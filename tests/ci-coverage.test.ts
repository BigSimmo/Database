import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import fullConfig from "../vitest.config.mjs";
import shardConfig from "../vitest.coverage-shard.config.mjs";

import { CI_EQUIVALENT, deriveCiCoverage, scopeFlagsInGuard } from "../scripts/ci-coverage.mjs";

const projectRoot = process.cwd();

describe("partitioned unit coverage verdict", () => {
  const workflow = createRequire(import.meta.url)("js-yaml").load(
    readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8"),
  );
  const partitions = workflow.jobs["coverage-shards"];
  const aggregate = workflow.jobs.coverage;

  it("keeps the full test inventory and defers only coverage reporting and thresholds", () => {
    expect(shardConfig).toEqual({
      ...fullConfig,
      test: { ...fullConfig.test, coverage: { ...fullConfig.test.coverage, reporter: [], thresholds: undefined } },
    });
    expect(fullConfig.test.coverage.thresholds).toBeDefined();
    expect(partitions.strategy.matrix.shard).toEqual([1, 2]);
    expect(partitions.strategy["fail-fast"]).toBe(false);
    expect(partitions["continue-on-error"]).toBeUndefined();
    const run = partitions.steps.find((step: { run?: string }) => step.run?.includes("--shard="));
    expect(run.run).toContain("--shard=${{ matrix.shard }}/2");
    expect(run.run).toContain("--reporter=blob");
    expect(run["continue-on-error"]).toBeUndefined();
  });

  it("fails the required aggregate on unsuccessful or missing partitions", () => {
    expect(aggregate.needs).toContain("coverage-shards");
    expect(aggregate.if).toContain("always()");
    expect(aggregate.steps[0].env.SHARD_RESULT).toBe("${{ needs.coverage-shards.result }}");
    expect(aggregate.steps[0].run).toBe('test "$SHARD_RESULT" = success');
    expect(aggregate.steps[0]["continue-on-error"]).toBeUndefined();
    const merge = aggregate.steps.find((step: { run?: string }) => step.run?.includes("--merge-reports="));
    const presence = aggregate.steps.find((step: { name: string }) => step.name === "Require both coverage reports");
    for (const shard of [1, 2]) expect(presence.run).toContain(`test -s .vitest-ci/coverage-${shard}.json`);
    expect(aggregate.steps.indexOf(presence)).toBeLessThan(aggregate.steps.indexOf(merge));
    expect(presence["continue-on-error"]).toBeUndefined();
    expect(merge.run).toContain("npm run test:coverage -- --merge-reports=.vitest-ci --reporter=default");
    expect(merge.run).not.toContain("--config");
    expect(merge["continue-on-error"]).toBeUndefined();
    expect(workflow.jobs["pr-required"].needs).toContain("coverage");
  });
});

describe("ci coverage — derived, not assumed", () => {
  it("resolves a gate CI runs under its own name, when its guard is satisfied", () => {
    expect(deriveCiCoverage(projectRoot, "lint", { scope: { static_heavy_changed: true } }).covered).toBe(true);
  });

  it("resolves a gate CI runs under its coverage-job name", () => {
    const coverage = deriveCiCoverage(projectRoot, "test", { scope: { coverage_changed: true } });
    expect(coverage.covered).toBe(true);
    expect(coverage.via).toBe(CI_EQUIVALENT.get("test"));
  });

  it("claims no coverage when the change scope is unknown", () => {
    // Without a scope the guards cannot be evaluated, so the conservative answer is
    // "not covered", which runs the gate. Fail open, never toward a skipped gate.
    expect(deriveCiCoverage(projectRoot, "lint").covered).toBe(false);
  });

  it("reports no coverage when CI cannot be read, so the gate runs", () => {
    const coverage = deriveCiCoverage(projectRoot, "test", {
      readFile: () => {
        throw new Error("unreadable");
      },
    });
    expect(coverage.covered).toBe(false);
  });

  it("surfaces an unverifiable precondition sitting alongside a satisfied scope flag", () => {
    // The `Unit coverage` job guard is
    // `coverage_changed == 'true' && github.event.pull_request.draft != true`.
    // Reporting `assumed` per whole guard would drop the draft half, so the one condition
    // the worktree genuinely cannot evaluate never reaches the operator.
    const coverage = deriveCiCoverage(projectRoot, "test", { scope: { coverage_changed: true } });
    expect(coverage.covered).toBe(true);
    expect(coverage.assumed.join("; ")).toMatch(/draft/);
    // A guard made only of satisfied scope flags assumes nothing.
    expect(deriveCiCoverage(projectRoot, "lint", { scope: { static_heavy_changed: true } }).assumed).toEqual([]);
  });
});

describe("ci coverage — evaluates step and job guards", () => {
  it.each([
    ["npm run test:coverage -- --merge-reports=.vitest-ci --reporter=default", true],
    ["npm run test:coverage -- --shard=1/2", false],
    ["npm run test:coverage -- --testNamePattern=one", false],
    ["echo npm run test:coverage", false],
    ["npm run test:coverage -- --merge-reports=.vitest-ci || true", false],
  ])("recognises complete report merging without treating subsets as full coverage: %s", (command, covered) => {
    const ci = `jobs:\n  coverage:\n    steps:\n      - run: ${command}\n`;
    const readFile = ((file: string) =>
      String(file).endsWith("package.json") ? JSON.stringify({ scripts: {} }) : ci) as never;
    expect(deriveCiCoverage(projectRoot, "test", { scope: {}, readFile }).covered).toBe(covered);
  });

  // `lint` and `typecheck` are step-conditional on static_heavy_changed, `test:coverage`
  // is job-conditional on coverage_changed. A docs-only change satisfies neither, so CI
  // skips all three — and a name-only scan would wrongly call them covered.
  const docsOnly = {
    docs_only: true,
    docs_changed: true,
    static_heavy_changed: false,
    coverage_changed: false,
    source_changed: false,
  };
  const sourceScope = { source_changed: true, static_heavy_changed: true, coverage_changed: true };

  it.each(["lint", "typecheck", "test"])("reports %s uncovered for docs-only scope", (gate) => {
    const coverage = deriveCiCoverage(projectRoot, gate, { scope: docsOnly });
    expect(coverage.covered).toBe(false);
    expect(coverage.reason).toMatch(/only when|no CI step/);
  });

  it.each(["lint", "typecheck", "test"])("reports %s covered for source scope", (gate) => {
    expect(deriveCiCoverage(projectRoot, gate, { scope: sourceScope }).covered).toBe(true);
  });

  it("extracts the change-scope flags a guard depends on", () => {
    expect(scopeFlagsInGuard("needs.changes.outputs.coverage_changed == 'true' && x")).toEqual(["coverage_changed"]);
    expect(scopeFlagsInGuard("github.event_name == 'push'")).toEqual([]);
  });

  it("treats an unreadable CI definition as no coverage", () => {
    const coverage = deriveCiCoverage(projectRoot, "test", {
      scope: sourceScope,
      readFile: () => {
        throw new Error("unreadable");
      },
    });
    expect(coverage.covered).toBe(false);
  });

  it("finds a gate invoked inside a multi-line run block, as CI runs the e2e shards", () => {
    const ci = [
      "jobs:",
      "  e2e:",
      "    if: needs.changes.outputs.ui_changed == 'true'",
      "    steps:",
      "      - name: Chromium production journeys",
      "        run: |",
      '          if [ "$EVENT" = "pull_request" ]; then',
      "            npm run test:e2e:pr:shard -- --shard 1 --exclude-critical",
      "          fi",
      "      - name: Unrelated",
      "        run: |",
      "          # npm run test:e2e:pr is only mentioned here",
      "          echo done",
    ].join("\n");
    const readFile = ((file: string) =>
      String(file).endsWith("package.json") ? JSON.stringify({ scripts: {} }) : ci) as never;
    const at = (gate: string, ui: boolean) =>
      deriveCiCoverage(projectRoot, gate, { scope: { ui_changed: ui }, readFile }).covered;
    expect(at("test:e2e:pr:shard", true)).toBe(true);
    expect(at("test:e2e:pr:shard", false)).toBe(false);
    expect(at("test:e2e:pr", true)).toBe(false);
  });
});
