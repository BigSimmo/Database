import { describe, expect, it } from "vitest";

import {
  factsheetCategories,
  factsheets,
  factsheetSlugs,
  featuredFactsheetSlugs,
  filterFactsheets,
  findFactsheet,
  printBlocks,
  relatedFactsheets,
  tocFor,
} from "@/components/factsheets/factsheets-data";

const kinds = new Set(["medRich", "medLite", "condition", "therapy", "procedure"]);

describe("factsheet library", () => {
  it("only resolves the explicitly supplied factsheet slugs", () => {
    expect(findFactsheet(factsheets[0]!.slug)).toEqual(factsheets[0]!);
    expect(findFactsheet("unknown-factsheet")).toBeUndefined();
  });

  it("has unique slugs and complete governance metadata on every sheet", () => {
    const slugs = new Set<string>();
    for (const sheet of factsheets) {
      expect(slugs.has(sheet.slug)).toBe(false);
      slugs.add(sheet.slug);

      expect(sheet.title).toBeTruthy();
      expect(sheet.summary).toBeTruthy();
      expect(sheet.audience).toBeTruthy();
      expect(sheet.readTime).toBeTruthy();
      // Every sheet carries a human review month and at least one cited source.
      expect(sheet.reviewedOn).toBeTruthy();
      expect(sheet.sources.length).toBeGreaterThan(0);
      expect(factsheetCategories).toContain(sheet.category);
      expect(kinds.has(sheet.kind)).toBe(true);
    }
  });

  it("exposes every slug through the static-params helper", () => {
    expect(factsheetSlugs().sort()).toEqual(factsheets.map((sheet) => sheet.slug).sort());
  });

  it("resolves every featured slug to a real sheet", () => {
    for (const slug of featuredFactsheetSlugs) {
      expect(findFactsheet(slug)).toBeDefined();
    }
  });

  it("filters by query and category", () => {
    expect(filterFactsheets("", undefined)).toHaveLength(factsheets.length);
    expect(filterFactsheets("sertraline").map((sheet) => sheet.slug)).toContain("sertraline");
    const conditions = filterFactsheets("", "Conditions");
    expect(conditions.length).toBeGreaterThan(0);
    expect(conditions.every((sheet) => sheet.category === "Conditions")).toBe(true);
    expect(filterFactsheets("this-matches-nothing-xyz")).toHaveLength(0);
  });

  it("never lists a sheet as related to itself", () => {
    for (const sheet of factsheets) {
      expect(relatedFactsheets(sheet.slug).some((related) => related.slug === sheet.slug)).toBe(false);
    }
  });

  it("builds a print projection and table of contents for every kind", () => {
    for (const sheet of factsheets) {
      const blocks = printBlocks(sheet);
      expect(blocks.length).toBeGreaterThan(0);
      // The sources block is always the final print block.
      expect(blocks.at(-1)?.kind).toBe("sources");
      expect(tocFor(sheet)).toContain("Sources");
    }
  });
});
