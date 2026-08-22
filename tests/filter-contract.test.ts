import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("filter contract structural verification", () => {
  it("exports ResultFilterSheet from src/components/search/ResultFilterSheet.tsx", () => {
    const filterExport = source("src/components/search/ResultFilterSheet.tsx");
    expect(filterExport).toContain("ResultFilterSheet");
    expect(filterExport).toContain("ResultFilterTrigger");
    expect(filterExport).toContain("ResultFilterFacetChips");
  });

  it("implements density tier detection in result-filter-control.tsx", () => {
    const control = source("src/components/clinical-dashboard/result-filter-control.tsx");
    expect(control).toContain("isDenseList");
    expect(control).toContain("group.options.length >= 6");
    expect(control).toContain("group.options.length <= 20");
    expect(control).toContain("min-h-tap");
  });

  it("documents density tiers in docs/filter-contract.md", () => {
    const doc = source("docs/filter-contract.md");
    expect(doc).toContain("6–20 options");
    expect(doc).toContain("dense full-width vertical list");
    expect(doc).toContain("≤ 5 options");
  });
});
