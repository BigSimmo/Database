import { describe, expect, it } from "vitest";
import {
  auditReviewAttribution,
  extractReviewerAttribution,
  isNonTrivialReviewerString,
  isRecordMarkedReviewed,
  type AuditableRecord,
} from "../scripts/audit-source-governance";

describe("source governance reviewer attribution", () => {
  describe("isNonTrivialReviewerString", () => {
    it("accepts valid non-trivial reviewer names, identifiers, and emails", () => {
      expect(isNonTrivialReviewerString("Dr. Jane Doe")).toBe(true);
      expect(isNonTrivialReviewerString("Psychiatrist Lead")).toBe(true);
      expect(isNonTrivialReviewerString("reviewer@health.wa.gov.au")).toBe(true);
      expect(isNonTrivialReviewerString("01M0B4YZFPSBKXZ7BGFC4YJ52G")).toBe(true);
      expect(isNonTrivialReviewerString("12345")).toBe(true);
    });

    it("rejects non-strings, empty strings, and whitespace", () => {
      expect(isNonTrivialReviewerString(null)).toBe(false);
      expect(isNonTrivialReviewerString(undefined)).toBe(false);
      expect(isNonTrivialReviewerString(12345)).toBe(false);
      expect(isNonTrivialReviewerString({})).toBe(false);
      expect(isNonTrivialReviewerString([])).toBe(false);
      expect(isNonTrivialReviewerString("")).toBe(false);
      expect(isNonTrivialReviewerString("   ")).toBe(false);
      expect(isNonTrivialReviewerString("\t\n")).toBe(false);
    });

    it("rejects known trivial placeholders and empty sentinel values", () => {
      expect(isNonTrivialReviewerString("unknown")).toBe(false);
      expect(isNonTrivialReviewerString("UNKNOWN")).toBe(false);
      expect(isNonTrivialReviewerString("none")).toBe(false);
      expect(isNonTrivialReviewerString("n/a")).toBe(false);
      expect(isNonTrivialReviewerString("N/A")).toBe(false);
      expect(isNonTrivialReviewerString("na")).toBe(false);
      expect(isNonTrivialReviewerString("null")).toBe(false);
      expect(isNonTrivialReviewerString("undefined")).toBe(false);
      expect(isNonTrivialReviewerString("todo")).toBe(false);
      expect(isNonTrivialReviewerString("TODO")).toBe(false);
      expect(isNonTrivialReviewerString("tbd")).toBe(false);
      expect(isNonTrivialReviewerString("test")).toBe(false);
      expect(isNonTrivialReviewerString("placeholder")).toBe(false);
      expect(isNonTrivialReviewerString("anonymous")).toBe(false);
      expect(isNonTrivialReviewerString("unattributed")).toBe(false);
      expect(isNonTrivialReviewerString("unassigned")).toBe(false);
      expect(isNonTrivialReviewerString("missing")).toBe(false);
      expect(isNonTrivialReviewerString("pending")).toBe(false);
      expect(isNonTrivialReviewerString("default")).toBe(false);
      expect(isNonTrivialReviewerString("system")).toBe(false);
      expect(isNonTrivialReviewerString("bot")).toBe(false);
      expect(isNonTrivialReviewerString("automated")).toBe(false);
    });

    it("rejects nil UUID and punctuation-only strings", () => {
      expect(isNonTrivialReviewerString("00000000-0000-0000-0000-000000000000")).toBe(false);
      expect(isNonTrivialReviewerString("---")).toBe(false);
      expect(isNonTrivialReviewerString("???")).toBe(false);
      expect(isNonTrivialReviewerString("...")).toBe(false);
      expect(isNonTrivialReviewerString("___")).toBe(false);
      expect(isNonTrivialReviewerString(" - ")).toBe(false);
    });
  });

  describe("isRecordMarkedReviewed", () => {
    it("detects top-level and metadata reviewStatus: reviewed", () => {
      expect(isRecordMarkedReviewed({ reviewStatus: "reviewed" })).toEqual({
        isReviewed: true,
        rawStatus: "reviewed",
        unrecognisedStatus: null,
      });
      expect(isRecordMarkedReviewed({ review_status: "Reviewed" })).toEqual({
        isReviewed: true,
        rawStatus: "Reviewed",
        unrecognisedStatus: null,
      });
      expect(isRecordMarkedReviewed({ metadata: { reviewStatus: "reviewed" } })).toEqual({
        isReviewed: true,
        rawStatus: "reviewed",
        unrecognisedStatus: null,
      });
      expect(isRecordMarkedReviewed({ metadata: { review_status: "REVIEWED" } })).toEqual({
        isReviewed: true,
        rawStatus: "REVIEWED",
        unrecognisedStatus: null,
      });
    });

    it("returns false for unreviewed statuses or missing review status", () => {
      expect(isRecordMarkedReviewed({ reviewStatus: "needs_review" })).toEqual({
        isReviewed: false,
        rawStatus: null,
        unrecognisedStatus: null,
      });
      expect(isRecordMarkedReviewed({ reviewStatus: "Pending review" })).toEqual({
        isReviewed: false,
        rawStatus: null,
        unrecognisedStatus: null,
      });
      expect(isRecordMarkedReviewed({ reviewStatus: "Pending qualified clinician review" })).toEqual({
        isReviewed: false,
        rawStatus: null,
        unrecognisedStatus: null,
      });
      expect(isRecordMarkedReviewed({})).toEqual({
        isReviewed: false,
        rawStatus: null,
        unrecognisedStatus: null,
      });
    });

    // THE 2026-09-25 LIVE RUN. The audit reported "clinical_validation_status:
    // locally_reviewed × 1935" and, in the same report, "reviewed_record_count:
    // 0" over 3,907 records — because this function read `review_status` only
    // and matched the exact string "reviewed". The 1,935 documents showing
    // "Locally reviewed" to clinicians were never examined for a reviewer.
    it("treats the clinical_validation_status vocabulary as a review claim", () => {
      expect(isRecordMarkedReviewed({ metadata: { clinical_validation_status: "locally_reviewed" } })).toEqual({
        isReviewed: true,
        rawStatus: "locally_reviewed",
        unrecognisedStatus: null,
      });
      expect(isRecordMarkedReviewed({ metadata: { clinical_validation_status: "approved" } })).toEqual({
        isReviewed: true,
        rawStatus: "approved",
        unrecognisedStatus: null,
      });
      expect(isRecordMarkedReviewed({ clinical_validation_status: "Locally_Reviewed" })).toEqual({
        isReviewed: true,
        rawStatus: "Locally_Reviewed",
        unrecognisedStatus: null,
      });
      // `unverified` is the opposite claim and must never count as a review.
      expect(isRecordMarkedReviewed({ metadata: { clinical_validation_status: "unverified" } })).toEqual({
        isReviewed: false,
        rawStatus: null,
        unrecognisedStatus: null,
      });
    });

    // The sign-off value settled for the specifier catalogue on 2026-09-18. The
    // exact-match test would have missed it, so the first signed specifier would
    // have gone unexamined in exactly the same way.
    it("recognises the specifier catalogue sign-off value", () => {
      expect(isRecordMarkedReviewed({ reviewStatus: "clinician-reviewed-approved" })).toEqual({
        isReviewed: true,
        rawStatus: "clinician-reviewed-approved",
        unrecognisedStatus: null,
      });
      expect(isRecordMarkedReviewed({ reviewStatus: "clinician-review-pending" })).toEqual({
        isReviewed: false,
        rawStatus: null,
        unrecognisedStatus: null,
      });
    });

    // "This gate does not know what this value means" and "this record was not
    // reviewed" are different findings, and only one of them is safe to pass.
    it("reports a status neither vocabulary claims instead of assuming it is unreviewed", () => {
      expect(isRecordMarkedReviewed({ reviewStatus: "signed_off_by_committee" })).toEqual({
        isReviewed: false,
        rawStatus: null,
        unrecognisedStatus: "signed_off_by_committee",
      });
      // An explicit review claim elsewhere on the record still decides the answer.
      expect(
        isRecordMarkedReviewed({
          reviewStatus: "signed_off_by_committee",
          metadata: { clinical_validation_status: "locally_reviewed" },
        }),
      ).toEqual({
        isReviewed: true,
        rawStatus: "locally_reviewed",
        unrecognisedStatus: null,
      });
    });
  });

  describe("extractReviewerAttribution", () => {
    it("extracts valid reviewedBy and reviewer fields", () => {
      expect(extractReviewerAttribution({ reviewedBy: "Dr. Jane Doe" })).toMatchObject({
        hasAttribution: true,
        attribution: "Dr. Jane Doe",
      });
      expect(extractReviewerAttribution({ reviewer: "Dr. John Smith" })).toMatchObject({
        hasAttribution: true,
        attribution: "Dr. John Smith",
      });
    });

    it("CONTRACT CHANGED: a bare job title in an identity field is no longer attribution", () => {
      // This assertion previously read `hasAttribution: true` for
      // `reviewed_by: "Consultant Psychiatrist"`. It is inverted deliberately,
      // not deleted: a qualification names a role and nobody in particular, so it
      // cannot be traced back to whoever performed the review and cannot support
      // a clinical approval. The placeholder blocklist never caught it, because a
      // job title is a perfectly non-trivial string.
      expect(extractReviewerAttribution({ reviewed_by: "Consultant Psychiatrist" })).toMatchObject({
        hasAttribution: false,
        qualificationOnly: true,
      });

      // Matching is whole-string and exact, so a real reviewer who happens to
      // carry their title with them is unaffected.
      expect(extractReviewerAttribution({ reviewed_by: "Dr Jane Doe (Consultant Psychiatrist)" })).toMatchObject({
        hasAttribution: true,
      });
      expect(extractReviewerAttribution({ reviewed_by: "Psychiatrist Lead, SMHS" })).toMatchObject({
        hasAttribution: true,
      });
    });

    it("extracts valid reviewer attribution from nested metadata and attestations", () => {
      expect(
        extractReviewerAttribution({
          metadata: {
            reviewedBy: "Dr. Jane Doe",
          },
        }),
      ).toMatchObject({
        hasAttribution: true,
        attribution: "Dr. Jane Doe",
      });

      expect(
        extractReviewerAttribution({
          metadata: {
            clinical_validation_evidence: {
              attested_by: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
            },
          },
        }),
      ).toMatchObject({
        hasAttribution: true,
        attribution: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      });

      expect(
        extractReviewerAttribution({
          reviewChecklist: {
            reviewedBy: "Dr. Alice",
          },
        }),
      ).toMatchObject({
        hasAttribution: true,
        attribution: "Dr. Alice",
      });
    });

    it("extracts structured reviewer object attribution", () => {
      expect(
        extractReviewerAttribution({
          reviewer: {
            name: "Dr. Jane Doe",
            qualification: "FRANZCP",
          },
        }),
      ).toMatchObject({
        hasAttribution: true,
        attribution: "Dr. Jane Doe",
      });

      expect(
        extractReviewerAttribution({
          reviewer: {
            id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
          },
        }),
      ).toMatchObject({
        hasAttribution: true,
        attribution: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      });
    });

    it("extracts array of reviewers", () => {
      expect(
        extractReviewerAttribution({
          reviewer: ["Dr. Jane Doe", "Dr. John Smith"],
        }),
      ).toMatchObject({
        hasAttribution: true,
        attribution: "Dr. Jane Doe",
      });
    });

    it("returns hasAttribution: false when reviewer is missing, empty, or trivial", () => {
      expect(extractReviewerAttribution({})).toMatchObject({
        hasAttribution: false,
        attribution: null,
      });
      expect(extractReviewerAttribution({ reviewedBy: "" })).toMatchObject({
        hasAttribution: false,
        attribution: null,
      });
      expect(extractReviewerAttribution({ reviewedBy: "   " })).toMatchObject({
        hasAttribution: false,
        attribution: null,
      });
      expect(extractReviewerAttribution({ reviewedBy: "none" })).toMatchObject({
        hasAttribution: false,
        attribution: null,
      });
      expect(extractReviewerAttribution({ reviewer: "N/A" })).toMatchObject({
        hasAttribution: false,
        attribution: null,
      });
      expect(extractReviewerAttribution({ reviewed_by: "TODO" })).toMatchObject({
        hasAttribution: false,
        attribution: null,
      });
      expect(extractReviewerAttribution({ reviewedBy: "00000000-0000-0000-0000-000000000000" })).toMatchObject({
        hasAttribution: false,
        attribution: null,
      });
      expect(
        extractReviewerAttribution({
          reviewer: {
            name: "none",
            id: "00000000-0000-0000-0000-000000000000",
          },
        }),
      ).toMatchObject({
        hasAttribution: false,
        attribution: null,
      });
    });
  });

  describe("auditReviewAttribution", () => {
    it("passes when there are no reviewed records or all reviewed records have valid attribution", () => {
      const records: AuditableRecord[] = [
        {
          record: {
            slug: "therapy-needs-review",
            name: "Therapy 1",
            reviewStatus: "needs_review",
          },
          recordType: "therapy",
          identifier: "therapy-needs-review",
          title: "Therapy 1",
          source: "src/data/therapies-source.json",
        },
        {
          record: {
            slug: "therapy-reviewed",
            name: "Therapy 2",
            reviewStatus: "reviewed",
            reviewedBy: "Dr. Jane Doe (FRANZCP)",
          },
          recordType: "therapy",
          identifier: "therapy-reviewed",
          title: "Therapy 2",
          source: "src/data/therapies-source.json",
        },
      ];

      const report = auditReviewAttribution(records);
      expect(report).toMatchObject({
        audited_record_count: 2,
        reviewed_record_count: 1,
        unattributed_reviewed_record_count: 0,
        passed: true,
        violations: [],
      });
    });

    it("fails the gate and names any review status neither vocabulary claims", () => {
      const records: AuditableRecord[] = [
        {
          record: { slug: "a", reviewStatus: "signed_off_by_committee" },
          recordType: "therapy",
          identifier: "a",
          title: "A",
          source: "src/data/therapies-source.json",
        },
        {
          record: { slug: "b", reviewStatus: "signed_off_by_committee" },
          recordType: "therapy",
          identifier: "b",
          title: "B",
          source: "src/data/therapies-source.json",
        },
      ];

      const report = auditReviewAttribution(records);
      // No violations, because no record claims a review this gate understands —
      // and that is precisely why it must not report a pass.
      expect(report.violations).toEqual([]);
      expect(report.unattributed_reviewed_record_count).toBe(0);
      expect(report.unrecognised_review_status_counts).toEqual({ signed_off_by_committee: 2 });
      expect(report.passed).toBe(false);
    });

    // The live shape of the 2026-09-25 finding, in miniature: a document marked
    // locally reviewed with nobody recorded against it.
    it("catches a document marked locally_reviewed with no reviewer named", () => {
      const records: AuditableRecord[] = [
        {
          record: {
            id: "doc-1",
            metadata: { clinical_validation_status: "locally_reviewed", clinical_validation_evidence: {} },
          },
          recordType: "document",
          identifier: "doc-1",
          title: "Depression in adults",
          source: "Depression in adults.pdf",
        },
      ];

      const report = auditReviewAttribution(records);
      expect(report.reviewed_record_count).toBe(1);
      expect(report.unattributed_reviewed_record_count).toBe(1);
      expect(report.passed).toBe(false);
      expect(report.violations[0]?.review_status).toBe("locally_reviewed");
    });

    it("detects governance violations when reviewed records lack attribution", () => {
      const records: AuditableRecord[] = [
        {
          record: {
            slug: "unattributed-reviewed-therapy",
            name: "Unattributed Therapy",
            reviewStatus: "reviewed",
          },
          recordType: "therapy",
          identifier: "unattributed-reviewed-therapy",
          title: "Unattributed Therapy",
          source: "src/data/therapies-source.json",
        },
        {
          record: {
            id: "doc-reviewed-empty-attribution",
            title: "Guideline with Empty Attribution",
            metadata: {
              reviewStatus: "reviewed",
              reviewedBy: "   ",
            },
          },
          recordType: "document",
          identifier: "doc-reviewed-empty-attribution",
          title: "Guideline with Empty Attribution",
          source: "WA Health/guideline.pdf",
        },
        {
          record: {
            id: "diff-trivial-attribution",
            title: "Differential with Trivial Placeholder",
            reviewStatus: "reviewed",
            reviewer: "N/A",
          },
          recordType: "differential",
          identifier: "diff-trivial-attribution",
          title: "Differential with Trivial Placeholder",
          source: "data/differentials-snapshot.json",
        },
        {
          record: {
            slug: "valid-reviewed-therapy",
            name: "Valid Therapy",
            reviewStatus: "reviewed",
            reviewedBy: "Dr. Jane Doe",
          },
          recordType: "therapy",
          identifier: "valid-reviewed-therapy",
          title: "Valid Therapy",
          source: "src/data/therapies-source.json",
        },
        {
          record: {
            slug: "unreviewed-therapy",
            name: "Unreviewed Therapy",
            reviewStatus: "needs_review",
          },
          recordType: "therapy",
          identifier: "unreviewed-therapy",
          title: "Unreviewed Therapy",
          source: "src/data/therapies-source.json",
        },
      ];

      const report = auditReviewAttribution(records);
      expect(report.audited_record_count).toBe(5);
      expect(report.reviewed_record_count).toBe(4);
      expect(report.unattributed_reviewed_record_count).toBe(3);
      expect(report.passed).toBe(false);
      expect(report.violations).toHaveLength(3);

      expect(report.violations[0]).toMatchObject({
        record_type: "therapy",
        identifier: "unattributed-reviewed-therapy",
        review_status: "reviewed",
        reason: expect.stringContaining("has no reviewer attribution"),
      });

      expect(report.violations[1]).toMatchObject({
        record_type: "document",
        identifier: "doc-reviewed-empty-attribution",
        review_status: "reviewed",
        reason: expect.stringContaining("trivial placeholder"),
        found_attribution: { "metadata.reviewedBy": "[redacted]" },
      });
      expect(report.violations[1].reason).not.toContain("   ");

      expect(report.violations[2]).toMatchObject({
        record_type: "differential",
        identifier: "diff-trivial-attribution",
        review_status: "reviewed",
        reason: expect.stringContaining("trivial placeholder"),
        found_attribution: { reviewer: "[redacted]" },
      });
      expect(report.violations[2].reason).toContain("reviewer");
      expect(report.violations[2].reason).not.toContain("unknown");
    });
  });
});
