#!/usr/bin/env node
/**
 * check-lighthouse-budget — grade Lighthouse reports from a LOCAL production build
 * against a committed baseline, so a performance regression is caught before merge.
 *
 * Why this exists alongside `.github/workflows/live-web-vitals.yml`: that workflow
 * measures the deployed origin, is dispatch-only by design, and answers the ledger
 * #017 question ("are the real numbers acceptable?"). It cannot stop a regression
 * from merging — by the time it runs, `main` has already auto-deployed to
 * psychiatry.tools. This gate answers the other question: "did this diff make the
 * app slower than the last known-good build?"
 *
 * It is deliberately a RELATIVE gate. Absolute web-vitals thresholds are meaningless
 * against a localhost server with no network latency — every route would pass
 * trivially and the gate would catch nothing. So this follows the same shape as
 * `check:bundle-budget`: a committed baseline, a tolerance, and an `enforce` flag.
 *   - No baseline recorded  -> warn, exit 0 (never breaks a run that has nothing to
 *     compare against).
 *   - Within tolerance      -> ok.
 *   - Over tolerance        -> fail when enforcing, warn otherwise.
 *   - Evidence incomplete   -> ALWAYS fail. A route that produced no report is not a
 *     pass; this is the failure mode `summarise-web-vitals.mjs` documents at length.
 *
 * Refresh the baseline from an intentional, known-good run:
 *   npm run check:lighthouse-budget -- --update
 *
 * Flags: --update, --json, --dir <path>.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { hasUsableMetrics, measuredRequestedPage, routeSlug, summariseReport } from "./summarise-web-vitals.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUDGET_PATH = path.join(root, "lighthouse-budget.json");

/** Metrics graded, and how a regression in each is decided. */
export const DEFAULT_TOLERANCE = Object.freeze({
  // Percentage growth alone flags noise on small numbers (12ms -> 16ms is +33%),
  // and an absolute floor alone flags nothing on slow routes. A breach needs both.
  lcpMs: { pct: 20, minAbsolute: 100 },
  tbtMs: { pct: 30, minAbsolute: 50 },
  // CLS is a unitless ratio that is usually 0 on a good build, where percentage
  // growth is undefined or infinite. Graded on absolute movement only.
  cls: { absolute: 0.02 },
});

/** Every `<strategy>-<slug>` run name the budget asks for. */
export function expectedBudgetRuns(budget) {
  const strategies = budget?.strategies ?? ["mobile", "desktop"];
  const slugs = (budget?.routes ?? []).map(routeSlug).filter(Boolean);
  return strategies.flatMap((strategy) => slugs.map((slug) => `${strategy}-${slug}`));
}

/**
 * Runs that cannot be graded at all: no report, no usable metrics, or a report that
 * measured a different page than the one requested (a redirect to /login produces
 * perfectly good numbers for the wrong route).
 *
 * Fails closed and is never downgraded by `enforce` — an ungraded route silently
 * counted as a pass is exactly how unmeasured latency claims got acted on before.
 */
export function incompleteBudgetEvidence(rows, budget) {
  const byRun = new Map(rows.map((row) => [row.run, row]));
  const problems = [];
  for (const run of expectedBudgetRuns(budget)) {
    const row = byRun.get(run);
    if (!row) problems.push(`${run}: no Lighthouse report produced`);
    else if (!hasUsableMetrics(row)) problems.push(`${run}: report has no LCP or CLS number`);
    else if (!measuredRequestedPage(row)) problems.push(`${run}: report measured a different page than requested`);
  }
  return problems.sort();
}

/** Grade one run against its baseline. Returns the breaches, empty when within tolerance. */
export function gradeRun(row, baselineRow, tolerance = DEFAULT_TOLERANCE) {
  if (!baselineRow) return [];
  const breaches = [];

  for (const [metric, rule] of Object.entries(tolerance)) {
    const current = row?.[metric];
    const before = baselineRow?.[metric];
    if (typeof current !== "number" || typeof before !== "number") continue;
    const delta = current - before;
    if (delta <= 0) continue;

    if (typeof rule.absolute === "number") {
      if (delta > rule.absolute) {
        breaches.push({
          run: row.run,
          metric,
          baseline: before,
          current,
          delta,
          reason: `${metric} +${delta.toFixed(3)} vs baseline (max +${rule.absolute})`,
        });
      }
      continue;
    }

    const pct = before === 0 ? Number.POSITIVE_INFINITY : (delta / before) * 100;
    if (delta >= (rule.minAbsolute ?? 0) && pct > rule.pct) {
      breaches.push({
        run: row.run,
        metric,
        baseline: before,
        current,
        delta,
        reason:
          `${metric} +${delta.toFixed(0)} (+${Number.isFinite(pct) ? pct.toFixed(1) : "inf"}%) vs baseline ` +
          `(tolerance +${rule.pct}% and +${rule.minAbsolute ?? 0})`,
      });
    }
  }

  return breaches;
}

/**
 * Pure comparison over every graded run.
 * Returns { status: "ok"|"warn"|"fail", breaches, incomplete, ... }.
 */
export function compareToLighthouseBudget(rows, budget) {
  const tolerance = { ...DEFAULT_TOLERANCE, ...(budget?.tolerance ?? {}) };
  const baseline = budget?.baseline ?? null;
  const enforce = Boolean(budget?.enforce);
  const incomplete = incompleteBudgetEvidence(rows, budget);

  // Incompleteness is fatal regardless of `enforce`: there is nothing to grade, so
  // "warn" would report a pass for a route that was never measured.
  if (incomplete.length > 0) {
    return { status: "fail", reason: "evidence incomplete", breaches: [], incomplete, baseline, enforce, tolerance };
  }

  if (!baseline || Object.keys(baseline).length === 0) {
    return {
      status: "warn",
      reason: "no baseline recorded — run with --update after a known-good build",
      breaches: [],
      incomplete,
      baseline,
      enforce,
      tolerance,
    };
  }

  const breaches = rows.flatMap((row) => gradeRun(row, baseline[row.run], tolerance));
  if (breaches.length === 0) {
    return { status: "ok", reason: "within tolerance", breaches, incomplete, baseline, enforce, tolerance };
  }
  return {
    status: enforce ? "fail" : "warn",
    reason: `${breaches.length} metric(s) outside tolerance`,
    breaches,
    incomplete,
    baseline,
    enforce,
    tolerance,
  };
}

/** The baseline object to commit for a set of measured rows. */
export function baselineFromRows(rows) {
  return Object.fromEntries(
    [...rows]
      .sort((a, b) => (a.run < b.run ? -1 : a.run > b.run ? 1 : 0))
      .map((row) => [row.run, { lcpMs: row.lcpMs, cls: row.cls, tbtMs: row.tbtMs, fcpMs: row.fcpMs }]),
  );
}

export function renderBudgetTable(rows, result) {
  const format = (value, digits = 0) => (value === null || value === undefined ? "n/a" : value.toFixed(digits));
  const baseline = result.baseline ?? {};
  const lines = [
    "| run | LCP ms | baseline | TBT ms | baseline | CLS | baseline |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...rows.map((row) => {
      const before = baseline[row.run] ?? {};
      return (
        `| ${row.run} | ${format(row.lcpMs)} | ${format(before.lcpMs)} | ` +
        `${format(row.tbtMs)} | ${format(before.tbtMs)} | ` +
        `${format(row.cls, 3)} | ${format(before.cls, 3)} |`
      );
    }),
  ];

  lines.push("");
  if (result.incomplete.length > 0) {
    lines.push(`**Evidence incomplete.** ${result.incomplete.join("; ")}. Nothing is graded from this run.`);
    return lines.join("\n");
  }
  if (result.status === "warn" && result.breaches.length === 0) {
    lines.push(`_${result.reason}._`);
    return lines.join("\n");
  }
  if (result.breaches.length === 0) {
    lines.push(`**Every graded route is within tolerance of the committed baseline.**`);
    return lines.join("\n");
  }
  lines.push(
    `**${result.breaches.length} metric(s) regressed:** ` +
      `${result.breaches.map((breach) => `${breach.run} ${breach.reason}`).join("; ")}.` +
      (result.enforce ? "" : " Reported only — `enforce` is false in lighthouse-budget.json."),
  );
  return lines.join("\n");
}

export function loadBudget(budgetPath = BUDGET_PATH) {
  try {
    return JSON.parse(readFileSync(budgetPath, "utf8"));
  } catch {
    return { enforce: false, routes: [], strategies: ["mobile", "desktop"], baseline: null };
  }
}

export function readReports(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((file) => file.endsWith(".json") && file !== "summary.json")
    .sort()
    .map((file) =>
      summariseReport(file.replace(/\.json$/, ""), JSON.parse(readFileSync(path.join(directory, file), "utf8"))),
    );
}

function main() {
  const argv = process.argv.slice(2);
  const update = argv.includes("--update");
  const asJson = argv.includes("--json");
  const dirIndex = argv.indexOf("--dir");
  const directory = path.resolve(root, dirIndex >= 0 ? (argv[dirIndex + 1] ?? "lighthouse") : "lighthouse");

  const budget = loadBudget();
  const rows = readReports(directory);

  if (rows.length === 0) {
    // Mirrors check:bundle-budget: a run that produced no reports at all did not
    // measure anything, so it cannot be a verdict either way. Say so and exit 0
    // rather than failing a job that simply did not build.
    console.log(
      `check:lighthouse-budget: no Lighthouse reports in ${path.relative(root, directory)} — nothing to grade.`,
    );
    return;
  }

  const result = compareToLighthouseBudget(rows, budget);

  if (update) {
    if (result.incomplete.length > 0) {
      console.error(
        `::error::refusing to update the baseline from incomplete evidence: ${result.incomplete.join("; ")}`,
      );
      process.exit(1);
    }
    const next = {
      ...budget,
      baseline: baselineFromRows(rows),
      updatedAt: new Date().toISOString(),
    };
    writeFileSync(BUDGET_PATH, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`check:lighthouse-budget: baseline updated for ${rows.length} run(s) in lighthouse-budget.json.`);
    return;
  }

  const table = renderBudgetTable(rows, result);
  console.log(table);
  if (asJson) console.log(JSON.stringify({ ...result, rows }, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY) {
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, `## Lighthouse budget\n\n${table}\n`, { flag: "a" });
  }

  if (result.status === "fail") {
    console.error(`::error::check:lighthouse-budget failed — ${result.reason}`);
    process.exit(1);
  }
  if (result.status === "warn") console.log(`::warning::check:lighthouse-budget — ${result.reason}`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("check-lighthouse-budget.mjs")) {
  main();
}
