import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildClinicalReviewQueue, buildTopLocalReviewEvidenceManifest } from "@/lib/clinical-review-queue";

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
      best_rank: 1,
      case_ids: ["case-a", "case-b"],
      review_class: "unknown",
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

  it("classifies authority and builds a deterministic top-local evidence manifest", () => {
    const manifest = buildTopLocalReviewEvidenceManifest(
      {
        generated_at: "2026-07-26T19:00:00.000Z",
        results: [
          {
            id: "case-b",
            topResults: [
              {
                rank: 2,
                title: "Local B",
                file_name: "b.pdf",
                publisher_code: "NMHS",
                jurisdiction: "Australia/WA",
                document_status: "review_due",
                clinical_validation_status: "locally_reviewed",
                extraction_quality: "good",
              },
              {
                rank: 1,
                title: "BMJ reference",
                file_name: "bmj.pdf",
                publisher_code: "BMJ",
                jurisdiction: "International",
                document_status: "current",
                clinical_validation_status: "unverified",
                extraction_quality: "good",
              },
            ],
          },
          {
            id: "case-a",
            topResults: [
              {
                rank: 3,
                title: "Local A",
                file_name: "a.pdf",
                publisher_code: "AKG",
                jurisdiction: "Australia/WA",
                document_status: "review_due",
                clinical_validation_status: "locally_reviewed",
                extraction_quality: "good",
              },
              {
                rank: 1,
                title: "Local B",
                file_name: "b.pdf",
                publisher_code: "NMHS",
                jurisdiction: "Australia/WA",
                document_status: "review_due",
                clinical_validation_status: "locally_reviewed",
                extraction_quality: "good",
              },
            ],
          },
        ],
      },
      { limit: 2, sourceArtifact: "github-actions/run-1/golden-retrieval.json" },
    );

    expect(manifest).toMatchObject({
      source_artifact: "github-actions/run-1/golden-retrieval.json",
      entry_count: 2,
      review_status: "pending_qualified_human_review",
      attestation_applied: false,
    });
    expect(manifest.entries.map((entry) => entry.file_name)).toEqual(["b.pdf", "a.pdf"]);
    expect(manifest.entries[0]).toMatchObject({
      top_result_slots: 2,
      best_rank: 1,
      case_ids: ["case-a", "case-b"],
      publisher_code: "NMHS",
      jurisdiction: "Australia/WA",
      review_class: "local_wa",
      review_status: "pending_qualified_human_review",
      attestation_applied: false,
    });
    expect(JSON.stringify(manifest)).not.toContain("BMJ reference");
  });

  it("tracks the current ten-document local evidence pack without applying attestation", () => {
    const manifest = JSON.parse(
      readFileSync("docs/evidence/rag-top-local-review-manifest-2026-07-26.json", "utf8"),
    ) as {
      entry_count: number;
      review_status: string;
      attestation_applied: boolean;
      entries: Array<{ file_name: string; top_result_slots: number; best_rank: number; attestation_applied: boolean }>;
    };

    expect(manifest.entry_count).toBe(10);
    expect(manifest.review_status).toBe("pending_qualified_human_review");
    expect(manifest.attestation_applied).toBe(false);
    expect(
      manifest.entries.map(({ file_name, top_result_slots, best_rank }) => [file_name, top_result_slots, best_rank]),
    ).toEqual([
      ["Clozapine Management by GP (NMHS).pdf", 11, 2],
      ["Alcohol and Other Drugs - Addiction, Toxicity and Withdrawal (FSH).pdf", 6, 1],
      ["MHATT Assessment and Treatment Process (AKG).pdf", 4, 4],
      ["Clozapine Coordinator and Clozapine Clinic (NMHS).pdf", 3, 1],
      ["Women's and Perinatal Mental Health Referral and Management Guideline (KEMH).pdf", 3, 7],
      ["Mother Baby Unit Admissions (FSH).pdf", 2, 6],
      ["Pressure Injuries (AKG).pdf", 2, 6],
      ["Referral to the Mother Baby Unit MR202.09 (KEMH).pdf", 2, 8],
      ["Hampton House Referral (FSH).pdf", 2, 9],
      ["Arousal and Agitation Drug Management (CAMHS).pdf", 1, 2],
    ]);
    expect(manifest.entries.every((entry) => entry.attestation_applied === false)).toBe(true);
  });
});
