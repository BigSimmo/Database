import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { redactSensitiveText } from "./sensitive-text.mjs";

const tokenEnvironmentKey = "CLINICAL_KB_HEAVY_LOCK_TOKEN";
const pathEnvironmentKey = "CLINICAL_KB_HEAVY_LOCK_PATH";
const incompleteLockGraceMs = 30_000;

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function normalizeIdentity(value) {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function resolveRepositoryIdentity(projectRoot) {
  const result = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const gitCommonDirectory = typeof result.stdout === "string" ? result.stdout.trim() : "";
  if (result.status === 0 && gitCommonDirectory) return normalizeIdentity(gitCommonDirectory);

  // Docker build contexts intentionally omit .git. They cannot share worktrees
  // with the host, so a validated workspace-local identity keeps nested build
  // commands safe without weakening the common-directory lock in Git checkouts.
  try {
    const manifest = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8"));
    if (manifest.name === "prompt-for-codex-medical-knowledge-base") return normalizeIdentity(projectRoot);
  } catch {
    // Preserve the explicit error below for an invalid working directory.
  }
  throw new Error("Could not resolve the shared Git directory for the Database heavyweight-run lock.");
}

function lockPathFor(repositoryIdentity, baseDirectory = os.tmpdir()) {
  const repositoryId = createHash("sha256").update(normalizeIdentity(repositoryIdentity)).digest("hex").slice(0, 20);
  return path.join(baseDirectory, "clinical-kb-heavy-locks", `${repositoryId}.lock`);
}

function readOwner(lockPath) {
  try {
    return JSON.parse(readFileSync(path.join(lockPath, "owner.json"), "utf8"));
  } catch {
    return null;
  }
}

function lockIsOldEnoughToRecover(lockPath, now = Date.now()) {
  try {
    return now - statSync(lockPath).mtimeMs >= incompleteLockGraceMs;
  } catch {
    return false;
  }
}

/**
 * @param {{
 *   projectRoot: string;
 *   command?: string;
 *   environment?: Record<string, string | undefined>;
 *   baseDirectory?: string;
 *   repositoryIdentity?: string;
 *   processId?: number;
 *   waitMs?: number;
 * }} options
 */
export function acquireHeavyRunLock({
  projectRoot,
  command = process.argv.join(" "),
  environment = process.env,
  baseDirectory,
  repositoryIdentity = resolveRepositoryIdentity(projectRoot),
  processId = process.pid,
  waitMs = environment.CLINICAL_KB_LOCK_WAIT_MS ? parseInt(environment.CLINICAL_KB_LOCK_WAIT_MS, 10) : 0,
}) {
  if (!projectRoot) throw new Error("projectRoot is required for the Database heavyweight-run lock.");
  const lockPath = lockPathFor(repositoryIdentity, baseDirectory);
  const inheritedToken = environment[tokenEnvironmentKey];
  const inheritedPath = environment[pathEnvironmentKey];

  if (inheritedToken || inheritedPath) {
    if (!inheritedToken || normalizeIdentity(inheritedPath) !== normalizeIdentity(lockPath)) {
      throw new Error("The inherited Database heavyweight-run lock does not match this repository.");
    }
    const owner = readOwner(lockPath);
    if (owner?.token !== inheritedToken || !processIsAlive(owner.pid)) {
      throw new Error("The inherited Database heavyweight-run lock is no longer owned by a live parent process.");
    }
    return { path: lockPath, owner, environment: { ...environment }, reentrant: true, release() {} };
  }

  mkdirSync(path.dirname(lockPath), { recursive: true });
  const startTime = Date.now();
  for (let attempt = 0; ; attempt += 1) {
    try {
      mkdirSync(lockPath);
      const token = randomUUID();
      const safeCommand = redactSensitiveText(command);
      const owner = {
        pid: processId,
        token,
        command: safeCommand,
        worktree: path.resolve(projectRoot),
        repositoryIdentity: normalizeIdentity(repositoryIdentity),
        startedAt: new Date().toISOString(),
      };
      writeFileSync(path.join(lockPath, "owner.json"), `${JSON.stringify(owner, null, 2)}\n`, "utf8");
      let released = false;
      return {
        path: lockPath,
        owner,
        reentrant: false,
        environment: {
          ...environment,
          [tokenEnvironmentKey]: token,
          [pathEnvironmentKey]: lockPath,
        },
        release() {
          if (released) return;
          released = true;
          if (readOwner(lockPath)?.token === token) rmSync(lockPath, { recursive: true, force: true });
        },
      };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const owner = readOwner(lockPath);
      if (owner && processIsAlive(owner.pid)) {
        // Enforce max 5 minutes staleness limit for inactive idle processes (Issue 2)
        const startedTime = new Date(owner.startedAt).getTime();
        const maxStaleness = 5 * 60 * 1000;
        if (!isNaN(startedTime) && Date.now() - startedTime > maxStaleness) {
          rmSync(lockPath, { recursive: true, force: true });
          continue;
        }

        if (Date.now() - startTime < waitMs) {
          const delayMs = Math.min(1000, 500 * Math.pow(1.5, attempt)) + Math.random() * 100;
          spawnSync(process.argv[0], ["-e", `setTimeout(()=>{}, ${Math.floor(delayMs)})`]);
          continue;
        }
        throw new Error(
          `Another Database heavyweight command is active (PID ${owner.pid}, worktree ${owner.worktree ?? "unknown"}, started ${owner.startedAt ?? "unknown"}): ${redactSensitiveText(owner.command ?? "unknown command")}`,
        );
      }
      if (!owner && !lockIsOldEnoughToRecover(lockPath)) {
        if (Date.now() - startTime < waitMs) {
          const delayMs = Math.min(1000, 500 * Math.pow(1.5, attempt)) + Math.random() * 100;
          spawnSync(process.argv[0], ["-e", `setTimeout(()=>{}, ${Math.floor(delayMs)})`]);
          continue;
        }
        throw new Error(`A Database heavyweight lock is being initialized at ${lockPath}; retry after it settles.`);
      }
      rmSync(lockPath, { recursive: true, force: true });
    }
  }
  throw new Error(`Could not acquire the Database heavyweight-run lock at ${lockPath}.`);
}

export const testRunLockInternals = {
  lockPathFor,
  processIsAlive,
  readOwner,
  resolveRepositoryIdentity,
  tokenEnvironmentKey,
  pathEnvironmentKey,
};
