import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { normalizedSchemaSha256 as driftSha } from "../scripts/check-drift";
import {
  ACTIVE_CI_RUN_STATES,
  autoMergeVerdict,
  changedFilesForRange,
  defaultRunsFetch,
  driftVerdict,
  findInFlightCiRuns,
  findPrettierBin,
  forcePushedBranchNames,
  formatGuard,
  guardBaseForRange,
  HEAVY_RUN_ADMISSION_BUSY_EXIT,
  HEAVY_RUN_ADMISSION_BUSY_MARKER,
  inFlightCiGuard,
  inFlightCiVerdict,
  isCoordinatorBusyOutput,
  isCoordinatorBusyResult,
  isEslintPolicyFile,
  isForcePushRange,
  isRequiredCiWorkflow,
  isTypecheckExcludedPath,
  lintableFiles,
  needsRepoWideLint,
  needsTypecheck,
  normalizedSchemaSha256 as guardSha,
  parsePushRanges,
  pushedBranchNames,
  pushedTipMatchesHead,
  staticGuard,
} from "../scripts/guard-push.mjs";

const ZERO = "0".repeat(40);
const created: string[] = [];

afterEach(() => {
  for (const root of created.splice(0)) rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function dependencyFixture(lockMarker: string, withPrettier = false) {
  const root = mkdtempSync(join(tmpdir(), "guard-push-dependencies-"));
  created.push(root);
  const lock = JSON.stringify({
    lockfileVersion: 3,
    marker: lockMarker,
    packages: { "node_modules/prettier": { version: "3.9.6" } },
  });
  writeFileSync(join(root, "package-lock.json"), lock);
  if (withPrettier) {
    mkdirSync(join(root, "node_modules", "prettier", "bin"), { recursive: true });
    writeFileSync(join(root, "node_modules", "prettier", "package.json"), JSON.stringify({ version: "3.9.6" }));
    writeFileSync(join(root, "node_modules", "prettier", "bin", "prettier.cjs"), "");
  }
  return root;
}

function gitFixture() {
  const root = mkdtempSync(join(tmpdir(), "guard-push-git-"));
  created.push(root);
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "--quiet", "--initial-branch=main");
  git("config", "user.name", "Guard Push Test");
  git("config", "user.email", "guard-push@example.invalid");
  writeFileSync(join(root, "README.md"), "base\n");
  git("add", "README.md");
  git("commit", "--quiet", "-m", "base");
  return { root, git, baseSha: git("rev-parse", "HEAD") };
}

describe("guard-push sha parity", () => {
  it("guard-push's sha is byte-identical to check-drift's (they must never diverge)", () => {
    for (const sample of ["create table t();\n", "a\r\nb\r\n", "", "SELECT 1;"]) {
      expect(guardSha(sample)).toBe(driftSha(sample));
    }
  });

  it("normalizes CRLF to LF", () => {
    expect(guardSha("a\r\nb")).toBe(guardSha("a\nb"));
  });
});

describe("auto-merge verdict", () => {
  it("does not block a fast-forward push to a PR branch with armed auto-merge, but warns", () => {
    const v = autoMergeVerdict("codex/x", { autoMergeRequest: { enabledAt: "t" }, state: "OPEN", number: 6 });
    expect(v.block).toBe(false);
    expect(v.warn).toBe(true);
  });

  it("blocks a force-push to a claude/* branch with armed auto-merge on an open PR", () => {
    const v = autoMergeVerdict("claude/x", { autoMergeRequest: { enabledAt: "t" }, state: "OPEN", number: 7 }, true);
    expect(v.block).toBe(true);
    expect(v.number).toBe(7);
  });

  it("does not warn or block a force-push when auto-merge is not armed", () => {
    const v = autoMergeVerdict("claude/x", { autoMergeRequest: null, state: "OPEN" }, true);
    expect(v.block).toBe(false);
    expect(v.warn).toBe(false);
  });

  it("does not block when there is no open PR", () => {
    expect(autoMergeVerdict("claude/x", null).block).toBe(false);
  });

  it("does not block when the PR is not OPEN", () => {
    expect(autoMergeVerdict("claude/x", { autoMergeRequest: {}, state: "MERGED" }).block).toBe(false);
  });
});

describe("force-push detection", () => {
  it("does not flag a fast-forward push", () => {
    const { root, git } = gitFixture();
    writeFileSync(join(root, "one.md"), "one\n");
    git("add", "one.md");
    git("commit", "--quiet", "-m", "one");
    const remoteSha = git("rev-parse", "HEAD");
    writeFileSync(join(root, "two.md"), "two\n");
    git("add", "two.md");
    git("commit", "--quiet", "-m", "two");
    const localSha = git("rev-parse", "HEAD");

    expect(isForcePushRange({ localSha, remoteSha, remoteRef: "refs/heads/feature" }, root)).toBe(false);
    expect(forcePushedBranchNames([{ localSha, remoteSha, remoteRef: "refs/heads/feature" }], root)).toEqual(new Set());
  });

  it("flags a push that abandons the remote tip (history rewrite)", () => {
    const { root, git, baseSha } = gitFixture();
    writeFileSync(join(root, "abandoned.md"), "abandoned\n");
    git("add", "abandoned.md");
    git("commit", "--quiet", "-m", "abandoned");
    const remoteSha = git("rev-parse", "HEAD");

    git("reset", "--quiet", "--hard", baseSha);
    writeFileSync(join(root, "rebuilt.md"), "rebuilt\n");
    git("add", "rebuilt.md");
    git("commit", "--quiet", "-m", "rebuilt");
    const localSha = git("rev-parse", "HEAD");

    expect(isForcePushRange({ localSha, remoteSha, remoteRef: "refs/heads/feature" }, root)).toBe(true);
    expect(forcePushedBranchNames([{ localSha, remoteSha, remoteRef: "refs/heads/feature" }], root)).toEqual(
      new Set(["feature"]),
    );
  });

  it("never flags a brand-new branch (zero remote sha) as a force-push", () => {
    expect(isForcePushRange({ localSha: "abc123", remoteSha: ZERO, remoteRef: "refs/heads/feature" })).toBe(false);
  });
});

describe("manual auto-merge ownership policy", () => {
  it("keeps active agent policies aligned on preserving an armed PR", () => {
    const policyFiles = [
      "../AGENTS.md",
      "../.claude/skills/run-pr/SKILL.md",
      "../.claude/skills/handoff/SKILL.md",
      "../.cursor/agents/pr-babysit.md",
    ];

    for (const file of policyFiles) {
      const policy = readFileSync(new URL(file, import.meta.url), "utf8");
      expect(policy, file).toContain("auto-merge state is user-owned");
      expect(policy, file).toContain("must not disable");
    }
  });
});

describe("drift verdict", () => {
  const text = "create table t();\n";
  it("is fresh when the manifest sha matches", () => {
    expect(driftVerdict(text, { schema_sha256: guardSha(text) }).stale).toBe(false);
  });
  it("is stale when the manifest sha differs", () => {
    expect(driftVerdict(text, { schema_sha256: "deadbeef" }).stale).toBe(true);
  });
  it("never false-blocks when the manifest has no sha", () => {
    expect(driftVerdict(text, {}).stale).toBe(false);
  });
});

describe("push-range parsing", () => {
  it("parses a new-branch push (zero remote sha)", () => {
    const ranges = parsePushRanges(`refs/heads/x abc123 refs/heads/x ${ZERO}\n`);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].remoteRef).toBe("refs/heads/x");
    expect(ranges[0].remoteSha).toBe(ZERO);
  });

  it("guards the remote branch even when a different branch is checked out", () => {
    const ranges = parsePushRanges(`refs/heads/local abc123 refs/heads/pr-head ${ZERO}\n`);
    expect(pushedBranchNames(ranges, "main")).toEqual(["pr-head"]);
  });

  it("skips a branch-deletion push (zero local sha)", () => {
    expect(parsePushRanges(`refs/heads/x ${ZERO} refs/heads/x abc\n`)).toHaveLength(0);
  });

  it("ignores blank lines", () => {
    expect(parsePushRanges("\n  \n")).toHaveLength(0);
  });

  it("compares a fast-forward push from its remote tip", () => {
    const { root, git } = gitFixture();
    git("update-ref", "refs/remotes/origin/main", "HEAD");
    git("switch", "--quiet", "-c", "feature");
    writeFileSync(join(root, "one.md"), "one\n");
    git("add", "one.md");
    git("commit", "--quiet", "-m", "one");
    const remoteSha = git("rev-parse", "HEAD");
    writeFileSync(join(root, "two.md"), "two\n");
    git("add", "two.md");
    git("commit", "--quiet", "-m", "two");
    const localSha = git("rev-parse", "HEAD");

    // Ordinary push: the remote tip is reachable, so it stays the base and only
    // the newly pushed commit is in scope.
    expect(guardBaseForRange({ localSha, remoteSha }, root)).toBe(remoteSha);
    expect(changedFilesForRange({ localSha, remoteSha }, root)).toEqual(["two.md"]);
  });

  // A force-push abandons the old remote tip. Comparing against it makes every
  // file the discarded history carried look deleted, which is unanswerable for
  // transaction guards; the merge base is the question CI actually asks.
  it("falls back to the merge base when the remote tip was discarded by a force-push", () => {
    const { root, git, baseSha } = gitFixture();
    git("update-ref", "refs/remotes/origin/main", "HEAD");
    git("switch", "--quiet", "-c", "feature");
    writeFileSync(join(root, "abandoned.md"), "abandoned\n");
    git("add", "abandoned.md");
    git("commit", "--quiet", "-m", "abandoned");
    const discardedSha = git("rev-parse", "HEAD");

    git("reset", "--quiet", "--hard", baseSha);
    writeFileSync(join(root, "rebuilt.md"), "rebuilt\n");
    git("add", "rebuilt.md");
    git("commit", "--quiet", "-m", "rebuilt");
    const localSha = git("rev-parse", "HEAD");

    expect(discardedSha).not.toBe(localSha);
    expect(guardBaseForRange({ localSha, remoteSha: discardedSha }, root)).toBe(baseSha);
    // abandoned.md must not read as a deletion introduced by this push.
    expect(changedFilesForRange({ localSha, remoteSha: discardedSha }, root)).toEqual(["rebuilt.md"]);
  });

  it("keeps a Windows new-branch static command scoped to the PR side of an advanced main", () => {
    const { root, git, baseSha } = gitFixture();
    git("switch", "--quiet", "-c", "feature");
    mkdirSync(join(root, "scripts"), { recursive: true });
    writeFileSync(join(root, "scripts", "feature.mjs"), "export const feature = true;\n");
    git("add", "scripts/feature.mjs");
    git("commit", "--quiet", "-m", "feature");
    const featureSha = git("rev-parse", "HEAD");

    git("switch", "--quiet", "main");
    mkdirSync(join(root, "src"), { recursive: true });
    for (let index = 0; index < 360; index += 1) {
      const name = `main-only-${String(index).padStart(3, "0")}-${"x".repeat(96)}.ts`;
      writeFileSync(join(root, "src", name), `export const value${index} = ${index};\n`);
    }
    git("add", "src");
    git("commit", "--quiet", "-m", "advance main");
    git("update-ref", "refs/remotes/origin/main", "HEAD");
    git("branch", "origin/main", baseSha);

    const twoDotFiles = git("diff", "--name-only", `refs/remotes/origin/main..${featureSha}`).split("\n");
    expect(lintableFiles(twoDotFiles).join(" ").length).toBeGreaterThan(32_767);
    expect(changedFilesForRange({ localSha: featureSha, remoteSha: ZERO }, root)).toEqual(["scripts/feature.mjs"]);
    expect(guardBaseForRange({ localSha: featureSha, remoteSha: ZERO }, root)).toBe(baseSha);
  });
});

describe("format dependency resolution", () => {
  it("reuses Prettier only from a byte-identical sibling lockfile", () => {
    const project = dependencyFixture("current");
    const stale = dependencyFixture("stale", true);
    const exact = dependencyFixture("current", true);

    expect(findPrettierBin(project, [stale, exact])).toBe(
      join(exact, "node_modules", "prettier", "bin", "prettier.cjs"),
    );
  });

  it("fails closed when no exact-lock Prettier installation is available", () => {
    const result = formatGuard([{ sha: "abc123", file: "README.md" }], () => {
      throw new Error("missing fixture dependency");
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain("npm ci --include=dev");
    expect(result.message).toContain("SKIP_FORMAT_GUARD=1");
  });
});

describe("static guard scope selection", () => {
  it("lints lint-root sources and eslint-rules, not docs or public assets", () => {
    expect(lintableFiles(["src/components/a.tsx", "docs/x.md", "package-lock.json"])).toEqual(["src/components/a.tsx"]);
    expect(lintableFiles(["eslint-rules/require-button-wiring.mjs"])).toEqual([
      "eslint-rules/require-button-wiring.mjs",
    ]);
    expect(lintableFiles(["public/demo/x.js"])).toEqual([]);
  });

  it("normalizes backslash paths before filtering", () => {
    expect(lintableFiles(["src\\components\\a.tsx"])).toEqual(["src/components/a.tsx"]);
  });

  it("triggers typecheck only for extensions the source-only config includes", () => {
    expect(needsTypecheck(["src/lib/a.ts"])).toBe(true);
    expect(needsTypecheck(["src/lib/a.tsx", "src/lib/a.mts"])).toBe(true);
    expect(needsTypecheck(["docs/a.md", "x.png"])).toBe(false);
    expect(needsTypecheck(["src/lib/a.cts"])).toBe(false);
  });

  it("skips typecheck for paths excluded by tsconfig.typecheck.json", () => {
    expect(isTypecheckExcludedPath("supabase/functions/foo/index.ts")).toBe(true);
    expect(isTypecheckExcludedPath("scripts/archive/old.ts")).toBe(true);
    expect(isTypecheckExcludedPath("src/lib/a.ts")).toBe(false);
    expect(needsTypecheck(["supabase/functions/foo/index.ts"])).toBe(false);
    expect(needsTypecheck(["scripts/archive/old.ts", "scratch/x.tsx", "worktrees/a/b.ts"])).toBe(false);
    expect(needsTypecheck(["supabase/functions/foo/index.ts", "src/lib/a.ts"])).toBe(true);
  });

  it("treats shared-slot exhaustion as coordinator busy, not a typecheck failure", () => {
    expect(isCoordinatorBusyOutput("Database focused-test capacity is full (current owner PID 1)")).toBe(true);
    expect(isCoordinatorBusyOutput("Another Database heavyweight command is active (PID 1)")).toBe(true);
    expect(isCoordinatorBusyOutput("A Database heavyweight coordinator is being initialized; retry shortly.")).toBe(
      true,
    );
    expect(isCoordinatorBusyOutput("error TS2322: Type 'string' is not assignable")).toBe(false);
  });

  it("prefers structured admission-busy exit/marker over prose that tsc can quote", () => {
    expect(isCoordinatorBusyResult({ status: HEAVY_RUN_ADMISSION_BUSY_EXIT })).toBe(true);
    expect(isCoordinatorBusyResult({ status: 1, stderr: `${HEAVY_RUN_ADMISSION_BUSY_MARKER}\nbusy` })).toBe(true);
    expect(
      isCoordinatorBusyResult({
        status: 1,
        stderr: "error TS2304: Another Database heavyweight command is active",
      }),
    ).toBe(false);
  });

  it("escalates to repo-wide lint when eslint policy changes", () => {
    expect(isEslintPolicyFile("eslint.config.mjs")).toBe(true);
    expect(isEslintPolicyFile("eslint-rules/no-hardcoded-hex.mjs")).toBe(true);
    expect(isEslintPolicyFile("src/lib/a.ts")).toBe(false);
    expect(needsRepoWideLint(["eslint.config.mjs"])).toBe(true);
    expect(needsRepoWideLint(["eslint-rules/x.mjs"])).toBe(true);
    expect(needsRepoWideLint(["src/lib/a.ts"])).toBe(false);
  });

  it("fails closed when the pushed tip is not HEAD", () => {
    expect(pushedTipMatchesHead([{ localSha: "aaa" }], "aaa").ok).toBe(true);
    expect(pushedTipMatchesHead([{ localSha: "aaa", localRef: "refs/heads/other" }], "bbb")).toEqual({
      ok: false,
      headSha: "bbb",
      tipSha: "aaa",
      localRef: "refs/heads/other",
    });
    expect(pushedTipMatchesHead([{ localSha: "tagobj", localRef: "refs/tags/v1" }], "bbb").ok).toBe(true);

    const result = staticGuard(["src/lib/a.ts"], {
      ranges: [{ localSha: "deadbeef", localRef: "refs/heads/other" }],
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("SKIP_STATIC_GUARD=1");
    expect(result.message).toContain("deadbeef");
  });

  it("does not tip-check docs-only or tag pushes that need no static work", () => {
    const docsOnly = staticGuard(["docs/only.md"], {
      ranges: [{ localSha: "deadbeef", localRef: "refs/heads/docs-branch" }],
    });
    expect(docsOnly.ok).toBe(true);
    expect(docsOnly.message).toBeUndefined();

    const tagPush = staticGuard(["README.md"], {
      ranges: [{ localSha: "tagobj", localRef: "refs/tags/v1.2.3" }],
    });
    expect(tagPush.ok).toBe(true);
  });

  it("skips with SKIP_STATIC_GUARD=1 and is a no-op for docs-only pushes", () => {
    const previous = process.env.SKIP_STATIC_GUARD;
    process.env.SKIP_STATIC_GUARD = "1";
    try {
      const skipped = staticGuard(["src/lib/a.ts"]);
      expect(skipped.ok).toBe(true);
      expect(skipped.skipped).toBe("SKIP_STATIC_GUARD=1");
    } finally {
      if (previous === undefined) delete process.env.SKIP_STATIC_GUARD;
      else process.env.SKIP_STATIC_GUARD = previous;
    }

    const docsOnly = staticGuard(["docs/only.md"]);
    expect(docsOnly.ok).toBe(true);
    expect(docsOnly.message).toBeUndefined();
  });
});

describe("in-flight CI push guard (#HSSHRG)", () => {
  it("recognizes active workflow runs for required CI only", () => {
    expect(isRequiredCiWorkflow({ name: "CI" })).toBe(true);
    expect(isRequiredCiWorkflow({ workflowName: "CI" })).toBe(true);
    expect(isRequiredCiWorkflow({ path: ".github/workflows/ci.yml" })).toBe(true);
    expect(isRequiredCiWorkflow({ path: ".github\\workflows\\ci.yml" })).toBe(true);
    expect(isRequiredCiWorkflow({ name: "Nightly Security Scan" })).toBe(false);

    expect(ACTIVE_CI_RUN_STATES.has("in_progress")).toBe(true);
    expect(ACTIVE_CI_RUN_STATES.has("queued")).toBe(true);
    expect(ACTIVE_CI_RUN_STATES.has("completed")).toBe(false);

    const runs = [
      { databaseId: 1, name: "CI", status: "in_progress", conclusion: null },
      { databaseId: 2, name: "CI", status: "queued", conclusion: "" },
      { databaseId: 3, name: "CI", status: "completed", conclusion: "success" },
      { databaseId: 4, name: "Deploy", status: "in_progress", conclusion: null },
    ];
    const inFlight = findInFlightCiRuns(runs);
    expect(inFlight).toHaveLength(2);
    expect(inFlight.map((r: Record<string, unknown>) => r.databaseId)).toEqual([1, 2]);

    const objPayload = {
      workflow_runs: [
        { id: 10, path: ".github/workflows/ci.yml", status: "waiting", conclusion: null },
        { id: 11, path: ".github/workflows/ci.yml", status: "completed", conclusion: "failure" },
      ],
    };
    expect(findInFlightCiRuns(objPayload).map((r: Record<string, unknown>) => r.id)).toEqual([10]);
  });

  it("blocks a push to an open PR when required CI is in-flight", () => {
    const runs = [
      { databaseId: 101, name: "CI", status: "in_progress", conclusion: null, url: "https://github.com/run/101" },
    ];
    const verdict = inFlightCiVerdict("claude/my-fix", { state: "OPEN", number: 123 }, runs);
    expect(verdict.block).toBe(true);
    expect(verdict.number).toBe(123);
    expect(verdict.runs).toHaveLength(1);
  });

  it("allows push when CI has completed or no runs are in-flight", () => {
    const completedRuns = [{ databaseId: 102, name: "CI", status: "completed", conclusion: "success" }];
    const verdict = inFlightCiVerdict("claude/my-fix", { state: "OPEN", number: 123 }, completedRuns);
    expect(verdict.block).toBe(false);
    expect(verdict.reason).toBe("no-in-flight-ci");
  });

  it("never blocks base branch pushes or closed PRs", () => {
    const runs = [{ databaseId: 101, name: "CI", status: "in_progress", conclusion: null }];
    expect(inFlightCiVerdict("main", { state: "OPEN", number: 1 }, runs).block).toBe(false);
    expect(inFlightCiVerdict("release/2.0", { state: "OPEN", number: 2 }, runs).block).toBe(false);
    expect(inFlightCiVerdict("claude/my-fix", { state: "MERGED", number: 123 }, runs).block).toBe(false);
    expect(inFlightCiVerdict("claude/my-fix", null, runs).block).toBe(false);
  });

  it("inFlightCiGuard formats actionable blocked message with PR and run details", () => {
    const runs = [{ databaseId: 555, name: "CI", status: "in_progress", url: "https://github.com/run/555" }];
    const result = inFlightCiGuard(["claude/my-fix"], [], {
      prViewer: () => ({ state: "OPEN", number: 77 }),
      runFetcher: () => runs,
      ghAvailable: () => true,
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("PR #77 on claude/my-fix has required CI run(s) currently IN-FLIGHT");
    expect(result.message).toContain("Run 555: CI (in_progress) https://github.com/run/555");
    expect(result.message).toContain("SKIP_IN_FLIGHT_CI_GUARD=1 git push");
    expect(result.message).toContain("#HSSHRG");
  });

  it("inFlightCiGuard fails open when gh is unavailable, without consulting the PR", () => {
    let prViewerCalls = 0;
    const result = inFlightCiGuard(["claude/my-fix"], [], {
      prViewer: () => {
        prViewerCalls += 1;
        return { state: "OPEN", number: 77 };
      },
      runFetcher: () => [{ databaseId: 555, name: "CI", status: "in_progress" }],
      ghAvailable: () => false,
    });
    expect(result.ok).toBe(true);
    expect(result.note).toContain("gh not available");
    expect(prViewerCalls).toBe(0);
  });

  it("inFlightCiGuard never spawns a process when every dependency is injected (#HSSHRG)", () => {
    // Regression guard: the availability probe used to call the real `gh` binary
    // even here. `gh --version` was measured at 97 s on a loaded machine, which
    // timed this suite out at vitest's 30 s limit — a unit test must not be
    // hostage to an external process it never asked for.
    let spawned = 0;
    const result = inFlightCiGuard(["claude/my-fix"], [], {
      prViewer: () => ({ state: "OPEN", number: 77 }),
      runFetcher: () => [{ databaseId: 555, name: "CI", status: "in_progress" }],
      ghAvailable: () => {
        spawned += 1;
        return true;
      },
    });
    expect(spawned).toBe(1);
    expect(result.ok).toBe(false);
  });

  it("inFlightCiGuard skips when SKIP_IN_FLIGHT_CI_GUARD=1 is set", () => {
    const previous = process.env.SKIP_IN_FLIGHT_CI_GUARD;
    process.env.SKIP_IN_FLIGHT_CI_GUARD = "1";
    try {
      const result = inFlightCiGuard(["claude/my-fix"], [], {
        prViewer: () => ({ state: "OPEN", number: 77 }),
        runFetcher: () => [{ databaseId: 555, name: "CI", status: "in_progress" }],
        ghAvailable: () => true,
      });
      expect(result.ok).toBe(true);
      expect(result.skipped).toBe("SKIP_IN_FLIGHT_CI_GUARD=1");
    } finally {
      if (previous === undefined) delete process.env.SKIP_IN_FLIGHT_CI_GUARD;
      else process.env.SKIP_IN_FLIGHT_CI_GUARD = previous;
    }
  });

  it("supports localRef === 'HEAD' in pushedTipMatchesHead", () => {
    expect(pushedTipMatchesHead([{ localSha: "sha123", localRef: "HEAD" }], "sha123").ok).toBe(true);
    expect(pushedTipMatchesHead([{ localSha: "sha123", localRef: "HEAD" }], "sha456").ok).toBe(false);
  });

  it("defaultRunsFetch scopes to ci.yml and pages past the default 10-run window (#HSSHRG)", () => {
    let capturedArgs: string[] = [];
    defaultRunsFetch("claude/my-fix", ((_cmd: string, args: string[]) => {
      capturedArgs = args;
      return "[]";
    }) as unknown as typeof execFileSync);

    expect(capturedArgs).toContain("run");
    expect(capturedArgs).toContain("list");
    expect(capturedArgs).toContain("--branch");
    expect(capturedArgs).toContain("claude/my-fix");
    expect(capturedArgs).toContain("--workflow");
    expect(capturedArgs).toContain("ci.yml");
    const limitIndex = capturedArgs.indexOf("--limit");
    expect(limitIndex).not.toBe(-1);
    expect(Number(capturedArgs[limitIndex + 1])).toBeGreaterThan(10);
  });
});
