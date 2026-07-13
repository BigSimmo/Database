/** Build a useful-page link without retaining evidence pinned to a different page. */
export function documentPageHref(documentId: string, page: number) {
  const params = new URLSearchParams({ page: String(Math.max(1, Math.trunc(page))) });
  return `/documents/${encodeURIComponent(documentId)}?${params.toString()}#pdf-preview-section`;
}
