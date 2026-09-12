import type { AnswerFeedbackType } from "@/lib/answer-feedback";
import { sanitizeRagEvalDiagnostics } from "@/lib/rag/rag-eval-diagnostics";

const categories = [
  "verified",
  "needs_correction",
  "source_insufficient",
  "wrong_source",
  "missing_source",
  "unsupported_answer",
  "numeric_error",
  "outdated_guidance",
] as const satisfies readonly AnswerFeedbackType[];

export type FeedbackEvalTriage = {
  interactionId: string;
  category: string;
  diagnosticReasonCodes: string[];
  recommendedAction: "aggregate_only" | "request_reproduction" | "candidate_eval_case" | "clinical_review";
  requiresDeidentificationReview: true;
  mayAutoPromote: false;
};

export function validFeedbackInteractionId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

/** Input must already be joined by interaction ID. Diagnostic presence is not clinical approval. */
export function classifyFeedbackForEval(args: {
  feedback: { interactionId: string; category: string };
  answerMetadata: Record<string, unknown> | null;
  retrievalMetadata: Record<string, unknown> | null;
}): FeedbackEvalTriage {
  const interactionId = validFeedbackInteractionId(args.feedback?.interactionId)
    ? args.feedback.interactionId.toLowerCase()
    : "";
  const category = categories.find((value) => value === args.feedback?.category) ?? "unknown";
  const diagnosticReasonCodes = [`feedback_${category}`];
  let incomplete = !interactionId || category === "unknown";
  const completeSides: string[] = [];
  if (!interactionId) diagnosticReasonCodes.push("interaction_id_invalid");
  for (const [side, metadata] of [
    ["answer", args.answerMetadata],
    ["retrieval", args.retrievalMetadata],
  ] as const) {
    if (metadata === null) {
      diagnosticReasonCodes.push(`${side}_metadata_missing`);
      incomplete = true;
      continue;
    }
    const safe = sanitizeRagEvalDiagnostics(
      metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {},
    );
    if (safe.generation_outcome === null || safe.required_part_count === null || safe.represented_part_count === null) {
      diagnosticReasonCodes.push(`${side}_metadata_incomplete`);
      incomplete = true;
      continue;
    }
    diagnosticReasonCodes.push(`${side}_generation_${safe.generation_outcome}`);
    completeSides.push(
      JSON.stringify([safe.generation_outcome, safe.required_part_count, safe.represented_part_count]),
    );
    if ((safe.required_part_loss_count ?? 0) > 0) diagnosticReasonCodes.push(`${side}_coverage_part_loss`);
  }
  if (completeSides.length === 2 && completeSides[0] !== completeSides[1]) {
    diagnosticReasonCodes.push("telemetry_metadata_conflict");
    incomplete = true;
  }
  return {
    interactionId,
    category,
    diagnosticReasonCodes,
    recommendedAction:
      category === "verified"
        ? "aggregate_only"
        : incomplete
          ? "request_reproduction"
          : category === "numeric_error" || category === "outdated_guidance"
            ? "clinical_review"
            : "candidate_eval_case",
    requiresDeidentificationReview: true,
    mayAutoPromote: false,
  };
}
