import { describe, expect, it, vi } from "vitest";
import {
  ANONYMOUS_GENERATION_CEILING,
  ANONYMOUS_GENERATION_CEILING_CODE,
  ANONYMOUS_GENERATION_CEILING_SUBJECT_KEY,
  ANONYMOUS_GENERATION_CEILING_BUCKET,
  consumeSubjectApiRateLimit,
  consumeSummaryRateLimits,
  rateLimitJsonResponse,
  type RateLimitSubject,
} from "@/lib/api-rate-limit";
import type { createAdminClient } from "@/lib/supabase/admin";

type RpcArgs = { p_subject_key?: string; p_bucket?: string; p_limit?: number; p_window_seconds?: number };

/**
 * Records every rate-limit RPC call and answers `limited` only for the subject keys
 * named in `limitedKeys`, so a test can deny exactly one bucket.
 */
function limiterStub(limitedKeys: string[] = []) {
  const calls: RpcArgs[] = [];
  const rpc = vi.fn(async (_name: string, args: RpcArgs) => {
    calls.push(args);
    const limited = limitedKeys.includes(String(args.p_subject_key));
    return {
      data: {
        limited,
        limit_value: args.p_limit ?? 0,
        remaining: limited ? 0 : (args.p_limit ?? 0) - 1,
        retry_after_seconds: args.p_window_seconds ?? 60,
        reset_at: new Date(Date.now() + (args.p_window_seconds ?? 60) * 1000).toISOString(),
      },
      error: null,
    };
  });
  return { calls, supabase: { rpc } as unknown as ReturnType<typeof createAdminClient> };
}

const anonymous: RateLimitSubject = { kind: "anonymous", subjectKey: "anon:test-subject" };

describe("aggregate anonymous ceiling for provider-backed generation", () => {
  it("consumes the shared aggregate ceiling for anonymous answer generation and allows callers under it", async () => {
    const { calls, supabase } = limiterStub();

    const result = await consumeSubjectApiRateLimit({ supabase, subject: anonymous, bucket: "answer" });

    expect(result.limited).toBe(false);
    expect(calls).toContainEqual(
      expect.objectContaining({
        p_subject_key: ANONYMOUS_GENERATION_CEILING_SUBJECT_KEY,
        p_bucket: ANONYMOUS_GENERATION_CEILING_BUCKET,
        p_limit: ANONYMOUS_GENERATION_CEILING.limit,
        p_window_seconds: ANONYMOUS_GENERATION_CEILING.windowSeconds,
      }),
    );
  });

  it("shares one aggregate bucket across every anonymous generation route", async () => {
    for (const bucket of ["answer", "clinical_ask", "speech_transcription"] as const) {
      const { calls, supabase } = limiterStub();
      await consumeSubjectApiRateLimit({ supabase, subject: anonymous, bucket });
      const aggregateCalls = calls.filter((call) => call.p_subject_key === ANONYMOUS_GENERATION_CEILING_SUBJECT_KEY);
      expect(aggregateCalls, `bucket ${bucket} must consume the aggregate ceiling`).toHaveLength(1);
      expect(aggregateCalls[0]?.p_bucket).toBe(ANONYMOUS_GENERATION_CEILING_BUCKET);
    }
  });

  it("denies over the ceiling with a distinct scope and a 429 carrying a distinct error code", async () => {
    const { supabase } = limiterStub([ANONYMOUS_GENERATION_CEILING_SUBJECT_KEY]);

    const result = await consumeSubjectApiRateLimit({ supabase, subject: anonymous, bucket: "answer" });

    expect(result.limited).toBe(true);
    expect(result.scope).toBe("anonymous_generation_ceiling");

    const response = rateLimitJsonResponse("Too many answer requests. Retry shortly.", result, { bucket: "answer" });
    expect(response.status).toBe(429);
    const body = (await response.json()) as { code: string; message: string };
    expect(body.code).toBe(ANONYMOUS_GENERATION_CEILING_CODE);
    expect(body.message).toMatch(/sign in/i);
  });

  it("keeps the ordinary per-subject denial on the generic rate_limited code", async () => {
    const { supabase } = limiterStub([anonymous.subjectKey]);

    const result = await consumeSubjectApiRateLimit({ supabase, subject: anonymous, bucket: "answer" });

    expect(result.limited).toBe(true);
    expect(result.scope).not.toBe("anonymous_generation_ceiling");
    const body = (await rateLimitJsonResponse("Too many answer requests.", result).json()) as { code: string };
    expect(body.code).toBe("rate_limited");
  });

  it("applies the ceiling to anonymous streamed document summaries", async () => {
    const { calls, supabase } = limiterStub([ANONYMOUS_GENERATION_CEILING_SUBJECT_KEY]);

    const decision = await consumeSummaryRateLimits({ supabase, subject: anonymous });

    expect(calls).toContainEqual(expect.objectContaining({ p_subject_key: ANONYMOUS_GENERATION_CEILING_SUBJECT_KEY }));
    expect(decision.rateLimit.limited).toBe(true);
    expect(decision.rateLimit.scope).toBe("anonymous_generation_ceiling");
  });

  it("leaves authenticated callers untouched by the anonymous ceiling", async () => {
    const { calls, supabase } = limiterStub([ANONYMOUS_GENERATION_CEILING_SUBJECT_KEY]);

    const result = await consumeSubjectApiRateLimit({
      supabase,
      subject: { kind: "owner", ownerId: "11111111-2222-3333-4444-555555555555" },
      bucket: "answer",
    });

    expect(result.limited).toBe(false);
    expect(calls.some((call) => call.p_subject_key === ANONYMOUS_GENERATION_CEILING_SUBJECT_KEY)).toBe(false);

    const summaryStub = limiterStub([ANONYMOUS_GENERATION_CEILING_SUBJECT_KEY]);
    const decision = await consumeSummaryRateLimits({
      supabase: summaryStub.supabase,
      subject: { kind: "owner", ownerId: "11111111-2222-3333-4444-555555555555" },
    });
    expect(decision.rateLimit.limited).toBe(false);
    expect(summaryStub.calls.some((call) => call.p_subject_key === ANONYMOUS_GENERATION_CEILING_SUBJECT_KEY)).toBe(
      false,
    );
  });
});
