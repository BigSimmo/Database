#!/usr/bin/env node
// Summarises the Lighthouse JSON produced by .github/workflows/live-web-vitals.yml
// into a markdown table plus a machine-readable summary.json, and states the
// ledger #017 verdict.
//
// Lives here rather than inline in the workflow so the escaping is not at the
// mercy of YAML-inside-shell-inside-node quoting, and so the thresholds can be
// unit-tested.
//
// Lab metrics only. Lighthouse cannot measure INP in lab conditions (it is an
// interaction metric); TBT is its lab proxy. The #017 rule has three clauses —
// LCP, CLS and INP — so this script can satisfy at most two of them and NEVER
// emits an #017 closure on its own. The best it reports is "LCP and CLS are
// within threshold; obtain INP from CrUX before closing #017".

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** #017 decision rule, fixed before any numbers are read. */
export const WEB_VITALS_THRESHOLDS = { lcpMs: 2500, cls: 0.1 };

/**
 * #017 asks for evidence from the production origin specifically
 * (`docs/outstanding-issues.md`). `LIVE_DOMAIN_URL` can point the workflow at a
 * staging cutover, which is useful for a dry run but cannot discharge #017.
 */
export const CANONICAL_ORIGIN = "https://psychiatry.tools";

/** Origins actually loaded, taken from the reports rather than the input URL. */
export function measuredOrigins(rows) {
  const origins = new Set();
  for (const row of rows) {
    if (!row?.url) continue;
    try {
      origins.add(new URL(row.url).origin);
    } catch {
      origins.add(String(row.url));
    }
  }
  return [...origins].sort();
}

/**
 * Whether this run may state an #017 verdict at all. Read from each report's own
 * final URL, not from `LIVE_DOMAIN_URL`, so a redirect to another host is caught
 * as well as a deliberate staging override.
 */
export function isProductionVerdict(rows) {
  const origins = measuredOrigins(rows);
  return origins.length > 0 && origins.every((origin) => origin === CANONICAL_ORIGIN);
}

/** Extract the fields we report from one Lighthouse JSON report. */
export function summariseReport(run, report) {
  const audits = report?.audits ?? {};
  const numeric = (id) => {
    const value = audits[id]?.numericValue;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };
  return {
    run,
    url: report?.finalDisplayedUrl ?? report?.requestedUrl ?? null,
    // Kept alongside the final URL so a redirect can be detected. Measuring
    // /login instead of the requested route yields perfectly good numbers for
    // the wrong page, and the filename alone cannot reveal that.
    requestedUrl: report?.requestedUrl ?? null,
    runtimeError: report?.runtimeError?.code ?? null,
    // The browser that produced these numbers. Chrome comes from the runner
    // image, not from `LIGHTHOUSE_VERSION`, so it moves independently of the
    // pinned tooling and a metric shift can originate there rather than in the
    // application. `main()` records the distinct values in summary.json.
    chromeVersion: report?.environment?.hostUserAgent ?? null,
    performanceScore: report?.categories?.performance?.score ?? null,
    lcpMs: numeric("largest-contentful-paint"),
    cls: numeric("cumulative-layout-shift"),
    tbtMs: numeric("total-blocking-time"),
    fcpMs: numeric("first-contentful-paint"),
  };
}

/**
 * Filename slug for a route, matching the sed expression in the workflow:
 * "/" -> root, "/a" -> a, "/a/b" -> a-b.
 */
export function routeSlug(route) {
  const trimmed = String(route ?? "").trim();
  if (!trimmed) return null;
  return trimmed.replace(/^\//, "").replaceAll("/", "-") || "root";
}

/** The strategies the workflow measures. #017 asks for mobile AND desktop evidence. */
export const WEB_VITALS_STRATEGIES = ["mobile", "desktop"];

/** The requested routes' slugs, in dispatch order, blanks dropped. */
export function routeSlugs(routes) {
  return (Array.isArray(routes) ? routes : String(routes ?? "").split(",")).map(routeSlug).filter(Boolean);
}

/**
 * Requested routes whose slugs collide. The workflow names each report
 * `<strategy>-<slug>.json`, so `/a/b` and `/a-b` both write `a-b` and the second
 * run overwrites the first. The surviving file then satisfies the expected-run
 * check for both routes, and one requested route is silently never measured.
 * The filename scheme simply cannot represent both, so the evidence can never be
 * complete and this is fatal rather than a warning.
 */
export function collidingRouteSlugs(routes) {
  const counts = new Map();
  for (const slug of routeSlugs(routes)) counts.set(slug, (counts.get(slug) ?? 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([slug]) => slug);
}

/** Every `<strategy>-<slug>` run name the workflow was asked to produce. */
export function expectedRuns(routes, strategies = WEB_VITALS_STRATEGIES) {
  const slugs = routeSlugs(routes);
  return strategies.flatMap((strategy) => slugs.map((slug) => `${strategy}-${slug}`));
}

/** The `mobile-<slug>` runs — the threshold rule in #017 is graded on mobile only. */
export function expectedMobileRuns(routes) {
  return expectedRuns(routes, ["mobile"]);
}

/**
 * Requested runs of EITHER strategy that produced no report. The threshold
 * verdict is mobile-only, but #017 asks for reproducible mobile *and* desktop
 * evidence (`docs/outstanding-issues.md`), so a run with every mobile report and
 * no desktop report is not a baseline and must not be reported as one.
 */
export function missingRuns(rows, routes) {
  const seen = new Set(rows.map((row) => row.run));
  return expectedRuns(routes).filter((run) => !seen.has(run));
}

/** A report is usable evidence only if it carries both graded numbers. */
export function hasUsableMetrics(row) {
  return row != null && row.lcpMs !== null && row.cls !== null;
}

/**
 * Path AND query of a URL, normalised, for comparing requested vs final. The
 * query matters: `/documents/search?q=depression` and `/documents/search` are
 * different pages to measure — one renders results, the other an empty state —
 * so a redirect that drops or rewrites the query must not pass as the requested
 * route. Params are sorted so a reordering redirect is not a false rejection.
 */
function normalisedTarget(value) {
  if (!value) return null;
  try {
    const { pathname, searchParams } = new URL(value);
    const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : "/";
    const params = [...searchParams.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    // Encode each component. Joining the decoded entries as `key=val&…` lets
    // `/forms?q=alpha%26run%3D1` (one value containing `&`/`=`) alias
    // `/forms?q=alpha&run=1` (two params) — different pages, same string after
    // decode. URLSearchParams.toString() keeps the boundary.
    const query = new URLSearchParams(params).toString();
    return query ? `${path}?${query}` : path;
  } catch {
    return null;
  }
}

/**
 * Whether the report measured the page that was asked for. An origin check alone
 * is not enough: a route that redirects to `/login`, to a same-origin error page
 * or to any other path still produces clean metrics on `psychiatry.tools`, and
 * the filename cannot reveal that the numbers describe a different page. A
 * Lighthouse `runtimeError` is treated the same way — the run did not measure
 * what it claims to.
 */
export function measuredRequestedPage(row) {
  if (row == null || row.runtimeError) return false;
  const requested = normalisedTarget(row.requestedUrl);
  // Older reports carry no requestedUrl; absent evidence of a redirect is not
  // evidence of none, but neither is it a reason to reject a report that has
  // no requested URL recorded at all — those are caught by hasUsableMetrics.
  if (requested === null) return true;
  return normalisedTarget(row.url) === requested;
}

/**
 * Everything that makes the evidence incomplete rather than merely bad: a
 * requested run with no report, a report with no LCP/CLS number, or a route
 * whose slug collides so its report was overwritten. All must fail the step — a
 * problem that is only rendered in the table still exits 0, and #017 exists
 * precisely because this repo has acted on unmeasured latency claims before.
 *
 * This walks the expected route-by-strategy matrix DIRECTLY rather than asking
 * `mobileBreaches`. Delegating to that mobile-only helper is what produced three
 * successive holes here — desktop reports, then desktop metrics — each fixed one
 * instance at a time. Completeness is a property of the whole matrix, so it is
 * computed over the whole matrix.
 *
 * An over-threshold number is deliberately NOT here: that is a real measurement
 * and a real verdict, not missing evidence.
 */
export function incompleteEvidence(rows, routes) {
  const byRun = new Map(rows.map((row) => [row.run, row]));
  const expected = expectedRuns(routes);
  const problems = new Set(collidingRouteSlugs(routes).map((slug) => `route slug collision: ${slug}`));
  for (const run of expected) {
    const row = byRun.get(run);
    if (!hasUsableMetrics(row) || !measuredRequestedPage(row)) problems.add(run);
  }
  // With no route list to check against, an absence of mobile reports entirely
  // is still not a pass — the guard must not be bypassable by omitting the arg.
  if (expected.length === 0 && !rows.some((row) => row.run.startsWith("mobile-") && hasUsableMetrics(row))) {
    problems.add("mobile-*");
  }
  return [...problems].sort();
}

/**
 * Mobile runs that breach the rule. Three ways to breach, all fail-closed:
 * a metric is missing, a metric is over threshold, or the run produced no
 * report at all. The last one matters because the workflow deliberately
 * downgrades a per-route Lighthouse failure to a warning, so a run that never
 * happened would otherwise be silently absent from the pass verdict — and #017
 * exists precisely because this repo has acted on unmeasured latency claims
 * before. An absent number is not evidence of passing; nor is an absent run.
 */
export function mobileBreaches(rows, routes) {
  const present = rows.filter((row) => row.run.startsWith("mobile-"));
  const seen = new Set(present.map((row) => row.run));
  const expected = expectedMobileRuns(routes);
  const missing = expected
    .filter((run) => !seen.has(run))
    .map((run) => ({ run, reason: "no Lighthouse report produced", missingReport: true, missingMetric: false }));
  const failed = present
    .filter(
      (row) =>
        row.lcpMs === null ||
        row.cls === null ||
        row.lcpMs >= WEB_VITALS_THRESHOLDS.lcpMs ||
        row.cls >= WEB_VITALS_THRESHOLDS.cls,
    )
    .map((row) => {
      const missingMetric = row.lcpMs === null || row.cls === null;
      return {
        ...row,
        reason: missingMetric ? "report has no LCP or CLS number" : "outside the threshold",
        missingReport: false,
        missingMetric,
      };
    });
  // With no expected list to check against, zero mobile reports is still not a
  // pass — never let an all-desktop directory read as "every mobile route ok".
  if (expected.length === 0 && present.length === 0) {
    return [
      { run: "mobile-*", reason: "no mobile Lighthouse report produced", missingReport: true, missingMetric: false },
    ];
  }
  return [...missing, ...failed];
}

export function renderTable(rows, routes) {
  const format = (value, digits = 0) => (value === null ? "n/a" : value.toFixed(digits));
  const lines = [
    "| run | perf | LCP ms | CLS | TBT ms | FCP ms |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    ...rows.map(
      (row) =>
        `| ${row.run} | ${format((row.performanceScore ?? 0) * 100)} | ${format(row.lcpMs)} | ` +
        `${format(row.cls, 3)} | ${format(row.tbtMs)} | ${format(row.fcpMs)} |`,
    ),
  ];
  const breaches = mobileBreaches(rows, routes);
  const incomplete = incompleteEvidence(rows, routes);
  const productionVerdict = isProductionVerdict(rows);

  // Disqualifiers are resolved BEFORE any threshold or actionability prose, and
  // that ordering is the point. Both were previously computed independently of
  // the verdict branch and appended afterwards, so a run could assert "every
  // mobile route is within threshold" in bold and then admit two paragraphs
  // later that the evidence was incomplete, or call a staging breach
  // "actionable" for #017. Whichever line a reader takes away, one of them was
  // false. A run that cannot produce a verdict must not emit verdict prose at
  // all — the measurements are still shown, explicitly subordinated.
  const disqualifiers = [];
  if (incomplete.length > 0) {
    disqualifiers.push(`${incomplete.length} requested run(s) produced no usable report: ${incomplete.join(", ")}`);
  }
  if (!productionVerdict) {
    disqualifiers.push(
      `#017 asks for evidence from ${CANONICAL_ORIGIN}; this run measured ` +
        `${measuredOrigins(rows).join(", ") || "an unknown origin"}`,
    );
  }

  lines.push("");
  if (disqualifiers.length > 0) {
    lines.push(
      `**This run is NOT an #017 verdict.** ${disqualifiers.join(". ")}. ` +
        "Record nothing against #017 from this run; fix the cause and rerun.",
    );
    lines.push("");
    lines.push(
      breaches.length === 0
        ? "_For reference only — the reports that were produced are within the thresholds. " +
            "This is a measurement, not a verdict._"
        : `_For reference only — ${breaches.length} of the reports that were produced are outside the thresholds: ` +
            `${breaches.map((breach) => `${breach.run} (${breach.reason})`).join(", ")}. ` +
            "This is a measurement, not a verdict, and does not make any finding actionable._",
    );
    return lines.join("\n");
  }

  lines.push(
    breaches.length === 0
      ? // Deliberately NOT a closure. The #017 rule has three clauses — LCP,
        // CLS and INP < 200ms — and Lighthouse cannot measure INP in lab
        // conditions at all (it is an interaction metric; TBT is the lab
        // proxy). This run therefore satisfies two of three and cannot close
        // #017 by itself. Announcing closure here and asking the operator to
        // "confirm INP afterward" put the bold verdict before the evidence,
        // which is the exact failure mode #017 exists to prevent.
        `**Every mobile route is within LCP < ${WEB_VITALS_THRESHOLDS.lcpMs}ms and CLS < ${WEB_VITALS_THRESHOLDS.cls}. ` +
          "This is NOT yet an #017 closure.** The #017 rule also requires INP < 200ms, which is field data this run " +
          "does not collect — Lighthouse cannot measure INP in lab conditions. Obtain INP from CrUX for these routes; " +
          "only if it is available AND under 200ms does #017 close as metrics-acceptable and the gated payload " +
          "findings become WONTFIX. An unavailable or >=200ms INP leaves #017 open."
      : `**${breaches.length} mobile route(s) breach the rule: ` +
          `${breaches.map((breach) => `${breach.run} (${breach.reason})`).join(", ")}.** ` +
          "Only findings on those routes become actionable, ranked by measured contribution. " +
          "A route with no report is a breach, not a pass — rerun it before recording any #017 verdict.",
  );
  return lines.join("\n");
}

function main() {
  const directory = process.argv[2] ?? "web-vitals";
  // The routes the workflow was asked to measure, so a route whose Lighthouse
  // run failed is reported as a breach rather than silently omitted.
  const routes = process.argv[3] ?? process.env.ROUTES ?? "";
  const files = readdirSync(directory)
    .filter((file) => file.endsWith(".json") && file !== "summary.json")
    .sort();
  if (files.length === 0) {
    console.log("::error::no Lighthouse output produced");
    process.exit(1);
  }
  const rows = files.map((file) =>
    summariseReport(file.replace(/\.json$/, ""), JSON.parse(readFileSync(join(directory, file), "utf8"))),
  );
  // Record the measurement environment alongside the numbers: a baseline is
  // only comparable to a follow-up produced by the same implementation AND the
  // same browser. `LIGHTHOUSE_VERSION` is pinned in the workflow, but Chrome
  // comes from the `ubuntu-24.04` runner image and moves underneath it, so a
  // rendering or metric change can originate in the browser rather than the
  // application. Lighthouse reports the build it drove in `environment.
  // hostUserAgent`; taking it from the reports rather than from the runner
  // records what actually measured, and disagreement across reports is itself
  // worth seeing. Compare baselines only when both fields match.
  const lighthouseVersion = process.env.LIGHTHOUSE_VERSION ?? "unpinned";
  const chromeVersions = [...new Set(rows.map((row) => row.chromeVersion).filter(Boolean))].sort();
  writeFileSync(
    join(directory, "summary.json"),
    `${JSON.stringify({ lighthouseVersion, chromeVersions, routes, rows }, null, 2)}\n`,
  );
  const table = renderTable(rows, routes);
  console.log(table);
  if (process.env.GITHUB_STEP_SUMMARY) {
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, `## Live Web Vitals\n\n${table}\n`, { flag: "a" });
  }
  const incomplete = incompleteEvidence(rows, routes);
  if (incomplete.length > 0) {
    console.log(
      `::error::${incomplete.length} requested run(s) produced no usable report — evidence is incomplete: ` +
        `${incomplete.join(", ")}`,
    );
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("summarise-web-vitals.mjs")) {
  main();
}
