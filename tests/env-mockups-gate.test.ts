import { afterEach, describe, expect, it, vi } from "vitest";

// mockupsEnabled() reads a frozen value from `env` (parsed at import time) plus
// live process.env.NODE_ENV, so each case re-imports the module with a fresh,
// stubbed environment (same pattern as env-demo-mode.test.ts). The /mockups/*
// design-exploration routes must 404 in production unless explicitly opted in.

const ENV_KEYS = ["NODE_ENV", "NEXT_PUBLIC_MOCKUPS_ENABLED"] as const;

async function loadEnv(overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>) {
  vi.resetModules();
  for (const key of ENV_KEYS) {
    vi.stubEnv(key, overrides[key]);
  }
  return import("../src/lib/env");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("mockupsEnabled production guard", () => {
  it("disables mockup routes in production by default", async () => {
    const { mockupsEnabled } = await loadEnv({ NODE_ENV: "production" });
    expect(mockupsEnabled()).toBe(false);
  });

  it("honors an explicit opt-in in production", async () => {
    const { mockupsEnabled } = await loadEnv({
      NODE_ENV: "production",
      NEXT_PUBLIC_MOCKUPS_ENABLED: "true",
    });
    expect(mockupsEnabled()).toBe(true);
  });

  it("keeps mockup routes reachable in development without opt-in", async () => {
    const { mockupsEnabled } = await loadEnv({ NODE_ENV: "development" });
    expect(mockupsEnabled()).toBe(true);
  });

  it("keeps mockup routes reachable in test without opt-in", async () => {
    const { mockupsEnabled } = await loadEnv({ NODE_ENV: "test" });
    expect(mockupsEnabled()).toBe(true);
  });
});
