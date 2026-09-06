import { readFileSync } from "node:fs";

import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { wardStatistics } from "@/components/ward-management/ward-statistics";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { StatisticsCompareScreen } from "@/components/ward-management/statistics/statistics-compare-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allEmergencyDepartments, allUnits } from "@/components/ward-management/ward-sites";

/**
 * 🔴 **WARDS AND DEPARTMENTS DO NOT SHARE A MEASURE SET, AND ONE TABLE WOULD CLAIM THEY DO.**
 *
 * The section's own description promised "the same measure set beside every ward and emergency
 * department". That sentence is false of the software, not merely ambitious: a ward measure is
 * about BEDS — length of stay, empty-bed minutes, discharge dates — and an emergency department in
 * this model has no beds, no capacity and no occupancy. `statistics-ed-screen.tsx` already says so
 * in its own words: **"A WARD AND AN EMERGENCY DEPARTMENT ARE NOT ONE LIST WITH A FLAG."**
 *
 * The compare stub carried the test both sides must pass, and both do:
 *
 * > A measure can be set against a named ward only when the record it comes from carries a
 * > REQUIRED unit id. … An `Admission` carries `unitId` and always has one, so anything derived
 * > from admissions attributes cleanly. A unit id that is optional attributes only to the part of
 * > the population where it happens to be set — which is never the whole column, and never the
 * > part a reader assumes.
 *
 * Ward figures attribute through `Admission.unitId`; department figures through
 * `Movement.originEdId`. Both are required. **They attribute cleanly and they attribute from
 * different records, which is precisely why they cannot share a table.**
 *
 * ⚠️ **THE DEFECT THIS FORBIDS IS A BLANK CELL, NOT A MISSING TABLE.** One table with a ward's
 * columns and a department's rows leaves half the grid empty, and **a blank cell in a comparison
 * reads as a measured zero** — the same failure as a null average rendered as `0`, wearing a
 * different hat. A reader cannot tell "not measured here" from "measured, and it was none".
 */

function renderCompare() {
  return render(
    <WardFlowProvider>
      <StatisticsCompareScreen />
    </WardFlowProvider>,
  );
}

const STATISTICS_CSS = "src/components/ward-management/statistics/statistics-sections.module.css";

/** Comments first, always: this file’s own prose contains the string being searched for. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//gu, "");
}

const WARD_TABLE = "ward-statistics-compare-wards";
const ED_TABLE = "ward-statistics-compare-eds";

/**
 * ⚠️ **COLUMNS ARE ADDRESSED BY HEADER, NEVER BY POSITION.** Removing `Empty-bed time` on
 * 2026-09-05 shifted every index after it by one, and a suite written positionally would have gone
 * on asserting — green — about whichever column had slid into the slot. **An assertion that
 * silently retargets is worse than one that breaks**, because it keeps its name while changing its
 * subject, and the name is what a reviewer reads.
 */
function cellsUnder(testId: string, header: string): string[] {
  const table = screen.getByTestId(testId);
  const headers = [...table.querySelectorAll("thead th")].map((th) => (th.textContent ?? "").trim());
  const index = headers.indexOf(header);
  if (index < 0) throw new Error(`${testId} has no column headed "${header}" — headers are: ${headers.join(" | ")}`);
  return [...table.querySelectorAll("tbody tr")].map((row) => (row.children[index]?.textContent ?? "").trim());
}

function headersOf(testId: string): string[] {
  return within(screen.getByTestId(testId))
    .getAllByRole("columnheader")
    .map((th) => (th.textContent ?? "").trim().toLowerCase())
    .filter((text) => text.length > 0);
}

describe("the comparisons page sets wards beside wards and departments beside departments", () => {
  /**
   * ⚠️ **THE FLOOR FIRST.** Every assertion below is about the SHAPE of two tables. A page
   * rendering neither satisfies most of them vacuously, and that is the state this page was in
   * before today — so the population is asserted before anything is asserted about it.
   */
  it("renders both tables, with a row for every ward and every department", () => {
    renderCompare();
    for (const testId of [WARD_TABLE, ED_TABLE]) {
      expect(screen.queryByTestId(testId), `${testId} is not on the page — nothing below can fail`).not.toBeNull();
    }
    expect(within(screen.getByTestId(WARD_TABLE)).getAllByRole("row").length - 1).toBe(allUnits().length);
    expect(within(screen.getByTestId(ED_TABLE)).getAllByRole("row").length - 1).toBe(allEmergencyDepartments().length);
  });

  /**
   * 🔴 The claim of the whole page. If these two ever share a column set, somebody has merged them
   * and the merge is the defect — not the presentation of it.
   */
  it("gives the two tables different column sets, because the records they attribute from differ", () => {
    renderCompare();
    const wards = headersOf(WARD_TABLE);
    const eds = headersOf(ED_TABLE);
    expect(wards.length, "the ward table has no columns").toBeGreaterThan(1);
    expect(eds.length, "the department table has no columns").toBeGreaterThan(1);
    expect(wards, "wards and departments are being shown the same measure set").not.toEqual(eds);
    // Beyond "not identical": the bed measures must not appear over departments at all.
    for (const bedWord of ["stay", "bed", "discharge"]) {
      expect(
        eds.some((header) => header.includes(bedWord)),
        `the department table carries a bed measure ("${bedWord}") — a department has no beds in this model`,
      ).toBe(false);
    }
  });

  /**
   * ⚠️ **NO BLANK CELL, ANYWHERE, IN EITHER TABLE.** This is the assertion that fails if somebody
   * later merges the two and pads the gaps.
   */
  it("leaves no cell empty, because a blank in a comparison reads as a measured zero", () => {
    renderCompare();
    for (const testId of [WARD_TABLE, ED_TABLE]) {
      const cells = within(screen.getByTestId(testId)).getAllByRole("cell");
      expect(cells.length, `${testId} has no cells`).toBeGreaterThan(0);
      for (const cell of cells) {
        expect((cell.textContent ?? "").trim().length, `an empty cell in ${testId}`).toBeGreaterThan(0);
      }
    }
  });

  /**
   * Ruling E15: no colour encodes a threshold. A uniform tint is only honest to a reader who has
   * seen enough rows to know it is uniform, and a reader of a comparison sees one row at a time.
   */
  it("encodes no threshold in a colour, on either table", () => {
    renderCompare();
    for (const testId of [WARD_TABLE, ED_TABLE]) {
      const table = screen.getByTestId(testId);
      expect(table.querySelectorAll("[data-level]").length, `${testId} marks rows by level`).toBe(0);
      expect(table.querySelectorAll("[data-tone]").length, `${testId} marks cells by tone`).toBe(0);
    }
  });

  /**
   * The wrapper never reorders, so the ward order is the caller's — `allWardStatistics(units, …)`
   * follows `units`, and that ordering means something clinically.
   */
  it("keeps the caller's ordering rather than imposing one", () => {
    renderCompare();
    const rowNames = within(screen.getByTestId(WARD_TABLE))
      .getAllByRole("row")
      .slice(1)
      .map((row) => (row.textContent ?? "").trim());
    const expected = allUnits().map((unit) => unit.name);
    expect(
      expected.every((name, index) => rowNames[index]?.startsWith(name)),
      `ward rows are not in units order: ${rowNames.slice(0, 3).join(" | ")}`,
    ).toBe(true);
  });

  /**
   * 🔴 **THE ALIGNMENT RULE WAS INERT AND EVERY TEST HERE STILL PASSED.** As a bare `.num` it lost
   * to the shared block's `.table th, .table td { text-align: left }` on specificity — (0,1,0)
   * against (0,2,0) — so the figures rendered left-aligned while the stylesheet read as though they
   * were right. **Found by opening the page**, not by anything in this file.
   *
   * ⚠️ **AND IT IS ASSERTED AGAINST THE STYLESHEET RATHER THAN THE DOM, BECAUSE THE DOM CANNOT
   * ANSWER IT HERE.** The obvious guard is `getComputedStyle(cell).textAlign === "right"`. That was
   * written first and it failed with `expected '' to be 'right'` — jsdom loads no CSS Modules
   * stylesheet, so every computed style in this environment is empty. A DOM assertion about
   * alignment can only ever FAIL here; it cannot pass, and a guard that cannot pass is as useless
   * as one that cannot fail.
   *
   * So the property checked is the one that actually broke: the rule that right-aligns figures must
   * be SCOPED to a table selector, because an unscoped one is outranked. Comments are stripped
   * first — a text-scanning guard is satisfied by prose unless it excludes prose, and this file's
   * own comments say `text-align: right` more than once.
   */
  it("scopes the right-alignment rule to a table selector, because an unscoped one is outranked", () => {
    const css = stripComments(readFileSync(STATISTICS_CSS, "utf8"));
    const aligning = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/gu)].filter(([, , body]) =>
      /text-align:\s*right/u.test(body),
    );
    expect(aligning.length, "no rule right-aligns anything in this stylesheet").toBeGreaterThan(0);
    for (const [, selector] of aligning) {
      expect(
        /\.[a-zA-Z]*[Tt]able[a-zA-Z]*\s+\w*\.?\w*/u.test(selector),
        `a right-alignment rule is not scoped to a table selector and will lose to the shared ` +
          `block's own \`.table td\`: ${selector.trim()}`,
      ).toBe(true);
    }
  });

  /**
   * A raw average reached the page as `44.33680555555556 days` and no assertion here minded. A
   * figure a clinician cannot read at a glance is not a rendering nit on a comparison table — the
   * column exists to be scanned.
   */
  it("renders no unrounded figure", () => {
    renderCompare();
    for (const testId of [WARD_TABLE, ED_TABLE]) {
      for (const cell of within(screen.getByTestId(testId)).getAllByRole("cell")) {
        const text = cell.textContent ?? "";
        expect(text, `an unrounded figure in ${testId}: "${text}"`).not.toMatch(/\d+\.\d{2,}/u);
      }
    }
  });

  /**
   * 🔴 **A MEASURED NOUGHT IS A MEASUREMENT AND MUST NOT BE WORDED AS AN ABSENCE.** Every column
   * named below is the length of a filtered list or a `number` field that is never `number | null`,
   * and `ward-statistics.ts` says so itself: "the count-based figures … are genuine counts, so `0`
   * is a true and correct answer for them when there is no data."
   *
   * ⚠️ **THEY RENDERED AS A MUTED "none" AND EVERY ASSERTION IN THIS FILE PASSED, BECAUSE THIS IS
   * THIS PAGE'S OWN GOVERNANCE SENTENCE RUN BACKWARDS.** The page refuses a blank cell because a
   * blank reads as a measured nought — and then let a measured nought read as an absence, which
   * destroys the same distinction from the other side. The "no empty cell" test above is satisfied
   * by the word "none", so nothing here could ever have caught it. **Found by a second reader
   * comparing the rendered columns against the derivation, not by this suite.**
   *
   * Which direction cost more, on the seed as it stands: twelve of twenty-three wards have nobody
   * ready-to-leave-but-blocked and seven of eight departments have nobody marked urgent. Those are
   * facts about those units, and they were rendering as "we have nothing for you".
   */
  it.each([
    { table: WARD_TABLE, name: "Ready, blocked" },
    { table: WARD_TABLE, name: "Long stays" },
    { table: ED_TABLE, name: "On the list" },
    { table: ED_TABLE, name: "Marked urgent" },
    { table: ED_TABLE, name: "No ward yet" },
  ])("renders every $name figure as a bare integer, nought included", ({ table, name }) => {
    renderCompare();
    const cells = cellsUnder(table, name);
    expect(cells.length, `${table} has no body rows — nothing below can fail`).toBeGreaterThan(0);
    for (const text of cells) {
      expect(text, `"${name}" rendered "${text}" instead of a count`).toMatch(/^\d+$/u);
    }
  });

  /**
   * The other half of the same rule, kept separate on purpose: `Average stay` is `number | null` and
   * its absence is real, so it may be worded — and when it is, the wording must carry no numeral, or
   * the reader is handed a figure inside a statement that there is none. `Discharge dates` is a
   * third thing again: a ratio that cannot be formed, since 0 of 0 is undefined rather than zero.
   */
  it.each([{ name: "Average stay" }, { name: "Discharge dates" }])(
    "lets $name state its absence in words, and never with a numeral in them",
    ({ name }) => {
      renderCompare();
      const cells = cellsUnder(WARD_TABLE, name);
      expect(cells.length, "the ward table has no body rows").toBeGreaterThan(0);
      for (const text of cells) {
        expect(text.length, `"${name}" is empty`).toBeGreaterThan(0);
        // A worded cell is one with no digit anywhere. A figure cell must not be the bare word
        // "none", which is what a measured nought looked like before 2026-09-05.
        if (!/\d/u.test(text)) expect(text, `"${name}" states an absence as bare "none"`).not.toBe("none");
      }
    },
  );

  /**
   * 🔴 **THE NULL-AVERAGE BRANCH IS RENDERED BY NOTHING IN THE SEEDED FIXTURE, SO EVERY ASSERTION
   * ABOVE IS SILENT ABOUT IT.** Measured on the running page: nought of twenty-three wards has a
   * null `averageLengthOfStayDays` or `averageEmptyBedMinutes`. Ward Lead's ruling names a null
   * average rendered as a number **the single most likely way these screens could lie**, and on
   * this screen that branch had no test and no render. Found by a second reader asking what the
   * third styling treatment looked like, and discovering he had never seen the second.
   *
   * ⚠️ **THE FIXTURE IS THE ARGUMENT, AND IT IS `ward-statistics-ward-nulls.dom.test.tsx`'s.** One
   * ward with no admissions produces BOTH kinds of answer in the same render — two null averages
   * and two true noughts — so a page that words them the same way fails here rather than passing
   * on a fixture that only ever shows one kind.
   */
  describe("a ward with nothing recorded, which the seed cannot produce", () => {
    const UNIT = allUnits()[0];

    function renderEmpty() {
      return render(
        <WardFlowProvider>
          <StatisticsCompareScreen units={[UNIT]} admissions={[]} />
        </WardFlowProvider>,
      );
    }

    /** The premise, pinned rather than assumed: this fixture really does produce both kinds at once. */
    it("keeps producing two null averages and two true noughts", () => {
      const stats = wardStatistics(UNIT.id, [], NOW_ANCHOR);
      expect(stats.averageLengthOfStayDays, "fixture no longer yields a null length of stay").toBeNull();
      expect(stats.averageEmptyBedMinutes, "fixture no longer yields a null empty-bed figure").toBeNull();
      expect(stats.readyToLeaveCannot, "readyToLeaveCannot is not a true nought here").toBe(0);
      expect(stats.longStays, "longStays is not a true nought here").toBe(0);
    });

    it.each([{ name: "Average stay" }, { name: "Discharge dates" }])(
      "renders $name in words, with no digit anywhere in it",
      ({ name }) => {
        renderEmpty();
        const [text] = cellsUnder(WARD_TABLE, name);
        expect(text.length, `${name} rendered empty`).toBeGreaterThan(0);
        // No digit at all, which is stricter than "no 0": a null shown as 0, 0.0 or rounded into
        // any other number is caught by the same assertion.
        expect(text, `${name} put a digit on the page for a value that cannot be measured: "${text}"`).not.toMatch(
          /\d/u,
        );
        expect(text, `${name} flattened to a dash, which cannot say which absence it means`).not.toMatch(/[—–-]\s*$/u);
      },
    );

    /**
     * 🔴 **THE DISTINCTION THE WHOLE PAGE TURNS ON, ASSERTED IN ONE RENDER.** Both kinds of answer
     * are on this row at once. If the screen ever words them the same way, a reader cannot tell
     * "nothing to measure" from "measured, and the answer is none".
     */
    it("does not render an unmeasurable average the same way as a true nought", () => {
      renderEmpty();
      const cell = (header: string) => cellsUnder(WARD_TABLE, header)[0].toLowerCase();
      const unmeasurable = [cell("Average stay"), cell("Discharge dates")];
      const noughts = [cell("Ready, blocked"), cell("Long stays")];
      for (const absent of unmeasurable) {
        for (const nought of noughts) {
          expect(absent, `an unmeasurable average and a true nought render identically: "${absent}"`).not.toBe(nought);
        }
      }
      expect(noughts, "a true nought is no longer rendered as a bare integer").toEqual(["0", "0"]);
    });
  });

  /**
   * 🔴 **NO COLUMN ON EITHER TABLE MAY GIVE EVERY UNIT THE SAME ANSWER.** Ward Lead's ruling,
   * 2026-09-05, on a stronger diagnosis than the one that reached him: `Empty-bed time` did not
   * merely happen to be flat on this seed — **it was arithmetically incapable of varying.** Verified
   * in `ward-admissions-seed.ts`: `PULL_TO_ARRIVAL_MINUTES = 5 * 60` at `:71`, and both admission
   * shapes that can yield a gap define `pulledAt` as `arrivedAt` minus that constant (`:278`,
   * `:346`); the shape whose `pulledAt` does vary carries `arrivedAt: null` (`:245`) and is excluded
   * by the derivation. **So twenty-three rows of "300 min" were the constant printed twenty-three
   * times with ward names beside it**, indistinguishable to a reader from twenty-three wards that
   * genuinely perform alike. The column was removed rather than annotated.
   *
   * ⚠️ **THE LIST OF KNOWN OFFENDERS BELOW IS EMPTY, AND THAT IS A RESULT RATHER THAN A STARTING
   * POINT.** An empty allowlist means either "we finished" or "we stopped looking", and the two are
   * indistinguishable from outside — the exact shape found in `ward-table-single-source` a day
   * earlier. **Here it means finished: every column on both tables was checked on the seeded
   * fixture on 2026-09-05, one was uniform, and it was removed.** The assertion is not that the
   * list is empty; it is that the page is.
   *
   * ⚠️ **AND THE MUTATION THAT PROVES IT IS THE REGRESSION ITSELF: PUT THE COLUMN BACK.** Not an
   * artificial edit — precisely the change to fear.
   */
  it("ships no column that gives every unit the same answer", () => {
    renderCompare();
    for (const testId of [WARD_TABLE, ED_TABLE]) {
      const table = screen.getByTestId(testId);
      const headers = [...table.querySelectorAll("thead th")].map((th) => (th.textContent ?? "").trim()).slice(1);
      expect(headers.length, `${testId} has no measure columns — nothing below can fail`).toBeGreaterThan(1);
      const rows = [...table.querySelectorAll("tbody tr")];
      expect(rows.length, `${testId} has fewer than two rows, so uniformity is undefined`).toBeGreaterThan(1);
      for (const header of headers) {
        const distinct = new Set(cellsUnder(testId, header));
        expect(
          distinct.size,
          `"${header}" reads "${[...distinct][0]}" on every row of ${testId} — it separates nothing, and on a ` +
            `comparison screen a constant reads as a measured sameness`,
        ).toBeGreaterThan(1);
      }
    }
    // Nothing is uniform, so the backstop note must be absent from both tables.
    for (const testId of [WARD_TABLE, ED_TABLE]) {
      expect(screen.queryByTestId(`${testId}-uniform`), `${testId} carries a uniform-column note`).toBeNull();
    }
  });

  it("names every uniform column when a fixture makes them all uniform", () => {
    const [first, second] = allUnits();
    render(
      <WardFlowProvider>
        <StatisticsCompareScreen units={[first, second]} admissions={[]} />
      </WardFlowProvider>,
    );
    const note = screen.getByTestId(`${WARD_TABLE}-uniform`).textContent ?? "";
    // The expected set is read off the rendered table rather than typed. A hand-written list of
    // column names in a test is a second home for the column set, and it went stale within the hour
    // the first time — `Empty-bed time` was removed and this assertion went on demanding it.
    const headers = [...screen.getByTestId(WARD_TABLE).querySelectorAll("thead th")]
      .map((th) => (th.textContent ?? "").trim())
      .slice(1);
    expect(headers.length, "the ward table has no measure columns, so this proves nothing").toBeGreaterThan(1);
    for (const header of headers) {
      expect(note, `${header} is uniform on this fixture and is not named`).toContain(header);
    }
  });

  /**
   * ⚠️ **ONE ROW CANNOT BE UNIFORM IN ANY USEFUL SENSE.** A single-ward table trivially gives "every
   * ward" the same answer in all five columns, and a note saying so would be a degeneracy of the
   * arithmetic rather than an observation about the data.
   */
  it("says nothing about uniformity when there is only one row to compare", () => {
    render(
      <WardFlowProvider>
        <StatisticsCompareScreen units={[allUnits()[0]]} admissions={[]} />
      </WardFlowProvider>,
    );
    expect(
      screen.queryByTestId(`${WARD_TABLE}-uniform`),
      "a one-row table claimed its columns separate nothing",
    ).toBeNull();
  });

  /**
   * 🔴 **A THRESHOLD MEASURED AGAINST A TABLE THAT HAS SINCE CHANGED SHAPE IS NOT A MEASUREMENT ANY
   * MORE — AND NOTHING IN THIS REPOSITORY CONNECTED THE TWO.** Ward Lead's ruling, 2026-09-05, after
   * this file's own pin went stale TWICE in one day, both times from a change that was not about
   * width:
   *
   *   50.5rem  measured against six columns   -> a column was removed on a ruling
   *   38rem    measured against five columns  -> row headers were allowed to wrap
   *   35rem    measured against five columns, headers wrapping
   *
   * **Neither reading was wrong when it was taken.** Removing a column did not make the measurement
   * incorrect; it made it a measurement of a DIFFERENT TABLE. That is the part that generalises past
   * pins: **a measurement's subject can change without the measurement changing, and nothing
   * announces it.**
   *
   * ⚠️ **AN OVER-PIN IS NOT A MILDER INERT PIN. IT IS WORSE, AND IT HIDES IN THE SAME THREE PLACES.**
   * An inert pin does nothing; an over-pin actively forces a horizontal scroll that was not required
   * and pushes columns off a scroller they would have fitted — manufacturing the very defect a pin
   * exists to prevent, while the stylesheet reads deliberate, the pin map reads measured, and the
   * page looks perfect at desk width.
   *
   * So the two facts are read from where they actually live — the pin from the stylesheet, the
   * column count from the render — and both are checked against what was recorded when the
   * measurement was taken. **Change either without re-measuring and this goes red naming both.**
   */
  it.each([
    { table: WARD_TABLE, selector: ".compareWardTable", pin: "35rem", columnsWhenMeasured: 5 },
    { table: WARD_TABLE, selector: ".compareEdTable", pin: "27.5rem", columnsWhenMeasured: 4, use: ED_TABLE },
  ])("$selector was measured at $pin against $columnsWhenMeasured columns, and still has them", (entry) => {
    const testId = entry.use ?? entry.table;
    renderCompare();
    const rendered = within(screen.getByTestId(testId)).getAllByRole("columnheader").length;
    expect(
      rendered,
      `${entry.selector} is pinned at ${entry.pin}, measured on a running page against ` +
        `${entry.columnsWhenMeasured} columns, and now renders ${rendered}. The pin is a measurement of a ` +
        `table that no longer exists — re-measure it in a browser rather than adjusting this number`,
    ).toBe(entry.columnsWhenMeasured);

    const css = stripComments(readFileSync(STATISTICS_CSS, "utf8"));
    const block = new RegExp(`\\${entry.selector}\\s*\\{[^}]*--ward-table-min-width:\\s*([^;]+);`, "u").exec(css);
    expect(block, `${entry.selector} no longer declares a --ward-table-min-width`).not.toBeNull();
    expect(
      block?.[1].trim(),
      `${entry.selector}'s threshold moved without its column count changing — if the table did not change ` +
        `shape, the new value needs its own browser measurement rather than this line being updated to match`,
    ).toBe(entry.pin);
  });

  /** Neither table sorts, carries a totals row, or marks a row — none of which exists anywhere in the ward estate. */
  it("adds no sorting, no totals row and no row markers", () => {
    renderCompare();
    for (const testId of [WARD_TABLE, ED_TABLE]) {
      const table = screen.getByTestId(testId);
      expect(table.querySelectorAll("tfoot").length, `${testId} has a totals row`).toBe(0);
      expect(table.querySelectorAll("th button, td button").length, `${testId} has an in-table control`).toBe(0);
      expect(table.querySelectorAll("[aria-sort]").length, `${testId} offers sorting`).toBe(0);
    }
  });
});
