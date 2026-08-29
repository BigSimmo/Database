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

  // RE-MEASURED on 2026-08-29 at NOW_ANCHOR against this file's own basis — `seedWardFlowState()`'s
  // `movements` and `units`, not another file's fixture read — counting `eligibility(...).eligible`
  // for every open movement (never the truncated length of `eligibleCandidatesAmong(...)`'s default
  // 3-candidate shortlist, which is a same-cohort count, not an eligibility count): 23 units,
  // 41 open movements, 342 eligible movement/unit pairs, distribution
  // {0:2, 4:11, 5:3, 6:4, 7:2, 11:1, 12:9, 14:9}, and exactly two movements — WF-009 and WF-308 —
  // already have nowhere eligible on the standard night. Both are the fixture as authored. Pinned
  // by id so a regression that strands more (or fewer) patients is caught here, not only on screen.
  //
  // It replaces a 2026-08-25 record of 337 pairs over 22 units. Do not read the change as the 23rd
  // unit arriving: recomputing without `bty-youth` still gives 342, and no open movement is
  // eligible for it at all. The five extra pairs are the gates and the fixture moving across
  // Phase 5 to Phase 8. tests/ward-scenarios.test.ts carries the same measurement, taken on ITS
  // basis (`scenarioUnits("standard")` and `wardMovements`) and agreeing figure for figure — the
  // two were measured separately rather than copied, because they are not the same read.
  it("on the standard night, exactly WF-009 and WF-308 have nowhere eligible", () => {
    const board = escalationBoard(movements, units, NOW_ANCHOR);
    expect(
      board.nowhereEligible.map((movement) => movement.id).sort(),
      "The set of patients with nowhere to go on an ORDINARY night has changed. This is a clinical " +
        "fact about the demonstration, not a test detail: every id here is a movement the network " +
        "cannot place at all, and the escalation board exists to show exactly these. A LONGER list " +
        "means a gate or the fixture now strands someone it used to place - investigate the gate " +
        "before touching this line. A SHORTER list is not automatically good either; it can mean a " +
        "gate stopped rejecting something it should reject. Re-measure and re-date the comment " +
        "above rather than editing these ids to match what the code now does.",
    ).toEqual(["WF-009", "WF-308"]);
  });

  it("on the scarce night, nowhereEligible grows to the measured nine-movement set", () => {
    const scarceUnits = scenarioUnits("scarce");
    const board = escalationBoard(movements, scarceUnits, NOW_ANCHOR);
    // RE-MEASURED 2026-08-30 on this file's own basis (`seedWardFlowState()` movements against
    // `scenarioUnits("scarce")`, counting `eligibility(...).eligible`): 41 open movements, 23 units,
    // 98 eligible movement/unit pairs, 9 movements stranded. Pinned exactly.
    //
    // The pair count previously read 123, and that was WRONG rather than stale. Every other figure
    // re-measures unchanged - 342 standard pairs, 9 stranded, 23 units, 41 open - and a fixture
    // that had drifted enough to move the scarce total by 25 could not have left the other four
    // identical. So this reads as an error at the moment it was written rather than the fixture
    // moving underneath it. Recorded rather than quietly renumbered, because "adjust the number and
    // keep the date" is exactly how the 2026-08-25 record in this file went stale in substance.
    //
    // Nothing was ever red: no assertion reads the pair count, so a comment can carry a wrong
    // figure here indefinitely. tests/ward-scenarios.test.ts measures 98 independently on ITS basis.
    expect(
      board.nowhereEligible.map((movement) => movement.id).sort(),
      "The scarce night's stranded set has changed. The scarce scenario exists to produce the hard " +
        "case - patients the network genuinely cannot place - so this list IS the scenario's reason " +
        "for existing. It must stay a strict superset of the standard night's two, WF-009 and " +
        "WF-308, which the assertion below checks separately: the scarce night is the standard " +
        "night with fewer beds, never a different night. If this list shrank, the scenario has " +
        "stopped demonstrating the thing the escalation and out-of-area screens answer.",
    ).toEqual(["WF-002", "WF-009", "WF-011", "WF-012", "WF-014", "WF-015", "WF-017", "WF-308", "WF-319"]);
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
