import type { AdaptiveAnswerPlan } from "@/lib/types";

export type AnswerContractLimits = Readonly<{
  lead: number;
  heading: number;
  body: number;
  sections: number;
  total: number;
}>;

// Exact existing provider limits. Legacy parsing/projection compatibility is unchanged.
export const legacyAnswerLimits: AnswerContractLimits = Object.freeze({
  lead: 1600,
  heading: 48,
  body: 600,
  sections: 6,
  total: 5488,
});
// Declared synthetic E01-E04/E12-E16 references: 2074-char supported claim-25
// lead/body; 21-char longest heading; eight asked parts. Retain modest markup
// headroom per field, keep headings unchanged, and share a 5000-char aggregate
// rather than granting eight independently maximal bodies. Capacity, not a quota.
export const adaptiveAnswerLimits: AnswerContractLimits = Object.freeze({
  lead: 2400,
  heading: 48,
  body: 2400,
  sections: 8,
  total: 5000,
});

type AnswerProse = { answer?: string; answerSections?: readonly { heading: string; body: string }[] };
export function answerProseSize(value: AnswerProse): number {
  return (
    (value.answer?.length ?? 0) + (value.answerSections ?? []).reduce((n, s) => n + s.heading.length + s.body.length, 0)
  );
}
export function answerWithinLimits(
  value: AnswerProse,
  limits: AnswerContractLimits,
  sectionCap = limits.sections,
): boolean {
  const sections = value.answerSections ?? [];
  return (
    (value.answer?.length ?? 0) <= limits.lead &&
    sections.length <= Math.min(sectionCap, limits.sections) &&
    sections.every((s) => s.heading.length <= limits.heading && s.body.length <= limits.body) &&
    answerProseSize(value) <= limits.total
  );
}

export function adaptivePlanSectionCap(plan: AdaptiveAnswerPlan): number {
  const requested = plan.requiredCoverage.length + Number(plan.requireExactGap) + Number(plan.requireConflictSection);
  const optional =
    plan.requestedDepth === "detailed" || plan.shape === "comprehensive" || plan.shape === "comparison"
      ? 8
      : plan.shape === "narrow"
        ? 1
        : 4;
  return Math.min(adaptiveAnswerLimits.sections, Math.max(requested, optional));
}
