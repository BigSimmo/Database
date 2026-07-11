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
// the FULL answer and must run before this trim (both routes do).

// Longest snippet the source cards can usefully show; the render policy falls
// back to `content` only when `retrieval_synopsis` is absent.
const clientSourceContentMaxChars = 700;

function truncateAtWordBoundary(text: string, maxChars: number) {
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(" ");
  return `${slice.slice(0, lastSpace > maxChars * 0.6 ? lastSpace : maxChars).trimEnd()}…`;
}

function trimSourceForClient(source: SearchResult): SearchResult {
  const trimmed: SearchResult = {
    ...source,
    content: truncateAtWordBoundary(source.content ?? "", clientSourceContentMaxChars),
  };
  delete trimmed.adjacent_context;
  delete trimmed.memory_cards;
  delete trimmed.table_facts;
  delete trimmed.index_unit;
  delete trimmed.document_summary;
  return trimmed;
}

export function toClientAnswerPayload<T extends Pick<RagAnswer, "sources">>(answer: T): T {
  if (!answer.sources?.length) return answer;
  return { ...answer, sources: answer.sources.map(trimSourceForClient) };
}
