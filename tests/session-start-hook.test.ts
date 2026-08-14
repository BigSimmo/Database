import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
 * `checkNodeRuntime`'s failure message now names both the hook and the caller-
 * persistent export required after a manual invocation.
 *
 * It ran under `set -u` with both variables expanded unguarded, so a manual run
 * aborted with `CLAUDE_ENV_FILE: unbound variable` after the Node tarball had
 * downloaded and after PATH had changed only inside the soon-to-exit child
 * process, but before PATH persistence and before the install. These tests pin
 * that it survives both variables being absent, prints a command that activates
 * the provisioned Node in the invoking shell, and still writes the env file when
 * one is provided.
 *
 * Each test copies the hook into a temporary project, supplies stub `node` and
 * `npm` executables, and writes a matching lockfile stamp. That keeps the tests
 * hermetic: they never download, install, or touch the real checkout.
 */

const sourceHook = join(process.cwd(), ".claude/hooks/session-start.sh");
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
 */
function stubEnvironment(): { home: string; project: string; hook: string } {
  const home = mkdtempSync(join(tmpdir(), "session-start-home-"));
  const project = mkdtempSync(join(tmpdir(), "session-start-project-"));
  scratchRoots.push(home, project);

  const hookDir = join(project, ".claude", "hooks");
  mkdirSync(hookDir, { recursive: true });
  const hook = join(hookDir, "session-start.sh");
  copyFileSync(sourceHook, hook);
  chmodSync(hook, 0o755);

  const nodeBin = join(home, ".node24", `node-v${NODE_VERSION}-linux-x64`, "bin");
  mkdirSync(nodeBin, { recursive: true });
  const nodeStub = join(nodeBin, "node");
  writeFileSync(nodeStub, `#!/bin/bash\necho "v${NODE_VERSION}"\n`);
  chmodSync(nodeStub, 0o755);
  const npmStub = join(nodeBin, "npm");
  writeFileSync(npmStub, '#!/bin/bash\nif [ "${1:-}" = "ci" ]; then exit 97; fi\necho "11.17.0"\n');
  chmodSync(npmStub, 0o755);

  const lockfile = join(project, "package-lock.json");
  const lockContents = '{"name":"stub","lockfileVersion":3}\n';
  writeFileSync(lockfile, lockContents);
  const stampDir = join(project, "node_modules", ".cache");
  mkdirSync(stampDir, { recursive: true });
  writeFileSync(
    join(stampDir, "session-start-lock-hash"),
    `${createHash("sha256").update(lockContents).digest("hex")}\n`.trimEnd() + "\n",
  );

  return { home, project, hook };
}

function runHook(hook: string, env: Record<string, string | undefined>, cwd: string) {
  const base = { ...process.env, CLAUDE_CODE_REMOTE: "true", ...env };
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete (base as Record<string, string | undefined>)[key];
  }
  return spawnSync("bash", [hook], { cwd, env: base as NodeJS.ProcessEnv, encoding: "utf8" });
}

describe("session-start hook", () => {
  it("survives a manual run with no CLAUDE_ENV_FILE", () => {
    const { home, project, hook } = stubEnvironment();

    const result = runHook(hook, { HOME: home, CLAUDE_ENV_FILE: undefined, CLAUDE_PROJECT_DIR: project }, project);

    expect(result.stderr).not.toContain("unbound variable");
    expect(result.status, `hook exited ${result.status}: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("CLAUDE_ENV_FILE is unset");
    expect(result.stdout).toContain("export PATH=");
  });

  it("prints a PATH command that activates the provisioned Node in the invoking shell", () => {
    const { home, project, hook } = stubEnvironment();
    const result = runHook(hook, { HOME: home, CLAUDE_ENV_FILE: undefined, CLAUDE_PROJECT_DIR: project }, project);

    expect(result.status, `hook exited ${result.status}: ${result.stderr}`).toBe(0);
    const exportLine = result.stdout.split(/\r?\n/).find((line) => line.startsWith("export PATH="));
    expect(exportLine).toBeDefined();

    const caller = spawnSync("bash", ["-c", `${exportLine}; node -v`], {
      cwd: project,
      env: { ...process.env, HOME: home },
      encoding: "utf8",
    });
    expect(caller.status, `caller exited ${caller.status}: ${caller.stderr}`).toBe(0);
    expect(caller.stdout.trim()).toBe(`v${NODE_VERSION}`);
  });

  it("falls back to its own repository when CLAUDE_PROJECT_DIR is absent", () => {
    const { home, hook } = stubEnvironment();

    // Deliberately run from a directory that is neither the repo nor the
    // temporary project: the fallback must derive from the copied hook's path.
    const elsewhere = mkdtempSync(join(tmpdir(), "session-start-elsewhere-"));
    scratchRoots.push(elsewhere);
    const result = runHook(hook, { HOME: home, CLAUDE_ENV_FILE: undefined, CLAUDE_PROJECT_DIR: undefined }, elsewhere);

    expect(result.stderr).not.toContain("unbound variable");
    expect(result.status, `hook exited ${result.status}: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("node_modules matches the lockfile, skipping install");
  });

  it("still writes the env file when Claude Code provides one", () => {
    const { home, project, hook } = stubEnvironment();
    const envFile = join(project, "claude-env");
    writeFileSync(envFile, "");

    const result = runHook(hook, { HOME: home, CLAUDE_ENV_FILE: envFile, CLAUDE_PROJECT_DIR: project }, project);

    expect(result.status, `hook exited ${result.status}: ${result.stderr}`).toBe(0);
    const written = readFileSync(envFile, "utf8");
    expect(written).toContain(join(home, ".node24", `node-v${NODE_VERSION}-linux-x64`, "bin"));
    expect(written).toContain("export PATH=");
    // The manual-run advice belongs only to the manual-run branch.
    expect(result.stdout).not.toContain("CLAUDE_ENV_FILE is unset");
  });

  it("does nothing at all outside a Claude Code remote container", () => {
    const { home, project, hook } = stubEnvironment();

    const result = runHook(
      hook,
      { HOME: home, CLAUDE_CODE_REMOTE: undefined, CLAUDE_ENV_FILE: undefined, CLAUDE_PROJECT_DIR: undefined },
      project,
    );

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("");
  });
});
