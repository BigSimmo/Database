import { describe, expect, it } from "vitest";

import { capacityBreakdown } from "../src/components/ward-management/ward-bed-availability";
import { BED_PREPARATION_NOTES, BED_RELEASE_BLOCKERS } from "../src/components/ward-management/ward-change-reasons";
import { unitCapacity } from "../src/components/ward-management/ward-derivations";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

function seeded() {
  return seedWardFlowState();
}

function release(state: ReturnType<typeof seeded>, id: string) {
  const found = state.bedReleases.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing bed release ${id}`);
  return found;
}

function unit(state: ReturnType<typeof seeded>, id: string) {
  const found = state.units.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing unit ${id}`);
  return found;
}

describe("ward bed release lifecycle", () => {
  it("1. a ward confirms a expected release", () => {
    const state = seeded();
    // WR-002 (scgh-adult-open) is seeded expected.
    expect(release(state, "WR-002").state).toBe("expected");
    const next = wardFlowReducer(state, {
      type: "CONFIRM_BED_RELEASE",
      role: "ward",
      now: NOW,
      releaseId: "WR-002",
      actingUnitId: "scgh-adult-open",
    });
    expect(next.rejections).toHaveLength(0);
    expect(release(next, "WR-002").state).toBe("confirmed");
    expect(release(next, "WR-002").waitingOn).toBeNull();
  });

  it("fix round 2 (Finding 3, P2, spec D7): confirming at a later instant moves confirmedAt to that instant, not the original flag time", () => {
    // WR-002 is seeded expected with `confirmedAt: NOW_ANCHOR - 25` — before the fix, every
    // accepted transition spread `...release`, keeping that ORIGINAL confirmedAt forever, so
    // `WardFreshness` on this row would report when the release was first flagged rather than
    // when its current state (confirmed) was actually last reported.
    const state = seeded();
    const originalConfirmedAt = release(state, "WR-002").confirmedAt;
    const laterInstant = NOW + 45;
    expect(laterInstant).not.toBe(originalConfirmedAt);

    const next = wardFlowReducer(state, {
      type: "CONFIRM_BED_RELEASE",
      role: "ward",
      now: laterInstant,
      releaseId: "WR-002",
      actingUnitId: "scgh-adult-open",
    });

    expect(next.rejections).toHaveLength(0);
    expect(release(next, "WR-002").confirmedAt).toBe(laterInstant);
    expect(release(next, "WR-002").confirmedAt).not.toBe(originalConfirmedAt);
  });

  /**
   * Bed-model rework (2026-08-28). This used to assert `state === "blocked"` and a null
   * waiting-on value — the fourth state swallowing the row's stage. Blocking is now a FLAG: the
   * stage is untouched, so a expected release stays expected and keeps the value it was flagged
   * with, and the role that recorded the block is stored beside the reason.
   */
  it("2. a ward blocks a release with a blocker from the list — the flag goes on, the stage does not move", () => {
    const state = seeded();
    const [blocker] = BED_RELEASE_BLOCKERS;
    const before = release(state, "WR-002");
    expect(before.state).toBe("expected");
    const next = wardFlowReducer(state, {
      type: "BLOCK_BED_RELEASE",
      role: "ward",
      now: NOW,
      releaseId: "WR-002",
      actingUnitId: "scgh-adult-open",
      blocker,
    });
    expect(next.rejections).toHaveLength(0);
    expect(release(next, "WR-002").state).toBe("expected");
    expect(release(next, "WR-002").blocker).toBe(blocker);
    expect(release(next, "WR-002").blockedBy).toBe("NUM SCGH Adult Open");
    expect(release(next, "WR-002").waitingOn).toBe(before.waitingOn);
  });

  /**
   * THE case the whole rework exists for, proved end to end through the reducer rather than only
   * against `capacityBreakdown`'s arithmetic. A ward confirms a discharge, then reports it stuck.
   * Under the four-stage model the second event moved the release into `"blocked"`, which
   * `capacityBreakdown` counted in neither `confirmedToday` nor `expectedToday` — so the ward's
   * confirmed count fell by one at the exact moment it got stuck, with nothing saying why.
   */
  it("2b. blocking a CONFIRMED release leaves it confirmed, still counted as confirmed, and reported as blocked", () => {
    const state = seeded();
    // WR-001 (rph-adult-secure) is seeded confirmed.
    expect(release(state, "WR-001").state).toBe("confirmed");
    const before = capacityBreakdown(unit(state, "rph-adult-secure"), state.bedReleases, state.leaveBeds, NOW);

    const next = wardFlowReducer(state, {
      type: "BLOCK_BED_RELEASE",
      role: "ward",
      now: NOW,
      releaseId: "WR-001",
      actingUnitId: "rph-adult-secure",
      blocker: BED_RELEASE_BLOCKERS[0],
    });
    expect(next.rejections).toHaveLength(0);
    expect(release(next, "WR-001").state).toBe("confirmed");

    const after = capacityBreakdown(unit(next, "rph-adult-secure"), next.bedReleases, next.leaveBeds, NOW);
    expect(before.confirmedToday).toBeGreaterThan(0);
    expect(after.confirmedToday).toBe(before.confirmedToday);
    expect(after.blockedToday).toBe(before.blockedToday + 1);
  });

  /** The flag comes off without touching the stage either — the mirror of 2b. */
  it("2c. clearing the block leaves the stage alone and drops the blocked count", () => {
    const state = seeded();
    const blocked = wardFlowReducer(state, {
      type: "BLOCK_BED_RELEASE",
      role: "ward",
      now: NOW,
      releaseId: "WR-001",
      actingUnitId: "rph-adult-secure",
      blocker: BED_RELEASE_BLOCKERS[0],
    });
    const cleared = wardFlowReducer(blocked, {
      type: "CLEAR_BED_RELEASE_BLOCK",
      role: "ward",
      now: NOW,
      releaseId: "WR-001",
      actingUnitId: "rph-adult-secure",
    });
    expect(cleared.rejections).toHaveLength(0);
    expect(release(cleared, "WR-001").state).toBe("confirmed");
    expect(release(cleared, "WR-001").blocker).toBeNull();
    expect(release(cleared, "WR-001").blockedBy).toBeNull();
    expect(
      capacityBreakdown(unit(cleared, "rph-adult-secure"), cleared.bedReleases, cleared.leaveBeds, NOW).blockedToday,
    ).toBe(0);
  });

  /**
   * The reversal the four-stage model forbade. Forbidding it never stopped a ward reversing a
   * decision — it only stopped the ward recording it, which is worse. The blocked flag survives,
   * because reversing the discharge decision does not unstick the bed.
   */
  it("2d. a ward reverts a confirmed release back to expected, keeping any block", () => {
    const state = seeded();
    // WR-007 is seeded confirmed AND blocked — the blocked-but-confirmed shape.
    expect(release(state, "WR-007").state).toBe("confirmed");
    expect(release(state, "WR-007").blocker).not.toBeNull();

    const next = wardFlowReducer(state, {
      type: "REVERT_BED_RELEASE",
      role: "ward",
      now: NOW,
      releaseId: "WR-007",
      actingUnitId: "fsh-adult-secure",
      waitingOn: "Nothing outstanding",
    });
    expect(next.rejections).toHaveLength(0);
    expect(release(next, "WR-007").state).toBe("expected");
    expect(release(next, "WR-007").waitingOn).toBe("Nothing outstanding");
    expect(release(next, "WR-007").blocker).toBe(release(state, "WR-007").blocker);
  });

  it("2e. a ward may not revert a release that is not confirmed — rejected, release unchanged", () => {
    const state = seeded();
    const before = release(state, "WR-002");
    expect(before.state).toBe("expected");
    const next = wardFlowReducer(state, {
      type: "REVERT_BED_RELEASE",
      role: "ward",
      now: NOW,
      releaseId: "WR-002",
      actingUnitId: "scgh-adult-open",
      waitingOn: "Awaiting ward round",
    });
    expect(next.rejections).toHaveLength(1);
    expect(release(next, "WR-002")).toEqual(before);
  });

  /**
   * Q4 (2026-08-28): the preparation indication is INFORMATIONAL and gates nothing. Proved
   * against the unit's own bed figures, which is where a gating implementation would have to
   * write — `capacityBreakdown`'s `availableNow` reads those and never a release.
   */
  it("2f. marking a released bed as being made ready changes no bed figure at all", () => {
    const state = seeded();
    // WR-008 (arm-adult-open) is the seeded released bed, and the fixture already marks it as
    // being made ready. The flag is cleared FIRST so `before` and `after` genuinely differ in the
    // one field under test — comparing "preparing" against "preparing" would subtract the same
    // bed from both sides of a gating implementation and pass while proving nothing.
    expect(release(state, "WR-008").state).toBe("discharged");
    expect(release(state, "WR-008").preparing).toBe(true);

    const cleared = wardFlowReducer(state, {
      type: "SET_BED_PREPARATION",
      role: "ward",
      now: NOW,
      releaseId: "WR-008",
      actingUnitId: "arm-adult-open",
      preparing: false,
    });
    expect(release(cleared, "WR-008").preparing).toBe(false);
    const before = capacityBreakdown(unit(cleared, "arm-adult-open"), cleared.bedReleases, cleared.leaveBeds, NOW);

    const next = wardFlowReducer(cleared, {
      type: "SET_BED_PREPARATION",
      role: "ward",
      now: NOW,
      releaseId: "WR-008",
      actingUnitId: "arm-adult-open",
      preparing: true,
      // List 3 (2026-08-28): a REAL note, where this line previously asserted `null` because
      // `BED_PREPARATION_NOTES` was empty and no caller could supply one. The assertion is
      // strengthened rather than dropped — the note now has to round-trip AND still change no
      // figure, which is the case the old version could not express at all.
      note: "Being cleaned",
    });
    expect(next.rejections).toHaveLength(0);
    expect(release(next, "WR-008").preparing).toBe(true);
    expect(release(next, "WR-008").preparationNote).toBe("Being cleaned");

    const after = capacityBreakdown(unit(next, "arm-adult-open"), next.bedReleases, next.leaveBeds, NOW);
    expect(after).toEqual(before);
    // Non-vacuity: this unit really does have a bed to withhold, so a gating implementation had
    // somewhere to go wrong.
    expect(after.availableNow).toBeGreaterThan(0);
  });

  /**
   * List 3 (2026-08-28), the two halves the reducer has always claimed and could never be shown:
   * a note outside `BED_PREPARATION_NOTES` is REFUSED, and clearing `preparing` clears the note
   * with it. Neither was testable while the array was empty — every note was refused, so a guard
   * that refused everything and a guard that checked membership were indistinguishable.
   */
  it("2h. refuses a preparation note outside BED_PREPARATION_NOTES, and clearing the flag clears the note", () => {
    const state = seeded();
    const refused = wardFlowReducer(state, {
      type: "SET_BED_PREPARATION",
      role: "ward",
      now: NOW,
      releaseId: "WR-008",
      actingUnitId: "arm-adult-open",
      preparing: true,
      // Deliberately plausible-looking and deliberately NOT on the owner's list. A truthiness
      // check would accept it; only real membership refuses it.
      note: "Awaiting a deep clean" as unknown as (typeof BED_PREPARATION_NOTES)[number],
    });
    expect(refused.rejections).toHaveLength(1);
    expect(refused.rejections[0]?.reason).toContain("BED_PREPARATION_NOTES");
    expect(release(refused, "WR-008").preparationNote).toBe(release(state, "WR-008").preparationNote);

    const noted = wardFlowReducer(state, {
      type: "SET_BED_PREPARATION",
      role: "ward",
      now: NOW,
      releaseId: "WR-008",
      actingUnitId: "arm-adult-open",
      preparing: true,
      note: "Awaiting maintenance or repair",
    });
    expect(release(noted, "WR-008").preparationNote).toBe("Awaiting maintenance or repair");

    const cleared = wardFlowReducer(noted, {
      type: "SET_BED_PREPARATION",
      role: "ward",
      now: NOW,
      releaseId: "WR-008",
      actingUnitId: "arm-adult-open",
      preparing: false,
    });
    // "not being made ready, waiting on a clean" is a contradiction, so the note goes with it.
    expect(release(cleared, "WR-008").preparing).toBe(false);
    expect(release(cleared, "WR-008").preparationNote).toBeNull();
  });

  /**
   * Confirming a stuck prediction must KEEP the flag. This is the counting defect approached from
   * the other end: if confirmation quietly cleared the block, the system would assert the bed was
   * unstuck because somebody decided the discharge, and "how many confirmed discharges are stuck"
   * — the question the four-stage model structurally could not answer — would read zero forever.
   */
  it("2g. confirming a blocked prediction keeps the flag, and the bed counts as confirmed AND blocked", () => {
    const state = seeded();
    const blocked = wardFlowReducer(state, {
      type: "BLOCK_BED_RELEASE",
      role: "ward",
      now: NOW,
      releaseId: "WR-002",
      actingUnitId: "scgh-adult-open",
      blocker: BED_RELEASE_BLOCKERS[0],
    });
    const confirmed = wardFlowReducer(blocked, {
      type: "CONFIRM_BED_RELEASE",
      role: "ward",
      now: NOW,
      releaseId: "WR-002",
      actingUnitId: "scgh-adult-open",
    });

    expect(confirmed.rejections).toHaveLength(0);
    expect(release(confirmed, "WR-002").state).toBe("confirmed");
    expect(release(confirmed, "WR-002").blocker).toBe(BED_RELEASE_BLOCKERS[0]);
    expect(release(confirmed, "WR-002").blockedBy).toBe("NUM SCGH Adult Open");

    const after = capacityBreakdown(
      unit(confirmed, "scgh-adult-open"),
      confirmed.bedReleases,
      confirmed.leaveBeds,
      NOW,
    );
    expect(after.confirmedToday).toBe(1);
    expect(after.blockedToday).toBe(1);
  });

  it("3. a ward blocks with no blocker — rejected, release unchanged", () => {
    const state = seeded();
    const before = release(state, "WR-002");
    // A typed caller cannot omit `blocker` — BLOCK_BED_RELEASE requires it. The invalid event is
    // constructed only for this runtime-refusal test, never by widening the event type itself.
    const invalidEvent = {
      type: "BLOCK_BED_RELEASE",
      role: "ward",
      now: NOW,
      releaseId: "WR-002",
      actingUnitId: "scgh-adult-open",
      blocker: "",
    } as unknown as WardFlowEvent;
    const next = wardFlowReducer(state, invalidEvent);
    expect(next.rejections).toHaveLength(1);
    expect(release(next, "WR-002")).toEqual(before);
  });

  it("3b. a ward blocks with a blocker outside BED_RELEASE_BLOCKERS — rejected, release unchanged (review Finding 1)", () => {
    // Review Finding 1: the reducer's own guard was `if (!event.blocker)`, a truthiness test —
    // it refuses only a missing or empty value, so any other non-empty string reached this far
    // and was stored verbatim. This is the case truthiness alone cannot catch: a non-empty,
    // non-member string. A typed caller cannot construct this event with such a value — the
    // invalid event is constructed only for this runtime-refusal test, never by widening the
    // event type itself, mirroring test 3 above.
    const state = seeded();
    const before = release(state, "WR-002");
    const invalidEvent = {
      type: "BLOCK_BED_RELEASE",
      role: "ward",
      now: NOW,
      releaseId: "WR-002",
      actingUnitId: "scgh-adult-open",
      blocker: "Awaiting a family decision",
    } as unknown as WardFlowEvent;
    const next = wardFlowReducer(state, invalidEvent);
    expect(next.rejections).toHaveLength(1);
    expect(release(next, "WR-002")).toEqual(before);
  });

  it("4. a ward releases a confirmed release — availableNow rises by one", () => {
    const state = seeded();
    // WR-001 (rph-adult-secure) is seeded confirmed.
    expect(release(state, "WR-001").state).toBe("confirmed");
    const before = capacityBreakdown(unit(state, "rph-adult-secure"), state.bedReleases, state.leaveBeds, NOW);
    const next = wardFlowReducer(state, {
      type: "RELEASE_BED",
      role: "ward",
      now: NOW,
      releaseId: "WR-001",
      actingUnitId: "rph-adult-secure",
    });
    expect(next.rejections).toHaveLength(0);
    expect(release(next, "WR-001").state).toBe("discharged");
    expect(release(next, "WR-001").waitingOn).toBeNull();
    expect(release(next, "WR-001").blocker).toBeNull();
    const after = capacityBreakdown(unit(next, "rph-adult-secure"), next.bedReleases, next.leaveBeds, NOW);
    expect(after.availableNow).toBe(before.availableNow + 1);
  });

  it("fix round 1 (Critical): releasing a bed at full vacancy still reconciles to unit.beds", () => {
    // rph-adult-secure is seeded with beds:20, empty:2, allocatable:1 — nowhere near the
    // ceiling. Force it to full physical vacancy (every bed already empty and allocatable) so
    // that RELEASE_BED's own +1 writes are the ones that would walk `empty.value` past
    // `unit.beds` if the reducer's clamp were ever removed — the exact worked failure from the
    // review: beds=5, empty.value=5, allocatable.value=5 -> a bare +1 gives empty.value=6,
    // allocatable.value=6, and `unitCapacity` then reports available=6, held=0, blocked=0,
    // occupied=0 against a 5-bed unit.
    const state = seeded();
    const targetUnit = unit(state, "rph-adult-secure");
    const fullyVacant = {
      ...state,
      units: state.units.map((candidate) =>
        candidate.id === targetUnit.id
          ? {
              ...candidate,
              empty: { ...candidate.empty, value: candidate.beds },
              allocatable: { ...candidate.allocatable, value: candidate.beds },
            }
          : candidate,
      ),
    };
    // WR-001 belongs to rph-adult-secure and is seeded confirmed — a legal RELEASE_BED target.
    expect(release(fullyVacant, "WR-001").state).toBe("confirmed");

    const next = wardFlowReducer(fullyVacant, {
      type: "RELEASE_BED",
      role: "ward",
      now: NOW,
      releaseId: "WR-001",
      actingUnitId: "rph-adult-secure",
    });

    expect(next.rejections).toHaveLength(0);
    expect(release(next, "WR-001").state).toBe("discharged");
    const afterUnit = unit(next, "rph-adult-secure");
    // The reconciliation identity ruling 3 requires (see tests/ward-capacity-reconciliation.test.ts):
    // the four bed-state figures must sum to exactly the unit's own bed count, whatever the
    // unit's numbers were coming in.
    const capacity = unitCapacity(afterUnit, next.bedReleases);
    expect(capacity.available + capacity.held + capacity.blocked + capacity.occupied).toBe(afterUnit.beds);
    // And neither field was allowed to walk past the physical ceiling that produced the failure.
    expect(afterUnit.empty.value).toBeLessThanOrEqual(afterUnit.beds);
    expect(afterUnit.allocatable.value).toBeLessThanOrEqual(afterUnit.beds);
  });

  /** Spec D2, extended by the 2026-08-28 rework to the three events it added: only the ward moves
   *  a bed between stages, flags it stuck or unstuck, or says it is being made ready. */
  it("5. a coordinator may not confirm, revert, block, unblock, prepare or release a bed — six rejections, no state change (spec D2)", () => {
    const state = seeded();
    const beforeConfirmTarget = release(state, "WR-002");
    const beforeReleaseTarget = release(state, "WR-001");

    const afterConfirm = wardFlowReducer(state, {
      type: "CONFIRM_BED_RELEASE",
      role: "coordinator",
      now: NOW,
      releaseId: "WR-002",
      actingUnitId: "scgh-adult-open",
    });
    const afterBlock = wardFlowReducer(afterConfirm, {
      type: "BLOCK_BED_RELEASE",
      role: "coordinator",
      now: NOW,
      releaseId: "WR-002",
      actingUnitId: "scgh-adult-open",
      blocker: BED_RELEASE_BLOCKERS[0],
    });
    const afterRevert = wardFlowReducer(afterBlock, {
      type: "REVERT_BED_RELEASE",
      role: "coordinator",
      now: NOW,
      releaseId: "WR-001",
      actingUnitId: "rph-adult-secure",
      waitingOn: "Awaiting ward round",
    });
    const afterUnblock = wardFlowReducer(afterRevert, {
      type: "CLEAR_BED_RELEASE_BLOCK",
      role: "coordinator",
      now: NOW,
      releaseId: "WR-002",
      actingUnitId: "scgh-adult-open",
    });
    const afterPrepare = wardFlowReducer(afterUnblock, {
      type: "SET_BED_PREPARATION",
      role: "coordinator",
      now: NOW,
      releaseId: "WR-001",
      actingUnitId: "rph-adult-secure",
      preparing: true,
    });
    const afterRelease = wardFlowReducer(afterPrepare, {
      type: "RELEASE_BED",
      role: "coordinator",
      now: NOW,
      releaseId: "WR-001",
      actingUnitId: "rph-adult-secure",
    });

    expect(afterRelease.rejections).toHaveLength(6);
    expect(release(afterRelease, "WR-002")).toEqual(beforeConfirmTarget);
    expect(release(afterRelease, "WR-001")).toEqual(beforeReleaseTarget);
  });

  it("6. a ward whose actingUnitId does not match the release's unitId is rejected", () => {
    const state = seeded();
    const before = release(state, "WR-002");
    const next = wardFlowReducer(state, {
      type: "CONFIRM_BED_RELEASE",
      role: "ward",
      now: NOW,
      releaseId: "WR-002",
      // WR-002 belongs to scgh-adult-open, not rph-adult-secure.
      actingUnitId: "rph-adult-secure",
    });
    expect(next.rejections).toHaveLength(1);
    expect(release(next, "WR-002")).toEqual(before);
  });

  it("7. RECORD_LEAVE_BED adds a leave bed; END_LEAVE_BED removes it", () => {
    const state = seeded();
    const startCount = state.leaveBeds.length;
    const afterRecord = wardFlowReducer(state, {
      type: "RECORD_LEAVE_BED",
      role: "ward",
      now: NOW,
      unitId: "fsh-older-adult",
      actingUnitId: "fsh-older-adult",
      usable: true,
      expectedReturn: NOW + 200,
    });
    expect(afterRecord.rejections).toHaveLength(0);
    expect(afterRecord.leaveBeds).toHaveLength(startCount + 1);
    const created = afterRecord.leaveBeds.find((bed) => !state.leaveBeds.some((seed) => seed.id === bed.id));
    if (!created) throw new Error("no new leave bed was created");
    expect(created.unitId).toBe("fsh-older-adult");
    expect(created.usable).toBe(true);

    const afterEnd = wardFlowReducer(afterRecord, {
      type: "END_LEAVE_BED",
      role: "ward",
      now: NOW,
      leaveBedId: created.id,
      actingUnitId: "fsh-older-adult",
    });
    expect(afterEnd.rejections).toHaveLength(0);
    expect(afterEnd.leaveBeds).toHaveLength(startCount);
    expect(afterEnd.leaveBeds.some((bed) => bed.id === created.id)).toBe(false);
  });

  it("fix round 2 (Finding 2, P2): leave-bed ids never collide after one is ended — record, record, end the first, record", () => {
    // Reviewer's exact repro: before the fix, `RECORD_LEAVE_BED` derived its id from
    // `state.leaveBeds.length`. `END_LEAVE_BED` REMOVES entries, so the length falls back down
    // and a later record can be assigned an id already in use by an earlier, still-live record.
    // React then sees duplicate `key`s, and `END_LEAVE_BED`'s own id-filter removes EVERY leave
    // bed sharing that id — ending one silently deletes two.
    const state = seeded();
    const unitId = "fsh-older-adult";

    const afterFirst = wardFlowReducer(state, {
      type: "RECORD_LEAVE_BED",
      role: "ward",
      now: NOW,
      unitId,
      actingUnitId: unitId,
      usable: true,
      expectedReturn: NOW + 100,
    });
    const first = afterFirst.leaveBeds.find((bed) => !state.leaveBeds.some((seed) => seed.id === bed.id));
    if (!first) throw new Error("no first leave bed was created");

    const afterSecond = wardFlowReducer(afterFirst, {
      type: "RECORD_LEAVE_BED",
      role: "ward",
      now: NOW,
      unitId,
      actingUnitId: unitId,
      usable: true,
      expectedReturn: NOW + 200,
    });
    const second = afterSecond.leaveBeds.find(
      (bed) => bed.id !== first.id && !state.leaveBeds.some((seed) => seed.id === bed.id),
    );
    if (!second) throw new Error("no second leave bed was created");
    expect(second.id).not.toBe(first.id);

    const afterEndFirst = wardFlowReducer(afterSecond, {
      type: "END_LEAVE_BED",
      role: "ward",
      now: NOW,
      leaveBedId: first.id,
      actingUnitId: unitId,
    });
    // Ending the first removes EXACTLY that one record — the second, still-live record survives.
    expect(afterEndFirst.leaveBeds.some((bed) => bed.id === first.id)).toBe(false);
    expect(afterEndFirst.leaveBeds.some((bed) => bed.id === second.id)).toBe(true);

    const afterThird = wardFlowReducer(afterEndFirst, {
      type: "RECORD_LEAVE_BED",
      role: "ward",
      now: NOW,
      unitId,
      actingUnitId: unitId,
      usable: false,
      expectedReturn: NOW + 300,
    });
    const third = afterThird.leaveBeds.find(
      (bed) => bed.id !== second.id && !state.leaveBeds.some((seed) => seed.id === bed.id) && bed.id !== first.id,
    );
    if (!third) throw new Error("no third leave bed was created");

    // Three distinct ids across the whole sequence — the third must never reuse the first's id,
    // which is exactly what a length-based id (2 live records -> length 2 -> same id as a record
    // ended earlier) would do.
    expect(new Set([first.id, second.id, third.id]).size).toBe(3);

    // Ending the second now removes exactly that one record too — the third survives.
    const afterEndSecond = wardFlowReducer(afterThird, {
      type: "END_LEAVE_BED",
      role: "ward",
      now: NOW,
      leaveBedId: second.id,
      actingUnitId: unitId,
    });
    expect(afterEndSecond.leaveBeds.some((bed) => bed.id === second.id)).toBe(false);
    expect(afterEndSecond.leaveBeds.some((bed) => bed.id === third.id)).toBe(true);
  });

  it("fix round 1 (Minor coverage): RECORD_LEAVE_BED refuses an unknown unit, leaving leaveBeds unchanged", () => {
    const state = seeded();
    const next = wardFlowReducer(state, {
      type: "RECORD_LEAVE_BED",
      role: "ward",
      now: NOW,
      unitId: "not-a-real-unit",
      actingUnitId: "not-a-real-unit",
      usable: true,
      expectedReturn: NOW + 100,
    });
    expect(next.rejections).toHaveLength(1);
    expect(next.leaveBeds).toEqual(state.leaveBeds);
  });

  it("fix round 1 (Minor coverage): RECORD_LEAVE_BED refuses an actingUnitId mismatch, leaving leaveBeds unchanged", () => {
    const state = seeded();
    const next = wardFlowReducer(state, {
      type: "RECORD_LEAVE_BED",
      role: "ward",
      now: NOW,
      unitId: "fsh-older-adult",
      actingUnitId: "rph-adult-secure",
      usable: true,
      expectedReturn: NOW + 100,
    });
    expect(next.rejections).toHaveLength(1);
    expect(next.leaveBeds).toEqual(state.leaveBeds);
  });

  it("fix round 1 (Minor coverage): END_LEAVE_BED refuses an unknown leave bed, leaving leaveBeds unchanged", () => {
    const state = seeded();
    const next = wardFlowReducer(state, {
      type: "END_LEAVE_BED",
      role: "ward",
      now: NOW,
      leaveBedId: "WL-not-real",
      actingUnitId: "rph-adult-secure",
    });
    expect(next.rejections).toHaveLength(1);
    expect(next.leaveBeds).toEqual(state.leaveBeds);
  });

  it("fix round 1 (Minor coverage): END_LEAVE_BED refuses an actingUnitId mismatch, leaving the record unchanged", () => {
    const state = seeded();
    // WL-001 belongs to rph-adult-secure.
    const before = state.leaveBeds.find((bed) => bed.id === "WL-001");
    if (!before) throw new Error("fixture is missing WL-001");
    const next = wardFlowReducer(state, {
      type: "END_LEAVE_BED",
      role: "ward",
      now: NOW,
      leaveBedId: "WL-001",
      actingUnitId: "scgh-adult-open",
    });
    expect(next.rejections).toHaveLength(1);
    const after = next.leaveBeds.find((bed) => bed.id === "WL-001");
    expect(after).toEqual(before);
    expect(next.leaveBeds).toEqual(state.leaveBeds);
  });

  it("8. a coordinator's REQUEST_CAPACITY_REFRESH is accepted and changes no bed figure (spec D12)", () => {
    const state = seeded();
    const before = capacityBreakdown(unit(state, "rph-adult-secure"), state.bedReleases, state.leaveBeds, NOW);
    const next = wardFlowReducer(state, {
      type: "REQUEST_CAPACITY_REFRESH",
      role: "coordinator",
      now: NOW,
      unitId: "rph-adult-secure",
    });
    expect(next.rejections).toHaveLength(0);
    expect(next.refreshRequests).toHaveLength(1);
    expect(next.refreshRequests[0]).toEqual({ unitId: "rph-adult-secure", at: NOW, byRole: "coordinator" });
    const after = capacityBreakdown(unit(next, "rph-adult-secure"), next.bedReleases, next.leaveBeds, NOW);
    expect(after).toEqual(before);
  });
});
