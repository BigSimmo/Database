// tests/ward-referral-reducer.test.ts
//
// Phase 7 Task 3 (spec "The front door"): the three events that wire Task 1's `Referral` type
// into live reducer state — RECEIVE_REFERRAL (community), ACCEPT_REFERRAL and DECLINE_REFERRAL
// (both ["ward", "coordinator"] since owner ruling FD-25, 2026-08-30; coordinator-only before). Every guard named in the task brief gets its own test here, and every
// one of those tests is proven against a mutation in the accompanying report — see
// `.superpowers/sdd/2026-08-27-ward-flow-phase-7-front-door/task-3-report.md`.
import { describe, expect, it } from "vitest";

import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import {
  PARALLEL_REFERRAL_CAP,
  REFERRAL_DECLINE_REASONS,
  type Referral,
  type ReferralAddressing,
  type ReferralDestination,
} from "../src/components/ward-management/ward-model";
import { referralState } from "../src/components/ward-management/ward-referrals";
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

/**
 * The WARD destination of a referral, and what it answered.
 *
 * The decision fields moved off `Referral` onto each destination when a referral gained several
 * (FD-21), so "what did this referral decide" is no longer a question with one answer. Every
 * referral in this file is addressed to a ward only, so this reads the one that exists — and
 * throws rather than returning undefined, so a fixture that stops being a ward referral fails
 * here by name instead of turning every assertion below into a comparison against `undefined`.
 */
function ward(state: WardFlowState, id: string): ReferralAddressing {
  const found = referral(state, id).destinations.find(
    (addressing) => addressing.destination.kind === "psychiatric_ward",
  );
  if (!found) throw new Error(`referral ${id} has no psychiatric ward destination`);
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
    destinations: [
      {
        kind: "psychiatric_ward",
        sex: "Female",
        secureBedNeeded: false,
        involuntaryBedNeeded: false,
      },
    ],
    homeRegion: "Perth Metropolitan",
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
    expect(referralState(created)).toBe("queued");
    expect(created.ageBand).toBe("Adult");
    // The whole arm, not its three fields one at a time: this now also pins that the referral was
    // addressed to a psychiatric ward and carries no field belonging to another destination.
    expect(created.destinations[0].destination).toEqual({
      kind: "psychiatric_ward",
      sex: "Female",
      secureBedNeeded: false,
      involuntaryBedNeeded: false,
    });
    expect(created.homeRegion).toBe("Perth Metropolitan");
    expect(created.source).toBe("community");
    expect(created.urgency).toBe(2);
    expect(created.originSiteCode).toBe("SCGH");
    expect(created.transportNeeded).toBe(false);
    expect(created.raisedAt).toBe(NOW);
    expect(created.destinations[0].acceptedUnitId).toBeUndefined();
    expect(created.destinations[0].declineReason).toBeUndefined();
    expect(created.destinations[0].decidedAt).toBeUndefined();
  });

  // Controller ruling P1: the id source is a monotonic counter (`frontDoorReferralSequence`),
  // never `state.referrals.length` — Phase 5 shipped exactly the length-derived bug for leave
  // beds. The seed fixture carries 7 referrals (RF-001..RF-007, fix round B added RF-007), so a
  // length-derived id would mint "RF-907" for the very first runtime referral; the
  // counter-derived id mints "RF-901" instead. This test fails if a future change swaps the id
  // source back to `.length`.
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
      destinations: [
        {
          kind: "psychiatric_ward",
          sex: "Female",
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
        },
      ],
      homeRegion: "Perth Metropolitan",
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

  /**
   * I2 fix: `RECEIVE_REFERRAL`'s own comment used to say "the only guard is the role check
   * above" — `source`, `homeRegion`, `ageBand`, `urgency` and `originSiteCode` all passed through
   * unvalidated, contradicting the spec's Failure behaviour directly ("a referral … carrying an
   * unknown source … → refused with a visible `Rejection`. Never silently queued, never
   * defaulted."). Each of the five checks below is proven independently: a bad value in that ONE
   * field refuses the referral, named, and every other field stays valid.
   */
  describe("validates every field, not just role (review finding I2)", () => {
    function withBadField(overrides: Record<string, unknown>) {
      const event = {
        type: "RECEIVE_REFERRAL",
        role: "community",
        now: NOW,
        ageBand: "Adult",
        destinations: [
          {
            kind: "psychiatric_ward",
            sex: "Female",
            secureBedNeeded: false,
            involuntaryBedNeeded: false,
          },
        ],
        homeRegion: "Perth Metropolitan",
        source: "community",
        urgency: 2,
        originSiteCode: "SCGH",
        transportNeeded: false,
        ...overrides,
      };
      // Deliberately bypassing the event type here — that is the whole point of this helper: it
      // constructs an event carrying a value the type system would refuse, to prove the REDUCER
      // refuses it too, at runtime, the same discipline as this file's existing
      // `"clinically_unsuitable" as unknown as …` cast on `DECLINE_REFERRAL`'s own reason field.
      return wardFlowReducer(seeded(), event as unknown as Parameters<typeof wardFlowReducer>[1]);
    }

    it("refuses an ageBand outside COHORTS, by membership rather than truthiness", () => {
      const after = withBadField({ ageBand: "Infant" });
      expect(after.referrals).toEqual(seeded().referrals);
      expect(after.rejections).toHaveLength(1);
      expect(after.rejections[0].reason).toContain("COHORTS");
    });

    // Review finding M1: `sex` was the one enum-shaped field on this event with no membership
    // check. `"F"` rather than an obvious nonsense value on purpose — it is the abbreviation a
    // non-form caller would plausibly send, and the one whose consequences are invisible: it is
    // never a key of `unit.sexMix`, so `sexMix["F"] ?? 0` is 0 on every unit, and
    // `sexDesignationAccepts` refuses it at every designated unit. The referral would have
    // queued and then matched almost nothing, with a plausible-looking reason per unit, instead
    // of being refused where it entered.
    it("refuses a sex outside SEXES, by membership rather than truthiness", () => {
      // `sex` moved onto the ward arm INSIDE a list, so the malformed value has to be planted
      // where the field now lives. Planting it at either older path -- flat on the event, or on a
      // single `destination` -- tests nothing: the reducer reads neither, so the event would be
      // well-formed and the referral would queue, which is exactly what this test exists to catch.
      const after = withBadField({
        destinations: [{ kind: "psychiatric_ward", sex: "F", secureBedNeeded: false, involuntaryBedNeeded: false }],
      });
      expect(after.referrals).toEqual(seeded().referrals);
      expect(after.rejections).toHaveLength(1);
      expect(after.rejections[0].reason).toContain("SEXES");
    });

    it("refuses a source outside REFERRAL_SOURCES, by membership rather than truthiness", () => {
      const after = withBadField({ source: "self_referral" });
      expect(after.referrals).toEqual(seeded().referrals);
      expect(after.rejections).toHaveLength(1);
      expect(after.rejections[0].reason).toContain("REFERRAL_SOURCES");
    });

    // The discriminating case for this field: an address, not merely a bad value — this is the
    // exact failure scenario I2 names (a text input landing in a field that must be a region).
    it("refuses a homeRegion outside HOME_REGIONS, including an address, by membership rather than truthiness", () => {
      const after = withBadField({ homeRegion: "12 Wellington St, Perth" });
      expect(after.referrals).toEqual(seeded().referrals);
      expect(after.rejections).toHaveLength(1);
      expect(after.rejections[0].reason).toContain("HOME_REGIONS");
    });

    it("refuses an urgency outside 1, 2 or 3", () => {
      const after = withBadField({ urgency: 4 });
      expect(after.referrals).toEqual(seeded().referrals);
      expect(after.rejections).toHaveLength(1);
      expect(after.rejections[0].reason).toContain("urgency");
    });

    // The discriminating case for this field, same shape as homeRegion above: an address is a
    // non-empty string, so a mere non-emptiness check would have let it through.
    it("refuses an originSiteCode that does not resolve to a real site, including an address", () => {
      const after = withBadField({ originSiteCode: "123 Wellington Street, Perth" });
      expect(after.referrals).toEqual(seeded().referrals);
      expect(after.rejections).toHaveLength(1);
      expect(after.rejections[0].reason).toContain("originSiteCode");
    });

    it("still accepts a referral once every field is valid, proving the checks above are not vacuous", () => {
      const after = withBadField({});
      expect(after.rejections).toEqual([]);
      expect(after.referrals).toHaveLength(seeded().referrals.length + 1);
    });
  });
});

describe("ACCEPT_REFERRAL", () => {
  it("passes every gate against a well-matched unit and creates NO Movement (spec D14)", () => {
    const received = receiveReferral(seeded());
    const created = received.referrals.at(-1)!;
    const before = received;
    const after = wardFlowReducer(before, {
      type: "ACCEPT_REFERRAL",
      destinationKind: "psychiatric_ward",
      role: "coordinator",
      now: NOW,
      referralId: created.id,
      unitId: "scgh-adult-open",
    });
    expect(after.rejections).toEqual([]);
    const decided = referral(after, created.id);
    expect(referralState(decided)).toBe("accepted");
    expect(decided.destinations[0].acceptedUnitId).toBe("scgh-adult-open");
    expect(decided.destinations[0].decidedAt).toBe(NOW);
    // H4 fix: was `.toBeTruthy()`, which "Dr Jane Smith" would also pass — `decidedBy`'s own doc
    // comment says "a role, never a person", so the exact value is asserted, not merely its
    // presence. NOT coordinator-only since FD-25: the value follows the ACTING role, which the
    // ward-accepts test below is what actually proves.
    expect(decided.destinations[0].decidedBy).toBe("Flow coordinator");
    expect(decided.destinations[0].declineReason).toBeUndefined();

    // Spec D14, asserted explicitly rather than left implicit: acceptance never creates a
    // Movement. Both the count AND the content are unchanged, so a future change that appends a
    // movement anywhere — not just one keyed on this referral — is caught.
    expect(after.movements).toHaveLength(before.movements.length);
    expect(after.movements).toEqual(before.movements);
  });

  /**
   * FD-25 widened ACCEPT_REFERRAL to `["ward", "coordinator"]` while the reducer still wrote
   * `decidedBy: "Flow coordinator"` as a LITERAL. A ward accepting would have been recorded as the
   * coordinator having decided -- a false entry in the only field that names who answered, and
   * exactly the fact the override register exists to make accountable.
   *
   * This is the test that makes the fix real. Widening the role list on its own broke nothing and
   * no existing test noticed, because every one of them accepts as the coordinator.
   */
  it("records the ward as having decided when a WARD accepts, not the coordinator", () => {
    const received = receiveReferral(seeded());
    const created = received.referrals.at(-1)!;
    const after = wardFlowReducer(received, {
      type: "ACCEPT_REFERRAL",
      destinationKind: "psychiatric_ward",
      role: "ward",
      now: NOW,
      referralId: created.id,
      unitId: "scgh-adult-open",
    });
    expect(after.rejections, "a ward may accept a referral addressed to it since FD-25").toEqual([]);
    const decided = referral(after, created.id);
    expect(referralState(decided)).toBe("accepted");
    expect(
      decided.destinations[0].decidedBy,
      "the ward accepted, so the ward is who decided. Recording the coordinator would put a party " +
        "that took no part in the decision into the one field naming who answered.",
    ).toBe("Ward manager");

    // And a coordinator still writes the coordinator's label -- so this does not pass merely
    // because the lookup returns one string for everybody.
    const byCoordinator = wardFlowReducer(received, {
      type: "ACCEPT_REFERRAL",
      destinationKind: "psychiatric_ward",
      role: "coordinator",
      now: NOW,
      referralId: created.id,
      unitId: "scgh-adult-open",
    });
    expect(ward(byCoordinator, created.id).decidedBy).toBe("Flow coordinator");
  });

  it("refuses (visibly) a role that is neither ward nor coordinator, rather than silently doing nothing", () => {
    const received = receiveReferral(seeded());
    const created = received.referrals.at(-1)!;
    const after = wardFlowReducer(received, {
      type: "ACCEPT_REFERRAL",
      destinationKind: "psychiatric_ward",
      role: "community",
      now: NOW,
      referralId: created.id,
      unitId: "scgh-adult-open",
    });
    expect(referralState(referral(after, created.id))).toBe("queued");
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
      destinationKind: "psychiatric_ward",
      role: "coordinator",
      now: NOW,
      referralId: "RF-001",
      unitId: "scgh-adult-open",
    });
    expect(referralState(referral(after, "RF-001"))).toBe("queued");
    expect(after.rejections).toHaveLength(1);
    // Named as the exact gate identifier, not a bare substring — `toContain("age")` also matches
    // "manage", "message" and "storage" (H6), so it would survive a mutation that swapped in the
    // wrong failing gate's name as long as one of those words appeared anywhere in the reason.
    expect(after.rejections[0].reason).toContain("failed gate age:");
    // The failing gate is named by the UNIT'S NAME (matching `referralEligibility`'s own detail
    // strings), not its bare id.
    expect(after.rejections[0].reason).toContain("SCGH Adult Open");
  });

  it("refuses a decision on a referral that is not queued (already accepted)", () => {
    const before = seeded();
    // RF-002 is already accepted in the seed fixture (ward-movements.ts).
    expect(referralState(referral(before, "RF-002"))).toBe("accepted");
    const after = wardFlowReducer(before, {
      type: "ACCEPT_REFERRAL",
      destinationKind: "psychiatric_ward",
      role: "coordinator",
      now: NOW,
      referralId: "RF-002",
      unitId: "scgh-adult-open",
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain("already been accepted elsewhere");
    // A referral that is accepted is finished for placement (FD-22), so a second acceptance is
    // refused on the REFERRAL, not on the destination -- a different refusal from the one below.
    // Untouched — a refused decision does not overwrite the earlier one.
    expect(referral(after, "RF-002")).toEqual(referral(before, "RF-002"));
  });

  it("refuses a decision on a referral that is not queued (already declined)", () => {
    const before = seeded();
    // RF-004 is already declined in the seed fixture.
    expect(referralState(referral(before, "RF-004"))).toBe("declined");
    const after = wardFlowReducer(before, {
      type: "ACCEPT_REFERRAL",
      destinationKind: "psychiatric_ward",
      role: "coordinator",
      now: NOW,
      referralId: "RF-004",
      unitId: "scgh-adult-open",
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain("has already answered");
    // RF-004's ward declined, so the referral itself is still open as far as FD-24 is concerned;
    // what is refused here is asking the SAME destination twice.
  });

  it("refuses an unknown referral id", () => {
    const after = wardFlowReducer(seeded(), {
      type: "ACCEPT_REFERRAL",
      destinationKind: "psychiatric_ward",
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
      destinationKind: "psychiatric_ward",
      role: "coordinator",
      now: NOW,
      referralId: created.id,
      reason: "no_suitable_bed",
    });
    expect(after.rejections).toEqual([]);
    const decided = referral(after, created.id);
    expect(referralState(decided)).toBe("declined");
    expect(decided.destinations[0].declineReason).toBe("no_suitable_bed");
    expect(decided.destinations[0].decidedAt).toBe(NOW);
    // H4 fix — same reasoning as ACCEPT_REFERRAL's own test above.
    expect(decided.destinations[0].decidedBy).toBe("Flow coordinator");
    expect(decided.destinations[0].acceptedUnitId).toBeUndefined();
  });

  it("refuses (visibly) a role that is neither ward nor coordinator, rather than silently doing nothing", () => {
    const received = receiveReferral(seeded());
    const created = received.referrals.at(-1)!;
    const after = wardFlowReducer(received, {
      type: "DECLINE_REFERRAL",
      destinationKind: "psychiatric_ward",
      role: "community",
      now: NOW,
      referralId: created.id,
      reason: "no_suitable_bed",
    });
    expect(referralState(referral(after, created.id))).toBe("queued");
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
      destinationKind: "psychiatric_ward",
      role: "coordinator",
      now: NOW,
      // A non-empty string a truthiness test would let through.
      referralId: created.id,
      reason: "clinically_unsuitable" as unknown as (typeof REFERRAL_DECLINE_REASONS)[number],
    });
    expect(referralState(referral(after, created.id))).toBe("queued");
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain("REFERRAL_DECLINE_REASONS");
  });

  it("refuses a decision on a referral that is not queued (already accepted)", () => {
    const before = seeded();
    expect(referralState(referral(before, "RF-003"))).toBe("accepted");
    const after = wardFlowReducer(before, {
      type: "DECLINE_REFERRAL",
      destinationKind: "psychiatric_ward",
      role: "coordinator",
      now: NOW,
      referralId: "RF-003",
      reason: "no_suitable_bed",
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain("already been accepted elsewhere");
    expect(referral(after, "RF-003")).toEqual(referral(before, "RF-003"));
  });

  it("refuses a decision on a referral that is not queued (already declined)", () => {
    const before = seeded();
    expect(referralState(referral(before, "RF-004"))).toBe("declined");
    const after = wardFlowReducer(before, {
      type: "DECLINE_REFERRAL",
      destinationKind: "psychiatric_ward",
      role: "coordinator",
      now: NOW,
      referralId: "RF-004",
      reason: "no_suitable_bed",
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain("has already answered");
  });

  it("refuses an unknown referral id", () => {
    const after = wardFlowReducer(seeded(), {
      type: "DECLINE_REFERRAL",
      destinationKind: "psychiatric_ward",
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
        destinationKind: "psychiatric_ward",
        role: "coordinator",
        now: NOW,
        referralId: created.id,
        reason,
      });
      expect(state.rejections.length, `reason ${reason} was refused`).toBe(before);
      expect(ward(state, created.id).declineReason).toBe(reason);
    }
  });
});

/**
 * Phase 8 Task 2 (spec D8-6). Optional by design: nobody knows whether country services look for
 * a local bed first, so this records that it happened if it did. It is never a stage the pathway
 * requires, never a gate on acceptance, and its absence is never counted against anyone.
 */
describe("RECORD_LOCAL_BED_SOUGHT", () => {
  function queuedWithoutRecord(state: WardFlowState): Referral {
    const found = state.referrals.find(
      (candidate) => referralState(candidate) === "queued" && candidate.localBedSought === undefined,
    );
    if (!found) throw new Error("the seed holds no queued referral without a local-bed record");
    return found;
  }

  it("records the search against a queued referral, as a time and a ROLE and nothing else", () => {
    const before = seeded();
    const target = queuedWithoutRecord(before);
    const after = wardFlowReducer(before, {
      type: "RECORD_LOCAL_BED_SOUGHT",
      role: "coordinator",
      now: NOW,
      referralId: target.id,
    });
    expect(after.rejections).toEqual([]);
    expect(referral(after, target.id).localBedSought).toEqual({ at: NOW, by: "coordinator" });
  });

  it("stays optional: it is not required before ACCEPT_REFERRAL and never gates it", () => {
    const before = seeded();
    // scgh-adult-open is the deterministic match the `receiveReferral` helper above relies on.
    const received = receiveReferral(before);
    const created = received.referrals.at(-1)!;
    expect(created.localBedSought).toBeUndefined();
    const accepted = wardFlowReducer(received, {
      type: "ACCEPT_REFERRAL",
      destinationKind: "psychiatric_ward",
      role: "coordinator",
      now: NOW,
      referralId: created.id,
      unitId: "scgh-adult-open",
    });
    expect(accepted.rejections).toEqual([]);
    expect(referralState(referral(accepted, created.id))).toBe("accepted");
    expect(referral(accepted, created.id).localBedSought).toBeUndefined();
  });

  it("refuses a role that does not hold the event, with a visible rejection rather than a silent no-op", () => {
    const before = seeded();
    const target = queuedWithoutRecord(before);
    const after = wardFlowReducer(before, {
      type: "RECORD_LOCAL_BED_SOUGHT",
      role: "ward",
      now: NOW,
      referralId: target.id,
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain("RECORD_LOCAL_BED_SOUGHT requires role");
    expect(after.rejections[0].reason).toContain("ward");
    expect(referral(after, target.id).localBedSought).toBeUndefined();
  });

  it("refuses an already-decided referral, naming the state", () => {
    const before = seeded();
    const decided = before.referrals.find((candidate) => referralState(candidate) === "accepted")!;
    const after = wardFlowReducer(before, {
      type: "RECORD_LOCAL_BED_SOUGHT",
      role: "coordinator",
      now: NOW,
      referralId: decided.id,
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain("already decided");
    expect(after.rejections[0].reason).toContain("accepted");
  });

  it("is one-shot: a second record is refused and the first survives", () => {
    const before = seeded();
    const target = queuedWithoutRecord(before);
    const once = wardFlowReducer(before, {
      type: "RECORD_LOCAL_BED_SOUGHT",
      role: "coordinator",
      now: NOW,
      referralId: target.id,
    });
    expect(once.rejections).toEqual([]);
    const twice = wardFlowReducer(once, {
      type: "RECORD_LOCAL_BED_SOUGHT",
      role: "coordinator",
      now: NOW + 30,
      referralId: target.id,
    });
    expect(twice.rejections).toHaveLength(1);
    expect(twice.rejections[0].reason).toContain("already records a local bed search");
    expect(referral(twice, target.id).localBedSought).toEqual({ at: NOW, by: "coordinator" });
  });

  it("refuses an unknown referral id rather than defaulting to one", () => {
    const before = seeded();
    const after = wardFlowReducer(before, {
      type: "RECORD_LOCAL_BED_SOUGHT",
      role: "coordinator",
      now: NOW,
      referralId: "RF-DOES-NOT-EXIST",
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain("RF-DOES-NOT-EXIST");
    expect(after.referrals).toEqual(before.referrals);
  });
});

describe("seeding", () => {
  it("wires Task 1's Referral fixture into live state", () => {
    const state = seeded();
    // Fix round B added RF-007 (review finding M1's related note: a successful youth match
    // against EMyU, which nothing in the seed previously demonstrated) — 7 referrals, not 6.
    // Phase 8 Task 2 added RF-008, the one accepted referral whose travel band is out of area —
    // 8, not 7. See `referrals`' own doc comment (`ward-movements.ts`) for why that case had to
    // be added rather than made out of an existing referral.
    expect(state.referrals).toHaveLength(8);
    expect(state.referrals.map((r) => r.id)).toEqual([
      "RF-001",
      "RF-002",
      "RF-003",
      "RF-004",
      "RF-005",
      "RF-006",
      "RF-007",
      "RF-008",
    ]);
    expect(state.frontDoorReferralSequence).toBe(0);
  });

  it("copies the referral fixture rather than aliasing it", () => {
    const first = seeded();
    const second = seeded();
    expect(first.referrals[0]).not.toBe(second.referrals[0]);
    expect(first.referrals).toEqual(second.referrals);
  });
});

/**
 * FD-21, FD-22 and FD-24 — the lifecycle a referral gained when it could be addressed to several
 * places at once. None of this was expressible before 2026-08-30, so none of it is covered by the
 * tests above: they were all written when a referral had exactly one thing to decide.
 */
describe("a referral addressed to several destinations", () => {
  function receiveMulti(state: WardFlowState, kinds: ReferralDestination[]) {
    return wardFlowReducer(state, {
      type: "RECEIVE_REFERRAL",
      role: "community",
      now: NOW,
      ageBand: "Adult",
      destinations: kinds,
      homeRegion: "Perth Metropolitan",
      source: "community",
      urgency: 2,
      originSiteCode: "SCGH",
      transportNeeded: false,
    });
  }

  const WARD: ReferralDestination = {
    kind: "psychiatric_ward",
    sex: "Female",
    secureBedNeeded: false,
    involuntaryBedNeeded: false,
  };
  // `edId` and `purpose` are required on every ED destination (FD-15/FD-11): a referral to an
  // emergency department always says WHICH one and WHY. See the arm's own doc comment for why
  // purpose is a field rather than a fourth kind.
  const ED: ReferralDestination = {
    kind: "emergency_department",
    edId: "peel-ed",
    purpose: "psychiatric_review",
  };
  const COMMUNITY: ReferralDestination = { kind: "community_team" };

  it("holds every destination the referrer chose, each queued and each with its own record", () => {
    const after = receiveMulti(seeded(), [WARD, ED, COMMUNITY]);
    expect(after.rejections).toEqual([]);
    const created = after.referrals.at(-1)!;
    expect(created.destinations.map((addressing) => addressing.destination.kind)).toEqual([
      "psychiatric_ward",
      "emergency_department",
      "community_team",
    ]);
    expect(created.destinations.every((addressing) => addressing.state === "queued")).toBe(true);
    expect(referralState(created)).toBe("queued");
  });

  it("refuses an empty list and the same kind twice, each by its own reason", () => {
    const empty = receiveMulti(seeded(), []);
    expect(empty.rejections.at(-1)?.reason).toContain("at least one destination");

    const twice = receiveMulti(seeded(), [WARD, { ...WARD }]);
    expect(twice.rejections.at(-1)?.reason).toContain("same destination kind twice");
    expect(twice.referrals).toEqual(seeded().referrals);

    // Three kinds exist and the cap is three, so a too-long list of DIFFERENT kinds is not
    // constructible today; the duplicate refusal above is what actually bounds it. Asserted so the
    // cap is the number the model states rather than a figure invented in this test.
    expect(PARALLEL_REFERRAL_CAP).toBe(3);
  });

  it("cancels every destination still waiting when the first one accepts (FD-22)", () => {
    const after = receiveMulti(seeded(), [WARD, ED, COMMUNITY]);
    const created = after.referrals.at(-1)!;
    const accepted = wardFlowReducer(after, {
      type: "ACCEPT_REFERRAL",
      role: "ward",
      now: NOW + 5,
      referralId: created.id,
      destinationKind: "psychiatric_ward",
      unitId: "scgh-adult-open",
    });
    expect(accepted.rejections).toEqual([]);

    const decided = accepted.referrals.find((candidate) => candidate.id === created.id)!;
    const byKind = new Map(decided.destinations.map((a) => [a.destination.kind, a]));
    expect(byKind.get("psychiatric_ward")!.state).toBe("accepted");
    expect(
      [byKind.get("emergency_department")!.state, byKind.get("community_team")!.state],
      "the ward accepting must end the other two asks without anybody coordinating it",
    ).toEqual(["cancelled", "cancelled"]);
    expect(referralState(decided)).toBe("accepted");

    // A cancellation is a consequence, not a decision: it has a time, and nobody to attribute it to.
    for (const kind of ["emergency_department", "community_team"] as const) {
      expect(byKind.get(kind)!.decidedAt).toBe(NOW + 5);
      expect(byKind.get(kind)!.decidedBy, "nobody decided a cancellation").toBeUndefined();
    }
  });

  it("refuses a second acceptance rather than letting two places both believe they took the person", () => {
    const after = receiveMulti(seeded(), [WARD, ED]);
    const created = after.referrals.at(-1)!;
    const once = wardFlowReducer(after, {
      type: "ACCEPT_REFERRAL",
      role: "ward",
      now: NOW + 5,
      referralId: created.id,
      destinationKind: "psychiatric_ward",
      unitId: "scgh-adult-open",
    });
    const twice = wardFlowReducer(once, {
      type: "ACCEPT_REFERRAL",
      role: "coordinator",
      now: NOW + 9,
      referralId: created.id,
      destinationKind: "emergency_department",
    });
    expect(twice.rejections.at(-1)?.reason).toContain("already been accepted elsewhere");
    expect(
      twice.referrals.find((candidate) => candidate.id === created.id),
      "a refused second acceptance changes nothing",
    ).toEqual(once.referrals.find((candidate) => candidate.id === created.id));
  });

  it("leaves the others live when one destination declines, and keeps the refusal on the record (FD-24)", () => {
    const after = receiveMulti(seeded(), [WARD, ED, COMMUNITY]);
    const created = after.referrals.at(-1)!;
    const declined = wardFlowReducer(after, {
      type: "DECLINE_REFERRAL",
      role: "ward",
      now: NOW + 3,
      referralId: created.id,
      destinationKind: "psychiatric_ward",
      reason: "no_suitable_bed",
    });
    expect(declined.rejections).toEqual([]);

    const subject = declined.referrals.find((candidate) => candidate.id === created.id)!;
    const byKind = new Map(subject.destinations.map((a) => [a.destination.kind, a]));
    expect(byKind.get("psychiatric_ward")!.state).toBe("declined");
    expect(
      [byKind.get("emergency_department")!.state, byKind.get("community_team")!.state],
      "a decline locks nobody out and ends nothing else",
    ).toEqual(["queued", "queued"]);
    expect(
      referralState(subject),
      "one ward saying no is NOT a declined referral — the other two have not answered",
    ).toBe("queued");

    // The refusal, its time and its reason stay recorded: the surviving half of the decision FD-24
    // replaced. And the ward is not shut out of anything later.
    expect(byKind.get("psychiatric_ward")!.declineReason).toBe("no_suitable_bed");
    expect(byKind.get("psychiatric_ward")!.decidedAt).toBe(NOW + 3);
    expect(byKind.get("psychiatric_ward")!.decidedBy).toBe("Ward manager");
  });

  it("does not overwrite a decline when a later acceptance cancels the rest", () => {
    const after = receiveMulti(seeded(), [WARD, ED, COMMUNITY]);
    const created = after.referrals.at(-1)!;
    const declined = wardFlowReducer(after, {
      type: "DECLINE_REFERRAL",
      role: "ward",
      now: NOW + 3,
      referralId: created.id,
      destinationKind: "psychiatric_ward",
      reason: "no_suitable_bed",
    });
    const accepted = wardFlowReducer(declined, {
      type: "ACCEPT_REFERRAL",
      role: "coordinator",
      now: NOW + 7,
      referralId: created.id,
      destinationKind: "emergency_department",
    });
    expect(accepted.rejections).toEqual([]);

    const subject = accepted.referrals.find((candidate) => candidate.id === created.id)!;
    const byKind = new Map(subject.destinations.map((a) => [a.destination.kind, a]));
    expect(byKind.get("emergency_department")!.state).toBe("accepted");
    expect(byKind.get("community_team")!.state).toBe("cancelled");
    expect(
      byKind.get("psychiatric_ward")!.state,
      "a ward that already refused stays REFUSED — rewriting it as cancelled would replace a real " +
        "answer somebody gave with a consequence they had no part in",
    ).toBe("declined");
    expect(byKind.get("psychiatric_ward")!.declineReason).toBe("no_suitable_bed");
  });

  it("cannot accept a non-ward destination into a unit, because a team is not a bed", () => {
    const after = receiveMulti(seeded(), [WARD, COMMUNITY]);
    const created = after.referrals.at(-1)!;
    const wrong = wardFlowReducer(after, {
      type: "ACCEPT_REFERRAL",
      role: "coordinator",
      now: NOW + 2,
      referralId: created.id,
      destinationKind: "community_team",
      unitId: "scgh-adult-open",
    });
    expect(wrong.rejections.at(-1)?.reason).toContain("answered by a team, not a bed");

    // And the ward arm still REQUIRES one, so this is not simply ignoring `unitId` everywhere.
    const missing = wardFlowReducer(after, {
      type: "ACCEPT_REFERRAL",
      role: "ward",
      now: NOW + 2,
      referralId: created.id,
      destinationKind: "psychiatric_ward",
    });
    expect(missing.rejections.at(-1)?.reason).toContain("must name a unit");
  });

  it("refuses a decision for a destination this referral was never addressed to", () => {
    const after = receiveMulti(seeded(), [WARD]);
    const created = after.referrals.at(-1)!;
    const unaddressed = wardFlowReducer(after, {
      type: "DECLINE_REFERRAL",
      role: "coordinator",
      now: NOW + 2,
      referralId: created.id,
      destinationKind: "community_team",
      reason: "no_suitable_bed",
    });
    expect(unaddressed.rejections.at(-1)?.reason).toContain("was not addressed to");
    expect(unaddressed.referrals.find((c) => c.id === created.id)).toEqual(created);
  });

  it("calls a referral declined only when every destination has declined", () => {
    const after = receiveMulti(seeded(), [WARD, ED]);
    const created = after.referrals.at(-1)!;
    const one = wardFlowReducer(after, {
      type: "DECLINE_REFERRAL",
      role: "ward",
      now: NOW + 3,
      referralId: created.id,
      destinationKind: "psychiatric_ward",
      reason: "no_suitable_bed",
    });
    expect(referralState(one.referrals.find((c) => c.id === created.id)!)).toBe("queued");

    const both = wardFlowReducer(one, {
      type: "DECLINE_REFERRAL",
      role: "coordinator",
      now: NOW + 6,
      referralId: created.id,
      destinationKind: "emergency_department",
      reason: "belongs_to_another_service",
    });
    expect(referralState(both.referrals.find((c) => c.id === created.id)!)).toBe("declined");
  });
});
