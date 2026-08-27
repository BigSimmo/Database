// tests/ward-referral-reducer.test.ts
//
// Phase 7 Task 3 (spec "The front door"): the three events that wire Task 1's `Referral` type
// into live reducer state — RECEIVE_REFERRAL (community), ACCEPT_REFERRAL and DECLINE_REFERRAL
// (both coordinator-only). Every guard named in the task brief gets its own test here, and every
// one of those tests is proven against a mutation in the accompanying report — see
// `.superpowers/sdd/2026-08-27-ward-flow-phase-7-front-door/task-3-report.md`.
import { describe, expect, it } from "vitest";

import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { REFERRAL_DECLINE_REASONS, type Referral } from "../src/components/ward-management/ward-model";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

function seeded() {
  return seedWardFlowState();
}

function referral(state: WardFlowState, id: string): Referral {
  const found = state.referrals.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing referral ${id}`);
  return found;
}

/** A referral draft matched against `scgh-adult-open` on purpose — see the reducer test below
 *  ("passes every gate") for why that unit is a reliable, deterministic match: Adult cohort,
 *  Undesignated (accepts either sex), non-forensic, allocatable 2 (so sex_mix passes regardless
 *  of occupancy), capacity confirmed 15 minutes before NOW_ANCHOR against a 60-minute staleness
 *  window. */
function receiveReferral(state: WardFlowState, now = NOW) {
  return wardFlowReducer(state, {
    type: "RECEIVE_REFERRAL",
    role: "community",
    now,
    ageBand: "Adult",
    sex: "Female",
    secureBedNeeded: false,
    source: "community",
    urgency: 2,
    originSiteCode: "SCGH",
    transportNeeded: false,
  });
}

describe("RECEIVE_REFERRAL", () => {
  it("appends a queued referral carrying exactly what was submitted", () => {
    const before = seeded();
    const after = receiveReferral(before);
    expect(after.rejections).toEqual([]);
    expect(after.referrals).toHaveLength(before.referrals.length + 1);
    const created = after.referrals.at(-1)!;
    expect(created.state).toBe("queued");
    expect(created.ageBand).toBe("Adult");
    expect(created.sex).toBe("Female");
    expect(created.secureBedNeeded).toBe(false);
    expect(created.source).toBe("community");
    expect(created.urgency).toBe(2);
    expect(created.originSiteCode).toBe("SCGH");
    expect(created.transportNeeded).toBe(false);
    expect(created.raisedAt).toBe(NOW);
    expect(created.acceptedUnitId).toBeUndefined();
    expect(created.declineReason).toBeUndefined();
    expect(created.decidedAt).toBeUndefined();
  });

  // Controller ruling P1: the id source is a monotonic counter (`frontDoorReferralSequence`),
  // never `state.referrals.length` — Phase 5 shipped exactly the length-derived bug for leave
  // beds. The seed fixture already carries 6 referrals (RF-001..RF-006), so a length-derived id
  // would mint "RF-906" for the very first runtime referral; the counter-derived id mints
  // "RF-901" instead. This test fails if a future change swaps the id source back to `.length`.
  it("mints the runtime referral id from the sequence counter, not from the fixture's array length", () => {
    const after = receiveReferral(seeded());
    const created = after.referrals.at(-1)!;
    expect(created.id).toBe("RF-901");
    expect(after.frontDoorReferralSequence).toBe(1);
  });

  it("keeps minting distinct, increasing ids across repeated intakes", () => {
    const first = receiveReferral(seeded());
    const second = receiveReferral(first);
    const third = receiveReferral(second);
    const ids = third.referrals.slice(-3).map((r) => r.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids).toEqual(["RF-901", "RF-902", "RF-903"]);
  });

  it("refuses (visibly) a role other than community, rather than silently doing nothing", () => {
    const before = seeded();
    const after = wardFlowReducer(before, {
      type: "RECEIVE_REFERRAL",
      role: "coordinator",
      now: NOW,
      ageBand: "Adult",
      sex: "Female",
      secureBedNeeded: false,
      source: "community",
      urgency: 2,
      originSiteCode: "SCGH",
      transportNeeded: false,
    });
    expect(after.referrals).toEqual(before.referrals);
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toMatch(/role/i);
    expect(after.rejections[0].attempted).toBe("RECEIVE_REFERRAL");
  });
});

describe("ACCEPT_REFERRAL", () => {
  it("passes every gate against a well-matched unit and creates NO Movement (spec D14)", () => {
    const received = receiveReferral(seeded());
    const created = received.referrals.at(-1)!;
    const before = received;
    const after = wardFlowReducer(before, {
      type: "ACCEPT_REFERRAL",
      role: "coordinator",
      now: NOW,
      referralId: created.id,
      unitId: "scgh-adult-open",
    });
    expect(after.rejections).toEqual([]);
    const decided = referral(after, created.id);
    expect(decided.state).toBe("accepted");
    expect(decided.acceptedUnitId).toBe("scgh-adult-open");
    expect(decided.decidedAt).toBe(NOW);
    expect(decided.decidedBy).toBeTruthy();
    expect(decided.declineReason).toBeUndefined();

    // Spec D14, asserted explicitly rather than left implicit: acceptance never creates a
    // Movement. Both the count AND the content are unchanged, so a future change that appends a
    // movement anywhere — not just one keyed on this referral — is caught.
    expect(after.movements).toHaveLength(before.movements.length);
    expect(after.movements).toEqual(before.movements);
  });

  it("refuses (visibly) a role other than coordinator, rather than silently doing nothing", () => {
    const received = receiveReferral(seeded());
    const created = received.referrals.at(-1)!;
    const after = wardFlowReducer(received, {
      type: "ACCEPT_REFERRAL",
      role: "community",
      now: NOW,
      referralId: created.id,
      unitId: "scgh-adult-open",
    });
    expect(referral(after, created.id).state).toBe("queued");
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toMatch(/role/i);
    expect(after.rejections[0].attempted).toBe("ACCEPT_REFERRAL");
  });

  // Uses the fixture's own RF-001: Youth + secureBedNeeded true, structurally unmatchable
  // anywhere in the network per ward-movements.ts's own comment — the network's one Youth unit
  // (bty-youth) is Open, not Secure. Both the `age` gate (targeting an Adult unit) and the
  // `security` gate are exercised, and the failing gate is named in the rejection.
  it("refuses a unit that does not accept the referral, naming the failing gate", () => {
    const before = seeded();
    const after = wardFlowReducer(before, {
      type: "ACCEPT_REFERRAL",
      role: "coordinator",
      now: NOW,
      referralId: "RF-001",
      unitId: "scgh-adult-open",
    });
    expect(referral(after, "RF-001").state).toBe("queued");
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain("age");
    // The failing gate is named by the UNIT'S NAME (matching `referralEligibility`'s own detail
    // strings), not its bare id.
    expect(after.rejections[0].reason).toContain("SCGH Adult Open");
  });

  it("refuses a decision on a referral that is not queued (already accepted)", () => {
    const before = seeded();
    // RF-002 is already accepted in the seed fixture (ward-movements.ts).
    expect(referral(before, "RF-002").state).toBe("accepted");
    const after = wardFlowReducer(before, {
      type: "ACCEPT_REFERRAL",
      role: "coordinator",
      now: NOW,
      referralId: "RF-002",
      unitId: "scgh-adult-open",
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain("already decided");
    // Untouched — a refused decision does not overwrite the earlier one.
    expect(referral(after, "RF-002")).toEqual(referral(before, "RF-002"));
  });

  it("refuses a decision on a referral that is not queued (already declined)", () => {
    const before = seeded();
    // RF-004 is already declined in the seed fixture.
    expect(referral(before, "RF-004").state).toBe("declined");
    const after = wardFlowReducer(before, {
      type: "ACCEPT_REFERRAL",
      role: "coordinator",
      now: NOW,
      referralId: "RF-004",
      unitId: "scgh-adult-open",
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain("already decided");
  });

  it("refuses an unknown referral id", () => {
    const after = wardFlowReducer(seeded(), {
      type: "ACCEPT_REFERRAL",
      role: "coordinator",
      now: NOW,
      referralId: "RF-DOES-NOT-EXIST",
      unitId: "scgh-adult-open",
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain("RF-DOES-NOT-EXIST");
  });
});

describe("DECLINE_REFERRAL", () => {
  it("records the chosen reason and decider", () => {
    const received = receiveReferral(seeded());
    const created = received.referrals.at(-1)!;
    const after = wardFlowReducer(received, {
      type: "DECLINE_REFERRAL",
      role: "coordinator",
      now: NOW,
      referralId: created.id,
      reason: "no_suitable_bed",
    });
    expect(after.rejections).toEqual([]);
    const decided = referral(after, created.id);
    expect(decided.state).toBe("declined");
    expect(decided.declineReason).toBe("no_suitable_bed");
    expect(decided.decidedAt).toBe(NOW);
    expect(decided.decidedBy).toBeTruthy();
    expect(decided.acceptedUnitId).toBeUndefined();
  });

  it("refuses (visibly) a role other than coordinator, rather than silently doing nothing", () => {
    const received = receiveReferral(seeded());
    const created = received.referrals.at(-1)!;
    const after = wardFlowReducer(received, {
      type: "DECLINE_REFERRAL",
      role: "community",
      now: NOW,
      referralId: created.id,
      reason: "no_suitable_bed",
    });
    expect(referral(after, created.id).state).toBe("queued");
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toMatch(/role/i);
    expect(after.rejections[0].attempted).toBe("DECLINE_REFERRAL");
  });

  // The discriminating case: a truthy string that is NOT a member of REFERRAL_DECLINE_REASONS.
  // A truthiness test (`!event.reason`) would accept this; only a real membership check refuses
  // it. Phase 5 shipped a truthiness test in this exact position on BLOCK_BED_RELEASE's own
  // blocker field and review caught it — this is the same shape of bug, on a different field.
  it("refuses a reason outside REFERRAL_DECLINE_REASONS, by membership rather than truthiness", () => {
    const received = receiveReferral(seeded());
    const created = received.referrals.at(-1)!;
    const after = wardFlowReducer(received, {
      type: "DECLINE_REFERRAL",
      role: "coordinator",
      now: NOW,
      // A non-empty string a truthiness test would let through.
      referralId: created.id,
      reason: "clinically_unsuitable" as unknown as (typeof REFERRAL_DECLINE_REASONS)[number],
    });
    expect(referral(after, created.id).state).toBe("queued");
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain("REFERRAL_DECLINE_REASONS");
  });

  it("refuses a decision on a referral that is not queued (already accepted)", () => {
    const before = seeded();
    expect(referral(before, "RF-003").state).toBe("accepted");
    const after = wardFlowReducer(before, {
      type: "DECLINE_REFERRAL",
      role: "coordinator",
      now: NOW,
      referralId: "RF-003",
      reason: "no_suitable_bed",
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain("already decided");
    expect(referral(after, "RF-003")).toEqual(referral(before, "RF-003"));
  });

  it("refuses a decision on a referral that is not queued (already declined)", () => {
    const before = seeded();
    expect(referral(before, "RF-004").state).toBe("declined");
    const after = wardFlowReducer(before, {
      type: "DECLINE_REFERRAL",
      role: "coordinator",
      now: NOW,
      referralId: "RF-004",
      reason: "no_suitable_bed",
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain("already decided");
  });

  it("refuses an unknown referral id", () => {
    const after = wardFlowReducer(seeded(), {
      type: "DECLINE_REFERRAL",
      role: "coordinator",
      now: NOW,
      referralId: "RF-DOES-NOT-EXIST",
      reason: "no_suitable_bed",
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain("RF-DOES-NOT-EXIST");
  });

  it("accepts every reason in REFERRAL_DECLINE_REASONS, not just the first", () => {
    let state = seeded();
    for (const reason of REFERRAL_DECLINE_REASONS) {
      state = receiveReferral(state);
      const created = state.referrals.at(-1)!;
      const before = state.rejections.length;
      state = wardFlowReducer(state, {
        type: "DECLINE_REFERRAL",
        role: "coordinator",
        now: NOW,
        referralId: created.id,
        reason,
      });
      expect(state.rejections.length, `reason ${reason} was refused`).toBe(before);
      expect(referral(state, created.id).declineReason).toBe(reason);
    }
  });
});

describe("seeding", () => {
  it("wires Task 1's Referral fixture into live state", () => {
    const state = seeded();
    expect(state.referrals).toHaveLength(6);
    expect(state.referrals.map((r) => r.id)).toEqual(["RF-001", "RF-002", "RF-003", "RF-004", "RF-005", "RF-006"]);
    expect(state.frontDoorReferralSequence).toBe(0);
  });

  it("copies the referral fixture rather than aliasing it", () => {
    const first = seeded();
    const second = seeded();
    expect(first.referrals[0]).not.toBe(second.referrals[0]);
    expect(first.referrals).toEqual(second.referrals);
  });
});
