import { toClientAnswerPayload } from "@/lib/answer-client-payload";
import {
  hasDangerSourceGovernanceWarning,
  sourceGovernanceRefusalAnswer,
  sourceGovernanceWarnings,
} from "@/lib/source-governance";
import type { RagAnswer } from "@/lib/types";

export function answerDegradedModeSignal(
  answer?: Pick<RagAnswer, "degradedMode" | "answerQualityTier" | "fallbackReason">,
) {
  if (answer?.degradedMode) return answer.degradedMode;
  const active = answer?.answerQualityTier === "source_only";
  return {
    active,
    reason: active ? (answer?.fallbackReason ?? "source_only") : null,
  };
}

/** Apply the shared browser-boundary source-governance contract. */
export function buildGovernedAnswerClientResponse(answer: RagAnswer) {
  const warnings = sourceGovernanceWarnings({
    results: answer.sources ?? [],
    relevance: answer.relevance ?? answer.smartPanel?.relevance ?? null,
  });
  const shouldRefuse =
    answer.grounded !== false &&
    answer.confidence !== "unsupported" &&
    answer.responseMode !== "evidence_gap" &&
    hasDangerSourceGovernanceWarning(warnings);

  if (shouldRefuse) {
    const routingReason = [answer.routingReason, "source_governance_refusal"].filter(Boolean).join("; ");
    const telemetryAnswer = {
      ...answer,
      answer: sourceGovernanceRefusalAnswer,
      grounded: false,
      confidence: "unsupported",
      citations: [],
      sources: [],
      responseMode: "evidence_gap",
      fallbackReason: "source_governance_refusal",
      routingReason,
    } satisfies RagAnswer;

    return {
      refused: true as const,
      warnings,
      telemetryAnswer,
      payload: {
        answer: sourceGovernanceRefusalAnswer,
        grounded: false as const,
        confidence: "unsupported" as const,
        citations: [],
        sources: [],
        degradedMode: answerDegradedModeSignal(answer),
        sourceGovernanceWarnings: warnings,
      },
    };
  }

  return {
    refused: false as const,
    warnings,
    telemetryAnswer: answer,
    payload: {
      ...toClientAnswerPayload(answer),
      degradedMode: answerDegradedModeSignal(answer),
      sourceGovernanceWarnings: warnings,
    },
  };
}

/** Apply the governed browser contract while preserving explicit demo/degraded state. */
export function buildGovernedDemoAnswerClientResponse(answer: RagAnswer, fallbackReason?: string) {
  const governedResponse = buildGovernedAnswerClientResponse(answer);
  return {
    ...governedResponse.payload,
    demoMode: true as const,
    degradedMode: fallbackReason ? { active: true, reason: fallbackReason } : answerDegradedModeSignal(answer),
    ...(fallbackReason ? { fallbackMode: "non_production_demo" as const, fallbackReason } : {}),
  };
}
