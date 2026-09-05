// tests/ward-capacity-derivations.test.ts
//
// The merged Capacity screen (MERGE 02) answers "where is the mismatch" in aggregate — never
// "where could this person go". These tests assert that shape directly (a source scan for the
// per-patient surface it must never import) alongside the arithmetic, because a helper that quietly
// grew a per-patient branch would still pass every numeric assertion below.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  freeingCellText,
  bedKindGaps,
  bedKindTotals,
  networkTotals,
  networkWardRows,
  type BedKindId,
} from "@/components/ward-management/capacity/capacity-derivations";
import { lockedBedsFree, openBedsFree } from "@/components/ward-management/ward-bed-designation";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";
import type { Cohort, Security } from "@/components/ward-management/ward-model";

const NOW = NOW_ANCHOR;

/** Independent of `bedKindOfMovement` in the module under test — re-derives the mapping from the
 *  real `Cohort`/`Security` values so a bug shared between the module and this test cannot hide. */
function expectedKind(cohort: Cohort, security: Security): BedKindId {
  if (cohort === "Older adult") return "older_adult";
  if (cohort === "Youth") return "youth";
  return security === "Secure" ? "locked_adult" : "open_adult";
}

describe("bedKindGaps", () => {
  const units = allUnits();
  const open = wardMovements.filter(isOpen);

  it("walks a non-empty population of open movements and units, or every assertion below is vacuous", () => {
    expect(open.length, "no open movement in the fixture").toBeGreaterThan(0);
    expect(units.length, "no unit in the fixture").toBeGreaterThan(0);
  });

  it("returns exactly the four bed kinds, in the locked order", () => {
    const rows = bedKindGaps(wardMovements, units, NOW);
    expect(rows.map((row) => row.id)).toEqual(["locked_adult", "open_adult", "older_adult", "youth"]);
  });

  it("counts `waiting` as open movements of that kind, matching an independently derived mapping", () => {
    const rows = bedKindGaps(wardMovements, units, NOW);
    for (const row of rows) {
      const expected = open.filter((movement) => expectedKind(movement.cohort, movement.security) === row.id).length;
      expect(row.waiting, row.id).toBe(expected);
    }
  });

  it("never counts a closed movement", () => {
    const closed = wardMovements.filter((movement) => !isOpen(movement));
    expect(closed.length, "the fixture has no closed movement to prove exclusion with").toBeGreaterThan(0);

    const rows = bedKindGaps(wardMovements, units, NOW);
    const totalWaiting = rows.reduce((sum, row) => sum + row.waiting, 0);
    // Every open movement lands in exactly one kind (the mapping above is total), so the sum of
    // `waiting` across all four rows must equal the open count exactly — not merely be no larger.
    expect(totalWaiting).toBe(open.length);
  });

  it("sums `bedsThatFit` from the real locked/open free-bed split, per cohort", () => {
    const rows = bedKindGaps(wardMovements, units, NOW);
    const byId = new Map(rows.map((row) => [row.id, row]));

    const adultUnits = units.filter((unit) => unit.cohort === "Adult");
    const olderAdultUnits = units.filter((unit) => unit.cohort === "Older adult");
    const youthUnits = units.filter((unit) => unit.cohort === "Youth");
    expect(adultUnits.length, "no Adult-cohort unit in the fixture").toBeGreaterThan(0);
    expect(olderAdultUnits.length, "no Older-adult-cohort unit in the fixture").toBeGreaterThan(0);
    expect(youthUnits.length, "no Youth-cohort unit in the fixture").toBeGreaterThan(0);

    expect(byId.get("locked_adult")?.bedsThatFit).toBe(adultUnits.reduce((sum, unit) => sum + lockedBedsFree(unit), 0));
    expect(byId.get("open_adult")?.bedsThatFit).toBe(adultUnits.reduce((sum, unit) => sum + openBedsFree(unit), 0));
    expect(byId.get("older_adult")?.bedsThatFit).toBe(
      olderAdultUnits.reduce((sum, unit) => sum + lockedBedsFree(unit) + openBedsFree(unit), 0),
    );
    expect(byId.get("youth")?.bedsThatFit).toBe(
      youthUnits.reduce((sum, unit) => sum + lockedBedsFree(unit) + openBedsFree(unit), 0),
    );
  });

  it("sets gap to bedsThatFit minus waiting, on every row", () => {
    const rows = bedKindGaps(wardMovements, units, NOW);
    for (const row of rows) {
      expect(row.gap, row.id).toBe(row.bedsThatFit - row.waiting);
    }
  });

  /**
   * 🔴 Design lock §5.7 / `tests/ward-locked-not-authorised.test.ts`: a locked ward and a ward
   * that may lawfully detain are different facts. This screen must count an unauthorised locked
   * unit's locked beds as locked beds — the kind is about doors, not statute — so a shortfall does
   * not quietly hide behind a bed nobody may actually place a detained patient in.
   */
  it("counts a locked-but-unauthorised unit's locked beds toward locked_adult, never filtering on authorised", () => {
    const lockedUnauthorisedAdultUnits = units.filter(
      (unit) => unit.cohort === "Adult" && lockedBedsFree(unit) > 0 && !unit.authorised,
    );
    expect(
      lockedUnauthorisedAdultUnits.length,
      "the fixture carries no locked-but-unauthorised Adult unit with a free locked bed — this test would " +
        "otherwise be vacuous. See tests/ward-locked-not-authorised.test.ts for the unit the fixture uses.",
    ).toBeGreaterThan(0);

    const withoutFiltering = units.reduce(
      (sum, unit) => (unit.cohort === "Adult" ? sum + lockedBedsFree(unit) : sum),
      0,
    );
    const rows = bedKindGaps(wardMovements, units, NOW);
    expect(rows.find((row) => row.id === "locked_adult")?.bedsThatFit).toBe(withoutFiltering);
  });

  it("never returns a negative bedsThatFit — the underlying functions are already clamped at zero", () => {
    for (const row of bedKindGaps(wardMovements, units, NOW)) {
      expect(row.bedsThatFit, row.id).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("bedKindTotals", () => {
  it("sums the rows rather than recomputing independently", () => {
    const rows = bedKindGaps(wardMovements, allUnits(), NOW);
    const totals = bedKindTotals(rows);
    expect(totals).toEqual({
      waiting: rows.reduce((sum, row) => sum + row.waiting, 0),
      bedsThatFit: rows.reduce((sum, row) => sum + row.bedsThatFit, 0),
      gap: rows.reduce((sum, row) => sum + row.gap, 0),
    });
  });

  it("keeps gap consistent with bedsThatFit minus waiting at the total level too", () => {
    const rows = bedKindGaps(wardMovements, allUnits(), NOW);
    const totals = bedKindTotals(rows);
    expect(totals.gap).toBe(totals.bedsThatFit - totals.waiting);
  });
});

describe("networkWardRows", () => {
  const units = allUnits();

  it("returns exactly one row per unit, in the same order", () => {
    const rows = networkWardRows(units, NOW);
    expect(rows.length).toBe(units.length);
    expect(rows.map((row) => row.unit.id)).toEqual(units.map((unit) => unit.id));
  });

  it("computes ready and lockedReady from the real locked/open free-bed split", () => {
    for (const row of networkWardRows(units, NOW)) {
      expect(row.ready, row.unit.id).toBe(lockedBedsFree(row.unit) + openBedsFree(row.unit));
      expect(row.lockedReady, row.unit.id).toBe(lockedBedsFree(row.unit));
      expect(row.lockedReady, row.unit.id).toBeLessThanOrEqual(row.ready);
    }
  });

  it("reads confirmedAt from the ward's own allocatable figure, not the feed's empty count", () => {
    for (const row of networkWardRows(units, NOW)) {
      expect(row.confirmedAt, row.unit.id).toBe(row.unit.allocatable.confirmedAt);
    }
  });

  /**
   * ⚠️ HONESTY GUARD, NOT A PLACEHOLDER. "Expected to free today" needs a `BedRelease[]` list —
   * reducer state, not a fact on `Unit` — and this function's fixed signature takes only `units`
   * and `now`. There is no honest number to put here, so this pins `undefined` rather than letting
   * a future edit quietly start returning `0` (a specific, false "nothing is freeing" claim) to
   * satisfy a type. See the field's own doc comment in capacity-derivations.ts.
   */
  it("leaves freeing undefined rather than fabricating a count it has no data for", () => {
    for (const row of networkWardRows(units, NOW)) {
      expect(row.freeing, row.unit.id).toBeUndefined();
    }
  });
});

/**
 * ⚠️ THIS SUITE EXISTS BECAUSE THE SCREEN CANNOT REACH THE ABSENCE BRANCH. `CapacityScreen` reads
 * `bedReleases` from `useWardFlow()`, typed `BedRelease[]` and never `undefined`, so
 * `networkWardRows` always gets releases and every row comes back with a real number — measured
 * 2026-09-05 on the live fixture: 23 rows, 0 untracked. The DOM test's untracked arm therefore
 * never runs, and until now the only thing standing behind it was a `/not tracked/i` match on
 * copy. Here both answers are directly constructible, so the property is proved rather than
 * assumed.
 *
 * 🔴 **THE PROPERTY, NOT THE PHRASE.** The owner is redesigning many pages, and a guard that goes
 * red when "Not tracked here" becomes "No figure recorded" is one somebody deletes — taking the
 * honest guards with it in the same tidy-up. What must survive any rewording is that the absence
 * reads as a SENTENCE and never as a FIGURE, because the two fabrications the field's own doc
 * comment names are the literal word "undefined" and a false "0".
 *
 * ⚠️ AND NOT A BAN ON DIGITS, which is the over-broad version of the same idea and would forbid the
 * correct fix. "Not reported by this ward (see the discharge board)" is honest and may one day
 * carry a numeral; what is forbidden is text that READS as the figure itself.
 */
describe("freeingCellText", () => {
  it("prints a real number whenever there is one, including a measured zero", () => {
    // `0` and `undefined` are the two facts `NetworkWardRow.freeing` exists to keep apart: a ward
    // that reports nothing freeing, and a ward that does not report. A `?? 0` on this path collapses
    // the second into the first, which is the false claim with the most confidence behind it.
    for (const value of [0, 1, 3, 12, 100]) {
      expect(freeingCellText(value)).toBe(String(value));
    }
  });

  it("states an absent figure as words, never as a figure and never as the word undefined", () => {
    const text = freeingCellText(undefined);
    expect(text, "the absence rendered the literal word undefined").not.toMatch(/undefined/iu);
    expect(text, "the absence carries no words at all — a blank or a dash says nothing").toMatch(/\p{L}/u);
    expect(
      Number(text.trim()),
      `"${text}" reads as a figure, so a coordinator cannot tell it from a real count`,
    ).toBeNaN();
  });

  it("never gives the absence the same text as any figure it could print", () => {
    // The discriminating half: a coordinator must be able to tell "no data" from every real count.
    const absent = freeingCellText(undefined);
    for (let value = 0; value <= 60; value += 1) {
      expect(freeingCellText(value), `the absence is indistinguishable from a count of ${value}`).not.toBe(absent);
    }
  });
});

describe("networkTotals", () => {
  it("sums wards, beds and ready from the rows rather than recomputing independently", () => {
    const units = allUnits();
    const rows = networkWardRows(units, NOW);
    const totals = networkTotals(rows);
    expect(totals).toEqual({
      wards: rows.length,
      beds: units.reduce((sum, unit) => sum + unit.beds, 0),
      ready: rows.reduce((sum, row) => sum + row.ready, 0),
    });
  });
});

describe("the module answers aggregate mismatch, never a per-patient suggestion", () => {
  // A numeric assertion cannot catch a per-patient branch added beside the aggregate ones — the
  // totals above would still balance. Scanning the source for the one surface this module must
  // never reach for is the only guard that actually fails when that boundary is crossed.
  const source = readFileSync(
    new URL("../src/components/ward-management/capacity/capacity-derivations.ts", import.meta.url),
    "utf8",
  );

  it("never imports from ward-eligibility.ts", () => {
    // Matches an actual `import ... from ".../ward-eligibility"` line, not prose that merely
    // names the file — this module's own doc comments explain the rule by naming what they avoid.
    expect(source).not.toMatch(/from\s+["'][^"']*ward-eligibility["']/);
  });

  it("never calls the per-patient shortlist or eligibility functions", () => {
    expect(source).not.toMatch(/\bshortlistCandidates\s*\(/);
    expect(source).not.toMatch(/\beligibility\s*\(/);
    expect(source).not.toMatch(/\beligibleCandidatesAmong\s*\(/);
  });
});
