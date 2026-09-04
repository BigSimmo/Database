import { citationFromResult, documentCitationHref } from "@/lib/citations";
import type {
  BestSourceRecommendation,
  ClinicalQueryMode,
  RagAnswer,
  SearchResult,
  SearchScopeSummary,
} from "@/lib/types";

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
  authorityTrustCapRequired: "client",
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

export type ClientSearchResult = Pick<
  SearchResult,
  | "id"
  | "document_id"
  | "title"
  | "file_name"
  | "page_number"
  | "chunk_index"
  | "section_heading"
  | "section_path"
  | "heading_level"
  | "parent_heading"
  | "anchor_id"
  | "content"
  | "retrieval_synopsis"
  | "image_ids"
  | "similarity"
  | "similarity_origin"
  | "text_rank"
  | "hybrid_score"
  | "lexical_score"
  | "rrf_score"
  | "score_explanation"
  | "source_strength"
  | "source_metadata"
  | "document_labels"
  | "memory_score"
  | "relevance"
  | "match_explanation"
  | "indexing_quality"
>;

export type ClientSearchScopeSummary = Pick<
  SearchScopeSummary,
  "summary" | "activeFilterCount" | "matchedDocumentCount" | "warnings" | "queryMode"
>;

export type ClientDegradedMode = {
  active: boolean;
  reason?: string | null;
};

type ClientAnswerScalarKey = Exclude<
  ClientAnswerKey,
  "sources" | "scope" | "degradedMode" | "retrievalGateBlocked" | "authorityTrustCapRequired"
>;

export type ClientRagAnswerPayload = Pick<RagAnswer, ClientAnswerScalarKey> & {
  sources: ClientSearchResult[];
  scope?: ClientSearchScopeSummary;
  degradedMode?: ClientDegradedMode;
  retrievalGateBlocked?: boolean;
  authorityTrustCapRequired?: boolean;
};

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
): ClientSearchScopeSummary {
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
export function trimSourceForClient(source: SearchResult): ClientSearchResult {
  const renderedSnippet = (source.retrieval_synopsis ?? source.content ?? "").trim();
  const content =
    renderedSnippet.length <= clientSourceSnippetMaxChars
      ? renderedSnippet
      : `${renderedSnippet.slice(0, clientSourceSnippetMaxChars - 1).trimEnd()}…`;
  return {
    id: source.id,
    document_id: source.document_id,
    title: source.title,
    file_name: source.file_name,
    page_number: source.page_number,
    chunk_index: source.chunk_index,
    section_heading: source.section_heading,
    content,
    image_ids: source.image_ids,
    similarity: source.similarity,
    ...(source.section_path === undefined ? {} : { section_path: source.section_path }),
    ...(source.heading_level === undefined ? {} : { heading_level: source.heading_level }),
    ...(source.parent_heading === undefined ? {} : { parent_heading: source.parent_heading }),
    ...(source.anchor_id === undefined ? {} : { anchor_id: source.anchor_id }),
    ...(source.retrieval_synopsis == null ? {} : { retrieval_synopsis: content }),
    ...(source.similarity_origin === undefined ? {} : { similarity_origin: source.similarity_origin }),
    ...(source.text_rank === undefined ? {} : { text_rank: source.text_rank }),
    ...(source.hybrid_score === undefined ? {} : { hybrid_score: source.hybrid_score }),
    ...(source.lexical_score === undefined ? {} : { lexical_score: source.lexical_score }),
    ...(source.rrf_score === undefined ? {} : { rrf_score: source.rrf_score }),
    ...(source.score_explanation === undefined ? {} : { score_explanation: source.score_explanation }),
    ...(source.source_strength === undefined ? {} : { source_strength: source.source_strength }),
    ...(source.source_metadata === undefined ? {} : { source_metadata: source.source_metadata }),
    ...(source.document_labels === undefined ? {} : { document_labels: source.document_labels }),
    ...(source.memory_score === undefined ? {} : { memory_score: source.memory_score }),
    ...(source.relevance === undefined ? {} : { relevance: source.relevance }),
    ...(source.match_explanation === undefined ? {} : { match_explanation: source.match_explanation }),
    ...(source.indexing_quality === undefined ? {} : { indexing_quality: source.indexing_quality }),
  };
}

export function authorityTrustCapRequired(answer: RagAnswer): boolean {
  if (answer.authorityTrustCapRequired === true) return true;
  const capAllClaims = process.env.NEXT_PUBLIC_RAG_TRUST_CAP_ALL_CLAIMS === "true";
  const gatedClaims = capAllClaims
    ? (answer.supportedClaims ?? [])
    : (answer.supportedClaims ?? []).filter((claim) => claim.riskClass === "high_risk");
  if (gatedClaims.length === 0) return false;
  return !gatedClaims.every(
    (claim) =>
      claim.supportStatus === "direct" &&
      claim.supportingChunkIds.length > 0 &&
      claim.supportingChunkIds.every((chunkId) => {
        const authority = answer.evidenceAssessments?.[chunkId]?.authority;
        return authority === "approved" || authority === "locally_reviewed";
      }),
  );
}

function directSupportingBestSource(answer: RagAnswer): BestSourceRecommendation | null {
  const directlySupportingId = (answer.supportedClaims ?? [])
    .filter((claim) => claim.supportStatus === "direct")
    .flatMap((claim) => claim.supportingChunkIds)[0];
  const source = answer.sources.find((candidate) => candidate.id === directlySupportingId);
  if (!source) return null;
  const citation = citationFromResult(source, "deterministic_support");
  return {
    ...citation,
    source_strength: source.source_strength ?? "limited",
    score: source.hybrid_score ?? source.similarity,
    snippet: source.retrieval_synopsis ?? source.content,
    section_heading: source.section_heading,
    image_count: source.image_ids.length,
    viewer_href: documentCitationHref(citation),
  };
}

export function toClientAnswerPayload(answer: RagAnswer): ClientRagAnswerPayload {
  const bestSource = directSupportingBestSource(answer) ?? answer.bestSource;
  return {
    answer: answer.answer,
    grounded: answer.grounded,
    confidence: answer.confidence,
    citations: answer.citations,
    sources: (answer.sources ?? []).map(trimSourceForClient),
    retrievalGateBlocked: answer.retrievalGateBlocked === true || answer.retrievalDiagnostics?.gateStatus === "blocked",
    authorityTrustCapRequired: authorityTrustCapRequired(answer),
    ...(answer.routingMode === undefined ? {} : { routingMode: answer.routingMode }),
    ...(answer.providerMode === undefined ? {} : { providerMode: answer.providerMode }),
    ...(answer.answerQualityTier === undefined ? {} : { answerQualityTier: answer.answerQualityTier }),
    ...(answer.fallbackReasonCode === undefined ? {} : { fallbackReasonCode: answer.fallbackReasonCode }),
    ...(answer.queryClass === undefined ? {} : { queryClass: answer.queryClass }),
    ...(answer.responseMode === undefined ? {} : { responseMode: answer.responseMode }),
    ...(answer.comparisonMatrix === undefined ? {} : { comparisonMatrix: answer.comparisonMatrix }),
    ...(answer.comparisonEvaluationState === undefined
      ? {}
      : { comparisonEvaluationState: answer.comparisonEvaluationState }),
    ...(answer.preformatted === undefined ? {} : { preformatted: answer.preformatted }),
    ...(answer.answerSections === undefined ? {} : { answerSections: answer.answerSections }),
    ...(answer.evidenceSummary === undefined ? {} : { evidenceSummary: answer.evidenceSummary }),
    ...(answer.conflictsOrGaps === undefined ? {} : { conflictsOrGaps: answer.conflictsOrGaps }),
    ...(answer.sourceCoverage === undefined ? {} : { sourceCoverage: answer.sourceCoverage }),
    ...(answer.quoteCards === undefined ? {} : { quoteCards: answer.quoteCards }),
    ...(answer.visualEvidence === undefined ? {} : { visualEvidence: answer.visualEvidence }),
    ...(bestSource === undefined ? {} : { bestSource }),
    ...(answer.documentBreakdown === undefined ? {} : { documentBreakdown: answer.documentBreakdown }),
    ...(answer.relatedDocuments === undefined ? {} : { relatedDocuments: answer.relatedDocuments }),
    ...(answer.relevance === undefined ? {} : { relevance: answer.relevance }),
    ...(answer.scope ? { scope: toClientSearchScopeSummary(answer.scope, answer.scope.queryMode) } : {}),
    ...(answer.sourceGovernanceWarnings === undefined
      ? {}
      : { sourceGovernanceWarnings: answer.sourceGovernanceWarnings }),
    ...(answer.safetyWarnings === undefined ? {} : { safetyWarnings: answer.safetyWarnings }),
    ...(answer.truncated === undefined ? {} : { truncated: answer.truncated }),
    ...(answer.truncationReason === undefined ? {} : { truncationReason: answer.truncationReason }),
    ...(answer.unverifiedNumericTokens === undefined
      ? {}
      : { unverifiedNumericTokens: answer.unverifiedNumericTokens }),
    ...(answer.faithfulnessWarning === undefined ? {} : { faithfulnessWarning: answer.faithfulnessWarning }),
  };
}
