import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  assess,
  docMentions,
  historyIsComplete,
  main,
  removedDeclarationsInDiff,
} from "../scripts/check-dead-code-candidate.mjs";

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

  it.each(["--diff", "--symbol", "--file"])("rejects a valueless %s option", (option) => {
    const result = spawnSync(process.execPath, [SCRIPT, option], {
      cwd: REPOSITORY_ROOT,
      encoding: "utf8",
    });

    expect(result.status).toBe(2);
    expect(`${result.stdout}\n${result.stderr}`).toContain(`${option} requires a value`);
  });

  it("rejects an option-shaped diff base before Git can interpret it", () => {
    const result = spawnSync(process.execPath, [SCRIPT, "--diff", "-s"], {
      cwd: REPOSITORY_ROOT,
      encoding: "utf8",
    });

    expect(result.status).toBe(2);
    expect(`${result.stdout}\n${result.stderr}`).toContain("--diff requires a non-option value");
  });

  it.each([
    ["--self-test", "--diff"],
    ["--diff", "--self-test"],
  ])("rejects mixed self-test mode in either argument order: %s %s", (...args) => {
    const result = spawnSync(process.execPath, [SCRIPT, ...args], {
      cwd: REPOSITORY_ROOT,
      encoding: "utf8",
    });

    expect(result.status).toBe(2);
    expect(`${result.stdout}\n${result.stderr}`).toContain("--self-test must be used alone");
  });

  it.each([
    { args: ["--unknown"], message: "unknown argument: --unknown" },
    { args: ["--diff", "HEAD", "--diff", "HEAD"], message: "duplicate option: --diff" },
    {
      args: ["--diff", "HEAD", "--symbol", "candidate", "--file", "src/candidate.ts"],
      message: "--diff cannot be combined with --symbol or --file",
    },
  ])("rejects ambiguous arguments: $message", ({ args, message }) => {
    const root = createFixture();
    const errors: string[] = [];

    expect(
      main(args, {
        root,
        runGit: () => {
          throw new Error("Git must not run for invalid arguments");
        },
        stdout: () => undefined,
        stderr: (error: string) => errors.push(error),
      }),
    ).toBe(2);
    expect(errors.join("\n")).toContain(message);
  });
});

describe("dead-code candidate diff parsing", () => {
  it("fails closed when Git quotes a non-ASCII café filename", () => {
    const root = createFixture();
    const candidatePath = join(root, "src", "café.ts");
    writeFileSync(candidatePath, "export const cafeCandidate = 1;\n", "utf8");
    execFileSync("git", ["init", "--quiet"], { cwd: root });
    execFileSync("git", ["config", "core.quotePath", "true"], { cwd: root });
    execFileSync("git", ["add", "src/café.ts"], { cwd: root });
    execFileSync(
      "git",
      [
        "-c",
        "user.name=Dead Code Test",
        "-c",
        "user.email=dead-code@example.invalid",
        "commit",
        "--quiet",
        "-m",
        "base",
      ],
      { cwd: root },
    );
    const base = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
    rmSync(candidatePath);

    expect(() => removedDeclarationsInDiff(base, { root })).toThrow(/quoted|unparseable/i);
  });

  it("disables ambient Git color so a removed main export is detected and refused", () => {
    const root = createFixture();
    const candidatePath = join(root, "src", "color-main.ts");
    writeFileSync(candidatePath, "export function main() {}\n", "utf8");
    execFileSync("git", ["init", "--quiet"], { cwd: root });
    execFileSync("git", ["config", "color.ui", "always"], { cwd: root });
    execFileSync("git", ["add", "src/color-main.ts"], { cwd: root });
    execFileSync(
      "git",
      [
        "-c",
        "user.name=Dead Code Test",
        "-c",
        "user.email=dead-code@example.invalid",
        "commit",
        "--quiet",
        "-m",
        "base",
      ],
      { cwd: root },
    );
    const base = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
    writeFileSync(candidatePath, "export const retained = 1;\n", "utf8");
    const output: string[] = [];
    const errors: string[] = [];

    expect(
      main(["--diff", base], {
        root,
        stdout: (line: string) => output.push(line),
        stderr: (line: string) => errors.push(line),
      }),
    ).toBe(1);
    expect(output.join("\n")).toContain("REFUSE  main  (src/color-main.ts)");
    expect(output.join("\n")).toContain("[dead-code] 1 candidate(s), 1 refused.");
    expect(errors.join("\n")).toContain("[dead-code] FAIL");
  });

  it("traverses each content root a bounded number of times for multiple candidates", () => {
    const root = createFixture();
    const directoryReads = new Map<string, number>();
    const fileReads = new Map<string, number>();
    const sentinels = [
      "docs/guides/sentinel.md",
      "docs/superpowers/plans/sentinel.md",
      "docs/superpowers/specs/sentinel.md",
      "tests/sentinel.ts",
      "scripts/sentinel.mjs",
      "worker/sentinel.py",
    ];
    for (const sentinel of sentinels) {
      const absolutePath = resolve(root, sentinel);
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, "unrelated content\n", "utf8");
    }
    const fileSystem = {
      readFileSync(path: Parameters<typeof readFileSync>[0], encoding: "utf8") {
        const absolutePath = resolve(String(path));
        fileReads.set(absolutePath, (fileReads.get(absolutePath) ?? 0) + 1);
        return readFileSync(path, encoding);
      },
      readdirSync(path: Parameters<typeof readdirSync>[0], options: { withFileTypes: true }) {
        const absolutePath = resolve(String(path));
        directoryReads.set(absolutePath, (directoryReads.get(absolutePath) ?? 0) + 1);
        return readdirSync(path, options);
      },
    };
    const diff = [
      "diff --git a/src/candidate.ts b/src/candidate.ts",
      "--- a/src/candidate.ts",
      "+++ b/src/candidate.ts",
      "@@ -1,2 +0,0 @@",
      "-export const candidateOne = 1;",
      "-export const candidateTwo = 2;",
      "",
    ].join("\n");
    const resolvedBase = "a".repeat(40);
    const runGit: GitRunner = (args) => {
      if (args[0] === "rev-parse" && args[1] === "--verify") {
        expect(args).toEqual(["rev-parse", "--verify", "--end-of-options", "base^{commit}"]);
        return `${resolvedBase}\n`;
      }
      if (args[0] === "diff") {
        expect(args).toEqual([
          "diff",
          "--no-color",
          "--no-ext-diff",
          "--no-textconv",
          "--src-prefix=a/",
          "--dst-prefix=b/",
          "-U0",
          resolvedBase,
          "--",
          "src",
          "scripts",
          "worker",
        ]);
        return diff;
      }
      if (args[0] === "rev-parse" && args[1] === "--is-shallow-repository") return "false\n";
      if (args[0] === "log") return "2026-01-01\n";
      throw new Error(`unexpected git call: ${args.join(" ")}`);
    };

    expect(
      main(["--diff", "base"], {
        root,
        runGit,
        fileSystem,
        stdout: () => undefined,
        stderr: () => undefined,
      }),
    ).toBe(0);
    for (const searchRoot of ["tests", "src", "scripts", "worker"]) {
      expect(directoryReads.get(resolve(root, searchRoot)), searchRoot).toBe(1);
    }
    for (const nestedPlanRoot of ["docs/superpowers/plans", "docs/superpowers/specs"]) {
      expect(directoryReads.get(resolve(root, nestedPlanRoot)), nestedPlanRoot).toBe(2);
    }
    for (const sentinel of sentinels) {
      expect(fileReads.get(resolve(root, sentinel)), sentinel).toBe(1);
    }
  });
});
