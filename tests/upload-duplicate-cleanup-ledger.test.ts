import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const uploadRoute = readFileSync(new URL("../src/app/api/upload/route.ts", import.meta.url), "utf8");

describe("upload cleanup ledger", () => {
  it("creates one durable compensation row before upload and settles that same row", () => {
    expect(uploadRoute).toContain('from("storage_cleanup_jobs").insert({');
    expect(uploadRoute).toContain('operation: "upload_compensation"');
    expect(uploadRoute).toContain("expected_document_id: state.documentId");
    expect(uploadRoute).toContain("Upload cleanup ledger insert failed");
    expect(uploadRoute).toContain('.eq("id", args.state.cleanupJobId)');
    expect(uploadRoute).not.toMatch(/compensateUploadStorage[\s\S]*storage_cleanup_jobs"\)\.insert/);
  });
});
