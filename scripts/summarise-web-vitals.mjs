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
// interaction metric); TBT is its lab proxy. The #017 rule's INP clause is read
// from CrUX field data when the origin has enough traffic, which is why the
// verdict below is stated as provisional on that confirmation.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** #017 decision rule, fixed before any numbers are read. */
export const WEB_VITALS_THRESHOLDS = { lcpMs: 2500, cls: 0.1 };

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

/** The `mobile-<slug>` run names the workflow was asked to produce. */
export function expectedMobileRuns(routes) {
  return (Array.isArray(routes) ? routes : String(routes ?? "").split(","))
    .map(routeSlug)
    .filter(Boolean)
    .map((slug) => `mobile-${slug}`);
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
    .map((run) => ({ run, reason: "no Lighthouse report produced", missingReport: true }));
  const failed = present
    .filter(
      (row) =>
        row.lcpMs === null ||
        row.cls === null ||
        row.lcpMs >= WEB_VITALS_THRESHOLDS.lcpMs ||
        row.cls >= WEB_VITALS_THRESHOLDS.cls,
    )
    .map((row) => ({ ...row, reason: "outside the threshold", missingReport: false }));
  // With no expected list to check against, zero mobile reports is still not a
  // pass — never let an all-desktop directory read as "every mobile route ok".
  if (expected.length === 0 && present.length === 0) {
    return [{ run: "mobile-*", reason: "no mobile Lighthouse report produced", missingReport: true }];
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
  lines.push("");
  lines.push(
    breaches.length === 0
      ? `**Every mobile route is within LCP < ${WEB_VITALS_THRESHOLDS.lcpMs}ms and CLS < ${WEB_VITALS_THRESHOLDS.cls}.** ` +
          "Per the #017 decision rule that closes #017 as metrics-acceptable and makes the gated payload findings WONTFIX. " +
          "Confirm INP from CrUX field data before recording the verdict."
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
  writeFileSync(join(directory, "summary.json"), `${JSON.stringify(rows, null, 2)}\n`);
  const table = renderTable(rows, routes);
  console.log(table);
  if (process.env.GITHUB_STEP_SUMMARY) {
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, `## Live Web Vitals\n\n${table}\n`, { flag: "a" });
  }
  const missing = mobileBreaches(rows, routes).filter((breach) => breach.missingReport);
  if (missing.length > 0) {
    console.log(`::error::${missing.length} requested mobile route(s) produced no report — evidence is incomplete`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("summarise-web-vitals.mjs")) {
  main();
}
