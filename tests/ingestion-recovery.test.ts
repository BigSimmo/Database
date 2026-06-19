import { describe, expect, it } from "vitest";
import { buildIngestionRecoveryPlan, isStaleProcessingJob } from "../src/lib/ingestion-recovery";

describe("ingestion queue recovery planning", () => {
  const now = new Date("2026-06-15T00:00:00.000Z");

  it("selects stale processing and failed jobs for retry", () => {
    const plan = buildIngestionRecoveryPlan({
      now,
      staleAfterMinutes: 45,
      jobs: [
        {
          id: "stale",
          document_id: "doc-a",
          status: "processing",
          locked_at: "2026-06-14T22:00:00.000Z",
          documents: { status: "processing", chunk_count: 0 },
        },
        {
          id: "failed",
          document_id: "doc-b",
          status: "failed",
          documents: { status: "failed", chunk_count: 0 },
        },
      ],
    });

    expect(plan.retryCount).toBe(2);
    expect(plan.resetDocumentIds.sort()).toEqual(["doc-a", "doc-b"]);
  });

  it("supersedes obsolete failed jobs for already indexed documents", () => {
    const plan = buildIngestionRecoveryPlan({
      now,
      staleAfterMinutes: 45,
      jobs: [
        {
          id: "old-failure",
          document_id: "doc-indexed",
          status: "failed",
          documents: { status: "indexed", chunk_count: 42 },
        },
      ],
    });

    expect(plan.supersedeCount).toBe(1);
    expect(plan.retryCount).toBe(0);
    expect(plan.actions[0]).toMatchObject({ action: "supersede", jobId: "old-failure" });
  });

  it("does not reclaim fresh processing jobs", () => {
    expect(
      isStaleProcessingJob(
        {
          id: "fresh",
          document_id: "doc",
          status: "processing",
          locked_at: "2026-06-14T23:30:00.000Z",
        },
        now,
        45,
      ),
    ).toBe(false);
  });
});
