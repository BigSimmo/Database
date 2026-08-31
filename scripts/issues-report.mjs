#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { parseIssues } from "./check-outstanding-issues.mjs";
import { issueIdCitations } from "./issue-id.mjs";
import { splitCells } from "./outstanding-issues.mjs";

const LEDGER_PATH = "docs/outstanding-issues.md";

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

function tryGit(args, cwd) {
  try {
    return git(args, cwd);
  } catch {
    return undefined;
  }
}

function queueRows(markdown) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith("## Recommended execution queue"));
  if (start < 0) return [];
  const rows = [];
  for (let index = start + 1; index < lines.length && !lines[index].startsWith("## "); index += 1) {
    if (!/^\|\s*\d+\s*\|/.test(lines[index])) continue;
    const cells = splitCells(lines[index]);
    if (cells.length !== 7) continue;
    rows.push({
      order: Number(cells[0]),
      ids: issueIdCitations(cells[1]),
      acuity: cells[2],
      capability: cells[3],
      when: cells[4],
      estimate: cells[5],
      outcome: cells[6],
    });
  }
  return rows;
}

function maximumHours(estimate) {
  if (/\b(?:day|week|month|blocked|corpus|provider-gated)\b/i.test(estimate)) return null;
  const hours = [...estimate.matchAll(/(\d+(?:\.\d+)?)\s*(?:-|–|to)?\s*(\d+(?:\.\d+)?)?\s*hours?/gi)];
  if (hours.length === 0) {
    const minutes = [...estimate.matchAll(/(\d+)\s*(?:-|–|to)?\s*(\d+)?\s*min/gi)];
    return minutes.length ? Math.max(...minutes.map((match) => Number(match[2] ?? match[1]) / 60)) : null;
  }
  return Math.max(...hours.map((match) => Number(match[2] ?? match[1])));
}

export function classifyAgentSafeWins(rows) {
  return rows.filter((row) => {
    const combined = `${row.capability} ${row.when} ${row.estimate} ${row.outcome}`;
    const hours = maximumHours(row.estimate);
    return (
      hours !== null &&
      hours <= 4 &&
      !/\boperator\b/i.test(row.capability) &&
      !/\b(?:provider|live |production|staging|hosted.?ci|ci.?uploaded|human (?:decision|review)|owner decides?|approval|rag|retrieval|clinical|design.?owner|do not close automatically|the decision is a human|not for agents?|human.?only|requires? human|awaiting? (?:owner|human|operator)|operator decision)\b/i.test(
        combined,
      )
    );
  });
}

export function isWardFlowRow(row) {
  if (!row) return false;
  const summary = String(row.summary ?? "");
  const outcome = String(row.outcome ?? "");
  return /^ward flow\b/i.test(summary) || /^ward flow\b/i.test(outcome);
}

export function buildIssuesReport(markdown, source, options = {}) {
  const parsed = parseIssues(markdown);
  const queue = queueRows(markdown);
  let openRows = parsed.rows
    .filter((row) => row.table === "open")
    .map((row) => {
      const cells = splitCells(row.raw);
      return {
        // parseIssues strips the durable ULID comment from the human-facing id.
        id: row.id,
        priority: cells[1],
        type: cells[2],
        summary: cells[3],
        detail: cells[4],
        source: cells[5],
        added: cells[6],
      };
    });
  // Report each queue row's prose from the cited row's own Detail cell rather
  // than the queue's Outcome cell. They were independent copies of the same
  // prose and drifted, and since this report is what /issues reads back, the
  // drifted copy was the one acted on — the #231 queue cell spent days pointing
  // at an approach that row had already refuted. The queue cell cannot be
  // re-corrected in place (no inbox request type reaches it, and
  // check:ledger-write-discipline rejects a direct edit), so the duplication is
  // removed at the point of use instead. Order, acuity, capability, when and
  // estimate stay from the queue, which is the only place they exist.
  const detailById = new Map(openRows.map((row) => [row.id, row.detail]));
  let derived = queue.map((row) => {
    // A composite ID(s) cell has no single row to speak for it; keep the queue
    // text there rather than arbitrarily picking one of the cited rows.
    if (row.ids.length !== 1) return row;
    const detail = detailById.get(row.ids[0]);
    return detail ? { ...row, outcome: detail } : row;
  });

  if (options.ward) {
    const isWard = (row) => isWardFlowRow(row);
    const wardOpenIds = new Set(openRows.filter(isWard).map((r) => r.id));
    openRows = openRows.filter(isWard);
    derived = derived.filter((row) => isWard(row) || (row.ids && row.ids.some((id) => wardOpenIds.has(id))));
  } else if (options.core) {
    const isWard = (row) => isWardFlowRow(row);
    const wardOpenIds = new Set(openRows.filter(isWard).map((r) => r.id));
    openRows = openRows.filter((r) => !isWard(r));
    derived = derived.filter((row) => !isWard(row) && !(row.ids && row.ids.some((id) => wardOpenIds.has(id))));
  } else if (options.filter) {
    const term = String(options.filter).toLowerCase();
    const matches = (r) =>
      Boolean(
        (r.summary && String(r.summary).toLowerCase().includes(term)) ||
        (r.detail && String(r.detail).toLowerCase().includes(term)) ||
        (r.outcome && String(r.outcome).toLowerCase().includes(term)) ||
        (r.id && String(r.id).toLowerCase().includes(term)) ||
        (r.ids && r.ids.some((id) => String(id).toLowerCase().includes(term))),
      );
    const matchingOpenIds = new Set(openRows.filter(matches).map((r) => r.id));
    openRows = openRows.filter(matches);
    derived = derived.filter((row) => matches(row) || (row.ids && row.ids.some((id) => matchingOpenIds.has(id))));
  }

  return {
    source,
    counts: { open: openRows.length, recommended: derived.length },
    priorityBlockers: derived.filter((row) => row.acuity === "A1"),
    recommended: derived,
    open: openRows,
    // Keep queue-only stop conditions in the safe-win classifier. `derived` is
    // presentation text, while the queue outcome also carries safety gates that
    // may not appear in the cited row's Detail cell.
    agentSafeWins: classifyAgentSafeWins(queue),
  };
}

export function loadRevalidatedLedger(cwd = process.cwd()) {
  const branch = tryGit(["branch", "--show-current"], cwd) || "(detached)";
  const counts = tryGit(["rev-list", "--left-right", "--count", "origin/main...HEAD"], cwd);
  const [behind, ahead] = counts ? counts.split(/\s+/).map(Number) : [null, null];
  const gitPath = LEDGER_PATH.replace(/\\/g, "/");
  const remoteLedger = tryGit(["show", `origin/main:${gitPath}`], cwd);
  if (remoteLedger !== undefined) {
    return {
      markdown: remoteLedger,
      source: {
        ref: "origin/main (cached)",
        branch,
        behind,
        ahead,
        revalidated: false,
        warning:
          "origin/main is a local remote-tracking ref; refresh it explicitly before relying on current remote state",
      },
    };
  }
  const localPath = path.resolve(cwd, ...gitPath.split("/"));
  let markdown = "";
  try {
    markdown = readFileSync(localPath, "utf8");
  } catch {
    markdown = readFileSync(fileURLToPath(new URL(`../${gitPath}`, import.meta.url)), "utf8");
  }
  return {
    markdown,
    source: {
      ref: "worktree",
      branch,
      behind,
      ahead,
      revalidated: false,
      warning: "origin/main is unavailable; this report may be stale",
    },
  };
}

function render(report, winsOnly) {
  const { source, counts } = report;
  console.log(
    `[issues] source=${source.ref} revalidated=${source.revalidated} branch=${source.branch} behind=${source.behind ?? "unknown"} ahead=${source.ahead ?? "unknown"}`,
  );
  if (source.warning) console.log(`[issues] WARNING: ${source.warning}`);
  const rows = winsOnly ? report.agentSafeWins : report.recommended;
  console.log(`[issues] open=${counts.open} recommended=${counts.recommended} shown=${rows.length}`);
  if (winsOnly && report.priorityBlockers.length) {
    console.log(
      `[issues] A1 priority remains ahead of wins: ${report.priorityBlockers.map((row) => row.ids.join(",")).join(" ")}`,
    );
  }
  for (const row of rows)
    console.log(`${row.order}. ${row.ids.join(", ")} · ${row.acuity} · ${row.estimate} · ${row.outcome}`);
}

function parseCliArgs(argv) {
  const flags = new Set();
  let filter = undefined;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (["--json", "--agent-safe-wins", "--ward", "--core"].includes(arg)) {
      flags.add(arg);
    } else if (arg === "--filter") {
      filter = argv[i + 1];
      i += 1;
    } else if (arg.startsWith("--filter=")) {
      filter = arg.slice("--filter=".length);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  if (flags.has("--ward") && flags.has("--core")) {
    throw new Error("Cannot specify both --ward and --core");
  }
  return {
    json: flags.has("--json"),
    winsOnly: flags.has("--agent-safe-wins"),
    ward: flags.has("--ward"),
    core: flags.has("--core"),
    filter,
  };
}

function main() {
  const options = parseCliArgs(process.argv.slice(2));
  const { markdown, source } = loadRevalidatedLedger();
  const report = buildIssuesReport(markdown, source, options);
  if (options.json) console.log(JSON.stringify(report, null, 2));
  else render(report, options.winsOnly);
}

const isDirectRun =
  process.argv[1] &&
  (fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) ||
    import.meta.url === pathToFileURL(process.argv[1]).href);

if (isDirectRun) {
  try {
    main();
  } catch (error) {
    console.error(`[issues-report] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
