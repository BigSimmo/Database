import { buildRelatedInformationMenu } from "@/lib/rag/answer-composition";
import { adaptiveAnswerLimits, adaptivePlanSectionCap } from "@/lib/rag/rag-answer-contract-limits";
import type {
  AdaptiveAnswerPlan,
  AdaptiveAnswerRequest,
  AnswerCoveragePlan,
  AnswerSection,
  ClinicalQueryIntent,
  RagQueryClass,
} from "@/lib/types";

/** No model call or evidence inference: coverage must describe the actual packed sources. */
export function buildAdaptiveAnswerPlan(args: {
  queryClass: RagQueryClass;
  intent: ClinicalQueryIntent;
  simpleDirect: boolean;
  requestPlan: AdaptiveAnswerRequest;
  coverage: AnswerCoveragePlan;
}): AdaptiveAnswerPlan {
  const { requestPlan, coverage } = args;
  // Take the union so an omitted request part cannot disappear behind an
  // apparently complete coverage summary. Optional enrichment never joins it.
  const requiredQuestions = new Map(
    coverage.subquestions.filter((part) => part.required).map((part) => [part.id, part]),
  );
  for (const part of requestPlan.subquestions) {
    if (part.required) requiredQuestions.set(part.id, part);
  }
  const requiredCoverage = [...requiredQuestions.values()].map((part) => ({
    subquestionId: part.id,
    question: part.question,
    purpose: requestPlan.subquestions.find((item) => item.id === part.id)?.purpose ?? null,
    coverage: coverage.coverage.find((item) => item.subquestionId === part.id) ?? null,
  }));
  const supportedSubquestionIds = requiredCoverage
    .filter((part) => part.coverage && part.coverage.status !== "absent" && part.coverage.chunkIds.length > 0)
    .map((part) => part.subquestionId);
  const exactGapSubquestionIds = requiredCoverage
    .filter((part) => part.coverage?.status !== "direct" || part.coverage.chunkIds.length === 0)
    .map((part) => part.subquestionId);
  const missingSafetyDependencies = requestPlan.materialSafetyDependencies.filter(
    (purpose) =>
      !requiredCoverage.some(
        (part) => part.purpose === purpose && part.coverage?.status === "direct" && part.coverage.chunkIds.length > 0,
      ),
  );
  const clarificationQuestion = coverage.ambiguity?.material ? coverage.ambiguity.clarificationQuestion : null;
  // A status label alone cannot authorize a source-disagreement claim. The
  // upstream governance owner supplies the reviewed canonical payload.
  const requireConflictSection = coverage.conflicts.length > 0;
  const requireExactGap =
    exactGapSubquestionIds.length > 0 ||
    missingSafetyDependencies.length > 0 ||
    requiredCoverage.length === 0 ||
    Boolean(clarificationQuestion) ||
    requireConflictSection;
  const shape = requireExactGap
    ? "partial"
    : args.simpleDirect
      ? "narrow"
      : args.queryClass === "comparison"
        ? "comparison"
        : args.queryClass === "broad_summary" || args.intent === "protocol" || args.intent === "broad_summary"
          ? "comprehensive"
          : "focused";

  return {
    shape,
    requestedDepth: requestPlan.requestedDepth,
    requiredAskedParts: [...requestPlan.askedParts],
    materialSafetyDependencies: [...requestPlan.materialSafetyDependencies],
    sourcePolicy: requestPlan.sourcePolicy,
    requiredCoverage,
    supportedSubquestionIds,
    exactGapSubquestionIds,
    missingSafetyDependencies,
    optionalSectionKinds: [
      ...new Set(buildRelatedInformationMenu(args.queryClass, args.intent).items.map((item) => item.kind)),
    ],
    requireExactGap,
    requireConflictSection,
    conflicts: coverage.conflicts,
    clarificationQuestion,
    allocation: {
      tier: requestPlan.requestedDepth,
      requiredFirst: true,
      optionalEnrichment: "remaining_budget_only",
      padToMinimum: false,
    },
  };
}

export function formatAdaptiveAnswerPlanLine(plan: AdaptiveAnswerPlan): string {
  return [
    `shape=${plan.shape}`,
    `depth=${plan.requestedDepth}`,
    `sections=0-${adaptivePlanSectionCap(plan)}`,
    `required_parts=${plan.requiredCoverage.map((part) => part.question).join(" | ") || "none"}`,
    `supported_parts=${plan.supportedSubquestionIds.join(",") || "none"}`,
    `exact_gap=${plan.requireExactGap ? "required" : "only_if_present"}`,
    `missing_parts=${plan.exactGapSubquestionIds.join(",") || "none"}`,
    `source_conflict=${plan.requireConflictSection ? "required" : "only_if_present"}`,
    `source_policy=${plan.sourcePolicy}`,
    `lead_chars=${adaptiveAnswerLimits.lead}`,
    `section_body_chars=${adaptiveAnswerLimits.body}`,
    `total_prose_chars=${adaptiveAnswerLimits.total}`,
  ].join("; ");
}

/** A model-proposed conflict kind never establishes canonical conflict authority. */
export function adaptiveConflictSectionsAuthorized(
  plan: AdaptiveAnswerPlan,
  sections: readonly AnswerSection[],
): boolean {
  return sections
    .filter((section) => section.kind === "source_conflict")
    .every((section) =>
      plan.conflicts.some((conflict) => {
        const ids = new Set(section.citation_chunk_ids);
        const allowed = new Set([...conflict.local.supportingChunkIds, ...conflict.australian.supportingChunkIds]);
        return (
          conflict.local.supportingChunkIds.some((id) => ids.has(id)) &&
          conflict.australian.supportingChunkIds.some((id) => ids.has(id)) &&
          [...ids].every((id) => allowed.has(id))
        );
      }),
    );
}
