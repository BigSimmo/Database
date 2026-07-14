import { describe, expect, it } from "vitest";

import { buildClinicalReviewQueue } from "@/lib/clinical-review-queue";

describe("clinical review queue", () => {
  it("deduplicates review-required top results and sorts by slot count", () => {
    const input = {
      generated_at: "2026-07-13T00:00:00.000Z",
      retrieval: {
        results: [
          {
            id: "case-b",
            topResults: [
              {
                title: "Lithium guideline",
                file_name: "lithium.pdf",
                document_status: "review_due",
                clinical_validation_status: "locally_reviewed",
                extraction_quality: "good",
              },
              {
                title: "Current guideline",
                file_name: "current.pdf",
                document_status: "current",
                clinical_validation_status: "approved",
                extraction_quality: "good",
              },
            ],
          },
          {
            id: "case-a",
            topResults: [
              {
                document_id: "doc-lithium",
                title: "Lithium guideline",
                file_name: "lithium.pdf",
                document_status: "current",
                clinical_validation_status: "unverified",
                extraction_quality: "good",
              },
              {
                document_id: "doc-other",
                title: "Other guideline",
                file_name: "other.pdf",
                document_status: "unknown",
                clinical_validation_status: "approved",
                extraction_quality: "unknown",
              },
            ],
          },
        ],
      },
    };

    const queue = buildClinicalReviewQueue(input);
    expect(queue.source_generated_at).toBe("2026-07-13T00:00:00.000Z");
    expect(queue.entry_count).toBe(2);
    expect(queue.entries[0]).toMatchObject({
      key: "document:doc-lithium",
      document_id: "doc-lithium",
      top_result_slots: 2,
      case_ids: ["case-a", "case-b"],
    });
    expect(queue.entries[0]?.reasons).toEqual(
      expect.arrayContaining(["clinical_validation_status:unverified", "document_status:review_due"]),
    );
    expect(queue.entries[1]).toMatchObject({ key: "document:doc-other", top_result_slots: 1 });
  });

  it("records observed states without proposing automatic promotions", () => {
    const queue = buildClinicalReviewQueue({
      results: [
        {
          id: "case-1",
          topResults: [
            {
              title: "Unverified source",
              file_name: "unverified.pdf",
              document_status: "unknown",
              clinical_validation_status: "unverified",
              extraction_quality: "poor",
            },
          ],
        },
      ],
    });

    expect(queue.entries[0]?.observed).toEqual({
      document_statuses: ["unknown"],
      clinical_validation_statuses: ["unverified"],
      extraction_qualities: ["poor"],
    });
    expect(queue.status_change_policy).toContain("never auto-promotes");
    expect(JSON.stringify(queue)).not.toContain("recommended_status");
    expect(JSON.stringify(queue)).not.toContain("target_status");
  });

  it("rejects JSON that is not an eval result shape", () => {
    expect(() => buildClinicalReviewQueue({ retrieval: {} })).toThrow(
      "Eval JSON must contain retrieval.results or a results array.",
    );
  });
});
