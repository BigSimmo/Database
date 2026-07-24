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

/**
 * Extracts the last non-empty IP address from a proxy forwarding header value.
 *
 * @param value - A comma-separated proxy forwarding header value
 * @returns The last trimmed IP address, or an empty string when no address is present
 */
function trustedProxyIp(value: string | null) {
  const forwarded = value
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const ip = forwarded?.at(-1) ?? "";

  // Strip IPv6 brackets and any port (e.g. [2001:db8::1]:443 -> 2001:db8::1)
  if (ip.startsWith("[")) {
    const endPos = ip.indexOf("]");
    if (endPos !== -1) return ip.slice(1, endPos);
  }

  // Strip IPv4 port (e.g. 192.0.2.1:8080 -> 192.0.2.1)
  // Bare IPv6 addresses have multiple colons, so only split if there is exactly one colon
  const colonIndex = ip.indexOf(":");
  if (colonIndex !== -1 && colonIndex === ip.lastIndexOf(":")) {
    return ip.slice(0, colonIndex);
  }

  return ip;
}

/**
 * Determines the request's source IP from trusted proxy forwarding headers.
 *
 * @param request - The request containing the proxy forwarding headers
 * @returns The last non-empty address from `x-forwarded-for`, the address from `x-real-ip`, or `"unknown-ip"` when neither header provides an address
 */
function requestIpSignal(request: Request) {
  return (
    trustedProxyIp(request.headers.get("x-forwarded-for")) ||
    trustedProxyIp(request.headers.get("x-real-ip")) ||
    "unknown-ip"
  );
}

/**
 * Creates a stable anonymous rate-limit subject key from the request's trusted proxy IP signal.
 *
 * @param request - The request from which to derive the IP signal
 * @returns A prefixed, truncated SHA-256 hash of the source IP signal
 */
export function anonymousApiSubjectKey(request: Request) {
  // Trust only the deployment proxy's appended forwarding entry. Ignore the
  // caller-controlled Cloudflare/User-Agent values and any leading XFF entries:
  // Railway appends the trusted client address at the right edge of the chain.
  // If no trusted proxy IP is available, every unknown caller intentionally
  // shares the same conservative quota rather than failing open.
  const source = requestIpSignal(request);
  return `anon:${createHash("sha256").update(source).digest("hex").slice(0, 32)}`;
}

type OwnerScopedQuery<T> = {
  eq(column: string, value: unknown): T;
  is(column: string, value: null): T;
  or(filters: string): T;
};

/**
 * Scope reads to public rows (owner_id IS NULL) and, when signed in, the caller's owned rows.
 *
 * Anonymous callers intentionally see ONLY the public corpus (owner_id IS NULL). Uploads are
 * administrator-only; newly uploaded owner-scoped documents remain private until the existing
 * publication-review workflow promotes them to the public corpus.
 */
export function withOwnerReadScope<T extends OwnerScopedQuery<T>>(query: T, ownerId: string | undefined): T {
  if (ownerId) return query.or(`owner_id.eq.${ownerId},owner_id.is.null`);
  return query.is("owner_id", null);
}

// Owner-internal document columns that must never be exposed on a row the caller does not own.
// `withOwnerReadScope` lets an authenticated caller read PUBLIC documents (owner_id IS NULL) that
// belong to nobody; those rows must not leak the storage location, dedup hash, import provenance,
// raw stage error, or free-form `metadata` of the operator who ingested them. `metadata` is
// arbitrary and can carry owner-internal provenance (e.g. the bulk-edit author's user id, prior
// titles, indexing internals), so — matching the anonymous list projection and the `[id]` detail
// route — it is stripped for non-owners rather than surfaced as governance data.
const NON_OWNER_INTERNAL_DOCUMENT_FIELDS = [
  "storage_path",
  "content_hash",
  "source_path",
  "import_batch_id",
  "error_message",
  "metadata",
] as const;

/** True when `viewerOwnerId` is set and owns the row (i.e. the caller's own document). */
export function callerOwnsDocumentRow(row: { owner_id?: unknown }, viewerOwnerId: string | undefined): boolean {
  return Boolean(viewerOwnerId) && row.owner_id === viewerOwnerId;
}

/**
 * Strip operator-internal storage fields from a document row unless the caller owns it.
 *
 * No-op for owned rows and for rows already selected without those columns (e.g. the anonymous
 * public projection), so it is safe to map over every returned row regardless of caller identity.
 */
export function redactNonOwnedDocumentFields<T extends Record<string, unknown>>(
  row: T,
  viewerOwnerId: string | undefined,
): T {
  if (callerOwnsDocumentRow(row, viewerOwnerId)) return row;
  const redacted = { ...row };
  for (const field of NON_OWNER_INTERNAL_DOCUMENT_FIELDS) {
    delete redacted[field];
  }
  return redacted;
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
