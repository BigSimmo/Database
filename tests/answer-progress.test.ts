import { describe, expect, it } from "vitest";
import {
  answerProgressDisplayMessage,
  answerProgressStepIndex,
  answerProgressTookUnusualRoute,
  normalizeAnswerProgressEvent,
} from "../src/components/clinical-dashboard/answer-progress";
import { toPublicAnswerProgressEvent } from "../src/lib/answer-progress-public";
import {
  evidencePreviewReconcilesWithFinal,
  readAnswerStream,
} from "../src/components/clinical-dashboard/search-utils";
import type { VerifiedEvidencePreviewUnit } from "../src/lib/answer-stream-contract";

const previewSource = {
  id: "chunk-1",
  document_id: "doc-1",
  title: "Clozapine Monitoring",
  file_name: "clozapine.pdf",
  page_number: 3,
  chunk_index: 1,
  section_heading: "Monitoring",
  content: "ANC thresholds and FBC monitoring schedule for clozapine.",
  image_ids: [],
  similarity: 0.82,
  images: [],
};

const evidencePreview: VerifiedEvidencePreviewUnit = {
  schemaVersion: 1,
  kind: "evidence_preview",
  sequence: 0,
  sources: [previewSource],
  selectedContextCount: 1,
};

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
    expect(answerProgressDisplayMessage(progress!)).toBe("Selecting the most relevant passages\u2026");
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

    expect(answerProgressDisplayMessage(progress!)).toBe("Prioritising 4 Australian sources, 4 from WA");
    expect(answerProgressStepIndex("fallback")).toBe(3);
    expect(answerProgressDisplayMessage({ stage: "fallback", message: "private" })).toBe(
      "Assembling the answer from the sources directly\u2026",
    );
  });

  // The status line counts two different things and must never call them the same
  // thing: `resultCount` is every candidate chunk retrieval touched, while the
  // arriving rail shows the trimmed sources. Collapsing both into one noun is how
  // a reader ends up believing two dozen documents are behind an answer that
  // cites three.
  it("counts passages during retrieval and never calls them sources", () => {
    const line = (stage: "retrieving" | "retrieved", resultCount?: number) =>
      answerProgressDisplayMessage({
        stage,
        message: "private",
        ...(resultCount === undefined ? {} : { resultCount }),
      });

    expect(line("retrieving")).toBe("Searching your documents\u2026");
    expect(line("retrieved")).toBe("Searching your documents\u2026");
    expect(line("retrieved", 1)).toBe("Searching your documents \u00b7 1 passage found");
    expect(line("retrieved", 24)).toBe("Searching your documents \u00b7 24 passages found");
    expect(line("retrieved", 24)).not.toMatch(/source/i);
  });

  // The wait is where a reader should learn the answer is being assembled without
  // the model, rather than meeting a source-only answer that then has to defend
  // itself.
  it("names the unusual route while it is happening", () => {
    expect(answerProgressDisplayMessage({ stage: "fallback", message: "private" })).toMatch(/sources directly/);
    expect(answerProgressDisplayMessage({ stage: "retrying", message: "private" })).toMatch(/Revising the draft/);
  });

  // A routine answer has nothing to disclose, which is why the retired Processing
  // details panel held the same five stages for every question. Only a
  // non-ordinary route earns the disclosure.
  it("offers the build disclosure only when the answer left the ordinary route", () => {
    const ordinary = (["scoping", "retrieving", "ranking", "generating", "verifying", "complete"] as const).map(
      (stage) => ({ stage, message: "private" }),
    );

    expect(answerProgressTookUnusualRoute(ordinary)).toBe(false);
    expect(answerProgressTookUnusualRoute([...ordinary, { stage: "fallback", message: "private" }])).toBe(true);
    expect(answerProgressTookUnusualRoute([...ordinary, { stage: "retrying", message: "private" }])).toBe(true);
    expect(answerProgressTookUnusualRoute([...ordinary, { stage: "cached", message: "private" }])).toBe(true);
    expect(answerProgressTookUnusualRoute([])).toBe(false);
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

  it("parses only allowlisted SSE events and clears a verified preview when final becomes authoritative", async () => {
    const progress: string[] = [];
    const tokens: string[] = [];
    const previews: Array<VerifiedEvidencePreviewUnit | null> = [];
    let revisions = 0;
    const body = [
      `event: progress\ndata: ${JSON.stringify({ stage: "ranking", message: "private", verifiedUnit: evidencePreview })}`,
      'event: token\ndata: {"delta":"Draft"}',
      "event: revising\ndata: {}",
      'event: progress\ndata: {"stage":"complete","message":"private","elapsedMs":1200}',
      `event: final\ndata: ${JSON.stringify({
        answer: "Grounded answer.",
        grounded: true,
        confidence: "medium",
        citations: [],
        sources: [previewSource],
      })}`,
      "",
    ].join("\n\n");

    const answer = await readAnswerStream(
      new Response(body, { headers: { "Content-Type": "text/event-stream" } }),
      (event) => progress.push(event.stage),
      (delta) => tokens.push(delta),
      () => {
        revisions += 1;
      },
      undefined,
      (preview) => previews.push(preview),
    );

    expect(progress).toEqual(["ranking", "complete"]);
    expect(tokens).toEqual([]);
    expect(revisions).toBe(0);
    expect(previews).toEqual([evidencePreview, null]);
    expect(answer.answer).toBe("Grounded answer.");
  });

  it("drops invalid, duplicate, and out-of-order verified units", async () => {
    const previews: Array<VerifiedEvidencePreviewUnit | null> = [];
    const previewByStage: Array<[string, VerifiedEvidencePreviewUnit | null]> = [];
    let visiblePreview: VerifiedEvidencePreviewUnit | null = null;
    const body = [
      `event: progress\ndata: ${JSON.stringify({ stage: "ranking", message: "private", verifiedUnit: evidencePreview })}`,
      `event: progress\ndata: ${JSON.stringify({ stage: "generating", message: "private", verifiedUnit: evidencePreview })}`,
      `event: progress\ndata: ${JSON.stringify({
        stage: "verifying",
        message: "private",
        verifiedUnit: { ...evidencePreview, schemaVersion: 2 },
      })}`,
      `event: final\ndata: ${JSON.stringify({
        answer: "Grounded answer.",
        grounded: true,
        confidence: "medium",
        citations: [],
        sources: [previewSource],
      })}`,
      "",
    ].join("\n\n");

    await readAnswerStream(
      new Response(body, { headers: { "Content-Type": "text/event-stream" } }),
      (progress) => previewByStage.push([progress.stage, visiblePreview]),
      undefined,
      undefined,
      undefined,
      (preview) => {
        visiblePreview = preview;
        previews.push(preview);
      },
    );

    expect(previews).toEqual([evidencePreview, null]);
    expect(previewByStage).toContainEqual(["ranking", evidencePreview]);
    expect(previewByStage).toContainEqual(["generating", null]);
    expect(previewByStage).toContainEqual(["verifying", null]);
  });

  it("discards a preview on stream error and starts sequence validation fresh for a retry", async () => {
    const firstAttemptPreviews: Array<VerifiedEvidencePreviewUnit | null> = [];
    const failedBody = [
      `event: progress\ndata: ${JSON.stringify({ stage: "ranking", message: "private", verifiedUnit: evidencePreview })}`,
      'event: error\ndata: {"error":"provider unavailable","status":503}',
      "",
    ].join("\n\n");

    await expect(
      readAnswerStream(
        new Response(failedBody, { headers: { "Content-Type": "text/event-stream" } }),
        () => undefined,
        undefined,
        undefined,
        undefined,
        (preview) => firstAttemptPreviews.push(preview),
      ),
    ).rejects.toThrow("provider unavailable");
    expect(firstAttemptPreviews).toEqual([evidencePreview, null]);

    const retryPreviews: Array<VerifiedEvidencePreviewUnit | null> = [];
    const retryBody = [
      `event: progress\ndata: ${JSON.stringify({ stage: "ranking", message: "private", verifiedUnit: evidencePreview })}`,
      `event: final\ndata: ${JSON.stringify({
        answer: "Retry succeeded.",
        grounded: true,
        confidence: "medium",
        citations: [],
        sources: [previewSource],
      })}`,
      "",
    ].join("\n\n");
    await readAnswerStream(
      new Response(retryBody, { headers: { "Content-Type": "text/event-stream" } }),
      () => undefined,
      undefined,
      undefined,
      undefined,
      (preview) => retryPreviews.push(preview),
    );
    expect(retryPreviews).toEqual([evidencePreview, null]);
  });

  it("discards a preview when the response stream is cancelled", async () => {
    const previews: Array<VerifiedEvidencePreviewUnit | null> = [];
    const encoder = new TextEncoder();
    let previewDelivered = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (!previewDelivered) {
          previewDelivered = true;
          controller.enqueue(
            encoder.encode(
              `event: progress\ndata: ${JSON.stringify({ stage: "ranking", message: "private", verifiedUnit: evidencePreview })}\n\n`,
            ),
          );
          return;
        }
        controller.error(new DOMException("Cancelled", "AbortError"));
      },
    });

    await expect(
      readAnswerStream(
        new Response(body, { headers: { "Content-Type": "text/event-stream" } }),
        () => undefined,
        undefined,
        undefined,
        undefined,
        (preview) => previews.push(preview),
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(previews).toEqual([evidencePreview, null]);
  });

  it("requires byte-identical preview sources to reconcile with final", () => {
    const finalPayload = {
      answer: "Grounded answer.",
      grounded: true,
      confidence: "medium" as const,
      citations: [],
      sources: [previewSource],
    };

    expect(evidencePreviewReconcilesWithFinal(evidencePreview, finalPayload)).toBe(true);
    expect(
      evidencePreviewReconcilesWithFinal(
        { ...evidencePreview, sources: [{ ...previewSource, content: "Changed source text." }] },
        finalPayload,
      ),
    ).toBe(false);
  });

  it("discards a mismatched preview while retaining the authoritative final payload", async () => {
    const previews: Array<VerifiedEvidencePreviewUnit | null> = [];
    const authoritativeSource = { ...previewSource, content: "Authoritative final source text." };
    const body = [
      `event: progress\ndata: ${JSON.stringify({ stage: "ranking", message: "private", verifiedUnit: evidencePreview })}`,
      `event: final\ndata: ${JSON.stringify({
        answer: "Authoritative final answer.",
        grounded: true,
        confidence: "medium",
        citations: [],
        sources: [authoritativeSource],
      })}`,
      "",
    ].join("\n\n");

    const finalPayload = await readAnswerStream(
      new Response(body, { headers: { "Content-Type": "text/event-stream" } }),
      () => undefined,
      undefined,
      undefined,
      undefined,
      (preview) => previews.push(preview),
    );

    expect(previews).toEqual([evidencePreview, null]);
    expect(finalPayload.sources).toEqual([authoritativeSource]);
  });

  it("fails closed when a shared answer stream ends without a valid final payload", async () => {
    const response = new Response('event: progress\ndata: {"stage":"complete","message":"private"}\n\n');

    await expect(readAnswerStream(response, () => undefined)).rejects.toThrow(
      "Answer stream ended before a final answer was received.",
    );
  });
});
