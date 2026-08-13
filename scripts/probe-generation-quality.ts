/**
 * #231 probe: run ONE cache-bypassed live answer and report which generation-quality
 * gate (if any) rejected it, using the structured diagnostics added by PR #1899.
 *
 * PROVIDER-BACKED: this makes real Supabase retrieval RPCs and OpenAI generation calls.
 * Run it only with explicit operator approval, from an environment carrying the live
 * env vars (see .env.example). It refuses to run in demo mode instead of degrading.
 *
 * Usage:
 *   node scripts/run-tsx.mjs scripts/probe-generation-quality.ts "Lithium dosing?"
 *   node scripts/run-tsx.mjs scripts/probe-generation-quality.ts "Lithium dosing?" --show-answer
 *
 * Output is provider-safe by default: routing/degraded reasons, retry reasons (including
 * the new generation_quality_gate:<reason> entries), timings, and counts — no answer or
 * source prose unless --show-answer is passed. Nothing is written to rag_queries
 * (logQuery: false) and nothing is cached (skipCache: true).
 */
import { isDemoMode } from "@/lib/env";
import { answerQuestionWithScope } from "@/lib/rag/rag";

async function main() {
  const args = process.argv.slice(2);
  const showAnswer = args.includes("--show-answer");
  const query =
    args
      .filter((arg) => !arg.startsWith("--"))
      .join(" ")
      .trim() || "Lithium dosing?";

  if (isDemoMode()) {
    console.error(
      "probe-generation-quality: demo mode detected (missing Supabase/OpenAI env). " +
        "This probe requires the live environment and explicit operator approval; refusing to run.",
    );
    process.exit(2);
  }

  console.log(`[probe] cache-bypassed live answer for: ${JSON.stringify(query)}`);
  const startedAt = Date.now();
  const answer = await answerQuestionWithScope({
    query,
    ownerId: undefined,
    skipCache: true,
    logQuery: false,
    onProgress: (event) => {
      console.log(`[progress] ${event.stage}${event.mode ? ` mode=${event.mode}` : ""}`);
    },
  });

  const retryReasons = answer.latencyTimings?.answer_retry_reasons ?? [];
  const gateReasons = retryReasons
    .filter((reason) => reason.startsWith("generation_quality_gate:"))
    .map((reason) => reason.slice("generation_quality_gate:".length));

  const report = {
    query,
    grounded: answer.grounded,
    confidence: answer.confidence,
    routing_mode: answer.routingMode,
    routing_reason: answer.routingReason,
    degraded_mode: answer.degradedMode ?? null,
    fallback_reason: answer.fallbackReason ?? null,
    answer_quality_tier: answer.answerQualityTier ?? null,
    generation_quality_gate_reasons: gateReasons,
    answer_retry_reasons: retryReasons,
    citation_count: answer.citations.length,
    source_count: answer.sources.length,
    unverified_numeric_token_count: answer.unverifiedNumericTokens?.length ?? 0,
    model_used: answer.modelUsed,
    openai_request_ids: answer.openAIRequestIds ?? [],
    search_latency_ms: answer.latencyTimings?.search_latency_ms ?? null,
    generation_latency_ms: answer.latencyTimings?.generation_latency_ms ?? null,
    total_latency_ms: answer.latencyTimings?.total_latency_ms ?? Date.now() - startedAt,
  };
  console.log(JSON.stringify(report, null, 2));

  if (showAnswer) {
    console.log("--- answer text (requested with --show-answer) ---");
    console.log(answer.answer);
  }

  if (gateReasons.length) {
    console.log(`[probe] generation quality gate fired: ${gateReasons.join(", ")}`);
  } else if (report.degraded_mode && (report.degraded_mode as { active?: boolean }).active) {
    console.log("[probe] degraded for a non-quality reason — see fallback_reason above.");
  } else {
    console.log("[probe] no generation-quality failure on this run.");
  }
}

main().catch((error) => {
  console.error("probe-generation-quality failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
