type SignedUrlPayload = {
  url: string;
  caption?: string;
  mimeType?: string;
  fileType?: string;
  expiresAt?: string;
};

type SignedUrlCacheEntry = {
  payload: SignedUrlPayload;
  // Absolute epoch-ms after which the entry must not be served. Always set:
  // derived from payload.expiresAt when present, otherwise a conservative
  // default shorter than the issued signed-URL lifetime (RET-H3).
  expiresAtMs: number;
};

// Signed URLs are bearer credentials for private document images. Bound the cache
// and never serve an entry past its hard expiry so a leaked/over-retained URL is
// not usable indefinitely and a missing-expiry payload cannot be cached forever.
const SIGNED_URL_CACHE_MAX_SIZE = 256;
// Issued signed URLs live 10 minutes (see signed-url routes). Use a shorter TTL
// for payloads that omit expiresAt so they self-heal well before the URL dies.
const SIGNED_URL_DEFAULT_TTL_MS = 5 * 60_000;
// Refresh a few seconds before the hard expiry to avoid serving a near-dead URL.
const SIGNED_URL_EXPIRY_SKEW_MS = 30_000;

const signedUrlCache = new Map<string, SignedUrlCacheEntry>();

export function signedUrlCacheScope(
  accessScope: "public" | "owner",
  authEpoch: number,
  ownerId: string | null | undefined,
) {
  return accessScope === "public" ? "public" : `owner:${authEpoch}:${ownerId ?? "signed-out"}`;
}

function cacheKey(endpoint: string, authScope: string) {
  return `${authScope}\n${endpoint}`;
}

export function getCachedSignedUrl(endpoint: string, authScope: string) {
  const key = cacheKey(endpoint, authScope);
  const cached = signedUrlCache.get(key);
  if (!cached) return null;

  if (cached.expiresAtMs - Date.now() <= SIGNED_URL_EXPIRY_SKEW_MS) {
    signedUrlCache.delete(key);
    return null;
  }

  // LRU: mark as most-recently-used.
  signedUrlCache.delete(key);
  signedUrlCache.set(key, cached);
  return cached.payload;
}

export function setCachedSignedUrl(endpoint: string, authScope: string, payload: SignedUrlPayload) {
  const key = cacheKey(endpoint, authScope);
  const parsedExpiry = payload.expiresAt ? Date.parse(payload.expiresAt) : NaN;
  const expiresAtMs = Number.isFinite(parsedExpiry) ? parsedExpiry : Date.now() + SIGNED_URL_DEFAULT_TTL_MS;

  if (signedUrlCache.has(key)) signedUrlCache.delete(key);
  signedUrlCache.set(key, { payload, expiresAtMs });

  while (signedUrlCache.size > SIGNED_URL_CACHE_MAX_SIZE) {
    const oldestKey = signedUrlCache.keys().next().value;
    if (!oldestKey) break;
    signedUrlCache.delete(oldestKey);
  }
  return payload;
}

export function clearCachedSignedUrl(endpoint: string, authScope: string) {
  signedUrlCache.delete(cacheKey(endpoint, authScope));
}

export function clearSignedUrlCache() {
  signedUrlCache.clear();
}
