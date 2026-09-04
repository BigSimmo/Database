import { retrievalAccessScopeMatchesOwner, type RetrievalAccessScope } from "@/lib/owner-scope";
import type { RagContextSnapshot } from "@/lib/site-content/site-content-contracts";
import type { ContextPackAdmissionReceipt, SearchResult } from "@/lib/types";

const issuedAdmissionReceipts = new WeakSet<object>();

type ContextPackAdmissionInput = Omit<ContextPackAdmissionReceipt, "version">;

/** Issue an opaque, request-local receipt only after an authoritative retrieval boundary has validated its input. */
export function issueContextPackAdmissionReceipt(input: ContextPackAdmissionInput): ContextPackAdmissionReceipt {
  const siteContent = input.siteContent ? Object.freeze({ ...input.siteContent }) : null;
  const receipt = Object.freeze({ version: "context-pack-admission-v1" as const, ...input, siteContent });
  issuedAdmissionReceipts.add(receipt);
  return receipt;
}

function cachedAdmissionInput(value: unknown): ContextPackAdmissionInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const receipt = value as Record<string, unknown>;
  if (
    receipt.version !== "context-pack-admission-v1" ||
    (receipt.ownerId !== null && typeof receipt.ownerId !== "string") ||
    typeof receipt.sourcePolicyVersion !== "string" ||
    (receipt.indexGeneration !== null && typeof receipt.indexGeneration !== "string")
  )
    return null;
  let siteContent: ContextPackAdmissionInput["siteContent"] = null;
  if (receipt.siteContent !== null) {
    if (!receipt.siteContent || typeof receipt.siteContent !== "object" || Array.isArray(receipt.siteContent))
      return null;
    const site = receipt.siteContent as Record<string, unknown>;
    if (
      typeof site.releaseId !== "string" ||
      typeof site.releaseDigest !== "string" ||
      typeof site.changeEpoch !== "string"
    )
      return null;
    siteContent = { releaseId: site.releaseId, releaseDigest: site.releaseDigest, changeEpoch: site.changeEpoch };
  }
  return {
    ownerId: receipt.ownerId as string | null,
    sourcePolicyVersion: receipt.sourcePolicyVersion,
    indexGeneration: receipt.indexGeneration as string | null,
    siteContent,
  };
}

/** Reissue only receipts read through the already validated RAG cache boundary. */
export function restoreCachedContextPackAdmission(results: SearchResult[]) {
  return results.map((result) => {
    const input = cachedAdmissionInput(result.context_pack_admission);
    if (!input) {
      const { context_pack_admission, ...withoutAdmission } = result;
      void context_pack_admission;
      return withoutAdmission;
    }
    return { ...result, context_pack_admission: issueContextPackAdmissionReceipt(input) };
  });
}

export function contextPackAdmissionMatches(
  result: SearchResult,
  accessScope: RetrievalAccessScope,
  snapshot: RagContextSnapshot,
) {
  const receipt = result.context_pack_admission;
  if (!receipt || !issuedAdmissionReceipts.has(receipt) || receipt.version !== "context-pack-admission-v1")
    return false;
  if (!retrievalAccessScopeMatchesOwner(accessScope, receipt.ownerId)) return false;
  if (receipt.sourcePolicyVersion !== snapshot.sourcePolicyVersion) return false;
  if (result.corpus_scope === "clinical_kb_site") {
    const expected = snapshot.publicSiteContent;
    return Boolean(
      receipt.ownerId === null &&
      receipt.indexGeneration === null &&
      receipt.siteContent &&
      receipt.siteContent.releaseId === expected.releaseId &&
      receipt.siteContent.releaseDigest === expected.releaseDigest &&
      receipt.siteContent.changeEpoch === expected.changeEpoch,
    );
  }
  return receipt.siteContent === null && receipt.indexGeneration === snapshot.documentIndexGeneration;
}
