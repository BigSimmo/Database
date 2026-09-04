import { describe, expect, it } from "vitest";

import { WITHDRAWAL_REASONS } from "../src/components/ward-management/ward-change-reasons";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

function seeded() {
  return seedWardFlowState();
}

function movement(state: ReturnType<typeof seeded>, id: string) {
  const found = state.movements.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing movement ${id}`);
  return found;
}

/** A movement with live referrals and no acceptance — chosen FROM state, so a seed change cannot
 *  quietly make this file test a movement that is already settled. */
function anOpenReferral(state: ReturnType<typeof seeded>) {
  const found = state.movements.find(
    (candidate) => candidate.referredUnitIds.length > 0 && !candidate.acceptedUnitId && !candidate.closure,
  );
  if (!found) throw new Error("the seed contains no movement with a live, unaccepted referral");
  return found;
}

describe("a referrer taking its referral back", () => {
  /*
   * WHY THIS EXISTS. Until `WITHDRAW_REFERRAL` the only writer of `withdrawnReferrals` was
   * `ACCEPT_IN_PRINCIPLE`, so the ONLY way a referral ever ended was another unit winning it. A
   * patient who improved, went home or went somewhere else left the request sitting live in every
   * receiving ward's list, and nobody in the model could say it was over. That is a flow gap
   * rather than a missing screen: the state had no way to exist.
   */

  it("withdraws every live referral at once, because that is what the referrer is saying", () => {
    const state = seeded();
    const open = anOpenReferral(state);
    const referredBefore = [...open.referredUnitIds];
    expect(referredBefore.length).toBeGreaterThan(0);

    const next = wardFlowReducer(state, {
      type: "WITHDRAW_REFERRAL",
      role: "ed",
      now: NOW,
      movementId: open.id,
    });

    expect(next.rejections).toHaveLength(0);
    const after = movement(next, open.id);
    expect(after.referredUnitIds).toHaveLength(0);
    // Every unit that held a live referral now holds a withdrawal, and nothing else was invented.
    const withdrawnUnits = after.withdrawnReferrals.slice(open.withdrawnReferrals.length).map((w) => w.unitId);
    expect(withdrawnUnits.sort()).toEqual(referredBefore.sort());
  });

  it("records the cause as the referrer's own, not as another unit accepting", () => {
    /*
     * `WITHDRAWAL_REASONS`' own comment warned that "another unit accepted" was true of every entry
     * ONLY because acceptance was the sole writer, and that a second path with a different cause
     * would make that label quietly wrong on a ward screen. This is that second path, so it carries
     * its own code rather than inheriting a false one.
     */
    const state = seeded();
    const open = anOpenReferral(state);

    const next = wardFlowReducer(state, {
      type: "WITHDRAW_REFERRAL",
      role: "community",
      now: NOW,
      movementId: open.id,
    });

    const added = movement(next, open.id).withdrawnReferrals.slice(open.withdrawnReferrals.length);
    expect(added.length).toBeGreaterThan(0);
    for (const entry of added) {
      expect(entry.reason).toBe("referrer_withdrew");
      expect(entry.at).toBe(NOW);
    }
  });

  it("closes the movement as one that did not proceed", () => {
    const state = seeded();
    const open = anOpenReferral(state);

    const next = wardFlowReducer(state, {
      type: "WITHDRAW_REFERRAL",
      role: "ward",
      now: NOW,
      movementId: open.id,
    });

    const closure = movement(next, open.id).closure;
    expect(closure?.outcome).toBe("did_not_proceed");
    expect(closure?.at).toBe(NOW);
  });

  it("names no place in anything a ward can read", () => {
    /*
     * The defect this vocabulary exists to prevent: a LOSING ward reading the WINNING ward's name
     * out of the record of its own loss. A withdrawal by the referrer has no winner at all, so
     * there is nothing to leak — asserted anyway, because the previous leak passed every shape
     * guard by carrying a forbidden VALUE in a permitted field.
     */
    const state = seeded();
    const open = anOpenReferral(state);
    const unitNames = state.units.map((unit) => unit.name);

    const next = wardFlowReducer(state, {
      type: "WITHDRAW_REFERRAL",
      role: "ed",
      now: NOW,
      movementId: open.id,
    });

    const added = movement(next, open.id).withdrawnReferrals.slice(open.withdrawnReferrals.length);
    for (const entry of added) {
      expect(WITHDRAWAL_REASONS).toContain(entry.reason);
      for (const name of unitNames) {
        expect(entry.reason).not.toContain(name);
      }
    }
  });

  describe("what it refuses", () => {
    it("refuses to undo an acceptance", () => {
      /*
       * Once a ward has accepted, this is no longer a referral anybody can take back — the ward is
       * holding a bed for this person. Undoing that is the ward's own decline, a different act with
       * a different record.
       */
      const state = seeded();
      const open = anOpenReferral(state);
      const accepted = wardFlowReducer(state, {
        type: "ACCEPT_IN_PRINCIPLE",
        role: "ward",
        now: NOW,
        movementId: open.id,
        unitId: open.referredUnitIds[0],
      });
      expect(accepted.rejections).toHaveLength(0);

      const next = wardFlowReducer(accepted, {
        type: "WITHDRAW_REFERRAL",
        role: "ed",
        now: NOW + 10,
        movementId: open.id,
      });

      expect(next.rejections).toHaveLength(1);
      expect(next.rejections[0].reason).toMatch(/already been accepted/i);
      expect(movement(next, open.id).acceptedUnitId).toBe(open.referredUnitIds[0]);
    });

    it("refuses a movement holding no live referral", () => {
      const state = seeded();
      const open = anOpenReferral(state);
      const once = wardFlowReducer(state, {
        type: "WITHDRAW_REFERRAL",
        role: "ed",
        now: NOW,
        movementId: open.id,
      });

      // A second withdrawal has nothing left to withdraw — and the movement is closed by the first,
      // so it is refused on the earlier guard rather than silently appending an empty record.
      const twice = wardFlowReducer(once, {
        type: "WITHDRAW_REFERRAL",
        role: "ed",
        now: NOW + 5,
        movementId: open.id,
      });

      expect(twice.rejections).toHaveLength(1);
      expect(movement(twice, open.id).withdrawnReferrals).toEqual(movement(once, open.id).withdrawnReferrals);
    });

    it("refuses an unknown movement", () => {
      const state = seeded();
      const next = wardFlowReducer(state, {
        type: "WITHDRAW_REFERRAL",
        role: "ed",
        now: NOW,
        movementId: "MV-NOT-A-REAL-ONE",
      });

      expect(next.rejections).toHaveLength(1);
      expect(next.rejections[0].reason).toMatch(/no movement found/i);
      expect(next.movements).toEqual(state.movements);
    });

    it("refuses a role that never refers", () => {
      /*
       * Whoever referred may un-refer, so the role list mirrors RAISE_REFERRAL's rather than
       * narrowing it. `officer` is not on it: a transport officer moves people and does not decide
       * whether a bed is still wanted.
       */
      const state = seeded();
      const open = anOpenReferral(state);
      const next = wardFlowReducer(state, {
        type: "WITHDRAW_REFERRAL",
        role: "officer",
        now: NOW,
        movementId: open.id,
      });

      expect(next.rejections).toHaveLength(1);
      expect(movement(next, open.id).referredUnitIds).toEqual(open.referredUnitIds);
    });
  });
});
