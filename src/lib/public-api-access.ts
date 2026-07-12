import { createHash } from "node:crypto";
import type { createAdminClient } from "@/lib/supabase/admin";
import {
  consumeSubjectApiRateLimit,
  allowRateLimitInMemoryFallbackOnUnavailable,
  type ApiRateLimitResult,
} from "@/lib/api-rate-limit";
import { getOptionalAuthenticatedUser } from "@/lib/supabase/auth";

type AdminClient = ReturnType<typeof createAdminClient>;

export type RateLimitSubject = { kind: "owner"; ownerId: string } | { kind: "anonymous"; subjectKey: string };

function firstForwardedIp(value: string | null) {
  return value?.split(",")[0]?.trim() || "";
}

function requestIpSignal(request: Request) {
  return (
    firstForwardedIp(request.headers.get("cf-connecting-ip")) ||
    firstForwardedIp(request.headers.get("x-forwarded-for")) ||
    firstForwardedIp(request.headers.get("x-real-ip")) ||
    "unknown-ip"
  );
}

export function anonymousApiSubjectKey(request: Request) {
  // User-Agent is caller-controlled and therefore must not partition a quota:
  // rotating it would mint a fresh paid-answer allowance for every request.
  // If no trusted proxy IP is available, every unknown caller intentionally
  // shares the same conservative quota rather than failing open.
  const source = requestIpSignal(request);
  return `anon:${createHash("sha256").update(source).digest("hex").slice(0, 32)}`;
}

export function hasSessionCookieSignal(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  return cookieHeader.includes("sb-");
}

export function hasBearerAuthAttempt(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return /^Bearer\s+\S+/i.test(authorization);
}

/** True when the request may carry a durable Supabase session (cookie), not a bare bearer attempt. */
export function hasPublicApiAuthSignal(request: Request) {
  return hasSessionCookieSignal(request);
}

/** Anonymous callers with no cookie or bearer skip auth resolution and rate limits on curated public catalogs. */
export function shouldResolvePublicCatalogAccess(request: Request) {
  return hasSessionCookieSignal(request) || hasBearerAuthAttempt(request);
}

type OwnerScopedQuery<T> = {
  eq(column: string, value: unknown): T;
  is(column: string, value: null): T;
  or(filters: string): T;
};

/**
 * Scope reads to public rows (owner_id IS NULL) and, when signed in, the caller's owned rows.
 *
 * Anonymous callers intentionally see ONLY the public corpus (owner_id IS NULL). Documents pooled
 * under PUBLIC_WORKSPACE_OWNER_ID by anonymous uploads (see upload/route.ts) are a deliberate
 * moderation quarantine: they stay out of anonymous viewing here — and out of RAG retrieval, which
 * is gated separately on owner_id IS NULL — until an operator reviews and promotes them to
 * owner_id IS NULL via scripts/promote-public-documents.ts (or the 20260706120000 promote
 * migration). Do not union the pool owner in here without making that content-moderation decision.
 */
export function withOwnerReadScope<T extends OwnerScopedQuery<T>>(query: T, ownerId: string | undefined): T {
  if (ownerId) return query.or(`owner_id.eq.${ownerId},owner_id.is.null`);
  return query.is("owner_id", null);
}

export async function publicAccessContext(request: Request, supabase: AdminClient) {
  const user = await getOptionalAuthenticatedUser(request, supabase);
  if (user) {
    return {
      authenticated: true,
      ownerId: user.id,
      rateLimitSubject: { kind: "owner", ownerId: user.id } satisfies RateLimitSubject,
    };
  }

  return {
    authenticated: false,
    ownerId: undefined,
    rateLimitSubject: { kind: "anonymous", subjectKey: anonymousApiSubjectKey(request) } satisfies RateLimitSubject,
  };
}

export async function enforceDocumentReadRateLimit(
  request: Request,
  supabase: AdminClient,
): Promise<{ access: Awaited<ReturnType<typeof publicAccessContext>>; rateLimit: ApiRateLimitResult }> {
  const access = await publicAccessContext(request, supabase);
  const rateLimit = await consumeSubjectApiRateLimit({
    supabase,
    subject: access.rateLimitSubject,
    bucket: "document_read",
    allowInMemoryFallbackOnUnavailable: allowRateLimitInMemoryFallbackOnUnavailable(),
  });
  return { access, rateLimit };
}
