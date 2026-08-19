import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_TOLERANCE,
  baselineFromRows,
  compareToLighthouseBudget,
  expectedBudgetRuns,
  gradeRun,
  incompleteBudgetEvidence,
  majorityBreachDecision,
  numericBreachConfirmationRuns,
  readReports,
  renderBudgetTable,
  validateBaselineBrowserVersions,
} from "../scripts/check-lighthouse-budget.mjs";
import { measurementFailureReason } from "../scripts/lighthouse-measurement-outcome.mjs";
import { deadlineAfter, processTimeoutMs, remainingMs } from "../scripts/lighthouse-time-budget.mjs";

/**
 * Synthetic fixture routes for the unit cases below — deliberately more than the
 * committed budget measures, so run-expansion and completeness have several rows
 * to work with. The committed list is asserted separately as COMMITTED_ROUTES.
 */
const ROUTES = ["/", "/therapy-compass", "/documents/search", "/dsm", "/forms"];

/**
 * What lighthouse-budget.json actually measures. `/therapy-compass`, `/dsm` and
 * `/forms` left the budget when home consolidation turned them into redirect
 * stubs — Lighthouse followed the 307 and graded `/?mode=<id>` against a baseline
 * captured on the retired detailed home. All three now render the same shared home
 * as `/`, so their removal costs duplication rather than coverage.
 */
const COMMITTED_ROUTES = ["/", "/documents/search"];

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

  it("rejects a baseline measured by a different browser, collapsed to one instruction", () => {
    // One browser bump reds every run in the budget. Ten near-identical sentences
    // buried the single actionable line, so drift collapses to one message when it is
    // the whole story — the VERDICT is unchanged and asserted below.
    const rows = completeRows();
    const stale = baselineFromRows(rows.map((entry: Row) => ({ ...entry, chromeVersion: "HeadlessChrome/131" })));
    const problems = incompleteBudgetEvidence(rows, budget({ baseline: stale }));

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("browser drift on 10 run(s)");
    expect(problems[0]).toContain("HeadlessChrome/131");
    expect(problems[0]).toContain("HeadlessChrome/140");
    expect(problems[0]).toContain("Refresh Lighthouse baseline");

    // The collapse is cosmetic. Incomplete evidence still fails closed, and still
    // does so independently of `enforce`.
    for (const enforce of [true, false]) {
      const result = compareToLighthouseBudget(rows, budget({ baseline: stale, enforce }));
      expect(result.status).toBe("fail");
      expect(result.reason).toBe("evidence incomplete");
    }
  });

  it("lists drift per run when the browsers themselves disagree", () => {
    // Two different baseline browsers is not one fact, so it must not read as one.
    const rows = completeRows();
    const mixed = Object.fromEntries(
      Object.entries(baselineFromRows(rows)).map(([run, entry], index) => [
        run,
        { ...(entry as object), chromeVersion: index % 2 === 0 ? "HeadlessChrome/131" : "HeadlessChrome/132" },
      ]),
    );
    const problems = incompleteBudgetEvidence(rows, budget({ baseline: mixed }));

    expect(problems).toHaveLength(10);
    expect(problems.every((problem: string) => problem.includes("measured by a different browser"))).toBe(true);
  });

  it("keeps drift per run when a measurement gap shares the verdict", () => {
    // A missing report and a browser bump are different facts with different fixes;
    // collapsing here would hide the one that --update cannot resolve.
    const rows = completeRows().filter((entry: Row) => entry.run !== "mobile-dsm");
    const stale = baselineFromRows(
      completeRows().map((entry: Row) => ({ ...entry, chromeVersion: "HeadlessChrome/131" })),
    );
    const problems = incompleteBudgetEvidence(rows, budget({ baseline: stale }));

    expect(problems).toEqual(
      expect.arrayContaining([
        "mobile-dsm: no Lighthouse report produced",
        expect.stringContaining("measured by a different browser"),
      ]),
    );
    expect(problems.length).toBeGreaterThan(1);
  });

  it("ignores browser drift and missing baseline rows when refreshing", () => {
    // `--update` must remain reachable after a runner Chrome bump; grading still
    // fails closed on the same evidence via the default ignoreBaseline:false path.
    const rows = completeRows();
    const stale = baselineFromRows(
      rows
        .filter((entry: Row) => entry.run !== "mobile-forms")
        .map((entry: Row) => ({ ...entry, chromeVersion: "HeadlessChrome/131" })),
    );

    expect(incompleteBudgetEvidence(rows, budget({ baseline: stale }), { ignoreBaseline: true })).toEqual([]);
    expect(incompleteBudgetEvidence(rows, budget({ baseline: stale }))).toEqual(
      expect.arrayContaining([
        expect.stringContaining("measured by a different browser"),
        "mobile-forms: no baseline row recorded — refresh with --update",
      ]),
    );
  });

  it("still refuses a refresh when a report is missing", () => {
    const rows = completeRows().filter((entry: Row) => entry.run !== "mobile-dsm");

    expect(incompleteBudgetEvidence(rows, budget(), { ignoreBaseline: true })).toEqual([
      "mobile-dsm: no Lighthouse report produced",
    ]);
  });

  it("accepts a baseline that recorded no browser identity at all", () => {
    // Older baselines predate the field; absent is not the same as mismatched.
    const rows = completeRows();
    const legacy = Object.fromEntries(
      Object.entries(baselineFromRows(rows)).map(([run, row]) => [run, { ...(row as object), chromeVersion: null }]),
    );

    expect(incompleteBudgetEvidence(rows, budget({ baseline: legacy }))).toEqual([]);
  });

  it("keeps drift per run when some baseline rows lack a recorded browser version", () => {
    // When older baselines contain a mix of versioned and unversioned rows,
    // drift is not uniform across all expected runs and must list per run.
    const rows = completeRows();
    const mixed = Object.fromEntries(
      Object.entries(baselineFromRows(rows)).map(([run, entry], index) => [
        run,
        { ...(entry as object), chromeVersion: index === 0 ? null : "HeadlessChrome/131" },
      ]),
    );
    const problems = incompleteBudgetEvidence(rows, budget({ baseline: mixed }));

    expect(problems).toHaveLength(9);
    expect(problems.every((problem: string) => problem.includes("measured by a different browser"))).toBe(true);
    expect(problems[0]).not.toContain("browser drift on");
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

describe("numeric breach confirmation", () => {
  const baseline = baselineFromRows(completeRows());

  it("targets only cells with a numeric breach", () => {
    const rows = completeRows({ "mobile-dsm": { lcpMs: 4000 }, "desktop-forms": { cls: 0.2 } });
    expect(numericBreachConfirmationRuns(rows, budget({ baseline }))).toEqual(["desktop-forms", "mobile-dsm"]);
  });

  it("does not turn missing evidence into a numeric retry", () => {
    const rows = completeRows().filter((entry: Row) => entry.run !== "mobile-dsm");
    expect(numericBreachConfirmationRuns(rows, budget({ baseline }))).toEqual([]);
  });

  it("requires two breached samples out of three", () => {
    expect(majorityBreachDecision([true, true, false])).toEqual({ breached: true, breachCount: 2, sampleCount: 3 });
    expect(majorityBreachDecision([true, false, false])).toEqual({
      breached: false,
      breachCount: 1,
      sampleCount: 3,
    });
  });

  it("fails closed when the three-sample set is incomplete", () => {
    expect(majorityBreachDecision([true, false])).toBeNull();
    expect(majorityBreachDecision([true, false, undefined])).toBeNull();
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
    baseline: Record<string, { chromeVersion?: unknown }>;
  };

  it("measures the routes this suite grades", () => {
    expect(committed.routes).toEqual(COMMITTED_ROUTES);
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

  it("records a complete baseline from one named browser identity", () => {
    const rows = Object.values(committed.baseline ?? {});
    const versions = rows
      .map((row) => row.chromeVersion)
      .filter((version): version is string => typeof version === "string" && version.length > 0);

    expect(rows).toHaveLength(committed.routes.length * committed.strategies.length);
    expect(versions).toHaveLength(rows.length);
    expect(new Set(versions).size).toBe(1);
    expect(versions[0]).toContain("HeadlessChrome/");
  });

  it("measures every route without a query string", () => {
    // Budget routes stay query-free so a silent `?q=` addition cannot hide new
    // client-driven API traffic. This is a signal, not a complete proof that no API
    // runs on load — `/` already fetches /api/setup-status and /api/local-project-id,
    // and those handlers are carved into perfInitialLoadApiPatterns.
    expect(committed.routes.filter((route) => route.includes("?"))).toEqual([]);
  });

  it("writes an isolated tsconfig that silences TS5101 baseUrl deprecation", () => {
    const runner = readFileSync(path.join(process.cwd(), "scripts", "run-lighthouse-budget.mjs"), "utf8");

    // Same Next 16.3 + TS 6 TS5101 trap as the Playwright runner (#1798).
    expect(runner).toContain('ignoreDeprecations: "6.0"');
    expect(runner).toContain('baseUrl: "../.."');
    expect(runner).toContain('paths: { "@/*": ["src/*"] }');
  });

  it("invokes npm's JavaScript npx CLI through Node when available", () => {
    const runner = readFileSync(path.join(process.cwd(), "scripts", "run-lighthouse-budget.mjs"), "utf8");

    expect(runner).toContain('const npxCli = path.join(path.dirname(npmExecPath), "npx-cli.js")');
    expect(runner).toContain("process.env.npm_node_execpath ?? process.execPath");
    expect(runner).toMatch(/spawn\(\s*npxInvocation\.command,/);
    expect(runner).toContain("...npxInvocation.prefixArgs");
    expect(runner).not.toMatch(/spawnSync\(\s*"npx",/);
    expect(runner).not.toMatch(/spawnSync\(\s*"npx\.cmd",/);
    expect(runner).toContain("stopOwnedProcessTree(child)");
    expect(runner).toContain('detached: process.platform !== "win32"');
  });

  it("uses two targeted confirmations and restores the initial breach when evidence is incomplete", () => {
    const runner = readFileSync(path.join(process.cwd(), "scripts", "run-lighthouse-budget.mjs"), "utf8");

    expect(runner).toContain("for (let attempt = 1; attempt <= 2; attempt += 1)");
    expect(runner).toContain("majorityBreachDecision(samples)");
    expect(runner).toMatch(/if \(unavailable \|\| !decision\) \{\s*copyFileSync\(initial, target\.output\)/);
  });

  it("bounds each Lighthouse process independently of its navigation timeout", () => {
    const runner = readFileSync(path.join(process.cwd(), "scripts", "run-lighthouse-budget.mjs"), "utf8");

    expect(runner).toContain("timeout: LIGHTHOUSE_BUILD_TIMEOUT_MS");
    expect(runner).toContain("waitForServer(baseUrl, server, LIGHTHOUSE_SERVER_READY_TIMEOUT_MS)");
    expect(runner).toContain("if (requestTimeout === 0) break");
    expect(runner).toContain("deadlineAfter(LIGHTHOUSE_MEASUREMENT_SUITE_TIMEOUT_MS)");
    expect(runner).toContain("LIGHTHOUSE_PROCESS_TIMEOUT_MS");
    expect(runner).toContain("--max-wait-for-load=60000");
    expect(runner).not.toMatch(/stdio:\s*"inherit",\s*\n\s*timeout,/);
  });
});

describe("Lighthouse time budget", () => {
  it("uses a real deadline for server readiness and each process", () => {
    const deadline = deadlineAfter(120_000, 1_000);

    expect(deadline).toBe(121_000);
    expect(remainingMs(deadline, 61_000)).toBe(60_000);
    expect(processTimeoutMs(deadline, 120_000, 61_000)).toBe(60_000);
    expect(processTimeoutMs(deadline, 120_000, deadline)).toBe(0);
  });
});

describe("measurementFailureReason", () => {
  const report = (extra: Record<string, unknown> = {}) =>
    JSON.stringify({ requestedUrl: "http://localhost:4461/forms", audits: {}, ...extra });

  it("passes a clean run through", () => {
    expect(measurementFailureReason(0, report())).toBeNull();
  });

  it("flags a non-zero exit that wrote no report", () => {
    expect(measurementFailureReason(1, null)).toContain("exited 1");
  });

  it("grades a parseable report even when post-measurement cleanup exits non-zero", () => {
    expect(measurementFailureReason(1, report())).toBeNull();
  });

  it("flags a run that was killed without a status", () => {
    expect(measurementFailureReason(null, null)).toContain("without a status");
  });

  it("flags a clean exit that wrote no report", () => {
    expect(measurementFailureReason(0, null)).toBe("no report file was written");
    expect(measurementFailureReason(0, "")).toBe("no report file was written");
  });

  it("flags an unparseable report", () => {
    expect(measurementFailureReason(0, "{not json")).toBe("report is not valid JSON");
  });

  it("flags the NO_NAVSTART shape that exits zero with a well-formed report", () => {
    // Ledger #147: `/forms` did this locally while the live dispatch measured it
    // fine. An exit-code check alone leaves it unretried, because Lighthouse both
    // exits 0 and writes a valid file whose only content is the runtime error.
    expect(measurementFailureReason(0, report({ runtimeError: { code: "NO_NAVSTART" } }))).toBe(
      "lighthouse runtimeError NO_NAVSTART",
    );
  });

  it("never retries a real measurement that produced bad numbers", () => {
    // The line that keeps this a retry and not a re-roll: a page that loaded and
    // scored badly is evidence, and re-running it until it goes green is the failure
    // mode this whole gate exists to prevent.
    const slow = report({ audits: { "largest-contentful-paint": { numericValue: 9999 } } });

    expect(measurementFailureReason(0, slow)).toBeNull();
  });
});

describe("readReports", () => {
  it("ignores the retry sidecar rather than reading it as a report", () => {
    // retries.txt is deliberately not .json: readReports globs *.json and skips only
    // summary.json, so a JSON sidecar would be parsed as a Lighthouse report and
    // become a phantom row named `retries` — a run the budget never asked for,
    // carrying no metrics.
    const directory = mkdtempSync(path.join(tmpdir(), "lighthouse-reports-"));
    try {
      writeFileSync(
        path.join(directory, "mobile-root.json"),
        JSON.stringify({ requestedUrl: "http://localhost:4461/", finalUrl: "http://localhost:4461/", audits: {} }),
      );
      writeFileSync(path.join(directory, "retries.txt"), "mobile /forms (lighthouse runtimeError NO_NAVSTART)\n");

      expect(readReports(directory).map((entry: { run: string }) => entry.run)).toEqual(["mobile-root"]);
    } finally {
      rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
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

describe("validateBaselineBrowserVersions", () => {
  it("accepts a baseline with exactly one browser version across all rows", () => {
    const baseline = baselineFromRows(completeRows());
    const result = validateBaselineBrowserVersions(baseline);

    expect(result.ok).toBe(true);
    expect(result.versions).toEqual(["HeadlessChrome/140"]);
    expect(result.error).toBeNull();
  });

  it("rejects an empty baseline", () => {
    const result = validateBaselineBrowserVersions({});

    expect(result.ok).toBe(false);
    expect(result.error).toContain("no baseline rows recorded");
  });

  it("rejects a baseline with mixed browser versions", () => {
    const rows = completeRows();
    const mixed = Object.fromEntries(
      Object.entries(baselineFromRows(rows)).map(([run, entry], index) => [
        run,
        { ...(entry as object), chromeVersion: index % 2 === 0 ? "HeadlessChrome/140" : "HeadlessChrome/141" },
      ]),
    );
    const result = validateBaselineBrowserVersions(mixed);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("expected exactly one baseline Chrome version");
  });

  it("rejects a baseline where some rows are missing a browser version", () => {
    const rows = completeRows();
    const partial = Object.fromEntries(
      Object.entries(baselineFromRows(rows)).map(([run, entry], index) => [
        run,
        { ...(entry as object), chromeVersion: index === 0 ? null : "HeadlessChrome/140" },
      ]),
    );
    const result = validateBaselineBrowserVersions(partial);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("some rows are missing a recorded browser version");
  });
});
