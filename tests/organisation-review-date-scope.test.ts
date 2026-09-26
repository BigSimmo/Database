import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  describeReviewDateScope,
  expiredReviewDateDisposition,
  gitTouchedFiles,
  NOT_BLOCKING_NOTE,
  reportExpiredReviewDate,
  resolveReviewDateScope,
  STRICT_REVIEW_DATE_SCOPE,
  type ReviewDateScope,
} from "../scripts/organisation/review-date-scope.mjs";

// Organisation framework suggestion 6, "defuse the date traps": the shared rule that decides
// whether an expired governance review date blocks a run. Strict unless pull-request CI asks.

const REGISTER = "docs/register.json";
const listed = (files: string[]) => () => ({ ok: true as const, files });
const PR_ENV = { REVIEW_DATE_MODE: "pr", BASE_SHA: "abc1234", HEAD_SHA: "def5678", GITHUB_EVENT_NAME: "pull_request" };

describe("resolving the review-date scope", () => {
  it("is strict, silently, when nothing asks for pull-request mode", () => {
    for (const env of [
      {},
      { REVIEW_DATE_MODE: "" },
      { REVIEW_DATE_MODE: "strict" },
      { REVIEW_DATE_MODE: " strict " },
    ]) {
      const scope = resolveReviewDateScope({ env, root: ".", listTouched: listed(["x"]) });
      expect(scope).toMatchObject({ mode: "strict", touched: null, notes: [] });
    }
  });

  it("is pull-request mode only with an explicit request and a usable base", () => {
    const calls: string[][] = [];
    const scope = resolveReviewDateScope({
      env: PR_ENV,
      root: "/repo",
      listTouched: (root, base, head) => {
        calls.push([root, base, head]);
        return { ok: true, files: ["a.ts", "docs/b.md"] };
      },
    });
    expect(scope).toEqual({ mode: "pr", touched: ["a.ts", "docs/b.md"], base: "abc1234", head: "def5678", notes: [] });
    expect(calls).toEqual([["/repo", "abc1234", "def5678"]]);
  });

  it("accepts a pull-request or merge-queue event and defaults the head to HEAD", () => {
    for (const event of ["pull_request", "merge_group"]) {
      const heads: string[] = [];
      const scope = resolveReviewDateScope({
        env: { ...PR_ENV, HEAD_SHA: "", GITHUB_EVENT_NAME: event },
        root: ".",
        listTouched: (_root, _base, head) => {
          heads.push(head);
          return { ok: true, files: [] };
        },
      });
      expect(scope.mode).toBe("pr");
      expect(heads).toEqual(["HEAD"]);
    }
  });

  it("refuses, with a note, on any other GitHub event: pushes to main, schedules, manual runs", () => {
    for (const event of ["push", "schedule", "workflow_dispatch"]) {
      const scope = resolveReviewDateScope({
        env: { ...PR_ENV, GITHUB_EVENT_NAME: event },
        root: ".",
        listTouched: listed([]),
      });
      expect(scope.mode).toBe("strict");
      expect(scope.notes.join(" ")).toContain(`the GitHub event is ${event}`);
    }
  });

  it("refuses, with a note, when no GitHub event is named: pr mode is for pull-request CI only", () => {
    for (const GITHUB_EVENT_NAME of [undefined, "", "   "]) {
      const scope = resolveReviewDateScope({
        env: { ...PR_ENV, GITHUB_EVENT_NAME },
        root: ".",
        listTouched: listed([]),
      });
      expect(scope.mode).toBe("strict");
      expect(scope.notes.join(" ")).toContain("GITHUB_EVENT_NAME is not set");
      expect(scope.notes.join(" ")).toContain("expired review dates block as usual");
    }
  });

  it("refuses, with a note, a misspelt mode or a missing, zero or malformed revision", () => {
    const cases: [Record<string, string>, string][] = [
      [{ ...PR_ENV, REVIEW_DATE_MODE: "PR" }, 'the only other accepted value is "pr"'],
      [{ ...PR_ENV, REVIEW_DATE_MODE: "off" }, 'the only other accepted value is "pr"'],
      [{ ...PR_ENV, BASE_SHA: "" }, "BASE_SHA is not set"],
      [{ ...PR_ENV, BASE_SHA: "0".repeat(40) }, "BASE_SHA is not set"],
      [{ ...PR_ENV, BASE_SHA: "--output=/tmp/x" }, "malformed"],
      [{ ...PR_ENV, HEAD_SHA: "-p" }, "malformed"],
      [{ ...PR_ENV, BASE_SHA: "abc 123" }, "malformed"],
    ];
    for (const [env, why] of cases) {
      const scope = resolveReviewDateScope({ env, root: ".", listTouched: listed(["x"]) });
      expect(scope.mode).toBe("strict");
      expect(scope.touched).toBeNull();
      expect(scope.notes.join(" ")).toContain(why);
      expect(scope.notes.join(" ")).toContain("expired review dates block as usual");
    }
  });

  it("refuses, with a note, when the changed files cannot be listed", () => {
    const failed = resolveReviewDateScope({
      env: PR_ENV,
      root: ".",
      listTouched: () => ({ ok: false, reason: "the base abc1234 is not reachable" }),
    });
    expect(failed.mode).toBe("strict");
    expect(failed.notes.join(" ")).toContain("the base abc1234 is not reachable");

    const threw = resolveReviewDateScope({
      env: PR_ENV,
      root: ".",
      listTouched: () => {
        throw new Error("git exploded");
      },
    });
    expect(threw.mode).toBe("strict");
    expect(threw.notes.join(" ")).toContain("git exploded");
  });
});

describe("whether an expired date blocks", () => {
  const pr = (touched: string[]): ReviewDateScope => ({ mode: "pr", touched, base: "b", head: "h", notes: [] });

  it("always blocks without a well-formed pull-request scope", () => {
    const malformed = { mode: "pr", touched: null, base: null, head: null, notes: [] } as unknown as ReviewDateScope;
    for (const scope of [undefined, null, STRICT_REVIEW_DATE_SCOPE, malformed]) {
      expect(expiredReviewDateDisposition(scope, { registerPath: REGISTER, coveredPaths: ["a.ts"] })).toEqual({
        blocking: true,
        because: null,
      });
    }
  });

  it("blocks a pull request that touches the register or a covered path, and says which", () => {
    expect(expiredReviewDateDisposition(pr(["z.ts", REGISTER]), { registerPath: REGISTER, coveredPaths: [] })).toEqual({
      blocking: true,
      because: REGISTER,
    });
    // A covered reference may carry an anchor; the path is what counts.
    expect(
      expiredReviewDateDisposition(pr(["docs/pia.md"]), {
        registerPath: REGISTER,
        coveredPaths: ["src/a.ts", "docs/pia.md#section-6", 42],
      }),
    ).toEqual({ blocking: true, because: "docs/pia.md" });
  });

  it("canonicalises covered paths before matching, and lets a folder cover the files under it", () => {
    const covers = (touched: string[], coveredPaths: unknown[]) =>
      expiredReviewDateDisposition(pr(touched), { registerPath: REGISTER, coveredPaths });
    expect(covers(["src/a.ts"], ["./src/a.ts"])).toEqual({ blocking: true, because: "src/a.ts" });
    expect(covers(["src/a.ts"], ["src//lib/../a.ts#anchor"])).toEqual({ blocking: true, because: "src/a.ts" });
    expect(covers(["src/lib/deep/b.ts"], ["src/lib/"])).toEqual({ blocking: true, because: "src/lib/deep/b.ts" });
    expect(covers(["src/lib/b.ts"], ["./src/lib"])).toEqual({ blocking: true, because: "src/lib/b.ts" });
    // A folder prefix is a whole segment: src/lib does not cover src/library.ts.
    expect(covers(["src/library.ts"], ["src/lib"]).blocking).toBe(false);
    // The repository root is not a usable reference and never covers everything.
    expect(covers(["src/a.ts"], ["./", ".", "/"]).blocking).toBe(false);
  });

  it("does not block a pull request that touches neither", () => {
    expect(
      expiredReviewDateDisposition(pr(["README.md", "docs/register.json.bak"]), {
        registerPath: REGISTER,
        coveredPaths: ["src/a.ts"],
      }),
    ).toEqual({ blocking: false, because: null });
    expect(expiredReviewDateDisposition(pr([]), { registerPath: REGISTER, coveredPaths: ["src/a.ts"] }).blocking).toBe(
      false,
    );
  });

  it("keeps the exact message when strict, names the touched path in pr mode, and never drops a warning", () => {
    const sink = () => ({ errors: [] as string[], warnings: [] as string[], registerPath: REGISTER });
    const strictSink = { ...sink(), scope: STRICT_REVIEW_DATE_SCOPE };
    expect(reportExpiredReviewDate(strictSink, "H1: review has expired", ["src/a.ts"])).toBe(true);
    expect(strictSink.errors).toEqual(["H1: review has expired"]);

    const touching = { ...sink(), scope: pr(["src/a.ts"]) };
    reportExpiredReviewDate(touching, "H1: review has expired", ["src/a.ts"]);
    expect(touching.errors).toEqual(["H1: review has expired (blocking: this change touches src/a.ts)"]);

    const unrelated = { ...sink(), scope: pr(["README.md"]) };
    expect(reportExpiredReviewDate(unrelated, "H1: review has expired", ["src/a.ts"])).toBe(false);
    expect(reportExpiredReviewDate(unrelated, "An exception has expired. Re-review it.", ["src/a.ts"])).toBe(false);
    expect(unrelated.errors).toEqual([]);
    expect(unrelated.warnings).toEqual([
      `H1: review has expired. ${NOT_BLOCKING_NOTE}`,
      `An exception has expired. Re-review it. ${NOT_BLOCKING_NOTE}`,
    ]);
  });

  it("describes the scope for a pass line", () => {
    expect(describeReviewDateScope(STRICT_REVIEW_DATE_SCOPE)).toBe("review-dates=strict");
    expect(describeReviewDateScope(undefined)).toBe("review-dates=strict");
    expect(describeReviewDateScope(pr(["a", "b"]))).toBe("review-dates=pr touched=2");
  });
});

describe("listing the files a change touched", () => {
  const roots: string[] = [];
  afterEach(() => {
    for (const root of roots.splice(0))
      fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  function git(root: string, ...args: string[]) {
    const result = spawnSync(
      "git",
      ["-c", "user.email=t@example.invalid", "-c", "user.name=t", "-c", "commit.gpgsign=false", "-C", root, ...args],
      { encoding: "utf8" },
    );
    if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
    return result.stdout.trim();
  }

  function write(root: string, file: string, text: string) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }

  function repo() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "review-date-scope-"));
    roots.push(root);
    git(root, "init", "-q", "-b", "main");
    write(root, REGISTER, "{}\n");
    write(root, "src/old.ts", "export const a = 1;\n");
    write(root, "src/keep.ts", "export const b = 1;\n");
    git(root, "add", ".");
    git(root, "commit", "-q", "-m", "base");
    git(root, "checkout", "-q", "-b", "feature");
    git(root, "mv", "src/old.ts", "src/new.ts");
    write(root, "src/keep.ts", "export const b = 2;\n");
    git(root, "add", ".");
    git(root, "commit", "-q", "-m", "feature");
    const head = git(root, "rev-parse", "HEAD");
    git(root, "checkout", "-q", "main");
    // main moves on after the branch point: its register edit is not the change's doing.
    write(root, REGISTER, '{ "edited": true }\n');
    git(root, "add", ".");
    git(root, "commit", "-q", "-m", "main moves on");
    const base = git(root, "rev-parse", "HEAD");
    return { root, base, head };
  }

  it("lists only the change's own files from the merge base, with a rename as both paths", () => {
    const { root, base, head } = repo();
    const listedFiles = gitTouchedFiles(root, base, head);
    expect(listedFiles).toEqual({ ok: true, files: ["src/keep.ts", "src/new.ts", "src/old.ts"] });
  });

  it("feeds pull-request mode end to end, and reports an unreachable base as a refusal", () => {
    const { root, base, head } = repo();
    const scope = resolveReviewDateScope({
      env: { REVIEW_DATE_MODE: "pr", BASE_SHA: base, HEAD_SHA: head, GITHUB_EVENT_NAME: "pull_request" },
      root,
    });
    expect(scope).toMatchObject({ mode: "pr", touched: ["src/keep.ts", "src/new.ts", "src/old.ts"] });

    const missing = "1".repeat(40);
    expect(gitTouchedFiles(root, missing, head).ok).toBe(false);
    const refused = resolveReviewDateScope({
      env: { REVIEW_DATE_MODE: "pr", BASE_SHA: missing, HEAD_SHA: head, GITHUB_EVENT_NAME: "merge_group" },
      root,
    });
    expect(refused.mode).toBe("strict");
    expect(refused.notes.join(" ")).toContain("could not be listed");
  });
});
