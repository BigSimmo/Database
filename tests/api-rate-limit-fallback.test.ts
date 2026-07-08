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
