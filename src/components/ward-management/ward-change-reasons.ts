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
  // Phase 5 (spec D3). Operational facts about the bed, chosen for the "ready but cannot leave"
  // case. Deliberately NOT added: guardianship, financial arrangements, family availability — each
  // describes the person rather than the bed, and so follows "Pending case review outcome" out of
  // this list. Adding one is a recorded product decision, never an implementer's convenience.
  "Awaiting accommodation",
  "Awaiting transport",
  "Awaiting receiving-service acceptance",
  // OWNER-APPROVED addition, 2026-08-28 ("The three lists", List 1). This entry deliberately
  // OVERTURNS the Phase 5 exclusion recorded in the comment above ("family availability"), and
  // the reasoning is recorded here so the next reader does not re-argue it: the "describes the person, not the bed" rule is sound in
  // general and is kept everywhere else, but it fails on its own terms here. A discharge held up
  // because nobody can collect someone, or because the family need a day's notice, IS a real
  // reason the bed is not coming free. Excluding it does not stop it happening — it makes a ward
  // record "Awaiting service coordination" instead, and the recorded reason becomes WRONG. A
  // wrong reason is worse than a blunt one.
  //
  // Guardianship and financial arrangements stay excluded; the Phase 5 reasoning still holds for
  // those two. Adding any further entry remains a recorded product decision, never an
  // implementer's convenience.
  //
  // Provenance, stated because it matters: these words were proposed by an agent session and
  // APPROVED by the product owner. No charge nurse has seen them. If a clinician offers different
  // words, theirs replace these verbatim.
  "Awaiting family or carer arrangement",
] as const;
export type BedReleaseBlocker = (typeof BED_RELEASE_BLOCKERS)[number];

/**
 * The bed-model rework of 2026-08-28 (`docs/ward-flow-phase-6-7-decisions.md`, Q4). Once a bed is
 * released it may carry a short indication that it is being MADE READY — the owner's example was
 * cleaning. His own clinical reasoning is why this is a note and not a fifth lifecycle stage:
 *
 * > "Once a bed is available, a patient will be pulled. Pulled patient takes hours to transport
 * > and move, so it is fine to allocate this bed. Just have a note for preparing bed maybe until
 * > it is ready."
 *
 * So the note is **informational and must NEVER gate allocation**. A bed being made ready is
 * still offered, still counts in `availableNow`, and still appears in every figure. Anything
 * else reintroduces the delay that answer says does not exist. Structurally this is enforced
 * three ways and none of them is a comment: the note lives on a `BedRelease`, `capacityBreakdown`
 * derives `availableNow` from the UNIT's own fields and never reads a release at all, and
 * matching never reads a `BedRelease` in the first place (`tests/ward-referral-matching.test.ts`).
 *
 * **The owner supplied the list on 2026-08-28** ("The three lists", List 3), so this array is no
 * longer empty and the note is expressible. Cleaning is his own example. Maintenance is the other
 * thing expected to take a bed out of use briefly without anything clinical changing. Both
 * describe the BED and nothing else, which is the same bar every list above holds to.
 *
 * Provenance, stated because it matters: these words were proposed by an agent session and
 * APPROVED by the product owner. No charge nurse has seen them. If a clinician offers different
 * words, theirs replace these verbatim. Adding an entry is a recorded product decision, never an
 * implementer's convenience.
 */
/**
 * WHY A COORDINATOR REFERRED DESPITE A FAILING GATE. Owner-approved verbatim, 2026-08-29 — the
 * canonical record is `WB-DB-15` (as superseded to five) and `WB-DB-16` on the ward board
 * specification.
 *
 * FIVE, not four. `WB-DB-15` shipped as four and carries its own superseded-to-five block; anyone
 * working from the four-reason version is reading the superseded entry.
 *
 * Stored as the sentences themselves rather than as keys with a separate label map, matching
 * `BED_RELEASE_BLOCKERS` and `BED_PREPARATION_NOTES` above: these are the owner's own words, and a
 * key plus a label is two places for one fact and one of them free to drift.
 *
 * ⚠️ **THERE IS NEVER AN "OTHER, PLEASE SPECIFY"** (`WB-DB-16`). That entry is the whole constraint:
 * it is how free text returns through the back door after being removed from the front. Adding one
 * would undo the decision this list exists to implement.
 *
 * **"Nowhere eligible" is deliberately excluded.** It is already its own recorded act — an
 * escalation (`RECORD_ESCALATION`) — and a second vocabulary for one fact is how two screens come
 * to describe the same event differently.
 */
/**
 * 🔴 WHY A WARD'S REFERRAL ENDED — and it may NEVER say where the patient went (`FD-23`).
 *
 * Until 2026-08-30 `withdrawnReferrals[].reason` was a bare `string`, and both the reducer and the
 * seed filled it with the winner's name:
 *
 *     reason: `withdrawn — placed at ${acceptedUnit.name}`
 *     reason: "Referral withdrawn once RGH Adult Secure confirmed the bed"
 *
 * The ward page renders that verbatim, so a LOSING ward read the ACCEPTING ward's name out of the
 * very field that exists to record its own loss. Confirmed on screen by two sessions independently.
 *
 * ⚠️ **NO SHAPE GUARD COULD SEE IT.** `ward-referral-visibility.ts` holds a mutation-tested
 * field-set allowlist at every level and this passed all of them: `reason` was a permitted field of
 * a permitted type carrying a forbidden VALUE. A guard over shapes cannot see a fact smuggled in
 * prose.
 *
 * ⚠️ **WHICH IS WHY THE FIX IS A TYPE AND NOT A BETTER SENTENCE.** Sanitising the string leaves a
 * free-form `string` any future edit can refill, with nothing red to say so. As a union the leak is
 * UNREPRESENTABLE rather than merely absent.
 *
 * The list is short because the model has exactly one way this happens today. Adding a member is a
 * governance decision, not an implementation one — and no member may name a place.
 *
 * **Nothing is lost to the coordinator:** it may read `movement.acceptedUnitId` directly, because it
 * is allowed to. The destination stops travelling inside a ward-readable string.
 */
export const WITHDRAWAL_REASONS = ["another_unit_accepted"] as const;
export type WithdrawalReason = (typeof WITHDRAWAL_REASONS)[number];

/**
 * What a ward is shown. Says the referral ended and why, and names no place.
 *
 * ⚠️ **"ACCEPTED", NOT "PLACED" — AND THAT IS A SECOND DEFECT, NOT A WORDING PREFERENCE.**
 * The first code here was `placed_elsewhere`, labelled *"the patient was placed elsewhere"*.
 * It closed the leak and kept a falsehood: `ACCEPT_IN_PRINCIPLE` leaves the movement at
 * `accepted_awaiting_bed`, so **the patient is accepted, not moved**, and the sentence asserted
 * a transfer that had not happened. Two sessions drafted "placed" independently and one caught
 * it. The lesson is the one worth keeping: **each of us checked the string for the thing we
 * were hunting, and not for whether it was true.**
 *
 * The wording matches the ward page verbatim, so the record and the screen cannot drift apart.
 *
 * ⚠️ **AND IT IS TRUE ONLY CONDITIONALLY.** "Another unit accepted" is true of every entry that
 * can exist today because `ACCEPT_IN_PRINCIPLE` is the only writer of `withdrawnReferrals` —
 * measured, one site, and pinned by `tests/ward-withdrawal-reason-privacy.test.ts`. A second
 * withdrawal path with a different cause makes this label quietly wrong; the pin is what makes
 * that a red test rather than a silent falsehood on a ward screen.
 */
export const withdrawalReasonLabels: Record<WithdrawalReason, string> = {
  another_unit_accepted: "Withdrawn — another unit accepted this patient.",
};

export const OVERRIDE_REASONS = [
  "The receiving team has agreed despite the mismatch",
  "Clinical urgency outweighs the mismatch",
  "The bed information is known to be out of date",
  "Continuity with a previous admission at this unit",
  "Closer to the person's home or family",
] as const;
export type OverrideReason = (typeof OVERRIDE_REASONS)[number];

export const BED_PREPARATION_NOTES = ["Being cleaned", "Awaiting maintenance or repair"] as const;
export type BedPreparationNote = (typeof BED_PREPARATION_NOTES)[number];

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
