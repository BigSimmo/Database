import { describe, expect, it } from "vitest";

import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Referral } from "@/components/ward-management/ward-model";
import { REFERRAL_CLOCK_TERMS, referralClocks } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * TWO CLOCKS, AND THE SECOND ONE IS ALLOWED TO NOT EXIST.
 *
 * `P9-D2` (OWNER, 2026-08-30): every wait carries **two** clocks, both visible — time in the
 * department, counted from triage, and time since the referral to mental health. **The gap between
 * them is the signal**: it says whether the delay sits upstream of mental health or with them,
 * which one clock can only ever obscure. He rejected referral-only (a patient sits for hours before
 * anyone refers, and the screen shows a short wait) and triage-only (mental health looks slow for
 * a delay it could not act on).
 *
 * `P9-D7`: a **community expect who has not arrived has only ONE clock**, and the screen must say
 * so. Time in department does not exist for them yet, and it must render as genuinely absent —
 * ⚠️ **not `0m`, not an em dash styled like a duration, and never a zero that sorts alongside real
 * waits.** *"A not-yet-arrived expect showing '0m in department' reads as 'just arrived', which is
 * the opposite of the truth."*
 *
 * ⚠️ **THE MODEL COULD NOT EXPRESS ANY OF THAT UNTIL NOW — `P9-F3`.** `P9-D7` was recorded against
 * a `Referral` with no arrival instant at all, so the ruling had **no field to read**: settled in
 * the register and unbuildable from the code, with neither side announcing the disagreement. This
 * file is the other half of closing that, and every assertion below is one of those two rows.
 *
 * ⚠️ **AND `triagedAt` IS NOT THE `arrivedAt` PHASE 8 TASK 2R DELETED.** That one meant arriving at
 * a **bed**, and it went because `Admission` is the single record of a person occupying one. This
 * is entering the **department** — a different event, at a different place, starting a different
 * clock, for a person who may never get a bed at all. Naming it `arrivedAt` again would have made
 * the deletion look reversed rather than complemented; see `Referral.triagedAt`'s own comment.
 *
 * ⚠️ **TRIAGE IS A PROXY FOR ARRIVAL, NOT ARRIVAL.** A patient arrives, waits, and is triaged some
 * time later; on a busy night that gap is not small. The arithmetic is unaffected and **the wording
 * is not** — the last test in this file fails on any clock term containing "arriv", because the
 * first version of this work was named honestly and commented dishonestly, and it was the comment
 * that would have reached the screen.
 */
const NOW = NOW_ANCHOR;

describe("a referral's two clocks", () => {
  const base = seedWardFlowState().referrals[0]!;

  it("has no time in department until the person is in the department", () => {
    const expected: Referral = { ...base, raisedAt: NOW - 40, triagedAt: undefined };
    const clocks = referralClocks(expected, NOW);

    expect(clocks.sinceReferral).toBe(40);
    expect(
      clocks.inDepartment,
      "a community expect who has not arrived has ONE clock. Zero would read as 'just arrived' — " +
        "the opposite of the truth — and would sort them as the newest arrival when they are not there.",
    ).toBeUndefined();
    // Stated separately because `undefined` and `0` are both falsy, and an implementation that
    // returned 0 would satisfy a truthiness check while failing the ruling outright.
    expect(clocks.inDepartment).not.toBe(0);
  });

  it("⚠️ RUNS BOTH CLOCKS OFF ONE `now` — the defect that has already happened once here", () => {
    // The out-of-area board read two clocks for one comparison on this same model and disagreed
    // with itself, so this is a repeat defect, not a hypothetical.
    //
    // ⚠️ The first version of this test asserted the two durations were EQUAL for a referral
    // triaged at the instant it was raised. That was wrong about the model it was testing, not
    // about the property: equal instants mean the person arrived the moment they were referred, so
    // the referral clock STOPS at 0 while the department clock runs. Kept as a note because the
    // assertion looked obviously right and would have been "fixed" by weakening the stop rule.
    //
    // The property, expressed so the stop rule does not interfere: for someone already in the
    // department, BOTH clocks run, so the gap between them is a constant of the two stored instants
    // and cannot move with `now` — and both must advance by exactly what `now` advanced by. Two
    // clock sources (a second `wallClockNow()` inside the derivation, say) break both halves.
    const running: Referral = { ...base, raisedAt: NOW - 30, triagedAt: NOW - 200 };
    for (const now of [NOW, NOW + 5, NOW + 2_000]) {
      const clocks = referralClocks(running, now);
      expect(clocks.inDepartment! - clocks.sinceReferral).toBe(170);
    }
    const before = referralClocks(running, NOW);
    const after = referralClocks(running, NOW + 5);
    expect(after.sinceReferral - before.sinceReferral).toBe(5);
    expect(after.inDepartment! - before.inDepartment!).toBe(5);
  });

  it("keeps the referral clock running for someone already in the department — the GAP is the point", () => {
    // The ED patient: triaged, waits, and is referred to mental health later. Time in department is
    // the LONGER number and the difference is the pre-referral delay `P9-D2` exists to show.
    const edPatient: Referral = { ...base, raisedAt: NOW - 30, triagedAt: NOW - 200 };
    const clocks = referralClocks(edPatient, NOW);

    expect(clocks.inDepartment).toBe(200);
    expect(clocks.sinceReferral).toBe(30);
    expect(clocks.sinceReferralRunning, "nothing has ended this wait — they are still waiting to be seen").toBe(true);
    expect(
      clocks.inDepartment! - clocks.sinceReferral,
      "the gap is the pre-referral delay, and it is the reason the owner asked for two numbers",
    ).toBe(170);
  });

  it("⚠️ STOPS the referral clock when the person arrives AFTER being referred", () => {
    // The community expect who has now turned up. `P9-D7` via `P9-F3`: the referral clock runs
    // only until the patient arrives. Proved by ADVANCING `now` — a clock that has stopped does not
    // grow, and asserting a single value could not tell the two apart.
    const arrived: Referral = { ...base, raisedAt: NOW - 300, triagedAt: NOW - 120 };
    const atNow = referralClocks(arrived, NOW);
    const muchLater = referralClocks(arrived, NOW + 600);

    expect(atNow.sinceReferral).toBe(180);
    expect(muchLater.sinceReferral, "a stopped clock does not grow with the wall clock").toBe(180);
    expect(atNow.sinceReferralRunning).toBe(false);
    expect(muchLater.inDepartment, "the department clock is the one still running for them").toBe(720);
  });

  it("never returns a negative duration for a referral raised in the future", () => {
    // Defensive rather than expected: a fixture authored at a future anchor, or a re-anchor that
    // moves `now` backwards, must not produce "-20m waiting" on a board.
    const future: Referral = { ...base, raisedAt: NOW + 20, triagedAt: NOW + 5 };
    const clocks = referralClocks(future, NOW);
    expect(clocks.sinceReferral).toBeGreaterThanOrEqual(0);
    expect(clocks.inDepartment).toBeGreaterThanOrEqual(0);
  });

  it('⚠️ WORDS NEITHER CLOCK AS "ARRIVED", because triage is a proxy for arrival and not arrival', () => {
    // The guard that replaces the comment which failed. `triagedAt` is when the department triaged
    // this person; they arrived some time earlier and, on a busy night, not by a small margin. So
    // "arrived 14:20" would assert a fact this model does not hold — and it is the natural phrasing,
    // which is exactly why it needs a test rather than a note.
    const terms = Object.entries(REFERRAL_CLOCK_TERMS);
    expect(terms.length, "an empty term set would satisfy every assertion in this loop").toBeGreaterThan(3);
    for (const [key, term] of terms) {
      expect(term.toLowerCase(), `REFERRAL_CLOCK_TERMS.${key} says "arrived". Say triage.`).not.toContain("arriv");
      expect(term.length, `REFERRAL_CLOCK_TERMS.${key} is empty, so a screen would print nothing`).toBeGreaterThan(0);
      expect(term, `REFERRAL_CLOCK_TERMS.${key} is a term, not a sentence — screens compose the layout`).not.toContain(
        ".",
      );
    }
    // The absent case is the one `P9-D7` is about, so it must exist and must not read as a duration.
    expect(REFERRAL_CLOCK_TERMS.notInDepartment).not.toMatch(/\d/);
    expect(REFERRAL_CLOCK_TERMS.notInDepartment).not.toBe("—");
  });

  it("⚠️ IS EXERCISED BY THE SEED IN BOTH SHAPES, or every assertion above is about nothing", () => {
    // The canary. Hand-made referrals prove the arithmetic; only the seed proves the screens have
    // both cases to render. `P9-D7`'s whole risk is a not-yet-arrived expect, so the seed must
    // carry one — and `P9-D2`'s gap needs someone already in the department.
    const referrals = seedWardFlowState().referrals;
    expect(referrals.length).toBeGreaterThan(1);
    expect(
      referrals.some((referral) => referral.triagedAt === undefined),
      "no seeded referral is a not-yet-arrived expect, so nothing demonstrates the absent clock",
    ).toBe(true);
    expect(
      referrals.some((referral) => referral.triagedAt !== undefined && referral.triagedAt < referral.raisedAt),
      "no seeded referral was already in the department when it was raised, so the gap is never shown",
    ).toBe(true);
  });
});
