import { NextResponse } from "next/server";
import { isLocalNoAuthMode } from "@/lib/env";
import { PublicApiError } from "@/lib/http";
import type { RateLimitSubject } from "@/lib/public-api-access";
import type { createAdminClient } from "@/lib/supabase/admin";

/** Prefer durable RPC rate limits; fall back to per-instance memory when the DB function is unavailable. */
export function allowRateLimitInMemoryFallbackOnUnavailable() {
  return isLocalNoAuthMode() || process.env.NODE_ENV === "production";
}

function allowAnonymousRateLimitFallback(bucket: ApiRateLimitBucket, allowInMemoryFallbackOnUnavailable?: boolean) {
  // Paid answer generation must not fall back to a per-instance limiter in a
  // distributed production runtime. If the durable limiter is unavailable,
  // fail closed before retrieval or provider generation can start.
  if (bucket === "answer" && !isLocalNoAuthMode()) return false;
  if (allowInMemoryFallbackOnUnavailable) return true;

  // Anonymous public read/search paths must stay reachable if the durable limiter
  // migration is temporarily unavailable; the per-instance limiter still applies.
  return bucket === "answer" || bucket === "search" || bucket === "document_read" || bucket === "registry";
}

export type ApiRateLimitBucket =
  | "answer"
  | "search"
  | "document_read"
  | "document_upload"
  | "document_summarize"
  | "document_reindex"
  | "bulk_reindex"
  | "registry";

export type ApiRateLimitResult = {
  limited: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: string;
};

const apiRateLimitDefaults = {
  answer: { limit: 30, windowSeconds: 60 },
  search: { limit: 240, windowSeconds: 60 },
  document_read: { limit: 180, windowSeconds: 60 },
  document_upload: { limit: 12, windowSeconds: 60 },
  document_summarize: { limit: 12, windowSeconds: 60 },
  document_reindex: { limit: 6, windowSeconds: 60 },
  bulk_reindex: { limit: 2, windowSeconds: 60 },
  registry: { limit: 120, windowSeconds: 60 },
} as const satisfies Record<ApiRateLimitBucket, { limit: number; windowSeconds: number }>;

const anonymousApiRateLimitDefaults: Partial<Record<ApiRateLimitBucket, { limit: number; windowSeconds: number }>> = {
  answer: { limit: 6, windowSeconds: 60 },
  search: { limit: 60, windowSeconds: 60 },
  document_read: { limit: 45, windowSeconds: 60 },
  document_upload: { limit: 3, windowSeconds: 60 },
};

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

type RateLimitRpcRow = {
  limited?: boolean;
  limit_value?: number;
  remaining?: number;
  retry_after_seconds?: number;
  reset_at?: string;
};

type InMemoryRateLimitWindow = {
  windowStartMs: number;
  requestCount: number;
  resetAtMs: number;
};

type GlobalWithRateLimitFallback = typeof globalThis & {
  __clinicalKbInMemoryApiRateLimits?: Map<string, InMemoryRateLimitWindow>;
};

const inMemoryApiRateLimits = ((globalThis as GlobalWithRateLimitFallback).__clinicalKbInMemoryApiRateLimits ??=
  new Map<string, InMemoryRateLimitWindow>());

export class ApiRateLimitUnavailableError extends PublicApiError {
  constructor() {
    super("Rate limit check is temporarily unavailable.", 503, { code: "rate_limit_unavailable" });
    this.name = "ApiRateLimitUnavailableError";
  }
}

function parseRateLimitRow(data: unknown): RateLimitRpcRow | null {
  if (Array.isArray(data)) return (data[0] as RateLimitRpcRow | undefined) ?? null;
  return data && typeof data === "object" ? (data as RateLimitRpcRow) : null;
}

export async function consumeApiRateLimit(args: {
  supabase: SupabaseAdmin;
  ownerId: string;
  bucket: ApiRateLimitBucket;
  limit?: number;
  windowSeconds?: number;
  allowInMemoryFallbackOnUnavailable?: boolean;
}): Promise<ApiRateLimitResult> {
  const defaults = apiRateLimitDefaults[args.bucket];
  const limit = args.limit ?? defaults.limit;
  const windowSeconds = args.windowSeconds ?? defaults.windowSeconds;
  const { data, error } = await args.supabase.rpc("consume_api_rate_limit", {
    p_owner_id: args.ownerId,
    p_bucket: args.bucket,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    if (args.allowInMemoryFallbackOnUnavailable) {
      console.warn("Durable API rate limit check unavailable; using local in-memory fallback.", {
        bucket: args.bucket,
        code: error.code,
        message: error.message,
      });
      return consumeInMemoryApiRateLimit({ ownerId: args.ownerId, bucket: args.bucket, limit, windowSeconds });
    }
    throw new ApiRateLimitUnavailableError();
  }
  const row = parseRateLimitRow(data);
  if (!row || typeof row.limited !== "boolean") {
    if (args.allowInMemoryFallbackOnUnavailable) {
      console.warn("Durable API rate limit check returned an invalid payload; using local in-memory fallback.", {
        bucket: args.bucket,
      });
      return consumeInMemoryApiRateLimit({ ownerId: args.ownerId, bucket: args.bucket, limit, windowSeconds });
    }
    throw new ApiRateLimitUnavailableError();
  }

  return {
    limited: row.limited,
    limit: Number(row.limit_value ?? limit),
    remaining: Number(row.remaining ?? 0),
    retryAfterSeconds: Math.max(1, Number(row.retry_after_seconds ?? windowSeconds)),
    resetAt: String(row.reset_at ?? new Date(Date.now() + windowSeconds * 1000).toISOString()),
  };
}

export async function consumeSubjectApiRateLimit(args: {
  supabase: SupabaseAdmin;
  subject: RateLimitSubject;
  bucket: ApiRateLimitBucket;
  limit?: number;
  windowSeconds?: number;
  allowInMemoryFallbackOnUnavailable?: boolean;
}): Promise<ApiRateLimitResult> {
  const allowInMemoryFallbackOnUnavailable =
    args.bucket === "answer" && !isLocalNoAuthMode() ? false : args.allowInMemoryFallbackOnUnavailable;

  if (args.subject.kind === "owner") {
    return consumeApiRateLimit({
      supabase: args.supabase,
      ownerId: args.subject.ownerId,
      bucket: args.bucket,
      limit: args.limit,
      windowSeconds: args.windowSeconds,
      allowInMemoryFallbackOnUnavailable,
    });
  }

  const defaults = anonymousApiRateLimitDefaults[args.bucket] ?? apiRateLimitDefaults[args.bucket];
  const limit = args.limit ?? defaults.limit;
  const windowSeconds = args.windowSeconds ?? defaults.windowSeconds;
  const consumeAnonymousLimit = async (subjectKey: string, requestedLimit: number, requestedWindowSeconds: number) => {
    const { data, error } = await args.supabase.rpc("consume_api_subject_rate_limit", {
      p_subject_key: subjectKey,
      p_bucket: args.bucket,
      p_limit: requestedLimit,
      p_window_seconds: requestedWindowSeconds,
    });

    if (error) {
      if (allowAnonymousRateLimitFallback(args.bucket, allowInMemoryFallbackOnUnavailable)) {
        console.warn("Durable anonymous API rate limit check unavailable; using local in-memory fallback.", {
          bucket: args.bucket,
          code: error.code,
          message: error.message,
        });
        return consumeInMemoryApiRateLimit({
          ownerId: subjectKey,
          bucket: args.bucket,
          limit: requestedLimit,
          windowSeconds: requestedWindowSeconds,
        });
      }
      throw new ApiRateLimitUnavailableError();
    }

    const row = parseRateLimitRow(data);
    if (!row || typeof row.limited !== "boolean") {
      if (allowAnonymousRateLimitFallback(args.bucket, allowInMemoryFallbackOnUnavailable)) {
        return consumeInMemoryApiRateLimit({
          ownerId: subjectKey,
          bucket: args.bucket,
          limit: requestedLimit,
          windowSeconds: requestedWindowSeconds,
        });
      }
      throw new ApiRateLimitUnavailableError();
    }

    return {
      limited: row.limited,
      limit: Number(row.limit_value ?? requestedLimit),
      remaining: Number(row.remaining ?? 0),
      retryAfterSeconds: Math.max(1, Number(row.retry_after_seconds ?? requestedWindowSeconds)),
      resetAt: String(row.reset_at ?? new Date(Date.now() + requestedWindowSeconds * 1000).toISOString()),
    } satisfies ApiRateLimitResult;
  };

  if (args.bucket !== "answer") {
    return consumeAnonymousLimit(args.subject.subjectKey, limit, windowSeconds);
  }

  // A stable global ceiling prevents rotated/spoofed network identities from
  // multiplying paid provider capacity. Use the existing authenticated answer
  // allowance as the aggregate anonymous ceiling to avoid a new magic budget.
  const globalDefaults = apiRateLimitDefaults.answer;
  const subjectResult = await consumeAnonymousLimit(args.subject.subjectKey, limit, windowSeconds);
  if (subjectResult.limited) return subjectResult;
  const globalResult = await consumeAnonymousLimit(
    "anon:answer:global",
    globalDefaults.limit,
    globalDefaults.windowSeconds,
  );
  if (globalResult.limited) return globalResult;
  return {
    ...subjectResult,
    remaining: Math.min(subjectResult.remaining, globalResult.remaining),
  };
}

function consumeInMemoryApiRateLimit({
  ownerId,
  bucket,
  limit,
  windowSeconds,
}: {
  ownerId: string;
  bucket: ApiRateLimitBucket;
  limit: number;
  windowSeconds: number;
}): ApiRateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const key = `${ownerId}:${bucket}`;

  // Evict expired entries to prevent memory leak
  for (const [k, v] of inMemoryApiRateLimits.entries()) {
    if (now >= v.resetAtMs) {
      inMemoryApiRateLimits.delete(k);
    }
  }

  const current = inMemoryApiRateLimits.get(key);
  const windowStartMs = current && now - current.windowStartMs < windowMs ? current.windowStartMs : now;
  const requestCount = (current && current.windowStartMs === windowStartMs ? current.requestCount : 0) + 1;
  const resetAtMs = windowStartMs + windowMs;

  inMemoryApiRateLimits.set(key, { windowStartMs, requestCount, resetAtMs });

  return {
    limited: requestCount > limit,
    limit,
    remaining: Math.max(limit - requestCount, 0),
    retryAfterSeconds: Math.max(1, Math.ceil((resetAtMs - now) / 1000)),
    resetAt: new Date(resetAtMs).toISOString(),
  };
}

export function rateLimitJsonResponse(message: string, rateLimit: ApiRateLimitResult) {
  return NextResponse.json(
    {
      error: message,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(rateLimit.retryAfterSeconds),
      },
    },
  );
}
