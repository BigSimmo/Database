import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

type EvalSummary = Record<string, unknown>;

type EvalPayload = {
  summary?: EvalSummary;
  results?: Array<Record<string, unknown>>;
};

type MetricKind = "number" | "array" | "layer";

type MetricSpec = {
  name: string;
  // Summary field to read, or the layer name when kind is "layer".
  field: string;
  kind: MetricKind;
  // Required metrics feed the re-index gate; a missing value must fail closed rather than read
  // as 0. Optional/context metrics are mode-dependent (latency, force-embedding, layer coverage)
  // or superseded by content_mrr_at_10 (doc-level mrr_at_10) — absent is reported as n/a.
  required: boolean;
  digits: number;
};

const METRIC_SPECS: MetricSpec[] = [
  { name: "case_count", field: "case_count", kind: "number", required: true, digits: 0 },
  { name: "document_recall_at_5", field: "document_recall_at_5", kind: "number", required: true, digits: 4 },
  { name: "content_recall_at_5", field: "content_recall_at_5", kind: "number", required: true, digits: 4 },
  { name: "top_k_hit_rate", field: "top_k_hit_rate", kind: "number", required: true, digits: 4 },
  // Passage rank is the decisive retrieval metric; its case count guards the population it is
  // averaged over. Both are required so a missing value is surfaced, not silently zeroed.
  { name: "content_mrr_at_10", field: "content_mrr_at_10", kind: "number", required: true, digits: 4 },
  { name: "content_mrr_case_count", field: "content_mrr_case_count", kind: "number", required: true, digits: 0 },
  { name: "failed_cases", field: "failed_cases", kind: "array", required: true, digits: 0 },
  { name: "mrr_at_10", field: "mrr_at_10", kind: "number", required: false, digits: 4 },
  { name: "median_latency_ms", field: "median_latency_ms", kind: "number", required: false, digits: 0 },
  { name: "p90_latency_ms", field: "p90_latency_ms", kind: "number", required: false, digits: 0 },
  {
    name: "force_embedding_failure_count",
    field: "force_embedding_failure_count",
    kind: "number",
    required: false,
    digits: 0,
  },
  { name: "latency_failed_cases", field: "latency_failed_cases", kind: "array", required: false, digits: 0 },
  { name: "index_units_layer_count", field: "index_units", kind: "layer", required: false, digits: 0 },
];

type MetricValue = { present: boolean; value: number };

function readNumber(summary: EvalSummary, key: string): MetricValue {
  const value = summary[key];
  return typeof value === "number" && Number.isFinite(value) ? { present: true, value } : { present: false, value: 0 };
}

function readArrayLength(summary: EvalSummary, key: string): MetricValue {
  const value = summary[key];
  return Array.isArray(value) ? { present: true, value: value.length } : { present: false, value: 0 };
}

function readLayer(summary: EvalSummary, layer: string): MetricValue {
  const counts = summary.retrieval_layer_counts;
  if (!counts || typeof counts !== "object") return { present: false, value: 0 };
  const value = (counts as Record<string, unknown>)[layer];
  return typeof value === "number" && Number.isFinite(value) ? { present: true, value } : { present: false, value: 0 };
}

function readMetric(summary: EvalSummary, spec: MetricSpec): MetricValue {
  switch (spec.kind) {
    case "array":
      return readArrayLength(summary, spec.field);
    case "layer":
      return readLayer(summary, spec.field);
    default:
      return readNumber(summary, spec.field);
  }
}

export type ComparisonRow = {
  name: string;
  baseline: MetricValue;
  candidate: MetricValue;
  digits: number;
};

export type RetrievalEvalComparison = {
  rows: ComparisonRow[];
  missingRequired: string[];
};

// Pure so it can be unit-tested without touching the filesystem or process exit code.
export function compareRetrievalEval(baseline: EvalSummary, candidate: EvalSummary): RetrievalEvalComparison {
  const rows: ComparisonRow[] = [];
  const missingRequired: string[] = [];
  for (const spec of METRIC_SPECS) {
    const baselineValue = readMetric(baseline, spec);
    const candidateValue = readMetric(candidate, spec);
    if (spec.required) {
      if (!baselineValue.present) missingRequired.push(`baseline.${spec.name}`);
      if (!candidateValue.present) missingRequired.push(`candidate.${spec.name}`);
    }
    rows.push({ name: spec.name, baseline: baselineValue, candidate: candidateValue, digits: spec.digits });
  }
  return { rows, missingRequired };
}

function formatCell(row: ComparisonRow): string {
  if (!row.baseline.present || !row.candidate.present) {
    const candidate = row.candidate.present ? row.candidate.value.toFixed(row.digits) : "n/a";
    const baseline = row.baseline.present ? row.baseline.value.toFixed(row.digits) : "n/a";
    return `${candidate} (baseline ${baseline})`;
  }
  const delta = row.candidate.value - row.baseline.value;
  const sign = delta > 0 ? "+" : "";
  return `${row.candidate.value.toFixed(row.digits)} (${sign}${delta.toFixed(row.digits)})`;
}

function readPayload(path: string): EvalPayload {
  return JSON.parse(readFileSync(path, "utf8")) as EvalPayload;
}

function main() {
  const [, , baselinePath, candidatePath] = process.argv;
  if (!baselinePath || !candidatePath) {
    throw new Error("Usage: tsx scripts/compare-retrieval-eval.ts <baseline.json> <candidate.json>");
  }

  const baseline = readPayload(baselinePath).summary ?? {};
  const candidate = readPayload(candidatePath).summary ?? {};
  const { rows, missingRequired } = compareRetrievalEval(baseline, candidate);

  console.log("Retrieval eval comparison: candidate (delta from baseline)");
  for (const row of rows) {
    console.log(`  ${row.name}: ${formatCell(row)}`);
  }

  if (missingRequired.length > 0) {
    console.error(`\nMissing required metric(s), refusing a clean comparison: ${missingRequired.join(", ")}`);
    console.error("A missing decision metric is not the same as 0 — regenerate the eval JSON with the full summary.");
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
