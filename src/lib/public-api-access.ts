import { createHash } from "node:crypto";
import type { createAdminClient } from "@/lib/supabase/admin";
import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
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
  const userAgent = request.headers.get("user-agent")?.slice(0, 180) || "unknown-agent";
  const source = `${requestIpSignal(request)}\n${userAgent}`;
  return `anon:${createHash("sha256").update(source).digest("hex").slice(0, 32)}`;
}

export function hasPublicApiAuthSignal(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  if (/^Bearer\s+\S+/i.test(authorization)) return true;

  const cookieHeader = request.headers.get("cookie") ?? "";
  return cookieHeader.includes("sb-");
}

type OwnerScopedQuery<T> = {
  eq(column: string, value: unknown): T;
  is(column: string, value: null): T;
};

/** Scope document reads to the authenticated owner or public (owner_id IS NULL) rows. */
export function withOwnerReadScope<T extends OwnerScopedQuery<T>>(query: T, ownerId: string | undefined): T {
  if (ownerId) return query.eq("owner_id", ownerId);
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
