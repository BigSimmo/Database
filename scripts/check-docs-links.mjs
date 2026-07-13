#!/usr/bin/env node
/**
 * check-docs-links.mjs — verify that repo-relative paths referenced in the
 * maintained documentation surface actually exist.
 *
 * Scanned by default: README.md, AGENTS.md, and top-level docs/*.md that are
 * not dated point-in-time reports (docs/README.md classifies those as
 * historical records that intentionally reference the repo as it was).
 * Pass --all to also scan dated reports, docs/audit/, docs/redesign/,
 * docs/superpowers/, and docs/archive/ (informational; still fails on
 * missing paths).
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
]);

const DATED_DOC = /\b20\d{2}-\d{2}(-\d{2})?\b/;

function defaultTargets() {
  const targets = ["README.md", "AGENTS.md"];
  const docsDir = path.join(repoRoot, "docs");
  for (const entry of readdirSync(docsDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      if (!scanAll && DATED_DOC.test(entry.name)) continue;
      targets.push(path.posix.join("docs", entry.name));
    }
    if (scanAll && entry.isDirectory()) {
      const sub = path.join(docsDir, entry.name);
      for (const subEntry of readdirSync(sub, { withFileTypes: true })) {
        if (subEntry.isFile() && subEntry.name.endsWith(".md")) {
          targets.push(path.posix.join("docs", entry.name, subEntry.name));
        }
      }
    }
  }
  return targets;
}

function candidatePathsFrom(markdown) {
  const candidates = new Set();

  // Inline code spans: `docs/foo.md`, `src/a.ts, src/b.ts`, `path/file.ts:12`
  for (const match of markdown.matchAll(/`([^`\n]+)`/g)) {
    for (const rawPiece of match[1].split(/,\s*/)) {
      candidates.add(rawPiece.trim());
    }
  }

  // Markdown link targets: [text](docs/foo.md)
  for (const match of markdown.matchAll(/\]\(([^)#\s]+)\)/g)) {
    candidates.add(match[1].trim());
  }

  return candidates;
}

function normalize(candidate) {
  let value = candidate;
  if (value.startsWith("./")) value = value.slice(2);
  // Strip :line, :line:col, or :line-line suffixes.
  value = value.replace(/:\d+([-:]\d+)?$/, "");
  return value;
}

function looksLikeRepoPath(value) {
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

let missing = 0;
let checked = 0;

for (const target of defaultTargets()) {
  const absoluteTarget = path.join(repoRoot, target);
  if (!existsSync(absoluteTarget)) continue;
  const markdown = readFileSync(absoluteTarget, "utf8");
  const failures = [];

  for (const rawCandidate of candidatePathsFrom(markdown)) {
    const value = normalize(rawCandidate);
    if (ALLOWLIST.has(value)) continue;
    const base = ROOT_PREFIXES.some((prefix) => value.startsWith(prefix)) ? globBaseDir(value) : null;
    if (base !== null) {
      checked += 1;
      if (!existsSync(path.join(repoRoot, base))) failures.push(`${value} (glob base '${base}' missing)`);
      continue;
    }
    if (!looksLikeRepoPath(value)) continue;
    checked += 1;
    const cleaned = value.replace(/\/$/, "");
    if (!existsSync(path.join(repoRoot, cleaned))) failures.push(value);
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
