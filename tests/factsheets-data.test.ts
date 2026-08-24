import { describe, expect, it } from "vitest";

import {
  FACTSHEET_DEMO_NOTICE,
  TOPIC_SECTION_PREVIEW_LIMIT,
  factsheetCategories,
  factsheetTopicQueryValue,
  factsheets,
  factsheetSlugs,
  featuredFactsheetSlugs,
  factsheetsGroupedByCategory,
  filterFactsheets,
  findFactsheet,
  printBlocks,
  relatedFactsheets,
  resolveFactsheetTopicParam,
  topicSectionId,
  visibleTopicSheets,
} from "@/components/factsheets/factsheets-data";

const kinds = new Set(["medRich", "medLite", "condition", "therapy", "procedure"]);

describe("factsheet library", () => {
  it("only resolves the explicitly supplied factsheet slugs", () => {
    expect(findFactsheet(factsheets[0]!.slug)).toEqual(factsheets[0]!);
    expect(findFactsheet("unknown-factsheet")).toBeUndefined();
  });

  it("exposes a demo/governance notice for on-screen and printed take-aways", () => {
    // The exported handout must never read as approved local patient information.
    expect(FACTSHEET_DEMO_NOTICE).toMatch(/demonstration/i);
    expect(FACTSHEET_DEMO_NOTICE).toMatch(/not clinician-approved/i);
    expect(FACTSHEET_DEMO_NOTICE).toMatch(/before any clinical use/i);
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
      // Every sheet carries a content date month and at least one cited source.
      // `reviewedOn` is a demonstration currency stamp — not clinician approval.
      expect(sheet.reviewedOn).toBeTruthy();
      expect(sheet.sources.length).toBeGreaterThan(0);
      expect(factsheetCategories).toContain(sheet.category);
      expect(kinds.has(sheet.kind)).toBe(true);
    }
  });

  it("attaches verifiable https URLs to every cited source", () => {
    for (const sheet of factsheets) {
      for (const source of sheet.sources) {
        expect(source.url, `${sheet.slug} source ${source.n}`).toMatch(/^https:\/\//);
      }
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

  it("resolves topic browse helpers for section ids, query params, and collapse", () => {
    expect(TOPIC_SECTION_PREVIEW_LIMIT).toBe(8);
    expect(topicSectionId("Tests & procedures")).toBe("factsheet-topic-tests-procedures");
    expect(factsheetTopicQueryValue("Tests & procedures")).toBe("tests-procedures");
    expect(resolveFactsheetTopicParam("Medications")).toBe("Medications");
    expect(resolveFactsheetTopicParam("tests-procedures")).toBe("Tests & procedures");
    expect(resolveFactsheetTopicParam("factsheet-topic-conditions")).toBe("Conditions");
    expect(resolveFactsheetTopicParam("unknown")).toBeUndefined();
    expect(resolveFactsheetTopicParam("")).toBeUndefined();
    expect(visibleTopicSheets([1, 2, 3, 4], false, 2)).toEqual([1, 2]);
    expect(visibleTopicSheets([1, 2, 3, 4], true, 2)).toEqual([1, 2, 3, 4]);
  });

  it("groups the library into the four topic categories without dropping sheets", () => {
    const groups = factsheetsGroupedByCategory();
    expect(groups.map((group) => group.category)).toEqual([...factsheetCategories]);
    expect(groups.reduce((count, group) => count + group.sheets.length, 0)).toBe(factsheets.length);
    for (const group of groups) {
      expect(group.sheets.every((sheet) => sheet.category === group.category)).toBe(true);
    }
  });

  it("filters by query and category", () => {
    expect(filterFactsheets("", undefined)).toHaveLength(factsheets.length);
    expect(filterFactsheets("sertraline").map((sheet) => sheet.slug)).toContain("sertraline");
    // Brand suffix ("(Zoloft)") is indexed even though it is stored separately from the title.
    expect(filterFactsheets("Zoloft").map((sheet) => sheet.slug)).toContain("sertraline");
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

  it("builds a print projection for every kind", () => {
    for (const sheet of factsheets) {
      const blocks = printBlocks(sheet);
      expect(blocks.length).toBeGreaterThan(0);
      // The sources block is always the final print block.
      expect(blocks.at(-1)?.kind).toBe("sources");
    }
  });

  it("prints the selected reading level for medicine-rich factsheets", () => {
    const sheet = factsheets.find((candidate) => candidate.kind === "medRich");
    if (!sheet || sheet.kind !== "medRich") throw new Error("Expected a medicine-rich factsheet fixture");

    const easyBlock = printBlocks(sheet, "easy").find((block) => block.heading === "What is this medicine?");
    const standardBlock = printBlocks(sheet, "standard").find((block) => block.heading === "What is this medicine?");

    expect(easyBlock).toMatchObject({ kind: "prose", body: sheet.whatEasy });
    expect(standardBlock).toMatchObject({ kind: "prose", body: sheet.whatStandard });
  });
});
