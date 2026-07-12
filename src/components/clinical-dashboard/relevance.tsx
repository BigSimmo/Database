import { CircleAlert, CircleCheck } from "lucide-react";

import { cn, metadataPill } from "@/components/ui-primitives";
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

function relevanceChipClasses(
  relevance: EvidenceRelevance | SourceEvidenceRelevance | null | undefined,
  grounded = false,
) {
  const verdict = relevance?.verdict ?? (grounded ? "direct" : "none");
  if (verdict === "direct") {
    return "border-[color:var(--success)]/20 bg-[color:var(--success-soft)]/45 text-[color:var(--success)]";
  }
  if (verdict === "partial") {
    return "border-[color:var(--primary)]/25 bg-[color:var(--primary-soft)]/45 text-[color:var(--primary)]";
  }
  return "border-[color:var(--warning)]/25 bg-[color:var(--warning-soft)]/45 text-[color:var(--warning)]";
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

export function RelevanceBadge({
  relevance,
  grounded = false,
  testId,
}: {
  relevance?: EvidenceRelevance | SourceEvidenceRelevance | null;
  grounded?: boolean;
  testId?: string;
}) {
  const showStrongIcon = hasStrongRelevanceIcon(relevance, grounded);
  const label = relevanceChipLabel(relevance, grounded);
  return (
    <span
      data-testid={testId}
      className={cn(
        "inline-flex min-h-7 items-center gap-1 rounded-md border px-2 text-2xs font-semibold leading-none sm:min-h-8 sm:gap-1.5 sm:px-2.5 sm:text-xs",
        relevanceChipClasses(relevance, grounded),
      )}
      aria-label={label}
      title={relevance?.supportReason ?? label}
    >
      {showStrongIcon ? (
        <CircleCheck aria-hidden="true" className="h-3.5 w-3.5" />
      ) : (
        <CircleAlert aria-hidden="true" className="h-3.5 w-3.5" />
      )}
      <span>{label}</span>
    </span>
  );
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
        <span key={chip} className={cn(metadataPill, "min-h-7 px-2 text-2xs")}>
          {chip}
        </span>
      ))}
    </div>
  );
}
