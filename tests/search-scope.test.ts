import { describe, expect, it } from "vitest";
import { activeScopeFilterCount, searchScopeFiltersSchema } from "@/lib/search-scope";

describe("search scope filters", () => {
  it("accepts smart document label filter groups", () => {
    const filters = searchScopeFiltersSchema.parse({
      services: ["mental-health"],
      settings: ["inpatient"],
      populations: ["youth"],
      risks: ["high-risk-medication"],
      clinicalActions: ["monitor"],
      carePhases: ["discharge-planning"],
      documentIntents: ["medication-instruction"],
      contentFeatures: ["contains-monitoring-schedule"],
    });

    expect(filters).toMatchObject({
      services: ["mental-health"],
      settings: ["inpatient"],
      populations: ["youth"],
      risks: ["high-risk-medication"],
      clinicalActions: ["monitor"],
      carePhases: ["discharge-planning"],
      documentIntents: ["medication-instruction"],
      contentFeatures: ["contains-monitoring-schedule"],
    });
    expect(activeScopeFilterCount(filters)).toBe(8);
  });
});
