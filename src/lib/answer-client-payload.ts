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
// Ordering contract: sourceGovernanceWarnings and logAnswerDiagnostics consume
// the FULL answer and must run before this trim (both routes do). Full source
// content remains client-visible because the safety panel scans it for clinical
// warnings that may occur beyond the display synopsis.

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
  images: "client",
} as const satisfies Record<keyof SearchResult, "client" | "server">;

function trimSourceForClient(source: SearchResult): SearchResult {
  const trimmed = Object.fromEntries(
    (Object.keys(sourceFieldPolicy) as Array<keyof SearchResult>)
      .filter((key) => sourceFieldPolicy[key] === "client" && key in source)
      .map((key) => [key, source[key]]),
  ) as SearchResult;
  trimmed.content = source.content ?? "";
  trimmed.images ??= [];
  return trimmed;
}

export function toClientAnswerPayload<T extends Pick<RagAnswer, "sources">>(answer: T): T {
  if (!answer.sources?.length) return answer;
  return { ...answer, sources: answer.sources.map(trimSourceForClient) };
}
