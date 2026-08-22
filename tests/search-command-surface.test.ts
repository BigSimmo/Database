import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { appModeIds } from "@/lib/app-modes";
import {
  commandDropdownCanDisplay,
  commandDropdownMinimumWidthMediaQuery,
  commandDropdownPointerMediaQuery,
  commandSurfaceRemoteSearchEnabled,
  differentialRedFlagTerms,
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

  it("covers every app mode, so no mode silently loses the command surface", () => {
    // `UniversalSearchCommandSurface` early-returns on a null config, which takes
    // the phone "Try this" ticker, the sm+ rotating hint, the prompt-chip row and
    // the whole command dropdown with it. therapy-compass shipped in exactly that
    // state — the single uncovered mode — so pin the whole set rather than the
    // one mode that happened to be missing.
    for (const modeId of appModeIds) {
      const config = searchCommandSurfaceConfig(modeId);
      expect(config, `${modeId} has no search command surface config`).not.toBeNull();
      expect(config?.examples.length, `${modeId} has no examples`).toBeGreaterThan(0);
      expect(config?.suggestions.length, `${modeId} has no suggestions`).toBeGreaterThan(0);
    }
  });

  it("keeps therapy suggestions local to the generated catalogue", () => {
    const therapy = searchCommandSurfaceConfig("therapy-compass");
    expect(therapy?.examples).toContain("trauma-focused CBT");
    expect(therapy?.crossModes).toContain("documents");
    // Therapy reads public/therapy-compass-data, not the remote index.
    expect(therapy?.remoteSearchEnabled).toBe(false);
  });

  it("keeps calculator suggestions local while preserving remote typeahead elsewhere", () => {
    expect(commandSurfaceRemoteSearchEnabled("calculators")).toBe(false);
    expect(commandSurfaceRemoteSearchEnabled("documents")).toBe(true);
    expect(commandSurfaceRemoteSearchEnabled("therapy-compass")).toBe(false);
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

  it("does not let a stale narrow-window focus decision shadow later displayability", () => {
    const source = readFileSync(
      new URL("../src/components/clinical-dashboard/universal-search-command-surface.tsx", import.meta.url),
      "utf8",
    );

    expect(source).not.toContain("setEagerDropdownDisplayable(displayable);");
    expect(source).toContain("setEagerDropdownDisplayable(displayable ? true : null);");
  });
});
