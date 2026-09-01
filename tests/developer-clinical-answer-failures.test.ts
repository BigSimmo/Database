import { afterEach, describe, expect, it, vi } from "vitest";

import type { LedgerOpenItem, LedgerSnapshot } from "@/lib/developer-area/ledger-snapshot";

// The panel this feeds is clinical-facing, so both directions of its matching
// are load-bearing. Listing a question nothing reported puts a false clinical
// failure on screen; missing one that was reported hides a real answer defect.
// The nesting case below is not hypothetical: `discharge-documentation` and
// `patient-safety-plan` are both real eval case ids AND substrings of other real
// ones, and a plain `includes` reported both as failing on the committed ledger.

afterEach(() => {
  vi.resetModules();
});

function item(overrides: Partial<LedgerOpenItem> = {}): LedgerOpenItem {
  return {
    id: "#AAA111",
    priority: "P2",
    type: "issue",
    summary: "",
    detail: "",
    source: "",
    added: "2026-08-01",
    ...overrides,
  };
}

function snapshotOf(open: LedgerOpenItem[]): LedgerSnapshot {
  return {
    version: "outstanding-issues-snapshot-v1",
    ledger_revision: null,
    counts: { open: open.length, p1: 0, p2: 0, p3: 0, queued: 0, pending: 0, resolved: 0 },
    queue: [],
    open,
    pending: [],
  };
}

async function loadWithCases(cases: { id: string; question: string }[]) {
  vi.doMock("@/lib/rag/rag-eval-cases", () => ({
    ragEvalCases: cases,
    answerQualityEvalCases: [],
  }));
  return import("../src/lib/developer-area/clinical-answer-failures");
}

describe("resolveClinicalAnswerFailures", () => {
  it("lists an open item that names a clinical eval case, with the question a reader can understand", async () => {
    const { resolveClinicalAnswerFailures } = await loadWithCases([
      { id: "quality-antipsychotic-metabolic-monitoring", question: "What metabolic monitoring is required?" },
    ]);

    const failures = resolveClinicalAnswerFailures(
      snapshotOf([
        item({
          summary: "Metabolic monitoring returns a stub",
          source: "canary run 1; quality-antipsychotic-metabolic-monitoring",
        }),
      ]),
    );

    expect(failures).toHaveLength(1);
    expect(failures[0].cases).toEqual([
      { id: "quality-antipsychotic-metabolic-monitoring", question: "What metabolic monitoring is required?" },
    ]);
  });

  it("does not report a case whose id is only a fragment of the id actually named", async () => {
    const { resolveClinicalAnswerFailures } = await loadWithCases([
      { id: "discharge-documentation", question: "Short case that must not be implicated" },
      { id: "quality-discharge-documentation", question: "The case that was actually named" },
    ]);

    const failures = resolveClinicalAnswerFailures(
      snapshotOf([item({ source: "fails targeting: quality-discharge-documentation" })]),
    );

    expect(failures[0].cases.map((testCase) => testCase.id)).toEqual(["quality-discharge-documentation"]);
  });

  it("still reports the short case when the text names it in its own right", async () => {
    // The other half of the same contract. A boundary rule that never matched
    // the shorter id would trade a false positive for a false negative, which on
    // this panel is the worse of the two.
    const { resolveClinicalAnswerFailures } = await loadWithCases([
      { id: "discharge-documentation", question: "Short case" },
      { id: "quality-discharge-documentation", question: "Long case" },
    ]);

    const failures = resolveClinicalAnswerFailures(
      snapshotOf([item({ source: "both named: discharge-documentation and quality-discharge-documentation" })]),
    );

    expect(failures[0].cases.map((testCase) => testCase.id).sort()).toEqual([
      "discharge-documentation",
      "quality-discharge-documentation",
    ]);
  });

  it("searches the summary, the detail and the source, because items record the case id in any of them", async () => {
    const { resolveClinicalAnswerFailures } = await loadWithCases([{ id: "quality-duress-pathway", question: "Q" }]);

    for (const field of ["summary", "detail", "source"] as const) {
      const failures = resolveClinicalAnswerFailures(snapshotOf([item({ [field]: "affects quality-duress-pathway" })]));
      expect(failures, `case id in ${field} was not found`).toHaveLength(1);
    }
  });

  it("ignores an open item that names no case at all", async () => {
    const { resolveClinicalAnswerFailures } = await loadWithCases([{ id: "quality-duress-pathway", question: "Q" }]);

    expect(resolveClinicalAnswerFailures(snapshotOf([item({ summary: "Bundle budget baseline is stale" })]))).toEqual(
      [],
    );
  });

  it("orders blocking items above the rest rather than leaving ledger order to chance", async () => {
    const { resolveClinicalAnswerFailures } = await loadWithCases([{ id: "quality-duress-pathway", question: "Q" }]);

    const failures = resolveClinicalAnswerFailures(
      snapshotOf([
        item({ id: "#P3ONLY", priority: "P3", source: "quality-duress-pathway" }),
        item({ id: "#P1FIRST", priority: "P1", source: "quality-duress-pathway" }),
        item({ id: "#P2MID", priority: "P2", source: "quality-duress-pathway" }),
      ]),
    );

    expect(failures.map((failure) => failure.item.id)).toEqual(["#P1FIRST", "#P2MID", "#P3ONLY"]);
  });

  it("counts each referenced question once even when several items name it", async () => {
    const { resolveClinicalAnswerFailures, referencedQuestionCount } = await loadWithCases([
      { id: "quality-duress-pathway", question: "Q1" },
      { id: "quality-agitation-im-route", question: "Q2" },
    ]);

    const failures = resolveClinicalAnswerFailures(
      snapshotOf([
        item({ id: "#ONE", source: "quality-duress-pathway quality-agitation-im-route" }),
        item({ id: "#TWO", source: "quality-duress-pathway" }),
      ]),
    );

    expect(failures).toHaveLength(2);
    expect(referencedQuestionCount(failures)).toBe(2);
  });

  /**
   * The shape review of PR #2498 caught, reproduced from the real `#J8SJQ9`
   * detail: an item about one case names a second only as the *contrast* that
   * legitimately answers with a source pointer.
   *
   * The assertion is that BOTH come back, and that is not a bug being enshrined.
   * Nothing in the text distinguishes a contrast from a report, so the module
   * returns references and the page presents them as references. Restricting the
   * match to the `source` field was tried against the real ledger and rejected:
   * it fixes this item and hides both genuinely broken questions in `#S4R2W3`,
   * which names them only in its detail prose.
   *
   * If a later change makes this return one case, it must be because the ledger
   * gained an explicit per-case association — not because a heuristic guessed.
   */
  it("returns a contrast case as a reference, and does not pretend to know it is failing", async () => {
    const { resolveClinicalAnswerFailures } = await loadWithCases([
      { id: "quality-antipsychotic-metabolic-monitoring", question: "What metabolic monitoring is required?" },
      { id: "quality-discharge-documentation", question: "What discharge documentation is required?" },
    ]);

    const failures = resolveClinicalAnswerFailures(
      snapshotOf([
        item({
          id: "#J8SJQ9",
          summary: "Antipsychotic metabolic monitoring returns a source-backed stub instead of a written answer",
          detail:
            "All four cases carrying that flag document the same rationale: the corpus has no single authoritative " +
            "source, so a source pointer is a legitimate answer, and quality-discharge-documentation deliberately " +
            "drops mustContainAny for exactly that reason. quality-antipsychotic-metabolic-monitoring is the " +
            "opposite case - it names expectedFiles and an authoritative source exists.",
          source: "canary run 32589154243; quality-antipsychotic-metabolic-monitoring",
        }),
      ]),
    );

    expect(failures[0].cases.map((testCase) => testCase.id).sort()).toEqual([
      "quality-antipsychotic-metabolic-monitoring",
      "quality-discharge-documentation",
    ]);
  });

  /**
   * Against the real eval case list and the real committed ledger, asserted as a
   * property rather than as a fixed expectation: a hard-coded list of today's
   * three items would fail the next time the ledger legitimately changes, and
   * would be "fixed" by pasting in whatever the code then produced, which proves
   * nothing. What must always hold is that every reported case was named as a
   * whole token by the item reporting it.
   */
  it("reports only whole-token matches when run against the repository's real data", async () => {
    // `vi.resetModules()` clears the module cache but NOT the mock registry, so
    // without this `doUnmock` the "real data" below silently ran against
    // whichever `loadWithCases` fixture the previous test registered — a check
    // that could not fail. Caught by mutating the matcher to a plain `includes`
    // and watching this test stay green while the synthetic one went red.
    vi.doUnmock("@/lib/rag/rag-eval-cases");
    vi.resetModules();
    const { resolveClinicalAnswerFailures } = await import("../src/lib/developer-area/clinical-answer-failures");
    const { loadLedgerSnapshot } = await import("../src/lib/developer-area/ledger-snapshot");

    for (const { item: openItem, cases } of resolveClinicalAnswerFailures(loadLedgerSnapshot())) {
      const haystack = `${openItem.summary} ${openItem.detail} ${openItem.source}`;
      for (const testCase of cases) {
        expect(
          new RegExp(`(^|[^a-z0-9-])${testCase.id}([^a-z0-9-]|$)`).test(haystack),
          `${openItem.id} reports ${testCase.id}, which its text does not name as a whole token`,
        ).toBe(true);
        expect(testCase.question.length, `${testCase.id} has no question text to show a reader`).toBeGreaterThan(0);
      }
    }
  });
});
