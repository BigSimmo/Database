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

import { referralForMovement } from "../src/components/ward-management/ward-derivations";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type { Movement, Referral } from "../src/components/ward-management/ward-model";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

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
    expect(movement.referralId).toBe("RF-902");
    expect(movement.referralId).not.toBe(movement.id.replace(/^WF-/, "RF-"));
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

  it("resolves to undefined for every hand-authored movement in the seed", () => {
    // The field is never backfilled onto the fixture. Its absence there is real, and this is the
    // assertion that stops a later change quietly manufacturing values for it.
    const seeded = seedWardFlowState();
    expect(seeded.movements.length).toBeGreaterThan(0);
    for (const movement of seeded.movements) {
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
