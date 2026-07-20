// Answer-quality / targeting eval (P3). Runs the 30-case `answerQualityEvalCases` fixture through
// the live answer path and reports the five answer-quality metrics PLUS a structural per-intent
// `targeting` metric (dose→figure, red-result→withhold action, monitoring→schedule, etc.).
//
// This is a SEPARATE, opt-in script (npm run eval:answer-quality) — it does not touch eval:quality
// or add spend to any existing run. All metrics are reported informationally; the script exits 0
// unless --fail-on-threshold is passed with an explicit floor, so it can be calibrated safely.
import { loadEnvConfig } from "@next/env";
import {
  answerQualityEvalCases,
  answerQualityMetricLabels,
  answerTargetingMetricLabel,
  scoreAnswerQualityEvalCase,
  scoreAnswerTargeting,
  type AnswerQualityEvalCase,
  type AnswerQualityMetric,
} from "@/lib/rag/rag-eval-cases";
import type { RagAnswer } from "@/lib/types";
import { loadAdminClient, resolveEvalOwnerId, withProviderBackoff } from "./eval-utils";

loadEnvConfig(process.cwd());

type Args = {
  ownerEmail?: string;
  ownerId?: string;
  limit?: number;
  intent?: string;
  json: boolean;
  targetingFloor?: number;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    ownerEmail: process.env.RAG_EVAL_OWNER_EMAIL,
    ownerId: process.env.RAG_EVAL_OWNER_ID ?? process.env.LOCAL_NO_AUTH_OWNER_ID,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    if (token === "--json") {
      args.json = true;
      continue;
    }
    const value = argv[index + 1];
    if (token === "--owner-id") args.ownerId = value;
    if (token === "--owner-email") args.ownerEmail = value;
    if (token === "--intent") args.intent = value;
    if (token === "--limit") args.limit = Number.parseInt(value, 10);
    if (token === "--targeting-floor") args.targetingFloor = Number.parseFloat(value);
  }
  return args;
}

const METRICS: AnswerQualityMetric[] = ["relevance", "readability", "artifact_leaks", "intent_coverage", "fail_closed"];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [{ requireOpenAIEnv, requireServerEnv }, { answerQuestionWithScope }, supabase] = await Promise.all([
    import("@/lib/env"),
    import("@/lib/rag/rag"),
    loadAdminClient(),
  ]);
  requireServerEnv();
  requireOpenAIEnv();

  const ownerId = await resolveEvalOwnerId(supabase, args);
  let cases: AnswerQualityEvalCase[] = answerQualityEvalCases;
  if (args.intent) cases = cases.filter((testCase) => testCase.expectedIntent === args.intent);
  if (args.limit) cases = cases.slice(0, args.limit);

  const metricTotals: Record<AnswerQualityMetric, number> = {
    relevance: 0,
    readability: 0,
    artifact_leaks: 0,
    intent_coverage: 0,
    fail_closed: 0,
  };
  const targetingByIntent = new Map<string, { applicable: number; hit: number }>();
  let targetingApplicable = 0;
  let targetingHit = 0;
  const targetingMisses: Array<{ id: string; intent: string; reason: string; answer_length: number }> = [];
  const caseResults: Array<Record<string, unknown>> = [];

  for (const testCase of cases) {
    const answer = (await withProviderBackoff(`answer-quality:${testCase.id}`, () =>
      answerQuestionWithScope({ query: testCase.question, ownerId, logQuery: false, skipCache: true }),
    )) as RagAnswer;

    const metricScores = scoreAnswerQualityEvalCase(testCase, answer);
    for (const score of metricScores) {
      metricTotals[score.metric] += score.score;
    }

    const targeting = scoreAnswerTargeting(testCase, answer);
    const bucket = targetingByIntent.get(testCase.expectedIntent) ?? { applicable: 0, hit: 0 };
    if (targeting.applicable) {
      bucket.applicable += 1;
      targetingApplicable += 1;
      if (targeting.score === 1) {
        bucket.hit += 1;
        targetingHit += 1;
      } else {
        targetingMisses.push({
          id: testCase.id,
          intent: testCase.expectedIntent,
          reason: targeting.reason,
          answer_length: answer.answer?.length ?? 0,
        });
      }
    }
    targetingByIntent.set(testCase.expectedIntent, bucket);
    caseResults.push({
      id: testCase.id,
      intent: testCase.expectedIntent,
      grounded: answer.grounded,
      confidence: answer.confidence,
      route: answer.routingMode,
      query_class: answer.queryClass ?? null,
      model: answer.modelUsed ?? null,
      citation_count: answer.citations.length,
      routing_reason: answer.routingReason ?? null,
      metrics: Object.fromEntries(metricScores.map((score) => [score.metric, score.score])),
      targeting: targeting.applicable ? targeting.score : null,
      targeting_reason: targeting.reason,
      answer_length: answer.answer?.length ?? 0,
    });
  }

  const caseCount = cases.length;
  const metricRates = Object.fromEntries(
    METRICS.map((metric) => [metric, caseCount ? Number((metricTotals[metric] / caseCount).toFixed(4)) : 0]),
  ) as Record<AnswerQualityMetric, number>;
  const targetingRate = targetingApplicable ? Number((targetingHit / targetingApplicable).toFixed(4)) : null;
  const targetingByIntentRates = Object.fromEntries(
    [...targetingByIntent.entries()].map(([intent, { applicable, hit }]) => [
      intent,
      { applicable, hit, rate: applicable ? Number((hit / applicable).toFixed(4)) : null },
    ]),
  );

  const summary = {
    case_count: caseCount,
    metric_labels: answerQualityMetricLabels,
    metric_rates: metricRates,
    targeting_label: answerTargetingMetricLabel,
    targeting_applicable: targetingApplicable,
    targeting_rate: targetingRate,
    targeting_by_intent: targetingByIntentRates,
    targeting_misses: targetingMisses,
    case_results: caseResults,
  };

  if (args.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`Answer-quality eval: ${caseCount} case(s).`);
    console.log("  metric_rates:");
    for (const metric of METRICS) console.log(`    ${metric}=${metricRates[metric]}`);
    console.log(`  targeting_rate=${targetingRate} (applicable=${targetingApplicable})`);
    console.log("  targeting_by_intent:");
    for (const [intent, value] of Object.entries(targetingByIntentRates)) {
      console.log(`    ${intent}=${value.rate} (${value.hit}/${value.applicable})`);
    }
    if (targetingMisses.length) {
      console.log("  targeting_misses:");
      for (const miss of targetingMisses) {
        console.log(`    [${miss.intent}] ${miss.id}: ${miss.reason} :: answer_length=${miss.answer_length}`);
      }
    }
  }

  if (args.targetingFloor !== undefined && targetingRate !== null && targetingRate < args.targetingFloor) {
    console.error(`FAIL: targeting_rate ${targetingRate} < floor ${args.targetingFloor}`);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
