import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const LEDGER_PATH = "docs/outstanding-issues.md";
const INBOX_DIR = "docs/outstanding-issues-inbox";
const OUTPUT_PATH = "data/outstanding-issues-snapshot.json";
export const SNAPSHOT_VERSION = "outstanding-issues-snapshot-v1";

// Reuse the repo's escape-aware splitter. The ledger contains 8 escaped pipes
// (`\|`); a naive `line.split("|")` turns each into a column boundary and the
// row then fails the arity check as "malformed" when it is perfectly valid.
import { splitCells } from "./outstanding-issues.mjs";

const ID_PATTERN = /#[A-Za-z0-9]+/g;

/**
 * An ID cell is not just an ID. 62 of the ledger's rows carry a trailing HTML
 * comment holding the issue ULID:
 *   `| #SZGPAH <!-- issue-ulid:01M0A10Q19SZGPAH22TYYY2366 --> |`
 * Taking the cell verbatim yields an "id" containing markup, which then fails
 * to match the queue's `#SZGPAH` and silently breaks the queue→row detail join.
 */
function normalizeId(cell) {
  const withoutComments = cell.replace(/<!--[\s\S]*?-->/g, " ");
  const match = withoutComments.match(/#[A-Za-z0-9]+/);
  if (!match) throw new Error(`Row has no parsable ID: ${cell.slice(0, 80)}`);
  return match[0];
}

function tableRowsUnder(markdown, heading, expectedColumns) {
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start === -1) throw new Error(`Ledger is missing the "${heading}" heading.`);
  const rows = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith("## ")) break;
    if (!line.trim().startsWith("|")) continue;
    const cells = splitCells(line).map((cell) => cell.trim());
    // Per-row header detection, NOT a one-shot flag: `## Resolved / archive`
    // holds three separate tables, and the 2nd and 3rd header rows have the
    // same cell count as data rows, so a one-shot flag counts them as items.
    if (cells[0] === "ID" || cells[0] === "Order") continue;
    if (cells.every((cell) => /^:?-{2,}:?$/.test(cell))) continue;
    if (cells.length !== expectedColumns) {
      throw new Error(
        `Malformed row under "${heading}" at line ${index + 1}: expected ${expectedColumns} cells, got ${cells.length} — ${line.slice(0, 80)}`,
      );
    }
    rows.push(cells);
  }
  return rows;
}

export function buildSnapshot({ ledgerMarkdown, inboxRecords, revision }) {
  const openRows = tableRowsUnder(ledgerMarkdown, "## Open items", 7).map((cells) => ({
    id: normalizeId(cells[0]),
    priority: cells[1],
    type: cells[2],
    summary: cells[3],
    detail: cells[4],
    source: cells[5],
    added: cells[6],
  }));

  const detailById = new Map(openRows.map((row) => [row.id, row.detail]));

  const queue = tableRowsUnder(ledgerMarkdown, "## Recommended execution queue", 7).map((cells) => {
    const ids = cells[1].match(ID_PATTERN) ?? [];
    // Prose comes from the cited row's own Detail cell. `issues-report.mjs`
    // does the same after the queue's independent copy drifted and spent days
    // pointing at an approach its row had already refuted. A composite ID cell
    // has no single row to speak for it, so it keeps the queue's Outcome cell.
    const detail = ids.length === 1 && detailById.has(ids[0]) ? detailById.get(ids[0]) : cells[6];
    return {
      order: Number(cells[0]),
      ids,
      acuity: cells[2],
      capability: cells[3],
      timing: cells[4],
      estimate: cells[5],
      detail,
    };
  });

  const resolvedCount = tableRowsUnder(ledgerMarkdown, "## Resolved / archive", 5).length;

  /**
   * Only `add` requests carry `summary`. An `update` request carries the target
   * row's `id` plus a `detail`, and a `done` request carries an `outcome`, so
   * reading `summary` alone renders those as blank rows on the hub — which is
   * under-reporting outstanding work, the exact failure this feature exists to
   * prevent. Fall back through the fields each action actually has, and prefix
   * the target id so an update reads as being about a specific row.
   */
  const pending = inboxRecords.map((record) => {
    const payload = record.payload ?? {};
    const body = payload.summary || payload.detail || payload.outcome || "";
    const target = payload.id ? `${payload.id}: ` : "";
    return {
      request_id: record.id,
      action: record.action,
      summary: body ? `${target}${body}` : `${target}(no summary in the ${record.action} request)`,
      created_at: record.createdOn ?? null,
    };
  });

  const countBy = (priority) => openRows.filter((row) => row.priority === priority).length;

  return {
    version: SNAPSHOT_VERSION,
    ledger_revision: revision,
    counts: {
      open: openRows.length,
      p1: countBy("P1"),
      p2: countBy("P2"),
      p3: countBy("P3"),
      queued: queue.length,
      pending: pending.length,
      resolved: resolvedCount,
    },
    queue,
    open: openRows,
    pending,
  };
}

export function readInboxRecords(dir = INBOX_DIR) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => JSON.parse(readFileSync(join(dir, entry.name), "utf8")));
}

export function readLedgerRevision(path = LEDGER_PATH) {
  try {
    const output = execFileSync("git", ["log", "-1", "--format=%H%x09%cI", "--", path], { encoding: "utf8" }).trim();
    if (!output) return null;
    const [sha, committed_at] = output.split("\t");
    return { sha, committed_at };
  } catch {
    return null;
  }
}

export function generate() {
  return buildSnapshot({
    ledgerMarkdown: readFileSync(LEDGER_PATH, "utf8"),
    inboxRecords: readInboxRecords(),
    revision: readLedgerRevision(),
  });
}

// Windows-safe main-module check, matching the convention used elsewhere in
// scripts/ (e.g. build-worker.mjs): a manual `file://${argv[1]}` string
// reconstruction never matches `import.meta.url` on Windows, because a
// relative argv[1] stays relative and an absolute one is missing the
// drive-letter leading slash — the guard would silently never fire and the
// file would never be written.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(generate(), null, 2)}\n`, "utf8");
  console.log(`[snapshot] wrote ${OUTPUT_PATH}`);
}
