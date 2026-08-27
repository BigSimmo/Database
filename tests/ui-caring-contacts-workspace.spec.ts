import { expect, test, type Page } from "playwright/test";

import {
  WORKSPACE_OVERLAY_DEFINITIONS,
  type WorkspaceOverlayDefinition,
} from "../src/components/caring-contacts/workspace/overlays/definitions";
import { WORKSPACE_WIDTH_BREAKPOINTS, widthStateFor } from "../src/components/caring-contacts/workspace/width-state";

/**
 * The production Caring Contacts workspace shell, proved in a browser.
 *
 * This spec is what `docs/design-system/adoption-contract.json` cites for all
 * five proof categories of the `caring-contacts-workspace` surface. Every
 * declaration there points here, and nowhere else, because a proof pointer at a
 * suite that never visits this route is a red gate that has been silenced.
 *
 * Ruling 51 splits the workspace's browser proof in two. This file owns the
 * *shell* half — the four width states, the dock/rail exchange, dark, forced
 * colours and print. Task 19 extends this same file with the overlay half (all
 * 24 overlays deep-linked) and 400% zoom. A Task 19 implementer will therefore
 * find its Step 1 registration guard already green; that is expected.
 *
 * The width assertions compare against `widthStateFor()` itself rather than a
 * second copy of the frozen numbers, so a breakpoint edited in the shell's
 * Tailwind classes without editing the module — or the reverse — fails here.
 */

const WORKSPACE_ROUTE = "/caring-contacts";
const PATIENTS_ROUTE = `${WORKSPACE_ROUTE}/patients`;

/**
 * Every production screen this workspace serves, with the `h1` it must render.
 *
 * The header above states the rule this list exists to keep true: the adoption
 * contract names this file as the sole evidence for all five proof categories of
 * the `caring-contacts-workspace` surface, and a proof pointer at a suite that
 * never visits a route is a red gate that has been silenced. Phase 2B Task 5
 * added `/caring-contacts/patients` to that surface, so the accessibility-mode
 * proofs below run against BOTH screens rather than against Today alone. A
 * screen added to that surface without being added here is the same silenced
 * gate wearing a newer date.
 */
const WORKSPACE_SCREENS = [
  { name: "Today", route: WORKSPACE_ROUTE, heading: "Today" },
  { name: "Patients", route: PATIENTS_ROUTE, heading: "Patients" },
] as const;

type WorkspaceScreen = (typeof WORKSPACE_SCREENS)[number];

const TODAY_SCREEN: WorkspaceScreen = WORKSPACE_SCREENS[0];
const PATIENTS_SCREEN: WorkspaceScreen = WORKSPACE_SCREENS[1];

/** 320/390/430 are the three compact review widths; the rest are the state boundaries. */
const REVIEW_WIDTHS = [320, 390, 430, 768, 1024, 1440] as const;

const VIEWPORT_HEIGHT = 900;

/**
 * `height` is optional and defaults to the frozen review height, so every call site written
 * before it existed is unchanged. The service-stop block below passes a shorter viewport for a
 * reason recorded there.
 */
async function openWorkspace(
  page: Page,
  width: number,
  height: number = VIEWPORT_HEIGHT,
  screen: WorkspaceScreen = TODAY_SCREEN,
) {
  await page.setViewportSize({ width, height });
  await page.goto(screen.route, { waitUntil: "load" });
  // React streams the segment under `loading.tsx`'s Suspense boundary into a
  // hidden holder before moving it into place, so a production page sampled too
  // early carries a second, inert copy of the whole shell. Settle on exactly one
  // before measuring anything — and assert it, because a shell that genuinely
  // mounted twice would double every landmark on the page.
  await expect(page.getByTestId("caring-contacts-rail")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1, name: screen.heading })).toBeVisible();
}

/** Horizontal overflow of the document against the viewport, in CSS pixels. */
function documentOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

/**
 * The width-state markers the shell displays one at a time. Reading the
 * *displayed* one is how the CSS media classes become checkable at all.
 */
function displayedWidthStates(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("[data-workspace-width-state]")]
      // `getClientRects()` is empty for anything an ancestor has hidden, which a
      // bare `display` read on the element itself would miss entirely.
      .filter((node) => node.getClientRects().length > 0)
      .map((node) => node.getAttribute("data-workspace-width-state")),
  );
}

/**
 * What the marker looks like once forced colours have had their way with it.
 *
 * Only the border is reported, because only the border turned out to be
 * falsifiable — see the test below.
 */
function markerBorder(page: Page) {
  return page.evaluate(() => {
    const marker = document.querySelector("[data-synthetic-marker]");
    if (!marker) throw new Error("the synthetic marker is missing");
    const style = getComputedStyle(marker);
    return { width: style.borderTopWidth, colour: style.borderTopColor };
  });
}

/**
 * The Patients screen's own surface and ink, read from the empty-state panel.
 *
 * `shellColours` reads the rail, the `h1` and the synthetic marker — all shell chrome, identical
 * on both routes, so a dark-mode test built only on it proves the SHELL re-resolves and says
 * nothing about anything this screen draws. The empty state sits on `--surface-subtle` with its
 * own border and muted ink, none of which the shell contributes.
 */
function emptyStateColours(page: Page) {
  return page.evaluate(() => {
    const group = document.querySelector("[role='group'][aria-label='No patients yet']");
    if (!group) throw new Error("the empty state is missing");
    const style = getComputedStyle(group);
    const heading = group.querySelector("p");
    if (!heading) throw new Error("the empty state has no heading");
    return {
      surface: style.backgroundColor,
      border: style.borderTopColor,
      ink: getComputedStyle(heading).color,
    };
  });
}

function shellColours(page: Page) {
  return page.evaluate(() => {
    const chrome = document.querySelector("[data-testid='caring-contacts-rail']");
    const heading = document.querySelector("h1");
    const marker = document.querySelector("[data-testid='caring-contacts-synthetic-marker']");
    if (!chrome || !heading || !marker) throw new Error("caring-contacts shell landmarks are missing");
    return {
      chrome: getComputedStyle(chrome).backgroundColor,
      ink: getComputedStyle(heading).color,
      marker: getComputedStyle(marker).color,
    };
  });
}

test.describe("caring-contacts workspace shell", () => {
  for (const width of REVIEW_WIDTHS) {
    test(`holds the frozen layout at ${width}px`, async ({ page }) => {
      await openWorkspace(page, width);

      // (1) nothing spills sideways — the failure that makes a phone screen unusable.
      expect(await documentOverflow(page), `horizontal document overflow at ${width}px`).toBeLessThanOrEqual(2);

      // (4) exactly one width state is displayed, and it is the one the frozen
      // module names. Two displayed markers means overlapping media classes.
      expect(await displayedWidthStates(page), `width state at ${width}px`).toEqual([widthStateFor(width)]);

      const rail = page.getByTestId("caring-contacts-rail");
      const dock = page.getByTestId("caring-contacts-phone-dock");

      // (2) below the rail boundary the phone dock owns navigation; at and above
      // it the rail does, and the dock is gone.
      if (width < WORKSPACE_WIDTH_BREAKPOINTS.rail) {
        await expect(dock).toBeVisible();
        await expect(rail).toBeHidden();

        // (3) the fixed dock must not cover the workspace's primary control.
        const dockBox = await dock.boundingBox();
        const primaryBox = await page.getByTestId("caring-contacts-primary-control").boundingBox();
        expect(dockBox, "phone dock has no box").not.toBeNull();
        expect(primaryBox, "primary control has no box").not.toBeNull();
        expect(
          primaryBox!.y + primaryBox!.height,
          `primary control is under the dock at ${width}px`,
        ).toBeLessThanOrEqual(dockBox!.y);

        // …nor the last control in the flow, which is where a missing bottom
        // reserve actually shows up. The primary control alone sits near the top
        // of the page and would pass a broken reserve untouched.
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        const lastControl = page.getByRole("button", { name: "Coverage" });
        const lastBox = await lastControl.boundingBox();
        const dockBoxAfterScroll = await dock.boundingBox();
        expect(lastBox, "last More destination has no box").not.toBeNull();
        expect(
          lastBox!.y + lastBox!.height,
          `the last destination is under the dock at ${width}px — the bottom reserve is too small`,
        ).toBeLessThanOrEqual(dockBoxAfterScroll!.y);
      } else {
        await expect(rail).toBeVisible();
        await expect(dock).toBeHidden();
      }
    });
  }

  test("re-resolves its surfaces and ink in dark rather than leaking a light value", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await openWorkspace(page, 1024);
    const light = await shellColours(page);

    await page.emulateMedia({ colorScheme: "dark" });
    await openWorkspace(page, 1024);
    const dark = await shellColours(page);

    // A hardcoded colour anywhere in the shell would leave one of these identical
    // across the two schemes.
    expect(dark.chrome, "rail surface did not change in dark").not.toBe(light.chrome);
    expect(dark.ink, "heading ink did not change in dark").not.toBe(light.ink);
    expect(dark.marker, "synthetic marker ink did not change in dark").not.toBe(light.marker);
    for (const value of Object.values(dark)) {
      expect(value, "a dark colour resolved to nothing").not.toBe("rgba(0, 0, 0, 0)");
    }
    await expect(page.getByTestId("caring-contacts-synthetic-marker")).toBeVisible();
  });

  test("keeps the synthetic marker delimited once forced colours drop its tint", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "forced-colors emulation is Chromium-only");

    await page.emulateMedia({ forcedColors: "active" });
    await openWorkspace(page, 390);

    await expect(page.getByTestId("caring-contacts-synthetic-marker")).toBeVisible();

    // Forced colours drop an author background, so the badge's tint goes and the
    // border is the only thing left delimiting the one safeguard that says these
    // patients are invented.
    //
    // This is the only assertion here that was shown to be able to fail:
    // removing the marker's `border` class reddens it. Three other candidates
    // were tried and discarded because nothing could make them fail on a v2
    // surface — the marker's ink and surface are forced to system colours by the
    // user agent whatever the CSS says, and `--clinical-accent-soft` already maps
    // to `Canvas`, so "the tint was dropped" and "the tint was kept" look
    // identical. Details in the task report; decoration is not left here to look
    // thorough.
    const border = await markerBorder(page);
    expect(Number.parseFloat(border.width), "the marker has no border under forced colours").toBeGreaterThan(0);
    expect(border.colour, "the marker border is transparent under forced colours").not.toBe("rgba(0, 0, 0, 0)");

    await expect(page.getByTestId("caring-contacts-phone-dock")).toBeVisible();
    expect(await documentOverflow(page), "horizontal overflow under forced colours").toBeLessThanOrEqual(2);
  });

  test("prints with the synthetic marker still on the page", async ({ page }) => {
    await openWorkspace(page, 1024);
    await page.emulateMedia({ media: "print" });

    // A printed page of invented patients that has lost its marker is the exact
    // artefact this workspace must never produce.
    await expect(page.getByTestId("caring-contacts-synthetic-marker")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
    expect(await documentOverflow(page), "horizontal overflow in print").toBeLessThanOrEqual(2);
  });
});

/* ------------------------------------------------------------------------- *
 * The Patients directory (Phase 2B Task 5) — the workspace's second production
 * screen, and the reason this file could no longer prove only one route.
 *
 * `docs/design-system/adoption-contract.json` added
 * `src/app/caring-contacts/patients/page.tsx` to the `caring-contacts-workspace`
 * surface, whose five proof categories all cite this file and nothing else.
 * Until this block existed, every one of those five was a claim about a route
 * this suite had never loaded — a well-formed declaration certifying nothing,
 * which is precisely the silenced gate the file header warns about. So the four
 * accessibility-mode proofs are repeated here against the real screen rather
 * than inherited from Today, and each asserts something that can actually fail.
 *
 * The demo store holds no plans (the in-memory repository seeds none), so this
 * screen's honest state in a browser is the "no patients yet" empty state. That
 * is not a fixture convenience: it is the empty-list contract observed end to
 * end — an empty caseload served as a page rather than as a missing resource.
 * ------------------------------------------------------------------------- */

test.describe("caring-contacts patients directory", () => {
  test("serves an empty caseload as a page, not a missing resource", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: VIEWPORT_HEIGHT });
    const response = await page.goto(PATIENTS_ROUTE, { waitUntil: "load" });

    // The empty-list contract observed end to end rather than inferred from a
    // render: `listPlans` returning `[]` is a permitted read that released
    // something, so this screen is served rather than refused.
    //
    // READ THE NEXT PARAGRAPH BEFORE TRIMMING THIS TEST TO THE STATUS LINE.
    // The status check is NOT what catches a `notFound()` here, and measuring
    // that was the point of running the mutation rather than assuming: with
    // `if (records.length === 0) notFound()` added to the page, this route still
    // answered **200**, because it is dynamic and streams under `loading.tsx`'s
    // Suspense boundary — the headers are flushed before the render reaches
    // `notFound()`, so the refusal arrives as CONTENT, not as a status code. The
    // three content assertions below are the load-bearing ones; the status line
    // is kept because it still catches a refusal made before the stream opens
    // (the production demo lock, or the route failing to resolve at all).
    expect(response?.status(), "the patients route did not serve a page").toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Patients" })).toBeVisible();

    // And the empty state states which of the three facts it is, in words.
    const empty = page.getByRole("group", { name: "No patients yet" });
    await expect(empty).toBeVisible();
    await expect(empty).toContainText("referral");
  });

  test("holds the frozen layout at 320px, the narrowest reviewed width", async ({ page }) => {
    await openWorkspace(page, 320, VIEWPORT_HEIGHT, PATIENTS_SCREEN);

    expect(await documentOverflow(page), "horizontal document overflow at 320px").toBeLessThanOrEqual(2);
    expect(await displayedWidthStates(page), "width state at 320px").toEqual([widthStateFor(320)]);
    await expect(page.getByTestId("caring-contacts-phone-dock")).toBeVisible();
    await expect(page.getByTestId("caring-contacts-rail")).toBeHidden();

    // The state filter is a set of real links, and they meet the production tap
    // floor at the width where a thumb is the only pointer. A chip narrowed to
    // the generic 44px guidance fails here, which is the point.
    const chip = page.getByRole("link", { name: "Active" });
    await expect(chip).toBeVisible();
    const box = await chip.boundingBox();
    expect(box?.height ?? 0, "the state filter chip is under the production tap floor").toBeGreaterThanOrEqual(48);
  });

  test("re-resolves its surfaces and ink in dark rather than leaking a light value", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await openWorkspace(page, 1024, VIEWPORT_HEIGHT, PATIENTS_SCREEN);
    await expect(page.getByRole("group", { name: "No patients yet" })).toBeVisible();
    const light = await shellColours(page);
    const lightEmpty = await emptyStateColours(page);

    await page.emulateMedia({ colorScheme: "dark" });
    await openWorkspace(page, 1024, VIEWPORT_HEIGHT, PATIENTS_SCREEN);
    await expect(page.getByRole("group", { name: "No patients yet" })).toBeVisible();
    const dark = await shellColours(page);
    const darkEmpty = await emptyStateColours(page);

    expect(dark.chrome, "rail surface did not change in dark").not.toBe(light.chrome);
    expect(dark.ink, "heading ink did not change in dark").not.toBe(light.ink);
    expect(dark.marker, "synthetic marker ink did not change in dark").not.toBe(light.marker);
    for (const value of Object.values(dark)) {
      expect(value, "a dark colour resolved to nothing").not.toBe("rgba(0, 0, 0, 0)");
    }

    // Everything above is shell chrome, identical on both routes, so on its own it would prove
    // the SHELL re-resolves and claim the category on a screen it had not inspected. These read
    // this screen's own surface: the empty state's panel, border and ink, none of them drawn by
    // the shell. A hardcoded colour in `list-empty-state.tsx` leaves one of them unchanged.
    expect(darkEmpty.surface, "the empty state's surface did not change in dark").not.toBe(lightEmpty.surface);
    expect(darkEmpty.border, "the empty state's border did not change in dark").not.toBe(lightEmpty.border);
    expect(darkEmpty.ink, "the empty state's ink did not change in dark").not.toBe(lightEmpty.ink);
    for (const value of Object.values(darkEmpty)) {
      expect(value, "a dark colour on the empty state resolved to nothing").not.toBe("rgba(0, 0, 0, 0)");
    }
  });

  test("states the empty caseload in words once forced colours drop every tint", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "forced-colors emulation is Chromium-only");

    await page.emulateMedia({ forcedColors: "active" });
    await openWorkspace(page, 390, VIEWPORT_HEIGHT, PATIENTS_SCREEN);

    // Forced colours drop author backgrounds, so anything this screen said with
    // a tint alone says nothing here. Both safeguards must survive in words.
    await expect(page.getByTestId("caring-contacts-synthetic-marker")).toBeVisible();
    const empty = page.getByRole("group", { name: "No patients yet" });
    await expect(empty).toBeVisible();
    await expect(empty).toContainText("referral");

    // The empty state's own delimiter, the same assertion shape the synthetic
    // marker uses above and for the same reason: forced colours drop the panel's
    // author background, leaving the border as the only thing separating this
    // statement from the page around it.
    const border = await page.evaluate(() => {
      const group = document.querySelector("[role='group'][aria-label='No patients yet']");
      if (!group) throw new Error("the empty state is missing");
      const style = getComputedStyle(group);
      return { width: style.borderTopWidth, colour: style.borderTopColor };
    });
    expect(Number.parseFloat(border.width), "the empty state has no border under forced colours").toBeGreaterThan(0);
    expect(border.colour, "the empty state border is transparent under forced colours").not.toBe("rgba(0, 0, 0, 0)");

    expect(await documentOverflow(page), "horizontal overflow under forced colours").toBeLessThanOrEqual(2);
  });

  test("prints with the synthetic marker and the empty state still on the page", async ({ page }) => {
    await openWorkspace(page, 1024, VIEWPORT_HEIGHT, PATIENTS_SCREEN);
    await page.emulateMedia({ media: "print" });

    await expect(page.getByTestId("caring-contacts-synthetic-marker")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Patients" })).toBeVisible();
    // A printed caseload that has lost the statement of WHY it is empty reads as
    // a caseload of zero with no reason given.
    await expect(page.getByRole("group", { name: "No patients yet" })).toBeVisible();
    expect(await documentOverflow(page), "horizontal overflow in print").toBeLessThanOrEqual(2);
  });

  test("is reachable from the workspace rail, not only by typing its URL", async ({ page }) => {
    await openWorkspace(page, 1024);

    await page.getByRole("navigation", { name: "Workspace" }).getByRole("link", { name: "Patients" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Patients" })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(PATIENTS_ROUTE);
  });
});

/* ------------------------------------------------------------------------- *
 * Task 19 — the overlay half, and the accessibility half.
 *
 * Task 15 (Ruling 51) wrote everything above: the six review widths, the
 * dock/rail exchange, dock clearance, the width-state markers, dark, forced
 * colours and print. Nothing above is weakened here; this file only grows.
 *
 * What is added below is brief item 5 and the remainder of item 6:
 *
 *  - all twenty-four overlays deep-linked by `?overlay=<id>` at 390 and 1440,
 *    checked against the FROZEN TABLE rather than against a second copy of it;
 *  - the dismissal contract, likewise read off the table;
 *  - return of focus to the control an overlay was opened from;
 *  - a visible focus ring in dark, under forced colours, and at the 400% zoom
 *    equivalent of a 1280px viewport, with no horizontal overflow there.
 * ------------------------------------------------------------------------- */

/**
 * The two widths the overlay matrix is proved at for pure phone and desktop modalities.
 *
 * 390 samples `compact` (phone modalities) and 1440 samples `wide` (desktop
 * modalities), which is every branch the host's modality decision has.
 *
 * Ruling 60 modal/sheet breakpoint contract testing: between 640 and 767 the stamped
 * modality and the shared Sheet's own geometry breakpoint disagree: `widthStateFor`
 * switches compact→rail at 768, while `Sheet` switches to a centred dialog at
 * Tailwind `sm:` = 640, so a `bottom-sheet` row in that band stamps `bottom-sheet`
 * and renders as a dialog. This divergence is explicitly verified across 640px,
 * 700px, and 767px in the dedicated Ruling 60 suite below.
 */
const OVERLAY_MATRIX_WIDTHS = [390, 1440] as const;

/** The query parameter that names an open overlay (`workspace-overlays.tsx`). */
const OVERLAY_PARAM = "overlay";

/** A `dialog` is a dialog and not a page: it never grows past this. */
const DIALOG_MAX_WIDTH = 640;

/** An `inspection-drawer` inspects something; the thing being inspected stays visible beside it. */
const INSPECTION_DRAWER_MAX_WIDTH_RATIO = 0.56;

/** Sub-pixel rounding on a fractional viewport, not a licence to be off by a control's width. */
const EDGE_TOLERANCE = 2;

/**
 * The floor every overlay surface clears, whatever its modality.
 *
 * Without it two branches below state only one side of their bound — the desktop
 * session gate says "wider than a dialog" and the dialog says "no wider than 640"
 * — so a 1392x0 gate and a 1px dialog would both satisfy their own branch and
 * `expectFullyOnScreen` as well. A collapsed panel is in fact caught downstream,
 * by the decision control having to be fully in the viewport, but that is an
 * unstated dependency between two assertions rather than a stated contract. This
 * states it.
 *
 * 320 is the narrowest viewport this workspace supports, so nothing narrower than
 * that can be a usable surface. 96 is a heading, a line of plain-words
 * explanation and a 48px tap target — the least an overlay can be and still carry
 * what the frozen table gives it.
 */
const MIN_SURFACE_WIDTH = 320;
const MIN_SURFACE_HEIGHT = 96;

type OverlayBox = { x: number; y: number; width: number; height: number };

/**
 * Which modality the FROZEN TABLE chooses for this row at this width.
 *
 * Read from the definition and `widthStateFor`, never written into this spec by
 * hand: a modality typed in here would agree with the table on the day it was
 * typed and silently disagree afterwards, which is the one thing a browser proof
 * of a frozen contract must not do.
 */
function expectedModalityAt(definition: WorkspaceOverlayDefinition, width: number) {
  return widthStateFor(width) === "compact" ? definition.phoneModality : definition.desktopModality;
}

/**
 * Whether Escape dismisses this row, read off the table's `dismissal`.
 *
 * Deliberately throws on anything else rather than falling through to "yes". The
 * frozen matrix expresses exactly two values and `action-only` is reserved and
 * unreachable (Ruling 58); if a future row ever takes a third value, the
 * conservative reading — "the user must not be able to walk away from this" — is
 * the one that must not be assumed away by a test. Same shape as
 * `dismissesOnEscapeOrBackdrop` in the host, and deliberately not imported from
 * it: a proof that borrows the implementation's own decision cannot catch that
 * decision being wrong.
 *
 * Note that the brief names only `session-expiry` as surviving Escape. The table
 * marks `offline-banner` `recovery-only` too, and driving from the table rather
 * than from that list is what makes both hold.
 */
function dismissesOnEscape(dismissal: WorkspaceOverlayDefinition["dismissal"]): boolean {
  if (dismissal === "escape-backdrop-close") return true;
  if (dismissal === "recovery-only") return false;
  throw new Error(
    `Unrecognised overlay dismissal "${dismissal}". Decide it against ` +
      `docs/caring-contacts/interaction-matrix.md before this spec is taught to expect anything.`,
  );
}

/** The surface a modality is carried on: every modality but `status-banner` is a Sheet. */
function overlaySurface(page: Page, modality: string) {
  return modality === "status-banner"
    ? page.getByTestId("workspace-overlay-status-banner")
    : page.getByTestId("workspace-overlay-sheet");
}

/** Deep-links one overlay and waits for it, exactly as a pasted URL would. */
async function deepLinkOverlay(page: Page, width: number, id: string) {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await page.goto(`${WORKSPACE_ROUTE}?${OVERLAY_PARAM}=${id}`, { waitUntil: "load" });
  const content = page.locator(`[data-testid="workspace-overlay-content"][data-overlay-id="${id}"]`);
  await expect(content, `${id} did not open from its deep link at ${width}px`).toHaveCount(1);
  return content;
}

function overlayParamOf(page: Page) {
  return new URL(page.url()).searchParams.get(OVERLAY_PARAM);
}

/** Nothing is ever off-screen: no edge of the overlay lies outside the viewport. */
function expectFullyOnScreen(box: OverlayBox, width: number, label: string) {
  expect(box.x, `${label} starts left of the viewport`).toBeGreaterThanOrEqual(-EDGE_TOLERANCE);
  expect(box.y, `${label} starts above the viewport`).toBeGreaterThanOrEqual(-EDGE_TOLERANCE);
  expect(box.x + box.width, `${label} runs past the right edge`).toBeLessThanOrEqual(width + EDGE_TOLERANCE);
  expect(box.y + box.height, `${label} runs past the bottom edge`).toBeLessThanOrEqual(
    VIEWPORT_HEIGHT + EDGE_TOLERANCE,
  );
}

/**
 * The geometry each modality owes, stated once.
 *
 * Every branch is a statement about what the modality MEANS rather than a
 * transcription of a measurement: a stage that does not fill the screen is not a
 * stage, a drawer that covers the record it is inspecting is not a drawer, and a
 * session gate the size of a dialog reads as something the user may wave away
 * and carry on.
 */
function expectModalityGeometry(box: OverlayBox, modality: string, width: number, label: string) {
  expectFullyOnScreen(box, width, label);
  expect(box.width, `${label} is narrower than the narrowest supported viewport`).toBeGreaterThanOrEqual(
    MIN_SURFACE_WIDTH,
  );
  expect(box.height, `${label} is too short to carry its heading, summary and action`).toBeGreaterThanOrEqual(
    MIN_SURFACE_HEIGHT,
  );
  const compact = widthStateFor(width) === "compact";

  switch (modality) {
    case "full-screen-stage":
      // A stage owns the whole phone screen. It occurs only as a phone modality.
      expect(compact, `${label}: full-screen-stage is a phone modality`).toBe(true);
      expect(box.width, `${label} does not fill the viewport width`).toBeGreaterThanOrEqual(width - EDGE_TOLERANCE);
      expect(box.height, `${label} does not fill the viewport height`).toBeGreaterThanOrEqual(
        VIEWPORT_HEIGHT - EDGE_TOLERANCE,
      );
      break;

    case "session-gate":
      if (compact) {
        expect(box.width, `${label} does not fill the viewport width`).toBeGreaterThanOrEqual(width - EDGE_TOLERANCE);
        expect(box.height, `${label} does not fill the viewport height`).toBeGreaterThanOrEqual(
          VIEWPORT_HEIGHT - EDGE_TOLERANCE,
        );
      } else {
        // On a wide screen the gate is not full height — but it must never be
        // sized like an ordinary dialog, or it reads as one.
        expect(box.width, `${label} is no wider than a dialog, so it reads as one`).toBeGreaterThan(DIALOG_MAX_WIDTH);
      }
      break;

    case "bottom-sheet":
      expect(compact, `${label}: bottom-sheet is a phone modality`).toBe(true);
      expect(box.width, `${label} does not span the phone width`).toBeGreaterThanOrEqual(width - EDGE_TOLERANCE);
      expect(box.y + box.height, `${label} is not anchored to the bottom edge`).toBeGreaterThanOrEqual(
        VIEWPORT_HEIGHT - EDGE_TOLERANCE,
      );
      break;

    case "inspection-drawer":
      expect(compact, `${label}: inspection-drawer is a desktop modality`).toBe(false);
      expect(box.x + box.width, `${label} is not anchored to the right edge`).toBeGreaterThanOrEqual(
        width - EDGE_TOLERANCE,
      );
      expect(box.width, `${label} covers too much of the record it is inspecting`).toBeLessThanOrEqual(
        width * INSPECTION_DRAWER_MAX_WIDTH_RATIO,
      );
      break;

    case "dialog":
      expect(compact, `${label}: dialog is a desktop modality`).toBe(false);
      expect(box.width, `${label} is wider than a dialog may be`).toBeLessThanOrEqual(DIALOG_MAX_WIDTH);
      break;

    case "status-banner":
      // A banner reports; it never becomes a modal. It sits on the bottom edge
      // and spans the width at every size.
      expect(box.width, `${label} does not span the viewport width`).toBeGreaterThanOrEqual(width - EDGE_TOLERANCE);
      expect(box.y + box.height, `${label} is not anchored to the bottom edge`).toBeGreaterThanOrEqual(
        VIEWPORT_HEIGHT - EDGE_TOLERANCE,
      );
      break;

    default:
      throw new Error(`${label}: no geometry is stated for the modality "${modality}".`);
  }
}

test.describe("caring-contacts workspace overlays", () => {
  for (const width of OVERLAY_MATRIX_WIDTHS) {
    test(`opens all ${WORKSPACE_OVERLAY_DEFINITIONS.length} overlays at their frozen modality and geometry at ${width}px`, async ({
      page,
    }) => {
      // Twenty-four full page loads; the suite default of 60s is sized for one journey.
      test.setTimeout(240_000);

      for (const definition of WORKSPACE_OVERLAY_DEFINITIONS) {
        const content = await deepLinkOverlay(page, width, definition.id);
        const label = `${definition.id} at ${width}px`;

        // The URL names the open overlay, which is what makes it linkable at all.
        expect(overlayParamOf(page), `${label}: the URL does not carry the overlay id`).toBe(definition.id);

        const modality = expectedModalityAt(definition, width);
        await expect(content, `${label}: stamped modality`).toHaveAttribute("data-overlay-modality", modality);
        await expect(content, `${label}: stamped dismissal`).toHaveAttribute(
          "data-overlay-dismissal",
          definition.dismissal,
        );

        const box = await overlaySurface(page, modality).boundingBox();
        expect(box, `${label}: the overlay surface has no box`).not.toBeNull();
        expectModalityGeometry(box!, modality, width, label);

        // The decision control is the whole point of the overlay; an overlay whose
        // action is off-screen is unusable however well the panel itself is placed.
        await expect(
          content.getByTestId("workspace-overlay-action"),
          `${label}: the decision control is not fully in the viewport`,
        ).toBeInViewport({ ratio: 1 });

        await page.keyboard.press("Escape");

        if (dismissesOnEscape(definition.dismissal)) {
          await expect(content, `${label}: Escape did not close it`).toHaveCount(0);
          await expect
            .poll(() => overlayParamOf(page), { message: `${label}: Escape left the id in the URL` })
            .toBeNull();
        } else {
          // Proving that nothing happened needs a settle window: a dismissal that
          // was going to happen would have happened inside it.
          await page.waitForTimeout(300);
          await expect(content, `${label}: Escape dismissed a recovery-only overlay`).toHaveCount(1);
          expect(overlayParamOf(page), `${label}: Escape cleared a recovery-only overlay's id`).toBe(definition.id);
        }
      }
    });

    test(`returns focus to the control an overlay was opened from at ${width}px`, async ({ page }) => {
      test.setTimeout(240_000);
      await openWorkspace(page, width);

      // The workspace has no control that opens an overlay yet — `?overlay=<id>`
      // is reachable only by typing it, and the screens that raise these overlays
      // are Plan 2B. So the opener is stood in for by the two lines
      // `openWorkspaceOverlay()` performs: push the parameter onto the history
      // stack, and let the store's own `popstate` subscription notice. Everything
      // actually under test here — the host capturing `document.activeElement` as
      // the overlay opens, and the Sheet restoring focus to it on close — is
      // production code, reached exactly as it would be from a real button.
      const trigger = page.getByRole("button", { name: /^New plan/ });
      await expect(trigger).toBeVisible();

      for (const definition of WORKSPACE_OVERLAY_DEFINITIONS) {
        // A recovery-only overlay never closes on Escape, so it has no focus to
        // return; the matrix test above is what holds it open.
        if (!dismissesOnEscape(definition.dismissal)) continue;
        const label = `${definition.id} at ${width}px`;

        await trigger.focus();
        await expect(trigger, `${label}: the stand-in opener never took focus`).toBeFocused();

        await page.evaluate(
          ({ id, param }) => {
            const url = new URL(window.location.href);
            url.searchParams.set(param, id);
            window.history.pushState(null, "", `${url.pathname}${url.search}`);
            window.dispatchEvent(new PopStateEvent("popstate"));
          },
          { id: definition.id, param: OVERLAY_PARAM },
        );

        const content = page.locator(`[data-testid="workspace-overlay-content"][data-overlay-id="${definition.id}"]`);
        await expect(content, `${label}: did not open`).toHaveCount(1);

        await page.keyboard.press("Escape");
        await expect(content, `${label}: Escape did not close it`).toHaveCount(0);
        await expect(trigger, `${label}: focus was not returned to the opener`).toBeFocused();
      }
    });
  }
});

/**
 * Ruling 60 — modal vs bottom-sheet behavior across the 640px–767px band.
 *
 * `widthStateFor` returns "compact" up to 767px (rail breakpoint is 768px), so OverlayHost
 * stamps `data-overlay-modality="bottom-sheet"`. The shared Sheet component switches from
 * bottom-sheet to centred dialog modal at Tailwind `sm:` = 640px.
 *
 * The assertions below verify the exact contract across 640px, 700px, and 767px:
 * 1. The stamped modality remains "bottom-sheet" as specified in the frozen definitions.
 * 2. The rendered geometry is a centred modal dialog (constrained width <= 640px,
 *    not anchored to the bottom edge, drag grip hidden).
 * 3. Full-screen stages remain full screen across the band (they transition at `lg:` = 1024px).
 * 4. Decision control stays fully visible in the viewport and Escape dismissal is respected.
 */
const RULING_60_BAND_WIDTHS = [640, 700, 767] as const;

test.describe("caring-contacts overlay Ruling 60 modal vs bottom-sheet breakpoint contract", () => {
  for (const width of RULING_60_BAND_WIDTHS) {
    test(`verifies bottom-sheet rows render as centred dialog modals at ${width}px`, async ({ page }) => {
      test.setTimeout(120_000);

      const bottomSheetRows = WORKSPACE_OVERLAY_DEFINITIONS.filter(
        (definition) => definition.phoneModality === "bottom-sheet",
      );

      for (const definition of bottomSheetRows) {
        const label = `${definition.id} at ${width}px`;
        const content = await deepLinkOverlay(page, width, definition.id);

        expect(overlayParamOf(page), `${label}: URL query parameter`).toBe(definition.id);
        expect(widthStateFor(width), `${label}: widthStateFor must be compact`).toBe("compact");

        await expect(content, `${label}: stamped modality`).toHaveAttribute("data-overlay-modality", "bottom-sheet");
        await expect(content, `${label}: stamped dismissal`).toHaveAttribute(
          "data-overlay-dismissal",
          definition.dismissal,
        );

        const sheetSurface = page.getByTestId("workspace-overlay-sheet");
        const box = await sheetSurface.boundingBox();
        expect(box, `${label}: the overlay surface has no box`).not.toBeNull();
        expectFullyOnScreen(box!, width, label);

        // Modal geometry assertions:
        // Width is constrained to dialog max width and narrower than viewport width
        expect(box!.width, `${label}: modal width should not exceed dialog max width`).toBeLessThanOrEqual(
          DIALOG_MAX_WIDTH + EDGE_TOLERANCE,
        );
        expect(box!.width, `${label}: modal should be narrower than viewport width`).toBeLessThan(width);

        // Centered vertically, not bottom-anchored
        expect(
          box!.y + box!.height,
          `${label}: modal should be vertically centred, not anchored to the bottom edge`,
        ).toBeLessThan(VIEWPORT_HEIGHT - 4);
        expect(box!.y, `${label}: modal should not touch the top edge`).toBeGreaterThan(4);

        // Mobile drag grip is hidden on dialog modal
        const dragGrip = sheetSurface.locator(".cursor-grab");
        await expect(dragGrip, `${label}: drag handle should be hidden on modal`).toBeHidden();

        // Decision action is fully in viewport
        await expect(
          content.getByTestId("workspace-overlay-action"),
          `${label}: decision control is not fully in the viewport`,
        ).toBeInViewport({ ratio: 1 });

        await page.keyboard.press("Escape");
        if (dismissesOnEscape(definition.dismissal)) {
          await expect(content, `${label}: Escape did not close it`).toHaveCount(0);
          await expect
            .poll(() => overlayParamOf(page), { message: `${label}: Escape left the id in the URL` })
            .toBeNull();
        } else {
          await page.waitForTimeout(300);
          await expect(content, `${label}: Escape dismissed a recovery-only overlay`).toHaveCount(1);
          expect(overlayParamOf(page), `${label}: Escape cleared recovery-only id`).toBe(definition.id);
        }
      }
    });

    test(`verifies full-screen-stage rows remain fullscreen across the ${width}px band`, async ({ page }) => {
      test.setTimeout(120_000);

      const stageRows = WORKSPACE_OVERLAY_DEFINITIONS.filter(
        (definition) => definition.phoneModality === "full-screen-stage",
      );

      for (const definition of stageRows) {
        const label = `${definition.id} at ${width}px`;
        const content = await deepLinkOverlay(page, width, definition.id);

        await expect(content, `${label}: stamped modality`).toHaveAttribute(
          "data-overlay-modality",
          "full-screen-stage",
        );
        const sheetSurface = page.getByTestId("workspace-overlay-sheet");
        const box = await sheetSurface.boundingBox();
        expect(box, `${label}: stage surface has no box`).not.toBeNull();
        expectFullyOnScreen(box!, width, label);

        expect(box!.width, `${label}: stage does not fill viewport width`).toBeGreaterThanOrEqual(
          width - EDGE_TOLERANCE,
        );
        expect(box!.height, `${label}: stage does not fill viewport height`).toBeGreaterThanOrEqual(
          VIEWPORT_HEIGHT - EDGE_TOLERANCE,
        );

        await expect(
          content.getByTestId("workspace-overlay-action"),
          `${label}: decision control is not fully in the viewport`,
        ).toBeInViewport({ ratio: 1 });
      }
    });
  }
});

/**
 * WCAG 2.1 1.4.10 reflow, and the focus ring that has to survive it.
 *
 * 400% zoom is emulated as a 320x200 layout viewport — 1280x800 divided by four
 * — rather than by setting `zoom: 4` on the root element. That is not a shortcut.
 * Measured in this Chromium, `document.documentElement.style.zoom = "4"` on a
 * 1280px viewport leaves `innerWidth`, `documentElement.clientWidth` and
 * `documentElement.scrollWidth` all reporting 1280 and leaves `(width < 768px)`
 * matching false, so the page keeps its `split` desktop layout and an overflow
 * check written against it can never fail. The divided viewport is what the
 * success criterion actually describes, it moves the media queries with it, and
 * it is the same equivalence `ui-smoke.spec.ts` already uses for 200%.
 */
const ZOOM_400_BASE = { width: 1280, height: 800 } as const;
const ZOOM_400_EQUIVALENT = { width: ZOOM_400_BASE.width / 4, height: ZOOM_400_BASE.height / 4 } as const;

/** Horizontal overflow measured against the LAYOUT viewport, so it stays true under a resized frame. */
function layoutOverflow(page: Page) {
  return page.evaluate(
    () =>
      Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0) -
      document.documentElement.clientWidth,
  );
}

/**
 * Tabs until the workspace's own `Today` destination has focus.
 *
 * A keyboard press rather than `.focus()`: the ring is attached to
 * `:focus-visible`, which a programmatic focus does not reliably raise.
 */
async function tabToWorkspaceDestination(page: Page) {
  const destination = page.getByRole("link", { name: "Today" });
  for (let press = 0; press < 40; press += 1) {
    await page.keyboard.press("Tab");
    if (await destination.evaluate((node) => node === document.activeElement)) return destination;
  }
  throw new Error("Tab never reached the workspace's Today destination");
}

function focusRingOf(page: Page) {
  return page.evaluate(() => {
    const focused = document.activeElement;
    if (!(focused instanceof HTMLElement)) throw new Error("nothing has focus");
    const style = getComputedStyle(focused);
    return { style: style.outlineStyle, width: style.outlineWidth, colour: style.outlineColor };
  });
}

/**
 * The ring has to be one the application drew.
 *
 * Measured, because it changes how a failure here should be read: TWO
 * independent declarations supply this ring — the app-wide
 * `:where(button, a, …):focus-visible` rule in `globals.css`, and the shell's own
 * `focus-visible:outline-2` utilities — and either one alone satisfies every
 * assertion below. Removing just the shell's classes leaves this green, which is
 * the honest answer: the ring is still drawn. Removing both turns `outlineStyle`
 * to `none` and reddens it.
 *
 * Width and colour are checked as well as style because a ring declared at zero
 * width, or in a transparent colour, still reports as `solid`.
 */
function expectVisibleFocusRing(ring: { style: string; width: string; colour: string }, label: string) {
  expect(ring.style, `${label}: the focused control has no focus outline`).not.toBe("none");
  expect(
    Number.parseFloat(ring.width),
    `${label}: the focus outline is thinner than the declared ring`,
  ).toBeGreaterThanOrEqual(2);
  expect(ring.colour, `${label}: the focus outline is transparent`).not.toBe("rgba(0, 0, 0, 0)");
}

test.describe("caring-contacts workspace accessibility modes", () => {
  test("reflows at the 400% zoom equivalent without spilling sideways", async ({ page }) => {
    await page.setViewportSize(ZOOM_400_EQUIVALENT);
    await page.goto(WORKSPACE_ROUTE, { waitUntil: "load" });
    await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();

    expect(await layoutOverflow(page), "horizontal overflow at the 400% zoom equivalent").toBeLessThanOrEqual(2);

    // Reflow really happened rather than the page merely not overflowing: at the
    // 400% equivalent the frozen mapping must have dropped to its phone layout.
    expect(await displayedWidthStates(page), "width state at the 400% zoom equivalent").toEqual([
      widthStateFor(ZOOM_400_EQUIVALENT.width),
    ]);
    await expect(page.getByTestId("caring-contacts-phone-dock")).toBeVisible();
  });

  for (const mode of ["default", "dark", "forced-colors", "zoom-400"] as const) {
    test(`draws a visible focus ring in ${mode}`, async ({ page, browserName }) => {
      test.skip(mode === "forced-colors" && browserName !== "chromium", "forced-colors emulation is Chromium-only");

      if (mode === "dark") await page.emulateMedia({ colorScheme: "dark" });
      if (mode === "forced-colors") await page.emulateMedia({ forcedColors: "active" });
      await page.setViewportSize(mode === "zoom-400" ? ZOOM_400_EQUIVALENT : { width: 1024, height: VIEWPORT_HEIGHT });
      await page.goto(WORKSPACE_ROUTE, { waitUntil: "load" });
      await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();

      await tabToWorkspaceDestination(page);
      expectVisibleFocusRing(await focusRingOf(page), `focus ring in ${mode}`);
      expect(await layoutOverflow(page), `horizontal overflow in ${mode}`).toBeLessThanOrEqual(2);
    });
  }
});

/* ------------------------------------------------------------------------- *
 * The condensed service-stop bar.
 *
 * Nothing above this line is weakened; this file only grows again.
 *
 * Task 19 measured the defect this closes: with a stop active, the full banner
 * sits in normal flow beneath a sticky header, so at 320, 390, 430 and 768px it
 * scrolls completely out of view (y from -285 to -602). Spec 4.2 requires the
 * stop to be stated on every screen for as long as it is active, and a
 * statement that has scrolled away states nothing. The owner's decision was a
 * condensed one-line bar pinned under the header once the full banner has gone
 * — not the full banner pinned, which costs about a quarter of a phone screen
 * at all times, on every screen.
 *
 * Only a browser can check this. Every unit test on the branch stayed green
 * while the banner was scrolling off screen, because JSDOM has no scroll
 * position and no sticky header. So the assertions below are geometric: is the
 * stop ON SCREEN, and is it stated ONCE.
 *
 * Ordering matters and is deliberate. Raising a stop is irreversible in the
 * demo: restarting needs three approvals from three DIFFERENT people, and only
 * two demo roles hold `approveServiceRestart`, so nothing can undo it in this
 * process. `run-playwright.mjs` starts a fresh server for every run, and this
 * config is `fullyParallel: false` with one worker, so declaring this block last
 * means every test above it runs against a running service exactly as before.
 * ------------------------------------------------------------------------- */

/** The state word the workspace uses. Deliberately not a transport word. */
const STOPPED_STATE_LABEL = "Sending stopped";

/** The scope half of the claim — the half an abbreviation must not drop. */
const STOPPED_SCOPE_WORDING = "the whole service";

const SERVICE_STATE_ROUTE = "/api/caring-contacts/service-state";

const FULL_BANNER_SELECTOR = "#caring-contacts-service-stop-banner";
const CONDENSED_BAR_SELECTOR = "#caring-contacts-condensed-service-stop";
const WORKSPACE_HEADER_SELECTOR = "#caring-contacts-workspace-header";

/**
 * Raises the service-wide stop through the real HTTP boundary — the only route
 * to a stopped service that does not put a test-only hook into production code.
 *
 * `service-already-stopped` is accepted rather than treated as a failure: the
 * first record of an incident is permanent by design, so a second run of this
 * spec against a still-running server finds the same arranged condition it
 * asked for. Any other refusal is a real failure and is surfaced with its reason.
 */
async function arrangeServiceStop(page: Page) {
  const response = await page.request.post(SERVICE_STATE_ROUTE, {
    data: {
      type: "stop",
      reason: "wrong-recipient",
      note: "Browser proof of the condensed service-stop bar. Synthetic prototype; nothing was sent.",
      idempotencyKey: "ui-condensed-service-stop-bar",
    },
  });
  if (response.status() !== 200) {
    const refusal = (await response.json()) as { refusal?: string };
    expect(refusal.refusal, `could not arrange a stopped service (HTTP ${response.status()})`).toBe(
      "service-already-stopped",
    );
  }

  const state = (await (await page.request.get(SERVICE_STATE_ROUTE)).json()) as { stopped?: boolean };
  expect(state.stopped, "the service-state route does not report a stopped service").toBe(true);
}

/**
 * Every statement of the stopped state that is actually ON SCREEN, with its box.
 *
 * "On screen" is not `toBeVisible()`. Playwright counts an element with a box as
 * visible even when it has scrolled far above the viewport — which is exactly
 * the defect being fixed, so it would report the broken page as fine. On screen
 * here means: displayed, and overlapping the region below the sticky header,
 * which is the only region a reader can see.
 */
function statementsOnScreen(page: Page) {
  return page.evaluate(
    ({ full, condensed, header, label }) => {
      const headerBottom = document.querySelector(header)?.getBoundingClientRect().bottom ?? 0;
      const viewportBottom = window.innerHeight;
      return [full, condensed]
        .map((selector) => ({ selector, node: document.querySelector(selector) }))
        .filter(({ node }) => node !== null && getComputedStyle(node).display !== "none")
        .map(({ selector, node }) => ({ selector, rect: node!.getBoundingClientRect(), text: node!.textContent ?? "" }))
        .filter(({ rect }) => Math.min(rect.bottom, viewportBottom) - Math.max(rect.top, headerBottom) > 0)
        .filter(({ text }) => text.includes(label))
        .map(({ selector, rect, text }) => ({
          selector,
          text,
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
        }));
    },
    {
      full: FULL_BANNER_SELECTOR,
      condensed: CONDENSED_BAR_SELECTOR,
      header: WORKSPACE_HEADER_SELECTOR,
      label: STOPPED_STATE_LABEL,
    },
  );
}

/** Scrolls the document and lets the watcher's one-read-per-frame land. */
async function scrollDocumentTo(page: Page, offset: number) {
  await page.evaluate((y) => window.scrollTo(0, y), offset);
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
}

function maxScrollOffset(page: Page) {
  return page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
}

/**
 * The viewport height these tests use, and the whole reason they are not vacuous.
 *
 * Fix round 1, finding 1. At the frozen 900px review height this page cannot scroll at all at
 * 1024 and 1440 — measured `scrollHeight` 900, `innerHeight` 900, **`maxScroll` 0** — so the
 * sampled offsets were all filtered away by `maxOffset` and the only surviving sample was the
 * at-rest one. Both widths therefore asserted the pre-existing banner behaviour and said nothing
 * whatever about the handover, while reading as though they covered it. That is worse than an
 * uncovered width, because it looks covered.
 *
 * At 500px every review width has room to push the banner past the header. Measured without the
 * banner (it adds its own height to the document on top of these): `maxScroll` 838 / 790 / 744 /
 * 571 / 286 / 286 at 320 / 390 / 430 / 768 / 1024 / 1440, against a banner that has to travel its
 * own height — roughly 250px at 320 and less as the text stops wrapping.
 *
 * A short window is not a contrivance: 1440x500 is an ordinary half-height desktop window, and it
 * is exactly where a stop scrolling away hurts. Nothing branches on page height any more — the
 * handover is ASSERTED at every width, so a page that grows or shrinks under this test reddens it
 * rather than quietly emptying it.
 */
const STOP_HANDOVER_VIEWPORT_HEIGHT = 500;

test.describe("caring-contacts service stop, stated on every screen", () => {
  for (const width of REVIEW_WIDTHS) {
    test(`keeps the stop stated exactly once at every scroll position at ${width}px`, async ({ page }) => {
      await arrangeServiceStop(page);
      await openWorkspace(page, width, STOP_HANDOVER_VIEWPORT_HEIGHT);

      // The page renders the arrangement at all: without this, a store the page
      // cannot see would leave every assertion below trivially satisfied by a
      // page that simply never mentions a stop.
      await expect(page.locator(FULL_BANNER_SELECTOR)).toHaveCount(1);
      await expect(page.locator(CONDENSED_BAR_SELECTOR)).toHaveCount(1);

      // At rest the full banner owns the statement and the condensed bar is not
      // displayed at all — two statements of one stop is the failure mode here.
      await scrollDocumentTo(page, 0);
      expect(await statementsOnScreen(page), `statements at rest at ${width}px`).toMatchObject([
        { selector: FULL_BANNER_SELECTOR },
      ]);
      await expect(page.locator(CONDENSED_BAR_SELECTOR)).toBeHidden();

      // Then across the whole scroll range. Sampling rather than asserting only
      // the ends is what covers the handover: the banner leaving and the bar
      // arriving are one exchange, and a gap or an overlap in it would be a
      // moment with no statement, or with two.
      const maxOffset = await maxScrollOffset(page);
      // The range must be big enough to carry the banner past the header, or every
      // sample below lands where the banner is still on screen and the loop asserts
      // the behaviour that already existed. That is precisely what happened at 1024
      // and 1440 in round 1.
      const bannerTravel = await page.evaluate(
        ({ full, header }) =>
          document.querySelector(full)!.getBoundingClientRect().bottom -
          document.querySelector(header)!.getBoundingClientRect().bottom,
        { full: FULL_BANNER_SELECTOR, header: WORKSPACE_HEADER_SELECTOR },
      );
      expect(
        maxOffset,
        `no room to scroll the banner away at ${width}px — this test would prove nothing`,
      ).toBeGreaterThan(bannerTravel);

      const offsets = [40, 80, 120, 200, 320, 480, maxOffset].filter((offset) => offset <= maxOffset);
      for (const offset of offsets) {
        await scrollDocumentTo(page, offset);
        const statements = await statementsOnScreen(page);
        expect(statements, `statements at scroll ${offset} at ${width}px`).toHaveLength(1);
        expect(statements[0]!.text, `the statement at scroll ${offset} at ${width}px drops its scope`).toContain(
          STOPPED_SCOPE_WORDING,
        );
      }

      // …and at the bottom the statement is the CONDENSED BAR, not the banner. Without
      // this the loop could be satisfied end to end by a banner that never left, which
      // is the degenerate pass round 1 shipped.
      expect(
        (await statementsOnScreen(page))[0]!.selector,
        `the banner, not the condensed bar, is still the statement at the bottom at ${width}px`,
      ).toBe(CONDENSED_BAR_SELECTOR);
    });
  }

  for (const width of REVIEW_WIDTHS) {
    test(`pins the condensed bar under the header once the banner has gone at ${width}px`, async ({ page }) => {
      await arrangeServiceStop(page);
      await openWorkspace(page, width, STOP_HANDOVER_VIEWPORT_HEIGHT);
      await scrollDocumentTo(page, await maxScrollOffset(page));

      const geometry = await page.evaluate(
        ({ full, condensed, header, dock }) => {
          const box = (selector: string) => {
            const node = document.querySelector(selector);
            if (!node) return null;
            const rect = node.getBoundingClientRect();
            return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, height: rect.height };
          };
          const bar = document.querySelector(condensed);
          const displayed = bar ? getComputedStyle(bar).display !== "none" : false;
          const barRect = bar?.getBoundingClientRect();
          // What a reader's eye would actually meet at the bar's centre. Nothing
          // may be painted over it — not the header, not the page content.
          const covering =
            displayed && barRect
              ? document.elementFromPoint(barRect.left + barRect.width / 2, barRect.top + barRect.height / 2)
              : null;
          return {
            bannerBox: box(full),
            barBox: box(condensed),
            headerBox: box(header),
            dockBox: box(dock),
            viewportHeight: window.innerHeight,
            overflow: document.documentElement.scrollWidth - window.innerWidth,
            barIsTopmostAtItsCentre: covering ? covering.closest(condensed) !== null : false,
            barDisplayed: displayed,
          };
        },
        {
          full: FULL_BANNER_SELECTOR,
          condensed: CONDENSED_BAR_SELECTOR,
          header: WORKSPACE_HEADER_SELECTOR,
          dock: "[data-testid='caring-contacts-phone-dock']",
        },
      );

      // Fix round 1, finding 1: no branch. Round 1 skipped this test's real work whenever
      // the page was too short for the banner to leave, which at the frozen 900px height was
      // ALWAYS true at 1024 and 1440 — so the two widths where Phase 2B will add content were
      // the two widths the pin was never measured at. The short viewport above guarantees the
      // room; this asserts the banner actually used it, so the test can no longer opt itself out.
      expect(
        geometry.bannerBox!.bottom,
        `the banner is still on screen at ${width}px — nothing about the handover is being measured`,
      ).toBeLessThanOrEqual(geometry.headerBox!.bottom);

      expect(geometry.barDisplayed, `the condensed bar did not appear at ${width}px`).toBe(true);
      // Under the header, not behind it. The header measures 87.5px at 320 and
      // 390 and 65px above that, against a 64px --header-h token, so a bar
      // pinned by that token would have been buried at every width.
      expect(geometry.barBox!.top, `the condensed bar is behind the header at ${width}px`).toBeGreaterThanOrEqual(
        geometry.headerBox!.bottom - 1,
      );
      expect(geometry.barBox!.bottom, `the condensed bar is off screen at ${width}px`).toBeLessThanOrEqual(
        geometry.viewportHeight,
      );
      expect(geometry.barIsTopmostAtItsCentre, `something is painted over the condensed bar at ${width}px`).toBe(true);
      // It spans the header rather than sitting inside the header's padding.
      expect(Math.round(geometry.barBox!.left), `condensed bar left edge at ${width}px`).toBe(
        Math.round(geometry.headerBox!.left),
      );
      expect(Math.round(geometry.barBox!.right), `condensed bar right edge at ${width}px`).toBe(
        Math.round(geometry.headerBox!.right),
      );
      // A pinned bar is exactly where a stray z-index buries the phone dock.
      if (geometry.dockBox && geometry.dockBox.height > 0) {
        expect(geometry.barBox!.bottom, `the condensed bar reaches the phone dock at ${width}px`).toBeLessThanOrEqual(
          geometry.dockBox.top,
        );
      }
      expect(geometry.overflow, `horizontal overflow with the condensed bar shown at ${width}px`).toBeLessThanOrEqual(
        2,
      );
    });
  }

  /** The bar's own resolved appearance, read once the handover has happened. */
  async function condensedBarAppearance(page: Page) {
    await scrollDocumentTo(page, await maxScrollOffset(page));
    return page.evaluate((selector) => {
      const node = document.querySelector(selector)!;
      const style = getComputedStyle(node);
      return { display: style.display, colour: style.color, surface: style.backgroundColor };
    }, CONDENSED_BAR_SELECTOR);
  }

  test("re-resolves the condensed bar's own colours in dark rather than leaking a light value", async ({ page }) => {
    await arrangeServiceStop(page);

    await page.emulateMedia({ colorScheme: "light" });
    await openWorkspace(page, 390, STOP_HANDOVER_VIEWPORT_HEIGHT);
    const light = await condensedBarAppearance(page);

    await page.emulateMedia({ colorScheme: "dark" });
    await openWorkspace(page, 390, STOP_HANDOVER_VIEWPORT_HEIGHT);
    const dark = await condensedBarAppearance(page);

    expect(dark.display, "the condensed bar is not shown in dark").not.toBe("none");
    // Fix round 1, finding 3. The round-1 form of this compared each value against
    // `rgba(0, 0, 0, 0)`, which almost nothing resolves to — it passed for any colour at
    // all, including a hardcoded one that never changes theme, which is the exact defect a
    // dark-mode check exists to catch. Comparing the two schemes against EACH OTHER has
    // discriminating power: swapping `--danger-text` for a token whose value is identical
    // in both themes reddens this and would have sailed through the old assertion.
    expect(dark.colour, "the condensed bar's ink did not change in dark").not.toBe(light.colour);
    expect(dark.surface, "the condensed bar's surface did not change in dark").not.toBe(light.surface);
    await page.emulateMedia({ colorScheme: "light" });
  });

  test("states the stop in words once forced colours have dropped the tint", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "forced-colors emulation is Chromium-only");
    await arrangeServiceStop(page);

    await page.emulateMedia({ forcedColors: "active" });
    await openWorkspace(page, 390, STOP_HANDOVER_VIEWPORT_HEIGHT);
    await scrollDocumentTo(page, await maxScrollOffset(page));
    // Forced colours drop the author's tint, so the words are all that is left
    // to carry the state. This is the assertion that makes the bar independent
    // of colour rather than merely accompanied by an icon.
    const forced = await statementsOnScreen(page);
    expect(forced, "the stop is not stated under forced colours").toHaveLength(1);
    expect(forced[0]!.text).toContain(STOPPED_STATE_LABEL);
    expect(forced[0]!.text).toContain(STOPPED_SCOPE_WORDING);
    expect(await documentOverflow(page), "horizontal overflow under forced colours").toBeLessThanOrEqual(2);
  });
});
