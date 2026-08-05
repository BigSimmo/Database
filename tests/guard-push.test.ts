import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { normalizedSchemaSha256 as driftSha } from "../scripts/check-drift";
import {
  autoMergeVerdict,
  driftVerdict,
  findPrettierBin,
  formatGuard,
  HEAVY_RUN_ADMISSION_BUSY_EXIT,
  HEAVY_RUN_ADMISSION_BUSY_MARKER,
  isCoordinatorBusyOutput,
  isCoordinatorBusyResult,
  isEslintPolicyFile,
  isTypecheckExcludedPath,
  lintableFiles,
  needsRepoWideLint,
  needsTypecheck,
  normalizedSchemaSha256 as guardSha,
  parsePushRanges,
  pushedTipMatchesHead,
  staticGuard,
} from "../scripts/guard-push.mjs";

const ZERO = "0".repeat(40);
const created: string[] = [];

afterEach(() => {
  for (const root of created.splice(0)) rmSync(root, { recursive: true, force: true });
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
  it("never blocks a non-claude branch", () => {
    expect(autoMergeVerdict("main", { autoMergeRequest: {}, state: "OPEN" }).block).toBe(false);
  });

  it("blocks a claude/* branch with an armed auto-merge on an open PR", () => {
    const v = autoMergeVerdict("claude/x", { autoMergeRequest: { enabledAt: "t" }, state: "OPEN", number: 7 });
    expect(v.block).toBe(true);
    expect(v.number).toBe(7);
  });

  it("does not block when auto-merge is not armed", () => {
    expect(autoMergeVerdict("claude/x", { autoMergeRequest: null, state: "OPEN" }).block).toBe(false);
  });

  it("does not block when there is no open PR", () => {
    expect(autoMergeVerdict("claude/x", null).block).toBe(false);
  });

  it("does not block when the PR is not OPEN", () => {
    expect(autoMergeVerdict("claude/x", { autoMergeRequest: {}, state: "MERGED" }).block).toBe(false);
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
    expect(ranges[0].remoteSha).toBe(ZERO);
  });

  it("skips a branch-deletion push (zero local sha)", () => {
    expect(parsePushRanges(`refs/heads/x ${ZERO} refs/heads/x abc\n`)).toHaveLength(0);
  });

  it("ignores blank lines", () => {
    expect(parsePushRanges("\n  \n")).toHaveLength(0);
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
