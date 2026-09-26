#!/usr/bin/env node
// Decisions log checker. `docs/decisions/` indexes the owner's recorded decisions, one short file
// each, named `YYYY-MM-DD-<slug>.md`. Each entry points at the place the decision is recorded
// (a repository path plus a phrase to find it); it never moves or restates that text as the
// authority. Guide: docs/decisions/README.md.
//
// Two kinds of finding, kept apart on purpose:
//   errors    an entry is malformed (bad name, missing field, date that disagrees with its name).
//             These are the entry author's own mistakes and are cheap to fix in the same change.
//   warnings  an entry's source has moved, or its phrase is no longer found there. Sources are
//             ordinary documents that other work edits and moves, so a stale pointer is reported
//             for tidying and never fails a check (the organisation framework's "moving a file
//             never turns a PR red" rule).
//
// Exit codes follow scripts/check-organisation.mjs: 0 no errors (warnings may remain), 1 at least
// one malformed entry, 2 the check could not run.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DECISIONS_DIR = "docs/decisions";
export const SOURCE_WINS = "If this summary and the source ever differ, the source wins.";
export const ENTRY_NAME = /^(\d{4}-\d{2}-\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;

const STATUS_LINE = /^- \*\*Status:\*\* decided (\d{4}-\d{2}-\d{2})\b(.*)$/m;
const SOURCE_LINE = /^- \*\*Source:\*\* `([^`]+)`, find "([^"]+)"\s*$/m;
const TITLE_LINE = /^# Decision: (\S.*)$/m;
const PENDING_INBOX = /^docs\/outstanding-issues-inbox\/([^/]+\.json)$/;

function isRealDate(text) {
  const parsed = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text;
}

function isRepoRelative(file) {
  return (
    file.length > 0 &&
    !file.startsWith("/") &&
    !file.startsWith("./") &&
    !/^[A-Za-z]:/.test(file) &&
    !file.includes("\\") &&
    !file.split("/").includes("..")
  );
}

/**
 * Read one entry. Returns the parsed fields and every format problem found, so a caller can
 * report them all at once rather than one per run.
 */
export function parseDecisionEntry(fileName, markdown) {
  const problems = [];
  const name = ENTRY_NAME.exec(fileName);
  if (!name) problems.push("name must be YYYY-MM-DD-<slug>.md, with a lowercase hyphenated slug");
  const nameDate = name?.[1] ?? null;
  if (nameDate && !isRealDate(nameDate)) problems.push(`${nameDate} is not a real date`);

  const title = TITLE_LINE.exec(markdown)?.[1]?.trim() ?? null;
  if (!title) problems.push('missing the "# Decision: <title>" heading');

  const status = STATUS_LINE.exec(markdown);
  const date = status?.[1] ?? null;
  if (!status) problems.push('missing the "- **Status:** decided YYYY-MM-DD" line');
  else if (nameDate && date !== nameDate) problems.push(`the status date ${date} differs from the name's ${nameDate}`);

  const source = SOURCE_LINE.exec(markdown);
  const sourcePath = source?.[1] ?? null;
  const sourcePhrase = source?.[2]?.trim() ?? null;
  if (!source) problems.push('missing the "- **Source:** `<path>`, find "<phrase>"" line');
  else if (!isRepoRelative(sourcePath)) problems.push(`source ${sourcePath} is not a repository-relative path`);

  if (!markdown.includes(SOURCE_WINS)) problems.push(`missing the closing sentence "${SOURCE_WINS}"`);

  const summary = decisionSummary(markdown);
  if (!summary) problems.push("missing the decision itself: one or two plain sentences under the fields");

  return { fileName, date, slug: name?.[2] ?? null, title, sourcePath, sourcePhrase, summary, problems };
}

/** The prose between the field list and the closing sentence. */
function decisionSummary(markdown) {
  const lines = markdown.split(/\r?\n/);
  const body = [];
  for (const line of lines) {
    if (line.startsWith("#") || line.startsWith("- **")) continue;
    if (line.includes(SOURCE_WINS)) break;
    body.push(line);
  }
  const text = body.join(" ").replace(/\s+/g, " ").trim();
  return text.length > 0 ? text : null;
}

/**
 * Collapse a source to comparable text: drop the comment markers that start wrapped lines in
 * code and quoted prose, then collapse whitespace, so a phrase is found however the source wraps.
 */
export function comparableText(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:\/\/+|\*+|#+|>+)?\s?/, ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function sourceContainsPhrase(sourceText, phrase) {
  return comparableText(sourceText).includes(comparableText(phrase));
}

/**
 * Where a cited source lives now. A pending outstanding-issues inbox request moves to `applied/`
 * when it is reconciled, and is the same immutable file there (the rule docs:check-links uses).
 */
export function resolveSourcePath(repoRoot, sourcePath) {
  const direct = path.join(repoRoot, sourcePath);
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return sourcePath;
  const pending = PENDING_INBOX.exec(sourcePath);
  if (pending) {
    const applied = `docs/outstanding-issues-inbox/applied/${pending[1]}`;
    if (fs.existsSync(path.join(repoRoot, applied))) return applied;
  }
  return null;
}

/**
 * Check every file in the decisions folder. Never writes anything.
 * @param {{ repoRoot?: string, dir?: string }} [options]
 */
export function checkDecisions({ repoRoot, dir = DECISIONS_DIR } = {}) {
  if (!repoRoot) throw new Error("checkDecisions needs repoRoot");
  const absoluteDir = path.join(repoRoot, dir);
  const errors = [];
  const warnings = [];
  const entries = [];
  const records = [];
  if (!fs.existsSync(absoluteDir)) {
    errors.push(`${dir}: the folder does not exist`);
    return { entries, records, errors, warnings };
  }
  const names = fs
    .readdirSync(absoluteDir, { withFileTypes: true })
    .filter((item) => item.isFile() && item.name.endsWith(".md") && item.name !== "README.md")
    .map((item) => item.name)
    .sort();
  const slugs = new Map();
  for (const name of names) {
    const file = `${dir}/${name}`;
    const markdown = fs.readFileSync(path.join(absoluteDir, name), "utf8");
    if (!/^\d/.test(name)) {
      // A full decision record kept under its own name (for example a ledger id).
      if (!/^# Decision: \S/m.test(markdown))
        errors.push(`${file}: a full record must open with "# Decision: <title>"`);
      records.push(file);
      continue;
    }
    const entry = parseDecisionEntry(name, markdown);
    for (const problem of entry.problems) errors.push(`${file}: ${problem}`);
    if (entry.slug) {
      if (slugs.has(entry.slug))
        warnings.push(`${file}: same slug as ${slugs.get(entry.slug)}; check it is not a duplicate`);
      else slugs.set(entry.slug, file);
    }
    if (entry.sourcePath && entry.sourcePhrase && entry.problems.length === 0) {
      const resolved = resolveSourcePath(repoRoot, entry.sourcePath);
      if (!resolved) {
        warnings.push(
          `${file}: source ${entry.sourcePath} no longer exists; point the entry at where the text now lives`,
        );
      } else if (!sourceContainsPhrase(fs.readFileSync(path.join(repoRoot, resolved), "utf8"), entry.sourcePhrase)) {
        warnings.push(
          `${file}: "${entry.sourcePhrase}" is no longer found in ${resolved}; re-read the source and update the entry`,
        );
      }
    }
    entries.push(entry);
  }
  return { entries, records, errors, warnings };
}

function main() {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const json = process.argv.includes("--json");
  let result;
  try {
    result = checkDecisions({ repoRoot });
  } catch (error) {
    console.error(`decisions: could not run: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    for (const error of result.errors) console.error(`error: ${error}`);
    for (const warning of result.warnings) console.warn(`warning: ${warning}`);
    console.log(
      `decisions: ${result.entries.length} entries, ${result.records.length} full records, ` +
        `${result.errors.length} errors, ${result.warnings.length} warnings`,
    );
  }
  return result.errors.length > 0 ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
