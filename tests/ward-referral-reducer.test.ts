// tests/ward-referral-reducer.test.ts
//
// Phase 7 Task 3 (spec "The front door"): the three events that wire Task 1's `Referral` type
// into live reducer state — RECEIVE_REFERRAL (community), ACCEPT_REFERRAL and DECLINE_REFERRAL
// (both ["ward", "coordinator"] since owner ruling FD-25, 2026-08-30; coordinator-only before). Every guard named in the task brief gets its own test here, and every
// one of those tests is proven against a mutation in the accompanying report — see
// `.superpowers/sdd/2026-08-27-ward-flow-phase-7-front-door/task-3-report.md`.
import { describe, expect, it } from "vitest";

import { eligibility, referralEligibility } from "../src/components/ward-management/ward-eligibility";
import {
  SUITABILITY_GATES,
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { OVERRIDE_REASONS } from "../src/components/ward-management/ward-change-reasons";
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
    suburb: { kind: "named", name: "Armadale" },
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
      suburb: { kind: "named", name: "Armadale" },
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
        // A real suburb, so a case testing a bad `urgency` fails on urgency rather than on the
        // suburb check that now runs before it. `overrides` below can still replace it.
        suburb: { kind: "named", name: "Armadale" },
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

  /**
   * Three states, not two — matching `RAISE_REFERRAL.referralId`'s own resolve-when-present
   * discipline rather than inventing a new one. See the reducer's own comment on this guard
   * (`ward-flow-reducer.ts`, `case "RECEIVE_REFERRAL"`, just above `const sequence = …`) for the
   * full reasoning; these three tests are what pin it.
   */
  describe("patientId — present-and-real, present-and-naming-nobody, and absent (owner ruling 2026-09-02)", () => {
    it("refuses a patientId that names nobody on file, visibly and by name", () => {
      const before = seeded();
      const after = wardFlowReducer(before, {
        type: "RECEIVE_REFERRAL",
        role: "community",
        now: NOW,
        patientId: "PT-999",
        ageBand: "Adult",
        destinations: [
          { kind: "psychiatric_ward", sex: "Female", secureBedNeeded: false, involuntaryBedNeeded: false },
        ],
        homeRegion: "Perth Metropolitan",
        suburb: { kind: "named", name: "Armadale" },
        source: "community",
        urgency: 2,
        originSiteCode: "SCGH",
        transportNeeded: false,
      });
      expect(after.referrals).toEqual(before.referrals);
      expect(after.rejections).toHaveLength(1);
      expect(after.rejections[0].reason).toContain("PT-999");
      expect(after.rejections[0].reason).toMatch(/patient|person/i);
    });

    it("still accepts and stores a patientId that names a real patient", () => {
      const before = seeded();
      const realPatientId = before.patients[0]!.id;
      const after = wardFlowReducer(before, {
        type: "RECEIVE_REFERRAL",
        role: "community",
        now: NOW,
        patientId: realPatientId,
        ageBand: "Adult",
        destinations: [
          { kind: "psychiatric_ward", sex: "Female", secureBedNeeded: false, involuntaryBedNeeded: false },
        ],
        homeRegion: "Perth Metropolitan",
        suburb: { kind: "named", name: "Armadale" },
        source: "community",
        urgency: 2,
        originSiteCode: "SCGH",
        transportNeeded: false,
      });
      expect(after.rejections).toEqual([]);
      const created = after.referrals.at(-1)!;
      expect(created.patientId).toBe(realPatientId);
    });

    it("still accepts and stores undefined when patientId is absent — the legitimate no-person-on-file case", () => {
      const after = receiveReferral(seeded());
      expect(after.rejections).toEqual([]);
      const created = after.referrals.at(-1)!;
      expect(created.patientId).toBeUndefined();
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

  // ── The reason path on the front door (owner ruling, 2026-09-02) ──────────────────────────
  //
  // Until this was built the two placement paths held OPPOSITE policies: the coordinator's path
  // checked no judgement gate at all, while `ACCEPT_REFERRAL` here rejected on the first failing
  // gate of ANY kind. So a referral that every ward failed on one judgement gate could not be
  // accepted by anybody, with any reason, ever. The owner's rule for both ends: a judgement about
  // the patient is overridable by a named human recording why; a fact about the world is not.

  it("names the way through when it refuses a judgement gate, instead of just shutting the door", () => {
    const after = wardFlowReducer(seeded(), {
      type: "ACCEPT_REFERRAL",
      destinationKind: "psychiatric_ward",
      role: "coordinator",
      now: NOW,
      referralId: "RF-001",
      unitId: "scgh-adult-open",
    });
    expect(referralState(referral(after, "RF-001"))).toBe("queued");
    expect(after.rejections).toHaveLength(1);
    // ⚠️ NAMES A STATE, NOT AN ACTION, AND THAT IS DELIBERATE. The refusal before this change
    // named the gate and stopped, which reads as "never". But an instruction is only safe if every
    // surface that can receive it has the control to obey it — and the engine speaks ONE sentence
    // to every caller. "Record an override reason" sent a ward nurse hunting for a control that
    // exists only on the coordinator's panel. A state is true on every surface and instructs
    // nobody. See `docs/ward-flow/` — the exact clinical wording is still the owner's to confirm.
    expect(after.rejections[0].reason).toContain("This acceptance needs a recorded override reason");
  });

  it("admits the SAME acceptance once a reason is recorded, and stores what was given", () => {
    const after = wardFlowReducer(seeded(), {
      type: "ACCEPT_REFERRAL",
      destinationKind: "psychiatric_ward",
      role: "coordinator",
      now: NOW,
      referralId: "RF-001",
      unitId: "scgh-adult-open",
      overrideReason: "Clinical urgency outweighs the mismatch",
    });
    // Same patient, same unsuitable ward, opposite outcome — the reason is the only difference
    // between this dispatch and the one above, so nothing else can be producing the change.
    expect(after.rejections).toEqual([]);
    expect(referralState(referral(after, "RF-001"))).toBe("accepted");
    expect(ward(after, "RF-001").acceptedUnitId).toBe("scgh-adult-open");
    // Stored, not merely accepted: an override nobody can read afterwards is not accountability.
    expect(ward(after, "RF-001").acceptOverrideReason).toBe("Clinical urgency outweighs the mismatch");
  });

  it("refuses a reason that is not one of the offered reasons", () => {
    const after = wardFlowReducer(seeded(), {
      type: "ACCEPT_REFERRAL",
      destinationKind: "psychiatric_ward",
      role: "coordinator",
      now: NOW,
      referralId: "RF-001",
      unitId: "scgh-adult-open",
      // Membership-checked, never truthiness-checked. A free-text string must not buy its way
      // past a clinical gate just by being non-empty.
      overrideReason: "because I said so" as (typeof OVERRIDE_REASONS)[number],
    });
    expect(referralState(referral(after, "RF-001"))).toBe("queued");
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain("must be chosen from OVERRIDE_REASONS");
  });

  it("lets NO recorded reason past NO BED, because no reason creates a bed", () => {
    const received = receiveReferral(seeded());
    const created = received.referrals.at(-1)!;
    // ⚠️ REPOINTED 2026-09-02. This used `capacity_freshness` as its example of a fact no reason
    // can buy — and the owner has since ruled that a STALE COUNT IS INFORMATION, NOT A WALL, so
    // that gate is now overridable and would have made this test assert the opposite of the ruling.
    // `kun-adult-open` fails `allocatable_bed`, which the same ruling explicitly left absolute.
    const after = wardFlowReducer(received, {
      type: "ACCEPT_REFERRAL",
      destinationKind: "psychiatric_ward",
      role: "coordinator",
      now: NOW,
      referralId: created.id,
      unitId: "kun-adult-open",
      overrideReason: "Clinical urgency outweighs the mismatch",
    });
    expect(referralState(referral(after, created.id))).toBe("queued");
    expect(after.rejections).toHaveLength(1);
    // ⚠️ PIN THE GATE, NOT THE TAIL. `kun-adult-open` fails BOTH `allocatable_bed` and
    // `capacity_freshness`, and the trailing sentence is identical whichever unbypassable gate
    // refuses — so asserting only on it, this test would pass just as well if the refusal came
    // from freshness, which is exactly where it came from BEFORE the ruling moved that gate.
    // The test could not tell the before-state from the after-state. Found by Ward Lead's review:
    // an assertion on the SHARED TAIL of a message cannot distinguish which of several causes
    // produced it, and the reducer already emits the gate name.
    expect(after.rejections[0].reason).toContain("failed gate allocatable_bed");
    expect(after.rejections[0].reason).toContain("not something a recorded reason can override");
  });

  it("DOES let a recorded reason past a stale bed count, which the owner ruled is information", () => {
    // Owner ruling, 2026-09-02: a stale count is refusable AND answerable. "I have confirmed the
    // current bed state with the ward directly" is a named person taking responsibility for a fact.
    // ⚠️ Before this, `capacity_freshness` was refused at the front door with NO way through, which
    // left his own approved reason — "the bed information is known to be out of date" — a dead
    // option naming the one gate no reason could answer.
    const received = receiveReferral(seeded());
    const created = received.referrals.at(-1)!;
    // `scgh-adult-open` passes every gate at NOW; two hours past a 60-minute window fails
    // `capacity_freshness` and nothing else, isolating it from every other gate.
    const stale = { referralId: created.id, unitId: "scgh-adult-open", now: NOW + 120 } as const;

    const refused = wardFlowReducer(received, {
      type: "ACCEPT_REFERRAL",
      destinationKind: "psychiatric_ward",
      role: "coordinator",
      ...stale,
    });
    expect(refused.rejections, "still refused when nobody vouches for the count").toHaveLength(1);
    expect(refused.rejections[0].reason).toContain("failed gate capacity_freshness:");

    const allowed = wardFlowReducer(received, {
      type: "ACCEPT_REFERRAL",
      destinationKind: "psychiatric_ward",
      role: "coordinator",
      ...stale,
      overrideReason: "The bed information is known to be out of date",
    });
    expect(allowed.rejections, "and admitted when somebody does").toEqual([]);
    expect(referralState(referral(allowed, created.id))).toBe("accepted");
    expect(ward(allowed, created.id).acceptOverrideReason).toBe("The bed information is known to be out of date");
  });

  it("does not file an override against an acceptance that overrode nothing", () => {
    const received = receiveReferral(seeded());
    const created = received.referrals.at(-1)!;
    const after = wardFlowReducer(received, {
      type: "ACCEPT_REFERRAL",
      destinationKind: "psychiatric_ward",
      role: "coordinator",
      now: NOW,
      referralId: created.id,
      unitId: "scgh-adult-open",
      // A reason offered against a ward that turns out to be eligible anyway. Recording it would
      // put "a clinical rule was bent here" into the one place someone would later go looking for
      // the real ones.
      overrideReason: "Closer to the person's home or family",
    });
    expect(after.rejections).toEqual([]);
    expect(referralState(referral(after, created.id))).toBe("accepted");
    expect(ward(after, created.id).acceptOverrideReason).toBeUndefined();
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
    // Nine since 2026-08-30: RF-009 is the only referral addressed to an emergency department, and
    // the ED psychiatry hub had no data at all until it existed.
    // Ten since 2026-09-01: RF-007's community arm was SPLIT OUT into RF-010 rather than deleted,
    // because `{psychiatric_ward, community_team}` is a combination the owner ruled cannot occur
    // and RF-007's ward arm is the seed's only successful youth match. RF-010 is also the only
    // referral any seeded admission points at — see its own comment in `ward-movements.ts`.
    // Eleven since 2026-09-02: RF-011 is the seed's one multi-destination referral
    // (`{psychiatric_ward, emergency_department}`, a PERMITTED pair per `ward-referral-visibility.ts`)
    // — added so FD-23 ("a ward cannot see where else a patient has been referred") has a real
    // seeded record to demonstrate against, not only the reducer-built fixture in
    // `tests/ward-referral-visibility.test.ts`.
    expect(state.referrals).toHaveLength(11);
    expect(state.referrals.map((r) => r.id)).toEqual([
      "RF-001",
      "RF-002",
      "RF-003",
      "RF-004",
      "RF-005",
      "RF-006",
      "RF-007",
      "RF-008",
      // The only referral addressed to an emergency department, added 2026-08-30. Without it the
      // ED psychiatry hub held nothing for any department and looked exactly like a correct hub
      // with nothing to show.
      "RF-009",
      // The only referral addressed to a community team and to nothing else, added 2026-09-01 when
      // RF-007 was split. It is the community hub's fixture and the front door's only real join.
      "RF-010",
      // FD-23's multi-destination demonstration fixture, added 2026-09-02 — see the comment above.
      "RF-011",
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
      suburb: { kind: "named", name: "Armadale" },
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
  const COMMUNITY: ReferralDestination = { kind: "community_team", teamName: "Inner City Clinic" };

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
      byKind.get("emergency_department")!.state,
      "the ward accepting must end the other COMPETING ask without anybody coordinating it",
    ).toBe("cancelled");
    /*
     * ⚠️ **CHANGED 2026-09-01, AND IT IS AN EXPECTATION MOVED RATHER THAN A DEFECT FIXED.** This
     * previously asserted `["cancelled", "cancelled"]` — that a ward acceptance ended the community
     * ask too. The owner ruled otherwise, and his definition is the reason: *"Community referral means
     * a patient is about to be discharged"*.
     *
     * **A community team is not in the race FD-22 governs.** FD-22 is about destinations competing for
     * the same PLACEMENT; a follow-up team is about the patient leaving. Cancelling it at the moment a
     * ward said yes was the app cancelling discharge planning exactly when admission was confirmed.
     */
    expect(
      byKind.get("community_team")!.state,
      "a community team is not competing for the bed, so an acceptance does not end it",
    ).toBe("queued");
    expect(referralState(decided)).toBe("accepted");

    // A cancellation is a consequence, not a decision: it has a time, and nobody to attribute it to.
    expect(byKind.get("emergency_department")!.decidedAt).toBe(NOW + 5);
    expect(byKind.get("emergency_department")!.decidedBy, "nobody decided a cancellation").toBeUndefined();
    // The community arm was not decided at all, so it carries neither.
    expect(byKind.get("community_team")!.decidedAt).toBeUndefined();
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
    // Changed 2026-09-01 with the FD-22 test above, same owner ruling and same reason: a community
    // team is not competing for the placement, so no acceptance ends it. The point of THIS test is the
    // declined ward below, which is unaffected.
    expect(byKind.get("community_team")!.state).toBe("queued");
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

describe("what a recorded reason may and may not buy past", () => {
  /**
   * ⚠️ THIS GUARD EXISTS BECAUSE THE HAZARD IT COVERS IS SILENT, AND A COMMENT COULD NOT CATCH IT.
   *
   * `eligibilityRefusal` (the placement path) returns as soon as it sees a valid override reason,
   * without computing the verdict at all. That is safe ONLY while every gate it can refuse on is a
   * judgement. Add a world-fact gate to `SUITABILITY_GATES` and a typed reason silently buys past a
   * physical fact — no test fails, no type breaks, nothing on screen looks wrong.
   *
   * ⚠️ AND ITS TITLE MUST NOT OUTRUN WHAT IT CHECKS. An earlier name — "never lets a world fact
   * become overridable" — promised the bed was protected, and this test cannot deliver that. The
   * realistic edit that lets a reason create a bed is a tidy-up folding the bed and specialling
   * checks into the eligibility verdict; that never touches `SUITABILITY_GATES`, so THIS TEST
   * STAYS GREEN THROUGH IT, under a title claiming the opposite. A green test making a false
   * promise is worse than no test: the next editor is not merely unwarned, they are reassured by
   * something that ran.
   *
   * What actually protects the bed is `tests/ward-physical-facts-are-not-overridable.test.ts`.
   * This test covers one narrower, real edit: somebody putting `allocatable_bed` into
   * `SUITABILITY_GATES` directly. Put it there and this goes red, in the file being edited, at the
   * moment of the edit. Owner's ruling, in his words: no reason typed into a form creates a bed.
   */
  it("never lets `allocatable_bed` become overridable — no reason typed into a form creates a bed", () => {
    // ⚠️ A NAMED NEGATIVE PIN, NOT A DISJOINTNESS CLAIM, and the change of shape is the point.
    // This used to assert SUITABILITY_GATES was disjoint from a hand-written list of world facts.
    // That list only ever shrinks — the owner moved `capacity_freshness` out of it on 2026-09-02 —
    // and a gate added to eligibility() later would not be in it, so disjointness would PASS while
    // the new gate sat unclassified. The guard's strength would rest on a list nobody maintains,
    // which is the shape this whole suite exists to replace. Ward Verifier's shape.
    //
    // A named pin can only ever complain that a gate the OWNER FORBADE has become overridable. It
    // never tries to classify anything new, so it cannot drift as the sets move. And a NEW gate is
    // already safe without it: `referralAcceptanceRefusal` treats anything absent from
    // SUITABILITY_GATES as unbypassable BY CONSTRUCTION — that fail-closed default is doing the
    // work disjointness only appeared to do.
    expect(SUITABILITY_GATES).not.toContain("allocatable_bed");
  });

  it("never lets `specialling` become overridable — staff cannot be conjured by a dropdown either", () => {
    expect(SUITABILITY_GATES).not.toContain("specialling");
  });

  it("still holds the judgement gates it is supposed to, so the pins above are not the whole story", () => {
    // Anti-vacuity: both pins above are satisfied by an EMPTY list, which would make every gate
    // unbypassable and the override feature dead. Something must still be in here.
    for (const gate of ["age", "cohort", "security", "sex_designation", "forensic", "sex_mix"]) {
      expect(SUITABILITY_GATES, `${gate} must remain overridable`).toContain(gate);
    }
    // And the one the owner moved, cited so a future reader knows it was a decision.
    expect(SUITABILITY_GATES, "owner ruling 2026-09-02: a stale bed count is information, not a wall").toContain(
      "capacity_freshness",
    );
  });

  /**
   * ⚠️ `SUITABILITY_GATES` IS THE UNION OF WHAT EITHER PATH CAN ASK, AND ITS NAME DOES NOT SAY SO.
   * Two of its eight members — `age` and `legal_status` — are NEVER evaluated on the movement
   * path. They are referral-path questions (`ward-eligibility.ts` says so in its own words), so on
   * a movement they are neither pass nor fail: they are absent from the question.
   *
   * That is not wrong, but it is looser than it reads — being in the protected set does not imply
   * ever being asked — and it has a consequence nobody would notice. ⚠️ ADD `age` TO
   * `eligibility()` AND IT BECOMES OVERRIDABLE ON THE MOVEMENT PATH IMMEDIATELY, because
   * `eligibilityRefusal` selects failed gates by membership in `SUITABILITY_GATES` and `age` is
   * already there. No decision would be taken, nothing would go red, and the morning tour's
   * scripted step would change its safety without anyone editing the tour.
   *
   * So this pins WHAT EACH PATH ACTUALLY ASKS, measured at runtime rather than parsed. Adding or
   * removing a gate on either side turns this red, which is the moment to decide whether the new
   * gate is a judgement someone may override or a fact they may not. Found by Ward Lead.
   */
  it("pins which questions each path actually asks, so a new gate cannot become overridable unnoticed", () => {
    const state = seeded();
    const movement = state.movements[0];
    const unit = state.units[0];
    const asked = eligibility(movement, unit, NOW).gates.map((gate) => gate.gate);

    expect(
      asked,
      "the PLACEMENT path never asks age or legal_status — it derives the requirement from the " +
        "person's own legalStatus, so those two names belong to the front door",
    ).toEqual([
      "authorisation",
      "cohort",
      "security",
      "sex_designation",
      "forensic",
      "sex_mix",
      "specialling",
      "prior_decline",
      "capacity_freshness",
      "allocatable_bed",
    ]);

    // ⚠️ THE TWO THE MOVEMENT PATH NEVER ASKS — AND IT IS NOT MISSING THEM. READ THIS BEFORE
    // "FIXING" THE ASYMMETRY, BECAUSE THE OBVIOUS FIX IS A DUPLICATE.
    //
    // Both concepts ARE enforced on both paths. They are named differently because a Movement and
    // a Referral store the same fact under different field names:
    //
    //   does the unit suit this person's age band?
    //     placement  `cohort`        unit.cohort === movement.cohort
    //     front door `age`           unit.cohort === referral.ageBand
    //
    //   may this unit hold someone involuntarily?
    //     placement  `authorisation` requiresAuthorisedDestination(movement.legalStatus) -> unit.authorised
    //     front door `legal_status`  ward.involuntaryBedNeeded                           -> unit.authorised
    //
    // So `SUITABILITY_GATES` carries EIGHT NAMES FOR SIX CONCEPTS, which is why three separate
    // chats re-derived "the placement path is missing two gates" from the list and were wrong.
    // ⚠️ Adding `age` to eligibility() would not close a hole; it would ask `cohort`'s question a
    // second time. The assertion below is what fires if someone tries, and this comment is what
    // they should read when it does.
    //
    // One real difference, and it is in the INPUT rather than the gate: placement derives the
    // requirement from the person's own `legalStatus`, the front door from what the referral ASKS
    // for (`involuntaryBedNeeded`). Those can disagree — a referral may not request an involuntary
    // bed for a detained patient. That is a question about the data, not a missing check.
    // The two assertions that stood here could not fire — the `toEqual` above pins the whole list,
    // so "age" and "legal_status" were already known to be absent. The reasoning above is kept as a
    // comment because it is design rationale rather than a failure diagnostic; the omission itself
    // is named in that assertion's message.

    // Anti-vacuity: a helper returning [] would satisfy both `not.toContain` assertions.
    expect(asked.length).toBeGreaterThan(6);

    // ⚠️ THE SECOND PATH, PINNED TOO — AND THE TITLE SAID "EACH" WHILE ONLY ONE WAS PINNED.
    // Found by Ward Builder One reading this test against its own name. Not a safety hole, and
    // that must be said as loudly as the finding: `referralAcceptanceRefusal` fails CLOSED, so a
    // gate absent from `SUITABILITY_GATES` refuses outright before the reason is read. The gap was
    // "nobody is forced to notice a change here", never "it becomes bypassable". A title claiming
    // coverage the assertions do not provide is the same defect as a guard named for a promise it
    // cannot keep — which I renamed one of tonight.
    const ward = referral(state, "RF-001").destinations.find(
      (addressing) => addressing.destination.kind === "psychiatric_ward",
    );
    if (!ward || ward.destination.kind !== "psychiatric_ward") {
      throw new Error("RF-001 must be addressed to a ward for this pin to mean anything");
    }
    const askedAtTheFrontDoor = referralEligibility(referral(state, "RF-001"), ward.destination, unit, NOW).gates.map(
      (gate) => gate.gate,
    );

    expect(
      askedAtTheFrontDoor,
      "the FRONT DOOR never asks authorisation, cohort or prior_decline — each path omits exactly " +
        "what the other's naming covers",
    ).toEqual([
      "age",
      "legal_status",
      "sex_designation",
      "forensic",
      "security",
      "sex_mix",
      "specialling",
      "capacity_freshness",
      "allocatable_bed",
    ]);

    // The two the FRONT DOOR never asks, stated explicitly for the same reason as above — and note
    // they are the mirror image: each path omits exactly what the other's naming covers.
    // Three assertions stood here and none could fire, for the same reason as the placement list
    // above: the `toEqual` pins the whole list. The mirror-image point is kept as a comment; the
    // omissions are named in that assertion's message.
  });
});
