import { isDemoMode, isLocalNoAuthMode } from "@/lib/env";

export const PUBLIC_OWNER_FILTER_SENTINEL = "00000000-0000-0000-0000-000000000000";

export function requireOwnerScope(ownerId: string | null | undefined): string | undefined {
  if (ownerId) return ownerId;
  if (isDemoMode() || isLocalNoAuthMode() || process.env.NODE_ENV === "test") {
    return undefined;
  }
  throw new Error(
    "Owner-scoped retrieval was called without an ownerId; refusing to run to avoid returning another tenant's data.",
  );
}

export function retrievalOwnerFilter(args: {
  ownerId?: string | null;
  documentIds?: string[];
  allowGlobalSearch?: boolean;
}): string | null | undefined {
  if (args.ownerId) return requireOwnerScope(args.ownerId);
  if (isDemoMode() || isLocalNoAuthMode() || process.env.NODE_ENV === "test") {
    return undefined;
  }
  if (args.allowGlobalSearch || args.documentIds?.length) {
    return PUBLIC_OWNER_FILTER_SENTINEL;
  }
  throw new Error(
    "Owner-scoped retrieval was called without an ownerId; refusing to run to avoid returning another tenant's data.",
  );
}
