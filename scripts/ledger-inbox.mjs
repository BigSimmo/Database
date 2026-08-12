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
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { addIssue, resolveIssue, updateIssue } from "./outstanding-issues.mjs";
import { ISSUES_PATH, checkIssues } from "./check-outstanding-issues.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const INBOX_DIR = "docs/outstanding-issues-inbox";
const APPLIED_DIR = path.posix.join(INBOX_DIR, "applied");
const ACTIONS = new Set(["add", "done", "update", "cancel"]);
const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RECONCILE_LOCK_NAME = "outstanding-issues-reconcile.lock";
const OWNERLESS_LOCK_GRACE_MS = 5 * 60 * 1000;
const RECONCILE_TRANSACTION_NAME = "transaction.json";
const RECONCILE_BACKUP_NAME = "ledger.before";

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
  if (!REQUEST_ID.test(request.id ?? "")) problems.push("id must be a UUID");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(request.createdOn ?? "")) problems.push("createdOn must be YYYY-MM-DD");
  if (!ACTIONS.has(request.action)) problems.push("action must be add, done, update, or cancel");
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
  if (request.action === "cancel") {
    if (!REQUEST_ID.test(request.payload?.requestId ?? "")) {
      problems.push("cancel requires a pending request UUID");
    }
    if (!String(request.payload?.reason ?? "").trim()) problems.push("cancel requires reason");
  }
  return problems;
}

export function applyRequest(markdown, request) {
  const problems = validateRequest(request);
  if (problems.length > 0) throw new Error(problems.join("; "));
  if (request.action === "cancel") {
    throw new Error("cancel requests must be applied through batch reconciliation");
  }
  const options = { date: request.createdOn };
  if (request.action === "add") return addIssue(markdown, request.payload, options);
  if (request.action === "done") return resolveIssue(markdown, request.payload.id, request.payload.outcome, options);
  return updateIssue(markdown, request.payload.id, request.payload);
}

function mutationConflicts(requests) {
  const byIssue = new Map();
  for (const request of requests) {
    if (request.action === "add" || request.action === "cancel") continue;
    const id = request.payload.id;
    const requestIds = byIssue.get(id) ?? [];
    requestIds.push(request.id);
    byIssue.set(id, requestIds);
  }
  return [...byIssue.entries()].filter(([, requestIds]) => requestIds.length > 1);
}

/**
 * Resolve immutable cancellation decisions before applying a pending request batch.
 * A cancellation request is itself retained in the applied audit trail, while the
 * targeted request is moved unchanged but deliberately not applied to the ledger.
 */
export function planRequestBatch(requests) {
  const byId = new Map();
  for (const request of requests) {
    const problems = validateRequest(request);
    if (problems.length > 0) throw new Error(`${request?.id ?? "unknown request"}: ${problems.join("; ")}`);
    if (byId.has(request.id)) throw new Error(`duplicate immutable request id: ${request.id}`);
    byId.set(request.id, request);
  }

  const cancelledIds = new Set();
  const cancellations = [];
  for (const request of requests) {
    if (request.action !== "cancel") continue;
    const target = byId.get(request.payload.requestId);
    if (!target) {
      throw new Error(
        `cancel request ${request.id} targets missing pending request ${request.payload.requestId}`,
      );
    }
    if (target.action === "cancel") {
      throw new Error(`cancel request ${request.id} cannot cancel another cancellation request`);
    }
    if (cancelledIds.has(target.id)) {
      throw new Error(`pending request ${target.id} is cancelled more than once`);
    }
    cancelledIds.add(target.id);
    cancellations.push({
      requestId: request.id,
      targetId: target.id,
      reason: String(request.payload.reason).trim(),
    });
  }

  const active = requests.filter((request) => request.action !== "cancel" && !cancelledIds.has(request.id));
  const conflicts = mutationConflicts(active);
  if (conflicts.length > 0) {
    const detail = conflicts.map(([id, requestIds]) => `${id}: ${requestIds.join(", ")}`).join("; ");
    throw new Error(
      `multiple pending mutations require an explicit cancellation decision (${detail}). ` +
        "Queue `node scripts/ledger-inbox.mjs cancel <request-uuid> --reason \"<why>\"` for each rejected mutation, land it, then reconcile again.",
    );
  }

  return { active, cancellations, cancelledIds: [...cancelledIds] };
}

export function applyRequestBatch(markdown, requests) {
  const plan = planRequestBatch(requests);
  let next = markdown;
  for (const request of plan.active) next = applyRequest(next, request);
  return { markdown: next, ...plan };
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

function pendingRequestsAreTrackedAndClean(pending) {
  for (const entry of pending) {
    try {
      git(["ls-files", "--error-unmatch", "--", entry.relative]);
      git(["diff", "--quiet", "HEAD", "--", entry.relative]);
    } catch {
      throw new Error(`pending request ${entry.relative} is untracked or modified; commit the immutable request before reconciliation`);
    }
  }
}

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

export function processIsAlive(pid) {
  const numericPid = typeof pid === "string" && /^\d+$/.test(pid) ? Number(pid) : pid;
  if (!Number.isSafeInteger(numericPid) || numericPid <= 0) return false;
  try {
    process.kill(numericPid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function reconcileLockPath() {
  const commonDir = git(["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  return path.join(commonDir, RECONCILE_LOCK_NAME);
}

function recoverReconcileTransaction(lockPath) {
  const transactionPath = path.join(lockPath, RECONCILE_TRANSACTION_NAME);
  if (!existsSync(transactionPath)) return false;
  const journal = JSON.parse(readFileSync(transactionPath, "utf8"));
  const backupPath = path.join(lockPath, journal.backup ?? RECONCILE_BACKUP_NAME);
  if (!existsSync(backupPath) || !Array.isArray(journal.pending)) {
    throw new Error(`incomplete reconciliation journal at ${transactionPath}; refusing automatic recovery`);
  }

  writeFileSync(path.join(ROOT, ISSUES_PATH), readFileSync(backupPath, "utf8"), "utf8");
  for (const relative of journal.pending) {
    const pendingPath = path.join(ROOT, relative);
    const appliedPath = path.join(ROOT, APPLIED_DIR, path.basename(relative));
    if (!existsSync(pendingPath) && existsSync(appliedPath)) renameSync(appliedPath, pendingPath);
  }
  rmSync(transactionPath, { force: true });
  rmSync(backupPath, { force: true });
  return true;
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
      // The directory creation is atomic, but owner.json is written immediately
      // after it. Give an ownerless lock a short grace period before recovery so
      // a concurrent process cannot be mistaken for a crashed one.
    }
    let lockAgeMs = 0;
    try {
      lockAgeMs = Math.max(0, Date.now() - statSync(lockPath).mtimeMs);
    } catch {
      throw new Error(`could not inspect reconciliation lock at ${lockPath}`);
    }
    if (!owner && lockAgeMs < OWNERLESS_LOCK_GRACE_MS) {
      throw new Error(`reconciliation lock at ${lockPath} is still initializing; retry after it completes`);
    }
    if (owner && processIsAlive(owner.pid)) {
      throw new Error(
        `another reconciliation is active at ${lockPath}${owner?.pid ? ` (PID ${owner.pid})` : ""}; retry after it completes`,
      );
    }
    try {
      recoverReconcileTransaction(lockPath);
    } catch (recoveryError) {
      throw new Error(`stale reconciliation requires recovery before retry: ${recoveryError.message}`);
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
        : action === "cancel"
          ? { requestId: argv[1], reason: argValue(argv, "reason") }
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
  try {
    pendingRequestsAreTrackedAndClean(pending);
  } catch (error) {
    console.error(`refusing to reconcile: ${error instanceof Error ? error.message : String(error)}`);
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
    const current = readFileSync(path.join(ROOT, ISSUES_PATH), "utf8");
    const result = applyRequestBatch(
      current,
      pending.map((entry) => entry.request),
    );
    const problems = checkIssues(result.markdown, { prettierIgnored: true });
    if (problems.length > 0) throw new Error(`invalid ${ISSUES_PATH}: ${problems.join("; ")}`);
    return result;
  };

  let result;
  try {
    result = apply();
  } catch (error) {
    console.error(`refusing to reconcile: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
    return;
  }
  const decisions = result.cancellations.length > 0 ? ` with ${result.cancellations.length} cancellation decision(s)` : "";
  console.log(
    `${dryRun ? "Would reconcile" : "Reconciling"} ${pending.length} request(s) into ${ISSUES_PATH}${decisions}.`,
  );
  if (dryRun) return;
  const release = acquireReconcileLock();
  const lockPath = reconcileLockPath();
  const transactionPath = path.join(lockPath, RECONCILE_TRANSACTION_NAME);
  let transactionOpen = false;
  try {
    if (!canonicalLedgerIsClean())
      throw new Error(`${ISSUES_PATH} changed while reconciliation was waiting for its lock`);
    pendingRequestsAreTrackedAndClean(pending);
    assertFreshReconciliationBase();
    result = apply();

    const current = readFileSync(path.join(ROOT, ISSUES_PATH), "utf8");
    writeFileSync(path.join(lockPath, RECONCILE_BACKUP_NAME), current, "utf8");
    writeFileSync(
      transactionPath,
      `${JSON.stringify({
        backup: RECONCILE_BACKUP_NAME,
        pending: pending.map((entry) => entry.relative),
      })}\n`,
      "utf8",
    );
    transactionOpen = true;
    writeFileSync(path.join(ROOT, ISSUES_PATH), result.markdown, "utf8");
    mkdirSync(path.join(ROOT, APPLIED_DIR), { recursive: true });
    for (const entry of pending)
      renameSync(path.join(ROOT, entry.relative), path.join(ROOT, APPLIED_DIR, path.basename(entry.relative)));
    rmSync(transactionPath, { force: true });
    rmSync(path.join(lockPath, RECONCILE_BACKUP_NAME), { force: true });
    transactionOpen = false;
    console.log(`Applied ${pending.length} request(s); their immutable audit records are under ${APPLIED_DIR}.`);
  } catch (error) {
    if (transactionOpen) {
      try {
        recoverReconcileTransaction(lockPath);
        transactionOpen = false;
      } catch (recoveryError) {
        console.error(`reconciliation recovery is required: ${recoveryError.message}`);
      }
    }
    console.error(`refusing to reconcile: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  } finally {
    if (!transactionOpen) release();
  }
}  createdOn: "2026-08-13",
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
  const update = {
    version: 1,
    id: "33333333-3333-4333-8333-333333333333",
    createdOn: "2026-08-13",
    action: "update",
    payload: { id: "#001", summary: "updated" },
  };
  const cancel = {
    version: 1,
    id: "44444444-4444-4444-8444-444444444444",
    createdOn: "2026-08-13",
    action: "cancel",
    payload: { requestId: done.id, reason: "prefer the later update" },
  };
  const added = applyRequest(base, add);
  if (!added.includes("#002")) throw new Error("self-test failed: queued add did not preserve ledger invariants");
  const resolved = applyRequest(base, done);
  if (resolved.includes("`#001`"))
    throw new Error("self-test failed: queued resolve did not preserve ledger invariants");
  if (validateRequest({ ...add, payload: {} }).length === 0)
    throw new Error("self-test failed: invalid request accepted");

  let conflictRejected = false;
  try {
    applyRequestBatch(base, [done, update]);
  } catch (error) {
    conflictRejected = /explicit cancellation decision/.test(String(error));
  }
  if (!conflictRejected) throw new Error("self-test failed: colliding mutations were not rejected");
  const planned = applyRequestBatch(base, [done, update, cancel]);
  if (!planned.markdown.includes("updated") || planned.cancelledIds[0] !== done.id) {
    throw new Error("self-test failed: cancellation did not select the intended mutation");
  }
  let missingTargetRejected = false;
  try {
    planRequestBatch([{ ...cancel, payload: { requestId: add.id, reason: "missing" } }]);
  } catch (error) {
    missingTargetRejected = /missing pending request/.test(String(error));
  }
  if (!missingTargetRejected) throw new Error("self-test failed: missing cancellation target was accepted");
  if (!processIsAlive(process.pid) || !processIsAlive(String(process.pid))) {
    throw new Error("self-test failed: current numeric or numeric-string PID was not treated as alive");
  }
  if (processIsAlive(0) || processIsAlive("not-a-pid")) {
    throw new Error("self-test failed: invalid PID was treated as alive");
  }
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
    throw new Error("usage: ledger-inbox.mjs <add|done|update|cancel|reconcile|check> [args]");
  } catch (error) {
    console.error(`ledger inbox: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

if (process.argv[1]?.endsWith("ledger-inbox.mjs")) main();
