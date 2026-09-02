import type { AppModeId } from "@/lib/app-modes";
import type { RetrievalAccessScope } from "@/lib/owner-scope";

export const clinicalAskModeIds = [
  "services",
  "forms",
  "differentials",
  "formulation",
  "dsm",
  "specifiers",
  "therapy-compass",
] as const;
export type ClinicalAskModeId = (typeof clinicalAskModeIds)[number];

export function isClinicalAskModeId(value: AppModeId): value is ClinicalAskModeId {
  return (clinicalAskModeIds as readonly string[]).includes(value);
}
export type ClinicalAskContextField =
  | "ageGroup"
  | "careSetting"
  | "jurisdiction"
  | "workingDiagnosis"
  | "presentationFeatures"
  | "duration"
  | "impairment"
  | "exclusions"
  | "course"
  | "serviceLocation"
  | "eligibilityFacts"
  | "pathwayStage"
  | "referralPurpose"
  | "formPurpose"
  | "clinicalLegalStage"
  | "responsibleRole"
  | "therapyGoals"
  | "population"
  | "cautions"
  | "availabilityConstraints"
  | "priorResponse";
export type ConfirmedCaseContext = Partial<Record<ClinicalAskContextField, string | string[]>>;
export type ContextSuggestion = {
  id: string;
  field: ClinicalAskContextField;
  value: string | string[];
  status: "suggested" | "confirmed" | "rejected";
};
export type EvidenceTier = "catalogue" | "indexed" | "external";
export type SourceReviewState = "reviewed" | "needs_review" | "unknown";
export type ClinicalAskEvidence = {
  id: string;
  tier: EvidenceTier;
  title: string;
  publisher: string;
  jurisdiction: string | null;
  href: string;
  extract: string;
  reviewState: SourceReviewState;
  publishedAt: string | null;
  updatedAt: string | null;
  retrievedAt: string | null;
};
export type ClinicalAskClaim = { id: string; text: string; evidenceIds: string[] };
export type ClinicalAskSection = { id: string; title: string; claims: ClinicalAskClaim[] };
export type ClinicalAskClarification = { id: string; field: ClinicalAskContextField; prompt: string; required: true };
export type ClinicalAskHandoff = {
  targetMode: ClinicalAskModeId;
  label: string;
  acceptedContext: ConfirmedCaseContext;
};
export type ClinicalAskPublicErrorCode =
  | "invalid_request"
  | "identifiable_input_blocked"
  | "mode_unavailable"
  | "unauthorized"
  | "rate_limited"
  | "retrieval_unavailable"
  | "external_unavailable"
  | "synthesis_invalid"
  | "provider_unavailable"
  | "timeout"
  | "aborted"
  | "internal_error";
export type ClinicalAskDraft = {
  mode: ClinicalAskModeId;
  lead: ClinicalAskClaim;
  sections: ClinicalAskSection[];
  conflicts: ClinicalAskClaim[];
  missingInformation: string[];
  followUps: string[];
  handoffs: ClinicalAskHandoff[];
};
export type ClinicalAskFeedbackMetadata = { interactionId: string; answerHash: string; feedbackToken: string };
export type ClinicalAskFinalPayload = { response: ClinicalAskResponse; feedback: ClinicalAskFeedbackMetadata | null };
export type ClinicalAskProgressStage =
  | "validating"
  | "confirming_context"
  | "clarifying"
  | "catalogue"
  | "indexed"
  | "external"
  | "synthesizing"
  | "governing"
  | "complete";
export type ClinicalAskProgressEvent = { type: "progress"; stage: ClinicalAskProgressStage; elapsedMs: number };
export type ClinicalAskResponse =
  | {
      state: "clarification_required";
      mode: ClinicalAskModeId;
      suggestions: ContextSuggestion[];
      clarifications: ClinicalAskClarification[];
    }
  | {
      state: "answered";
      mode: ClinicalAskModeId;
      lead: ClinicalAskClaim;
      sections: ClinicalAskSection[];
      evidence: ClinicalAskEvidence[];
      conflicts: ClinicalAskClaim[];
      missingInformation: string[];
      followUps: string[];
      handoffs: ClinicalAskHandoff[];
    }
  | {
      state: "evidence_gap";
      mode: ClinicalAskModeId;
      explanation: string;
      evidence: ClinicalAskEvidence[];
      missingInformation: string[];
      nextActions: string[];
    }
  | { state: "failed"; mode: ClinicalAskModeId; code: ClinicalAskPublicErrorCode; retryable: boolean; message: string };
export type ClinicalAskStreamEvent =
  | ClinicalAskProgressEvent
  | { type: "context_suggestions"; suggestions: ContextSuggestion[] }
  | { type: "clarification"; response: Extract<ClinicalAskResponse, { state: "clarification_required" }> }
  | { type: "evidence"; evidence: ClinicalAskEvidence[] }
  | { type: "final"; payload: ClinicalAskFinalPayload }
  | { type: "error"; code: ClinicalAskPublicErrorCode; retryable: boolean; message: string };
export type ClinicalAskRequest = {
  mode: ClinicalAskModeId;
  question: string;
  confirmedContext: ConfirmedCaseContext;
  clarificationAnswers: Partial<Record<string, string>>;
  priorTurns: Array<{ role: "user" | "assistant"; text: string }>;
  allowExternalFallback: boolean;
  inputTransport: "typed" | "voice";
};
export type ClinicalAskDependencies = {
  suggestContext(input: ClinicalAskRequest, signal: AbortSignal): Promise<ContextSuggestion[]>;
  retrieveCatalogue(input: ClinicalAskRequest, signal: AbortSignal): Promise<ClinicalAskEvidence[]>;
  retrieveIndexed(
    input: ClinicalAskRequest,
    accessScope: RetrievalAccessScope,
    signal: AbortSignal,
  ): Promise<ClinicalAskEvidence[]>;
  retrieveExternal(
    input: ClinicalAskRequest,
    allowedDomains: readonly string[],
    signal: AbortSignal,
  ): Promise<ClinicalAskEvidence[]>;
  synthesize(
    input: ClinicalAskRequest,
    evidence: readonly ClinicalAskEvidence[],
    signal: AbortSignal,
  ): Promise<ClinicalAskDraft>;
};
