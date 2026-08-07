/**
 * Shared signed-URL fetch helper for document preview and download.
 * Kept outside DocumentViewer so expiry refresh and initial load cannot drift.
 */

export type SignedUrlResponsePayload = {
  url?: string;
  caption?: string;
  mimeType?: string;
  fileType?: string;
  expiresAt?: string;
  error?: string;
};

export async function requestSignedUrlPayload(
  endpoint: string,
  options: {
    signal: AbortSignal;
    headers: HeadersInit | undefined;
    onUnauthorized: () => void;
    errorMessage: string;
  },
): Promise<SignedUrlResponsePayload> {
  const response = await fetch(endpoint, { signal: options.signal, headers: options.headers });
  const payload: SignedUrlResponsePayload = await response.json();
  if (response.status === 401) options.onUnauthorized();
  if (!response.ok) throw new Error(payload?.error || options.errorMessage);
  return payload;
}

/** Deduplicate detail rows by id while preserving first-seen order. */
export function rowsById<T extends { id: string }>(incoming: T[]) {
  const rows = new Map<string, T>();
  for (const row of incoming) rows.set(row.id, row);
  return Array.from(rows.values());
}
