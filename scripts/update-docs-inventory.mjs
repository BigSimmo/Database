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
const inventoryMatchPattern =
  /Curated map of `scripts\/` \((?:~)?(\d+) files\) and the `package\.json` script surface \((?:~)?(\d+) entries\),/;

export const INVENTORY_TOLERANCE = 5;

export function parseScriptsInventoryCounts(markdown) {
  const match = inventoryMatchPattern.exec(markdown);
  if (!match) return null;
  return {
    scriptFileCount: parseInt(match[1], 10),
    npmScriptCount: parseInt(match[2], 10),
  };
}

export function isInventoryWithinTolerance(currentCounts, expectedCounts, tolerance = INVENTORY_TOLERANCE) {
  if (!currentCounts || !expectedCounts) return false;
  const fileDiff = Math.abs(currentCounts.scriptFileCount - expectedCounts.scriptFileCount);
  const scriptDiff = Math.abs(currentCounts.npmScriptCount - expectedCounts.npmScriptCount);
  return fileDiff <= tolerance && scriptDiff <= tolerance;
}

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
  const currentCounts = parseScriptsInventoryCounts(current);
  const check = process.argv.includes("--check");
  const force = process.argv.includes("--force");
  const withinTolerance = isInventoryWithinTolerance(currentCounts, { scriptFileCount, npmScriptCount });

  if (
    currentCounts &&
    currentCounts.scriptFileCount === scriptFileCount &&
    currentCounts.npmScriptCount === npmScriptCount
  ) {
    console.log(`Docs inventory current: ${scriptFileCount} script files, ${npmScriptCount} npm scripts.`);
    return;
  }

  if (withinTolerance && !force) {
    if (check) {
      console.log(
        `Docs inventory within tolerance (current: ${currentCounts.scriptFileCount} files, ${currentCounts.npmScriptCount} scripts; expected: ${scriptFileCount} files, ${npmScriptCount} scripts).`,
      );
      return;
    }
    console.log(
      `Docs inventory preserved within tolerance (current: ${currentCounts.scriptFileCount} files, ${currentCounts.npmScriptCount} scripts; expected: ${scriptFileCount} files, ${npmScriptCount} scripts; pass --force to rewrite).`,
    );
    return;
  }

  if (check) {
    console.error(
      `docs/scripts-index.md inventory is stale. Run \`npm run docs:update\` ` +
        `(expected ${scriptFileCount} script files and ${npmScriptCount} npm scripts, current: ${currentCounts?.scriptFileCount ?? "unknown"} and ${currentCounts?.npmScriptCount ?? "unknown"}).`,
    );
    process.exitCode = 1;
    return;
  }

  const expected = updateScriptsInventoryText(current, scriptFileCount, npmScriptCount);
  writeFileSync(scriptsIndexPath, expected, "utf8");
  console.log(
    `Updated docs/scripts-index.md inventory: ${scriptFileCount} script files, ${npmScriptCount} npm scripts.`,
  );
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
