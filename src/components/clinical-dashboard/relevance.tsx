import { metadataPillDensity } from "@/components/ui-primitives";
import type { EvidenceRelevance, SourceEvidenceRelevance } from "@/lib/types";

export function relevanceChipLabel(
  relevance: EvidenceRelevance | SourceEvidenceRelevance | null | undefined,
  grounded = false,
) {
  if (!relevance) return grounded ? "Source-backed" : "No direct support";
  if (relevance.verdict === "direct") return "Source-backed";
  if (relevance.verdict === "partial") return "Partial support";
  if (relevance.verdict === "nearby") return "Nearby only";
  return "No direct support";
}

export function hasStrongRelevanceIcon(
  relevance: EvidenceRelevance | SourceEvidenceRelevance | null | undefined,
  grounded = false,
) {
  const verdict = relevance?.verdict ?? (grounded ? "direct" : "none");
  return verdict === "direct" || verdict === "partial";
}

export function isWeakRelevance(relevance: EvidenceRelevance | SourceEvidenceRelevance | null | undefined) {
  return !relevance?.isSourceBacked || relevance.verdict === "nearby" || relevance.verdict === "none";
}

export function QueryCoverageChips({
  relevance,
  limit = 4,
}: {
  relevance?: SourceEvidenceRelevance | EvidenceRelevance | null;
  limit?: number;
}) {
  if (!relevance) return null;
  const chips =
    "chips" in relevance && relevance.chips.length
      ? relevance.chips
      : [
          relevance.matchedTerms.length ? `matched: ${relevance.matchedTerms.slice(0, 3).join(", ")}` : "",
          relevance.missingTerms.length ? `missing: ${relevance.missingTerms.slice(0, 3).join(", ")}` : "",
          relevanceChipLabel(relevance),
        ].filter(Boolean);
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.slice(0, limit).map((chip) => (
        <span key={chip} className={metadataPillDensity.dense}>
          {chip}
        </span>
      ))}
    </div>
  );
}
