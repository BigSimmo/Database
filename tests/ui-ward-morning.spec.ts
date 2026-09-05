import { PDFParse } from "pdf-parse";
import { expect, test, type Page } from "playwright/test";

/**
 * Task 5 (Phase 6). One journey covering the morning bed-state page
 * (`MorningPage`/`MorningTour` in `src/components/ward-management/morning/`), modelled on
 * `tests/ui-ward-discharges.spec.ts`'s shape: a single `page.goto()` at the top, then real clicks
 * on real controls, asserting against the shared `WardFlowProvider` state the same way every
 * other Ward Flow journey does.
 *
 * ⚠️ THIS FILE COVERS MUCH LESS THAN IT ONCE DID, AND THE LOSS IS DELIBERATE — 2026-09-02.
 *
 * As written, this journey drove the guided tour beat by beat and read the board's own figures
 * back at each beat, and it drove the fixed/live view toggle. Neither control is on the page any
 * more, so every one of those assertions was passing against nothing:
 *
 *   - The TOUR is unmounted by owner decision (`morning-page.tsx`'s own comment: "THE GUIDED TOUR
 *     IS PAUSED, NOT REMOVED — owner instruction 2026-08-30"). `MorningTour`, its beats and its
 *     unit tests all still exist. It comes back. That is why the assertions below were *removed
 *     from this journey* rather than rewritten: they described real behaviour of a component that
 *     is not currently rendered here, and whoever un-pauses the tour should know they once existed
 *     and what they proved. `tests/ward-morning-tour-paused.dom.test.tsx` is the guard that the
 *     paused tour emits nothing, and it is the thing someone must deliberately remove to un-pause.
 *   - The fixed/live TOGGLE (`ViewControl`) is still exported by `morning-page.tsx` but `MorningBody`
 *     no longer renders it, so `ward-morning-view-fixed` / `-live` match no element.
 *
 * ⚠️ WHAT THIS LEAVES UNCOVERED, named so it is a known hole and not a silent one: NOTHING in this
 * file now reads a single morning figure. `confirmedToday` and `expectedToday` — and the
 * service/site/unit `data-testid` level-prefix scheme that stops those five keys colliding across
 * three levels — have no browser assertion at all. They had exactly one, here, and it depended on
 * the tour to move them. Restoring that coverage needs a driver that changes the board without the
 * tour; it is not restored by un-pausing the tour, because a paused tour is a decision, not a bug.
 *
 * `gotoMorning` still emulates `prefers-reduced-motion: reduce`. Its original reason is gone (it
 * made the tour advance by a real "Next" button instead of 12-second timers), but both remaining
 * tests are honest under it and it is the safer default, so it stays.
 */

async function gotoMorning(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/mockups/ward-flow/morning", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("ward-morning-page")).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState("networkidle");
}

test.describe("@mockup Ward morning bed state — page render, rail navigation and printing", () => {
  test.describe.configure({ timeout: 60_000 });

  // ⚠️ RENAMED 2026-09-02, and the rename is the point. This was "the fixed page states its
  // instant, the live toggle is distinguishable, the tour changes the board by beat 4, Stop halts
  // it mid-tour, and navigating away mid-tour clears fabricated state" — a name describing five
  // behaviours, four of which this test no longer touches at all. See this file's header for what
  // was removed, why, and what it leaves uncovered. A test whose name outlives its work is the
  // next reader's stale finding, so the name goes when the work goes.
  test("the morning page renders its headline, and the rail navigates away and back", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });
    await gotoMorning(page);

    // The page's own headline section (`morning-page.tsx`, `data-testid="ward-morning-headline"`).
    // This is what survives of "the fixed page renders": the page mounts and puts its headline up.
    await expect(page.getByTestId("ward-morning-headline")).toBeVisible();

    // The rail's real `<Link>`s — `ClinicalRail` is rendered by `morning-page.tsx` itself, so it
    // mounts and unmounts with the page. Never `page.goto()` here: a full navigation would remount
    // `WardFlowProvider` and reseed shared state, which would make a client-side routing failure
    // indistinguishable from a pass.
    // MERGE 01 (2026-09-05): the fold at e31c9c462 combined "Priority queue" and "Exceptions"
    // into one rail entry. The id is still `queue`, but the label it renders is now "Delays" and
    // it leads to the `DelaysScreen` route, whose root carries `data-testid="ward-delays-page"` —
    // there is no more `ward-queue-view` testid anywhere for this link to land on.
    await page.getByRole("link", { name: "Delays", exact: true }).click();
    await expect(page.getByTestId("ward-delays-page")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    await page.getByRole("link", { name: "Morning bed state", exact: true }).click();
    await expect(page.getByTestId("ward-morning-page")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    // The third click is not a repeat of the first. `ClinicalRail` was unmounted by the navigation
    // away and mounted fresh by the navigation back, so this exercises a newly-mounted rail after
    // a client-side return — a different condition from the first click, which was on the rail
    // that came with the server-rendered page.
    //
    // MERGE 01 (2026-09-05): same rename as above — the link is "Delays" now, and it lands on
    // `ward-delays-page`, not the retired `ward-queue-view`.
    await page.getByRole("link", { name: "Delays", exact: true }).click();
    await expect(page.getByTestId("ward-delays-page")).toBeVisible({ timeout: 15_000 });
  });
});

/**
 * Phase 6 Task 6 fix pass (C2, C3, I4 — see the task's own blocker list). The print behaviour
 * this page ships is a genuine RENDERING contract, not something a CSS-source-text check can
 * verify: `tests/ward-morning-print.test.ts` reads `morning.module.css` as a string, which can
 * see whether a rule EXISTS but not whether the sheet a browser actually produces states its own
 * view/instant or fits one page. Both facts below come from a real Chromium print render —
 * `page.emulateMedia({ media: "print" })` for the label/note visibility, `page.pdf({format:
 * "A4"})` measured with `pdf-parse` for the page count — the same instruments used to find these
 * three defects in the first place (see the CSS's own doc comments on each fix for the measured
 * "before" numbers: 0×0 elements, zero `\d\d:\d\d` matches, and `/Count 5`).
 */
test.describe("@mockup Ward morning bed state — print output states its view and fits one page", () => {
  test.describe.configure({ timeout: 60_000 });

  test("print states when the sheet was printed, and the real PDF is exactly one A4 page", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 1400 });
    await gotoMorning(page);

    // --- C2, REWRITTEN 2026-09-02. THERE IS ONE VIEW NOW, NOT TWO. The owner removed the
    // fixed/live toggle on 2026-08-30 — "There is no point of a stale handover. Remove it and
    // make the print out live from whatever time" — so every assertion here that drove the
    // toggle, or read a label naming which of two views produced the sheet, was exercising a
    // feature that no longer exists. `ViewControl` survives as an exported component that
    // nothing renders: the toggle is unreachable, not merely restyled.
    //
    // ⚠️ THE LABEL ITSELF IS NOT DEAD AND ITS WORDING WAS NOT AN OPEN QUESTION. `PrintViewMeta`
    // still renders it, and the owner's replacement is already implemented, with the reasoning
    // written above it in morning-page.tsx: a sheet with no time on it is the one nobody can
    // tell is old, so it states the moment it was actually printed. These assertions are READ
    // FROM THAT SOURCE rather than invented, which is why no coverage is lost with the toggle.
    const printLabel = page.getByTestId("ward-morning-print-view-label");
    await expect(printLabel).toHaveText(/^This sheet: printed \d{2}:\d{2}\.$/);

    // --- C2: under real print media the label and its note are the visible statement of what
    // this sheet is — a rendered visibility fact `emulateMedia` can prove and a CSS-source-text
    // check cannot. ---
    await page.emulateMedia({ media: "print" });
    await expect(printLabel).toBeVisible();
    await expect(page.getByTestId("ward-morning-print-view-note")).toContainText(
      "a printed sheet is a moment, not a monitor",
    );

    // --- I4, rendered: Joondalup and Peel (real no-unit fixture sites) state "Never confirmed"
    // and "No units recorded" but print no five-zero figure grid, while a real site with units
    // (Royal Perth) still prints its grid. ---
    const jhc = page.getByTestId("ward-morning-site-JHC");
    await expect(jhc.getByTestId("ward-morning-figure-site-JHC-availableNow")).toHaveCount(0);
    await expect(jhc.getByText("No units recorded")).toBeVisible();
    const rph = page.getByTestId("ward-morning-site-RPH");
    await expect(rph.getByTestId("ward-morning-figure-site-RPH-availableNow")).toBeVisible();

    // --- C3: the real PDF Chromium produces for this page is exactly one A4 page. Measured
    // before this fix pass: `/Count 5`. `page.pdf()` only works against Chromium (this project's
    // Playwright project), matching the `--project=chromium-mockups` this spec already runs
    // under. ---
    const pdfBuffer = await page.pdf({ format: "A4" });
    const parser = new PDFParse({ data: pdfBuffer });
    const parsed = await parser.getText();
    await parser.destroy();
    expect(parsed.pages.length, "the printed sheet must fit on exactly one A4 page").toBe(1);
  });
});
