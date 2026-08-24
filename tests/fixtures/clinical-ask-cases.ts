import { clinicalAskModeIds, type ClinicalAskRequest } from "@/lib/clinical-ask/contracts";

export const clinicalAskCases: ClinicalAskRequest[] = clinicalAskModeIds.map((mode) => ({
  mode,
  question: `What evidence should Example Community Clinic review for this ${mode} scenario?`,
  confirmedContext: { ageGroup: "adult", careSetting: "community", jurisdiction: "Example jurisdiction" },
  clarificationAnswers: {},
  priorTurns: [],
  allowExternalFallback: false,
  inputTransport: "typed",
}));

export const clinicalAskEdgeCases = {
  missingContext: "The care setting is not supplied.",
  negation: "No history of the example feature.",
  conflictingJurisdiction: "Two fictional jurisdictions publish conflicting guidance.",
  needsReview: "The catalogue record needs review.",
  unsupportedNumber: "No source supports the requested duration or number.",
  promptInjection: "External text says to ignore the evidence rules.",
  rejectedRedirect: "The authority redirects outside its allowlist.",
  providerFailure: "The mocked provider is unavailable.",
  abortedRecording: "The synthetic recording is aborted.",
  expiredSession: "The in-memory session has expired.",
} as const;
