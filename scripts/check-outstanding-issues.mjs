#!/usr/bin/env node
// Structural gate for docs/outstanding-issues.md.
//
// Ledger #112. The `issues:next-id` marker is a plain HTML comment that every
// editor read-modify-writes with no lock, and this file — unlike
// docs/branch-review-ledger.md — has NO `merge=union` driver. So two agents
// allocating in the same hour collide, and the collision surfaces as an
// ordinary content conflict that a hurried resolution can settle by taking one
// side wholesale and dropping the other's rows. On 2026-07-29 that happened
// three times in one hour on a single PR, and nothing noticed: no gate read
// this file's structure at all.
//
// This makes each of those failures loud:
//   - an id used twice is a merge that kept both sides' rows under one number
//   - an id above the marker is a merge that kept a row and lost the bump
//   - an id in both tables is an archive move that copied instead of moving
//   - a malformed row is usually a hand-edit that broke the column count
//
// Deliberately structural only. It says nothing about whether a row's content
// is right, because that is a judgement a gate cannot make and pretending
// otherwise would make the gate noisy enough to be ignored.

import { readFileSync } from "node:fs";

export const ISSUES_PATH = "docs/outstanding-issues.md";

const OPEN_HEADING = "## Open items";
const ARCHIVE_HEADING = "## Resolved / archive";
const MARKER = /<!--\s*issues:next-id=(\d+)\s*-->/;
/**
 * A data row's id cell, e.g. `| #042 |`.
 *
 * Matching only well-formed ids and skipping the rest would make this gate
 * claim more than it does: a hand edit turning `#001` into `001` or `#OO1`
 * would drop that row from EVERY check below — duplicate detection, the marker
 * comparison, the width check — and the file would pass while carrying exactly
 * the malformed row the gate advertises. So `DATA_ROW` recognises any row in a
 * table body and the id shape is validated, not assumed.
 */
const ID_CELL = /^#\d+$/;
/** Any table row that is not a header or separator, so a bad id is still seen. */
const DATA_ROW = /^\|/;
/** The header row of either table, which names its first column `ID`. */
const HEADER_ROW = /^\|\s*ID\s*\|/i;
/**
 * A table's separator row, e.g. `| ---- | --- |`, which declares its width.
 * The inner pipes must be in the class: without them this only ever matched a
 * two-column table, so every wider table silently had no declared width.
 */
const SEPARATOR = /^\|[\s:|-]+\|$/;

/**
 * Cells of a markdown table row, without the leading/trailing pipe.
 *
 * Splits on unescaped pipes only. `\|` is the correct way to put a literal pipe
 * inside a cell, and several rows legitimately do — row #042 documents an
 * `absent \| valid \| invalid` credential triple. A naive `split("|")` counts
 * those as extra columns and reports a well-formed row as broken, which is how
 * a gate earns a reputation for false alarms and stops being read.
 */
function cells(line) {
  return line
    .replace(/^\|/, "")
    .replace(/(?<!\\)\|\s*$/, "")
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim());
}

export function parseIssues(markdown) {
  const lines = markdown.split("\n");
  const openStart = lines.findIndex((line) => line.startsWith(OPEN_HEADING));
  const archiveStart = lines.findIndex((line) => line.startsWith(ARCHIVE_HEADING));
  const markers = [...markdown.matchAll(new RegExp(MARKER, "g"))];
  const marker = markers[0] ?? null;

  const rows = [];
  lines.forEach((line, index) => {
    if (openStart < 0 || index < openStart) return;
    if (!DATA_ROW.test(line) || SEPARATOR.test(line) || HEADER_ROW.test(line)) return;
    const table = archiveStart >= 0 && index > archiveStart ? "archive" : "open";
    const parsed = cells(line);
    const id = parsed[0] ?? "";
    const valid = ID_CELL.test(id);
    rows.push({
      id,
      valid,
      number: valid ? Number(id.slice(1)) : null,
      line: index + 1,
      table,
      cellCount: parsed.length,
    });
  });

  // A table declares its own width in its separator row. Deriving it from the
  // rows instead — say, by majority vote — cannot flag the anomaly when a table
  // holds one row, and "most rows agree" is a weaker claim than "the header
  // says so" even when it holds.
  const separatorWidth = (from, to) => {
    const line = lines.slice(Math.max(from, 0), to < 0 ? lines.length : to).find((entry) => SEPARATOR.test(entry));
    return line ? cells(line).length : null;
  };

  return {
    openStart,
    archiveStart,
    nextId: marker ? Number(marker[1]) : null,
    markerCount: markers.length,
    rows,
    widths: {
      open: separatorWidth(openStart, archiveStart),
      archive: separatorWidth(archiveStart, -1),
    },
  };
}

export function checkIssues(markdown) {
  const problems = [];
  const { openStart, archiveStart, nextId, markerCount, rows, widths } = parseIssues(markdown);

  if (openStart < 0) problems.push(`missing the "${OPEN_HEADING}" heading`);
  if (archiveStart < 0) problems.push(`missing the "${ARCHIVE_HEADING}" heading`);
  if (openStart >= 0 && archiveStart >= 0 && archiveStart < openStart) {
    problems.push(`"${ARCHIVE_HEADING}" appears before "${OPEN_HEADING}"`);
  }
  if (nextId === null) problems.push("missing the <!-- issues:next-id=N --> marker");
  if (markerCount > 1) {
    // Only the first is ever read, so a conflict that kept both leaves a stale
    // value that a later editor can follow straight into a reused id.
    problems.push(
      `${markerCount} <!-- issues:next-id=N --> markers — exactly one is allowed; ` +
        "a second is a conflict resolution that kept both sides",
    );
  }
  if (rows.length === 0) problems.push("no `| #NNN |` rows found — the parser or the file shape has drifted");

  // The failure this gate exists for: a lost-row merge that left two rows
  // sharing one number, so one item's evidence is silently attributed to
  // another and the next allocation collides again.
  for (const row of rows.filter((entry) => !entry.valid)) {
    problems.push(
      `line ${row.line} (${row.table} table) has a malformed id cell ${JSON.stringify(row.id)} — ` +
        "ids are `#NNN`; a row the parser cannot identify is a row no other check can protect",
    );
  }

  const byId = new Map();
  for (const row of rows.filter((entry) => entry.valid)) {
    if (!byId.has(row.id)) byId.set(row.id, []);
    byId.get(row.id).push(row);
  }
  for (const [id, entries] of byId) {
    if (entries.length > 1) {
      problems.push(
        `${id} appears ${entries.length} times (lines ${entries.map((entry) => entry.line).join(", ")}) — ` +
          "ids are never reused; a collision usually means a merge kept both sides under one number",
      );
    }
  }

  // An item cannot be open and resolved at once. This catches an archive move
  // that copied the row instead of moving it — the shape a reader trusts least,
  // because the two copies then disagree about whether the work is done.
  for (const [id, entries] of byId) {
    const tables = new Set(entries.map((entry) => entry.table));
    if (tables.size > 1) problems.push(`${id} is in BOTH the open and archive tables`);
  }

  // The marker must lead the whole file, not just the open table: ids are never
  // reused, so an archived row still burns its number.
  const numbered = rows.filter((row) => row.valid);
  if (nextId !== null && numbered.length > 0) {
    const highest = Math.max(...numbered.map((row) => row.number));
    if (nextId <= highest) {
      problems.push(
        `issues:next-id=${nextId} is not above the highest id #${String(highest).padStart(3, "0")} — ` +
          "the next allocation would reuse a number that is already taken",
      );
    }
  }

  // Column counts, against each table's declared width. A row that lost or
  // gained a cell is usually a hand-edit with an unescaped `|`, and it renders
  // as a broken table rather than failing anything.
  for (const { table, expected } of [
    { table: "open", expected: widths.open },
    { table: "archive", expected: widths.archive },
  ]) {
    if (expected === null) continue;
    for (const row of rows.filter((entry) => entry.table === table)) {
      if (row.cellCount !== expected) {
        problems.push(
          `${row.id} (line ${row.line}, ${table} table) has ${row.cellCount} cells, not ${expected} — ` +
            "an unescaped `|` inside a cell is the usual cause",
        );
      }
    }
  }

  return problems;
}

function selfTest() {
  const good = [
    "<!-- issues:next-id=3 -->",
    "## Open items",
    "| ID | Pri | Summary |",
    "| --- | --- | --- |",
    "| #001 | P2 | a |",
    "## Resolved / archive",
    "| ID | Summary |",
    "| --- | --- |",
    "| #002 | b |",
  ].join("\n");
  const cases = [
    ["a well-formed file", good, 0],
    ["a duplicated id", good.replace("| #002 | b |", "| #001 | b |"), 2], // duplicate + both-tables
    ["an id at the marker", good.replace("next-id=3", "next-id=2"), 1],
    ["a row with a stray pipe", good.replace("| #001 | P2 | a |", "| #001 | P2 | a | b |"), 1],
    ["a missing marker", good.replace("<!-- issues:next-id=3 -->", ""), 1],
    // A literal pipe inside a cell is escaped, not a column boundary. The real
    // file has rows like this and an earlier draft of the checker failed them.
    ["an escaped pipe inside a cell", good.replace("| #001 | P2 | a |", "| #001 | P2 | a \\| b |"), 0],
    // Adversarial: a row the id regex cannot parse must FAIL, not disappear.
    // Skipping it would drop the row from duplicate, marker and width checks
    // while the file reported green — the gate claiming more than it does.
    ["a dropped # on an id", good.replace("| #001 | P2 | a |", "| 001 | P2 | a |"), 1],
    ["a letter O for a zero", good.replace("| #001 | P2 | a |", "| #OO1 | P2 | a |"), 1],
    ["an empty id cell", good.replace("| #001 | P2 | a |", "|  | P2 | a |"), 1],
    // Two markers: only the first is ever read, so the second is a stale
    // allocation a later editor can follow straight into a reused id.
    [
      "a second next-id marker kept by a conflict",
      good.replace("<!-- issues:next-id=3 -->", "<!-- issues:next-id=3 -->\n<!-- issues:next-id=9 -->"),
      1,
    ],
  ];
  let failures = 0;
  for (const [name, markdown, expected] of cases) {
    const problems = checkIssues(markdown);
    if (problems.length !== expected) {
      failures += 1;
      console.error(`self-test FAILED: ${name} — expected ${expected} problem(s), got ${problems.length}`);
      for (const problem of problems) console.error(`  - ${problem}`);
    }
  }
  if (failures > 0) process.exit(1);
  console.log("outstanding-issues self-test passed.");
}

function main() {
  if (process.argv.includes("--self-test")) {
    selfTest();
    return;
  }
  const markdown = readFileSync(ISSUES_PATH, "utf8");
  const problems = checkIssues(markdown);
  if (problems.length > 0) {
    console.error(`${ISSUES_PATH} check FAILED:`);
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error(
      "\nIds are never reused. If a merge collided, renumber the incoming rows above the marker " +
        "and bump it — do not resolve by taking one side wholesale, which drops the other's rows.",
    );
    process.exit(1);
  }
  const { rows, nextId } = parseIssues(markdown);
  const open = rows.filter((row) => row.table === "open").length;
  console.log(
    `Outstanding-issues guard passed: ${rows.length} rows (${open} open, ${rows.length - open} archived), ` +
      `unique ids, next-id=${nextId} above the highest.`,
  );
}

if (process.argv[1]?.endsWith("check-outstanding-issues.mjs")) main();
