import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const nodeSetup = readFileSync(new URL("../.github/actions/setup-node-cached/action.yml", import.meta.url), "utf8");
const uiSetup = readFileSync(new URL("../.github/actions/setup-ui-e2e/action.yml", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");

describe("CI cache safety", () => {
  it("uses npm's download cache but recreates node_modules on every job", () => {
    expect(nodeSetup).toContain("cache: npm");
    expect(nodeSetup).toContain("cache-dependency-path: package-lock.json");
    expect(nodeSetup).toContain("run: npm ci --include=dev");
    expect(nodeSetup).not.toContain("path: node_modules");
    expect(nodeSetup).not.toContain("cache-hit");
  });

  it("keeps quarantined and mockup UI specs in one advisory lane", () => {
    expect(workflow).toContain("ui-advisory:");
    expect(workflow).toContain("uses: ./.github/actions/setup-ui-e2e");
    expect(workflow).toContain("run: npm run test:e2e:advisory");
    expect(workflow).not.toContain("ui-quarantine:");
    expect(workflow).not.toContain("ui-mockups:");
  });

  it("installs Playwright system dependencies when browser caches hit", () => {
    expect(uiSetup).toMatch(/cache-hit.*?install-deps chromium.*?install chromium/s);
    expect(workflow).toMatch(/cache-hit.*?install-deps\n\s+npx playwright install/s);
  });
});

/*
 * #095: `cancel-in-progress` supersedes an in-flight run on every push, and the aggregate's
 * `require_*` helpers lumped the resulting `cancelled` in with a genuine `failure`. One
 * 2026-07-30 session burned four separate investigations on `::error::changes result was
 * cancelled` before recognising it, while a docs-only PR merged straight through a red the
 * repo had learned to ignore. Both halves of the contract matter and pull against each other:
 * a cancelled run must stay RED (it verified nothing, and a skipped required check counts as
 * PASSING on GitHub, so skipping the aggregate would make a hand-cancelled run mergeable),
 * while its message must be unmistakably distinct from a real failure.
 *
 * These cases execute the aggregate's real shell rather than grepping the YAML for strings,
 * because the defect was in the script's behaviour and a structural assertion would have
 * passed against it (see #094 on gates asserting structure over rendered effect).
 */
describe("PR required aggregate — cancelled vs failed (#095)", () => {
  const script = (() => {
    const lines = workflow.split("\n");
    const stepIndex = lines.findIndex((line) => line.includes("name: Verify required in-scope jobs"));
    const runIndex = lines.findIndex((line, index) => index > stepIndex && /^\s+run: \|\s*$/.test(line));
    const runIndent = lines[runIndex].search(/\S/);
    const body: string[] = [];
    for (let index = runIndex + 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (line.trim() && line.search(/\S/) <= runIndent) break;
      body.push(line);
    }
    const bodyIndent = body.find((line) => line.trim())?.search(/\S/) ?? 0;
    return body.map((line) => line.slice(bodyIndent)).join("\n");
  })();

  const allGreen = {
    DOCS_ONLY: "false",
    COVERAGE_CHANGED: "false",
    UI_CHANGED: "false",
    DB_CHANGED: "false",
    BUILD_CHANGED: "false",
    CONTAINER_CHANGED: "false",
    EVENT_NAME: "pull_request",
    CHANGES_RESULT: "success",
    STATIC_RESULT: "success",
    // `safety` is required whenever DOCS_ONLY is false, so the green baseline must run it.
    SAFETY_RESULT: "success",
    COVERAGE_RESULT: "skipped",
    BUILD_RESULT: "skipped",
    CONTAINER_RESULT: "skipped",
    UI_RESULT: "skipped",
    DB_RESULT: "skipped",
  };

  function runAggregate(overrides: Record<string, string> = {}) {
    const result = spawnSync("bash", ["-c", script], {
      // process.env is spread because this repo augments ProcessEnv with required keys, so a
      // bare object does not typecheck. All fifteen variables the script reads are overridden
      // below, and it runs under `set -u`, so the ambient environment cannot change the outcome.
      env: { ...process.env, ...allGreen, ...overrides },
      encoding: "utf8",
    });
    return { status: result.status, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
  }

  it("extracted the real aggregate script, not an empty string", () => {
    // Without this the whole describe would vacuously pass on a YAML restructure.
    expect(script).toContain("require_success");
    expect(script).toContain("Required in-scope PR checks passed.");
  });

  it("passes when every in-scope job succeeded", () => {
    expect(runAggregate().status).toBe(0);
  });

  it("reports a superseded run as CANCELLED rather than describing a failure", () => {
    // A supersession cancels the upstream jobs, so this is what a real one looks like.
    const { status, output } = runAggregate({ CHANGES_RESULT: "cancelled", STATIC_RESULT: "cancelled" });
    expect(status).toBe(1);
    expect(output).toContain("CANCELLED");
    expect(output).toContain("not a real failure");
    // The actionable part: point the reader at the run that does describe the head.
    expect(output).toMatch(/newest .*run/i);
    // And do not let a hand-cancelled run read as safe to merge past.
    expect(output).toContain("re-run it rather than merging");
  });

  it("labels a single cancelled job distinctly instead of as a plain failure", () => {
    const { status, output } = runAggregate({ CHANGES_RESULT: "cancelled" });
    expect(status).toBe(1);
    expect(output).toContain("CANCELLED");
    expect(output).not.toContain("changes result was cancelled");
  });

  it("still reports a genuine failure plainly, with no cancellation excuse attached", () => {
    const { status, output } = runAggregate({ STATIC_RESULT: "failure" });
    expect(status).toBe(1);
    expect(output).toContain("static-pr result was failure");
    expect(output).not.toContain("CANCELLED");
  });

  it("NEVER passes on a cancelled required job — #095's stop rule", () => {
    /*
     * The tempting fix was to treat cancelled as neutral so the red would disappear. That is
     * the one change this must not permit: a cancelled job proved nothing, so green here would
     * assert verification that never happened.
     */
    for (const key of ["CHANGES_RESULT", "STATIC_RESULT"]) {
      expect(runAggregate({ [key]: "cancelled" }).status).not.toBe(0);
    }
    expect(runAggregate({ DOCS_ONLY: "false", SAFETY_RESULT: "cancelled" }).status).not.toBe(0);
    expect(runAggregate({ COVERAGE_CHANGED: "true", COVERAGE_RESULT: "cancelled" }).status).not.toBe(0);
    expect(runAggregate({ UI_CHANGED: "true", UI_RESULT: "cancelled" }).status).not.toBe(0);
  });

  it("keeps `if: always()`, since a skipped required check counts as passing", () => {
    // Guards the unsafe "fix": `if: !cancelled()` would skip this job on cancellation, and
    // GitHub treats a skipped required check as PASSING — mergeable with nothing verified.
    expect(workflow).toMatch(/pr-required:[\s\S]*?if: always\(\)/);
  });

  it("never puts a status-check function anywhere but an `if:` condition", () => {
    /*
     * GitHub allows success()/failure()/cancelled()/always() ONLY in `if:` conditions. Using
     * one elsewhere is valid YAML and an invalid Actions schema, so the whole file fails to
     * parse: the run is named after the file path instead of the workflow, creates ZERO jobs,
     * and reports a bare failure. Nothing local catches it — prettier, lint, typecheck,
     * check:github-actions and the full unit suite all passed the broken version, and it was
     * only visible on hosted CI. Measured 2026-07-30 on PR #1409, from
     * `RUN_CANCELLED: ${{ cancelled() }}` in an env block.
     */
    const workflowDirectory = new URL("../.github/workflows/", import.meta.url);
    const offenders: string[] = [];
    for (const file of readdirSync(workflowDirectory).filter((name) => /\.ya?ml$/.test(name))) {
      const text = readFileSync(new URL(file, workflowDirectory), "utf8");
      text.split("\n").forEach((line, index) => {
        if (!/\$\{\{[^}]*\b(success|failure|cancelled|always)\s*\(/.test(line)) return;
        // `if:` may be the key on this line, or the expression may continue a multi-line if.
        if (/^\s*(-\s+)?if\s*:/.test(line)) return;
        offenders.push(`${file}:${index + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
