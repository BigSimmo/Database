import { readFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import { appModeIds } from "@/lib/app-modes";
import { sharedHomePresentation } from "@/lib/ui-copy";

/**
 * The caveat line under the composer — `ModeHomeVerificationFooter` — was removed
 * from every mode home. This file is the contract that keeps it removed.
 *
 * It exists because the first attempt at that guard asserted the absence of a few
 * hand-picked strings ("Source catalogue reviewed", …) in two files. A different
 * footer component, or the same idea with reworded copy, would have walked
 * straight past it. These checks are structural instead: they pin the number and
 * location of call sites, and the shape of the copy table, so reintroducing the
 * line anywhere on a home has to fail here rather than depending on which words
 * someone chose.
 */

const REPO_ROOT = process.cwd();
const FOOTER = "ModeHomeVerificationFooter";

/** Every surface that renders a mode's home. */
const MODE_HOME_SOURCES = [
  // The shared home at `/`, which is the only home most modes have.
  "src/components/clinical-dashboard/answer-status.tsx",
  // Standalone mode homes.
  "src/components/calculators/home-page.tsx",
  "src/components/dictionary/dictionary-home-page.tsx",
  "src/components/differentials/differentials-home-page.tsx",
  "src/components/dsm/dsm-home-page.tsx",
  "src/components/factsheets/factsheets-home-page.tsx",
  "src/components/forms/forms-home-page.tsx",
  "src/components/formulation/formulation-home-page.tsx",
  "src/components/services/services-home-page.tsx",
  "src/components/specifiers/specifiers-home-page.tsx",
  "src/components/clinical-dashboard/differentials-home.tsx",
  "src/components/clinical-dashboard/medication-prescribing-workspace.tsx",
  "src/components/therapy-compass/screens/home-screen.tsx",
] as const;

/**
 * The one legitimate survivor: Therapy's page-bottom footer, which sits below a
 * divider at the end of its sub-routes. `workspace.tsx` renders it with
 * `showFooter={!isHome}`, so it is not a home-page element.
 */
const THERAPY_PAGE_FOOTER = "src/components/therapy-compass/workspace.tsx";

function sourceFiles(dir: string, collected: string[] = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      sourceFiles(full, collected);
      continue;
    }
    if (/\.(?:ts|tsx)$/.test(entry)) collected.push(full);
  }
  return collected;
}

describe("mode homes carry no caveat footer", () => {
  it.each(MODE_HOME_SOURCES)("%s neither imports nor renders the footer", (path) => {
    const source = readFileSync(join(REPO_ROOT, path), "utf8");
    expect(source).not.toContain(FOOTER);
  });

  it("keeps exactly one call site repo-wide, and it is not a home", () => {
    // Pinning the count is what catches a *second* footer appearing somewhere
    // this file does not enumerate — a new mode home, or a shared component that
    // every home happens to render.
    const callSites = sourceFiles(join(REPO_ROOT, "src"))
      .filter((file) => readFileSync(file, "utf8").includes(FOOTER))
      .map((file) => relative(REPO_ROOT, file).split("\\").join("/"))
      .filter((file) => file !== "src/components/mode-home-template.tsx")
      .sort();

    expect(callSites).toEqual([THERAPY_PAGE_FOOTER]);

    // …and that survivor stays gated off the Therapy home.
    const workspace = readFileSync(join(REPO_ROOT, THERAPY_PAGE_FOOTER), "utf8");
    expect(workspace).toContain("showFooter={!isHome}");
  });

  it("leaves no caveat copy in the shared-home presentation table", () => {
    // The copy route into the same defect: a mode could carry the line as data
    // rather than as a component. The table now also carries starter
    // suggestions, but it must not grow any caveat/footer field.
    for (const modeId of appModeIds) {
      expect(Object.keys(sharedHomePresentation[modeId]).sort(), modeId).toEqual(["subtitle", "suggestions", "title"]);
    }
  });
});
