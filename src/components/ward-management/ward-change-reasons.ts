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

/**
 * Task 6 (spec item 11): the escalation contact, chosen never typed — the last free-text input in
 * the escalation form becomes a fixed list, for the same reason as the four lists above. Five
 * entries are drawn from language this model already uses; "Other service" is the one deliberate
 * general entry — never a free-text field of its own, which would reinstate exactly what this
 * removes. Unlike the four reason lists above, there is no separate snake_case value / label pair:
 * the values themselves are the rendered display text, because there is no clinical token to keep
 * out of a label here to begin with.
 */
export const ESCALATION_CONTACTS = [
  "State bed coordination desk",
  "Duty psychiatrist",
  "Bed management",
  "Nurse unit manager (destination ward)",
  "Escort or transport provider",
  "Other service",
] as const;
export type EscalationContact = (typeof ESCALATION_CONTACTS)[number];

/**
 * Task 11 (spec item 9): the blocker on a bed release, chosen never typed — same discipline as
 * every fixed list above. This is the operational fact holding the bed up, and the privacy rule
 * from the binding spec §4 is unconditional: never a blocker that describes a person, only the
 * BED. Drawn from the wording `ward-movements.ts`'s existing `bedReleases` fixture already uses,
 * generalised to fixed categories rather than copied as free-text sentences:
 *   - "Awaiting clean" generalises the fixture's "Bed clean pending".
 *   - "Awaiting pharmacy" matches the fixture's "Awaiting pharmacy" exactly.
 *   - "Awaiting placement confirmation" generalises "Awaiting bed-management confirmation" and
 *     "Awaiting external placement confirmation".
 *   - "Awaiting service coordination" generalises "Awaiting external service coordination".
 * The fixture's sixth entry, "Pending case review outcome", is deliberately NOT a source here —
 * "case review" reads as being about the patient's own case, not the bed, so it is excluded
 * rather than generalised. Like `ESCALATION_CONTACTS`, there is no separate label map: the
 * values ARE the rendered text, because there is no clinical token to keep out of a label here
 * to begin with.
 */
export const BED_RELEASE_BLOCKERS = [
  "Awaiting clean",
  "Awaiting pharmacy",
  "Awaiting placement confirmation",
  "Awaiting service coordination",
] as const;
export type BedReleaseBlocker = (typeof BED_RELEASE_BLOCKERS)[number];

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
