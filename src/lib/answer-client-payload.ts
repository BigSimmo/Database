import {
  projectBestSourceForClient,
  projectCitationForClient,
  projectDocumentLabelsForClient,
  projectIndexingQualityForClient,
  projectQuoteCardForClient,
  projectRelatedDocumentForClient,
  projectSmartPanelForClient,
  projectSourceMetadataForClient,
} from "@/lib/client-source-projection";
import type { RagAnswer, SearchResult } from "@/lib/types";

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
  interactionId: "client",
  feedbackToken: "client",
  answer: "client",
  grounded: "client",
  confidence: "client",
  citations: "client",
  sources: "client",
  supportedClaims: "client",
  evidenceAssessments: "client",
  retrievalDiagnostics: "client",
  modelUsed: "client",
  routingMode: "client",
  routingReason: "client",
  providerMode: "client",
  answerQualityTier: "client",
  fallbackReason: "client",
  degradedMode: "client",
  queryClass: "client",
  queryAnalysis: "client",
  responseMode: "client",
  comparisonMatrix: "client",
  comparisonEvaluationState: "client",
  preformatted: "client",
  latencyTimings: "client",
  openAIRequestIds: "client",
  openAIUsage: "client",
  answerSections: "client",
  evidenceSummary: "client",
  conflictsOrGaps: "client",
  sourceCoverage: "client",
  quoteCards: "client",
  visualEvidence: "client",
  bestSource: "client",
  documentBreakdown: "client",
  smartPanel: "client",
  relatedDocuments: "client",
  relevance: "client",
  memoryCardsUsed: "server",
  indexingVersion: "client",
  indexingQuality: "client",
  smartApiPlan: "client",
  scoreExplanations: "client",
  scope: "client",
  sourceGovernanceWarnings: "client",
  safetyWarnings: "client",
  truncated: "client",
  truncationReason: "client",
  unverifiedNumericTokens: "client",
  faithfulnessWarning: "client",
} as const satisfies Record<keyof RagAnswer, "client" | "server">;

function trimSourceForClient(source: SearchResult): SearchResult {
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
  if (source.source_metadata !== undefined) {
    trimmed.source_metadata = projectSourceMetadataForClient(source.source_metadata);
  }
  if (source.document_labels !== undefined) {
    trimmed.document_labels = projectDocumentLabelsForClient(source.document_labels);
  }
  if (source.indexing_quality !== undefined) {
    trimmed.indexing_quality = projectIndexingQualityForClient(source.indexing_quality);
  }
  // Full image/table objects remain available to generation and diagnostics,
  // but the answer UI resolves source media from the bounded image_ids list.
  trimmed.images = [];
  return trimmed;
}

type ClientAnswerProjectionInput = Pick<RagAnswer, "sources"> & Partial<RagAnswer>;

export function toClientAnswerPayload<T extends ClientAnswerProjectionInput>(answer: T): T {
  const payload = Object.fromEntries(
    (Object.keys(answerFieldPolicy) as Array<keyof RagAnswer>)
      .filter((key) => answerFieldPolicy[key] === "client" && Object.prototype.hasOwnProperty.call(answer, key))
      .map((key) => [key, answer[key]]),
  ) as T & Partial<RagAnswer>;
  payload.sources = answer.sources.map(trimSourceForClient);

  if (answer.citations !== undefined) {
    payload.citations = answer.citations.map(projectCitationForClient);
  }
  if (answer.quoteCards !== undefined) {
    payload.quoteCards = answer.quoteCards.map(projectQuoteCardForClient);
  }
  if (answer.bestSource !== undefined) {
    payload.bestSource = answer.bestSource ? projectBestSourceForClient(answer.bestSource) : null;
  }
  if (answer.relatedDocuments !== undefined) {
    payload.relatedDocuments = answer.relatedDocuments.map(projectRelatedDocumentForClient);
  }
  if (answer.smartPanel !== undefined) {
    payload.smartPanel = projectSmartPanelForClient(answer.smartPanel);
  }
  if (answer.safetyWarnings !== undefined) {
    payload.safetyWarnings = answer.safetyWarnings.map((warning) => ({
      ...warning,
      citation: projectCitationForClient(warning.citation),
    }));
  }

  return payload as T;
}
