import { REFERRAL_HISTORY_LIMITS, type ReferralHistoryField } from "@/components/ward-management/ward-model";

/**
 * A written history for a fixture that is not about the written history.
 *
 * ⚠️ **WHY IT EXISTS.** `Referral` gained free-text on 2026-09-05 (owner instruction). Around fifty
 * fixtures across two dozen suites construct a referral or a `RECEIVE_REFERRAL` in order to test
 * something else entirely — eligibility, visibility, matching, travel grouping, morning rollups.
 * None is about the history, and **none may be affected by it**: `Referral.history` states that
 * nothing in this system may derive anything from it, so a visibility or eligibility result that
 * changed with the history would be evidence of a defect, not of a bad fixture. Spreading this in
 * says so in one greppable token.
 *
 * ⚠️ **IT IS STILL NON-BLANK, THOUGH THE FIELD IS NOW OPTIONAL AND A BLANK WOULD BE ACCEPTED.**
 * Three boxes became one and the required half was dropped by the owner's ruling of 2026-09-05, so
 * the reason this value is non-empty has CHANGED and is worth restating rather than inheriting: a
 * fixture spreading `history: ""` would exercise the empty path in fifty suites that are not about
 * the history, and the empty path is the one where a screen has to say "Not written yet" in words.
 * **Fifty accidental tests of the absent case is not coverage, it is a monoculture.** Tests that
 * are about the blank write it themselves.
 *
 * ⚠️ **AND THE HISTORY OF THIS FILE IS WORTH KEEPING NOW THE RULE IT RECORDS IS GONE.** Its first
 * version had the field empty when the field was REQUIRED, and turned 100 tests red in one run —
 * every dispatch built from the blank spread was refused and the referral under test was never
 * created. **The refusal was right and the fixture was wrong.** The temptation at that moment was
 * to relax the reducer to make the fixtures pass, which would have deleted the rule rather than
 * fixed the fixture. The owner has since removed that rule deliberately, which is a different act
 * entirely — and the reason to remember the first one is that it looked exactly like this.
 *
 * ⚠️ **DO NOT USE IT IN A TEST THAT IS ABOUT THE HISTORY.** Those write the strings they mean,
 * because the value under test is the whole point.
 *
 * ⚠️ **AND IT IS NOT A DEFAULT.** Nothing in `src/` imports this; the product has no fallback for
 * a missing history, and adding one would put words nobody wrote into a clinical record.
 */
export const FIXTURE_HISTORY: Record<ReferralHistoryField, string> = {
  history: "Fixture history. This referral is used to test something other than the history.",
};

/**
 * A history that is one character too long for its field — for proving the refusal, never the trim.
 *
 * Built from `REFERRAL_HISTORY_LIMITS` rather than from a typed-out number, so it stays exactly one
 * over on the day somebody changes a limit. A hard-coded 1501 would silently stop testing the
 * boundary the moment the limit moved, and would go on passing.
 */
export function oneCharacterTooLong(field: ReferralHistoryField): string {
  return "x".repeat(REFERRAL_HISTORY_LIMITS[field] + 1);
}

/** Exactly at the limit — the value that must be ACCEPTED, so the refusal above is proved to be
 *  about length rather than about the field being long-ish. */
export function exactlyAtTheLimit(field: ReferralHistoryField): string {
  return "x".repeat(REFERRAL_HISTORY_LIMITS[field]);
}
