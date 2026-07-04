export const DOCUMENTS_MODE_HOME_ROUTE = "/?mode=documents";
export const DOCUMENT_SEARCH_ROUTE = "/documents/search";
export const DOCUMENT_READER_ROUTE = "/documents/source";
export const DOCUMENT_EVIDENCE_ROUTE = "/documents/source/evidence";

export const DEFAULT_DOCUMENT_FLOW_QUERY = "clozapine monitoring table";
export const DEFAULT_DOCUMENT_FLOW_DOCUMENT = "clozapine-monitoring";
export const DEFAULT_DOCUMENT_FLOW_PAGE = 12;
export const DEFAULT_DOCUMENT_FLOW_CHUNK = "monitoring-table";
export const DEFAULT_DOCUMENT_FLOW_EVIDENCE = "monitoring-table";

export function documentsSearchHref(options: { query?: string; focus?: boolean; run?: boolean } = {}) {
  const params = new URLSearchParams({ mode: "documents" });
  const query = options.query?.trim();
  if (query) params.set("q", query);
  if (options.focus) params.set("focus", "1");
  if (options.run && query) params.set("run", "1");
  return `${DOCUMENT_SEARCH_ROUTE}?${params.toString()}`;
}

export function documentReaderHref(
  options: {
    document?: string;
    query?: string;
    page?: number | string;
    chunk?: string;
  } = {},
) {
  const params = new URLSearchParams({
    mode: "documents",
    document: options.document ?? DEFAULT_DOCUMENT_FLOW_DOCUMENT,
    q: options.query?.trim() || DEFAULT_DOCUMENT_FLOW_QUERY,
    page: String(options.page ?? DEFAULT_DOCUMENT_FLOW_PAGE),
    chunk: options.chunk ?? DEFAULT_DOCUMENT_FLOW_CHUNK,
  });
  return `${DOCUMENT_READER_ROUTE}?${params.toString()}`;
}

export function documentEvidenceHref(
  options: {
    document?: string;
    evidence?: string;
    query?: string;
    page?: number | string;
    chunk?: string;
  } = {},
) {
  const evidence = options.evidence ?? DEFAULT_DOCUMENT_FLOW_EVIDENCE;
  const params = new URLSearchParams({
    mode: "documents",
    document: options.document ?? DEFAULT_DOCUMENT_FLOW_DOCUMENT,
    evidence,
    q: options.query?.trim() || DEFAULT_DOCUMENT_FLOW_QUERY,
    page: String(options.page ?? DEFAULT_DOCUMENT_FLOW_PAGE),
    chunk: options.chunk ?? evidence,
  });
  return `${DOCUMENT_EVIDENCE_ROUTE}?${params.toString()}`;
}
