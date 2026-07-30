#!/usr/bin/env node
// Structural gate for docs/outstanding-issues.md.
//
// Ledger #112. The `issues:next-id` marker is a plain HTML comment that every
// editor read-modify-writes with no lock. A `merge=union` driver was tried (PR
// #1416) and removed: unlike docs/branch-review-ledger.md this file allocates
// IDs by read-modify-write, so union could not allocate unique IDs either, and
// it silently concatenated conflicting hunks — two marker bumps became two
// `next-id` lines (#133), and on 2026-07-30 the whole open-items table was
// duplicated on four merges (#1430). This gate now requires that NO driver is
// set, so overlapping edits conflict loudly. A hurried conflict resolution can
// still take one side wholesale. On 2026-07-29 that happened three times in one hour
// on a single PR, and nothing noticed: no gate read this file's structure at
// all. This structural gate is what makes those failures loud.
//
// This makes each of those failures loud:
//   - an id used twice is a merge that kept both sides' rows under one number
//   - an id above the marker is a merge that kept a row and lost the bump
//   - an id in both tables is an archive move that copied instead of moving
//   - a malformed row is usually a hand-edit that broke the column count
//   - a row outside any table is a blank line that silently ended the table
//
// Deliberately structural only. It says nothing about whether a row's content
// is right, because that is a judgement a gate cannot make and pretending
// otherwise would make the gate noisy enough to be ignored.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export const ISSUES_PATH = "docs/outstanding-issues.md";

const OPEN_HEADING = "## Open items";
const ARCHIVE_HEADING = "## Resolved / archive";
const MARKER = /<!--\s*issues:next-id=(\d+)\s*-->/;
/**
 * An id cell's shape, e.g. `#042`. Used to READ the number, never to decide
 * whether a line is a row.
 *
 * That distinction is the whole correctness argument. Matching only well-formed
 * ids and skipping the rest would make this gate claim more than it does: a
 * hand edit turning `#001` into `001` or `#OO1` would drop that row from EVERY
 * check below — duplicate detection, the marker comparison, the width check —
 * and the file would pass while carrying exactly the malformed row the gate
 * advertises. Rows are found positionally instead (see `tableBodies`), and the
 * id shape is validated rather than assumed.
 */
const ID_CELL = /^#\d+$/;
/**
 * A table's separator row, e.g. `| ---- | --- |`, which declares its width.
 * The inner pipes must be in the class: without them this only ever matched a
 * two-column table, so every wider table silently had no declared width.
 */
const SEPARATOR = /^\|[\s:|-]+\|$/;
/** An ATX heading: one to six hashes THEN whitespace. `#001` is not one. */
const HEADING = /^#{1,6}(\s|$)/;

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

/**
 * The lines that make up one table's BODY, and the width its separator declares.
 *
 * This inverts how rows were found, and the inversion is the point. Three
 * successive review rounds each found another row shape the detector silently
 * dropped — a malformed id, then a damaged leading pipe — because it asked
 * "does this line look like a row?" and anything that did not was invisible to
 * every check below. A gate that only inspects the rows it can already parse
 * cannot report the rows it cannot.
 *
 * So a body is defined POSITIONALLY: everything from a separator to the next
 * heading or blank line, which is exactly what Markdown treats as one table.
 * Every line in that span must then be a well-formed row; a line that is not
 * one is a reported problem rather than a skipped line.
 *
 * Plural, because a section can legitimately hold more than one table, and each
 * declares its own width. A single-body reader saw 4 of the archive's 60 rows —
 * found by running the checker against the real file rather than its fixtures.
 */
function tableBodies(lines, headingIndex, limit) {
  if (headingIndex < 0) return [];
  const bodies = [];
  let index = headingIndex + 1;
  while (index < limit) {
    if (!SEPARATOR.test(lines[index])) {
      index += 1;
      continue;
    }
    const separator = index;
    let end = separator + 1;
    // A blank line ends a Markdown table; so does the next heading. `HEADING`
    // rather than `startsWith("#")` because a row that lost its leading pipe
    // begins `#001 | ...` — every id row does. Treating that as a heading ended
    // the body one line early and made the damaged row vanish, which is the
    // exact failure the positional reader exists to prevent. An ATX heading
    // requires whitespace after its hashes, so `#001` is not one.
    while (end < limit && lines[end].trim() !== "" && !HEADING.test(lines[end])) end += 1;
    bodies.push({ separator, start: separator + 1, end, width: cells(lines[separator]).length });
    index = end + 1;
  }
  return bodies;
}

/**
 * Runs of pipe-prefixed lines in a section that no table contains.
 *
 * The positional body reader above fixed rows the old detector skipped INSIDE a
 * table. It could still not see a row that fell outside every table — and that
 * is not hypothetical. On `main` the archive section carries blank lines part
 * way down its rows; GFM ends a table at the first blank line, so 56 of the 60
 * archived rows render as a paragraph of literal pipe characters rather than as
 * table rows. Every earlier version of this gate, including the positional one,
 * reported that file as clean and counted 4 archived rows.
 *
 * A row that is not in a table is invisible to a reader and to every check
 * here, so it is reported as its own failure rather than left uncounted.
 */
function orphanRuns(lines, headingIndex, limit, bodies) {
  if (headingIndex < 0) return [];
  const covered = new Set();
  for (const body of bodies) {
    // The header sits directly above the separator and belongs to the table.
    covered.add(body.separator - 1).add(body.separator);
    for (let index = body.start; index < body.end; index += 1) covered.add(index);
  }
  const runs = [];
  for (let index = headingIndex + 1; index < limit; index += 1) {
    if (covered.has(index) || !/^\s*\|/.test(lines[index])) continue;
    const start = index;
    while (index < limit && !covered.has(index) && /^\s*\|/.test(lines[index])) index += 1;
    runs.push({ start, count: index - start });
  }
  return runs;
}

/**
 * The canonical rendering of an id number: zero-padded to at least three
 * digits. `#1` and `#001` are the SAME allocation, so accepting both lets a
 * conflict keep two rows for one number while a string-keyed uniqueness check
 * calls them distinct. Comparing against this form rejects `#1`, `#0001` and
 * `#00042` while still allowing the scheme to grow past `#999`.
 */
export function canonicalId(number) {
  return `#${String(number).padStart(3, "0")}`;
}

export function parseIssues(markdown) {
  const lines = markdown.split("\n");
  const openStart = lines.findIndex((line) => line.startsWith(OPEN_HEADING));
  const archiveStart = lines.findIndex((line) => line.startsWith(ARCHIVE_HEADING));
  const markers = [...markdown.matchAll(new RegExp(MARKER, "g"))];
  const marker = markers[0] ?? null;

  const openLimit = archiveStart >= 0 ? archiveStart : lines.length;
  const bodies = {
    open: tableBodies(lines, openStart, openLimit),
    archive: tableBodies(lines, archiveStart, lines.length),
  };
  const orphans = {
    open: orphanRuns(lines, openStart, openLimit, bodies.open),
    archive: orphanRuns(lines, archiveStart, lines.length, bodies.archive),
  };

  const rows = [];
  for (const [table, blocks] of Object.entries(bodies)) {
    for (const body of blocks) {
      for (let index = body.start; index < body.end; index += 1) {
        const line = lines[index];
        const record = { line: index + 1, table, raw: line };
        // Positional membership, so a row that lost its pipe is still OUR row —
        // and therefore still reportable — rather than something we never saw.
        if (!/^\|/.test(line) || !/\|\s*$/.test(line)) {
          rows.push({
            ...record,
            id: "",
            number: null,
            valid: false,
            cellCount: null,
            expectedCells: body.width,
            shape: "not-a-table-row",
          });
          continue;
        }
        const parsed = cells(line);
        const id = parsed[0] ?? "";
        const number = ID_CELL.test(id) ? Number(id.slice(1)) : null;
        rows.push({
          ...record,
          id,
          number,
          valid: number !== null && id === canonicalId(number),
          cellCount: parsed.length,
          // Each block declares its own width, so a row is checked against the
          // table it is actually in rather than a section-wide assumption.
          expectedCells: body.width,
          shape: "row",
        });
      }
    }
  }

  return {
    openStart,
    archiveStart,
    nextId: marker ? Number(marker[1]) : null,
    markerCount: markers.length,
    rows,
    orphans,
    bodyCount: { open: bodies.open.length, archive: bodies.archive.length },
  };
}

export function checkIssues(markdown) {
  const problems = [];
  const { openStart, archiveStart, nextId, markerCount, rows, orphans, bodyCount } = parseIssues(markdown);

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
      row.shape === "not-a-table-row"
        ? `line ${row.line} (${row.table} table body) is not a table row: ${JSON.stringify(row.raw.slice(0, 60))} — ` +
            "a row that lost its leading or trailing pipe has left the table while still sitting in it"
        : `line ${row.line} (${row.table} table) has a non-canonical id ${JSON.stringify(row.id)} — ` +
            `ids are zero-padded to three digits (${row.number === null ? "#NNN" : canonicalId(row.number)}), ` +
            "so two spellings of one number cannot both exist",
    );
  }

  // Keyed by NUMBER, not by the raw string: `#1` and `#001` are one allocation,
  // and a string key would call them distinct and pass.
  const byId = new Map();
  for (const row of rows.filter((entry) => entry.number !== null)) {
    if (!byId.has(row.number)) byId.set(row.number, []);
    byId.get(row.number).push(row);
  }
  for (const [number, entries] of byId) {
    if (entries.length > 1) {
      problems.push(
        `${canonicalId(number)} appears ${entries.length} times (lines ${entries.map((entry) => entry.line).join(", ")}) — ` +
          "ids are never reused; a collision usually means a merge kept both sides under one number",
      );
    }
  }

  // An item cannot be open and resolved at once. This catches an archive move
  // that copied the row instead of moving it — the shape a reader trusts least,
  // because the two copies then disagree about whether the work is done.
  for (const [number, entries] of byId) {
    const tables = new Set(entries.map((entry) => entry.table));
    if (tables.size > 1) problems.push(`${canonicalId(number)} is in BOTH the open and archive tables`);
  }

  // The marker must lead the whole file, not just the open table: ids are never
  // reused, so an archived row still burns its number.
  const numbered = rows.filter((row) => row.number !== null);
  if (nextId !== null && numbered.length > 0) {
    const highest = Math.max(...numbered.map((row) => row.number));
    if (nextId <= highest) {
      problems.push(
        `issues:next-id=${nextId} is not above the highest id #${String(highest).padStart(3, "0")} — ` +
          "the next allocation would reuse a number that is already taken",
      );
    }
  }

  // Rows stranded outside every table. A blank line mid-table is the usual
  // cause and the least visible one: the rows keep their pipes, so a diff looks
  // ordinary while GFM stops rendering them as a table at that point.
  for (const [table, runs] of Object.entries(orphans)) {
    for (const run of runs) {
      problems.push(
        `line ${run.start + 1} (${table} section) starts ${run.count} pipe row(s) that are outside any table — ` +
          "a blank line above them ends the Markdown table, so they render as literal text and no check here sees them",
      );
    }
  }

  // A section with no separator has no table at all. Reporting it beats
  // skipping: silently skipping is what let a hand edit that deleted a
  // separator pass with every width check disabled for that whole section.
  for (const [table, heading] of [
    ["open", OPEN_HEADING],
    ["archive", ARCHIVE_HEADING],
  ]) {
    if (bodyCount[table] === 0) {
      problems.push(
        `"${heading}" contains no table separator row (\`| --- | --- |\`) — without one the section declares ` +
          "no width, so nothing can check its rows and the Markdown does not render as a table",
      );
    }
  }

  // Column counts, against the width the row's OWN block declares. Per-block
  // rather than per-section because the archive is two tables of different
  // widths; a section-wide expectation would fail all 7-cell rows or all
  // 5-cell ones depending on which separator it happened to read first.
  for (const row of rows.filter((entry) => entry.cellCount !== null)) {
    if (row.cellCount !== row.expectedCells) {
      problems.push(
        `${row.id || "(no id)"} (line ${row.line}, ${row.table} table) has ${row.cellCount} cells, ` +
          `not ${row.expectedCells} — an unescaped \`|\` inside a cell is the usual cause`,
      );
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
    // `#1` and `#001` are ONE allocation. Accepting both spellings lets a
    // conflict keep two rows for one number while a string-keyed uniqueness
    // check calls them distinct and passes.
    // non-canonical + duplicate #001 + in-both-tables: the collision a
    // string-keyed uniqueness check would have called two distinct ids.
    ["a short id that collides with a padded one", good.replace("| #002 | b |", "| #1 | b |"), 3],
    ["an over-padded id", good.replace("| #001 | P2 | a |", "| #0001 | P2 | a |"), 1],
    // Deleting a separator used to disable the width check for its whole table
    // silently — the check had nothing to compare against and skipped.
    ["a deleted separator row", good.replace("| --- | --- | --- |\n", ""), 2], // no table + no rows found
    // A row that loses its leading pipe leaves the table while still sitting in
    // it. Found positionally, so it is reported rather than skipped.
    ["a row that lost its leading pipe", good.replace("| #001 | P2 | a |", "#001 | P2 | a |"), 1],
    ["an indented row", good.replace("| #001 | P2 | a |", "  | #001 | P2 | a |"), 1],
    // The archive's real shape on `main`: a blank line part way down the rows.
    // GFM ends the table there, so everything below renders as literal text.
    // Every earlier version of this gate counted those rows as absent.
    // One problem, not two: the stranded `#003` is deliberately NOT fed to the
    // id and marker checks. It is not in a table, so treating it as a row would
    // report consequences of a structural break as if they were separate
    // content faults. Fix the structure and the row rejoins every check.
    ["a blank line stranding the rows below it", good.replace("| #002 | b |", "| #002 | b |\n\n| #003 | c |"), 1],
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

function effectiveMergeAttribute() {
  const output = execFileSync("git", ["check-attr", "merge", "--", ISSUES_PATH], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  return output.match(/:\s*merge:\s*(\S+)$/)?.[1] ?? "";
}

function main() {
  if (process.argv.includes("--self-test")) {
    selfTest();
    return;
  }
  const markdown = readFileSync(ISSUES_PATH, "utf8");
  const problems = checkIssues(markdown);
  const mergeAttribute = effectiveMergeAttribute();
  // A merge driver on this file is a regression, not an improvement: union
  // concatenated conflicting hunks and duplicated the whole table rather than
  // failing (#133, and four times on PR #1430). Honest conflicts are the
  // contract; ids still need manual renumbering either way.
  if (mergeAttribute && mergeAttribute !== "unspecified" && mergeAttribute !== "unset") {
    problems.push(
      `${ISSUES_PATH} must have NO merge driver (found merge=${mergeAttribute}) — ` +
        "remove it from .gitattributes so overlapping edits conflict loudly instead of " +
        "silently concatenating both sides (ledger #133)",
    );
  }
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
      `unique ids, next-id=${nextId} above the highest, no merge driver.`,
  );
}

if (process.argv[1]?.endsWith("check-outstanding-issues.mjs")) main();
