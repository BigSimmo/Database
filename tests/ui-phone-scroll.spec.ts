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

const appModeHeaderRoutes = [
  { mode: "Answer", route: "/?mode=answer" },
  { mode: "Documents", route: "/?mode=documents" },
  { mode: "Services", route: "/services" },
  { mode: "Forms", route: "/forms" },
  { mode: "Favourites", route: "/favourites" },
  { mode: "Differentials", route: "/differentials" },
  { mode: "DSM", route: "/dsm" },
  { mode: "Specifiers", route: "/specifiers" },
  { mode: "Formulation", route: "/formulation" },
  { mode: "Medication", route: "/?mode=prescribing" },
  { mode: "Tools", route: "/tools" },
  { mode: "Therapy", route: "/therapy-compass" },
  { mode: "Factsheets", route: "/factsheets" },
];

const pageOwnedHeaderRoutes = [
  {
    name: "Therapy section navigation",
    route: "/therapy-compass/search?q=CBT&run=1",
    selector: '[data-testid="therapy-compass-section-nav"]',
  },
  {
    name: "document navigation",
    route: "/documents/11111111-1111-4111-8111-111111111111?page=1",
    selector: "header",
  },
  {
    name: "differential detail navigation",
    route: "/differentials/diagnoses/delirium",
    selector: '[data-testid="differential-detail-header"]',
  },
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

async function gotoPhoneSurface(page: Page, path: string, safeAreaBottom = 34) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#main-content").first()).toBeVisible({ timeout: 15_000 });
  // Simulate installed-PWA safe-area insets (the repo routes env() through
  // these vars precisely so Chromium tests can exercise them).
  await page.addStyleTag({
    content: `:root{--safe-area-top:59px !important;--safe-area-bottom:${safeAreaBottom}px !important;}`,
  });
  // Let hydration, fonts, and the composer/portal layout settle.
  await page.waitForTimeout(700);
}

async function addPhoneScrollRunway(page: Page) {
  await page.evaluate(() => {
    const main = document.getElementById("main-content");
    if (!main) throw new Error("addPhoneScrollRunway: #main-content was not rendered");
    const filler = document.createElement("div");
    filler.dataset.testid = "phone-header-scroll-runway";
    filler.setAttribute("aria-hidden", "true");
    filler.style.height = "1600px";
    filler.style.pointerEvents = "none";
    main.append(filler);
  });
  await page.waitForTimeout(50);
}

interface ScrollGeometry {
  scrollTop: number;
  maxOffset: number;
  headerHidden: boolean;
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

test("phone chrome keeps an opaque header and a soft-glass Services footer that fully releases when hidden", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize(phoneViewport);
  // A submitted Services search is a stable GlobalSearchShell result surface.
  // Its exaggerated bottom inset catches paint that only leaks through a notch.
  await gotoPhoneSurface(page, "/services?q=clinic&run=1&focus=1", 112);
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
      dockBackground: dock ? getComputedStyle(dock).backgroundColor : "",
      dockBackdropPosition: dockBackdrop ? getComputedStyle(dockBackdrop).position : "missing",
      dockBackdropPaint: dockBackdrop ? getComputedStyle(dockBackdrop).backgroundImage : "",
      dockBackdropFilter: dockBackdrop ? getComputedStyle(dockBackdrop).backdropFilter : "",
      dockBackdropPointerEvents: dockBackdrop ? getComputedStyle(dockBackdrop).pointerEvents : "",
      dockBackdropHasTranslucentStop: dockBackdrop
        ? /transparent|\/\s*(?:0?\.)\d+/.test(getComputedStyle(dockBackdrop).backgroundImage)
        : false,
      dockLeft: dockRect?.left ?? -1,
      dockRight: dockRect?.right ?? -1,
      dockBottom: dockRect?.bottom ?? -1,
      pillBackground: pill ? getComputedStyle(pill).backgroundColor : "",
    };
  });

  expect(visible.headerBackground).toMatch(/^rgb\(/);
  expect(visible.headerBackdropFilter).toBe("none");
  expect(visible.headerBackdropDisplay).toBe("none");
  expect(visible.dockBackground).toBe("rgba(0, 0, 0, 0)");
  expect(visible.dockBackdropDisplay).toBe("block");
  expect(visible.dockBackdropPosition).toBe("absolute");
  expect(visible.dockBackdropPaint).toContain("gradient");
  expect(visible.dockBackdropHasTranslucentStop).toBe(true);
  // The runner may emulate reduced transparency; the fallback deliberately
  // removes blur but keeps this translucent gradient instead of a solid slab.
  expect(["none", "blur(2px) saturate(1.3)"]).toContain(visible.dockBackdropFilter);
  expect(visible.dockBackdropPointerEvents).toBe("none");
  expect(visible.dockLeft).toBeCloseTo(0, 0);
  expect(visible.dockRight).toBeCloseTo(phoneViewport.width, 0);
  expect(visible.dockBottom).toBeCloseTo(phoneViewport.height, 0);
  expect(visible.pillBackground).toMatch(/(?:^rgba\([^)]+,\s*0\.92\)|\/ 0\.92\))/);

  const geometry = await readGeometry(page);
  await dragScrollBy(page, Math.min(geometry.maxOffset, 500), 24);
  await expect(page.getByTestId("universal-header-collapse")).toHaveAttribute("data-scroll-hidden", "true");
  await expect(page.locator(".answer-footer-search-dock")).toHaveAttribute("data-scroll-hidden", "true");
  await page.waitForTimeout(300);

  const hidden = await page.evaluate(() => {
    const collapse = document.querySelector<HTMLElement>('[data-testid="universal-header-collapse"]');
    const dock = document.querySelector<HTMLElement>(".answer-footer-search-dock");
    const backdrop = dock?.querySelector<HTMLElement>(".answer-footer-search-backdrop");
    const main = document.getElementById("main-content");
    return {
      collapseHeight: collapse?.getBoundingClientRect().height ?? -1,
      dockTop: dock?.getBoundingClientRect().top ?? -1,
      dockOpacity: dock ? getComputedStyle(dock).opacity : "",
      backdropTop: backdrop?.getBoundingClientRect().top ?? -1,
      reserve: main ? getComputedStyle(main).getPropertyValue("--mobile-composer-reserve").trim() : "",
    };
  });
  expect(hidden.collapseHeight).toBeLessThanOrEqual(1);
  expect(hidden.dockTop).toBeGreaterThanOrEqual(phoneViewport.height - 1);
  expect(hidden.dockOpacity).toBe("0");
  expect(hidden.backdropTop).toBeGreaterThanOrEqual(phoneViewport.height - 1);
  expect(hidden.reserve).toBe("0rem");
});

test("calculators page-owned phone dock uses localized glass and releases its reserve when hidden", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize(phoneViewport);
  await gotoPhoneSurface(page, "/calculators", 112);

  const dock = page.getByTestId("calculators-phone-dock");
  const pageSurface = page.getByTestId("calculators-search-page");
  await expect(dock).toBeVisible();

  const visible = await dock.evaluate((element) => {
    const backdrop = element.querySelector<HTMLElement>(".answer-footer-search-backdrop");
    const dockRect = element.getBoundingClientRect();
    const backdropStyle = backdrop ? getComputedStyle(backdrop) : null;
    return {
      background: getComputedStyle(element).backgroundColor,
      left: dockRect.left,
      right: dockRect.right,
      bottom: dockRect.bottom,
      backdropDisplay: backdropStyle?.display ?? "missing",
      backdropPosition: backdropStyle?.position ?? "missing",
      backdropPaint: backdropStyle?.backgroundImage ?? "",
      backdropHasTranslucentStop: /transparent|\/\s*(?:0?\.)\d+/.test(backdropStyle?.backgroundImage ?? ""),
    };
  });
  expect(visible.background).toBe("rgba(0, 0, 0, 0)");
  expect(visible.left).toBeCloseTo(0, 0);
  expect(visible.right).toBeCloseTo(phoneViewport.width, 0);
  expect(visible.bottom).toBeCloseTo(phoneViewport.height, 0);
  expect(visible.backdropDisplay).toBe("block");
  expect(visible.backdropPosition).toBe("absolute");
  expect(visible.backdropPaint).toContain("gradient");
  expect(visible.backdropHasTranslucentStop).toBe(true);
  await expect
    .poll(async () =>
      Number.parseFloat(await pageSurface.evaluate((element) => getComputedStyle(element).paddingBottom)),
    )
    .toBeGreaterThan(112);

  const geometry = await readGeometry(page);
  await dragScrollBy(page, Math.min(Math.max(geometry.maxOffset, 500), 900), 24);
  await expect(dock).toHaveAttribute("data-scroll-hidden", "true");
  await page.waitForTimeout(300);

  const hidden = await dock.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { opacity: getComputedStyle(element).opacity, top: rect.top, viewportHeight: window.innerHeight };
  });
  expect(hidden.opacity).toBe("0");
  expect(hidden.top).toBeGreaterThanOrEqual(hidden.viewportHeight - 1);
  await expect
    .poll(async () =>
      Number.parseFloat(await pageSurface.evaluate((element) => getComputedStyle(element).paddingBottom)),
    )
    .toBeLessThanOrEqual(1);

  await dragScrollBy(page, -48, 8);
  await expect(dock).not.toHaveAttribute("data-scroll-hidden", "true");
});

test("calculator combined chrome stays visible with only 96px of near-bottom runway", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize(phoneViewport);
  await gotoPhoneSurface(page, "/calculators", 112);
  await addPhoneScrollRunway(page);

  const frames = await page.evaluate(async () => {
    const main = document.getElementById("main-content");
    const dock = document.querySelector<HTMLElement>('[data-testid="calculators-phone-dock"]');
    const reserve = document.querySelector<HTMLElement>('[data-testid="calculators-search-page"]');
    if (!main || !dock || !reserve) throw new Error("calculator reserve geometry was not rendered");
    const read = () => ({
      dockHidden: dock.getAttribute("data-scroll-hidden") === "true",
      headerHidden:
        document.querySelector('[data-testid="universal-header-collapse"]')?.getAttribute("data-scroll-hidden") ===
        "true",
      scrollTop: main.scrollTop,
      maxOffset: main.scrollHeight - main.clientHeight,
    });
    const collapse = document.querySelector<HTMLElement>('[data-testid="universal-header-collapse"]');
    const safeArea = document.querySelector<HTMLElement>('[data-testid="chrome-safe-area-top"]');
    const collapseBudget =
      (collapse?.getBoundingClientRect().height ?? 0) +
      (safeArea?.getBoundingClientRect().height ?? 0) +
      Number.parseFloat(getComputedStyle(reserve).paddingBottom);
    // This is the historical regression boundary: a realistic down-gesture
    // with 96px remaining after the combined header, safe-area, and calculator
    // reserve release. The gate must decline both owners rather than allow a
    // later reserve transition to clamp the reader upward.
    main.scrollTop = Math.max(0, main.scrollHeight - main.clientHeight - collapseBudget - 96);
    main.dispatchEvent(new Event("scroll", { bubbles: true }));
    const frames = [read()];
    for (let index = 0; index < 18; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
      frames.push(read());
    }
    return frames;
  });

  expect(frames.every((frame) => !frame.headerHidden && !frame.dockHidden)).toBe(true);
  for (let index = 1; index < frames.length; index += 1) {
    expect(frames[index].scrollTop, "rejected near-bottom collapse cannot clamp scrollTop").toBeCloseTo(
      frames[0].scrollTop,
      0,
    );
    expect(frames[index].maxOffset, "rejected near-bottom collapse keeps the scroll range stable").toBeCloseTo(
      frames[0].maxOffset,
      0,
    );
  }
});

test("calculator reserve and dock hide and reveal monotonically with sufficient near-bottom runway", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize(phoneViewport);
  await gotoPhoneSurface(page, "/calculators", 112);
  await addPhoneScrollRunway(page);

  const frames = await page.evaluate(async () => {
    const main = document.getElementById("main-content");
    const dock = document.querySelector<HTMLElement>('[data-testid="calculators-phone-dock"]');
    const reserve = document.querySelector<HTMLElement>('[data-testid="calculators-search-page"]');
    if (!main || !dock || !reserve) throw new Error("calculator reserve geometry was not rendered");
    const read = () => ({
      hidden: dock.getAttribute("data-scroll-hidden") === "true",
      dockTop: dock.getBoundingClientRect().top,
      paddingBottom: Number.parseFloat(getComputedStyle(reserve).paddingBottom),
      scrollTop: main.scrollTop,
      scrollAnchor: getComputedStyle(main).overflowAnchor,
      transitionDuration: getComputedStyle(reserve).transitionDuration,
    });
    const collapse = document.querySelector<HTMLElement>('[data-testid="universal-header-collapse"]');
    const safeArea = document.querySelector<HTMLElement>('[data-testid="chrome-safe-area-top"]');
    const collapseBudget =
      (collapse?.getBoundingClientRect().height ?? 0) +
      (safeArea?.getBoundingClientRect().height ?? 0) +
      Number.parseFloat(getComputedStyle(reserve).paddingBottom);
    main.scrollTop = Math.max(0, main.scrollHeight - main.clientHeight - collapseBudget - 256);
    main.dispatchEvent(new Event("scroll", { bubbles: true }));
    const hiding = [read()];
    for (let index = 0; index < 18; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
      hiding.push(read());
    }
    main.scrollTop -= 12;
    main.dispatchEvent(new Event("scroll", { bubbles: true }));
    const reveal = [read()];
    for (let index = 0; index < 16; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
      reveal.push(read());
    }
    return { hiding, reveal };
  });

  const firstHidden = frames.hiding.findIndex((frame) => frame.hidden);
  expect(firstHidden, "sufficient-runway downward intent hides the calculator dock").toBeGreaterThan(-1);
  const hiding = frames.hiding.slice(firstHidden);
  expect(hiding.some((frame) => frame.transitionDuration.includes("0.24s"))).toBe(true);
  expect(
    hiding.some((frame) => frame.scrollAnchor === "none"),
    "page-owned reserve transition disables anchoring",
  ).toBe(true);
  for (let index = 1; index < hiding.length; index += 1) {
    expect(hiding[index].paddingBottom, "calculator reserve never reverses during hide").toBeLessThanOrEqual(
      hiding[index - 1].paddingBottom + 1,
    );
    expect(hiding[index].dockTop, "dock never reverses during hide").toBeGreaterThanOrEqual(
      hiding[index - 1].dockTop - 1,
    );
    expect(hiding[index].scrollTop, "scroll remains monotonic during hide").toBeGreaterThanOrEqual(
      hiding[index - 1].scrollTop - 1,
    );
  }
  const firstRevealed = frames.reveal.findIndex((frame) => !frame.hidden);
  expect(firstRevealed, "upward intent reveals the calculator dock").toBeGreaterThan(-1);
  const revealing = frames.reveal.slice(firstRevealed);
  for (let index = 1; index < revealing.length; index += 1) {
    expect(revealing[index].paddingBottom, "calculator reserve never reverses during reveal").toBeGreaterThanOrEqual(
      revealing[index - 1].paddingBottom - 1,
    );
    expect(revealing[index].dockTop, "dock never reverses during reveal").toBeLessThanOrEqual(
      revealing[index - 1].dockTop + 1,
    );
    expect(revealing[index].scrollTop, "scroll remains monotonic during reveal").toBeLessThanOrEqual(
      revealing[index - 1].scrollTop + 1,
    );
  }
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
    // Reserve padding only animates while the short-lived
    // data-reserve-transitioning marker is on (hide/reveal). Once settled,
    // transitionDuration returns to 0s — the 240ms rule is pinned in
    // clinical-dashboard-merge-artifacts / globals.css.
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

for (const { mode, route } of appModeHeaderRoutes) {
  test(`phone ${mode} mode releases the complete top edge without oscillation`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize(phoneViewport);
    await gotoPhoneSurface(page, route);
    await addPhoneScrollRunway(page);
    await installFlipCounter(page);

    const initial = await page.evaluate(() => {
      const collapse = document.querySelector<HTMLElement>('[data-testid="universal-header-collapse"]');
      const header = document.querySelector<HTMLElement>("header#search");
      const safeArea = document.querySelector<HTMLElement>('[data-testid="chrome-safe-area-top"]');
      const main = document.getElementById("main-content");
      const safeAreaTopPx = Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--safe-area-top"),
      );
      return {
        usesCollapse: Boolean(collapse),
        hidden: (collapse ?? header)?.getAttribute("data-scroll-hidden") === "true",
        safeAreaHeight: safeArea?.getBoundingClientRect().height ?? 0,
        safeAreaTopPx,
        mainTop: main?.getBoundingClientRect().top ?? -1,
      };
    });
    expect(initial.hidden, "header starts visible").toBe(false);
    if (initial.usesCollapse) {
      expect(initial.safeAreaHeight, "visible collapse header owns the top inset").toBeGreaterThanOrEqual(
        initial.safeAreaTopPx - 1,
      );
      expect(initial.mainTop, "visible collapse header remains in flow").toBeGreaterThan(initial.safeAreaTopPx);
    }

    await dragScrollBy(page, 720, 24);
    await page.waitForTimeout(500);

    const hidden = await page.evaluate(() => {
      const collapse = document.querySelector<HTMLElement>('[data-testid="universal-header-collapse"]');
      const header = document.querySelector<HTMLElement>("header#search");
      const safeArea = document.querySelector<HTMLElement>('[data-testid="chrome-safe-area-top"]');
      const main = document.getElementById("main-content");
      const mainRect = main?.getBoundingClientRect();
      return {
        usesCollapse: Boolean(collapse),
        hidden: (collapse ?? header)?.getAttribute("data-scroll-hidden") === "true",
        collapseHeight: collapse?.getBoundingClientRect().height ?? 0,
        safeAreaHeight: safeArea?.getBoundingClientRect().height ?? 0,
        headerBottom: header?.getBoundingClientRect().bottom ?? -1,
        mainTop: mainRect?.top ?? -1,
        mainLeft: mainRect?.left ?? -1,
        mainRight: mainRect?.right ?? -1,
        viewportWidth: window.innerWidth,
      };
    });
    expect(hidden.hidden, "one deliberate descent hides the header").toBe(true);
    if (hidden.usesCollapse) {
      expect(hidden.collapseHeight, "all collapsed header rows release their height").toBeLessThanOrEqual(1);
      expect(hidden.safeAreaHeight, "hidden header releases the top safe area").toBeLessThanOrEqual(1);
    } else {
      expect(hidden.headerBottom, "overlay header clears the viewport top").toBeLessThanOrEqual(1);
    }
    expect(hidden.mainTop, "content reaches the physical top edge").toBeLessThanOrEqual(1);
    expect(hidden.mainLeft, "content reaches the left edge").toBeCloseTo(0, 0);
    expect(hidden.mainRight, "content reaches the right edge").toBeCloseTo(hidden.viewportWidth, 0);
    expect(await readFlipCount(page), "descent produces one stable hide transition").toBe(1);

    await page.waitForTimeout(350);
    expect(await readFlipCount(page), "resting after hide cannot oscillate").toBe(1);

    await dragScrollBy(page, -48, 8);
    await page.waitForTimeout(500);
    const revealed = await page.evaluate(() => {
      const collapse = document.querySelector<HTMLElement>('[data-testid="universal-header-collapse"]');
      const header = document.querySelector<HTMLElement>("header#search");
      const safeArea = document.querySelector<HTMLElement>('[data-testid="chrome-safe-area-top"]');
      return {
        hidden: (collapse ?? header)?.getAttribute("data-scroll-hidden") === "true",
        safeAreaHeight: safeArea?.getBoundingClientRect().height ?? 0,
        safeAreaTopPx: Number.parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue("--safe-area-top"),
        ),
      };
    });
    expect(revealed.hidden, "one deliberate upward gesture reveals the header").toBe(false);
    if (hidden.usesCollapse) {
      expect(revealed.safeAreaHeight, "revealed header restores the top inset").toBeGreaterThanOrEqual(
        revealed.safeAreaTopPx - 1,
      );
    }
    expect(await readFlipCount(page), "hide and reveal remain a single symmetric cycle").toBe(2);
  });
}

for (const { name, route, selector } of pageOwnedHeaderRoutes) {
  test(`phone ${name} uses the universal collapse owner`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 320, height: 720 });
    await gotoPhoneSurface(page, route);

    const collapse = page.getByTestId("universal-header-collapse");
    const addon = page.getByTestId("header-collapse-addon");
    const pageHeader = page.locator(selector).first();
    await expect(pageHeader).toBeVisible({ timeout: 20_000 });
    await expect(
      addon.locator(selector).first(),
      "phone page header is portaled into the one collapse track",
    ).toBeVisible();
    const pageHeaderBox = await pageHeader.boundingBox();
    expect(pageHeaderBox).not.toBeNull();
    expect(pageHeaderBox!.x, "page header cannot overflow the viewport left edge").toBeGreaterThanOrEqual(0);
    expect(pageHeaderBox!.x + pageHeaderBox!.width, "page header cannot expand past the viewport").toBeLessThanOrEqual(
      320,
    );
    await addPhoneScrollRunway(page);

    await dragScrollBy(page, 720, 24);
    await page.waitForTimeout(500);

    await expect(collapse).toHaveAttribute("data-scroll-hidden", "true");
    expect(await collapse.evaluate((element) => element.getBoundingClientRect().height)).toBeLessThanOrEqual(1);
    expect(
      await page.getByTestId("chrome-safe-area-top").evaluate((element) => element.getBoundingClientRect().height),
    ).toBeLessThanOrEqual(1);
  });
}

test("phone portaled addon focus pins the universal collapse owner during scroll", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 320, height: 720 });
  await gotoPhoneSurface(page, "/differentials/diagnoses/delirium");

  const collapse = page.getByTestId("universal-header-collapse");
  const addon = page.getByTestId("header-collapse-addon");
  const backLink = addon.getByRole("link", { name: "Back to differentials" });
  await expect(backLink).toBeVisible({ timeout: 20_000 });
  await addPhoneScrollRunway(page);

  await backLink.focus();
  await expect(backLink).toBeFocused();
  await dragScrollBy(page, 720, 24);
  await page.waitForTimeout(500);

  await expect(backLink, "focused addon control keeps keyboard focus").toBeFocused();
  await expect(backLink, "focused addon control remains visible").toBeVisible();
  await expect(collapse, "focused portaled addon keeps the header visible").not.toHaveAttribute(
    "data-scroll-hidden",
    "true",
  );
  expect(await collapse.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThan(1);
  expect(
    await page.getByTestId("chrome-safe-area-top").evaluate((element) => element.getBoundingClientRect().height),
  ).toBeGreaterThan(1);
});

test("phone portaled addon focus clears when its focused control navigates away", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 320, height: 720 });
  await gotoPhoneSurface(page, "/differentials/diagnoses/delirium");

  const addon = page.getByTestId("header-collapse-addon");
  const backLink = addon.getByRole("link", { name: "Back to differentials" });
  await expect(backLink).toBeVisible({ timeout: 20_000 });
  await backLink.focus();
  await expect(backLink).toBeFocused();

  await backLink.press("Enter");
  await expect(page).toHaveURL(/\/differentials(?:$|\?)/, { timeout: 20_000 });
  await expect(page.getByTestId("differentials-home")).toBeVisible({ timeout: 20_000 });
  await addPhoneScrollRunway(page);

  await dragScrollBy(page, 720, 24);
  await page.waitForTimeout(500);

  await expect(
    page.getByTestId("universal-header-collapse"),
    "removed focused addon control cannot leave the shared header pinned",
  ).toHaveAttribute("data-scroll-hidden", "true");
});

test("phone header hide and reveal animate monotonically without a geometry jump", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize(phoneViewport);
  await gotoPhoneSurface(page, "/therapy-compass/search?q=CBT&run=1");
  await addPhoneScrollRunway(page);

  const hideFrames = await page.evaluate(async () => {
    const main = document.getElementById("main-content");
    const collapse = document.querySelector<HTMLElement>('[data-testid="universal-header-collapse"]');
    const safeArea = document.querySelector<HTMLElement>('[data-testid="chrome-safe-area-top"]');
    if (!main || !collapse || !safeArea) throw new Error("phone collapse geometry was not rendered");
    const frames: Array<{ hidden: boolean; chromeHeight: number; mainTop: number; scrollTop: number }> = [];
    for (let frame = 0; frame < 55; frame += 1) {
      if (frame < 20) {
        main.scrollTop += 8;
        main.dispatchEvent(new Event("scroll", { bubbles: true }));
      }
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
      frames.push({
        hidden: collapse.getAttribute("data-scroll-hidden") === "true",
        chromeHeight: collapse.getBoundingClientRect().height + safeArea.getBoundingClientRect().height,
        mainTop: main.getBoundingClientRect().top,
        scrollTop: main.scrollTop,
      });
    }
    return frames;
  });

  const firstHiddenFrame = hideFrames.findIndex((frame) => frame.hidden);
  expect(firstHiddenFrame, "the stepped descent triggers hide").toBeGreaterThan(-1);
  const hiding = hideFrames.slice(firstHiddenFrame);
  expect(
    new Set(hiding.map((frame) => Math.round(frame.chromeHeight))).size,
    "hide has intermediate frames",
  ).toBeGreaterThan(3);
  for (let index = 1; index < hiding.length; index += 1) {
    expect(hiding[index].chromeHeight, "chrome height never reverses during hide").toBeLessThanOrEqual(
      hiding[index - 1].chromeHeight + 1,
    );
    expect(hiding[index].mainTop, "content edge never reverses during hide").toBeLessThanOrEqual(
      hiding[index - 1].mainTop + 1,
    );
    expect(hiding[index].scrollTop, "downward intent remains monotonic during hide").toBeGreaterThanOrEqual(
      hiding[index - 1].scrollTop - 1,
    );
  }
  expect(hiding.at(-1)?.chromeHeight ?? -1, "hide settles at zero chrome height").toBeLessThanOrEqual(1);

  const revealFrames = await page.evaluate(async () => {
    const main = document.getElementById("main-content");
    const collapse = document.querySelector<HTMLElement>('[data-testid="universal-header-collapse"]');
    const safeArea = document.querySelector<HTMLElement>('[data-testid="chrome-safe-area-top"]');
    if (!main || !collapse || !safeArea) throw new Error("phone collapse geometry was not rendered");
    const frames: Array<{ hidden: boolean; chromeHeight: number; mainTop: number; scrollTop: number }> = [];
    for (let frame = 0; frame < 45; frame += 1) {
      if (frame < 6) {
        main.scrollTop -= 8;
        main.dispatchEvent(new Event("scroll", { bubbles: true }));
      }
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
      frames.push({
        hidden: collapse.getAttribute("data-scroll-hidden") === "true",
        chromeHeight: collapse.getBoundingClientRect().height + safeArea.getBoundingClientRect().height,
        mainTop: main.getBoundingClientRect().top,
        scrollTop: main.scrollTop,
      });
    }
    return frames;
  });

  const firstRevealedFrame = revealFrames.findIndex((frame) => !frame.hidden);
  expect(firstRevealedFrame, "the upward gesture triggers reveal").toBeGreaterThan(-1);
  const revealing = revealFrames.slice(firstRevealedFrame);
  expect(
    new Set(revealing.map((frame) => Math.round(frame.chromeHeight))).size,
    "reveal has intermediate frames",
  ).toBeGreaterThan(3);
  for (let index = 1; index < revealing.length; index += 1) {
    expect(revealing[index].chromeHeight, "chrome height never reverses during reveal").toBeGreaterThanOrEqual(
      revealing[index - 1].chromeHeight - 1,
    );
    expect(revealing[index].mainTop, "content edge never reverses during reveal").toBeGreaterThanOrEqual(
      revealing[index - 1].mainTop - 1,
    );
    expect(revealing[index].scrollTop, "upward intent remains monotonic during reveal").toBeLessThanOrEqual(
      revealing[index - 1].scrollTop + 1,
    );
  }
  expect(revealing.at(-1)?.chromeHeight ?? 0, "reveal restores the full phone chrome").toBeGreaterThan(100);
});

/** Phone edge-to-edge guard for the shared header on Therapy results. */
test("phone shared header releases its top safe-area band after hide", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize(phoneViewport);
  await gotoPhoneSurface(page, "/therapy-compass/search?q=CBT&run=1");
  await expect(page.getByTestId("therapy-compass-section-nav")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("chrome-safe-area-top")).toBeVisible();

  const initial = await page.evaluate(() => {
    const safeArea = document.querySelector<HTMLElement>('[data-testid="chrome-safe-area-top"]');
    const collapse = document.querySelector<HTMLElement>('[data-testid="universal-header-collapse"]');
    const main = document.getElementById("main-content");
    const safeAreaTopPx = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--safe-area-top"),
    );
    return {
      headerHidden: collapse?.getAttribute("data-scroll-hidden") === "true",
      safeAreaHeight: safeArea?.getBoundingClientRect().height ?? -1,
      mainTop: main?.getBoundingClientRect().top ?? -1,
      safeAreaTopPx,
    };
  });
  expect(initial.headerHidden, "header starts visible").toBe(false);
  expect(initial.safeAreaHeight, "visible header owns the simulated OS inset").toBeGreaterThanOrEqual(
    initial.safeAreaTopPx - 1,
  );
  expect(initial.mainTop, "visible header and Therapy nav remain in flow").toBeGreaterThan(initial.safeAreaTopPx);

  await dragScrollBy(page, 720, 24);
  await page.waitForTimeout(500);

  const afterHide = await page.evaluate(() => {
    const safeArea = document.querySelector<HTMLElement>('[data-testid="chrome-safe-area-top"]');
    const collapse = document.querySelector<HTMLElement>('[data-testid="universal-header-collapse"]');
    const main = document.getElementById("main-content");
    const safeRect = safeArea?.getBoundingClientRect();
    const mainRect = main?.getBoundingClientRect();
    return {
      headerHidden: collapse?.getAttribute("data-scroll-hidden") === "true",
      safeAreaHeight: safeRect?.height ?? 0,
      mainTop: mainRect?.top ?? -1,
      mainLeft: mainRect?.left ?? -1,
      mainRight: mainRect?.right ?? -1,
      viewportWidth: window.innerWidth,
    };
  });

  expect(afterHide.headerHidden, "shared header collapses after a deliberate descent").toBe(true);
  expect(afterHide.safeAreaHeight, "hidden header releases the opaque status-bar band").toBeLessThanOrEqual(1);
  expect(afterHide.mainTop, "hidden header lets content reach the physical top edge").toBeLessThanOrEqual(1);
  expect(afterHide.mainLeft, "phone scroll surface reaches the left edge").toBeCloseTo(0, 0);
  expect(afterHide.mainRight, "phone scroll surface reaches the right edge").toBeCloseTo(afterHide.viewportWidth, 0);

  await dragScrollBy(page, -720, 24);
  await page.waitForTimeout(500);

  const afterReveal = await page.evaluate(() => {
    const safeArea = document.querySelector<HTMLElement>('[data-testid="chrome-safe-area-top"]');
    const collapse = document.querySelector<HTMLElement>('[data-testid="universal-header-collapse"]');
    const main = document.getElementById("main-content");
    const safeAreaTopPx = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--safe-area-top"),
    );
    return {
      headerHidden: collapse?.getAttribute("data-scroll-hidden") === "true",
      safeAreaHeight: safeArea?.getBoundingClientRect().height ?? -1,
      mainTop: main?.getBoundingClientRect().top ?? -1,
      safeAreaTopPx,
    };
  });

  expect(afterReveal.headerHidden, "upward scroll reveals the shared header").toBe(false);
  expect(afterReveal.safeAreaHeight, "revealed header restores the OS inset").toBeGreaterThanOrEqual(
    afterReveal.safeAreaTopPx - 1,
  );
  expect(afterReveal.mainTop, "revealed header restores its complete flow height").toBeGreaterThan(
    afterReveal.safeAreaTopPx,
  );
});
