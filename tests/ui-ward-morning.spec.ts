import { PDFParse } from "pdf-parse";
import { expect, test, type Page } from "playwright/test";

/**
 * Task 5 (Phase 6). One journey covering the morning bed-state page
 * (`MorningPage`/`MorningTour` in `src/components/ward-management/morning/`), modelled on
 * `tests/ui-ward-discharges.spec.ts`'s shape: a single `page.goto()` at the top, then real clicks
 * on real controls, asserting against the shared `WardFlowProvider` state the same way every
 * other Ward Flow journey does.
 *
 * The tour is driven with `prefers-reduced-motion: reduce` emulated for the whole test. This is
 * not a testing shortcut bolted on top of the component — it is the component's own documented
 * behaviour (spec D12, `morning-tour.tsx`'s own doc comment on `scheduleAdvance`): under reduced
 * motion the tour never auto-advances on `TOUR_BEAT_INTERVAL_MS` (12 seconds) timers and instead
 * renders a real "Next" button (`ward-morning-tour-next`) that drives each beat directly. Using
 * the emulated-motion path lets this journey exercise the exact same `runBeat`/dispatch code the
 * timed path uses, deterministically and without a single `page.waitForTimeout()`.
 */

const TOUR_UNIT_ID = "scgh-adult-open";

async function gotoMorning(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/mockups/ward-flow/morning", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("ward-morning-page")).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState("networkidle");
}

/** Figure `data-testid`s carry an explicit level prefix — `ward-morning-figure-service-<key>`,
 *  `ward-morning-figure-site-<code>-<key>`, `ward-morning-figure-unit-<unitId>-<key>` — so the
 *  same five keys rendered at service, site AND unit level never collide on one `data-testid`
 *  (`FigureList`'s own doc comment in morning-page.tsx). Every figure read in this file goes
 *  through a helper naming its exact level rather than a bare page-level lookup. */
function unitFigure(page: Page, key: "confirmedToday" | "predictedToday") {
  return page.getByTestId(`ward-morning-figure-unit-${TOUR_UNIT_ID}-${key}`).locator("dd");
}

test.describe("@mockup Ward morning bed state — fixed/live views and the guided tour", () => {
  test.describe.configure({ timeout: 60_000 });

  test("the fixed page states its instant, the live toggle is distinguishable, the tour changes the board by beat 4, Stop halts it mid-tour, and navigating away mid-tour clears fabricated state", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });
    await gotoMorning(page);

    // --- 1. The fixed page renders and states its instant. ---
    // `ViewControl`'s fixed button label is `Handover ${formatInstant(MORNING_HANDOVER_MINUTES)}`
    // — MORNING_HANDOVER_MINUTES is a fixed 08:00 (ward-morning-rollup.ts), so this exact string
    // is a stable fact about the page, not a guess at rendered prose.
    const fixedButton = page.getByTestId("ward-morning-view-fixed");
    const liveButton = page.getByTestId("ward-morning-view-live");
    await expect(fixedButton).toContainText("Handover 08:00");
    await expect(fixedButton).toHaveAttribute("aria-pressed", "true");
    await expect(liveButton).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("ward-morning-headline")).toBeVisible();

    // --- 2. The live toggle changes the instant, and the two views are distinguishable in the
    // DOM: not by colour alone (spec item 5) — `aria-pressed` flips on both buttons, and the live
    // button's own label carries a real, different clock reading (`Live HH:MM`) rather than the
    // fixed button's constant "Handover 08:00". ---
    await liveButton.click();
    await expect(liveButton).toHaveAttribute("aria-pressed", "true");
    await expect(fixedButton).toHaveAttribute("aria-pressed", "false");
    await expect(liveButton).not.toContainText("Handover 08:00");
    await expect(liveButton).toContainText(/^Live \d{2}:\d{2}/);

    // Baseline read for the tour-completion assertion below, taken from the live view before the
    // tour touches anything: WR-002 (`morning-tour.tsx`'s own `TOUR_RELEASE_ID`) seeds as a
    // `predicted` release at this exact unit, so this unit's predicted/confirmed figures are the
    // ones the tour's beat 3 (`CONFIRM_BED_RELEASE`) moves.
    const baselineConfirmed = Number(await unitFigure(page, "confirmedToday").innerText());
    const baselinePredicted = Number(await unitFigure(page, "predictedToday").innerText());
    expect(
      baselinePredicted,
      "fixture assumption: WR-002 seeds scgh-adult-open predictedToday >= 1",
    ).toBeGreaterThanOrEqual(1);

    // --- 3. The tour runs to completion and the board visibly changes at beat 4. ---
    // Beat 0 (Start) resets the scenario; beats 1-3 are driven one at a time by the reduced-motion
    // "Next" control, exactly like a visitor with reduced motion enabled would drive it; beat 4
    // dispatches nothing of its own (`tourBeatEvents(4, ...)` is empty by design) — it exists only
    // to prove the board re-renders against beats 1-3's already-changed shared state.
    await page.getByTestId("ward-morning-tour-start").click();
    await expect(liveButton).toHaveAttribute("aria-pressed", "true");

    const nextButton = page.getByTestId("ward-morning-tour-next");
    const beatLabel = page.getByTestId("ward-morning-tour-beat");
    await expect(beatLabel).toHaveText("Beat 0 of 4");

    await nextButton.click(); // -> beat 1: RAISE_REFERRAL
    await expect(beatLabel).toHaveText("Beat 1 of 4");
    await nextButton.click(); // -> beat 2: REFER_TO_UNITS
    await expect(beatLabel).toHaveText("Beat 2 of 4");
    await nextButton.click(); // -> beat 3: ACCEPT_IN_PRINCIPLE + CONFIRM_BED_RELEASE
    await expect(beatLabel).toHaveText("Beat 3 of 4");
    // Beat 3 dispatches its second event only once the first's outcome is known (see
    // `pendingSecondEventRef`'s own doc comment in `morning-tour.tsx`) — wait for that to land on
    // the live board before reading the figures it moves, rather than racing it.
    await expect(unitFigure(page, "confirmedToday")).toHaveText(String(baselineConfirmed + 1));
    await expect(unitFigure(page, "predictedToday")).toHaveText(String(baselinePredicted - 1));

    await nextButton.click(); // -> beat 4: no dispatch, the board just re-renders
    await expect(beatLabel).toHaveText("Beat 4 of 4");
    // The change made at beat 3 is still visibly on the board at beat 4 — this is the "board
    // visibly changes at beat 4" the brief asks for: not a NEW change at beat 4 (there is none by
    // design), but proof the board carries beat 3's real dispatch forward rather than resetting or
    // stalling on the second-to-last beat.
    await expect(unitFigure(page, "confirmedToday")).toHaveText(String(baselineConfirmed + 1));
    await expect(unitFigure(page, "predictedToday")).toHaveText(String(baselinePredicted - 1));

    // Let the tour finish and reset (clicking Next at the last beat calls `finish()`), returning
    // the page to a clean idle state before the next phase of this journey.
    await nextButton.click();
    await expect(page.getByTestId("ward-morning-tour-start")).toBeVisible();
    await expect(unitFigure(page, "confirmedToday")).toHaveText(String(baselineConfirmed));
    await expect(unitFigure(page, "predictedToday")).toHaveText(String(baselinePredicted));

    // --- 4. Stop halts the tour at the current beat: clicking Stop mid-tour (beat 2, a
    // non-terminal beat) ends the tour immediately from wherever it currently is, rather than only
    // working at the last beat, and leaves no fabricated data behind. ---
    await page.getByTestId("ward-morning-tour-start").click();
    await nextButton.click(); // beat 1: RAISE_REFERRAL creates WF-901
    await nextButton.click(); // beat 2
    await expect(beatLabel).toHaveText("Beat 2 of 4");
    await page.getByTestId("ward-morning-tour-stop").click();
    await expect(page.getByTestId("ward-morning-tour-start")).toBeVisible();
    await expect(page.getByTestId("ward-morning-tour-stop")).toHaveCount(0);

    // Stop resets the scenario (`finish()` always dispatches `RESET_SCENARIO`) — beat 1's
    // referral must not still be sitting in shared state. WF-901 never renders on the morning page
    // itself, so this has to be checked on a screen that actually lists movements: the priority
    // queue, reached via the rail's real `<Link>`.
    await page.getByRole("link", { name: "Priority queue", exact: true }).click();
    await expect(page.getByTestId("ward-queue-view")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "WF-901", exact: true })).toHaveCount(0);

    // Back to the morning page via the rail's own link (never `page.goto()` mid-journey — a full
    // navigation would remount `WardFlowProvider` and reseed everything, which would make the next
    // check pass whether or not the unmount fix actually works).
    await page.getByRole("link", { name: "Morning bed state", exact: true }).click();
    await expect(page.getByTestId("ward-morning-page")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    // --- 5. THE UNMOUNT CASE. Start the tour again, let it pass beat 1 (a real dispatch —
    // `RAISE_REFERRAL` creates movement WF-901, deterministically, per `morning-tour.tsx`'s own
    // doc comment on `TOUR_MOVEMENT_ID`), then navigate away via a REAL rail link click — not a
    // simulated re-render — and confirm the fabricated referral is gone from shared state. This is
    // the Critical defect this phase fixed: `MorningTour`'s unmount cleanup effect must dispatch
    // `RESET_SCENARIO` when the component unmounts mid-tour, and until now that has only ever been
    // proven with a simulated re-render, never a live navigation. ---
    await page.getByTestId("ward-morning-tour-start").click();
    await nextButton.click(); // beat 1: RAISE_REFERRAL creates WF-901
    await expect(beatLabel).toHaveText("Beat 1 of 4");

    // The rail's own `<Link>`, mounted on every Ward Flow route (`ClinicalRail` /
    // `ward-management-navigation.tsx`) — a real navigation, not `page.goto()`, so it unmounts
    // `MorningTour` exactly the way a coordinator clicking away mid-tour would.
    await page.getByRole("link", { name: "Priority queue", exact: true }).click();
    await expect(page.getByTestId("ward-queue-view")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("button", { name: "WF-901", exact: true })).toHaveCount(0);
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

  test("print states which view produced the sheet and its instant, hides the interactive control, and the real PDF is exactly one A4 page", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 1400 });
    await gotoMorning(page);

    // --- C2: the print-only label names the fixed view's instant while interactive chrome is
    // still on screen (unaffected by print media yet). ---
    const printLabel = page.getByTestId("ward-morning-print-view-label");
    await expect(printLabel).toHaveText("This sheet: handover view, frozen 08:00.");

    // --- C2, continued: switching to live updates the SAME label — proves this is read from the
    // real `view`/`liveNow` state, not a static string that happens to match the fixed case. ---
    await page.getByTestId("ward-morning-view-live").click();
    await expect(printLabel).toHaveText(/^This sheet: live view, as at \d{2}:\d{2}\.$/);
    // Switch back to the fixed view for the PDF measurement below, matching what a coordinator
    // would actually pin up (the frozen 08:00 handover sheet, not a live snapshot mid-shift).
    await page.getByTestId("ward-morning-view-fixed").click();
    await expect(printLabel).toHaveText("This sheet: handover view, frozen 08:00.");

    // --- C2: under real print media, the interactive fixed/live control is hidden and the
    // print-only label/note become the visible statement of which view this is — a rendered
    // visibility fact `emulateMedia` can prove and a CSS-source-text check cannot. ---
    await page.emulateMedia({ media: "print" });
    await expect(page.getByTestId("ward-morning-view-fixed")).toBeHidden();
    await expect(printLabel).toBeVisible();
    await expect(page.getByTestId("ward-morning-print-view-note")).toContainText(
      "not a reconstruction of what the ward state actually was at 08:00",
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
