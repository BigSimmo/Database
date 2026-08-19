// tests/ward-derivations.test.ts
import { describe, expect, it } from "vitest";

import { clockState } from "../src/components/ward-management/ward-clock";
import { buildActionInbox } from "../src/components/ward-management/ward-derivations";
import { PARALLEL_REFERRAL_CAP } from "../src/components/ward-management/ward-model";
import { wardMovements } from "../src/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

describe("buildActionInbox", () => {
  // RULING 1 (Task 8): buildActionInbox used to build each of its three categories with
  // `.find()`, so it could only ever report one movement per category. The real fixture at
  // NOW_ANCHOR carries more than one qualifying movement in two of the three categories — a
  // drawer built on `.find()` would tell a coordinator a single legal breach exists when several
  // do. Expected numbers here are derived from `wardMovements` itself, never hard-coded, so this
  // test keeps proving the real count rather than pinning today's fixture size.
  it("emits one item per movement that carries a breached legal deadline, not just the first", () => {
    const expectedIds = wardMovements
      .filter((movement) => movement.legalForm && clockState(movement.legalForm.dueAt, NOW_ANCHOR) === "breached")
      .map((movement) => `legal-${movement.id}`)
      .sort();

    const items = buildActionInbox(wardMovements, NOW_ANCHOR)
      .filter((item) => item.id.startsWith("legal-"))
      .map((item) => item.id)
      .sort();

    expect(expectedIds.length).toBeGreaterThan(1);
    expect(items).toEqual(expectedIds);
  });

  it("emits one item per movement that reached the parallel-referral cap, not just the first", () => {
    const expectedIds = wardMovements
      .filter((movement) => movement.declines.length >= PARALLEL_REFERRAL_CAP)
      .map((movement) => `declines-${movement.id}`)
      .sort();

    const items = buildActionInbox(wardMovements, NOW_ANCHOR)
      .filter((item) => item.id.startsWith("declines-"))
      .map((item) => item.id)
      .sort();

    expect(items).toEqual(expectedIds);
  });

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
  it("returns exactly as many items as the three categories combined — no more, no fewer", () => {
    const legalCount = wardMovements.filter(
      (movement) => movement.legalForm && clockState(movement.legalForm.dueAt, NOW_ANCHOR) === "breached",
    ).length;
    const declineCount = wardMovements.filter((movement) => movement.declines.length >= PARALLEL_REFERRAL_CAP).length;
    const transportCount = wardMovements.filter(
      (movement) =>
        movement.transport?.acceptedAt !== undefined &&
        movement.transport.enRouteAt === undefined &&
        movement.transport.cancelledAt === undefined,
    ).length;

    expect(buildActionInbox(wardMovements, NOW_ANCHOR)).toHaveLength(legalCount + declineCount + transportCount);
  });

  it("gives every item a unique id even with several movements in the same category", () => {
    const items = buildActionInbox(wardMovements, NOW_ANCHOR);
    const ids = items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
