import { describe, expect, it } from "vitest";

import {
  differentialRedFlagTerms,
  favouriteMatchesCommandScopes,
  filteredSuggestions,
  isFormCodeQuery,
  medicationMatchesCommandScopes,
  recordMatchesCommandScopes,
  searchCommandSurfaceConfig,
} from "@/lib/search-command-surface";
import type { ServiceRecord } from "@/lib/services";

function serviceRecord(overrides: Partial<ServiceRecord> = {}): ServiceRecord {
  return {
    slug: "crisis-line",
    title: "Crisis phone line",
    summary: "Statewide crisis support",
    location: "WA statewide",
    route: "Phone self referral",
    referral: "Call anytime",
    cost: "Free",
    primaryContact: { kind: "phone", value: "13 11 14" },
    statusChips: [{ label: "Crisis" }],
    catchments: ["Metro"],
    ...overrides,
  };
}

describe("search command surface", () => {
  it("returns mode-specific command surface config", () => {
    const documents = searchCommandSurfaceConfig("documents");
    expect(documents?.examples.length).toBeGreaterThan(0);
    expect(documents?.crossModes).toContain("prescribing");

    expect(searchCommandSurfaceConfig("tools")).toBeNull();
  });

  it("detects form code queries", () => {
    expect(isFormCodeQuery("form 3A")).toBe(true);
    expect(isFormCodeQuery("form 12")).toBe(true);
    expect(isFormCodeQuery("transport order")).toBe(false);
  });

  it("filters suggestions by query tokens", () => {
    const config = searchCommandSurfaceConfig("documents");
    expect(config).not.toBeNull();
    if (!config) return;

    expect(filteredSuggestions(config, "")).toEqual([]);
    expect(filteredSuggestions(config, "clozapine monitoring").map((entry) => entry.text)).toContain(
      "clozapine monitoring table",
    );
    expect(filteredSuggestions(config, "missing topic")).toEqual([]);
  });

  it("matches service and form scopes against records", () => {
    const crisisRecord = serviceRecord();
    expect(recordMatchesCommandScopes(crisisRecord, ["crisis"], "services")).toBe(true);
    expect(recordMatchesCommandScopes(crisisRecord, ["atsi"], "services")).toBe(false);
    expect(recordMatchesCommandScopes(crisisRecord, [], "services")).toBe(true);

    const formRecord = serviceRecord({
      title: "Official transport order template",
      summary: "High risk pathway-linked form",
      statusChips: [{ label: "High risk" }],
    });
    expect(recordMatchesCommandScopes(formRecord, ["highrisk", "official"], "forms")).toBe(true);
    expect(recordMatchesCommandScopes(formRecord, ["pathway"], "forms")).toBe(true);
  });

  it("matches favourite and medication scope chips", () => {
    expect(
      favouriteMatchesCommandScopes(
        { pinned: true, evidence: "Guideline excerpt", lastUsed: "Today" },
        ["pinned", "source", "recent"],
      ),
    ).toBe(true);
    expect(
      favouriteMatchesCommandScopes(
        { pinned: false, evidence: "Run", lastUsed: "Last week" },
        ["pinned", "source"],
      ),
    ).toBe(false);

    expect(
      medicationMatchesCommandScopes(
        {
          indication: "Alcohol abstinence maintenance",
          match: "Acamprosate",
          dose: "666 mg TDS",
          ceiling: "1,998 mg/day",
          action: "Check renal function before start",
        },
        ["indication", "renal", "monitor"],
      ),
    ).toBe(true);
    expect(
      medicationMatchesCommandScopes(
        {
          indication: "Alcohol abstinence maintenance",
          match: "Acamprosate",
          dose: "666 mg TDS",
          ceiling: "1,998 mg/day",
          action: "Titrate to response",
        },
        ["safety"],
      ),
    ).toBe(false);
  });

  it("exposes differential red-flag search terms", () => {
    expect(differentialRedFlagTerms).toContain("confusion");
    expect(differentialRedFlagTerms.length).toBeGreaterThan(3);
  });
});
