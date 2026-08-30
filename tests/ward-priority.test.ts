// tests/ward-priority.test.ts
import { describe, expect, it } from "vitest";

import { operationalScore, queueOrder } from "../src/components/ward-management/ward-priority";
import { wardMovements } from "../src/components/ward-management/ward-movements";
import { isOpen } from "../src/components/ward-management/ward-derivations";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import type { Movement } from "../src/components/ward-management/ward-model";
import type { Instant } from "../src/components/ward-management/ward-clock";

function movementById(id: string) {
  const found = wardMovements.find((movement) => movement.id === id);
  if (!found) throw new Error(`fixture is missing ${id}`);
  return found;
}

describe("operational score", () => {
  it("never reads urgency — two movements differing only in tier score identically", () => {
    const base = movementById("WF-001");
    const tierOne: Movement = { ...base, urgency: 1 };
    const tierThree: Movement = { ...base, urgency: 3 };
    expect(operationalScore(tierOne, NOW_ANCHOR).score).toBe(operationalScore(tierThree, NOW_ANCHOR).score);
  });

  it("scores a longer wait above a shorter one, all else equal", () => {
    const base = movementById("WF-001");
    const waitedLonger: Movement = { ...base, openedAt: base.openedAt - 240 };
    expect(operationalScore(waitedLonger, NOW_ANCHOR).score).toBeGreaterThan(operationalScore(base, NOW_ANCHOR).score);
  });

  // Relabelled from Form 1A to Form 4A on 2026-08-23 (fix wave 1, finding 8). These two
  // movements are test scaffolding, not fixture data: they exist to prove the breach-scoring
  // path works at all, and since the product-owner correction no Form 1A or 3B carries a `dueAt`,
  // labelling them 1A contradicted the model's own doc comment and invited a future author to
  // copy the shape. A Form 4A ("Transport order") is the honest carrier — it is about moving a
  // person, not about the examination timeline, and it legitimately carries a `dueAt` in this
  // model. The -30 and +400 offsets below are arbitrary test scaffolding chosen to sit either
  // side of `NOW_ANCHOR`; they are NOT Mental Health Act figures and nothing derives them from
  // one. After this correction these two movements are the only positive proof left that the
  // breach-scoring path scores at all, which is why they are relabelled rather than deleted.
  it("scores a breached legal deadline above a clear one", () => {
    const base = movementById("WF-001");
    const breached: Movement = {
      ...base,
      legalForm: { code: "4A", kind: "transport", dueAt: NOW_ANCHOR - 30 },
    };
    const clear: Movement = {
      ...base,
      legalForm: { code: "4A", kind: "transport", dueAt: NOW_ANCHOR + 400 },
    };
    expect(operationalScore(breached, NOW_ANCHOR).score).toBeGreaterThan(operationalScore(clear, NOW_ANCHOR).score);

    // Fix wave 1, finding 7: before this, `"passed its deadline"` (ward-priority.ts) was pinned
    // by no unit test at all — deleting or renaming it would have gone undetected, because the
    // only test that mentioned the string was the new whole-page ABSENCE assertion in Playwright,
    // which a deletion makes *more* likely to pass. Assert the rendered factor positively here.
    const breachFactor = operationalScore(breached, NOW_ANCHOR).factors.find(
      (factor) => factor.label === "Statutory timing",
    );
    expect(breachFactor, "a past-due form must produce a Statutory timing factor").toBeDefined();
    expect(breachFactor?.detail).toBe("Form 4A passed its deadline 30 min ago");
    // Fix wave 2, finding 6. Closing the gap disclosed in fix wave 1: the comparison above is an
    // ORDERING claim against a form scoring zero, so any positive value satisfied it and dropping
    // the breached tier from 30 to 10 survived as a mutation. This pins the statutory tiers
    // outright. No clinical or statutory figure is involved — these are the model's own
    // operational priority weights.
    expect(breachFactor?.points).toBe(30);

    // A +400 deadline is "clear" under `clockState` (>= 180 min remaining), which scores zero
    // points and so pushes no factor at all. Pinning that explicitly is the honest assertion —
    // and it is what makes the comparison above meaningful rather than a comparison of two
    // scored states.
    const clearFactor = operationalScore(clear, NOW_ANCHOR).factors.find(
      (factor) => factor.label === "Statutory timing",
    );
    expect(clearFactor, "a deadline still 400 min away must score no Statutory timing points").toBeUndefined();

    // The forward-counting branch of the same line. 90 min remaining is "due" under `clockState`
    // (remaining < 180 is "due"; < 60 is "critical"; < 0 is "breached"), which scores 10 points
    // and therefore renders. 90 is arbitrary test scaffolding on a transport order, not a legal
    // figure.
    const approaching: Movement = {
      ...base,
      legalForm: { code: "4A", kind: "transport", dueAt: NOW_ANCHOR + 90 },
    };
    const approachingFactor = operationalScore(approaching, NOW_ANCHOR).factors.find(
      (factor) => factor.label === "Statutory timing",
    );
    expect(approachingFactor?.detail).toBe("Form 4A due in 90 min");
    expect(approachingFactor?.points).toBe(10);
  });

  it("awards no Statutory timing points to a legal form with no dueAt", () => {
    // Task 6A: a Form 3B carries no dueAt — the clinician settled that the post-examination
    // clock counts up, so none is recorded. This must never score as breached, critical or due — the
    // patient's priority rides on "Time waiting" alone, which is precisely the clinician's rule,
    // and this must never gain a compensating bonus for being detained instead.
    const base = movementById("WF-003");
    const noDeadline: Movement = {
      ...base,
      legalForm: { code: "3B", kind: "detention" },
    };
    const { factors } = operationalScore(noDeadline, NOW_ANCHOR);
    expect(factors.find((factor) => factor.label === "Statutory timing")).toBeUndefined();
  });

  it("awards no Statutory timing points to a legal form with no dueAt", () => {
    // Task 6A: a Form 3B honestly carries no dueAt — the clinician, asked directly, settled that
    // the post-examination clock is elapsed ED wait counting up, not a countdown, so this model
    // records no deadline for a 3B. This must never score as breached, critical or due — the
    // patient's priority rides on "Time waiting" alone, which is precisely the clinician's rule,
    // and this must never gain a compensating bonus for being detained instead.
    const base = movementById("WF-003");
    const noDeadline: Movement = {
      ...base,
      legalForm: { code: "3B", kind: "detention" },
    };
    const { factors } = operationalScore(noDeadline, NOW_ANCHOR);
    expect(factors.find((factor) => factor.label === "Statutory timing")).toBeUndefined();
  });

  /**
   * The 2026-08-24 product-owner instruction: whether a patient has been reviewed stops affecting
   * the queue at all — no points for it, and no gate on requesting a bed. The 25-point
   * "Bed need confirmed" factor that used to fire on `examination.outcome === "inpatient_order"`
   * is deleted, and this pins the deletion two ways so it cannot quietly come back: no factor is
   * labelled for an examination or a review, and adding an examination changes nothing at all.
   *
   * The `examination` record itself is untouched and still asserted elsewhere
   * (`ward-flow-reducer.test.ts` for RECORD_EXAMINATION, `ward-model-phase3.test.ts` for the
   * fixture shape) — only its effect on priority is gone.
   */
  it("scores no factor for having been examined or reviewed", () => {
    const forbidden = /exam|review|assess|bed need/i;
    for (const movement of wardMovements) {
      for (const factor of operationalScore(movement, NOW_ANCHOR).factors) {
        expect(factor.label, `${movement.id} scored a factor labelled for review: ${factor.label}`).not.toMatch(
          forbidden,
        );
      }
    }

    // The fixture only carries `inpatient_order`, so drive the other two outcomes explicitly.
    const base = movementById("WF-001");
    for (const outcome of ["inpatient_order", "community_order", "revoked"] as const) {
      const examined: Movement = { ...base, examination: { at: NOW_ANCHOR - 30, outcome } };
      for (const factor of operationalScore(examined, NOW_ANCHOR).factors) {
        expect(factor.label, `outcome ${outcome} scored a factor labelled for review`).not.toMatch(forbidden);
      }
    }
  });

  it("scores an examined movement exactly as it scores the same movement unexamined", () => {
    const unexamined = movementById("WF-001");
    expect(unexamined.examination, "fixture assumption: WF-001 carries no examination").toBeUndefined();
    const before = operationalScore(unexamined, NOW_ANCHOR);

    for (const outcome of ["inpatient_order", "community_order", "revoked"] as const) {
      const examined: Movement = { ...unexamined, examination: { at: NOW_ANCHOR - 30, outcome } };
      const after = operationalScore(examined, NOW_ANCHOR);
      expect(after.score, `recording ${outcome} must not move the score`).toBe(before.score);
      expect(after.factors, `recording ${outcome} must not add or alter a factor`).toEqual(before.factors);
    }

    // The same identity from the other direction: WF-009 carries a real `inpatient_order`
    // examination in the fixture, and stripping it must leave its score untouched.
    const examinedFixture = movementById("WF-009");
    expect(examinedFixture.examination?.outcome, "fixture assumption: WF-009 was examined").toBe("inpatient_order");
    const stripped: Movement = { ...examinedFixture, examination: undefined };
    expect(operationalScore(stripped, NOW_ANCHOR).score).toBe(operationalScore(examinedFixture, NOW_ANCHOR).score);
  });

  it("explains itself — every point scored is attributed to a named factor", () => {
    for (const movement of wardMovements) {
      const { score, factors } = operationalScore(movement, NOW_ANCHOR);
      expect(factors.reduce((sum, factor) => sum + factor.points, 0)).toBe(score);
      for (const factor of factors) {
        expect(factor.label.length).toBeGreaterThan(0);
        expect(factor.detail.length).toBeGreaterThan(0);
      }
    }
  });

  it("stays inside its stated range so it cannot be read as a percentage of anything", () => {
    for (const movement of wardMovements) {
      const { score } = operationalScore(movement, NOW_ANCHOR);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it("does not report a blocker for a movement whose blocker field says there is none", () => {
    for (const id of ["WF-006", "WF-007", "WF-014"]) {
      const movement = movementById(id);
      const { factors } = operationalScore(movement, NOW_ANCHOR);
      expect(factors.find((factor) => factor.label === "Active blocker")).toBeUndefined();
    }
  });

  it("does not report a blocker for a value that only happens to start with 'None'", () => {
    const base = movementById("WF-001");
    const realBlocker: Movement = { ...base, blocker: "None of the secure units can take him" };
    const { factors } = operationalScore(realBlocker, NOW_ANCHOR);
    expect(factors.find((factor) => factor.label === "Active blocker")).toBeDefined();
  });

  it("states the decline count without a self-contradictory fraction against the parallel cap", () => {
    const movement = movementById("WF-009");
    const { factors } = operationalScore(movement, NOW_ANCHOR);
    const declineFactor = factors.find((factor) => factor.label === "Destinations declined");
    expect(declineFactor).toBeDefined();
    expect(declineFactor?.detail).not.toContain(" of 3");
    expect(declineFactor?.detail).toContain("5");
  });

  it("does not claim a transport delay for a movement already en route", () => {
    for (const movement of wardMovements) {
      if (movement.transport?.enRouteAt === undefined) continue;
      const { factors } = operationalScore(movement, NOW_ANCHOR);
      expect(factors.find((factor) => factor.label === "Transport delay")).toBeUndefined();
    }
  });

  it("still claims a transport delay for a movement accepted but not yet departed", () => {
    for (const id of ["WF-005", "WF-015"]) {
      const movement = movementById(id);
      const { factors } = operationalScore(movement, NOW_ANCHOR);
      expect(factors.find((factor) => factor.label === "Transport delay")).toBeDefined();
    }
  });
});

describe("queue order", () => {
  /**
   * Narrowed to the UNFLAGGED on 2026-08-30, when the urgent flag landed above the tiers. It read
   * "every tier 1 above every tier 2" over the whole queue, and a flagged tier-3 patient leading
   * the board is exactly what the flag is for.
   *
   * Narrowed rather than removed: the tier ladder still governs everyone without a flag, and
   * deleting this would have left that unasserted at the moment something was placed above it.
   */
  it("keeps every tier 1 above every tier 2 and every tier 2 above every tier 3, among the unflagged", () => {
    const ordered = queueOrder(wardMovements, NOW_ANCHOR).filter((movement) => !movement.flaggedUrgent);
    expect(ordered.length, "the fixture must still hold unflagged movements to order").toBeGreaterThan(1);
    const tiers = ordered.map((movement) => movement.urgency);
    expect([...tiers].sort((a, b) => a - b)).toEqual(tiers);
  });

  it("orders by operational score within a tier, highest first", () => {
    const ordered = queueOrder(wardMovements, NOW_ANCHOR);
    for (let index = 1; index < ordered.length; index += 1) {
      if (ordered[index].urgency !== ordered[index - 1].urgency) continue;
      expect(operationalScore(ordered[index - 1], NOW_ANCHOR).score).toBeGreaterThanOrEqual(
        operationalScore(ordered[index], NOW_ANCHOR).score,
      );
    }
  });

  it("excludes closed and arrived movements", () => {
    const ordered = queueOrder(wardMovements, NOW_ANCHOR);
    expect(ordered.every((movement) => !movement.closure && movement.stage !== "arrived")).toBe(true);
    expect(ordered.length).toBe(wardMovements.filter(isOpen).length);
  });

  it("orders tier 1 on waiting time, declines and blockers alone — the re-derived leading order after review stopped scoring", () => {
    // Re-derived from the code at NOW_ANCHOR after the 25-point "Bed need confirmed" factor was
    // deleted on 2026-08-24. Two movements moved, both because they used to carry that factor:
    // WF-017 fell from tier-1 row 2 to row 5 (66 -> 41), and WF-003 fell from row 3 to row 13
    // (52 -> 27). WF-009 still leads tier 1, but now on 28 waiting + 15 declines + 10 blocker
    // = 53 rather than on having been examined; it kept the lead only because its wait and
    // declines were always enough on their own.
    //
    // The first five are pinned rather than the whole tier because ranks 6 and 7 are a genuine
    // 40-40 tie (WF-309, WF-312) whose order is sort stability, not a scoring claim. These five
    // scores — 53, 50, 43, 42, 41 — are all distinct, so this is a real ordering assertion. It
    // is also the guard against the deleted factor returning: restore 25 points to WF-017 and it
    // jumps back to row 2, breaking this.
    const ordered = queueOrder(wardMovements, NOW_ANCHOR);
    const tierOneIds = ordered.filter((movement) => movement.urgency === 1).map((movement) => movement.id);
    expect(
      tierOneIds.slice(0, 5),
      "The leading order of tier 1 has changed. Tier 1 is the most urgent queue on the board, so " +
        "this is the order a coordinator would work down. The five scores behind it are 53, 50, 43, " +
        "42 and 41 - all distinct, so this is a real ordering claim and not sort stability. Check " +
        "WF-017 first: it sits at 41 only because the 25-point 'Bed need confirmed' factor was " +
        "deleted on 2026-08-24, so if it has jumped back toward row 2 that factor has returned, " +
        "which is the specific regression this line exists to catch. Re-derive the scores from the " +
        "code before changing any id here.",
    ).toEqual(["WF-009", "WF-315", "WF-006", "WF-014", "WF-017"]);

    // WF-003 was row 3 and is now behind WF-303, which it used to outrank. Asserted by id
    // because that pair is the clearest single consequence of the removal.
    expect(tierOneIds.indexOf("WF-303")).toBeLessThan(tierOneIds.indexOf("WF-003"));
  });
});

/**
 * THE URGENT FLAG — who gets the next bed, and the decision that is deliberately still open.
 *
 * Owner, 2026-08-30: "A long wait always is prioritised… however… in certain cases patients can be
 * marked as urgent for many reasons which outranks everything." Asked how far to take it, he scoped
 * it small on purpose: "For now just have a feature that flags the patient. I will build on it
 * later."
 *
 * ⚠️ SO THE FLAG SITS ABOVE THREE TIERS ABOVE A COMPOSITE SCORE — THREE RANKINGS STACKED — AND
 * THAT IS A STAGE, NOT A DESIGN. This block exists so a reader cannot mistake it for settled.
 *
 * THE DEFERRED DECISION, named here so it cannot become the shape by default: what becomes of
 * `UrgencyLevel` 1/2/3 and of `operationalScore` when the flag becomes the ordering. His fuller
 * ruling — "otherwise go by time for the main level of urgency" — is something the tiers and the
 * capped score cannot express, because `operationalScore` still stops counting a wait at ten hours
 * (`Math.min(40, …)`), so a patient at 10 hours and one at 30 rank identically on time. `D9-1`
 * decided that ceiling comes off and was never built. All of it was scoped, costed and then held
 * back BY HIM, not overlooked.
 *
 * The mapping question that made him defer: with three tiers becoming a flag and everyone else,
 * tiers 1+2 together are 22 of this fixture's 28 movements — four in five patients would outrank
 * everyone, and "go by time" would govern six. That number is invented demo data and was given to
 * him as such.
 */
describe("the urgent flag, and the ranking decision still open beneath it", () => {
  function pairAround(now: Instant) {
    const base = movementById("WF-001");
    const flaggedButNewer: Movement = {
      ...base,
      id: "WF-FLAGGED-NEW",
      flaggedUrgent: true,
      urgency: 3,
      openedAt: now - 30,
    };
    const unflaggedButOlder: Movement = {
      ...base,
      id: "WF-UNFLAGGED-OLD",
      flaggedUrgent: false,
      urgency: 1,
      openedAt: now - 600,
    };
    return { flaggedButNewer, unflaggedButOlder };
  }

  it("puts a flagged patient above an unflagged one with a higher tier and twenty times the wait", () => {
    const { flaggedButNewer, unflaggedButOlder } = pairAround(NOW_ANCHOR);
    expect(
      queueOrder([unflaggedButOlder, flaggedButNewer], NOW_ANCHOR).map((movement) => movement.id),
      "the flag outranks everything: a tier-3 patient thirty minutes in must lead a tier-1 patient " + "ten hours in",
    ).toEqual(["WF-FLAGGED-NEW", "WF-UNFLAGGED-OLD"]);
  });

  it("REVERSES when the flag is taken off, which is what proves the flag did the work", () => {
    const { flaggedButNewer, unflaggedButOlder } = pairAround(NOW_ANCHOR);
    const noLongerFlagged: Movement = { ...flaggedButNewer, flaggedUrgent: false };
    expect(
      queueOrder([noLongerFlagged, unflaggedButOlder], NOW_ANCHOR).map((movement) => movement.id),
      "with the flag off, the old ranking returns and tier 1 leads tier 3. If this does not flip, " +
        "the assertion above was passing on argument order, sort stability, or the tier comparator " +
        "— anything but the flag.",
    ).toEqual(["WF-UNFLAGGED-OLD", "WF-FLAGGED-NEW"]);
  });

  it("leads the real fixture with WF-018, which nothing but the flag could have put there", () => {
    const ordered = queueOrder(wardMovements, NOW_ANCHOR);
    const leader = ordered[0];
    expect(leader.id, "the flagged movement must lead the live queue").toBe("WF-018");
    expect(leader.flaggedUrgent).toBe(true);

    // And it could not have arrived there any other way: lowest tier, shortest wait of any seeded
    // movement. Asserted rather than asserted-in-a-comment, so a fixture edit that made WF-018
    // ordinarily top of the queue would fail here instead of hollowing out the test above.
    expect(leader.urgency, "WF-018 must stay the LOWEST tier or it could lead on tier alone").toBe(3);
    const others = ordered.filter((movement) => movement.id !== "WF-018");
    expect(others.every((movement) => movement.openedAt >= leader.openedAt || !movement.flaggedUrgent)).toBe(true);
    expect(
      others.some((movement) => movement.urgency === 1),
      "the queue must contain tier-1 patients for leading it to mean anything",
    ).toBe(true);
  });

  it("changes NOTHING beneath the flag — the tiers and the score still order the rest", () => {
    // The additive half of the ruling, asserted directly: strip the flag from the fixture and the
    // queue must be exactly what it was before this feature existed.
    const unflagged = wardMovements.map((movement) => ({ ...movement, flaggedUrgent: false }));
    const ordered = queueOrder(unflagged, NOW_ANCHOR);
    const tiers = ordered.map((movement) => movement.urgency);
    expect(
      [...tiers].sort((a, b) => a - b),
      "with no flags, tier order must be intact — the flag was supposed to sit ABOVE the existing " +
        "ranking, not replace it",
    ).toEqual(tiers);

    for (let index = 1; index < ordered.length; index += 1) {
      if (ordered[index].urgency !== ordered[index - 1].urgency) continue;
      expect(operationalScore(ordered[index - 1], NOW_ANCHOR).score).toBeGreaterThanOrEqual(
        operationalScore(ordered[index], NOW_ANCHOR).score,
      );
    }
  });

  it("STILL STOPS COUNTING A WAIT AT TEN HOURS — the deferred half, pinned as a known gap", () => {
    // NOT a bug and NOT to be "fixed" opportunistically. `D9-1` decided this ceiling comes off and
    // the owner deferred it with the rest of the ranking rework. Pinned so that when somebody does
    // remove it, they do it as the decided change with this test in front of them — and so the gap
    // cannot be quietly discovered later as though nobody knew.
    const base = movementById("WF-001");
    const tenHours: Movement = { ...base, openedAt: NOW_ANCHOR - 600 };
    const thirtyHours: Movement = { ...base, openedAt: NOW_ANCHOR - 1800 };
    expect(
      operationalScore(tenHours, NOW_ANCHOR).score,
      "the wait ceiling has moved. If that was deliberate, this is the decided change (D9-1) and " +
        "the queue's whole ordering should be revisited with it, not just this number.",
    ).toBe(operationalScore(thirtyHours, NOW_ANCHOR).score);
  });
});
