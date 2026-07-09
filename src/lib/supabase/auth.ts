import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

type AdminClient = ReturnType<typeof createAdminClient>;

export type AuthenticatedUser = {
  id: string;
};

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

function extractBearerAccessToken(request: Request): string | null {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const headerToken = match?.[1]?.trim();
  return headerToken || null;
}

function extractCookieSessionAccessToken(request: Request): string | null {
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

function extractSessionAccessToken(request: Request): string | null {
  return extractBearerAccessToken(request) ?? extractCookieSessionAccessToken(request);
}

async function getUserFromAccessToken(supabase: AdminClient, token: string): Promise<AuthenticatedUser | null> {
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.id) return null;
  return { id: data.user.id };
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

/**
 * Resolve the user from the `@supabase/ssr` cookie session. The
 * `sb-<ref>-auth-token` cookie it writes is base64-encoded (and chunked when
 * large), which `extractCookieSessionAccessToken`'s plain-JSON parser cannot read, so
 * this uses the ssr server client to decode + validate it. Returns null when
 * the public env is absent or no `sb-` cookie is present.
 */
async function getUserFromRequestCookies(request: Request): Promise<AuthenticatedUser | null> {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const cookieHeader = request.headers.get("cookie");
  if (!url || !key || !cookieHeader || !cookieHeader.includes("sb-")) {
    return null;
  }

  const client = createServerClient(url, key, {
    cookies: {
      getAll() {
        return parseCookieHeader(cookieHeader).map(({ name, value }) => ({ name, value: value ?? "" }));
      },
      setAll() {
        // Read-only during the route-handler auth check; the proxy refreshes cookies.
      },
    },
  });

  const { data, error } = await client.auth.getUser();
  if (error || !data.user?.id) {
    return null;
  }
  return { id: data.user.id };
}

async function resolveOptionalAuthenticatedUser(
  request: Request,
  supabase: AdminClient,
): Promise<AuthenticatedUser | null> {
  const bearerToken = extractBearerAccessToken(request);
  if (bearerToken) {
    const bearerUser = await getUserFromAccessToken(supabase, bearerToken);
    if (bearerUser) return bearerUser;
  }

  const cookieToken = extractCookieSessionAccessToken(request);
  if (cookieToken && cookieToken !== bearerToken) {
    const cookieTokenUser = await getUserFromAccessToken(supabase, cookieToken);
    if (cookieTokenUser) return cookieTokenUser;
  }

  return getUserFromRequestCookies(request);
}

export async function requireAuthenticatedUser(request: Request, supabase: AdminClient): Promise<AuthenticatedUser> {
  const user = await resolveOptionalAuthenticatedUser(request, supabase);
  if (user) return user;
  throw new AuthenticationError();
}

export async function getOptionalAuthenticatedUser(
  request: Request,
  supabase: AdminClient,
): Promise<AuthenticatedUser | null> {
<<<<<<< HEAD
  const token = extractSessionAccessToken(request);
  if (token) {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user?.id) {
      throw new AuthenticationError();
    }
    return { id: data.user.id };
  }

  return getUserFromRequestCookies(request);
}
=======
  return resolveOptionalAuthenticatedUser(request, supabase);
}

// Retained for callers that only need a single token string.
export { extractSessionAccessToken };
>>>>>>> origin/main
