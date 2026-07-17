import { afterEach, describe, expect, it } from "vitest";

import {
  answerCoalescingMetricsSnapshot,
  recordAnswerOrigination,
  recordAnswerOriginationFinished,
  recordCoalescedAnswerWaiter,
  resetAnswerCoalescingMetrics,
} from "@/lib/observability/answer-coalescing-metrics";

afterEach(() => {
  resetAnswerCoalescingMetrics();
});

describe("answer coalescing metrics", () => {
  it("reports a safe zero snapshot before coalescible answer work", () => {
    expect(answerCoalescingMetricsSnapshot()).toEqual({
      originations: 0,
      coalescedWaiters: 0,
      activeOriginations: 0,
      coalescingRate: 0,
    });
  });

  it("tracks originations, waiters, and the active gauge without request content", () => {
    recordAnswerOrigination();
    recordAnswerOrigination();
    recordCoalescedAnswerWaiter();
    recordAnswerOriginationFinished();

    expect(answerCoalescingMetricsSnapshot()).toEqual({
      originations: 2,
      coalescedWaiters: 1,
      activeOriginations: 1,
      coalescingRate: 1 / 3,
    });
  });

  it("never reports a negative active gauge when cleanup is repeated", () => {
    recordAnswerOriginationFinished();
    expect(answerCoalescingMetricsSnapshot().activeOriginations).toBe(0);
  });
});
