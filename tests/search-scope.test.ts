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

  it("accepts label-type-any filters used by mode-default scopes", () => {
    const filters = searchScopeFiltersSchema.parse({ labelTypesAny: ["service"] });

    expect(filters.labelTypesAny).toEqual(["service"]);
    expect(activeScopeFilterCount(filters)).toBe(1);
  });

  it("rejects unknown label types in labelTypesAny", () => {
    expect(() => searchScopeFiltersSchema.parse({ labelTypesAny: ["not-a-label-type"] })).toThrow();
  });
});
