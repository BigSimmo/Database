/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { clinicalAskComposerChromeEnabled } from "@/components/clinical-dashboard/use-clinical-ask-shell-state";
import { clinicalAskModeIds } from "@/lib/clinical-ask/contracts";

const source = (relativePath: string) => readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("clinicalAskComposerChromeEnabled", () => {
  it("keeps every supported Clinical Ask mode actionable, including Therapy", () => {
    expect(clinicalAskComposerChromeEnabled("therapy-compass")).toBe(true);
    expect(clinicalAskComposerChromeEnabled("answer")).toBe(false);
    expect(clinicalAskComposerChromeEnabled(null)).toBe(false);
    for (const mode of clinicalAskModeIds) {
      expect(clinicalAskComposerChromeEnabled(mode)).toBe(true);
    }
  });

  it("gates both composer owners on the shared helper", () => {
    const shell = source("src/components/clinical-dashboard/global-search-shell.tsx");
    const dashboard = source("src/components/ClinicalDashboard.tsx");
    expect(shell).toContain("clinicalAskComposerChromeEnabled(clinicalAskMode)");
    expect(dashboard).toContain("clinicalAskComposerChromeEnabled(clinicalAskMode)");
    expect(shell).toMatch(/const showClinicalAskDockChrome =\s*clinicalAskComposerChromeEnabled\(clinicalAskMode\) &&/);
    expect(dashboard).toMatch(
      /const showClinicalAskDockChrome =\s*clinicalAskComposerChromeEnabled\(clinicalAskMode\) &&/,
    );
    expect(dashboard).toContain("clinicalAskActionsVisible: showClinicalAskDockChrome");
  });
});
