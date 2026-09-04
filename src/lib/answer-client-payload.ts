import type { ClinicalQueryMode, RagAnswer, SearchResult, SearchScopeSummary } from "@/lib/types";

// Route-boundary trim of the answer payload. The retrieval pipeline carries
// full chunk text plus server-only context on every source (adjacent_context
// for generation packing, memory cards, table facts, index-unit matches,
// document summaries), but the client renders only a snippet
// (retrieval_synopsis ?? content) plus identity, scoring, governance, and
// label fields. Trimming at the route boundary — never inside rag.ts — keeps
// caches, generation inputs, and eval behavior byte-identical while cutting
// the final SSE/JSON event the user waits on after the prose has streamed.
//
// Ordering contract: source-governance/safety derivation and diagnostics consume
// the FULL answer and must run before this trim (both routes do). The browser
// receives only the same bounded snippet the source UI renders; explicit
// server-derived safetyWarnings preserve findings beyond that display window.

const clientSourceSnippetMaxChars = 900;

const sourceFieldPolicy = {
  id: "client",
  document_id: "client",
  title: "client",
  file_name: "client",
  page_number: "client",
  chunk_index: "client",
  section_heading: "client",
  section_path: "client",
  heading_level: "client",
  parent_heading: "client",
  anchor_id: "client",
  content: "client",
  retrieval_synopsis: "client",
  image_ids: "client",
  similarity: "client",
  corpus_scope: "server",
  site_content_domain: "server",
  context_pack_admission: "server",
  similarity_origin: "client",
  text_rank: "client",
  hybrid_score: "client",
  lexical_score: "client",
  rrf_score: "client",
  score_explanation: "client",
  source_strength: "client",
  source_metadata: "client",
  document_labels: "client",
  document_summary: "server",
  adjacent_context: "server",
  memory_cards: "server",
  memory_score: "client",
  relevance: "client",
  match_explanation: "client",
  table_facts: "server",
  index_unit: "server",
  indexing_quality: "client",
  images: "server",
} as const satisfies Record<keyof SearchResult, "client" | "server">;

const answerFieldPolicy = {
  interactionId: "server",
  feedbackToken: "server",
  answer: "client",
  grounded: "client",
  confidence: "client",
  citations: "client",
  sources: "client",
  supportedClaims: "server",
  evidenceAssessments: "server",
  retrievalDiagnostics: "server",
  retrievalGateBlocked: "client",
  modelUsed: "server",
  routingMode: "client",
  routingReason: "server",
  providerMode: "client",
  answerQualityTier: "client",
  fallbackReasonCode: "client",
  fallbackReason: "server",
  degradedMode: "server",
  queryClass: "client",
  queryAnalysis: "server",
  responseMode: "client",
  comparisonMatrix: "client",
  comparisonEvaluationState: "client",
  preformatted: "client",
  latencyTimings: "server",
  openAIRequestIds: "server",
  openAIUsage: "server",
  answerSections: "client",
  evidenceSummary: "client",
  conflictsOrGaps: "client",
  sourceCoverage: "client",
  quoteCards: "client",
  visualEvidence: "client",
  bestSource: "client",
  documentBreakdown: "client",
  smartPanel: "server",
  relatedDocuments: "client",
  relevance: "client",
  memoryCardsUsed: "server",
  indexingVersion: "server",
  indexingQuality: "server",
  smartApiPlan: "server",
  scoreExplanations: "server",
  scope: "client",
  sourceGovernanceWarnings: "client",
  safetyWarnings: "client",
  truncated: "client",
  truncationReason: "client",
  unverifiedNumericTokens: "client",
  faithfulnessWarning: "client",
} as const satisfies Record<keyof RagAnswer, "client" | "server">;

type ClientAnswerKey = {
  [Key in keyof typeof answerFieldPolicy]: (typeof answerFieldPolicy)[Key] extends "client" ? Key : never;
}[keyof typeof answerFieldPolicy];

export type ClientRagAnswerPayload = Pick<RagAnswer, ClientAnswerKey>;

const scopeSummaryMaxChars = 300;
const scopeWarningMaxChars = 240;
const scopeWarningMaxCount = 5;

function boundedScopeText(value: unknown, maximum: number): string {
  if (typeof value !== "string") return "";
  const normalized = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.length <= maximum ? normalized : `${normalized.slice(0, maximum - 1).trimEnd()}…`;
}

/** Allowlisted route/client projection. Resolved document ids and raw filters never cross this boundary. */
export function toClientSearchScopeSummary(
  scope: Pick<SearchScopeSummary, "summary" | "activeFilterCount" | "matchedDocumentCount" | "warnings">,
  queryMode?: ClinicalQueryMode,
): SearchScopeSummary {
  const activeFilterCount = Number.isFinite(scope.activeFilterCount)
    ? Math.max(0, Math.min(1_000, Math.trunc(scope.activeFilterCount)))
    : 0;
  const matchedDocumentCount =
    scope.matchedDocumentCount == null || !Number.isFinite(scope.matchedDocumentCount)
      ? null
      : Math.max(0, Math.min(1_000_000, Math.trunc(scope.matchedDocumentCount)));
  return {
    summary: boundedScopeText(scope.summary, scopeSummaryMaxChars),
    activeFilterCount,
    matchedDocumentCount,
    warnings: (Array.isArray(scope.warnings) ? scope.warnings : [])
      .slice(0, scopeWarningMaxCount)
      .map((warning) => boundedScopeText(warning, scopeWarningMaxChars))
      .filter(Boolean),
    ...(queryMode === undefined ? {} : { queryMode }),
  };
}

/** Exported for the verified evidence preview (#100), which must cross the route
 * boundary through the exact same trim as the final payload — never a copy of it. */
export function trimSourceForClient(source: SearchResult): SearchResult {
  const trimmed = Object.fromEntries(
    (Object.keys(sourceFieldPolicy) as Array<keyof SearchResult>)
      .filter((key) => sourceFieldPolicy[key] === "client" && key in source)
      .map((key) => [key, source[key]]),
  ) as SearchResult;
  const renderedSnippet = (source.retrieval_synopsis ?? source.content ?? "").trim();
  trimmed.content =
    renderedSnippet.length <= clientSourceSnippetMaxChars
      ? renderedSnippet
      : `${renderedSnippet.slice(0, clientSourceSnippetMaxChars - 1).trimEnd()}…`;
  if (source.retrieval_synopsis != null) trimmed.retrieval_synopsis = trimmed.content;
  // Full image/table objects remain available to generation and diagnostics,
  // but the answer UI resolves source media from the bounded image_ids list.
  trimmed.images = [];
  return trimmed;
}

export function toClientAnswerPayload(answer: RagAnswer): ClientRagAnswerPayload {
  const payload = Object.fromEntries(
    (Object.keys(answerFieldPolicy) as Array<keyof RagAnswer>)
      .filter((key) => answerFieldPolicy[key] === "client" && key in answer)
      .map((key) => [key, (answer as Partial<RagAnswer>)[key]]),
  ) as ClientRagAnswerPayload;
  payload.sources = (answer.sources ?? []).map(trimSourceForClient);
  payload.retrievalGateBlocked =
    answer.retrievalGateBlocked === true || answer.retrievalDiagnostics?.gateStatus === "blocked";
  if (answer.scope) payload.scope = toClientSearchScopeSummary(answer.scope, answer.scope.queryMode);
  return payload;
}
