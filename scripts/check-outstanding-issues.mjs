#!/usr/bin/env node
// Structural gate for docs/outstanding-issues.md.
//
// Ledger #112/#168. The former `issues:next-id` allocator was a plain HTML
// comment that every editor read-modify-wrote with no lock. New rows now carry
// durable ULIDs and collision-extended display locators; a transition marker,
// if still present, is deliberately ignored. A `merge=union` driver was tried (PR
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
//   - a durable ULID or permanent display locator used twice is an identity collision
//   - an id in both tables is an archive move that copied instead of moving
//   - an id absent from both tables relative to the base is a row deletion
//   - a malformed row is usually a hand-edit that broke the column count
//   - a row outside any table is a blank line that silently ended the table
//
//   - a queue ID that is not in Open items is a stale recommended-execution row
//
// Deliberately structural only. It says nothing about whether a row's content
// is right, because that is a judgement a gate cannot make and pretending
// otherwise would make the gate noisy enough to be ignored.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

import {
  canonicalLegacyIssueId,
  isIssueDisplayId,
  issueIdCitations,
  normalizeIssueDisplayId,
  parseIssueIdCell,
} from "./issue-id.mjs";

export const ISSUES_PATH = "docs/outstanding-issues.md";

const OPEN_HEADING = "## Open items";
const ARCHIVE_HEADING = "## Resolved / archive";
const QUEUE_HEADING = "## Recommended execution queue";
const MARKER = /<!--\s*issues:next-id=(\d+)\s*-->/;
const PRETTIER_IGNORE = "<!-- prettier-ignore -->";
const ISSUE_ROW_FINGERPRINT = /^[0-9a-f]{64}$/i;
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

function canonicalTableRow(line) {
  return `| ${cells(line).join(" | ")} |`;
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
 * The canonical rendering of a legacy id number: zero-padded to at least three
 * digits. `#1` and `#001` are the SAME allocation, so accepting both lets a
 * conflict keep two rows for one number while a string-keyed uniqueness check
 * calls them distinct. Comparing against this form rejects `#1`, `#0001` and
 * `#00042` while still allowing the scheme to grow past `#999`.
 */
export function canonicalId(number) {
  return canonicalLegacyIssueId(number);
}

export function parseIssues(markdown) {
  const lines = markdown.split("\n");
  const queueStart = lines.findIndex((line) => line.startsWith(QUEUE_HEADING));
  const openStart = lines.findIndex((line) => line.startsWith(OPEN_HEADING));
  const archiveStart = lines.findIndex((line) => line.startsWith(ARCHIVE_HEADING));
  const markers = [...markdown.matchAll(new RegExp(MARKER, "g"))];
  const marker = markers[0] ?? null;

  const openLimit = archiveStart >= 0 ? archiveStart : lines.length;
  const queueLimit = openStart >= 0 ? openStart : archiveStart >= 0 ? archiveStart : lines.length;
  const bodies = {
    open: tableBodies(lines, openStart, openLimit),
    archive: tableBodies(lines, archiveStart, lines.length),
    queue: tableBodies(lines, queueStart, queueLimit),
  };
  const orphans = {
    open: orphanRuns(lines, openStart, openLimit, bodies.open),
    archive: orphanRuns(lines, archiveStart, lines.length, bodies.archive),
  };

  const rows = [];
  for (const [table, blocks] of Object.entries(bodies)) {
    if (table === "queue") continue;
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
            ulid: null,
            valid: false,
            cellCount: null,
            expectedCells: body.width,
            shape: "not-a-table-row",
          });
          continue;
        }
        const parsed = cells(line);
        const identity = parseIssueIdCell(parsed[0] ?? "");
        rows.push({
          ...record,
          id: identity.id,
          number: identity.number,
          ulid: identity.ulid,
          valid: identity.valid,
          cellCount: parsed.length,
          // Each block declares its own width, so a row is checked against the
          // table it is actually in rather than a section-wide assumption.
          expectedCells: body.width,
          shape: "row",
        });
      }
    }
  }

  /** Queue ID(s) column citations only — never prose elsewhere in the ledger (#201). */
  const queueCitations = [];
  for (const body of bodies.queue) {
    for (let index = body.start; index < body.end; index += 1) {
      const line = lines[index];
      if (!/^\|/.test(line) || !/\|\s*$/.test(line)) continue;
      const parsed = cells(line);
      // Column 0 is Order; column 1 is ID(s). Ignore other cells (evidence prose).
      const idCell = parsed[1] ?? "";
      for (const id of issueIdCitations(idCell)) {
        queueCitations.push({
          line: index + 1,
          id,
        });
      }
    }
  }

  return {
    openStart,
    archiveStart,
    queueStart,
    nextId: marker ? Number(marker[1]) : null,
    markerCount: markers.length,
    rows,
    orphans,
    queueCitations,
    bodyCount: { open: bodies.open.length, archive: bodies.archive.length },
  };
}

// Two id generations coexist in the ledger: legacy zero-padded sequential ids
// (`#001`) and the Crockford display locators minted from a row's ULID
// (`#J912J9`). Rows of both kinds are addressed by display id everywhere else,
// but this lookup resolved only the numeric form — so for every row created
// after the ULID migration it returned null, and `ledger-inbox.mjs` reads a null
// fingerprint as "no such row" and refuses the request. The visible symptom was
// `npm run issues:done '#J912J9'` failing with "is not in Open items" against a
// row plainly present in Open items, which made the optimistic-concurrency check
// unreachable for exactly the rows that have it available (they carry a ULID).
export function issueRowFingerprint(markdown, issueId) {
  const id = normalizeIssueDisplayId(issueId);
  const legacy = id.match(/^#(\d+)$/);
  const number = legacy ? Number(legacy[1]) : null;
  if (legacy) {
    if (!Number.isFinite(number)) return null;
  } else if (!isIssueDisplayId(id)) {
    return null;
  }

  const open = parseIssues(markdown).rows.filter((entry) => entry.table === "open" && entry.valid && entry.raw);
  // Exact display id first, and only then the legacy numeric interpretation.
  // Crockford's alphabet includes 0-9, so a ULID-derived locator can be entirely
  // digits (`#041061`) and is indistinguishable from a legacy id by pattern
  // alone — branching on shape would silently miss exactly those rows. The
  // fallback preserves the old behaviour of resolving a non-canonical legacy id
  // (`#5`) to its zero-padded row, and the exact-id arm preserves
  // `issues:done` closing ULID-suffix display ids minted by reconcile.
  const row = open.find((entry) => entry.id === id) ?? (legacy ? open.find((entry) => entry.number === number) : null);
  if (!row) return null;
  const normalized = `| ${cells(row.raw).join(" | ")} |`;
  return createHash("sha256").update(normalized).digest("hex");
}

export function isValidIssueRowFingerprint(value) {
  return ISSUE_ROW_FINGERPRINT.test(String(value ?? ""));
}

export function checkIssues(markdown, { prettierIgnored = false } = {}) {
  const problems = [];
  const { openStart, archiveStart, markerCount, rows, orphans, bodyCount, queueCitations } = parseIssues(markdown);
  const lines = markdown.split("\n");

  // Prettier pads every Markdown table cell to the widest value in its column.
  // In this long-lived ledger, changing one cell would then rewrite hundreds
  // of unrelated rows and make concurrent merges needlessly conflict.
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\|.*\|\s*$/.test(line) && line !== canonicalTableRow(line)) {
      problems.push(
        `line ${index + 1} is not a compact canonical table row — use one space around each cell delimiter`,
      );
    }
    if (
      !prettierIgnored &&
      /^\|/.test(line) &&
      SEPARATOR.test(lines[index + 1] ?? "") &&
      lines[index - 1]?.trim() !== PRETTIER_IGNORE
    ) {
      problems.push(
        `line ${index + 1} starts a table without ${PRETTIER_IGNORE} immediately above it — ` +
          "formatting would re-pad every row and amplify merge conflicts",
      );
    }
  }

  if (openStart < 0) problems.push(`missing the "${OPEN_HEADING}" heading`);
  if (archiveStart < 0) problems.push(`missing the "${ARCHIVE_HEADING}" heading`);
  if (openStart >= 0 && archiveStart >= 0 && archiveStart < openStart) {
    problems.push(`"${ARCHIVE_HEADING}" appears before "${OPEN_HEADING}"`);
  }
  if (markerCount > 1) {
    problems.push(
      `${markerCount} deprecated <!-- issues:next-id=N --> markers — at most one transition marker is allowed`,
    );
  }
  if (rows.length === 0) problems.push("no outstanding-issue rows found — the parser or the file shape has drifted");

  // Invalid spellings stay visible to every downstream collision check.
  for (const row of rows.filter((entry) => !entry.valid)) {
    problems.push(
      row.shape === "not-a-table-row"
        ? `line ${row.line} (${row.table} table body) is not a table row: ${JSON.stringify(row.raw.slice(0, 60))} — ` +
            "a row that lost its leading or trailing pipe has left the table while still sitting in it"
        : `line ${row.line} (${row.table} table) has a non-canonical id ${JSON.stringify(row.id)} — ` +
            "use a zero-padded legacy #NNN id, or a stored collision-free display id with its derived issue-ulid comment",
    );
  }

  // Display locators are permanent citations, so they must remain unique even
  // though modern rows also carry a durable ULID.
  const byId = new Map();
  for (const row of rows.filter((entry) => entry.valid || entry.number !== null)) {
    const key = row.valid ? row.id : canonicalId(row.number);
    if (!byId.has(key)) byId.set(key, []);
    byId.get(key).push(row);
  }
  for (const [id, entries] of byId) {
    if (entries.length > 1) {
      problems.push(
        `${id} appears ${entries.length} times (lines ${entries.map((entry) => entry.line).join(", ")}) — ` +
          "ids are never reused; a collision usually means a merge kept both sides under one number",
      );
    }
  }

  const byUlid = new Map();
  for (const row of rows.filter((entry) => entry.ulid !== null)) {
    if (!byUlid.has(row.ulid)) byUlid.set(row.ulid, []);
    byUlid.get(row.ulid).push(row);
  }
  for (const [ulid, entries] of byUlid) {
    if (entries.length > 1) {
      problems.push(
        `issue ULID ${ulid} appears ${entries.length} times (lines ${entries.map((entry) => entry.line).join(", ")}) — ` +
          "durable identities are never reused",
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

  // Recommended execution queue may only cite currently open IDs (#201). Parse
  // the ID(s) column alone so archive mentions in evidence prose do not fail.
  const openIds = new Set(rows.filter((row) => row.table === "open" && row.valid).map((row) => row.id));
  for (const citation of queueCitations ?? []) {
    if (!openIds.has(citation.id)) {
      problems.push(
        `recommended queue line ${citation.line} cites ${citation.id} which is not in Open items — ` +
          "prune the queue row or restore the open item; do not treat evidence prose as queue membership",
      );
    }
  }

  return problems;
}

export function prettierIgnoreCoversIssues(prettierIgnore) {
  return prettierIgnore.split(/\r?\n/).some((line) => line.trim() === ISSUES_PATH);
}

/**
 * IDs that existed at the comparison base but disappeared from the current
 * ledger entirely. Moving a row from open to archive keeps its allocation and
 * therefore passes; deleting it from both tables does not.
 */
export function missingIssueIds(baseMarkdown, currentMarkdown) {
  const ids = (markdown) =>
    new Set(
      parseIssues(markdown)
        .rows.filter((row) => row.valid)
        .map((row) => row.id),
    );
  const baseIds = ids(baseMarkdown);
  const currentIds = ids(currentMarkdown);
  return [...baseIds].filter((id) => !currentIds.has(id)).sort();
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? "") : "";
}

function gitOutput(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

/**
 * Resolve the comparison commit without network access. CI supplies the event
 * base explicitly; local feature branches compare with their merge base
 * against the already-fetched origin/main. A checkout with neither source
 * still receives all structural checks, but an explicit unreadable base fails
 * closed instead of silently dropping deletion protection.
 */
function issueBaseRevision() {
  const requested = argumentValue("--base-ref") || process.env.OUTSTANDING_ISSUES_BASE_SHA || "";
  if (requested && !/^0{40}$/.test(requested)) return { ref: requested, required: true };
  try {
    const main = gitOutput(["rev-parse", "--verify", "refs/remotes/origin/main^{commit}"]);
    return { ref: gitOutput(["merge-base", "HEAD", main]), required: false };
  } catch {
    return null;
  }
}

function readIssuesAtRevision(ref) {
  const commit = gitOutput(["rev-parse", "--verify", `${ref}^{commit}`]);
  return execFileSync("git", ["show", `${commit}:${ISSUES_PATH}`], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function selfTest() {
  const good = [
    "<!-- issues:next-id=3 -->",
    "## Recommended execution queue",
    PRETTIER_IGNORE,
    "| Order | ID(s) |",
    "| --- | --- |",
    "| 1 | `#001` |",
    "## Open items",
    PRETTIER_IGNORE,
    "| ID | Pri | Summary |",
    "| --- | --- | --- |",
    "| #001 | P2 | a |",
    "## Resolved / archive",
    PRETTIER_IGNORE,
    "| ID | Summary |",
    "| --- | --- |",
    "| #002 | b |",
  ].join("\n");
  const cases = [
    ["a well-formed file", good, 0],
    [
      "a table without a scoped prettier ignore",
      good.replace(`${PRETTIER_IGNORE}\n| Order | ID(s) |`, "| Order | ID(s) |"),
      1,
    ],
    ["a padded table row", good.replace("| #001 | P2 | a |", "| #001 | P2      | a |"), 1],
    ["a duplicated id", good.replace("| #002 | b |", "| #001 | b |"), 2], // duplicate + both-tables
    ["a stale transition marker", good.replace("next-id=3", "next-id=2"), 0],
    ["a row with a stray pipe", good.replace("| #001 | P2 | a |", "| #001 | P2 | a | b |"), 1],
    ["a removed transition marker", good.replace("<!-- issues:next-id=3 -->", ""), 0],
    // A literal pipe inside a cell is escaped, not a column boundary. The real
    // file has rows like this and an earlier draft of the checker failed them.
    ["an escaped pipe inside a cell", good.replace("| #001 | P2 | a |", "| #001 | P2 | a \\| b |"), 0],
    // Adversarial: a row the id regex cannot parse must FAIL, not disappear.
    // Skipping it would drop the row from duplicate, marker and width checks
    // while the file reported green — the gate claiming more than it does.
    ["a dropped # on an id", good.replace("| #001 | P2 | a |", "| 001 | P2 | a |"), 2],
    ["a letter O for a zero", good.replace("| #001 | P2 | a |", "| #OO1 | P2 | a |"), 2],
    ["an empty id cell", good.replace("| #001 | P2 | a |", "|  | P2 | a |"), 2],
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
    ["an over-padded id", good.replace("| #001 | P2 | a |", "| #0001 | P2 | a |"), 2],
    // Deleting a separator used to disable the width check for its whole table
    // silently — the check had nothing to compare against and skipped.
    ["a deleted separator row", good.replace("| --- | --- | --- |\n", ""), 3], // no table + orphan pipes + queue cites missing open
    // A row that loses its leading pipe leaves the table while still sitting in
    // it. Found positionally, so it is reported rather than skipped.
    ["a row that lost its leading pipe", good.replace("| #001 | P2 | a |", "#001 | P2 | a |"), 2],
    ["an indented row", good.replace("| #001 | P2 | a |", "  | #001 | P2 | a |"), 2],
    // The archive's real shape on `main`: a blank line part way down the rows.
    // GFM ends the table there, so everything below renders as literal text.
    // Every earlier version of this gate counted those rows as absent.
    // One problem, not two: the stranded `#003` is deliberately NOT fed to the
    // id and marker checks. It is not in a table, so treating it as a row would
    // report consequences of a structural break as if they were separate
    // content faults. Fix the structure and the row rejoins every check.
    ["a blank line stranding the rows below it", good.replace("| #002 | b |", "| #002 | b |\n\n| #003 | c |"), 1],
    // #201: queue ID(s) column must cite open items only.
    ["a queue row citing an archived id", good.replace("| 1 | `#001` |", "| 1 | `#002` |"), 1],
    [
      "a modern durable id",
      good
        .replace("`#001`", "`#ABCDEF`")
        .replace("| #001 | P2 | a |", "| #ABCDEF <!-- issue-ulid:0000000000ABCDEF0000000000 --> | P2 | a |"),
      0,
    ],
    [
      "a 26-char Crockford ULID issue id (#DREDWA)",
      good
        .replace("`#001`", "`#DREDWA`")
        .replace(
          "| #001 | P2 | a |",
          "| #DREDWA <!-- issue-ulid:01M09A9WXBDREDWA7KN2EB1JRA --> | P2 | Crockford ULID row |",
        ),
      0,
    ],
    [
      "an all-digit Crockford display id (#041061)",
      good
        .replace("`#001`", "`#041061`")
        .replace(
          "| #001 | P2 | a |",
          "| #041061 <!-- issue-ulid:01M00000000410610123456789 --> | P2 | All-digit Crockford locator |",
        ),
      0,
    ],
    [
      "a modern display id without its durable identity",
      good.replace("`#001`", "`#ABCDEF`").replace("| #001 | P2 | a |", "| #ABCDEF | P2 | a |"),
      2,
    ],
    [
      "a reused modern durable identity",
      good
        .replace("`#001`", "`#ABCDEF`")
        .replace("| #001 | P2 | a |", "| #ABCDEF <!-- issue-ulid:0000000000ABCDEF0000000000 --> | P2 | a |")
        .replace("| #002 | b |", "| #ABCDEF0 <!-- issue-ulid:0000000000ABCDEF0000000000 --> | b |"),
      1,
    ],
    [
      "an invalid 26-char ULID carrying forbidden Crockford characters (I/L/O/U)",
      good.replace(
        "| #001 | P2 | a |",
        "| #DREDWA <!-- issue-ulid:01M09A9WXBDREDWA7KN2EBIJRA --> | P2 | Bad char I in ULID |",
      ),
      2,
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
  const fileWideIgnoreProblems = checkIssues(good.replaceAll(`${PRETTIER_IGNORE}\n`, ""), {
    prettierIgnored: true,
  });
  if (fileWideIgnoreProblems.length !== 0) {
    failures += 1;
    console.error(
      `self-test FAILED: a file-wide prettier ignore replaces scoped table comments — expected 0 problems, got ${fileWideIgnoreProblems.length}`,
    );
  }
  if (!prettierIgnoreCoversIssues(`# ledger files\n${ISSUES_PATH}\n`) || prettierIgnoreCoversIssues("docs/*.md\n")) {
    failures += 1;
    console.error("self-test FAILED: file-wide prettier-ignore detection must require the exact ledger path");
  }
  if (failures > 0) process.exit(1);

  // Validate issueRowFingerprint on legacy numeric IDs and 26-char Crockford ULIDs
  const mixedLedger = [
    "<!-- issues:next-id=3 -->",
    "## Recommended execution queue",
    PRETTIER_IGNORE,
    "| Order | ID(s) |",
    "| --- | --- |",
    "| 1 | `#001` |",
    "| 2 | `#DREDWA` |",
    "| 3 | `#041061` |",
    "## Open items",
    PRETTIER_IGNORE,
    "| ID | Pri | Summary |",
    "| --- | --- | --- |",
    "| #001 | P2 | legacy row |",
    "| #DREDWA <!-- issue-ulid:01M09A9WXBDREDWA7KN2EB1JRA --> | P2 | Crockford ULID row |",
    "| #041061 <!-- issue-ulid:01M00000000410610123456789 --> | P2 | All-digit Crockford locator |",
    "## Resolved / archive",
    PRETTIER_IGNORE,
    "| ID | Summary |",
    "| --- | --- |",
    "| #002 | b |",
  ].join("\n");

  const fpLegacy = issueRowFingerprint(mixedLedger, "#001");
  const fpCrockford = issueRowFingerprint(mixedLedger, "#DREDWA");
  const fpCrockfordLower = issueRowFingerprint(mixedLedger, "#dredwa");
  const fpAllDigit = issueRowFingerprint(mixedLedger, "#041061");
  const fpMissing = issueRowFingerprint(mixedLedger, "#999");
  const fpArchived = issueRowFingerprint(mixedLedger, "#002");

  if (!isValidIssueRowFingerprint(fpLegacy)) {
    failures += 1;
    console.error("self-test FAILED: issueRowFingerprint failed to resolve legacy numeric ID #001");
  }
  if (!isValidIssueRowFingerprint(fpCrockford)) {
    failures += 1;
    console.error("self-test FAILED: issueRowFingerprint failed to resolve 26-char Crockford ULID #DREDWA");
  }
  if (!isValidIssueRowFingerprint(fpCrockfordLower) || fpCrockfordLower !== fpCrockford) {
    failures += 1;
    console.error("self-test FAILED: issueRowFingerprint failed to resolve lowercase Crockford display ID #dredwa");
  }
  if (!isValidIssueRowFingerprint(fpAllDigit)) {
    failures += 1;
    console.error("self-test FAILED: issueRowFingerprint failed to resolve all-digit Crockford locator #041061");
  }
  if (fpMissing !== null) {
    failures += 1;
    console.error("self-test FAILED: issueRowFingerprint must return null for missing ID");
  }
  if (fpArchived !== null) {
    failures += 1;
    console.error("self-test FAILED: issueRowFingerprint must return null for archived ID");
  }
  if (failures > 0) process.exit(1);

  const deletionCases = [
    ["an unchanged id set", good, []],
    ["an open row deleted from both tables", good.replace("| #001 | P2 | a |\n", ""), ["#001"]],
    [
      "an open row moved to the archive",
      good.replace("| #001 | P2 | a |\n", "").replace("| #002 | b |", "| #002 | b |\n| #001 | a |"),
      [],
    ],
    ["a newly allocated row", good.replace("| #001 | P2 | a |", "| #001 | P2 | a |\n| #003 | P3 | c |"), []],
    [
      "a Crockford ULID row deleted from both tables",
      mixedLedger.replace("| #DREDWA <!-- issue-ulid:01M09A9WXBDREDWA7KN2EB1JRA --> | P2 | Crockford ULID row |\n", ""),
      ["#DREDWA"],
    ],
  ];
  for (const [name, current, expected] of deletionCases) {
    // Only compare expected if the base ledger matches the test case
    const base = name.includes("Crockford") ? mixedLedger : good;
    const resolvedActual = missingIssueIds(base, current);
    if (JSON.stringify(resolvedActual) !== JSON.stringify(expected)) {
      failures += 1;
      console.error(`self-test FAILED: ${name} — expected missing ${expected}, got ${resolvedActual}`);
    }
  }
  if (failures > 0) process.exit(1);
  console.log("outstanding-issues self-test passed.");
}

/**
 * The only acceptable state for this file's `merge` attribute.
 *
 * Git distinguishes three non-driver states, and they are NOT interchangeable
 * (see gitattributes, "merge"): *Unspecified* — no pattern matches — is the
 * documented default 3-way text merge, which is the contract here. *Unset*
 * (`-merge`) instead takes the current branch's version and declares the merge
 * conflicted, so every two-sided edit becomes a manual resolution — a different
 * regression from a driver, but a regression all the same, and one a global or
 * future attributes file could introduce while this gate stayed green. A named
 * driver (`union`, `ledger`, …) is the case #133 removed.
 *
 * Exported so the distinction is unit-tested rather than only reasoned about.
 */
export function mergeAttributeProblem(mergeAttribute) {
  if (mergeAttribute === "unspecified") return null;
  if (mergeAttribute === "unset") {
    return (
      `${ISSUES_PATH} must leave \`merge\` unspecified (found \`-merge\`, i.e. Unset) — ` +
      "Unset takes the current branch's version and declares a conflict instead of running the " +
      "default 3-way merge, so drop the negated attribute rather than adding one (ledger #133)"
    );
  }
  return (
    `${ISSUES_PATH} must have NO merge driver (found merge=${mergeAttribute || "empty"}) — ` +
    "remove it from .gitattributes so overlapping edits conflict loudly instead of " +
    "silently concatenating both sides (ledger #133)"
  );
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
  let prettierIgnored = false;
  try {
    prettierIgnored = prettierIgnoreCoversIssues(readFileSync(".prettierignore", "utf8"));
  } catch {
    // Without a file-wide ignore, each table must carry its own scoped comment.
  }
  const problems = checkIssues(markdown, { prettierIgnored });
  const base = issueBaseRevision();
  let checkedBase = null;
  if (base) {
    try {
      const missing = missingIssueIds(readIssuesAtRevision(base.ref), markdown);
      checkedBase = base.ref;
      for (const id of missing) {
        problems.push(
          `${id} existed at base ${base.ref.slice(0, 12)} but is absent from both open and archive tables — ` +
            "move resolved or superseded rows to the archive; never delete their allocation",
        );
      }
    } catch (error) {
      if (base.required) {
        problems.push(
          `could not read ${ISSUES_PATH} at required base ${JSON.stringify(base.ref)} — ` +
            `deletion protection cannot run (${error instanceof Error ? error.message.split("\n")[0] : String(error)})`,
        );
      }
    }
  }
  // A merge driver on this file is a regression, not an improvement: union
  // concatenated conflicting hunks and duplicated the whole table rather than
  // failing (#133, and four times on PR #1430). Honest conflicts are the
  // contract. Immutable inbox requests plus serialized reconciliation remain
  // the only supported way to mutate the canonical ledger.
  const mergeProblem = mergeAttributeProblem(effectiveMergeAttribute());
  if (mergeProblem) problems.push(mergeProblem);
  if (problems.length > 0) {
    console.error(`${ISSUES_PATH} check FAILED:`);
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error(
      "\nIds are never reused. Do not hand-edit or renumber rows after a conflict: preserve immutable " +
        "inbox requests and run one serialized reconciliation from a fresh origin/main base.",
    );
    process.exit(1);
  }
  const { rows, markerCount } = parseIssues(markdown);
  const open = rows.filter((row) => row.table === "open").length;
  console.log(
    `Outstanding-issues guard passed: ${rows.length} rows (${open} open, ${rows.length - open} archived), ` +
      `unique display and durable ids, collision-free allocation enabled` +
      `${markerCount ? ", deprecated next-id marker ignored" : ""}, no merge driver` +
      `${checkedBase ? `, no ids deleted from base ${checkedBase.slice(0, 12)}` : ", deletion baseline unavailable"}.`,
  );
}

if (process.argv[1]?.endsWith("check-outstanding-issues.mjs")) main();
