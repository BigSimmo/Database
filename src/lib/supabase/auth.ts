import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
