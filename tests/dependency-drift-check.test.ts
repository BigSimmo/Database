import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  classifySpecifier,
  computeClosure,
  extractImportSpecifiers,
  intersect,
  main,
  splitByFindability,
} from "../scripts/check-dependency-drift.mjs";

const fixtureRoots: string[] = [];

function createFixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), "dependency-drift-"));
  fixtureRoots.push(root);
  return root;
}

function write(root: string, relativePath: string, contents: string) {
  const target = join(root, ...relativePath.split("/"));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents, "utf8");
}

afterEach(() => {
  for (const root of fixtureRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

describe("extractImportSpecifiers / classifySpecifier", () => {
  it("extracts default, named, side-effect, re-export and dynamic-literal specifiers", () => {
    const source = `
      import Default from "./default";
      import { A, B } from "../up/named";
      import "./side-effect.css";
      export { C } from "@/lib/reexport";
      export * from "./barrel";
      const lazy = () => import("./lazy-chunk");
      import type { D } from "./types-only";
    `;
    expect(extractImportSpecifiers(source).sort()).toEqual(
      [
        "./default",
        "../up/named",
        "./side-effect.css",
        "@/lib/reexport",
        "./barrel",
        "./lazy-chunk",
        "./types-only",
      ].sort(),
    );
  });

  it("does not follow a dynamic import built from a template literal — the documented limit", () => {
    const source = "const mod = (name) => import(`./modes/${name}`);";
    expect(extractImportSpecifiers(source)).toEqual([]);
  });

  it("classifies relative, aliased and bare specifiers", () => {
    expect(classifySpecifier("./a")).toBe("relative");
    expect(classifySpecifier("../a")).toBe("relative");
    expect(classifySpecifier("@/lib/a")).toBe("aliased");
    expect(classifySpecifier("react")).toBe("bare");
    expect(classifySpecifier("@radix-ui/react-dialog")).toBe("bare");
  });
});

describe("computeClosure — synthetic fixture", () => {
  it("(a) follows the closure through a depth->=2 file the seed never imports directly", () => {
    const root = createFixtureRoot();
    // entry.tsx (seed) -> src/lib/level1.ts -> src/lib/level2.ts
    // entry.tsx never mentions level2 itself: it is only reachable transitively.
    write(root, "src/components/mysurface/entry.tsx", 'import { one } from "../../lib/level1";\nexport { one };\n');
    write(root, "src/lib/level1.ts", 'import { two } from "./level2";\nexport const one = two;\n');
    write(root, "src/lib/level2.ts", "export const two = 2;\n");

    const result = computeClosure({
      surfaceAbsoluteDir: join(root, "src", "components", "mysurface"),
      root,
    });

    expect(result.unresolved).toEqual([]);
    expect(result.seedFiles).toEqual(["src/components/mysurface/entry.tsx"]);
    // level1 is a direct import; level2 is two hops from the seed and the seed's own
    // source text never names it — this is the transitivity the tool exists to prove.
    expect(result.closure.has("src/lib/level1.ts")).toBe(true);
    expect(result.closure.has("src/lib/level2.ts")).toBe(true);
    expect(result.closure.size).toBe(3);
  });

  it("ignores bare package specifiers but counts them", () => {
    const root = createFixtureRoot();
    write(
      root,
      "src/components/mysurface/entry.tsx",
      'import React from "react";\nimport { z } from "zod";\nexport const x = 1;\n',
    );

    const result = computeClosure({
      surfaceAbsoluteDir: join(root, "src", "components", "mysurface"),
      root,
    });

    expect(result.closure.size).toBe(1);
    expect(result.bareSpecifiers).toEqual(new Set(["react", "zod"]));
  });

  it("resolves through every documented suffix, in order", () => {
    const root = createFixtureRoot();
    write(root, "src/components/mysurface/a.tsx", 'import "../../lib/plain";\n');
    write(root, "src/components/mysurface/b.tsx", 'import "../../lib/dot-ts";\n');
    write(root, "src/components/mysurface/c.tsx", 'import "../../lib/folder";\n');
    write(root, "src/lib/plain.js", "export {};\n"); // resolved via the ".js" suffix
    write(root, "src/lib/dot-ts.ts", "export {};\n"); // resolved via the ".ts" suffix
    write(root, "src/lib/folder/index.tsx", "export {};\n"); // resolved via "/index.tsx"

    const result = computeClosure({
      surfaceAbsoluteDir: join(root, "src", "components", "mysurface"),
      root,
    });

    expect(result.unresolved).toEqual([]);
    expect(result.closure.has("src/lib/plain.js")).toBe(true);
    expect(result.closure.has("src/lib/dot-ts.ts")).toBe(true);
    expect(result.closure.has("src/lib/folder/index.tsx")).toBe(true);
  });
});

describe("CONTROL A — unresolved local specifiers", () => {
  it("(b) fails the run and never calls git", () => {
    const root = createFixtureRoot();
    write(root, "src/components/mysurface/entry.tsx", 'import { thing } from "./missing";\nexport { thing };\n');

    const stderrLines: string[] = [];
    const exitCode = main(["--surface", "src/components/mysurface", "--against", "HEAD"], {
      root,
      runGit: () => {
        throw new Error("git must not run once Control A has already failed");
      },
      stdout: () => undefined,
      stderr: (line: string) => stderrLines.push(line),
    });

    expect(exitCode).toBe(1);
    const combined = stderrLines.join("\n");
    expect(combined).toContain("CONTROL A FAILED");
    expect(combined).toContain("1 unresolved local specifier");
    expect(combined).toContain("./missing");
    expect(combined).toContain("src/components/mysurface/entry.tsx");
  });

  it("does not fire on a resolvable specifier", () => {
    const root = createFixtureRoot();
    write(root, "src/components/mysurface/entry.tsx", 'import { thing } from "./present";\nexport { thing };\n');
    write(root, "src/components/mysurface/present.ts", "export const thing = 1;\n");

    const result = computeClosure({
      surfaceAbsoluteDir: join(root, "src", "components", "mysurface"),
      root,
    });
    expect(result.unresolved).toEqual([]);
  });
});

describe("CONTROL B — self-intersection", () => {
  it("holds for an ordinary closure", () => {
    const closure = new Set(["a", "b", "c"]);
    const selfIntersection = intersect(closure, closure);
    expect(selfIntersection.size).toBe(closure.size);
  });

  it("intersect() only keeps members present in both sets", () => {
    expect(intersect(new Set(["a", "b"]), new Set(["b", "c"]))).toEqual(new Set(["b"]));
    expect(intersect(new Set(), new Set(["a"]))).toEqual(new Set());
  });
});

describe("splitByFindability", () => {
  it("(c) puts a path lacking the surface basename into the invisible group", () => {
    const { findable, invisible } = splitByFindability(
      ["src/components/mysurface/a.tsx", "src/lib/unrelated-helper.ts", "src/components/mysurface/sub/b.tsx"],
      "mysurface",
    );
    expect(findable).toEqual(["src/components/mysurface/a.tsx", "src/components/mysurface/sub/b.tsx"]);
    expect(invisible).toEqual(["src/lib/unrelated-helper.ts"]);
  });

  it("returns empty groups for an empty input", () => {
    expect(splitByFindability([], "anything")).toEqual({ findable: [], invisible: [] });
  });
});

/**
 * Regression fixture pointed at a REAL git repository this test builds and tears down —
 * never the live checkout, and never `origin/main` as it happens to sit on the machine
 * running the test.
 *
 * The previous version of this fixture ran `main()` against `REPOSITORY_ROOT` with
 * `--against origin/main`, i.e. the actual repository and the actual remote ref. That
 * measures something true only at the instant it is captured: merging the integration
 * branch forward changed the worker "invisible" count from 4 to 2 with no change to the
 * script at all — only the ref moved — and it has also been observed as 0 on another
 * checkout. A fixture that asserts a property of a target it does not control is not
 * testing the tool; it is testing whatever the remote happened to look like today.
 *
 * So this block owns BOTH sides of the comparison. `buildWorkerAnalogueFixture()` creates
 * a throwaway git repository (mkdtempSync + real `git init`/`commit`, exactly the pattern
 * tests/adopt-visual-baselines.test.ts and tests/bundle-budget.test.ts already use) with:
 *   - a `worker/` directory of exactly 3 files — entirely owned by this fixture, so unlike
 *     a directory in the live repository this count can never drift out from under the
 *     test (see the module doc's "second trap": hardcoding a LIVE count is the bug this
 *     rewrite exists to remove, not a fix for it).
 *   - a fork commit (HEAD) whose worker/index.ts imports 15 "pipeline stage" files under
 *     src/lib/pipeline — none of them named "worker" — so the closure reaches well beyond
 *     the seed, the way the real `worker` surface does.
 *   - an `upstream` commit, built on top of the fork commit and pointed to by a bare
 *     `refs/remotes/origin/main` ref (no `git remote` registered — git resolves a
 *     remote-tracking ref by name alone), which edits 11 of those 15 stage files plus the
 *     one worker-named file. That is the real, controlled analogue of "origin/main moved
 *     underneath this branch": diffing the fork commit against it names exactly those 12
 *     files, 11 of which no name search for "worker" would ever find.
 *
 * The working tree is left checked out at the fork commit (matching HEAD) because
 * computeClosure() reads the filesystem directly — it has no idea what git thinks HEAD is.
 */
describe("regression fixture — hermetic git fixture, not the live repository", () => {
  const WORKER_ANALOGUE_SEED_BASENAMES = ["index.ts", "queue.ts", "util.ts"]; // exactly 3, fixture-owned
  const WORKER_ANALOGUE_LIB_FILES = Array.from(
    { length: 15 },
    (_, index) => `src/lib/pipeline/stage-${String(index + 1).padStart(2, "0")}.ts`,
  );
  const WORKER_ANALOGUE_DRIFTED_LIB_FILES = WORKER_ANALOGUE_LIB_FILES.slice(0, 11); // > 10 — see "invisible share stays large" below
  const stageExportName = (file: string) => `stage${/stage-(\d+)/.exec(file)![1]}`;

  function gitExec(root: string, args: string[]) {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  }

  function commitAll(root: string, message: string) {
    gitExec(root, ["add", "-A"]);
    gitExec(root, ["commit", "-q", "-m", message, "--no-gpg-sign"]);
    return gitExec(root, ["rev-parse", "HEAD"]);
  }

  function buildWorkerAnalogueFixture() {
    const root = createFixtureRoot();
    gitExec(root, ["init", "-q"]);
    gitExec(root, ["config", "user.email", "fixture@example.invalid"]);
    gitExec(root, ["config", "user.name", "Fixture"]);

    write(root, "worker/queue.ts", 'export const queue = "queue.ts";\n');
    write(root, "worker/util.ts", 'export const util = "util.ts";\n');
    for (const file of WORKER_ANALOGUE_LIB_FILES) {
      write(root, file, `export const ${stageExportName(file)} = ${/stage-(\d+)/.exec(file)![1]};\n`);
    }
    write(
      root,
      "worker/index.ts",
      WORKER_ANALOGUE_LIB_FILES.map(
        (file) => `import { ${stageExportName(file)} } from "../${file.replace(/\.ts$/, "")}";\n`,
      ).join("") + `export const pipeline = [${WORKER_ANALOGUE_LIB_FILES.map(stageExportName).join(", ")}];\n`,
    );

    const forkSha = commitAll(root, "fork point");

    gitExec(root, ["checkout", "-q", "-b", "upstream"]);
    for (const file of WORKER_ANALOGUE_DRIFTED_LIB_FILES) {
      const existing = readFileSync(join(root, ...file.split("/")), "utf8");
      write(root, file, `${existing}// drifted upstream\n`);
    }
    write(root, "worker/queue.ts", 'export const queue = "queue.ts";\n// drifted upstream\n');
    const upstreamSha = commitAll(root, "upstream drift");

    // A bare remote-tracking ref, not a registered remote — this is what makes
    // `--against origin/main` resolvable without `git fetch` or network access.
    gitExec(root, ["update-ref", "refs/remotes/origin/main", upstreamSha]);
    gitExec(root, ["checkout", "-q", "-"]); // back to the fork commit — matches the seed/closure read from disk

    return { root, forkSha, upstreamSha };
  }

  function runAgainstFixture(root: string, surface: string, against: string) {
    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];
    const exitCode = main(["--surface", surface, "--against", against], {
      root,
      stdout: (line: string) => stdoutLines.push(line),
      stderr: (line: string) => stderrLines.push(line),
    });
    return { exitCode, stdout: stdoutLines.join("\n"), stderr: stderrLines.join("\n") };
  }

  it("worker: seed and closure counts match this fixture's own inventory", () => {
    const { root } = buildWorkerAnalogueFixture();
    const { exitCode, stdout, stderr } = runAgainstFixture(root, "worker", "origin/main");
    expect(stderr, `control(s) tripped: ${stderr}`).toBe("");
    expect(exitCode).toBe(0);

    const seedMatch = /seed: (\d+) · closure: (\d+) · ratio: ([\d.]+)x/.exec(stdout);
    expect(seedMatch, `could not find the seed/closure line in stdout:\n${stdout}`).not.toBeNull();
    const [, seedCount, closureCount] = seedMatch as RegExpExecArray;

    expect(Number(seedCount)).toBe(WORKER_ANALOGUE_SEED_BASENAMES.length);
    expect(Number(closureCount)).toBe(WORKER_ANALOGUE_SEED_BASENAMES.length + WORKER_ANALOGUE_LIB_FILES.length);
  });

  it("worker: the invisible share stays large — this is the case the tool exists for", () => {
    const { root } = buildWorkerAnalogueFixture();
    const { exitCode, stdout, stderr } = runAgainstFixture(root, "worker", "origin/main");
    expect(stderr).toBe("");
    expect(exitCode).toBe(0);

    const summaryMatch = /seed: (\d+) · closure: (\d+) · ratio: ([\d.]+)x/.exec(stdout);
    const changedMatch = /changed dependencies\): (\d+) — (\d+) findable, (\d+) INVISIBLE/.exec(stdout);
    expect(summaryMatch, `could not find the summary line in stdout:\n${stdout}`).not.toBeNull();
    expect(changedMatch, `could not find the changed-dependencies line in stdout:\n${stdout}`).not.toBeNull();

    const [, , , ratio] = summaryMatch as RegExpExecArray;
    const [, changed, findable, invisible] = changedMatch as RegExpExecArray;

    expect(Number(findable) + Number(invisible)).toBe(Number(changed));
    expect(Number(changed)).toBe(WORKER_ANALOGUE_DRIFTED_LIB_FILES.length + 1); // +1 for worker/queue.ts
    expect(Number(findable)).toBe(1);
    // A script that reports 0 invisible for worker is broken and nobody would know.
    expect(Number(invisible)).toBeGreaterThan(10);
    expect(Number(invisible)).toBe(WORKER_ANALOGUE_DRIFTED_LIB_FILES.length);
    expect(Number(ratio)).toBeGreaterThan(5);
  });

  it("CATCHER — refuses cleanly instead of fabricating a report when the compared ref does not exist", () => {
    const { root } = buildWorkerAnalogueFixture();
    gitExec(root, ["update-ref", "-d", "refs/remotes/origin/main"]); // construct: no origin/main ref at all
    const { exitCode, stdout, stderr } = runAgainstFixture(root, "worker", "origin/main");
    expect(exitCode).toBe(1);
    expect(stderr).toContain("REFUSE — git setup failed");
    expect(stdout).toBe("");
  });

  it("CATCHER — reports zero drift, not stale numbers, when origin/main equals HEAD", () => {
    const { root, forkSha } = buildWorkerAnalogueFixture();
    // construct: origin/main pointed at the exact commit HEAD is on — no drift has happened
    gitExec(root, ["update-ref", "refs/remotes/origin/main", forkSha]);
    const { exitCode, stdout, stderr } = runAgainstFixture(root, "worker", "origin/main");
    expect(stderr).toBe("");
    expect(exitCode).toBe(0);

    const changedMatch = /changed dependencies\): (\d+) — (\d+) findable, (\d+) INVISIBLE/.exec(stdout);
    expect(changedMatch, `could not find the changed-dependencies line in stdout:\n${stdout}`).not.toBeNull();
    const [, changed, findable, invisible] = changedMatch as RegExpExecArray;

    expect(Number(changed)).toBe(0);
    expect(Number(findable)).toBe(0);
    expect(Number(invisible)).toBe(0);
  });
});

/**
 * ⚠️ **THE COVERAGE THE HERMETIC FIXTURE GAVE UP, RESTORED WITHOUT THE DEFECT THAT SANK IT.**
 *
 * This block replaces four assertions deleted alongside the hermetic rewrite. Those ran the tool
 * over four real surfaces and pinned a SEED COUNT for each — 85, 36, 34, 14. One was already
 * failing (`expected 56 to be 34`), and the test's own `console.warn` told the reader to update
 * the baseline "to match reality". ⚠️ **A test whose documented maintenance procedure is
 * "change the expected value when it changes" is not asserting a property; it is reporting that a
 * folder grew.** Removing them was right. Losing every check against a real repository shape was
 * not.
 *
 * So this asserts only things that CANNOT DRIFT: no counts, no ratios, no thresholds. Add a
 * hundred files to any of these surfaces and nothing here needs editing.
 *
 * ⚠️ **AND IT TOUCHES NO GIT REF, NO REMOTE AND NO NETWORK — deliberately, and it is why it calls
 * `computeClosure` rather than `main`.** `main` requires `--against <git-ref>` (it throws
 * "--surface and --against are both required"), so any smoke test built on it would reintroduce
 * exactly the moving-target dependency the rewrite removed. `computeClosure` walks the working
 * tree and nothing else. The ref-handling paths are covered hermetically by the two CATCHER tests
 * above, where the ref's state is owned by the fixture instead of the world.
 *
 * ⚠️ **THE FAILURE MODE THIS IS BUILT AGAINST: a smoke test that passes when the tool is dead.**
 * "It ran" is satisfied by a script that finds nothing. So the first assertion is that the surface
 * was actually walked, and it is mutation-proven — a tool returning an empty seed reddens it by
 * name.
 */
describe("smoke — the tool still works against real repository shapes", () => {
  // Derived here rather than at module scope: every other block in this file is hermetic and must
  // not acquire a dependency on where it is checked out. `tests/<file>` -> repository root.
  const REPOSITORY_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

  const REAL_SURFACES = ["src/components/ward-management", "src/lib/rag", "src/components/caring-contacts", "worker"];

  it.each(REAL_SURFACES)("%s: is walked, resolves cleanly, and its seed is inside its closure", (surface) => {
    const result = computeClosure({
      surfaceAbsoluteDir: join(REPOSITORY_ROOT, ...surface.split("/")),
      root: REPOSITORY_ROOT,
    });

    // (1) The tool found something. ⚠️ Without this, every assertion below is vacuously true for a
    // tool that returns nothing at all — which is the state a broken walk actually produces.
    expect(
      result.seedFiles.length,
      `${surface}: the walk returned an EMPTY seed. Either the surface moved, or the tool stopped ` +
        `finding files — and a tool that finds nothing satisfies every other check in this block.`,
    ).toBeGreaterThan(0);

    // (2) Every local import inside the closure resolved against a real repository shape. This is
    // the property the deleted tests were reaching for and never actually asserted: the script's
    // own CONTROL A fails the run on an unresolved specifier, so a non-empty list here means the
    // tool would refuse on this repository today.
    expect(
      result.unresolved,
      `${surface}: local specifiers the tool could not resolve — it would REFUSE on this ` +
        `repository. First few: ${result.unresolved
          .slice(0, 3)
          .map((entry) => `${entry.file} -> ${entry.specifier}`)
          .join(", ")}`,
    ).toEqual([]);

    // (3) The closure is a superset of the seed, by construction. An invariant, not a measurement:
    // it holds at any size, and breaks if the closure ever stops including what it started from.
    const missing = result.seedFiles.filter((file) => !result.closure.has(file));
    expect(missing, `${surface}: seed files missing from their own closure`).toEqual([]);
  });
});
