/**
 * Builds a URL for a specific document page in the PDF preview section.
 *
 * @param documentId - The document identifier to include in the URL
 * @param page - The requested page number, normalized to an integer of at least 1
 * @returns A document page URL with the encoded document identifier and normalized page number
 */
export function documentPageHref(documentId: string, page: number) {
  const normalizedPage = Number.isFinite(page) ? Math.max(1, Math.trunc(page)) : 1;
  const params = new URLSearchParams({ page: String(normalizedPage) });
  return `/documents/${encodeURIComponent(documentId)}?${params.toString()}#pdf-preview-section`;
}
