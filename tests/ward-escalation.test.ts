// tests/ward-escalation.test.ts
import { describe, expect, it } from "vitest";

import { escalationBoard, isOpen } from "../src/components/ward-management/ward-derivations";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { scenarioUnits } from "../src/components/ward-management/ward-scenarios";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const { movements, units } = seedWardFlowState();
const openMovements = movements.filter(isOpen);

describe("escalationBoard", () => {
  it("escalated contains exactly the open movements carrying a recorded escalation", () => {
    const board = escalationBoard(movements, units, NOW_ANCHOR);
    const expectedIds = openMovements
      .filter((movement) => movement.escalation !== undefined)
      .map((movement) => movement.id)
      .sort();
    expect(board.escalated.map((entry) => entry.movement.id).sort()).toEqual(expectedIds);
  });

  it("escalated resolves triedUnitIds to real Unit objects, one for one, on the real fixture", () => {
    const board = escalationBoard(movements, units, NOW_ANCHOR);
    for (const entry of board.escalated) {
      const escalation = entry.movement.escalation;
      if (!escalation) throw new Error(`${entry.movement.id} appears in escalated without an escalation record`);
      expect(entry.triedUnits.map((unit) => unit.id)).toEqual(escalation.triedUnitIds);
    }
  });

  // Measured directly against the real fixture at NOW_ANCHOR (2026-08-25), counting
  // `eligibility(...).eligible` across all 22 units for every open movement (never the
  // truncated length of `eligibleCandidatesAmong(...)`'s default 3-candidate shortlist, which
  // is a same-cohort count, not an eligibility count): 41 open movements, 337 eligible
  // movement/unit pairs, and exactly two movements — WF-009 and WF-308 — already have nowhere
  // eligible on the standard night. Both are the fixture as authored. Pinned by id and by exact
  // count so a regression that strands more (or fewer) patients is caught here, not only on
  // screen. See tests/ward-scenarios.test.ts's own comment for the same measurement.
  it("on the standard night, exactly WF-009 and WF-308 have nowhere eligible", () => {
    const board = escalationBoard(movements, units, NOW_ANCHOR);
    expect(board.nowhereEligible.map((movement) => movement.id).sort()).toEqual(["WF-009", "WF-308"]);
  });

  it("on the scarce night, nowhereEligible grows to the measured nine-movement set", () => {
    const scarceUnits = scenarioUnits("scarce");
    const board = escalationBoard(movements, scarceUnits, NOW_ANCHOR);
    // Measured directly against the real fixture at NOW_ANCHOR under scenarioUnits("scarce"):
    // 123 eligible movement/unit pairs, 9 movements stranded. Pinned exactly.
    expect(board.nowhereEligible.map((movement) => movement.id).sort()).toEqual([
      "WF-002",
      "WF-009",
      "WF-011",
      "WF-012",
      "WF-014",
      "WF-015",
      "WF-017",
      "WF-308",
      "WF-319",
    ]);
    // The honest empty state does not exist on either measured night — the scarce night is
    // strictly a superset of the standard night's two, never a disjoint or smaller set. This
    // guards against a scenario change that shrinks the scarce list back toward the standard
    // one, which would quietly undercut the point of the scarce scenario.
    const standardBoard = escalationBoard(movements, units, NOW_ANCHOR);
    const standardIds = new Set(standardBoard.nowhereEligible.map((movement) => movement.id));
    for (const id of standardIds) {
      expect(board.nowhereEligible.map((movement) => movement.id)).toContain(id);
    }
    expect(board.nowhereEligible.length).toBeGreaterThan(standardBoard.nowhereEligible.length);
  });

  it("excludes closed movements from both groups", () => {
    const closedWithEscalation = movements.find((movement) => movement.escalation !== undefined && !isOpen(movement));
    // The real fixture carries no closed movement with a recorded escalation (escalation only
    // makes sense for a patient still travelling through the pathway), so this constructs the
    // precondition explicitly rather than weakening the assertion — the same move Tasks 2, 3 and
    // 4 all had to make when a literal fixture lookup would not produce what the assertion needs.
    const syntheticClosedEscalated =
      closedWithEscalation ??
      (() => {
        const base = movements.find((movement) => movement.escalation !== undefined);
        if (!base) throw new Error("fixture carries no movement with a recorded escalation to build the case from");
        return {
          ...base,
          id: "WF-TEST-CLOSED-ESCALATED",
          closure: { at: NOW_ANCHOR, outcome: "arrived" as const, reason: "Test fixture: arrived" },
        };
      })();

    expect(isOpen(syntheticClosedEscalated)).toBe(false);

    const board = escalationBoard([...movements, syntheticClosedEscalated], units, NOW_ANCHOR);
    expect(board.escalated.map((entry) => entry.movement.id)).not.toContain(syntheticClosedEscalated.id);
    expect(board.nowhereEligible.map((movement) => movement.id)).not.toContain(syntheticClosedEscalated.id);
  });
});
