import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_TOLERANCE,
  baselineFromRows,
  compareToLighthouseBudget,
  expectedBudgetRuns,
  gradeRun,
  incompleteBudgetEvidence,
  renderBudgetTable,
} from "../scripts/check-lighthouse-budget.mjs";

/** Kept in step with lighthouse-budget.json. */
const ROUTES = ["/", "/therapy-compass", "/documents/search", "/dsm", "/forms"];

const budget = (overrides: Record<string, unknown> = {}) => ({
  enforce: true,
  routes: ROUTES,
  strategies: ["mobile", "desktop"],
  baseline: null,
  ...overrides,
});

function row(run: string, metrics: { lcpMs?: number | null; cls?: number | null; tbtMs?: number | null } = {}) {
  const url = `http://localhost:4461/${run}`;
  return {
    run,
    url,
    requestedUrl: url,
    runtimeError: null,
    performanceScore: 0.99,
    lcpMs: metrics.lcpMs ?? 1000,
    cls: metrics.cls ?? 0,
    tbtMs: metrics.tbtMs ?? 100,
    fcpMs: 500,
    chromeVersion: "HeadlessChrome/140",
  };
}

/** The shape `summariseReport` yields, as this suite fabricates it. The graded
    helpers come from an untyped `.mjs`, so callbacks over their results need an
    explicit annotation to stay under `noImplicitAny`. */
type Row = ReturnType<typeof row>;

/** A complete set of reports for the configured matrix. */
function completeRows(metrics: Record<string, { lcpMs?: number; cls?: number; tbtMs?: number }> = {}) {
  return expectedBudgetRuns(budget()).map((run: string) => row(run, metrics[run] ?? {}));
}

describe("expectedBudgetRuns", () => {
  it("expands routes across every configured strategy", () => {
    expect(expectedBudgetRuns(budget())).toEqual([
      "mobile-root",
      "mobile-therapy-compass",
      "mobile-documents-search",
      "mobile-dsm",
      "mobile-forms",
      "desktop-root",
      "desktop-therapy-compass",
      "desktop-documents-search",
      "desktop-dsm",
      "desktop-forms",
    ]);
  });

  it("returns nothing when no routes are configured", () => {
    expect(expectedBudgetRuns(budget({ routes: [] }))).toEqual([]);
  });
});

describe("incompleteBudgetEvidence", () => {
  it("passes a complete matrix", () => {
    expect(incompleteBudgetEvidence(completeRows(), budget())).toEqual([]);
  });

  it("reports a requested run that produced no report", () => {
    const rows = completeRows().filter((entry: Row) => entry.run !== "mobile-dsm");

    expect(incompleteBudgetEvidence(rows, budget())).toEqual(["mobile-dsm: no Lighthouse report produced"]);
  });

  it("reports a run whose report carries no usable metrics", () => {
    const rows = completeRows().map((entry: Row) =>
      entry.run === "desktop-forms" ? { ...entry, lcpMs: null } : entry,
    );

    expect(incompleteBudgetEvidence(rows, budget())).toEqual(["desktop-forms: report has no LCP or CLS number"]);
  });

  it("reports a run that measured a different page than requested", () => {
    // A route that redirects to /login yields clean numbers for the wrong page.
    const rows = completeRows().map((entry: Row) =>
      entry.run === "mobile-dsm" ? { ...entry, url: "http://localhost:4461/login" } : entry,
    );

    expect(incompleteBudgetEvidence(rows, budget())).toEqual([
      "mobile-dsm: report measured a different page than requested",
    ]);
  });
});

describe("incompleteBudgetEvidence — completeness derived from what is graded", () => {
  it("rejects a report missing a graded metric even when LCP and CLS are present", () => {
    // hasUsableMetrics only checks the LCP/CLS pair ledger #017 grades. This budget
    // also grades TBT, so a report without it must not pass completeness and then
    // have TBT silently skipped.
    const rows = completeRows().map((entry: Row) => (entry.run === "mobile-dsm" ? { ...entry, tbtMs: null } : entry));

    expect(incompleteBudgetEvidence(rows, budget())).toEqual(["mobile-dsm: report has no tbtMs number"]);
  });

  it("rejects a run the recorded baseline does not cover", () => {
    // A route added after the baseline was recorded has nothing to compare against,
    // and gradeRun returns no breaches for a missing row — so it would grade ok at
    // any LCP.
    const rows = completeRows();
    const partial = baselineFromRows(rows.filter((entry: Row) => entry.run !== "mobile-forms"));

    expect(incompleteBudgetEvidence(rows, budget({ baseline: partial }))).toEqual([
      "mobile-forms: no baseline row recorded — refresh with --update",
    ]);
  });

  it("fails an enforcing budget whose baseline predates a new route", () => {
    const rows = completeRows({ "mobile-forms": { lcpMs: 99_000 } });
    const partial = baselineFromRows(completeRows().filter((entry: Row) => entry.run !== "mobile-forms"));
    const result = compareToLighthouseBudget(rows, budget({ baseline: partial }));

    expect(result.status).toBe("fail");
    expect(result.reason).toBe("evidence incomplete");
  });

  it("rejects a baseline measured by a different browser", () => {
    const rows = completeRows();
    const stale = baselineFromRows(rows.map((entry: Row) => ({ ...entry, chromeVersion: "HeadlessChrome/131" })));
    const problems = incompleteBudgetEvidence(rows, budget({ baseline: stale }));

    expect(problems).toHaveLength(10);
    expect(problems[0]).toContain("measured by a different browser");
  });

  it("accepts a baseline that recorded no browser identity at all", () => {
    // Older baselines predate the field; absent is not the same as mismatched.
    const rows = completeRows();
    const legacy = Object.fromEntries(
      Object.entries(baselineFromRows(rows)).map(([run, row]) => [run, { ...(row as object), chromeVersion: null }]),
    );

    expect(incompleteBudgetEvidence(rows, budget({ baseline: legacy }))).toEqual([]);
  });

  it("rejects colliding route slugs before anything is measured", () => {
    // `/a/b` and `/a-b` both write `a-b.json`, so the second overwrites the first and
    // the survivor would satisfy the expected-run check for both pages.
    const colliding = budget({ routes: ["/a/b", "/a-b"], baseline: null });

    expect(incompleteBudgetEvidence([], colliding)).toContain("route slug collision: a-b");
  });
});

describe("gradeRun", () => {
  it("records no breach without a baseline for that run", () => {
    expect(gradeRun(row("mobile-root", { lcpMs: 9000 }), undefined)).toEqual([]);
  });

  it("ignores an improvement", () => {
    expect(gradeRun(row("mobile-root", { lcpMs: 800 }), { lcpMs: 1000, cls: 0, tbtMs: 100 })).toEqual([]);
  });

  it("ignores percentage noise on a small absolute number", () => {
    // 12ms -> 16ms is +33% but only +4ms; flagging it would make the gate useless.
    expect(gradeRun(row("mobile-root", { tbtMs: 16 }), { lcpMs: 1000, cls: 0, tbtMs: 12 })).toEqual([]);
  });

  it("ignores a large absolute rise that stays within the percentage tolerance", () => {
    // +100ms on a 5s LCP is +2%: real but well inside the noise band.
    expect(gradeRun(row("mobile-root", { lcpMs: 5100 }), { lcpMs: 5000, cls: 0, tbtMs: 100 })).toEqual([]);
  });

  it("flags a rise that clears both the percentage and absolute floors", () => {
    const breaches = gradeRun(row("mobile-root", { lcpMs: 1400 }), { lcpMs: 1000, cls: 0, tbtMs: 100 });

    expect(breaches).toHaveLength(1);
    expect(breaches[0].metric).toBe("lcpMs");
    expect(breaches[0].delta).toBe(400);
  });

  it("grades CLS on absolute movement because percentage growth from zero is undefined", () => {
    expect(gradeRun(row("mobile-root", { cls: 0.01 }), { lcpMs: 1000, cls: 0, tbtMs: 100 })).toEqual([]);

    const breaches = gradeRun(row("mobile-root", { cls: 0.05 }), { lcpMs: 1000, cls: 0, tbtMs: 100 });

    expect(breaches).toHaveLength(1);
    expect(breaches[0].metric).toBe("cls");
  });

  it("skips a metric the baseline never recorded", () => {
    expect(gradeRun(row("mobile-root", { tbtMs: 5000 }), { lcpMs: 1000, cls: 0 })).toEqual([]);
  });

  it("honours a caller-supplied tolerance", () => {
    // Spread the defaults so this overrides one metric rather than dropping the others.
    const strict = { ...DEFAULT_TOLERANCE, lcpMs: { pct: 1, minAbsolute: 1 } };

    expect(gradeRun(row("mobile-root", { lcpMs: 1100 }), { lcpMs: 1000 }, strict)).toHaveLength(1);
  });
});

describe("compareToLighthouseBudget", () => {
  const baseline = baselineFromRows(completeRows());

  it("warns rather than failing when no baseline is recorded yet", () => {
    const result = compareToLighthouseBudget(completeRows(), budget({ baseline: null }));

    expect(result.status).toBe("warn");
    expect(result.reason).toContain("no baseline");
  });

  it("passes an unchanged run against its baseline", () => {
    const result = compareToLighthouseBudget(completeRows(), budget({ baseline }));

    expect(result.status).toBe("ok");
    expect(result.breaches).toEqual([]);
  });

  it("fails an enforcing budget when a metric regresses", () => {
    const rows = completeRows({ "mobile-dsm": { lcpMs: 4000 } });
    const result = compareToLighthouseBudget(rows, budget({ baseline }));

    expect(result.status).toBe("fail");
    expect(result.breaches.map((breach: { run: string }) => breach.run)).toEqual(["mobile-dsm"]);
  });

  it("only warns about the same regression when enforce is false", () => {
    const rows = completeRows({ "mobile-dsm": { lcpMs: 4000 } });
    const result = compareToLighthouseBudget(rows, budget({ baseline, enforce: false }));

    expect(result.status).toBe("warn");
    expect(result.breaches).toHaveLength(1);
  });

  it("fails on incomplete evidence even when not enforcing", () => {
    // An ungraded route counted as a pass is the failure mode this repo has
    // already acted on; `enforce: false` must not downgrade it.
    const rows = completeRows().filter((entry: Row) => entry.run !== "mobile-forms");
    const result = compareToLighthouseBudget(rows, budget({ baseline, enforce: false }));

    expect(result.status).toBe("fail");
    expect(result.incomplete).toEqual(["mobile-forms: no Lighthouse report produced"]);
  });

  it("fails on incomplete evidence before it reports a missing baseline", () => {
    const rows = completeRows().filter((entry: Row) => entry.run !== "mobile-forms");
    const result = compareToLighthouseBudget(rows, budget({ baseline: null }));

    expect(result.status).toBe("fail");
    expect(result.reason).toBe("evidence incomplete");
  });

  it("treats an empty baseline object like no baseline", () => {
    const result = compareToLighthouseBudget(completeRows(), budget({ baseline: {} }));

    expect(result.status).toBe("warn");
  });

  it("exposes the default tolerance when the budget supplies none", () => {
    const result = compareToLighthouseBudget(completeRows(), budget({ baseline }));

    expect(result.tolerance).toMatchObject(DEFAULT_TOLERANCE);
  });
});

describe("baselineFromRows", () => {
  it("records the graded metrics per run, sorted for a stable diff", () => {
    const baseline = baselineFromRows([row("mobile-root", { lcpMs: 1200 }), row("desktop-root", { lcpMs: 900 })]);

    expect(Object.keys(baseline)).toEqual(["desktop-root", "mobile-root"]);
    expect(baseline["mobile-root"]).toEqual({
      lcpMs: 1200,
      cls: 0,
      tbtMs: 100,
      fcpMs: 500,
      // Stored so a later comparison can tell a browser bump from a regression.
      chromeVersion: "HeadlessChrome/140",
    });
  });
});

describe("committed lighthouse-budget.json", () => {
  const committed = JSON.parse(readFileSync(path.join(process.cwd(), "lighthouse-budget.json"), "utf8")) as {
    routes: string[];
    strategies: string[];
    lighthouseVersion: string;
    enforce: boolean;
  };

  it("measures the routes this suite grades", () => {
    expect(committed.routes).toEqual(ROUTES);
  });

  it("pins the same Lighthouse version as the live-domain workflow", () => {
    // Two entry points drive Lighthouse (this pre-merge budget and the dispatch-only
    // live baseline). A version skew between them makes their numbers incomparable,
    // which is the whole reason the live workflow pins exactly rather than `@12`.
    const workflow = readFileSync(path.join(process.cwd(), ".github", "workflows", "live-web-vitals.yml"), "utf8");
    const pinned = /LIGHTHOUSE_VERSION:\s*"([^"]+)"/.exec(workflow)?.[1];

    expect(pinned, "LIGHTHOUSE_VERSION not found in live-web-vitals.yml").toBeTruthy();
    expect(committed.lighthouseVersion).toBe(pinned);
  });

  it("names a strategy set the grader understands", () => {
    expect(committed.strategies).toEqual(["mobile", "desktop"]);
  });
});

describe("renderBudgetTable", () => {
  it("subordinates every measurement when the evidence is incomplete", () => {
    const rows = completeRows().filter((entry: Row) => entry.run !== "mobile-forms");
    const result = compareToLighthouseBudget(rows, budget({ baseline: baselineFromRows(completeRows()) }));

    expect(renderBudgetTable(rows, result)).toContain("Evidence incomplete");
  });

  it("says a warned regression was reported only", () => {
    const rows = completeRows({ "mobile-dsm": { lcpMs: 4000 } });
    const result = compareToLighthouseBudget(
      rows,
      budget({ baseline: baselineFromRows(completeRows()), enforce: false }),
    );

    expect(renderBudgetTable(rows, result)).toContain("enforce` is false");
  });

  it("states the pass explicitly when every route is within tolerance", () => {
    const rows = completeRows();
    const result = compareToLighthouseBudget(rows, budget({ baseline: baselineFromRows(rows) }));

    expect(renderBudgetTable(rows, result)).toContain("within tolerance of the committed baseline");
  });
});
