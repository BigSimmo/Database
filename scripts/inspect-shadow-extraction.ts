import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
import type { ShadowExtractionOutcome, ShadowExtractionRecord } from "../worker/shadow-extraction";

loadEnvConfig(process.cwd());

export interface ShadowExtractionInspectionOptions {
  hours?: number;
  thresholdPct?: number;
  inputFile?: string;
  useStdin?: boolean;
  jsonOutput?: boolean;
}

export interface ShadowExtractionSummary {
  window_hours: number;
  threshold_pct: number;
  total_records: number;
  attempted_cohort_runs: number;
  outcome_counts: Record<ShadowExtractionOutcome | string, number>;
  timeout_count: number;
  timeout_rate_pct: number;
  threshold_breached: boolean;
  runtime_unavailable_count: number;
  process_error_count: number;
  wall_ms_stats: {
    min: number | null;
    p50: number | null;
    p90: number | null;
    p95: number | null;
    max: number | null;
    avg: number | null;
  };
  peak_rss_stats: {
    max_bytes: number | null;
    p95_bytes: number | null;
    avg_bytes: number | null;
    max_gib: number | null;
  };
  delta_averages: {
    text_character_ratio: number | null;
    numeric_token_ratio: number | null;
    page_count_delta: number | null;
    table_count_delta: number | null;
  };
  status: "HEALTHY" | "ROLLBACK_RECOMMENDED" | "NO_DATA" | "WARNING";
  reasons: string[];
}

function calculatePercentile(values: number[], percentile: number): number | null {
  if (values.length === 0) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const clampedPercentile = Math.max(0, Math.min(100, percentile));
  const index = (clampedPercentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  if (lower === upper) return sorted[lower];
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

function arrayMin(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((min, val) => (val < min ? val : min), values[0]);
}

function arrayMax(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((max, val) => (val > max ? val : max), values[0]);
}

export function extractShadowRecords(rawItems: unknown[]): ShadowExtractionRecord[] {
  if (!Array.isArray(rawItems)) return [];
  const records: ShadowExtractionRecord[] = [];
  for (const item of rawItems) {
    if (!item || typeof item !== "object") continue;
    const doc = item as Record<string, unknown>;
    if ("metadata" in doc && doc.metadata && typeof doc.metadata === "object") {
      const meta = doc.metadata as Record<string, unknown>;
      if (meta.shadow_extraction && typeof meta.shadow_extraction === "object") {
        const shadow = meta.shadow_extraction as Record<string, unknown>;
        if (typeof shadow.outcome === "string" && shadow.outcome) {
          records.push(shadow as unknown as ShadowExtractionRecord);
          continue;
        }
      }
    }
    if (typeof doc.outcome === "string" && doc.outcome && "extractor" in doc && doc.extractor === "docling") {
      records.push(doc as unknown as ShadowExtractionRecord);
    }
  }
  return records;
}

export function analyzeShadowRecords(
  records: ShadowExtractionRecord[],
  options: { hours?: number; thresholdPct?: number } = {},
): ShadowExtractionSummary {
  const hours = typeof options.hours === "number" && Number.isFinite(options.hours) ? options.hours : 24;
  const thresholdPct =
    typeof options.thresholdPct === "number" && Number.isFinite(options.thresholdPct) ? options.thresholdPct : 10;

  const outcomeCounts: Record<string, number> = {
    ok: 0,
    runtime_unavailable: 0,
    process_error: 0,
    skipped_concurrent: 0,
    timeout: 0,
    skipped_page_cap: 0,
    extraction_failed: 0,
  };

  const wallMsValues: number[] = [];
  const peakRssValues: number[] = [];
  const textCharRatios: number[] = [];
  const numTokenRatios: number[] = [];
  const pageDeltas: number[] = [];
  const tableDeltas: number[] = [];

  const safeRecords = Array.isArray(records) ? records : [];

  let processedCount = 0;
  for (const record of safeRecords) {
    if (!record || typeof record !== "object" || Object.keys(record).length === 0) continue;
    processedCount += 1;

    const outcome = typeof record.outcome === "string" && record.outcome ? record.outcome : "unknown";
    outcomeCounts[outcome] = (outcomeCounts[outcome] ?? 0) + 1;

    if (typeof record.wall_ms === "number" && Number.isFinite(record.wall_ms)) {
      wallMsValues.push(record.wall_ms);
    }
    if (typeof record.peak_rss_bytes === "number" && Number.isFinite(record.peak_rss_bytes)) {
      peakRssValues.push(record.peak_rss_bytes);
    }
    if (record.delta && typeof record.delta === "object") {
      if (typeof record.delta.text_character_ratio === "number" && Number.isFinite(record.delta.text_character_ratio)) {
        textCharRatios.push(record.delta.text_character_ratio);
      }
      if (typeof record.delta.numeric_token_ratio === "number" && Number.isFinite(record.delta.numeric_token_ratio)) {
        numTokenRatios.push(record.delta.numeric_token_ratio);
      }
      if (typeof record.delta.page_count === "number" && Number.isFinite(record.delta.page_count)) {
        pageDeltas.push(record.delta.page_count);
      }
      if (typeof record.delta.table_count === "number" && Number.isFinite(record.delta.table_count)) {
        tableDeltas.push(record.delta.table_count);
      }
    }
  }

  const totalRecords = processedCount;
  const skippedCount = (outcomeCounts.skipped_page_cap ?? 0) + (outcomeCounts.skipped_concurrent ?? 0);
  const attemptedRuns = Math.max(0, totalRecords - skippedCount);
  const timeoutCount = outcomeCounts.timeout ?? 0;
  const timeoutRatePct = attemptedRuns > 0 ? (timeoutCount / attemptedRuns) * 100 : 0;
  const thresholdBreached = timeoutRatePct > thresholdPct;
  const runtimeUnavailableCount = outcomeCounts.runtime_unavailable ?? 0;
  const processErrorCount = outcomeCounts.process_error ?? 0;

  const maxPeakBytes = arrayMax(peakRssValues);
  const maxPeakGib = maxPeakBytes !== null ? maxPeakBytes / (1024 * 1024 * 1024) : null;

  const reasons: string[] = [];
  let status: ShadowExtractionSummary["status"] = "HEALTHY";

  if (totalRecords === 0) {
    status = "NO_DATA";
    reasons.push("No shadow extraction records found in the evaluated window.");
  } else {
    if (thresholdBreached) {
      status = "ROLLBACK_RECOMMENDED";
      reasons.push(
        `Timeout rate ${timeoutRatePct.toFixed(1)}% exceeds the ${thresholdPct}% rollback threshold (${timeoutCount}/${attemptedRuns} attempted runs timed out).`,
      );
    }
    if (runtimeUnavailableCount > 0) {
      if (status !== "ROLLBACK_RECOMMENDED") status = "ROLLBACK_RECOMMENDED";
      reasons.push(
        `Runtime unavailable recorded on ${runtimeUnavailableCount} runs (Docling Python environment missing or broken).`,
      );
    }
    if (processErrorCount > 0) {
      if (status === "HEALTHY") status = "WARNING";
      reasons.push(`Process errors recorded on ${processErrorCount} runs.`);
    }
    if (maxPeakGib !== null && maxPeakGib > 2.0) {
      if (status === "HEALTHY") status = "WARNING";
      reasons.push(`Peak RSS exceeded 2.0 GiB (${maxPeakGib.toFixed(2)} GiB observed).`);
    }
    if (reasons.length === 0) {
      reasons.push("All shadow extraction health checks and metrics within normal parameters.");
    }
  }

  return {
    window_hours: hours,
    threshold_pct: thresholdPct,
    total_records: totalRecords,
    attempted_cohort_runs: attemptedRuns,
    outcome_counts: outcomeCounts,
    timeout_count: timeoutCount,
    timeout_rate_pct: Math.round(timeoutRatePct * 100) / 100,
    threshold_breached: thresholdBreached,
    runtime_unavailable_count: runtimeUnavailableCount,
    process_error_count: processErrorCount,
    wall_ms_stats: {
      min: arrayMin(wallMsValues),
      p50: calculatePercentile(wallMsValues, 50),
      p90: calculatePercentile(wallMsValues, 90),
      p95: calculatePercentile(wallMsValues, 95),
      max: arrayMax(wallMsValues),
      avg: average(wallMsValues),
    },
    peak_rss_stats: {
      max_bytes: maxPeakBytes,
      p95_bytes: calculatePercentile(peakRssValues, 95),
      avg_bytes: average(peakRssValues),
      max_gib: maxPeakGib !== null ? Math.round(maxPeakGib * 1000) / 1000 : null,
    },
    delta_averages: {
      text_character_ratio: average(textCharRatios),
      numeric_token_ratio: average(numTokenRatios),
      page_count_delta: average(pageDeltas),
      table_count_delta: average(tableDeltas),
    },
    status,
    reasons,
  };
}

export function formatSummaryReport(summary: ShadowExtractionSummary): string {
  const lines: string[] = [];
  lines.push("================================================================================");
  lines.push(`  SHADOW EXTRACTION HEALTH REPORT (${summary.window_hours}h window)`);
  lines.push("================================================================================");
  lines.push(`Status: ${summary.status}`);
  lines.push(`Total Records: ${summary.total_records} (Attempted runs: ${summary.attempted_cohort_runs})`);
  lines.push("");
  lines.push("Outcome Breakdown:");
  for (const [outcome, count] of Object.entries(summary.outcome_counts)) {
    if (count > 0 || ["ok", "timeout", "runtime_unavailable", "process_error"].includes(outcome)) {
      lines.push(`  - ${outcome.padEnd(22)}: ${count}`);
    }
  }
  lines.push("");
  lines.push(`Timeout Rate: ${summary.timeout_rate_pct.toFixed(2)}% (Threshold: ${summary.threshold_pct}%)`);
  lines.push(`Threshold Breached: ${summary.threshold_breached ? "YES (ROLLBACK TRIGGERED)" : "NO"}`);
  lines.push("");

  if (summary.wall_ms_stats.max !== null) {
    lines.push("Wall Clock Duration (ms):");
    lines.push(`  - Min: ${summary.wall_ms_stats.min} ms`);
    lines.push(`  - P50: ${summary.wall_ms_stats.p50?.toFixed(0)} ms`);
    lines.push(`  - P90: ${summary.wall_ms_stats.p90?.toFixed(0)} ms`);
    lines.push(`  - P95: ${summary.wall_ms_stats.p95?.toFixed(0)} ms`);
    lines.push(`  - Max: ${summary.wall_ms_stats.max} ms`);
    lines.push(`  - Avg: ${summary.wall_ms_stats.avg?.toFixed(0)} ms`);
    lines.push("");
  }

  if (summary.peak_rss_stats.max_bytes !== null) {
    lines.push("Peak RSS Memory:");
    lines.push(
      `  - Max: ${(summary.peak_rss_stats.max_bytes / (1024 * 1024)).toFixed(1)} MiB (${summary.peak_rss_stats.max_gib?.toFixed(3)} GiB)`,
    );
    lines.push(`  - P95: ${((summary.peak_rss_stats.p95_bytes ?? 0) / (1024 * 1024)).toFixed(1)} MiB`);
    lines.push("");
  }

  const hasDeltaAverages =
    summary.delta_averages.text_character_ratio !== null ||
    summary.delta_averages.numeric_token_ratio !== null ||
    summary.delta_averages.page_count_delta !== null ||
    summary.delta_averages.table_count_delta !== null;

  if (hasDeltaAverages) {
    lines.push("Parity Delta Averages vs Legacy:");
    lines.push(
      `  - Text Character Ratio : ${summary.delta_averages.text_character_ratio !== null ? summary.delta_averages.text_character_ratio.toFixed(4) : "N/A"}`,
    );
    lines.push(`  - Numeric Token Ratio  : ${summary.delta_averages.numeric_token_ratio?.toFixed(4) ?? "N/A"}`);
    lines.push(`  - Page Count Delta     : ${summary.delta_averages.page_count_delta?.toFixed(2) ?? "0"}`);
    lines.push(`  - Table Count Delta    : ${summary.delta_averages.table_count_delta?.toFixed(2) ?? "0"}`);
    lines.push("");
  }

  lines.push("Findings & Diagnostics:");
  for (const reason of summary.reasons) {
    lines.push(`  * ${reason}`);
  }
  lines.push("================================================================================");
  return lines.join("\n");
}

function parseCliArgs(args: string[]): ShadowExtractionInspectionOptions & { help?: boolean } {
  const options: ShadowExtractionInspectionOptions & { help?: boolean } = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--hours" && i + 1 < args.length) {
      const val = Number(args[++i]);
      if (Number.isFinite(val)) options.hours = val;
    } else if (arg === "--threshold" && i + 1 < args.length) {
      const val = Number(args[++i]);
      if (Number.isFinite(val)) options.thresholdPct = val;
    } else if ((arg === "--file" || arg === "--input") && i + 1 < args.length) {
      options.inputFile = args[++i];
    } else if (arg === "--stdin") {
      options.useStdin = true;
    } else if (arg === "--json") {
      options.jsonOutput = true;
    }
  }
  return options;
}

export function printHelp(): void {
  console.log(`
Usage:
  node --loader ts-node/esm scripts/inspect-shadow-extraction.ts [options]
  npx tsx scripts/inspect-shadow-extraction.ts [options]

Options:
  -h, --help            Show this help message and exit
  --hours <number>      Hours window to inspect (default: 24)
  --threshold <number>  Timeout percentage threshold for rollback alert (default: 10)
  --file, --input <file>Read JSON records from file instead of querying Supabase
  --stdin               Read JSON records from standard input
  --json                Output results as JSON instead of human-readable report

Examples:
  npx tsx scripts/inspect-shadow-extraction.ts --hours 48
  npx tsx scripts/inspect-shadow-extraction.ts --file test-records.json --threshold 10
`);
}

async function loadFromDatabase(hours: number): Promise<unknown[]> {
  const { createAdminClient } = await import("../src/lib/supabase/admin");
  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("documents")
    .select("id,metadata")
    .not("metadata->shadow_extraction", "is", null)
    .gt("metadata->shadow_extraction->>measured_at", cutoff);

  if (error) {
    throw new Error(`Supabase query failed: ${error.message}`);
  }
  return data ?? [];
}

export interface ShadowExtractionCliIO {
  readStdin?: () => string;
  loadDb?: (hours: number) => Promise<unknown[]>;
}

export async function runCli(args = process.argv.slice(2), io: ShadowExtractionCliIO = {}): Promise<number> {
  const options = parseCliArgs(args);

  if (options.help) {
    printHelp();
    return 0;
  }

  let rawItems: unknown[] = [];

  if (options.inputFile) {
    try {
      const content = readFileSync(resolve(options.inputFile), "utf8");
      const parsed = JSON.parse(content);
      rawItems = Array.isArray(parsed) ? parsed : [parsed];
    } catch (err) {
      console.error(`Failed to read input file ${options.inputFile}:`, err);
      return 1;
    }
  } else if (options.useStdin) {
    try {
      const content = io.readStdin ? io.readStdin() : readFileSync(0, "utf8");
      const parsed = JSON.parse(content);
      rawItems = Array.isArray(parsed) ? parsed : [parsed];
    } catch (err) {
      console.error("Failed to read JSON from stdin:", err);
      return 1;
    }
  } else {
    try {
      rawItems = io.loadDb ? await io.loadDb(options.hours ?? 24) : await loadFromDatabase(options.hours ?? 24);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `[inspect-shadow-extraction] Live database query unavailable: ${message}.\n` +
          `Provide offline fixture data via --file <path> or check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.`,
      );
      // Fail gracefully with NO_DATA summary when DB is offline
      const summary = analyzeShadowRecords([], options);
      if (options.jsonOutput) {
        console.log(JSON.stringify(summary, null, 2));
      } else {
        console.log(formatSummaryReport(summary));
      }
      return 0;
    }
  }

  const records = extractShadowRecords(rawItems);
  const summary = analyzeShadowRecords(records, options);

  if (options.jsonOutput) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(formatSummaryReport(summary));
  }

  return summary.status === "ROLLBACK_RECOMMENDED" ? 2 : 0;
}

if (process.argv[1] && process.argv[1].endsWith("inspect-shadow-extraction.ts")) {
  runCli().then((code) => {
    if (code !== 0 && code !== 2) {
      process.exit(code);
    }
  });
}
