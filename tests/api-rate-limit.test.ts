import { beforeEach, describe, expect, it, vi } from "vitest";
import { consumeSubjectApiRateLimit, type RateLimitSubject } from "@/lib/api-rate-limit";
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
});
