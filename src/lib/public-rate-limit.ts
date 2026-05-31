type RateLimitBucket = {
  count: number;
  resetAt: number;
};

export type PublicRateLimitResult = {
  limited: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
};

const answerBuckets = new Map<string, RateLimitBucket>();

export const publicAnswerRateLimitDefaults = {
  limit: 30,
  windowMs: 60_000,
} as const;

export function publicRateLimitKey(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwardedFor) return forwardedFor;

  const realIp = headers.get("x-real-ip")?.trim();
  return realIp || "unknown";
}

export function consumePublicAnswerRateLimit(
  headers: Headers,
  now = Date.now(),
  options: { limit?: number; windowMs?: number } = {},
): PublicRateLimitResult {
  const limit = options.limit ?? publicAnswerRateLimitDefaults.limit;
  const windowMs = options.windowMs ?? publicAnswerRateLimitDefaults.windowMs;
  const key = publicRateLimitKey(headers);
  const existing = answerBuckets.get(key);
  const bucket =
    existing && existing.resetAt > now
      ? existing
      : {
          count: 0,
          resetAt: now + windowMs,
        };

  bucket.count += 1;
  answerBuckets.set(key, bucket);

  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  const remaining = Math.max(0, limit - bucket.count);

  return {
    limited: bucket.count > limit,
    limit,
    remaining,
    retryAfterSeconds,
    resetAt: bucket.resetAt,
  };
}

export function resetPublicAnswerRateLimitForTests() {
  answerBuckets.clear();
}
