// Render a run-over-run metric trend from downloaded eval-canary artifacts.
//
// Every canary run uploads `eval-canary-output` (golden-retrieval.json, 30-day
// retention). Download the artifacts you want to compare, then:
//
//   npm run eval:trend -- runA/golden-retrieval.json runB/golden-retrieval.json
//   npm run eval:trend -- --case lithium-therapy-monitoring runA.json runB.json
//
// Files are ordered as given (pass oldest first). Offline and read-only: no
// providers, no repo state — the durable trend record without new infrastructure
// (docs/observability-slos.md §3.1).
import { readFileSync } from "node:fs";

/** One trend row per artifact payload; exported for tests. */
export function buildTrendRows(payloads) {
  return payloads.map(({ label, payload }) => {
    const summary = payload?.summary ?? {};
    const results = Array.isArray(payload?.results) ? payload.results : [];
    return {
      label,
      cases: results.length,
      failed: Array.isArray(summary.failed_cases) ? summary.failed_cases.length : (summary.failed_cases ?? 0),
      doc_recall_at_5: summary.document_recall_at_5 ?? null,
      content_recall_at_5: summary.content_recall_at_5 ?? null,
      mrr_at_10: summary.mrr_at_10 ?? null,
      content_mrr_at_10: summary.content_mrr_at_10 ?? null,
      irrelevant_at_10: summary.irrelevant_source_rate_at_10 ?? null,
      p50_ms: summary.median_latency_ms ?? null,
      p90_ms: summary.p90_latency_ms ?? null,
    };
  });
}

/** Per-case reciprocal-rank trend across payloads; exported for tests. */
export function buildCaseTrend(payloads, caseId) {
  return payloads.map(({ label, payload }) => {
    const match = (Array.isArray(payload?.results) ? payload.results : []).find((result) => result.id === caseId);
    return {
      label,
      found: Boolean(match),
      rr_at_10: match?.reciprocalRankAt10 ?? null,
      content_rr_at_10: match?.contentReciprocalRankAt10 ?? null,
      passed: match ? match.failures?.length === 0 || match.failures === undefined : null,
      strategy: match?.retrievalStrategy ?? null,
    };
  });
}

function formatTable(rows) {
  if (!rows.length) return "(no rows)";
  const keys = Object.keys(rows[0]);
  const cell = (value) => (typeof value === "number" ? Number(value.toFixed(4)).toString() : String(value ?? "-"));
  const widths = keys.map((key) => Math.max(key.length, ...rows.map((row) => cell(row[key]).length)));
  const line = (values) => values.map((value, i) => value.padEnd(widths[i])).join("  ");
  return [
    line(keys),
    line(widths.map((w) => "-".repeat(w))),
    ...rows.map((row) => line(keys.map((k) => cell(row[k])))),
  ].join("\n");
}

function main() {
  const argv = process.argv.slice(2);
  const caseFlag = argv.indexOf("--case");
  const caseId = caseFlag >= 0 ? argv[caseFlag + 1] : undefined;
  const files = argv.filter((arg, index) => arg !== "--case" && index !== caseFlag + 1);
  if (!files.length) {
    console.error("Usage: eval-trend [--case <golden-case-id>] <golden-retrieval.json...>  (oldest first)");
    process.exit(2);
  }
  const payloads = files.map((file) => ({ label: file, payload: JSON.parse(readFileSync(file, "utf8")) }));
  console.log(formatTable(buildTrendRows(payloads)));
  if (caseId) {
    console.log(`\nCase trend: ${caseId}`);
    console.log(formatTable(buildCaseTrend(payloads, caseId)));
  }
}

if (process.argv[1] && process.argv[1].endsWith("eval-trend.mjs")) main();
