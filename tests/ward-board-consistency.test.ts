import { describe, expect, it } from "vitest";

import { ADMISSION_FIELDS, bedIsOccupied } from "@/components/ward-management/ward-admissions";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { allUnits } from "@/components/ward-management/ward-sites";

/**
 * The guard whose absence let a visible defect exist.
 *
 * A bed with nobody in it is not necessarily a bed you can fill. A unit's beds divide into FOUR,
 * not two: **occupied** (including PULLED — the ward gave the bed away and the person may still be
 * in an emergency department), **blocked** (out of service), **held** (physically empty, but not
 * yet confirmed as one the ward will actually offer), and **available** (fillable right now). So
 * the invariant is `beds − occupied === available + held + blocked`, and the seed satisfies it on
 * all 23 units.
 *
 * **This test was first written asserting `beds − occupied === empty`, and failed on four units.**
 * Rendering the board had shown `fsh-adult-secure` drawing four empty-looking tiles under a header
 * saying three, and it was reported as a possible fixture inconsistency. It is not: every one of the
 * four failures had exactly one blocked bed and was off by exactly one. **The fixture was right and
 * the assertion was wrong** — which is why the rule is to run a check before prescribing a fix from
 * it, and why a failing test is a question rather than a verdict.
 *
 * **Widened from three-way to four-way** when the board grew a fourth tile kind: `rph-adult-secure`
 * heads with "1 bed you can fill today", but the first board pass still drew BOTH its
 * physically-empty beds as plain "Empty" — the header and the grid disagreeing about how many beds
 * a coordinator can actually take someone to. `available`/`held`/`blocked`/`occupied` below are read
 * from `unitCapacity` (`ward-derivations.ts`) — the SAME function `ward-board.tsx`, `ward-screen.tsx`
 * and `flow-diagram.tsx` all call for this exact split — rather than re-derived by hand here, so this
 * test exercises the real partitioning code instead of a parallel copy of its arithmetic that could
 * drift from it. `bedReleases` is passed as `[]`: `unitCapacity` only reads that parameter for its
 * own dead `potential` field (see that function's own doc comment), never for
 * `available`/`held`/`blocked`/`occupied`, so an empty array cannot change this assertion's answer.
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
  it("partitions every unit into occupied, held, blocked and available with none left over", () => {
    const mismatched = allUnits()
      .map((unit) => {
        const occupied = wardAdmissions.filter(
          (admission) => admission.unitId === unit.id && bedIsOccupied(admission),
        ).length;
        const capacity = unitCapacity(unit, []);
        return {
          unitId: unit.id,
          beds: unit.beds,
          occupied,
          unseated: unit.beds - occupied,
          availableHeldBlocked: capacity.available + capacity.held + capacity.blocked,
          // Kept alongside the totals above so a failure message names exactly which term is off,
          // rather than only the two sums that disagree.
          available: capacity.available,
          held: capacity.held,
          blocked: capacity.blocked,
        };
      })
      .filter((row) => row.unseated !== row.availableHeldBlocked);

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

  /**
   * **A witness to the branch merge, deliberately placed OUTSIDE the conflict set.**
   *
   * This file is not one of the three paths that conflict, so a resolution cannot delete it
   * alongside what it guards — which is exactly what makes the fully-wrong resolution look green.
   * `tests/ward-admission-model.test.ts` IS in that set: resolving it away removes the assertion
   * that the discharge fields must exist in the same edit that removes the fields.
   *
   * **This assertion was added because the first version of this file could NOT do this job, and a
   * sister session caught it rather than me.** The two checks above read `bedIsOccupied` — byte
   * identical on both branches, verified by blob id — and unit figures from the unconflicted
   * `ward-sites.ts`. Nothing they touch changes under the wrong resolution, so they pass. They
   * catch a MIXED resolution only, which four greps already catch. A test believed to be an
   * independent witness, that is not one, is worse than no test: it is a check that cannot fail
   * wearing the label of the thing that would have caught the error.
   *
   * `dischargeConfirmedAt` / `dischargeConfirmedBy` are the ONLY route to the `confirmed` discharge
   * stage. They appear 4 times in this branch's seed and 0 times on the other. So:
   *
   * **If this reddens after a merge, the discharge fields were dropped — do not "fix" it by
   * relaxing the assertion. Re-resolve the three conflicted paths toward the board's copy.**
   */
  /**
   * **Four claims, four cases, on purpose.** Vitest stops a case at its first failing assertion, so
   * four `expect`s in one block can only ever be exercised by a mutation that trips the first of
   * them — the other three stay unproven while the case reddens and the whole thing reads as
   * thoroughly verified. This was written as one block and split after noticing that, which means
   * the shape got built into the very test whose job is to be a reliable witness.
   */
  it("declares dischargeConfirmedAt on the admission record", () => {
    expect(ADMISSION_FIELDS, "the record no longer declares dischargeConfirmedAt").toContain("dischargeConfirmedAt");
  });

  it("declares dischargeConfirmedBy on the admission record", () => {
    expect(ADMISSION_FIELDS, "the record no longer declares dischargeConfirmedBy").toContain("dischargeConfirmedBy");
  });

  it("seeds at least one confirmed discharge, so the stage is reachable at all", () => {
    const confirmed = wardAdmissions.filter((admission) => admission.dischargeConfirmedAt !== null);

    expect(
      confirmed.length,
      "no seeded admission carries dischargeConfirmedAt — the confirmed discharge stage is unreachable",
    ).toBeGreaterThan(0);
  });

  /**
   * Confirmed BY someone, not merely AT some time. The pair is what makes the stage attributable,
   * and a resolution could plausibly keep one field and drop the other — so this is asserted apart
   * from the case above rather than after it.
   */
  it("never records a discharge confirmed at an instant by nobody", () => {
    const unattributed = wardAdmissions
      .filter((admission) => admission.dischargeConfirmedAt !== null && admission.dischargeConfirmedBy === null)
      .map((admission) => admission.id);

    expect(unattributed, "confirmed at an instant, by nobody").toEqual([]);
  });
});
