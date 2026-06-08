type SignedUrlPayload = {
  url: string;
  caption?: string;
  mimeType?: string;
  fileType?: string;
  expiresAt?: string;
};

const signedUrlCache = new Map<string, SignedUrlPayload>();

export function getCachedSignedUrl(endpoint: string) {
  const cached = signedUrlCache.get(endpoint);
  if (!cached) return null;

  const expiresAt = cached.expiresAt ? Date.parse(cached.expiresAt) : null;
  if (expiresAt && Number.isFinite(expiresAt) && expiresAt - Date.now() < 30_000) {
    signedUrlCache.delete(endpoint);
    return null;
  }

  return cached;
}

export function setCachedSignedUrl(endpoint: string, payload: SignedUrlPayload) {
  signedUrlCache.set(endpoint, payload);
  return payload;
}

export function clearCachedSignedUrl(endpoint: string) {
  signedUrlCache.delete(endpoint);
}

export function clearSignedUrlCache() {
  signedUrlCache.clear();
}
