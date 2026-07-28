#!/usr/bin/env node
/**
 * branch-review-ledger — read and write docs/branch-review-ledger.md through one
 * checked path instead of hand-editing a 1000-row markdown table.
 *
 * Hand-writing rows is what produced every defect the 2026-07-28 hygiene pass had to
 * repair: rows appended by a shell redirect that was not UTF-8 (146 mojibake lines),
 * rows written with five or twelve cells instead of six, records written as a heading
 * plus bullet list in the middle of the table, and abbreviated/`see PR head` HEADs that
 * no `git rev-parse` lookup could ever match — so the throttle the ledger exists to
 * provide silently never fired.
 *
 *   node scripts/branch-review-ledger.mjs lookup <branch-or-ref> [--head <sha>] [--scope <text>] [--json]
 *   node scripts/branch-review-ledger.mjs append --ref <x> --head <sha> --scope <s> --outcome <o> --checks <c>
 *   node scripts/branch-review-ledger.mjs --self-test
 *
 * `lookup` answers the only question the ledger is for: has this exact ref at this exact
 * HEAD already been reviewed for this scope? `append` writes one valid row, in UTF-8,
 * with the cells escaped and the HEAD resolved to a full SHA.
 *
 * Read-only except for `append`, which only ever adds one line at the end of the file.
 * Never calls a provider or a network service; `git rev-parse` is local.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const LEDGER_PATH = "docs/branch-review-ledger.md";

/** Cell separator: a literal `|` that was not escaped as `\|` inside prose. */
export const CELL_SPLIT = /(?<!\\)\|/;
export const RECORD_START = /^\| \d{4}-\d{2}-\d{2} \|/;
export const COLUMNS = ["date", "ref", "head", "scope", "outcome", "checks"];

/** Parse the six cells of every review record. Non-record lines are ignored. */
export function parseLedgerRows(markdown) {
  const rows = [];
  for (const [index, line] of markdown.split(/\r?\n/).entries()) {
    if (!RECORD_START.test(line)) continue;
    const cells = line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split(CELL_SPLIT)
      .map((cell) => cell.trim());
    const [date, ref, head, scope, outcome, checks] = COLUMNS.map((_, i) => cells[i] ?? "");
    rows.push({ line: index + 1, raw: line, cells, date, ref, head, scope, outcome, checks });
  }
  return rows;
}

/** Strip markdown/prose decoration so `origin/foo`, `` `foo` `` and `PR #1 / foo` compare equal. */
export function normalizeRef(value) {
  return value
    .replace(/`/g, "")
    .trim()
    .replace(/^origin\//, "")
    .toLowerCase();
}

/** Every branch-like token in a ref cell, so "PR #1137 / `codex/x` (babysit)" yields `codex/x`. */
export function refTokens(cell) {
  const tokens = new Set();
  const plain = cell.replace(/`/g, "");
  for (const match of plain.matchAll(/[A-Za-z0-9._-]+\/[A-Za-z0-9._/-]+/g)) tokens.add(normalizeRef(match[0]));
  for (const match of plain.matchAll(/(?:^|[\s(])([A-Za-z0-9][A-Za-z0-9._-]{2,})(?=[\s),]|$)/g)) {
    tokens.add(normalizeRef(match[1]));
  }
  return tokens;
}

/** A recorded HEAD matches when either side is an abbreviation (>= 7 chars) of the other. */
export function headMatches(recorded, target) {
  const a = recorded.replace(/`/g, "").trim().toLowerCase();
  const b = target.replace(/`/g, "").trim().toLowerCase();
  if (!a || !b) return false;
  const aSha = /^[0-9a-f]{7,40}$/.test(a) ? a : (a.match(/\b[0-9a-f]{7,40}\b/) ?? [])[0];
  const bSha = /^[0-9a-f]{7,40}$/.test(b) ? b : (b.match(/\b[0-9a-f]{7,40}\b/) ?? [])[0];
  if (!aSha || !bSha) return false;
  const short = aSha.length <= bSha.length ? aSha : bSha;
  const long = aSha.length <= bSha.length ? bSha : aSha;
  return long.startsWith(short);
}

/** Prior review records for this ref, split by whether the reviewed HEAD still matches. */
export function findReviews(markdown, { ref, head = "", scope = "" }) {
  const wanted = normalizeRef(ref);
  const atHead = [];
  const otherHead = [];
  for (const row of parseLedgerRows(markdown)) {
    if (!refTokens(row.ref).has(wanted)) continue;
    if (scope && !row.scope.toLowerCase().includes(scope.toLowerCase())) continue;
    (head && headMatches(row.head, head) ? atHead : otherHead).push(row);
  }
  return { atHead, otherHead };
}

/** One cell of prose, safe to place in a markdown table row. */
export function sanitizeCell(value) {
  const text = String(value ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.replace(/(?<!\\)\|/g, "\\|");
}

export function buildRow({ date, ref, head, scope, outcome, checks }) {
  const cells = [date, ref, head, scope, outcome, checks].map(sanitizeCell);
  const problems = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cells[0])) problems.push(`date must be YYYY-MM-DD (got ${JSON.stringify(cells[0])})`);
  COLUMNS.forEach((name, i) => {
    if (!cells[i]) problems.push(`${name} must not be empty`);
  });
  const headCell = cells[2].replace(/`/g, "");
  if (!/^[0-9a-f]{40}$/.test(headCell) && !/^n\/a\b/i.test(headCell)) {
    problems.push(`head must be a full 40-character SHA, or "n/a - <reason>" (got ${JSON.stringify(cells[2])})`);
  }
  if (problems.length > 0) throw new Error(problems.join("; "));
  return `| ${cells.join(" | ")} |`;
}

function git(args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

/** Expand a ref or abbreviated SHA to a full SHA when git can; otherwise return it unchanged. */
function resolveHead(value) {
  const cleaned = String(value ?? "").trim();
  if (/^[0-9a-f]{40}$/i.test(cleaned)) return cleaned.toLowerCase();
  return git(["rev-parse", "--verify", `${cleaned}^{commit}`]) || cleaned;
}

function parseFlags(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }
    const name = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      flags[name] = true;
      continue;
    }
    flags[name] = next;
    i += 1;
  }
  return { flags, positional };
}

function summarize(row) {
  const outcome = row.outcome.length > 140 ? `${row.outcome.slice(0, 137)}...` : row.outcome;
  return `  ${row.date}  ${row.head.replace(/`/g, "").slice(0, 12).padEnd(12)}  ${row.scope}\n      ${outcome}`;
}

function runLookup(markdown, argv) {
  const { flags, positional } = parseFlags(argv);
  const ref = positional[0] ?? flags.ref;
  if (!ref || ref === true) {
    console.error("usage: branch-review-ledger.mjs lookup <branch-or-ref> [--head <sha>] [--scope <text>] [--json]");
    process.exitCode = 2;
    return;
  }
  const head = flags.head && flags.head !== true ? resolveHead(flags.head) : resolveHead(ref);
  const scope = flags.scope && flags.scope !== true ? flags.scope : "";
  const { atHead, otherHead } = findReviews(markdown, { ref, head, scope });

  if (flags.json) {
    console.log(JSON.stringify({ ref, head, scope: scope || null, atHead, otherHead }, null, 2));
    return;
  }

  console.log(`ref:   ${ref}`);
  console.log(`head:  ${head}${/^[0-9a-f]{40}$/.test(head) ? "" : "  (not resolvable to a SHA here)"}`);
  if (scope) console.log(`scope: contains ${JSON.stringify(scope)}`);
  console.log("");

  if (atHead.length > 0) {
    console.log(`ALREADY REVIEWED - ${atHead.length} record(s) at this HEAD${scope ? " and scope" : ""}:`);
    for (const row of atHead) console.log(summarize(row));
    console.log(
      "\nSummarize the prior outcome and skip the repeat review unless a fresh pass was explicitly requested.",
    );
    return;
  }

  console.log(`NOT REVIEWED at this HEAD${scope ? " and scope" : ""}.`);
  if (otherHead.length > 0) {
    console.log(
      `\n${otherHead.length} earlier record(s) for this ref at a different HEAD (review the changed scope only):`,
    );
    for (const row of otherHead.slice(-5)) console.log(summarize(row));
  }
}

function runAppend(markdown, argv) {
  const { flags } = parseFlags(argv);
  const required = ["ref", "head", "scope", "outcome", "checks"];
  const missing = required.filter((name) => !flags[name] || flags[name] === true);
  if (missing.length > 0) {
    console.error(`missing required flag(s): ${missing.map((name) => `--${name}`).join(", ")}`);
    console.error(
      "usage: branch-review-ledger.mjs append --ref <x> --head <sha> --scope <s> --outcome <o> --checks <c>",
    );
    process.exitCode = 2;
    return;
  }

  const date = flags.date && flags.date !== true ? flags.date : new Date().toISOString().slice(0, 10);
  const head = /^n\/a\b/i.test(String(flags.head)) ? String(flags.head) : resolveHead(flags.head);

  let row;
  try {
    row = buildRow({ date, ref: flags.ref, head, scope: flags.scope, outcome: flags.outcome, checks: flags.checks });
  } catch (error) {
    console.error(`refusing to append: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const rows = parseLedgerRows(markdown);
  if (rows.some((existing) => existing.raw === row)) {
    console.error("refusing to append: an identical record already exists.");
    process.exitCode = 1;
    return;
  }
  const near = rows.filter(
    (existing) =>
      headMatches(existing.head, head) &&
      existing.scope.toLowerCase() === sanitizeCell(flags.scope).toLowerCase() &&
      refTokens(existing.ref).has(normalizeRef(String(flags.ref).split("/").slice(-2).join("/"))),
  );
  if (near.length > 0 && !flags.supersede) {
    console.error(`refusing to append: this ref/HEAD/scope was already recorded on ${near.at(-1).date}.`);
    console.error("Cite the prior record instead, or pass --supersede when this record deliberately replaces it.");
    process.exitCode = 1;
    return;
  }

  const needsNewline = markdown.length > 0 && !markdown.endsWith("\n");
  appendFileSync(path.join(root, LEDGER_PATH), `${needsNewline ? "\n" : ""}${row}\n`, "utf8");
  console.log(`Appended review record to ${LEDGER_PATH}:\n${row}`);
}

function assert(condition, label) {
  if (!condition) throw new Error(`self-test failed: ${label}`);
}

function selfTest() {
  const markdown = [
    "| Date | Branch or ref | Reviewed HEAD | Scope | Outcome | Checks |",
    "| --- | --- | --- | --- | --- | --- |",
    `| 2026-07-24 | PR #1 / \`codex/thing\` | ${"a".repeat(40)} | branch-cleanup | kept | npm run test |`,
    `| 2026-07-25 | origin/codex/thing | ${"b".repeat(40)} | diff review | fine | none |`,
    "| 2026-07-26 | pipes | " + "c".repeat(40) + " | s | a \\| b | none |",
  ].join("\n");

  const rows = parseLedgerRows(markdown);
  assert(rows.length === 3, "parses only dated records");
  assert(rows[2].outcome === "a \\| b", "escaped pipe stays inside one cell");
  assert(rows[0].cells.length === 6, "records have six cells");

  assert(headMatches("`abc1234`", "abc1234def"), "abbreviated HEAD matches full");
  assert(!headMatches("abc1234", "def5678"), "different HEADs do not match");
  assert(!headMatches("see PR head", "a".repeat(40)), "prose HEAD matches nothing");

  const hit = findReviews(markdown, { ref: "codex/thing", head: "a".repeat(40) });
  assert(hit.atHead.length === 1, "finds the record at this HEAD");
  assert(hit.otherHead.length === 1, "reports the other-HEAD record separately");
  assert(
    findReviews(markdown, { ref: "origin/codex/thing", head: "b".repeat(40) }).atHead.length === 1,
    "origin/ ref normalizes",
  );
  assert(
    findReviews(markdown, { ref: "codex/thing", head: "a".repeat(40), scope: "cleanup" }).atHead.length === 1,
    "scope filter matches",
  );
  assert(
    findReviews(markdown, { ref: "codex/thing", head: "a".repeat(40), scope: "release" }).atHead.length === 0,
    "scope filter excludes",
  );

  assert(sanitizeCell("a | b\nc") === "a \\| b c", "cells are single-line and pipe-escaped");
  const built = buildRow({
    date: "2026-07-28",
    ref: "x",
    head: "d".repeat(40),
    scope: "s",
    outcome: "o",
    checks: "c",
  });
  assert(parseLedgerRows(built)[0].cells.length === 6, "built row has six cells");
  for (const [bad, label] of [
    [{ date: "28-07-2026" }, "bad date rejected"],
    [{ head: "abc1234" }, "abbreviated HEAD rejected"],
    [{ checks: "" }, "empty cell rejected"],
  ]) {
    let threw = false;
    try {
      buildRow({ date: "2026-07-28", ref: "x", head: "d".repeat(40), scope: "s", outcome: "o", checks: "c", ...bad });
    } catch {
      threw = true;
    }
    assert(threw, label);
  }
  assert(
    buildRow({ date: "2026-07-28", ref: "x", head: "n/a - not pushed yet", scope: "s", outcome: "o", checks: "c" }),
    "documented n/a HEAD accepted",
  );

  console.log("branch-review-ledger self-test passed.");
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) {
    selfTest();
    return;
  }
  const markdown = readFileSync(path.join(root, LEDGER_PATH), "utf8");
  const [command, ...rest] = argv;
  if (command === "lookup") return runLookup(markdown, rest);
  if (command === "append") return runAppend(markdown, rest);
  console.error("usage: branch-review-ledger.mjs <lookup|append|--self-test> [...]");
  console.error("  lookup <branch-or-ref> [--head <sha>] [--scope <text>] [--json]");
  console.error(
    "  append --ref <x> --head <sha> --scope <s> --outcome <o> --checks <c> [--date <YYYY-MM-DD>] [--supersede]",
  );
  process.exitCode = 2;
}

if (process.argv[1]?.endsWith("branch-review-ledger.mjs")) main();
