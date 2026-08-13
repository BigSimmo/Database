// #100 Phase 1 — verified evidence preview (server-only).
// Builds the single retrieval-complete verified unit defined in
// docs/verified-answer-incremental-delivery-design.md. The unit must reuse the
// production gates, never approximate them: the same danger-level
// source-governance decision that governs the final response, and the exact
// route-boundary source trim the final payload goes through. If the gates
// cannot permit disclosure the preview is simply absent — there is no weaker
// "stream-safe" variant.

import { trimSourceForClient } from "@/lib/answer-client-payload";
import { hasDangerSourceGovernanceWarning, sourceGovernanceWarnings } from "@/lib/source-governance";
import type { VerifiedEvidencePreviewUnit } from "@/lib/answer-stream-contract";
import type { EvidenceRelevance, SearchResult } from "@/lib/types";

const evidencePreviewMaxSources = 12;

/**
 * Build the retrieval-complete evidence preview, or null when nothing may be disclosed.
 *
 * Deliberately stricter than the final response's refusal: the final gate only refuses
 * grounded, supported answers over danger-level sources, because unsupported/evidence-gap
 * responses withhold content anyway. At preview time the answer's support level is not yet
 * known, so ANY danger-level governance warning suppresses the preview — a preview must
 * never disclose source content the final governed response might withhold.
 */
export function buildEvidencePreviewUnit(args: {
  /** Sources guaranteed to be present in the final response on this route. */
  results: SearchResult[];
  /** Full final-candidate set used for the governing disclosure decision. */
  governanceResults?: SearchResult[];
  relevance?: EvidenceRelevance | null;
}): VerifiedEvidencePreviewUnit | null {
  if (!args.results.length) return null;
  const warnings = sourceGovernanceWarnings({
    results: args.governanceResults ?? args.results,
    relevance: args.relevance ?? null,
  });
  if (hasDangerSourceGovernanceWarning(warnings)) return null;
  const selected = args.results.slice(0, evidencePreviewMaxSources);
  return {
    schemaVersion: 1,
    kind: "evidence_preview",
    sequence: 0,
    sources: selected.map(trimSourceForClient),
    selectedContextCount: args.results.length,
  };
}
