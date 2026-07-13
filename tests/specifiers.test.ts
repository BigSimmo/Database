import { describe, expect, it } from "vitest";

import { findSpecifier, searchSpecifiers, specifierRecords } from "@/lib/specifiers";

describe("psychiatric specifier catalogue", () => {
  it("keeps slugs unique and related links valid", () => {
    const slugs = specifierRecords.map((record) => record.slug);
    expect(new Set(slugs).size).toBe(slugs.length);

    for (const record of specifierRecords) {
      expect(record.name).toBeTruthy();
      expect(record.summary).toBeTruthy();
      expect(record.fit.length).toBeGreaterThanOrEqual(2);
      expect(record.notFit.length).toBeGreaterThanOrEqual(2);
      expect(record.wording).toBeTruthy();
      for (const relatedSlug of record.relatedSlugs) {
        expect(findSpecifier(relatedSlug)).toBeTruthy();
      }
    }
  });

  it("matches natural clinical language to the deciding specifier", () => {
    expect(searchSpecifiers("depressed but racing thoughts and barely sleeping")[0]?.record.slug).toBe(
      "with-mixed-features",
    );
    expect(searchSpecifiers("depression returns every winter and lifts in spring")[0]?.record.slug).toBe(
      "with-seasonal-pattern",
    );
    expect(searchSpecifiers("stopped speaking and holds the same posture")[0]?.record.slug).toBe("with-catatonia");
    expect(searchSpecifiers("much better but not fully recovered")[0]?.record.slug).toBe("in-partial-remission");
  });

  it("filters by diagnostic role and diagnosis context", () => {
    const courseResults = searchSpecifiers("", { family: "course-onset" });
    expect(courseResults.length).toBeGreaterThan(0);
    expect(courseResults.every(({ record }) => record.family === "course-onset")).toBe(true);

    const psychoticResults = searchSpecifiers("", { diagnosis: "psychotic" });
    expect(psychoticResults.map(({ record }) => record.slug)).toContain("with-catatonia");
  });

  it("does not expose provenance columns in the specifier search records", () => {
    for (const record of specifierRecords) {
      expect(Object.hasOwn(record, "source")).toBe(false);
      expect(Object.hasOwn(record, "sourceStatus")).toBe(false);
    }
  });
});
