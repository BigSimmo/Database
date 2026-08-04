import { describe, expect, it } from "vitest";

import {
  commandDropdownCanDisplay,
  commandDropdownMinimumWidthMediaQuery,
  commandDropdownPointerMediaQuery,
  filteredSuggestions,
  isFormCodeQuery,
  searchCommandSurfaceConfig,
} from "@/lib/search-command-surface";

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
});
