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
  const title = (citation.title || citation.file_name || "Source").trim();
  return `${title}, ${page}`;
}

// Generic filler words dropped from compact citation labels so the label keeps
// the distinguishing words of the actual document title (e.g. drug/topic names)
// rather than collapsing to boilerplate.
const COMPACT_LABEL_STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "for",
  "to",
  "in",
  "on",
  "with",
  "guideline",
  "guidelines",
  "policy",
  "procedure",
  "document",
]);

function compactTitleWords(rawTitle: string) {
  const cleaned = rawTitle
    .replace(/\.(pdf|docx|xlsx|txt)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  const significant = words.filter((word) => !COMPACT_LABEL_STOPWORDS.has(word.toLowerCase()));
  return (significant.length ? significant : words).slice(0, 3).join(" ") || "Source";
}

export function formatCompactCitationLabel(citation: Pick<Citation, "title" | "file_name" | "page_number">) {
  // Derive the short label from the actual title (not a hardcoded drug whitelist)
  // so real-corpus documents are labelled correctly instead of being mislabeled
  // as one of a few demo drug names. Dropping filler words and keeping up to
  // three significant words preserves both drugs in a multi-drug title (e.g.
  // "Clozapine and lithium co-prescribing") rather than collapsing to "Clozapine and".
  const rawTitle = (citation.title || citation.file_name || "Source").replace(/^Synthetic\s+/i, "").trim();
  const shortTitle = compactTitleWords(rawTitle);
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
