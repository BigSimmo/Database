import "server-only";

import type { NextResponse } from "next/server";

import { isTeachingSecret } from "@/lib/teaching/checkin-token";

/**
 * The single-use claim a scan leaves in the scanning browser (spec §9). The cookie holds a
 * random secret; the database holds only its SHA-256 hash, for 10 minutes.
 *
 * Its Path is `/api/teaching/checkin`, where it is read. A browser sends a cookie only to paths
 * under its Path (RFC 6265 §5.1.4), so the contract's first draft, `/teaching`, would never have
 * reached `/api/teaching/checkin/complete`: every signed-out scan would have silently failed
 * after sign-in (review focus 1). It never goes to a page, so page scripts and other routes
 * never see it.
 */
export const TEACHING_CLAIM_COOKIE = "ps_teaching_claim";
export const TEACHING_CLAIM_PATH = "/api/teaching/checkin";
/** The database claim lasts 10 minutes; the cookie never outlives it. */
export const TEACHING_CLAIM_MAX_AGE_SECONDS = 600;

/** Railway ends TLS in front of the app, so the forwarded protocol is the one the browser used. */
function requestIsHttps(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  if (forwarded) return forwarded === "https";
  return new URL(request.url).protocol === "https:";
}

function claimCookieOptions(request: Request, maxAge: number) {
  return {
    path: TEACHING_CLAIM_PATH,
    maxAge,
    httpOnly: true,
    secure: requestIsHttps(request),
    sameSite: "lax" as const,
  };
}

export function setTeachingClaimCookie(response: NextResponse, request: Request, secret: string): NextResponse {
  response.cookies.set(TEACHING_CLAIM_COOKIE, secret, claimCookieOptions(request, TEACHING_CLAIM_MAX_AGE_SECONDS));
  return response;
}

/** Same name and Path, so the browser replaces and then drops it. */
export function clearTeachingClaimCookie(response: NextResponse, request: Request): NextResponse {
  response.cookies.set(TEACHING_CLAIM_COOKIE, "", claimCookieOptions(request, 0));
  return response;
}

/** The claim secret from the Cookie header, or null. A value not shaped like a secret is ignored. */
export function readTeachingClaimSecret(request: Request): string | null {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator <= 0 || part.slice(0, separator).trim() !== TEACHING_CLAIM_COOKIE) continue;
    const value = part.slice(separator + 1).trim();
    if (isTeachingSecret(value)) return value;
  }
  return null;
}
