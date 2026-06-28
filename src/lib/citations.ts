import type { Citation, SearchResult } from "@/lib/types";

export function citationFromResult(result: SearchResult): Citation {
  return {
    chunk_id: result.id,
    document_id: result.document_id,
    title: result.title,
    file_name: result.file_name,
    page_number: result.page_number,
    chunk_index: result.chunk_index,
    similarity: result.similarity,
    source_metadata: result.source_metadata,
  };
}

export function formatCitationLabel(citation: Citation) {
  const page = citation.page_number ? `p. ${citation.page_number}` : "source";
  return `${citation.title || citation.file_name}, ${page}`;
}

export function formatCompactCitationLabel(citation: Pick<Citation, "title" | "file_name" | "page_number">) {
  const rawTitle = (citation.title || citation.file_name || "Source").replace(/^Synthetic\s+/i, "");
  // Derive the compact label from the actual document title (first 1–2
  // significant words). Do NOT special-case drug/keyword names: this chip is the
  // affordance that tells a clinician which source they are opening, so
  // collapsing every "...Risk..." title to "Risk", or dropping "lithium" when
  // "clozapine" also appears, mislabels the cited source.
  const shortTitle =
    rawTitle
      .replace(/\.(pdf|docx|xlsx|txt)$/i, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .join(" ") || "Source";
  const page = citation.page_number ? `p.${citation.page_number}` : "source";
  return `${shortTitle} ${page}`;
}

export function documentCitationHref(citation: Citation) {
  const params = new URLSearchParams();
  if (citation.page_number) params.set("page", String(citation.page_number));
  params.set("chunk", citation.chunk_id);
  return `/documents/${encodeURIComponent(citation.document_id)}?${params.toString()}`;
}

export function citationIdentity(citation: Pick<Citation, "chunk_id" | "document_id" | "page_number">) {
  return [citation.document_id, citation.page_number ?? "n/a", citation.chunk_id].join(":");
}

export function uniqueCitations<T extends Citation>(citations: T[]) {
  const seen = new Set<string>();
  const unique: T[] = [];

  for (const citation of citations) {
    const key = citationIdentity(citation);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(citation);
  }

  return unique;
}

export function compactCitations(results: SearchResult[], limit = 6) {
  const seen = new Set<string>();
  const citations: Citation[] = [];

  for (const result of results) {
    const key = `${result.document_id}:${result.page_number}:${result.chunk_index}`;
    if (seen.has(key)) continue;
    seen.add(key);
    citations.push(citationFromResult(result));
    if (citations.length >= limit) break;
  }

  return citations;
}
