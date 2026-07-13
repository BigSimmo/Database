#!/usr/bin/env node
/**
 * check-codebase-index-coverage — flag top-level modules/routes that exist but are
 * NOT mentioned in docs/codebase-index.md.
 *
 * codebase-index.md is the orientation map agents read first; docs:check-links
 * already verifies the paths it names EXIST, but nothing catches the reverse — a
 * new src/lib module or app route that never gets added to the map, silently
 * staling it. This checks that each top-level directory the index organizes around
 * is referenced somewhere in it.
 *
 * Granularity is deliberately top-level directories (route groups + src/lib module
 * dirs), not every file — the index maps modules by theme, so per-file coverage
 * would be pure noise.
 *
 * Advisory: run `npm run docs:check-index`. Not in CI (kept alongside the other
 * docs:* advisory checks). Exit 1 on gaps.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INDEX_PATH = "docs/codebase-index.md";

// Directories intentionally not indexed at the top level.
const ALLOWLIST = new Set([
  "src/app/icons", // dynamic icon/OG routes, covered by the brand/PWA note, not a product page
]);

function dirsIn(relativeDir) {
  try {
    return readdirSync(path.join(repoRoot, relativeDir), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * A directory counts as "indexed" when its base name appears anywhere in the index
 * (case-insensitive). The index deliberately uses abbreviated forms — `validation/`,
 * `extractors/document.ts`, grouped route tables — so matching the bare name (rather
 * than a full `src/lib/x` path) is what actually catches a WHOLLY missing module
 * without drowning in format false-positives.
 */
export function coverageCandidates(kind, name) {
  return [name];
}

/** Pure: given the index text and the discovered groups, return the uncovered entries. */
export function coverageGaps(indexText, groups, allowlist = ALLOWLIST) {
  const haystack = indexText.toLowerCase();
  const gaps = [];
  for (const { kind, dir, name } of groups) {
    const full = `${dir}/${name}`;
    if (allowlist.has(full)) continue;
    if (!haystack.includes(name.toLowerCase())) gaps.push({ full, kind, tried: [name] });
  }
  return gaps;
}

function discoverGroups() {
  const groups = [];
  for (const name of dirsIn("src/lib")) groups.push({ kind: "lib", dir: "src/lib", name });
  for (const name of dirsIn("src/app")) {
    if (name === "api") continue;
    groups.push({ kind: "route", dir: "src/app", name });
  }
  for (const name of dirsIn("src/app/api")) groups.push({ kind: "api", dir: "src/app/api", name });
  return groups;
}

function main() {
  const indexText = readFileSync(path.join(repoRoot, INDEX_PATH), "utf8");
  const groups = discoverGroups();
  const gaps = coverageGaps(indexText, groups);

  if (gaps.length > 0) {
    console.error(`\n${INDEX_PATH} is missing ${gaps.length} top-level module(s)/route(s):`);
    for (const g of gaps) console.error(`  UNINDEXED ${g.full} (${g.kind}) — add it or allowlist it`);
    console.error(`\nUpdate ${INDEX_PATH} so the agent-orientation map stays current.`);
    process.exit(1);
  }
  console.log(`${INDEX_PATH} coverage OK: all ${groups.length} top-level modules/routes are indexed.`);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
