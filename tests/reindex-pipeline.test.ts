import { describe, expect, it } from "vitest";
import { hasIncompleteDocumentsWithoutOpenJobs, isReindexQueueClear } from "../src/lib/reindex-pipeline";

describe("reindex pipeline queue state", () => {
  it("does not declare the queue clear while documents are still processing", () => {
    expect(
      isReindexQueueClear({
        openJobs: 0,
        queuedDocuments: 0,
        processingDocuments: 1,
        failedDocuments: 0,
      }),
    ).toBe(false);
  });

  it("flags orphaned incomplete documents when no jobs remain", () => {
    expect(
      hasIncompleteDocumentsWithoutOpenJobs({
        openJobs: 0,
        queuedDocuments: 0,
        processingDocuments: 1,
        failedDocuments: 0,
      }),
    ).toBe(true);
    expect(
      hasIncompleteDocumentsWithoutOpenJobs({
        openJobs: 0,
        queuedDocuments: 1,
        processingDocuments: 0,
        failedDocuments: 1,
      }),
    ).toBe(false);
  });

  it("declares the queue clear only when no open jobs or incomplete documents remain", () => {
    expect(
      isReindexQueueClear({
        openJobs: 0,
        queuedDocuments: 0,
        processingDocuments: 0,
        failedDocuments: 0,
      }),
    ).toBe(true);
  });
});
