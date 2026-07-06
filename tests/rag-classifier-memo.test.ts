import { afterEach, describe, expect, it, vi } from "vitest";

// Finding #11 interim fix: the LLM classifier verdict must be deterministic per query for
// the memo TTL window, so the unsupported short-circuit cannot flip run-to-run and return
// 0 results for a valid in-corpus topic on some runs but not others.

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.useRealTimers();
});

async function loadWithClassifierMock(mock: ReturnType<typeof vi.fn>) {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.doMock("@/lib/openai", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../src/lib/openai")>();
    return { ...actual, generateStructuredTextResult: mock };
  });
  const rag = await import("../src/lib/rag");
  const { analyzeClinicalQuery } = await import("../src/lib/clinical-search");
  rag.resetClassifierVerdictMemoForTests();
  return { rag, analyzeClinicalQuery };
}

function classifierResponse(overrides: Record<string, unknown> = {}) {
  return {
    text: JSON.stringify({
      queryClass: "broad_summary",
      confidence: 0.9,
      reasons: ["classifier_test"],
      expandedTerms: ["mood disorder"],
      ...overrides,
    }),
  };
}

function fallbackQueryAnalysis(
  analyzeClinicalQuery: (typeof import("../src/lib/clinical-search"))["analyzeClinicalQuery"],
) {
  // A bare condition query is exactly the class that needs the LLM fallback (deterministic
  // confidence below 0.58 with class unsupported_or_general) — the finding #11 shape.
  const query = "bipolar disorder";
  const analysis = analyzeClinicalQuery(query);
  expect(analysis.needsClassifierFallback).toBe(true);
  return { query, analysis };
}

describe("classifier verdict memoization", () => {
  it("does not re-call the model for a repeated query and returns an identical verdict", async () => {
    const mock = vi.fn(async () => classifierResponse());
    const { rag, analyzeClinicalQuery } = await loadWithClassifierMock(mock);
    const { query, analysis } = fallbackQueryAnalysis(analyzeClinicalQuery);

    const first = await rag.analyzeQueryWithClassifierFallback(query, analysis);
    const second = await rag.analyzeQueryWithClassifierFallback(query, analysis);

    expect(mock).toHaveBeenCalledTimes(1);
    expect(first.queryClass).toBe("broad_summary");
    expect(second.queryClass).toBe("broad_summary");
    expect(second).toEqual(first);
  });

  it("memoizes rejected verdicts so a rejection is also deterministic", async () => {
    const mock = vi.fn(async () => classifierResponse({ confidence: 0.3 }));
    const { rag, analyzeClinicalQuery } = await loadWithClassifierMock(mock);
    const { query, analysis } = fallbackQueryAnalysis(analyzeClinicalQuery);

    const first = await rag.analyzeQueryWithClassifierFallback(query, analysis);
    const second = await rag.analyzeQueryWithClassifierFallback(query, analysis);

    expect(mock).toHaveBeenCalledTimes(1);
    // Rejected verdict (confidence < 0.58) leaves the deterministic analysis untouched.
    expect(first).toBe(analysis);
    expect(second).toBe(analysis);
  });

  it("does not memoize transport errors — the next request retries the classifier", async () => {
    const mock = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(classifierResponse());
    const { rag, analyzeClinicalQuery } = await loadWithClassifierMock(mock);
    const { query, analysis } = fallbackQueryAnalysis(analyzeClinicalQuery);

    const first = await rag.analyzeQueryWithClassifierFallback(query, analysis);
    const second = await rag.analyzeQueryWithClassifierFallback(query, analysis);

    expect(mock).toHaveBeenCalledTimes(2);
    expect(first).toBe(analysis);
    expect(second.queryClass).toBe("broad_summary");
  });

  it("deduplicates concurrent in-flight calls for the same query", async () => {
    let resolveCall: ((value: { text: string }) => void) | undefined;
    const mock = vi.fn(
      () =>
        new Promise<{ text: string }>((resolve) => {
          resolveCall = resolve;
        }),
    );
    const { rag, analyzeClinicalQuery } = await loadWithClassifierMock(mock);
    const { query, analysis } = fallbackQueryAnalysis(analyzeClinicalQuery);

    const firstPromise = rag.analyzeQueryWithClassifierFallback(query, analysis);
    const secondPromise = rag.analyzeQueryWithClassifierFallback(query, analysis);
    resolveCall?.(classifierResponse());
    const [first, second] = await Promise.all([firstPromise, secondPromise]);

    expect(mock).toHaveBeenCalledTimes(1);
    expect(first.queryClass).toBe("broad_summary");
    expect(second.queryClass).toBe("broad_summary");
  });

  it("re-calls the model after the memo TTL expires", async () => {
    vi.useFakeTimers({ now: new Date("2026-07-06T00:00:00Z") });
    const mock = vi.fn(async () => classifierResponse());
    const { rag, analyzeClinicalQuery } = await loadWithClassifierMock(mock);
    const { query, analysis } = fallbackQueryAnalysis(analyzeClinicalQuery);

    await rag.analyzeQueryWithClassifierFallback(query, analysis);
    vi.setSystemTime(new Date("2026-07-06T00:16:00Z"));
    await rag.analyzeQueryWithClassifierFallback(query, analysis);

    expect(mock).toHaveBeenCalledTimes(2);
  });
});
