import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  commandDropdownCanDisplay,
  commandDropdownMinimumWidthMediaQuery,
  commandDropdownPointerMediaQuery,
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
    subtitle: "Statewide crisis support",
    location: "WA statewide",
    route: "Phone self referral",
    referral: "Call anytime",
    cost: "Free",
    primaryContact: { label: "Primary contact", kind: "phone", value: "13 11 14" },
    statusChips: [{ label: "Crisis" }],
    catchments: ["Metro"],
    ...overrides,
  };
}

describe("search command surface", () => {
  it("requires a desktop-sized non-touch or fine-pointer environment for the command dropdown", () => {
    expect(commandDropdownMinimumWidthMediaQuery("bottom-dock")).toBe("(min-width: 640px)");
    expect(commandDropdownMinimumWidthMediaQuery("inline")).toBe("(min-width: 1024px)");
    expect(commandDropdownPointerMediaQuery).toBe("(hover: hover) and (pointer: fine)");

    expect(commandDropdownCanDisplay({ minimumWidthMatches: true, pointerMatches: true, maxTouchPoints: 5 })).toBe(
      true,
    );
    expect(commandDropdownCanDisplay({ minimumWidthMatches: true, pointerMatches: false, maxTouchPoints: 0 })).toBe(
      true,
    );
    expect(commandDropdownCanDisplay({ minimumWidthMatches: true, pointerMatches: false, maxTouchPoints: 5 })).toBe(
      false,
    );
    expect(commandDropdownCanDisplay({ minimumWidthMatches: false, pointerMatches: true, maxTouchPoints: 0 })).toBe(
      false,
    );
  });

  it("returns mode-specific command surface config", () => {
    const documents = searchCommandSurfaceConfig("documents");
    expect(documents?.examples.length).toBeGreaterThan(0);
    expect(documents?.crossModes).toContain("prescribing");

    expect(searchCommandSurfaceConfig("tools")?.examples.length).toBeGreaterThan(0);
    expect(searchCommandSurfaceConfig("formulation")?.crossModes).toContain("differentials");

    const specifiers = searchCommandSurfaceConfig("specifiers");
    expect(specifiers?.examples.length).toBeGreaterThan(0);
    expect(specifiers?.suggestions.length).toBeGreaterThan(0);
    expect(specifiers?.crossModes).toContain("formulation");
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
      subtitle: "High risk pathway-linked form",
      statusChips: [{ label: "High risk" }],
    });
    expect(recordMatchesCommandScopes(formRecord, ["highrisk", "official"], "forms")).toBe(true);
    expect(recordMatchesCommandScopes(formRecord, ["pathway"], "forms")).toBe(true);
  });

  it("matches favourite and medication scope chips", () => {
    expect(
      favouriteMatchesCommandScopes({ pinned: true, evidence: "Guideline excerpt", lastUsed: "Today" }, [
        "pinned",
        "source",
        "recent",
      ]),
    ).toBe(true);
    expect(
      favouriteMatchesCommandScopes({ pinned: false, evidence: "Run", lastUsed: "Last week" }, ["pinned", "source"]),
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

  it("keeps one sm max-height cap per command dropdown placement", () => {
    const source = readFileSync(
      new URL("../src/components/clinical-dashboard/universal-search-command-surface.tsx", import.meta.url),
      "utf8",
    );

    expect(source).not.toContain("sm:max-h-[min(55dvh,26rem)]");
    expect(source).toContain('opensUpward ? "sm:max-h-[min(38dvh,20rem)]" : "sm:max-h-[min(42dvh,24rem)]"');
  });
});
