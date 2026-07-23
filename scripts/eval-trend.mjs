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
import { createHash } from "node:crypto";

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

function answerResults(payload) {
  return Array.isArray(payload?.rag?.results) ? payload.rag.results : [];
}

function answerFailureCategory(message) {
  const normalized = String(message ?? "").toLowerCase();
  if (normalized.includes("citation")) return "citation";
  if (normalized.includes("latency")) return "latency";
  if (normalized.includes("grounded answer")) return "grounding";
  if (normalized.includes("unsupported answer") || normalized.includes("false-positive")) {
    return "unsupported_correctness";
  }
  if (normalized.includes("expected document") || normalized.includes("retrieved sources")) return "expected_source";
  if (normalized.includes("expected content")) return "expected_content";
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

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function stableSignature(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

function answerFingerprints(result) {
  const categories = sortedUnique((result.failures ?? []).map(answerFailureCategory));
  const contentCategories = categories.filter((category) => category !== "latency");
  const routingReason = String(result.routingReason ?? "");
  const providerReason = /provider|generation_(?:fallback|failed|quality)|max_output_tokens|model_timeout/i.test(
    routingReason,
  )
    ? routingReason
    : "none";
  const content = {
    categories: contentCategories,
    grounded: Boolean(result.grounded),
    expectedHit: Boolean(result.expectedHit),
    citations: Number(result.citations ?? 0),
    missingFiles: sortedUnique(result.missingFiles ?? []),
    sourceDangerWarningCount: Number(result.sourceDangerWarningCount ?? 0),
    unverifiedNumericTokenCount: Number(result.unverifiedNumericTokenCount ?? 0),
    hasFaithfulnessWarning: Boolean(result.hasFaithfulnessWarning),
  };
  const provider = {
    route: result.route ?? "none",
    latencyRoute: result.latencyRoute ?? "none",
    providerReason,
    model: result.model ?? null,
    requestIdsPresent: (result.openAIRequestIds?.length ?? 0) > 0,
  };
  const latency = {
    latencyFailure: categories.includes("latency"),
    routeCeilingExceeded: Boolean(result.routeCeilingExceeded),
    routeDeadlineExceeded: Boolean(result.timings?.routeDeadlineExceeded),
    budgetExhaustedByRetrieval: Boolean(result.timings?.budgetExhaustedByRetrieval),
    latencyRoute: result.latencyRoute ?? "none",
  };
  return {
    content,
    provider,
    latency,
    diagnosticSignature: stableSignature({ content, provider, latency }),
  };
}

function allEqual(values) {
  return values.length > 0 && values.every((value) => value === values[0]);
}

function reportsUseSameTree(payloads) {
  const shas = payloads.map(({ payload }) => payload?.run_context?.git_sha ?? null);
  return shas.length > 1 && shas.every(Boolean) && allEqual(shas);
}

/**
 * Compare structured eval:quality reports without treating raw millisecond drift as a regression.
 * Content, provider/route, and latency-threshold outcomes receive separate stable fingerprints.
 */
export function buildAnswerQualityVariabilityRows(payloads) {
  const ids = sortedUnique(payloads.flatMap(({ payload }) => answerResults(payload).map((result) => result.id)));
  const sameTree = reportsUseSameTree(payloads);

  return ids.map((caseId) => {
    const matches = payloads.map(({ payload }) => answerResults(payload).find((result) => result.id === caseId));
    if (matches.some((result) => !result)) {
      return {
        case: caseId,
        classification: "missing_case",
        same_tree: sameTree,
        runs: matches.filter(Boolean).length,
        baseline_signature: matches[0] ? answerFingerprints(matches[0]).diagnosticSignature : null,
        latest_signature: matches.at(-1) ? answerFingerprints(matches.at(-1)).diagnosticSignature : null,
      };
    }

    const fingerprints = matches.map(answerFingerprints);
    const contentSignatures = fingerprints.map(({ content }) => stableSignature(content));
    const providerSignatures = fingerprints.map(({ provider }) => stableSignature(provider));
    const latencySignatures = fingerprints.map(({ latency }) => stableSignature(latency));
    const repeatedContentFailure =
      allEqual(contentSignatures) && fingerprints.every(({ content }) => content.categories.length > 0);
    let classification = "stable";
    if (!allEqual(contentSignatures)) classification = sameTree ? "same_tree_content_variability" : "content_change";
    else if (repeatedContentFailure) classification = "repeated_content_failure";
    else if (!allEqual(providerSignatures)) classification = "provider_route_variability";
    else if (!allEqual(latencySignatures)) classification = "latency_variability";

    return {
      case: caseId,
      classification,
      same_tree: sameTree,
      runs: matches.length,
      baseline_signature: fingerprints[0].diagnosticSignature,
      latest_signature: fingerprints.at(-1).diagnosticSignature,
    };
  });
}

/** Per-run answer diagnostics for one case; exported for focused offline investigation. */
export function buildAnswerQualityCaseTrend(payloads, caseId) {
  return payloads.map(({ label, payload }) => {
    const match = answerResults(payload).find((result) => result.id === caseId);
    const fingerprints = match ? answerFingerprints(match) : null;
    return {
      label,
      git_sha: payload?.run_context?.git_sha ?? null,
      found: Boolean(match),
      passed: match ? (match.failures?.length ?? 0) === 0 : null,
      route: match?.route ?? null,
      latency_route: match?.latencyRoute ?? null,
      total_ms: match?.latencyMs ?? null,
      diagnostic_signature: fingerprints?.diagnosticSignature ?? null,
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
  const answerQuality = argv.includes("--answer-quality");
  const caseFlag = argv.indexOf("--case");
  const caseId = caseFlag >= 0 ? argv[caseFlag + 1] : undefined;
  const files = argv.filter((arg, index) => arg !== "--case" && arg !== "--answer-quality" && index !== caseFlag + 1);
  if (!files.length) {
    console.error("Usage: eval-trend [--answer-quality] [--case <case-id>] <report.json...>  (oldest first)");
    process.exit(2);
  }
  const payloads = files.map((file) => ({ label: file, payload: JSON.parse(readFileSync(file, "utf8")) }));
  if (answerQuality) {
    console.log(formatTable(buildAnswerQualityVariabilityRows(payloads)));
    if (caseId) {
      console.log(`\nAnswer case trend: ${caseId}`);
      console.log(formatTable(buildAnswerQualityCaseTrend(payloads, caseId)));
    }
    return;
  }
  console.log(formatTable(buildTrendRows(payloads)));
  if (caseId) {
    console.log(`\nCase trend: ${caseId}`);
    console.log(formatTable(buildCaseTrend(payloads, caseId)));
  }
}

if (process.argv[1] && process.argv[1].endsWith("eval-trend.mjs")) main();
