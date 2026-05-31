import { loadEnvConfig } from "@next/env";
import { selectRagEvalCases, type RagEvalCase } from "@/lib/rag-eval-cases";
import type { RagAnswer } from "@/lib/types";
import { estimateCostUsd, findOwnerIdByEmail, loadAdminClient, percentile, validateRagAnswer } from "./eval-utils";

loadEnvConfig(process.cwd());

type EvalArgs = {
  ownerEmail?: string;
  limit?: number;
  question?: string;
  json: boolean;
  failOnThreshold: boolean;
};

type EvalResult = {
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
  latencyTimings: RagAnswer["latencyTimings"];
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number | null;
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

function summarizeFailures(results: EvalResult[]) {
  const supported = results.filter((result) => result.supported);
  const unsupported = results.filter((result) => !result.supported);
  const groundedSupported = supported.filter((result) => result.grounded).length;
  const unsupportedCorrect = unsupported.filter((result) => !result.grounded).length;
  const invalidCitations = results.filter((result) => result.grounded && result.citations === 0).length;
  const routineExtractiveLatencies = results
    .filter((result) => result.category === "routine" && result.route === "extractive")
    .map((result) => result.latencyMs);
  const complexSlow = results.filter((result) => result.category === "complex" && result.latencyMs > 20000).length;
  const failedCases = results.filter((result) => result.failures.length > 0);
  const failures: string[] = [];

  if (supported.length >= 18 && groundedSupported < 17)
    failures.push(`supported grounded ${groundedSupported}/${supported.length}`);
  if (unsupported.length >= 2 && unsupportedCorrect !== unsupported.length) {
    failures.push(`unsupported correct ${unsupportedCorrect}/${unsupported.length}`);
  }
  if (invalidCitations > 0) failures.push(`invalid citation count ${invalidCitations}`);
  if (routineExtractiveLatencies.length > 0 && percentile(routineExtractiveLatencies, 95) > 2000) {
    failures.push("routine extractive p95 over 2000ms");
  }
  if (complexSlow > 0) failures.push(`complex answers over 20000ms: ${complexSlow}`);
  if (failedCases.length > 0) failures.push(`${failedCases.length} case-level failure(s)`);

  return failures;
}

function printHumanSummary(results: EvalResult[]) {
  const latencies = results.map((result) => result.latencyMs);
  const grounded = results.filter((result) => result.grounded).length;
  const unsupported = results.length - grounded;
  const underTenSeconds = results.filter((result) => result.latencyMs < 10000).length;
  const expectedHits = results.filter((result) => result.expectedHit).length;
  const modelCounts = results.reduce<Record<string, number>>((counts, result) => {
    const model = result.model ?? "none";
    counts[model] = (counts[model] ?? 0) + 1;
    return counts;
  }, {});
  const routeCounts = results.reduce<Record<string, number>>((counts, result) => {
    counts[result.route] = (counts[result.route] ?? 0) + 1;
    return counts;
  }, {});
  const tokenTotals = results.reduce(
    (totals, result) => ({
      inputTokens: totals.inputTokens + result.inputTokens,
      outputTokens: totals.outputTokens + result.outputTokens,
      cachedInputTokens: totals.cachedInputTokens + result.cachedInputTokens,
      reasoningOutputTokens: totals.reasoningOutputTokens + result.reasoningOutputTokens,
      totalTokens: totals.totalTokens + result.totalTokens,
    }),
    { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, reasoningOutputTokens: 0, totalTokens: 0 },
  );
  const estimatedCostUsd = results.some((result) => result.estimatedCostUsd === null)
    ? null
    : results.reduce((sum, result) => sum + (result.estimatedCostUsd ?? 0), 0);

  console.log("");
  console.log("RAG eval summary:");
  console.log(`  grounded=${grounded}/${results.length}`);
  console.log(`  unsupported=${unsupported}/${results.length}`);
  console.log(`  expected_document_hit=${expectedHits}/${results.length}`);
  console.log(`  average_latency_ms=${Math.round(latencies.reduce((sum, value) => sum + value, 0) / results.length)}`);
  console.log(`  p50_latency_ms=${percentile(latencies, 50)}`);
  console.log(`  p95_latency_ms=${percentile(latencies, 95)}`);
  console.log(`  under_10s=${underTenSeconds}/${results.length}`);
  console.log(`  model_counts=${JSON.stringify(modelCounts)}`);
  console.log(`  route_counts=${JSON.stringify(routeCounts)}`);
  console.log(`  token_totals=${JSON.stringify(tokenTotals)}`);
  console.log(
    `  estimated_cost_usd=${
      estimatedCostUsd === null
        ? "set RAG_EVAL_INPUT_USD_PER_MILLION and RAG_EVAL_OUTPUT_USD_PER_MILLION"
        : estimatedCostUsd.toFixed(6)
    }`,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const [{ requireOpenAIEnv, requireServerEnv }, { answerQuestionWithScope }, supabase] = await Promise.all([
    import("@/lib/env"),
    import("@/lib/rag"),
    loadAdminClient(),
  ]);

  requireServerEnv();
  requireOpenAIEnv();

  const ownerId = args.ownerEmail ? await findOwnerIdByEmail(supabase, args.ownerEmail) : undefined;
  const scope = ownerId ? `owner:${args.ownerEmail}` : "public";
  const cases = selectRagEvalCases({ limit: args.limit, question: args.question });
  const results: EvalResult[] = [];

  if (!args.json) console.log(`Running ${cases.length} RAG eval case(s), scope=${scope}.`);

  for (const testCase of cases) {
    const answer = (await answerQuestionWithScope({
      query: testCase.question,
      ownerId,
      logQuery: false,
      skipCache: true,
    })) as RagAnswer;
    const latencyMs = answer.latencyTimings?.total_latency_ms ?? 0;
    const validation = validateRagAnswer(testCase, answer);
    const result: EvalResult = {
      id: testCase.id,
      question: testCase.question,
      category: testCase.category,
      supported: testCase.supported,
      expectedHit: validation.expectedHit,
      grounded: answer.grounded,
      latencyMs,
      route: answer.routingMode ?? "none",
      model: answer.modelUsed ?? null,
      citations: answer.citations.length,
      visualEvidence: answer.visualEvidence?.length ?? 0,
      failures: validation.failures,
      latencyTimings: answer.latencyTimings,
      inputTokens: answer.openAIUsage?.input_tokens ?? 0,
      outputTokens: answer.openAIUsage?.output_tokens ?? 0,
      cachedInputTokens: answer.openAIUsage?.cached_input_tokens ?? 0,
      reasoningOutputTokens: answer.openAIUsage?.reasoning_output_tokens ?? 0,
      totalTokens: answer.openAIUsage?.total_tokens ?? 0,
      estimatedCostUsd: estimateCostUsd({
        inputTokens: answer.openAIUsage?.input_tokens ?? 0,
        cachedInputTokens: answer.openAIUsage?.cached_input_tokens ?? 0,
        outputTokens: answer.openAIUsage?.output_tokens ?? 0,
      }),
    };
    results.push(result);

    if (!args.json) {
      const status = answer.grounded ? "GROUNDED" : "UNSUPPORTED";
      const failureSuffix = result.failures.length ? ` FAIL=${result.failures.join("; ")}` : "";
      const citationSummary = answer.citations
        .slice(0, 2)
        .map((citation) => `${citation.file_name} p${citation.page_number ?? "?"} c${citation.chunk_index}`)
        .join("; ");
      console.log(
        `${status} ${latencyMs}ms route=${result.route} model=${result.model ?? "none"} citations=${result.citations} visuals=${result.visualEvidence} expectedHit=${result.expectedHit}${failureSuffix}`,
      );
      console.log(`  Q: ${testCase.question}`);
      if (citationSummary) console.log(`  Sources: ${citationSummary}`);
    }
  }

  const thresholdFailures = summarizeFailures(results);

  if (args.json) {
    console.log(JSON.stringify({ scope, results, thresholdFailures }, null, 2));
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
