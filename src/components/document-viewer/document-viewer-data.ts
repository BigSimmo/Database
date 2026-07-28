export type SignedUrlResponsePayload = {
  url?: string;
  caption?: string;
  mimeType?: string;
  fileType?: string;
  expiresAt?: string;
  error?: string;
};

// Single signed-URL GET: parse JSON, mark the session expired on 401, and throw
// a message on failure. Shared by the initial load and the expiry refresh so the
// fetch/auth handling lives in exactly one place.
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

export function rowsById<T extends { id: string }>(incoming: T[]) {
  const rows = new Map<string, T>();
  for (const row of incoming) rows.set(row.id, row);
  return Array.from(rows.values());
}
