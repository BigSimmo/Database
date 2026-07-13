import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("allowRateLimitInMemoryFallbackOnUnavailable", () => {
  it("enables fallback for production deployments", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { allowRateLimitInMemoryFallbackOnUnavailable } = await import("../src/lib/api-rate-limit");
    expect(allowRateLimitInMemoryFallbackOnUnavailable()).toBe(true);
  });

  it("enables fallback for local no-auth development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.doMock("@/lib/env", () => ({
      isLocalNoAuthMode: () => true,
    }));
    const { allowRateLimitInMemoryFallbackOnUnavailable } = await import("../src/lib/api-rate-limit");
    expect(allowRateLimitInMemoryFallbackOnUnavailable()).toBe(true);
  });
});

describe("paid anonymous answer limits", () => {
  it("fails closed when the durable limiter is unavailable in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.doMock("@/lib/env", () => ({
      isLocalNoAuthMode: () => false,
    }));
    const { ApiRateLimitUnavailableError, consumeSubjectApiRateLimit } = await import("../src/lib/api-rate-limit");
    const supabase = {
      rpc: vi.fn(async () => ({ data: null, error: { code: "PGRST202", message: "missing RPC" } })),
    };

    await expect(
      consumeSubjectApiRateLimit({
        supabase: supabase as never,
        subject: { kind: "anonymous", subjectKey: "anon:caller" },
        bucket: "answer",
        allowInMemoryFallbackOnUnavailable: true,
      }),
    ).rejects.toBeInstanceOf(ApiRateLimitUnavailableError);
  });

  it("enforces a global durable quota as well as the caller quota", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.doMock("@/lib/env", () => ({
      isLocalNoAuthMode: () => false,
    }));
    const { consumeSubjectApiRateLimit } = await import("../src/lib/api-rate-limit");
    const rpc = vi.fn(async (_name: string, args: Record<string, unknown>) => ({
      data: {
        limited: false,
        limit_value: args.p_limit,
        remaining: Number(args.p_limit) - 1,
        retry_after_seconds: 60,
        reset_at: new Date(Date.now() + 60_000).toISOString(),
      },
      error: null,
    }));

    await consumeSubjectApiRateLimit({
      supabase: { rpc } as never,
      subject: { kind: "anonymous", subjectKey: "anon:caller" },
      bucket: "answer",
    });

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls.map(([, args]) => args.p_subject_key)).toEqual(
      expect.arrayContaining(["anon:caller", "anon:answer:global"]),
    );
  });

  it("does not consume the global quota after the caller quota denies the request", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.doMock("@/lib/env", () => ({
      isLocalNoAuthMode: () => false,
    }));
    const { consumeSubjectApiRateLimit } = await import("../src/lib/api-rate-limit");
    const rpc = vi.fn(async (_name: string, _args: Record<string, unknown>) => {
      void _name;
      void _args;
      return {
        data: {
          limited: true,
          limit_value: 6,
          remaining: 0,
          retry_after_seconds: 60,
          reset_at: new Date(Date.now() + 60_000).toISOString(),
        },
        error: null,
      };
    });

    const result = await consumeSubjectApiRateLimit({
      supabase: { rpc } as never,
      subject: { kind: "anonymous", subjectKey: "anon:caller" },
      bucket: "answer",
    });

    expect(result.limited).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0]?.[1]).toMatchObject({ p_subject_key: "anon:caller" });
  });
});

describe("document_upload fail-closed limiter", () => {
  it("fails closed (does not fall back to per-instance memory) when the durable limiter is unavailable", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.doMock("@/lib/env", () => ({
      isLocalNoAuthMode: () => false,
    }));
    const { ApiRateLimitUnavailableError, consumeSubjectApiRateLimit } = await import("../src/lib/api-rate-limit");
    const supabase = {
      rpc: vi.fn(async () => ({ data: null, error: { code: "PGRST202", message: "missing RPC" } })),
    };

    // Even when the caller opts into the in-memory fallback, document_upload (storage writes +
    // ingestion cost) must fail closed rather than grant N× the limit across instances.
    await expect(
      consumeSubjectApiRateLimit({
        supabase: supabase as never,
        subject: { kind: "owner", ownerId: "owner-1" },
        bucket: "document_upload",
        allowInMemoryFallbackOnUnavailable: true,
      }),
    ).rejects.toBeInstanceOf(ApiRateLimitUnavailableError);
  });

  it("still allows the in-memory fallback for a non-fail-closed bucket (document_read)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.doMock("@/lib/env", () => ({
      isLocalNoAuthMode: () => false,
    }));
    const { consumeSubjectApiRateLimit } = await import("../src/lib/api-rate-limit");
    const supabase = {
      rpc: vi.fn(async () => ({ data: null, error: { code: "PGRST202", message: "missing RPC" } })),
    };

    const result = await consumeSubjectApiRateLimit({
      supabase: supabase as never,
      subject: { kind: "owner", ownerId: "owner-1" },
      bucket: "document_read",
      allowInMemoryFallbackOnUnavailable: true,
    });

    // document_read degrades to the per-instance limiter instead of failing closed.
    expect(result.limited).toBe(false);
  });

  it("enforces a global anonymous upload quota as well as the caller quota", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.doMock("@/lib/env", () => ({
      isLocalNoAuthMode: () => false,
    }));
    const { consumeSubjectApiRateLimit } = await import("../src/lib/api-rate-limit");
    const rpc = vi.fn(async (_name: string, args: Record<string, unknown>) => ({
      data: {
        limited: false,
        limit_value: args.p_limit,
        remaining: Number(args.p_limit) - 1,
        retry_after_seconds: 60,
        reset_at: new Date(Date.now() + 60_000).toISOString(),
      },
      error: null,
    }));

    await consumeSubjectApiRateLimit({
      supabase: { rpc } as never,
      subject: { kind: "anonymous", subjectKey: "anon:caller" },
      bucket: "document_upload",
    });

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls.map(([, args]) => args.p_subject_key)).toEqual(
      expect.arrayContaining(["anon:caller", "anon:document_upload:global"]),
    );
  });

  it("does not consume the global upload quota after the caller quota denies the request", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.doMock("@/lib/env", () => ({
      isLocalNoAuthMode: () => false,
    }));
    const { consumeSubjectApiRateLimit } = await import("../src/lib/api-rate-limit");
    const rpc = vi.fn(async () => ({
      data: {
        limited: true,
        limit_value: 3,
        remaining: 0,
        retry_after_seconds: 60,
        reset_at: new Date(Date.now() + 60_000).toISOString(),
      },
      error: null,
    }));

    const result = await consumeSubjectApiRateLimit({
      supabase: { rpc } as never,
      subject: { kind: "anonymous", subjectKey: "anon:caller" },
      bucket: "document_upload",
    });

    expect(result.limited).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0]?.[1]).toMatchObject({ p_subject_key: "anon:caller" });
  });

  it("reports the smaller of the caller and global remaining counts when both allow the request", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.doMock("@/lib/env", () => ({
      isLocalNoAuthMode: () => false,
    }));
    const { consumeSubjectApiRateLimit } = await import("../src/lib/api-rate-limit");
    const rpc = vi.fn(async (_name: string, args: Record<string, unknown>) => {
      const isGlobal = args.p_subject_key === "anon:document_upload:global";
      return {
        data: {
          limited: false,
          limit_value: args.p_limit,
          // Global ceiling is nearly exhausted while the per-caller quota still has headroom.
          remaining: isGlobal ? 1 : 2,
          retry_after_seconds: 60,
          reset_at: new Date(Date.now() + 60_000).toISOString(),
        },
        error: null,
      };
    });

    const result = await consumeSubjectApiRateLimit({
      supabase: { rpc } as never,
      subject: { kind: "anonymous", subjectKey: "anon:caller" },
      bucket: "document_upload",
    });

    expect(result.limited).toBe(false);
    expect(result.remaining).toBe(1);
  });

  it("does not apply a global ceiling to buckets other than answer and document_upload", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.doMock("@/lib/env", () => ({
      isLocalNoAuthMode: () => false,
    }));
    const { consumeSubjectApiRateLimit } = await import("../src/lib/api-rate-limit");
    const rpc = vi.fn(async (_name: string, args: Record<string, unknown>) => ({
      data: {
        limited: false,
        limit_value: args.p_limit,
        remaining: Number(args.p_limit) - 1,
        retry_after_seconds: 60,
        reset_at: new Date(Date.now() + 60_000).toISOString(),
      },
      error: null,
    }));

    await consumeSubjectApiRateLimit({
      supabase: { rpc } as never,
      subject: { kind: "anonymous", subjectKey: "anon:caller" },
      bucket: "document_read",
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0]?.[1]).toMatchObject({ p_subject_key: "anon:caller" });
  });
});
