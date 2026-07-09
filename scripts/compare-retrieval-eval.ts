import { readFileSync } from "node:fs";

type EvalPayload = {
  summary?: Record<string, unknown>;
  results?: Array<Record<string, unknown>>;
};

function readPayload(path: string): EvalPayload {
  return JSON.parse(readFileSync(path, "utf8")) as EvalPayload;
}

function numberValue(summary: Record<string, unknown>, key: string) {
  const value = summary[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function arrayLength(summary: Record<string, unknown>, key: string) {
  const value = summary[key];
  return Array.isArray(value) ? value.length : 0;
}

function layerCount(summary: Record<string, unknown>, layer: string) {
  const counts = summary.retrieval_layer_counts;
  if (!counts || typeof counts !== "object") return 0;
  const value = (counts as Record<string, unknown>)[layer];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatDelta(candidate: number, baseline: number, digits = 4) {
  const delta = candidate - baseline;
  const sign = delta > 0 ? "+" : "";
  return `${candidate.toFixed(digits)} (${sign}${delta.toFixed(digits)})`;
}

function main() {
  const [, , baselinePath, candidatePath] = process.argv;
  if (!baselinePath || !candidatePath) {
    throw new Error("Usage: tsx scripts/compare-retrieval-eval.ts <baseline.json> <candidate.json>");
  }

  const baseline = readPayload(baselinePath).summary ?? {};
  const candidate = readPayload(candidatePath).summary ?? {};

  const metrics: Array<[string, number, number, number?]> = [
    ["case_count", numberValue(baseline, "case_count"), numberValue(candidate, "case_count"), 0],
    [
      "document_recall_at_5",
      numberValue(baseline, "document_recall_at_5"),
      numberValue(candidate, "document_recall_at_5"),
    ],
    [
      "content_recall_at_5",
      numberValue(baseline, "content_recall_at_5"),
      numberValue(candidate, "content_recall_at_5"),
    ],
    ["top_k_hit_rate", numberValue(baseline, "top_k_hit_rate"), numberValue(candidate, "top_k_hit_rate")],
    ["mrr_at_10", numberValue(baseline, "mrr_at_10"), numberValue(candidate, "mrr_at_10")],
    ["median_latency_ms", numberValue(baseline, "median_latency_ms"), numberValue(candidate, "median_latency_ms"), 0],
    ["p90_latency_ms", numberValue(baseline, "p90_latency_ms"), numberValue(candidate, "p90_latency_ms"), 0],
    [
      "force_embedding_failure_count",
      numberValue(baseline, "force_embedding_failure_count"),
      numberValue(candidate, "force_embedding_failure_count"),
      0,
    ],
    ["failed_cases", arrayLength(baseline, "failed_cases"), arrayLength(candidate, "failed_cases"), 0],
    [
      "latency_failed_cases",
      arrayLength(baseline, "latency_failed_cases"),
      arrayLength(candidate, "latency_failed_cases"),
      0,
    ],
    ["index_units_layer_count", layerCount(baseline, "index_units"), layerCount(candidate, "index_units"), 0],
  ];

  console.log("Retrieval eval comparison: candidate (delta from baseline)");
  for (const [name, baseValue, candidateValue, digits] of metrics) {
    console.log(`  ${name}: ${formatDelta(candidateValue, baseValue, digits ?? 4)}`);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
