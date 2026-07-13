import { describe, expect, it } from "vitest";
import {
  uploadBatchCompletion,
  uploadOutcomeFromResponse,
} from "../src/components/clinical-dashboard/DocumentManagerPanel";

describe("upload outcomes", () => {
  it("distinguishes queued, duplicate, and failed server responses", () => {
    expect(uploadOutcomeFromResponse("fresh.pdf", 201, { document: { id: "doc-1" }, job: { id: "job-1" } })).toEqual({
      kind: "queued",
      fileName: "fresh.pdf",
      documentId: "doc-1",
      jobId: "job-1",
    });
    expect(
      uploadOutcomeFromResponse("copy.pdf", 200, {
        duplicate: true,
        document: { id: "doc-1" },
        message: "Already exists; no duplicate job was queued.",
      }),
    ).toEqual({
      kind: "duplicate",
      fileName: "copy.pdf",
      documentId: "doc-1",
      message: "Already exists; no duplicate job was queued.",
    });
    expect(
      uploadOutcomeFromResponse("large.pdf", 413, {
        code: "payload_too_large",
        message: "File exceeds 150 MB upload limit.",
      }),
    ).toEqual({
      kind: "failed",
      fileName: "large.pdf",
      status: 413,
      code: "payload_too_large",
      message: "File exceeds 150 MB upload limit.",
    });
  });

  it("refreshes and clears the input when a batch is partly queued and partly failed", () => {
    const completion = uploadBatchCompletion([
      uploadOutcomeFromResponse("fresh.pdf", 201, { document: { id: "doc-1" }, job: { id: "job-1" } }),
      uploadOutcomeFromResponse("large.pdf", 413, {
        code: "payload_too_large",
        message: "File exceeds 150 MB upload limit.",
      }),
    ]);

    expect(completion.queued).toHaveLength(1);
    expect(completion.failures).toHaveLength(1);
    expect(completion.shouldRefreshDocuments).toBe(true);
    expect(completion.shouldClearInput).toBe(true);
  });
});
