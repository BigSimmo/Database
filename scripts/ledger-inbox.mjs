#!/usr/bin/env node
/**
 * Conflict-free intake for the outstanding-issues ledger.
 *
 * Feature branches write one immutable request file; only a deliberately serialized
 * `reconcile` operation edits docs/outstanding-issues.md and allocates numeric IDs.
 * This keeps a busy PR queue from contending on the next-id marker or one table row.
 */
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { addIssue, resolveIssue, updateIssue } from "./outstanding-issues.mjs";
import { ISSUES_PATH, checkIssues } from "./check-outstanding-issues.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const INBOX_DIR = "docs/outstanding-issues-inbox";
const APPLIED_DIR = path.posix.join(INBOX_DIR, "applied");
const ACTIONS = new Set(["add", "done", "update"]);
const RECONCILE_LOCK_NAME = "outstanding-issues-reconcile.lock";

function date() {
  return new Date().toISOString().slice(0, 10);
}

function argValue(argv, name) {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] : undefined;
}

function requestPath(id) {
  return path.posix.join(INBOX_DIR, `${id}.json`);
}

export function validateRequest(request) {
  const problems = [];
  if (!request || typeof request !== "object") return ["request must be an object"];
  if (request.version !== 1) problems.push("version must be 1");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request.id ?? "")) {
    problems.push("id must be a UUID");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(request.createdOn ?? "")) problems.push("createdOn must be YYYY-MM-DD");
  if (!ACTIONS.has(request.action)) problems.push("action must be add, done, or update");
  if (!request.payload || typeof request.payload !== "object") problems.push("payload must be an object");
  if (request.action === "add") {
    for (const field of ["pri", "type", "summary"])
      if (!request.payload?.[field]) problems.push(`add requires ${field}`);
  }
  if (request.action === "done") {
    if (!/^#\d{3,}$/.test(request.payload?.id ?? "")) problems.push("done requires a canonical #NNN id");
    if (!request.payload?.outcome) problems.push("done requires outcome");
  }
  if (request.action === "update") {
    if (!/^#\d{3,}$/.test(request.payload?.id ?? "")) problems.push("update requires a canonical #NNN id");
    if (!["summary", "detail", "source"].some((field) => request.payload?.[field] !== undefined)) {
      problems.push("update requires summary, detail, or source");
    }
  }
  return problems;
}

export function applyRequest(markdown, request) {
  const problems = validateRequest(request);
  if (problems.length > 0) throw new Error(problems.join("; "));
  const options = { date: request.createdOn };
  if (request.action === "add") return addIssue(markdown, request.payload, options);
  if (request.action === "done") return resolveIssue(markdown, request.payload.id, request.payload.outcome, options);
  return updateIssue(markdown, request.payload.id, request.payload);
}

function loadPending() {
  return loadRequestsIn(INBOX_DIR);
}

function loadRequestsIn(directory) {
  const absolute = path.join(ROOT, directory);
  if (!existsSync(absolute)) return [];
  const files = readdirSync(absolute)
    .filter((name) => name.endsWith(".json"))
    .sort();
  return files.map((name) => {
    const relative = path.posix.join(directory, name);
    try {
      return { relative, request: JSON.parse(readFileSync(path.join(ROOT, relative), "utf8")) };
    } catch (error) {
      return { relative, error: error instanceof Error ? error.message : String(error) };
    }
  });
}

function allRequestEntries() {
  return [...loadPending(), ...loadRequestsIn(APPLIED_DIR)];
}

function mutationConflicts(pending) {
  const byId = new Map();
  for (const entry of pending) {
    if (entry.request.action === "add") continue;
    const id = entry.request.payload.id;
    const requests = byId.get(id) ?? [];
    requests.push(entry.relative);
    byId.set(id, requests);
  }
  return [...byId.entries()].filter(([, requests]) => requests.length > 1);
}

function canonicalLedgerIsClean() {
  for (const args of [
    ["diff", "--quiet", "--", ISSUES_PATH],
    ["diff", "--cached", "--quiet", "--", ISSUES_PATH],
  ]) {
    try {
      execFileSync("git", args, { cwd: ROOT, stdio: "ignore" });
    } catch {
      return false;
    }
  }
  return true;
}

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

function processIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return Number.isInteger(pid) && pid > 0;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function reconcileLockPath() {
  const commonDir = git(["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  return path.join(commonDir, RECONCILE_LOCK_NAME);
}

function acquireReconcileLock() {
  const lockPath = reconcileLockPath();
  const attempt = () => {
    mkdirSync(lockPath);
    const owner = {
      pid: process.pid,
      startedAt: new Date().toISOString(),
      purpose: "outstanding-issues reconciliation",
    };
    writeFileSync(path.join(lockPath, "owner.json"), `${JSON.stringify(owner)}\n`, "utf8");
    return owner;
  };
  try {
    attempt();
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    let owner = null;
    try {
      owner = JSON.parse(readFileSync(path.join(lockPath, "owner.json"), "utf8"));
    } catch {
      // A malformed lock is not safe to delete while a concurrent process may own it.
    }
    if (!owner || processIsAlive(owner.pid)) {
      throw new Error(
        `another reconciliation is active at ${lockPath}${owner?.pid ? ` (PID ${owner.pid})` : ""}; retry after it completes`,
      );
    }
    rmSync(lockPath, { recursive: true, force: true });
    try {
      attempt();
    } catch (retryError) {
      throw new Error(`could not acquire reconciliation lock at ${lockPath}: ${retryError.message}`);
    }
  }
  return () => rmSync(lockPath, { recursive: true, force: true });
}

function assertFreshReconciliationBase() {
  let originMain;
  try {
    originMain = git(["rev-parse", "--verify", "refs/remotes/origin/main^{commit}"]);
  } catch {
    throw new Error(
      "reconciliation requires a fetched refs/remotes/origin/main; fetch first and start from that exact base",
    );
  }
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", originMain, "HEAD"], { cwd: ROOT, stdio: "ignore" });
  } catch {
    throw new Error(
      `reconciliation HEAD does not include the fetched origin/main (${originMain.slice(0, 12)}); merge or rebase it first to avoid a canonical-ledger conflict`,
    );
  }
}

function createRequest(action, argv) {
  const payload =
    action === "add"
      ? {
          pri: argValue(argv, "pri"),
          type: argValue(argv, "type"),
          summary: argValue(argv, "summary"),
          detail: argValue(argv, "detail"),
          source: argValue(argv, "source"),
        }
      : action === "done"
        ? { id: argv[1], outcome: argValue(argv, "outcome") }
        : {
            id: argv[1],
            summary: argValue(argv, "summary"),
            detail: argValue(argv, "detail"),
            source: argValue(argv, "source"),
          };
  const request = { version: 1, id: randomUUID(), createdOn: date(), action, payload };
  const problems = validateRequest(request);
  if (problems.length > 0) throw new Error(problems.join("; "));
  const relative = requestPath(request.id);
  const target = path.join(ROOT, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(request, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  console.log(
    `Queued ${action} request at ${relative}. It is merge-safe; run npm run issues:reconcile after this PR lands.`,
  );
}

function reconcile(argv) {
  const dryRun = argv.includes("--dry-run");
  const pending = loadPending();
  const bad = pending.filter((entry) => entry.error || validateRequest(entry.request).length > 0);
  if (bad.length > 0) {
    for (const entry of bad)
      console.error(`${entry.relative}: ${entry.error ?? validateRequest(entry.request).join("; ")}`);
    process.exitCode = 1;
    return;
  }
  if (pending.length === 0) {
    console.log("No outstanding-issue requests to reconcile.");
    return;
  }
  const conflicts = mutationConflicts(pending);
  if (conflicts.length > 0) {
    for (const [id, paths] of conflicts)
      console.error(`${id} is mutated by multiple pending requests: ${paths.join(", ")}`);
    console.error(
      "Reconcile one intended mutation for each existing issue at a time; do not choose a UUID sort order as policy.",
    );
    process.exitCode = 1;
    return;
  }
  if (!dryRun && !canonicalLedgerIsClean()) {
    console.error(
      `refusing to reconcile: ${ISSUES_PATH} has staged or unstaged changes; preserve or commit them first.`,
    );
    process.exitCode = 1;
    return;
  }
  assertFreshReconciliationBase();

  const apply = () => {
    let markdown = readFileSync(path.join(ROOT, ISSUES_PATH), "utf8");
    for (const entry of pending) markdown = applyRequest(markdown, entry.request);
    const problems = checkIssues(markdown);
    if (problems.length > 0) throw new Error(`invalid ${ISSUES_PATH}: ${problems.join("; ")}`);
    return markdown;
  };

  let markdown;
  try {
    markdown = apply();
  } catch (error) {
    console.error(`refusing to reconcile: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
    return;
  }
  console.log(`${dryRun ? "Would reconcile" : "Reconciling"} ${pending.length} request(s) into ${ISSUES_PATH}.`);
  if (dryRun) return;
  const release = acquireReconcileLock();
  try {
    if (!canonicalLedgerIsClean())
      throw new Error(`${ISSUES_PATH} changed while reconciliation was waiting for its lock`);
    assertFreshReconciliationBase();
    markdown = apply();
    writeFileSync(path.join(ROOT, ISSUES_PATH), markdown, "utf8");
    mkdirSync(path.join(ROOT, APPLIED_DIR), { recursive: true });
    for (const entry of pending)
      renameSync(path.join(ROOT, entry.relative), path.join(ROOT, APPLIED_DIR, path.basename(entry.relative)));
    console.log(`Applied ${pending.length} request(s); their immutable audit records are under ${APPLIED_DIR}.`);
  } catch (error) {
    console.error(`refusing to reconcile: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  } finally {
    release();
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
    "| #001 | P2 | issue | one | d | s | 2026-01-01 |",
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
  const add = {
    version: 1,
    id: "11111111-1111-4111-8111-111111111111",
    createdOn: "2026-08-13",
    action: "add",
    payload: { pri: "P2", type: "issue", summary: "two" },
  };
  const done = {
    version: 1,
    id: "22222222-2222-4222-8222-222222222222",
    createdOn: "2026-08-13",
    action: "done",
    payload: { id: "#001", outcome: "done" },
  };
  const added = applyRequest(base, add);
  if (!added.includes("#002")) throw new Error("self-test failed: queued add did not preserve ledger invariants");
  const resolved = applyRequest(base, done);
  if (resolved.includes("`#001`"))
    throw new Error("self-test failed: queued resolve did not preserve ledger invariants");
  if (validateRequest({ ...add, payload: {} }).length === 0)
    throw new Error("self-test failed: invalid request accepted");
  console.log("ledger inbox self-test passed.");
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) return selfTest();
  const action = argv[0];
  try {
    if (ACTIONS.has(action)) return createRequest(action, argv);
    if (action === "reconcile") return reconcile(argv.slice(1));
    if (action === "check") {
      const requests = allRequestEntries();
      const bad = requests.filter((entry) => entry.error || validateRequest(entry.request).length > 0);
      if (bad.length > 0)
        throw new Error(
          bad
            .map((entry) => `${entry.relative}: ${entry.error ?? validateRequest(entry.request).join("; ")}`)
            .join("\n"),
        );
      const seen = new Set();
      const duplicates = [];
      for (const entry of requests) {
        if (seen.has(entry.request.id)) duplicates.push(entry.relative);
        seen.add(entry.request.id);
      }
      if (duplicates.length > 0) throw new Error(`duplicate immutable request id(s): ${duplicates.join(", ")}`);
      console.log(
        `Ledger inbox check passed: ${loadPending().length} pending request(s), ${requests.length - loadPending().length} applied.`,
      );
      return;
    }
    throw new Error("usage: ledger-inbox.mjs <add|done|update|reconcile|check> [args]");
  } catch (error) {
    console.error(`ledger inbox: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

if (process.argv[1]?.endsWith("ledger-inbox.mjs")) main();
