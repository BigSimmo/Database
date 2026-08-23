import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AnswerRouteDeadlineExceededError,
  answerRouteResultCanBeCached,
  answerRouteBudgetMs,
  createAnswerRouteDeadline,
  deadlineAllowsGenerationRetry,
  generationRecoveryReserveMs,
  minimumGenerationRetryMs,
} from "../src/lib/rag/rag-route-budget";

afterEach(() => {
  vi.useRealTimers();
});

describe("RAG route deadlines", () => {
  it("defines the release route budgets", () => {
    expect(answerRouteBudgetMs).toEqual({
      unsupported: 0,
      extractive: 12_000,
      fast: 25_000,
      strong: 35_000,
    });
  });

  it("shares one shrinking deadline across retries", async () => {
    vi.useFakeTimers();
    const startedAt = Date.now();
    await vi.advanceTimersByTimeAsync(10_000);
    const deadline = createAnswerRouteDeadline({ routeMode: "fast", startedAt });

    expect(deadline.requestTimeoutMs(30_000)).toBe(15_000);
    expect(deadline.generationRequestTimeoutMs(30_000)).toBe(13_000);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(deadline.requestTimeoutMs(30_000)).toBe(5_000);
    expect(deadline.generationRequestTimeoutMs(30_000)).toBe(3_000);

    const pending = deadline.race(new Promise<never>(() => undefined));
    const rejection = expect(pending).rejects.toBeInstanceOf(AnswerRouteDeadlineExceededError);
    await vi.advanceTimersByTimeAsync(5_000);

    await rejection;
    expect(deadline.deadlineExceeded).toBe(true);
    deadline.dispose();
  });

  it("preserves the caller abort reason", async () => {
    const caller = new AbortController();
    const reason = new DOMException("caller stopped", "AbortError");
    const deadline = createAnswerRouteDeadline({ routeMode: "strong", callerSignal: caller.signal });
    const pending = deadline.race(new Promise<never>(() => undefined));

    caller.abort(reason);

    await expect(pending).rejects.toBe(reason);
    expect(deadline.deadlineExceeded).toBe(false);
    deadline.dispose();
  });

  it("does not allow a result to be cached after its route deadline", async () => {
    vi.useFakeTimers();
    const deadline = createAnswerRouteDeadline({ routeMode: "extractive" });
    const answer = { routingReason: "high_confidence_extractive_retrieval", degradedMode: undefined };

    expect(answerRouteResultCanBeCached(deadline, answer)).toBe(true);
    await vi.advanceTimersByTimeAsync(answerRouteBudgetMs.extractive);
    expect(answerRouteResultCanBeCached(deadline, answer)).toBe(false);

    deadline.dispose();
  });

  it("never caches provider-generation fallbacks before the route deadline", () => {
    const deadline = { deadlineExceeded: false };

    expect(
      answerRouteResultCanBeCached(deadline, {
        routingReason: "clinical_fast_grounded_synthesis; generation_fallback:provider_timeout",
        degradedMode: { active: true, reason: "generation_fallback:provider_timeout" },
      }),
    ).toBe(false);
    expect(
      answerRouteResultCanBeCached(deadline, {
        routingReason: "clinical_fast_grounded_synthesis; source_backed_extractive_fallback",
        degradedMode: { active: true, reason: "generation_fallback:provider_timeout" },
      }),
    ).toBe(false);
    expect(
      answerRouteResultCanBeCached(deadline, {
        routingReason: "strong_generation; generation_fallback",
        degradedMode: { active: true, reason: "generation_fallback" },
      }),
    ).toBe(false);
    // Bare routing marker alone (no degradedMode) must refuse the cache too.
    expect(
      answerRouteResultCanBeCached(deadline, {
        routingReason: "strong_generation; generation_fallback",
        degradedMode: undefined,
      }),
    ).toBe(false);
    expect(
      answerRouteResultCanBeCached(deadline, {
        routingReason: "clinical_fast; Generation_Fallback:provider_timeout",
        degradedMode: undefined,
      }),
    ).toBe(false);
  });
});

describe("budget-aware generation deadlines (E-3b)", () => {
  it("pins the reserve and retry-floor constants", () => {
    expect(generationRecoveryReserveMs).toBe(2_000);
    expect(minimumGenerationRetryMs).toBe(20_000);
  });

  it("holds back the recovery reserve from generation timeouts", async () => {
    vi.useFakeTimers();
    const deadline = createAnswerRouteDeadline({ routeMode: "fast", startedAt: Date.now() });
    await vi.advanceTimersByTimeAsync(10_000);
    // 15_000 remaining: plain requestTimeoutMs grants it all, the generation
    // variant holds back the 2_000ms recovery reserve.
    expect(deadline.requestTimeoutMs(30_000)).toBe(15_000);
    expect(deadline.generationRequestTimeoutMs(30_000)).toBe(13_000);
    deadline.dispose();
  });

  it("caps a fresh fast generation below the outer route deadline", () => {
    const deadline = createAnswerRouteDeadline({ routeMode: "fast", startedAt: Date.now() });
    expect(deadline.generationRequestTimeoutMs(30_000)).toBe(answerRouteBudgetMs.fast - generationRecoveryReserveMs);
    deadline.dispose();
  });

  it("floors at 1ms when the reserve exceeds remaining budget", async () => {
    vi.useFakeTimers();
    const deadline = createAnswerRouteDeadline({ routeMode: "extractive", startedAt: Date.now() });
    await vi.advanceTimersByTimeAsync(answerRouteBudgetMs.extractive - 1_500);
    expect(deadline.generationRequestTimeoutMs(30_000)).toBe(1);
    deadline.dispose();
  });

  it("gates generation retries on reserve + viability floor", async () => {
    vi.useFakeTimers();
    const deadline = createAnswerRouteDeadline({ routeMode: "fast", startedAt: Date.now() });
    // 25_000 budget: allowed until remaining < 22_000 (2_000 reserve + 20_000 floor).
    expect(deadlineAllowsGenerationRetry(deadline)).toBe(true);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(deadline.remainingMs()).toBe(22_000);
    expect(deadlineAllowsGenerationRetry(deadline)).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(deadlineAllowsGenerationRetry(deadline)).toBe(false);
    deadline.dispose();
  });

  it("never allows generation retries on zero-budget routes", () => {
    const deadline = createAnswerRouteDeadline({ routeMode: "unsupported", startedAt: Date.now() });
    expect(deadlineAllowsGenerationRetry(deadline)).toBe(false);
    deadline.dispose();
  });
});
