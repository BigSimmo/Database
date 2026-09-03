import { describe, expect, it } from "vitest";

import type { SourceUsage } from "@/lib/sources/catalogue-types";
import { groupSourceUsagesByMode, sourceUsageHref, sourceUsagePurpose } from "@/lib/sources/source-usage-presentation";

function usage(overrides: Partial<SourceUsage> = {}): SourceUsage {
  return {
    modeId: "dictionary",
    recordId: "mental-state-examination",
    recordLabel: "Mental state examination",
    field: "definition",
    ...overrides,
  };
}

describe("sourceUsageHref", () => {
  it("deep-links the modes whose record id is the route slug", () => {
    expect(sourceUsageHref(usage())).toBe("/dictionary/mental-state-examination");
    expect(sourceUsageHref(usage({ modeId: "factsheets", recordId: "depression" }))).toBe("/factsheets/depression");
    expect(sourceUsageHref(usage({ modeId: "prescribing", recordId: "lithium" }))).toBe("/medications/lithium");
    expect(sourceUsageHref(usage({ modeId: "therapy-compass", recordId: "cbt" }))).toBe("/therapy-compass/cbt");
    expect(sourceUsageHref(usage({ modeId: "documents", recordId: "doc_123" }))).toBe("/documents/doc_123");
  });

  it("sends a dictionary comparison to the comparison route rather than a term that does not exist", () => {
    expect(sourceUsageHref(usage({ recordId: "mania--hypomania", field: "comparison" }))).toBe("/dictionary/compare");
  });

  it("falls back to the mode's own search for records whose id is not a route", () => {
    expect(
      sourceUsageHref(usage({ modeId: "specifiers", recordId: "row-42", recordLabel: "With mixed features" })),
    ).toBe("/specifiers/search?q=With+mixed+features&run=1");
    expect(sourceUsageHref(usage({ modeId: "calculators", recordId: "phq9", recordLabel: "PHQ-9" }))).toBe(
      "/calculators/search?q=PHQ-9&run=1",
    );
  });

  it("percent-encodes a record label rather than emitting a broken query", () => {
    const href = sourceUsageHref(usage({ modeId: "forms", recordId: "f1", recordLabel: "Form 1A & 1B" }));
    expect(href).toContain("q=Form+1A+%26+1B");
  });
});

describe("sourceUsagePurpose", () => {
  it("reads as clinical phrasing, never as the stored field name", () => {
    expect(sourceUsagePurpose(usage({ field: "definition" }))).toBe("Supports the definition");
    expect(sourceUsagePurpose(usage({ field: "comparison" }))).toBe("Supports a term comparison");
    expect(sourceUsagePurpose(usage({ field: "distinctions.mania-vs-hypomania" }))).toBe(
      "Supports a distinction between terms",
    );
    expect(sourceUsagePurpose(usage({ field: "public_source_urls" }))).toBe("Linked as the service's public source");
    expect(sourceUsagePurpose(usage({ field: "source metadata" }))).toBe("Provides the document's source record");
    expect(sourceUsagePurpose(usage({ field: "review.sourceFamily" }))).toBe("Underpins the review criteria");
    expect(sourceUsagePurpose(usage({ field: "act" }))).toBe("Underpins the legislation summary");
  });

  it("names the record section a prescribing usage backs", () => {
    expect(sourceUsagePurpose(usage({ modeId: "prescribing", field: "Dosing.adult dose" }))).toBe(
      "Supports the dosing section",
    );
  });

  it("never leaks an unmapped field name into reader-facing text", () => {
    expect(sourceUsagePurpose(usage({ field: "some_unmapped_backend_field" }))).toBe("Cited as evidence");
  });
});

describe("groupSourceUsagesByMode", () => {
  it("groups by mode, keeps a stable record order and carries the mode's own label", () => {
    const groups = groupSourceUsagesByMode([
      usage({ modeId: "factsheets", recordId: "depression", recordLabel: "Depression", field: "sources" }),
      usage(),
      usage({ recordId: "affect", recordLabel: "Affect", field: "definition" }),
    ]);

    expect(groups.map((group) => group.modeLabel)).toEqual(["Dictionary", "Factsheets"]);
    expect(groups[0].usages.map((entry) => entry.recordLabel)).toEqual(["Affect", "Mental state examination"]);
    expect(groups[0].usages[0].purpose).toBe("Supports the definition");
    expect(groups[0].usages[0].href).toBe("/dictionary/affect");
  });

  it("collapses repeated usages of one record so a record is listed once per purpose", () => {
    const groups = groupSourceUsagesByMode([usage(), usage(), usage({ field: "clinical use" })]);

    expect(groups).toHaveLength(1);
    expect(groups[0].usages).toHaveLength(2);
    expect(groups[0].recordCount).toBe(1);
  });

  it("returns nothing for a source no part of the site uses", () => {
    expect(groupSourceUsagesByMode([])).toEqual([]);
  });
});
