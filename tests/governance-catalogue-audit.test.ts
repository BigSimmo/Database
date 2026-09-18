import { describe, expect, it } from "vitest";

import differentialsSnapshot from "../data/differentials-snapshot.json";
import specifiersContent from "../data/specifiers-content.json";
import {
  CatalogueShapeError,
  enumerateDifferentialAuditRecords,
  enumerateSpecifierAuditRecords,
} from "../scripts/lib/governance-catalogue-audit";
import { auditReviewAttribution, extractReviewerAttribution } from "../scripts/audit-source-governance";

/**
 * The defect these cover: scripts/audit-source-governance.ts read
 * data/differentials-snapshot.json at `.records` and data/specifiers-content.json
 * at `.specifiers`. Neither key exists. Both reads ended in `?? []`, so 835
 * clinical records contributed nothing and the reviewer-attribution gate passed
 * for both corpora by having no rows to examine.
 *
 * Counts below are EXACT, not minimums. A minimum-count assertion would not have
 * caught this, because zero is below every minimum.
 */
describe("catalogue coverage against the real committed files", () => {
  it("enumerates both differential populations separately", () => {
    const populations = enumerateDifferentialAuditRecords(differentialsSnapshot);
    expect(populations.map((population) => [population.name, population.observed])).toEqual([
      ["differential-diagnoses", 201],
      ["differential-presentations", 31],
    ]);
  });

  it("enumerates the nested specifier catalogue and the universal entries", () => {
    const populations = enumerateSpecifierAuditRecords(specifiersContent);
    expect(populations.map((population) => [population.name, population.observed])).toEqual([
      ["specifier-items", 585],
      ["specifier-universal", 18],
    ]);
    // The file's own declared counts must agree with what traversal reached.
    expect(populations.map((population) => population.declared)).toEqual([585, 18]);
  });

  it("reaches 835 records in total, where the audit previously reached none", () => {
    const total = [
      ...enumerateDifferentialAuditRecords(differentialsSnapshot),
      ...enumerateSpecifierAuditRecords(specifiersContent),
    ].reduce((running, population) => running + population.observed, 0);
    expect(total).toBe(835);
  });

  it("gives every record a usable identifier, so a violation can be acted on", () => {
    const records = [
      ...enumerateDifferentialAuditRecords(differentialsSnapshot),
      ...enumerateSpecifierAuditRecords(specifiersContent),
    ].flatMap((population) => population.records);
    for (const record of records) {
      expect(record.identifier, `${record.source} record has no identifier`).toBeTruthy();
      expect(record.identifier).not.toMatch(/^(undefined|null|unknown)$/);
    }
  });
});

describe("a missing population is a coverage failure, never an audited zero", () => {
  it("raises when the differential snapshot has neither real key", () => {
    // This is the exact shape the old `?? []` swallowed.
    expect(() => enumerateDifferentialAuditRecords({ records: [] })).toThrow(CatalogueShapeError);
    expect(() => enumerateDifferentialAuditRecords({ records: [] })).toThrow(/no "diagnoses" population/);
    expect(() => enumerateDifferentialAuditRecords({ diagnoses: [] })).toThrow(/no "presentations" population/);
  });

  it("raises when the specifier export has neither real shape", () => {
    expect(() => enumerateSpecifierAuditRecords({ specifiers: [] })).toThrow(/no "categories" population/);
    expect(() => enumerateSpecifierAuditRecords({ categories: [] })).toThrow(/no "universalSpecifiers" population/);
  });

  it("raises on a wrong-typed population rather than coercing it", () => {
    expect(() => enumerateDifferentialAuditRecords({ diagnoses: {}, presentations: [] })).toThrow(/not an array/);
    expect(() => enumerateDifferentialAuditRecords("nope")).toThrow(/not a JSON object/);
    expect(() => enumerateDifferentialAuditRecords(null)).toThrow(/not a JSON object/);
  });

  it("raises when traversal disagrees with the file's own declared count", () => {
    // The failure mode that happened: a traversal reaching far fewer records than
    // the file says it holds.
    const content = {
      stats: { specifierItems: 99, universalSpecifiers: 0 },
      universalSpecifiers: [],
      categories: [
        {
          id: "c",
          name: "Category",
          disorders: [
            { name: "Disorder", groups: [{ label: "G", items: [{ label: "One", review: { rowKey: "r" } }] }] },
          ],
        },
      ],
    };
    expect(() => enumerateSpecifierAuditRecords(content)).toThrow(
      /declares 99 specifier-items but traversal reached 1/,
    );
  });

  it("accepts a well-formed minimal catalogue", () => {
    const populations = enumerateSpecifierAuditRecords({
      stats: { specifierItems: 1, universalSpecifiers: 1 },
      universalSpecifiers: [{ title: "Universal", review: { rowKey: "u" } }],
      categories: [
        {
          id: "c",
          name: "Category",
          disorders: [
            { name: "Disorder", groups: [{ label: "G", items: [{ label: "One", review: { rowKey: "r" } }] }] },
          ],
        },
      ],
    });
    expect(populations.map((population) => population.observed)).toEqual([1, 1]);
    expect(populations[0].records[0]).toMatchObject({ identifier: "r", title: "One", recordType: "specifier-item" });
  });

  it("surfaces the nested clinician review status the audit could not see", () => {
    // Review state lives at item.review.clinicianReviewStatus, not at a top-level
    // reviewStatus, so isRecordMarkedReviewed was blind to it. All 585 are pending
    // today; this changes no record's status, it makes the field visible.
    const [items] = enumerateSpecifierAuditRecords({
      stats: { specifierItems: 1, universalSpecifiers: 0 },
      universalSpecifiers: [],
      categories: [
        {
          id: "c",
          name: "Category",
          disorders: [
            {
              name: "Disorder",
              groups: [
                { label: "G", items: [{ label: "One", review: { rowKey: "r", clinicianReviewStatus: "reviewed" } }] },
              ],
            },
          ],
        },
      ],
    });
    expect(items.records[0].record.reviewStatus).toBe("reviewed");
  });

  it("leaves the real catalogue's 585 items pending, not reviewed", () => {
    const [items] = enumerateSpecifierAuditRecords(specifiersContent);
    const statuses = new Set(items.records.map((record) => record.record.reviewStatus));
    expect([...statuses]).toEqual(["clinician-review-pending"]);
  });
});

describe("a qualification is not a reviewer identity", () => {
  it("rejects a role or title standing alone", () => {
    // Previously accepted: tests/source-governance-attribution.test.ts asserted
    // that `reviewed_by: "Consultant Psychiatrist"` counted as attribution. A job
    // title is not a placeholder — it is a real string that identifies nobody.
    expect(extractReviewerAttribution({ reviewerQualification: "psychiatrist" })).toMatchObject({
      hasAttribution: false,
      qualificationOnly: true,
    });
    expect(extractReviewerAttribution({ reviewer_qualification: "Consultant Psychiatrist" })).toMatchObject({
      hasAttribution: false,
      qualificationOnly: true,
    });
    expect(extractReviewerAttribution({ metadata: { reviewer_qualification: "Registrar" } })).toMatchObject({
      hasAttribution: false,
      qualificationOnly: true,
    });
  });

  it("rejects a nested qualification or title too", () => {
    expect(extractReviewerAttribution({ reviewer: { qualification: "psychiatrist" } })).toMatchObject({
      hasAttribution: false,
    });
    expect(extractReviewerAttribution({ reviewer: { title: "Consultant" } })).toMatchObject({ hasAttribution: false });
  });

  it("still accepts an identity, and lets a qualification supplement it", () => {
    expect(extractReviewerAttribution({ reviewedBy: "Dr. Jane Doe" })).toMatchObject({
      hasAttribution: true,
      attribution: "Dr. Jane Doe",
    });
    expect(
      extractReviewerAttribution({ reviewedBy: "Dr. Jane Doe", reviewerQualification: "psychiatrist" }),
    ).toMatchObject({ hasAttribution: true, attribution: "Dr. Jane Doe" });
    expect(
      extractReviewerAttribution({ reviewer: { name: "Dr. Jane Doe", qualification: "psychiatrist" } }),
    ).toMatchObject({ hasAttribution: true });
  });

  it("names the qualification in the violation so the follow-up differs", () => {
    // "Reviewed by a psychiatrist" and "reviewed by nobody recorded" need
    // different next steps.
    const report = auditReviewAttribution([
      {
        record: { reviewStatus: "reviewed", reviewerQualification: "psychiatrist" },
        recordType: "specifier-item",
        identifier: "row-1",
        title: "With psychotic features",
        source: "data/specifiers-content.json",
      },
    ]);
    expect(report.passed).toBe(false);
    expect(report.violations[0].reason).toMatch(/names a role rather than the person/);
    // The value itself stays redacted in output.
    expect(report.violations[0].found_attribution).toEqual({ reviewerQualification: "[redacted]" });
  });

  it("still distinguishes an absent attribution from a role-only one", () => {
    const report = auditReviewAttribution([
      {
        record: { reviewStatus: "reviewed" },
        recordType: "differential-diagnosis",
        identifier: "row-2",
        title: "Example",
        source: "data/differentials-snapshot.json",
      },
    ]);
    expect(report.violations[0].reason).toMatch(/has no reviewer attribution/);
  });
});
