import { afterEach, describe, expect, it, vi } from "vitest";

import { PublicApiError } from "@/lib/http";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function loadProvider(vars: { mode?: string; key?: string }) {
  vi.resetModules();
  vi.stubEnv("RAG_PROVIDER_MODE", vars.mode ?? "auto");
  vi.stubEnv("OPENAI_API_KEY", vars.key ?? "");
  return import("@/lib/rag/rag-provider");
}

describe("rag provider mode resolution", () => {
  it("offline mode is always source-only, even with a key", async () => {
    const p = await loadProvider({ mode: "offline", key: "sk-test" });
    expect(p.isSourceOnlyMode()).toBe(true);
    expect(p.allowsAutoDegrade()).toBe(false);
  });

  it("openai mode never goes source-only, even without a key", async () => {
    const p = await loadProvider({ mode: "openai", key: "" });
    expect(p.isSourceOnlyMode()).toBe(false);
    expect(p.allowsAutoDegrade()).toBe(false);
  });

  it("auto mode uses OpenAI when a key is present", async () => {
    const p = await loadProvider({ mode: "auto", key: "sk-test" });
    expect(p.isSourceOnlyMode()).toBe(false);
    expect(p.allowsAutoDegrade()).toBe(true);
  });

  it("auto mode degrades to source-only when no key is present", async () => {
    const p = await loadProvider({ mode: "auto", key: "" });
    expect(p.isSourceOnlyMode()).toBe(true);
    expect(p.allowsAutoDegrade()).toBe(true);
  });
});

describe("provider failure classification", () => {
  it("classifies quota, auth, rate-limit, timeout, and generic failures", async () => {
    const p = await loadProvider({ mode: "auto", key: "sk-test" });
    expect(p.classifyProviderFailure(Object.assign(new Error("x"), { status: 429, code: "insufficient_quota" }))).toBe(
      "quota_exhausted",
    );
    expect(p.classifyProviderFailure(new PublicApiError("quota", 429, { code: "insufficient_quota" }))).toBe(
      "quota_exhausted",
    );
    expect(p.classifyProviderFailure(Object.assign(new Error("x"), { status: 401 }))).toBe("auth_failed");
    expect(
      p.classifyProviderFailure(
        Object.assign(new Error("Rate limit reached"), { status: 429, code: "rate_limit_exceeded" }),
      ),
    ).toBe("rate_limited");
    expect(p.classifyProviderFailure(Object.assign(new Error("Request timed out"), { code: "ETIMEDOUT" }))).toBe(
      "timeout",
    );
    expect(p.classifyProviderFailure(new Error("something else"))).toBe("provider_failed");
  });

  it("derives a stable source-only reason for offline vs degraded auto", async () => {
    const offline = await loadProvider({ mode: "offline" });
    expect(offline.sourceOnlyReason()).toBe("source_only_offline_mode");

    const auto = await loadProvider({ mode: "auto", key: "" });
    expect(auto.sourceOnlyReason()).toBe("source_only_no_api");
    expect(auto.sourceOnlyReason(new PublicApiError("quota", 429, { code: "insufficient_quota" }))).toBe(
      "source_only_quota_exhausted",
    );
  });
});
