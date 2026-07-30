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
    // Critical-first UI job (this PR); skipped when ui_changed is false.
    UI_FAST_RESULT: "skipped",
    UI_RESULT: "skipped",
    DB_RESULT: "skipped",
  };

  function runAggregate(overrides: Record<string, string> = {}) {
    const variables = { ...allGreen, ...overrides };
    const shellQuote = (value: string) => `'${value.replaceAll("'", `'\\''`)}'`;
    const assignments = Object.entries(variables)
      .map(([name, value]) => `${name}=${shellQuote(value)}`)
      .join("\n");

    // Feed the workflow body over stdin instead of a `bash -c` command-line
    // argument. MSYS bash on Windows reparses backticks in that argument before
    // preserving the embedded newlines, so explanatory shell comments can be
    // executed as command substitutions and make this contract false-green. The
    // fixed test variables are prepended as assignments because WSL bash does not
    // inherit arbitrary Windows environment variables unless WSLENV names them.
    const result = spawnSync("bash", [], {
      env: process.env,
      encoding: "utf8",
      input: `${assignments}\n${script}`,
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
    expect(output).toContain("CANCELLED with no failing job");
    expect(output).toContain("not a broken change");
    // Names every cancelled job, not just the first one it tripped over.
    expect(output).toContain("changes");
    expect(output).toContain("static-pr");
    // The actionable part: point the reader at the run that does describe the head.
    expect(output).toMatch(/newer .*run/i);
    // Hedged, not asserted — a hand-cancelled run has no newer run to look at.
    expect(output).toContain("Usually");
    expect(output).toContain("cancelled by hand");
  });

  it("labels a single cancelled job distinctly instead of as a plain failure", () => {
    const { status, output } = runAggregate({ CHANGES_RESULT: "cancelled" });
    expect(status).toBe(1);
    expect(output).toContain("CANCELLED with no failing job");
    expect(output).not.toContain("changes result was cancelled");
  });

  it("still reports a genuine failure plainly, with no cancellation excuse attached", () => {
    const { status, output } = runAggregate({ STATIC_RESULT: "failure" });
    expect(status).toBe(1);
    expect(output).toContain("static-pr result was failure");
    expect(output).not.toContain("CANCELLED with no failing job");
  });

  it("headlines a genuine failure even when another job was cancelled in the same run", () => {
    /*
     * The mixed case, reported by Codex on PR #1409. An earlier revision exited on the first
     * non-success, so `safety` cancelled + `build` failed announced "not a real failure" and
     * hid the break entirely — worse than the ambiguity the change set out to remove. Genuine
     * failures must win, and a concurrent cancellation may only appear as context.
     */
    const { status, output } = runAggregate({
      SAFETY_RESULT: "cancelled",
      BUILD_CHANGED: "true",
      BUILD_RESULT: "failure",
    });
    expect(status).toBe(1);
    expect(output).toContain("build result was failure");
    // The cancellation must not be the headline, and must not excuse the failure.
    expect(output).not.toContain("CANCELLED with no failing job");
    expect(output).not.toContain("not a broken change");
    // It may still be mentioned, but only as a warning alongside the real failure.
    expect(output).toMatch(/also cancelled: .*safety/);
  });

  it("lists every failing job rather than stopping at the first", () => {
    // Collecting before reporting also fixes the older annoyance of one failure per run.
    const { output } = runAggregate({
      STATIC_RESULT: "failure",
      COVERAGE_CHANGED: "true",
      COVERAGE_RESULT: "failure",
    });
    expect(output).toContain("static-pr result was failure");
    expect(output).toContain("coverage result was failure");
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
    expect(
      runAggregate({
        UI_CHANGED: "true",
        UI_FAST_RESULT: "success",
        UI_RESULT: "cancelled",
      }).status,
    ).not.toBe(0);
    expect(
      runAggregate({
        UI_CHANGED: "true",
        UI_FAST_RESULT: "cancelled",
        UI_RESULT: "success",
      }).status,
    ).not.toBe(0);
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
