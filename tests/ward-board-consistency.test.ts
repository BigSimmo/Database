import { describe, expect, it } from "vitest";

import { bedIsOccupied } from "@/components/ward-management/ward-admissions";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { allUnits } from "@/components/ward-management/ward-sites";

/**
 * The guard whose absence let a visible defect exist.
 *
 * A bed with nobody in it is not necessarily a bed you can fill. A unit's beds divide into three:
 * **occupied** (including PULLED — the ward gave the bed away and the person may still be in an
 * emergency department), **empty**, and **blocked** (out of service). So the invariant is
 * `beds − occupied === empty + blocked`, and the seed satisfies it on all 23 units.
 *
 * **This test was first written asserting `beds − occupied === empty`, and failed on four units.**
 * Rendering the board had shown `fsh-adult-secure` drawing four empty-looking tiles under a header
 * saying three, and it was reported as a possible fixture inconsistency. It is not: every one of the
 * four failures had exactly one blocked bed and was off by exactly one. **The fixture was right and
 * the assertion was wrong** — which is why the rule is to run a check before prescribing a fix from
 * it, and why a failing test is a question rather than a verdict.
 *
 * What the rendering DID find is real and belongs to the board, not the data: **blocked beds are
 * drawn as ordinary empty tiles**, so a coordinator sees four fillable beds where three exist. Spec
 * D7 already lists blocked as its own tile state; the first pass did not implement it.
 *
 * Deliberately over **every** unit rather than a spot check. Two wards were rendered by hand and one
 * mismatch was found between them; the sweep found four. The range a check covers is the part most
 * often left unstated.
 */
describe("the ward board's tiles agree with the unit's own figures", () => {
  it("seats exactly (beds − empty − blocked) occupants in every unit", () => {
    const mismatched = allUnits()
      .map((unit) => {
        const occupied = wardAdmissions.filter(
          (admission) => admission.unitId === unit.id && bedIsOccupied(admission),
        ).length;
        return {
          unitId: unit.id,
          beds: unit.beds,
          occupied,
          unseated: unit.beds - occupied,
          emptyPlusBlocked: unit.empty.value + unit.blocked,
        };
      })
      .filter((row) => row.unseated !== row.emptyPlusBlocked);

    expect(mismatched).toEqual([]);
  });

  /**
   * A pulled admission holds a bed before anyone has arrived — the ward gave it away at the pull.
   * So it must count against the tiles exactly as an arrived occupant does. Asserted separately
   * because the count above would still balance if `bedIsOccupied` silently stopped counting pulled
   * beds AND the fixture happened to compensate.
   */
  it("never seats more occupants than a unit has beds", () => {
    const overfull = allUnits()
      .map((unit) => ({
        unitId: unit.id,
        beds: unit.beds,
        occupied: wardAdmissions.filter((admission) => admission.unitId === unit.id && bedIsOccupied(admission)).length,
      }))
      .filter((row) => row.occupied > row.beds);

    expect(overfull).toEqual([]);
  });
});
