import { describe, expect, it, vi } from "vitest";

import { consumeSubjectApiRateLimit } from "@/lib/api-rate-limit";
import type { createAdminClient } from "@/lib/supabase/admin";

type Client = ReturnType<typeof createAdminClient>;

function limiter() {
  const rpc = vi.fn().mockResolvedValue({
    data: {
      limited: false,
      limit_value: 1,
      remaining: 1,
      retry_after_seconds: 60,
      reset_at: new Date(Date.now() + 60_000).toISOString(),
    },
    error: null,
  });
  return { rpc, supabase: { rpc } as unknown as Client };
}

describe("Teaching rate limits", () => {
  // Review focus 4: a lecture theatre on hospital Wi-Fi scans from one network address.
  it("lets a whole room of signed-out scanners on one network scan 300 times a minute", async () => {
    const { rpc, supabase } = limiter();
    await consumeSubjectApiRateLimit({
      supabase,
      subject: { kind: "anonymous", subjectKey: "anon:hospital-network" },
      bucket: "teaching_code",
    });
    expect(rpc).toHaveBeenCalledWith(
      "consume_api_subject_rate_limit",
      expect.objectContaining({ p_bucket: "teaching_code", p_limit: 300, p_window_seconds: 60 }),
    );
  });

  it("gives each signed-in doctor 12 typed-code attempts a minute", async () => {
    const { rpc, supabase } = limiter();
    await consumeSubjectApiRateLimit({
      supabase,
      subject: { kind: "owner", ownerId: "11111111-1111-4111-8111-111111111111" },
      bucket: "teaching_code",
    });
    expect(rpc).toHaveBeenCalledWith(
      "consume_api_rate_limit",
      expect.objectContaining({ p_bucket: "teaching_code", p_limit: 12, p_window_seconds: 60 }),
    );
  });

  it("gives signed-in Teaching reads and writes 60 a minute", async () => {
    const { rpc, supabase } = limiter();
    await consumeSubjectApiRateLimit({
      supabase,
      subject: { kind: "owner", ownerId: "11111111-1111-4111-8111-111111111111" },
      bucket: "teaching",
    });
    expect(rpc).toHaveBeenCalledWith(
      "consume_api_rate_limit",
      expect.objectContaining({ p_bucket: "teaching", p_limit: 60, p_window_seconds: 60 }),
    );
  });
});
