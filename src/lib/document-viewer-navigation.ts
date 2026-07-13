/** Build a useful-page link without retaining evidence pinned to a different page. */
export function documentPageHref(documentId: string, page: number) {
  const normalizedPage = Number.isFinite(page) ? Math.max(1, Math.trunc(page)) : 1;
  const params = new URLSearchParams({ page: String(normalizedPage) });
  return `/documents/${encodeURIComponent(documentId)}?${params.toString()}#pdf-preview-section`;
}
