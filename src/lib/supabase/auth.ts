import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import { env } from "@/lib/env";
import { PublicApiError, jsonError } from "@/lib/http";
import { isAdministratorAppMetadata } from "@/lib/authorization";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export type AuthenticatedUser = {
  id: string;
  appMetadata: Record<string, unknown>;
};

export type OptionalAuthenticationResult =
  { status: "absent" } | { status: "valid"; user: AuthenticatedUser } | { status: "invalid" };

type AuthenticationRequirement = {
  administrator?: boolean;
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

function configuredSupabaseProjectRef(): string | null {
  if (env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const hostname = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.toLowerCase();
      const match = hostname.match(/^([a-z0-9]+)\.supabase\.co$/);
      if (match?.[1]) return match[1];
    } catch {
      // Invalid public URLs are rejected by env parsing; retain the explicit-ref fallback for tests and local tooling.
    }
  }

  const explicitRef = env.SUPABASE_PROJECT_REF?.trim().toLowerCase();
  return explicitRef && /^[a-z0-9]+$/.test(explicitRef) ? explicitRef : null;
}

function configuredSessionCookieName(): string | null {
  const projectRef = configuredSupabaseProjectRef();
  return projectRef ? `sb-${projectRef}-auth-token` : null;
}

function extractCurrentCookieSessionAccessToken(request: Request): string | null {
  const cookies = readCookies(request.headers.get("cookie"));
  const cookieName = configuredSessionCookieName();
  const value = cookieName ? cookies.get(cookieName) : undefined;
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    const accessToken = typeof parsed?.access_token === "string" ? parsed.access_token.trim() : "";
    if (accessToken) return accessToken;
  } catch {
    // The current SSR format can be base64-encoded; the server client validates it below.
  }

  return null;
}

function extractLegacyCookieSessionAccessToken(request: Request): string | null {
  return readCookies(request.headers.get("cookie")).get("sb-access-token")?.trim() || null;
}

function hasCurrentSessionCookie(request: Request): boolean {
  const cookies = readCookies(request.headers.get("cookie"));
  const cookieName = configuredSessionCookieName();
  if (!cookieName) {
    // Without a configured project, a presented Supabase session cannot be validated and must fail closed.
    return [...cookies.keys()].some((name) => /^sb-.+-auth-token(?:\.\d+)?$/.test(name));
  }
  return [...cookies.keys()].some(
    (name) =>
      name === cookieName || (name.startsWith(`${cookieName}.`) && /^\d+$/.test(name.slice(cookieName.length + 1))),
  );
}

function hasLegacySessionCookie(request: Request): boolean {
  return readCookies(request.headers.get("cookie")).has("sb-access-token");
}

function extractSessionAccessToken(request: Request): string | null {
  return (
    extractBearerAccessToken(request) ??
    extractCurrentCookieSessionAccessToken(request) ??
    extractLegacyCookieSessionAccessToken(request)
  );
}

async function getUserFromAccessToken(supabase: AdminClient, token: string): Promise<AuthenticatedUser | null> {
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.id) return null;
  return { id: data.user.id, appMetadata: data.user.app_metadata ?? {} };
}

export class AuthenticationError extends PublicApiError {
  constructor(message = "Authentication required.") {
    super(message, 401, { code: "authentication_required" });
    this.name = "AuthenticationError";
  }
}

export function unauthorizedResponse(error?: AuthenticationError) {
  void error;
  // Route through the shared error envelope so 401s carry a stable `code`/`message`
  // like every other API failure (and inherit its `Cache-Control: private, no-store`).
  // `log: false` keeps a routine unauthenticated request from being recorded as a
  // server-side error.
  return jsonError(new AuthenticationError(), 401, { log: false });
}

/**
 * Resolve the user from the `@supabase/ssr` cookie session. The
 * `sb-<ref>-auth-token` cookie it writes is base64-encoded (and chunked when
 * large), which `extractCurrentCookieSessionAccessToken`'s plain-JSON parser cannot read, so
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
  return { id: data.user.id, appMetadata: data.user.app_metadata ?? {} };
}

export async function resolveOptionalAuthentication(
  request: Request,
  supabase: AdminClient,
): Promise<OptionalAuthenticationResult> {
  if (request.headers.has("authorization")) {
    const bearerToken = extractBearerAccessToken(request);
    if (!bearerToken) return { status: "invalid" };

    const bearerUser = await getUserFromAccessToken(supabase, bearerToken);
    return bearerUser ? { status: "valid", user: bearerUser } : { status: "invalid" };
  }

  const currentCookieToken = extractCurrentCookieSessionAccessToken(request);
  if (currentCookieToken) {
    const currentCookieUser = await getUserFromAccessToken(supabase, currentCookieToken);
    return currentCookieUser ? { status: "valid", user: currentCookieUser } : { status: "invalid" };
  }

  if (hasCurrentSessionCookie(request)) {
    const currentCookieUser = await getUserFromRequestCookies(request);
    return currentCookieUser ? { status: "valid", user: currentCookieUser } : { status: "invalid" };
  }

  const legacyCookieToken = extractLegacyCookieSessionAccessToken(request);
  if (legacyCookieToken) {
    const legacyCookieUser = await getUserFromAccessToken(supabase, legacyCookieToken);
    return legacyCookieUser ? { status: "valid", user: legacyCookieUser } : { status: "invalid" };
  }

  return hasLegacySessionCookie(request) ? { status: "invalid" } : { status: "absent" };
}

export async function requireAuthenticatedUser(
  request: Request,
  supabase: AdminClient,
  requirement: AuthenticationRequirement = {},
): Promise<AuthenticatedUser> {
  const authentication = await resolveOptionalAuthentication(request, supabase);
  if (authentication.status !== "valid") {
    throw new AuthenticationError(
      authentication.status === "invalid" ? "Invalid authentication credentials." : undefined,
    );
  }
  const { user } = authentication;
  if (requirement.administrator && !isAdministratorAppMetadata(user.appMetadata)) {
    throw new PublicApiError("Administrator access required.", 403, { code: "administrator_required" });
  }
  return user;
}

export async function getOptionalAuthenticatedUser(
  request: Request,
  supabase: AdminClient,
): Promise<AuthenticatedUser | null> {
  const authentication = await resolveOptionalAuthentication(request, supabase);
  if (authentication.status === "invalid") {
    throw new AuthenticationError("Invalid authentication credentials.");
  }
  return authentication.status === "valid" ? authentication.user : null;
}

// Retained for callers that only need a single token string.
export { extractSessionAccessToken };
