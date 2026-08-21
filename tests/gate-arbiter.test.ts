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
  summariseYield,
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
  it("resolves a gate CI runs under its own name", () => {
    expect(deriveCiCoverage(projectRoot, "lint").covered).toBe(true);
  });

  it("resolves a gate CI runs under its coverage-job name", () => {
    const coverage = deriveCiCoverage(projectRoot, "test");
    expect(coverage.covered).toBe(true);
    expect(coverage.via).toBe(CI_EQUIVALENT.get("test"));
  });

  it("reports no coverage when CI cannot be read, so the gate runs", () => {
    const coverage = deriveCiCoverage(projectRoot, "test", {
      readFile: () => {
        throw new Error("unreadable");
      },
    });
    expect(coverage.covered).toBe(false);
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
