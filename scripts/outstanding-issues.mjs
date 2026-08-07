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
// still pick the same number. That is ledger #156 / #168 territory and needs a
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

const OPEN_CELLS = 10;
// ID | Type | Priority/status | Group/main issue | Before starting | Codex |
// Checks/CI | External input/time | Done when | collapsed details (context/source/added)
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

function escapeHtmlText(value) {
  return escapeCell(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function unescapeHtmlText(value) {
  return String(value)
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")
    .replace(/\\\|/g, "|");
}

function priorityStatusCell(pri, status) {
  return `<strong>${escapeHtmlText(pri)}</strong><br>${escapeHtmlText(status)}`;
}

function parsePriorityStatusCell(cell) {
  const match = cell.match(/^<strong>(.*?)<\/strong><br>(.*)$/);
  if (!match) throw new Error("open row has a malformed priority/status cell");
  return { pri: unescapeHtmlText(match[1]), status: unescapeHtmlText(match[2]) };
}

function mainIssueCell(group, summary) {
  return `<strong>${escapeHtmlText(group)}</strong><br>${escapeHtmlText(summary)}`;
}

function parseMainIssueCell(cell) {
  const match = cell.match(/^<strong>(.*?)<\/strong><br>(.*)$/);
  if (!match) throw new Error("open row has a malformed group/main-issue cell");
  return { group: unescapeHtmlText(match[1]), summary: unescapeHtmlText(match[2]) };
}

function detailsCell(detail, source, added) {
  return (
    "<details><summary>Evidence</summary>" +
    `<strong>Context:</strong> ${escapeHtmlText(detail)}<br>` +
    `<strong>Source:</strong> ${escapeHtmlText(source)}<br>` +
    `<strong>Added:</strong> ${escapeHtmlText(added)}</details>`
  );
}

function parseDetailsCell(cell) {
  const match = cell.match(
    /^<details><summary>Evidence<\/summary><strong>Context:<\/strong> (.*?)<br><strong>Source:<\/strong> (.*?)<br><strong>Added:<\/strong> (.*?)<\/details>$/,
  );
  if (!match) throw new Error("open row has a malformed collapsed evidence cell");
  return {
    detail: unescapeHtmlText(match[1]),
    source: unescapeHtmlText(match[2]),
    added: unescapeHtmlText(match[3]),
  };
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

function isQueueHeaderRow(cells) {
  return /^Order$/i.test((cells[0] ?? "").trim());
}

function isQueueSeparatorRow(cells) {
  return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell.replace(/\s/g, "")) || cell.trim() === "");
}

/**
 * Remove a resolved id from the recommended-execution queue (#201 + /issues done).
 *
 * - Drops the id from a composite ID(s) cell and keeps the row when siblings remain.
 * - Deletes the whole queue row when no cited open id remains.
 * - Renumbers Order 1..N to close gaps (skill contract).
 */
export function pruneResolvedIdFromQueue(markdown, id) {
  const target = Number(String(id).replace(/^#/, ""));
  if (!Number.isFinite(target)) return markdown;

  const lines = markdown.split("\n");
  const queueStart = lines.findIndex((line) => line.startsWith("## Recommended execution queue"));
  if (queueStart < 0) return markdown;
  const openStart = lines.findIndex((line) => line.startsWith("## Open items"));
  const archiveStart = lines.findIndex((line) => line.startsWith("## Resolved / archive"));
  const limit = openStart >= 0 ? openStart : archiveStart >= 0 ? archiveStart : lines.length;

  // Walk bottom-up so splice indices stay valid while deleting.
  for (let index = limit - 1; index > queueStart; index -= 1) {
    const line = lines[index];
    if (!/^\|/.test(line) || !/\|\s*$/.test(line)) continue;
    const cells = splitCells(line);
    if (cells.length < 2 || isQueueHeaderRow(cells) || isQueueSeparatorRow(cells)) continue;

    const idCell = cells[1] ?? "";
    const cited = [...idCell.matchAll(/#(\d+)/g)].map((match) => Number(match[1]));
    if (!cited.includes(target)) continue;

    const remaining = cited.filter((number) => number !== target);
    if (remaining.length === 0) {
      lines.splice(index, 1);
      continue;
    }
    cells[1] = remaining.map((number) => `\`${canonicalId(number)}\``).join(", ");
    lines[index] = buildRow(cells);
  }

  // Close Order gaps after deletions/edits. Recompute the section boundary:
  // every deletion above shifted the headings' indices down.
  const nextOpenStart = lines.findIndex((line) => line.startsWith("## Open items"));
  const nextArchiveStart = lines.findIndex((line) => line.startsWith("## Resolved / archive"));
  const renumberLimit = nextOpenStart >= 0 ? nextOpenStart : nextArchiveStart >= 0 ? nextArchiveStart : lines.length;
  let order = 1;
  for (let index = queueStart + 1; index < renumberLimit; index += 1) {
    const line = lines[index];
    if (!/^\|/.test(line) || !/\|\s*$/.test(line)) continue;
    const cells = splitCells(line);
    if (cells.length < 2 || isQueueHeaderRow(cells) || isQueueSeparatorRow(cells)) continue;
    cells[0] = String(order);
    lines[index] = buildRow(cells);
    order += 1;
  }

  return lines.join("\n");
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
    const added = today(options);
    const row = buildRow([
      id,
      type,
      priorityStatusCell(pri, fields.status ?? "Open — revalidate"),
      mainIssueCell(fields.group ?? "Needs classification", fields.summary),
      escapeCell(fields.before ?? "Revalidate current main."),
      escapeCell(fields.codex ?? "Estimate before start"),
      escapeCell(fields.checks ?? "Select by changed risk"),
      escapeCell(fields.external ?? "None identified"),
      escapeCell(fields.done ?? "Acceptance criteria in context"),
      detailsCell(fields.detail ?? "", fields.source ?? `session ${added}`, added),
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
    // Open retains planning and evidence fields; archive keeps only identity,
    // type, the main issue/build summary, the actual outcome and resolution date.
    const mainIssue = parseMainIssueCell(cells[3]);
    const archived = buildRow([cells[0], cells[1], escapeCell(mainIssue.summary), escapeCell(outcome), today(options)]);
    if (splitCells(archived).length !== ARCHIVE_CELLS) {
      throw new Error(`built an archive row with ${splitCells(archived).length} cells, expected ${ARCHIVE_CELLS}`);
    }

    const lines = current.split("\n");
    lines.splice(row.line - 1, 1);
    // Prune the queue before re-parsing so #201 does not refuse the write when
    // the ID(s) cell still cites the id we just moved to archive.
    const withoutOpen = pruneResolvedIdFromQueue(lines.join("\n"), id);
    const afterRemoval = parseIssues(withoutOpen);
    const nextLines = withoutOpen.split("\n");
    const anchor = lastRowIndex(afterRemoval, "archive");
    if (anchor === null) throw new Error("the archive table has no rows to append after");
    nextLines.splice(anchor + 1, 0, archived);
    return nextLines.join("\n");
  });
}

export function updateIssue(markdown, id, fields) {
  const editable = ["status", "group", "summary", "before", "codex", "checks", "external", "done", "detail", "source"];
  const requested = editable.filter((key) => fields[key] !== undefined);
  if (requested.length === 0) {
    throw new Error(
      "pass at least one editable field (status, group, summary, before, codex, checks, external, done, detail, source)",
    );
  }

  return guarded(markdown, (current) => {
    const parsed = parseIssues(current);
    const row = findRow(parsed, id);
    if (!row) throw new Error(`${id} is not in ${ISSUES_PATH}`);
    if (row.table !== "open") throw new Error(`${id} is archived; archived rows are history and are not edited`);

    const cells = splitCells(row.raw);
    const priorityStatus = parsePriorityStatusCell(cells[2]);
    const mainIssue = parseMainIssueCell(cells[3]);
    const details = parseDetailsCell(cells[9]);
    cells[2] = priorityStatusCell(priorityStatus.pri, fields.status ?? priorityStatus.status);
    cells[3] = mainIssueCell(fields.group ?? mainIssue.group, fields.summary ?? mainIssue.summary);
    if (fields.before !== undefined) cells[4] = escapeCell(fields.before);
    if (fields.codex !== undefined) cells[5] = escapeCell(fields.codex);
    if (fields.checks !== undefined) cells[6] = escapeCell(fields.checks);
    if (fields.external !== undefined) cells[7] = escapeCell(fields.external);
    if (fields.done !== undefined) cells[8] = escapeCell(fields.done);
    cells[9] = detailsCell(fields.detail ?? details.detail, fields.source ?? details.source, details.added);
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
    "<!-- issues:next-id=17 -->",
    "",
    "## Recommended execution queue",
    "",
    "<!-- prettier-ignore -->",
    "",
    "| Order | ID(s) | Acuity | Capability | When | Estimate | Outcome |",
    "| ----: | -------------- | -------- | --- | --- | --- | --- |",
    "| 1 | `#005` | A2 | High | now | 1h | solo |",
    "| 2 | `#013`, `#016` | A3 | High | later | 1d | composite |",
    "| 3 | `#006` | A3 | High | later | 1h | trailing |",
    "",
    "## Open items",
    "",
<<<<<<< HEAD
    "| ID | Pri | Type | Summary | Detail / next action | Source | Added |",
    "| ---- | --- | ---- | ---- | ---- | ---- | ---- |",
    "| #005 | P2 | issue | first | detail one | src | 2026-01-01 |",
    "| #006 | P3 | task | second | detail two | src | 2026-01-02 |",
    "| #013 | P3 | task | left | detail | src | 2026-01-03 |",
    "| #016 | P3 | task | right | detail | src | 2026-01-04 |",
=======
    "| ID | Type | Priority / status | Group / main issue | Before starting | Codex | Checks / CI | External input / time | Done when | Details |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    "| #005 | issue | <strong>P2</strong><br>Ready | <strong>Test</strong><br>first | None | 1h | 5m | None | first is fixed | <details><summary>Evidence</summary><strong>Context:</strong> detail one<br><strong>Source:</strong> src<br><strong>Added:</strong> 2026-01-01</details> |",
    "| #006 | task | <strong>P3</strong><br>Open | <strong>Test</strong><br>second | Revalidate | 2h | 10m | None | second is done | <details><summary>Evidence</summary><strong>Context:</strong> detail two<br><strong>Source:</strong> src<br><strong>Added:</strong> 2026-01-02</details> |",
>>>>>>> origin/codex/issue-ledger-audit-findings-20260805
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
    addedParsed.rows.some((r) => r.id === "#017" && r.table === "open"),
  );
  check("add bumps the marker", addedParsed.nextId === 18);
  check("add appends after the last open row", added.indexOf("#017") > added.indexOf("#016"));
  check("add stays out of the archive", !addedParsed.rows.some((r) => r.id === "#017" && r.table === "archive"));

  // The wrong-table failure that motivated this writer: appending must not land
  // in the archive even though an archived row sits later in the file.
  check("add lands before the archive heading", added.indexOf("| #017 ") < added.indexOf("## Resolved / archive"));

  // escaping: a pipe in prose must not become a column.
  const piped = addIssue(
    fixture,
    { pri: "P2", type: "task", summary: "a | b", detail: "c | d" },
    { date: "2026-02-02" },
  );
  const pipedRow = parseIssues(piped).rows.find((r) => r.id === "#017");
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
  // #201: resolving must prune the queue so guarded() does not refuse the write.
  check("done drops solo queue row for #005", !resolved.includes("`#005`"));
  check("done renumbers remaining queue orders", /\|\s*1\s*\|\s*`#013`/.test(resolved));
  check("done keeps composite sibling after solo prune", resolved.includes("`#016`"));

  // Composite queue cell: remove only the resolved id, keep the sibling.
  const composite = resolveIssue(fixture, "#013", "Resolved left side", { date: "2026-03-04" });
  check("done keeps composite sibling id", /`#016`/.test(composite) && !/`#013`/.test(composite));
  check("done does not drop the composite queue row", composite.includes("composite"));

  // Multi-row queue prune must not walk into Open items with a stale boundary
  // (Devin: Order renumber overwrote the open ID header after enough deletions).
  const multiQueue = [
    "# Outstanding",
    "",
    "<!-- issues:next-id=17 -->",
    "",
    "## Recommended execution queue",
    "",
    "<!-- prettier-ignore -->",
    "",
    "| Order | ID(s) | Acuity | Capability | When | Estimate | Outcome |",
    "| ----: | --- | --- | --- | --- | --- | --- |",
    "| 1 | `#005` | A2 | High | now | 1h | a |",
    "| 2 | `#005` | A2 | High | now | 1h | b |",
    "| 3 | `#005` | A2 | High | now | 1h | c |",
    "| 4 | `#005` | A2 | High | now | 1h | d |",
    "| 5 | `#005` | A2 | High | now | 1h | e |",
    "| 6 | `#005` | A2 | High | now | 1h | f |",
    "",
    "",
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
  const multiResolved = resolveIssue(multiQueue, "#005", "Resolved multi-queue", { date: "2026-03-05" });
  check("multi-queue prune keeps open ID header", multiResolved.includes("| ID | Pri | Type | Summary |"));
  check("multi-queue prune does not order-stamp open header", !/\|\s*1\s*\|\s*Pri\s*\|/.test(multiResolved));
  check(
    "multi-queue prune still archives #005",
    parseIssues(multiResolved).rows.some((r) => r.id === "#005" && r.table === "archive"),
  );

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
        status: argValue(argv, "status"),
        group: argValue(argv, "group"),
        summary: argValue(argv, "summary"),
        before: argValue(argv, "before"),
        codex: argValue(argv, "codex"),
        checks: argValue(argv, "checks"),
        external: argValue(argv, "external"),
        done: argValue(argv, "done"),
        detail: argValue(argv, "detail"),
        source: argValue(argv, "source"),
      });
    } else if (command === "done") {
      next = resolveIssue(markdown, positional, argValue(argv, "outcome"));
    } else if (command === "update") {
      next = updateIssue(markdown, positional, {
        status: argValue(argv, "status"),
        group: argValue(argv, "group"),
        summary: argValue(argv, "summary"),
        before: argValue(argv, "before"),
        codex: argValue(argv, "codex"),
        checks: argValue(argv, "checks"),
        external: argValue(argv, "external"),
        done: argValue(argv, "done"),
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
