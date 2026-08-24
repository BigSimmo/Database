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
// nobody reads this channel, so that reaching out is answered rather than met with silence. Content is
// discarded after this response is sent; nothing is stored, counted per patient, or shown to staff.
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
