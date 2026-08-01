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

  it("maps every supported internal stage to stable public copy", () => {
    const publicCopy = (stage: string, extra: Record<string, unknown> = {}) =>
      toPublicAnswerProgressEvent({ stage, message: "private internal detail", ...extra });

    expect(publicCopy("scoping")).toEqual({ stage: "scoping", message: "Preparing the clinical search scope." });
    expect(publicCopy("retrieving")).toEqual({
      stage: "retrieving",
      message: "Searching indexed clinical documents.",
    });
    expect(publicCopy("retrieved", { resultCount: 1 })).toEqual({
      stage: "retrieved",
      message: "Found 1 candidate source passage.",
      resultCount: 1,
    });
    expect(publicCopy("retrieved", { resultCount: 7 })?.message).toBe("Found 7 candidate source passages.");
    expect(publicCopy("retrieved")?.message).toBe("Source passages found.");
    // Internal routing and finalizing stages collapse into the public stages that describe them.
    expect(publicCopy("routing")?.stage).toBe("ranking");
    expect(publicCopy("finalizing")).toEqual({
      stage: "verifying",
      message: "Checking citations, clinical numbers, and source metadata.",
    });
    expect(publicCopy("generating")?.message).toBe("Drafting a cited answer from the selected passages.");
    expect(publicCopy("retrying")?.message).toContain("revising it against the evidence");
    expect(publicCopy("fallback")?.message).toBe("Building a source-backed answer from the selected passages.");
    expect(publicCopy("cached")).toEqual({ stage: "cached", message: "Loading a recent cited answer." });
    expect(publicCopy("complete", { elapsedMs: 1200.7 })).toEqual({
      stage: "complete",
      message: "Answer ready.",
      elapsedMs: 1200,
    });
  });

  it("rejects progress payloads that carry no recognized stage", () => {
    expect(toPublicAnswerProgressEvent(null)).toBeNull();
    expect(toPublicAnswerProgressEvent("retrieving")).toBeNull();
    expect(toPublicAnswerProgressEvent({ stage: "internal-debug", message: "private" })).toBeNull();
    expect(toPublicAnswerProgressEvent({ stage: "retrieved", resultCount: Number.NaN })).not.toHaveProperty(
      "resultCount",
    );
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

  it("shares one SSE parser across answer surfaces and commits completion only with a valid final answer", async () => {
    const progress: string[] = [];
    const tokens: string[] = [];
    let revisions = 0;
    const body = [
      'event: progress\ndata: {"stage":"retrieving","message":"private"}',
      'event: token\ndata: {"delta":"Draft"}',
      "event: revising\ndata: {}",
      'event: progress\ndata: {"stage":"complete","message":"private","elapsedMs":1200}',
      'event: final\ndata: {"answer":"Grounded answer.","grounded":true,"confidence":"medium","citations":[],"sources":[]}',
      "",
    ].join("\n\n");

    const answer = await readAnswerStream(
      new Response(body, { headers: { "Content-Type": "text/event-stream" } }),
      (event) => progress.push(event.stage),
      (delta) => tokens.push(delta),
      () => {
        revisions += 1;
      },
    );

    expect(progress).toEqual(["retrieving", "complete"]);
    expect(tokens).toEqual(["Draft"]);
    expect(revisions).toBe(1);
    expect(answer.answer).toBe("Grounded answer.");
  });

  it("fails closed when a shared answer stream ends without a valid final payload", async () => {
    const response = new Response('event: progress\ndata: {"stage":"complete","message":"private"}\n\n');

    await expect(readAnswerStream(response, () => undefined)).rejects.toThrow(
      "Answer stream ended before a final answer was received.",
    );
  });
});
