import { describe, expect, it } from "vitest";

import { EVENT_ROLE } from "../src/components/ward-management/ward-flow-events";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { wardMovements } from "../src/components/ward-management/ward-movements";
import { isFlaggedUrgent, queueOrder } from "../src/components/ward-management/ward-priority";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

function movement(state: WardFlowState, id: string) {
  const found = state.movements.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing movement ${id}`);
  return found;
}

function anOpenUnflagged(state: WardFlowState) {
  const found = state.movements.find(
    (candidate) => !candidate.closure && candidate.stage !== "arrived" && !candidate.flaggedUrgent,
  );
  if (!found) throw new Error("the seed contains no open, unflagged movement");
  return found;
}

describe("the urgent flag — the mechanism the owner asked for and nobody could reach", () => {
  /*
   * WHY THIS FILE EXISTS. `Movement.flaggedUrgent` was added on 2026-08-30 with a ranking rule
   * above it — `queueOrder` puts it ABOVE all three urgency tiers — and a "Flagged urgent" badge on
   * the coordinator queue below it. Its only writer was the literal `false` in `RAISE_REFERRAL`,
   * and exactly one hand-authored movement carried `true`. There was no flagging event among the
   * thirty-nine: the feature was fully built and entirely unreachable.
   */

  it("the fixture carries exactly one flagged movement, which is what made this invisible", () => {
    // Non-vacuity, and the audit's own figure re-measured rather than quoted: one seeded `true` is
    // why the badge and the ordering both LOOKED alive.
    expect(wardMovements.filter((candidate) => candidate.flaggedUrgent)).toHaveLength(1);
  });

  it("flags a patient", () => {
    const state = seedWardFlowState();
    const target = anOpenUnflagged(state);

    const next = wardFlowReducer(state, {
      type: "FLAG_MOVEMENT_URGENT",
      role: "coordinator",
      now: NOW,
      movementId: target.id,
    });

    expect(next.rejections).toHaveLength(0);
    expect(movement(next, target.id).flaggedUrgent).toBe(true);
    expect(isFlaggedUrgent(movement(next, target.id))).toBe(true);
  });

  it("unflags them again, which is the half that would otherwise be a new permanent state", () => {
    const state = seedWardFlowState();
    const target = anOpenUnflagged(state);

    const flagged = wardFlowReducer(state, {
      type: "FLAG_MOVEMENT_URGENT",
      role: "coordinator",
      now: NOW,
      movementId: target.id,
    });
    const cleared = wardFlowReducer(flagged, {
      type: "CLEAR_MOVEMENT_URGENT_FLAG",
      role: "coordinator",
      now: NOW + 60,
      movementId: target.id,
    });

    expect(cleared.rejections).toHaveLength(0);
    expect(movement(cleared, target.id).flaggedUrgent).toBe(false);
  });

  it("can clear the one the SEED flagged, which nothing could touch before", () => {
    const state = seedWardFlowState();
    const seededFlag = state.movements.find((candidate) => candidate.flaggedUrgent);
    if (!seededFlag) throw new Error("the seed flags nobody urgent");

    const cleared = wardFlowReducer(state, {
      type: "CLEAR_MOVEMENT_URGENT_FLAG",
      role: "coordinator",
      now: NOW,
      movementId: seededFlag.id,
    });

    expect(cleared.rejections).toHaveLength(0);
    expect(movement(cleared, seededFlag.id).flaggedUrgent).toBe(false);
  });

  /**
   * ⚠️ THE ASSERTION THAT MAKES THE FEATURE REAL RATHER THAN MERELY STORED. The owner's words were
   * that a flag "outranks everything", so this walks the actual queue: a flagged patient in the
   * LEAST urgent tier must lead one in the most urgent tier. A test that only checked the boolean
   * would pass just as well against a flag nothing sorted on.
   */
  it("puts a flagged tier-3 patient ahead of an unflagged tier-1 patient", () => {
    const state = seedWardFlowState();
    const open = state.movements.filter((candidate) => !candidate.closure && candidate.stage !== "arrived");
    const leastUrgent = open.find((candidate) => candidate.urgency === 3 && !candidate.flaggedUrgent);
    const mostUrgent = open.find((candidate) => candidate.urgency === 1 && !candidate.flaggedUrgent);
    if (!leastUrgent || !mostUrgent) throw new Error("the seed lacks an open tier-1 and tier-3 pair");

    // Before: the tier does the ordering, and the tier-1 patient leads.
    const before = queueOrder(state.movements, NOW).map((candidate) => candidate.id);
    expect(before.indexOf(mostUrgent.id)).toBeLessThan(before.indexOf(leastUrgent.id));

    const flagged = wardFlowReducer(state, {
      type: "FLAG_MOVEMENT_URGENT",
      role: "coordinator",
      now: NOW,
      movementId: leastUrgent.id,
    });
    expect(flagged.rejections).toHaveLength(0);

    const after = queueOrder(flagged.movements, NOW).map((candidate) => candidate.id);
    expect(after.indexOf(leastUrgent.id)).toBeLessThan(after.indexOf(mostUrgent.id));

    // And it goes back when the flag is removed — the ordering is not a one-way door either.
    const cleared = wardFlowReducer(flagged, {
      type: "CLEAR_MOVEMENT_URGENT_FLAG",
      role: "coordinator",
      now: NOW + 60,
      movementId: leastUrgent.id,
    });
    const restored = queueOrder(cleared.movements, NOW).map((candidate) => candidate.id);
    expect(restored.indexOf(mostUrgent.id)).toBeLessThan(restored.indexOf(leastUrgent.id));
  });

  it("refuses a second flag, rather than reporting a no-op as success", () => {
    const state = seedWardFlowState();
    const seededFlag = state.movements.find((candidate) => candidate.flaggedUrgent);
    if (!seededFlag) throw new Error("the seed flags nobody urgent");

    const next = wardFlowReducer(state, {
      type: "FLAG_MOVEMENT_URGENT",
      role: "coordinator",
      now: NOW,
      movementId: seededFlag.id,
    });

    expect(next.rejections).toHaveLength(1);
    expect(next.rejections[0]?.reason).toContain("already flagged urgent");
  });

  it("refuses clearing a flag that is not there", () => {
    const state = seedWardFlowState();
    const target = anOpenUnflagged(state);

    const next = wardFlowReducer(state, {
      type: "CLEAR_MOVEMENT_URGENT_FLAG",
      role: "coordinator",
      now: NOW,
      movementId: target.id,
    });

    expect(next.rejections).toHaveLength(1);
    expect(next.rejections[0]?.reason).toContain("not flagged urgent");
  });

  it("refuses flagging a closed movement, which is not in the queue to be promoted within", () => {
    const state = seedWardFlowState();
    const closed = state.movements.find((candidate) => candidate.closure && !candidate.flaggedUrgent);
    if (!closed) throw new Error("the seed contains no closed unflagged movement");

    const next = wardFlowReducer(state, {
      type: "FLAG_MOVEMENT_URGENT",
      role: "coordinator",
      now: NOW,
      movementId: closed.id,
    });

    expect(next.rejections).toHaveLength(1);
    expect(movement(next, closed.id).flaggedUrgent).toBe(false);
  });

  /**
   * ⚠️ The permission is not merely "some list" — it must be the SAME list as `CHANGE_URGENCY`.
   * The flag sits above all three tiers in `queueOrder`, so a role that may flag but may not move
   * a tier could put a patient above every tier 1 while being unable to move them to tier 1. This
   * asserts the two lists against each other rather than restating one of them.
   */
  it("permits exactly the roles that may already move an urgency tier, and no more", () => {
    expect([...EVENT_ROLE.FLAG_MOVEMENT_URGENT]).toEqual([...EVENT_ROLE.CHANGE_URGENCY]);
    expect([...EVENT_ROLE.CLEAR_MOVEMENT_URGENT_FLAG]).toEqual([...EVENT_ROLE.CHANGE_URGENCY]);
    expect([...EVENT_ROLE.FLAG_MOVEMENT_URGENT]).toEqual(["coordinator", "ed"]);

    const state = seedWardFlowState();
    const target = anOpenUnflagged(state);
    for (const role of ["ward", "officer", "community", "demo"] as const) {
      const next = wardFlowReducer(state, {
        type: "FLAG_MOVEMENT_URGENT",
        role,
        now: NOW,
        movementId: target.id,
      });
      expect(next.rejections, `${role} was allowed to flag a patient urgent`).toHaveLength(1);
      expect(movement(next, target.id).flaggedUrgent).toBe(false);
    }
  });

  it("records the boolean and nothing else — no reason, no author, no instant", () => {
    const state = seedWardFlowState();
    const target = anOpenUnflagged(state);

    const byCoordinator = wardFlowReducer(state, {
      type: "FLAG_MOVEMENT_URGENT",
      role: "coordinator",
      now: NOW,
      movementId: target.id,
    });
    const byEd = wardFlowReducer(state, {
      type: "FLAG_MOVEMENT_URGENT",
      role: "ed",
      now: NOW + 500,
      movementId: target.id,
    });

    // Byte-identical whoever raised it and whenever. The owner deferred both a reason vocabulary
    // and any provenance; this asserts the deferral held rather than trusting a comment saying so.
    expect(movement(byCoordinator, target.id)).toEqual(movement(byEd, target.id));
    expect(movement(byCoordinator, target.id)).toEqual({ ...target, flaggedUrgent: true });
  });
});
