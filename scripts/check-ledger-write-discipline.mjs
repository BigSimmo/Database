#!/usr/bin/env node
/**
 * Enforce the conflict-free ledger architecture at the Git boundary.
 *
 * - Branch-review history is immutable records; the historic table's dated rows
 *   must not change in ordinary PR work.
 * - Outstanding-issue mutations are a single serial transaction: pending JSON
 *   requests move to `applied/`, and the resulting canonical Markdown must be
 *   exactly what applying those requests to the base ledger produces.
 *
 * This is deliberately stronger than a shape check. A valid-looking manual
 * edit would still reintroduce the shared-hunk race that the inbox removes.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { applyRequest, validateRequest } from "./ledger-inbox.mjs";
import { parseLedgerRows } from "./branch-review-ledger.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const REVIEW_LEDGER = "docs/branch-review-ledger.md";
const ISSUES_LEDGER = "docs/outstanding-issues.md";
const INBOX = "docs/outstanding-issues-inbox";
const APPLIED = `${INBOX}/applied`;

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

function readAt(ref, relative) {
  return execFileSync("git", ["show", `${ref}:${relative}`], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function filesAt(ref, directory) {
  let names = "";
  try {
    names = git(["ls-tree", "-r", "--name-only", ref, "--", directory]);
  } catch {
    return new Map();
  }
  const entries = new Map();
  for (const relative of names
    .split(/\r?\n/)
    .filter((name) => name.endsWith(".json") && path.posix.dirname(name) === directory)) {
    const name = path.posix.basename(relative);
    entries.set(name, readAt(ref, relative));
  }
  return entries;
}

function parsedRequests(entries, label) {
  const problems = [];
  const requests = new Map();
  for (const [name, text] of entries) {
    try {
      const request = JSON.parse(text);
      const requestProblems = validateRequest(request);
      if (requestProblems.length > 0) problems.push(`${label}/${name}: ${requestProblems.join("; ")}`);
      requests.set(name, request);
    } catch (error) {
      problems.push(`${label}/${name}: invalid JSON (${error instanceof Error ? error.message : String(error)})`);
    }
  }
  return { requests, problems };
}

/**
 * Pure transaction verifier. Maps are keyed by one immutable UUID filename.
 * Exported for focused tests and the script self-test.
 */
export function verifyIssueReconciliation({
  baseIssues,
  headIssues,
  basePending,
  headPending,
  baseApplied,
  headApplied,
}) {
  const failures = [];
  const basePendingParsed = parsedRequests(basePending, INBOX);
  const headPendingParsed = parsedRequests(headPending, INBOX);
  const baseAppliedParsed = parsedRequests(baseApplied, APPLIED);
  const headAppliedParsed = parsedRequests(headApplied, APPLIED);
  failures.push(
    ...basePendingParsed.problems,
    ...headPendingParsed.problems,
    ...baseAppliedParsed.problems,
    ...headAppliedParsed.problems,
  );

  const moved = [];
  for (const [name, text] of basePending) {
    const targetPending = headPending.get(name);
    const targetApplied = headApplied.get(name);
    if (targetPending === text) continue;
    if (targetPending !== undefined) {
      failures.push(`${INBOX}/${name} changed in place; requests are immutable.`);
      continue;
    }
    if (targetApplied !== text) {
      failures.push(`${INBOX}/${name} was removed without an identical ${APPLIED}/${name} audit record.`);
      continue;
    }
    moved.push(name);
  }

  for (const [name, text] of baseApplied) {
    if (headApplied.get(name) !== text)
      failures.push(`${APPLIED}/${name} changed or disappeared; applied records are immutable.`);
  }
  for (const [name, text] of headApplied) {
    if (!baseApplied.has(name) && basePending.get(name) !== text) {
      failures.push(`${APPLIED}/${name} was introduced without moving the identical pending request from the base.`);
    }
  }

  for (const [name] of headPending) {
    if (!basePending.has(name) && headApplied.has(name)) {
      failures.push(`${INBOX}/${name} exists in both pending and applied locations.`);
    }
  }

  if (failures.length > 0) return failures;
  let expected = baseIssues;
  try {
    for (const name of moved.sort()) expected = applyRequest(expected, basePendingParsed.requests.get(name));
  } catch (error) {
    failures.push(
      `queued reconciliation cannot be applied safely: ${error instanceof Error ? error.message : String(error)}`,
    );
    return failures;
  }
  if (expected !== headIssues) {
    failures.push(
      `${ISSUES_LEDGER} does not exactly match the serial application of ${moved.length} moved inbox request(s) from the base. ` +
        "Run npm run issues:reconcile from a fresh ledger branch; do not edit the canonical ledger directly.",
    );
  }
  return failures;
}

export function reviewLedgerRowsChanged(baseMarkdown, headMarkdown) {
  const baseRows = parseLedgerRows(baseMarkdown).map((row) => row.raw);
  const headRows = parseLedgerRows(headMarkdown).map((row) => row.raw);
  return JSON.stringify(baseRows) !== JSON.stringify(headRows);
}

function resolveArgs(argv) {
  const value = (name) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : "";
  };
  const requestedBase = value("--base") || process.env.LEDGER_WRITE_BASE_SHA || "";
  const requestedHead = value("--head") || "HEAD";
  if (requestedBase) return { base: requestedBase, head: requestedHead };
  try {
    return { base: git(["merge-base", "HEAD", "refs/remotes/origin/main"]), head: requestedHead };
  } catch {
    throw new Error("cannot resolve a comparison base; pass --base <commit> or fetch refs/remotes/origin/main");
  }
}

function selfTest() {
  const base = [
    "<!-- issues:next-id=2 -->",
    "",
    "## Recommended execution queue",
    "",
    "<!-- prettier-ignore -->",
    "",
    "| Order | ID(s) |",
    "| --- | --- |",
    "| 1 | `#001` |",
    "",
    "## Open items",
    "",
    "<!-- prettier-ignore -->",
    "",
    "| ID | Pri | Type | Summary | Detail / next action | Source | Added |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    "| #001 | P2 | issue | existing | detail | source | 2026-01-01 |",
    "",
    "## Resolved / archive",
    "",
    "<!-- prettier-ignore -->",
    "",
    "| ID | Type | Summary | Outcome | Resolved |",
    "| ---- | ---- | ---- | ---- | ---- |",
    "| #000 | issue | old | done | 2026-01-01 |",
    "",
  ].join("\n");
  const name = "11111111-1111-4111-8111-111111111111.json";
  const request = JSON.stringify({
    version: 1,
    id: name.slice(0, -5),
    createdOn: "2026-08-13",
    action: "add",
    payload: { pri: "P2", type: "issue", summary: "queued" },
  });
  const head = applyRequest(base, JSON.parse(request));
  const options = {
    baseIssues: base,
    headIssues: head,
    basePending: new Map([[name, request]]),
    headPending: new Map(),
    baseApplied: new Map(),
    headApplied: new Map([[name, request]]),
  };
  if (verifyIssueReconciliation(options).length !== 0)
    throw new Error("self-test failed: valid serial reconciliation rejected");
  if (verifyIssueReconciliation({ ...options, headIssues: base }).length === 0) {
    throw new Error("self-test failed: manual canonical edit accepted");
  }
  const review = `| 2026-08-13 | codex/a | ${"a".repeat(40)} | review | pass | test |\n`;
  if (!reviewLedgerRowsChanged("", review) || reviewLedgerRowsChanged(review, review)) {
    throw new Error("self-test failed: legacy review row change detection is incorrect");
  }
  console.log("ledger write discipline self-test passed.");
}

function main() {
  if (process.argv.includes("--self-test")) return selfTest();
  const { base, head } = resolveArgs(process.argv.slice(2));
  const failures = [];
  const baseReview = readAt(base, REVIEW_LEDGER);
  const headReview = readAt(head, REVIEW_LEDGER);
  if (reviewLedgerRowsChanged(baseReview, headReview)) {
    failures.push(
      `${REVIEW_LEDGER} dated rows changed. Write review history with npm run ledger:append so each PR adds an immutable record file instead.`,
    );
  }

  const baseIssues = readAt(base, ISSUES_LEDGER);
  const headIssues = readAt(head, ISSUES_LEDGER);
  failures.push(
    ...verifyIssueReconciliation({
      baseIssues,
      headIssues,
      basePending: filesAt(base, INBOX),
      headPending: filesAt(head, INBOX),
      baseApplied: filesAt(base, APPLIED),
      headApplied: filesAt(head, APPLIED),
    }),
  );

  if (failures.length > 0) {
    console.error("Ledger write-discipline check failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Ledger write discipline passed for ${base.slice(0, 12)}..${head.slice(0, 12)}.`);
}

if (process.argv[1]?.endsWith("check-ledger-write-discipline.mjs")) {
  try {
    main();
  } catch (error) {
    console.error(`Ledger write-discipline check failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
