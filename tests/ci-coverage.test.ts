import { describe, expect, it } from "vitest";

import { CI_EQUIVALENT, deriveCiCoverage, scopeFlagsInGuard } from "../scripts/ci-coverage.mjs";

const projectRoot = process.cwd();

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
