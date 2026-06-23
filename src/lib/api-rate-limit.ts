import { NextResponse } from "next/server";
import { PublicApiError } from "@/lib/http";
import type { createAdminClient } from "@/lib/supabase/admin";

export type ApiRateLimitBucket = "answer" | "search" | "document_summarize" | "document_reindex" | "bulk_reindex";

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
  document_summarize: { limit: 12, windowSeconds: 60 },
  document_reindex: { limit: 6, windowSeconds: 60 },
  bulk_reindex: { limit: 2, windowSeconds: 60 },
} as const satisfies Record<ApiRateLimitBucket, { limit: number; windowSeconds: number }>;

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

type RateLimitRpcRow = {
  limited?: boolean;
  limit_value?: number;
  remaining?: number;
  retry_after_seconds?: number;
  reset_at?: string;
};

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

  if (error) throw new ApiRateLimitUnavailableError();
  const row = parseRateLimitRow(data);
  if (!row || typeof row.limited !== "boolean") throw new ApiRateLimitUnavailableError();

  return {
    limited: row.limited,
    limit: Number(row.limit_value ?? limit),
    remaining: Number(row.remaining ?? 0),
    retryAfterSeconds: Math.max(1, Number(row.retry_after_seconds ?? windowSeconds)),
    resetAt: String(row.reset_at ?? new Date(Date.now() + windowSeconds * 1000).toISOString()),
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
