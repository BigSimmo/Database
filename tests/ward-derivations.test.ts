// tests/ward-derivations.test.ts
import { describe, expect, it } from "vitest";

import { clockState } from "../src/components/ward-management/ward-clock";
import {
  buildActionInbox,
  eligibleCandidatesAmong,
  restrictionNotice,
  transportLeg,
} from "../src/components/ward-management/ward-derivations";
import { eligibility } from "../src/components/ward-management/ward-eligibility";
import {
  DECLINE_REASONS,
  PARALLEL_REFERRAL_CAP,
  type Decline,
  type Movement,
  type TransportJob,
} from "../src/components/ward-management/ward-model";
import { wardMovements } from "../src/components/ward-management/ward-movements";
import { allUnits, NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

function transportJob(overrides: Partial<TransportJob> = {}): TransportJob {
  return {
    id: "TR-TEST",
    provider: "St John WA",
    escortRequired: true,
    ...overrides,
  };
}

// A real, valid, open fixture movement to spread from when a test needs to inject its own
// movement list — same approach as tests/ward-pressure.test.ts's `movementFrom`. Object.assign
// rather than spread, because `{ ...base, ...Partial<T> }` widens every overridden field back to
// optional under TypeScript's spread-merge rules even though every field is present at runtime.
const inboxBaseMovement = wardMovements.find((movement) => movement.id === "WF-002");
if (!inboxBaseMovement) throw new Error("Fixture movement WF-002 is required as a template for ward-derivations tests");

function movementFrom(overrides: Partial<Movement>): Movement {
  return Object.assign({}, inboxBaseMovement, overrides);
}

describe("buildActionInbox", () => {
  // RULING 1 (Task 8): buildActionInbox used to build each of its three categories with
  // `.find()`, so it could only ever report one movement per category. Expected numbers here
  // are derived from `wardMovements` itself, never hard-coded, so this test keeps proving the
  // real count rather than pinning today's fixture size — a shape kept below even though the
  // legal-timing category is dormant (see the next test): if a `dueAt` ever returns to this
  // fixture, `.find()` regressing to one-item-per-category must still be caught here.
  it("emits no legal-timing item for the real fixture, which carries no past-due deadline", () => {
    const expectedIds = wardMovements
      .filter(
        (movement) =>
          movement.legalForm?.dueAt !== undefined && clockState(movement.legalForm.dueAt, NOW_ANCHOR) === "breached",
      )
      .map((movement) => `legal-${movement.id}`)
      .sort();

    const items = buildActionInbox(wardMovements, NOW_ANCHOR)
      .filter((item) => item.id.startsWith("legal-"))
      .map((item) => item.id)
      .sort();

    // 2026-08-23: neither a Form 1A nor a Form 3B carries a `dueAt` any longer (see
    // `LegalForm`'s own doc comment in ward-model.ts) — the only other legal-form kinds in this
    // fixture, the transport/transfer forms 4A/4C, still carry one but are not currently due in
    // the past — so this category is empty on today's fixture. `expectedIds`/`items` still
    // agreeing on that, computed independently, is the proof that `buildActionInbox` itself has
    // not silently started fabricating a breach.
    //
    // This is an ABSENCE check and cannot catch a `.find()` regression. The positive proof that
    // the legal category emits one item PER movement lives in the next test, which injects its
    // own movements rather than relying on a fixture that no longer contains a breach.
    expect(expectedIds).toHaveLength(0);
    expect(items).toEqual(expectedIds);
  });

  /**
   * Fix wave 1, finding 3 — the restored `.find()`-regression guard for the legal category.
   *
   * The original test asserted `expectedIds.length > 1` against the real fixture. After the
   * 2026-08-23 correction the fixture carries no past-due 1A/3B at all, so that assertion was
   * changed to `toHaveLength(0)` and the guard silently stopped guarding: appending `.slice(0, 1)`
   * to `breachedLegal` in ward-derivations.ts — the exact historical `.find()` regression this
   * test exists to catch — left the whole suite green (measured: 45 passed).
   *
   * `buildActionInbox(movements, now)` takes an explicit array, so the fix is to inject two
   * qualifying movements instead of hoping the fixture contains some. Both carry a Form **4A**
   * ("Transport order"), which is about moving a person and is unrelated to the examination
   * timeline this project's fabrications were about. The `- 20` and `- 90` offsets are arbitrary
   * test scaffolding chosen to sit in the past; they are NOT Mental Health Act figures and
   * nothing derives them from one.
   */
  it("emits a legal-timing item for EVERY past-due movement, not just the first", () => {
    const first = movementFrom({
      id: "TEST-legal-one",
      legalForm: { code: "4A", kind: "transport", dueAt: NOW_ANCHOR - 20 },
    });
    const second = movementFrom({
      id: "TEST-legal-two",
      legalForm: { code: "4A", kind: "transport", dueAt: NOW_ANCHOR - 90 },
    });
    const notDue = movementFrom({
      id: "TEST-legal-not-due",
      legalForm: { code: "4A", kind: "transport", dueAt: NOW_ANCHOR + 500 },
    });

    const items = buildActionInbox([first, second, notDue], NOW_ANCHOR)
      .filter((item) => item.id.startsWith("legal-"))
      .map((item) => item.id)
      .sort();

    // Both past-due movements, and only those two. `.slice(0, 1)` or a `.find()` yields one id
    // and fails; a filter that ignored `clockState` would also emit the not-due one and fail.
    expect(items).toEqual(["legal-TEST-legal-one", "legal-TEST-legal-two"]);
  });

  // Regression proof for the 2026-08-23 correction: WF-303 is the real fixture Form 1A that an
  // earlier, now-deleted authored `dueAt` made "breached" at `NOW_ANCHOR` (an arbitrary window
  // unrelated to how long the patient had actually waited — see the fixture's own file header).
  // It must never surface a "legal-WF-303" inbox item, because the form now carries no deadline
  // at all.
  it("never lists a legal-timing item for WF-303, a long-waiting Form 1A with no dueAt", () => {
    const movement = wardMovements.find((candidate) => candidate.id === "WF-303");
    expect(movement?.legalForm?.code).toBe("1A");
    expect(movement?.legalForm?.dueAt).toBeUndefined();

    const items = buildActionInbox(wardMovements, NOW_ANCHOR);
    expect(items.find((item) => item.id === "legal-WF-303")).toBeUndefined();
  });

  // Fix wave 2, finding 3. Exactly one fixture movement (WF-009) reaches the cap, so this
  // fixture-derived test could not catch a one-item regression: `.slice(0, 1)` on
  // `heavilyDeclined` left it green (measured: 19 passed). It is kept — agreement between two
  // independently computed lists is still worth pinning — but the positive proof now lives in the
  // injected test below, and the floor here stops it degrading into a pure absence check if the
  // fixture ever loses WF-009.
  it("emits one item per movement that reached the parallel-referral cap, not just the first", () => {
    const expectedIds = wardMovements
      .filter((movement) => movement.declines.length >= PARALLEL_REFERRAL_CAP)
      .map((movement) => `declines-${movement.id}`)
      .sort();

    const items = buildActionInbox(wardMovements, NOW_ANCHOR)
      .filter((item) => item.id.startsWith("declines-"))
      .map((item) => item.id)
      .sort();

    expect(expectedIds.length, "the fixture no longer contains a capped movement").toBeGreaterThan(0);
    expect(items).toEqual(expectedIds);
  });

  // The `.find()`-regression guard for the declines category, on injected movements so it does not
  // depend on how many fixture movements happen to qualify. No legal form and no deadline is
  // involved here at all — this category counts declines.
  it("emits a declines item for EVERY capped movement, not just the first", () => {
    const decline = (unitId: string): Decline => ({ unitId, at: NOW_ANCHOR - 60, reason: DECLINE_REASONS[0] });
    const capped = (id: string): Movement =>
      movementFrom({ id, declines: [decline("unit-a"), decline("unit-b"), decline("unit-c")] });
    const underCap = movementFrom({ id: "TEST-declines-under", declines: [decline("unit-a")] });

    expect(capped("TEST-declines-one").declines.length, "fixture assumption: three declines meets the cap").toBe(
      PARALLEL_REFERRAL_CAP,
    );

    const items = buildActionInbox([capped("TEST-declines-one"), capped("TEST-declines-two"), underCap], NOW_ANCHOR)
      .filter((item) => item.id.startsWith("declines-"))
      .map((item) => item.id)
      .sort();

    expect(items).toEqual(["declines-TEST-declines-one", "declines-TEST-declines-two"]);
  });

  // Fix wave 2, finding 3 — checked for the same shape as the declines category above. Two
  // fixture movements currently qualify, so a one-item regression IS caught here today; the floor
  // below is what keeps that true if the fixture changes, and the injected test after it does not
  // depend on the fixture at all.
  it("emits one item per movement with transport accepted but not yet en route, not just the first", () => {
    const expectedIds = wardMovements
      .filter(
        (movement) =>
          movement.transport?.acceptedAt !== undefined &&
          movement.transport.enRouteAt === undefined &&
          movement.transport.cancelledAt === undefined,
      )
      .map((movement) => `transport-${movement.id}`)
      .sort();

    expect(expectedIds.length, "the fixture no longer contains a stalled transport").toBeGreaterThan(1);

    const items = buildActionInbox(wardMovements, NOW_ANCHOR)
      .filter((item) => item.id.startsWith("transport-"))
      .map((item) => item.id)
      .sort();

    expect(expectedIds.length).toBeGreaterThan(1);
    expect(items).toEqual(expectedIds);
  });

  // The drawer's toggle count and the drawer's own rendered rows must agree (Task 8 ruling 3).
  // This is the model-side half of that guarantee: the total item count really is the sum of
  // every category's own real count, never a number computed independently of the rows below it.
  it("lists expired bed holds so a lapsed reservation cannot disappear silently", () => {
    const expired = wardMovements.find((movement) => movement.id === "WF-004")!;
    expect(expired.bedHeldUntil).toBeLessThan(NOW_ANCHOR);

    expect(buildActionInbox(wardMovements, NOW_ANCHOR)).toContainEqual(
      expect.objectContaining({
        id: "bed-hold-WF-004",
        title: "Bed hold expired",
        movementId: "WF-004",
      }),
    );
  });

  it("returns exactly as many items as the four categories combined — no more, no fewer", () => {
    const legalCount = wardMovements.filter(
      (movement) =>
        movement.legalForm?.dueAt !== undefined && clockState(movement.legalForm.dueAt, NOW_ANCHOR) === "breached",
    ).length;
    const declineCount = wardMovements.filter((movement) => movement.declines.length >= PARALLEL_REFERRAL_CAP).length;
    const transportCount = wardMovements.filter(
      (movement) =>
        movement.transport?.acceptedAt !== undefined &&
        movement.transport.enRouteAt === undefined &&
        movement.transport.cancelledAt === undefined,
    ).length;
    const expiredHoldCount = wardMovements.filter(
      (movement) =>
        movement.stage === "bed_held" && movement.bedHeldUntil !== undefined && movement.bedHeldUntil < NOW_ANCHOR,
    ).length;

    expect(buildActionInbox(wardMovements, NOW_ANCHOR)).toHaveLength(
      legalCount + declineCount + transportCount + expiredHoldCount,
    );
  });

  it("gives every item a unique id even with several movements in the same category", () => {
    const items = buildActionInbox(wardMovements, NOW_ANCHOR);
    const ids = items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // Task 6A: WF-003 is a real fixture Form 3B, which honestly carries no dueAt — the clinician,
  // asked directly, settled that the post-examination clock is elapsed ED wait counting up, not a
  // countdown, so this model records no deadline for a 3B. It must never surface a "legal-WF-003"
  // inbox item, however long it has been open — a form with no deadline is never breached.
  it("never lists a legal-timing item for a movement whose form has no dueAt", () => {
    const movement = wardMovements.find((candidate) => candidate.id === "WF-003");
    expect(movement?.legalForm?.code).toBe("3B");
    expect(movement?.legalForm?.dueAt).toBeUndefined();

    const items = buildActionInbox(wardMovements, NOW_ANCHOR);
    expect(items.find((item) => item.id === "legal-WF-003")).toBeUndefined();
  });
});

describe("eligibleCandidatesAmong", () => {
  /**
   * R79, adopted from the diverged branch (`5ae4fbf43`) and adapted to this side's signature —
   * theirs called `eligibleCandidates(movement, now, limit, units)`, which no longer exists here.
   * Whole-branch review Critical 1 at unit level: this side proves the same property in Playwright
   * (`ui-ward-roles.spec.ts`, "live capacity"), but a vitest assertion is sharper and cheaper, so
   * both are kept. The mutation that kills it is reverting `eligibleCandidatesAmong` to read
   * `allUnits()` internally — then the exhausted copy is never consulted and the second
   * expectation reads `true`.
   */
  it("evaluates candidates against the caller's live unit state, not the frozen fixture", () => {
    const movement = wardMovements.find((candidate) => candidate.id === "WF-001")!;
    const liveUnits = allUnits();
    const original = eligibleCandidatesAmong(movement, liveUnits, NOW_ANCHOR, Number.POSITIVE_INFINITY).find(
      (candidate) => candidate.unit.id === "rph-adult-secure",
    );
    expect(original?.verdict.eligible).toBe(true);

    const exhaustedUnits = liveUnits.map((unit) =>
      unit.id === "rph-adult-secure" ? { ...unit, allocatable: { ...unit.allocatable, value: 0 } } : unit,
    );
    const exhausted = eligibleCandidatesAmong(movement, exhaustedUnits, NOW_ANCHOR, Number.POSITIVE_INFINITY).find(
      (candidate) => candidate.unit.id === "rph-adult-secure",
    );
    expect(exhausted?.verdict.eligible).toBe(false);
  });

  // Fix round 1, Finding 2. The two-pass truncate-then-reorder fix only had incidental coverage
  // before this: one Playwright assertion on one unit name for one movement, and the vitest
  // contract test that also exercises this function calls it with `Number.POSITIVE_INFINITY`, so
  // truncation never engages there at all. This pins the actual invariant directly, against the
  // real fixture: reordering by restrictiveness must never change WHICH candidates are in the
  // top-`PARALLEL_REFERRAL_CAP` cut, only their order within it. Restoring the original one-pass
  // version (reorder-then-truncate) turns this red — see the task report for the captured output.
  //
  // The "expected" set below is deliberately reimplemented from `allUnits()`/`eligibility()`
  // directly, never derived by calling `eligibleCandidatesAmong(..., Infinity)` — an Infinity call
  // still runs the function's OWN second (restriction-reorder) pass over the whole cohort, which
  // would make the oracle circular: re-sorting that already-reordered array by eligibility alone
  // does not recover the raw `allUnits()`-order tie-break, so slicing it would silently compare
  // the implementation against a copy of itself instead of an independent ground truth.
  it("reorders by restrictiveness within the eligible-first cut without ever changing which candidates are in it", () => {
    const CAP = PARALLEL_REFERRAL_CAP;
    let provedAMixedReorder = false;

    for (const movement of wardMovements) {
      const cohortUnits = allUnits().filter((unit) => unit.cohort === movement.cohort);
      if (cohortUnits.length <= CAP) continue; // truncation never engages for this movement

      const eligibleFirstOnly = cohortUnits
        .map((unit) => ({ unit, verdict: eligibility(movement, unit, NOW_ANCHOR) }))
        .sort((a, b) => Number(b.verdict.eligible) - Number(a.verdict.eligible))
        .slice(0, CAP);

      const capped = eligibleCandidatesAmong(movement, allUnits(), NOW_ANCHOR, CAP);
      const cappedIds = new Set(capped.map((candidate) => candidate.unit.id));
      const expectedIds = new Set(eligibleFirstOnly.map((candidate) => candidate.unit.id));
      expect(cappedIds, `${movement.id}: top-${CAP} membership must match the eligible-first cut`).toEqual(expectedIds);

      // Only counts as proof of the REORDER (not just the slice) if this movement's cut actually
      // mixes a restricted and an unrestricted candidate — otherwise the second sort pass is a
      // no-op for this movement and it proves nothing about reordering, only about truncation.
      const anyRestricted = capped.some((candidate) => restrictionNotice(movement, candidate.unit) !== undefined);
      const anyUnrestricted = capped.some((candidate) => restrictionNotice(movement, candidate.unit) === undefined);
      if (anyRestricted && anyUnrestricted) provedAMixedReorder = true;
    }

    expect(
      provedAMixedReorder,
      "fixture assumption: at least one movement's top-N cut mixes restricted and unrestricted candidates",
    ).toBe(true);
  });
});

describe("transportLeg", () => {
  // RULING (Task 10 prep): transportStatusLabel mixes the discrete transport leg with
  // provider prose, so a caller that needs "which leg is this job on" cannot use it directly —
  // two of its seven outputs embed the provider name instead of a leg name. transportLeg
  // exists to give that caller a value that is always exactly one of the five capitalised leg
  // names, or a distinct "Cancelled"/absent value, never prose. The real fixture only exercises
  // "Accepted" and "En route" (all 8 transport jobs carry acceptedAt; 6 of those also carry
  // enRouteAt), so every case here is built directly rather than pulled from wardMovements —
  // otherwise this test would silently prove far less than its name claims.

  it("returns undefined when the movement carries no transport job at all", () => {
    expect(transportLeg(undefined)).toBeUndefined();
  });

  it("returns Requested for a transport job with no stamps at all", () => {
    expect(transportLeg(transportJob())).toBe("Requested");
  });

  it("returns Accepted once acceptedAt is stamped", () => {
    expect(transportLeg(transportJob({ acceptedAt: NOW_ANCHOR - 10 }))).toBe("Accepted");
  });

  it("returns En route once enRouteAt is stamped", () => {
    expect(transportLeg(transportJob({ acceptedAt: NOW_ANCHOR - 20, enRouteAt: NOW_ANCHOR - 10 }))).toBe("En route");
  });

  it("returns Collected once collectedAt is stamped", () => {
    expect(
      transportLeg(
        transportJob({ acceptedAt: NOW_ANCHOR - 30, enRouteAt: NOW_ANCHOR - 20, collectedAt: NOW_ANCHOR - 10 }),
      ),
    ).toBe("Collected");
  });

  it("returns Arrived once arrivedAt is stamped", () => {
    expect(
      transportLeg(
        transportJob({
          acceptedAt: NOW_ANCHOR - 40,
          enRouteAt: NOW_ANCHOR - 30,
          collectedAt: NOW_ANCHOR - 20,
          arrivedAt: NOW_ANCHOR - 10,
        }),
      ),
    ).toBe("Arrived");
  });

  it("returns Cancelled when cancelledAt is stamped, distinct from every leg", () => {
    expect(transportLeg(transportJob({ cancelledAt: NOW_ANCHOR - 5 }))).toBe("Cancelled");
  });

  it("resolves precedence to the furthest-progressed stamp when several are set at once, and cancelledAt always wins", () => {
    const fullyProgressed = transportJob({
      acceptedAt: NOW_ANCHOR - 40,
      enRouteAt: NOW_ANCHOR - 30,
      collectedAt: NOW_ANCHOR - 20,
      arrivedAt: NOW_ANCHOR - 10,
    });
    expect(transportLeg(fullyProgressed)).toBe("Arrived");

    const cancelledAfterProgress = transportJob({
      acceptedAt: NOW_ANCHOR - 40,
      enRouteAt: NOW_ANCHOR - 30,
      collectedAt: NOW_ANCHOR - 20,
      arrivedAt: NOW_ANCHOR - 10,
      cancelledAt: NOW_ANCHOR - 5,
    });
    expect(transportLeg(cancelledAfterProgress)).toBe("Cancelled");
  });
});
