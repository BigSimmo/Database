#!/usr/bin/env node
/**
 * Conflict-free intake for the outstanding-issues ledger.
 *
 * Feature branches write one immutable request file; only a deliberately serialized
 * `reconcile` operation edits docs/outstanding-issues.md. Add requests carry a
 * durable ULID, so independent branches no longer contend on a numeric marker.
 */
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { addIssue, resolveIssue, updateIssue, updateQueueRow } from "./outstanding-issues.mjs";
import {
  ISSUES_PATH,
  checkIssues,
  issueRowFingerprint,
  isValidIssueRowFingerprint,
  queueRowFingerprint,
} from "./check-outstanding-issues.mjs";
import { isIssueDisplayId, isIssueUlid, issueUlid, issueUlidFromRequest } from "./issue-id.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const INBOX_DIR = "docs/outstanding-issues-inbox";
const APPLIED_DIR = path.posix.join(INBOX_DIR, "applied");
const ACTIONS = new Set(["add", "done", "update", "queue", "cancel"]);
// Fields a `queue` request may carry, mirroring updateQueueRow's editable map.
const QUEUE_FIELDS = ["acuity", "capability", "when", "estimate", "outcome"];
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

function readOutstandingIssues() {
  return readFileSync(path.join(ROOT, ISSUES_PATH), "utf8");
}

export function validateRequest(request) {
  const problems = [];
  if (!request || typeof request !== "object") return ["request must be an object"];
  if (![1, 2].includes(request.version)) problems.push("version must be 1 or 2");
  if (!REQUEST_ID.test(request.id ?? "")) problems.push("id must be a UUID");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(request.createdOn ?? "")) problems.push("createdOn must be YYYY-MM-DD");
  if (!ACTIONS.has(request.action)) problems.push("action must be add, done, update, queue, or cancel");
  if (!request.payload || typeof request.payload !== "object") problems.push("payload must be an object");
  if (request.action === "add") {
    for (const field of ["pri", "type", "summary"])
      if (!request.payload?.[field]) problems.push(`add requires ${field}`);
    if (request.payload?.issueUlid !== undefined && !isIssueUlid(request.payload.issueUlid)) {
      problems.push("add issueUlid must be a valid ULID");
    }
    if (request.version === 2 && request.payload?.issueUlid === undefined) {
      problems.push("version 2 add requires a valid issueUlid");
    }
  }
  if (request.action === "done") {
    if (!isIssueDisplayId(request.payload?.id)) problems.push("done requires a canonical issue display id");
    if (!request.payload?.outcome) problems.push("done requires outcome");
    if (
      request.payload?.baseRowFingerprint !== undefined &&
      !isValidIssueRowFingerprint(request.payload.baseRowFingerprint)
    )
      problems.push("done requires a valid baseRowFingerprint");
  }
  if (request.action === "update") {
    if (!isIssueDisplayId(request.payload?.id)) problems.push("update requires a canonical issue display id");
    // `pri` counts as a mutation on its own: a re-prioritisation with no prose
    // change is a legitimate and common triage edit, and leaving it out here
    // made `--pri` unusable alone even once the CLI could emit it (ledger #313).
    if (!["pri", "summary", "detail", "source"].some((field) => request.payload?.[field] !== undefined)) {
      problems.push("update requires pri, summary, detail, or source");
    }
    if (
      request.payload?.baseRowFingerprint !== undefined &&
      !isValidIssueRowFingerprint(request.payload.baseRowFingerprint)
    )
      problems.push("update requires a valid baseRowFingerprint");
    if (request.payload?.pri !== undefined && !["P1", "P2", "P3"].includes(String(request.payload.pri))) {
      problems.push("update pri must be P1, P2, or P3");
    }
  }
  if (request.action === "queue") {
    if (!isIssueDisplayId(request.payload?.id)) problems.push("queue requires a canonical issue display id");
    // A queue re-grade is usually exactly one cell (acuity), so requiring any
    // one field rather than a prose field keeps the common correction — the
    // #M6JNR8 instance — expressible without inventing filler text.
    if (!QUEUE_FIELDS.some((field) => request.payload?.[field] !== undefined)) {
      problems.push(`queue requires one of ${QUEUE_FIELDS.join(", ")}`);
    }
    if (
      request.payload?.baseRowFingerprint !== undefined &&
      !isValidIssueRowFingerprint(request.payload.baseRowFingerprint)
    )
      problems.push("queue requires a valid baseRowFingerprint");
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
  if (request.action === "queue" && request.payload?.baseRowFingerprint) {
    const id = request.payload.id;
    const fingerprint = queueRowFingerprint(markdown, id);
    if (!fingerprint) {
      throw new Error(
        `${id} no longer has exactly one queue row; reread and reissue this request from the latest ledger`,
      );
    }
    if (fingerprint !== String(request.payload.baseRowFingerprint).toLowerCase()) {
      throw new Error(
        `${id} queue row is stale: it changed after this request was queued; reread and reissue from the latest ledger`,
      );
    }
  }
  if ((request.action === "done" || request.action === "update") && request.payload?.baseRowFingerprint) {
    const id = request.payload.id;
    const fingerprint = issueRowFingerprint(markdown, id);
    if (!fingerprint) {
      throw new Error(`${id} is no longer open; reread and reissue this request from the latest ledger`);
    }
    if (fingerprint !== String(request.payload.baseRowFingerprint).toLowerCase()) {
      throw new Error(
        `${id} is stale: the ledger row changed after this request was queued; reread and reissue from the latest ledger`,
      );
    }
  }
  if (request.action === "add") {
    const durableId = request.payload.issueUlid ?? issueUlidFromRequest(request.createdOn, request.id);
    return addIssue(markdown, request.payload, { ...options, issueUlid: durableId });
  }
  if (request.action === "done") return resolveIssue(markdown, request.payload.id, request.payload.outcome, options);
  if (request.action === "queue") return updateQueueRow(markdown, request.payload.id, request.payload);
  return updateIssue(markdown, request.payload.id, request.payload);
}

function mutationConflicts(requests) {
  const byIssue = new Map();
  for (const request of requests) {
    if (request.action === "add" || request.action === "cancel") continue;
    // Keyed by target ROW, not by issue. A `queue` request and an `update`
    // request for the same id edit two different tables and cannot clobber each
    // other, and re-grading an item usually means doing both in one batch — so
    // treating them as a conflict would force an artificial cancel/relanded
    // round trip for the ordinary case (ledger #M6JNR8).
    const id = `${request.action === "queue" ? "queue " : ""}${request.payload.id}`;
    const requestIds = byIssue.get(id) ?? [];
    requestIds.push(request.id);
    byIssue.set(id, requestIds);
  }
  return [...byIssue.entries()].filter(([, requestIds]) => requestIds.length > 1);
}

/**
 * Ids of requests that a previous reconciliation already applied. Used to tell a
 * cancellation that lost a race (its target landed via another branch's batch)
 * apart from one that names a request which never existed.
 */
function appliedRequestsById() {
  try {
    return new Map(
      loadRequestsIn(APPLIED_DIR)
        .map((entry) => entry.request)
        .filter((request) => request?.id)
        .map((request) => [request.id, request]),
    );
  } catch {
    return new Map();
  }
}

/**
 * Resolve immutable cancellation decisions before applying a pending request batch.
 * A cancellation request is itself retained in the applied audit trail, while the
 * targeted request is moved unchanged but deliberately not applied to the ledger.
 *
 * Parallel reconciliations are normal here: several branches queue requests and one
 * of them reconciles first. A cancellation whose target was applied by that earlier
 * batch has therefore *failed* — but throwing would wedge every consumer of this
 * function (check:docs-links, check:ledger-write-discipline and reconcile itself)
 * with no legal way out, because write discipline forbids deleting the queued file.
 * So an already-applied target is reported loudly and skipped rather than fatal; a
 * genuinely unknown target still throws.
 *
 * @param {Array<object>} requests pending requests in the batch
 * @param {{ appliedRequests?: Map<string, object>, warn?: (message: string) => void }} [options]
 */
export function planRequestBatch(requests, options = {}) {
  const applied = options.appliedRequests ?? appliedRequestsById();
  const warn = options.warn ?? ((message) => console.warn(message));
  const byId = new Map();
  for (const request of requests) {
    const problems = validateRequest(request);
    if (problems.length > 0) throw new Error(`${request?.id ?? "unknown request"}: ${problems.join("; ")}`);
    if (byId.has(request.id)) throw new Error(`duplicate immutable request id: ${request.id}`);
    byId.set(request.id, request);
  }

  const cancelledIds = new Set();
  const cancellations = [];
  const ineffective = [];
  for (const request of requests) {
    if (request.action !== "cancel") continue;
    const target = byId.get(request.payload.requestId);
    if (!target) {
      const appliedTarget = applied.get(request.payload.requestId);
      if (appliedTarget) {
        if (appliedTarget.action === "cancel") {
          throw new Error(`cancel request ${request.id} cannot cancel another cancellation request`);
        }
        // Lost the race. Say so plainly: the correction this cancellation was
        // protecting did NOT take effect, and whoever queued it needs to fix the
        // row with a fresh update rather than assume the cancel did its job.
        ineffective.push({ requestId: request.id, targetId: request.payload.requestId });
        warn(
          `ledger inbox: cancel request ${request.id} did not take effect — its target ` +
            `${request.payload.requestId} was already applied by an earlier reconciliation. ` +
            `The cancellation is recorded but changed nothing; correct the affected row with a new update request.`,
        );
        continue;
      }
      throw new Error(`cancel request ${request.id} targets missing pending request ${request.payload.requestId}`);
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
        'Queue `node scripts/ledger-inbox.mjs cancel <request-uuid> --reason "<why>"` for each rejected mutation, land it, then reconcile again.',
    );
  }

  return { active, cancellations, cancelledIds: [...cancelledIds], ineffectiveCancellations: ineffective };
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
      throw new Error(
        `pending request ${entry.relative} is untracked or modified; commit the immutable request before reconciliation`,
      );
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

/**
 * Detect whether another unmerged branch on `origin` carries inbox
 * reconciliations (applied inbox records under `docs/outstanding-issues-inbox/applied/`).
 *
 * This provides a pre-flight remote interlock so concurrent `issues:reconcile`
 * branches are not created simultaneously against the same base (issue #EH9VA6).
 *
 * When offline or when git ls-remote fails, it fails open (returns an empty list)
 * so offline workflows and tests are not blocked.
 *
 * @param {{
 *   lsRemoteOutput?: string,
 *   runner?: (args: string[]) => string,
 *   originRef?: string,
 *   currentBranch?: string,
 *   warn?: (message: string) => void
 * }} [options]
 * @returns {Array<{ branch: string, sha: string, unmergedCount?: number, reason: string }>}
 */
export function findUnmergedRemoteReconciliations(options = {}) {
  const runner =
    options.runner ??
    ((args) =>
      execFileSync("git", args, {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim());

  let lsRemoteText = options.lsRemoteOutput;
  if (lsRemoteText === undefined) {
    try {
      lsRemoteText = runner(["ls-remote", "--heads", "origin"]);
    } catch {
      // Offline or network error: fail open safely.
      return [];
    }
  }

  if (!lsRemoteText || typeof lsRemoteText !== "string") return [];

  const originMainRef = options.originRef ?? "refs/remotes/origin/main";
  let currentBranch = options.currentBranch;
  if (currentBranch === undefined) {
    try {
      currentBranch = runner(["branch", "--show-current"]).trim();
    } catch {
      currentBranch = "";
    }
  }

  const lines = lsRemoteText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const candidateBranches = [];
  const shasToCheck = [];

  for (const line of lines) {
    const parts = line.split(/\s+/);
    if (parts.length < 2) continue;
    const sha = parts[0];
    const ref = parts[1];
    const branchName = ref.replace(/^refs\/heads\//, "");
    if (!/^[0-9a-f]{40}$/i.test(sha)) continue;
    if (branchName === "main" || branchName === "master" || (currentBranch && branchName === currentBranch)) continue;

    candidateBranches.push({ branch: branchName, sha });
    shasToCheck.push(sha);
  }

  if (candidateBranches.length === 0) return [];

  let mainApplied = new Set();
  try {
    const mainTree = execFileSync("git", ["ls-tree", "-r", "--name-only", originMainRef, "--", APPLIED_DIR], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    mainApplied = new Set(
      mainTree
        .trim()
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    );
  } catch {
    // If originMainRef cannot be inspected, fail open for tree diffs
  }

  let localShas = new Set();
  try {
    const checkOutput = execFileSync("git", ["cat-file", "--batch-check=%(objectname) %(objecttype)"], {
      cwd: ROOT,
      input: shasToCheck.join("\n") + "\n",
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    for (const entry of checkOutput.split("\n")) {
      const [sha, type] = entry.trim().split(" ");
      if (type === "commit") localShas.add(sha);
    }
  } catch {
    // If batch-check fails, fallback
  }

  const detected = [];
  const presentCandidates = candidateBranches.filter((b) => localShas.has(b.sha));
  const presentShas = presentCandidates.map((b) => b.sha);

  if (presentShas.length > 0) {
    try {
      const logArgs = [
        "log",
        "--format=COMMIT:%H",
        "--name-only",
        `^${originMainRef}`,
        ...presentShas,
        "--",
        APPLIED_DIR,
      ];
      const logOutput = execFileSync("git", logArgs, {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      if (logOutput) {
        const suspiciousCommits = new Set();
        for (const block of logOutput.split("COMMIT:").filter(Boolean)) {
          const blines = block.trim().split("\n");
          const cSha = blines[0].trim();
          const files = blines
            .slice(1)
            .map((f) => f.trim())
            .filter(Boolean);
          if (files.some((f) => !mainApplied.has(f))) {
            suspiciousCommits.add(cSha);
          }
        }

        if (suspiciousCommits.size > 0) {
          for (const candidate of presentCandidates) {
            try {
              const branchLog = execFileSync(
                "git",
                ["log", "-1", "--format=%H", `^${originMainRef}`, candidate.sha, "--", APPLIED_DIR],
                { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
              ).trim();
              if (branchLog && suspiciousCommits.has(branchLog)) {
                const branchApplied = execFileSync(
                  "git",
                  ["ls-tree", "-r", "--name-only", candidate.sha, "--", APPLIED_DIR],
                  { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
                )
                  .trim()
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean);
                const unmerged = branchApplied.filter((f) => !mainApplied.has(f));
                if (unmerged.length > 0) {
                  detected.push({
                    branch: candidate.branch,
                    sha: candidate.sha,
                    unmergedCount: unmerged.length,
                    reason: `carries ${unmerged.length} unmerged applied inbox record(s) under ${APPLIED_DIR}`,
                  });
                }
              }
            } catch {
              // ignore
            }
          }
        }
      }
    } catch {
      // fail open
    }
  }

  for (const candidate of candidateBranches) {
    if (localShas.has(candidate.sha)) continue;
    if (/(?:issues|ledger|inbox)[-_]?reconcile|reconcile[-_]?(?:issues|ledger|inbox)/i.test(candidate.branch)) {
      detected.push({
        branch: candidate.branch,
        sha: candidate.sha,
        reason: "unfetched remote branch name indicates an in-flight unmerged reconcile branch",
      });
    }
  }

  return detected;
}

export function assertSafeRemoteReconciliation(argv = [], options = {}) {
  const allowConcurrent =
    argv.includes("--allow-concurrent") ||
    argv.includes("--force") ||
    process.env.ALLOW_CONCURRENT_RECONCILE === "true";
  const skipRemoteCheck =
    argv.includes("--no-remote-check") ||
    argv.includes("--skip-remote-check") ||
    process.env.SKIP_REMOTE_CHECK === "true";

  if (skipRemoteCheck) return;

  const conflicts = findUnmergedRemoteReconciliations(options);
  if (conflicts.length === 0) return;

  const detail = conflicts.map((c) => `  - ${c.branch} (${c.sha.slice(0, 12)}): ${c.reason}`).join("\n");
  const message =
    `detected unmerged branch(es) on origin carrying pending inbox reconciliations:\n${detail}\n` +
    "Concurrent reconciliations cause canonical-ledger conflicts or corrupted reconciliation journals (#EH9VA6). " +
    "Land or close the existing reconciliation PR(s) before starting a new one, or pass --allow-concurrent to override.";

  if (allowConcurrent) {
    const warn = options.warn ?? ((msg) => console.warn(msg));
    warn(`warning: ${message}`);
  } else {
    throw new Error(message);
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
          issueUlid: issueUlid(),
        }
      : action === "done"
        ? { id: argv[1], outcome: argValue(argv, "outcome") }
        : action === "cancel"
          ? { requestId: argv[1], reason: argValue(argv, "reason") }
          : action === "queue"
            ? {
                id: argv[1],
                acuity: argValue(argv, "acuity"),
                capability: argValue(argv, "capability"),
                when: argValue(argv, "when"),
                estimate: argValue(argv, "estimate"),
                outcome: argValue(argv, "outcome"),
              }
            : {
                // `pri` rides the same update request as the prose fields so a
                // demotion and the reason for it land as one auditable mutation.
                // Without it the CLI could not express a re-prioritisation at all,
                // which is the half of ledger #313 the inbox would otherwise
                // reintroduce: updateIssue accepts --pri and validateRequest
                // permits it, but nothing could produce the payload.
                id: argv[1],
                pri: argValue(argv, "pri"),
                summary: argValue(argv, "summary"),
                detail: argValue(argv, "detail"),
                source: argValue(argv, "source"),
              };
  if (["done", "update"].includes(action) && typeof payload.id === "string") {
    const currentFingerprint = issueRowFingerprint(readOutstandingIssues(), payload.id);
    if (currentFingerprint === null) {
      throw new Error(`ledger request rejected: ${payload.id} is not in Open items`);
    }
    payload.baseRowFingerprint = currentFingerprint;
  }
  if (action === "queue" && typeof payload.id === "string") {
    const currentFingerprint = queueRowFingerprint(readOutstandingIssues(), payload.id);
    if (currentFingerprint === null) {
      throw new Error(
        `ledger request rejected: ${payload.id} does not have exactly one recommended-execution-queue row`,
      );
    }
    payload.baseRowFingerprint = currentFingerprint;
  }
  const request = { version: 2, id: randomUUID(), createdOn: date(), action, payload };
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

/**
 * `reconcile` is the only sanctioned writer of docs/outstanding-issues.md, and
 * it also moves every request it applied into `applied/` — so both the ledger
 * content and the inbox change, and data/outstanding-issues-snapshot.json (which
 * the developer hub renders) is behind the moment reconciliation returns.
 * Without this, every reconcile PR failed `check:outstanding-issues` with a fix
 * command. That is fail-closed and nothing wrong shipped, but a sanctioned path
 * that is routinely red is how gates come to be routed around.
 *
 * Deliberately OUTSIDE the reconciliation transaction, and only after it has
 * committed. `recoverReconcileTransaction` journals exactly two things — the
 * ledger backup and the pending request paths — and widening it to cover a
 * third, derived artifact would complicate the one transaction in this repo
 * that most needs to stay simple. The snapshot is regenerable from the ledger
 * at any time, so a failure here is a warning naming its own fix rather than a
 * failed reconcile: printing "refusing to reconcile" after the ledger has
 * already been rewritten would misdescribe the repository.
 *
 * Spawned with `cwd: ROOT` because the generator resolves its paths relative to
 * the working directory, and reconcile may be invoked from a subdirectory.
 */
function regenerateLedgerSnapshot() {
  try {
    execFileSync(process.execPath, ["scripts/generate-outstanding-issues-snapshot.mjs"], {
      cwd: ROOT,
      stdio: ["ignore", "inherit", "inherit"],
    });
    console.log("Commit data/outstanding-issues-snapshot.json alongside the ledger.");
  } catch (error) {
    console.warn(
      `warning: the ledger was reconciled but data/outstanding-issues-snapshot.json was NOT regenerated (${error instanceof Error ? error.message : String(error)}). Run: npm run snapshot:issues`,
    );
  }
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
  try {
    assertSafeRemoteReconciliation(argv);
  } catch (error) {
    console.error(`refusing to reconcile: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
    return;
  }

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
  const decisions =
    result.cancellations.length > 0 ? ` with ${result.cancellations.length} cancellation decision(s)` : "";
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
    regenerateLedgerSnapshot();
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
    "| #041061 <!-- issue-ulid:01M00000000410610000000000 --> | P2 | task | modern | d | s | 2026-01-01 |",
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
    payload: { id: "#001", outcome: "done", baseRowFingerprint: issueRowFingerprint(base, "#001") },
  };
  const update = {
    version: 1,
    id: "33333333-3333-4333-8333-333333333333",
    createdOn: "2026-08-13",
    action: "update",
    payload: { id: "#001", summary: "updated", baseRowFingerprint: issueRowFingerprint(base, "#001") },
  };
  const modernUpdate = {
    ...update,
    id: "66666666-6666-4666-8666-666666666666",
    payload: {
      id: "#041061",
      summary: "modern updated",
      baseRowFingerprint: issueRowFingerprint(base, "#041061"),
    },
  };
  if (!applyRequest(base, modernUpdate).includes("| modern updated |")) {
    throw new Error("self-test failed: modern Crockford display id update was not applied");
  }
  const cancel = {
    version: 1,
    id: "44444444-4444-4444-8444-444444444444",
    createdOn: "2026-08-13",
    action: "cancel",
    payload: { requestId: done.id, reason: "prefer the later update" },
  };
  // #313: a re-prioritisation must survive the whole path — accepted by the
  // validator on its own, and actually written to the Pri cell by the writer.
  // Each half failed independently while the other looked fine.
  const reprioritise = {
    version: 1,
    id: "55555555-5555-4555-8555-555555555555",
    createdOn: "2026-08-13",
    action: "update",
    payload: { id: "#001", pri: "P3", baseRowFingerprint: issueRowFingerprint(base, "#001") },
  };
  if (validateRequest(reprioritise).length > 0) {
    throw new Error("self-test failed: a pri-only update request must validate");
  }
  if (validateRequest({ ...reprioritise, payload: { id: "#001", pri: "P9" } }).length === 0) {
    throw new Error("self-test failed: an out-of-range pri must be rejected");
  }
  const reprioritised = applyRequest(base, reprioritise);
  if (!/\|\s*#001\s*\|\s*P3\s*\|/.test(reprioritised)) {
    throw new Error("self-test failed: a pri-only update did not reach the Pri cell");
  }

  // #M6JNR8: a queue re-grade must survive the whole path — validated, carried
  // by a request, fingerprinted against the queue row rather than the
  // Open-items row, and written to the Acuity cell without disturbing Order or
  // the ID(s) linkage. The base fixture's queue is deliberately two columns
  // wide, so this needs a fixture shaped like the real seven-column queue.
  const queueBase = base.replace(
    ["| Order | ID(s) |", "| --- | --- |", "| 1 | `#001` |"].join("\n"),
    [
      "| Order | ID(s) | Acuity | Capability | When | Estimate | Outcome |",
      "| --- | --- | --- | --- | --- | --- | --- |",
      "| 1 | `#001` | A1 | Specialist | Immediate | 2h | investigate |",
    ].join("\n"),
  );
  const regrade = {
    version: 1,
    id: "77777777-7777-4777-8777-777777777777",
    createdOn: "2026-08-13",
    action: "queue",
    payload: {
      id: "#001",
      acuity: "A3",
      when: "After the next release",
      baseRowFingerprint: queueRowFingerprint(queueBase, "#001"),
    },
  };
  if (validateRequest(regrade).length > 0) {
    throw new Error("self-test failed: a queue re-grade request must validate");
  }
  if (validateRequest({ ...regrade, payload: { id: "#001" } }).length === 0) {
    throw new Error("self-test failed: a queue request with no editable field must be rejected");
  }
  const regraded = applyRequest(queueBase, regrade);
  if (!/\|\s*1\s*\|\s*`#001`\s*\|\s*A3\s*\|/.test(regraded)) {
    throw new Error("self-test failed: a queue re-grade did not reach the Acuity cell");
  }
  if (!/\|\s*#001\s*\|\s*P2\s*\|/.test(regraded)) {
    throw new Error("self-test failed: a queue re-grade must not touch the Open-items row");
  }
  // The whole point of the fingerprint is that it tracks the QUEUE row: an edit
  // to the Open-items row must not invalidate a queued re-grade, and an edit to
  // the queue row must.
  let staleQueueRejected = false;
  try {
    applyRequest(queueBase.replace("| 1 | `#001` | A1 |", "| 1 | `#001` | A2 |"), regrade);
  } catch (error) {
    staleQueueRejected = /stale/.test(String(error));
  }
  if (!staleQueueRejected) throw new Error("self-test failed: stale queue request was not rejected");
  if (!applyRequest(queueBase.replace("| #001 | P2 | issue | one |", "| #001 | P2 | issue | one prime |"), regrade)) {
    throw new Error("self-test failed: an unrelated Open-items edit invalidated a queue re-grade");
  }
  // A queue edit and an Open-items update for the same id are two rows, so
  // reconciling both in one batch must not demand a cancellation decision.
  if (mutationConflicts([regrade, update]).length > 0) {
    throw new Error("self-test failed: a queue edit and an open-row update were treated as conflicting");
  }
  if (mutationConflicts([regrade, { ...regrade, id: "88888888-8888-4888-8888-888888888888" }]).length !== 1) {
    throw new Error("self-test failed: two queue edits for one id must conflict");
  }

  const added = applyRequest(base, add);
  const replayed = applyRequest(base, add);
  const legacyUlid = issueUlidFromRequest(add.createdOn, add.id);
  if (!added.includes(`issue-ulid:${legacyUlid}`) || added !== replayed) {
    throw new Error("self-test failed: legacy queued add did not derive a stable durable id");
  }
  const v2Add = {
    ...add,
    version: 2,
    payload: { ...add.payload, issueUlid: issueUlid(1, new Uint8Array(10)) },
  };
  if (validateRequest(v2Add).length > 0 || !applyRequest(base, v2Add).includes(v2Add.payload.issueUlid)) {
    throw new Error("self-test failed: version 2 add did not preserve its durable id");
  }
  if (validateRequest({ ...v2Add, payload: { ...v2Add.payload, issueUlid: "invalid" } }).length === 0) {
    throw new Error("self-test failed: invalid version 2 durable id accepted");
  }
  const resolved = applyRequest(base, done);
  if (resolved.includes("`#001`"))
    throw new Error("self-test failed: queued resolve did not preserve ledger invariants");
  if (validateRequest({ ...add, payload: {} }).length === 0)
    throw new Error("self-test failed: invalid request accepted");

  const staleBase = base.replace("one", "stale");
  let staleRejected = false;
  try {
    applyRequest(staleBase, done);
  } catch (error) {
    staleRejected = /stale/.test(String(error));
  }
  if (!staleRejected) throw new Error("self-test failed: stale done request was not rejected");
  let staleUpdateRejected = false;
  try {
    applyRequest(staleBase, update);
  } catch (error) {
    staleUpdateRejected = /stale/.test(String(error));
  }
  if (!staleUpdateRejected) throw new Error("self-test failed: stale update request was not rejected");

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

  // Pre-flight remote interlock self-test (#EH9VA6)
  const offlineResult = findUnmergedRemoteReconciliations({
    runner: () => {
      throw new Error("offline");
    },
  });
  if (offlineResult.length !== 0) {
    throw new Error("self-test failed: remote check must fail open when offline");
  }

  const cleanRemoteOutput = [`${"a".repeat(40)}\trefs/heads/main`, `${"b".repeat(40)}\trefs/heads/feature-branch`].join(
    "\n",
  );
  const cleanResult = findUnmergedRemoteReconciliations({
    lsRemoteOutput: cleanRemoteOutput,
    currentBranch: "feature-branch",
  });
  if (cleanResult.length !== 0) {
    throw new Error("self-test failed: clean remote branches must report no conflicts");
  }

  const conflictingRemoteOutput = [
    `${"a".repeat(40)}\trefs/heads/main`,
    `${"c".repeat(40)}\trefs/heads/claude/issues-reconcile-20260818`,
  ].join("\n");
  const conflictResult = findUnmergedRemoteReconciliations({
    lsRemoteOutput: conflictingRemoteOutput,
    currentBranch: "feature-branch",
  });
  if (conflictResult.length === 0 || conflictResult[0].branch !== "claude/issues-reconcile-20260818") {
    throw new Error("self-test failed: unmerged reconcile branch on origin was not detected");
  }

  let remoteInterlockError = false;
  try {
    assertSafeRemoteReconciliation([], {
      lsRemoteOutput: conflictingRemoteOutput,
      currentBranch: "feature-branch",
    });
  } catch (error) {
    remoteInterlockError = /detected unmerged branch/.test(String(error));
  }
  if (!remoteInterlockError) {
    throw new Error(
      "self-test failed: assertSafeRemoteReconciliation must throw when unmerged reconcile branch is found",
    );
  }

  const remoteWarnings = [];
  assertSafeRemoteReconciliation(["--allow-concurrent"], {
    lsRemoteOutput: conflictingRemoteOutput,
    currentBranch: "feature-branch",
    warn: (msg) => remoteWarnings.push(msg),
  });
  if (remoteWarnings.length === 0 || !remoteWarnings[0].includes("claude/issues-reconcile-20260818")) {
    throw new Error("self-test failed: --allow-concurrent must warn loudly rather than throw");
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
    throw new Error("usage: ledger-inbox.mjs <add|done|update|queue|cancel|reconcile|check> [args]");
  } catch (error) {
    console.error(`ledger inbox: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

if (process.argv[1]?.endsWith("ledger-inbox.mjs")) main();
