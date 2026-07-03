import { isDemoMode, isLocalNoAuthMode } from "@/lib/env";

/**
 * Fail-closed guard for multi-tenant owner scoping.
 *
 * The hybrid retrieval RPCs treat a null `owner_filter` as "all owners"
 * (fail-open), so calling them without an ownerId would silently return another
 * tenant's data. Call this at every retrieval RPC boundary that filters by
 * owner. In a real (multi-user) deployment a missing ownerId throws instead of
 * leaking; in demo / local-no-auth / the test runner there is no multi-tenancy,
 * so it stays permissive (returns undefined, preserving the previous behaviour).
 *
 * See the owner-scoping isolation audit.
 */
export function requireOwnerScope(ownerId: string | null | undefined): string | undefined {
  if (ownerId) return ownerId;
  if (isDemoMode() || isLocalNoAuthMode() || process.env.NODE_ENV === "test") {
    return undefined;
  }
  throw new Error(
    "Owner-scoped retrieval was called without an ownerId; refusing to run to avoid returning another tenant's data.",
  );
}
