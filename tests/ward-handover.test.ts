// tests/ward-handover.test.ts
import { describe, expect, it } from "vitest";

import { handoverSnapshot, isOpen, transportLeg } from "../src/components/ward-management/ward-derivations";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const { movements, units } = seedWardFlowState();
const openMovements = movements.filter(isOpen);
const snapshot = handoverSnapshot(movements, units, NOW_ANCHOR);

describe("handoverSnapshot", () => {
  it("freezes at exactly the now it was called with", () => {
    expect(snapshot.frozenAt).toBe(NOW_ANCHOR);
  });

  it("ranks every open movement by wait, strictly non-increasing, longest first", () => {
    expect(snapshot.longestWaits).toHaveLength(openMovements.length);
    expect(snapshot.longestWaits.map((entry) => entry.movement.id).sort()).toEqual(
      openMovements.map((movement) => movement.id).sort(),
    );

    const waits = snapshot.longestWaits.map((entry) => NOW_ANCHOR - entry.movement.openedAt);
    for (let index = 1; index < waits.length; index += 1) {
      expect(waits[index]).toBeLessThanOrEqual(waits[index - 1]);
    }

    const maxWait = Math.max(...openMovements.map((movement) => NOW_ANCHOR - movement.openedAt));
    expect(waits[0]).toBe(maxWait);
  });

  // A non-vacuity floor: the fixture carries 41 open movements at NOW_ANCHOR (measured, not
  // assumed). This fails the moment the fixture stops producing a real open caseload — a
  // breach-led handover with nothing left to rank would otherwise pass silently.
  it("a non-vacuity floor: the open caseload stays real, not near-empty", () => {
    expect(snapshot.longestWaits.length).toBeGreaterThan(30);
  });

  it("heldBeds contains exactly the open movements carrying a bedHeldUntil, expired iff bedHeldUntil <= now", () => {
    const expectedIds = openMovements
      .filter((movement) => movement.bedHeldUntil !== undefined)
      .map((movement) => movement.id)
      .sort();
    expect(snapshot.heldBeds.map((entry) => entry.movement.id).sort()).toEqual(expectedIds);

    // Measured against the real fixture at NOW_ANCHOR: 7 beds held, 1 already expired. Pinned
    // so a fixture change that silently drops a hold is caught here, not only on screen.
    expect(snapshot.heldBeds).toHaveLength(7);
    expect(snapshot.heldBeds.filter((entry) => entry.expired)).toHaveLength(1);

    for (const entry of snapshot.heldBeds) {
      const bedHeldUntil = entry.movement.bedHeldUntil;
      if (bedHeldUntil === undefined) {
        throw new Error(`${entry.movement.id} appears in heldBeds without a bedHeldUntil`);
      }
      expect(entry.expired).toBe(bedHeldUntil <= NOW_ANCHOR);
    }
  });

  it("inTransit contains exactly the open movements carrying a transport job, each with its real leg", () => {
    const expectedIds = openMovements
      .filter((movement) => movement.transport !== undefined)
      .map((movement) => movement.id)
      .sort();
    expect(snapshot.inTransit.map((entry) => entry.movement.id).sort()).toEqual(expectedIds);

    // Measured against the real fixture at NOW_ANCHOR: 8 movements carry a transport job.
    expect(snapshot.inTransit).toHaveLength(8);

    for (const entry of snapshot.inTransit) {
      expect(entry.leg).toBe(transportLeg(entry.movement.transport));
    }
  });

  it("placementGoneWrong lists an escalated or declined-by-all movement exactly once each", () => {
    const escalated = openMovements.filter((movement) => movement.escalation !== undefined);
    const declinedByAll = openMovements.filter(
      (movement) =>
        movement.escalation === undefined && movement.referredUnitIds.length === 0 && movement.declines.length > 0,
    );
    const expectedIds = [...escalated, ...declinedByAll].map((movement) => movement.id).sort();

    const actualIds = snapshot.placementGoneWrong.map((entry) => entry.movement.id);
    expect([...actualIds].sort()).toEqual(expectedIds);
    expect(new Set(actualIds).size).toBe(actualIds.length);

    for (const entry of snapshot.placementGoneWrong) {
      const expectedKind = entry.movement.escalation !== undefined ? "escalated" : "declined_by_all";
      expect(entry.kind).toBe(expectedKind);
    }
  });

  // Measured against the real fixture at NOW_ANCHOR (2026-08-25): WF-009 is the only movement
  // carrying a recorded escalation, and no other movement satisfies declined-by-all once
  // WF-009's escalation claims it first. Pinned so a future fixture change that silently drops
  // the escalation, or adds a second stranded movement, is caught here rather than only in a
  // screenshot.
  it("matches the measured fixture: WF-009 escalated, nothing else stranded", () => {
    expect(snapshot.placementGoneWrong.map((entry) => entry.movement.id)).toEqual(["WF-009"]);
    expect(snapshot.placementGoneWrong[0]?.kind).toBe("escalated");
  });
});
