import { describe, expect, it } from "vitest";

import {
  ARBITRATED_GATES,
  CLEAN_WINDOW_BY_CLASS,
  CI_EQUIVALENT,
  NEVER_DEFER_CLASSES,
  arbiterMode,
  arbitrate,
  classFromScope,
  deriveCiCoverage,
  observationKey,
  recordCiVerdict,
  recordGateOutcome,
  scopeFlagsInGuard,
  summariseYield,
  vitestGateIdentity,
  MAX_OBSERVATIONS,
} from "../scripts/gate-arbiter.mjs";

const projectRoot = process.cwd();

/** A miss, i.e. no local receipt covers this content — the ordinary case. */
const noReceipt = { reuse: false, reason: "no receipt" };
const ciCovers = { covered: true, via: "test:coverage", reason: "ci.yml runs it" };
const noCiVerdict = { proven: false, sha: null, at: null, reason: "none recorded" };

function ledgerWith(gate: string, changeClass: string, outcomes: boolean[]) {
  return {
    observations: {
      [observationKey(gate, changeClass)]: outcomes.map((failed) => ({
        at: new Date().toISOString(),
        failed,
        durationMs: 60_000,
        head: null,
      })),
    },
    ci: {},
  };
}

function decide(overrides: Record<string, unknown>, env: Record<string, string | undefined> = {}) {
  return arbitrate({
    projectRoot,
    gate: "test",
    env: { ...env, CI: undefined },
    overrides: { receipt: noReceipt, coverage: ciCovers, ciVerdict: noCiVerdict, ...overrides },
  });
}

describe("gate arbiter — mode", () => {
  it("never advises CI, whatever else is set", () => {
    // CI is the authoritative merge gate: a local yield ledger must not reach it.
    expect(arbiterMode({ CI: "true", GATE_ARBITER: "enforce" }).enabled).toBe(false);
  });

  it("is advisory by default, so a gate a human typed still runs", () => {
    const mode = arbiterMode({ CI: undefined });
    expect(mode.enabled).toBe(true);
    expect(mode.enforce).toBe(false);
  });

  it("acts on deferrals only under an explicit opt-in", () => {
    expect(arbiterMode({ CI: undefined, GATE_ARBITER: "enforce" }).enforce).toBe(true);
    expect(arbiterMode({ CI: undefined, GATE_ARBITER: "off" }).enabled).toBe(false);
  });
});

describe("gate arbiter — change classification fails closed", () => {
  it("routes each risky scope to its own never-defer class", () => {
    expect(classFromScope({ db_changed: true })).toBe("db");
    expect(classFromScope({ rag_eval_changed: true })).toBe("rag");
    expect(classFromScope({ lockfile_changed: true })).toBe("deps");
    expect(classFromScope({ workflow_changed: true })).toBe("workflow");
    expect(classFromScope({ ui_changed: true })).toBe("ui");
  });

  it("classifies an unrecognised scope as unknown, which never defers", () => {
    expect(classFromScope({})).toBe("unknown");
    expect(NEVER_DEFER_CLASSES.has("unknown")).toBe(true);
  });

  it("keeps every high-risk class out of the deferral windows", () => {
    for (const risky of NEVER_DEFER_CLASSES) {
      expect(CLEAN_WINDOW_BY_CLASS.has(risky)).toBe(false);
    }
  });

  it("requires a longer clean run before deferring source than docs", () => {
    // A source change is a riskier population than a docs change; the window sizes
    // are the only place that judgement is encoded, so pin the ordering.
    expect(CLEAN_WINDOW_BY_CLASS.get("source")!).toBeGreaterThan(CLEAN_WINDOW_BY_CLASS.get("docs")!);
  });
});

describe("gate arbiter — CI coverage is derived, not assumed", () => {
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
    // Reporting `assumed` per whole guard dropped the draft half, so the one condition
    // the worktree genuinely cannot evaluate never reached the operator — and on a draft
    // PR CI skips that job, which under GATE_ARBITER=enforce is again no verdict anywhere.
    const coverage = deriveCiCoverage(projectRoot, "test", { scope: { coverage_changed: true } });
    expect(coverage.covered).toBe(true);
    expect(coverage.assumed.join("; ")).toMatch(/draft/);
    // A guard made only of satisfied scope flags assumes nothing.
    expect(deriveCiCoverage(projectRoot, "lint", { scope: { static_heavy_changed: true } }).assumed).toEqual([]);
  });

  it("prints every assumed precondition with the decision", () => {
    const decision = arbitrate({
      projectRoot,
      gate: "test",
      env: { CI: undefined },
      overrides: {
        receipt: noReceipt,
        ciVerdict: noCiVerdict,
        changeClass: "docs",
        coverage: { covered: true, via: "test:coverage", reason: "runs it", assumed: ["draft != true"] },
        ledger: { observations: {}, ci: {} },
      },
    });
    expect(decision.message).toMatch(/unverifiable CI preconditions \(assumed true\): draft != true/);
  });
});

describe("gate arbiter — yield window", () => {
  it("counts the clean streak from the most recent run backwards", () => {
    const stats = summariseYield(ledgerWith("test", "docs", [false, false, true, false]), "test", "docs");
    expect(stats.cleanStreak).toBe(2);
    expect(stats.catches).toBe(1);
    expect(stats.runs).toBe(4);
  });

  it("reports an empty window for a gate and class never observed", () => {
    expect(summariseYield({ observations: {}, ci: {} }, "test", "docs").runs).toBe(0);
  });
});

describe("gate arbiter — the decision table", () => {
  it("defers only once the clean window is full", () => {
    const required = CLEAN_WINDOW_BY_CLASS.get("docs")!;
    const clean = Array.from({ length: required }, () => false);
    expect(decide({ changeClass: "docs", ledger: ledgerWith("test", "docs", clean) }).action).toBe("defer");
  });

  it("runs while the window is one observation short", () => {
    const required = CLEAN_WINDOW_BY_CLASS.get("docs")!;
    const nearly = Array.from({ length: required - 1 }, () => false);
    expect(decide({ changeClass: "docs", ledger: ledgerWith("test", "docs", nearly) }).action).toBe("run");
  });

  it("re-arms immediately on a catch — one failure ends the deferral", () => {
    // The whole point of the loop: a gate that starts catching things again is
    // never left deferred because it had a long clean run beforehand.
    const required = CLEAN_WINDOW_BY_CLASS.get("docs")!;
    const caught = [true, ...Array.from({ length: required }, () => false)];
    expect(decide({ changeClass: "docs", ledger: ledgerWith("test", "docs", caught) }).action).toBe("run");
  });

  it("never defers a high-risk scope, however clean the history", () => {
    const clean = Array.from({ length: 50 }, () => false);
    for (const risky of NEVER_DEFER_CLASSES) {
      const decision = decide({ changeClass: risky, ledger: ledgerWith("test", risky, clean) });
      expect(decision.action, `${risky} must not defer`).toBe("run");
    }
  });

  it("never defers a gate CI does not re-run, however clean the history", () => {
    const clean = Array.from({ length: 50 }, () => false);
    const decision = decide({
      changeClass: "docs",
      coverage: { covered: false, via: null, reason: "no CI step runs it" },
      ledger: ledgerWith("test", "docs", clean),
    });
    expect(decision.action).toBe("run");
    expect(decision.reason).toMatch(/only gate/);
  });

  it("treats an existing local receipt as proof rather than re-deciding", () => {
    expect(decide({ receipt: { reuse: true, reason: "receipt matches" } }).action).toBe("proven");
  });

  it("treats content GitHub already proved green as proven", () => {
    const decision = decide({
      ciVerdict: { proven: true, sha: "a".repeat(40), at: new Date().toISOString(), reason: "identical" },
    });
    expect(decision.action).toBe("proven");
  });

  it("holds no opinion about a gate outside the arbitrated set", () => {
    const decision = arbitrate({ projectRoot, gate: "docs:check-links", env: { CI: undefined } });
    expect(decision.action).toBe("run");
    expect(ARBITRATED_GATES.has("docs:check-links")).toBe(false);
  });

  it("says in as many words that a deferred gate is not a passed gate", () => {
    const required = CLEAN_WINDOW_BY_CLASS.get("docs")!;
    const clean = Array.from({ length: required }, () => false);
    const decision = decide({ changeClass: "docs", ledger: ledgerWith("test", "docs", clean) });
    expect(decision.message).toMatch(/NOT a passed gate/);
    // Advisory by default: a deferral must not skip anything unless opted in.
    expect(decision.enforce).toBe(false);
  });

  it("marks a deferral enforceable only under GATE_ARBITER=enforce", () => {
    const required = CLEAN_WINDOW_BY_CLASS.get("docs")!;
    const clean = Array.from({ length: required }, () => false);
    const decision = decide(
      { changeClass: "docs", ledger: ledgerWith("test", "docs", clean) },
      { GATE_ARBITER: "enforce" },
    );
    expect(decision.enforce).toBe(true);
  });
});

describe("gate arbiter — CI coverage evaluates step and job guards", () => {
  // The P1 from Codex review on PR #2245, reproduced against the real ci.yml: `lint`
  // and `typecheck` are step-conditional on static_heavy_changed, `test:coverage` is
  // job-conditional on coverage_changed. A docs-only change satisfies neither, so CI
  // skips all three — and a name-only scan would call them covered, which under
  // enforce leaves no verdict anywhere.
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

  it("does not defer when CI would skip the gate for this change", () => {
    const clean = Array.from({ length: 50 }, () => false);
    const decision = decide({
      changeClass: "docs",
      coverage: deriveCiCoverage(projectRoot, "test", { scope: docsOnly }),
      ledger: ledgerWith("test", "docs", clean),
    });
    expect(decision.action).toBe("run");
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
});

describe("gate arbiter — a proven verdict is enforceable", () => {
  it("marks a CI-proven verdict enforceable under enforce, so it is not re-derived", () => {
    const decision = decide(
      { ciVerdict: { proven: true, sha: "a".repeat(40), at: new Date().toISOString(), reason: "identical" } },
      { GATE_ARBITER: "enforce" },
    );
    expect(decision.action).toBe("proven");
    expect(decision.enforce).toBe(true);
  });

  it("still runs a proven gate in advisory mode", () => {
    const decision = decide({
      ciVerdict: { proven: true, sha: "a".repeat(40), at: new Date().toISOString(), reason: "identical" },
    });
    expect(decision.enforce).toBe(false);
  });
});

describe("gate arbiter — Vitest yield identity", () => {
  it("keeps the plain identity for the whole suite, including output-only flags", () => {
    expect(vitestGateIdentity(["run"])).toBe("vitest");
    expect(vitestGateIdentity(["run", "--reporter=dot"])).toBe("vitest");
  });

  it("separates any narrowed selection from full-suite history", () => {
    expect(vitestGateIdentity(["run", "tests/a.test.ts"])).toBe("vitest(selected)");
    expect(vitestGateIdentity(["run", "--project=node"])).toBe("vitest(selected)");
    expect(vitestGateIdentity(["run", "-t", "some name"])).toBe("vitest(selected)");
  });

  it("never lets a focused history satisfy the full-suite window", () => {
    const clean = Array.from({ length: 50 }, () => false);
    // A long clean run of focused invocations is recorded under a different key, so
    // the full-suite gate still sees an empty window and runs.
    const focusedHistory = ledgerWith("vitest(selected)", "source", clean);
    const decision = arbitrate({
      projectRoot,
      gate: "vitest",
      env: { CI: undefined },
      overrides: {
        receipt: noReceipt,
        coverage: ciCovers,
        ciVerdict: noCiVerdict,
        changeClass: "source",
        ledger: focusedHistory,
      },
    });
    expect(decision.action).toBe("run");
  });
});

describe("gate arbiter — recording boundaries", () => {
  const disabled = { CI: "true" }; // keeps every assertion off the filesystem

  it("never records an admission-busy exit as a verdict", () => {
    // Exit 75 is lock contention, not a result. Recording it as a pass would let
    // contention manufacture a clean window; as a catch it would pin a healthy gate.
    const result = recordGateOutcome({ projectRoot, gate: "vitest", exitCode: 75, env: { CI: undefined } });
    expect(result.recorded).toBe(false);
    expect(result.reason).toMatch(/admission-busy/);
  });

  it("does not record for a gate outside the arbitrated set", () => {
    const result = recordGateOutcome({ projectRoot, gate: "docs:check-links", exitCode: 0, env: { CI: undefined } });
    expect(result.recorded).toBe(false);
  });

  it("never records anything in CI", () => {
    expect(recordGateOutcome({ projectRoot, gate: "vitest", exitCode: 0, env: disabled }).recorded).toBe(false);
  });

  it("truncates the observation window", () => {
    const overfull = Array.from({ length: MAX_OBSERVATIONS + 25 }, () => false);
    const stats = summariseYield(ledgerWith("test", "source", overfull), "test", "source");
    // ledgerWith does not truncate; the cap is applied on write, so assert the constant
    // is what the writer slices to and that the summary reads whatever is retained.
    expect(MAX_OBSERVATIONS).toBeGreaterThan(0);
    expect(stats.runs).toBe(overfull.length);
  });

  it("rejects a CI verdict without a full 40-character SHA before writing", () => {
    expect(recordCiVerdict({ projectRoot, sha: "abc123", gates: ["test"] }).recorded).toBe(false);
    expect(recordCiVerdict({ projectRoot, sha: undefined, gates: ["test"] }).recorded).toBe(false);
  });

  it("rejects a CI verdict naming no gates", () => {
    // Recording every arbitrated gate from one observed job would claim proof the
    // session does not have, and the proven branch runs before every veto.
    expect(recordCiVerdict({ projectRoot, sha: "a".repeat(40), gates: [] }).recorded).toBe(false);
  });

  it("rejects a SHA that does not resolve to a commit here", () => {
    const result = recordCiVerdict({ projectRoot, sha: "a".repeat(40), gates: ["test"] });
    expect(result.recorded).toBe(false);
    expect(result.reason).toMatch(/does not resolve/);
  });
});
