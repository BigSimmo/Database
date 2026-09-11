import { revalidateReviewedPolicyRequest } from "@/lib/rag/rag-reviewed-policy-input";
import { retainCanonicalSourcePolicyConflicts } from "@/lib/source-role-policy";
import type { SearchChunksArgs } from "@/lib/rag/rag-contracts";
import type { AnswerSection, SearchResult, SourcePolicyConflict, SourcePolicyConflictSide } from "@/lib/types";

function plain(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f<>\[\]\x60*_#\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function describeSide(side: SourcePolicyConflictSide): string {
  const dates = [
    side.publicationDate && "published " + plain(side.publicationDate),
    side.effectiveFrom && "effective " + plain(side.effectiveFrom),
  ]
    .filter(Boolean)
    .join(", ");
  return (
    plain(side.title) +
    " — " +
    plain(side.publisher) +
    "; " +
    dates +
    "; " +
    plain(side.jurisdiction) +
    "; " +
    plain(side.sourceRole.replaceAll("_", " ")) +
    "."
  );
}

/** Final cited rows and issued review authority are both required; a typed conflict alone is not authority. */
export function buildSourceConflictSection(
  conflict: SourcePolicyConflict,
  reconciledResults: SearchResult[],
  reviewRequest?: SearchChunksArgs,
): AnswerSection | null {
  if (!reviewRequest) return null;
  const reviewed = revalidateReviewedPolicyRequest(reviewRequest, reconciledResults);
  const canonical = reviewed.conflicts.find(
    (candidate) =>
      candidate.id === conflict.id &&
      candidate.topicKey === conflict.topicKey &&
      candidate.overlapReason === conflict.overlapReason &&
      candidate.materialDifferenceReason === conflict.materialDifferenceReason,
  );
  if (
    !canonical ||
    !retainCanonicalSourcePolicyConflicts({
      conflicts: [conflict],
      claimRole: canonical.claimRole,
      local: reconciledResults.filter((row) => row.corpus_scope === "uploaded_local"),
      australian: reconciledResults.filter((row) => row.corpus_scope === "australian_public"),
    }).length
  )
    return null;
  return {
    heading: "Guidance conflict",
    kind: "source_conflict",
    supportLevel: "direct",
    citation_chunk_ids: [
      ...new Set([...canonical.local.supportingChunkIds, ...canonical.australian.supportingChunkIds]),
    ],
    body: [
      describeSide(canonical.local),
      describeSide(canonical.australian),
      "Reviewed material difference: " +
        plain(canonical.materialDifferenceReason.replaceAll("_", " ")) +
        " (" +
        plain(canonical.overlapReason.replaceAll("_", " ")) +
        ").",
      "The uploaded guideline remains primary because it is current, valid, accessible and directly supportive.",
      "Flagged for review: " + plain(canonical.local.title) + ".",
    ].join(" "),
  };
}
