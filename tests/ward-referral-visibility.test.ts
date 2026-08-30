// tests/ward-referral-visibility.test.ts
import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import type { Referral, ReferralAddressing } from "../src/components/ward-management/ward-model";
import {
  coordinatorScopedReferral,
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
      { kind: "community_team" },
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

  const accepted = wardFlowReducer(declined, {
    type: "ACCEPT_REFERRAL",
    role: "coordinator",
    now: ELSEWHERE_DECIDED_AT,
    referralId: created.id,
    destinationKind: "emergency_department",
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
 * **`"cancelled"` is a marker in THIS fixture because the ward here declined**, so the only
 * addressing carrying that state is the community team's. A ward whose OWN addressing was cancelled
 * would legitimately carry it — FD-22 telling that ward to stop, which is the owner's own reason
 * for FD-23 and not a leak. See `ward-referral-visibility.ts` on the one inference that survives.
 */
const ELSEWHERE_MARKERS: readonly (string | number)[] = [
  "emergency_department",
  "community_team",
  "accepted",
  "cancelled",
  "Flow coordinator",
  ELSEWHERE_DECIDED_AT,
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

    it("the shipped seed cannot test this rule, which is why the reducer-built fixture exists", () => {
      // Recorded rather than worked around: every referral in `ward-movements.ts` has exactly one
      // destination today, so the seed can prove the field sets below but never the leak.
      expect(seededReferrals.length).toBeGreaterThan(0);
      expect(seededReferrals.every((referral) => referral.destinations.length === 1)).toBe(true);
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
