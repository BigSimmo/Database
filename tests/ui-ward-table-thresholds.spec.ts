import { expect, test } from "playwright/test";

/**
 * 🔴 **EVERY WARD TABLE'S SCROLL THRESHOLD, MEASURED AGAINST THE TABLE THAT IS ACTUALLY THERE.**
 *
 * Ward Lead's ruling, 2026-09-05, and the general form of the day's most expensive finding: **a
 * threshold measured against a table that has since changed shape is not a measurement any more.**
 * The comparisons screen's pin went stale three times in one day — a column removed on a ruling,
 * then a wrapping rule relaxed — and **every reading was correct when it was taken.** Nothing made
 * it wrong; a change elsewhere made it a measurement of a different table.
 *
 * ⚠️ **AN OVER-PIN IS WORSE THAN AN INERT ONE AND HIDES IN THE SAME PLACES.** An inert threshold
 * does nothing. An over-pin actively forces a horizontal scroll that was not required and pushes
 * columns off a scroller they would have fitted — manufacturing the very defect a threshold exists
 * to prevent — while the stylesheet reads deliberate, the pin map reads measured, and the page looks
 * perfect at desk width. **Neither is visible to a static check**, which is why this runs in a
 * browser.
 *
 * ⚠️ **IT ASSERTS ONLY THE TABLES I OWN AND REPORTS THE REST, DELIBERATELY.** Pinning another
 * screen's shape here would make my suite go red on somebody else's legitimate redesign, and a
 * guard that fires on correct work is one that gets deleted. Every other table is surfaced with its
 * numbers for its own owner.
 */

/**
 * 🔴 **WHY A PROBE THAT WORKS BY HAND RETURNED THE PIN IN HERE, AND WHAT IT ALSO CORRUPTED.**
 *
 * An earlier version of this file dropped its min-content measurement rather than ship it: it
 * returned a figure exactly equal to the threshold for every table on every route, and the reason
 * could not be explained. It was explained on 2026-09-05, and the explanation is worth more than the
 * measurement, because **it was silently corrupting the max-content number this file already
 * shipped, in the one direction that mattered.**
 *
 * **The mechanism is a CSS transition, created by the reduced-motion accessibility reset.**
 *
 *   1. `transition-property`'s INITIAL value is `all`. Nothing in this repository sets it on a ward
 *      table — measured: a walk of every rule in every stylesheet that matches the element finds no
 *      author declaration of `transition` or `transition-property` on it at all. It is `all` because
 *      that is the property's default, and it is normally inert because the default
 *      `transition-duration` is `0s`.
 *   2. `globals.css`'s reduced-motion block sets `transition-duration: 0.01ms !important` on `*`.
 *      It changes the DURATION only and leaves the `all` property list alone — so under reduced
 *      motion, every interpolable property change on every element becomes a real, 0.01ms-long
 *      transition.
 *   3. `playwright.config.ts` sets `contextOptions: { reducedMotion: "reduce" }` for the whole
 *      suite. **So that reset is in force in here and is not in force in a browser window**, which
 *      is the entire difference between this file and a hand probe in devtools.
 *   4. **A transition outranks even an `!important` author declaration** — it is the highest origin
 *      in the cascade. Writing `min-width: 0px` starts a transition FROM the pin, and inside one
 *      synchronous block no time has passed, so the transition's output is still its start value.
 *      The write lands — the inline `cssText` reads `min-width: 0px` — and the used value does not
 *      move. What comes back is the pre-mutation computed min-width, which IS the threshold, on
 *      every table, exactly, which is why it looked like a keyword bug in `width: min-content`.
 *
 * **The measured A/B — same browser, same page, same code, one variable** (`page.emulateMedia`):
 *
 *   reduce         transition-duration 1e-05s, a live CSSTransition on the element, min-width reads
 *                  480px after being set to 0px, min-content reads 480  ← the wrong answer on demand
 *   no-preference  transition-duration 0s, no animations at all, min-width reads 0px,
 *                  min-content reads 295  ← agrees with the devtools hand probe
 *
 * **Three tables were immune, and that is the confirming detail rather than a loose end.**
 * `/referrals` (`referrals.module.css`: `@media (prefers-reduced-motion: reduce) { .screen * {
 * transition: none !important } }`) and `/queue` (`WardModeWorkspace`, whose `.modeShell` composes
 * `descendantKillWithScroll` from `ward-reduced-motion.module.css` — the same kill) compute
 * `transition-property: none`, so no transition is ever created and the naive probe returned their
 * true widths: 403px and 300px on the two referral boards, matching Ward Builder Three's own
 * measurement to the pixel, while the other ten returned their pins. **The split is exactly the set
 * of screens carrying a reduced-motion transition kill**, which no coincidence produces.
 *
 * ⚠️ **AND IT WAS ALREADY POISONING max-content, IN THE ONE DIRECTION THAT MATTERS.** `width:
 * max-content` is a keyword, not a length: length→keyword is not interpolable, so it snaps and no
 * transition is created for it. That is why max-content "demonstrably varied" and looked healthy.
 * But the frozen `min-width` still floored the result, so **any table whose real max-content sits
 * BELOW its pin reported max-content == pin** — and `minWidthPx > maxContentPx` is precisely the
 * over-pin test below. **The detector was blind in the only case it exists to catch.** Escalation's
 * second table reported 704px (its pin) and actually measures 640px: a genuine over-pin this file
 * called healthy on every previous run. The comparisons tables reported 560/440 (their pins) and
 * actually measure 557/436.
 *
 * **The fix is one line and it is not the obvious one.** Setting `transition: none` inline works,
 * but NOT by zeroing the duration — the reset's `!important` duration outranks any inline
 * declaration. It works because the shorthand also sets `transition-property: none`, which the reset
 * never touches. This file writes that property explicitly, so the thing being relied on is the
 * thing being asked for.
 */

/**
 * The two tables on the comparisons screen, recorded with the browser measurement that set their
 * thresholds. **Recorded, not guessed** — a first draft of this file typed plausible numbers from
 * memory and the sweep's own assertion caught three of them wrong on its first run, including a
 * route that has two tables where I had written one.
 */
const OWNED = "/mockups/ward-flow/statistics/compare";
const OWNED_TABLES: readonly { readonly testId: string; readonly columns: number; readonly minWidthPx: number }[] = [
  { testId: "ward-statistics-compare-wards", columns: 5, minWidthPx: 560 },
  { testId: "ward-statistics-compare-eds", columns: 4, minWidthPx: 440 },
];

/**
 * Routes the sweep visits.
 *
 * ⚠️ **SEVEN OF THE ELEVEN WARD ROUTES THAT RENDER A TABLE, AND SAYING SO IS THE POINT.** A separate
 * read-only sweep of all 32 route files and their import graphs establishes the denominator: eleven
 * routes render at least one table, and this list reaches seven of them. **The four it misses are
 * named rather than left to be discovered:**
 *
 *   /capacity      `.dataTable` in `ward-management-modes.module.css` — a bare `<table>` with NO
 *                  wrapper element at all; overflow is handled by `.panel:has(.dataTable)` on an
 *                  ancestor, inside a media query. This selector cannot see it.
 *   /network       `.compareTable` in `ward-management-network.module.css` — rendered only while no
 *                  referral is selected, so it is state-conditional as well as unlisted.
 *   /ed/[edId]     `.capacityTable` in `ed/ed.module.css`
 *   /handover      four `<table>`s directly inside `<section>`, no wrapper of any kind; each renders
 *                  only when its own list is non-empty.
 *
 * **Three of the four share one reason: the table has no wrapper element**, so a sweep keyed on a
 * scroll wrapper finds nothing however many routes it visits. Widening the ROUTES list alone would
 * not reach them — the selector has to change too, and that is a separate piece of work rather than
 * an omission to fix by adding lines here.
 *
 * A table that renders only in some state is likewise absent from the count rather than silently
 * absent from the check, which is why the figure is printed on every run.
 */
const ROUTES = [
  OWNED,
  "/mockups/ward-flow/out-of-area",
  "/mockups/ward-flow/escalation",
  "/mockups/ward-flow/discharges",
  "/mockups/ward-flow/referrals",
  "/mockups/ward-flow/search",
  "/mockups/ward-flow/queue",
] as const;

/**
 * The table used for the instrument's two-method cross-check. It is somebody else's screen and this
 * file asserts NOTHING about its design — only that two unrelated ways of measuring it land on the
 * same number, which is a fact about the probe rather than about the table.
 */
const CROSS_CHECK_ROUTE = "/mockups/ward-flow/out-of-area";
const CROSS_CHECK_TESTID = "ward-out-of-area-table";

/** A width no ward table's content could coincidentally produce, so a match cannot be luck. */
const SENTINEL_PX = 1234;

type Measured = {
  readonly testId: string;
  readonly columns: number;
  readonly minWidthPx: number;
  readonly minContentPx: number;
  readonly maxContentPx: number;
  /** `min-content` again, measured by starving the WRAPPER instead of sizing the table. */
  readonly minContentBySqueezePx: number;
  /** What `min-width` actually computed to after the probe cleared it. Must be `0px`. */
  readonly clearedMinWidth: string;
  /** Width the table took when the probe pinned it to the sentinel. Must be the sentinel. */
  readonly sentinelWidthPx: number;
};

test.describe("@mockup every ward table's threshold still describes the table it was measured for", () => {
  test("sweeps the estate, holds the comparisons thresholds, and reports the rest", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    const seen: Record<string, Measured[]> = {};
    let tablesWalked = 0;

    for (const route of ROUTES) {
      await page.goto(route, { waitUntil: "load" });
      await page.waitForLoadState("networkidle");
      // React streams a hidden staging copy of the screen; measuring geometry against it would be
      // meaningless even where it does not double every locator.
      await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0, { timeout: 15_000 });

      const measured: Measured[] = await page.evaluate(
        (sentinel) =>
          [...document.querySelectorAll('[data-ward-primitive="table"], [class*="tableScroll"]')].flatMap(
            (scroller) => {
              const table = scroller.querySelector("table");
              if (!(table instanceof HTMLTableElement)) return [];
              const wrapper = scroller as HTMLElement;
              const width = () => table.getBoundingClientRect().width;

              const previousWidth = table.style.width;
              const previousMin = table.style.minWidth;
              const previousWrapperWidth = wrapper.style.width;
              const threshold = getComputedStyle(table).minWidth;
              const columns = table.querySelectorAll("thead th").length;

              /*
               * ⚠️ FIRST, AND BEFORE ANY GEOMETRY IS TOUCHED. Under the suite-wide
               * `reducedMotion: "reduce"`, `globals.css` gives every element a 0.01ms
               * `transition-duration` while the default `transition-property: all` stays in place,
               * so the first length written here would otherwise start a transition — and a
               * transition outranks `!important`, freezing the used value at the pin for the whole
               * synchronous block. See this file's head comment for the measured A/B.
               * `transition-property` is what has to go: the reset's `!important` DURATION cannot be
               * beaten from an inline declaration, and does not need to be.
               */
              table.style.setProperty("transition-property", "none", "important");
              wrapper.style.setProperty("transition-property", "none", "important");

              table.style.minWidth = "0px";
              const clearedMinWidth = getComputedStyle(table).minWidth;

              table.style.width = "min-content";
              const minContent = width();
              table.style.width = "max-content";
              const maxContent = width();

              // Second method, sharing nothing with the first: leave the table's own `width` alone
              // and starve it of space instead.
              table.style.width = previousWidth;
              wrapper.style.width = "1px";
              const minContentBySqueeze = width();
              wrapper.style.width = previousWrapperWidth;

              // Does a write to `min-width` move this table at all? A frozen probe fails here.
              table.style.width = "min-content";
              table.style.minWidth = `${sentinel}px`;
              const sentinelWidth = width();

              table.style.width = previousWidth;
              table.style.minWidth = previousMin;
              table.style.removeProperty("transition-property");
              wrapper.style.removeProperty("transition-property");

              return [
                {
                  testId: scroller.getAttribute("data-testid") ?? "(no testid)",
                  columns,
                  minWidthPx: threshold.endsWith("px") ? Math.round(Number.parseFloat(threshold)) : 0,
                  minContentPx: Math.round(minContent),
                  maxContentPx: Math.round(maxContent),
                  minContentBySqueezePx: Math.round(minContentBySqueeze),
                  clearedMinWidth,
                  sentinelWidthPx: Math.round(sentinelWidth),
                },
              ];
            },
          ),
        SENTINEL_PX,
      );
      seen[route] = measured;
      tablesWalked += measured.length;
    }

    console.log(`ward-table threshold sweep: ${tablesWalked} tables across ${ROUTES.length} routes`, seen);

    /*
     * ⚠️ THE FLOOR IS ON THE SWEEP, AND IT IS THE ASSERTION MOST LIKELY TO SAVE THIS FILE. Everything
     * below is "the recorded shape still matches". A sweep that reached no tables — a route renamed,
     * the primitive's attribute dropped, a screen that renders its tables only with state this run
     * does not have — satisfies all of it and reports a clean estate.
     */
    expect(tablesWalked, "the sweep reached no ward tables at all, so nothing below was checked").toBeGreaterThan(8);

    /*
     * 🔴 **THE INSTRUMENT CHECK, AND IT IS DELIBERATELY NOT AN `every()` OVER A DESIGN DECISION.**
     *
     * The control this replaces asked whether every pinned table's intrinsic width equalled its
     * threshold, and it let ten wrong readings through the moment one table legitimately differed.
     * The two assertions below are not about any screen's design, and no member of the population
     * may legitimately differ from them: **a `min-width` set to `0px` must compute to `0px`, and a
     * table pinned to a sentinel must be that wide.** Both are properties of the probe, not the page.
     *
     * ⚠️ **AND NOTE WHAT DOES NOT DISCRIMINATE, BECAUSE IT WAS MEASURED.** "Measure one table two
     * independent ways and fail if they disagree" is not sufficient on its own here: under the
     * transition freeze BOTH methods returned 480px, because both were floored by the same
     * un-clearable pin. Two agreeing methods behind one shared blocker agree on the wrong answer.
     * The cross-check below is kept — it catches a different class of fault, a table-sizing
     * assumption the wrapper-squeeze does not share — but the assertions that actually go red on the
     * state this file shipped with are these two.
     *
     * Proved by mutation, 2026-09-05: deleting the `transition-property` line above turns
     * `clearedMinWidth` into the pin on ten of the thirteen tables and the sentinel width into the
     * table's pre-write width, and both assertions fail naming them.
     */
    const frozen = Object.entries(seen).flatMap(([route, tables]) =>
      tables
        .filter((table) => table.clearedMinWidth !== "0px")
        .map(
          (table) =>
            `${route} ${table.testId}: min-width was set to 0px and computes to ${table.clearedMinWidth} — ` +
            `every width reported for it is the pin, not a measurement`,
        ),
    );
    expect(frozen, "the probe could not clear the pin, so nothing it measured is an intrinsic width").toEqual([]);

    const unmoved = Object.entries(seen).flatMap(([route, tables]) =>
      tables
        .filter((table) => table.sentinelWidthPx !== SENTINEL_PX)
        .map(
          (table) =>
            `${route} ${table.testId}: pinned to ${SENTINEL_PX}px and measured ${table.sentinelWidthPx}px — ` +
            `this table does not respond to the probe's writes`,
        ),
    );
    expect(unmoved, "a write to min-width did not move the table, so the probe is not measuring it").toEqual([]);

    const crossCheck = (seen[CROSS_CHECK_ROUTE] ?? []).find((table) => table.testId === CROSS_CHECK_TESTID);
    expect(
      crossCheck,
      `${CROSS_CHECK_TESTID} is no longer on ${CROSS_CHECK_ROUTE}, so the two-method cross-check did not run`,
    ).toBeDefined();
    expect(
      Math.abs((crossCheck?.minContentPx ?? 0) - (crossCheck?.minContentBySqueezePx ?? -1)),
      `sizing the table and starving its wrapper disagree about ${CROSS_CHECK_TESTID}'s intrinsic width ` +
        `(${crossCheck?.minContentPx}px vs ${crossCheck?.minContentBySqueezePx}px)`,
    ).toBeLessThanOrEqual(1);

    const owned = seen[OWNED] ?? [];
    expect(
      owned.map((table) => table.testId),
      "the comparisons screen no longer renders the two tables this file was written for",
    ).toEqual(OWNED_TABLES.map((table) => table.testId));

    const drifted: string[] = [];
    for (const [index, expectation] of OWNED_TABLES.entries()) {
      const table = owned[index];
      if (table.columns !== expectation.columns) {
        drifted.push(
          `${table.testId}: threshold ${table.minWidthPx}px was measured against ${expectation.columns} columns and ` +
            `the table now renders ${table.columns}. It is a measurement of a table that no longer exists — ` +
            `re-measure it in a browser rather than editing this number`,
        );
      }
      if (table.minWidthPx !== expectation.minWidthPx) {
        drifted.push(
          `${table.testId}: threshold moved from ${expectation.minWidthPx}px to ${table.minWidthPx}px without its ` +
            `column count changing — the new value needs its own measurement`,
        );
      }
    }
    expect(drifted, "a comparisons table's threshold no longer describes the table it was measured for").toEqual([]);

    /*
     * REPORTED, NEVER ASSERTED, AND FOR EVERY TABLE INCLUDING MINE. A threshold above a table's
     * max-content forces a scroll that was not required. Whether that is wrong is a decision about a
     * specific screen and belongs to that screen's owner — and a table may legitimately be pinned
     * above its current content if its content is expected to grow.
     */
    const overPinned = Object.entries(seen).flatMap(([route, tables]) =>
      tables
        .filter((table) => table.minWidthPx > table.maxContentPx + 8)
        .map(
          (table) =>
            `${route} ${table.testId}: threshold ${table.minWidthPx}px exceeds max-content ${table.maxContentPx}px ` +
            `by ${table.minWidthPx - table.maxContentPx}px`,
        ),
    );
    if (overPinned.length > 0) {
      console.log(`thresholds wider than their table needs (${overPinned.length}):\n  ${overPinned.join("\n  ")}`);
    }

    /*
     * REPORTED, NEVER ASSERTED — the measurement the previous version of this file dropped, restored
     * now that the readings can be explained.
     *
     * A threshold at or below a table's own min-content can never take effect: the table will not go
     * that narrow whatever the pin says. It does no harm, and it reads in the stylesheet exactly like
     * a working one, which is the whole reason for surfacing it — an owner re-measuring a screen has
     * no other way to tell a threshold that is holding a line from one that is decoration. The
     * comparison is deliberately exact rather than generous: a pin a few pixels above min-content
     * still binds, and calling that inert would be the same kind of overstatement this file exists to
     * prevent.
     */
    const inert = Object.entries(seen).flatMap(([route, tables]) =>
      tables
        .filter((table) => table.minWidthPx <= table.minContentPx)
        .map(
          (table) =>
            `${route} ${table.testId}: threshold ${table.minWidthPx}px is at or below the table's own min-content ` +
            `${table.minContentPx}px, so it can never take effect`,
        ),
    );
    console.log(
      inert.length > 0
        ? `thresholds that can never bind (${inert.length}):\n  ${inert.join("\n  ")}`
        : `no inert thresholds: all ${tablesWalked} tables are pinned above their own min-content`,
    );
  });
});
