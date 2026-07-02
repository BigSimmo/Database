import { describe, expect, it } from "vitest";
import {
  abandonedReindexGenerationTotal,
  committedIndexGeneration,
  hasAbandonedReindexGenerations,
  isAbandonedStagedGeneration,
  hasIncompleteDocumentsWithoutOpenJobs,
  isAtomicReindexCandidate,
  isCommittedGenerationMetadata,
  isReindexQueueClear,
} from "../src/lib/reindex-pipeline";

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

  it("treats indexed documents as atomic reindex candidates", () => {
    expect(isAtomicReindexCandidate({ status: "indexed", metadata: { index_generation_id: "old-generation" } })).toBe(
      true,
    );
    expect(isAtomicReindexCandidate({ status: "queued", metadata: { index_generation_id: "old-generation" } })).toBe(
      false,
    );
  });

  it("compares generated artifacts against the committed document generation", () => {
    expect(committedIndexGeneration({ index_generation_id: "generation-a" })).toBe("generation-a");
    expect(isCommittedGenerationMetadata({ rowMetadata: {}, committedGeneration: "generation-a" })).toBe(true);
    expect(
      isCommittedGenerationMetadata({
        rowMetadata: { index_generation_id: "generation-b" },
        committedGeneration: "generation-a",
      }),
    ).toBe(false);
    expect(
      isCommittedGenerationMetadata({
        rowMetadata: { index_generation_id: "generation-a" },
        committedGeneration: "generation-a",
      }),
    ).toBe(true);
    expect(
      isCommittedGenerationMetadata({
        rowMetadata: { index_generation_id: "legacy-generation" },
        committedGeneration: null,
      }),
    ).toBe(true);
  });

  it("identifies abandoned staged generation rows without flagging legacy generationless rows", () => {
    expect(
      isAbandonedStagedGeneration({
        rowGenerationId: "generation-b",
        committedGeneration: "generation-a",
      }),
    ).toBe(true);
    expect(
      isAbandonedStagedGeneration({
        rowMetadata: { index_generation_id: "generation-a" },
        committedGeneration: "generation-a",
      }),
    ).toBe(false);
    expect(
      isAbandonedStagedGeneration({
        rowMetadata: {},
        committedGeneration: "generation-a",
      }),
    ).toBe(false);
  });

  it("summarizes abandoned staged generation cleanup counts", () => {
    expect(
      abandonedReindexGenerationTotal({
        document_chunks: 2,
        document_images: 1,
        document_table_facts: 0,
      }),
    ).toBe(3);
    expect(hasAbandonedReindexGenerations({ document_chunks: 0, document_images: 0 })).toBe(false);
    expect(hasAbandonedReindexGenerations({ document_chunks: 0, document_images: 1 })).toBe(true);
  });
});
