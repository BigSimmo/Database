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
 * Mobile rows that breach the rule. A missing metric counts as a breach — an
 * absent number is not evidence of passing, and #017 exists precisely because
 * this repo has acted on unmeasured latency claims before.
 */
export function mobileBreaches(rows) {
  return rows
    .filter((row) => row.run.startsWith("mobile-"))
    .filter(
      (row) =>
        row.lcpMs === null ||
        row.cls === null ||
        row.lcpMs >= WEB_VITALS_THRESHOLDS.lcpMs ||
        row.cls >= WEB_VITALS_THRESHOLDS.cls,
    );
}

export function renderTable(rows) {
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
  const breaches = mobileBreaches(rows);
  lines.push("");
  lines.push(
    breaches.length === 0
      ? `**Every mobile route is within LCP < ${WEB_VITALS_THRESHOLDS.lcpMs}ms and CLS < ${WEB_VITALS_THRESHOLDS.cls}.** ` +
          "Per the #017 decision rule that closes #017 as metrics-acceptable and makes the gated payload findings WONTFIX. " +
          "Confirm INP from CrUX field data before recording the verdict."
      : `**${breaches.length} mobile route(s) breach the rule: ${breaches.map((b) => b.run).join(", ")}.** ` +
          "Only findings on those routes become actionable, ranked by measured contribution.",
  );
  return lines.join("\n");
}

function main() {
  const directory = process.argv[2] ?? "web-vitals";
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
  const table = renderTable(rows);
  console.log(table);
  if (process.env.GITHUB_STEP_SUMMARY) {
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, `## Live Web Vitals\n\n${table}\n`, { flag: "a" });
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("summarise-web-vitals.mjs")) {
  main();
}
