import type { RagAnswer, RagQueryClass, SearchResult } from "@/lib/types";
import { selectAustralianClinicalContext } from "@/lib/australian-source-priority";

export { summarizeAustralianSourceSelection } from "@/lib/australian-source-priority";

const fastRoutineModelContextLimit = 4;

const maxContextChunksPerDocument = 3;

// P9: keep one verbose document from dominating the sources the model sees. Cap each document to at
// most `maxContextChunksPerDocument` chunks (order-preserving, no reranking/dedup), but only when the
// result set spans multiple documents — a genuinely single-document answer must not be starved.
export function capPerDocumentCrowding(results: SearchResult[], maxPerDocument = maxContextChunksPerDocument) {
  if (results.length <= maxPerDocument) return results;
  const distinctDocuments = new Set(results.map((result) => result.document_id)).size;
  if (distinctDocuments < 2) return results;
  const documentCounts = new Map<string, number>();
  const capped: SearchResult[] = [];
  for (const result of results) {
    const count = documentCounts.get(result.document_id) ?? 0;
    if (count >= maxPerDocument) continue;
    documentCounts.set(result.document_id, count + 1);
    capped.push(result);
  }
  return capped;
}

export function selectModelContextResults(args: {
  routeMode: RagAnswer["routingMode"];
  queryClass: RagQueryClass;
  crossDocument: boolean;
  results: SearchResult[];
}) {
  if (args.queryClass === "medication_dose_risk" || args.queryClass === "table_threshold") {
    return selectAustralianClinicalContext(args.results);
  }
  const results = capPerDocumentCrowding(args.results);
  if (args.routeMode !== "fast") return results;
  if (args.crossDocument || args.queryClass === "comparison" || args.queryClass === "broad_summary") {
    return results;
  }
  return results.slice(0, fastRoutineModelContextLimit);
}
