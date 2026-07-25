import { NextResponse } from "next/server";
import { isLocalNoAuthMode } from "@/lib/env";
import { PublicApiError } from "@/lib/http";
import type { RateLimitSubject } from "@/lib/public-api-access";
import type { createAdminClient } from "@/lib/supabase/admin";

/** Prefer durable RPC rate limits; fall back to per-instance memory when the DB function is unavailable. */
export function allowRateLimitInMemoryFallbackOnUnavailable() {
  return isLocalNoAuthMode() || process.env.NODE_ENV === "production";
}

// Buckets that must FAIL CLOSED (503) rather than fall back to a per-instance in-memory limiter
// when the durable limiter is unavailable. A per-process Map gives N× the intended limit across N
// horizontally-scaled instances during a limiter outage — unacceptable for expensive/abusable
// paths: `answer` (paid provider generation) and `document_upload` (storage writes + ingestion
// cost).
function failsClosedOnLimiterUnavailable(bucket: ApiRateLimitBucket) {
  return bucket === "answer" || bucket === "document_upload";
}

/** Production multi-instance deploys fail closed for expensive buckets. Single-instance
 *  local/dev (including secret-backed cloud agents) keeps the in-memory fallback so Answer
 *  remains usable when the durable rate-limit RPC is misconfigured or unavailable. */
function mustFailClosedOnLimiterUnavailable(bucket: ApiRateLimitBucket) {
  if (!failsClosedOnLimiterUnavailable(bucket)) return false;
  if (isLocalNoAuthMode() || process.env.NODE_ENV !== "production") return false;
  return true;
}

function allowAnonymousRateLimitFallback(bucket: ApiRateLimitBucket, allowInMemoryFallbackOnUnavailable?: boolean) {
  // Fail-closed buckets must not fall back to a per-instance limiter in a distributed production
  // runtime. If the durable limiter is unavailable, fail closed before any expensive work starts.
  if (mustFailClosedOnLimiterUnavailable(bucket)) return false;
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
  | "source_review"
  | "answer_feedback"
  | "registry"
  | "document_admin"
  | "ingestion_admin";

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
  source_review: { limit: 30, windowSeconds: 60 },
  answer_feedback: { limit: 30, windowSeconds: 60 },
  registry: { limit: 120, windowSeconds: 60 },
  // Authenticated owner document-admin writes (bulk metadata, label edits, table-fact review).
  // Generous for interactive single-owner admin use, bounded against an abusive/compromised client.
  document_admin: { limit: 60, windowSeconds: 60 },
  // Authenticated owner ingestion/eval admin tooling (ingestion-quality dashboard, eval-case capture).
  // Generous for interactive/polling admin use, bounded against an abusive/compromised client.
  ingestion_admin: { limit: 60, windowSeconds: 60 },
} as const satisfies Record<ApiRateLimitBucket, { limit: number; windowSeconds: number }>;

const anonymousApiRateLimitDefaults: Partial<Record<ApiRateLimitBucket, { limit: number; windowSeconds: number }>> = {
  answer: { limit: 6, windowSeconds: 60 },
  search: { limit: 60, windowSeconds: 60 },
  document_read: { limit: 45, windowSeconds: 60 },
  document_upload: { limit: 3, windowSeconds: 60 },
  answer_feedback: { limit: 12, windowSeconds: 60 },
  // Anonymous curated-catalog reads (medications/registry/differentials) return the full
  // seed corpus (~MBs). Halve the authenticated allowance so an unauthenticated caller
  // cannot use the public catalog endpoints as a high-volume egress lever, while still
  // leaving ample headroom for legitimate public browsing.
  registry: { limit: 60, windowSeconds: 60 },
};

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

type RateLimitRpcRow = {
  bucket?: string | null;
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

/**
 * Applies an API rate limit to an owner or anonymous subject.
 *
 * Anonymous requests to answer and document upload buckets are constrained by
 * both subject-specific and aggregate bucket limits. Limiter unavailability may
 * use an in-memory fallback when permitted.
 *
 * @param args - Rate-limiting configuration and request subject.
 * @param args.subject - The authenticated owner or anonymous subject to limit.
 * @param args.bucket - The API resource bucket being limited.
 * @param args.limit - Optional subject-specific request limit.
 * @param args.windowSeconds - Optional subject-specific rate-limit window.
 * @param args.allowInMemoryFallbackOnUnavailable - Whether local fallback may be used when the durable limiter is unavailable.
 * @returns The computed rate-limit outcome.
 */
export async function consumeSubjectApiRateLimit(args: {
  supabase: SupabaseAdmin;
  subject: RateLimitSubject;
  bucket: ApiRateLimitBucket;
  limit?: number;
  windowSeconds?: number;
  allowInMemoryFallbackOnUnavailable?: boolean;
}): Promise<ApiRateLimitResult> {
  const allowInMemoryFallbackOnUnavailable = mustFailClosedOnLimiterUnavailable(args.bucket)
    ? false
    : args.allowInMemoryFallbackOnUnavailable;

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

  if (args.bucket !== "answer" && args.bucket !== "document_upload") {
    return consumeAnonymousLimit(args.subject.subjectKey, limit, windowSeconds);
  }

  // A stable global ceiling prevents rotated/spoofed network identities from
  // multiplying paid generation or upload/ingestion capacity. Reuse each
  // bucket's authenticated allowance as the aggregate anonymous ceiling.
  const globalDefaults = apiRateLimitDefaults[args.bucket];
  const subjectResult = await consumeAnonymousLimit(args.subject.subjectKey, limit, windowSeconds);
  if (subjectResult.limited) return subjectResult;
  const globalResult = await consumeAnonymousLimit(
    `anon:${args.bucket}:global`,
    globalDefaults.limit,
    globalDefaults.windowSeconds,
  );
  if (globalResult.limited) return globalResult;
  return {
    ...subjectResult,
    remaining: Math.min(subjectResult.remaining, globalResult.remaining),
  };
}

export type SummaryRateLimitBucket = "answer" | "document_summarize";

export type SummaryRateLimitDecision = {
  bucket: SummaryRateLimitBucket | null;
  rateLimit: ApiRateLimitResult;
};

/**
 * Atomically applies the answer and document-summary policies used by streamed
 * summaries. The database function locks every participating bucket in a
 * stable order, avoiding the partial accounting and lock-order risk of two
 * serial RPC calls.
 */
export async function consumeSummaryRateLimits(args: {
  supabase: SupabaseAdmin;
  subject: RateLimitSubject;
}): Promise<SummaryRateLimitDecision> {
  const answerDefaults =
    args.subject.kind === "owner"
      ? apiRateLimitDefaults.answer
      : (anonymousApiRateLimitDefaults.answer ?? apiRateLimitDefaults.answer);
  const summaryDefaults = apiRateLimitDefaults.document_summarize;
  const globalAnswerDefaults = apiRateLimitDefaults.answer;
  const { data, error } = await args.supabase.rpc("consume_summary_rate_limits_atomic", {
    p_owner_id: args.subject.kind === "owner" ? args.subject.ownerId : null,
    p_subject_key: args.subject.kind === "anonymous" ? args.subject.subjectKey : null,
    p_answer_limit: answerDefaults.limit,
    p_answer_window_seconds: answerDefaults.windowSeconds,
    p_summary_limit: summaryDefaults.limit,
    p_summary_window_seconds: summaryDefaults.windowSeconds,
    p_global_answer_limit: globalAnswerDefaults.limit,
    p_global_answer_window_seconds: globalAnswerDefaults.windowSeconds,
  });

  if (error) throw new ApiRateLimitUnavailableError();

  const row = parseRateLimitRow(data);
  const bucket = row?.bucket;
  const validBucket = bucket === "answer" || bucket === "document_summarize" ? bucket : null;
  if (!row || typeof row.limited !== "boolean" || (row.limited && validBucket === null)) {
    throw new ApiRateLimitUnavailableError();
  }

  return {
    bucket: validBucket,
    rateLimit: {
      limited: row.limited,
      limit: Number(row.limit_value ?? summaryDefaults.limit),
      remaining: Number(row.remaining ?? 0),
      retryAfterSeconds: Math.max(1, Number(row.retry_after_seconds ?? summaryDefaults.windowSeconds)),
      resetAt: String(row.reset_at ?? new Date(Date.now() + summaryDefaults.windowSeconds * 1000).toISOString()),
    },
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

  // Lazy per-key eviction: the most common path touches only the accessed entry.
  // A full-map sweep runs only when the map exceeds a size ceiling so stale entries
  // don't accumulate indefinitely, without scanning on every request.
  const EVICTION_SIZE_CEILING = 2000;
  const stale = inMemoryApiRateLimits.get(key);
  if (stale && now >= stale.resetAtMs) {
    inMemoryApiRateLimits.delete(key);
  }
  if (inMemoryApiRateLimits.size > EVICTION_SIZE_CEILING) {
    for (const [k, v] of inMemoryApiRateLimits.entries()) {
      if (now >= v.resetAtMs) inMemoryApiRateLimits.delete(k);
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
      message,
      code: "rate_limited",
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      details: { retryAfterSeconds: rateLimit.retryAfterSeconds, resetAt: rateLimit.resetAt },
    },
    {
      status: 429,
      headers: {
        "Cache-Control": "private, no-store",
        "Retry-After": String(rateLimit.retryAfterSeconds),
      },
    },
  );
}
