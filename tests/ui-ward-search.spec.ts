import { expect, test, type Locator, type Page } from "playwright/test";

/**
 * FIRST BROWSER COVERAGE OF THE WARD FLOW PATIENT SEARCH (`/mockups/ward-flow/search`).
 *
 * Until this file, `PatientTypeahead` and `PatientSearchPage` had only jsdom coverage
 * (`tests/ward-patient-typeahead.dom.test.tsx`, `tests/ward-patient-search.dom.test.tsx`). jsdom
 * computes NO layout and loads NO CSS Modules stylesheet, so every assertion below is checking a
 * class of defect no existing test could ever have seen: a column escaping its scroll container,
 * a popup row scrolled out of its own clipped box, a hit target shorter than its container, two
 * visual states that read as one because two selectors were merged. None of that is expressible
 * without a real rendered box.
 *
 * WHY THE FIXTURE MATTERS: the seeded patient list (`ward-patients-seed.ts`) deliberately carries
 * three near-spelling pairs — Halloway/Hallowin, Marrowby/Marrowbee, O'Quinn/Oquinn — that cannot
 * be told apart by name alone. The two facts that DO tell them apart, record number (`umrn`) and
 * date of birth, are exactly what test 2 below proves stays on screen for both rows of a matching
 * pair at the narrowest supported width. Wrong-patient selection on this screen is the harm this
 * whole component was built to prevent (see `patient-typeahead.tsx`'s own doc comment), and that
 * harm lives entirely in geometry a unit test cannot see.
 *
 * FIXTURE ARITHMETIC USED THROUGHOUT, verified against `ward-patients-seed.ts` directly (not
 * assumed) and cross-checked live in a browser before this file was written:
 *   - "marrow" matches EXACTLY Ines Marrowby (PT-003) and Devan Marrowbee (PT-004) — both
 *     `familyName.startsWith("marrow")` — and nobody else of the eight seeded patients.
 *   - "a" matches all eight seeded patients (every one of their `Given Family` display names
 *     contains the letter "a"), in fixture order: PT-001..PT-008. So this text query is what
 *     tests 3 and 4 use whenever the property under test needs a keyboard cursor to move through
 *     more than two options.
 *   - "wf" matches every open movement's `id` field (every seeded movement id is shaped
 *     `WF-###`), which is what test 1 uses to guarantee the results table actually renders rows
 *     to measure rather than the empty-state panel.
 *
 * `data-ward-primitive="table"` (not a page-specific testid) is what selects the results table's
 * scroll wrapper below: `ResultsSection` mounts the shared `WardTable` primitive with no `testId`
 * prop of its own, so the primitive's own attribute — already the documented, production-safe
 * selector `tests/ui-ward-forced-colors.spec.ts`'s own header explains — is the only stable hook.
 */

async function gotoSearch(page: Page): Promise<void> {
  await page.goto("/mockups/ward-flow/search", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  // The same streamed-content guard every other Ward Flow spec in this repo uses (see
  // ui-ward-discharges.spec.ts, ui-ward-roles.spec.ts): React's streaming leaves a hidden staging
  // copy of the whole screen in the document for a moment, duplicating every testid and making
  // geometry measured against it meaningless even where it does not throw outright.
  await expect(
    page.locator('div[hidden][id^="S:"]'),
    "React's streamed content is still staged, so the whole screen is duplicated in the document",
  ).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByTestId("ward-patient-search")).toBeVisible({ timeout: 15_000 });
}

function typeaheadInput(page: Page): Locator {
  return page.getByTestId("ward-patient-typeahead-input");
}

function typeaheadOptions(page: Page): Locator {
  return page.locator('[data-testid^="ward-patient-typeahead-option-"]');
}

test.describe("@mockup Ward patient search", () => {
  test.describe.configure({ timeout: 60_000 });

  /**
   * THE CONTROL. Confirms the harness, the dev server and the route itself all work before any of
   * the real geometric assertions below are trusted — method note from the task brief: an
   * assertion that has never been seen to pass against a healthy page is not evidence either way
   * about a red result from a broken one.
   */
  test("CONTROL: the search screen renders its composer and its results panel", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await gotoSearch(page);
    await expect(typeaheadInput(page)).toBeVisible();
    await expect(page.getByTestId("ward-patient-search-results")).toBeVisible();
  });

  /**
   * 1. WIDTH SWEEP. Two widths at the extremes are not a sweep (Ward Builder Three's contract,
   * adopted today) — the band in between is where a layout hands over from one arrangement to
   * another, and that is where damage happens. Five widths: 375 (phone), 641/700/760 (the band
   * between the phone bar and the icon rail — `search.module.css`'s own `@media (max-width: 40rem)`
   * breakpoint sits at 640px), and 820 (just past the band).
   *
   * Two properties, both geometric and both impossible in jsdom:
   *   - every cell of the results table lies within its scroll wrapper's own SCROLLABLE extent, so
   *     a reader can reach it. Sideways scrolling to see a column is expected on a table pinned
   *     wider than a phone and is not a defect; a column no scroll can reach is;
   *   - the page's own `<html>` never gains horizontal scroll at any of the five widths.
   *
   * ⚠️ THE FIRST PROPERTY WAS ORIGINALLY WRITTEN AS "no cell outside the wrapper's VISIBLE right
   * edge", copied from `ui-ward-discharges.spec.ts`. That is unsatisfiable for a table that
   * scrolls — see the long note at the assertion — and it was the test that was wrong, not the
   * page. Corrected under the owner's 2026-09-05 standing rule that testing must work with a
   * redesign rather than fight it: **guard the property, never the layout that happens to satisfy
   * it today.**
   *
   * PREDICTED FAILURE for the corrected form: a cell placed outside the scroll extent — e.g. an
   * absolutely positioned descendant escaping the scroll box, which is precisely the defect the
   * second property caught (a `.sr-only` header label with no positioned ancestor put 324px of
   * horizontal scroll on `<html>` itself). Both halves therefore have a demonstrated failure,
   * and the second one's was a live defect rather than a synthetic break.
   */
  test("no column of the results table escapes its scroll container, and the page never scrolls sideways, at 375/641/700/760/820px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await gotoSearch(page);

    await typeaheadInput(page).fill("wf");
    // Close the popup before measuring the results table below it — the popup overlaying the
    // table would not affect the geometry being measured, but leaving it open serves no purpose
    // here and Escape is the documented close-without-picking key.
    await page.keyboard.press("Escape");

    const results = page.getByTestId("ward-patient-search-results");
    const scroller = results.locator('[data-ward-primitive="table"]');
    await expect(scroller).toBeVisible();

    for (const width of [375, 641, 700, 760, 820]) {
      await page.setViewportSize({ width, height: 900 });
      /*
       * 🔴 THIS ASSERTION USED TO DEMAND SOMETHING A SCROLLING TABLE CANNOT SATISFY, AND IT WAS
       * THE TEST THAT WAS WRONG RATHER THAN THE PAGE.
       *
       * It required no cell's right edge to exceed the scroller's VISIBLE right edge. For a table
       * pinned wider than its container — which this one is, deliberately, at 44rem — **content
       * outside the visible box is what "scrolls horizontally" MEANS.** Measured: 8 cells outside
       * at 375px, 6 at 641px, 4 at 700px and 760px, 0 only at 820px, which is exactly where the
       * available width (706px) first reaches the table's floor (704px). The assertion was not
       * detecting a defect; it was restating the pin.
       *
       * ⚠️ **AND THE SIBLING SPEC IT WAS COPIED FROM PASSES ONLY BECAUSE ITS TABLES NEVER SCROLL.**
       * `ui-ward-discharges.spec.ts` uses this identical pattern on tables pinned at 30rem, where
       * the wrapper is already as wide as the table at every width it tests — so it has never once
       * exercised a genuinely scrolling table. **A pattern that has only ever run against the case
       * it cannot fail on looks exactly like a proven one.**
       *
       * The contract this file is actually here to defend is the one the stylesheets state:
       * **wide content scrolls INSIDE its own container; the page never scrolls sideways.** The
       * second half is asserted below and is real — it caught a genuine 324px page leak, from a
       * visually-hidden label escaping the scroll box entirely. The first half is asserted here as
       * REACHABILITY: every cell must lie within the scroller's own scrollable extent, so a reader
       * can always get to it. A cell outside THAT is unreachable by any scroll, which is the actual
       * harm — and it stays true however the table is redesigned.
       */
      const measured = await scroller.evaluate((scroll) => {
        const box = scroll.getBoundingClientRect();
        const reachableRight = box.left + scroll.scrollWidth + 1;
        const cells = [...scroll.querySelectorAll("thead th, tbody tr:first-child td")];
        return {
          cells: cells.length,
          scrollWidth: Math.round(scroll.scrollWidth),
          clientWidth: Math.round(scroll.clientWidth),
          unreachable: cells
            .filter((cell) => cell.getBoundingClientRect().right > reachableRight)
            .map(
              (cell) =>
                `${(cell.textContent ?? "").trim()} (right edge ${Math.round(cell.getBoundingClientRect().right)} vs reachable ${Math.round(reachableRight)})`,
            ),
        };
      });
      expect(measured.cells, `${width}px: the results table rendered no cells to measure`).toBeGreaterThan(0);
      expect(
        measured.unreachable,
        `column(s) of the results table at ${width}px sit outside the scroll container's own scrollable ` +
          `extent (scrollWidth ${measured.scrollWidth}, clientWidth ${measured.clientWidth}), so no amount ` +
          `of scrolling reaches them. Scrolling sideways to see a column is expected here and is not a ` +
          `defect; a column no scroll can reach is.`,
      ).toEqual([]);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(
        overflow,
        `the page itself scrolls horizontally at ${width}px (overflow ${overflow}px)`,
      ).toBeLessThanOrEqual(2);
    }
  });

  /**
   * 2. THE TYPEAHEAD POPUP AT 375PX, on the exact near-spelling pair the search exists to make
   * safe. Both rows must stay fully inside the 375px viewport horizontally, and each row's record
   * number and date of birth — the only two facts that actually distinguish Marrowby from
   * Marrowbee — must be genuinely visible, not merely present in the DOM.
   *
   * `getByText(..., { exact: true })` is what closes the hiding case
   * `ui-ward-discharges.spec.ts`'s own W1 note documents: a plain `toContainText` on the row would
   * still pass if the umrn or DOB span were given `display: none`, because Playwright compares
   * `textContent` there regardless of visibility. An exact match on the leaf `<span>`/`<b>` whose
   * own trimmed text equals the number resolves to that specific element, so `toBeVisible()` on it
   * actually exercises the visibility this test is named for.
   *
   * PREDICTED FAILURE, verified live: adding `style="width: 500px"` to the popup via
   * `page.addStyleTag` pushed PT-004's row past x=375 and the second row's `x + width <=
   * viewportWidth` assertion went red, naming the exact overshoot.
   */
  test("both Marrowby/Marrowbee rows and their identifying details stay on screen at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await gotoSearch(page);

    await typeaheadInput(page).fill("marrow");

    const row1 = page.getByTestId("ward-patient-typeahead-option-PT-003");
    const row2 = page.getByTestId("ward-patient-typeahead-option-PT-004");
    await expect(typeaheadOptions(page), "exactly the two Marrow* patients, nobody else").toHaveCount(2);
    await expect(row1).toBeVisible();
    await expect(row2).toBeVisible();

    const viewportWidth = 375;
    for (const [row, label] of [
      [row1, "Ines Marrowby's row"],
      [row2, "Devan Marrowbee's row"],
    ] as const) {
      const box = await row.boundingBox();
      expect(box, `${label} has no measurable box`).not.toBeNull();
      expect(box!.x, `${label} starts left of the viewport`).toBeGreaterThanOrEqual(0);
      expect(
        box!.x + box!.width,
        `${label} extends to ${box!.x + box!.width}px, past the ${viewportWidth}px viewport`,
      ).toBeLessThanOrEqual(viewportWidth + 1);
    }

    // The record number and date of birth — genuinely visible, not merely textContent.
    await expect(row1.getByText("UM100003", { exact: true })).toBeVisible();
    await expect(row1.getByText("1995-07-21", { exact: true })).toBeVisible();
    await expect(row2.getByText("UM100004", { exact: true })).toBeVisible();
    await expect(row2.getByText("1974-01-09", { exact: true })).toBeVisible();
  });

  /**
   * 3. HOVER VERSUS KEYBOARD-ACTIVE. `patient-typeahead.module.css`'s own comment records that
   * these two states used to share one CSS declaration on the premise that "a pointer user and a
   * keyboard user must be looking at the same row" — false, because nothing in this component
   * keeps a hovered row in sync with `activeIndex`. If that regressed, a row the mouse merely
   * rests on would render pixel-identical to the row Enter will actually pick, and a clinician
   * could commit a different person than the one they were looking at.
   *
   * ⚠️ THREE ARROWDOWN PRESSES, NOT TWO. `activeIndex` starts at −1 (nothing preselected — the
   * component's own documented rule), and each ArrowDown computes `(i + 1) % length`. So the FIRST
   * press lands on index 0 (PT-001, the row the mouse is resting on), the second on index 1
   * (PT-002), and a THIRD is required to reach index 2 (PT-003, the third rendered option).
   * Verified live before writing this (dispatching the three keydowns and reading
   * `aria-selected`) rather than assumed from the arithmetic alone.
   *
   * "a" is the query rather than "marrow" because a pair of two rows has no third option for the
   * cursor to land on — this needs at least three, and "a" gives all eight in fixture order
   * (verified against `ward-patients-seed.ts`).
   *
   * PREDICTED FAILURE, verified live: temporarily merging `.option:hover` and
   * `.option.optionActive` into one shared rule (the exact regression the CSS file's own comment
   * describes) via `page.addStyleTag` made every measured property equal between the two rows, and
   * the `propertiesDiffer` assertion went red with both style objects printed and visibly
   * identical.
   */
  test("the keyboard-active option reads as visually distinct from a merely-hovered one", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await gotoSearch(page);

    await typeaheadInput(page).fill("a");
    await expect(typeaheadOptions(page)).toHaveCount(8);

    const hoveredRow = page.getByTestId("ward-patient-typeahead-option-PT-001");
    const activeRow = page.getByTestId("ward-patient-typeahead-option-PT-003");

    await hoveredRow.hover();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");

    await expect(activeRow, "the third ArrowDown press must land on the third option").toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(hoveredRow, "hovering a row must never itself select it").toHaveAttribute("aria-selected", "false");

    const readStyle = (el: HTMLElement) => {
      const style = getComputedStyle(el);
      return { background: style.backgroundColor, borderLeft: style.borderLeftColor, boxShadow: style.boxShadow };
    };
    const [hoveredStyle, activeStyle] = await Promise.all([
      hoveredRow.evaluate(readStyle),
      activeRow.evaluate(readStyle),
    ]);

    const propertiesDiffer =
      hoveredStyle.background !== activeStyle.background ||
      hoveredStyle.borderLeft !== activeStyle.borderLeft ||
      hoveredStyle.boxShadow !== activeStyle.boxShadow;
    expect(
      propertiesDiffer,
      `the hovered row and the keyboard-active row render identically: ${JSON.stringify({ hoveredStyle, activeStyle })}`,
    ).toBe(true);
  });

  /**
   * 4. THE ACTIVE ROW SCROLLED INTO VIEW — the most severe defect this screen has had, per the
   * task brief, and invisible without a browser: `getBoundingClientRect()` reports an element's
   * real rendered position regardless of an `overflow: auto` ancestor clipping it out of sight, so
   * an active row that is technically in the DOM but scrolled below the popup's own visible box is
   * exactly what this assertion is built to catch.
   *
   * "a" matches all eight seeded patients in fixture order (verified above and against
   * `ward-patients-seed.ts`), so the eighth and last is PT-008 (Kwame Vandersloot) — far enough
   * down the list that the popup's `max-height: 24rem` clip (`patient-typeahead.module.css`)
   * cannot show it without scrolling.
   *
   * PREDICTED FAILURE, verified live: dispatching the same End keydown against a build with the
   * scroll-into-view effect body emptied out (`document.getElementById(...)` called and its result
   * discarded, never `.scrollIntoView()`) left PT-008's row with a top of 718px against the
   * popup's own bottom of 401px — comfortably below the popup's visible box — and the
   * `toBeLessThanOrEqual` assertion on the row's bottom went red naming both numbers.
   */
  test("pressing End moves the active option to the list's end, and the popup scrolls it into its own visible area", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await gotoSearch(page);

    await typeaheadInput(page).fill("a");
    await expect(typeaheadOptions(page)).toHaveCount(8);

    await page.keyboard.press("End");

    const lastRow = page.getByTestId("ward-patient-typeahead-option-PT-008");
    await expect(lastRow).toHaveAttribute("aria-selected", "true");

    const popup = page.getByTestId("ward-patient-typeahead-popup");
    const [popupBox, rowBox] = await Promise.all([popup.boundingBox(), lastRow.boundingBox()]);
    expect(popupBox, "the popup must have a measurable box").not.toBeNull();
    expect(rowBox, "the active row must have a measurable box").not.toBeNull();

    expect(
      rowBox!.y,
      `the active row's top (${Math.round(rowBox!.y)}) sits above the popup's own top (${Math.round(popupBox!.y)})`,
    ).toBeGreaterThanOrEqual(popupBox!.y - 1);
    expect(
      rowBox!.y + rowBox!.height,
      `the active row's bottom (${Math.round(rowBox!.y + rowBox!.height)}) sits below the popup's own bottom (${Math.round(popupBox!.y + popupBox!.height)}) — scrolled out of view`,
    ).toBeLessThanOrEqual(popupBox!.y + popupBox!.height + 1);
  });

  /**
   * 5. TAP TARGETS AT 375PX. Every interactive control inside the search composer (the typeahead
   * input, its Clear button once a query is typed, the Stage select, the Department select) must
   * have a hit box of at least 48px in its smaller dimension — this repository's production floor,
   * never the generic 44px WCAG minimum (see `AGENTS.md`'s own note on the `ui-smoke` flake that
   * reintroducing 44px caused).
   *
   * ⚠️ MEASURED LIVE BEFORE WRITING THIS, AND THE INPUT ITSELF FAILS TODAY. Its parent
   * `.controlBox` correctly honours `min-height: var(--ward-tap)` (48px, confirmed:
   * `{width:286,height:48}`), but `.controlBox` is `align-items: center` with no `stretch`, and
   * the `<input>` itself has no `min-height` of its own — measured directly: `{width:238,
   * height:36}`. That is the exact pattern this file's own CSS already has a fix for on the
   * sibling `.clear` button (`align-self: stretch` plus its own `min-height` — see that rule's own
   * comment: "A tap target inside a correctly sized container is not a correctly sized tap
   * target"), applied to every control in the row except the one a clinician actually types into.
   * A 6px dead strip sits above and below the input, inside the visually-bordered field, where a
   * tap lands on `.controlBox` and focuses nothing.
   *
   * This assertion is left as the brief specifies rather than narrowed to dodge the finding —
   * doing so would be exactly the "quietly narrow a check to make it pass" failure this repository
   * has named elsewhere. `patient-typeahead.tsx` and its stylesheet are owned by another agent
   * actively editing them right now, so the fix belongs there, not here.
   *
   * ⚠️ **THE FIX HAS LANDED, AND THIS COMMENT SAID OTHERWISE FOR HOURS. Corrected 2026-09-05.**
   * It read *"this test states the measured defect and is expected to be RED until it lands"*, which
   * was true when written and became false without anything changing here.
   * `search/patient-typeahead.module.css` now carries exactly the prescribed pair —
   * `align-self: stretch` with `min-height: var(--ward-tap)` — on both the input and its sibling,
   * and the stylesheet's own comment names the absent-declaration defect it closes.
   *
   * ⚠️ **TREAT THIS SPEC'S STATUS AS UNKNOWN RATHER THAN RED OR GREEN, and that is the point worth
   * keeping.** It sits in the `chromium-mockups` lane, which the owner ruled is kept but not run, so
   * **nothing executes to contradict a claim made here.** A stale "expected to be RED" in an unrun
   * lane is worse than in a running one: a reader takes it as a live defect, and there is no red or
   * green anywhere to correct them. **Re-read this comment the first time the lane is switched on**
   * — the flag is `vars.WARD_JOURNEYS_BLOCKING`, unset by default.
   *
   * ⚠️ **AND THE DEFECT ITSELF IS THE STRONGEST ARGUMENT IN THIS REPOSITORY FOR KEEPING THESE
   * SEVEN SPECS.** jsdom computes no layout, so no offline test could have measured a 36px control;
   * and the fault was an **absent** declaration, so there was no wrong value for a stylesheet-reading
   * guard to find either. **Invisible to both halves of this project's testing, and found by a
   * browser.** That belongs beside the keep-but-do-not-run ruling, not buried in a changelog.
   */
  test("every interactive control in the search composer meets the 48px tap-target floor at 375px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await gotoSearch(page);

    const input = typeaheadInput(page);
    await input.fill("a"); // brings the Clear button into the DOM

    const controls: ReadonlyArray<readonly [Locator, string]> = [
      [input, "the typeahead's own text input"],
      [page.getByRole("button", { name: "Clear" }), "the typeahead's Clear button"],
      [page.locator("#ward-patient-search-stage"), "the Stage select"],
      [page.locator("#ward-patient-search-department"), "the Department select"],
    ];

    const failures: string[] = [];
    for (const [control, label] of controls) {
      await expect(control, `${label} is not visible`).toBeVisible();
      const box = await control.boundingBox();
      expect(box, `${label} has no measurable box`).not.toBeNull();
      const smallerDimension = Math.min(box!.width, box!.height);
      if (smallerDimension < 48) {
        failures.push(`${label}: ${Math.round(box!.width)}x${Math.round(box!.height)}px`);
      }
    }

    expect(failures, "control(s) under the 48px production tap-target floor at 375px (width x height)").toEqual([]);
  });
});
