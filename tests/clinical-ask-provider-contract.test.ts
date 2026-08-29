import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) => readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("Clinical Ask provider placement", () => {
  it("wraps the dashboard content that consumes the Clinical Ask session", () => {
    const dashboard = source("src/components/ClinicalDashboard.tsx");
    expect(dashboard).toMatch(
      /function ClinicalAskSessionBoundary[\s\S]*?accountId=\{auth\.session\?\.user\.id\}[\s\S]*?<\/ClinicalAskSessionProvider>/,
    );
    expect(dashboard).toMatch(
      /export function ClinicalDashboard[\s\S]*?<ClinicalAskSessionBoundary>[\s\S]*?<ClinicalDashboardContent \{\.\.\.props\} \/>[\s\S]*?<\/ClinicalAskSessionBoundary>/,
    );
    expect(dashboard).toMatch(/function ClinicalDashboardContent[\s\S]*?useClinicalAskDashboardChrome\(\{/);
  });

  it("forwards Clinical Ask follow-ups into the dashboard-owned composer draft", () => {
    const dashboard = source("src/components/ClinicalDashboard.tsx");
    expect(dashboard).toMatch(
      /<ClinicalAskWorkspace[\s\S]*?onDraftChange=\{stageAnswerFollowUpDraft\}[\s\S]*?onRun=\{runModeClinicalAsk\}/,
    );
    expect(dashboard).toMatch(
      /function stageAnswerFollowUpDraft\(draft: string\) \{\s*setQuery\(draft\);\s*focusComposerInput\(\);/,
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
