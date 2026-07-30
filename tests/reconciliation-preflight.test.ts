import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import {
  classifyReconciliationState,
  collectReconciliationState,
  collectProcessDiagnostics,
  parseWorktreePorcelain,
} from "../scripts/reconciliation-preflight.mjs";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function temporaryDirectory(prefix: string) {
  const directory = mkdtempSync(path.join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

function git(args: string[], cwd: string) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `git ${args.join(" ")} failed`);
  }
  return (result.stdout ?? "").trim();
}

/** Tiny isolated repo so the collector never scales with the live worktree farm. */
function createFixtureRepository() {
  const root = temporaryDirectory("reconcil-preflight-");
  git(["init", "-b", "main"], root);
  git(["config", "user.email", "preflight@example.test"], root);
  git(["config", "user.name", "Preflight Fixture"], root);
  writeFileSync(path.join(root, "README.md"), "fixture\n", "utf8");
  git(["add", "README.md"], root);
  git(["commit", "-m", "fixture root"], root);
  return root;
}

/**
 * A genuinely shallow clone (#109). `--depth` is ignored for local-path clones, so the origin
 * has to be addressed as a `file://` URL, and it needs two commits for depth 1 to truncate
 * anything at all — hence the explicit is-shallow assertion in the caller rather than trusting
 * the flag.
 */
function createShallowCloneFixture() {
  const origin = createFixtureRepository();
  writeFileSync(path.join(origin, "second.md"), "second\n", "utf8");
  git(["add", "second.md"], origin);
  git(["commit", "-m", "second commit"], origin);
  const clone = temporaryDirectory("reconcil-shallow-");
  git(["clone", "--depth", "1", pathToFileURL(origin).href, clone], origin);
  return clone;
}

describe("reconciliation preflight", () => {
  it("parses clean, detached, locked, and prunable worktree records", () => {
    const parsed = parseWorktreePorcelain(
      [
        "worktree C:/repo",
        "HEAD abc123",
        "branch refs/heads/main",
        "",
        "worktree C:/repo-review",
        "HEAD def456",
        "detached",
        "locked active review",
        "prunable missing directory",
        "",
      ].join("\n"),
    );

    expect(parsed).toEqual([
      { path: "C:/repo", head: "abc123", branch: "main" },
      {
        path: "C:/repo-review",
        head: "def456",
        detached: true,
        locked: "active review",
        prunable: "missing directory",
      },
    ]);
  });

  it("blocks integration from a dirty or divergent primary while preserving dirty worktrees", () => {
    const result = classifyReconciliationState({
      baseRef: "origin/main",
      baseCommit: "base123",
      worktrees: [
        {
          path: "C:/repo",
          head: "old123",
          branch: "main",
          statusEntries: 2,
          operations: [],
        },
        {
          path: "C:/repo-task",
          head: "task123",
          branch: "codex/task",
          statusEntries: 1,
          operations: [],
        },
      ],
    });

    expect(result.blocking).toBe(true);
    expect(result.integrationBase).toBe("dedicated-worktree-required");
    expect(result.findings.map((item) => item.code)).toEqual([
      "primary-dirty",
      "primary-base-mismatch",
      "preserve-dirty-worktrees",
    ]);
  });

  it("fails closed on unreadable worktree state without calling it an active Git operation", () => {
    const result = classifyReconciliationState({
      baseRef: "origin/main",
      baseCommit: "base123",
      worktrees: [
        {
          path: "C:/repo",
          head: "base123",
          branch: "main",
          statusEntries: null,
          operations: [],
          inspectionErrors: ["status-unreadable", "git-directory-unresolved"],
        },
      ],
    });

    expect(result.blocking).toBe(true);
    expect(result.totals).toMatchObject({ activeOperations: 0, inspectionFailures: 1 });
    expect(result.findings.map((item) => item.code)).toEqual(["worktree-inspection-failed"]);
  });

  it("checks process ownership across every registered worktree", () => {
    let inspectedRoots: string[] = [];
    const diagnostics = collectProcessDiagnostics(
      [{ path: "C:/repo" }, { path: "C:/repo-task" }],
      (roots: string[]) => {
        inspectedRoots = roots;
        return [{ pid: 123, parentPid: 1, createdAtMs: null }];
      },
    );

    expect(inspectedRoots).toEqual(["C:/repo", "C:/repo-task"]);
    expect(diagnostics).toEqual({ matchingWorktreeNodeProcesses: 1, rawCommandLinesSerialized: false });
  });

  it("emits parseable metadata-only JSON from a fixture repository without fetching", () => {
    // Causal harness fix (#067): collecting against the live checkout scales with every
    // registered worktree (status + git-dir + rev-list each). Under full-suite load that
    // O(n) scan contended for CPU and hit the global 30s timeout. Inject a tiny fixture
    // root so this contract stays deterministic and independent of the worktree farm.
    const fixtureRoot = createFixtureRepository();
    const startedAt = Date.now();
    const payload = collectReconciliationState({
      repositoryRoot: fixtureRoot,
      baseRef: "main",
      now: () => new Date("2026-07-24T12:00:00.000Z"),
    });
    const elapsedMs = Date.now() - startedAt;

    expect(payload).toMatchObject({
      cachedRefsOnly: true,
      fetched: false,
      generatedAt: "2026-07-24T12:00:00.000Z",
      repositoryRoot: path.resolve(fixtureRoot),
      baseRef: "main",
      integrationBase: "dedicated-worktree-required",
      totals: { worktrees: 1 },
    });
    expect(payload.processDiagnostics).toMatchObject({ skipped: true, rawCommandLinesSerialized: false });
    expect(JSON.stringify(payload)).not.toContain("commandLine");
    expect(elapsedMs).toBeLessThan(5_000);
  });

  it("does not inspect the live repository when a fixture root is injected", () => {
    const fixtureRoot = createFixtureRepository();
    const liveRoot = path.resolve(process.cwd());
    const payload = collectReconciliationState({ repositoryRoot: fixtureRoot, baseRef: "main" });

    expect(path.resolve(payload.repositoryRoot)).not.toBe(liveRoot);
    expect(path.resolve(payload.primaryPath)).toBe(path.resolve(fixtureRoot));
    expect(payload.totals.worktrees).toBe(1);
  });

  // #109: every worktree's ahead/behind comes from `rev-list --left-right --count`, which is
  // merge-base-derived and silently wrong on a shallow clone. The guard therefore has to sit in
  // the collector, not in the CLI — `buildReconciliationEvidencePack` calls the collector
  // directly and stamps `status: "complete"`, so a CLI-only check let the pack persist shallow
  // numbers as completed evidence while the CLI itself exited 1.
  describe("shallow-history refusal", () => {
    it("throws instead of returning fiction when the injected root is a shallow clone", () => {
      const shallowRoot = createShallowCloneFixture();
      // Precondition: prove the fixture really is shallow, so a git behaviour change cannot
      // make this test pass vacuously against a full clone.
      expect(git(["rev-parse", "--is-shallow-repository"], shallowRoot)).toBe("true");

      let thrown: unknown;
      try {
        collectReconciliationState({ repositoryRoot: shallowRoot, baseRef: "main" });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(Error);
      const error = thrown as Error & { code?: string };
      expect(error.code).toBe("history-not-verified");
      expect(error.message).toContain("SHALLOW clone");
      expect(error.message).toContain("git fetch --unshallow --tags origin");
      expect(error.message).toContain("#109");
    });

    it("judges the injected root, not the module's own repository", () => {
      // The live checkout backing this suite has complete history, so the only way the shallow
      // fixture can refuse is if the guard runs `git` inside the passed root.
      const shallowRoot = createShallowCloneFixture();
      expect(() => collectReconciliationState({ repositoryRoot: shallowRoot, baseRef: "main" })).toThrow(
        /history-not-verified|SHALLOW clone/,
      );
      expect(() =>
        collectReconciliationState({ repositoryRoot: createFixtureRepository(), baseRef: "main" }),
      ).not.toThrow();
    });
  });
});
