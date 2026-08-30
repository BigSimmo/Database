import { formatElapsed, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import type { Referral } from "@/components/ward-management/ward-model";
import { referralClocks, REFERRAL_CLOCK_TERMS } from "@/components/ward-management/ward-referrals";

/**
 * THE ONE WAIT FIGURE THE REFERRAL SCREENS PRINT — and the reason it is not `referralWaitLabel`.
 *
 * ⚠️ **`referralWaitLabel` RUNS FOREVER.** It is `formatElapsed(minutesUntil(now, raisedAt))` and
 * nothing else, so it keeps counting after the person has already been triaged into a department.
 * A referral raised at 09:00 for somebody triaged at 09:20 still reads "3h 40m waiting" at 12:40 —
 * a wait nobody is serving, rendered exactly like one somebody is. `P9-D7` stops the referral clock
 * when the patient reaches the department, and `referralClocks` is where that stopping lives.
 *
 * ⚠️ **A STOPPED SPAN IS WORDED DIFFERENTLY FROM A RUNNING WAIT, and that is not styling.** The
 * running form says "waiting", which asserts that a clock is still counting; the stopped form says
 * what stopped it. `sinceReferralRunning` is the field that decides, and it exists for this.
 * `src/components/ward-management/ed/ed-screen.tsx` makes the same split for its two-line layout —
 * this is the single-cell version of it, and both compose the SAME vocabulary.
 *
 * ⚠️ **THE WORDS COME FROM `REFERRAL_CLOCK_TERMS`, never from here.** That value exists because a
 * doc comment asking screens not to say "arrived" is precisely what already failed once: the field
 * is `triagedAt`, a patient arrives and is triaged some time later, and the two are different
 * events. `tests/ward-referral-clocks.test.ts` fails on any term containing "arriv"; a phrase
 * invented in this file would sit outside that check.
 *
 * ⚠️ **ONE `now`, ONE `referralClocks` CALL.** Both the figure and the running/stopped decision come
 * from the same reading. Two readings for one cell can disagree with themselves, which the
 * out-of-area board already did once on this same model.
 *
 * Durations go through `formatElapsed`/`splitDuration` (`ward-clock.ts`) and are never hand-rolled
 * from minutes here — two screens each doing their own hours-from-minutes conversion is what kept
 * `25h 30m` alive on eleven surfaces.
 */
export function referralWaitLine(referral: Referral, now: Instant): string {
  const clocks = referralClocks(referral, now);
  // The running branch keeps the exact register every other live wait in Ward Flow uses, so a
  // queue that has always read "40m waiting" still does — only a clock that has actually STOPPED
  // reads differently, and it reads differently on purpose.
  return clocks.sinceReferralRunning
    ? formatElapsed(clocks.sinceReferral)
    : `${splitDuration(clocks.sinceReferral)} ${REFERRAL_CLOCK_TERMS.sinceReferralStopped}`;
}
