import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * RAG_QUERY_HASH_SECRET is optional outside production, and it is also what signs the
 * answer-feedback token. Without it `createAnswerFeedbackToken()` returns undefined, the
 * answer payload carries no `feedbackToken`, and the dashboard tells the reader the answer
 * "predates traceable feedback. Run the question again." — an instruction that can never
 * succeed on that deployment. The failure was silent: nothing anywhere said why
 * (2026-09-02 audit, L44).
 *
 * Warning only. Validation is unchanged, and production still fails closed in
 * requireQueryHashSecret().
 */

async function loadEnv(stubs: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(stubs)) {
    vi.stubEnv(key, value);
  }
  return import("../src/lib/env");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("warnAnswerFeedbackDisabled", () => {
  it("warns exactly once outside production when the secret is unset", async () => {
    const { warnAnswerFeedbackDisabled } = await loadEnv({
      NODE_ENV: "development",
      RAG_QUERY_HASH_SECRET: undefined,
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    warnAnswerFeedbackDisabled();
    warnAnswerFeedbackDisabled();

    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0]?.[0]);
    expect(message).toContain("RAG_QUERY_HASH_SECRET");
    expect(message).toContain("Answer feedback is disabled");
  });

  it("stays silent when the secret is configured", async () => {
    const { warnAnswerFeedbackDisabled } = await loadEnv({
      NODE_ENV: "development",
      RAG_QUERY_HASH_SECRET: "0123456789abcdef0123",
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    warnAnswerFeedbackDisabled();

    expect(warn).not.toHaveBeenCalled();
  });

  it("stays silent in production, where requireQueryHashSecret already fails closed", async () => {
    const { warnAnswerFeedbackDisabled, requireQueryHashSecret } = await loadEnv({
      NODE_ENV: "production",
      RAG_QUERY_HASH_SECRET: undefined,
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    warnAnswerFeedbackDisabled();

    expect(warn).not.toHaveBeenCalled();
    expect(() => requireQueryHashSecret()).toThrow(/RAG_QUERY_HASH_SECRET/);
  });
});
