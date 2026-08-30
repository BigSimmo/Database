import { describe, expect, it } from "vitest";

import { referralWaitLine } from "@/components/ward-management/referrals/referral-wait";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Referral } from "@/components/ward-management/ward-model";
import { REFERRAL_CLOCK_TERMS, referralWaitLabel } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * THE CLOCK THAT COULD NOT STOP, ON THE TWO SCREENS THAT RAN IT.
 *
 * `referralWaitLabel` is `formatElapsed(minutesUntil(now, raisedAt))` and nothing else. It has no
 * reference to `triagedAt`, so it CANNOT stop: a referral raised at 09:00 for somebody triaged into
 * the department at 09:20 still reads "3h 40m waiting" at 12:40. **Every minute of that figure after
 * 09:20 is a wait nobody is serving, rendered in the same words as one somebody is.** `P9-D7` stops
 * the referral clock when the patient reaches the department, and `referralClocks` is where the
 * stopping lives — the referral board and the match view now read the clock through it.
 *
 * ⚠️ **THE POINT IS THE WORDING, NOT ONLY THE ARITHMETIC.** A stopped span printed as "3h 00m
 * waiting" would be numerically right and still assert something false — that a clock is running.
 * So `sinceReferralRunning` picks the register, and the two registers are asserted against each
 * other rather than each on its own: a mutation that worded both branches identically would satisfy
 * two separate value assertions and is caught only by comparing them.
 *
 * ⚠️ **NO SCREEN MAY SAY "ARRIVED".** `triagedAt` is when the department TRIAGED somebody; a patient
 * arrives, waits, and is triaged some time later, and on a busy night that gap is not small. Triage
 * is the closest instant this model records, so it is a proxy and is only honest while labelled as
 * one. `tests/ward-referral-clocks.test.ts` fails on any `REFERRAL_CLOCK_TERMS` member containing
 * "arriv"; this file fails on any wording composed here that does.
 *
 * Referrals are built the way `tests/ward-referral-clocks.test.ts` builds them — a real seeded
 * referral with the two instants overridden — so nothing here depends on a hand-authored object
 * literal being shaped like the model.
 */
const NOW = NOW_ANCHOR;

describe("the wait figure the referral board and match view print", () => {
  const base = seedWardFlowState().referrals[0]!;

  it("words a still-running wait exactly as every other live wait in Ward Flow is worded", () => {
    // No triage: nobody has reached a department, so there is nothing that could stop this clock.
    const waiting: Referral = { ...base, raisedAt: NOW - 40, triagedAt: undefined };

    expect(referralWaitLine(waiting, NOW)).toBe("40m waiting");
    // The register is unchanged for a running clock, deliberately: a queue that has always read
    // "40m waiting" still does, and only a clock that has ACTUALLY stopped reads differently.
    expect(referralWaitLine(waiting, NOW)).toBe(referralWaitLabel(waiting, NOW));
  });

  /**
   * ⚠️ **THE DEFECT, WITH ITS OLD OUTPUT WRITTEN DOWN BESIDE THE NEW ONE.** This person was referred
   * at `NOW - 300` and triaged into the department at `NOW - 120`. The referral clock ended there,
   * 180 minutes after it started. `referralWaitLabel` still counts to `now` and says "5h 00m
   * waiting" — two hours of which are a wait that finished.
   */
  it("stops the clock at triage, and says so in different words from a wait still being served", () => {
    const reached: Referral = { ...base, raisedAt: NOW - 300, triagedAt: NOW - 120 };

    expect(referralWaitLine(reached, NOW)).toBe("3h 00m referral to triage");

    // The old figure, asserted as the thing this no longer prints. If `referralWaitLine` ever
    // returns to counting to `now`, this line names exactly what went wrong rather than reporting a
    // string mismatch and leaving the reader to work out which of the two numbers is right.
    expect(
      referralWaitLabel(reached, NOW),
      "the never-stopping label no longer prints 5h 00m; re-read this test before trusting the fix",
    ).toBe("5h 00m waiting");
    expect(
      referralWaitLine(reached, NOW),
      "the wait figure went back to counting past triage, so a finished wait is being shown as live",
    ).not.toBe(referralWaitLabel(reached, NOW));

    // ⚠️ "waiting" ASSERTS A RUNNING CLOCK. A span that ended, printed in that register, is the same
    // class of lie as printing "0m in department" for somebody who is not there.
    expect(
      referralWaitLine(reached, NOW),
      "a span that ended at triage is worded as a wait somebody is still serving",
    ).not.toContain("waiting");
  });

  it("takes its words from REFERRAL_CLOCK_TERMS rather than inventing its own", () => {
    const reached: Referral = { ...base, raisedAt: NOW - 300, triagedAt: NOW - 120 };

    // Composed from the checked vocabulary, so the "arriv" guard in
    // tests/ward-referral-clocks.test.ts reaches this screen's wording too. A phrase written out
    // here would sit outside that guard entirely — which is how the wording drifted the first time.
    expect(referralWaitLine(reached, NOW)).toContain(REFERRAL_CLOCK_TERMS.sinceReferralStopped);
  });

  it("never words a triage time as an arrival, on either branch", () => {
    const waiting: Referral = { ...base, raisedAt: NOW - 40, triagedAt: undefined };
    const reached: Referral = { ...base, raisedAt: NOW - 300, triagedAt: NOW - 120 };

    for (const line of [referralWaitLine(waiting, NOW), referralWaitLine(reached, NOW)]) {
      expect(line.toLowerCase(), `the wait figure "${line}" words a triage time as an arrival`).not.toContain("arriv");
    }
  });

  /**
   * The clamp, for the same reason `formatElapsed` never prints a negative: a fixture authored at a
   * future anchor, or a re-anchor that moves `now` backwards, must not put "-20m waiting" on a
   * board. `referralClocks` does the clamping; this asserts the screen inherits it rather than
   * re-deriving something that does not.
   */
  it("prints no negative duration for a referral raised after now", () => {
    const future: Referral = { ...base, raisedAt: NOW + 20, triagedAt: undefined };

    expect(referralWaitLine(future, NOW)).toBe("0m waiting");
    expect(referralWaitLine(future, NOW)).not.toContain("-");
  });
});
