import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  ACQUISITION_METADATA_DEFECTS,
  acquisitionLedgerIssues,
  acquisitionRecordGeography,
  acquisitionRecordWarnings,
  acquisitionReviewQueue,
  acquisitionSourceReferences,
  SOURCE_ACQUISITION_RUNGS,
  sourceAcquisitionRecords,
  type SourceAcquisitionRecord,
} from "@/lib/sources/acquisition-ledger";
import { sourceAuthorityForPublisher } from "@/lib/source-authority-registry";
import { canonicalizeSourceReferences } from "@/lib/sources/catalogue-core";
import {
  classifySourceAuthority,
  sourceCatalogueDesignation,
  sourceCatalogueGeographyScope,
} from "@/lib/source-authority-registry";
import type { ClinicalSourceReferenceInput } from "@/lib/sources/catalogue-types";

const baseRecord: SourceAcquisitionRecord = {
  id: "ocp-wa-test-guideline",
  title: "Chief Psychiatrist's Guideline for further opinions",
  publisher: "Office of the Chief Psychiatrist WA",
  publisherCode: "OCP WA",
  canonicalUrl: "https://www.chiefpsychiatrist.wa.gov.au/publication/guideline-further-opinions/",
  jurisdiction: "Australia/WA",
  version: "December 2025",
  publicationDate: "2025-12-19",
  datePrecision: "day",
  reviewDate: null,
  expiryDate: null,
  evidenceType: "guideline",
  documentStatus: "current",
  validationStatus: "unverified",
  contentMode: "link_only",
  topics: ["Mental Health Act 2014"],
  rung: 2,
  capturedAt: "2026-09-06",
  capturedFor: "Test capture",
  disposition: "candidate",
  dispositionReason: "Awaiting sign-off",
  supersededBy: [],
  notes: null,
};

// A real Australian clinical publisher that is deliberately absent from the source authority
// register, so the "unrecognised publisher" path has a genuine example to exercise.
const unregisteredPublisher = "Beyond Blue";

function record(overrides: Partial<SourceAcquisitionRecord> = {}): SourceAcquisitionRecord {
  return { ...baseRecord, ...overrides };
}

function issuesFor(overrides: Partial<SourceAcquisitionRecord> = {}) {
  return acquisitionLedgerIssues([record(overrides)]);
}

describe("source acquisition ledger", () => {
  it("retains catalogue geography without granting runtime authority by publisher code", () => {
    expect(sourceCatalogueGeographyScope(baseRecord)).toBe("wa");
    expect(sourceCatalogueDesignation(baseRecord)).toBe("trusted");
    const runtime = classifySourceAuthority({
      source_kind: "document",
      publisher: baseRecord.publisher,
      publisher_code: baseRecord.publisherCode,
      jurisdiction: baseRecord.jurisdiction,
      document_status: "current",
      clinical_validation_status: "locally_reviewed",
      extraction_quality: "good",
    });
    expect(runtime.authority).toBeNull();
    expect(runtime.designation).toBe("unclassified");
    expect(runtime.tier).toBe("supplementary");
    expect(runtime.australianAugmentationEligible).toBe(false);
  });

  it.each([
    { publisherCode: "UNKNOWN" },
    { publisher: "Unrelated publisher" },
    { publisher: "World Health Organization" },
    { jurisdiction: "United Kingdom" },
  ])("rejects conflicting catalogue geography %j", (override) => {
    expect(sourceCatalogueGeographyScope({ ...baseRecord, ...override })).toBeNull();
    expect(sourceCatalogueDesignation({ ...baseRecord, ...override })).toBe("unclassified");
    const [conflicting] = canonicalizeSourceReferences(
      acquisitionSourceReferences([record({ validationStatus: "locally_reviewed", ...override })]),
    );
    expect(conflicting.rating.dimensions.reliability).toBe(8);
  });

  it("requires jurisdiction for a catalogue designation resolved only by publisher alias", () => {
    expect(sourceCatalogueDesignation({ ...baseRecord, publisherCode: null })).toBe("trusted");
    expect(sourceCatalogueDesignation({ ...baseRecord, publisherCode: null, jurisdiction: null })).toBe("unclassified");
  });

  it.each([
    { publisherCode: "CAHS", publisher: "WA Health", designation: "official", reliability: 20 },
    { publisherCode: "NMHS", publisher: "WA Health", designation: "official", reliability: 20 },
    { publisherCode: "SMHS", publisher: "WA Health", designation: "official", reliability: 20 },
    { publisherCode: "OCPWA", publisher: "WA Health", designation: "trusted", reliability: 16 },
    { publisherCode: "CAHS", publisher: "World Health Organization", designation: "unclassified", reliability: 8 },
  ])("rates compatible publisher identity for $publisherCode / $publisher", (identity) => {
    const source = record({
      publisherCode: identity.publisherCode,
      publisher: identity.publisher,
      validationStatus: "locally_reviewed",
    });
    expect(sourceCatalogueDesignation(source)).toBe(identity.designation);
    const [entry] = canonicalizeSourceReferences(acquisitionSourceReferences([source]));
    expect(entry.rating.dimensions.reliability).toBe(identity.reliability);
  });

  it("accepts the committed ledger without any outstanding issue", () => {
    expect(acquisitionLedgerIssues(sourceAcquisitionRecords)).toEqual([]);
    expect(sourceAcquisitionRecords.length).toBeGreaterThan(0);
  });

  it("captures every committed source with complete metadata, so none carries a metadata defect", () => {
    const defects = new Set<string>(ACQUISITION_METADATA_DEFECTS);
    for (const entry of sourceAcquisitionRecords) {
      expect(
        acquisitionRecordWarnings(entry).filter((warning) => defects.has(warning)),
        `${entry.id} carries a metadata defect`,
      ).toEqual([]);
    }
  });

  it("treats an unreviewed capture as awaiting sign-off rather than as broken metadata", () => {
    const warnings = acquisitionRecordWarnings(record());
    expect(warnings).toContain("verification_unknown");
    expect(warnings.filter((warning) => (ACQUISITION_METADATA_DEFECTS as readonly string[]).includes(warning))).toEqual(
      [],
    );
    expect(issuesFor()).toEqual([]);
  });

  it("lifts a signed-off capture out of D band using catalogue identity without granting runtime authority", () => {
    const [unreviewed] = canonicalizeSourceReferences(acquisitionSourceReferences([record()]));
    const [reviewed] = canonicalizeSourceReferences(
      acquisitionSourceReferences([record({ validationStatus: "locally_reviewed" })]),
    );

    expect(unreviewed.rating.band).toBe("D");
    expect(reviewed.rating.band).toBe("A");
    expect(reviewed.rating.dimensions.reliability).toBe(16);
    expect(reviewed.rating.dimensions.australianApplicability).toBe(15);
    expect(reviewed.rating.score).toBeGreaterThan(unreviewed.rating.score);
    expect(reviewed.geography.scope).toBe("wa");
  });
});

describe("source acquisition rungs", () => {
  it("maps every rung to the geography the catalogue derives independently", () => {
    expect(SOURCE_ACQUISITION_RUNGS.map((entry) => entry.scope)).toEqual([
      "wa",
      "wa",
      "australian_national",
      "australian_state",
      "international",
    ]);
  });

  it("rejects a source filed at a rung its publisher does not belong to", () => {
    expect(acquisitionRecordGeography(record())).toBe("wa");
    expect(issuesFor({ rung: 5 })).toEqual([
      "ocp-wa-test-guideline: filed at rung 5 (expects international) but the register places it in wa",
    ]);
  });

  it("rejects an unknown rung", () => {
    expect(issuesFor({ rung: 9 as SourceAcquisitionRecord["rung"] })).toContain(
      "ocp-wa-test-guideline: rung must be one of 1, 2, 3, 4 or 5",
    );
  });

  it("names the register as the blocker when a publisher is not recognised, and warns that fixing it moves retrieval", () => {
    // The example publisher has to be one the register genuinely does not carry, so assert that
    // here rather than trusting the constant: Therapeutic Guidelines used to sit in this slot and
    // the premise silently went false the day it was registered.
    expect(sourceAuthorityForPublisher(unregisteredPublisher)).toBeNull();
    const [issue] = issuesFor({ publisher: unregisteredPublisher, publisherCode: null, canonicalUrl: null });
    expect(issue).toContain("is not in the source authority register");
    expect(issue).toContain("can never leave D band");
    expect(issue).toContain("changes retrieval selection");
  });
});

describe("source acquisition metadata floor", () => {
  it.each([
    ["publisher", { publisher: "" }],
    ["version", { version: "" }],
    ["jurisdiction", { jurisdiction: "" }],
    ["capturedFor", { capturedFor: "" }],
  ] as const)("requires %s", (_field, overrides) => {
    expect(issuesFor(overrides).length).toBeGreaterThan(0);
  });

  it("requires an exact publication date and rejects a bare year", () => {
    expect(issuesFor({ publicationDate: "2025" })).toContain(
      'ocp-wa-test-guideline: publicationDate must be an exact YYYY-MM-DD date, got "2025"',
    );
  });

  it("requires a year-precision date to be recorded as the first of January", () => {
    expect(issuesFor({ publicationDate: "2020-06-01", datePrecision: "year" })).toContain(
      "ocp-wa-test-guideline: year-precision publicationDate must be recorded as the first of January",
    );
    expect(issuesFor({ publicationDate: "2020-01-01", datePrecision: "year" })).toEqual([]);
  });

  it("requires a month-precision date to be recorded as the first of the month", () => {
    expect(issuesFor({ publicationDate: "2025-12-19", datePrecision: "month" })).toContain(
      "ocp-wa-test-guideline: month-precision publicationDate must be recorded as the first of the month",
    );
  });

  it("refuses a URL on a host the source policy does not govern, and says how to fix it", () => {
    const [issue] = issuesFor({ canonicalUrl: "https://example.com/guideline" });
    expect(issue).toContain("example.com is not a governed source host");
    expect(issue).toContain("GOVERNED_SOURCE_HOSTS");
  });

  it("rejects a duplicate ledger id", () => {
    expect(acquisitionLedgerIssues([record(), record()])).toContain("ocp-wa-test-guideline: duplicate ledger id");
  });

  it("rejects an id that is not a slug", () => {
    expect(acquisitionLedgerIssues([record({ id: "Not A Slug" })])).toContain(
      "Not A Slug: id must be a lower-case hyphenated slug",
    );
  });
});

describe("source acquisition dispositions", () => {
  it("refuses to let unreviewed evidence be adopted into clinical content", () => {
    expect(issuesFor({ disposition: "adopted" })).toContain(
      "ocp-wa-test-guideline: an adopted source must be reviewed before clinical content cites it",
    );
    expect(issuesFor({ disposition: "adopted", validationStatus: "locally_reviewed" })).toEqual([]);
  });

  it("requires a reason for anything not adopted, so a rejection is recoverable later", () => {
    expect(issuesFor({ disposition: "rejected", dispositionReason: null })).toContain(
      "ocp-wa-test-guideline: a rejected source must record why",
    );
    expect(issuesFor({ disposition: "candidate", dispositionReason: "  " })).toContain(
      "ocp-wa-test-guideline: a candidate source must record why",
    );
  });

  it("keeps a rejected source in the register as excluded, and exempts it from the metadata floor", () => {
    const rejected = record({
      disposition: "rejected",
      dispositionReason: "Superseded by the 2020 Australian guideline",
      version: "",
    });
    expect(acquisitionLedgerIssues([rejected])).toEqual([]);

    const [entry] = canonicalizeSourceReferences(acquisitionSourceReferences([rejected]));
    expect(entry.lifecycleStatus).toBe("excluded");
    expect(entry.rating.band).toBe("excluded");
  });
});

describe("source acquisition catalogue integration", () => {
  it("merges a capture with the content that cites the same source, so one entry lists both usages", () => {
    const contentReference: ClinicalSourceReferenceInput = {
      ...acquisitionSourceReferences([record({ validationStatus: "locally_reviewed" })])[0],
      usage: {
        modeId: "factsheets",
        recordId: "further-opinions",
        recordLabel: "Requesting a further opinion",
        field: "sources",
      },
    };

    const entries = canonicalizeSourceReferences([
      ...acquisitionSourceReferences([record({ validationStatus: "locally_reviewed" })]),
      contentReference,
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0].usedBy.map((usage) => `${usage.modeId}:${usage.field}`).sort()).toEqual([
      "factsheets:sources",
      "sources:acquisition_ledger",
    ]);
  });

  it("files every capture under the sources mode so the register is traceable", () => {
    for (const reference of acquisitionSourceReferences()) {
      expect(reference.usage.modeId).toBe("sources");
      expect(reference.usage.field).toBe("acquisition_ledger");
      expect(reference.usage.recordId).toBeTruthy();
      expect(reference.sourceId).toBeNull();
    }
  });

  it("queues unreviewed captures for sign-off, most local first", () => {
    const queue = acquisitionReviewQueue([
      record({
        id: "national",
        rung: 3,
        publisher: "Royal Australian and New Zealand College of Psychiatrists",
        publisherCode: "RANZCP",
        jurisdiction: "Australia",
      }),
      record({ id: "local" }),
      record({ id: "already-reviewed", validationStatus: "locally_reviewed" }),
    ]);

    expect(queue.map((entry) => entry.id)).toEqual(["local", "national"]);
  });
});
