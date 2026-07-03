import { mkdir, readFile, writeFile } from "node:fs/promises";
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
import {
  estimateCostUsd,
  findOwnerIdByEmail,
  loadAdminClient,
  percentile,
  validateRagAnswer,
  withProviderBackoff,
} from "./eval-utils";
import {
  loadCapturedRagEvalCases,
  mergeRagEvalCases,
  selectRagEvalCases,
  type RagEvalCase,
  type SupabaseEvalCaseClient,
} from "@/lib/rag-eval-cases";
import { sourceGovernanceWarnings } from "@/lib/source-governance";
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
  sourceMetadataDebt?: string;
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
  expectedFiles: string[];
  matchedFiles: string[];
  missingFiles: string[];
  topFiles: string[];
  expectedHit: boolean;
  grounded: boolean;
  latencyMs: number;
  route: string;
  model: string | null;
  citations: number;
  visualEvidence: number;
  failures: string[];
  sourceWarningCount: number;
  sourceDangerWarningCount: number;
  unverifiedNumericTokenCount: number;
  hasFaithfulnessWarning: boolean;
  routingReason?: string;
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

export type SourceMetadataDebtAcceptance = {
  path?: string;
  accepted_by: string;
  accepted_at: string;
  expires_at?: string;
  reason: string;
  max_stale_rate: number;
  max_review_required_rate: number;
  max_outdated_top_results: number;
  max_poor_extraction_top_results: number;
  max_source_governance_danger_failure_rate: number;
};

export function sourceWarningsForRagQualityAnswer(
  answer: Pick<RagAnswer, "sourceGovernanceWarnings" | "sources" | "relevance">,
) {
  return (
    answer.sourceGovernanceWarnings ??
    sourceGovernanceWarnings({ results: answer.sources, relevance: answer.relevance })
  );
}

export function deliveredGroundedAfterSourceGovernancePolicy(
  answer: Pick<RagAnswer, "grounded" | "confidence" | "responseMode">,
  warnings: Array<{ severity: string }>,
) {
  const shouldUseSourceGovernanceRefusal =
    answer.grounded !== false && answer.confidence !== "unsupported" && answer.responseMode !== "evidence_gap";
  if (shouldUseSourceGovernanceRefusal && warnings.some((warning) => warning.severity === "danger")) return false;
  return answer.grounded;
}

const qualityThresholds = {
  retrievalTopKHitRate: 0.8,
  retrievalDocumentRecallAt5: 0.8,
  retrievalContentRecallAt5: 0.8,
  ragGroundedSupportedRate: 0.9,
  ragUnsupportedCorrectRate: 1,
  ragCitationFailureRate: 0,
  numericGroundingFailureRate: 0,
  staleTopResultRate: 0.25,
  reviewRequiredTopResultRate: 0.25,
  ragP95LatencyMs: 25_000,
  ragRouteP95LatencyMs: {
    unsupported: 4_000,
    extractive: 12_000,
    fast: 25_000,
    strong: 35_000,
  } as Record<string, number>,
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
    if (token === "--source-metadata-debt") args.sourceMetadataDebt = value;
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

export function sourceGovernanceDangerFailuresForAnswer(args: {
  grounded: boolean;
  sourceDangerWarningCount: number;
  expectsDangerWarning?: boolean;
}): string[] {
  const failures: string[] = [];
  // A danger warning is a governance failure only when a grounded answer was
  // actually delivered on that sourcing. Declined answers carry the danger
  // warning as the expected refusal signal, not a failure. `grounded` is the
  // robust signal for "an answer was delivered": it covers both `unsupported`
  // routes and answers that a fast/strong/extractive route converted into an
  // evidence-gap refusal (finalizeRagAnswerQualityCore sets grounded=false
  // while preserving the original routingMode).
  if (args.grounded && args.sourceDangerWarningCount > 0) {
    failures.push("danger source governance warning present");
  }
  // Refusal-safety guard: exempting ungrounded answers above must not let a
  // refusal that is *expected* to surface a danger warning pass as clean when it
  // silently drops that warning. For cases flagged expectsSourceDangerWarning,
  // a missing danger warning is a failure regardless of grounded — otherwise a
  // regression that stops emitting the warning would keep the danger failure
  // rate at 0 and go undetected.
  if (args.expectsDangerWarning && args.sourceDangerWarningCount === 0) {
    failures.push("expected danger source governance warning missing");
  }
  return failures;
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

function isSourceMetadataDebtThresholdFailure(failure: string) {
  return failure.startsWith("top-result stale_rate") || failure.startsWith("top-result review_required_rate");
}

function isIsoDateString(value: string) {
  return !Number.isNaN(Date.parse(value));
}

function evaluateSourceMetadataDebtAcceptance(args: {
  acceptance?: SourceMetadataDebtAcceptance;
  thresholdFailures: string[];
  governance: ReturnType<typeof topResultGovernanceCounts>;
  ragSummary: ReturnType<typeof summarizeRagQualityResults>;
}) {
  const metadataFailures = args.thresholdFailures.filter(isSourceMetadataDebtThresholdFailure);
  const rejectionReasons: string[] = [];

  if (!args.acceptance) {
    return {
      status: "not_requested" as const,
      accepted_failures: [] as string[],
      rejection_reasons: rejectionReasons,
    };
  }

  const acceptance = args.acceptance;
  if (!acceptance.accepted_by.trim()) rejectionReasons.push("accepted_by is required");
  if (!acceptance.reason.trim()) rejectionReasons.push("reason is required");
  if (!isIsoDateString(acceptance.accepted_at)) rejectionReasons.push("accepted_at must be an ISO-compatible date");
  if (acceptance.expires_at) {
    if (!isIsoDateString(acceptance.expires_at)) {
      rejectionReasons.push("expires_at must be an ISO-compatible date");
    } else if (Date.parse(acceptance.expires_at) < Date.now()) {
      rejectionReasons.push(`acceptance expired at ${acceptance.expires_at}`);
    }
  }
  if (args.governance.stale_rate > acceptance.max_stale_rate) {
    rejectionReasons.push(
      `stale rate ${args.governance.stale_rate} exceeds accepted ceiling ${acceptance.max_stale_rate}`,
    );
  }
  if (args.governance.review_required_rate > acceptance.max_review_required_rate) {
    rejectionReasons.push(
      `review-required rate ${args.governance.review_required_rate} exceeds accepted ceiling ${acceptance.max_review_required_rate}`,
    );
  }
  if (args.governance.stale_top_results > acceptance.max_outdated_top_results) {
    rejectionReasons.push(
      `outdated top results ${args.governance.stale_top_results} exceeds accepted ceiling ${acceptance.max_outdated_top_results}`,
    );
  }
  if (args.governance.poor_extraction_top_results > acceptance.max_poor_extraction_top_results) {
    rejectionReasons.push(
      `poor-extraction top results ${args.governance.poor_extraction_top_results} exceeds accepted ceiling ${acceptance.max_poor_extraction_top_results}`,
    );
  }
  const acceptedFailures = rejectionReasons.length === 0 ? metadataFailures : [];
  return {
    status: rejectionReasons.length > 0 ? ("rejected" as const) : ("accepted" as const),
    path: acceptance.path,
    accepted_by: acceptance.accepted_by,
    accepted_at: acceptance.accepted_at,
    expires_at: acceptance.expires_at,
    reason: acceptance.reason,
    accepted_failures: acceptedFailures,
    rejection_reasons: rejectionReasons,
  };
}

function topResultGovernanceCounts(results: GoldenRetrievalResult[]) {
  let total = 0;
  let stale = 0;
  let reviewDue = 0;
  let unknown = 0;
  let unverified = 0;
  let unknownExtraction = 0;
  let poorExtraction = 0;
  let reviewRequired = 0;

  for (const result of results) {
    for (const topResult of result.topResults) {
      total += 1;
      const status = topResult.document_status ?? "unknown";
      const validation = topResult.clinical_validation_status ?? "unverified";
      const extraction = topResult.extraction_quality ?? "unknown";
      if (status === "outdated") stale += 1;
      if (status === "review_due") reviewDue += 1;
      if (status === "unknown") unknown += 1;
      if (validation === "unverified") unverified += 1;
      if (extraction === "unknown") unknownExtraction += 1;
      if (extraction === "poor") poorExtraction += 1;
      if (
        status === "outdated" ||
        status === "review_due" ||
        status === "unknown" ||
        validation === "unverified" ||
        extraction === "unknown" ||
        extraction === "poor"
      ) {
        reviewRequired += 1;
      }
    }
  }

  return {
    total_top_results: total,
    stale_top_results: stale,
    review_due_top_results: reviewDue,
    unknown_status_top_results: unknown,
    unverified_top_results: unverified,
    unknown_extraction_top_results: unknownExtraction,
    poor_extraction_top_results: poorExtraction,
    stale_rate: rate(stale, total),
    stale_review_unknown_rate: rate(stale + reviewDue + unknown, total),
    review_required_top_results: reviewRequired,
    review_required_rate: rate(reviewRequired, total),
    metadata_policy:
      "unknown, unverified, review_due, outdated, unknown extraction, and poor extraction metadata are treated as review-required; do not silently default them to current or approved.",
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
  const sourceGovernanceWarnings = results.filter((result) => result.sourceWarningCount > 0);
  const sourceGovernanceDangerFailures = results.filter(
    (result) => result.grounded && result.sourceDangerWarningCount > 0,
  );
  const expectedDangerWarningMissing = results.filter((result) =>
    result.failures.includes("expected danger source governance warning missing"),
  ).length;
  const latencies = results.map((result) => result.latencyMs);
  const routeLatencyP95 = Object.fromEntries(
    Array.from(
      results.reduce((accumulator, result) => {
        const current = accumulator.get(result.route) ?? [];
        current.push(result.latencyMs);
        accumulator.set(result.route, current);
        return accumulator;
      }, new Map<string, number[]>()),
    ).map(([route, routeLatencies]) => [route, percentile(routeLatencies, 95)]),
  );
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
    source_governance_warning_rate: rate(sourceGovernanceWarnings.length, results.length),
    source_governance_danger_failure_rate: rate(sourceGovernanceDangerFailures.length, results.length),
    expected_danger_warning_missing_count: expectedDangerWarningMissing,
    median_latency_ms: percentile(latencies, 50),
    p95_latency_ms: percentile(latencies, 95),
    route_p95_latency_ms: routeLatencyP95,
    estimated_cost_usd: estimatedCostUsd === null ? null : Number(estimatedCostUsd.toFixed(6)),
    failure_category_counts: failureCategoryCounts(results),
    failed_cases: results.filter((result) => result.failures.length > 0),
  };
}

export function buildEvalQualityReport(args: {
  generatedAt?: string;
  retrievalResults: GoldenRetrievalResult[];
  ragResults: RagQualityResult[];
  sourceMetadataDebtAcceptance?: SourceMetadataDebtAcceptance;
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
        `top-result stale_rate ${governance.stale_rate} above ${qualityThresholds.staleTopResultRate}`,
      );
    }
    if (governance.review_required_rate > qualityThresholds.reviewRequiredTopResultRate) {
      thresholdFailures.push(
        `top-result review_required_rate ${governance.review_required_rate} above ${qualityThresholds.reviewRequiredTopResultRate}`,
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
    if (ragSummary.source_governance_danger_failure_rate > 0) {
      thresholdFailures.push(
        `RAG source_governance_danger_failure_rate ${ragSummary.source_governance_danger_failure_rate} above 0`,
      );
    }
    if (ragSummary.expected_danger_warning_missing_count > 0) {
      // A refusal that was expected to surface a danger warning dropped it. This
      // is a refusal-safety regression and hard-blocks release — it is never
      // waivable via the source-metadata debt acceptance below.
      thresholdFailures.push(
        `RAG expected_danger_warning_missing_count ${ragSummary.expected_danger_warning_missing_count} above 0`,
      );
    }
    if (ragSummary.p95_latency_ms > qualityThresholds.ragP95LatencyMs) {
      thresholdFailures.push(
        `RAG p95_latency_ms ${ragSummary.p95_latency_ms} above ${qualityThresholds.ragP95LatencyMs}`,
      );
    }
    for (const [route, maxP95] of Object.entries(qualityThresholds.ragRouteP95LatencyMs)) {
      const routeP95 = ragSummary.route_p95_latency_ms?.[route];
      if (typeof routeP95 === "number" && routeP95 > maxP95) {
        thresholdFailures.push(`RAG route ${route} p95_latency_ms ${routeP95} above ${maxP95}`);
      }
    }
  }

  const sourceMetadataDebtAcceptance = evaluateSourceMetadataDebtAcceptance({
    acceptance: args.sourceMetadataDebtAcceptance,
    thresholdFailures,
    governance,
    ragSummary,
  });
  const acceptedThresholdFailures = new Set(sourceMetadataDebtAcceptance.accepted_failures);
  const blockingThresholdFailures = thresholdFailures.filter((failure) => !acceptedThresholdFailures.has(failure));

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
    accepted_threshold_failures: sourceMetadataDebtAcceptance.accepted_failures,
    blocking_threshold_failures: blockingThresholdFailures,
    source_metadata_debt_acceptance: sourceMetadataDebtAcceptance,
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
  const blockingFailures = report.blocking_threshold_failures.length
    ? report.blocking_threshold_failures.map((item) => `- ${item}`).join("\n")
    : "- None";
  const acceptedFailures = report.accepted_threshold_failures.length
    ? report.accepted_threshold_failures.map((item) => `- ${item}`).join("\n")
    : "- None";
  const debtAcceptance = report.source_metadata_debt_acceptance;
  const debtAcceptanceRows =
    debtAcceptance.status === "not_requested"
      ? markdownTable([["Status", "not_requested"]])
      : markdownTable([
          ["Status", debtAcceptance.status],
          ["Accepted by", debtAcceptance.accepted_by ?? "n/a"],
          ["Accepted at", debtAcceptance.accepted_at ?? "n/a"],
          ["Expires at", debtAcceptance.expires_at ?? "n/a"],
          ["Path", debtAcceptance.path ?? "n/a"],
          ["Reason", debtAcceptance.reason ?? "n/a"],
          ["Rejection reasons", debtAcceptance.rejection_reasons.join("; ") || "none"],
        ]);
  const failedRetrieval = report.retrieval.summary.failed_cases
    .slice(0, 10)
    .map(
      (item) =>
        `- ${item.id}: ${item.failures.join("; ")}\n  Expected documents: ${
          item.expectedDocumentSubstrings.join(", ") || "none"
        }; missing: ${item.missingDocumentSubstrings.join(", ") || "none"}\n  Expected content: ${
          item.expectedContentTerms.join(", ") || "none"
        }; missing content: ${item.missingContentTerms.join(", ") || "none"}\n  Actual top files: ${
          item.topResults
            .slice(0, 5)
            .map((source) => `${source.rank}:${source.file_name}`)
            .join(" | ") || "none"
        }`,
    )
    .join("\n");
  const failedRag = report.rag.summary.failed_cases
    .slice(0, 10)
    .map(
      (item) =>
        `- ${item.id}: ${item.failures.join("; ")}\n  Expected files: ${
          item.expectedFiles.join(", ") || "none"
        }; missing: ${item.missingFiles.join(", ") || "none"}\n  Actual top files: ${
          item.topFiles.join(" | ") || "none"
        }\n  route=${item.route} grounded=${item.grounded} citations=${item.citations} numericWarnings=${
          item.unverifiedNumericTokenCount
        } faithfulnessWarning=${item.hasFaithfulnessWarning ? "yes" : "no"} sourceWarnings=${item.sourceWarningCount}`,
    )
    .join("\n");

  return `# Retrieval Quality Report

Generated: ${report.generated_at}

## Threshold Status

Blocking failures:

${blockingFailures}

Accepted metadata-debt failures:

${acceptedFailures}

All threshold failures:

${failures}

## Source Metadata Debt Acceptance

${debtAcceptanceRows}

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
  ["Unknown-extraction top results", governance.unknown_extraction_top_results],
  ["Poor-extraction top results", governance.poor_extraction_top_results],
  ["Stale rate", governance.stale_rate],
  ["Stale/review/unknown rate", governance.stale_review_unknown_rate],
  ["Review-required top results", governance.review_required_top_results],
  ["Review-required rate", governance.review_required_rate],
])}

Policy: ${governance.metadata_policy}

## Answer Metrics

${markdownTable([
  ["Cases", rag.case_count],
  ["Grounded supported rate", rag.grounded_supported_rate],
  ["Unsupported correct rate", rag.unsupported_correct_rate],
  ["Expected source hit rate", rag.expected_hit_rate],
  ["Citation failure rate", rag.citation_failure_rate],
  ["Numeric grounding failure rate", rag.numeric_grounding_failure_rate],
  ["Source governance warning rate", rag.source_governance_warning_rate],
  ["Source governance danger failure rate", rag.source_governance_danger_failure_rate],
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
    const search = await withProviderBackoff(`quality-retrieval:${testCase.id}`, () =>
      searchChunksWithTelemetry({
        query: testCase.query,
        ownerId: args.ownerId,
        topK: testCase.topK,
        minSimilarity: 0.12,
        skipCache: true,
        forceEmbedding: testCase.forceEmbedding,
      }),
    );
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
    const answer = (await withProviderBackoff(`quality-rag:${testCase.id}`, () =>
      answerQuestionWithScope({
        query: testCase.question,
        ownerId: args.ownerId,
        logQuery: false,
        skipCache: true,
      }),
    )) as RagAnswer;
    const validation = validateRagAnswer(testCase, answer);
    const failures = [...validation.failures];
    const sourceWarnings = sourceWarningsForRagQualityAnswer(answer);
    const sourceDangerWarningCount = sourceWarnings.filter((warning) => warning.severity === "danger").length;
    const deliveredGrounded = deliveredGroundedAfterSourceGovernancePolicy(answer, sourceWarnings);
    failures.push(
      ...sourceGovernanceDangerFailuresForAnswer({
        grounded: deliveredGrounded,
        sourceDangerWarningCount,
        expectsDangerWarning: testCase.expectsSourceDangerWarning,
      }),
    );

    results.push({
      id: testCase.id,
      question: testCase.question,
      category: testCase.category,
      supported: testCase.supported,
      expectedFiles: validation.expectedCoverage.expectedFiles,
      matchedFiles: validation.expectedCoverage.matchedFiles,
      missingFiles: validation.expectedCoverage.missingFiles,
      topFiles: answer.sources.slice(0, 5).map((source) => source.file_name),
      expectedHit: validation.expectedHit,
      grounded: deliveredGrounded,
      latencyMs: answer.latencyTimings?.total_latency_ms ?? 0,
      route: answer.routingMode ?? "none",
      model: answer.modelUsed ?? null,
      citations: answer.citations.length,
      visualEvidence: answer.visualEvidence?.length ?? 0,
      failures,
      sourceWarningCount: sourceWarnings.length,
      sourceDangerWarningCount,
      unverifiedNumericTokenCount: answer.unverifiedNumericTokens?.length ?? 0,
      hasFaithfulnessWarning: Boolean(answer.faithfulnessWarning),
      routingReason: answer.routingReason,
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

function asRecord(value: unknown, label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requiredString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`source metadata debt ${key} is required.`);
  return value;
}

function optionalString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim()) throw new Error(`source metadata debt ${key} must be a string.`);
  return value;
}

function requiredNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`source metadata debt ${key} must be a finite number.`);
  }
  return value;
}

async function loadSourceMetadataDebtAcceptance(path: string): Promise<SourceMetadataDebtAcceptance> {
  const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
  const record = asRecord(parsed, "source metadata debt acceptance");
  const ceilings = asRecord(record.ceilings, "source metadata debt acceptance ceilings");

  if (record.accepted !== true) {
    throw new Error("source metadata debt acceptance must set accepted to true.");
  }

  return {
    path,
    accepted_by: requiredString(record, "accepted_by"),
    accepted_at: requiredString(record, "accepted_at"),
    expires_at: optionalString(record, "expires_at"),
    reason: requiredString(record, "reason"),
    max_stale_rate: requiredNumber(ceilings, "max_stale_rate"),
    max_review_required_rate: requiredNumber(ceilings, "max_review_required_rate"),
    max_outdated_top_results: requiredNumber(ceilings, "max_outdated_top_results"),
    max_poor_extraction_top_results: requiredNumber(ceilings, "max_poor_extraction_top_results"),
    max_source_governance_danger_failure_rate: requiredNumber(ceilings, "max_source_governance_danger_failure_rate"),
  };
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
  const sourceMetadataDebtAcceptance = args.sourceMetadataDebt
    ? await loadSourceMetadataDebtAcceptance(args.sourceMetadataDebt)
    : undefined;

  const ownerId = args.ownerId ?? (args.ownerEmail ? await findOwnerIdByEmail(supabase, args.ownerEmail) : undefined);
  const retrievalResults = args.ragOnly ? [] : await runRetrievalQualityCases({ ...args, ownerId, supabase });
  const ragResults = args.retrievalOnly ? [] : await runRagQualityCases({ ...args, ownerId, supabase });
  const report = buildEvalQualityReport({ retrievalResults, ragResults, sourceMetadataDebtAcceptance });
  const paths = await writeReports(report, args.outputDir);

  if (args.json) {
    console.log(JSON.stringify({ ...report, output: paths }, null, 2));
  } else {
    console.log(renderEvalQualityMarkdown(report));
    console.log(`Reports written:\n  JSON: ${paths.jsonPath}\n  Markdown: ${paths.markdownPath}`);
  }

  if (args.failOnThreshold && report.blocking_threshold_failures.length > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
