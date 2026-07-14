import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AnswerRouteDeadlineExceededError,
  answerRouteResultCanBeCached,
  answerRouteBudgetMs,
  createAnswerRouteDeadline,
} from "../src/lib/rag-route-budget";

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
    await vi.advanceTimersByTimeAsync(10_000);
    expect(deadline.requestTimeoutMs(30_000)).toBe(5_000);

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

    expect(answerRouteResultCanBeCached(deadline)).toBe(true);
    await vi.advanceTimersByTimeAsync(answerRouteBudgetMs.extractive);
    expect(answerRouteResultCanBeCached(deadline)).toBe(false);

    deadline.dispose();
  });
});
