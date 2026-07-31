#!/usr/bin/env node
// Writer for docs/outstanding-issues.md — the counterpart to
// check-outstanding-issues.mjs, which only ever validated.
//
// Why this exists. docs/branch-review-ledger.md has had a writer
// (branch-review-ledger.mjs) since it was introduced, and hand-authoring a row
// there is forbidden by AGENTS.md. This file had a gate but no writer, so every
// mutation was hand-authored — and the 2026-07-30/31 session produced exactly
// the failures that predicts, none of which were judgement calls:
//
//   - rows appended into the archive table because the author anchored on an id
//     that had since been archived (the gate caught it as a cell-count error,
//     which is a confusing way to be told "wrong table")
//   - an unescaped `|` inside prose splitting one row into extra cells
//   - ids allocated by reading the marker by eye and colliding with a
//     concurrent branch
//
// So the rules live in ONE place: this writer imports the gate's parser rather
// than re-deriving where the tables are or how wide they are, and it re-runs the
// gate against its own output before writing. A refusal here is the same
// refusal CI would give, minus the round trip.
//
// It deliberately does NOT solve id collisions between concurrent branches:
// allocation is still read-modify-write against the marker, so two branches can
// still pick the same number. That is ledger #154's territory and needs a
// different id scheme, not a better writer.
//
// Usage:
//   node scripts/outstanding-issues.mjs add --pri P2 --type issue \
//     --summary "..." --detail "..." --source "..."
//   node scripts/outstanding-issues.mjs done '#151' --outcome "Resolved ..."
//   node scripts/outstanding-issues.mjs update '#151' --detail "..."
//   node scripts/outstanding-issues.mjs --self-test

import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { ISSUES_PATH, canonicalId, checkIssues, parseIssues } from "./check-outstanding-issues.mjs";

const OPEN_CELLS = 7; // ID | Pri | Type | Summary | Detail / next action | Source | Added
const ARCHIVE_CELLS = 5; // ID | Type | Summary | Outcome | Resolved
const PRIORITIES = new Set(["P1", "P2", "P3"]);
const TYPES = new Set(["task", "issue", "rec"]);

/**
 * Make one cell safe to place in a markdown table.
 *
 * The pipe escape is the whole point: prose in these rows routinely contains
 * `a | b`, and an unescaped pipe silently becomes a column boundary, which the
 * gate then reports as a width error somewhere else on the line. Newlines
 * collapse for the same reason — a row is one line, by construction.
 */
export function escapeCell(value) {
  return String(value ?? "")
    .replace(/\r?\n+/g, " ")
    .replace(/\|/g, "\\|")
    .replace(/\s+/g, " ")
    .trim();
}

/** Split a row into cells, honouring `\|` escapes so prose pipes stay put. */
export function splitCells(line) {
  const inner = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const out = [];
  let cell = "";
  for (let i = 0; i < inner.length; i += 1) {
    if (inner[i] === "\\" && inner[i + 1] === "|") {
      cell += "\\|";
      i += 1;
      continue;
    }
    if (inner[i] === "|") {
      out.push(cell.trim());
      cell = "";
      continue;
    }
    cell += inner[i];
  }
  out.push(cell.trim());
  return out;
}

export function buildRow(cells) {
  return `| ${cells.join(" | ")} |`;
}

function today(options = {}) {
  if (options.date) return options.date;
  return new Date().toISOString().slice(0, 10);
}

/** Last line index of the last body block of a table, or null when absent. */
function lastRowIndex(parsed, table) {
  const rows = parsed.rows.filter((row) => row.table === table);
  if (rows.length === 0) return null;
  return rows[rows.length - 1].line - 1;
}

function findRow(parsed, id) {
  return parsed.rows.find((row) => row.id === id) ?? null;
}

/**
 * Apply an edit, then re-run the gate on the result. Returning the markdown
 * only when it passes is what makes a wrong-table insert impossible rather than
 * merely detectable later.
 */
function guarded(markdown, mutate) {
  const next = mutate(markdown);
  const problems = checkIssues(next, { prettierIgnored: true });
  if (problems.length > 0) {
    throw new Error(`refusing to write, the result would fail the gate:\n  - ${problems.join("\n  - ")}`);
  }
  return next;
}

export function addIssue(markdown, fields, options = {}) {
  const pri = String(fields.pri ?? "P2");
  const type = String(fields.type ?? "task");
  if (!PRIORITIES.has(pri)) throw new Error(`--pri must be one of ${[...PRIORITIES].join(", ")}, got ${pri}`);
  if (!TYPES.has(type)) throw new Error(`--type must be one of ${[...TYPES].join(", ")}, got ${type}`);
  if (!fields.summary) throw new Error("--summary is required");

  return guarded(markdown, (current) => {
    const parsed = parseIssues(current);
    if (parsed.nextId === null) throw new Error("no issues:next-id marker found");
    if (parsed.openStart < 0) throw new Error("no '## Open items' heading found");

    const id = canonicalId(parsed.nextId);
    const row = buildRow([
      id,
      pri,
      type,
      escapeCell(fields.summary),
      escapeCell(fields.detail ?? ""),
      escapeCell(fields.source ?? `session ${today(options)}`),
      today(options),
    ]);
    if (splitCells(row).length !== OPEN_CELLS) {
      throw new Error(`built an open row with ${splitCells(row).length} cells, expected ${OPEN_CELLS}`);
    }

    const anchor = lastRowIndex(parsed, "open");
    if (anchor === null) throw new Error("the open-items table has no rows to append after");

    const lines = current.split("\n");
    lines.splice(anchor + 1, 0, row);
    let next = lines.join("\n");
    next = next.replace(/<!--\s*issues:next-id=\d+\s*-->/, `<!-- issues:next-id=${parsed.nextId + 1} -->`);
    return next;
  });
}

export function resolveIssue(markdown, id, outcome, options = {}) {
  if (!outcome) throw new Error("--outcome is required");
  return guarded(markdown, (current) => {
    const parsed = parseIssues(current);
    const row = findRow(parsed, id);
    if (!row) throw new Error(`${id} is not in ${ISSUES_PATH}`);
    if (row.table === "archive") throw new Error(`${id} is already archived`);

    const cells = splitCells(row.raw);
    // Open is ID|Pri|Type|Summary|Detail|Source|Added; archive drops Pri,
    // Detail and Source and gains Outcome + Resolved.
    const archived = buildRow([cells[0], cells[2], cells[3], escapeCell(outcome), today(options)]);
    if (splitCells(archived).length !== ARCHIVE_CELLS) {
      throw new Error(`built an archive row with ${splitCells(archived).length} cells, expected ${ARCHIVE_CELLS}`);
    }

    const lines = current.split("\n");
    lines.splice(row.line - 1, 1);
    const afterRemoval = parseIssues(lines.join("\n"));
    const anchor = lastRowIndex(afterRemoval, "archive");
    if (anchor === null) throw new Error("the archive table has no rows to append after");
    lines.splice(anchor + 1, 0, archived);
    return lines.join("\n");
  });
}

export function updateIssue(markdown, id, fields) {
  const editable = { summary: 3, detail: 4, source: 5 };
  const requested = Object.keys(editable).filter((key) => fields[key] !== undefined);
  if (requested.length === 0) throw new Error("pass at least one of --summary, --detail, --source");

  return guarded(markdown, (current) => {
    const parsed = parseIssues(current);
    const row = findRow(parsed, id);
    if (!row) throw new Error(`${id} is not in ${ISSUES_PATH}`);
    if (row.table !== "open") throw new Error(`${id} is archived; archived rows are history and are not edited`);

    const cells = splitCells(row.raw);
    for (const key of requested) cells[editable[key]] = escapeCell(fields[key]);
    const lines = current.split("\n");
    lines[row.line - 1] = buildRow(cells);
    return lines.join("\n");
  });
}

function argValue(argv, name) {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] : undefined;
}

function selfTest() {
  const fixture = [
    "# Outstanding",
    "",
    "<!-- issues:next-id=7 -->",
    "",
    "## Open items",
    "",
    "| ID | Pri | Type | Summary | Detail / next action | Source | Added |",
    "| ---- | --- | ---- | ---- | ---- | ---- | ---- |",
    "| #005 | P2 | issue | first | detail one | src | 2026-01-01 |",
    "| #006 | P3 | task | second | detail two | src | 2026-01-02 |",
    "",
    "## Resolved / archive",
    "",
    "| ID | Type | Summary | Outcome | Resolved |",
    "| ---- | ---- | ---- | ---- | ---- |",
    "| #001 | task | old | done long ago | 2025-12-01 |",
    "",
  ].join("\n");

  const failures = [];
  const check = (label, condition) => {
    if (!condition) failures.push(label);
  };

  // add: lands in the OPEN table, takes the marker's id, bumps it.
  const added = addIssue(
    fixture,
    { pri: "P1", type: "rec", summary: "third", detail: "d", source: "s" },
    { date: "2026-02-02" },
  );
  const addedParsed = parseIssues(added);
  check(
    "add uses the marker id",
    addedParsed.rows.some((r) => r.id === "#007" && r.table === "open"),
  );
  check("add bumps the marker", addedParsed.nextId === 8);
  check("add appends after the last open row", added.indexOf("#007") > added.indexOf("#006"));
  check("add stays out of the archive", !addedParsed.rows.some((r) => r.id === "#007" && r.table === "archive"));

  // The wrong-table failure that motivated this writer: appending must not land
  // in the archive even though an archived row sits later in the file.
  check("add lands before the archive heading", added.indexOf("| #007 ") < added.indexOf("## Resolved / archive"));

  // escaping: a pipe in prose must not become a column.
  const piped = addIssue(
    fixture,
    { pri: "P2", type: "task", summary: "a | b", detail: "c | d" },
    { date: "2026-02-02" },
  );
  const pipedRow = parseIssues(piped).rows.find((r) => r.id === "#007");
  check("pipes are escaped, not new cells", splitCells(pipedRow.raw).length === OPEN_CELLS);
  check("escaped pipe survives in the text", pipedRow.raw.includes("a \\| b"));

  // done: moves rather than copies, and reshapes to the archive width.
  const resolved = resolveIssue(fixture, "#005", "Resolved by PR #1", { date: "2026-03-03" });
  const resolvedParsed = parseIssues(resolved);
  const moved = resolvedParsed.rows.filter((r) => r.id === "#005");
  check("done leaves exactly one #005", moved.length === 1);
  check("done puts it in the archive", moved[0]?.table === "archive");
  check("done reshapes to archive width", splitCells(moved[0].raw).length === ARCHIVE_CELLS);
  check("done keeps the summary", moved[0].raw.includes("first"));
  check("done records the outcome", moved[0].raw.includes("Resolved by PR #1"));

  // update: edits in place, same table, same width.
  const updated = updateIssue(fixture, "#006", { detail: "replaced | detail" });
  const updatedRow = parseIssues(updated).rows.find((r) => r.id === "#006");
  check("update stays in the open table", updatedRow.table === "open");
  check("update keeps the width", splitCells(updatedRow.raw).length === OPEN_CELLS);
  check("update escapes the new text", updatedRow.raw.includes("replaced \\| detail"));

  // refusals
  const rejects = (label, run) => {
    try {
      run();
      failures.push(`${label} should have thrown`);
    } catch {
      /* expected */
    }
  };
  rejects("unknown id", () => resolveIssue(fixture, "#999", "x"));
  rejects("double archive", () => resolveIssue(resolved, "#005", "again"));
  rejects("bad priority", () => addIssue(fixture, { pri: "P9", summary: "x" }));
  rejects("bad type", () => addIssue(fixture, { type: "nope", summary: "x" }));
  rejects("missing summary", () => addIssue(fixture, {}));
  rejects("empty update", () => updateIssue(fixture, "#006", {}));

  if (failures.length > 0) {
    console.error("outstanding-issues writer self-test FAILED:");
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log("outstanding-issues writer self-test passed.");
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) {
    selfTest();
    return;
  }

  const [command, positional] = argv;
  const markdown = readFileSync(ISSUES_PATH, "utf8");
  let next;

  try {
    if (command === "add") {
      next = addIssue(markdown, {
        pri: argValue(argv, "pri"),
        type: argValue(argv, "type"),
        summary: argValue(argv, "summary"),
        detail: argValue(argv, "detail"),
        source: argValue(argv, "source"),
      });
    } else if (command === "done") {
      next = resolveIssue(markdown, positional, argValue(argv, "outcome"));
    } else if (command === "update") {
      next = updateIssue(markdown, positional, {
        summary: argValue(argv, "summary"),
        detail: argValue(argv, "detail"),
        source: argValue(argv, "source"),
      });
    } else {
      console.error("usage: outstanding-issues.mjs <add|done|update> [id] [--flags]  (see file header)");
      process.exitCode = 1;
      return;
    }
  } catch (error) {
    console.error(`outstanding-issues: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  writeFileSync(ISSUES_PATH, next, "utf8");
  const parsed = parseIssues(next);
  const open = parsed.rows.filter((r) => r.table === "open").length;
  const archived = parsed.rows.filter((r) => r.table === "archive").length;
  console.log(`${ISSUES_PATH} updated: ${open} open, ${archived} archived, next-id=${parsed.nextId}.`);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
