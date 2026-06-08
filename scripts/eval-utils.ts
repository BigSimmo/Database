import type { RagEvalCase } from "@/lib/rag-eval-cases";
import type { RagAnswer, SearchResult, VisualEvidenceCard } from "@/lib/types";

export type SupabaseAdmin = Awaited<ReturnType<typeof loadAdminClient>>;

export async function loadAdminClient() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  return createAdminClient();
}

export async function findOwnerIdByEmail(supabase: SupabaseAdmin, email: string) {
  const normalized = email.trim().toLowerCase();
  const perPage = 1000;

  for (let page = 1; page < 50; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === normalized);
    if (user?.id) return user.id;
    if (data.users.length < perPage) break;
  }

  throw new Error(`No Supabase Auth user found for ${email}. Sign in once before running evals.`);
}

export function percentile(values: number[], percentileValue: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return sorted[index];
}

export type ExpectedFileCoverage = {
  expectedFiles: string[];
  matchedFiles: string[];
  missingFiles: string[];
  anyHit: boolean;
  allHit: boolean;
};

export function expectedFileCoverage(
  expectedFiles: string[],
  sources: Array<Pick<SearchResult, "file_name">>,
  limit = 3,
): ExpectedFileCoverage {
  const topFiles = sources.slice(0, limit).map((source) => source.file_name.toLowerCase());
  const matchedFiles = expectedFiles.filter((expected) =>
    topFiles.some((file) => file.includes(expected.toLowerCase())),
  );

  return {
    expectedFiles,
    matchedFiles,
    missingFiles: expectedFiles.filter((expected) => !matchedFiles.includes(expected)),
    anyHit: matchedFiles.length > 0,
    allHit: expectedFiles.length > 0 && matchedFiles.length === expectedFiles.length,
  };
}

export function expectedFileHit(expectedFiles: string[], sources: Array<Pick<SearchResult, "file_name">>, limit = 3) {
  return expectedFileCoverage(expectedFiles, sources, limit).anyHit;
}

export function hasInvalidVisualEvidence(cards: VisualEvidenceCard[] = []) {
  return cards.some((card) => card.image_type === "logo_decorative" || card.clinical_relevance_score === 0);
}

export function validateRagAnswer(testCase: RagEvalCase, answer: RagAnswer) {
  const failures: string[] = [];
  const expectedCoverage = expectedFileCoverage(
    testCase.expectedFiles,
    answer.sources,
    testCase.expectedFiles.length > 1 ? 5 : 3,
  );
  const expectedHit = testCase.expectedFiles.length > 1 ? expectedCoverage.allHit : expectedCoverage.anyHit;
  const route = answer.routingMode ?? "unsupported";
  const visualEvidence = answer.visualEvidence ?? [];

  if (testCase.supported && !answer.grounded) failures.push("expected grounded answer");
  if (!testCase.supported && answer.grounded) failures.push("expected unsupported answer");
  if (testCase.falsePositiveControl && answer.grounded)
    failures.push("false-positive control produced grounded answer");
  if (!testCase.allowedRoutes.includes(route)) failures.push(`unexpected route ${route}`);
  if (testCase.expectedQueryClass && answer.queryClass !== testCase.expectedQueryClass) {
    failures.push(`expected query class ${testCase.expectedQueryClass}, got ${answer.queryClass ?? "none"}`);
  }
  if (answer.citations.length < testCase.minCitations)
    failures.push(`expected at least ${testCase.minCitations} citations`);
  if (testCase.expectedFiles.length > 1 && !expectedCoverage.allHit) {
    failures.push(`expected documents missing from top 5: ${expectedCoverage.missingFiles.join(", ")}`);
  } else if (testCase.expectedFiles.length === 1 && !expectedCoverage.anyHit) {
    failures.push("expected document not in retrieved sources");
  }
  if (testCase.requireVisualEvidence && visualEvidence.length === 0) failures.push("expected visual evidence");
  if (hasInvalidVisualEvidence(visualEvidence)) failures.push("decorative or zero-relevance visual evidence returned");
  if (testCase.category === "complex" && (answer.latencyTimings?.total_latency_ms ?? 0) > testCase.latencyTargetMs) {
    failures.push(`latency over ${testCase.latencyTargetMs}ms`);
  }

  return { expectedHit, expectedCoverage, failures };
}

export function configuredCostRates() {
  const input = Number(process.env.RAG_EVAL_INPUT_USD_PER_MILLION);
  const cachedInput = Number(process.env.RAG_EVAL_CACHED_INPUT_USD_PER_MILLION);
  const output = Number(process.env.RAG_EVAL_OUTPUT_USD_PER_MILLION);
  if (!Number.isFinite(input) || !Number.isFinite(output)) return null;

  return {
    input,
    cachedInput: Number.isFinite(cachedInput) ? cachedInput : input,
    output,
  };
}

export function estimateCostUsd(result: { inputTokens: number; cachedInputTokens: number; outputTokens: number }) {
  const rates = configuredCostRates();
  if (!rates) return null;

  const uncachedInput = Math.max(result.inputTokens - result.cachedInputTokens, 0);
  return (
    (uncachedInput * rates.input + result.cachedInputTokens * rates.cachedInput + result.outputTokens * rates.output) /
    1_000_000
  );
}
