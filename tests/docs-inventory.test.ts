import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  countTrackedScriptFiles,
  renderScriptsInventorySummary,
  updateScriptsInventoryText,
} from "../scripts/update-docs-inventory.mjs";

describe("scripts documentation inventory", () => {
  it("renders exact repository counts", () => {
    expect(renderScriptsInventorySummary(181, 195)).toBe(
      "Curated map of `scripts/` (181 files) and the `package.json` script surface (195 entries),",
    );
  });

  it("refreshes legacy approximate counts without changing curated prose", () => {
    const source = [
      "# Scripts index",
      "",
      "Curated map of `scripts/` (~135 files) and the `package.json` script surface (~166 entries),",
      "grouped by purpose.",
    ].join("\n");

    expect(updateScriptsInventoryText(source, 181, 195)).toBe(
      [
        "# Scripts index",
        "",
        "Curated map of `scripts/` (181 files) and the `package.json` script surface (195 entries),",
        "grouped by purpose.",
      ].join("\n"),
    );
  });

  it("fails closed when the generated summary marker is removed", () => {
    expect(() => updateScriptsInventoryText("# Scripts index\n", 181, 195)).toThrow(
      "missing its generated repository inventory summary",
    );
  });

  it("counts only null-delimited Git-tracked script paths", () => {
    expect(countTrackedScriptFiles("scripts/a.mjs\0scripts/nested/b.ts\0docs/scripts-index.md\0")).toBe(2);
  });

  it("wires safe automatic updates without auto-staging", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    const hook = readFileSync(".githooks/pre-commit", "utf8");
    const installer = readFileSync("scripts/install-git-hooks.mjs", "utf8");

    expect(packageJson.scripts["docs:update"]).toContain("sitemap:update");
    expect(packageJson.scripts["docs:check-inventory"]).toContain("--check");
    expect(hook).toContain("npm run sitemap:update");
    expect(hook).toContain("node scripts/update-docs-inventory.mjs");
    expect(hook).toContain("npm run docs:check-index");
    expect(hook).toContain("sync_sitemap=0");
    expect(hook).toContain("--diff-filter=ACMRD");
    expect(hook).toContain("git ls-files --others --exclude-standard");
    expect(hook).toContain("Documentation inputs have unstaged or untracked changes");
    expect(hook).toContain("Generated documentation has unstaged changes");
    expect(hook.indexOf("dirty_generated_docs=")).toBeLessThan(hook.indexOf("npm run sitemap:update"));
    expect(hook).not.toMatch(/\bgit\s+add\b/);
    expect(installer).toContain('["pre-commit", "pre-push"]');
  });
});
