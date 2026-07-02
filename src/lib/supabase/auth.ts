import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env, isLocalNoAuthMode } from "@/lib/env";
import { isSafeLocalProjectRequest } from "@/lib/local-project-guard";

type AdminClient = ReturnType<typeof createAdminClient>;

export type AuthenticatedUser = {
  id: string;
};

const LOCAL_OWNER_CACHE_TTL_MS = 5 * 60_000;

type LocalOwnerResolutionState = {
  cache: {
    cacheKey: string;
    expiresAt: number;
    user: AuthenticatedUser;
  } | null;
  inFlight: {
    cacheKey: string;
    promise: Promise<AuthenticatedUser>;
  } | null;
};

type GlobalWithLocalOwnerResolutionState = typeof globalThis & {
  __clinicalKbLocalOwnerResolutionState?: LocalOwnerResolutionState;
};

const localOwnerResolutionState = ((
  globalThis as GlobalWithLocalOwnerResolutionState
).__clinicalKbLocalOwnerResolutionState ??= {
  cache: null,
  inFlight: null,
});

function readCookies(cookieHeader: string | null): Map<string, string> {
  if (!cookieHeader) return new Map<string, string>();

  const cookies = new Map<string, string>();
  for (const rawPart of cookieHeader.split(";")) {
    const trimmed = rawPart.trim();
    const firstEq = trimmed.indexOf("=");
    if (firstEq <= 0) continue;

    const name = trimmed.slice(0, firstEq).trim();
    const encodedValue = trimmed.slice(firstEq + 1).trim();
    if (!name) continue;

    try {
      cookies.set(name, decodeURIComponent(encodedValue));
    } catch {
      cookies.set(name, encodedValue);
    }
  }
  return cookies;
}

function extractSessionAccessToken(request: Request): string | null {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const headerToken = match?.[1]?.trim();
  if (headerToken) return headerToken;

  const cookies = readCookies(request.headers.get("cookie"));
  const legacyAccessToken = cookies.get("sb-access-token")?.trim();
  if (legacyAccessToken) return legacyAccessToken;

  for (const [name, value] of cookies.entries()) {
    if (!/^sb-.+-auth-token$/.test(name)) continue;
    if (!value) continue;

    try {
      const parsed = JSON.parse(value);
      const accessToken = typeof parsed?.access_token === "string" ? parsed.access_token.trim() : "";
      if (accessToken) return accessToken;
    } catch {
      // Optional legacy auth-cookie format; ignore invalid payloads.
    }
  }

  return null;
}

export class AuthenticationError extends Error {
  constructor(message = "Authentication required.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export function unauthorizedResponse(error?: AuthenticationError) {
  void error;
  return NextResponse.json({ error: "Authentication required." }, { status: 401 });
}

export async function requireAuthenticatedUser(request: Request, supabase: AdminClient): Promise<AuthenticatedUser> {
  if (isLocalNoAuthMode()) {
    if (!isSafeLocalProjectRequest(request)) {
      throw new AuthenticationError("Use the ensured Clinical KB local URL before calling private APIs.");
    }
    return resolveLocalNoAuthUser(supabase);
  }

  const token = extractSessionAccessToken(request);

  if (!token) {
    throw new AuthenticationError();
  }

  const { data, error } = await supabase.auth.getUser(token);
  const userId = data.user?.id;

  if (error || !userId) {
    throw new AuthenticationError();
  }

  return { id: userId };
}

async function resolveLocalNoAuthUser(supabase: AdminClient): Promise<AuthenticatedUser> {
  const configuredOwnerId = env.LOCAL_NO_AUTH_OWNER_ID?.trim();
  if (configuredOwnerId) {
    if (!isUuid(configuredOwnerId)) {
      throw new Error("LOCAL_NO_AUTH_OWNER_ID must be a valid UUID.");
    }
    return { id: configuredOwnerId };
  }

  const configuredOwnerEmail = env.LOCAL_NO_AUTH_OWNER_EMAIL?.trim();
  const cacheKey = `email:${configuredOwnerEmail?.toLowerCase() ?? ""}:documents-fallback`;
  const now = Date.now();

  if (localOwnerResolutionState.cache?.cacheKey === cacheKey && localOwnerResolutionState.cache.expiresAt > now) {
    return localOwnerResolutionState.cache.user;
  }

  if (localOwnerResolutionState.inFlight?.cacheKey === cacheKey) {
    return localOwnerResolutionState.inFlight.promise;
  }

  const promise = resolveLocalNoAuthOwnerId(supabase, configuredOwnerEmail).then((ownerId) => {
    const user = { id: ownerId };
    localOwnerResolutionState.cache = {
      cacheKey,
      expiresAt: Date.now() + LOCAL_OWNER_CACHE_TTL_MS,
      user,
    };
    return user;
  });

  localOwnerResolutionState.inFlight = { cacheKey, promise };

  try {
    return await promise;
  } finally {
    if (localOwnerResolutionState.inFlight?.promise === promise) {
      localOwnerResolutionState.inFlight = null;
    }
  }
}

async function resolveLocalNoAuthOwnerId(supabase: AdminClient, configuredOwnerEmail?: string) {
  const ownerIdFromEmail = await resolveOwnerByEmail(supabase, configuredOwnerEmail);
  if (ownerIdFromEmail) return ownerIdFromEmail;

  const fallbackOwnerId = await resolveOwnerFromDocuments(supabase);
  if (fallbackOwnerId) return fallbackOwnerId;

  throw new Error(
    "Local no-auth mode is enabled, but no owner could be resolved. Set LOCAL_NO_AUTH_OWNER_ID or " +
      "LOCAL_NO_AUTH_OWNER_EMAIL, or ensure the documents table has at least one row with owner_id.",
  );
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function resolveOwnerByEmail(supabase: AdminClient, ownerEmail?: string) {
  if (!ownerEmail) return null;

  const normalizedEmail = ownerEmail.trim().toLowerCase();
  if (!normalizedEmail) return null;

  let page = 1;
  const seenPages = new Set<number>();

  while (page > 0) {
    if (seenPages.has(page)) {
      throw new Error("Failed to resolve owner by email because the admin user listing returned a pagination loop.");
    }
    seenPages.add(page);

    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) {
      throw new Error(`Failed to resolve local owner from email: ${error.message}`);
    }
    if (!data?.users?.length) break;

    const found = data.users.find((user) => user.email?.toLowerCase() === normalizedEmail);
    if (found?.id) return found.id;

    page = typeof data.nextPage === "number" ? data.nextPage : 0;
  }

  return null;
}

async function resolveOwnerFromDocuments(supabase: AdminClient) {
  const { data, error } = await supabase
    .from("documents")
    .select("owner_id")
    .not("owner_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve local owner fallback from documents: ${error.message}`);
  }

  return data?.owner_id ?? null;
}
