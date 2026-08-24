/**
 * Fixed reason lists. Chosen, never typed — the same treatment `DECLINE_REASONS` already has,
 * and for the same reason: the synthetic-data promise must be true by construction rather than
 * by a user reading a label and complying.
 *
 * These are deliberately operational and content-free. NONE of them describes a patient, a
 * diagnosis, a clinical judgement or a legal requirement. A reason reading "patient
 * deteriorated" would be narrative clinical content; one reading "order made" would be a claim
 * about the Mental Health Act. Both are forbidden. If richer reasons are wanted they come from
 * the product owner; no agent adds one.
 */
export const URGENCY_CHANGE_REASONS = ["reassessed", "new_information", "correcting_an_error"] as const;
export type UrgencyChangeReason = (typeof URGENCY_CHANGE_REASONS)[number];

export const LEGAL_STATUS_CHANGE_REASONS = ["recorded_by_treating_team", "correcting_an_error"] as const;
export type LegalStatusChangeReason = (typeof LEGAL_STATUS_CHANGE_REASONS)[number];

export const changeReasonLabels: Record<UrgencyChangeReason | LegalStatusChangeReason, string> = {
  reassessed: "Reassessed",
  new_information: "New information",
  correcting_an_error: "Correcting an error",
  recorded_by_treating_team: "Recorded by treating team",
};
