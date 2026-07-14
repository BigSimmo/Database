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

/**
 * Identity of a full document load. A new `documentId` or an explicit retry
 * (`previewAttempt`) starts a fresh full load; page/chunk navigation within the
 * same document keeps the same key.
 */
export function documentLoadKey(documentId: string, previewAttempt: number): string {
  return `${documentId}::${previewAttempt}`;
}

/**
 * Whether the pending load is a *full* (re)load rather than navigation on an
 * already-loaded document. A full load resets the viewer, re-issues signed URLs
 * and surfaces load errors; navigation only re-windows the detail in place.
 *
 * The remembered key is advanced only after a *successful* detail load (see
 * {@link nextLoadedDocumentKey}), so a failed full load stays "not loaded" and
 * the next run retries it as a full load rather than a cheap navigation.
 */
export function isFullDocumentReload(loadedKey: string | null, loadKey: string): boolean {
  return loadedKey !== loadKey;
}

/**
 * The load key to remember once a load settles. Only a successful detail load
 * marks the document loaded; a failed load keeps the previous key so the next
 * navigation is still treated as a full reload (re-fetching signed URLs and
 * updating the viewer error) instead of skipping that recovery work.
 */
export function nextLoadedDocumentKey(
  previousKey: string | null,
  loadKey: string,
  detailLoaded: boolean,
): string | null {
  return detailLoaded ? loadKey : previousKey;
}
