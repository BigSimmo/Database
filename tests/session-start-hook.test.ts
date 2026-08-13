import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

/**
 * `.claude/hooks/session-start.sh` provisions a Node meeting the repo's
 * engine floor. It normally runs as a SessionStart hook, where Claude Code
 * supplies `CLAUDE_ENV_FILE` and `CLAUDE_PROJECT_DIR`.
 *
 * **Running it by hand is a supported path, not a curiosity.** SessionStart
 * hooks do not re-fire when a long-lived session re-bases its checkout onto a
 * newer `main`, so a session that predates this file acquires it without ever
 * executing it, stays on the container's older Node, and then fails
 * `check:runtime` — the first step of `verify:pr-local` — for every diff,
 * docs-only ones included. Running this script is the documented remedy, and
 * `checkNodeRuntime`'s failure message now names it.
 *
 * It ran under `set -u` with both variables expanded unguarded, so a manual run
 * aborted with `CLAUDE_ENV_FILE: unbound variable` — *after* the Node tarball had
 * downloaded and extracted, but before PATH was exported and before the install.
 * The operator saw a failure, got no runtime, and had no way to tell the download
 * had actually succeeded. These tests pin that it survives both variables being
 * absent, and that it still writes the env file when one is provided.
 *
 * The hook is driven with a stub `node` already in place so it never downloads,
 * and with a lockfile stamp that matches, so it never installs.
 */

const hook = join(process.cwd(), ".claude/hooks/session-start.sh");
const NODE_VERSION = "24.19.0";
const scratchRoots: string[] = [];

afterEach(() => {
  for (const root of scratchRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

/**
 * A HOME containing the exact provisioned Node layout the hook looks for, and a
 * project whose dependency stamp already matches its lockfile.
 *
 * Both halves exist to keep the test hermetic: with a supported `node` on PATH
 * the hook skips the network download, and with a current stamp it skips
 * `npm ci`. What is left is precisely the variable handling under test.
 */
function stubEnvironment(): { home: string; project: string } {
  const home = mkdtempSync(join(tmpdir(), "session-start-home-"));
  const project = mkdtempSync(join(tmpdir(), "session-start-project-"));
  scratchRoots.push(home, project);

  const nodeBin = join(home, ".node24", `node-v${NODE_VERSION}-linux-x64`, "bin");
  mkdirSync(nodeBin, { recursive: true });
  const stub = join(nodeBin, "node");
  writeFileSync(stub, `#!/bin/bash\necho "v${NODE_VERSION}"\n`);
  chmodSync(stub, 0o755);

  const lockfile = join(project, "package-lock.json");
  const lockContents = '{"name":"stub","lockfileVersion":3}\n';
  writeFileSync(lockfile, lockContents);
  const stampDir = join(project, "node_modules", ".cache");
  mkdirSync(stampDir, { recursive: true });
  writeFileSync(
    join(stampDir, "session-start-lock-hash"),
    `${createHash("sha256").update(lockContents).digest("hex")}\n`.trimEnd() + "\n",
  );

  return { home, project };
}

function runHook(env: Record<string, string | undefined>, cwd: string) {
  const base = { ...process.env, CLAUDE_CODE_REMOTE: "true", ...env };
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete (base as Record<string, string | undefined>)[key];
  }
  return spawnSync("bash", [hook], { cwd, env: base as NodeJS.ProcessEnv, encoding: "utf8" });
}

describe("session-start hook", () => {
  it("survives a manual run with no CLAUDE_ENV_FILE or CLAUDE_PROJECT_DIR", () => {
    const { home, project } = stubEnvironment();

    const result = runHook({ HOME: home, CLAUDE_ENV_FILE: undefined, CLAUDE_PROJECT_DIR: project }, project);

    expect(result.stderr).not.toContain("unbound variable");
    expect(result.status, `hook exited ${result.status}: ${result.stderr}`).toBe(0);
    // It must say so rather than silently exporting into the void, and hand back
    // the line that makes the runtime stick.
    expect(result.stdout).toContain("CLAUDE_ENV_FILE is unset");
    expect(result.stdout).toContain("export PATH=");
  });

  it("falls back to its own repository when CLAUDE_PROJECT_DIR is absent", () => {
    const { home } = stubEnvironment();

    // Deliberately run from a directory that is neither the repo nor a project:
    // the fallback derives from the script's own path, so cwd must not matter.
    const elsewhere = mkdtempSync(join(tmpdir(), "session-start-elsewhere-"));
    scratchRoots.push(elsewhere);
    const result = runHook({ HOME: home, CLAUDE_ENV_FILE: undefined, CLAUDE_PROJECT_DIR: undefined }, elsewhere);

    expect(result.stderr).not.toContain("unbound variable");
    expect(result.status, `hook exited ${result.status}: ${result.stderr}`).toBe(0);
    // It reached the dependency step in the real repo, which is the only place a
    // lockfile exists — proof the fallback resolved somewhere real.
    expect(result.stdout).toMatch(/node_modules matches the lockfile|Dependencies (re)?installed|reinstalling/);
  });

  it("still writes the env file when Claude Code provides one", () => {
    const { home, project } = stubEnvironment();
    const envFile = join(project, "claude-env");
    writeFileSync(envFile, "");

    const result = runHook({ HOME: home, CLAUDE_ENV_FILE: envFile, CLAUDE_PROJECT_DIR: project }, project);

    expect(result.status, `hook exited ${result.status}: ${result.stderr}`).toBe(0);
    const written = readFileSync(envFile, "utf8");
    expect(written).toContain(join(home, ".node24", `node-v${NODE_VERSION}-linux-x64`, "bin"));
    expect(written).toContain("export PATH=");
    // The manual-run advice belongs only to the manual-run branch.
    expect(result.stdout).not.toContain("CLAUDE_ENV_FILE is unset");
  });

  it("does nothing at all outside a Claude Code remote container", () => {
    const { home, project } = stubEnvironment();

    const result = runHook(
      { HOME: home, CLAUDE_CODE_REMOTE: undefined, CLAUDE_ENV_FILE: undefined, CLAUDE_PROJECT_DIR: undefined },
      project,
    );

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("");
  });
});
