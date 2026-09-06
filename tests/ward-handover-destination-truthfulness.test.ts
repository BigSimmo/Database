// tests/ward-handover-destination-truthfulness.test.ts
//
// The handover page prints a column headed "Destination". This guards the one thing that column
// must never do: name a ward that has not agreed to take the patient.
//
// ⚠️ THE DEFECT THIS EXISTS FOR. `LongestWaitsSection` rendered `destinationUnit(movement, units)`,
// which is `acceptedUnitId ?? referredUnitIds[0]`. On a movement with open referrals and no
// acceptance that printed the FIRST WARD ASKED under a column headed "Destination". The same page's
// `InTransitSection`, seventy lines below, had already been repaired — so the page was half fixed
// and looked wholly fixed.
//
// ⚠️ WHY THIS IMPORTS `destinationCell` RATHER THAN MIRRORING IT. A test that re-implements the
// rule it is checking guards nothing: revert the component and every assertion stays green, because
// the assertions are exercising the copy of the logic in the test file. The function is exported
// and driven directly, following `tests/ward-stage-reached-at.test.ts`, where mutation proved a
// mirror caught only a source-text pin.
//
// ⚠️ AND WHY IT ASSERTS OVER THE FIXTURE RATHER THAN OVER A STRING. Pinning the sentence would go
// green the moment somebody rewrote the sentence, and red the moment somebody improved it. The
// property is about what the words claim: no cell may carry a ward's name unless that ward has
// accepted.

import { describe, expect, it } from "vitest";

import { destinationCell } from "../src/components/ward-management/handover/handover-page";
import { handoverSnapshot, isOpen } from "../src/components/ward-management/ward-derivations";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import type { Movement, Unit } from "../src/components/ward-management/ward-model";

const { movements, units } = seedWardFlowState();
const unitNames = units.map((unit) => unit.name);

/**
 * THE DISCRIMINATING POPULATION: open movements that have been referred somewhere and accepted
 * nowhere. These are the only movements on which the defect and the repair differ — with an
 * acceptance both print the accepted ward, and with no referrals both print the same "nothing
 * recorded" line. Every assertion below is floored on this set being non-empty, because walking
 * zero of them would pass against the very code this file exists to reject.
 */
const askedButUnaccepted: Movement[] = movements.filter(
  (movement) => isOpen(movement) && movement.acceptedUnitId === undefined && movement.referredUnitIds.length > 0,
);

const accepted: Movement[] = movements.filter((movement) => isOpen(movement) && movement.acceptedUnitId !== undefined);

function unitById(id: string): Unit | undefined {
  return units.find((unit) => unit.id === id);
}

describe("the handover page's Destination column", () => {
  it("walks a fixture that can actually tell the defect from the repair", () => {
    expect(
      askedButUnaccepted.length,
      "no seeded movement is referred-but-unaccepted, so `acceptedUnitId ?? referredUnitIds[0]` and " +
        "an accepted-only read produce identical output on every row, and every assertion below " +
        "would pass against the defect",
    ).toBeGreaterThan(0);
    expect(
      accepted.length,
      "no seeded movement has an acceptance, so the positive half of the property is unexercised",
    ).toBeGreaterThan(0);
  });

  it("never names a ward on a movement no ward has accepted", () => {
    for (const movement of askedButUnaccepted) {
      const cell = destinationCell(movement, units);
      const referredNames = movement.referredUnitIds
        .map((id) => unitById(id)?.name)
        .filter((name): name is string => name !== undefined);

      // The precise defect: the cell IS the first referred ward's name.
      expect(
        cell,
        `${movement.id} has been referred to ${movement.referredUnitIds.length} ward(s) and accepted by none, ` +
          `so printing "${referredNames[0]}" under a column headed Destination states an agreement ` +
          `that does not exist`,
      ).not.toBe(referredNames[0]);

      // The general property: no bare ward name at all, whichever one it is. A cell that named
      // the LAST referred ward instead of the first would satisfy the assertion above and is the
      // same lie.
      expect(
        unitNames.includes(cell),
        `${movement.id}: the cell is exactly a ward's name ("${cell}"), which reads as a destination`,
      ).toBe(false);
    }
  });

  it("says how many wards were asked, so the middle state is legible rather than merely honest", () => {
    for (const movement of askedButUnaccepted) {
      const cell = destinationCell(movement, units);
      expect(
        cell,
        `${movement.id}: a coordinator chases an answer when wards have been asked and starts asking ` +
          `when none has been, so the cell must carry the count that tells those apart`,
      ).toContain(String(movement.referredUnitIds.length));
      expect(cell).toContain("none has accepted");
    }
  });

  it("does name the ward once one has accepted", () => {
    for (const movement of accepted) {
      const acceptedName = unitById(movement.acceptedUnitId as string)?.name;
      if (acceptedName === undefined) continue;
      expect(
        destinationCell(movement, units),
        `${movement.id} was accepted at ${acceptedName}, which is a real destination and must be named`,
      ).toBe(acceptedName);
    }
  });

  it("distinguishes 'nobody has been asked' from 'asked and unanswered'", () => {
    const neverAsked: Movement = {
      ...askedButUnaccepted[0],
      referredUnitIds: [],
    };
    expect(destinationCell(neverAsked, units)).toBe("No destination unit recorded");
    expect(destinationCell(neverAsked, units)).not.toBe(destinationCell(askedButUnaccepted[0], units));
  });

  /**
   * The structural half. The repair removed the resolved `unit` from `longestWaits` rather than
   * correcting it, because a resolved `Unit` on that row is what invited the fabrication: whoever
   * renders it has to decide what it means. If the field returns, this fails and says why.
   */
  it("carries no pre-resolved destination on the longest-waits rows", () => {
    const snapshot = handoverSnapshot(movements, units, NOW_ANCHOR);
    expect(snapshot.longestWaits.length).toBeGreaterThan(0);
    for (const entry of snapshot.longestWaits) {
      expect(
        Object.keys(entry),
        "a resolved unit on this row is what produced the original defect — the page builds the " +
          "cell from the movement via destinationCell() instead",
      ).toEqual(["movement"]);
    }
  });
});
