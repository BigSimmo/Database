import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) => readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("Clinical Ask provider placement", () => {
  it("wraps the dashboard content that consumes the Clinical Ask session", () => {
    const dashboard = source("src/components/ClinicalDashboard.tsx");
    const boundary = source("src/components/clinical-dashboard/clinical-ask-dashboard-boundary.tsx");
    expect(boundary).toMatch(
      /function ClinicalAskDashboardBoundary[\s\S]*?accountId=\{auth\.session\?\.user\.id\}[\s\S]*?<\/ClinicalAskSessionProvider>/,
    );
    expect(dashboard).toMatch(
      /export function ClinicalDashboard[\s\S]*?<ClinicalAskDashboardBoundary>[\s\S]*?<ClinicalDashboardContent \{\.\.\.props\} \/>[\s\S]*?<\/ClinicalAskDashboardBoundary>/,
    );
    expect(dashboard).toMatch(/function ClinicalDashboardContent[\s\S]*?useClinicalAskDashboardChrome\(\{/);
  });

  it("forwards Clinical Ask follow-ups into the dashboard-owned composer draft", () => {
    const dashboard = source("src/components/ClinicalDashboard.tsx");
    const surface = source("src/components/clinical-dashboard/mode-clinical-ask-surface.tsx");
    expect(dashboard).toMatch(
      /<ModeClinicalAskSurface[\s\S]*?setDraft=\{setQuery\}[\s\S]*?focusSearch=\{focusComposerInput\}[\s\S]*?onRun=\{runModeClinicalAsk\}/,
    );
    expect(surface).toMatch(
      /<ClinicalAskWorkspace[\s\S]*?onDraftChange=\{\(draft\) => \{\s*setDraft\(draft\);\s*focusSearch\(\);/,
    );
  });

  it("does not reserve empty-home Clinical Ask slots with loading skeletons", () => {
    const lazy = source("src/components/clinical-dashboard/clinical-dashboard-lazy.tsx");
    const workspace = lazy.slice(lazy.indexOf("export const ClinicalAskWorkspace"));
    expect(workspace).toContain("loading: () => null");
    expect(workspace).not.toContain("LoadingPanel");
  });

  it("keeps the workspace lazy without exporting the retired composer action rail", () => {
    const lazy = source("src/components/clinical-dashboard/clinical-dashboard-lazy.tsx");
    expect(lazy).not.toContain("ClinicalAskComposerActions");
    expect(lazy).not.toContain("clinical-ask-composer-actions");
  });
});
