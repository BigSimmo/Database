import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { appModeIds, type AppModeId } from "../src/lib/app-modes";

/**
 * Every mode's submitted-search surface carries the cross-mode panel.
 *
 * This exists because the mount is the part that goes missing. The panel is a
 * single component threaded through seventeen independently owned result
 * surfaces, so a mode gains one by someone remembering to add a line — and a
 * merge resolution has already silently dropped one before (the Forms mount,
 * recorded in the merge-loss audit for #1804). Nothing failed when it went: the
 * component still compiled, its own tests still passed, and Forms simply stopped
 * offering the reader anywhere else to look.
 *
 * The map below is the register. A mode either names the file that mounts the
 * panel, or names the surface that answers the same question differently and
 * says why. There is no third state.
 */
const MOUNTS: Record<AppModeId, { file: string; mounts: true } | { file: string; mounts: false; because: string }> = {
  answer: {
    file: "src/components/clinical-dashboard/answer-result-surface.tsx",
    mounts: false,
    because:
      "Answer carries its cross-mode links on the answer surface's own library line (CrossModeLinksSection). " +
      "Both rendered for a while, one directly under the other, asking the same question — the duplication " +
      "the owner photographed on 2026-08-26. tests/ui-universal-search.spec.ts pins the panel OUT of Answer.",
  },
  documents: { file: "src/components/ClinicalDashboard.tsx", mounts: true },
  services: { file: "src/components/services/services-navigator-page.tsx", mounts: true },
  forms: { file: "src/components/forms/forms-search-results-page.tsx", mounts: true },
  favourites: { file: "src/components/clinical-dashboard/favourites-command-library-page.tsx", mounts: true },
  differentials: { file: "src/components/clinical-dashboard/differentials-home.tsx", mounts: true },
  dsm: { file: "src/components/dsm/dsm-search-page.tsx", mounts: true },
  specifiers: { file: "src/components/specifiers/specifiers-home-page.tsx", mounts: true },
  formulation: { file: "src/components/formulation/formulation-home-page.tsx", mounts: true },
  prescribing: { file: "src/components/clinical-dashboard/medication-prescribing-workspace.tsx", mounts: true },
  tools: { file: "src/components/tools/tools-search-results-page.tsx", mounts: true },
  calculators: { file: "src/components/calculators/search-page.tsx", mounts: true },
  "therapy-compass": { file: "src/components/therapy-compass/screens/search-screen.tsx", mounts: true },
  factsheets: { file: "src/components/factsheets/factsheets-search-page.tsx", mounts: true },
  dictionary: { file: "src/components/dictionary/dictionary-catalogue-pages.tsx", mounts: true },
  sources: { file: "src/components/sources/sources-catalogue-client.tsx", mounts: true },
  "on-call": { file: "src/components/on-call/on-call-search-page.tsx", mounts: true },
};

function read(file: string) {
  return readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
}

describe("cross-mode also-matches coverage", () => {
  it("registers every app mode", () => {
    expect(Object.keys(MOUNTS).sort()).toEqual([...appModeIds].sort());
  });

  for (const modeId of appModeIds) {
    const entry = MOUNTS[modeId];

    if (entry.mounts) {
      it(`mounts the cross-mode panel on ${modeId}`, () => {
        const source = read(entry.file);
        expect(source, `${entry.file} must import UniversalSearchAlsoMatches`).toContain(
          'from "@/components/clinical-dashboard/universal-search-also-matches"',
        );
        expect(source, `${entry.file} must render <UniversalSearchAlsoMatches modeId="${modeId}" …>`).toMatch(
          new RegExp(`<UniversalSearchAlsoMatches[\\s\\S]{0,200}?modeId=(?:"${modeId}"|\\{searchMode\\})`),
        );
      });
      continue;
    }

    it(`records why ${modeId} answers cross-mode discovery elsewhere`, () => {
      expect(entry.because.length, "an exemption must carry its reason").toBeGreaterThan(80);
      expect(read(entry.file)).toContain("CrossModeLinksSection");
    });
  }

  it("lets exactly one owner mount the panel for a mode that borrows a result kind", () => {
    // `resultKind` is shared: prescribing declares "documents", and factsheets,
    // dictionary, sources and on-call all declare "tools". ClinicalDashboard gates
    // its own mount on the result KIND, so any mode whose results render inside the
    // dashboard AND whose own component mounts the panel gets two of them.
    // Prescribing is that mode — `/?mode=prescribing` renders
    // MedicationPrescribingWorkspace inside the dashboard — and it shipped two
    // panels until ui-stress caught the count at 2.
    const dashboard = read("src/components/ClinicalDashboard.tsx");
    const gate = dashboard.slice(
      dashboard.indexOf("const showUniversalAlsoMatches ="),
      dashboard.indexOf("const showDesktopHomeComposer ="),
    );
    expect(gate.length, "the also-matches visibility gate must be findable").toBeGreaterThan(0);
    expect(gate, "ClinicalDashboard must not mount a second panel for prescribing").toContain(
      'searchMode !== "prescribing"',
    );

    // The sibling tools-kind borrowers stay on the shared home rather than rendering
    // their results inside the dashboard, so they need no exclusion here. If one of
    // them ever gains an in-dashboard results branch, this list is where to notice.
    for (const modeId of ["factsheets", "dictionary", "sources", "on-call"] as const) {
      expect(gate, `${modeId} is not expected to need a dashboard exclusion yet`).not.toContain(
        `searchMode !== "${modeId}"`,
      );
    }
  });

  it("keeps the panel free of a per-mode suppression list", () => {
    // The panel suppressed itself for `prescribing` while it was mounted ABOVE
    // the medication results. The mount moved below them; the suppression is
    // gone with it. A mode that genuinely should not show cross-mode matches
    // belongs in MOUNTS above with a reason, not in a hidden early return.
    const panel = read("src/components/clinical-dashboard/universal-search-also-matches.tsx");
    expect(panel).not.toMatch(/modeId === "(?!answer)[a-z-]+"\s*\|\|\s*!submissionActive/);
  });
});
