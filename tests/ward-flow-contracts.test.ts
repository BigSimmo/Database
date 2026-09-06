import { MINUTES_PER_DAY, splitDuration } from "@/components/ward-management/ward-clock";
import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import type { WardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { PARALLEL_REFERRAL_CAP } from "../src/components/ward-management/ward-model";
import type { MovementStage } from "../src/components/ward-management/ward-model";
import { wardMovements } from "../src/components/ward-management/ward-movements";
import { NOW_ANCHOR, allUnits } from "../src/components/ward-management/ward-sites";
import { eligibleCandidatesAmong, isOpen } from "../src/components/ward-management/ward-derivations";
import { requiresAuthorisedDestination } from "../src/components/ward-management/ward-eligibility";

const NOW = NOW_ANCHOR;
const MOVEMENT_ID = "WF-001";
const ACCEPTED_UNIT_ID = "fre-adult-open";
const DECLINED_UNIT_ID = "scgh-adult-open";
const WITHDRAWN_UNIT_ID = "arm-adult-open";

/**
 * Every state the system can reach by walking one patient the whole way through.
 *
 * Fix round 1: the subject is WF-001, not WF-009. WF-009's seed fixture already carried five
 * declines and an examination before the walk's first event ran, so invariants 4, 5 and 6 were
 * asserting against fixture history rather than anything the walk itself produced — confirmed
 * vacuous by disabling the reducer's own writes and watching the suite stay green. WF-001 is
 * the only hand-authored movement early enough in its journey (`placement_requested`) to walk
 * the whole path while also carrying no seed `declines` or `referredUnitIds`, so every decline,
 * referral, withdrawal and acceptance the invariants below inspect is caused by one of these
 * events, not by data the fixture handed them for free.
 *
 * The first event is deliberately raised with the wrong role. The reducer's role check runs
 * before the event's payload or the movement's stage is inspected at all, so this is safe to
 * raise before the movement has even been referred anywhere — and it gives the privacy
 * invariant a real, walk-caused rejection to inspect instead of an empty `state.rejections`.
 */
/**
 * The walk, hoisted so its step INDICES can be derived by name rather than counted by hand.
 *
 * ⚠️ They were hand-counted until 2026-08-31, and inserting one step — `BOOK_TRANSPORT`, when
 * `HANDOVER_READY` stopped fabricating a transport job — silently shifted every index after it
 * and failed the bed-accounting test with a number, not a reason. **A positional index into a
 * list somebody else edits is a stale pointer waiting to happen.** `stepAfter` reads the list.
 */
const WALK_EVENTS = [
  { type: "ACCEPT_IN_PRINCIPLE", role: "coordinator", unitId: DECLINED_UNIT_ID },
  { type: "REFER_TO_UNITS", role: "coordinator", unitIds: [DECLINED_UNIT_ID, WITHDRAWN_UNIT_ID, ACCEPTED_UNIT_ID] },
  { type: "DECLINE", role: "ward", unitId: DECLINED_UNIT_ID, reason: "no_bed" },
  { type: "ACCEPT_IN_PRINCIPLE", role: "ward", unitId: ACCEPTED_UNIT_ID },
  { type: "PULL_PATIENT", role: "ward", unitId: ACCEPTED_UNIT_ID },
  // Booking is a step of its own since 2026-08-31: `HANDOVER_READY` used to fabricate the
  // transport job and answer the escort question by deriving it from legal status. It no
  // longer invents either, so a walk that reaches handover without booking is refused.
  { type: "BOOK_TRANSPORT", role: "ed", provider: "Ambulance service", escortRequired: true },
  { type: "HANDOVER_READY", role: "ed" },
  { type: "TRANSPORT_ACCEPTED", role: "officer" },
  { type: "TRANSPORT_EN_ROUTE", role: "officer" },
  { type: "PATIENT_COLLECTED", role: "officer" },
  { type: "PATIENT_ARRIVED", role: "officer" },
] as const;

function walk(): WardFlowState[] {
  let state = seedWardFlowState();
  const seen: WardFlowState[] = [state];
  const events = WALK_EVENTS;
  for (const event of events) {
    state = wardFlowReducer(state, { ...event, now: NOW, movementId: MOVEMENT_ID } as never);
    seen.push(state);
  }
  return seen;
}

/**
 * `walk()`'s state indices: `seen[0]` is the seed; `seen[i + 1]` is the state after `events[i]`.
 * Named here once so the bed-accounting test below can read the exact unit before and after
 * each bed-moving step without recomputing the offsets inline.
 */
function stepAfter(type: string): number {
  const index = WALK_EVENTS.findIndex((event) => event.type === type);
  // A miss would return 0 — the SEED state — and every assertion below would read the fixture
  // before anything happened while looking like it read a step. Loud rather than plausible.
  if (index < 0) throw new Error(`walk() has no ${type} step; the index below would read the seed`);
  return index + 1;
}

/** The state BEFORE a step: `seen[i]` precedes `events[i]`, so this is the same index. */
function stepBefore(type: string): number {
  return stepAfter(type) - 1;
}

const AFTER_REFER_TO_UNITS = stepAfter("REFER_TO_UNITS");
// ⚠️ Named against the step they bracket, NOT against whatever happens to precede it. The first
// version of this derived BEFORE_PULL_PATIENT as `stepAfter("ACCEPT_IN_PRINCIPLE")` — and `findIndex`
// returns the FIRST match, which is the coordinator's acceptance of the declined unit, four steps
// early. The suite still passed, because nothing between the two touches the accepted unit's
// allocatable count: the assertion could not tell the two indices apart. Bracketing the step by
// name removes the question rather than answering it, and the pin below fails if they ever drift.
const BEFORE_PULL_PATIENT = stepBefore("PULL_PATIENT");
const AFTER_PULL_PATIENT = stepAfter("PULL_PATIENT");
const BEFORE_PATIENT_ARRIVED = stepBefore("PATIENT_ARRIVED");
const AFTER_PATIENT_ARRIVED = stepAfter("PATIENT_ARRIVED");

describe("invariants across every reachable state", () => {
  it("⚠️ BRACKETS EACH STEP, or the bed arithmetic below measures the wrong two states", () => {
    // The guard for the derivation itself. A before/after pair that is not adjacent is reading two
    // states with something else in between, and the arithmetic then attributes that something
    // else's effect to the step under test — silently, because the numbers still look plausible.
    expect(AFTER_PULL_PATIENT - BEFORE_PULL_PATIENT).toBe(1);
    expect(AFTER_PATIENT_ARRIVED - BEFORE_PATIENT_ARRIVED).toBe(1);
    expect(WALK_EVENTS[BEFORE_PULL_PATIENT]!.type).toBe("PULL_PATIENT");
    expect(WALK_EVENTS[BEFORE_PATIENT_ARRIVED]!.type).toBe("PATIENT_ARRIVED");
  });

  it("never lets a movement hold more than the parallel cap", () => {
    for (const state of walk()) {
      for (const movement of state.movements) {
        expect(movement.referredUnitIds.length).toBeLessThanOrEqual(PARALLEL_REFERRAL_CAP);
      }
    }
  });

  it("keeps the accepted unit's raw bed counts exact across each bed-moving step", () => {
    // Fix round 1: routing this through `unitCapacity()` let the invariant survive real
    // corruption, because that helper is deliberately defensive — it re-partitions `unit.beds`
    // from whatever `empty`/`allocatable`/`blocked` it is given, so a wrong decrement rarely
    // changes its output. Reading the raw fields directly, immediately before and after each
    // step that is supposed to move them, is the correct instrument for an arithmetic contract.
    const states = walk();
    const unitIn = (state: WardFlowState) => state.units.find((unit) => unit.id === ACCEPTED_UNIT_ID)!;

    const beforePull = unitIn(states[BEFORE_PULL_PATIENT]);
    const afterPull = unitIn(states[AFTER_PULL_PATIENT]);
    expect(beforePull.allocatable.value).toBe(3);
    expect(afterPull.allocatable.value).toBe(2);
    expect(afterPull.empty.value).toBe(beforePull.empty.value); // PULL_PATIENT must not touch `empty`

    const beforeArrival = unitIn(states[BEFORE_PATIENT_ARRIVED]);
    const afterArrival = unitIn(states[AFTER_PATIENT_ARRIVED]);
    expect(beforeArrival.empty.value).toBe(4);
    expect(afterArrival.empty.value).toBe(3);
    expect(afterArrival.allocatable.value).toBe(beforeArrival.allocatable.value); // nor must PATIENT_ARRIVED touch `allocatable`
    expect(beforeArrival.sexMix.Female).toBe(9);
    expect(afterArrival.sexMix.Female).toBe(10);
  });

  it("never leaves a movement ownerless", () => {
    for (const state of walk()) {
      for (const movement of state.movements) {
        expect(movement.owner.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("never returns a declined unit to that patient's eligible candidates", () => {
    // Fix round 1: assert the specific unit id is genuinely excluded, not merely that some set
    // shrank — first prove it was eligible before the walk declined it (so this isn't checking
    // a unit that could never have been a candidate anyway), then prove the walk's own DECLINE
    // event removes it from the real candidate list the screens use.
    const states = walk();
    const beforeState = states[AFTER_REFER_TO_UNITS];
    const beforeDecline = beforeState.movements.find((movement) => movement.id === MOVEMENT_ID)!;
    // R70: reads the walk's own live `units`, never the frozen `allUnits()` fixture the deleted
    // `eligibleCandidates` wrapper read from — the wrapper existed only because this call site
    // had not yet been repointed at the units-aware `eligibleCandidatesAmong`.
    const beforeCandidates = eligibleCandidatesAmong(beforeDecline, beforeState.units, NOW, Number.POSITIVE_INFINITY);
    expect(beforeCandidates.some((c) => c.unit.id === DECLINED_UNIT_ID && c.verdict.eligible)).toBe(true);

    const final = states.at(-1)!;
    const target = final.movements.find((movement) => movement.id === MOVEMENT_ID)!;
    expect(target.declines.some((decline) => decline.unitId === DECLINED_UNIT_ID)).toBe(true);

    const afterCandidates = eligibleCandidatesAmong(target, final.units, NOW, Number.POSITIVE_INFINITY);
    const eligibleIds = new Set(afterCandidates.filter((c) => c.verdict.eligible).map((c) => c.unit.id));
    expect(eligibleIds.has(DECLINED_UNIT_ID)).toBe(false);
  });

  it("records the withdrawal the referral's own acceptance caused", () => {
    // Fix round 1: assert the withdrawn entry's unit id and its exact reason text, not just
    // that the array is non-empty. `WITHDRAWN_UNIT_ID` is still a live referral right up to the
    // moment ACCEPT_IN_PRINCIPLE fires on a different unit — the withdrawal below exists only
    // because that event's own bookkeeping produced it, not because the fixture pre-populated it.
    const final = walk().at(-1)!;
    const target = final.movements.find((movement) => movement.id === MOVEMENT_ID)!;
    expect(target.acceptedUnitId).toBe(ACCEPTED_UNIT_ID);

    const withdrawn = target.withdrawnReferrals.find((entry) => entry.unitId === WITHDRAWN_UNIT_ID);
    expect(withdrawn).toBeDefined();
    // 🔴 This line USED to read `.toBe("withdrawn — placed at FRE Adult Open")`, and that is the
    // uncomfortable part: a test was holding the FD-23 leak in place as the expected value. It
    // pinned the string precisely and never asked what the string said. See
    // `tests/ward-withdrawal-reason-privacy.test.ts` — the reason is now a code, it names no unit,
    // and it does not claim the patient has moved.
    expect(withdrawn?.reason).toBe("another_unit_accepted");

    // The declined unit ends its referral through `declines`, never through `withdrawnReferrals`
    // — the two mechanisms record different things and must not blur together.
    expect(target.withdrawnReferrals.some((entry) => entry.unitId === DECLINED_UNIT_ID)).toBe(false);
  });

  /**
   * DELIBERATELY WEAKENED on 2026-08-24, alongside its twin in tests/ward-model-phase3.test.ts.
   * This used to assert the 1A/3B invariant across every state in the walk. That invariant WAS
   * the deleted rule: no reducer branch derives, replaces or clears a form any more, so a
   * movement on a 1A may now carry an examination and a movement on a 3B may not.
   *
   * The honest replacement is that no event in this walk CHANGES the form a movement carries.
   *
   * STATED LIMIT, measured rather than assumed: the walk above dispatches ten event types and
   * `RECORD_EXAMINATION` is not one of them, so re-adding the 1A-to-3B swap does NOT turn this
   * test red — verified directly by making that mutation. The name is scoped to "this walk" for
   * that reason. `tests/ward-legal-figure-guard.test.ts` drives every event type in the union
   * against a movement carrying each code and is what covers the examination branch;
   * `tests/ward-flow-reducer.test.ts` pins that branch case by case.
   */
  it("never lets any event in this walk change the legal form a movement carries", () => {
    const states = walk();
    const first = states[0];

    const formOf = (state: (typeof states)[number], id: string) =>
      state.movements.find((movement) => movement.id === id)?.legalForm;

    // Non-vacuity: the walk really inspects movements that carry a form, so an empty or
    // form-free fixture cannot make this pass quietly.
    const carriers = first.movements.filter((movement) => movement.legalForm !== undefined).map((m) => m.id);
    expect(carriers.length, "no movement in the walk carries a legal form").toBeGreaterThan(0);

    for (const state of states) {
      for (const id of carriers) {
        expect(formOf(state, id), `${id}'s legal form was changed by an event in the walk`).toEqual(formOf(first, id));
      }
    }
  });

  it("keeps every rendered string free of anything identifying a person", () => {
    // Fix round 1: mirrors Task 1's fix (tests/ward-model-phase3.test.ts) — a guard that checks
    // properties and never reads strings is how a privacy defect can survive. Accumulate every
    // string this loop actually inspects and assert there is a real, non-trivial number of them
    // before checking content, so a future edit that empties `rejections`/`withdrawnReferrals`
    // back out turns this test red instead of leaving it vacuously green. The walk's own wrong-role
    // attempt (a real, walk-caused rejection) and its own accept-triggered withdrawal both land in
    // the strings this inspects, on top of the pre-existing fixture data on other movements.
    const forbidden = /\b(name|dob|date of birth|mrn|medical record|address|diagnosis)\b/i;
    const inspected: string[] = [];
    for (const state of walk()) {
      for (const rejection of state.rejections) {
        inspected.push(rejection.reason);
      }
      for (const movement of state.movements) {
        for (const withdrawn of movement.withdrawnReferrals) {
          inspected.push(withdrawn.reason);
        }
      }
    }
    expect(inspected.length).toBeGreaterThanOrEqual(2);
    for (const text of inspected) {
      expect(text).not.toMatch(forbidden);
    }
  });
});

/**
 * Fixture coherence, not reducer coherence: the invariants above walk one movement through
 * `wardFlowReducer` and check every state the reducer itself produces. These invariants instead
 * inspect `wardMovements` — the hand-authored + generated seed data — directly, because the
 * fixture does not go through the reducer at all. Nothing stops fixture authoring from putting a
 * movement in a stage/stamp combination the reducer could never reach on its own, and that is
 * exactly what happened: six "moving" movements shipped with `transport.collectedAt` unset, a
 * state `PATIENT_COLLECTED` (the only producer of stage "moving") cannot leave behind, because it
 * always sets `collectedAt` in the same update it sets the stage. Ruling R64 then found the same
 * shape of defect again — five "handover_ready" movements with no `transport` job, four of those
 * five also with no `acceptedUnitId` — because the invariant list this block started from (R58)
 * was written by hand rather than derived from the reducer, and an incomplete list cannot catch
 * what it never enumerated.
 *
 * R64's method: enumerate every `wardFlowReducer` branch that assigns a `stage`, and for each,
 * record what else that same branch writes in the same update. Every one of those is a direct
 * implication; chaining preconditions across branches (a later stage's precondition on an earlier
 * branch's output) gives the transitive ones. The complete table, read off `ward-flow-reducer.ts`
 * on 2026-08-22:
 *
 * | Branch                | Produces stage         | Also writes (same update)                          |
 * |------------------------|------------------------|-----------------------------------------------------|
 * | `RAISE_REFERRAL`       | `placement_requested`  | `referredUnitIds: []`, `declines: []`, `withdrawnReferrals: []` (new movement — no `acceptedUnitId`/`transport`/`pullExpiresAt`) |
 * | `REFER_TO_UNITS`       | `destination_review`   | `referredUnitIds: event.unitIds`                     |
 * | `ACCEPT_IN_PRINCIPLE`  | `accepted_awaiting_bed`| `acceptedUnitId: event.unitId`, `referredUnitIds: []`, `withdrawnReferrals: [...]` |
 * | `PULL_PATIENT`             | `pulled`             | `pullExpiresAt: event.now + 60` (requires the movement already at `accepted_awaiting_bed` with `acceptedUnitId === event.unitId`) |
 * | `DECLINE`              | `destination_review`   | `referredUnitIds`: filtered, `declines: [...]`       |
 * | `HANDOVER_READY`       | `handover_ready`       | `transport: {...}` (requires stage already `pulled`, so `acceptedUnitId`/`pullExpiresAt` carry over unchanged) |
 * | `PATIENT_COLLECTED`    | `moving`               | `transport.collectedAt: event.now` (requires `transport.enRouteAt` already set) |
 * | `PATIENT_ARRIVED`      | `arrived`              | `transport.arrivedAt: event.now`, `closure: {...}` (requires `acceptedUnitId` and `transport.collectedAt` already set) |
 *
 * Every other branch (`RECORD_EXAMINATION`, `TRANSPORT_ACCEPTED`, `TRANSPORT_EN_ROUTE`,
 * `CONFIRM_CAPACITY`, `RECORD_ESCALATION`, `RESET_SCENARIO`, `ADVANCE_CLOCK`) never assigns
 * `stage` on an existing movement, so it contributes no row.
 *
 * Chaining that table's preconditions gives the transitive implications the direct table alone
 * cannot: `ACCEPT_IN_PRINCIPLE` is the only branch that ever writes `acceptedUnitId`, and no
 * branch ever clears it, so every stage reachable only after `accepted_awaiting_bed` —
 * `accepted_awaiting_bed`, `pulled`, `handover_ready`, `moving`, `arrived` — requires it.
 * Symmetrically, `ACCEPT_IN_PRINCIPLE` rejects outright when `acceptedUnitId` is already set and
 * always advances the stage away from `destination_review` in that same update, so a movement
 * still at `placement_requested` or `destination_review` can never carry one. `HANDOVER_READY`
 * is the only branch that ever writes `transport`, and its own precondition is stage `pulled`
 * — which itself requires having already passed through `accepted_awaiting_bed` — so
 * `handover_ready` without `transport` is unreachable, and doubly so without `acceptedUnitId`.
 * This is exactly the R64 defect: the direct table alone (only `HANDOVER_READY`'s own row) would
 * have caught the missing `transport`, but not the missing `acceptedUnitId`, which only the
 * chained precondition surfaces.
 *
 * `pullExpiresAt` does not extend the same way past `pulled`: fixture authoring convention (both
 * hand-authored and generated) drops it once a movement moves on to `handover_ready` or later —
 * a hold that has already resulted in a handover is no longer "held" in the sense the field
 * describes — so the invariant below is scoped to `pulled` itself, matching the pre-existing,
 * previously-unproven fact that no `pulled` record lacks it. The same is true of `transport` at
 * `arrived`: the two current `arrived` records both close through a path that never had a
 * transport job at all, a state the existing test below deliberately keeps proving as legitimate
 * (a real `arrived` record with a transport job still must carry `arrivedAt`).
 *
 * Every rule below is read off `ward-flow-reducer.ts`'s transport transitions, not guessed:
 * - `PATIENT_COLLECTED` requires stage `"handover_ready"` and `transport.enRouteAt`, and moves
 *   the movement to stage `"moving"` while setting `transport.collectedAt` — so stage `"moving"`
 *   without `collectedAt` is unreachable.
 * - `PATIENT_ARRIVED` requires stage `"moving"` and `transport.collectedAt`, and moves the
 *   movement to stage `"arrived"` while setting `transport.arrivedAt` — so a movement with a
 *   transport job that is stage `"arrived"` and lacks `arrivedAt` is unreachable. (No current
 *   fixture record actually carries stage `"arrived"` together with a `transport` job — the two
 *   hand-authored and generated "arrived" records both close without ever having had transport at
 *   all — so this branch does not fire against today's data. It still guards a real invariant: a
 *   future "arrived" record that does carry a transport job must carry its arrival stamp too, and
 *   the mutation below (see the transport-stage-coherence report) proves the assertion still kills
 *   a violation when one is introduced.)
 * - `TRANSPORT_EN_ROUTE` requires `transport.acceptedAt`; `PATIENT_COLLECTED` requires
 *   `transport.enRouteAt`; `PATIENT_ARRIVED` requires `transport.collectedAt` — so the four
 *   transport stamps can only ever be present in the order acceptedAt, enRouteAt, collectedAt,
 *   arrivedAt: a later one is never set without every earlier one.
 * - Every event's `now` becomes the stamp it writes, and nothing in the reducer moves the clock
 *   backward, so on any real walk every stamp is `<= NOW_ANCHOR` and `>=` whichever stamp on the
 *   same job preceded it.
 */
describe("fixture stage/stamp coherence (ward-movements.ts)", () => {
  it("never leaves a 'moving' movement without the collection its stage implies", () => {
    // Counts records the assertion actually inspected (stage === "moving"), not every iteration
    // of the loop. A counter that increments on every movement regardless of stage would prove
    // only that `wardMovements` is non-empty — which is always true — not that this assertion
    // ever ran. That is the exact shape of defect this project has shipped before (Task 1's
    // privacy guard, whose loop bodies executed zero times and so could never fail).
    let matched = 0;
    for (const movement of wardMovements) {
      if (movement.stage === "moving") {
        matched += 1;
        expect(
          movement.transport?.collectedAt,
          `${movement.id} is stage "moving" but transport.collectedAt is unset — PATIENT_COLLECTED ` +
            `is the only reducer transition that produces "moving" and it always sets collectedAt`,
        ).toBeDefined();
      }
    }
    // Six records are stage "moving" today (WF-006, WF-014, WF-306, WF-313, WF-320, WF-327) — the
    // exact defect this fix corrects. If a future edit removed every "moving" record or renamed
    // the stage, this would go red instead of the assertion above silently inspecting nothing.
    expect(matched).toBeGreaterThan(0);
  });

  it("never leaves an 'arrived' movement's transport job without the arrival it implies", () => {
    let matched = 0;
    for (const movement of wardMovements) {
      if (movement.stage === "arrived" && movement.transport) {
        matched += 1;
        expect(
          movement.transport.arrivedAt,
          `${movement.id} is stage "arrived" with a transport job but transport.arrivedAt is unset`,
        ).toBeDefined();
      }
    }
    // 0 -> 6 on 2026-09-04, Task 6 (sweep R64) of the ward-flow movement step-track plan, a THIRD
    // instance of this same sweep's own defect class found while building its reachability test:
    // `PATIENT_ARRIVED` refuses outright unless `movement.stage === "moving" &&
    // movement.transport?.collectedAt`, so an "arrived" record with NO transport job at all — true
    // of both the hand-authored WF-007 and every generated "arrived" record until this fix — was a
    // state the reducer could never produce. `stageFields`'s `case "arrived"` (`ward-movements.ts`)
    // and WF-007 itself now both carry a completed transport job (`collectedAt` AND `arrivedAt`
    // set), the same fix `case "moving"` three lines above it already had. This assertion's own
    // job did not change: every "arrived" movement that carries a transport job must have
    // `arrivedAt` set on it, which the inner assertion above still checks per-movement and still
    // fails the moment one does not — only the COUNT this file expected to find matching the outer
    // condition moved, because the fixture correctly stopped being one of the records with no
    // transport job in the first place.
    expect(matched).toBe(6);
  });

  it("only ever fills transport stamps in the order the reducer allows, never after NOW_ANCHOR", () => {
    let inspected = 0;
    for (const movement of wardMovements) {
      const transport = movement.transport;
      if (!transport) continue;
      inspected += 1;
      const { acceptedAt, enRouteAt, collectedAt, arrivedAt } = transport;

      if (enRouteAt !== undefined) {
        expect(acceptedAt, `${movement.id} has transport.enRouteAt without transport.acceptedAt`).toBeDefined();
      }
      if (collectedAt !== undefined) {
        expect(enRouteAt, `${movement.id} has transport.collectedAt without transport.enRouteAt`).toBeDefined();
      }
      if (arrivedAt !== undefined) {
        expect(collectedAt, `${movement.id} has transport.arrivedAt without transport.collectedAt`).toBeDefined();
      }

      const stamps = [acceptedAt, enRouteAt, collectedAt, arrivedAt].filter(
        (stamp): stamp is number => stamp !== undefined,
      );
      for (const stamp of stamps) {
        expect(stamp, `${movement.id} has a transport stamp after NOW_ANCHOR (${NOW_ANCHOR})`).toBeLessThanOrEqual(
          NOW_ANCHOR,
        );
      }
      for (let i = 1; i < stamps.length; i += 1) {
        expect(stamps[i], `${movement.id}'s transport stamps are not in non-decreasing order`).toBeGreaterThanOrEqual(
          stamps[i - 1],
        );
      }
    }
    // Every movement with a transport job must actually have been walked — a filter that quietly
    // matched nothing would make every expectation above vacuously true.
    expect(inspected).toBeGreaterThan(0);
  });

  it("never leaves a 'handover_ready' movement without the transport its stage implies", () => {
    // Direct table entry: `HANDOVER_READY` is the only reducer branch that produces stage
    // "handover_ready", and it always writes a `transport` job in that same update
    // (`ward-flow-reducer.ts`'s own `case "HANDOVER_READY"`) — so "handover_ready" with no
    // `transport` is unreachable. Ruling R64: five records shipped in exactly that state.
    let matched = 0;
    for (const movement of wardMovements) {
      if (movement.stage === "handover_ready") {
        matched += 1;
        expect(
          movement.transport,
          `${movement.id} is stage "handover_ready" but has no transport job — HANDOVER_READY ` +
            `is the only reducer transition that produces "handover_ready" and it always creates one`,
        ).toBeDefined();
      }
    }
    // Two records are stage "handover_ready" today (WF-005, WF-015) after ruling R64 moved the
    // five that lacked a transport job back to the stage their own fields actually support.
    expect(matched).toBe(2);
  });

  it("never leaves an accepted, bed-held, handover-ready, moving or arrived movement without the accepted unit its stage implies", () => {
    // Transitive table entry: `ACCEPT_IN_PRINCIPLE` is the only branch that ever writes
    // `acceptedUnitId`, and no branch ever clears it, so every stage reachable only after
    // `accepted_awaiting_bed` requires one. `ward-model.test.ts` already proves this for
    // `accepted_awaiting_bed`/`pulled`; this closes the same invariant for the three stages
    // that test does not reach, including "handover_ready" — the second half of the R64 defect
    // (four of the five broken records had no `acceptedUnitId` at all, not just no transport).
    const requiresAcceptedUnit: MovementStage[] = [
      "accepted_awaiting_bed",
      "pulled",
      "handover_ready",
      "moving",
      "arrived",
    ];
    let matched = 0;
    for (const movement of wardMovements) {
      if (requiresAcceptedUnit.includes(movement.stage)) {
        matched += 1;
        expect(
          movement.acceptedUnitId,
          `${movement.id} is stage "${movement.stage}" but has no acceptedUnitId — only ` +
            `ACCEPT_IN_PRINCIPLE ever sets it and nothing later clears it`,
        ).toBeDefined();
      }
    }
    // 6 accepted_awaiting_bed + 7 pulled + 2 handover_ready + 6 moving + 6 arrived = 27 today.
    expect(matched).toBe(27);
  });

  /**
   * ⚠️ **THE FIXTURE ITSELF MUST NOT STATE AN UNLAWFUL PLACEMENT, AND UNTIL 2026-09-05 NOTHING
   * SAID SO.** `routineMovements` picks a generated destination by cohort and security and had
   * never looked at `authorised`; it merely happened not to land on either of the network's two
   * unauthorised units. When `be5327210` changed the destination pool's size and order, WF-318 —
   * referred for psychiatric examination, so requiring an authorised destination — landed on
   * `sjgs-adult-open`, which is private and not authorised under the Mental Health Act.
   *
   * The only thing that noticed was `buildActionInbox` reporting the patient as an exception, and
   * the test that caught THAT was counting four of the inbox's five categories, so it read as the
   * derivation being broken rather than the data. **A guard on the derivation cannot substitute
   * for a guard on the fixture**: the inbox's category count now includes this category, and it
   * would stay green if the generator regressed, because it counts what the fixture contains
   * rather than what the fixture is allowed to contain.
   *
   * This is not a synthetic-data tidiness rule. A detained patient recorded as accepted at a ward
   * that cannot lawfully hold them is a clinical falsehood on every screen that renders the
   * fixture.
   */
  it("never accepts a movement at a unit that cannot lawfully hold it", () => {
    const units = allUnits();
    let examined = 0;
    for (const movement of wardMovements) {
      if (movement.acceptedUnitId === undefined) continue;
      if (!requiresAuthorisedDestination(movement.legalStatus)) continue;
      const unit = units.find((candidate) => candidate.id === movement.acceptedUnitId);
      if (unit === undefined) continue;
      examined += 1;
      expect(
        unit.authorised,
        `${movement.id} is "${movement.legalStatus}" and is accepted at ${unit.id}, which is not ` +
          `authorised under the Mental Health Act — no destination generator or fixture author may ` +
          `produce this, whatever bed is free there`,
      ).toBe(true);
    }
    // ⚠️ Floor the POPULATION, never the violation count — a loop that examined nothing passes an
    // all-clear that means nothing. Measured 2026-09-05: 14 movements are examined here. The
    // floor is set well below that so an ordinary fixture edit does not trip it, while a change
    // that stops this loop finding detained-and-accepted movements at all still goes red.
    expect(
      examined,
      "no accepted movement requires an authorised destination — this test proved nothing",
    ).toBeGreaterThan(8);
  });

  it("never leaves a 'pulled' movement without the bed hold its stage implies", () => {
    // Direct table entry: `PULL_PATIENT` is the only branch that produces stage "pulled", and it
    // always writes `pullExpiresAt` in that same update. Unlike `acceptedUnitId`, fixture
    // authoring convention does not carry `pullExpiresAt` forward past "pulled" (a hold that
    // already resulted in a handover is no longer "held"), so this is scoped to "pulled" only.
    let matched = 0;
    for (const movement of wardMovements) {
      if (movement.stage === "pulled") {
        matched += 1;
        expect(
          movement.pullExpiresAt,
          `${movement.id} is stage "pulled" but has no pullExpiresAt — PULL_PATIENT is the only ` +
            `reducer transition that produces "pulled" and it always sets an expiry`,
        ).toBeDefined();
      }
    }
    expect(matched).toBe(7);
  });

  it("never lets a movement earlier than 'accepted_awaiting_bed' carry the accepted unit only a later stage should have", () => {
    // The mirror image of the acceptedUnitId invariant above: `ACCEPT_IN_PRINCIPLE` rejects
    // outright when `movement.acceptedUnitId` is already set, and the only way to reach
    // "placement_requested" or "destination_review" leaves acceptedUnitId untouched or unset —
    // so a movement still at either stage can never carry one. Currently zero records violate
    // this; asserting the real count (0), not `toBeGreaterThan(0)`, keeps that honest per the
    // match-counting rule rather than inventing a violation to get a positive count. The
    // mutation in the accompanying report proves this line still goes red the moment one exists.
    const preAcceptanceStages: MovementStage[] = ["placement_requested", "destination_review"];
    let matched = 0;
    for (const movement of wardMovements) {
      if (preAcceptanceStages.includes(movement.stage) && movement.acceptedUnitId !== undefined) {
        matched += 1;
      }
    }
    expect(matched).toBe(0);
  });

  it("never leaves a 'placement_requested' movement carrying a referral, decline or withdrawal RAISE_REFERRAL never wrote", () => {
    // Direct table entry: `RAISE_REFERRAL` is the only reducer branch that produces stage
    // "placement_requested", and it always creates the movement with `referredUnitIds: []`,
    // `declines: []` and `withdrawnReferrals: []` in that same update. Nothing can populate any
    // of the three while a movement is still "placement_requested": `REFER_TO_UNITS` is the only
    // branch that ever writes a non-empty `referredUnitIds`, and it always advances the stage to
    // "destination_review" in the same update; `DECLINE` requires the movement already at
    // "destination_review"; `ACCEPT_IN_PRINCIPLE` (the only writer of `withdrawnReferrals`) also
    // requires "destination_review". So a movement still at "placement_requested" must have all
    // three empty. This was the un-asserted RAISE_REFERRAL row R63/R64's own derivation table
    // named — WF-012 (review C2) shipped with a live `referredUnitIds` entry Graylands' own ward
    // screen could never see or answer, and WF-018 (review I6) shipped with a `withdrawnReferrals`
    // entry naming a referral it never received. Both are fixed on `ward-movements.ts`; this
    // closes the class rather than only the two instances.
    let matched = 0;
    for (const movement of wardMovements) {
      if (movement.stage === "placement_requested") {
        matched += 1;
        expect(
          movement.referredUnitIds,
          `${movement.id} is stage "placement_requested" but carries a live referral — only ` +
            `REFER_TO_UNITS ever populates referredUnitIds and it always moves the stage to ` +
            `"destination_review" in the same update`,
        ).toHaveLength(0);
        expect(
          movement.declines,
          `${movement.id} is stage "placement_requested" but carries a decline — DECLINE requires ` +
            `the movement already at "destination_review"`,
        ).toHaveLength(0);
        expect(
          movement.withdrawnReferrals,
          `${movement.id} is stage "placement_requested" but carries a withdrawn referral — only ` +
            `ACCEPT_IN_PRINCIPLE ever writes withdrawnReferrals and it requires "destination_review"`,
        ).toHaveLength(0);
      }
    }
    // 12 records are stage "placement_requested" today (WF-001, WF-012, WF-018, WF-301, WF-305,
    // WF-308, WF-312, WF-315, WF-319, WF-322, WF-326, WF-329) — measured directly against the real
    // fixture, not assumed.
    // 12 -> 14 on 2026-08-30. Both new long waits are `placement_requested` with no referral,
    // decline or withdrawal, which is what a patient nobody has yet referred anywhere looks like -
    // so they belong in this count and the coherence rule holds for both.
    // 14 -> 18 on 2026-09-04, Task 6 (sweep R64), defect 5a of the ward-flow movement step-track
    // plan: `routineMovements` remapped its four generated `destination_review` records to
    // `placement_requested` (`ward-movements.ts`), because every one of them carries an
    // unconditionally empty `referredUnitIds` AND an unconditionally empty `declines` — a state
    // `REFER_TO_UNITS`/`DECLINE` never leave a movement at `destination_review` in, exactly
    // mirroring the existing `handover_ready` remap three lines above `stageFields` in that same
    // file. They belong in THIS count for the same reason the two long waits above do: no
    // referral, decline or withdrawal is exactly what a patient nobody has yet referred anywhere
    // looks like. `WF-009` (empty referredUnitIds, two hand-authored declines) is untouched — it
    // is hand-authored, not generated, and its `declines` is genuinely non-empty.
    expect(matched, "the number of clean placement_requested movements changed").toBe(18);
  });

  it("never lets a movement carry a live referral outside the 'destination_review' stage REFER_TO_UNITS put it in", () => {
    // Direct table entry, the other half of the C2 fix: `REFER_TO_UNITS` is the only branch that
    // ever writes a non-empty `referredUnitIds`, always in the same update that sets stage to
    // "destination_review". `DECLINE` can shrink the array but never changes the stage away from
    // "destination_review", and `ACCEPT_IN_PRINCIPLE` always empties the array in the same update
    // that moves the stage past it. So a non-empty `referredUnitIds` is unreachable on any stage
    // other than "destination_review" — the exact shape of C2 (WF-012 held a referral while
    // "placement_requested", a stage the ward's own incoming-list filter never matches).
    let matched = 0;
    for (const movement of wardMovements) {
      if (movement.referredUnitIds.length > 0) {
        matched += 1;
        expect(
          movement.stage,
          `${movement.id} carries a live referral (${movement.referredUnitIds.join(", ")}) but is ` +
            `stage "${movement.stage}", not "destination_review" — REFER_TO_UNITS is the only ` +
            `reducer transition that populates referredUnitIds and it always sets this stage`,
        ).toBe("destination_review");
      }
    }
    // 4 records carry a live referral today (WF-002, WF-010, WF-013, WF-017), all at
    // "destination_review" — measured directly against the real fixture.
    expect(matched).toBe(4);
  });

  it("never leaves a withdrawn referral without the acceptance ACCEPT_IN_PRINCIPLE always pairs it with", () => {
    // Direct table entry: `ACCEPT_IN_PRINCIPLE` is the only reducer branch that ever writes to
    // `withdrawnReferrals`, and it always does so in the same update that sets `acceptedUnitId` —
    // withdrawing every other unit's live referral because this one just accepted. So a non-empty
    // `withdrawnReferrals` without an `acceptedUnitId` is unreachable. This is exactly I6: WF-018
    // shipped with a withdrawn-referral entry naming SCGH Older Adult while carrying no
    // acceptedUnitId, an empty referredUnitIds and an empty declines — a withdrawal for a referral
    // that was never raised.
    let matched = 0;
    for (const movement of wardMovements) {
      if (movement.withdrawnReferrals.length > 0) {
        matched += 1;
        expect(
          movement.acceptedUnitId,
          `${movement.id} carries a withdrawn referral but no acceptedUnitId — only ` +
            `ACCEPT_IN_PRINCIPLE ever writes withdrawnReferrals and it always sets acceptedUnitId ` +
            `in the same update`,
        ).toBeDefined();
      }
    }
    // 1 record carries a withdrawn referral today (WF-006, accepted at rgh-adult-secure) —
    // measured directly against the real fixture.
    expect(matched).toBe(1);
  });
});

describe("the fixture can demonstrate a wait longer than a day", () => {
  /*
   * WHY THIS EXISTS. `splitDuration` renders a day or more as "1d 6h" and `formatInstantWithDay`
   * says "yesterday" - and until 2026-08-30 no seeded record could produce either, because
   * `routineMovements` caps `openedAt` at `60 + ((index * 37) % 900)` minutes and every hand-seeded
   * movement waited hours. A capability nothing exercises is indistinguishable from one that does
   * not work, and the whole suite stays green either way. That is not hypothetical here: the
   * out-of-area screen rendered stays as "5041h 30m" for as long as it did precisely because no
   * assertion was ever about the format.
   *
   * So this asserts the DATA can reach the code path, which is a different claim from the code path
   * being correct - `tests/ward-clock.test.ts` makes that one.
   */
  it("holds open movements that have waited more than a day, and says so in days", () => {
    const longWaits = wardMovements
      .filter(isOpen)
      .map((movement) => ({ id: movement.id, minutes: NOW_ANCHOR - movement.openedAt }))
      .filter((entry) => entry.minutes > MINUTES_PER_DAY);

    expect(
      longWaits.map((entry) => entry.id).sort(),
      "the fixture no longer contains a wait longer than a day, so nothing on any screen can " +
        "demonstrate the day-scale clock. Adding the capability without data that reaches it is how " +
        "a feature everyone believes in ships broken: every test stays green because none of them " +
        "can produce the case.",
    ).toEqual(["WF-019", "WF-020"]);

    for (const entry of longWaits) {
      expect(
        splitDuration(entry.minutes),
        `${entry.id} waits ${entry.minutes} minutes and must render in days, not in hours`,
      ).toMatch(/^\d+d( \d+h)?$/);
    }
  });

  it("keeps one of them just over the boundary, where an hours-only formatter would look right", () => {
    // WF-020 waits 29 hours. A formatter that truncated to hours would render "29h 00m", which is
    // correct arithmetic and unreadable - and would look entirely plausible to a reviewer. The
    // boundary case is the one that catches a half-fix; a three-day wait would not.
    const wf020 = wardMovements.find((movement) => movement.id === "WF-020");
    expect(wf020, "WF-020 is the boundary case this file names; it must exist").toBeDefined();
    const minutes = NOW_ANCHOR - (wf020?.openedAt ?? NOW_ANCHOR);
    expect(minutes).toBeGreaterThan(MINUTES_PER_DAY);
    expect(minutes).toBeLessThan(2 * MINUTES_PER_DAY);
    expect(splitDuration(minutes)).toBe("1d 5h");
  });
});
