import { describe, expect, it } from "vitest";

import { capacityBreakdown } from "../src/components/ward-management/ward-bed-availability";
import { BED_RELEASE_BLOCKERS } from "../src/components/ward-management/ward-change-reasons";
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
  it("1. a ward confirms a predicted release", () => {
    const state = seeded();
    // WR-002 (scgh-adult-open) is seeded predicted.
    expect(release(state, "WR-002").state).toBe("predicted");
    const next = wardFlowReducer(state, {
      type: "CONFIRM_BED_RELEASE",
      role: "ward",
      now: NOW,
      releaseId: "WR-002",
      actingUnitId: "scgh-adult-open",
    });
    expect(next.rejections).toHaveLength(0);
    expect(release(next, "WR-002").state).toBe("confirmed");
    expect(release(next, "WR-002").confidence).toBeNull();
  });

  it("2. a ward blocks a release with a blocker from the list", () => {
    const state = seeded();
    const [blocker] = BED_RELEASE_BLOCKERS;
    const next = wardFlowReducer(state, {
      type: "BLOCK_BED_RELEASE",
      role: "ward",
      now: NOW,
      releaseId: "WR-002",
      actingUnitId: "scgh-adult-open",
      blocker,
    });
    expect(next.rejections).toHaveLength(0);
    expect(release(next, "WR-002").state).toBe("blocked");
    expect(release(next, "WR-002").blocker).toBe(blocker);
    expect(release(next, "WR-002").confidence).toBeNull();
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
    expect(release(next, "WR-001").state).toBe("released");
    expect(release(next, "WR-001").confidence).toBeNull();
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
    expect(release(next, "WR-001").state).toBe("released");
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

  it("5. a coordinator may not confirm, block or release a bed — three rejections, no state change (spec D2)", () => {
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
    const afterRelease = wardFlowReducer(afterBlock, {
      type: "RELEASE_BED",
      role: "coordinator",
      now: NOW,
      releaseId: "WR-001",
      actingUnitId: "rph-adult-secure",
    });

    expect(afterRelease.rejections).toHaveLength(3);
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
