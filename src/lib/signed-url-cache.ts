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

export function getCachedSignedUrl(endpoint: string) {
  const cached = signedUrlCache.get(endpoint);
  if (!cached) return null;

  if (cached.expiresAtMs - Date.now() <= SIGNED_URL_EXPIRY_SKEW_MS) {
    signedUrlCache.delete(endpoint);
    return null;
  }

  // LRU: mark as most-recently-used.
  signedUrlCache.delete(endpoint);
  signedUrlCache.set(endpoint, cached);
  return cached.payload;
}

export function setCachedSignedUrl(endpoint: string, payload: SignedUrlPayload) {
  const parsedExpiry = payload.expiresAt ? Date.parse(payload.expiresAt) : NaN;
  const expiresAtMs = Number.isFinite(parsedExpiry) ? parsedExpiry : Date.now() + SIGNED_URL_DEFAULT_TTL_MS;

  if (signedUrlCache.has(endpoint)) signedUrlCache.delete(endpoint);
  signedUrlCache.set(endpoint, { payload, expiresAtMs });

  while (signedUrlCache.size > SIGNED_URL_CACHE_MAX_SIZE) {
    const oldestKey = signedUrlCache.keys().next().value;
    if (!oldestKey) break;
    signedUrlCache.delete(oldestKey);
  }
  return payload;
}

export function clearCachedSignedUrl(endpoint: string) {
  signedUrlCache.delete(endpoint);
}

export function clearSignedUrlCache() {
  signedUrlCache.clear();
}

// --- Batched image signed-URL fetching -------------------------------------
// Image components used to issue one GET /api/images/[id]/signed-url each; a
// document view with N inline images meant N API calls. Requests arriving
// within a short window are coalesced into one POST /api/images/signed-urls.
// Queues are keyed by the caller's authorization header so concurrent sessions
// (or an auth change mid-flight) can never mix credentials in one batch.

export type SignedUrlFetchOptions = {
  authorizationHeader?: Record<string, string>;
  onUnauthorized?: () => void;
};

type PendingImage = {
  resolvers: Array<(payload: SignedUrlPayload | null) => void>;
};

type BatchQueue = {
  images: Map<string, PendingImage>;
  timer: ReturnType<typeof setTimeout> | null;
  options: SignedUrlFetchOptions;
};

// Matches the batch route's max ids per request.
const SIGNED_URL_BATCH_MAX_IDS = 50;
// Long enough to collect a render pass of visible images, short enough to be
// imperceptible next to the image download itself.
const SIGNED_URL_BATCH_WINDOW_MS = 25;

const signedUrlBatchQueues = new Map<string, BatchQueue>();

export function imageSignedUrlEndpoint(imageId: string) {
  return `/api/images/${imageId}/signed-url`;
}

export function fetchImageSignedUrl(
  imageId: string,
  options: SignedUrlFetchOptions = {},
): Promise<SignedUrlPayload | null> {
  const cached = getCachedSignedUrl(imageSignedUrlEndpoint(imageId));
  if (cached) return Promise.resolve(cached);

  const queueKey = JSON.stringify(options.authorizationHeader ?? {});
  let queue = signedUrlBatchQueues.get(queueKey);
  if (!queue) {
    queue = { images: new Map(), timer: null, options };
    signedUrlBatchQueues.set(queueKey, queue);
  }
  queue.options = options;

  return new Promise((resolve) => {
    const pending = queue.images.get(imageId) ?? { resolvers: [] };
    pending.resolvers.push(resolve);
    queue.images.set(imageId, pending);
    if (queue.images.size >= SIGNED_URL_BATCH_MAX_IDS) {
      void flushSignedUrlBatch(queueKey);
      return;
    }
    queue.timer ??= setTimeout(() => void flushSignedUrlBatch(queueKey), SIGNED_URL_BATCH_WINDOW_MS);
  });
}

async function flushSignedUrlBatch(queueKey: string) {
  const queue = signedUrlBatchQueues.get(queueKey);
  if (!queue) return;
  signedUrlBatchQueues.delete(queueKey);
  if (queue.timer) clearTimeout(queue.timer);

  const entries = [...queue.images.entries()];
  let itemsById: Record<string, SignedUrlPayload | null> = {};
  try {
    const response = await fetch("/api/images/signed-urls", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(queue.options.authorizationHeader ?? {}) },
      body: JSON.stringify({ ids: entries.map(([imageId]) => imageId) }),
    });
    if (response.status === 401) queue.options.onUnauthorized?.();
    if (response.ok) {
      const body = (await response.json()) as { items?: Record<string, SignedUrlPayload | null> };
      itemsById = body.items ?? {};
    }
  } catch {
    // Network failure: every waiter resolves null and the components show
    // their existing retry affordance.
  }

  for (const [imageId, pending] of entries) {
    const payload = itemsById[imageId] ?? null;
    const resolved = payload?.url ? payload : null;
    if (resolved) setCachedSignedUrl(imageSignedUrlEndpoint(imageId), resolved);
    for (const resolve of pending.resolvers) resolve(resolved);
  }
}
