import { describe, expect, it } from "vitest";
import {
  answerProgressDisplayMessage,
  answerProgressStepIndex,
  normalizeAnswerProgressEvent,
} from "../src/components/clinical-dashboard/answer-progress";
import { toPublicAnswerProgressEvent } from "../src/lib/answer-progress-public";

describe("answer progress events", () => {
  it("keeps only safe, normalized Australian source counts at the public boundary", () => {
    expect(
      toPublicAnswerProgressEvent({
        stage: "ranking",
        message: "private model route marker",
        selectedContextCount: 4.9,
        australianSourceCount: 4,
        waSourceCount: 3,
        usedSupplementaryFallback: false,
        model: "private-model",
        reason: "private-reason",
        smartApiPlan: { private: true },
      }),
    ).toEqual({
      stage: "ranking",
      message: "Selecting the most relevant source passages.",
      selectedContextCount: 4,
      australianSourceCount: 4,
      waSourceCount: 3,
      usedSupplementaryFallback: false,
    });
  });

  it("accepts legacy message-only progress while rendering stable copy", () => {
    const progress = normalizeAnswerProgressEvent({ message: "Selected fast route using private-model-marker." });

    expect(progress).toMatchObject({ stage: "ranking" });
    expect(answerProgressDisplayMessage(progress!)).toBe("Selecting the most relevant source passages.");
    expect(answerProgressDisplayMessage(progress!)).not.toMatch(/fast|private|model|route/i);
  });

  it("renders truthful Australian priority and fallback copy", () => {
    const progress = normalizeAnswerProgressEvent({
      stage: "ranking",
      message: "Selected governed passages.",
      selectedContextCount: 4,
      australianSourceCount: 4,
      waSourceCount: 4,
      usedSupplementaryFallback: false,
    });

    expect(answerProgressDisplayMessage(progress!)).toBe("Prioritising 4 Australian source passages, including 4 WA.");
    expect(answerProgressStepIndex("fallback")).toBe(3);
    expect(answerProgressDisplayMessage({ stage: "fallback", message: "private" })).toContain("source-backed answer");
  });

  it("rejects invalid progress objects and clamps safe counts", () => {
    expect(normalizeAnswerProgressEvent(null)).toBeNull();
    expect(normalizeAnswerProgressEvent({ stage: "ranking", message: "" })).toBeNull();
    expect(
      normalizeAnswerProgressEvent({
        stage: "retrieved",
        message: "Found passages.",
        resultCount: 2.8,
        selectedContextCount: -1,
      }),
    ).toMatchObject({ resultCount: 2, selectedContextCount: undefined });
  });
});
