// tests/ward-referral-visibility.test.ts
import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import { REFERRAL_DESTINATION_KINDS } from "../src/components/ward-management/ward-model";
import type {
  Referral,
  ReferralAddressing,
  ReferralAddressingState,
  ReferralDestinationKind,
} from "../src/components/ward-management/ward-model";
import {
  coordinatorScopedReferral,
  coordinatorScopedReferrals,
  coordinatorWorklistReferrals,
  coordinatorWorksReferral,
  referralDestinationDirection,
  wardScopedReferral,
  wardScopedReferrals,
  type WardScopedAddressing,
  type WardScopedReferral,
} from "../src/components/ward-management/ward-referral-visibility";
import { referrals as seededReferrals } from "../src/components/ward-management/ward-movements";
import { referralState } from "../src/components/ward-management/ward-referrals";
import { allEmergencyDepartments, NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/**
 * FD-23, owner 2026-08-30: **a ward cannot see where else a patient has been referred. The
 * coordinator may see everything.** His reason: so a ward does not spend its time on a patient who
 * is being placed elsewhere.
 *
 * This file is the guard the spec (Part 7) demands, and it was written and watched fail BEFORE
 * `ward-referral-visibility.ts` existed. That order is the point: a guard written after the thing
 * it protects is written at the moment its author already believes it works.
 *
 * **Why the rule is encoded as a separate projection rather than a hidden field.** Data that
 * reaches a component can be revealed later by a styling change, a new column or a debug panel.
 * Data a projection never carries cannot be. So the assertions below are about what the projection
 * OBJECT holds, at every level, and never about what a screen chooses to render.
 *
 * **The three properties this file exists to hold, and how each is made non-vacuous:**
 *
 *  1. A ward-scoped projection reaches no other destination's referral data. Checked by a
 *     recursive sweep of every value reachable from the projection root, against markers that a
 *     POSITIVE CONTROL first proves are genuinely present in the full referral. A marker list that
 *     had gone stale would fail the positive control rather than silently pass the sweep.
 *  2. Every level of the projection has its own field-set allowlist. A flat allowlist protects
 *     nothing below the top: this codebase has twice shipped a permitted key holding an unchecked
 *     object, which makes the guard vacuous while it keeps passing and with no diff on the guard
 *     itself. `tests/ward-referral-model.test.ts` already carries three such allowlists (referral,
 *     addressing, arm); these are the same pattern for the projection. The totality assertion —
 *     that the projection contains EXACTLY the three object nodes those allowlists cover and no
 *     fourth anywhere — is what stops a new nested shape arriving unguarded.
 *  3. The fixture really has other destinations to hide. A rule about hiding the others cannot be
 *     tested on a referral that has no others, so the destination count is asserted inside the
 *     sweep helper itself, not only in a standalone test that could be deleted without the leak
 *     tests noticing.
 *
 * The fixture is built through the reducer's own write path (`RECEIVE_REFERRAL` →
 * `DECLINE_REFERRAL` → `ACCEPT_REFERRAL`), never hand-assembled, so the states it holds are states
 * the live system actually produces — including the FD-22 cancellation the third destination
 * receives when the second accepts.
 */

const RAISED_AT = NOW_ANCHOR;
/** The ward's OWN decision time. Permitted in the projection — it is this destination's own fact. */
const WARD_DECIDED_AT = NOW_ANCHOR + 11;
/** Somebody else's decision time. Must never be reachable from a ward-scoped projection. */
const ELSEWHERE_DECIDED_AT = NOW_ANCHOR + 23;

/**
 * A referral addressed to all three destinations at once (FD-21), where the ward has DECLINED and
 * an emergency department has since ACCEPTED — which cancels the community team (FD-22).
 *
 * Chosen so the ward's own addressing state (`declined`) differs from the referral's overall state
 * (`accepted`). A projection that leaked the derived overall state would therefore be telling the
 * ward the patient has been placed, which is exactly the thing FD-23 forbids, and a fixture where
 * the two states coincided could not tell the difference.
 */
function multiDestinationReferral(): Referral {
  const received = wardFlowReducer(seedWardFlowState(), {
    type: "RECEIVE_REFERRAL",
    role: "community",
    now: RAISED_AT,
    ageBand: "Adult",
    destinations: [
      { kind: "psychiatric_ward", sex: "Female", secureBedNeeded: false, involuntaryBedNeeded: false },
      // A real department and a real purpose, not `{ kind }`. This fixture was one of the three
      // type errors that stopped the branch compiling when the ED arm gained `edId` and `purpose`,
      // and it is repaired the way the intake form was rather than with a cast: the department is
      // read out of the network, and the purpose is the one a community referral asking for a bed
      // actually carries. A stub `edId: ""` would have compiled and would have made this fixture
      // assert leak-hiding about a department that does not exist.
      { kind: "emergency_department", edId: allEmergencyDepartments()[0].id, purpose: "bed" },
      { kind: "community_team", teamName: "Inner City Clinic" },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    source: "community",
    urgency: 2,
    originSiteCode: "RPH",
    transportNeeded: false,
  });
  expect(received.rejections, "the reducer refused the three-destination referral this file needs").toEqual([]);
  const created = received.referrals.at(-1)!;

  const declined = wardFlowReducer(received, {
    type: "DECLINE_REFERRAL",
    role: "ward",
    now: WARD_DECIDED_AT,
    referralId: created.id,
    destinationKind: "psychiatric_ward",
    reason: "no_suitable_bed",
  });
  expect(declined.rejections, "the reducer refused the ward's own decline").toEqual([]);

  /*
   * ⚠️ **THE COMMUNITY TEAM ACCEPTS, NOT THE EMERGENCY DEPARTMENT — CHANGED 2026-09-01, AND IT IS
   * LOAD-BEARING RATHER THAN COSMETIC.**
   *
   * At the time this fixture was reshaped, it needed to contain a destination in state `cancelled`,
   * because the positive control below asserted every `ELSEWHERE_MARKERS` marker was present in the
   * full referral — without one, the absence sweep could not fail and proved nothing.
   *
   * It used to be the community arm that cancelled when the ED accepted. The owner then ruled that a
   * community team is never cancelled by somebody else's acceptance (*"Community referral means a
   * patient is about to be discharged"*), so nothing cancelled any more and **the positive control
   * fired — correctly, refusing to let the sweep pass vacuously.**
   *
   * Swapping which destination answers restored a real cancellation while keeping all three
   * destination KINDS and their exact field shapes. **Two alternatives were tried and rejected:** a
   * fourth destination is refused by `PARALLEL_REFERRAL_CAP` (3), and replacing the community arm with
   * a second emergency department broke the field-set allowlists, because an ED arm carries `edId` and
   * `purpose` where a community arm carries `teamName`.
   *
   * ⚠️ **THAT WAS THE FIX FOR ONE CANCELLATION ROUTE. IT DID NOT SURVIVE THE NEXT RULING, AND
   * `"cancelled"` HAS SINCE MOVED OFF THIS FIXTURE ENTIRELY — WHICH IS A SEPARATE MOVE, NOT A REVERSAL
   * OF THIS ONE.** Owner ruling 2 (2026-09-01) — an acceptance of a `leaving` destination cancels
   * nothing — removes this fixture's COORDINATOR-ACCEPTS-COMMUNITY route to `cancelled` too, the
   * moment Ward Lead's reducer change lands. Reshaping this fixture a third time to chase that would
   * repeat the same trap this comment already warns against. Instead `"cancelled"` was split into its
   * own marker set, `CANCELLED_ELSEWHERE_MARKERS`, over its own small fixture (`cancelledArmReferral()`,
   * defined below `ELSEWHERE_MARKERS`) built on a route that survives the change: a WARD accepting is
   * `arriving`, which the ruling never exempts. **This fixture no longer needs to reach `cancelled` at
   * all** — it still does today, incidentally, but nothing here depends on that any more. Deleting
   * `"cancelled"` outright, with nothing replacing it, would still be weakening the privacy sweep;
   * relocating it to a fixture that does not go stale is not that.
   *
   * The scenario THIS fixture exists for is unchanged in substance: the ward said no, somebody else
   * has since said yes, and a third ask ended as a consequence.
   */
  const accepted = wardFlowReducer(declined, {
    type: "ACCEPT_REFERRAL",
    role: "coordinator",
    now: ELSEWHERE_DECIDED_AT,
    destinationKind: "community_team",
    referralId: created.id,
  });
  expect(accepted.rejections, "the reducer refused the acceptance elsewhere").toEqual([]);

  return accepted.referrals.find((referral) => referral.id === created.id)!;
}

/**
 * Facts that belong to a destination OTHER than the ward's, in the fixture above. If any of these
 * is reachable from a ward-scoped projection, the ward can see where else this patient has been
 * referred — by name, by state, by decider, by time, or by count.
 *
 * **The destination COUNT is not on this list, and the positive control below is what established
 * that it must not be.** `3` was on it in the first draft. The control failed: the count is derived
 * (`destinations.length`), never a value stored anywhere in the referral, so "it is present in the
 * full record" is not true of it and a sweep for it could never be shown to bite. "Referred to 3
 * places" is still a leak and is still guarded — by its own test below, which computes the count
 * from the fixture and asserts no primitive in the projection equals it. The fixture is built so no
 * legitimate value in the projection is `3`: urgency is `2`, `NOW_ANCHOR` is 642, and no other
 * field holds a small integer.
 *
 * **`"cancelled"` is deliberately NOT on this list any more — split out 2026-09-01, owner ruling 2:
 * an acceptance of a `leaving` destination cancels nothing.** Ward Lead's reducer change to
 * implement that ruling removes this fixture's only route to a cancelled arm — a coordinator
 * accepting the `community_team` arm, which today cancels the queued ED arm and after the change
 * cancels nothing at all. Leaving `"cancelled"` on this list would make the positive control below
 * go red the day that change lands, on a fixture that can no longer prove the marker. One marker set
 * was doing two jobs — proving the ward-declined privacy case here AND proving the cancelled state is
 * hidden — so the two are separated: `CANCELLED_ELSEWHERE_MARKERS` below, over its own small
 * reducer-built fixture, now carries that coverage on a route (a WARD accepting) that stays a
 * cancellation both before and after the reducer change.
 */
const ELSEWHERE_MARKERS: readonly (string | number)[] = [
  "emergency_department",
  "community_team",
  "accepted",
  "Flow coordinator",
  ELSEWHERE_DECIDED_AT,
];

/**
 * A referral to a psychiatric ward and an emergency department, where the WARD accepts.
 *
 * **Why this fixture exists, split out of `multiDestinationReferral()` above.** Owner ruling 2,
 * 2026-09-01: an acceptance of a `leaving` destination (a community team) cancels nothing. Once Ward
 * Lead's reducer change implements that, `multiDestinationReferral()`'s only route to a cancelled arm
 * — a coordinator accepting the community arm — stops producing one, so `"cancelled"` needs a fixture
 * that does not depend on that route at all.
 *
 * **Why a WARD acceptance, specifically — the property that makes this fixture survive the change it
 * is being split ahead of.** Direction (`arriving` vs `leaving`, see `referralDestinationDirection`
 * below) is exactly what ruling 2 turns on, and a ward is `arriving`. The ruling exempts a `leaving`
 * acceptance from cancelling; it says nothing about an `arriving` one. So a ward accepting cancels a
 * queued ED arm in the reducer AS IT STANDS TODAY, and it still cancels that arm AFTER Ward Lead's
 * change lands — the accepting arm here is `arriving` either way. This fixture is not a
 * before-the-change snapshot to be thrown away once the change ships; it is the route chosen because
 * it does not go stale when that change does.
 */
function cancelledArmReferral(): Referral {
  const received = wardFlowReducer(seedWardFlowState(), {
    type: "RECEIVE_REFERRAL",
    role: "community",
    now: RAISED_AT,
    ageBand: "Youth",
    destinations: [
      { kind: "psychiatric_ward", sex: "Female", secureBedNeeded: false, involuntaryBedNeeded: false },
      { kind: "emergency_department", edId: allEmergencyDepartments()[0].id, purpose: "bed" },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    source: "community",
    urgency: 2,
    originSiteCode: "RPH",
    transportNeeded: false,
  });
  expect(received.rejections, "the reducer refused the two-destination referral this fixture needs").toEqual([]);
  const created = received.referrals.at(-1)!;

  const accepted = wardFlowReducer(received, {
    type: "ACCEPT_REFERRAL",
    role: "ward",
    now: WARD_DECIDED_AT,
    referralId: created.id,
    destinationKind: "psychiatric_ward",
    unitId: "bty-youth",
  });
  expect(accepted.rejections, "the reducer refused the ward's own acceptance").toEqual([]);

  return accepted.referrals.find((referral) => referral.id === created.id)!;
}

/**
 * Facts that belong to the emergency department arm in `cancelledArmReferral()` above — the
 * `"cancelled"` coverage split out of `ELSEWHERE_MARKERS`, for the reason documented there.
 *
 * Unlike `ELSEWHERE_MARKERS`, there is no elsewhere DECIDER to guard here: the cancellation this
 * fixture produces is automatic and writes no `decidedBy` at all (see `ACCEPT_REFERRAL` in
 * `ward-flow-reducer.ts`). And the cancelled arm's `decidedAt` is deliberately not a marker either:
 * it is written from the SAME event as the ward's own acceptance, so it equals the ward's own
 * `decidedAt` — a value that legitimately belongs in the ward-scoped projection, not a leak.
 */
const CANCELLED_ELSEWHERE_MARKERS: readonly (string | number)[] = [
  "emergency_department",
  "cancelled",
  "bed",
  allEmergencyDepartments()[0].id,
];

type Sweep = {
  /** Every key name found, at any depth. */
  keys: string[];
  /** Every string/number/boolean value found, at any depth. */
  primitives: (string | number | boolean)[];
  /** The dotted path of every object or array node, root first (the root's own path is `""`). */
  objectPaths: string[];
};

/**
 * Every value reachable from `root`, transitively, with the path of every object node it passes
 * through.
 *
 * Recursive rather than a single `Object.keys` pass, because the defect this whole file exists to
 * prevent is a permitted key holding an unchecked object. A flat sweep would report the projection
 * as clean while `addressing.context.referral` sat two levels below it holding everything.
 */
function sweep(root: unknown): Sweep {
  const keys: string[] = [];
  const primitives: (string | number | boolean)[] = [];
  const objectPaths: string[] = [];
  const seen = new Set<object>();

  const walk = (node: unknown, path: string): void => {
    if (node === null || node === undefined) return;
    if (typeof node === "string" || typeof node === "number" || typeof node === "boolean") {
      primitives.push(node);
      return;
    }
    if (typeof node !== "object") return;
    if (seen.has(node)) return;
    seen.add(node);
    objectPaths.push(path);
    if (Array.isArray(node)) {
      node.forEach((entry, index) => walk(entry, `${path}[${index}]`));
      return;
    }
    for (const [key, entry] of Object.entries(node as Record<string, unknown>)) {
      keys.push(key);
      walk(entry, path === "" ? key : `${path}.${key}`);
    }
  };

  walk(root, "");
  return { keys, primitives, objectPaths };
}

/**
 * The non-vacuity precondition, checked HERE rather than only in a standalone test.
 *
 * A leak sweep over a referral with one destination proves nothing at all — there is nothing to
 * hide, so every marker is absent for the wrong reason. Putting the check inside the helper every
 * leak assertion calls means the leak tests cannot be made vacuous by deleting a test elsewhere in
 * this file.
 */
function assertFixtureHasOthers(referral: Referral): ReferralAddressing[] {
  expect(
    referral.destinations.length,
    "FD-23 is a rule about hiding the OTHER destinations. A fixture with one destination has none, " +
      "so every leak assertion below would pass for the wrong reason.",
  ).toBeGreaterThan(1);
  const others = referral.destinations.filter((addressing) => addressing.destination.kind !== "psychiatric_ward");
  expect(others.length, "the fixture holds no non-ward destination to hide").toBeGreaterThan(0);
  return others;
}

/** The permitted fields on a ward-scoped projection — LEVEL 1. */
const ALLOWED_WARD_PROJECTION_FIELDS = [
  "id",
  "ageBand",
  "homeRegion",
  "source",
  "raisedAt",
  "urgency",
  "originSiteCode",
  "transportNeeded",
  // Singular, and that is the whole rule in one key name: a ward sees the one addressing that is
  // its own. `destinations` — the plural the full `Referral` carries — must never appear here.
  "addressing",
].sort();

/** The permitted fields on the ward's own addressing — LEVEL 2. Where the decision lives. */
const ALLOWED_WARD_ADDRESSING_FIELDS = [
  "destination",
  "state",
  "decidedAt",
  "decidedBy",
  "declineReason",
  "acceptedUnitId",
].sort();

/**
 * The permitted fields on the ward arm itself — LEVEL 3. Identical to the arm allowlist in
 * `tests/ward-referral-model.test.ts`, because the projection carries the arm unchanged: a ward
 * being asked about a bed still needs the bed criteria it is being asked about.
 */
const ALLOWED_WARD_DESTINATION_FIELDS = ["kind", "sex", "secureBedNeeded", "involuntaryBedNeeded"].sort();

/**
 * The three object nodes a ward-scoped projection is made of, and there are no others.
 *
 * This is the assertion that makes the three allowlists above TOTAL. Without it, a fourth nested
 * object introduced later would sit below every allowlist and be checked by none of them — the
 * exact shape of the two vacuous guards this codebase has already shipped.
 */
const WARD_PROJECTION_OBJECT_PATHS = ["", "addressing", "addressing.destination"];

describe("FD-23 — a ward cannot see where else a patient has been referred", () => {
  describe("the fixture, and whether it can test the rule at all", () => {
    it("really carries more than one destination, with the ward's own state differing from the referral's", () => {
      const referral = multiDestinationReferral();
      const others = assertFixtureHasOthers(referral);
      expect(referral.destinations.length).toBe(3);
      expect(others.map((addressing) => addressing.destination.kind).sort()).toEqual([
        "community_team",
        "emergency_department",
      ]);
      // The ward said no; somebody else has since said yes. A projection that leaked the referral's
      // own derived state would be telling the ward the patient is placed.
      const ward = referral.destinations.find((addressing) => addressing.destination.kind === "psychiatric_ward")!;
      expect(ward.state).toBe("declined");
      expect(referralState(referral)).toBe("accepted");
    });

    it("positive control — every marker really is present in the full referral, so absence in the projection means something", () => {
      const referral = multiDestinationReferral();
      const full = sweep(referral);
      const reachable = new Set<string | number | boolean>(full.primitives);
      for (const marker of ELSEWHERE_MARKERS) {
        expect(
          reachable.has(marker),
          `${JSON.stringify(marker)} is not present in the full referral, so the leak sweep below ` +
            "cannot fail on it. The marker list has gone stale — fix the list, not the sweep.",
        ).toBe(true);
      }
    });

    it("positive control (cancelled fixture) — every CANCELLED_ELSEWHERE_MARKERS marker really is present in the full referral", () => {
      const referral = cancelledArmReferral();
      const full = sweep(referral);
      const reachable = new Set<string | number | boolean>(full.primitives);
      for (const marker of CANCELLED_ELSEWHERE_MARKERS) {
        expect(
          reachable.has(marker),
          `${JSON.stringify(marker)} is not present in the full referral, so the leak sweep below ` +
            "cannot fail on it. The marker list has gone stale — fix the list, not the sweep.",
        ).toBe(true);
      }
    });

    it("⚠️ THE SEED CAN NOW TEST THIS RULE — a real seeded referral proves the leak sweep, not only the reducer-built one", () => {
      /*
       * ⚠️ **THIS ASSERTION HAS FIRED IN THREE DIRECTIONS NOW, WHICH IS THE POINT OF WRITING IT
       * DOWN AT ALL.** It began as `every(referral => destinations.length === 1)`, recording that
       * the shipped seed had no multi-destination referral and so could prove the field sets below
       * but never the leak. `RF-007` gained a community-team arm on 2026-08-31 and it went red; the
       * claim was replaced with `> 0`. `RF-007` was SPLIT on 2026-09-01 (owner rulings 13/14:
       * `{psychiatric_ward, community_team}` cannot occur, so the arm moved to `RF-010` alone) and
       * the seed lost its only multi-destination referral again — the claim went back to `toBe(0)`
       * and the gap was recorded rather than absorbed.
       *
       * ⚠️ **CLOSED, 2026-09-02: `RF-011` carries `{psychiatric_ward, emergency_department}`** — a
       * PERMITTED pair, named as such in `ward-referral-visibility.ts`'s own doc comment, and never
       * the forbidden `{psychiatric_ward, community_team}` shape `RF-007` was split away from. The
       * expectation below is now `toBeGreaterThan(0)` and stays that way as long as the seed keeps a
       * multi-destination referral — if this ever reads `0` again, the seed has lost that fixture
       * a fourth time and this comment needs the same correction as before, not silent deletion.
       *
       * The reducer-built fixture (`multiDestinationReferral`, above) stays and is still the only
       * one shaped to order — several DECIDED destinations, chosen markers, exercising FD-22's
       * cancel-on-acceptance path. `RF-011` deliberately leaves both arms `queued`: it exists to
       * prove the privacy boundary holds on a real record that ships in the demo, not to re-cover
       * ground the reducer-built fixture already covers.
       */
      const multi = seededReferrals.filter((referral) => referral.destinations.length > 1);
      expect(
        multi.length,
        "the seed's multi-destination referral (RF-011) is missing or was reduced to one " +
          "destination. If a seeded referral now carries {psychiatric_ward, community_team} that " +
          "combination is FORBIDDEN (owner rulings 13/14) and the fixture is the bug; if the seed " +
          "has no multi-destination referral at all, FD-23 is untestable against real seeded data " +
          "again and the gap this test once recorded is back — see the comment above.",
      ).toBeGreaterThan(0);

      // RF-011 by name: the coordinator sees every destination this referral was sent to, and a
      // ward sees only its own — the two projections FD-23 exists to keep apart, over the actual
      // fixture the demo ships rather than only a fixture this test built for the purpose.
      const rf011 = multi.find((referral) => referral.id === "RF-011");
      expect(rf011, "RF-011 — the seeded {psychiatric_ward, emergency_department} referral — is missing").toBeDefined();
      const coordinatorView = coordinatorScopedReferral(rf011!);
      expect(coordinatorView.destinations.map((addressing) => addressing.destination.kind).sort()).toEqual([
        "emergency_department",
        "psychiatric_ward",
      ]);
      const wardView = wardScopedReferral(rf011!);
      expect(wardView, "RF-011 is addressed to a ward, so a ward view must exist").toBeDefined();
      expect(Object.keys(wardView!)).not.toContain("destinations");
      const edArm = rf011!.destinations.find((addressing) => addressing.destination.kind === "emergency_department")!;
      const edValues = Object.values(edArm.destination);
      const seenByWard = sweep(wardView).primitives;
      for (const value of edValues) {
        expect(
          seenByWard.includes(value as string),
          `RF-011: a ward can see ${JSON.stringify(value)} from the emergency-department arm, which ` +
            "is not its own. FD-23 — a ward may not see where else this patient was referred.",
        ).toBe(false);
      }

      // And the rule itself, against every multi-destination referral the seed holds — a loop over
      // exactly RF-011 today, and a real check against any further fixture added later.
      for (const referral of multi) {
        const scoped = wardScopedReferral(referral);
        expect(scoped, `${referral.id} is addressed to a ward, so a ward view must exist`).toBeDefined();
        const seen = sweep(scoped).primitives;
        for (const other of referral.destinations.filter((a) => a.destination.kind !== "psychiatric_ward")) {
          for (const value of Object.values(other.destination)) {
            expect(
              seen.includes(value as string),
              `${referral.id}: a ward can see ${JSON.stringify(value)} from a destination that is ` +
                "not its own. FD-23 — a ward may know its own referral ended; it may not know where else " +
                "the patient was sent.",
            ).toBe(false);
          }
        }
      }
    });
  });

  describe("the ward-scoped projection", () => {
    it("is not empty, and has exactly the permitted field set at level 1", () => {
      const projection = wardScopedReferral(multiDestinationReferral());
      expect(projection).toBeDefined();
      expect(Object.keys(projection!).length).toBeGreaterThan(0);
      expect(Object.keys(projection!).sort()).toEqual(ALLOWED_WARD_PROJECTION_FIELDS);
    });

    it("has exactly the permitted field set at level 2 (the addressing) and level 3 (the arm)", () => {
      const projection = wardScopedReferral(multiDestinationReferral())!;
      // Subset, not equality, at level 2: the optional decision fields are only present once a
      // decision exists. The exhaustive half is the `Required<>` literal below.
      for (const key of Object.keys(projection.addressing)) {
        expect(ALLOWED_WARD_ADDRESSING_FIELDS, `the ward addressing carries "${key}"`).toContain(key);
      }
      expect(Object.keys(projection.addressing.destination).sort()).toEqual(ALLOWED_WARD_DESTINATION_FIELDS);
    });

    it("a fully-populated projection (every optional field set) has exactly the allowed field set at every level", () => {
      // TYPE-CHECKED half: `Required<>` forces every field the type has, so a field added to the
      // projection and left off this literal stops compiling. Vitest does not typecheck, which is
      // why the runtime halves above and below exist alongside it.
      const addressing: Required<WardScopedAddressing> = {
        destination: { kind: "psychiatric_ward", sex: "Female", secureBedNeeded: false, involuntaryBedNeeded: false },
        state: "declined",
        decidedAt: WARD_DECIDED_AT,
        decidedBy: "Ward manager",
        declineReason: "no_suitable_bed",
        acceptedUnitId: "rph-adult-secure",
      };
      const canonical: Required<WardScopedReferral> = {
        id: "REF-CANON",
        ageBand: "Adult",
        homeRegion: "Perth Metropolitan",
        source: "community",
        raisedAt: RAISED_AT,
        urgency: 2,
        originSiteCode: "RPH",
        transportNeeded: false,
        addressing,
      };
      expect(Object.keys(canonical).sort()).toEqual(ALLOWED_WARD_PROJECTION_FIELDS);
      expect(Object.keys(canonical.addressing).sort()).toEqual(ALLOWED_WARD_ADDRESSING_FIELDS);
      expect(Object.keys(canonical.addressing.destination).sort()).toEqual(ALLOWED_WARD_DESTINATION_FIELDS);
    });

    it("is made of exactly three object nodes, so no level exists that no allowlist covers", () => {
      const projection = wardScopedReferral(multiDestinationReferral())!;
      expect(sweep(projection).objectPaths.sort()).toEqual([...WARD_PROJECTION_OBJECT_PATHS].sort());
    });

    it("carries no key, at any depth, that its own level's allowlist does not permit", () => {
      const projection = wardScopedReferral(multiDestinationReferral())!;
      const permitted = new Set([
        ...ALLOWED_WARD_PROJECTION_FIELDS,
        ...ALLOWED_WARD_ADDRESSING_FIELDS,
        ...ALLOWED_WARD_DESTINATION_FIELDS,
      ]);
      const found = sweep(projection).keys;
      expect(found.length).toBeGreaterThan(ALLOWED_WARD_PROJECTION_FIELDS.length);
      for (const key of found) {
        expect(permitted.has(key), `the ward projection carries a key no allowlist permits: "${key}"`).toBe(true);
      }
    });

    it("reaches no other destination's referral data, at any depth", () => {
      const referral = multiDestinationReferral();
      assertFixtureHasOthers(referral);
      const projection = wardScopedReferral(referral)!;
      const found = sweep(projection);
      expect(found.primitives.length, "the sweep visited nothing — it is not reading the projection").toBeGreaterThan(
        5,
      );
      const reachable = new Set<string | number | boolean>(found.primitives);
      for (const marker of ELSEWHERE_MARKERS) {
        expect(
          reachable.has(marker),
          `a ward-scoped projection reaches ${JSON.stringify(marker)}, which belongs to a destination ` +
            "that is not this ward's. FD-23: a ward cannot see where else a patient has been referred.",
        ).toBe(false);
      }
    });

    it("reaches no other destination's referral data (cancelled fixture), at any depth", () => {
      const referral = cancelledArmReferral();
      assertFixtureHasOthers(referral);
      const projection = wardScopedReferral(referral)!;
      const found = sweep(projection);
      expect(found.primitives.length, "the sweep visited nothing — it is not reading the projection").toBeGreaterThan(
        5,
      );
      const reachable = new Set<string | number | boolean>(found.primitives);
      for (const marker of CANCELLED_ELSEWHERE_MARKERS) {
        expect(
          reachable.has(marker),
          `a ward-scoped projection reaches ${JSON.stringify(marker)}, which belongs to a destination ` +
            "that is not this ward's. FD-23: a ward cannot see where else a patient has been referred.",
        ).toBe(false);
      }
    });

    it("carries no count of the other destinations — 'referred to 3 places' is itself a leak", () => {
      const referral = multiDestinationReferral();
      assertFixtureHasOthers(referral);
      const projection = wardScopedReferral(referral)!;
      const found = sweep(projection);
      expect(
        found.primitives.includes(referral.destinations.length),
        `the projection holds the number ${referral.destinations.length}, which is exactly how many ` +
          "places this patient was referred to. A count names nobody and still tells a ward the " +
          "patient is being worked elsewhere.",
      ).toBe(false);
      for (const key of found.keys) {
        expect(key, "a key that could only hold a fact about the other destinations").not.toMatch(
          /destinations|others|elsewhere|count|total/i,
        );
      }
    });

    it("carries the ward's OWN decision — its state, its reason, its time — because that is not a leak", () => {
      const projection = wardScopedReferral(multiDestinationReferral())!;
      expect(projection.addressing.state).toBe("declined");
      expect(projection.addressing.declineReason).toBe("no_suitable_bed");
      expect(projection.addressing.decidedAt).toBe(WARD_DECIDED_AT);
      expect(projection.addressing.destination.kind).toBe("psychiatric_ward");
    });

    it("holds every referral in the shipped seed to the same field sets", () => {
      const projections = wardScopedReferrals(seededReferrals);
      expect(projections.length).toBeGreaterThan(0);
      for (const projection of projections) {
        expect(Object.keys(projection).sort()).toEqual(ALLOWED_WARD_PROJECTION_FIELDS);
        expect(sweep(projection).objectPaths.sort()).toEqual([...WARD_PROJECTION_OBJECT_PATHS].sort());
      }
    });
  });

  describe("the coordinator's view is a different projection, not the same one with a flag", () => {
    it("carries every destination, which is the difference", () => {
      const referral = multiDestinationReferral();
      const coordinator = coordinatorScopedReferral(referral);
      expect(coordinator.destinations.length).toBe(referral.destinations.length);
      expect(coordinator.destinations.map((addressing) => addressing.destination.kind).sort()).toEqual([
        "community_team",
        "emergency_department",
        "psychiatric_ward",
      ]);
      expect(coordinator.state).toBe("accepted");
    });

    it("the ward projection carries no flag, role or scope field that could widen it", () => {
      const projection = wardScopedReferral(multiDestinationReferral())!;
      for (const key of sweep(projection).keys) {
        expect(key, "a switch on the projection is how the two views become one view with a flag").not.toMatch(
          /role|scope|coordinator|reveal|full|redact|hidden|visib/i,
        );
      }
      // And the one field that separates them is genuinely absent, not merely undefined.
      expect(Object.keys(projection)).not.toContain("destinations");
      expect(Object.keys(projection)).not.toContain("state");
    });
  });
});

/**
 * THE COORDINATOR'S WORK LIST — a different question from FD-23, answered beside it.
 *
 * **Owner ruling, 2026-09-01, verbatim: "Any referrals to community Do NOT need to be flagged in
 * the coordinators screen."** His reason: a community referral is *discharge planning* — the
 * patient is leaving. It is not a rival bed offer and it is not part of bed-matching.
 *
 * **The criterion is DIRECTION, and the seed holds the case that proves it is not something
 * simpler.** A referral is the coordinator's work while a live destination is still UPSTREAM of the
 * bed decision, and stops being it once the live ones are all downstream. `RF-009` asks for no ward
 * bed at all — one emergency-department destination, purpose `psychiatric_review` — and the owner
 * ruled it STAYS VISIBLE. So the rule cannot be "the referral asks for no bed": that criterion
 * removes RF-009 too, and it is wrong.
 *
 * **The rule reads the LIVE arms, not merely the kinds.** A referral whose ward arm is DECLINED and
 * whose community arm is still QUEUED has no bed question left to answer — every ward that could
 * have taken the patient has said no, and the only live arm is the community follow-up. A kind-only
 * rule keeps that row in the bed-matching queue, presented as somebody awaiting a bed. It is
 * exactly the class the ruling exists to remove, and the seed contains no example of it, so the
 * fixtures below are built.
 *
 * **Why this is a second function and not a filter inside `coordinatorScopedReferrals`.** FD-23
 * (2026-08-30) answers *which FIELDS a viewer may see of a referral*, and its answer for the
 * coordinator is "everything". This ruling answers *which REFERRALS belong in the coordinator's
 * work list*. Filtering the FD-23 projection would silently invert a standing ruling, so the
 * regression guard at the bottom of this block holds `coordinatorScopedReferrals` to returning
 * every referral, community-only ones included.
 */
describe("the coordinator's work list — direction of the LIVE destinations", () => {
  /**
   * A hand-built referral, used for the shapes the seed does not hold and for the empty
   * destination list the reducer refuses to create. Every non-destination field is a value the seed
   * itself already uses, so nothing clinical is invented here.
   */
  function localReferral(id: string, destinations: ReferralAddressing[]): Referral {
    return {
      id,
      destinations,
      ageBand: "Adult",
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Armadale" },
      source: "community",
      raisedAt: RAISED_AT,
      urgency: 2,
      originSiteCode: "RPH",
      transportNeeded: false,
    };
  }

  /** One addressing of the given kind in the given state. The reducer refuses the same kind twice
   *  (`RECEIVE_REFERRAL cannot address the same destination kind twice`), so a set of kinds plus
   *  their states really is the whole input this rule reads. */
  function arm(kind: ReferralDestinationKind, state: ReferralAddressingState): ReferralAddressing {
    switch (kind) {
      case "psychiatric_ward":
        return {
          destination: { kind: "psychiatric_ward", sex: "Female", secureBedNeeded: false, involuntaryBedNeeded: false },
          state,
        };
      case "emergency_department":
        return {
          destination: { kind: "emergency_department", edId: allEmergencyDepartments()[0].id, purpose: "bed" },
          state,
        };
      case "community_team":
        return { destination: { kind: "community_team", teamName: "Inner City Clinic" }, state };
    }
  }

  /** A seeded referral, found by id and proved to exist — a `find` returning `undefined` must fail
   *  loudly here rather than let the assertions below pass vacuously. */
  function seeded(id: string): Referral {
    const referral = seededReferrals.find((candidate) => candidate.id === id);
    expect(
      referral,
      `${id} is one of the cases this rule turns on and it is no longer in the seed. Do not ` +
        "hand-build a replacement — find out what happened to it.",
    ).toBeDefined();
    return referral!;
  }

  describe("direction is a property of the destination kind, decided once", () => {
    it("a ward and an emergency department are ARRIVING; a community team is LEAVING", () => {
      // The owner's criterion in three lines. `psychiatric_review` at an ED is still arriving —
      // somebody is in a department waiting on a psychiatry decision — which is why RF-009 stays.
      expect(referralDestinationDirection("psychiatric_ward")).toBe("arriving");
      expect(referralDestinationDirection("emergency_department")).toBe("arriving");
      expect(referralDestinationDirection("community_team")).toBe("leaving");
    });

    it("every destination kind the model has is given a direction", () => {
      // Not a restatement of the test above: this one fails if a fourth kind is added to
      // `REFERRAL_DESTINATION_KINDS` and left out of the switch. The compile error is the primary
      // guard; this is the one that still bites when nobody runs `tsc`.
      for (const kind of REFERRAL_DESTINATION_KINDS) {
        expect(["arriving", "leaving"], `${kind} has no direction`).toContain(referralDestinationDirection(kind));
      }
    });
  });

  it("⚠️ THE INVARIANT — RF-009 stays and a community-only referral goes, and only the PAIR proves the rule", () => {
    /*
     * Both halves in one test, because either half alone passes against a rule that is WRONG:
     *
     *   - "the referral asks for no bed" also removes a community-only referral, so the absence
     *     half alone cannot tell that wrong rule apart from the right one — and it would also
     *     remove RF-009, which the owner ruled must stay.
     *   - "it is a referral" also keeps RF-009, so the presence half alone proves nothing either.
     *
     * Only DIRECTION — upstream of the bed decision versus past it — keeps RF-009 and drops the
     * community-only referral at the same time.
     */
    const rf009 = seeded("RF-009");
    // Asserted against the real record rather than assumed: RF-009 is ED-only and queued, and asks
    // for no ward bed. If the seed changes shape this says so, instead of quietly testing
    // something else.
    expect(rf009.destinations.map((addressing) => addressing.destination.kind)).toEqual(["emergency_department"]);
    expect(rf009.destinations[0].state).toBe("queued");

    const communityOnly = localReferral("RF-LOCAL-COMMUNITY-ONLY", [arm("community_team", "queued")]);
    const ids = coordinatorWorklistReferrals([...seededReferrals, communityOnly]).map((entry) => entry.id);

    expect(
      ids,
      "RF-009 asks for no ward bed and the owner ruled it STAYS. A rule keyed on 'asks for no bed' " +
        "would drop it — the criterion is direction, never 'asks for no bed'.",
    ).toContain("RF-009");
    expect(
      ids,
      "a referral addressed only to a community team is discharge planning: the patient has already " +
        "passed the bed question, so it is not the coordinator's work.",
    ).not.toContain("RF-LOCAL-COMMUNITY-ONLY");
  });

  describe("⚠️ THE PARTIALLY RESOLVED CASES — a declined arm's KIND stops mattering once it is declined", () => {
    /*
     * Neither case below exists in the seed, and both are two clicks away at runtime: declines are
     * per-addressing, so a ward answering "no" on a ward+community referral produces Case A
     * immediately. A rule that read only the destination KINDS would keep both visible, and every
     * seeded fixture would have agreed with it — which is why these are built by hand rather than
     * looked for.
     */
    it("CASE A — ward DECLINED, community still queued: HIDDEN, because no bed question is left to answer", () => {
      const caseA = localReferral("RF-LOCAL-CASE-A", [
        arm("psychiatric_ward", "declined"),
        arm("community_team", "queued"),
      ]);
      // `referralState` still reads "queued" here — one declined arm is not a declined referral
      // (FD-24) — so without this rule the row sits in the bed-matching queue presented as somebody
      // awaiting a bed, when the only live arm is the community follow-up.
      expect(referralState(caseA)).toBe("queued");
      expect(coordinatorWorksReferral(caseA)).toBe(false);
      expect(coordinatorWorklistReferrals([caseA]).length).toBe(0);
    });

    it("CASE B — ward DECLINED, community ACCEPTED: HIDDEN, because the accepted arm IS the outcome", () => {
      const caseB = localReferral("RF-LOCAL-CASE-B", [
        arm("psychiatric_ward", "declined"),
        arm("community_team", "accepted"),
      ]);
      expect(referralState(caseB)).toBe("accepted");
      expect(coordinatorWorksReferral(caseB)).toBe(false);
      expect(coordinatorWorklistReferrals([caseB]).length).toBe(0);
    });
  });

  it("⚠️ THE SEQUENCE — an {ED, community} referral LEAVES the work list and RETURNS, and it is RULED", () => {
    /*
     * ⚠️ **A READER MEETING THIS IN THE APP IS SEEING A RULE WORK, NOT A GLITCH.** One referral
     * walked through three states, each verdict following from the direction principle applied to
     * whatever is live at that moment:
     *
     *   both arms queued        live = {ED, community}  → VISIBLE (somebody is in a department
     *                                                              awaiting a psychiatry decision)
     *   ED arm declined         live = {community}      → HIDDEN  (the only live arm is a discharge
     *                                                              follow-up; they are on their way out)
     *   community declines too  live = {}               → VISIBLE (nobody took them, so they are
     *                                                              back in play)
     *
     * Each state is defensible on its own; it is the SEQUENCE that surprises, so it is written down
     * here rather than left to emerge. The predicate deliberately does NOT carry history — a rule
     * that remembered the order its arms were decided in would make visibility unexplainable on
     * screen and untestable without sequencing every fixture.
     *
     * ⚠️ **REACHABLE TODAY, AND ORDINARY.** `{ED, community}` is a permitted combination the owner
     * has explicitly ruled STAYS VISIBLE while live, it is two clicks away in the intake form, and
     * declining the ED arm is a routine act. The intake refusal being added covers `{ward,
     * community}` only, so it does not touch this at all: **this is a permanent behaviour of the
     * product, not a legacy-data curiosity.**
     *
     * ⚠️ **THE RETURN IS RULED. Owner, 2026-09-01, verbatim: "tell ward lead to add the reason to
     * the screen."** The decision is that the SCREEN carries the reason on the return ("community
     * declined — back in the queue"), not that the rule changes: both transitions are true, so the
     * fix is presentational. That ruling is NECESSARY rather than decorative precisely because the
     * sequence is live.
     *
     * **That message is NOT built here.** It belongs to the coordinator surfaces another chat is
     * wiring. This predicate decides WHETHER a row appears; the screen decides WHAT it says, and if
     * the wording ever needs deriving it derives from the destination states, which are already on
     * the record.
     */
    const bothQueued = localReferral("RF-LOCAL-SEQUENCE", [
      arm("emergency_department", "queued"),
      arm("community_team", "queued"),
    ]);
    expect(
      coordinatorWorksReferral(bothQueued),
      "state 1 of 3: somebody is in a department awaiting a psychiatry decision",
    ).toBe(true);

    const edDeclined = localReferral("RF-LOCAL-SEQUENCE", [
      arm("emergency_department", "declined"),
      arm("community_team", "queued"),
    ]);
    expect(
      coordinatorWorksReferral(edDeclined),
      "state 2 of 3: the ED arm answered, so the only live arm is the community follow-up",
    ).toBe(false);

    const bothDeclined = localReferral("RF-LOCAL-SEQUENCE", [
      arm("emergency_department", "declined"),
      arm("community_team", "declined"),
    ]);
    expect(
      coordinatorWorksReferral(bothDeclined),
      "state 3 of 3: nobody took this patient, so they are back in play and the referral returns to " +
        "the work list. THE RETURN IS RULED (owner, 2026-09-01) — the screen carries the reason.",
    ).toBe(true);
  });

  it("the same three-state sequence through {ward, community} — the shape the intake refusal will make legacy-only", () => {
    /*
     * A second instance of the sequence above, not a different rule. It is kept because the
     * `{ward, community}` shape still exists in data written before the intake refusal — `RF-007`
     * carried it until it was split on 2026-09-01 — and a reader meeting the sequence on an old
     * record should find it described here too.
     *
     * It is NOT the primary case: refusing the combination at intake stops new ones, while the
     * `{ED, community}` sequence above stays reachable forever.
     */
    const bothQueued = localReferral("RF-LOCAL-SEQUENCE-WARD", [
      arm("psychiatric_ward", "queued"),
      arm("community_team", "queued"),
    ]);
    const wardDeclined = localReferral("RF-LOCAL-SEQUENCE-WARD", [
      arm("psychiatric_ward", "declined"),
      arm("community_team", "queued"),
    ]);
    const bothDeclined = localReferral("RF-LOCAL-SEQUENCE-WARD", [
      arm("psychiatric_ward", "declined"),
      arm("community_team", "declined"),
    ]);
    expect(coordinatorWorksReferral(bothQueued), "state 1 of 3: a bed is being asked for").toBe(true);
    expect(coordinatorWorksReferral(wardDeclined), "state 2 of 3: only the discharge follow-up is live").toBe(false);
    expect(coordinatorWorksReferral(bothDeclined), "state 3 of 3: nobody took them, so they return").toBe(true);
  });

  describe("the table — GENERATED from REFERRAL_DESTINATION_KINDS, never enumerated by hand", () => {
    /*
     * ⚠️ **THE ENUMERATION IS GENERATED; ONLY THE VERDICTS ARE WRITTEN BY US.** A hand-written table
     * agreeing with a hand-written document proves that we were consistent, not that the rule is
     * complete — and no mutation proof can detect a premise both halves share. So every non-empty
     * subset of `REFERRAL_DESTINATION_KINDS` is derived here, crossed with every assignment of the
     * states below, and any generated combination with no decided expectation is a FAILURE rather
     * than a silence.
     *
     * A fourth destination kind therefore makes this set grow by itself: the `switch` in
     * `referralDestinationDirection` stops compiling (no `default` arm), and this table goes red for
     * every new combination nobody has ruled on. Neither guard relies on somebody remembering the
     * other.
     *
     * **`cancelled` is deliberately not in the generated state alphabet, and its absence is tested
     * separately below rather than assumed.** `cancelled` is written in exactly one place in the
     * codebase — inside `ACCEPT_REFERRAL`, on the arms that did not accept — so on reducer-produced
     * data a cancelled arm always travels with an accepted one, which the accepted branch answers
     * first. Generating it across all subsets would quadruple the table with combinations the system
     * cannot produce. The two shapes that matter get their own named tests.
     */
    const GENERATED_STATES: readonly ReferralAddressingState[] = ["queued", "accepted", "declined"];

    /** Every non-empty subset, in `REFERRAL_DESTINATION_KINDS` order so a key is canonical. */
    function nonEmptySubsets<T>(items: readonly T[]): T[][] {
      const subsets: T[][] = [];
      for (let mask = 1; mask < 1 << items.length; mask += 1) {
        subsets.push(items.filter((_, index) => (mask & (1 << index)) !== 0));
      }
      return subsets;
    }

    /** Every assignment of `GENERATED_STATES` to `size` arms. */
    function stateAssignments(size: number): ReferralAddressingState[][] {
      let assignments: ReferralAddressingState[][] = [[]];
      for (let index = 0; index < size; index += 1) {
        assignments = assignments.flatMap((prefix) => GENERATED_STATES.map((state) => [...prefix, state]));
      }
      return assignments;
    }

    type Combination = { kind: ReferralDestinationKind; state: ReferralAddressingState }[];

    const combinations: Combination[] = nonEmptySubsets(REFERRAL_DESTINATION_KINDS).flatMap((kinds) =>
      stateAssignments(kinds.length).map((states) => kinds.map((kind, index) => ({ kind, state: states[index] }))),
    );

    const keyOf = (combination: Combination): string =>
      combination.map(({ kind, state }) => `${kind}:${state}`).join(" + ");

    /**
     * The verdicts, and ONLY the verdicts — `true` visible, `false` hidden. Nothing here is derived;
     * a wrong entry is a disagreement between us and the rule, which is exactly what a lookup is for.
     *
     * ⚠️ **The rows marked "two accepted arms" are `true` because the predicate SHOWS a record it
     * cannot make sense of, never because that state is acceptable.** FD-22 permits one acceptance
     * and the reducer refuses to produce a second, which the invariant test below asserts through the
     * write path. Showing the row is the conservative failure: `ward-flow/error.tsx` and
     * `statistics/error.tsx` now exist, but neither shrinks the blast radius — both replace the
     * entire page, navigation rail included, per `statistics/error.tsx`'s own doc comment — so being
     * loud here would still blank the board for every other waiting patient.
     */
    const EXPECTED: Record<string, boolean> = {
      // One destination.
      "psychiatric_ward:queued": true,
      "psychiatric_ward:accepted": true,
      "psychiatric_ward:declined": true,
      "emergency_department:queued": true,
      "emergency_department:accepted": true,
      "emergency_department:declined": true,
      "community_team:queued": false,
      "community_team:accepted": false,
      "community_team:declined": false,
      // Ward + emergency department: both arriving, so every assignment stays visible.
      "psychiatric_ward:queued + emergency_department:queued": true,
      "psychiatric_ward:queued + emergency_department:accepted": true,
      "psychiatric_ward:queued + emergency_department:declined": true,
      "psychiatric_ward:accepted + emergency_department:queued": true,
      "psychiatric_ward:accepted + emergency_department:accepted": true, // two accepted arms — impossible via the reducer; SHOWN, never thrown
      "psychiatric_ward:accepted + emergency_department:declined": true,
      "psychiatric_ward:declined + emergency_department:queued": true,
      "psychiatric_ward:declined + emergency_department:accepted": true,
      "psychiatric_ward:declined + emergency_department:declined": true,
      // Ward + community: the combination the owner rules cannot arise clinically and the intake form
      // is being changed to refuse, guarded because data written before that refusal still carries it.
      // The last three rows are the three states of the second sequence test above.
      "psychiatric_ward:queued + community_team:queued": true,
      "psychiatric_ward:queued + community_team:accepted": true, // accepted LEAVING arm does not outrank the live ARRIVING one
      "psychiatric_ward:queued + community_team:declined": true,
      "psychiatric_ward:accepted + community_team:queued": true,
      "psychiatric_ward:accepted + community_team:accepted": true, // two accepted arms — impossible via the reducer; SHOWN, never thrown
      "psychiatric_ward:accepted + community_team:declined": true,
      "psychiatric_ward:declined + community_team:queued": false,
      "psychiatric_ward:declined + community_team:accepted": false,
      "psychiatric_ward:declined + community_team:declined": true,
      // Emergency department + community: a permitted combination, ruled visible by the owner while
      // live (2026-09-01). The last three rows are the three states of the PRIMARY sequence test
      // above — the vanish-and-return is reachable here forever, not only in legacy data.
      "emergency_department:queued + community_team:queued": true,
      "emergency_department:queued + community_team:accepted": true, // accepted LEAVING arm does not outrank the live ARRIVING one
      "emergency_department:queued + community_team:declined": true,
      "emergency_department:accepted + community_team:queued": true,
      "emergency_department:accepted + community_team:accepted": true, // two accepted arms — impossible via the reducer; SHOWN, never thrown
      "emergency_department:accepted + community_team:declined": true,
      "emergency_department:declined + community_team:queued": false,
      "emergency_department:declined + community_team:accepted": false,
      "emergency_department:declined + community_team:declined": true,
      // All three.
      "psychiatric_ward:queued + emergency_department:queued + community_team:queued": true,
      "psychiatric_ward:queued + emergency_department:queued + community_team:accepted": true, // accepted LEAVING arm does not outrank the live ARRIVING one
      "psychiatric_ward:queued + emergency_department:queued + community_team:declined": true,
      "psychiatric_ward:queued + emergency_department:accepted + community_team:queued": true,
      "psychiatric_ward:queued + emergency_department:accepted + community_team:accepted": true, // two accepted arms — impossible via the reducer; SHOWN, never thrown
      "psychiatric_ward:queued + emergency_department:accepted + community_team:declined": true,
      "psychiatric_ward:queued + emergency_department:declined + community_team:queued": true,
      "psychiatric_ward:queued + emergency_department:declined + community_team:accepted": true, // accepted LEAVING arm does not outrank the live ARRIVING one
      "psychiatric_ward:queued + emergency_department:declined + community_team:declined": true,
      "psychiatric_ward:accepted + emergency_department:queued + community_team:queued": true,
      "psychiatric_ward:accepted + emergency_department:queued + community_team:accepted": true, // two accepted arms — impossible via the reducer; SHOWN, never thrown
      "psychiatric_ward:accepted + emergency_department:queued + community_team:declined": true,
      "psychiatric_ward:accepted + emergency_department:accepted + community_team:queued": true, // two accepted arms — impossible via the reducer; SHOWN, never thrown
      "psychiatric_ward:accepted + emergency_department:accepted + community_team:accepted": true, // two accepted arms — impossible via the reducer; SHOWN, never thrown
      "psychiatric_ward:accepted + emergency_department:accepted + community_team:declined": true, // two accepted arms — impossible via the reducer; SHOWN, never thrown
      "psychiatric_ward:accepted + emergency_department:declined + community_team:queued": true,
      "psychiatric_ward:accepted + emergency_department:declined + community_team:accepted": true, // two accepted arms — impossible via the reducer; SHOWN, never thrown
      "psychiatric_ward:accepted + emergency_department:declined + community_team:declined": true,
      "psychiatric_ward:declined + emergency_department:queued + community_team:queued": true,
      "psychiatric_ward:declined + emergency_department:queued + community_team:accepted": true, // accepted LEAVING arm does not outrank the live ARRIVING one
      "psychiatric_ward:declined + emergency_department:queued + community_team:declined": true,
      "psychiatric_ward:declined + emergency_department:accepted + community_team:queued": true,
      "psychiatric_ward:declined + emergency_department:accepted + community_team:accepted": true, // two accepted arms — impossible via the reducer; SHOWN, never thrown
      "psychiatric_ward:declined + emergency_department:accepted + community_team:declined": true,
      "psychiatric_ward:declined + emergency_department:declined + community_team:queued": false,
      "psychiatric_ward:declined + emergency_department:declined + community_team:accepted": false,
      "psychiatric_ward:declined + emergency_department:declined + community_team:declined": true,
    };

    it("the generated set is the complete cross, computed independently of the generator", () => {
      // (1 + states)^kinds - 1 is the count of non-empty subsets crossed with state assignments —
      // arithmetic, not a re-run of the loops above, so a generator that quietly dropped a subset
      // fails here.
      expect(combinations.length).toBe((1 + GENERATED_STATES.length) ** REFERRAL_DESTINATION_KINDS.length - 1);
      expect(new Set(combinations.map(keyOf)).size, "the generator produced a duplicate").toBe(combinations.length);
    });

    it("every generated combination has a decided expectation, and no expectation is stale", () => {
      const generated = new Set(combinations.map(keyOf));
      for (const key of generated) {
        expect(
          Object.hasOwn(EXPECTED, key),
          `no verdict has been decided for "${key}". A destination kind was probably added: decide ` +
            "whether this combination is the coordinator's work and add it to EXPECTED — do not " +
            "loosen this check.",
        ).toBe(true);
      }
      for (const key of Object.keys(EXPECTED)) {
        expect(
          generated.has(key),
          `EXPECTED holds "${key}", which the generator no longer produces. Delete the stale entry, ` +
            "or find out which kind or state stopped existing.",
        ).toBe(true);
      }
    });

    for (const combination of combinations) {
      const key = keyOf(combination);
      const expected = EXPECTED[key];
      it(`${key} → ${expected ? "VISIBLE" : "HIDDEN"}`, () => {
        const referral = localReferral(
          `RF-LOCAL-${key}`,
          combination.map(({ kind, state }) => arm(kind, state)),
        );
        expect(coordinatorWorksReferral(referral)).toBe(expected);
        expect(coordinatorWorklistReferrals([referral]).length).toBe(expected ? 1 : 0);
      });
    }
  });

  describe("two accepted arms — a real defect, answered conservatively HERE and loudly where that is safe", () => {
    it("is SHOWN rather than thrown, because a render predicate has no safe way to be loud", () => {
      /*
       * ⚠️ **THIS PREDICATE MUST NOT THROW, BECAUSE THE TRADE IS WRONG AT ANY BLAST RADIUS.**
       * Throwing from a predicate consulted during render spends a whole surface to announce one
       * row: the patients a coordinator can still act on disappear so that the one record nobody can
       * act on can be reported. Behind an error boundary that costs a panel instead of a page, and a
       * panel of missing patients is still a worse failure than one visible row somebody can
       * question. **The reason does not depend on how much of the screen is lost.**
       *
       * (Boundaries exist now — `src/app/mockups/ward-flow/error.tsx` and its nearer sibling
       * `src/app/mockups/ward-flow/statistics/error.tsx` — so it is no longer true that nothing
       * catches these throws. What stays true is the blast radius: both boundaries render inside
       * `ward-flow/layout.tsx`, and per `statistics/error.tsx`'s own doc comment, "It does NOT keep
       * more of the screen alive than the parent would" — both replace the entire page, navigation
       * rail included. That is supporting detail with a shelf life of its own — the rail could move
       * into the layout and shrink this — and it is deliberately not the load-bearing reason, so
       * this comment does not decay when that happens.)
       *
       * So the row is SHOWN, for the same reason branch 1 shows a referral addressed nowhere: a
       * visible row with a confused destination is something a coordinator can see and question; a
       * blank board is not. It is the same conservative-failure rule the whole module is built on.
       *
       * ⚠️ **What is NOT being said: that two acceptances are acceptable.** Two places believing they
       * have taken the same person is a serious data defect. It is pinned in the test below, through
       * the reducer, where being loud costs nothing — and a data-integrity check, not a render
       * predicate, is where such a defect should be raised.
       *
       * The order-independence F-2 asked for is unaffected: the arms are filtered and counted, never
       * `find`-ed, so both destination orders give the same answer and a fixture reorder cannot flip
       * a verdict silently.
       */
      /*
       * ⚠️ **THE THIRD ARM — A QUEUED COMMUNITY DESTINATION — IS WHAT MAKES THIS TEST PIN THE BRANCH
       * IT DESCRIBES, and it was added because the earlier two-arm version did not.** With only two
       * accepted arms, deleting `if (accepted.length > 1) return true` changes nothing here: the
       * fall-through reaches branch 4, which reads the whole record, finds an arriving arm and
       * returns `true` — the same answer, so the assertion stayed green over the deleted guard. It
       * documented the decision without holding it.
       *
       * With a queued community arm present, the fall-through instead reaches branch 3, whose live
       * set is `{community}` alone, and the answer flips to `false`. Same decision, now pinned.
       */
      const orderA = localReferral("RF-LOCAL-TWO-ACCEPTED-ORDER-A", [
        arm("psychiatric_ward", "accepted"),
        arm("emergency_department", "accepted"),
        arm("community_team", "queued"),
      ]);
      const orderB = localReferral("RF-LOCAL-TWO-ACCEPTED-ORDER-B", [
        arm("community_team", "queued"),
        arm("emergency_department", "accepted"),
        arm("psychiatric_ward", "accepted"),
      ]);

      for (const referral of [orderA, orderB]) {
        expect(() => coordinatorWorksReferral(referral), "a render predicate must never throw").not.toThrow();
      }
      // ORDER-INDEPENDENT, and that is the property F-2 was really about: the same three arms in two
      // orders must give one answer, which a `find` over the array could not guarantee.
      expect(coordinatorWorksReferral(orderA)).toBe(true);
      expect(coordinatorWorksReferral(orderB)).toBe(true);
      expect(coordinatorWorksReferral(orderA)).toBe(coordinatorWorksReferral(orderB));
      expect(coordinatorWorklistReferrals([orderA, orderB]).map((entry) => entry.id)).toEqual([
        "RF-LOCAL-TWO-ACCEPTED-ORDER-A",
        "RF-LOCAL-TWO-ACCEPTED-ORDER-B",
      ]);
    });

    it("⚠️ THE INVARIANT ITSELF — the reducer REFUSES a second acceptance, which is where loudness is safe", () => {
      /*
       * FD-22 in the write path, asserted through the reducer rather than quoted from a doc comment.
       * This is the test that makes the predicate's conservative answer above acceptable: the state
       * it declines to shout about cannot be produced by the system at all.
       *
       * ⚠️ **The refusal this test actually exercises is the REFERRAL-LEVEL one** — checked, not
       * assumed: the reason is asserted to match `already been accepted elsewhere`, and it does. The
       * addressing-level guard (`has already answered … (cancelled)`) is a second net that sits
       * behind it and is not reached here, because the referral-level check runs first. Said
       * explicitly so nobody reads this test as proving both.
       *
       * A future change that let a second acceptance through would go red HERE, on the write path,
       * where a refusal is a rejection record rather than a blank screen.
       */
      const received = wardFlowReducer(seedWardFlowState(), {
        type: "RECEIVE_REFERRAL",
        role: "community",
        now: RAISED_AT,
        ageBand: "Adult",
        destinations: [
          { kind: "psychiatric_ward", sex: "Female", secureBedNeeded: false, involuntaryBedNeeded: false },
          { kind: "emergency_department", edId: allEmergencyDepartments()[0].id, purpose: "bed" },
        ],
        homeRegion: "Perth Metropolitan",
        suburb: { kind: "named", name: "Armadale" },
        source: "community",
        urgency: 2,
        originSiteCode: "RPH",
        transportNeeded: false,
      });
      expect(received.rejections, "the reducer refused the two-destination referral this test needs").toEqual([]);
      const created = received.referrals.at(-1)!;

      const accepted = wardFlowReducer(received, {
        type: "ACCEPT_REFERRAL",
        role: "ed",
        now: RAISED_AT + 5,
        referralId: created.id,
        destinationKind: "emergency_department",
      });
      expect(accepted.rejections, "the reducer refused the first acceptance").toEqual([]);

      const secondAcceptance = wardFlowReducer(accepted, {
        type: "ACCEPT_REFERRAL",
        role: "ward",
        now: RAISED_AT + 9,
        referralId: created.id,
        destinationKind: "psychiatric_ward",
        unitId: "rph-adult-secure",
      });
      expect(
        secondAcceptance.rejections.length,
        "a second destination accepted the same referral. FD-22 says the first acceptance ends the " +
          "placement — if this passes, two places believe they have taken the same person.",
      ).toBeGreaterThan(0);
      // The REASON is asserted, not just the count: a rejection for a missing unit or a role
      // mismatch would satisfy a bare count while proving nothing about FD-22.
      expect(secondAcceptance.rejections.at(-1)!.reason, "the refusal must be FD-22's, not an incidental one").toMatch(
        /already been accepted elsewhere/,
      );

      const after = secondAcceptance.referrals.find((referral) => referral.id === created.id)!;
      expect(
        after.destinations.filter((addressing) => addressing.state === "accepted").length,
        "the referral holds more than one accepted destination",
      ).toBe(1);
      // And the predicate's conservative answer is never reached on reducer-produced data, which is
      // the whole point of pinning the invariant here instead of there.
      expect(coordinatorWorksReferral(after)).toBe(true);
    });

    it("⚠️ NO SEEDED REFERRAL HAS TWO ACCEPTED DESTINATIONS — the one check that covers the realistic producer", () => {
      /*
       * The reducer test above proves the WRITE PATH cannot produce this state, which is the path
       * already known to be safe. The paths that realistically can are an authored fixture, an
       * import, or a hand-built object — and with the predicate deliberately silent (it shows the row
       * rather than throwing, see above), **nothing else anywhere would record that it happened.**
       *
       * ⚠️ **A runtime `console.warn` in that branch was CONSIDERED AND DECLINED, deliberately.**
       * `src/components/ward-management/` contains no `console.log|warn|error|info|debug` call at
       * all, while the same search finds them elsewhere under `src/components/` — so the absence is a
       * standing convention rather than an oversight, and this rule is not the change that should
       * introduce the first one. (Search it with the call parenthesis, not a bare `console.` — that
       * matches the FILENAME `ward-management-console.tsx` in comments and reports hits that are not
       * calls.) The consequence is worth stating plainly: **the two-accepted state is undetectable at
       * runtime BY DECISION, not by omission**, and this test is the detection that replaces it.
       */
      for (const referral of seededReferrals) {
        const accepted = referral.destinations.filter((addressing) => addressing.state === "accepted");
        expect(
          accepted.length,
          `${referral.id} has ${accepted.length} accepted destinations; FD-22 permits one. FIX THE ` +
            "FIXTURE in ward-movements.ts — `coordinatorWorksReferral` shows such a row rather than " +
            "crashing, so this test is the only thing that will tell you the record is wrong.",
        ).toBeLessThanOrEqual(1);
      }
      // Non-vacuity: a seed with no accepted destination at all would satisfy the loop for the wrong
      // reason, so the fixture is confirmed to contain the state this rule is about.
      expect(
        seededReferrals.some((referral) => referral.destinations.some((addressing) => addressing.state === "accepted")),
        "no seeded referral has an accepted destination, so the guard above proves nothing",
      ).toBe(true);
    });
  });

  describe("cancelled arms — what the reducer can actually produce, checked rather than assumed", () => {
    it("a CANCELLED arm always travels with an accepted one, so the accepted arm decides", () => {
      // `state: "cancelled"` is written in exactly one place in the codebase: inside
      // `ACCEPT_REFERRAL`, on the arms that did not accept. So this is the reachable cancelled
      // shape, and the accepted arm answers it before any cancelled arm is read.
      const wardAcceptedEdCancelled = localReferral("RF-LOCAL-CANCELLED-WITH-ACCEPT", [
        arm("psychiatric_ward", "accepted"),
        arm("emergency_department", "cancelled"),
      ]);
      expect(coordinatorWorksReferral(wardAcceptedEdCancelled)).toBe(true);

      const communityAcceptedWardCancelled = localReferral("RF-LOCAL-CANCELLED-COMMUNITY-ACCEPT", [
        arm("community_team", "accepted"),
        arm("psychiatric_ward", "cancelled"),
      ]);
      expect(
        coordinatorWorksReferral(communityAcceptedWardCancelled),
        "the community team took the patient, so the bed question is finished however it started",
      ).toBe(false);
    });

    it("⚠️ declined + cancelled with NOTHING accepted can only be hand-built — recorded, not endorsed", () => {
      /*
       * The reducer cannot produce this: cancellation happens only as a consequence of an
       * acceptance, and neither `ACCEPT_REFERRAL` nor `DECLINE_REFERRAL` will re-decide an arm that
       * has already answered. It is asserted anyway so the nothing-live branch has a defined answer
       * for a malformed record rather than an accidental one — and if a future event handler starts
       * writing `cancelled` on its own, this test is where the new shape's verdict gets decided.
       */
      const handBuilt = localReferral("RF-LOCAL-DECLINED-AND-CANCELLED", [
        arm("psychiatric_ward", "declined"),
        arm("community_team", "cancelled"),
      ]);
      expect(coordinatorWorksReferral(handBuilt), "a decided bed referral stays on the decided side").toBe(true);
    });
  });

  it("a referral with ZERO destinations stays visible — MALFORMED, not community", () => {
    /*
     * The one case where "nothing arriving" and "is a community referral" come apart, ruled
     * deliberately rather than left to whatever an empty array happens to return. The reducer
     * refuses to create one (`RECEIVE_REFERRAL needs at least one destination`), so it can only come
     * from a fixture or a bad hand-built object — and it is outside the generated table above, which
     * covers only the non-empty subsets. In a system whose purpose is that a waiting person does not
     * vanish, the conservative failure is to SHOW: a hidden malformed record is unnoticeable, a
     * visible one is somebody's problem.
     */
    const nowhere = localReferral("RF-LOCAL-NO-DESTINATIONS", []);
    expect(coordinatorWorksReferral(nowhere)).toBe(true);
    expect(coordinatorWorklistReferrals([nowhere]).map((entry) => entry.id)).toContain("RF-LOCAL-NO-DESTINATIONS");
  });

  it("a WARD-ONLY referral stays — and this test exists because RF-007 and RF-009 would both agree with a wrong literal", () => {
    // Mutating the `"community_team"` literal in the direction switch to `"psychiatric_ward"`
    // changes no verdict on RF-007 (its ward arm is accepted) or RF-009 (no ward arm at all). This
    // is the case that goes red when the literal names the wrong kind.
    const rf001 = seeded("RF-001");
    expect(rf001.destinations.map((addressing) => addressing.destination.kind)).toEqual(["psychiatric_ward"]);
    expect(coordinatorWorksReferral(rf001)).toBe(true);
    expect(coordinatorWorklistReferrals([rf001]).map((entry) => entry.id)).toContain("RF-001");
  });

  it("a community + ward referral stays visible — DATA THAT PREDATES THE RULE, which is an ordinary and permanent category", () => {
    /*
     * ⚠️ **The owner ruled on 2026-09-01 that a community referral does not happen when a ward
     * needs one, and that the combination is to be REFUSED AT THE INTAKE FORM.** So no new referral
     * of this shape will be created once that refusal lands.
     *
     * **Refusing creation does nothing about referrals that already exist.** Data that predates a
     * rule is an ordinary and permanent category — every rule about shapes acquires it the moment
     * it lands, and it never goes away. That is what this test guards: not an impossible state,
     * not user error, but a record written before the rule existed.
     *
     * ⚠️ **THIS USED TO READ `RF-007`, AND THE SPLIT IS WHY IT NO LONGER CAN.** RF-007 carried
     * `{community_team, psychiatric_ward}` until 2026-09-01, when ruling 14 split it into a
     * ward-only RF-007 (keeping the seed's only successful youth match) and a community-only
     * RF-010 (feeding the community hub). **The rule being tested did not change; the seed did.**
     * Hand-building the pair is what keeps this case covered, and the assertion below pins that
     * RF-007 really is ward-only now — so a reader meeting this test cannot conclude the shape was
     * merely renamed away.
     *
     * The ward arm is ACCEPTED, not queued, exactly as RF-007's was: `referralState` reads
     * "accepted" and such a referral renders on the recently-decided side. It is not a patient
     * waiting on both.
     */
    const predatesTheRule = localReferral("RF-LOCAL-COMMUNITY-AND-WARD", [
      arm("community_team", "queued"),
      arm("psychiatric_ward", "accepted"),
    ]);
    const arms = predatesTheRule.destinations.map((addressing) => addressing.destination.kind);
    expect([...arms].sort()).toEqual(["community_team", "psychiatric_ward"]);
    expect(referralState(predatesTheRule)).toBe("accepted");
    expect(coordinatorWorksReferral(predatesTheRule)).toBe(true);
    expect(coordinatorWorklistReferrals([predatesTheRule]).map((entry) => entry.id)).toContain(
      "RF-LOCAL-COMMUNITY-AND-WARD",
    );

    // And the seed no longer holds the forbidden pair anywhere — the split, pinned where somebody
    // reading this case will see it.
    for (const referral of seededReferrals) {
      const kinds = new Set(referral.destinations.map((addressing) => addressing.destination.kind));
      expect(
        kinds.has("psychiatric_ward") && kinds.has("community_team"),
        `${referral.id} asks for a bed AND a community team. Owner rulings 13/14: that cannot ` +
          "occur — a community referral is for a patient being discharged. SPLIT it, never trim " +
          "it: RF-007's ward arm was the seed's only successful youth match and deleting it would " +
          "have failed nothing.",
      ).toBe(false);
    }
    expect(seeded("RF-007").destinations.map((addressing) => addressing.destination.kind)).toEqual([
      "psychiatric_ward",
    ]);
  });

  it("a community + emergency_department referral stays visible — RULED BY THE OWNER, 2026-09-01: 'yes keep them visible'", () => {
    /*
     * Asked whether a coordinator should still see someone awaiting a psychiatric review in an
     * emergency department who ALSO has a community team asked to pick them up, the owner answered
     * verbatim: **"yes keep them visible"**. So this is his ruling, not our inference from the
     * direction criterion — though the two agree: an ED arm means somebody is in a department
     * waiting on a psychiatry decision, which is upstream of the bed question.
     *
     * With `{ward, community}` refused at the intake form, this is the only mixed combination the
     * product can still create, and it is decided. The table is safe rather than lucky.
     */
    const mixed = localReferral("RF-LOCAL-COMMUNITY-AND-ED", [
      arm("community_team", "queued"),
      arm("emergency_department", "queued"),
    ]);
    expect(coordinatorWorklistReferrals([mixed]).map((entry) => entry.id)).toContain("RF-LOCAL-COMMUNITY-AND-ED");
  });

  it("⚠️ THE RULE NOW REMOVES SOMEBODY FROM THE REAL SEED — RF-010, and only RF-010", () => {
    /*
     * ⚠️ **THIS ASSERTION SAID THE OPPOSITE UNTIL 2026-09-01, AND IT WAS WRITTEN TO FAIL.** It
     * pinned that the whole seed passed through the work list untouched, because no seeded referral
     * was community-only — RF-001 to RF-006 and RF-008 ward-only, RF-007 community+ward, RF-009
     * ED-only. It said in as many words that it was expected to go red when `RF-007` was split, and
     * that the red would mean the rule had started doing its job. **It did, and it does.**
     *
     * RF-007 is now ward-only (keeping the seed's only successful youth match at `bty-youth`) and
     * `RF-010` carries the community arm alone, so the direction rule finally has something real to
     * remove. Owner ruling 18: `{community_team}` is the one combination that goes OUT — the
     * patient is leaving, so they are not a bed decision a coordinator is working.
     *
     * ⚠️ **THE SET DIFFERENCE, NOT A COUNT.** Asserting a length would pass if the rule started
     * hiding some other referral instead; naming exactly which id is removed is what makes this
     * measure the rule rather than its side effect. The invariant test still builds its own
     * community-only referral by hand, because a test written only over this seed would pass with
     * the predicate inverted or the module unwired — this one adds the live seed, it does not
     * replace that.
     */
    const worked = coordinatorWorklistReferrals(seededReferrals).map((entry) => entry.id);
    const removed = seededReferrals.map((referral) => referral.id).filter((id) => !worked.includes(id));
    expect(
      removed,
      "the coordinator's work list no longer removes exactly RF-010. If nothing is removed, the " +
        "seed has lost its community-only referral or the rule has been unwired; if something else " +
        "is removed, the rule is hiding a referral that is still upstream of a bed decision.",
    ).toEqual(["RF-010"]);

    // And the removed one really is community-only — the premise the assertion above rests on,
    // stated rather than assumed.
    expect(seeded("RF-010").destinations.map((addressing) => addressing.destination.kind)).toEqual(["community_team"]);
  });

  it("every entry in the work list is the FD-23 coordinator projection, unchanged", () => {
    // The work list decides WHICH referrals appear; FD-23 decides WHAT each one carries. This
    // asserts the second question is still answered by the same projection, not by a second,
    // divergent copy of it.
    const rf009 = seeded("RF-009");
    expect(coordinatorWorklistReferrals([rf009])).toEqual([coordinatorScopedReferral(rf009)]);
  });

  it("REGRESSION GUARD — `coordinatorScopedReferrals` still returns EVERY referral, community-only ones included", () => {
    /*
     * FD-23 (owner, 2026-08-30) says the coordinator may see everything, and that function's doc
     * comment reads "Never filtered". That is a rule about FIELDS. Adding the new work-list rule
     * INSIDE it would silently invert a standing ruling — and this module's own header warns it is
     * "the single most likely rule in that document to be undone by somebody being helpful".
     */
    const communityOnly = localReferral("RF-LOCAL-COMMUNITY-ONLY", [arm("community_team", "queued")]);
    const input = [...seededReferrals, communityOnly];
    const projections = coordinatorScopedReferrals(input);
    expect(projections.length).toBe(input.length);
    expect(projections.map((entry) => entry.id)).toContain("RF-LOCAL-COMMUNITY-ONLY");
  });
});

/**
 * ⚠️ **A PATIENT'S SUBURB REACHES NEITHER PROJECTION — owner's ruling, 2026-09-02.**
 *
 * `suburb` sits on `Referral` (`ward-model.ts:1220`) and on no scoped projection. Until the ruling
 * that was an ACCIDENT that happened to agree with good practice: nothing recorded the intent, so
 * the next person to widen `CoordinatorScopedReferral` would have added it without meeting a single
 * objection. **The owner has now decided, and this is where the decision lives.**
 *
 * **This asserts the absence of ONE NAMED FIELD, and deliberately does not re-assert the field set.**
 * That distinction is the whole reason this block is allowed to exist beside the instruction a few
 * lines up in `ward-referral-visibility.ts`, which forbids duplicating the projection's shape:
 *
 *   - **Re-asserting the eleven-field list would be buying the same verdict twice.** `tsc` already
 *     holds that contract, and a copied list decays independently of the type it copies.
 *   - **This is the opposite case.** A type states what IS present; no type can state what must
 *     NEVER be. `tsc` cannot fail on a field nobody wrote, so **no gate holds this rule at all** —
 *     there is no second verdict, only a first one.
 *
 * The positive control matters more than usual here. An absence check over a fixture that never had
 * the field would pass forever while proving nothing, so this asserts the source referral DOES carry
 * `suburb` before asserting the projection does not. **Otherwise the day `suburb` is renamed on
 * `Referral`, this guard goes quietly green and stops protecting anything.**
 */
describe("the owner's suburb ruling, recorded where no type can hold it", () => {
  /**
   * ⚠️ **THE WARD PROJECTION ONLY, AND THE COORDINATOR LIMB IS DELIBERATELY NOT BUILT.**
   *
   * An earlier draft of this guard asserted `suburb` was absent from BOTH projections. That was
   * wrong, and it would have pinned the opposite of the ruling on one of them.
   *
   * **A5 says: "the suburb. A ward must not have it."** It says nothing about the coordinator. And
   * **R2 says: "Only the coordinator has all the information. The state wide coordinator screen."**
   * — so a guard forbidding the coordinator a patient's suburb would encode the reverse of the
   * design principle it claims to enforce.
   *
   * **The coordinator projection does not carry `suburb` today. That is left as a fact, not fixed
   * as a rule**, because nobody has ruled on it and a guard is a decision. If the owner later rules
   * that a coordinator may see it, the field can be added with no test to argue with — which is the
   * correct state for an unruled question.
   *
   * **A field's absence is not a decision. A guard is. Do not guard what has not been decided.**
   */
  it("keeps `suburb` out of the ward projection, and proves the field was there to leak", () => {
    const referrals = seedWardFlowState().referrals;
    expect(referrals.length, "no seeded referral, so this guard would check nothing").toBeGreaterThan(0);

    // POSITIVE CONTROL — the field must exist on the source, or the absence below is meaningless.
    const carryingSuburb = referrals.filter((referral) => "suburb" in referral);
    expect(
      carryingSuburb.length,
      "no seeded Referral carries `suburb`, so nothing could have leaked and this guard is vacuous. " +
        "If the field was renamed, rename it here too rather than deleting this check.",
    ).toBeGreaterThan(0);

    let wardChecked = 0;

    for (const referral of referrals) {
      // `undefined` for a referral never addressed to a ward — that is the projection working, not a
      // gap, so it is skipped rather than asserted against.
      const ward = wardScopedReferral(referral);
      if (ward === undefined) continue;
      expect(
        Object.keys(ward),
        `the ward projection of ${referral.id} carries the patient's suburb. A WARD must not have it ` +
          "(owner's ruling A5, 2026-09-02, under R2: a ward screen carries no cross-ward information " +
          "at all; only the statewide coordinator screen holds the whole picture).",
      ).not.toContain("suburb");
      wardChecked += 1;
    }

    // The loop may not have measured an empty set.
    expect(wardChecked, "no seeded referral is addressed to a ward, so this guard proved nothing").toBeGreaterThan(0);
  });
});
