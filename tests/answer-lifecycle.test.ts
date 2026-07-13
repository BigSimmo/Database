import { describe, expect, it } from "vitest";
import { answerLifecycleReducer, initialAnswerLifecycle } from "../src/lib/answer-lifecycle";
describe("answer lifecycle", () => {
  it("keeps cancellation distinct from completion", () => {
    const loading = answerLifecycleReducer(initialAnswerLifecycle, { type: "start", query: "lithium" });
    const streaming = answerLifecycleReducer(loading, { type: "stream" });
    expect(answerLifecycleReducer(streaming, { type: "cancel" })).toEqual({ status: "cancelled", query: "lithium" });
    expect(answerLifecycleReducer(streaming, { type: "complete" }).status).toBe("completed");
  });
  it("returns a cancelled conversation to an empty lifecycle on new chat reset", () => {
    const loading = answerLifecycleReducer(initialAnswerLifecycle, { type: "start", query: "lithium" });
    const cancelled = answerLifecycleReducer(loading, { type: "cancel" });
    expect(answerLifecycleReducer(cancelled, { type: "reset" })).toEqual(initialAnswerLifecycle);
  });
});
