import { describe, expect, it } from "vitest";
import {
  classifyStorageCleanupJobs,
  nonNullDocumentIds,
  partitionStorageCleanupJobs,
  UPLOAD_COMPENSATION_GRACE_MS,
  uploadCompensationSelectionFilter,
} from "@/lib/storage-cleanup-safety";

describe("partitionStorageCleanupJobs (audit R11)", () => {
  const job = (id: string, document_id: string | null) => ({ id, document_id });

  it("skips ledger rows whose document still exists (aborted delete)", () => {
    const jobs = [job("j1", "doc-alive"), job("j2", "doc-gone"), job("j3", null)];
    const live = new Set(["doc-alive"]);
    const { safe, skipped } = partitionStorageCleanupJobs(jobs, live);
    expect(skipped.map((j) => j.id)).toEqual(["j1"]);
    expect(safe.map((j) => j.id)).toEqual(["j2", "j3"]);
  });

  it("treats a null document_id as a genuinely-deleted document (safe to process)", () => {
    const { safe, skipped } = partitionStorageCleanupJobs([job("j1", null)], new Set(["anything"]));
    expect(skipped).toHaveLength(0);
    expect(safe.map((j) => j.id)).toEqual(["j1"]);
  });

  it("processes rows whose document_id no longer resolves (FK should have nulled it, but be permissive)", () => {
    const { safe } = partitionStorageCleanupJobs([job("j1", "doc-gone")], new Set());
    expect(safe.map((j) => j.id)).toEqual(["j1"]);
  });

  it("collects distinct non-null document ids for the liveness probe", () => {
    const ids = nonNullDocumentIds([job("j1", "a"), job("j2", "a"), job("j3", null), job("j4", "b")]);
    expect(ids.sort()).toEqual(["a", "b"]);
  });

  it("reconciles an upload compensation row when its exact document path is live", () => {
    const uploadJob = {
      id: "upload-1",
      document_id: null,
      document_paths: ["owner/documents/doc-1/source.pdf"],
      image_paths: [],
      metadata: { operation: "upload_compensation", expected_document_id: "doc-1" },
    };
    const result = classifyStorageCleanupJobs([uploadJob], {
      liveDocumentIds: new Set(),
      referencedDocumentPaths: new Set(["owner/documents/doc-1/source.pdf"]),
      referencedImagePaths: new Set(),
    });

    expect(result.reconciled.map((entry) => entry.id)).toEqual(["upload-1"]);
    expect(result.safe).toHaveLength(0);
  });

  it("allows only unreferenced obsolete image paths to be removed beside a live document", () => {
    const obsolete = (id: string, path: string) => ({
      id,
      document_id: "doc-alive",
      document_paths: [],
      image_paths: [path],
      metadata: { operation: "obsolete_index_generation" },
    });
    const result = classifyStorageCleanupJobs(
      [obsolete("referenced", "images/still-live.png"), obsolete("obsolete", "images/old.png")],
      {
        liveDocumentIds: new Set(["doc-alive"]),
        referencedDocumentPaths: new Set(),
        referencedImagePaths: new Set(["images/still-live.png"]),
      },
    );

    expect(result.skipped.map((entry) => entry.id)).toEqual(["referenced"]);
    expect(result.safe.map((entry) => entry.id)).toEqual(["obsolete"]);
  });

  it("retains the live-document guard for legacy permanent-delete rows", () => {
    const legacy = {
      id: "delete-1",
      document_id: "doc-alive",
      document_paths: ["documents/source.pdf"],
      image_paths: ["images/page.png"],
      metadata: {},
    };
    const result = classifyStorageCleanupJobs([legacy], {
      liveDocumentIds: new Set(["doc-alive"]),
      referencedDocumentPaths: new Set(),
      referencedImagePaths: new Set(),
    });

    expect(result.skipped.map((entry) => entry.id)).toEqual(["delete-1"]);
    expect(result.safe).toHaveLength(0);
  });

  it("adds a fifteen-minute database selection grace period only to upload compensation", () => {
    const now = Date.parse("2026-07-27T12:00:00.000Z");
    const filter = uploadCompensationSelectionFilter(now);

    expect(filter).toContain("metadata->>operation.is.null");
    expect(filter).toContain("metadata->>operation.neq.upload_compensation");
    expect(filter).toContain("metadata->>operation.eq.upload_compensation");
    expect(filter).toContain(new Date(now - UPLOAD_COMPENSATION_GRACE_MS).toISOString());
  });
});
