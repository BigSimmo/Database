import { describe, expect, it } from "vitest";
import {
  answerProgressDisplayMessage,
  answerProgressStepIndex,
  normalizeAnswerProgressEvent,
} from "../src/components/clinical-dashboard/answer-progress";
import { toPublicAnswerProgressEvent } from "../src/lib/answer-progress-public";
import { readAnswerStream } from "../src/components/clinical-dashboard/search-utils";

describe("answer progress events", () => {
  it("keeps only safe, normalized Australian source counts at the public boundary", () => {
    const publicEvent = toPublicAnswerProgressEvent({
      stage: "ranking",
      message: "private model route marker",
      selectedContextCount: 4.9,
      australianSourceCount: 4,
      waSourceCount: 3,
      usedSupplementaryFallback: true,
      model: "private-model",
      reason: "private-reason",
      smartApiPlan: { private: true },
    });

    expect(publicEvent).toEqual({
      stage: "ranking",
      message: "Selecting the most relevant source passages.",
      selectedContextCount: 4,
      australianSourceCount: 4,
      waSourceCount: 3,
    });
    expect(publicEvent).not.toHaveProperty("usedSupplementaryFallback");
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

  it("ignores retired provisional events, reports byte activity, and commits only a valid final answer", async () => {
    const progress: string[] = [];
    let activityCount = 0;
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('event: progress\ndata: {"stage":"retrieving","message":"private"}\n\n'));
        controller.enqueue(encoder.encode('event: token\ndata: {"delta":"Draft"}\n\nevent: revising\ndata: {}\n\n'));
        controller.enqueue(
          encoder.encode(
            'event: progress\ndata: {"stage":"complete","message":"private","elapsedMs":1200}\n\nevent: final\ndata: {"answer":"Grounded answer.","grounded":true,"confidence":"medium","citations":[],"sources":[]}\n\n',
          ),
        );
        controller.close();
      },
    });

    const answer = await readAnswerStream(
      new Response(body, { headers: { "Content-Type": "text/event-stream" } }),
      (event) => progress.push(event.stage),
      () => {
        activityCount += 1;
      },
    );

    expect(progress).toEqual(["retrieving", "complete"]);
    expect(activityCount).toBe(3);
    expect(answer.answer).toBe("Grounded answer.");
  });

  it("fails closed when a shared answer stream ends without a valid final payload", async () => {
    const response = new Response('event: progress\ndata: {"stage":"complete","message":"private"}\n\n');

    await expect(readAnswerStream(response, () => undefined)).rejects.toThrow(
      "Answer stream ended before a final answer was received.",
    );
  });
});
