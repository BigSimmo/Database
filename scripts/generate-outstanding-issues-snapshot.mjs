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
 * `\|` is a markdown-table artifact: a pipe has to be escaped inside a cell or
 * it becomes a column boundary. JSON has no such rule, so carrying the escape
 * into the data contract means every consumer renders a literal `\|` to the
 * reader — which is what the ledger page did for `#SZGPAH` ("2 failed \| 14
 * passed").
 *
 * This unescape belongs HERE and not in `splitCells` (scripts/outstanding-issues.mjs).
 * That splitter deliberately preserves `\|` because the ledger tooling
 * round-trips cells back into markdown; unescaping there would emit a bare pipe
 * into a table row and corrupt `issues:reconcile`. The snapshot is a one-way
 * export, so it is the right place to drop the escape.
 */
function unescapeCell(cell) {
  return cell.replace(/\\\|/g, "|");
}

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
    // Split first (escape-aware, so `\|` is not a column boundary), then drop
    // the escape — the JSON this feeds needs no pipe escaping.
    const cells = splitCells(line).map((cell) => unescapeCell(cell.trim()));
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
   * Give each inbox action the context its payload carries. The developer hub
   * is a task ledger, so a valid priority-only/source-only update or a
   * cancellation must not collapse into the fallback message.
   */
  const pending = inboxRecords.map((record) => {
    const payload = record.payload ?? {};
    const target = payload.id ? `${payload.id}: ` : "";
    let summary;

    if (record.action === "update") {
      const changes = [
        payload.summary !== undefined ? `summary → ${payload.summary || "(clear)"}` : null,
        payload.detail !== undefined ? `detail → ${payload.detail || "(clear)"}` : null,
        payload.pri !== undefined ? `priority → ${payload.pri}` : null,
        payload.source !== undefined ? `source → ${payload.source || "(clear)"}` : null,
      ].filter(Boolean);
      summary = changes.length > 0 ? `${target}${changes.join("; ")}` : `${target}(no change in the update request)`;
    } else if (record.action === "cancel") {
      const request = payload.requestId ? `Cancel request ${payload.requestId}` : "Cancel request";
      summary = `${request}: ${payload.reason || "(no reason in the cancel request)"}`;
    } else {
      const body = payload.summary || payload.detail || payload.outcome || "";
      summary = body ? `${target}${body}` : `${target}(no summary in the ${record.action} request)`;
    }

    return {
      request_id: record.id,
      action: record.action,
      summary,
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

/**
 * The revision already recorded in the committed snapshot, or `null` if there
 * is none to read. Shape-checked rather than taken verbatim: a malformed field
 * carried forward would reach `resolveFreshness`, which does date arithmetic on
 * `committed_at`, and a confident-looking stamp carrying nonsense is the exact
 * failure `FreshnessStamp` exists to prevent.
 */
export function readCommittedRevision(path = OUTPUT_PATH) {
  try {
    const revision = JSON.parse(readFileSync(path, "utf8")).ledger_revision;
    if (typeof revision?.sha !== "string" || typeof revision?.committed_at !== "string") return null;
    return { sha: revision.sha, committed_at: revision.committed_at };
  } catch {
    return null;
  }
}

/**
 * The production image has no git repository. `.dockerignore` excludes `.git`,
 * the build stage does `COPY . .`, and `prebuild` then regenerates this
 * snapshot inside that image — so `readLedgerRevision()` shells out to `git
 * log`, fails, and returns `null`. Writing that `null` over a perfectly good
 * committed revision is how `FreshnessStamp` came to take its "Ledger revision
 * unknown" branch permanently in the one environment `#338` actually failed in:
 * the page could no longer state its own age, which is spec §6.3.
 *
 * So keep the committed revision when git cannot speak, and fall through to
 * `null` only when there is no snapshot to preserve from. This is fail-safe in
 * the same direction `check-outstanding-issues-snapshot.mjs` already documents:
 * a revision that lags reality can only make the page report itself as OLDER
 * than it is, never fresher.
 *
 * It cannot mask stale CONTENT. `ledger_revision` feeds nothing else in
 * `buildSnapshot` — `counts`, `queue`, `open` and `pending` are derived solely
 * from the ledger markdown and the inbox — and the gate compares those, having
 * deliberately excluded `ledger_revision` from the comparison already.
 */
/**
 * The pointer is MONOTONIC: it may lag reality, but it must never move
 * backwards. Regenerating from a stale base makes `git log` return an older
 * commit than the one already recorded, and writing that over the committed
 * value silently discards a newer pointer with nothing to detect it. That is
 * not hypothetical - commit `ca376969b` rolled this field from a 2026-08-25
 * revision back to a 2026-08-22 one, and it was found by accident two days
 * later while verifying an unrelated merge (ledger `#BR2217`).
 *
 * The rule below only ever REFUSES a move it can PROVE is backwards. If either
 * timestamp is missing or unparseable the fresh git read wins, exactly as
 * before, because an unprovable comparison must not change behaviour. This
 * keeps the existing fail-safe direction intact: the pointer can still report
 * itself as older than reality, never fresher.
 */
export function resolveMonotonicRevision(fromGit, committed) {
  if (!fromGit) return committed ?? null;
  if (!committed) return fromGit;
  const candidateAt = Date.parse(fromGit.committed_at);
  const committedAt = Date.parse(committed.committed_at);
  if (!Number.isFinite(candidateAt) || !Number.isFinite(committedAt)) return fromGit;
  return candidateAt < committedAt ? committed : fromGit;
}

function resolveRevision({ ledgerPath = LEDGER_PATH, snapshotPath = OUTPUT_PATH } = {}) {
  return resolveMonotonicRevision(readLedgerRevision(ledgerPath), readCommittedRevision(snapshotPath));
}

/**
 * `includePending` defaults to FALSE, and that default is the point.
 *
 * `pending` is the one section derived from `docs/outstanding-issues-inbox/`
 * rather than from the canonical ledger, so its value depends on every OTHER
 * branch's queued requests. Writing it into the committed artefact is what made
 * two concurrent ledger PRs conflict on a file neither of them was really
 * changing (`#Y090R5`; PR #2284 conflicted twice in an hour and was closed
 * rather than untangled). `check-outstanding-issues-snapshot.mjs` already
 * excludes `pending` and `counts.pending` from comparison for exactly that
 * reason — but excluding a field from the gate never stopped it conflicting in
 * git, because the bytes still shipped. With eight requests queued, a plain
 * `npm run docs:update` or `npm run build` rewrote the committed `pending` and
 * re-armed the conflict for whoever committed the result.
 *
 * So the committed artefact carries an empty `pending`, and only the caller
 * that needs the live list asks for it: `prebuild` passes `--with-pending`, so
 * the Docker image — which regenerates this file during `next build` — still
 * shows the developer hub the true set of unapplied requests. Nothing a reader
 * sees is lost; what is lost is a conflict in a file nobody was editing.
 */
export function generate({
  ledgerPath = LEDGER_PATH,
  inboxDir = INBOX_DIR,
  snapshotPath = OUTPUT_PATH,
  includePending = false,
} = {}) {
  return buildSnapshot({
    ledgerMarkdown: readFileSync(ledgerPath, "utf8"),
    inboxRecords: includePending ? readInboxRecords(inboxDir) : [],
    revision: resolveRevision({ ledgerPath, snapshotPath }),
  });
}

// Windows-safe main-module check, matching the convention used elsewhere in
// scripts/ (e.g. build-worker.mjs): a manual `file://${argv[1]}` string
// reconstruction never matches `import.meta.url` on Windows, because a
// relative argv[1] stays relative and an absolute one is missing the
// drive-letter leading slash — the guard would silently never fire and the
// file would never be written.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Only `prebuild` passes this. See `generate()` for why the committed file
  // deliberately carries an empty `pending`.
  const includePending = process.argv.slice(2).includes("--with-pending");
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(generate({ includePending }), null, 2)}\n`, "utf8");
  console.log(`[snapshot] wrote ${OUTPUT_PATH}${includePending ? " (with pending inbox requests)" : ""}`);
}
