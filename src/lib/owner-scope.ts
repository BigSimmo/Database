import { isDemoMode, isLocalNoAuthMode } from "@/lib/env";

export const PUBLIC_OWNER_FILTER_SENTINEL = "00000000-0000-0000-0000-000000000000";

// Demo / local-no-auth / test have no authenticated owner. These used to return
// `undefined`, which reaches the retrieval RPCs as a NULL owner_filter — and
// retrieval_owner_matches(NULL, …) previously failed OPEN (matched every tenant's
// rows). Return the public sentinel instead, so these modes see only the shared
// public (null-owner) corpus. Combined with the DB fail-closed change (migration
// 20260708160000_retrieval_owner_matches_fail_closed), no legitimate caller ever
// passes NULL. See docs/tenancy-defense-in-depth-review.md §6.
export function requireOwnerScope(ownerId: string | null | undefined): string {
  if (ownerId) return ownerId;
  if (isDemoMode() || isLocalNoAuthMode() || process.env.NODE_ENV === "test") {
    return PUBLIC_OWNER_FILTER_SENTINEL;
  }
  throw new Error(
    "Owner-scoped retrieval was called without an ownerId; refusing to run to avoid returning another tenant's data.",
  );
}

export function retrievalOwnerFilter(args: {
  ownerId?: string | null;
  documentIds?: string[];
  allowGlobalSearch?: boolean;
}): string {
  if (args.ownerId) return requireOwnerScope(args.ownerId);
  if (isDemoMode() || isLocalNoAuthMode() || process.env.NODE_ENV === "test") {
    return PUBLIC_OWNER_FILTER_SENTINEL;
  }
  if (args.allowGlobalSearch || args.documentIds?.length) {
    return PUBLIC_OWNER_FILTER_SENTINEL;
  }
  throw new Error(
    "Owner-scoped retrieval was called without an ownerId; refusing to run to avoid returning another tenant's data.",
  );
}
