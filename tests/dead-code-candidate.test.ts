import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { assess, docMentions, historyIsComplete } from "../scripts/check-dead-code-candidate.mjs";

const SCRIPT = fileURLToPath(new URL("../scripts/check-dead-code-candidate.mjs", import.meta.url));
const REPOSITORY_ROOT = dirname(dirname(SCRIPT));
const FIXED_TODAY = new Date("2026-08-23T00:00:00Z");
const fixtureRoots: string[] = [];

type GitRunner = (args: string[], root: string) => string;

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), "dead-code-candidate-"));
  fixtureRoots.push(root);
  for (const directory of ["docs/superpowers/plans", "docs/superpowers/specs", "tests", "src", "scripts", "worker"]) {
    mkdirSync(join(root, ...directory.split("/")), { recursive: true });
  }
  writeFileSync(join(root, "src", "candidate.ts"), "export const candidate = 1;\n", "utf8");
  return root;
}

function completeHistory(introduced = "2026-01-01"): GitRunner {
  return (args) => {
    if (args[0] === "rev-parse" && args[1] === "--is-shallow-repository") return "false\n";
    if (args[0] === "log") return `${introduced}\n`;
    throw new Error(`unexpected git call: ${args.join(" ")}`);
  };
}

function assessFixture(root: string, symbol: string, runGit: GitRunner) {
  return assess(symbol, "src/candidate.ts", { root, runGit, today: FIXED_TODAY });
}

afterEach(() => {
  for (const root of fixtureRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("dead-code candidate safety classifications", () => {
  it("refuses a symbol named by an unfinished executable plan", () => {
    const root = createFixture();
    writeFileSync(
      join(root, "docs", "superpowers", "plans", "unfinished.md"),
      "# Build candidate\n\n- [ ] Add the candidate consumer\n",
      "utf8",
    );

    const result = assessFixture(root, "candidate", completeHistory());

    expect(result.ok).toBe(false);
    expect(result.refusals).toContainEqual(expect.stringContaining("1 unchecked task"));
    expect(result.refusals).toContainEqual(expect.stringContaining("in-flight scaffolding"));
  });

  it("warns but does not independently refuse a completed plan mention", () => {
    const root = createFixture();
    writeFileSync(
      join(root, "docs", "superpowers", "plans", "complete.md"),
      "# Build candidate\n\n- [x] Add the candidate consumer\n",
      "utf8",
    );

    const result = assessFixture(root, "candidate", completeHistory());

    expect(result.ok).toBe(true);
    expect(result.refusals).toEqual([]);
    expect(result.warnings).toContainEqual(expect.stringContaining("all 1 tasks complete"));
  });

  it("refuses shallow history", () => {
    const root = createFixture();
    const runGit: GitRunner = (args) => {
      if (args[0] === "rev-parse" && args[1] === "--is-shallow-repository") return "true\n";
      throw new Error(`unexpected git call: ${args.join(" ")}`);
    };

    expect(historyIsComplete({ root, runGit })).toBe(false);
    const result = assessFixture(root, "candidate", runGit);
    expect(result.ok).toBe(false);
    expect(result.refusals).toContainEqual(expect.stringContaining("shallow"));
  });

  it("does not refuse solely because full history is available", () => {
    const root = createFixture();

    expect(historyIsComplete({ root, runGit: completeHistory() })).toBe(true);
    expect(assessFixture(root, "candidate", completeHistory()).refusals).toEqual([]);
  });

  it("normalizes Windows separators before applying documentation exclusions", () => {
    const root = createFixture();
    const mentions = [
      ["docs/archive/old.md", "candidate"],
      ["docs/branch-review-records/record.md", "candidate"],
      ["docs/outstanding-issues-inbox/request.json", '"candidate"'],
      ["docs/adoption-manifest.json", '"candidate"'],
      ["docs/guides/live.md", "candidate"],
    ] as const;
    for (const [relativePath, body] of mentions) {
      const absolutePath = join(root, ...relativePath.split("/"));
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, body, "utf8");
    }

    expect(docMentions("candidate", { root })).toEqual(["docs/guides/live.md"]);
  });

  it("refuses when an expected search root is missing", () => {
    const root = createFixture();
    rmSync(join(root, "tests"), { recursive: true });

    const result = assessFixture(root, "candidate", completeHistory());

    expect(result.ok).toBe(false);
    expect(result.refusals).toContainEqual(expect.stringMatching(/tests.*search failed/i));
  });

  it("does not depend on an external grep executable", () => {
    const source = readFileSync(SCRIPT, "utf8");

    expect(source).not.toMatch(/(?:execFileSync|\bsh\()\s*\(?(?:"|')grep(?:"|')/);
  });
});

describe("dead-code candidate CLI", () => {
  it("runs the real self-test entrypoint on Windows", () => {
    const result = spawnSync(process.execPath, [SCRIPT, "--self-test"], {
      cwd: REPOSITORY_ROOT,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("dead-code-candidate self-test passed");
  });

  it("runs the default gate path instead of exiting silently", () => {
    const result = spawnSync(process.execPath, [SCRIPT], {
      cwd: REPOSITORY_ROOT,
      encoding: "utf8",
    });

    expect([0, 1]).toContain(result.status);
    expect(result.stdout).toContain("[dead-code]");
  });

  it("refuses when git diff fails instead of reporting zero candidates", () => {
    const result = spawnSync(process.execPath, [SCRIPT, "--diff", "refs/heads/definitely-missing"], {
      cwd: REPOSITORY_ROOT,
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/REFUSE.*git diff/is);
  });
});
