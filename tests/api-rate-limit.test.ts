import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  consumeSubjectApiRateLimit,
  ANONYMOUS_GENERATION_CEILING_BUCKET,
  ANONYMOUS_GENERATION_CEILING_SUBJECT_KEY,
  durableRateLimitDenyCacheSizeForTests,
  resetDurableRateLimitDenyCacheForTests,
  type RateLimitSubject,
} from "@/lib/api-rate-limit";
import type { createAdminClient } from "@/lib/supabase/admin";

describe("api rate limiter dual-bucket & deny cache batching", () => {
  beforeEach(() => {
    process.env.ALLOW_DURABLE_RATE_LIMIT_DENY_CACHE_IN_TESTS = "1";
  });
  it("short-circuits when global deny cache is active without calling database RPC", async () => {
    const mockRpc = vi.fn();
    const mockSupabase = {
      rpc: mockRpc,
    } as unknown as ReturnType<typeof createAdminClient>;

    // First call: hit rate limit to populate deny cache for answer bucket
    mockRpc.mockResolvedValue({
      data: {
        scope: "subject",
        limited: true,
        limit_value: 10,
        remaining: 0,
        retry_after_seconds: 60,
        reset_at: new Date(Date.now() + 60000).toISOString(),
      },
      error: null,
    });

    const subject: RateLimitSubject = {
      kind: "anonymous",
      subjectKey: "anon:192.0.2.1",
    };

    const firstResult = await consumeSubjectApiRateLimit({
      supabase: mockSupabase,
      subject,
      bucket: "answer",
    });

    expect(firstResult.limited).toBe(true);
    expect(mockRpc).toHaveBeenCalledTimes(1);

    // Second call with same subject key should be served from deny cache immediately
    const secondResult = await consumeSubjectApiRateLimit({
      supabase: mockSupabase,
      subject,
      bucket: "answer",
    });

    expect(secondResult.limited).toBe(true);
    // Verified: RPC count is still 1 (zero additional DB round-trips)
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it("keeps the deny cache bounded when many limited subjects never return", async () => {
    resetDurableRateLimitDenyCacheForTests();
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          scope: "subject",
          limited: true,
          limit_value: 10,
          remaining: 0,
          retry_after_seconds: 60,
          reset_at: new Date(Date.now() + 60000).toISOString(),
        },
        error: null,
      }),
    } as unknown as ReturnType<typeof createAdminClient>;

    for (let index = 0; index < 2100; index += 1) {
      await consumeSubjectApiRateLimit({
        supabase: mockSupabase,
        subject: { kind: "anonymous", subjectKey: `anon:bounded-${index}` },
        bucket: "answer",
      });
    }

    expect(durableRateLimitDenyCacheSizeForTests()).toBeLessThanOrEqual(2000);
    const cache = (
      globalThis as typeof globalThis & {
        __clinicalKbDurableApiRateLimitDenyCache?: Map<string, unknown>;
      }
    ).__clinicalKbDurableApiRateLimitDenyCache!;
    const [oldest, firstEntry] = cache.entries().next().value!;
    const last = Array.from(cache.keys()).at(-1)!;
    const sharedKey = `${ANONYMOUS_GENERATION_CEILING_SUBJECT_KEY}:${ANONYMOUS_GENERATION_CEILING_BUCKET}`;
    cache.delete(last);
    cache.set(sharedKey, firstEntry);
    expect(cache.size).toBe(2000);

    const ceilingClient = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          scope: "ceiling",
          limited: true,
          limit_value: 300,
          remaining: 0,
          reset_at: new Date(Date.now() + 60_000).toISOString(),
        },
        error: null,
      }),
    } as unknown as ReturnType<typeof createAdminClient>;
    await consumeSubjectApiRateLimit({
      supabase: ceilingClient,
      subject: { kind: "anonymous", subjectKey: "anon:new-subject" },
      bucket: "answer",
    });
    expect(cache.size).toBe(2000);
    expect(cache.has(oldest)).toBe(true);
    resetDurableRateLimitDenyCacheForTests();
  });
});
