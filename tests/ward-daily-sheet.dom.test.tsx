import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  asAtStamp,
  dailySheetGroups,
  type DailySheetPerson,
} from "@/components/ward-management/board/ward-daily-sheet";
import { WardBoard } from "@/components/ward-management/board/ward-board";
import {
  admissionsForUnit,
  bedIsOccupied,
  isPastExpectedDischarge,
} from "@/components/ward-management/ward-admissions";
import { WARD_ADMISSIONS_ANCHOR, wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { arrowTargets, headlineAvailable, sinceYesterday } from "@/components/ward-management/ward-board-derivations";
import { MINUTES_PER_DAY, formatInstant, wallClockNow } from "@/components/ward-management/ward-clock";
import { derivedBedReleases } from "@/components/ward-management/ward-discharge-dates";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { Unit } from "@/components/ward-management/ward-model";
import { wardSites } from "@/components/ward-management/ward-sites";

/**
 * THE WARD'S DAILY SHEET — D19's handover sheet, with DB-10/DB-11/DB-12's live stamp.
 *
 * Two failure classes are worth a test here and the rest is decoration:
 *
 *   1. **A figure that is merely computed rather than POSSIBLE.** A sibling panel on this very
 *      board shipped "Kimberley 28 people" on a twenty-bed ward with nine passing assertions,
 *      because the caller handed a correct derivation the whole network's 267 records. So every
 *      count on the sheet is checked against a per-unit derivation computed independently here,
 *      across all 23 seeded units, and additionally bounded by the ward's own bed count.
 *   2. **A stamp that can lie** (DB-12). If the "as at" line read the wall clock while the figures
 *      read the provider's `now`, the sheet would assert a moment it is not showing — in the one
 *      element DB-10 deliberately made load-bearing, and on the strength of which DB-11 removed the
 *      frozen view. That defect is invisible to every test that does not look at the clock, so
 *      these tests look at it twice: once by pinning the rendered stamp to the anchor the figures
 *      are derived from, and once by asserting the stamp tracks its argument rather than any clock.
 */
function renderWardBoard(unitId: string) {
  return render(
    <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
      <WardBoard unitId={unitId} />
    </WardFlowProvider>,
  );
}

const UNIT_ID = "bty-adult-secure";
const allUnits: Unit[] = wardSites.flatMap((site) => site.units);

/** The occupants of one unit, derived here rather than read back off the board — the whole point is
 *  that an independent derivation and the rendered sheet must agree. */
function occupantsOf(unitId: string) {
  return admissionsForUnit(wardAdmissions, unitId).filter(bedIsOccupied);
}

describe("the daily sheet exists on the board and says what it is", () => {
  it("renders one daily sheet, with D19's four groups in D19's order", () => {
    renderWardBoard(UNIT_ID);
    const sheet = screen.getByTestId("ward-daily-sheet");

    // Order matters: the sheet is read aloud in a meeting, and D19 names the reading order.
    const headings = within(sheet)
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual([
      "Who came in",
      "Who is going",
      "Who is stuck",
      "Who is overdue",
      "Nobody has said when they are going",
    ]);
  });

  it("carries no control at all, so the print reset cannot take content off it", () => {
    renderWardBoard(UNIT_ID);
    const sheet = screen.getByTestId("ward-daily-sheet");

    // `globals.css` strips `header, nav, button` from every printed page, and six Ward Flow
    // surfaces shipped with their content deleted by exactly that rule. A sheet with no button,
    // no nav and no header element cannot be emptied by it.
    expect(sheet.querySelectorAll("button")).toHaveLength(0);
    expect(sheet.querySelectorAll("nav")).toHaveLength(0);
    expect(sheet.querySelectorAll("header")).toHaveLength(0);
  });

  it("says out loud that it cannot be used to update anything", () => {
    renderWardBoard(UNIT_ID);
    // D10's editable half is not built here — the board dispatches nothing (DB-19). The absence
    // must never read as "there is nothing to update".
    expect(screen.getByTestId("ward-daily-sheet-limits").textContent).toContain("read-only");
  });
});

describe("the as-at stamp — DB-10's safeguard, and DB-12's rule that it cannot lie", () => {
  it("prints the instant the figures were derived from, not the wall clock", () => {
    renderWardBoard(UNIT_ID);
    const stamp = screen.getByTestId("ward-board-as-at").textContent ?? "";

    // The anchor every figure on this board is derived from. If the stamp were switched to
    // `wallClockNow()` this goes red for all but one minute of the day.
    expect(stamp).toContain(`As at ${formatInstant(WARD_ADMISSIONS_ANCHOR)}`);

    // And it is not the wall clock even in the minute where the two would coincide: the two values
    // are asserted to differ before the containment check above is trusted. Skipped in the one
    // minute a day where the machine clock really is the anchor, because there the test cannot
    // distinguish the two and a green result would mean nothing.
    const wall = wallClockNow();
    if (wall !== WARD_ADMISSIONS_ANCHOR) {
      expect(stamp).not.toContain(`As at ${formatInstant(wall)}`);
    }
  });

  it("says it holds no calendar date rather than inventing one", () => {
    renderWardBoard(UNIT_ID);
    const stamp = screen.getByTestId("ward-board-as-at").textContent ?? "";
    // DB-10 asks for date AND time. An `Instant` is minutes since midnight on one synthetic
    // operating day, so the date does not exist — and a fabricated one on the element the decision
    // made load-bearing would be worse than the gap. The gap is stated instead.
    expect(stamp).toContain("no calendar date");
  });

  it("moves with the instant it is given, and never reads a clock of its own", () => {
    // The DB-12 test proper: the stamp is a pure function of the `now` handed to it. Two different
    // instants, two different stamps — which is what makes "the stamp reads the same instant the
    // figures read" enforceable rather than aspirational.
    expect(asAtStamp(8 * 60 + 14).time).toBe("08:14");
    expect(asAtStamp(15 * 60 + 22).time).toBe("15:22");
    expect(asAtStamp(8 * 60 + 14).time).not.toBe(asAtStamp(15 * 60 + 22).time);
  });

  it("distinguishes two sheets taken at the same time on different days, which is what DB-10 is FOR", () => {
    /*
     * The gap the three tests above cannot see, and the one DB-10 exists to close. Every one of
     * them varies the time of day, so all three pass while a sheet taken at 08:14 on the opening
     * day and one taken at 08:14 the next day are byte-identical — two moments looking like two
     * competing claims about one, which is exactly the hazard DB-10 names ("paper outlives its
     * day"). A stamp that only carries a clock face cannot discharge that requirement however
     * prominent it is.
     *
     * Asserted on the WHOLE stamp rather than on `time`, deliberately: `time` is a clock face and
     * SHOULD be identical across days. It is the stamp as a reader receives it that has to differ.
     */
    const openingMorning = 8 * 60 + 14;
    const nextMorning = openingMorning + MINUTES_PER_DAY;

    expect(asAtStamp(openingMorning).time).toBe(asAtStamp(nextMorning).time);

    const opening = asAtStamp(openingMorning);
    const next = asAtStamp(nextMorning);
    expect(opening.dayNote).not.toBe(next.dayNote);
    expect(opening.dayNote).toContain("day 1");
    expect(next.dayNote).toContain("day 2");
  });

  it("still refuses a calendar date, and says so on every day", () => {
    // The day number is NOT a date and must not be allowed to read as one arriving. It
    // distinguishes two sheets from each other; it tells nobody which Tuesday either was. The
    // refusal therefore travels on every day, not only the opening one.
    for (const instant of [8 * 60 + 14, 8 * 60 + 14 + MINUTES_PER_DAY, 8 * 60 + 14 + 9 * MINUTES_PER_DAY]) {
      expect(asAtStamp(instant).dayNote).toContain("no calendar date");
    }
  });

  it("offers no day at all when it has no time, rather than day NaN", () => {
    // `dayOf(NaN)` is `NaN`. The non-finite branch is the one place a stamp could print "day NaN"
    // on a sheet somebody pins to a wall, so time and day fail together on purpose.
    expect(asAtStamp(Number.NaN).time).toBeNull();
    expect(asAtStamp(Number.NaN).dayNote).not.toContain("NaN");
    expect(asAtStamp(Number.NaN).dayNote).toContain("no calendar date");
  });

  it("yields no time at all for an unusable instant, never NaN", () => {
    // Conservative direction: a sheet that cannot say when it was taken must not appear to.
    expect(asAtStamp(Number.NaN).time).toBeNull();
    expect(asAtStamp(Number.POSITIVE_INFINITY).time).toBeNull();
  });
});

describe("dailySheetGroups — a partition of the board's rows, never a second derivation", () => {
  const base: DailySheetPerson = {
    key: "AD-1",
    days: 10,
    bandLabel: "Under 2 weeks",
    pastDate: false,
    sex: "Female",
    homeRegion: "Peel",
    tentativeDiagnosis: null,
    expectedDays: 3,
    blockReason: null,
  };

  it("reads the flags the board already computed rather than recomputing them", () => {
    const people: DailySheetPerson[] = [
      { ...base, key: "held", blockReason: "Awaiting transport" },
      { ...base, key: "past", pastDate: true, expectedDays: -2 },
      { ...base, key: "undated", expectedDays: null },
      { ...base, key: "plain" },
    ];
    const groups = dailySheetGroups(people);
    expect(groups.heldUp.map((person) => person.key)).toEqual(["held"]);
    expect(groups.overdue.map((person) => person.key)).toEqual(["past"]);
    expect(groups.noDate.map((person) => person.key)).toEqual(["undated"]);
  });

  it("keeps somebody who is both held up and overdue in BOTH groups", () => {
    // Deduplicating to avoid printing a person twice would drop exactly the person a flow meeting
    // most needs to discuss out of one of the two groups it would look for them in.
    const both: DailySheetPerson = {
      ...base,
      key: "both",
      pastDate: true,
      expectedDays: -4,
      blockReason: "Awaiting clean",
    };
    const groups = dailySheetGroups([both]);
    expect(groups.heldUp).toHaveLength(1);
    expect(groups.overdue).toHaveLength(1);
  });

  it("preserves the order it was given", () => {
    // The board sorts soonest-expected-out first and the sheet must not reshuffle: two prints of
    // one picture have to be the same sheet.
    const people = ["a", "b", "c"].map((key) => ({ ...base, key, pastDate: true }));
    expect(dailySheetGroups(people).overdue.map((person) => person.key)).toEqual(["a", "b", "c"]);
  });
});

describe("every count on the sheet is POSSIBLE for this ward, not merely computed", () => {
  it.each(allUnits.map((unit) => [unit.id, unit] as const))(
    "%s — the sheet's stuck / overdue / undated counts match an independent per-unit derivation",
    (unitId, unit) => {
      renderWardBoard(unitId);
      const inBeds = occupantsOf(unitId);

      const expectedHeldUp = inBeds.filter((admission) => admission.blockReason !== null).length;
      const expectedOverdue = inBeds.filter((admission) =>
        isPastExpectedDischarge(admission, WARD_ADMISSIONS_ANCHOR),
      ).length;
      const expectedNoDate = inBeds.filter(
        (admission) => admission.expectedDischargeAt === null || !Number.isFinite(admission.expectedDischargeAt),
      ).length;

      const rowsIn = (testId: string) => within(screen.getByTestId(testId)).queryAllByRole("listitem").length;

      expect(rowsIn("ward-daily-sheet-stuck")).toBe(expectedHeldUp);
      expect(rowsIn("ward-daily-sheet-overdue")).toBe(expectedOverdue);
      expect(rowsIn("ward-daily-sheet-no-date")).toBe(expectedNoDate);

      // The bound that catches the "handed the whole network" defect: no group on ONE ward's sheet
      // can hold more people than that ward has beds. 267 admissions through a per-unit panel would
      // blow this on every ward in the state; equality alone would not, because a wrong-set caller
      // and a wrong-set expectation agree with each other.
      expect(expectedHeldUp).toBeLessThanOrEqual(unit.beds);
      expect(expectedOverdue).toBeLessThanOrEqual(unit.beds);
      expect(expectedNoDate).toBeLessThanOrEqual(unit.beds);
      expect(inBeds.length).toBeLessThanOrEqual(unit.beds);
    },
  );

  it("the destinations on the sheet are this ward's, and total no more than the people in its beds", () => {
    renderWardBoard(UNIT_ID);
    const targets = arrowTargets(admissionsForUnit(wardAdmissions, UNIT_ID), WARD_ADMISSIONS_ANCHOR);
    const list = screen.queryByTestId("ward-daily-sheet-destinations");

    if (targets.length === 0) {
      expect(list).toBeNull();
      return;
    }
    expect(within(list as HTMLElement).getAllByRole("listitem")).toHaveLength(targets.length);

    // The check a ward can do in its head, and the one that would have caught "Kimberley 28 people"
    // on a twenty-bed ward: everybody counted here is in one of this ward's beds.
    const totalPeople = targets.reduce((sum, target) => sum + target.count, 0);
    expect(totalPeople).toBeLessThanOrEqual(occupantsOf(UNIT_ID).length);
  });

  it("the since-yesterday line is this ward's own movement, not the state's", () => {
    renderWardBoard(UNIT_ID);
    const movement = sinceYesterday(
      wardAdmissions.filter((admission) => admission.unitId === UNIT_ID),
      WARD_ADMISSIONS_ANCHOR,
    );
    const statewide = sinceYesterday(wardAdmissions, WARD_ADMISSIONS_ANCHOR);
    const line = screen.getByTestId("ward-daily-sheet-since").textContent ?? "";

    expect(line).toContain(`${movement.discharged} left this ward`);
    expect(line).toContain(`${movement.pulled} bed`);
    expect(line).toContain(`${movement.datesMoved} expected date`);

    // Non-vacuity: the statewide figure really is bigger, so "this ward's" is a claim with teeth.
    // Without this, a board handed all 267 records would satisfy the three assertions above by
    // agreeing with a wrongly-scoped expectation.
    expect(statewide.datesMoved).toBeGreaterThan(movement.datesMoved);
  });

  it("names the basis of the going-out figure in words, because a sheet has no toggle on it", () => {
    renderWardBoard(UNIT_ID);
    const releases = derivedBedReleases([...wardAdmissions], WARD_ADMISSIONS_ANCHOR);
    const text = screen.getByTestId("ward-daily-sheet-out-count").textContent ?? "";

    // "4 beds" without "confirmed" or "predicted" beside it is two different claims sharing a
    // number, and on paper the control that would have said which is gone.
    expect(text).toMatch(/Confirmed today|Predicted today/);
    // And the figure is bounded by the ward's own releases, never the network's.
    const wardReleases = releases.filter((release) => release.unitId === UNIT_ID).length;
    const shown = Number(/(\d+) bed/.exec(text)?.[1] ?? "-1");
    expect(shown).toBeGreaterThanOrEqual(0);
    expect(shown).toBeLessThanOrEqual(wardReleases);
  });
});

describe("what the sheet may never show", () => {
  it("labels every diagnosis tentative, and leads the line with the word", () => {
    renderWardBoard(UNIT_ID);
    const sheet = screen.getByTestId("ward-daily-sheet");
    const lines = [...sheet.querySelectorAll("p")]
      .map((node) => node.textContent ?? "")
      .filter((text) => text.includes("iagnosis"));

    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      // A reader scanning a column takes the first words of each line, so a qualification at the
      // end is the half that gets skipped.
      expect(line.startsWith("Tentative diagnosis:")).toBe(true);
    }
  });

  it("never numbers a bed and never names a person", () => {
    renderWardBoard(UNIT_ID);
    const text = screen.getByTestId("ward-daily-sheet").textContent ?? "";
    // An admission records the ward and never a bed (D6). Nothing on this sheet may imply one.
    expect(text).not.toMatch(/\bBed \d/);
    // The record holds no name, no date of birth and no address, and the only ids in the model are
    // record handles that must never reach the page.
    expect(text).not.toMatch(/\bAD-[a-z]/i);
  });

  it("states the headline figure once on the page, in the heading, and not again on the sheet", () => {
    renderWardBoard(UNIT_ID);
    const releases = derivedBedReleases([...wardAdmissions], WARD_ADMISSIONS_ANCHOR);
    const unit = allUnits.find((candidate) => candidate.id === UNIT_ID) as Unit;
    const available = headlineAvailable(unit, wardAdmissions, releases, [], WARD_ADMISSIONS_ANCHOR);

    // The heading block above the sheet carries it, from `headlineAvailable`.
    expect(screen.getByTestId("ward-board-headline").textContent).toContain(String(available));
    // A second copy on the sheet is a figure that can disagree with itself on one printed page.
    expect(screen.queryByTestId("ward-daily-sheet-headline")).toBeNull();
  });
});
