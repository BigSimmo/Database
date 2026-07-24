#!/usr/bin/env node
/**
 * check-docs-links.mjs — verify that repo paths referenced in the maintained
 * documentation surface actually exist.
 *
 * Two kinds of references are checked:
 *  - Inline code spans (`docs/foo.md`, `src/bar.ts:12`) — treated as
 *    repo-root-relative paths when they start with a known top-level prefix.
 *  - Markdown link targets ([text](codebase-index.md), [text](../AGENTS.md))
 *    — resolved relative to the file containing the link and required to stay
 *    inside the repository.
 *
 * Scanned by default: README.md, AGENTS.md, and docs/**\/*.md excluding
 * docs/archive/, docs/audit/, and dated point-in-time filenames
 * (docs/README.md classifies those as historical records that intentionally
 * reference the repo as it was). Pass --all to scan those too
 * (informational deeper sweep; still fails on missing paths).
 *
 * Advisory tool: run `npm run docs:check-links` before doc handoffs. It is
 * deliberately NOT part of verify:cheap or CI so historical docs cannot
 * block unrelated PRs.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scanAll = process.argv.includes("--all");

const ROOT_PREFIXES = [
  "docs/",
  "src/",
  "scripts/",
  "supabase/",
  "worker/",
  "tests/",
  "public/",
  ".github/",
  ".cursor/",
];

// Paths that docs intentionally reference although they do not exist:
// designed-but-unbuilt drivers and hypothetical future splits.
const ALLOWLIST = new Set([
  "scripts/reindex-shadow.ts", // designed-only harness driver (docs/reindex-shadow-harness-design.md)
  "docs/site-map.generated.md", // hypothetical future split named in docs/process-hardening.md
  // Removed after the redesign; referenced historically in docs/redesign/*:
  "src/app/(search-app)/tools/page.tsx",
  "src/lib/tools.ts",
  "src/components/ServiceDetailPage.tsx",
]);

const DATED_DOC = /\b20\d{2}-\d{2}(-\d{2})?\b/;
// Historical directories: only scanned with --all.
const HISTORICAL_DIRS = new Set(["archive", "audit"]);

function collectDocs(dirRelative, targets) {
  const absolute = path.join(repoRoot, dirRelative);
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const entryRelative = path.posix.join(dirRelative, entry.name);
    if (entry.isDirectory()) {
      const isHistorical = HISTORICAL_DIRS.has(entry.name);
      if (isHistorical && !scanAll) continue;
      collectDocs(entryRelative, targets);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    if (!scanAll && DATED_DOC.test(entry.name)) continue;
    targets.push(entryRelative);
  }
}

function defaultTargets() {
  const targets = ["README.md", "AGENTS.md"];
  collectDocs("docs", targets);
  return targets;
}

function codeSpanCandidates(markdown) {
  const candidates = new Set();
  for (const match of markdown.matchAll(/`([^`\n]+)`/g)) {
    for (const rawPiece of match[1].split(/,\s*/)) {
      candidates.add(rawPiece.trim());
    }
  }
  return candidates;
}

function linkCandidates(markdown) {
  const candidates = new Set();
  for (const match of markdown.matchAll(/\]\(([^)\s]+)\)/g)) {
    candidates.add(match[1].trim());
  }
  return candidates;
}

function stripSuffixes(value) {
  let result = value;
  if (result.startsWith("./")) result = result.slice(2);
  // Drop #anchor fragments and :line / :line-line / :line:col suffixes.
  result = result.replace(/#[^#]*$/, "");
  result = result.replace(/:\d+([-:]\d+)?$/, "");
  return result;
}

function looksLikeRootPath(value) {
  if (!ROOT_PREFIXES.some((prefix) => value.startsWith(prefix))) return false;
  if (/[<>{}$\\]/.test(value)) return false; // templates/placeholders
  if (value.includes("*")) return false; // globs checked via their base dir below
  if (value.includes("...")) return false; // ellipsis placeholders like src/app/api/...
  if (/\s/.test(value)) return false;
  // Require a file extension or an explicit trailing slash so that
  // non-path tokens sharing a prefix (e.g. the `supabase/postgres` Docker
  // image) are not misread as repo paths. Extensionless directory mentions
  // are simply skipped, never failed.
  const lastSegment = value.replace(/\/$/, "").split("/").pop() ?? "";
  if (!value.endsWith("/") && !lastSegment.includes(".")) return false;
  return true;
}

function globBaseDir(value) {
  const starIndex = value.indexOf("*");
  if (starIndex === -1) return null;
  const base = value.slice(0, starIndex);
  const lastSlash = base.lastIndexOf("/");
  return lastSlash === -1 ? null : base.slice(0, lastSlash);
}

function isExternalLink(value) {
  return /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(value) || value.startsWith("#");
}

let missing = 0;
let checked = 0;

for (const target of defaultTargets()) {
  const absoluteTarget = path.join(repoRoot, target);
  if (!existsSync(absoluteTarget)) continue;
  const markdown = readFileSync(absoluteTarget, "utf8");
  const targetDir = path.posix.dirname(target);
  const failures = [];

  const check = (repoRelative, label) => {
    if (ALLOWLIST.has(repoRelative)) return;
    checked += 1;
    const cleaned = repoRelative.replace(/\/$/, "");
    if (!existsSync(path.join(repoRoot, cleaned))) failures.push(label);
  };

  // Inline code spans: repo-root-relative repo paths.
  for (const rawCandidate of codeSpanCandidates(markdown)) {
    const value = stripSuffixes(rawCandidate);
    const base = ROOT_PREFIXES.some((prefix) => value.startsWith(prefix)) ? globBaseDir(value) : null;
    if (base !== null) {
      if (ALLOWLIST.has(value)) continue;
      checked += 1;
      if (!existsSync(path.join(repoRoot, base))) failures.push(`${value} (glob base '${base}' missing)`);
      continue;
    }
    if (!looksLikeRootPath(value)) continue;
    check(value, value);
  }

  // Markdown link targets: repo docs use both repo-root-relative targets
  // (`src/lib/env.ts`) and file-relative targets (`codebase-index.md`,
  // `../AGENTS.md`). Accept whichever resolves, confined to the repository.
  for (const rawCandidate of linkCandidates(markdown)) {
    if (isExternalLink(rawCandidate)) continue;
    const value = stripSuffixes(rawCandidate);
    if (value === "" || value.includes("*") || /[<>{}$\\]/.test(value) || /\s/.test(value)) continue;
    const relative = path.posix.normalize(path.posix.join(targetDir === "." ? "" : targetDir, value));
    if (relative.startsWith("..")) {
      checked += 1;
      failures.push(`${rawCandidate} (escapes repository root)`);
      continue;
    }
    const rootStyle = path.posix.normalize(value);
    const candidates = rootStyle === relative || rootStyle.startsWith("..") ? [relative] : [rootStyle, relative];
    if (candidates.some((candidate) => ALLOWLIST.has(candidate))) continue;
    checked += 1;
    const found = candidates.some((candidate) => existsSync(path.join(repoRoot, candidate.replace(/\/$/, ""))));
    if (!found)
      failures.push(rawCandidate === relative ? relative : `${rawCandidate} (tried ${candidates.join(", ")})`);
  }

  if (failures.length > 0) {
    missing += failures.length;
    console.error(`\n${target}:`);
    for (const failure of failures) console.error(`  MISSING ${failure}`);
  }
}

if (missing > 0) {
  console.error(`\ndocs link check FAILED: ${missing} missing path(s) across ${checked} checked references.`);
  process.exit(1);
}

console.log(`docs link check passed: ${checked} repo path references resolve.`);
