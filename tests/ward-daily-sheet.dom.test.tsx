import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectSays } from "./helpers/ward-caption";

import {
  asAtStamp,
  dailySheetGroups,
  type DailySheetPerson,
} from "@/components/ward-management/board/ward-daily-sheet";
import { WardBoard } from "@/components/ward-management/board/ward-board";
import {
  admissionsForUnit,
  bedIsOccupied,
  daysInBed,
  isPastExpectedDischarge,
  stayDayNumber,
} from "@/components/ward-management/ward-admissions";
import { WARD_ADMISSIONS_ANCHOR, wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import {
  ARROW_HORIZON_DAYS,
  headlineAvailable,
  sinceYesterday,
} from "@/components/ward-management/ward-board-derivations";
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
      // "Who is off the ward" was briefly a sixth heading here. The owner removed the column on
      // 2026-08-30 and it is now a LINE under the grid, not a group — see the off-the-ward test
      // below. D19's approved reading order is untouched again.
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

describe("the daily sheet is folded away and last, not second", () => {
  /*
   * OWNER, 2026-08-30: put the sheet at the bottom, and the board is cluttered.
   *
   * Measured before the move: the sheet was **995px of a 2493px page — 40% of the ward board,
   * sitting second** and pushing the beds below the fold. Measured after: **1546px**, with the
   * beds as the first substantial block. The board's subject is the beds; the sheet is what the
   * board prints.
   *
   * Folded because on screen it repeated the board almost entirely, and by design — it was built
   * as a printout of these same panels, so its "Since yesterday", "Who came in", "Who is going"
   * and destinations were the board's own panels a second time.
   *
   * **These assertions cannot see the folding**, and that is stated rather than worked around:
   * jsdom applies no stylesheet, so the hidden body is still in the document and every existing
   * assertion in this file still passes. What CAN be pinned here is the contract the CSS hangs
   * off — the button, its state, and which class the body carries — and that is what these do.
   */
  it("starts folded, and the button says what it will show", () => {
    renderWardBoard(UNIT_ID);
    const button = screen.getByTestId("ward-board-sheet-fold").querySelector("button");
    expect(button, "the fold has no button").not.toBeNull();
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button?.textContent).toMatch(/show the ward.s daily sheet/i);
  });

  it("opens and closes, and says which state it is in", () => {
    renderWardBoard(UNIT_ID);
    const button = screen.getByTestId("ward-board-sheet-fold").querySelector("button")!;

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button.textContent).toMatch(/hide the ward.s daily sheet/i);

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps the sheet in the document while folded, which is what lets it print", () => {
    /*
     * The half that matters most and the one a careless simplification would break: if the fold
     * ever stops RENDERING the sheet and starts omitting it, the printed handover sheet becomes a
     * blank page — the reader of a printed page cannot click anything.
     *
     * A `<details>` element was the obvious build and is the wrong one for exactly this reason:
     * the browser hides a closed `details`' content through its own stylesheet and no print rule
     * reliably reopens it. The print stylesheet forces `.sheetBodyHidden` to `display: block`,
     * which only works while the content is actually there.
     */
    renderWardBoard(UNIT_ID);
    const body = screen.getByTestId("ward-board-sheet-body");
    expect(within(body).getByTestId("ward-daily-sheet")).toBeInTheDocument();
    expect(within(body).getByTestId("ward-daily-sheet-away")).toBeInTheDocument();
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

  it('says "None." and nothing longer when nobody on the ward is away', () => {
    /*
     * OWNER, 2026-08-30, answering whether this group should print at all when it is empty:
     * "Just say none."
     *
     * He kept the group and shortened the sentence, which resolves the tension better than either
     * option offered: the sheet's never-blank rule survives whole — a reader still meets the
     * heading and knows nothing failed to print — while the page cost on a sheet already spilling
     * to a second page drops from a sentence to one word.
     *
     * Pinned because it is his wording on a clinical artefact and nothing else asserts it. Twenty
     * of this project's user-facing control labels turned out to be pinned by no test at all, and
     * an owner-chosen string with no assertion is the same gap in a different place.
     */
    const wardWithNobodyAway = wardAdmissions.find(
      (admission) =>
        admission.awayAtEmergencyDepartmentSince === null &&
        !wardAdmissions.some(
          (other) => other.unitId === admission.unitId && other.awayAtEmergencyDepartmentSince !== null,
        ),
    );
    expect(wardWithNobodyAway, "every seeded ward has somebody away — this assertion is vacuous").toBeDefined();

    renderWardBoard(wardWithNobodyAway!.unitId);
    // The group became a line on 2026-08-30 ("remove the away column"), so his "Just say none."
    // now reads as "Off the ward: none." rather than a bare cell. The word he chose survives; the
    // container it sat in did not.
    const line = screen.getByTestId("ward-daily-sheet-away");
    expect(line.textContent).toMatch(/off the ward:\s*none\./i);
  });

  it("says on the PAPER that a patient is at an emergency department, not only on the screen", () => {
    /*
     * The gap the tile fix left, and the more serious half of it.
     *
     * The board's grid was fixed first. The printed sheet still showed that patient as an ordinary
     * occupant — a day count, a discharge plan, a diagnosis, and nothing saying they were not on
     * the ward. **This sheet is read aloud at handover**, so it is precisely the moment somebody
     * asks "and where is she?" and the page cannot answer. The paper is also the artefact that
     * leaves the room: a screen is re-read, a printed sheet is carried to a meeting and believed.
     *
     * Asserted against the sheet specifically, not the board as a whole — the board contains both
     * surfaces, so a query over the whole page would have passed on the strength of the tile fix
     * and this line could have been deleted with the suite green.
     */
    // The ward that actually has people away, not this file's default — a sheet with nobody away
    // proves nothing, and would pass just as quietly if the line were never rendered.
    const away = wardAdmissions.filter((admission) => admission.awayAtEmergencyDepartmentSince !== null);
    expect(away.length, "no seeded admission is away at an ED").toBeGreaterThan(0);
    const unitId = away[0].unitId;
    const awayHere = away.filter((admission) => admission.unitId === unitId);

    renderWardBoard(unitId);

    /*
     * The line, not a column — the owner removed the column on 2026-08-30. The assertion that
     * matters did not change with it: EVERY person away on this ward must reach the printed sheet.
     * One of the two seeded away people has an ordinary discharge date and no blocker, so they
     * appear in none of the four groups; if the line ever stops naming them they vanish from the
     * sheet that is read aloud at handover, and nobody in the room can see an absence.
     */
    const line = screen.getByTestId("ward-daily-sheet-away");
    const text = line.textContent ?? "";
    for (const admission of awayHere) {
      expect(text, `${admission.id} is away and is not named on the printed sheet`).toContain(admission.homeRegion);
    }
    expect(text, "the line does not say the bed is still theirs").toMatch(/bed stays theirs/i);
  });

  it("follows the provider's clock, so it cannot disagree with the ward screen", () => {
    /*
     * REPLACES the test that asserted the opposite. Owner decision 2026-09-01: the board is live.
     *
     * The test this supersedes pinned a note saying the board does not change. That note existed
     * because two owner decisions were live in one file at once — DB-11 (2026-08-29) made
     * everything live, a fixed-board decision (2026-08-30) kept this screen still — and the visible
     * result was this board reading `Held 1` at 10:42 while the ward screen read `Held 0` at 12:32
     * for the same ward at the same moment.
     *
     * WHY THIS ASSERTION AND NOT A SNAPSHOT. Every other test in this file renders the board at
     * `WARD_ADMISSIONS_ANCHOR`, which is the instant the fixture is authored against — so the old
     * hardcoded `now` and the provider's `now` were the SAME NUMBER and no assertion here could
     * tell them apart. That is precisely why the whole suite stayed green while the two screens
     * disagreed on screen. Rendering at a DIFFERENT instant is the one thing that separates them.
     *
     * It fails against the previous implementation on both limbs: the stamp was
     * `WARD_ADMISSIONS_ANCHOR` unconditionally, so it read 10:42 whatever the provider said, and
     * the fixed note was unconditional JSX that no state could remove.
     */
    const elevenTwentyTwo = WARD_ADMISSIONS_ANCHOR + 40;
    render(
      <WardFlowProvider initialNow={elevenTwentyTwo}>
        <WardBoard unitId={UNIT_ID} />
      </WardFlowProvider>,
    );

    const stamp = screen.getByTestId("ward-board-as-at").textContent ?? "";
    expect(stamp, `the board is still stamped from the fixture anchor: ${stamp}`).toContain("11:22");
    expect(stamp, "the board is showing the fixture's own instant, not the provider's").not.toContain("10:42");

    expect(
      screen.queryByTestId("ward-board-fixed-note"),
      "the board still claims it does not change, which is now untrue",
    ).toBeNull();
  });

  it("prints NO calendar date, now that it could print a real one", () => {
    /*
     * This test got STRONGER when the clock gained a date (`b1198cf6e`), and it is worth saying
     * why rather than just editing the string it pins.
     *
     * Before, the sheet could not print a date — there was no calendar — so asserting the absence
     * of one asserted a LIMITATION, and would have passed no matter what anybody decided. Now
     * `dayZero` and `calendarDateOf` exist and this sheet could say "30 August" in one line. The
     * same assertion therefore now guards a DECISION: a real date beside invented figures is the
     * one combination that makes a prototype look like a record.
     *
     * Asserted as the absence of any year or month name rather than of one fixed sentence, so it
     * cannot be satisfied by rewording — the point is that no date reaches the page, by any
     * spelling.
     */
    renderWardBoard(UNIT_ID);
    const stamp = screen.getByTestId("ward-board-as-at").textContent ?? "";

    expect(stamp).toMatch(/synthetic/i);
    expect(stamp, `a year reached the stamp: ${stamp}`).not.toMatch(/\b(19|20)\d{2}\b/);
    const months = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/;
    expect(stamp, `a month name reached the stamp: ${stamp}`).not.toMatch(months);
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
      expectSays(asAtStamp(instant).dayNote, "the synthetic-day caveat", ["real day"]);
    }
  });

  it("offers no day at all when it has no time, rather than day NaN", () => {
    // `dayOf(NaN)` is `NaN`. The non-finite branch is the one place a stamp could print "day NaN"
    // on a sheet somebody pins to a wall, so time and day fail together on purpose.
    expect(asAtStamp(Number.NaN).time).toBeNull();
    expect(asAtStamp(Number.NaN).dayNote).not.toContain("NaN");
    expectSays(asAtStamp(Number.NaN).dayNote, "the synthetic-day caveat", ["real day"]);
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
    dayNumber: 11,
    bandLabel: "Under 2 weeks",
    pastDate: false,
    sex: "Female",
    homeRegion: "Peel",
    tentativeDiagnosis: null,
    expectedDays: 3,
    blockReason: null,
    awayAtEdHours: null,
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

  it("the destination counts PRINTED on the sheet are the people in this ward's beds", () => {
    /*
     * ⚠️ WHAT THIS TEST USED TO CHECK, AND WHY IT COULD NOT FAIL (found 2026-09-01).
     *
     * It called `arrowTargets` — the very function the sheet renders from — and then compared that
     * result against itself: the row COUNT was read off the page, but no rendered NUMBER was. The
     * "no more than the people in its beds" bound was computed from the fixture, so it bounded the
     * fixture and never the page. Printing "Peel: 18 people" on a sheet where two people are
     * Peel-bound left every assertion green, and it was reproduced that way before this rewrite.
     *
     * That matters more here than on a screen: THIS SHEET IS READ ALOUD AT HANDOVER, so a wrong
     * number on it is spoken to a room as fact, and the paper leaves the room and is believed.
     *
     * SO THE EXPECTATION IS DERIVED WITHOUT `arrowTargets`. The same question — who in this ward's
     * beds is heading where, inside the board's window — asked of the seeded admissions directly.
     * A wrong figure can then no longer be confirmed by the code that produced it.
     */
    renderWardBoard(UNIT_ID);

    const inBeds = occupantsOf(UNIT_ID);
    const expectedByRegion = new Map<string, number>();
    for (const admission of inBeds) {
      const expected = admission.expectedDischargeAt;
      if (admission.homeRegion === null) continue;
      if (expected === null || !Number.isFinite(expected)) continue;
      const days = Math.max(0, Math.floor((expected - WARD_ADMISSIONS_ANCHOR) / MINUTES_PER_DAY));
      if (days > ARROW_HORIZON_DAYS) continue;
      expectedByRegion.set(admission.homeRegion, (expectedByRegion.get(admission.homeRegion) ?? 0) + 1);
    }

    const list = screen.queryByTestId("ward-daily-sheet-destinations");
    if (expectedByRegion.size === 0) {
      expect(list, "the sheet prints destinations for a ward whose beds are heading nowhere in the window").toBeNull();
      return;
    }
    expect(list, "nobody in this ward's beds reaches the sheet's destinations, though some are due out").not.toBeNull();

    const rows = within(list as HTMLElement).getAllByRole("listitem");
    expect(
      rows.length,
      `the sheet prints ${rows.length} destination lines; ${expectedByRegion.size} regions are actually ` +
        `represented in this ward's beds`,
    ).toBe(expectedByRegion.size);

    let printedTotal = 0;
    for (const row of rows) {
      const text = row.textContent ?? "";
      // Read the figure a clinician reads aloud, off the page, exactly as it is printed.
      const parsed = /^(.+?): (\d+) (?:person|people),/.exec(text);
      expect(parsed, `a destination line cannot be read as "<region>: <n> people": "${text}"`).not.toBeNull();

      const region = parsed![1];
      const printed = Number(parsed![2]);
      printedTotal += printed;

      const actual = expectedByRegion.get(region);
      expect(
        actual,
        `the handover sheet names "${region}" as a destination, but nobody in this ward's beds is ` +
          `heading there inside the board's window. This sheet is read aloud.`,
      ).toBeDefined();
      expect(
        printed,
        `the handover sheet says ${printed} ${printed === 1 ? "person is" : "people are"} heading to ` +
          `${region}; ${actual} of the people in this ward's beds ${actual === 1 ? "is" : "are"}. ` +
          `This sheet is read aloud at handover, so this number is spoken to a room as fact.`,
      ).toBe(actual);
    }

    // The check a ward can do in its head, and the one that would have caught "Kimberley 28 people"
    // on a twenty-bed ward — now applied to the PRINTED figures rather than to the fixture.
    expect(
      printedTotal,
      `the sheet's destination lines account for ${printedTotal} people, but only ${inBeds.length} ` +
        `${inBeds.length === 1 ? "person is" : "people are"} in this ward's beds`,
    ).toBeLessThanOrEqual(inBeds.length);
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

    // "4 beds" without "confirmed" or "expected" beside it is two different claims sharing a
    // number, and on paper the control that would have said which is gone.
    expect(text).toMatch(/Confirmed today|Expected today/);
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

/**
 * 🔴 THE SHEET'S LEAD IS AN ORDINAL AND `daysInBed` IS A DURATION, AND IT PRINTED ONE AS THE OTHER.
 *
 * `daysInBed` floors at zero, so anybody who arrived less than twenty-four hours ago is `0`. The
 * board tile renders that correctly — "0 days", meaning no whole days in the bed yet. The sheet
 * reused the same number as `Day ${days}` and printed **"Day 0"**, which is not a day of the
 * admission: on a ward the day you arrive is Day 1. Same value, right on one screen and wrong on
 * the other, because only the noun changed. Owner ruled it a defect, 2026-09-05.
 *
 * ⚠️ **THE SEEDED BOARD NEVER SHOWED IT, WHICH IS WHY IT SURVIVED.** Every occupied bed in the
 * fixture is at least one day old at the anchor — the minimum of 259 occupants is 1 — so no
 * rendered sheet has ever contained "Day 0", and a test that only walked the seed would have
 * confirmed the bug was absent. It arrives through `PATIENT_ARRIVED`, which writes
 * `arrivedAt: event.now`: the moment somebody arrives during a session their duration is 0. That is
 * the row a handover is most likely to be about, and the one the sheet got wrong.
 *
 * So these guards are written over the DERIVATION, where zero is constructible, rather than over
 * the rendered fixture, where it is not.
 */
describe("the day lead is an ordinal, never the duration", () => {
  it("counts the day somebody arrives as Day 1, not Day 0", () => {
    const occupant = wardAdmissions.find(bedIsOccupied);
    expect(occupant, "no occupied bed in the fixture to base this on").toBeDefined();
    // Exactly what PATIENT_ARRIVED writes: the person arrived at the instant being viewed.
    const justArrived = { ...occupant!, arrivedAt: WARD_ADMISSIONS_ANCHOR };

    // Anti-vacuity, and the whole premise: a duration of 0 is reachable. If this ever stops being
    // 0 the guard below proves nothing, and the failure says so rather than passing quietly.
    expect(daysInBed(justArrived, WARD_ADMISSIONS_ANCHOR), "a stay of zero whole days is no longer constructible").toBe(
      0,
    );

    expect(stayDayNumber(daysInBed(justArrived, WARD_ADMISSIONS_ANCHOR))).toBe(1);
  });

  it("numbers every real stay in the fixture one higher than its duration, and never zero", () => {
    const durations = wardAdmissions
      .filter(bedIsOccupied)
      .map((admission) => daysInBed(admission, WARD_ADMISSIONS_ANCHOR))
      .filter((days): days is number => days !== null);
    // Floor the population walked, not the failures found.
    expect(durations.length, "no occupied beds walked — this guard would pass by looking at nothing").toBeGreaterThan(
      50,
    );
    for (const days of durations) {
      expect(stayDayNumber(days)).toBe(days + 1);
      expect(stayDayNumber(days)).not.toBe(0);
    }
  });

  it("has no day number at all when there is no stay, rather than Day 1", () => {
    // A bed given away to somebody who has not arrived has no day of stay. Numbering it Day 1 would
    // present a person as having arrived somewhere they have not reached.
    expect(stayDayNumber(null)).toBeNull();
  });
});

/**
 * ⚠️ **THE GUARDS ABOVE COVER THE DERIVATION AND NOT THE SCREEN, WHICH IS HALF A FIX.**
 *
 * `stayDayNumber` being right does not stop the lead being pointed back at `person.days`: that is
 * a one-word edit at the render site, it is exactly the edit that produced "Day 0" in the first
 * place, and nothing above would go red for it. Ward Lead's ruling asked for a guard shaped over
 * the property rather than the string, so this one reads what the sheet actually printed and
 * compares it with the ordinal derived independently from the seed.
 *
 * Discriminating by construction: the ordinal is always exactly one greater than the duration, so
 * a lead rendering the duration fails on **every** row rather than only on a zero-day one — which
 * matters here, because the fixture has no zero-day occupant to catch it with.
 */
describe("the sheet's printed day number is the ordinal, checked against the seed", () => {
  it("prints daysInBed + 1 for every row it renders, never daysInBed", () => {
    renderWardBoard(UNIT_ID);
    const sheet = screen.getByTestId("ward-daily-sheet");

    const byKey = new Map(occupantsOf(UNIT_ID).map((admission) => [admission.id, admission]));
    let checked = 0;

    for (const row of Array.from(sheet.querySelectorAll<HTMLElement>("[data-testid]"))) {
      const testId = row.getAttribute("data-testid") ?? "";
      const admission = [...byKey.keys()].find((key) => testId.endsWith(`-${key}`));
      if (admission === undefined) continue;
      // ⚠️ The lead's OWN text node, never the row's `textContent`. The band label is a sibling
      // span inside the same paragraph and some bands begin with a digit, so the concatenated row
      // text reads "Day 411-3 months" and a naive match returns 411. That was a defect in the
      // measurement, not on the screen, and it cost one red before I read what it had printed.
      const lead = row.querySelector("p")?.childNodes[0]?.textContent ?? "";
      const printed = /^\s*Day (\d+)\s*$/u.exec(lead);
      if (printed === null) continue;

      const duration = daysInBed(byKey.get(admission)!, WARD_ADMISSIONS_ANCHOR);
      expect(duration, `${admission} has no stay but the sheet printed a day number`).not.toBeNull();
      expect(
        Number(printed[1]),
        `${admission}: the sheet printed "Day ${printed[1]}" for a stay of ${duration} whole days. ` +
          "The lead is an ordinal — arrival day is Day 1 — so it must be one greater than the duration. " +
          'Printing the duration itself is the defect that put "Day 0" on the sheet.',
      ).toBe(stayDayNumber(duration));
      checked += 1;
    }

    // Floor the population walked, not the failures found: a selector that stopped matching rows
    // would otherwise let this pass by reading nothing at all.
    expect(checked, "no sheet row carried both an admission id and a printed day number").toBeGreaterThan(0);
  });
});
