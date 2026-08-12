#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { parseIssues } from "./check-outstanding-issues.mjs";
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
      ids: [...cells[1].matchAll(/#\d+/g)].map((match) => match[0]),
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

export function buildIssuesReport(markdown, source) {
  const parsed = parseIssues(markdown);
  const queue = queueRows(markdown);
  const openRows = parsed.rows
    .filter((row) => row.table === "open")
    .map((row) => {
      const cells = splitCells(row.raw);
      return {
        id: cells[0],
        priority: cells[1],
        type: cells[2],
        summary: cells[3],
        detail: cells[4],
        source: cells[5],
        added: cells[6],
      };
    });
  return {
    source,
    counts: { open: openRows.length, recommended: queue.length },
    priorityBlockers: queue.filter((row) => row.acuity === "A1"),
    recommended: queue,
    open: openRows,
    agentSafeWins: classifyAgentSafeWins(queue),
  };
}

export function loadRevalidatedLedger(cwd = process.cwd()) {
  const branch = tryGit(["branch", "--show-current"], cwd) || "(detached)";
  const counts = tryGit(["rev-list", "--left-right", "--count", "origin/main...HEAD"], cwd);
  const [behind, ahead] = counts ? counts.split(/\s+/).map(Number) : [null, null];
  const remoteLedger = tryGit(["show", `origin/main:${LEDGER_PATH}`], cwd);
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
  return {
    markdown: readFileSync(new URL(`../${LEDGER_PATH}`, import.meta.url), "utf8"),
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

function main() {
  const args = new Set(process.argv.slice(2));
  const unknown = [...args].filter((arg) => !["--json", "--agent-safe-wins"].includes(arg));
  if (unknown.length) throw new Error(`Unknown option: ${unknown[0]}`);
  const { markdown, source } = loadRevalidatedLedger();
  const report = buildIssuesReport(markdown, source);
  if (args.has("--json")) console.log(JSON.stringify(report, null, 2));
  else render(report, args.has("--agent-safe-wins"));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main();
  } catch (error) {
    console.error(`[issues-report] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
