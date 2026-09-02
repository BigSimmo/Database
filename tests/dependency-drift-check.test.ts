import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

const SCRIPT = fileURLToPath(new URL("../scripts/check-dependency-drift.mjs", import.meta.url));
const REPOSITORY_ROOT = dirname(dirname(SCRIPT));

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
 * Regression fixture pointed at the real repository, not a synthetic tree.
 *
 * The synthetic fixtures above prove the LOGIC (closure, resolution, controls, the
 * findable/invisible split). This block proves the logic is pointed at something real:
 * it runs the tool against `origin/main` for four surfaces measured directly on
 * 2026-09-02, one of which — `worker` — is the whole reason this tool exists. Fourteen
 * files pull in 155, and the overwhelming majority of what changes underneath it shares
 * no name with "worker" at all. A version of this script that reported 0 invisible files
 * for `worker` would be silently wrong, and nothing else in this repository would notice.
 *
 * Seed counts are pinned exactly: they depend only on how many .ts/.tsx files currently
 * live under each surface, which is stable unless someone adds or removes files there —
 * and if they do, updating this number is the correct maintenance cost, not a fixture to
 * relax. The changed/findable/invisible counts are NOT pinned exactly, because `origin/main`
 * moves out from under this branch over time; instead this asserts the structural property
 * that actually matters — worker's invisible share stays large — so the fixture keeps
 * catching the failure mode it was built for instead of going stale and green.
 */
describe("regression fixture — real surfaces against origin/main", () => {
  const SURFACES: Array<{ surface: string; expectedSeed: number }> = [
    { surface: "src/components/ward-management", expectedSeed: 85 },
    { surface: "src/lib/rag", expectedSeed: 36 },
    // 34 -> 56 on 2026-09-03: the merge with `main` brought in every Caring Contacts file
    // added there since this branch forked. Legitimate drift, updated as the assertion
    // message above instructs — the script is untouched.
    { surface: "src/components/caring-contacts", expectedSeed: 56 },
    { surface: "worker", expectedSeed: 14 },
  ];

  function runAgainstRealRepo(surface: string) {
    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];
    const exitCode = main(["--surface", surface, "--against", "origin/main"], {
      root: REPOSITORY_ROOT,
      stdout: (line: string) => stdoutLines.push(line),
      stderr: (line: string) => stderrLines.push(line),
    });
    return { exitCode, stdout: stdoutLines.join("\n"), stderr: stderrLines.join("\n") };
  }

  it.each(SURFACES)("$surface: seed count matches the measured baseline", ({ surface, expectedSeed }) => {
    const { exitCode, stdout, stderr } = runAgainstRealRepo(surface);
    expect(stderr, `control(s) tripped for ${surface}: ${stderr}`).toBe("");
    expect(exitCode, `expected a clean report for ${surface}`).toBe(0);

    const seedMatch = /seed: (\d+) · closure: (\d+) · ratio: ([\d.]+)x/.exec(stdout);
    expect(seedMatch, `could not find the seed/closure line in stdout:\n${stdout}`).not.toBeNull();
    const [, seedCount, closureCount] = seedMatch as RegExpExecArray;

    if (Number(seedCount) !== expectedSeed) {
      console.warn(
        `[dependency-drift regression] ${surface}: measured seed ${seedCount} differs from the ` +
          `2026-09-02 baseline of ${expectedSeed}. This can be legitimate drift (files added or removed ` +
          `under the surface) — update the baseline in this test to match reality, do not change the script.`,
      );
    }
    expect(Number(seedCount)).toBe(expectedSeed);
    expect(Number(closureCount)).toBeGreaterThanOrEqual(expectedSeed);
  });

  /**
   * ⚠️ REWRITTEN 2026-09-03, WHEN THIS BRANCH WAS BROUGHT LEVEL WITH `main`, AND THE REWRITE IS
   * THE FINDING RATHER THAN A REPAIR.
   *
   * This asserted a large invisible share unconditionally. It could only ever pass while the
   * branch was BEHIND `origin/main`, because the tool measures upstream drift — what moved on the
   * reference side that this branch does not have. Bring the branch level and the honest answer is
   * zero, by construction: there is no ground that has moved. The old assertion therefore read
   * "this branch is stale" while claiming to read "the script still classifies".
   *
   * The anti-vacuity concern behind it is real and is kept, not dropped: a script silently
   * reporting zero invisible for `worker` would be broken and nobody would know. So a zero is now
   * accepted ONLY alongside independent proof that there is genuinely nothing upstream to see —
   * `git rev-list --count HEAD..origin/main` at zero. A broken script cannot produce that; a
   * merged branch produces it every time. When there IS drift, the original property is asserted
   * exactly as before.
   *
   * The classification itself is proven independently of any branch state by
   * `splitByFindability` above, which is where that guarantee belongs.
   */
  it("worker: the invisible share stays large whenever there is upstream ground to have moved", () => {
    const { exitCode, stdout, stderr } = runAgainstRealRepo("worker");
    expect(stderr).toBe("");
    expect(exitCode).toBe(0);

    const summaryMatch = /seed: (\d+) · closure: (\d+) · ratio: ([\d.]+)x/.exec(stdout);
    const changedMatch = /changed dependencies\): (\d+) — (\d+) findable, (\d+) INVISIBLE/.exec(stdout);
    expect(summaryMatch, `could not find the summary line in stdout:\n${stdout}`).not.toBeNull();
    expect(changedMatch, `could not find the changed-dependencies line in stdout:\n${stdout}`).not.toBeNull();

    const [, , , ratio] = summaryMatch as RegExpExecArray;
    const [, changed, findable, invisible] = changedMatch as RegExpExecArray;

    expect(Number(findable) + Number(invisible)).toBe(Number(changed));
    // Branch-independent, so it holds on every run: worker's closure is an order of magnitude
    // larger than its own file list, which is the whole reason a name search misses things.
    expect(Number(ratio)).toBeGreaterThan(5);

    if (Number(changed) === 0) {
      const behind = Number(
        execFileSync("git", ["rev-list", "--count", "HEAD..origin/main"], {
          cwd: REPOSITORY_ROOT,
          encoding: "utf8",
        }).trim(),
      );
      expect(
        behind,
        "the tool reported zero changed dependencies for worker, so this branch must actually be " +
          "level with origin/main. If it is behind and the count is still zero, the script has " +
          "stopped classifying and this is the failure the assertion below exists to catch.",
      ).toBe(0);
      return;
    }

    // A script that reports 0 invisible for worker while its ground HAS moved is broken.
    expect(Number(invisible)).toBeGreaterThan(10);
  });
});
