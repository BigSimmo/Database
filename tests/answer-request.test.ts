import { afterEach, describe, expect, it, vi } from "vitest";
import { requestAnswerStream } from "../src/components/clinical-dashboard/answer-request";
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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("requestAnswerStream", () => {
  it("preserves the authenticated request body and forwards only verified preview events", async () => {
    const streamBody = [
      `event: progress\ndata: ${JSON.stringify({ stage: "ranking", message: "private", verifiedUnit: evidencePreview })}`,
      `event: final\ndata: ${JSON.stringify({
        answer: "Grounded answer.",
        grounded: true,
        confidence: "medium",
        citations: [],
        sources: [previewSource],
      })}`,
      "",
    ].join("\n\n");
    const fetchMock = vi.fn(async () => new Response(streamBody, { headers: { "Content-Type": "text/event-stream" } }));
    vi.stubGlobal("fetch", fetchMock);
    const previews: Array<VerifiedEvidencePreviewUnit | null> = [];

    const result = await requestAnswerStream({
      queryText: "clozapine monitoring",
      filters: { medications: ["clozapine"] },
      queryMode: "auto",
      selectedDocumentIds: ["doc-1"],
      clientDemoMode: false,
      authorizationHeader: { authorization: "Bearer test-token" },
      onProgress: () => undefined,
      onEvidencePreview: (preview) => previews.push(preview),
      timedOut: () => false,
      onSessionExpired: vi.fn(),
      networkFailure: () => new Error("network failure"),
    });

    const [input, init] = fetchMock.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit];
    expect(input).toBe("/api/answer/stream");
    expect(init.headers).toEqual({
      "Content-Type": "application/json",
      authorization: "Bearer test-token",
    });
    expect(JSON.parse(String(init.body))).toEqual({
      query: "clozapine monitoring",
      documentIds: ["doc-1"],
      filters: { medications: ["clozapine"] },
      queryMode: "auto",
    });
    expect(previews).toEqual([evidencePreview, null]);
    expect(result).toMatchObject({ kind: "answer", query: "clozapine monitoring" });
    expect(result.payload.answer).toBe("Grounded answer.");
  });

  it("expires the client session before surfacing a 401 answer response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 401 })),
    );
    const onSessionExpired = vi.fn();

    await expect(
      requestAnswerStream({
        queryText: "clozapine monitoring",
        filters: {},
        queryMode: "auto",
        selectedDocumentIds: [],
        clientDemoMode: true,
        authorizationHeader: {},
        onProgress: () => undefined,
        onEvidencePreview: () => undefined,
        timedOut: () => false,
        onSessionExpired,
        networkFailure: () => new Error("network failure"),
      }),
    ).rejects.toMatchObject({ status: 401, retryable: false });
    expect(onSessionExpired).toHaveBeenCalledOnce();
  });
});
