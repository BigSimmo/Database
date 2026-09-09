import { expect, test } from "playwright/test";

/**
 * 🔴 **THE IDENTITY COLUMN MUST STILL BE ON SCREEN AFTER THE READER HAS SCROLLED TO THE FIGURES.**
 *
 * Ward Lead's ruling, 2026-09-05, on the comparisons screen at narrow widths. Six columns do not fit
 * a 305px scroller at any pin, so scrolling sideways is the accepted behaviour — **and the clinical
 * risk is not the scrolling.** It is that at 375px every column but the first left the visible
 * scroller and, on the department table, **the row header left it too.** A reader scrolled three
 * columns right, on a table whose row header is off screen, is looking at a figure they cannot
 * attribute, and the adjacent row is a different ward. **A misattributed figure is worse than a
 * hidden one, because a hidden figure announces itself.**
 *
 * ⚠️ **ASSERTED AFTER A SCROLL TO THE END, NEVER AT REST — AND THAT IS THE WHOLE GUARD.** Ward Lead
 * named this before it was written: an at-rest assertion passes today and means nothing, because at
 * rest the first column is trivially at the left edge whether or not it is pinned. **The at-rest
 * version of this test would have gone green on the broken page.**
 *
 * ⚠️ **AND SCROLLING IS WHAT FOUND THE DEFECT IN THE FIRST FIX.** `position: sticky` alone was not
 * enough: at 375px the department scroller is 305px and `Royal Perth Hospital Emergency Department`
 * was 329px on one line, so the pinned cell was WIDER THAN THE VIEWPORT IT WAS PINNED TO — scrolled
 * to the end it sat 24px off the left edge and ran 35px past the right. At rest it looked perfect.
 * The row headers now wrap and are capped.
 *
 * ⚠️ **THIS FILE RUNS IN NEITHER DEFAULT LOOP.** `verify:ui` does not select the ward E2E specs and
 * `test:focused` cannot reach a Playwright spec at all, so this is proof only when somebody runs it.
 * Named rather than left as an assumption, because a guard nobody runs and a guard that cannot fail
 * are worth the same.
 */

const COMPARE = "/mockups/ward-flow/statistics/compare";
const TABLES = ["ward-statistics-compare-wards", "ward-statistics-compare-eds"] as const;

/** Widths where the tables are narrower than they want to be. Above ~745px both fit and this is silent. */
const NARROW_WIDTHS = [375, 641, 700] as const;

test.describe("@mockup the comparisons screen keeps every row's identity on screen", () => {
  test("no row header leaves its scroller, at rest or scrolled to the end", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(COMPARE, { waitUntil: "load" });
    await page.waitForLoadState("networkidle");

    // The streamed-content guard the discharges spec uses, for the same reason: React leaves a
    // hidden staging copy of the screen in the document for a moment, so every testid resolves
    // twice and geometry measured against the staged copy would be meaningless.
    await expect(
      page.locator('div[hidden][id^="S:"]'),
      "React's streamed content is still staged, so the whole screen is duplicated in the document",
    ).toHaveCount(0, { timeout: 15_000 });

    /*
     * THE FLOOR, AND IT IS TWO FLOORS. A screen rendering no tables passes a containment assertion
     * perfectly, and so does a table with no body rows — the second is the likelier of the two here,
     * because these tables render from live state and an empty fixture would empty them silently.
     */
    for (const testId of TABLES) {
      await expect(page.getByTestId(testId), `${testId} is not on the page`).toBeVisible({ timeout: 15_000 });
    }
    const rowCounts = await page.evaluate(
      (ids) => ids.map((id) => document.querySelectorAll(`[data-testid="${id}"] tbody tr`).length),
      TABLES as unknown as string[],
    );
    for (const [index, count] of rowCounts.entries()) {
      expect(count, `${TABLES[index]} has no body rows, so nothing below would be measured`).toBeGreaterThan(1);
    }

    for (const width of NARROW_WIDTHS) {
      await page.setViewportSize({ width, height: 812 });
      for (const scrolled of [false, true] as const) {
        const escaping = await page.evaluate(
          ({ ids, toEnd }) =>
            ids.flatMap((id) => {
              const scroller = document.querySelector(`[data-testid="${id}"]`);
              if (!(scroller instanceof HTMLElement)) return [`${id}: no scroller`];
              scroller.scrollLeft = toEnd ? scroller.scrollWidth : 0;
              const box = scroller.getBoundingClientRect();
              return [...scroller.querySelectorAll("tbody th")]
                .filter((cell) => {
                  const rect = cell.getBoundingClientRect();
                  return rect.left < box.left - 1 || rect.right > box.right + 1;
                })
                .map((cell) => `${id}: "${(cell.textContent ?? "").trim()}"`);
            }),
          { ids: TABLES as unknown as string[], toEnd: scrolled },
        );
        expect(
          escaping,
          `at ${width}px${scrolled ? ", scrolled to the end" : ", at rest"} a row's identity is off its scroller, ` +
            `so the figures beside it cannot be attributed to a named unit`,
        ).toEqual([]);
      }
    }
  });
});
