import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadEnvConfig } from "@next/env";

import {
  capturedRagCaseToGoldenCase,
  evaluateGoldenRetrievalCase,
  loadGoldenRetrievalCases,
  summarizeGoldenRetrievalResults,
  type GoldenRetrievalResult,
} from "./eval-retrieval";
import { estimateCostUsd, findOwnerIdByEmail, loadAdminClient, percentile, validateRagAnswer } from "./eval-utils";
import {
  loadCapturedRagEvalCases,
  mergeRagEvalCases,
  selectRagEvalCases,
  type RagEvalCase,
  type SupabaseEvalCaseClient,
} from "@/lib/rag-eval-cases";
import type { RagAnswer } from "@/lib/types";

loadEnvConfig(process.cwd());

type EvalQualityArgs = {
  fixture: string;
  ownerEmail?: string;
  ownerId?: string;
  limit?: number;
  query?: string;
  question?: string;
  outputDir: string;
  json: boolean;
  failOnThreshold: boolean;
  retrievalOnly: boolean;
  ragOnly: boolean;
  skipPreflight: boolean;
};

export type RagQualityResult = {
  id: string;
  question: string;
  category: RagEvalCase["category"];
  supported: boolean;
  expectedHit: boolean;
  grounded: boolean;
  latencyMs: number;
  route: string;
  model: string | null;
  citations: number;
  visualEvidence: number;
  failures: string[];
  sourceWarningCount: number;
  unverifiedNumericTokenCount: number;
  hasFaithfulnessWarning: boolean;
  estimatedCostUsd: number | null;
};

export type QualityFailureCategory =
  | "query_class"
  | "expected_source"
  | "expected_content"
  | "table_evidence"
  | "grounding"
  | "unsupported_correctness"
  | "citation"
  | "visual_evidence"
  | "latency"
  | "numeric_grounding"
  | "source_governance"
  | "other";

export type EvalQualityReport = ReturnType<typeof buildEvalQualityReport>;

const qualityThresholds = {
  retrievalTopKHitRate: 0.8,
  retrievalDocumentRecallAt5: 0.8,
  retrievalContentRecallAt5: 0.8,
  ragGroundedSupportedRate: 0.9,
  ragUnsupportedCorrectRate: 1,
  ragCitationFailureRate: 0,
  numericGroundingFailureRate: 0,
  staleTopResultRate: 0.25,
  ragP95LatencyMs: 25_000,
};

function parseArgs(argv: string[]): EvalQualityArgs {
  const args: EvalQualityArgs = {
    fixture: join(process.cwd(), "scripts", "fixtures", "rag-retrieval-golden.json"),
    ownerEmail: process.env.RAG_EVAL_OWNER_EMAIL,
    ownerId: process.env.RAG_EVAL_OWNER_ID ?? process.env.LOCAL_NO_AUTH_OWNER_ID,
    outputDir: join(process.cwd(), "output", "evals"),
    json: false,
    failOnThreshold: false,
    retrievalOnly: false,
    ragOnly: false,
    skipPreflight: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;

    if (token === "--json") {
      args.json = true;
      continue;
    }
    if (token === "--fail-on-threshold") {
      args.failOnThreshold = true;
      continue;
    }
    if (token === "--retrieval-only") {
      args.retrievalOnly = true;
      continue;
    }
    if (token === "--rag-only") {
      args.ragOnly = true;
      continue;
    }
    if (token === "--skip-preflight") {
      args.skipPreflight = true;
      continue;
    }

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${token}`);
    index += 1;

    if (token === "--fixture") args.fixture = value;
    if (token === "--owner-email") args.ownerEmail = value;
    if (token === "--owner-id") args.ownerId = value;
    if (token === "--limit") args.limit = Number.parseInt(value, 10);
    if (token === "--query") args.query = value;
    if (token === "--question") args.question = value;
    if (token === "--output-dir") args.outputDir = value;
  }

  if (args.retrievalOnly && args.ragOnly) throw new Error("Use only one of --retrieval-only or --rag-only.");
  if (args.limit !== undefined && (!Number.isInteger(args.limit) || args.limit <= 0)) {
    throw new Error("--limit must be a positive integer.");
  }

  return args;
}

export function qualityFailureCategory(message: string): QualityFailureCategory {
  const normalized = message.toLowerCase();
  if (normalized.includes("query class")) return "query_class";
  if (normalized.includes("expected document") || normalized.includes("retrieved sources")) return "expected_source";
  if (normalized.includes("expected content")) return "expected_content";
  if (normalized.includes("table evidence") || normalized.includes("visual evidence")) {
    return normalized.includes("visual evidence") ? "visual_evidence" : "table_evidence";
  }
  if (normalized.includes("grounded answer")) return "grounding";
  if (normalized.includes("unsupported answer") || normalized.includes("false-positive"))
    return "unsupported_correctness";
  if (normalized.includes("citation")) return "citation";
  if (normalized.includes("latency")) return "latency";
  if (normalized.includes("numeric") || normalized.includes("faithfulness") || normalized.includes("verify against")) {
    return "numeric_grounding";
  }
  if (
    normalized.includes("source governance") ||
    normalized.includes("outdated") ||
    normalized.includes("unverified")
  ) {
    return "source_governance";
  }
  return "other";
}

function rate(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : Number((numerator / denominator).toFixed(4));
}

function failureCategoryCounts(results: Array<{ failures: string[] }>) {
  return results.reduce<Record<QualityFailureCategory, number>>(
    (counts, result) => {
      for (const failure of result.failures) {
        const category = qualityFailureCategory(failure);
        counts[category] = (counts[category] ?? 0) + 1;
      }
      return counts;
    },
    {} as Record<QualityFailureCategory, number>,
  );
}

function topResultGovernanceCounts(results: GoldenRetrievalResult[]) {
  let total = 0;
  let stale = 0;
  let reviewDue = 0;
  let unknown = 0;
  let unverified = 0;
  let poorExtraction = 0;

  for (const result of results) {
    for (const topResult of result.topResults) {
      total += 1;
      if (topResult.document_status === "outdated") stale += 1;
      if (topResult.document_status === "review_due") reviewDue += 1;
      if (!topResult.document_status || topResult.document_status === "unknown") unknown += 1;
      if (topResult.clinical_validation_status === "unverified") unverified += 1;
      if (topResult.extraction_quality === "poor") poorExtraction += 1;
    }
  }

  return {
    total_top_results: total,
    stale_top_results: stale,
    review_due_top_results: reviewDue,
    unknown_status_top_results: unknown,
    unverified_top_results: unverified,
    poor_extraction_top_results: poorExtraction,
    stale_rate: rate(stale + reviewDue + unknown, total),
  };
}

function summarizeRagQualityResults(results: RagQualityResult[]) {
  const supported = results.filter((result) => result.supported);
  const unsupported = results.filter((result) => !result.supported);
  const groundedSupported = supported.filter((result) => result.grounded).length;
  const unsupportedCorrect = unsupported.filter((result) => !result.grounded).length;
  const citationFailures = results.filter((result) =>
    result.failures.some((failure) => qualityFailureCategory(failure) === "citation"),
  );
  const numericFailures = results.filter(
    (result) =>
      result.unverifiedNumericTokenCount > 0 ||
      result.hasFaithfulnessWarning ||
      result.failures.some((failure) => qualityFailureCategory(failure) === "numeric_grounding"),
  );
  const latencies = results.map((result) => result.latencyMs);
  const estimatedCostUsd = results.some((result) => result.estimatedCostUsd === null)
    ? null
    : results.reduce((sum, result) => sum + (result.estimatedCostUsd ?? 0), 0);

  return {
    case_count: results.length,
    supported_count: supported.length,
    unsupported_count: unsupported.length,
    grounded_supported_rate: rate(groundedSupported, supported.length),
    unsupported_correct_rate: rate(unsupportedCorrect, unsupported.length),
    expected_hit_rate: rate(results.filter((result) => result.expectedHit).length, results.length),
    citation_failure_rate: rate(citationFailures.length, results.length),
    numeric_grounding_failure_rate: rate(numericFailures.length, results.length),
    source_warning_count: results.reduce((sum, result) => sum + result.sourceWarningCount, 0),
    median_latency_ms: percentile(latencies, 50),
    p95_latency_ms: percentile(latencies, 95),
    estimated_cost_usd: estimatedCostUsd === null ? null : Number(estimatedCostUsd.toFixed(6)),
    failure_category_counts: failureCategoryCounts(results),
    failed_cases: results.filter((result) => result.failures.length > 0),
  };
}

export function buildEvalQualityReport(args: {
  generatedAt?: string;
  retrievalResults: GoldenRetrievalResult[];
  ragResults: RagQualityResult[];
}) {
  const retrievalSummary = summarizeGoldenRetrievalResults(args.retrievalResults);
  const ragSummary = summarizeRagQualityResults(args.ragResults);
  const governance = topResultGovernanceCounts(args.retrievalResults);
  const thresholdFailures: string[] = [];

  if (args.retrievalResults.length > 0) {
    if (retrievalSummary.top_k_hit_rate < qualityThresholds.retrievalTopKHitRate) {
      thresholdFailures.push(
        `retrieval top_k_hit_rate ${retrievalSummary.top_k_hit_rate} below ${qualityThresholds.retrievalTopKHitRate}`,
      );
    }
    if (retrievalSummary.document_recall_at_5 < qualityThresholds.retrievalDocumentRecallAt5) {
      thresholdFailures.push(
        `retrieval document_recall_at_5 ${retrievalSummary.document_recall_at_5} below ${qualityThresholds.retrievalDocumentRecallAt5}`,
      );
    }
    if (retrievalSummary.content_recall_at_5 < qualityThresholds.retrievalContentRecallAt5) {
      thresholdFailures.push(
        `retrieval content_recall_at_5 ${retrievalSummary.content_recall_at_5} below ${qualityThresholds.retrievalContentRecallAt5}`,
      );
    }
    if (governance.stale_rate > qualityThresholds.staleTopResultRate) {
      thresholdFailures.push(
        `top-result stale/review/unknown rate ${governance.stale_rate} above ${qualityThresholds.staleTopResultRate}`,
      );
    }
  }

  if (args.ragResults.length > 0) {
    if (ragSummary.grounded_supported_rate < qualityThresholds.ragGroundedSupportedRate) {
      thresholdFailures.push(
        `RAG grounded_supported_rate ${ragSummary.grounded_supported_rate} below ${qualityThresholds.ragGroundedSupportedRate}`,
      );
    }
    if (
      ragSummary.unsupported_count > 0 &&
      ragSummary.unsupported_correct_rate < qualityThresholds.ragUnsupportedCorrectRate
    ) {
      thresholdFailures.push(
        `RAG unsupported_correct_rate ${ragSummary.unsupported_correct_rate} below ${qualityThresholds.ragUnsupportedCorrectRate}`,
      );
    }
    if (ragSummary.citation_failure_rate > qualityThresholds.ragCitationFailureRate) {
      thresholdFailures.push(`RAG citation_failure_rate ${ragSummary.citation_failure_rate} above 0`);
    }
    if (ragSummary.numeric_grounding_failure_rate > qualityThresholds.numericGroundingFailureRate) {
      thresholdFailures.push(`RAG numeric_grounding_failure_rate ${ragSummary.numeric_grounding_failure_rate} above 0`);
    }
    if (ragSummary.p95_latency_ms > qualityThresholds.ragP95LatencyMs) {
      thresholdFailures.push(
        `RAG p95_latency_ms ${ragSummary.p95_latency_ms} above ${qualityThresholds.ragP95LatencyMs}`,
      );
    }
  }

  return {
    generated_at: args.generatedAt ?? new Date().toISOString(),
    thresholds: qualityThresholds,
    retrieval: {
      summary: retrievalSummary,
      source_governance: governance,
      failure_category_counts: failureCategoryCounts(args.retrievalResults),
      results: args.retrievalResults,
    },
    rag: {
      summary: ragSummary,
      results: args.ragResults,
    },
    threshold_failures: thresholdFailures,
  };
}

function markdownTable(rows: Array<[string, string | number | null]>) {
  return [
    "| Metric | Value |",
    "| --- | --- |",
    ...rows.map(([metric, value]) => `| ${metric} | ${value ?? "n/a"} |`),
  ].join("\n");
}

export function renderEvalQualityMarkdown(report: EvalQualityReport) {
  const retrieval = report.retrieval.summary;
  const governance = report.retrieval.source_governance;
  const rag = report.rag.summary;
  const failures = report.threshold_failures.length
    ? report.threshold_failures.map((item) => `- ${item}`).join("\n")
    : "- None";
  const failedRetrieval = report.retrieval.summary.failed_cases
    .slice(0, 10)
    .map((item) => `- ${item.id}: ${item.failures.join("; ")}`)
    .join("\n");
  const failedRag = report.rag.summary.failed_cases
    .slice(0, 10)
    .map((item) => `- ${item.id}: ${item.failures.join("; ")}`)
    .join("\n");

  return `# Retrieval Quality Report

Generated: ${report.generated_at}

## Threshold Status

${failures}

## Retrieval Metrics

${markdownTable([
  ["Cases", retrieval.case_count],
  ["Hit@K", retrieval.top_k_hit_rate],
  ["Document recall@5", retrieval.document_recall_at_5],
  ["Content recall@5", retrieval.content_recall_at_5],
  ["MRR@10", retrieval.mrr_at_10],
  ["Median latency ms", retrieval.median_latency_ms],
  ["Failed cases", retrieval.failed_cases.length],
])}

## Retrieval Decision Metrics

${markdownTable([
  ["Embedding skipped rate", retrieval.embedding_skipped_rate],
  ["Median text candidate budget", retrieval.median_text_candidate_budget],
  ["Second-stage rerank rate", retrieval.second_stage_rerank_rate],
  ["Strategy counts", JSON.stringify(retrieval.retrieval_strategy_counts)],
  ["Embedding skip reasons", JSON.stringify(retrieval.embedding_skip_reason_counts)],
  ["Text fast-path reasons", JSON.stringify(retrieval.text_fast_path_reason_counts)],
])}

## Source Governance

${markdownTable([
  ["Top results", governance.total_top_results],
  ["Outdated top results", governance.stale_top_results],
  ["Review-due top results", governance.review_due_top_results],
  ["Unknown-status top results", governance.unknown_status_top_results],
  ["Unverified top results", governance.unverified_top_results],
  ["Poor-extraction top results", governance.poor_extraction_top_results],
  ["Stale/review/unknown rate", governance.stale_rate],
])}

## Answer Metrics

${markdownTable([
  ["Cases", rag.case_count],
  ["Grounded supported rate", rag.grounded_supported_rate],
  ["Unsupported correct rate", rag.unsupported_correct_rate],
  ["Expected source hit rate", rag.expected_hit_rate],
  ["Citation failure rate", rag.citation_failure_rate],
  ["Numeric grounding failure rate", rag.numeric_grounding_failure_rate],
  ["P95 latency ms", rag.p95_latency_ms],
  ["Estimated cost USD", rag.estimated_cost_usd],
])}

## Failing Retrieval Cases

${failedRetrieval || "- None"}

## Failing Answer Cases

${failedRag || "- None"}
`;
}

async function assertSafeToRunEvals(supabase: Awaited<ReturnType<typeof loadAdminClient>>) {
  const { probeSupabaseHealth } = await import("@/lib/supabase/health");
  const health = await probeSupabaseHealth(supabase);
  if (!health.ok) {
    throw new Error(`Supabase is unavailable. Do not run retrieval or RAG evals now: ${health.message}`);
  }
}

async function runRetrievalQualityCases(args: {
  fixture: string;
  ownerId?: string;
  limit?: number;
  query?: string;
  supabase: Awaited<ReturnType<typeof loadAdminClient>>;
}) {
  const [{ searchChunksWithTelemetry }, capturedCases] = await Promise.all([
    import("@/lib/rag"),
    loadCapturedRagEvalCases({
      supabase: args.supabase as unknown as SupabaseEvalCaseClient,
      ownerId: args.ownerId,
      limit: args.limit,
    }),
  ]);
  const allCases = [...capturedCases.map(capturedRagCaseToGoldenCase), ...loadGoldenRetrievalCases(args.fixture)];
  const filtered = args.query
    ? allCases.filter((item) => item.id === args.query || item.query.toLowerCase().includes(args.query!.toLowerCase()))
    : allCases;
  const cases = filtered.slice(0, args.limit ?? filtered.length);
  const results: GoldenRetrievalResult[] = [];

  for (const testCase of cases) {
    const startedAt = Date.now();
    const search = await searchChunksWithTelemetry({
      query: testCase.query,
      ownerId: args.ownerId,
      topK: testCase.topK,
      minSimilarity: 0.12,
      skipCache: true,
    });
    const latencyMs =
      (search.telemetry.supabase_rpc_latency_ms ?? 0) +
        (search.telemetry.embedding_latency_ms ?? 0) +
        (search.telemetry.rerank_latency_ms ?? 0) || Date.now() - startedAt;
    results.push(
      evaluateGoldenRetrievalCase({
        testCase,
        results: search.results,
        telemetry: search.telemetry,
        latencyMs,
      }),
    );
  }

  return results;
}

async function runRagQualityCases(args: {
  ownerId?: string;
  limit?: number;
  question?: string;
  supabase: Awaited<ReturnType<typeof loadAdminClient>>;
}) {
  const [{ answerQuestionWithScope }, capturedCases] = await Promise.all([
    import("@/lib/rag"),
    loadCapturedRagEvalCases({
      supabase: args.supabase as unknown as SupabaseEvalCaseClient,
      ownerId: args.ownerId,
      limit: args.limit,
    }),
  ]);
  const baseCases = selectRagEvalCases({ question: args.question });
  const allCases = args.question ? baseCases : mergeRagEvalCases(baseCases, capturedCases);
  const cases = allCases.slice(0, args.limit ?? allCases.length);
  const results: RagQualityResult[] = [];

  for (const testCase of cases) {
    const answer = (await answerQuestionWithScope({
      query: testCase.question,
      ownerId: args.ownerId,
      logQuery: false,
      skipCache: true,
    })) as RagAnswer;
    const validation = validateRagAnswer(testCase, answer);
    const failures = [...validation.failures];
    if ((answer.unverifiedNumericTokens?.length ?? 0) > 0 || answer.faithfulnessWarning) {
      failures.push("numeric faithfulness warning present");
    }
    if ((answer.sourceGovernanceWarnings?.length ?? 0) > 0) {
      failures.push("source governance warning present");
    }

    results.push({
      id: testCase.id,
      question: testCase.question,
      category: testCase.category,
      supported: testCase.supported,
      expectedHit: validation.expectedHit,
      grounded: answer.grounded,
      latencyMs: answer.latencyTimings?.total_latency_ms ?? 0,
      route: answer.routingMode ?? "none",
      model: answer.modelUsed ?? null,
      citations: answer.citations.length,
      visualEvidence: answer.visualEvidence?.length ?? 0,
      failures,
      sourceWarningCount: answer.sourceGovernanceWarnings?.length ?? 0,
      unverifiedNumericTokenCount: answer.unverifiedNumericTokens?.length ?? 0,
      hasFaithfulnessWarning: Boolean(answer.faithfulnessWarning),
      estimatedCostUsd: estimateCostUsd({
        inputTokens: answer.openAIUsage?.input_tokens ?? 0,
        cachedInputTokens: answer.openAIUsage?.cached_input_tokens ?? 0,
        outputTokens: answer.openAIUsage?.output_tokens ?? 0,
      }),
    });
  }

  return results;
}

async function writeReports(report: EvalQualityReport, outputDir: string) {
  await mkdir(outputDir, { recursive: true });
  const stamp = report.generated_at.replace(/[:.]/g, "-");
  const jsonPath = join(outputDir, `retrieval-quality-${stamp}.json`);
  const markdownPath = join(outputDir, `retrieval-quality-${stamp}.md`);
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8"),
    writeFile(markdownPath, renderEvalQualityMarkdown(report), "utf8"),
  ]);
  return { jsonPath, markdownPath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [{ requireOpenAIEnv, requireServerEnv }, supabase] = await Promise.all([
    import("@/lib/env"),
    loadAdminClient(),
  ]);

  requireServerEnv();
  requireOpenAIEnv();
  if (!args.skipPreflight) await assertSafeToRunEvals(supabase);

  const ownerId = args.ownerId ?? (args.ownerEmail ? await findOwnerIdByEmail(supabase, args.ownerEmail) : undefined);
  const [retrievalResults, ragResults] = await Promise.all([
    args.ragOnly ? Promise.resolve([]) : runRetrievalQualityCases({ ...args, ownerId, supabase }),
    args.retrievalOnly ? Promise.resolve([]) : runRagQualityCases({ ...args, ownerId, supabase }),
  ]);
  const report = buildEvalQualityReport({ retrievalResults, ragResults });
  const paths = await writeReports(report, args.outputDir);

  if (args.json) {
    console.log(JSON.stringify({ ...report, output: paths }, null, 2));
  } else {
    console.log(renderEvalQualityMarkdown(report));
    console.log(`Reports written:\n  JSON: ${paths.jsonPath}\n  Markdown: ${paths.markdownPath}`);
  }

  if (args.failOnThreshold && report.threshold_failures.length > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
