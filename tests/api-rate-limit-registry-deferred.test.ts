import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(async () => {
  vi.unstubAllEnvs();
  try {
    const { resetDurableRateLimitDenyCacheForTests } = await import("../src/lib/api-rate-limit");
    resetDurableRateLimitDenyCacheForTests();
  } catch {
    // Module may not be loaded yet.
  }
  vi.resetModules();
});

async function loadLimiter({ denyCache }: { denyCache: boolean }) {
  vi.stubEnv("NODE_ENV", "production");
  if (denyCache) vi.stubEnv("ALLOW_DURABLE_RATE_LIMIT_DENY_CACHE_IN_TESTS", "1");
  vi.doMock("@/lib/env", () => ({ isLocalNoAuthMode: () => false }));
  const limiter = await import("../src/lib/api-rate-limit");
  limiter.resetDurableRateLimitDenyCacheForTests();
  return limiter;
}

function durableRow(limited: boolean, limit = 60) {
  return {
    data: {
      limited,
      limit_value: limit,
      remaining: limited ? 0 : limit - 1,
      retry_after_seconds: 60,
      reset_at: new Date(Date.now() + 60_000).toISOString(),
    },
    error: null,
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("registry rate limit: served without waiting for the durable consume", () => {
  it("answers before the durable consume resolves, and still makes that consume", async () => {
    const { consumeSubjectApiRateLimit } = await loadLimiter({ denyCache: true });
    let release: (value: ReturnType<typeof durableRow>) => void = () => undefined;
    const rpc = vi.fn(() => new Promise<ReturnType<typeof durableRow>>((resolve) => (release = resolve)));

    const result = await consumeSubjectApiRateLimit({
      supabase: { rpc } as never,
      subject: { kind: "anonymous", subjectKey: "anon:registry-fast" },
      bucket: "registry",
    });

    expect(result.limited).toBe(false);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0]).toEqual([
      "consume_api_subject_rate_limit",
      expect.objectContaining({ p_subject_key: "anon:registry-fast", p_bucket: "registry", p_limit: 60 }),
    ]);
    release(durableRow(false));
  });

  it("refuses the subject's next request once the durable consume reports a denial", async () => {
    const { consumeSubjectApiRateLimit } = await loadLimiter({ denyCache: true });
    const rpc = vi.fn(async () => durableRow(true));
    const request = () =>
      consumeSubjectApiRateLimit({
        supabase: { rpc } as never,
        subject: { kind: "anonymous", subjectKey: "anon:registry-flood" },
        bucket: "registry",
      });

    await request();
    await flush();
    const next = await request();

    expect(next.limited).toBe(true);
    // The cached denial makes no further RPC, exactly like the awaited path.
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("caps a burst on one instance at the same limit before any durable denial arrives", async () => {
    const { consumeSubjectApiRateLimit } = await loadLimiter({ denyCache: true });
    const rpc = vi.fn(() => new Promise(() => undefined));
    const results = [];
    for (let index = 0; index < 61; index += 1) {
      results.push(
        await consumeSubjectApiRateLimit({
          supabase: { rpc } as never,
          subject: { kind: "anonymous", subjectKey: "anon:registry-burst" },
          bucket: "registry",
        }),
      );
    }

    expect(results.slice(0, 60).every((result) => !result.limited)).toBe(true);
    expect(results[60]?.limited).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(61);
  });

  it("uses the signed-in allowance and deny-cache key for an owner", async () => {
    const { consumeSubjectApiRateLimit } = await loadLimiter({ denyCache: true });
    const rpc = vi.fn(async () => durableRow(true, 120));
    const request = () =>
      consumeSubjectApiRateLimit({
        supabase: { rpc } as never,
        subject: { kind: "owner", ownerId: "owner-registry" },
        bucket: "registry",
      });

    expect((await request()).limited).toBe(false);
    await flush();
    expect((await request()).limited).toBe(true);
    expect(rpc.mock.calls[0]).toEqual([
      "consume_api_rate_limit",
      expect.objectContaining({ p_owner_id: "owner-registry", p_bucket: "registry", p_limit: 120 }),
    ]);
  });

  it("keeps a durable failure from surfacing, and still serves", async () => {
    const { consumeSubjectApiRateLimit } = await loadLimiter({ denyCache: true });
    const rpc = vi.fn(async () => ({ data: null, error: { code: "PGRST000", message: "down" } }));

    const result = await consumeSubjectApiRateLimit({
      supabase: { rpc } as never,
      subject: { kind: "owner", ownerId: "owner-outage" },
      bucket: "registry",
    });
    await flush();

    expect(result.limited).toBe(false);
  });

  it("still waits for the durable result on every other bucket", async () => {
    const { consumeSubjectApiRateLimit } = await loadLimiter({ denyCache: true });
    const rpc = vi.fn(async () => durableRow(true));

    const result = await consumeSubjectApiRateLimit({
      supabase: { rpc } as never,
      subject: { kind: "anonymous", subjectKey: "anon:search-awaited" },
      bucket: "search",
    });

    expect(result.limited).toBe(true);
  });

  it("waits for the durable result on registry too when the deny cache is off", async () => {
    const { consumeSubjectApiRateLimit } = await loadLimiter({ denyCache: false });
    const rpc = vi.fn(async () => durableRow(true));

    const result = await consumeSubjectApiRateLimit({
      supabase: { rpc } as never,
      subject: { kind: "anonymous", subjectKey: "anon:registry-awaited" },
      bucket: "registry",
    });

    expect(result.limited).toBe(true);
  });
});
