import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sourceFrom } from "./helpers/source-contract";

/*
 * `release-browser-matrix` runs one job per browser engine.
 *
 * Why that shape needs a guard of its own: before 2026-09-07 the job ran
 * chromium-mockups + firefox + webkit sequentially in ONE job under
 * `workers: 1` / `fullyParallel: false`, and it stopped finishing — measured
 * 70m23s (run 34100540973) and 70m20s (run 34104496596), both landing exactly on
 * the then-70-minute cap. GitHub reports a timed-out job as `cancelled`, so
 * every main run concluded cancelled while every other job passed, and the
 * matrix produced NO verdict at all. `main` had zero Firefox/WebKit coverage
 * rather than failing coverage, which is the strictly worse state and the one
 * nobody notices.
 *
 * Splitting by engine fixes the wall-clock. It also introduces the one hazard
 * that a single job did not have: the fail-safe path used to run bare
 * `npm run test:e2e`, which means EVERY project in playwright.config.ts. Spread
 * across engines, that set is now written out by hand, so a project added to the
 * config later would simply never run — and nothing would go red to say so.
 *
 * These cases exist to make that impossible. They re-derive the engine groups
 * from ci.yml and the project list from playwright.config.ts, and fail closed on
 * any divergence. Do not relax them to accommodate a new project; add the
 * project to the right engine group instead.
 */

const workflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
const playwrightConfig = readFileSync(new URL("../playwright.config.ts", import.meta.url), "utf8");

const releaseJob = sourceFrom(workflow, "  release-browser-matrix:", {
  label: "release-browser-matrix job definition",
});

/** Every project name declared in playwright.config.ts. */
function configuredProjects(): string[] {
  const names = [...playwrightConfig.matchAll(/^\s*name:\s*"([^"]+)"/gm)].map((match) => match[1]);
  expect(names.length, "playwright.config.ts declared no projects — the regex above has drifted").toBeGreaterThan(0);
  return names;
}

/**
 * The `--project=` flags each engine runs, split by the two branches of the
 * step's `if`. The first `case` block is the primary path (production Chromium
 * already proven in this run); the second is the fail-safe path that must cover
 * everything.
 */
function engineProjects(branch: "primary" | "failsafe"): Map<string, string[]> {
  const caseBlocks = [...releaseJob.matchAll(/case "\$ENGINE" in\n([\s\S]*?)\n\s*esac/g)].map((match) => match[1]);
  expect(caseBlocks.length, 'expected exactly two `case "$ENGINE"` blocks in the matrix step').toBe(2);

  const block = caseBlocks[branch === "primary" ? 0 : 1];
  const byEngine = new Map<string, string[]>();
  for (const line of block.split("\n")) {
    const engine = /^\s*([a-z]+)\)\s+PROJECTS=/.exec(line);
    if (!engine) continue;
    byEngine.set(
      engine[1],
      [...line.matchAll(/--project=([\w-]+)/g)].map((match) => match[1]),
    );
  }
  return byEngine;
}

describe("release-browser-matrix engine coverage", () => {
  it("declares one job per engine and does not buy time with a longer timeout", () => {
    expect(releaseJob).toContain("engine: [chromium, firefox, webkit]");
    expect(releaseJob).toContain("fail-fast: false");

    // A single-worker suite is not made faster by a longer cap. Raising this
    // back above the old 70 restores the exact defect: a job that runs for over
    // an hour and then reports nothing.
    const timeout = /timeout-minutes:\s*(\d+)/.exec(releaseJob);
    expect(timeout, "release-browser-matrix must declare a timeout").not.toBeNull();
    expect(Number(timeout?.[1])).toBeLessThanOrEqual(45);
  });

  it("runs every configured Playwright project on the fail-safe path", () => {
    const byEngine = engineProjects("failsafe");
    expect([...byEngine.keys()].sort()).toEqual(["chromium", "firefox", "webkit"]);

    const covered = [...byEngine.values()].flat();
    expect(
      [...covered].sort(),
      "a playwright.config.ts project is missing from the fail-safe engine groups, so it would never run in CI",
    ).toEqual([...configuredProjects()].sort());
  });

  it("never runs the same project on two engines", () => {
    for (const branch of ["primary", "failsafe"] as const) {
      const covered = [...engineProjects(branch).values()].flat();
      expect(new Set(covered).size, `${branch} path runs a project on more than one engine`).toBe(covered.length);
    }
  });

  it("keeps the primary path skipping production Chromium already proven in the run", () => {
    const byEngine = engineProjects("primary");
    expect([...byEngine.values()].flat().sort()).toEqual(["chromium-mockups", "firefox", "webkit"]);

    // `chromium` (the production project) is the one the ui-critical job already
    // proved in this run. Re-running it here is the waste the primary path exists
    // to avoid — but only Chromium, never the cross-engine backstop.
    expect([...byEngine.values()].flat()).not.toContain("chromium");
    expect([...byEngine.values()].flat()).toContain("firefox");
    expect([...byEngine.values()].flat()).toContain("webkit");
  });

  it("uploads diagnostics under a per-engine artifact name", () => {
    // A shared name makes the second failing engine fail on upload, so the
    // engine that failed second loses its trace exactly when it is needed.
    expect(releaseJob).toContain("release-ui-diagnostics-${{ github.run_id }}-${{ matrix.engine }}");
  });
});
