type SignedUrlPayload = {
  url: string;
  caption?: string;
  mimeType?: string;
};

const signedUrlCache = new Map<string, SignedUrlPayload>();

export function getCachedSignedUrl(endpoint: string) {
  return signedUrlCache.get(endpoint) ?? null;
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
