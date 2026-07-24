import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("production and mockup boundaries", () => {
  it("keeps production Documents routes free of fixture imports", () => {
    for (const file of ["search/page.tsx", "source/page.tsx", "source/evidence/page.tsx"]) {
      const source = readFileSync(resolve(process.cwd(), "src/app/(search-app)/documents", file), "utf8");
      expect(source).not.toContain("master-document-flow-mockups");
    }
  });
  it("keeps the production shell implementation under its production name", () => {
    const production = readFileSync(
      resolve(process.cwd(), "src/components/clinical-dashboard/global-search-shell.tsx"),
      "utf8",
    );
    const compatibility = readFileSync(
      resolve(process.cwd(), "src/components/clinical-dashboard/global-mockup-search-shell.tsx"),
      "utf8",
    );
    expect(production).toContain("export function GlobalSearchShell");
    expect(compatibility).toContain("GlobalSearchShell as GlobalMockupSearchShell");
  });
  it("keeps routed differential filters and filtered tool preview wiring", () => {
    const differentials = readFileSync(
      resolve(process.cwd(), "src/components/differentials/differentials-home-page.tsx"),
      "utf8",
    );
    const tools = readFileSync(
      resolve(process.cwd(), "src/components/tools-page-mockups/tools-page-mockup-page.tsx"),
      "utf8",
    );
    expect(differentials).toContain("onSuggestedSearch={navigateToSearch}");
    expect(tools).toContain("selected={selectedToolId === tool.id}");
    expect(tools).toContain("onSelect={() => setSelectedToolId(tool.id)}");
  });
});
