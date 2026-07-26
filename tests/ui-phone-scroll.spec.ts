import { expect, test, type Page } from "playwright/test";

/**
 * Phone scroll-geometry guardrail (the #964 regression class).
 *
 * Hiding the phone chrome (header grid collapse + dock reserve-pad shrink)
 * releases layout back into the #main-content scrollport. When that release
 * exceeds the page's remaining scroll runway, the offset clamps onto the new
 * bottom edge and any small upward drag snaps the geometry back — a
 * hide/reveal oscillation that reads as "scroll locks to the bottom" plus a
 * blank band below the content. use-hide-on-scroll's collapse-budget gate
 * refuses such hides; this spec sweeps every phone surface and asserts the
 * scroll geometry stays stable at the bottom edge.
 *
 * IMPORTANT: the suite-wide default emulates `reducedMotion: reduce`, which
 * disables the very padding/grid transitions that produce this failure mode —
 * it is exactly how #964 shipped green. Every test here re-enables motion via
 * page.emulateMedia({ reducedMotion: "no-preference" }).
 */

// Standalone mode homes share GlobalSearchShell's phone scroller. They keep the
// in-flow hero pill on phones (the composer sits in the hero and scrolls with the
// content — no bottom dock), while the sticky header still collapses on scroll;
// this sweep guards that the scroll geometry stays stable through that collapse.
// (list mirrors isStandaloneModeHomePath in search-route-ownership.ts).
const modeHomeRoutes = [
  "/formulation",
  "/dsm",
  "/tools",
  "/differentials",
  "/specifiers",
  "/factsheets",
  "/therapy-compass",
  "/services",
  "/forms",
  "/favourites",
];

// ClinicalDashboard scroller (answer home keeps the in-flow hero pill; the
// other modes dock the compact composer) plus representative long pages.
const dashboardRoutes = ["/?mode=answer", "/?mode=documents", "/?mode=prescribing"];
const longRoutes = [
  "/formulation/worry",
  "/formulation/builder?mechanism=rumination&template=5Ps",
  "/documents/search",
  // Demo-corpus document detail: DocumentViewer owns its composer here, and its
  // scroll container binding has its own failure mode (stale #main-content).
  "/documents/11111111-1111-4111-8111-111111111111?page=1",
];

const phoneViewport = { width: 390, height: 844 };

async function blockExternalRequests(page: Page) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)
    ) {
      await route.abort("blockedbyclient");
      return;
    }
    await route.fallback();
  });
}

async function gotoPhoneSurface(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#main-content").first()).toBeVisible({ timeout: 15_000 });
  // Simulate installed-PWA safe-area insets (the repo routes env() through
  // these vars precisely so Chromium tests can exercise them).
  await page.addStyleTag({
    content: ":root{--safe-area-top:59px !important;--safe-area-bottom:34px !important;}",
  });
  // Let hydration, fonts, and the composer/portal layout settle.
  await page.waitForTimeout(700);
}

interface ScrollGeometry {
  scrollTop: number;
  maxOffset: number;
  headerHidden: boolean;
  bottomComposerHidden: boolean;
  docScrollableExcess: number;
  horizontalOverflow: number;
  reserveTransitionDuration: string;
}

function readGeometry(page: Page): Promise<ScrollGeometry> {
  return page.evaluate(() => {
    const main = document.getElementById("main-content");
    const header = document.querySelector('[data-testid="universal-header-collapse"]');
    const doc = document.documentElement;
    const reserveHost = main?.querySelector<HTMLElement>('[data-testid="mobile-composer-reserve-pad"]') ?? main;
    return {
      scrollTop: main?.scrollTop ?? 0,
      maxOffset: main ? Math.max(0, main.scrollHeight - main.clientHeight) : 0,
      headerHidden: header?.getAttribute("data-scroll-hidden") === "true",
      bottomComposerHidden: main?.getAttribute("data-bottom-composer-hidden") === "true",
      docScrollableExcess: doc.scrollHeight - doc.clientHeight,
      horizontalOverflow: Math.max(doc.scrollWidth, document.body?.scrollWidth ?? 0) - window.innerWidth,
      reserveTransitionDuration: reserveHost ? getComputedStyle(reserveHost).transitionDuration : "",
    };
  });
}

/** Counts phone-chrome hide/reveal flips (header collapse + composer dock). */
async function installFlipCounter(page: Page) {
  await page.evaluate(() => {
    const counter = { flips: 0 };
    (window as unknown as { __scrollFlipCounter: typeof counter }).__scrollFlipCounter = counter;
    // Collapse hosts flip data-scroll-hidden on the grid wrapper; overlay
    // hosts (the answer home's glass bar) flip it on header#search itself.
    const header =
      document.querySelector('[data-testid="universal-header-collapse"]') ?? document.querySelector("header#search");
    // Fail loudly: returning early would leave the counter pinned at 0, so
    // every flip assertion would pass vacuously.
    if (!header) throw new Error("installFlipCounter: no scroll-hide chrome element found");
    new MutationObserver(() => {
      counter.flips += 1;
    }).observe(header, { attributes: true, attributeFilter: ["data-scroll-hidden"] });
  });
}

function readFlipCount(page: Page): Promise<number> {
  return page.evaluate(
    () => (window as unknown as { __scrollFlipCounter?: { flips: number } }).__scrollFlipCounter?.flips ?? 0,
  );
}

/**
 * Drags the phone scroller in deliberate steps (one per frame) so the scroll
 * state machine sees real directional intent — a single programmatic jump
 * models neither a touch drag nor iOS momentum.
 */
async function dragScrollBy(page: Page, totalPx: number, stepPx: number) {
  await page.evaluate(
    async ({ total, step }) => {
      const main = document.getElementById("main-content");
      if (!main) return;
      const steps = Math.max(1, Math.ceil(Math.abs(total) / step));
      const direction = total < 0 ? -1 : 1;
      for (let i = 0; i < steps; i += 1) {
        main.scrollTop += direction * step;
        main.dispatchEvent(new Event("scroll", { bubbles: true }));
        await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
      }
    },
    { total: totalPx, step: stepPx },
  );
}

test.beforeEach(async ({ page }) => {
  await blockExternalRequests(page);
});

test("phone chrome has an opaque header, one edge-to-edge footer, and releases both edges when hidden", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize(phoneViewport);
  // A submitted Forms search is a stable GlobalSearchShell result surface: it
  // renders the compact bottom dock and has enough content to exercise the
  // shared header/footer hide signal. Its legacy backdrop remains optional;
  // when present, the phone paint contract requires CSS to hide it.
  await gotoPhoneSurface(page, "/forms?q=Form&run=1&focus=1");
  await expect(page.locator("form.answer-footer-search-dock")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("global-search-input")).not.toBeFocused({ timeout: 5_000 });

  const visible = await page.evaluate(() => {
    const header = document.querySelector<HTMLElement>("header#search");
    const headerBackdrop = document.querySelector<HTMLElement>(".edge-glass-header-backdrop");
    const dock = document.querySelector<HTMLElement>(".answer-footer-search-dock");
    const dockBackdrop = dock?.querySelector<HTMLElement>(".answer-footer-search-backdrop");
    const pill = dock?.querySelector<HTMLElement>(".answer-footer-search-pill");
    const dockRect = dock?.getBoundingClientRect();
    return {
      headerBackground: header ? getComputedStyle(header).backgroundColor : "",
      headerBackdropFilter: header ? getComputedStyle(header).backdropFilter : "",
      headerBackdropDisplay: headerBackdrop ? getComputedStyle(headerBackdrop).display : "missing",
      dockBackdropDisplay: dockBackdrop ? getComputedStyle(dockBackdrop).display : "missing",
      dockLeft: dockRect?.left ?? -1,
      dockRight: dockRect?.right ?? -1,
      dockBottom: dockRect?.bottom ?? -1,
      pillBackground: pill ? getComputedStyle(pill).backgroundColor : "",
    };
  });

  expect(visible.headerBackground).toMatch(/^rgb\(/);
  expect(visible.headerBackdropFilter).toBe("none");
  expect(visible.headerBackdropDisplay).toBe("none");
  expect(["missing", "none"]).toContain(visible.dockBackdropDisplay);
  expect(visible.dockLeft).toBeCloseTo(0, 0);
  expect(visible.dockRight).toBeCloseTo(phoneViewport.width, 0);
  expect(visible.dockBottom).toBeCloseTo(phoneViewport.height, 0);
  expect(visible.pillBackground).toMatch(/(?:^rgba\([^)]+,\s*0\.92\)|\/ 0\.92\))/);

  const geometry = await readGeometry(page);
  await dragScrollBy(page, Math.min(geometry.maxOffset, 500), 24);
  await expect(page.getByTestId("universal-header-collapse")).toHaveAttribute("data-scroll-hidden", "true");
  await expect(page.locator(".answer-footer-search-dock")).toHaveAttribute("data-scroll-hidden", "true");

  const hidden = await page.evaluate(() => {
    const collapse = document.querySelector<HTMLElement>('[data-testid="universal-header-collapse"]');
    const dock = document.querySelector<HTMLElement>(".answer-footer-search-dock");
    const main = document.getElementById("main-content");
    return {
      collapseHeight: collapse?.getBoundingClientRect().height ?? -1,
      dockTop: dock?.getBoundingClientRect().top ?? -1,
      reserve: main ? getComputedStyle(main).getPropertyValue("--mobile-composer-reserve").trim() : "",
    };
  });
  expect(hidden.collapseHeight).toBeLessThanOrEqual(1);
  expect(hidden.dockTop).toBeGreaterThanOrEqual(phoneViewport.height - 1);
  expect(hidden.reserve).toBe("0rem");
});

for (const route of [...modeHomeRoutes, ...dashboardRoutes, ...longRoutes]) {
  test(`phone scroll stays smooth and bottom-stable on ${route}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize(phoneViewport);
    await gotoPhoneSurface(page, route);
    await installFlipCounter(page);

    const initial = await readGeometry(page);
    // The document must never be the phone scroller (#main-content owns it),
    // and no route may overflow horizontally.
    expect(initial.docScrollableExcess, "document must not scroll on phone").toBeLessThanOrEqual(2);
    expect(initial.horizontalOverflow, "no horizontal overflow").toBeLessThanOrEqual(2);
    expect(initial.scrollTop).toBe(0);
    expect(initial.headerHidden, "header visible at the top").toBe(false);
    // Mode/route reserve flips snap (0s). Padding only animates while
    // data-bottom-composer-hidden="true" (scroll-hide), asserted below.
    expect(initial.reserveTransitionDuration, "visible reserve must snap on mode/route flips").toBe("0s");

    // Drag to the bottom in deliberate 24px steps, then let transitions settle.
    await dragScrollBy(page, initial.maxOffset + 400, 24);
    await page.waitForTimeout(500);
    const flipsAfterDescent = await readFlipCount(page);
    const atBottom = await readGeometry(page);

    // No dead band: the settled position sits on the real bottom edge of the
    // settled geometry (this is what "locks to the bottom" violated — the
    // offset was pinned to a phantom bottom short of the content).
    expect(
      Math.abs(atBottom.scrollTop - atBottom.maxOffset),
      "settled scroll sits on the true bottom edge",
    ).toBeLessThanOrEqual(2);
    if (atBottom.bottomComposerHidden) {
      expect(atBottom.reserveTransitionDuration, "scroll-hide reserve transition remains exercised").toContain(
        "0.24s",
      );
    }
    // At most one chrome transition on a pure descent (hide, when the page is
    // long enough to afford it) — more means hide/reveal oscillation.
    expect(flipsAfterDescent, "no chrome oscillation while scrolling down").toBeLessThanOrEqual(1);

    // Oscillation check: geometry must be quiet AFTER settling — no further
    // flips while the user holds still at the bottom.
    await page.waitForTimeout(400);
    expect(await readFlipCount(page), "no chrome flips while resting at the bottom").toBe(flipsAfterDescent);

    // Small deliberate nudges AT the bottom edge are the oscillation trigger:
    // pre-fix, a 32px up-drag revealed the chrome (restoring ~180px of
    // geometry under the finger), the next down-drag re-hid it, and so on —
    // the "locks to the bottom" thrash. The collapse-budget gate permits at
    // most the one legitimate reveal here and refuses to re-hide with no
    // runway left, so the whole nudge cycle allows a single flip.
    for (const nudge of [-32, 48, -32]) {
      await dragScrollBy(page, nudge, 8);
      await page.waitForTimeout(350);
    }
    const flipsAfterNudges = await readFlipCount(page);
    expect(flipsAfterNudges - flipsAfterDescent, "bottom-edge nudges must not thrash the chrome").toBeLessThanOrEqual(
      1,
    );
    await page.waitForTimeout(400);
    expect(await readFlipCount(page), "no chrome flips after the nudges settle").toBe(flipsAfterNudges);

    // Top must be reachable with the header visible again.
    await dragScrollBy(page, -(atBottom.maxOffset + 800), 48);
    await page.waitForTimeout(500);
    const backAtTop = await readGeometry(page);
    expect(backAtTop.scrollTop, "top reachable after the round trip").toBe(0);
    expect(backAtTop.headerHidden, "header visible back at the top").toBe(false);
    expect(backAtTop.horizontalOverflow).toBeLessThanOrEqual(2);
  });
}

// One larger-phone pass over the worst offender to catch viewport-dependent
// regressions (the 390x844 sweep above is the canonical size).
test("phone scroll stays smooth on /formulation at 430x932", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 430, height: 932 });
  await gotoPhoneSurface(page, "/formulation");
  await installFlipCounter(page);

  const initial = await readGeometry(page);
  expect(initial.docScrollableExcess).toBeLessThanOrEqual(2);

  await dragScrollBy(page, initial.maxOffset + 400, 24);
  await page.waitForTimeout(500);
  const atBottom = await readGeometry(page);
  expect(Math.abs(atBottom.scrollTop - atBottom.maxOffset)).toBeLessThanOrEqual(2);
  expect(await readFlipCount(page)).toBeLessThanOrEqual(1);
});

/**
 * Forms/services search used to keep focus=1 after submit. Composer focus
 * pins both chrome edges, so neither header nor the bottom dock (white
 * safe-area rail) could hide while scrolling results.
 */
test("phone forms search hides header and footer after submit without stale focus", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize(phoneViewport);
  await gotoPhoneSurface(page, "/forms?q=Form&run=1&focus=1");
  await expect(page.locator("form.answer-footer-search-dock")).toBeVisible({ timeout: 20_000 });

  // Stale focus=1 on a submitted result view must not win — the shell blurs.
  const input = page.getByTestId("global-search-input");
  await expect(input).not.toBeFocused({ timeout: 5_000 });

  const initial = await readGeometry(page);
  expect(initial.headerHidden, "header visible at the top").toBe(false);

  await dragScrollBy(page, Math.min(Math.max(initial.maxOffset, 240), 800), 24);
  await page.waitForTimeout(500);

  const afterHide = await page.evaluate(() => {
    const collapse = document.querySelector<HTMLElement>('[data-testid="universal-header-collapse"]');
    const dock = document.querySelector<HTMLElement>("form.answer-footer-search-dock");
    const reserve = document.querySelector<HTMLElement>('[data-testid="mobile-composer-reserve-pad"]');
    const dockRect = dock?.getBoundingClientRect();
    return {
      headerHidden: collapse?.getAttribute("data-scroll-hidden") === "true",
      dockHidden: dock?.getAttribute("data-scroll-hidden") === "true",
      reservePb: reserve ? getComputedStyle(reserve).paddingBottom : "",
      dockTop: dockRect?.top ?? -1,
      viewportHeight: window.innerHeight,
      inputFocused: document.activeElement?.getAttribute("data-testid") === "global-search-input",
    };
  });

  expect(afterHide.inputFocused, "scroll must not leave the dock focused").toBe(false);
  expect(afterHide.headerHidden, "header hides on forms result scroll").toBe(true);
  expect(afterHide.dockHidden, "footer dock hides on forms result scroll").toBe(true);
  expect(afterHide.dockTop, "hidden dock clears the viewport bottom").toBeGreaterThanOrEqual(
    afterHide.viewportHeight - 1,
  );
  expect(Number.parseFloat(afterHide.reservePb) || 0, "hidden reserve releases the bottom rail").toBeLessThanOrEqual(1);
});

/**
 * Status-bar safe-area guard: collapsing the phone header must reclaim the
 * chrome controls, never the OS top inset. Without the always-on
 * `chrome-safe-area-top` spacer, service-detail text painted under the
 * system clock/signal icons after a deliberate scroll-hide.
 */
test("phone service detail keeps content below the status-bar inset after header hide", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize(phoneViewport);
  await gotoPhoneSurface(page, "/services/13yarn");
  await expect(page.getByTestId("service-detail-page")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("chrome-safe-area-top")).toBeVisible();

  const initial = await readGeometry(page);
  expect(initial.headerHidden, "header visible at the top").toBe(false);

  await dragScrollBy(page, Math.max(initial.maxOffset, 240), 24);
  await page.waitForTimeout(500);

  const afterHide = await page.evaluate(() => {
    const safeArea = document.querySelector<HTMLElement>('[data-testid="chrome-safe-area-top"]');
    const collapse = document.querySelector<HTMLElement>('[data-testid="universal-header-collapse"]');
    const main = document.getElementById("main-content");
    const servicePage = document.querySelector<HTMLElement>('[data-testid="service-detail-page"]');
    const safeRect = safeArea?.getBoundingClientRect();
    const mainRect = main?.getBoundingClientRect();
    const rootStyles = getComputedStyle(document.documentElement);
    const safeAreaTopPx = Number.parseFloat(rootStyles.getPropertyValue("--safe-area-top")) || 0;
    // Geometry proof (not hit-testing): service cards may sit above the main
    // box in document coordinates after scroll, but their visible paint is
    // clipped to #main-content, which must start at/below the safe-area band.
    const visibleServiceTop = servicePage ? Math.max(servicePage.getBoundingClientRect().top, mainRect?.top ?? 0) : -1;
    return {
      headerHidden: collapse?.getAttribute("data-scroll-hidden") === "true",
      safeAreaHeight: safeRect?.height ?? 0,
      safeAreaTop: safeRect?.top ?? -1,
      mainTop: mainRect?.top ?? -1,
      visibleServiceTop,
      safeAreaTopPx,
      safeAreaZ: safeArea ? getComputedStyle(safeArea).zIndex : "",
    };
  });

  expect(afterHide.headerHidden, "header collapses after a deliberate descent").toBe(true);
  expect(afterHide.safeAreaHeight, "safe-area spacer keeps the status-bar band").toBeGreaterThanOrEqual(
    afterHide.safeAreaTopPx - 1,
  );
  expect(afterHide.safeAreaTop, "safe-area spacer stays pinned to the viewport top").toBeLessThanOrEqual(1);
  expect(afterHide.mainTop, "scrollport starts below the status-bar inset").toBeGreaterThanOrEqual(
    afterHide.safeAreaTopPx - 1,
  );
  expect(afterHide.visibleServiceTop, "service content stays below the status-bar inset").toBeGreaterThanOrEqual(
    afterHide.safeAreaTopPx - 1,
  );
  expect(
    Number.parseInt(afterHide.safeAreaZ, 10),
    "safe-area spacer stacks above collapsing chrome",
  ).toBeGreaterThanOrEqual(32);
});
