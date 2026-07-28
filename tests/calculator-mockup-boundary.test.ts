import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const searchMockups = ["search-detail-mockup.tsx", "search-page-mockup.tsx"];
const forbiddenProductionFeatures = [
  "@/components/calculators/",
  "@/components/clinical-dashboard/",
  "@/components/mode-home-template",
  "@/components/privacy-input-notice",
];

describe("calculator mockup import boundary", () => {
  it.each(searchMockups)("keeps %s independent from production feature modules", (file) => {
    const source = readFileSync(resolve(process.cwd(), "src/components/calculator-mockups", file), "utf8");

    for (const forbiddenImport of forbiddenProductionFeatures) {
      expect(source, `${file} imports ${forbiddenImport}`).not.toContain(forbiddenImport);
    }
  });
});
