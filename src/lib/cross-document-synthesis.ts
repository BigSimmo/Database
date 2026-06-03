import type { RagQueryClass, SearchResult } from "@/lib/types";
import { sourceTextForModel } from "@/lib/source-text-sanitizer";

export type CrossDocumentSynthesisPlan = {
  enabled: boolean;
  reason: "single_document" | "routine_multi_document" | "comparison" | "broad_summary" | "explicit_cross_document";
  results: SearchResult[];
  documentCount: number;
  selectedDocumentCount: number;
  selectedSourceCount: number;
  maxPerDocument: number;
};

export type CrossDocumentFusionBrief = {
  text: string;
  documentCount: number;
  bulletCount: number;
  sourceChunkIds: string[];
};

const crossDocumentQueryPattern =
  /\b(?:across|combine|combined|synthesi[sz]e|together|overall|all documents|these documents|different documents|multiple documents|several documents|from the documents)\b/i;

const comparisonQueryPattern = /\b(?:compare|compared|versus|vs|between|difference\w*|conflict\w*)\b/i;

function score(result: SearchResult) {
  return result.hybrid_score ?? result.similarity ?? 0;
}

function documentCount(results: SearchResult[]) {
  return new Set(results.map((result) => result.document_id)).size;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[^a-z0-9/%<>.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function queryTokens(query: string) {
  const stopWords = new Set([
    "what",
    "which",
    "when",
    "where",
    "should",
    "could",
    "would",
    "across",
    "these",
    "those",
    "documents",
    "document",
    "guidance",
    "summary",
    "summarize",
    "summarise",
    "consider",
  ]);
  return Array.from(
    new Set(
      normalizeText(query)
        .split(/\s+/)
        .map((token) => (token.endsWith("s") && !token.endsWith("ss") ? token.slice(0, -1) : token))
        .filter((token) => token.length > 2 && !stopWords.has(token)),
    ),
  );
}

function compact(value: string, limit: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 3).trim()}...`;
}

function candidateSentences(result: SearchResult) {
  const memoryText = (result.memory_cards ?? [])
    .slice(0, 4)
    .map((card) => `${card.card_type}: ${card.content}`)
    .join(". ");
  return sourceTextForModel(`${memoryText}. ${result.section_heading ?? ""}. ${result.content}`)
    .split(/\r?\n|(?<=[.!?])\s+/)
    .map((sentence) => compact(sentence, 260))
    .filter(
      (sentence) =>
        sentence.length >= 24 &&
        !/\b(?:document owner|authorisation|references|uncontrolled when printed)\b/i.test(sentence),
    );
}

function bestDocumentPoint(query: string, results: SearchResult[]) {
  const tokens = queryTokens(query);
  const candidates = results.flatMap((result) =>
    candidateSentences(result).map((sentence) => {
      const normalized = normalizeText(sentence);
      const tokenHits = tokens.filter((token) => normalized.includes(token)).length;
      const clinicalSignal =
        /\b(?:must|should|required|monitor|escalat|risk|dose|mg|mcg|threshold|urgent|review|withhold|cease|avoid|baseline|hours?|days?)\b/i.test(
          sentence,
        )
          ? 1.25
          : 0;
      return {
        result,
        sentence,
        score: tokenHits * 1.6 + clinicalSignal + score(result),
      };
    }),
  );
  return candidates.sort((a, b) => b.score - a.score || a.sentence.length - b.sentence.length)[0] ?? null;
}

function isCrossDocumentIntent(query: string, queryClass: RagQueryClass) {
  return queryClass === "comparison" || queryClass === "broad_summary" || crossDocumentQueryPattern.test(query);
}

function planReason(query: string, queryClass: RagQueryClass, documents: number): CrossDocumentSynthesisPlan["reason"] {
  if (documents <= 1) return "single_document";
  if (queryClass === "comparison" || comparisonQueryPattern.test(query)) return "comparison";
  if (queryClass === "broad_summary") return "broad_summary";
  if (crossDocumentQueryPattern.test(query)) return "explicit_cross_document";
  return "routine_multi_document";
}

export function balanceCrossDocumentResults(
  results: SearchResult[],
  options: { limit?: number; maxPerDocument?: number; minDocuments?: number } = {},
) {
  const limit = options.limit ?? 8;
  const maxPerDocument = options.maxPerDocument ?? 2;
  const minDocuments = options.minDocuments ?? Math.min(4, documentCount(results));
  const byDocument = new Map<string, SearchResult[]>();

  for (const result of results) {
    byDocument.set(result.document_id, [...(byDocument.get(result.document_id) ?? []), result]);
  }
  for (const [documentId, documentResults] of byDocument) {
    byDocument.set(
      documentId,
      [...documentResults].sort((a, b) => score(b) - score(a) || a.chunk_index - b.chunk_index),
    );
  }

  const selected: SearchResult[] = [];
  const selectedIds = new Set<string>();
  const rankedDocuments = [...byDocument.entries()].sort(
    ([, a], [, b]) => score(b[0]) - score(a[0]) || (b[0].text_rank ?? 0) - (a[0].text_rank ?? 0),
  );

  for (const [, documentResults] of rankedDocuments.slice(0, minDocuments)) {
    const best = documentResults[0];
    if (!best || selectedIds.has(best.id)) continue;
    selected.push(best);
    selectedIds.add(best.id);
    if (selected.length >= limit) return selected;
  }

  const counts = new Map<string, number>();
  for (const result of selected) counts.set(result.document_id, (counts.get(result.document_id) ?? 0) + 1);

  for (const result of results) {
    if (selected.length >= limit) break;
    if (selectedIds.has(result.id)) continue;
    const count = counts.get(result.document_id) ?? 0;
    if (count >= maxPerDocument) continue;
    selected.push(result);
    selectedIds.add(result.id);
    counts.set(result.document_id, count + 1);
  }

  for (const result of results) {
    if (selected.length >= limit) break;
    if (selectedIds.has(result.id)) continue;
    selected.push(result);
    selectedIds.add(result.id);
  }

  return selected.sort((a, b) => {
    const selectedScoreDiff = score(b) - score(a);
    return selectedScoreDiff || a.title.localeCompare(b.title) || a.chunk_index - b.chunk_index;
  });
}

export function buildCrossDocumentSynthesisPlan(
  query: string,
  results: SearchResult[],
  queryClass: RagQueryClass,
): CrossDocumentSynthesisPlan {
  const documents = documentCount(results);
  const reason = planReason(query, queryClass, documents);
  const enabled = documents > 1 && isCrossDocumentIntent(query, queryClass);
  const maxPerDocument = queryClass === "comparison" ? 2 : 2;
  const limit = queryClass === "comparison" || queryClass === "broad_summary" ? 8 : 6;
  const balanced = enabled
    ? balanceCrossDocumentResults(results, {
        limit,
        maxPerDocument,
        minDocuments: Math.min(documents, queryClass === "comparison" ? 5 : 4),
      })
    : results;

  return {
    enabled,
    reason,
    results: balanced,
    documentCount: documents,
    selectedDocumentCount: documentCount(balanced),
    selectedSourceCount: balanced.length,
    maxPerDocument,
  };
}

export function buildCrossDocumentSourceGuide(results: SearchResult[]) {
  const grouped = new Map<string, { title: string; pages: Set<number>; chunks: string[] }>();
  for (const result of results) {
    const existing = grouped.get(result.document_id) ?? {
      title: result.title,
      pages: new Set<number>(),
      chunks: [],
    };
    if (result.page_number) existing.pages.add(result.page_number);
    existing.chunks.push(result.id);
    grouped.set(result.document_id, existing);
  }

  if (grouped.size <= 1) return "";

  return `Cross-document synthesis guide:
${[...grouped.values()]
  .map((document, index) => {
    const pages = [...document.pages].sort((a, b) => a - b).join(", ") || "page unavailable";
    return `${index + 1}. ${document.title}: use pages ${pages}; source chunks ${document.chunks.slice(0, 3).join(", ")}`;
  })
  .join("\n")}`;
}

export function buildCrossDocumentFusionBrief(query: string, results: SearchResult[]): CrossDocumentFusionBrief {
  const byDocument = new Map<string, SearchResult[]>();
  for (const result of results) {
    byDocument.set(result.document_id, [...(byDocument.get(result.document_id) ?? []), result]);
  }

  if (byDocument.size <= 1) {
    return { text: "", documentCount: byDocument.size, bulletCount: 0, sourceChunkIds: [] };
  }

  const points = [...byDocument.values()]
    .map((documentResults) => bestDocumentPoint(query, documentResults))
    .filter((point): point is NonNullable<typeof point> => Boolean(point))
    .sort((a, b) => score(b.result) - score(a.result));

  const sourceChunkIds = points.map((point) => point.result.id);
  const text = `Fast fused source brief:
${points
  .map((point, index) => {
    const page = point.result.page_number ? `p.${point.result.page_number}` : "page unavailable";
    return `${index + 1}. ${point.result.title} (${page}): ${point.sentence}`;
  })
  .join("\n")}`;

  return {
    text,
    documentCount: byDocument.size,
    bulletCount: points.length,
    sourceChunkIds,
  };
}
