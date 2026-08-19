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
      });
      expect(isRecordMarkedReviewed({ review_status: "Reviewed" })).toEqual({
        isReviewed: true,
        rawStatus: "Reviewed",
      });
      expect(isRecordMarkedReviewed({ metadata: { reviewStatus: "reviewed" } })).toEqual({
        isReviewed: true,
        rawStatus: "reviewed",
      });
      expect(isRecordMarkedReviewed({ metadata: { review_status: "REVIEWED" } })).toEqual({
        isReviewed: true,
        rawStatus: "REVIEWED",
      });
    });

    it("returns false for unreviewed statuses or missing review status", () => {
      expect(isRecordMarkedReviewed({ reviewStatus: "needs_review" })).toEqual({
        isReviewed: false,
        rawStatus: null,
      });
      expect(isRecordMarkedReviewed({ reviewStatus: "Pending review" })).toEqual({
        isReviewed: false,
        rawStatus: null,
      });
      expect(isRecordMarkedReviewed({ reviewStatus: "Pending qualified clinician review" })).toEqual({
        isReviewed: false,
        rawStatus: null,
      });
      expect(isRecordMarkedReviewed({})).toEqual({
        isReviewed: false,
        rawStatus: null,
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
      expect(extractReviewerAttribution({ reviewed_by: "Consultant Psychiatrist" })).toMatchObject({
        hasAttribution: true,
        attribution: "Consultant Psychiatrist",
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
      });

      expect(report.violations[2]).toMatchObject({
        record_type: "differential",
        identifier: "diff-trivial-attribution",
        review_status: "reviewed",
        reason: expect.stringContaining("trivial placeholder"),
      });
    });
  });
});
