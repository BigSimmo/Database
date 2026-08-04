// Exact live OCR failure: a flowchart edge and step number were flattened into
// comparator syntax. Keep comparator handling intentionally corpus-specific;
// generic clinical `<`/`>` expressions may name any measurement or scale.
const ectReferralFlowEdgePattern = /\breferral\s+for\s+ECT\s*:?\s*>\s*6(?!\d|\.\d)/i;

// Unambiguous arrow glyphs remain structural regardless of the surrounding
// label. Unlike `<` and `>`, these are not clinical comparison operators.
const explicitArrowStepPattern = /(?:->|=>|→|⇒)\s*(?:step\s*)?\d+(?:\.\d+)?\b/i;

/** Whether a bounded clause contains a flattened procedural flow edge. */
export function hasDanglingProceduralComparatorStepArtifact(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return ectReferralFlowEdgePattern.test(normalized) || explicitArrowStepPattern.test(normalized);
}

/** Whether any bounded source fragment contains a flattened procedural flow edge. */
export function containsDanglingProceduralComparatorStepArtifact(value: string | null | undefined) {
  if (!value) return false;
  // Check the reflowed field first so visual line wrapping cannot split the
  // known edge across two source lines. Sentence punctuation still prevents
  // the exact phrase from bridging independent clauses.
  if (hasDanglingProceduralComparatorStepArtifact(value)) return true;
  return value
    .split(/\r?\n+|(?<=[.!?])\s+|\s+[•|]\s+/)
    .some((fragment) => hasDanglingProceduralComparatorStepArtifact(fragment));
}
