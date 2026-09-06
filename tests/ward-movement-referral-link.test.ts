// tests/ward-movement-referral-link.test.ts
//
// THE FRONT-DOOR LINK: `Movement.referralId`, its one writer (`RAISE_REFERRAL`) and its one
// reader (`referralForMovement`).
//
// ⚠️ WHY THIS FILE DISPATCHES EVENTS INSTEAD OF BUILDING OBJECTS, WHICH IS THE WHOLE POINT.
//
// `Admission.referralId` is documented as "the join back to the front door" and joins to nothing:
// every seeded value is manufactured from the admission's own id by string substitution and the
// one runtime writer honestly writes `null`. It compiles, it renders, it means nothing, and no
// typecheck and no test can see that — see `docs/ward-flow/fields-with-no-producer-2026-09-01.md`,
// where it is finding zero and the reason all 65 community team pages are empty.
//
// A test that hand-builds a `Movement` with `referralId` set and then looks it up would pass
// against exactly that defect. So every test below walks the real flow, owner ruling 8's flow:
// a community team raises a referral addressed to an emergency department, and that department
// then raises the journey. The only objects here are the ones the reducer made.
import { describe, expect, it } from "vitest";

import { movementReferralLink, referralForMovement } from "../src/components/ward-management/ward-derivations";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type { Movement, Referral } from "../src/components/ward-management/ward-model";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";
const NOW = NOW_ANCHOR;

/**
 * ⚠️ **THE EXACT SET, NOT A COUNT AND NOT "AT LEAST ONE".** Owner ruling R-2026-09-04-D's own
 * warning is that seeding a link makes today's fixture look right while hiding the general
 * problem; an assertion that "some movement links" would pass on one link and hide nineteen gaps
 * just as happily. Both the ids and their number are pinned below, so removing a link, adding a
 * third, or silently backfilling the fixture each fail by name.
 */
const SEEDED_LINKED_MOVEMENT_IDS = ["WF-002", "WF-009"];

/** The movements the fixture ASSERTS nobody referred — the clinical arm, also pinned exactly. */
const SEEDED_NONE_RAISED_MOVEMENT_IDS = ["WF-001", "WF-013", "WF-019"];

/** The department the referral is addressed to and the patient then attends. */
const ATTENDED_ED = "jhc-ed";
/** A different real department — used to prove the link cannot be claimed by the wrong one. */
const OTHER_ED = "rph-ed";

/**
 * Step one of ruling 8's flow: a community team refers somebody to an emergency department.
 *
 * Modelled on `RF-009`, the seed's ED-only referral: purpose `psychiatric_review`, because a
 * referral to an ED is a notification rather than a bed request and nobody declines it.
 */
function communityRefersToEmergencyDepartment(state: WardFlowState, edId = ATTENDED_ED): WardFlowState {
  return wardFlowReducer(state, {
    type: "RECEIVE_REFERRAL",
    role: "community",
    now: NOW,
    ageBand: "Adult",
    destinations: [{ kind: "emergency_department", edId, purpose: "psychiatric_review" }],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    source: "community",
    urgency: 2,
    originSiteCode: "SCGH",
    transportNeeded: false,
    ...FIXTURE_HISTORY,
  });
}

/**
 * Step three: the department the patient attended raises the journey. `referralId` is omitted
 * entirely when the caller passes `undefined`, which is what a walk-in looks like.
 */
function departmentRaisesJourney(
  state: WardFlowState,
  options: { edId?: string; referralId?: string } = {},
): WardFlowState {
  return wardFlowReducer(state, {
    type: "RAISE_REFERRAL",
    role: "ed",
    now: NOW,
    edId: options.edId ?? ATTENDED_ED,
    referralId: options.referralId,
    draft: {
      cohort: "Adult",
      security: "Open",
      sex: "Female",
      specialling: false,
      legalStatus: "Voluntary",
      urgency: 2,
      legalFormCode: null,
    },
  });
}

/** The movement the reducer just appended, by identity rather than by a hand-written id. */
function newestMovement(state: WardFlowState): Movement {
  const movement = state.movements.at(-1);
  if (movement === undefined) throw new Error("state holds no movements at all");
  return movement;
}

/** The referral the reducer just appended. */
function newestReferral(state: WardFlowState): Referral {
  const referral = state.referrals.at(-1);
  if (referral === undefined) throw new Error("state holds no referrals at all");
  return referral;
}

describe("a journey raised from a referral resolves back to that exact referral", () => {
  it("walks the real flow — a referral received, then the department it named raising from it", () => {
    const seeded = seedWardFlowState();

    // 1. The community team refers somebody to an emergency department. TWO referrals are
    //    received and the SECOND is the one used, and that is not padding.
    //
    // ⚠️ The two runtime id counters both start at 901: the first referral received at runtime is
    // `RF-901` and the first journey raised at runtime is `WF-901`. So with one referral in play,
    // the `Admission.referralId` defect — manufacturing the id by string substitution from the
    // owner's own id — would produce `WF-901` → `RF-901` and RESOLVE. A test built on one referral
    // therefore cannot tell a real link from that defect. Using `RF-902` against `WF-901` can.
    const first = communityRefersToEmergencyDepartment(seeded);
    const referred = communityRefersToEmergencyDepartment(first);
    expect(referred.rejections).toEqual([]);
    expect(referred.referrals).toHaveLength(seeded.referrals.length + 2);
    const referral = newestReferral(referred);

    // 2. The patient attends that department, and it raises the journey from the referral.
    const raised = departmentRaisesJourney(referred, { referralId: referral.id });
    expect(raised.rejections).toEqual([]);
    expect(raised.movements).toHaveLength(referred.movements.length + 1);
    const movement = newestMovement(raised);

    // 3. The link resolves — to the referral OBJECT in state, not merely to an equal string.
    //
    // ⚠️ The match count is asserted BEFORE the identity check. `find` returning `undefined` and
    // `find` matching one thing look identical downstream of a comparison against `undefined`,
    // which is how a mutation that breaks this can read as a pass.
    const matches = raised.referrals.filter((candidate) => candidate.id === movement.referralId);
    expect(matches).toHaveLength(1);

    const resolved = referralForMovement(movement, raised.referrals);
    expect(resolved).toBe(referral);
    expect(resolved?.id).toBe(referral.id);
    expect(movement.referralId).toBe(referral.id);

    // And the id is a REAL one, not a string manufactured from the movement's own id — the
    // `Admission.referralId` defect stated as an assertion rather than as a comment. This is the
    // assertion the second referral above exists for: `WF-901` substitutes to `RF-901`, and the
    // link points at `RF-902`.
    expect(movement.id).toBe("WF-901");
    expect(
      movement.referralId,
      "the link must be the referral's real id, never one substituted from the movement id — " +
        "WF-901 substitutes to RF-901, and this movement's referral is RF-902",
    ).toBe("RF-902");
  });

  it("keeps the two records distinct — the journey names the referral, the referral is unchanged", () => {
    const referred = communityRefersToEmergencyDepartment(seedWardFlowState());
    const referral = newestReferral(referred);
    const raised = departmentRaisesJourney(referred, { referralId: referral.id });

    // Ruling 8: two linked records, not one. Raising a journey answers nothing on the referral.
    expect(newestReferral(raised)).toEqual(referral);
    expect(raised.referrals).toHaveLength(referred.referrals.length);
  });
});

describe("a journey with no referral", () => {
  it("resolves to undefined rather than throwing or guessing", () => {
    // A person who walked into an emergency department was referred by nobody. There is a
    // referral sitting in state, addressed to this very department, and the lookup must NOT
    // reach for it: a plausible nearby answer is the failure mode, not the fallback.
    const referred = communityRefersToEmergencyDepartment(seedWardFlowState());
    const raised = departmentRaisesJourney(referred);
    expect(raised.rejections).toEqual([]);
    const movement = newestMovement(raised);

    expect(movement.referralId).toBeUndefined();
    expect(referralForMovement(movement, raised.referrals)).toBeUndefined();
    // Not an empty-state artefact: there was something it could have wrongly returned.
    expect(raised.referrals.length).toBeGreaterThan(0);
  });

  it("resolves to undefined for every seeded movement that is not one of the two authored pairs", () => {
    // ⚠️ THIS TEST USED TO ASSERT THE FIELD WAS UNSET ON EVERY SEEDED MOVEMENT, AND IT WAS RIGHT
    // UNTIL OWNER RULING R-2026-09-04-D. Two movements now carry a link; the point that survives
    // is that NOTHING ELSE quietly acquired one, which is what a backfill would look like.
    const seeded = seedWardFlowState();
    expect(seeded.movements.length).toBeGreaterThan(0);
    for (const movement of seeded.movements.filter((candidate) => !SEEDED_LINKED_MOVEMENT_IDS.includes(candidate.id))) {
      expect(movement.referralId, `${movement.id} carries a referral id nothing raised it from`).toBeUndefined();
      expect(referralForMovement(movement, seeded.referrals)).toBeUndefined();
    }
  });

  it("returns undefined, never a throw, when an id names a referral this state does not hold", () => {
    // Unreachable through the reducer — `RAISE_REFERRAL` refuses such an id — so this is about the
    // reader's own conservatism against hand-authored data. The answer is "no referral", which is
    // the conservative reading, rather than an exception at render time.
    const seeded = seedWardFlowState();
    const dangling: Movement = { ...seeded.movements[0], referralId: "RF-DOES-NOT-EXIST" };
    expect(seeded.referrals.some((candidate) => candidate.id === "RF-DOES-NOT-EXIST")).toBe(false);
    expect(() => referralForMovement(dangling, seeded.referrals)).not.toThrow();
    expect(referralForMovement(dangling, seeded.referrals)).toBeUndefined();
  });
});

describe("RAISE_REFERRAL refuses a link it cannot resolve", () => {
  it("refuses an id that names no referral, and creates no movement", () => {
    const seeded = seedWardFlowState();
    const after = departmentRaisesJourney(seeded, { referralId: "RF-QQQ" });

    // Visibly refused, not silently dropped — a stored id that joins to nothing is the whole
    // defect this guard exists to prevent, and a silently-null field looks the same as a refusal.
    expect(after.movements).toHaveLength(seeded.movements.length);
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].attempted).toBe("RAISE_REFERRAL");
    expect(after.rejections[0].reason).toContain("RF-QQQ");
  });

  it("refuses a referral addressed to a different emergency department", () => {
    // The false join that reads as a true one: a real referral id, a real department, and no
    // relationship between them. Ruling 8's flow is that the patient attends the department the
    // referral named, and that department raises the journey.
    const referred = communityRefersToEmergencyDepartment(seedWardFlowState(), OTHER_ED);
    const referral = newestReferral(referred);
    const after = departmentRaisesJourney(referred, { edId: ATTENDED_ED, referralId: referral.id });

    expect(after.movements).toHaveLength(referred.movements.length);
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].attempted).toBe("RAISE_REFERRAL");
    expect(after.rejections[0].reason).toContain(referral.id);
  });

  it("still accepts the same referral at the department it WAS addressed to", () => {
    // The control for the test above: the refusal is about the pairing, not about ED referrals
    // being unusable. Without this, a guard that refused every link would pass that test.
    const referred = communityRefersToEmergencyDepartment(seedWardFlowState(), OTHER_ED);
    const referral = newestReferral(referred);
    const after = departmentRaisesJourney(referred, { edId: OTHER_ED, referralId: referral.id });

    expect(after.rejections).toEqual([]);
    expect(after.movements).toHaveLength(referred.movements.length + 1);
    expect(referralForMovement(newestMovement(after), after.referrals)).toBe(referral);
  });
});

/**
 * OWNER RULING R-2026-09-04-D, FIRST HALF — the seeded links themselves.
 *
 * The ruling asks the fixture to show real data rather than a uniform absence. These tests are
 * about the SEED, so they read `seedWardFlowState()` rather than dispatching: a hand-authored link
 * meets no reducer, so the three conditions `RAISE_REFERRAL` enforces at runtime — the id
 * resolves, the referral was addressed to the department that raised the journey, and the referral
 * came first — have to be asserted over the fixture directly or nothing checks them at all.
 */
describe("the seeded front-door links", () => {
  it("links exactly WF-002 and WF-009, by name and by count", () => {
    const seeded = seedWardFlowState();
    const linked = seeded.movements.filter((movement) => movement.referralId !== undefined);

    // The ids, in fixture order, and then the number as its own assertion: an array comparison
    // written against a shortened expectation would still pass the first check alone.
    expect(linked.map((movement) => movement.id)).toEqual(SEEDED_LINKED_MOVEMENT_IDS);
    expect(linked).toHaveLength(2);
    // And the fixture it is two OUT OF — so "two link" is a statement about a populated fixture
    // rather than about a fixture that lost forty-eight records.
    expect(seeded.movements).toHaveLength(50);
  });

  it("gives each linked movement a referral that resolves, names its own department, and predates it", () => {
    const seeded = seedWardFlowState();
    const linked = seeded.movements.filter((movement) => movement.referralId !== undefined);
    expect(linked).toHaveLength(2);

    for (const movement of linked) {
      // 1. RESOLVES — the `Admission.referralId` defect stated as an assertion. Match count first:
      //    `find` returning undefined and `find` matching one look identical downstream.
      const matches = seeded.referrals.filter((candidate) => candidate.id === movement.referralId);
      expect(matches, `${movement.id} referral ${movement.referralId} resolves to exactly one referral`).toHaveLength(
        1,
      );
      const referral = referralForMovement(movement, seeded.referrals);
      expect(referral).toBe(matches[0]);

      // 2. ADDRESSED TO THIS DEPARTMENT — the false join that wears a real id. The same rule
      //    `RAISE_REFERRAL` refuses at runtime, applied to data no reducer ever saw.
      const addressedHere = referral!.destinations.some(
        (addressing) =>
          addressing.destination.kind === "emergency_department" && addressing.destination.edId === movement.originEdId,
      );
      expect(addressedHere, `${referral!.id} is not addressed to ${movement.originEdId}, ${movement.id} own ED`).toBe(
        true,
      );

      // 3. CAME FIRST — a journey cannot precede the referral that produced it. This is the
      //    condition no existing seeded referral could satisfy, and the reason RF-012 and RF-013
      //    were authored rather than picked.
      expect(
        referral!.raisedAt,
        `${referral!.id} was raised after ${movement.id} opened, so it cannot be what produced it`,
      ).toBeLessThan(movement.openedAt);
    }
  });

  it("is not satisfied by an id substituted from the movement own id", () => {
    // The `Admission.referralId` shape: `WF-002` substitutes to `RF-002`, a real referral in this
    // fixture, so that defect here would RESOLVE and pass every check above except this one.
    const seeded = seedWardFlowState();
    for (const movement of seeded.movements.filter((candidate) => candidate.referralId !== undefined)) {
      const substituted = movement.id.replace(/^WF-/, "RF-");
      expect(seeded.referrals.some((candidate) => candidate.id === substituted)).toBe(true);
      expect(
        movement.referralId,
        `${movement.id} link is the string substitution of its own id, not a real join`,
      ).not.toBe(substituted);
    }
  });
});

/**
 * OWNER RULING R-2026-09-04-D, SECOND HALF — the three causes, made distinguishable.
 *
 * `referralForMovement` answers `undefined` for all three. `movementReferralLink` names them:
 * `none_raised` (clinical), `not_asked` and `not_recorded` (both record-keeping).
 */
describe("movementReferralLink separates the three causes of an absent referral", () => {
  it("classifies every seeded movement into exactly the expected buckets, by name and by count", () => {
    const seeded = seedWardFlowState();
    const byKind = (kind: string) =>
      seeded.movements
        .filter((movement) => movementReferralLink(movement, seeded.referrals).kind === kind)
        .map((movement) => movement.id);

    expect(byKind("referral")).toEqual(SEEDED_LINKED_MOVEMENT_IDS);
    expect(byKind("none_raised")).toEqual(SEEDED_NONE_RAISED_MOVEMENT_IDS);
    // The record-keeping remainder: fifty movements, two linked, three asserted, forty-five with
    // nothing recorded either way.
    expect(byKind("not_recorded")).toHaveLength(45);
    // ⚠️ TWO ABSENCE CLAIMS, EACH WITH ITS POSITIVE CONTROL BELOW. Neither state is producible by
    // the seed: `not_asked` is written only by `RAISE_REFERRAL` at runtime, and `unresolved` only
    // by a hand-authored dangling id. The two tests immediately after this one produce each of
    // them, so a zero here means "the seed has none" and not "the classifier cannot return it".
    expect(byKind("not_asked")).toEqual([]);
    expect(byKind("unresolved")).toEqual([]);
    // And the buckets account for every movement — no record fell outside the classification.
    expect(byKind("referral").length + byKind("none_raised").length + byKind("not_recorded").length).toBe(
      seeded.movements.length,
    );
  });

  it("POSITIVE CONTROL: a runtime movement raised without naming a referral is not_asked, never not_recorded", () => {
    // The record-keeping cause the seed cannot hold. There is a referral in state addressed to
    // this very department and the raiser did not name it — nobody was asked, and that is what the
    // classification says. Distinguishing this from the fixture's `not_recorded` is the point:
    // both are record-keeping, but only one of them is a record somebody could have made.
    const referred = communityRefersToEmergencyDepartment(seedWardFlowState());
    const raised = departmentRaisesJourney(referred);
    expect(raised.rejections).toEqual([]);
    const movement = newestMovement(raised);

    expect(movement.referralId).toBeUndefined();
    expect(movement.referralAbsence).toEqual({ reason: "not_asked", at: NOW });
    expect(movementReferralLink(movement, raised.referrals)).toEqual({ kind: "not_asked", at: NOW });
  });

  it("POSITIVE CONTROL: a dangling id is unresolved — never quietly re-read as nobody having referred them", () => {
    // Unreachable through the reducer, reachable by hand. The dangerous reading is "no referral",
    // because that is one step from the clinical assertion; `unresolved` says the record is
    // broken, which is what it is.
    const seeded = seedWardFlowState();
    const dangling: Movement = { ...seeded.movements[0], referralId: "RF-DOES-NOT-EXIST" };
    expect(movementReferralLink(dangling, seeded.referrals)).toEqual({
      kind: "unresolved",
      referralId: "RF-DOES-NOT-EXIST",
    });
  });

  it("prefers a resolved referral over a contradicting absence record", () => {
    // The reducer refuses to create this pair (`RECORD_NO_REFERRAL` rejects a movement that names
    // a referral), so it can only be hand-authored. Reporting "nobody referred this person" beside
    // a referral that resolves is the fabrication this ruling exists to prevent.
    const seeded = seedWardFlowState();
    const linked = seeded.movements.find((movement) => movement.referralId !== undefined)!;
    const contradictory: Movement = { ...linked, referralAbsence: { reason: "none_raised", at: NOW } };
    const link = movementReferralLink(contradictory, seeded.referrals);
    expect(link.kind).toBe("referral");
    expect(link.kind === "referral" && link.referral.id).toBe(linked.referralId);
  });

  it("carries the recorded instant on the clinical arm, so a screen can say WHEN it was answered", () => {
    const seeded = seedWardFlowState();
    const asserted = seeded.movements.find((movement) => movement.id === "WF-019")!;
    expect(movementReferralLink(asserted, seeded.referrals)).toEqual({ kind: "none_raised", at: NOW_ANCHOR - 600 });
    // And every authored instant is AFTER its movement opened — an answer recorded before the
    // question existed would be incoherent, and nothing else checks these three.
    for (const id of SEEDED_NONE_RAISED_MOVEMENT_IDS) {
      const movement = seeded.movements.find((candidate) => candidate.id === id)!;
      expect(movement.referralAbsence!.at, `${id} absence was recorded before the movement opened`).toBeGreaterThan(
        movement.openedAt,
      );
    }
  });
});

/**
 * `RECORD_NO_REFERRAL` — the producer of the clinical arm. Without it `none_raised` would be a
 * field only a fixture can write, which is the `Admission.referralId` class of defect one layer up.
 */
describe("RECORD_NO_REFERRAL records that nobody referred this patient", () => {
  /** A movement raised at runtime with nobody named — `not_asked` until somebody answers. */
  function runtimeMovement(): { state: WardFlowState; movement: Movement } {
    const raised = departmentRaisesJourney(seedWardFlowState());
    return { state: raised, movement: newestMovement(raised) };
  }

  it("upgrades not_asked to the recorded answer", () => {
    const { state, movement } = runtimeMovement();
    expect(movementReferralLink(movement, state.referrals).kind).toBe("not_asked");

    const after = wardFlowReducer(state, {
      type: "RECORD_NO_REFERRAL",
      role: "ed",
      now: NOW + 10,
      movementId: movement.id,
    });
    expect(after.rejections).toEqual([]);
    const updated = after.movements.find((candidate) => candidate.id === movement.id)!;
    expect(updated.referralAbsence).toEqual({ reason: "none_raised", at: NOW + 10 });
    expect(movementReferralLink(updated, after.referrals)).toEqual({ kind: "none_raised", at: NOW + 10 });
  });

  it("refuses a movement that was raised from a referral, rather than storing the contradiction", () => {
    const referred = communityRefersToEmergencyDepartment(seedWardFlowState());
    const referral = newestReferral(referred);
    const raised = departmentRaisesJourney(referred, { referralId: referral.id });
    const movement = newestMovement(raised);

    const after = wardFlowReducer(raised, {
      type: "RECORD_NO_REFERRAL",
      role: "ed",
      now: NOW + 10,
      movementId: movement.id,
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].attempted).toBe("RECORD_NO_REFERRAL");
    expect(after.rejections[0].reason).toContain(referral.id);
    // Visibly refused AND unchanged — a rejection that still wrote the field would pass the line
    // above on its own.
    expect(after.movements.find((candidate) => candidate.id === movement.id)!.referralAbsence).toBeUndefined();
  });

  it("refuses an unknown movement id rather than defaulting to one", () => {
    const seeded = seedWardFlowState();
    const after = wardFlowReducer(seeded, {
      type: "RECORD_NO_REFERRAL",
      role: "ed",
      now: NOW,
      movementId: "WF-DOES-NOT-EXIST",
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain("WF-DOES-NOT-EXIST");
    expect(after.movements).toEqual(seeded.movements);
  });

  it("refuses a closed movement — the question is meaningless once the journey ended", () => {
    const seeded = seedWardFlowState();
    const closed = seeded.movements.find((movement) => movement.closure !== undefined)!;
    const after = wardFlowReducer(seeded, {
      type: "RECORD_NO_REFERRAL",
      role: "ed",
      now: NOW,
      movementId: closed.id,
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain("closed movement");
  });

  it("refuses a coordinator, which cannot observe the front door", () => {
    const { state, movement } = runtimeMovement();
    const after = wardFlowReducer(state, {
      type: "RECORD_NO_REFERRAL",
      role: "coordinator",
      now: NOW + 10,
      movementId: movement.id,
    });
    expect(after.rejections).toHaveLength(1);
    // Still `not_asked`: the refusal left the record alone rather than half-writing it.
    expect(after.movements.find((candidate) => candidate.id === movement.id)!.referralAbsence).toEqual({
      reason: "not_asked",
      at: NOW,
    });
  });
});
