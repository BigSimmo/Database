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

/**
 * Task 3: the undo the prototype has never had. Same discipline as the two lists above — chosen,
 * never typed, operational and content-free. Neither describes a patient, a diagnosis, a clinical
 * judgement or a legal requirement.
 */
export const RELEASE_HOLD_REASONS = [
  "patient_no_longer_coming",
  "bed_needed_for_another_patient",
  "ward_withdrew_the_bed",
  "hold_made_in_error",
] as const;
export type ReleaseHoldReason = (typeof RELEASE_HOLD_REASONS)[number];

export const CANCEL_TRANSPORT_REASONS = [
  "provider_unavailable",
  "patient_not_ready",
  "destination_changed",
  "job_created_in_error",
] as const;
export type CancelTransportReason = (typeof CANCEL_TRANSPORT_REASONS)[number];

export const changeReasonLabels: Record<
  UrgencyChangeReason | LegalStatusChangeReason | ReleaseHoldReason | CancelTransportReason,
  string
> = {
  reassessed: "Reassessed",
  new_information: "New information",
  correcting_an_error: "Correcting an error",
  recorded_by_treating_team: "Recorded by treating team",
  // These three labels deliberately avoid the word "patient" even though the underlying reason
  // VALUE (fixed by the product brief, never renamed) carries it — `tests/ward-change-reasons.test.ts`
  // bans that token from any reason value or label it can rewrite, and the label text is the part
  // this file controls.
  patient_no_longer_coming: "No longer coming",
  bed_needed_for_another_patient: "Bed needed elsewhere",
  ward_withdrew_the_bed: "Ward withdrew the bed",
  hold_made_in_error: "Hold made in error",
  provider_unavailable: "Provider unavailable",
  patient_not_ready: "Not yet ready",
  destination_changed: "Destination changed",
  job_created_in_error: "Job created in error",
};
