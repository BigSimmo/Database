import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const hook = join(process.cwd(), ".claude/hooks/push-format-guard.sh");
const scratchRoots: string[] = [];

afterEach(() => {
  for (const root of scratchRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

/**
 * A repo whose Prettier check is rigged to FAIL, so "the guard ran" is
 * observable as a deny decision rather than as silence. Silence is ambiguous
 * on its own: the hook also exits 0 and prints nothing when it self-disables,
 * when npx is missing, and when node_modules/prettier is absent — so a test
 * asserting only `stdout === ""` would pass even if the guard had been deleted.
 */
function riggedRepo(options?: { prePush?: "executable" | "not-executable" | "absent" }): {
  root: string;
  binDir: string;
} {
  const root = mkdtempSync(join(tmpdir(), "push-format-guard-"));
  scratchRoots.push(root);
  execFileSync("git", ["init", "-q"], { cwd: root });

  // The hook refuses to run the check unless a real prettier install looks
  // present; the directory alone satisfies that gate.
  mkdirSync(join(root, "node_modules/prettier"), { recursive: true });

  const prePush = options?.prePush ?? "executable";
  if (prePush !== "absent") {
    mkdirSync(join(root, ".githooks"), { recursive: true });
    const path = join(root, ".githooks/pre-push");
    writeFileSync(path, "#!/usr/bin/env bash\nexit 0\n");
    chmodSync(path, prePush === "executable" ? 0o755 : 0o644);
  } else {
    mkdirSync(join(root, ".githooks"), { recursive: true });
  }

  // Shim npx so the repository-wide Prettier check reports unformatted files
  // without needing a real Prettier in the fixture.
  const binDir = mkdtempSync(join(tmpdir(), "push-format-guard-bin-"));
  scratchRoots.push(binDir);
  const npx = join(binDir, "npx");
  writeFileSync(npx, '#!/usr/bin/env bash\necho "[warn] bad.js"\nexit 1\n');
  chmodSync(npx, 0o755);

  return { root, binDir };
}

function setHooksPath(root: string, value: string | null): void {
  if (value === null) {
    spawnSync("git", ["config", "--unset", "core.hooksPath"], { cwd: root });
    return;
  }
  execFileSync("git", ["config", "core.hooksPath", value], { cwd: root });
}

function runHook(
  root: string,
  binDir: string,
  command = "git push origin HEAD",
): { status: number | null; stdout: string; denied: boolean } {
  const result = spawnSync("bash", [hook], {
    cwd: root,
    input: JSON.stringify({
      session_id: "sess",
      tool_name: "Bash",
      tool_input: { command },
      cwd: root,
    }),
    encoding: "utf8",
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: root,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
    },
  });
  const stdout = result.stdout ?? "";
  return {
    status: result.status,
    stdout,
    denied: stdout.includes('"permissionDecision":"deny"'),
  };
}

// The hook is a Bash contract exercised on Linux CI. Windows' `bash.exe` is a
// WSL launcher: it cannot execute the native absolute paths this fixture gives
// it, and `core.fileMode=false` on the ReFS Dev Drive makes the
// not-executable case unrepresentable there. That is neither the hook's
// runtime nor meaningful Windows coverage, so avoid false local reds.
describe.skipIf(process.platform === "win32")("push-format-guard", () => {
  describe("self-disables when this repo's pre-push hook is genuinely wired", () => {
    // `core.hooksPath` is absolute OR relative to the top of the working tree.
    // `npm install` in this repo writes the bare relative form, which a
    // `*/.githooks` suffix glob cannot match — so the guard ran a full
    // repository Prettier check on every push in a correctly wired checkout
    // (>100 s per push, measured 2026-08-22). All three spellings name the
    // same directory and must behave identically.
    for (const spelling of [".githooks", "./.githooks"]) {
      it(`stays silent for the relative spelling ${JSON.stringify(spelling)}`, () => {
        const { root, binDir } = riggedRepo();
        setHooksPath(root, spelling);
        const out = runHook(root, binDir);
        expect(out.denied).toBe(false);
        expect(out.stdout).toBe("");
        expect(out.status).toBe(0);
      });
    }

    it("stays silent for the absolute spelling", () => {
      const { root, binDir } = riggedRepo();
      setHooksPath(root, join(root, ".githooks"));
      const out = runHook(root, binDir);
      expect(out.denied).toBe(false);
      expect(out.stdout).toBe("");
    });
  });

  describe("still fires in the gap case it exists for", () => {
    it("denies an unformatted push when core.hooksPath is unset", () => {
      const { root, binDir } = riggedRepo();
      setHooksPath(root, null);
      const out = runHook(root, binDir);
      expect(out.denied).toBe(true);
      expect(out.status).toBe(0);
    });

    it("denies when core.hooksPath is wired but pre-push is missing", () => {
      const { root, binDir } = riggedRepo({ prePush: "absent" });
      setHooksPath(root, ".githooks");
      expect(runHook(root, binDir).denied).toBe(true);
    });

    it("denies when core.hooksPath is wired but pre-push is not executable", () => {
      const { root, binDir } = riggedRepo({ prePush: "not-executable" });
      setHooksPath(root, ".githooks");
      expect(runHook(root, binDir).denied).toBe(true);
    });

    it("denies when core.hooksPath points at a DIFFERENT repository's .githooks", () => {
      // A suffix match on `*/.githooks` accepted any path ending in that name,
      // including another checkout's — whose pre-push hook does not guard this
      // push at all. The comparison is exact for that reason.
      const { root, binDir } = riggedRepo();
      const foreign = mkdtempSync(join(tmpdir(), "push-format-guard-foreign-"));
      scratchRoots.push(foreign);
      mkdirSync(join(foreign, ".githooks"), { recursive: true });
      const path = join(foreign, ".githooks/pre-push");
      writeFileSync(path, "#!/usr/bin/env bash\nexit 0\n");
      chmodSync(path, 0o755);
      setHooksPath(root, join(foreign, ".githooks"));
      expect(runHook(root, binDir).denied).toBe(true);
    });
  });

  describe("scope", () => {
    it("ignores a command that is not a push, even with the guard armed", () => {
      const { root, binDir } = riggedRepo();
      setHooksPath(root, null);
      const out = runHook(root, binDir, "echo hello");
      expect(out.denied).toBe(false);
      expect(out.stdout).toBe("");
    });

    it("honours the documented CLAUDE_ALLOW_UNFORMATTED_PUSH=1 prefix", () => {
      const { root, binDir } = riggedRepo();
      setHooksPath(root, null);
      const out = runHook(root, binDir, "CLAUDE_ALLOW_UNFORMATTED_PUSH=1 git push origin HEAD");
      expect(out.denied).toBe(false);
    });
  });
});
