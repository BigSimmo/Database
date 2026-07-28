#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseWorktreePorcelain, reconciliationPreflightInternals } from "./reconciliation-preflight.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const incompleteLeaseGraceMs = 30_000;

/**
 * @typedef {{
 *   path: string;
 *   branch: string | null;
 *   statusEntries: number | null;
 *   operations: string[];
 *   inspectionErrors: string[];
 * }} PrimaryCheckoutState
 */

function normalizeIdentity(value) {
  const resolved = path.resolve(String(value ?? ""));
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function git(args, cwd = repositoryRoot) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 15_000,
    windowsHide: true,
  });
  if (result.status !== 0 || result.error) {
    throw new Error(`Could not inspect Git state required by the primary-checkout guard (${args[0] ?? "git"}).`);
  }
  return String(result.stdout ?? "").trim();
}

function resolveRepositoryIdentity() {
  return normalizeIdentity(git(["rev-parse", "--path-format=absolute", "--git-common-dir"]));
}

function resolvePrimaryCheckout() {
  const [primary] = parseWorktreePorcelain(git(["worktree", "list", "--porcelain"]));
  if (!primary?.path) throw new Error("Could not resolve the canonical primary checkout; mutation is blocked.");
  return { ...primary, path: path.resolve(primary.path) };
}

function inspectPrimaryCheckout() {
  const primary = resolvePrimaryCheckout();
  const status = git(["--no-optional-locks", "status", "--porcelain=v1", "--untracked-files=normal"], primary.path);
  const gitDirectory = git(["rev-parse", "--path-format=absolute", "--git-dir"], primary.path);
  return {
    path: primary.path,
    branch: primary.branch ?? null,
    statusEntries: status.split(/\r?\n/).filter(Boolean).length,
    operations: reconciliationPreflightInternals.operationMarkers.filter((marker) =>
      existsSync(path.join(gitDirectory, marker)),
    ),
    inspectionErrors: [],
  };
}

function lockPathFor(repositoryIdentity, baseDirectory = os.tmpdir()) {
  const repositoryId = createHash("sha256").update(normalizeIdentity(repositoryIdentity)).digest("hex").slice(0, 20);
  return path.join(baseDirectory, "clinical-kb-primary-checkout-leases", `${repositoryId}.lock`);
}

function readOwnerRecord(lockPath) {
  if (!existsSync(lockPath)) return { state: "absent", owner: null };
  try {
    const owner = JSON.parse(readFileSync(path.join(lockPath, "owner.json"), "utf8"));
    if (!owner || !Number.isInteger(owner.pid) || owner.pid <= 0 || typeof owner.token !== "string") {
      return { state: "unreadable", owner: null };
    }
    return { state: "valid", owner };
  } catch {
    return { state: "unreadable", owner: null };
  }
}

function leaseIsOldEnoughToRecover(lockPath, now = Date.now()) {
  try {
    return now - statSync(lockPath).mtimeMs >= incompleteLeaseGraceMs;
  } catch {
    return false;
  }
}

function safeOwner(owner, live) {
  if (!owner) return null;
  return {
    live,
    pid: owner.pid,
    ownerWorktree: owner.ownerWorktree ?? null,
    primaryPath: owner.primaryPath ?? null,
    startedAt: owner.startedAt ?? null,
  };
}

function assertPrimaryCanMutate(primary) {
  if (!primary || primary.inspectionErrors?.length > 0 || !Number.isInteger(primary.statusEntries)) {
    throw new Error("Primary checkout state could not be inspected completely; mutation is blocked.");
  }
  if (primary.operations?.length > 0) {
    throw new Error(
      `Primary checkout has an active Git operation (${primary.operations.join(", ")}); mutation is blocked.`,
    );
  }
  if (primary.statusEntries > 0) {
    throw new Error(
      `Primary checkout is dirty (${primary.statusEntries} entries); preserve and classify it before mutation.`,
    );
  }
}

/**
 * Acquire an atomic lease for one primary-checkout mutation. The caller must
 * hold the returned lease until the child mutation exits.
 */
/**
 * @param {{
 *   repositoryIdentity?: string;
 *   baseDirectory?: string;
 *   ownerWorktree?: string;
 *   processId?: number;
 *   inspectPrimary?: () => PrimaryCheckoutState;
 *   processIsAlive?: (pid: number) => boolean;
 * }} [options]
 */
export function acquirePrimaryCheckoutLease(options = {}) {
  const {
    repositoryIdentity = resolveRepositoryIdentity(),
    baseDirectory,
    ownerWorktree = process.cwd(),
    processId = process.pid,
    inspectPrimary = inspectPrimaryCheckout,
    processIsAlive: ownerIsAlive = processIsAlive,
  } = options;
  const lockPath = lockPathFor(repositoryIdentity, baseDirectory);
  mkdirSync(path.dirname(lockPath), { recursive: true });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      mkdirSync(lockPath);
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const record = readOwnerRecord(lockPath);
      if (record.state === "valid" && ownerIsAlive(record.owner.pid)) {
        throw new Error(
          `Another primary-checkout mutation is active (PID ${record.owner.pid}, ` +
            `worktree ${record.owner.ownerWorktree ?? "unknown"}, started ${record.owner.startedAt ?? "unknown"}).`,
        );
      }
      if (record.state === "unreadable" && !leaseIsOldEnoughToRecover(lockPath)) {
        throw new Error(`The primary-checkout ownership record is unreadable at ${lockPath}; mutation is blocked.`);
      }
      rmSync(lockPath, { recursive: true, force: true });
      continue;
    }

    const token = randomUUID();
    let primary;
    try {
      primary = inspectPrimary();
      const owner = {
        pid: processId,
        token,
        command: "primary checkout mutation",
        ownerWorktree: path.resolve(ownerWorktree),
        primaryPath: primary?.path ? path.resolve(primary.path) : null,
        repositoryIdentity: normalizeIdentity(repositoryIdentity),
        startedAt: new Date().toISOString(),
      };
      writeFileSync(path.join(lockPath, "owner.json"), `${JSON.stringify(owner, null, 2)}\n`, "utf8");
      assertPrimaryCanMutate(primary);

      let released = false;
      return {
        path: lockPath,
        owner,
        primary,
        release() {
          if (released) return;
          released = true;
          const current = readOwnerRecord(lockPath);
          if (current.state === "valid" && current.owner.token === token) {
            rmSync(lockPath, { recursive: true, force: true });
          }
        },
      };
    } catch (error) {
      const current = readOwnerRecord(lockPath);
      if (current.state !== "valid" || current.owner.token === token) {
        rmSync(lockPath, { recursive: true, force: true });
      }
      throw error;
    }
  }

  throw new Error(`Could not acquire the primary-checkout mutation lease at ${lockPath}.`);
}

/**
 * @param {{
 *   repositoryIdentity?: string;
 *   baseDirectory?: string;
 *   inspectPrimary?: () => PrimaryCheckoutState;
 *   processIsAlive?: (pid: number) => boolean;
 * }} [options]
 */
export function inspectPrimaryCheckoutOwnership(options = {}) {
  const {
    repositoryIdentity = resolveRepositoryIdentity(),
    baseDirectory,
    inspectPrimary = inspectPrimaryCheckout,
    processIsAlive: ownerIsAlive = processIsAlive,
  } = options;
  const primary = inspectPrimary();
  const lockPath = lockPathFor(repositoryIdentity, baseDirectory);
  const record = readOwnerRecord(lockPath);
  const live = record.state === "valid" ? ownerIsAlive(record.owner.pid) : null;
  const primaryBlocked =
    !primary ||
    primary.inspectionErrors?.length > 0 ||
    !Number.isInteger(primary.statusEntries) ||
    primary.statusEntries > 0 ||
    primary.operations?.length > 0;

  return {
    primary,
    owner: record.state === "unreadable" ? { live: null, unreadable: true } : safeOwner(record.owner, live),
    mutationAllowed: !primaryBlocked && record.state !== "unreadable" && live !== true,
    staleOwnerRecoverable: record.state === "valid" && live === false,
    readOnlyWorkAllowed: true,
    independentWorktreesAllowed: true,
  };
}

function renderStatus(status) {
  console.log("Primary checkout ownership (read-only)\n");
  console.log(`Primary: ${status.primary?.path ?? "(unresolved)"}`);
  console.log(`Branch: ${status.primary?.branch ?? "(detached or unknown)"}`);
  console.log(`Dirty entries: ${status.primary?.statusEntries ?? "unknown"}`);
  console.log(`Active operation markers: ${status.primary?.operations?.join(", ") || "none"}`);
  console.log(`Live mutation owner: ${status.owner?.live === true ? "yes" : "no"}`);
  console.log(`Primary mutation allowed: ${status.mutationAllowed ? "yes" : "no"}`);
  console.log("Read-only work and independent worktrees remain allowed.");
}

function usage() {
  console.log(
    "Usage:\n" +
      "  node scripts/primary-checkout-guard.mjs status [--json]\n" +
      "  node scripts/primary-checkout-guard.mjs run -- <command> [args...]",
  );
}

function runCli(argv) {
  const [mode, ...rest] = argv;
  if (!mode || mode === "--help" || mode === "-h") {
    usage();
    return 0;
  }
  if (mode === "status") {
    const unknown = rest.filter((token) => token !== "--json");
    if (unknown.length > 0) throw new Error(`Unknown status option: ${unknown[0]}`);
    const status = inspectPrimaryCheckoutOwnership();
    if (rest.includes("--json")) console.log(JSON.stringify(status, null, 2));
    else renderStatus(status);
    return 0;
  }
  if (mode !== "run") throw new Error(`Unknown primary-checkout guard mode: ${mode}`);

  const separator = rest.indexOf("--");
  const commandParts = separator >= 0 ? rest.slice(separator + 1) : rest;
  if (commandParts.length === 0) throw new Error("A mutation command is required after `run --`.");

  const lease = acquirePrimaryCheckoutLease();
  try {
    const result = spawnSync(commandParts[0], commandParts.slice(1), {
      cwd: lease.primary.path,
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
    });
    if (result.error) throw new Error(`Could not start the guarded primary-checkout mutation: ${result.error.message}`);
    return Number.isInteger(result.status) ? result.status : 1;
  } finally {
    lease.release();
  }
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedDirectly) {
  try {
    process.exitCode = runCli(process.argv.slice(2));
  } catch (error) {
    console.error(`[primary-checkout-guard] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  }
}

export const primaryCheckoutGuardInternals = {
  incompleteLeaseGraceMs,
  leaseIsOldEnoughToRecover,
  lockPathFor,
  normalizeIdentity,
  processIsAlive,
  readOwnerRecord,
};
