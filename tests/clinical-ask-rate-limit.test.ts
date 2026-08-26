import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiRateLimitUnavailableError, consumeSubjectApiRateLimit } from "@/lib/api-rate-limit";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Clinical Ask provider rate limits", () => {
  it.each(["answer", "clinical_ask", "speech_transcription"] as const)(
    "fails closed for authenticated %s when the durable limiter is unavailable",
    async (bucket) => {
      vi.stubEnv("NODE_ENV", "production");
      const supabase = { rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "unavailable" } }) };
      await expect(
        consumeSubjectApiRateLimit({
          supabase: supabase as never,
          subject: { kind: "owner", ownerId: "owner-a" },
          bucket,
          allowInMemoryFallbackOnUnavailable: true,
        }),
      ).rejects.toBeInstanceOf(ApiRateLimitUnavailableError);
    },
  );

  it.each(["answer", "clinical_ask", "speech_transcription"] as const)(
    "applies an anonymous global ceiling for %s",
    async (bucket) => {
      vi.stubEnv("NODE_ENV", "production");
      const rpc = vi
        .fn()
        .mockResolvedValueOnce({
          data: { limited: false, limit_value: 4, remaining: 3, retry_after_seconds: 60, reset_at: "2099-01-01" },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { limited: true, limit_value: 20, remaining: 0, retry_after_seconds: 60, reset_at: "2099-01-01" },
          error: null,
        });
      const result = await consumeSubjectApiRateLimit({
        supabase: { rpc } as never,
        subject: { kind: "anonymous", subjectKey: "anon:subject" },
        bucket,
      });
      expect(result.limited).toBe(true);
      expect(rpc).toHaveBeenNthCalledWith(
        2,
        "consume_api_subject_rate_limit",
        expect.objectContaining({
          p_subject_key: `anon:${bucket}:global`,
        }),
      );
    },
  );
});
