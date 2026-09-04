import { retrievalAccessScopeMatchesOwner, type RetrievalAccessScope } from "@/lib/owner-scope";
import type { RagContextSnapshot } from "@/lib/site-content/site-content-contracts";
import type { ContextPackAdmissionReceipt, SearchResult } from "@/lib/types";

const issuedAdmissionReceipts = new WeakSet<object>();

type ContextPackAdmissionInput = Omit<ContextPackAdmissionReceipt, "version">;

/** Issue an opaque, request-local receipt only after an authoritative retrieval boundary has validated its input. */
export function issueContextPackAdmissionReceipt(input: ContextPackAdmissionInput): ContextPackAdmissionReceipt {
  const siteContent = input.siteContent ? Object.freeze({ ...input.siteContent }) : null;
  const document = input.document ? Object.freeze({ ...input.document }) : null;
  const receipt = Object.freeze({ version: "context-pack-admission-v1" as const, ...input, document, siteContent });
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
  let document: ContextPackAdmissionInput["document"] = null;
  if (receipt.document !== null) {
    if (!receipt.document || typeof receipt.document !== "object" || Array.isArray(receipt.document)) return null;
    const identity = receipt.document as Record<string, unknown>;
    if (
      identity.corpusScope !== "australian_public" ||
      typeof identity.documentId !== "string" ||
      !identity.documentId ||
      typeof identity.chunkId !== "string" ||
      !identity.chunkId
    )
      return null;
    document = {
      corpusScope: "australian_public",
      documentId: identity.documentId,
      chunkId: identity.chunkId,
    };
  }
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
  if (document && siteContent) return null;
  return {
    ownerId: receipt.ownerId as string | null,
    sourcePolicyVersion: receipt.sourcePolicyVersion,
    indexGeneration: receipt.indexGeneration as string | null,
    document,
    siteContent,
  };
}

/** Reissue only receipts read through the already validated RAG cache boundary. */
export function restoreCachedContextPackAdmission(results: SearchResult[]): SearchResult[] {
  return results.map((result) => {
    const input = cachedAdmissionInput(result.context_pack_admission);
    const documentMatches = Boolean(
      input?.document &&
      result.corpus_scope === "australian_public" &&
      result.source_metadata?.corpus_scope === "australian_public" &&
      input.document.documentId === result.document_id &&
      input.document.chunkId === result.id,
    );
    const siteMatches = Boolean(
      input?.siteContent &&
      !input.document &&
      result.corpus_scope === "clinical_kb_site" &&
      result.source_metadata?.corpus_scope === "clinical_kb_site",
    );
    if (!input || (!documentMatches && !siteMatches)) {
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
      receipt.document === null &&
      receipt.siteContent &&
      receipt.siteContent.releaseId === expected.releaseId &&
      receipt.siteContent.releaseDigest === expected.releaseDigest &&
      receipt.siteContent.changeEpoch === expected.changeEpoch,
    );
  }
  if (result.corpus_scope === "australian_public") {
    return Boolean(
      result.source_metadata?.corpus_scope === "australian_public" &&
      receipt.siteContent === null &&
      receipt.indexGeneration === snapshot.documentIndexGeneration &&
      receipt.document?.corpusScope === "australian_public" &&
      receipt.document.documentId === result.document_id &&
      receipt.document.chunkId === result.id,
    );
  }
  // Uploaded-local and international receipt authorities are introduced by P16.
  return false;
}
