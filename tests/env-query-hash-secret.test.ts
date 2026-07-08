import { afterEach, describe, expect, it, vi } from "vitest";

// requireQueryHashSecret() reads the frozen `env` value parsed at import time, so
// each case re-imports the module with a stubbed environment. Production must fail
// closed when RAG_QUERY_HASH_SECRET is absent, so clinical-query hashes written to
// the log tables are keyed HMAC pseudonyms and not offline-reversible SHA-256 (PIA-2).

async function loadEnv(secret: string | undefined) {
  vi.resetModules();
  vi.stubEnv("RAG_QUERY_HASH_SECRET", secret);
  return import("../src/lib/env");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("requireQueryHashSecret", () => {
  it("throws when RAG_QUERY_HASH_SECRET is absent", async () => {
    const { requireQueryHashSecret } = await loadEnv(undefined);
    expect(() => requireQueryHashSecret()).toThrow(/RAG_QUERY_HASH_SECRET/);
  });

  it("does not throw when RAG_QUERY_HASH_SECRET is set", async () => {
    const { requireQueryHashSecret } = await loadEnv("test-secret-at-least-16-chars");
    expect(() => requireQueryHashSecret()).not.toThrow();
  });
});
