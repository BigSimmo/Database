import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { answerRequestSchema } from "@/lib/validation/answer-request";

const nonStreamRouteSource = readFileSync(new URL("../src/app/api/answer/route.ts", import.meta.url), "utf8");
const streamRouteSource = readFileSync(new URL("../src/app/api/answer/stream/route.ts", import.meta.url), "utf8");

describe("answer summaryMode contract", () => {
  const documentId = "11111111-1111-4111-8111-111111111111";
  const otherDocumentId = "22222222-2222-4222-8222-222222222222";

  it("rejects conflicting or multi-document summary scopes at request validation", () => {
    expect(
      answerRequestSchema.safeParse({
        query: "Summarize this document.",
        documentId,
        documentIds: [otherDocumentId],
        summaryMode: true,
      }).success,
    ).toBe(false);

    expect(
      answerRequestSchema.safeParse({
        query: "Summarize this document.",
        documentId,
        documentIds: [documentId, otherDocumentId],
        summaryMode: true,
      }).success,
    ).toBe(false);

    expect(
      answerRequestSchema.safeParse({
        query: "Summarize this document.",
        documentId,
        documentIds: [documentId],
        summaryMode: true,
      }).success,
    ).toBe(true);
  });

  it("keeps non-stream summaryMode rejected before backend answer work", () => {
    const rejectionIndex = nonStreamRouteSource.indexOf("summary_mode_stream_required");
    expect(rejectionIndex).toBeGreaterThan(0);
    expect(nonStreamRouteSource.indexOf("createAdminClient()", rejectionIndex)).toBeGreaterThan(rejectionIndex);
    expect(nonStreamRouteSource.indexOf("answerQuestionWithScope({", rejectionIndex)).toBeGreaterThan(rejectionIndex);
  });

  it("scopes streamed summaryMode to the exact selected document", () => {
    expect(streamRouteSource).toContain("body.summaryMode && body.documentId");
    expect(streamRouteSource).toContain("? [body.documentId]");
  });
});
