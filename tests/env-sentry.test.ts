import { afterEach, describe, expect, it, vi } from "vitest";

// requireSentryEnv() reads the frozen `env` value parsed at import time, so each
// case re-imports the module with a stubbed environment.

async function loadEnv(stubs: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(stubs)) {
    vi.stubEnv(key, value);
  }
  return import("../src/lib/env");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("requireSentryEnv", () => {
  it("does not throw when Sentry is fully unset", async () => {
    const { requireSentryEnv } = await loadEnv({
      NEXT_PUBLIC_SENTRY_DSN: undefined,
      SENTRY_DSN: undefined,
      SENTRY_ORG: undefined,
      SENTRY_PROJECT: undefined,
      SENTRY_AUTH_TOKEN: undefined,
    });
    expect(() => requireSentryEnv()).not.toThrow();
  });

  it("does not throw on partial build-time sourcemap credentials at runtime", async () => {
    const { requireSentryEnv } = await loadEnv({
      NEXT_PUBLIC_SENTRY_DSN: undefined,
      SENTRY_DSN: undefined,
      SENTRY_ORG: "clinibase-xz",
      SENTRY_PROJECT: undefined,
      SENTRY_AUTH_TOKEN: undefined,
    });
    expect(() => requireSentryEnv()).not.toThrow();
  });

  it("throws when client and server DSNs disagree", async () => {
    const { requireSentryEnv } = await loadEnv({
      NEXT_PUBLIC_SENTRY_DSN: "https://public@o0.ingest.sentry.io/1",
      SENTRY_DSN: "https://server@o0.ingest.sentry.io/2",
    });
    expect(() => requireSentryEnv()).toThrow(/Mismatch between NEXT_PUBLIC_SENTRY_DSN and SENTRY_DSN/);
  });

  it("throws on placeholder DSN values", async () => {
    const { requireSentryEnv } = await loadEnv({
      SENTRY_DSN: "https://your-public-key@o0.ingest.sentry.io/0",
      NEXT_PUBLIC_SENTRY_DSN: undefined,
    });
    expect(() => requireSentryEnv()).toThrow(/placeholder/);
  });
});
