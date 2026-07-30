#!/usr/bin/env node
/**
 * Keep the exact repository inventory in docs/scripts-index.md synchronized.
 *
 * The scripts index is intentionally curated rather than exhaustive, but its
 * headline counts are generated facts. Write mode refreshes those counts;
 * --check fails when they drift so verify:cheap and CI catch missed updates.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptsIndexPath = path.join(repoRoot, "docs", "scripts-index.md");
const packageJsonPath = path.join(repoRoot, "package.json");

const inventoryPattern =
  /Curated map of `scripts\/` \((?:~)?\d+ files\) and the `package\.json` script surface \((?:~)?\d+ entries\),/;

export function renderScriptsInventorySummary(scriptFileCount, npmScriptCount) {
  return `Curated map of \`scripts/\` (${scriptFileCount} files) and the \`package.json\` script surface (${npmScriptCount} entries),`;
}

export function updateScriptsInventoryText(markdown, scriptFileCount, npmScriptCount) {
  if (!inventoryPattern.test(markdown)) {
    throw new Error("docs/scripts-index.md is missing its generated repository inventory summary");
  }
  return markdown.replace(inventoryPattern, renderScriptsInventorySummary(scriptFileCount, npmScriptCount));
}

export function countTrackedScriptFiles(nullDelimitedPaths) {
  return nullDelimitedPaths.split("\0").filter((filePath) => filePath.startsWith("scripts/")).length;
}

export function collectRepositoryInventory() {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const trackedScripts = execFileSync("git", ["ls-files", "-z", "--", "scripts"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return {
    scriptFileCount: countTrackedScriptFiles(trackedScripts),
    npmScriptCount: Object.keys(packageJson.scripts ?? {}).length,
  };
}

function main() {
  const current = readFileSync(scriptsIndexPath, "utf8");
  const { scriptFileCount, npmScriptCount } = collectRepositoryInventory();
  const expected = updateScriptsInventoryText(current, scriptFileCount, npmScriptCount);
  const check = process.argv.includes("--check");

  if (current === expected) {
    console.log(`Docs inventory current: ${scriptFileCount} script files, ${npmScriptCount} npm scripts.`);
    return;
  }

  if (check) {
    console.error(
      `docs/scripts-index.md inventory is stale. Run \`npm run docs:update\` ` +
        `(expected ${scriptFileCount} script files and ${npmScriptCount} npm scripts).`,
    );
    process.exitCode = 1;
    return;
  }

  writeFileSync(scriptsIndexPath, expected, "utf8");
  console.log(
    `Updated docs/scripts-index.md inventory: ${scriptFileCount} script files, ${npmScriptCount} npm scripts.`,
  );
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
