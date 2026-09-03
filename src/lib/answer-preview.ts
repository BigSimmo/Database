// #100 Phase 1 — verified evidence preview (server-only).
// Builds the single retrieval-complete verified unit defined in
// docs/verified-answer-incremental-delivery-design.md. The unit must reuse the
// production gates, never approximate them: the same danger-level
// source-governance decision that governs the final response, and the exact
// route-boundary source trim the final payload goes through. If the gates
// cannot permit disclosure the preview is simply absent — there is no weaker
// "stream-safe" variant.

import { trimSourceForClient } from "@/lib/answer-client-payload";
import { env } from "@/lib/env";
import { hasDangerSourceGovernanceWarning, sourceGovernanceWarnings } from "@/lib/source-governance";
import type { VerifiedEvidencePreviewUnit, VerifiedUnit } from "@/lib/answer-stream-contract";
import type { EvidenceRelevance, SearchResult, SourceGovernanceWarning } from "@/lib/types";

export type { VerifiedUnit };

const evidencePreviewMaxSources = 12;

/** Danger-level warnings split into the two kinds the preview must treat differently.
 *
 * A danger warning that names a `document_id` is attributable: that document is outdated or
 * poorly extracted, and excluding it removes the hazard exactly. A danger warning with no
 * document is an answer-level verdict — today only `WEAK_EVIDENCE`, raised when the retrieved
 * evidence does not back the question at all — and no per-document exclusion can answer it,
 * so it suppresses the whole preview.
 */
function partitionDangerWarnings(warnings: readonly SourceGovernanceWarning[]) {
  const danger = warnings.filter((warning) => warning.severity === "danger");
  return {
    hasAnswerLevelDanger: danger.some((warning) => !warning.document_id),
    dangerDocumentIds: new Set(danger.map((warning) => warning.document_id).filter((id): id is string => Boolean(id))),
  };
}

/**
 * Build the retrieval-complete evidence preview, or null when nothing may be disclosed.
 *
 * **The governance decision is per document, not per answer.** An earlier cut ran the
 * canonical danger check over the whole retrieval set and returned null on any hit, which
 * made one outdated or badly-OCR'd chunk anywhere in twelve-to-twenty-four retrieved
 * passages blank the entire rail — the feature read as broken rather than conservative, and
 * the sources it hid were the clean ones. Excluding the flagged documents instead is
 * strictly safer per card: a danger-level source can no longer appear as a preview card at
 * all, where the wide check merely delayed its appearance until the answer's own rail.
 *
 * What stays all-or-nothing is the answer-level verdict. `relevance.verdict === "none"`
 * says the retrieved evidence is unbacked, which is not a property of any one document, so
 * there is no subset that is safe to show.
 *
 * Still deliberately stricter than the final response's refusal in one respect: the final
 * gate only refuses grounded, supported answers, because unsupported/evidence-gap responses
 * withhold content anyway. At preview time the answer's support level is not yet known, so
 * the danger decision is applied unconditionally.
 */
export function buildEvidencePreviewUnit(args: {
  results: SearchResult[];
  relevance?: EvidenceRelevance | null;
}): VerifiedEvidencePreviewUnit | null {
  if (!args.results.length) return null;
  const warnings = sourceGovernanceWarnings({
    results: args.results,
    relevance: args.relevance ?? null,
  });
  if (!hasDangerSourceGovernanceWarning(warnings)) {
    return buildUnit(args.results);
  }

  const { hasAnswerLevelDanger, dangerDocumentIds } = partitionDangerWarnings(warnings);
  if (hasAnswerLevelDanger) return null;
  return buildUnit(args.results.filter((result) => !dangerDocumentIds.has(result.document_id)));
}

function buildUnit(results: SearchResult[]): VerifiedEvidencePreviewUnit | null {
  if (!results.length) return null;
  const selected = results.slice(0, evidencePreviewMaxSources);
  return {
    schemaVersion: 1,
    kind: "evidence_preview",
    sequence: 0,
    sources: selected.map(trimSourceForClient),
    // Counts what survived governance, never the wider retrieval set: the stream contract
    // requires selectedContextCount >= sources.length, and a count drawn from passages that
    // were excluded would describe evidence the preview is deliberately not showing.
    selectedContextCount: results.length,
  };
}

/** Keep the ranking event small and keep final-path reconciliation out of the RAG monolith. */
export function buildEvidencePreviewProgress(args: {
  normalResults: SearchResult[];
  fallbackResults: SearchResult[];
  relevance?: EvidenceRelevance | null;
}): { verifiedUnit?: VerifiedEvidencePreviewUnit } {
  if (!env.RAG_INCREMENTAL_EVIDENCE_PREVIEW) return {};
  const fallbackIds = new Set(args.fallbackResults.map((result) => result.id));
  const verifiedUnit = buildEvidencePreviewUnit({
    results: args.normalResults.filter((result) => fallbackIds.has(result.id)),
    relevance: args.relevance,
  });
  return verifiedUnit ? { verifiedUnit } : {};
}
