import { describe, expect, it } from "vitest";
import {
  buildIngestionRecoveryPlan,
  isFreshProcessingJob,
  isRecoverableProcessingJob,
  isStaleProcessingJob,
} from "../src/lib/ingestion-recovery";

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

  it("leaves a queued (pending) reindex of an indexed document alone (R22)", () => {
    const plan = buildIngestionRecoveryPlan({
      now,
      staleAfterMinutes: 45,
      jobs: [
        {
          id: "queued-reindex",
          document_id: "doc-indexed",
          status: "pending",
          documents: { status: "indexed", chunk_count: 42 },
        },
      ],
    });

    // Must neither supersede (cancels the reindex) nor retry (resets the live
    // index). The worker's atomic reindex path handles the pending job.
    expect(plan.supersedeCount).toBe(0);
    expect(plan.retryCount).toBe(0);
    expect(plan.actions).toHaveLength(0);
    expect(plan.resetDocumentIds).toHaveLength(0);
  });

  it("still supersedes a failed job on an indexed document (R22 scope guard)", () => {
    const plan = buildIngestionRecoveryPlan({
      now,
      staleAfterMinutes: 45,
      jobs: [
        {
          id: "failed-on-indexed",
          document_id: "doc-indexed",
          status: "failed",
          documents: { status: "indexed", chunk_count: 42 },
        },
      ],
    });
    expect(plan.supersedeCount).toBe(1);
    expect(plan.retryCount).toBe(0);
  });

  it("requeues only one job and supersedes the sibling when a document has both pending and failed jobs (I2)", () => {
    const plan = buildIngestionRecoveryPlan({
      now,
      staleAfterMinutes: 45,
      jobs: [
        // The older `failed` row is iterated first; the still-open `pending` sibling must not be
        // flipped to a second `pending` row (which would collide on the partial unique index).
        {
          id: "failed-first",
          document_id: "doc-double",
          status: "failed",
          documents: { status: "failed", chunk_count: 0 },
        },
        {
          id: "pending-second",
          document_id: "doc-double",
          status: "pending",
          documents: { status: "queued", chunk_count: 0 },
        },
      ],
    });

    expect(plan.retryCount).toBe(1);
    expect(plan.supersedeCount).toBe(1);
    expect(plan.resetDocumentIds).toEqual(["doc-double"]);
    // Supersede must be applied before the retry so the open sibling is closed first.
    expect(plan.actions[0]).toMatchObject({ action: "supersede", documentId: "doc-double" });
    expect(plan.actions[1]).toMatchObject({ action: "retry", documentId: "doc-double" });
    // Exactly one job is requeued to `pending`; the other is closed.
    expect(plan.actions.filter((action) => action.action === "retry")).toHaveLength(1);
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

  it("retries processing jobs with no lock timestamp", () => {
    const plan = buildIngestionRecoveryPlan({
      now,
      staleAfterMinutes: 45,
      jobs: [
        {
          id: "null-lock",
          document_id: "doc-null",
          status: "processing",
          locked_at: null,
          documents: { status: "processing", chunk_count: 0 },
        },
      ],
    });

    expect(plan.retryCount).toBe(1);
    expect(plan.actions[0]).toMatchObject({ action: "retry", jobId: "null-lock", documentId: "doc-null" });
  });

  it("treats fresh processing jobs as active but not recoverable", () => {
    const job = {
      id: "fresh",
      document_id: "doc",
      status: "processing" as const,
      locked_at: "2026-06-14T23:30:00.000Z",
    };

    expect(isRecoverableProcessingJob(job, now, 45)).toBe(false);
    expect(isFreshProcessingJob(job, now, 45)).toBe(true);
  });
});
