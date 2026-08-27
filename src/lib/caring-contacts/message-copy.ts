import { calculateGsm7, type Gsm7Evidence } from "./message-policy";
import { FICTIONAL_CONTACTS_BY_ROLE } from "./synthetic-contacts";

// PROVISIONAL — not clinically approved. Corrected 2026-08-19 under production-build spec §2.1, which
// replaced the non-receiving sender with a receiving-capable number that auto-responds and discards.
// The previous wording ("Replies are not received, stored, analysed or monitored") became untrue the
// moment the number could receive: replies ARE received, then discarded unread. Stating something false
// about a safety boundary is the failure this programme can least afford, so the claim now describes only
// what remains true — that nobody reads them. Final wording is a clinical decision owned by the
// lived-experience and clinical-programme approval gate (docs/caring-contacts/message-review-pack.md §1).
export const PATIENT_VISIBLE_NO_REPLY_NOTICE = "No one reads replies to this number";

export const EXACT_PATIENT_VISIBLE_MESSAGE = `Hi Rowan, Alex from Example Aftercare Team is thinking of you. This is a one-way message. ${PATIENT_VISIBLE_NO_REPLY_NOTICE}. For timing changes call ${FICTIONAL_CONTACTS_BY_ROLE.programmeStaffedLine}, 9 am-6 pm. In an emergency call 000. Fictional Support Line: ${FICTIONAL_CONTACTS_BY_ROLE.crisisSupportContact}. - Alex`;

// PROVISIONAL — not clinically approved. Required by production-build spec §2.1: the automated response
// sent to anyone who replies. It must name where a person IS available, immediately after saying that
// nobody reads this channel, so that reaching out is answered rather than met with silence.
//
// Content is INTENDED to be discarded after this response is sent -- nothing stored, counted per
// patient, or shown to staff -- as a requirement on whatever sender is eventually built. This is a
// design contract, not a claim about current system behaviour: exactly as the next paragraph notes,
// there is no telephony provider yet to make it true or false, so do not read this line as evidence
// that anything is presently being discarded. Fixed round 1 (Minor 6, 2026-08-24): this line used to
// read as a settled operational fact, which is precisely the kind of unverifiable storage claim A2
// removed from the patient-visible text below -- reworded here so the module's own rationale does
// not silently reintroduce it.
//
// Corrected 2026-08-24 under the owner's approved copy decisions (items A2 + A3, see
// docs/caring-contacts/phase-2b-sdd-archive/task-c-brief.md). Two defects, fixed together because
// they are one sentence: A2 -- "has not been seen by anyone and has not been kept" was a firm claim
// about storage, made to a person in distress, about a system with no telephony provider yet, so
// nobody could currently know whether it was true. The replacement says only what this system can
// actually know: who is not reading. A3 -- a patient told "no one reads replies" who then receives
// this very message could reasonably conclude somebody read theirs first. "and this reply is
// automatic" closes that. EXACT_PATIENT_VISIBLE_MESSAGE is deliberately NOT touched: it is 252
// septets against the 2-segment ceiling with no room left, so this fact lives only here, where
// there is room -- see caring-contacts-message-copy.test.ts.
export const AUTOMATED_REPLY_RESPONSE = `No one at Example Aftercare Team reads this number, and this reply is automatic. To talk to someone, call ${FICTIONAL_CONTACTS_BY_ROLE.programmeStaffedLine}, 9 am-6 pm every day. In an emergency call 000. Fictional Support Line: ${FICTIONAL_CONTACTS_BY_ROLE.crisisSupportContact}.`;

export const EXACT_MESSAGE_GSM7: Gsm7Evidence = calculateGsm7(EXACT_PATIENT_VISIBLE_MESSAGE);
export const AUTOMATED_REPLY_GSM7: Gsm7Evidence = calculateGsm7(AUTOMATED_REPLY_RESPONSE);

/**
 * The approval status of the patient-visible wording in this module, in words a CLINICIAN reads.
 *
 * NOT PATIENT-VISIBLE. Nothing in this sentence is ever sent to anybody; it is governance chrome,
 * and it lives here rather than in a screen for the reason Ruling [131] was written. Round 1 of
 * Task 16 shipped a screen sentence claiming the opposite -- that the one patient-visible message
 * "has been approved" -- rendered directly beneath the two approval seats, where a clinician would
 * read those seats as having signed off the words a discharged patient receives. They have not:
 * the two constants above open with `PROVISIONAL -- not clinically approved`, and the decision
 * belongs to the approval gate named there.
 *
 * A screen that retyped this status would put the eventual answer in two places, and the copy on
 * the screen would go on saying "provisional" after the gate had decided. So the status is read
 * from beside the words it is about: change it here when the gate decides, and every screen
 * showing the wording changes with it.
 *
 * WHAT IT SEPARATES, and the distinction the deleted sentence collapsed: a pathway version's dual
 * approval is an approval of the VERSION -- its cadence, its lifecycle, the governance record --
 * and nothing anywhere in this system has approved the wording.
 */
export const CLINICIAN_FACING_WORDING_APPROVAL_STATUS =
  "This wording is provisional and has not been clinically approved. Whether it may be sent to a patient is a clinical decision owned by the lived-experience and clinical-programme approval gate, and that gate has not made it. A pathway version's recorded approvals approve the version, not these words.";
