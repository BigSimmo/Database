import type {
  ClinicalAskClarification,
  ClinicalAskContextField,
  ClinicalAskModeId,
  ConfirmedCaseContext,
  ContextSuggestion,
} from "./contracts";
import { clinicalAskModeProfile } from "./mode-profiles";

const clarificationPrompts: Record<ClinicalAskContextField, string> = {
  ageGroup: "What age group is relevant?",
  careSetting: "What care setting is relevant?",
  jurisdiction: "Which jurisdiction applies?",
  workingDiagnosis: "What working diagnosis is being considered?",
  presentationFeatures: "Which presentation features are material?",
  duration: "What duration or time course is known?",
  impairment: "What functional impairment is known?",
  exclusions: "Which relevant exclusions have been assessed?",
  course: "What course or episode context is known?",
  serviceLocation: "Which service location is relevant?",
  eligibilityFacts: "Which confirmed eligibility facts are available?",
  pathwayStage: "What stage of the pathway has been reached?",
  referralPurpose: "What is the referral purpose?",
  formPurpose: "What is the intended purpose of the form?",
  clinicalLegalStage: "What clinical or legal stage applies?",
  responsibleRole: "Which role is responsible for the next step?",
  therapyGoals: "What clinician-confirmed therapy goals are relevant?",
  population: "Which population is relevant?",
  cautions: "Which cautions are known?",
  availabilityConstraints: "Which availability constraints are known?",
  priorResponse: "What prior response is known?",
};

function hasValue(value: string | string[] | undefined): boolean {
  return Array.isArray(value) ? value.some((item) => item.trim().length > 0) : Boolean(value?.trim());
}

export function clarificationsFor(mode: ClinicalAskModeId, context: ConfirmedCaseContext): ClinicalAskClarification[] {
  return clinicalAskModeProfile(mode).materialClarificationFields.flatMap((field) =>
    hasValue(context[field])
      ? []
      : [{ id: `${mode}:${field}`, field, prompt: clarificationPrompts[field], required: true as const }],
  );
}

export function applyClarificationAnswers(
  mode: ClinicalAskModeId,
  context: ConfirmedCaseContext,
  answers: Readonly<Partial<Record<string, string>>>,
): ConfirmedCaseContext {
  const merged = { ...context };
  for (const clarification of clarificationsFor(mode, context)) {
    const answer = answers[clarification.id]?.trim();
    if (answer) merged[clarification.field] = answer;
  }
  return projectConfirmedContext(mode, merged);
}

export function projectConfirmedContext(
  mode: ClinicalAskModeId,
  context: ConfirmedCaseContext,
  suggestions: readonly ContextSuggestion[] = [],
): ConfirmedCaseContext {
  const confirmedSuggestions = new Map(
    suggestions
      .filter((suggestion) => suggestion.status === "confirmed")
      .map((suggestion) => [suggestion.field, suggestion.value]),
  );
  const projected: ConfirmedCaseContext = {};
  for (const field of clinicalAskModeProfile(mode).acceptedContextFields) {
    const value = context[field] ?? confirmedSuggestions.get(field);
    if (hasValue(value)) projected[field] = Array.isArray(value) ? [...value] : value;
  }
  return projected;
}

export function handoffContext(
  _source: ClinicalAskModeId,
  target: ClinicalAskModeId,
  context: ConfirmedCaseContext,
): ConfirmedCaseContext {
  return projectConfirmedContext(target, context);
}

const identifierPatterns = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /(?<!\w)\+?\d(?:[\s().-]*\d){8,14}(?!\w)/,
  /\b\d{4}[ -]?\d{5}[ -]?\d\b/,
  /\b(?:medical record|record|patient|hospital|mrn|urn)\s*(?:number|no\.?|#|id)?\s*[:=-]\s*[A-Z0-9-]{4,}\b/i,
  /\b(?:dob|date of birth)\s*[:=-]\s*(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/i,
] as const;

export function identifierShapeWarning(text: string): boolean {
  return identifierPatterns.some((pattern) => pattern.test(text));
}
