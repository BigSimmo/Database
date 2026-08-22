import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) => readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("Clinical Ask provider placement", () => {
  it("wraps the dashboard content that consumes the Clinical Ask session", () => {
    const dashboard = source("src/components/ClinicalDashboard.tsx");
    expect(dashboard).toMatch(
      /export function ClinicalDashboard[\s\S]*?<ClinicalAskSessionProvider>[\s\S]*?<ClinicalDashboardContent \{\.\.\.props\} \/>[\s\S]*?<\/ClinicalAskSessionProvider>/,
    );
    expect(dashboard).toMatch(
      /function ClinicalDashboardContent[\s\S]*?useClinicalAskShellState\(auth\.session\?\.user\.id\)/,
    );
  });

  it("forwards Clinical Ask follow-ups into the dashboard-owned composer draft", () => {
    const dashboard = source("src/components/ClinicalDashboard.tsx");
    expect(dashboard).toContain("<ClinicalAskWorkspace onDraftChange={stageClinicalAskFollowUpDraft} />");
    expect(dashboard).toMatch(
      /function stageClinicalAskFollowUpDraft\(draft: string\) \{\s*setQuery\(draft\);\s*focusComposerInput\(\);/,
    );
  });
});
