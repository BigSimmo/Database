import { loadEnvConfig } from "@next/env";
import { buildVisualEvidence } from "@/lib/evidence";
import { selectRagEvalCases, type RagEvalCase } from "@/lib/rag-eval-cases";
import type { SearchResult } from "@/lib/types";
import { expectedFileHit, findOwnerIdByEmail, hasInvalidVisualEvidence, loadAdminClient, percentile } from "./eval-utils";

loadEnvConfig(process.cwd());

type EvalArgs = {
  ownerEmail?: string;
  limit?: number;
  question?: string;
  json: boolean;
  failOnThreshold: boolean;
};

type SearchEvalResult = {
  id: string;
  question: string;
  category: RagEvalCase["category"];
  supported: boolean;
  expectedHitTop3: boolean;
  resultCount: number;
  topScore: number;
  topFiles: string[];
  latencyMs: number;
  retrievalStrategy: string | null;
  searchCacheHit: boolean;
  embeddingSkipped: boolean;
  embeddingCacheHit: boolean;
  fallbackToEmbedding: boolean;
  visualEvidence: number;
  failures: string[];
};

function parseArgs(argv: string[]): EvalArgs {
  const args: EvalArgs = {
    ownerEmail: process.env.RAG_EVAL_OWNER_EMAIL,
    json: false,
    failOnThreshold: false,
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

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${token}`);
    index += 1;

    if (token === "--owner-email") args.ownerEmail = value;
    if (token === "--limit") args.limit = Number.parseInt(value, 10);
    if (token === "--question") args.question = value;
  }

  if (args.limit !== undefined && (!Number.isInteger(args.limit) || args.limit <= 0)) {
    throw new Error("--limit must be a positive integer.");
  }

  return args;
}

function topScore(results: SearchResult[]) {
  return results.reduce((max, result) => Math.max(max, result.hybrid_score ?? result.similarity), 0);
}

function validateSearchResult(testCase: RagEvalCase, result: Omit<SearchEvalResult, "failures">) {
  const failures: string[] = [];

  if (testCase.supported && !result.expectedHitTop3) failures.push("expected document not in top 3");
  if (testCase.supported && result.resultCount === 0) failures.push("expected search results");
  if (!testCase.supported && result.topScore >= 0.82) failures.push("unsupported control produced high-confidence match");
  if (testCase.category === "routine" && result.latencyMs > 1500) failures.push("routine search over 1500ms");

  return failures;
}

function summarizeFailures(results: SearchEvalResult[]) {
  const routine = results.filter((result) => result.category === "routine");
  const supported = results.filter((result) => result.supported);
  const unsupported = results.filter((result) => !result.supported);
  const routineLatencies = routine.map((result) => result.latencyMs);
  const expectedHits = results.filter((result) => result.expectedHitTop3).length;
  const routineEmbeddingSkipped = routine.filter((result) => result.embeddingSkipped).length;
  const unsupportedHighConfidence = unsupported.filter((result) => result.topScore >= 0.82).length;
  const failures: string[] = [];

  if (expectedHits < 18) failures.push(`expected document top-3 hit ${expectedHits}/${results.length}`);
  if (routineLatencies.length > 0 && percentile(routineLatencies, 95) > 1500) failures.push("routine search p95 over 1500ms");
  if (routine.length > 0 && routineEmbeddingSkipped / routine.length < 0.7) {
    failures.push(`routine embedding skipped ${routineEmbeddingSkipped}/${routine.length}`);
  }
  if (unsupportedHighConfidence > 0) failures.push(`unsupported high-confidence matches ${unsupportedHighConfidence}`);
  if (supported.some((result) => result.failures.length > 0)) failures.push("supported case-level search failure(s)");

  return failures;
}

function printHumanSummary(results: SearchEvalResult[]) {
  const latencies = results.map((result) => result.latencyMs);
  const routineLatencies = results.filter((result) => result.category === "routine").map((result) => result.latencyMs);
  const expectedHits = results.filter((result) => result.expectedHitTop3).length;
  const textFast = results.filter((result) => result.retrievalStrategy === "text_fast_path").length;
  const embeddingSkipped = results.filter((result) => result.embeddingSkipped).length;
  const fallbackToEmbedding = results.filter((result) => result.fallbackToEmbedding).length;
  const strategyCounts = results.reduce<Record<string, number>>((counts, result) => {
    const strategy = result.retrievalStrategy ?? "none";
    counts[strategy] = (counts[strategy] ?? 0) + 1;
    return counts;
  }, {});

  console.log("");
  console.log("Search eval summary:");
  console.log(`  expected_document_hit_top3=${expectedHits}/${results.length}`);
  console.log(`  average_latency_ms=${Math.round(latencies.reduce((sum, value) => sum + value, 0) / results.length)}`);
  console.log(`  p50_latency_ms=${percentile(latencies, 50)}`);
  console.log(`  p95_latency_ms=${percentile(latencies, 95)}`);
  console.log(`  routine_p95_latency_ms=${percentile(routineLatencies, 95)}`);
  console.log(`  text_fast_path=${textFast}/${results.length}`);
  console.log(`  embedding_skipped=${embeddingSkipped}/${results.length}`);
  console.log(`  fallback_to_embedding=${fallbackToEmbedding}/${results.length}`);
  console.log(`  strategy_counts=${JSON.stringify(strategyCounts)}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.ownerEmail) throw new Error('Provide --owner-email "you@example.com" or set RAG_EVAL_OWNER_EMAIL.');

  const [{ requireOpenAIEnv, requireServerEnv }, { searchChunksWithTelemetry }, supabase] = await Promise.all([
    import("@/lib/env"),
    import("@/lib/rag"),
    loadAdminClient(),
  ]);

  requireServerEnv();
  requireOpenAIEnv();

  const ownerId = await findOwnerIdByEmail(supabase, args.ownerEmail);
  const cases = selectRagEvalCases({ limit: args.limit, question: args.question });
  const results: SearchEvalResult[] = [];

  if (!args.json) console.log(`Running ${cases.length} search eval case(s).`);

  for (const testCase of cases) {
    const startedAt = Date.now();
    const search = await searchChunksWithTelemetry({
      query: testCase.question,
      ownerId,
      topK: 12,
      minSimilarity: 0.12,
      skipCache: true,
    });
    const latencyMs =
      search.telemetry.supabase_rpc_latency_ms + search.telemetry.embedding_latency_ms + search.telemetry.rerank_latency_ms ||
      Date.now() - startedAt;
    const visuals = buildVisualEvidence(search.results);
    const baseResult = {
      id: testCase.id,
      question: testCase.question,
      category: testCase.category,
      supported: testCase.supported,
      expectedHitTop3: expectedFileHit(testCase.expectedFiles, search.results, 3),
      resultCount: search.results.length,
      topScore: topScore(search.results),
      topFiles: Array.from(new Set(search.results.slice(0, 3).map((result) => result.file_name))),
      latencyMs,
      retrievalStrategy: search.telemetry.retrieval_strategy ?? null,
      searchCacheHit: search.telemetry.search_cache_hit,
      embeddingSkipped: search.telemetry.embedding_skipped,
      embeddingCacheHit: search.telemetry.embedding_cache_hit,
      fallbackToEmbedding: !search.telemetry.embedding_skipped,
      visualEvidence: visuals.length,
    } satisfies Omit<SearchEvalResult, "failures">;
    const failures = validateSearchResult(testCase, baseResult);
    if (hasInvalidVisualEvidence(visuals)) failures.push("decorative or zero-relevance visual evidence returned");
    const result = { ...baseResult, failures };
    results.push(result);

    if (!args.json) {
      const failureSuffix = result.failures.length ? ` FAIL=${result.failures.join("; ")}` : "";
      console.log(
        `SEARCH ${result.latencyMs}ms strategy=${result.retrievalStrategy ?? "none"} skippedEmbedding=${result.embeddingSkipped} expectedHit=${result.expectedHitTop3} topScore=${result.topScore.toFixed(3)}${failureSuffix}`,
      );
      console.log(`  Q: ${testCase.question}`);
      console.log(`  Top files: ${result.topFiles.join("; ") || "none"}`);
    }
  }

  const thresholdFailures = summarizeFailures(results);

  if (args.json) {
    console.log(JSON.stringify({ results, thresholdFailures }, null, 2));
  } else {
    printHumanSummary(results);
    if (thresholdFailures.length > 0) {
      console.log(`  threshold_failures=${JSON.stringify(thresholdFailures)}`);
    }
  }

  if (args.failOnThreshold && thresholdFailures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
