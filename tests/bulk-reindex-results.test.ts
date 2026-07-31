import { describe, expect, it } from "vitest";

import { summarizeBulkReindexPayload } from "@/lib/bulk-reindex-results";

describe("summarizeBulkReindexPayload", () => {
  it("reports successful, failed, and missing documents separately", () => {
    expect(
      summarizeBulkReindexPayload({
        results: [{ ok: true }, { ok: false }, { ok: true }],
        missingDocumentIds: ["missing-document"],
      }),
    ).toEqual({
      succeeded: 2,
      failed: 2,
      hasSuccessfulWork: true,
      message: "Bulk reindex: 2 queue requests succeeded; 2 failed.",
    });
  });

  it("does not claim successful work for a malformed or empty response", () => {
    expect(summarizeBulkReindexPayload(null)).toEqual({
      succeeded: 0,
      failed: 0,
      hasSuccessfulWork: false,
      message: "Bulk reindex completed without per-document results.",
    });
  });
});
