import type { SearchResult } from "@/lib/types";
import {
  analyzeClinicalQuery,
  riskZoneActionPattern,
  riskZoneContextPattern,
  zoneContextPatternsForQuery,
} from "@/lib/clinical-search";
import { isClinicalImageEvidence } from "@/lib/image-filtering";
import { evidenceTextForGate } from "@/lib/rag/rag-answer-support";
import { hasDirectTitleSupport } from "@/lib/rag/rag-routing";

// Extracted from rag.ts (maturity X3): pure query/evidence gate predicates that
// decide fast-path eligibility and evidence sufficiency. Behaviour-preserving —
// the function bodies are byte-identical to their previous rag.ts definitions.

/** Normalize document alias text. */
function normalizeDocumentAliasText(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Has document alias without top title support. */
export function hasDocumentAliasWithoutTopTitleSupport(query: string, results: SearchResult[]) {
  const aliases = analyzeClinicalQuery(query)
    .documentTitleTerms.map(normalizeDocumentAliasText)
    .filter((term) => term.length > 3);
  if (!aliases.length) return false;

  return !results.slice(0, 5).some((result) => {
    if (result.match_explanation?.titleHit || result.match_explanation?.labelHit) return true;
    const title = normalizeDocumentAliasText(`${result.title} ${result.file_name}`);
    return aliases.some((alias) => title.includes(alias));
  });
}

/** Has admission community lookup intent. */
export function hasAdmissionCommunityLookupIntent(query: string) {
  const normalized = normalizeDocumentAliasText(query);
  return /\badmission\b/.test(normalized) && /\bcommunity\b/.test(normalized);
}

/** Has admission community title support. */
export function hasAdmissionCommunityTitleSupport(results: SearchResult[]) {
  return results.slice(0, 5).some((result) => {
    if (result.match_explanation?.titleHit || result.match_explanation?.labelHit) {
      const title = normalizeDocumentAliasText(`${result.title} ${result.file_name}`);
      return /\badmission\b/.test(title) && /\bcommunity\b/.test(title);
    }
    const title = normalizeDocumentAliasText(`${result.title} ${result.file_name}`);
    return (
      title.includes("admission of community patient") ||
      title.includes("admission community pt") ||
      title.includes("admission to discharge for community")
    );
  });
}

/** Top evidence text. */
export function topEvidenceText(results: SearchResult[], limit = 5) {
  return results.slice(0, limit).map(evidenceTextForGate).join(" ");
}

/** Has any term. */
export function hasAnyTerm(text: string, pattern: RegExp) {
  return pattern.test(text);
}

/** Is risk flowchart next step query. */
export function isRiskFlowchartNextStepQuery(query: string) {
  return (
    /\b(?:flow\s*chart|flowchart|algorithm|pathway|risk[\s-]*matrix)\b/i.test(query) &&
    riskZoneContextPattern.test(query) &&
    /\b(?:next step|step after|after|action)\b/i.test(query)
  );
}

/** Has risk flowchart action evidence. */
export function hasRiskFlowchartActionEvidence(query: string, results: SearchResult[], limit = 5) {
  // A single result must carry BOTH the zone context and the action language
  // (escalate / urgent review): scattering the two term groups across different
  // results (or their image captions) let unrelated risk-assessment flowcharts
  // pass. Deliberately does NOT require a flowchart word in the evidence — the
  // escalation protocols that answer a red-zone question express the flowchart's
  // decision steps as prose ("has any Purple or Red Zone criteria ... escalate
  // for Senior Clinician Review") without ever saying "flowchart".
  //
  // The shared patterns are scoped to the colour the query names (a red-zone
  // question must not fast-path on an amber-zone chunk); for risk-matrix /
  // flowchart visual units the bare cell colour token counts as zone context.
  const { zonePhrasePattern, bareColourPattern } = zoneContextPatternsForQuery(query);
  return results.slice(0, limit).some((result) => {
    const evidenceText = evidenceTextForGate(result);
    if (!riskZoneActionPattern.test(evidenceText)) return false;
    if (zonePhrasePattern.test(evidenceText)) return true;
    return (
      ["risk_matrix_cell", "flowchart_step", "diagram_decision"].includes(result.index_unit?.unit_type ?? "") &&
      bareColourPattern.test(evidenceText)
    );
  });
}

/** Has dose amount evidence for gate. */
export function hasDoseAmountEvidenceForGate(result: SearchResult) {
  return /\b\d+(?:\.\d+)?\s?(?:mg|mcg|micrograms?|milligrams?|ug|[µμ]g)\b/i.test(evidenceTextForGate(result));
}

/** Has route evidence for gate. */
export function hasRouteEvidenceForGate(result: SearchResult) {
  return /\b(?:oral|orally|intramuscular|intramuscularly|subcutaneous|subcutaneously|subcut|sublingual|sublingually|\bim\b|\bpo\b|\bsc\b|\bsl\b)\b/i.test(
    evidenceTextForGate(result),
  );
}

/** Has administration frequency evidence for gate. */
export function hasFrequencyEvidenceForGate(result: SearchResult) {
  return /\b(?:once|twice|daily|nightly|weekly|monthly|hourly|prn|bd|tds|qds|qid|every\s+\d+(?:\.\d+)?\s*(?:hours?|days?|weeks?)|\d+\s+times?\s+(?:a|per)\s+(?:day|week|hour))\b/i.test(
    evidenceTextForGate(result),
  );
}

/** Has direct source image evidence. */
export function hasDirectSourceImageEvidence(result: SearchResult) {
  const sourceImageIds = new Set(
    [result.index_unit?.source_image_id, ...(result.table_facts ?? []).map((fact) => fact.source_image_id)].filter(
      Boolean,
    ) as string[],
  );
  return (
    sourceImageIds.size > 0 ||
    (result.images ?? []).some(
      (image) => sourceImageIds.has(image.id) || isClinicalImageEvidence(image) || image.source_kind === "table_crop",
    )
  );
}

/** Source image required for query. */
export function sourceImageRequiredForQuery(query: string) {
  return (
    /\b(?:show|display|attach|open|view|source|original)\b/i.test(query) &&
    /\b(?:image|table|chart|figure|crop|visual)\b/i.test(query)
  );
}

/** Direct title or alias support. */
export function directTitleOrAliasSupport(query: string, results: SearchResult[]) {
  return (
    hasDirectTitleSupport(query, results) ||
    results.slice(0, 5).some((result) => result.match_explanation?.titleHit || result.match_explanation?.labelHit)
  );
}
