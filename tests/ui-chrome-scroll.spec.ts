import { expect, test, type Page } from "playwright/test";

/**
 * Tablet/desktop top-bar hide-and-return, with the search field staying put.
 *
 * Two defects are guarded here:
 *
 *  1. Above the phone breakpoint the top bar used to scroll away with the page
 *     and only return at the very top (no scroll reporter / sticky travel).
 *  2. The first cross-breakpoint fix wrapped the search composer inside the
 *     same collapse/translate row as the top bar, so tablet/desktop search
 *     disappeared with mode / new chat — only the top bar should hide.
 *
 * The load-bearing assertions are (a) the reveal *mid-page* and (b) the search
 * input remaining on screen while the top bar is hidden. Asserting only
 * `data-scroll-hidden` would miss both.
 *
 * The suite-wide `reducedMotion: "reduce"` is kept deliberately: the chrome
 * carries `motion-reduce:transition-none`, so geometry settles in one frame and
 * these position reads are exact. Transition timing is covered by
 * ui-phone-scroll.spec.ts, which re-enables motion for that purpose.
 */

const breakpoints = [
  { name: "tablet", viewport: { width: 834, height: 1112 } },
  { name: "desktop", viewport: { width: 1440, height: 900 } },
];

// One surface per scroll-ownership model above the phone breakpoint, chosen for
// having real scroll runway at both sizes (short pages legitimately never hide).
// Dashboard results keep an inline header search; shell mode homes may portal
// the composer into the hero (still covered by the search-visible assertion
// when an input is present).
const surfaces = [
  { name: "shell mode home", route: "/tools" },
  { name: "shell detail page", route: "/formulation/worry" },
  { name: "dashboard results", route: "/?mode=prescribing&q=a&run=1" },
];

const requiredRunway = 700;

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

interface ChromeState {
  offset: number;
  maxOffset: number;
  hidden: boolean;
  headerTop: number;
  headerBottom: number;
  searchTop: number;
  searchBottom: number;
  searchVisible: boolean;
  hiddenBottomComposers: number;
}

/**
 * Reads whichever element actually scrolls at this width, so one spec can cover
 * both the document-scrolled shell and the `<main>`-scrolled dashboard.
 */
function readChromeState(page: Page): Promise<ChromeState> {
  return page.evaluate(() => {
    const main = document.getElementById("main-content");
    const mainScrolls = Boolean(main && main.scrollHeight > main.clientHeight + 1);
    const doc = document.documentElement;
    // Collapse hosts flip data-scroll-hidden on the top-bar grid wrapper; the
    // answer view's overlay glass bar flips it on header#search itself.
    const header = document.querySelector("header#search");
    const hideTarget = document.querySelector('[data-testid="universal-header-collapse"]') ?? header;
    const rect = header?.getBoundingClientRect();
    // Prefer the global search input; fall back to any visible search textbox
    // so hero-portaled composers still count.
    const search =
      document.querySelector<HTMLElement>('[data-testid="global-search-input"]') ??
      document.querySelector<HTMLElement>('input[type="search"], input[role="combobox"]');
    const searchRect = search?.getBoundingClientRect();
    const searchOnScreen = Boolean(
      searchRect &&
        searchRect.width > 0 &&
        searchRect.height > 0 &&
        searchRect.bottom > 0 &&
        searchRect.top < window.innerHeight,
    );
    return {
      offset: Math.round(mainScrolls && main ? main.scrollTop : window.scrollY),
      maxOffset: Math.round(
        mainScrolls && main ? main.scrollHeight - main.clientHeight : doc.scrollHeight - window.innerHeight,
      ),
      hidden: hideTarget?.getAttribute("data-scroll-hidden") === "true",
      headerTop: rect ? Math.round(rect.top) : Number.NaN,
      headerBottom: rect ? Math.round(rect.bottom) : Number.NaN,
      searchTop: searchRect ? Math.round(searchRect.top) : Number.NaN,
      searchBottom: searchRect ? Math.round(searchRect.bottom) : Number.NaN,
      searchVisible: searchOnScreen,
      hiddenBottomComposers: document.querySelectorAll('form[data-scroll-hidden="true"]').length,
    };
  });
}

/** Scrolls in per-frame steps so the reporter sees real directional intent. */
async function scrollBy(page: Page, totalPx: number, stepPx: number) {
  await page.evaluate(
    async ({ total, step }) => {
      const main = document.getElementById("main-content");
      const mainScrolls = Boolean(main && main.scrollHeight > main.clientHeight + 1);
      const steps = Math.max(1, Math.ceil(Math.abs(total) / step));
      const direction = total < 0 ? -1 : 1;
      for (let i = 0; i < steps; i += 1) {
        if (mainScrolls && main) {
          main.scrollTop += direction * step;
          main.dispatchEvent(new Event("scroll", { bubbles: true }));
        } else {
          window.scrollBy(0, direction * step);
        }
        await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
      }
    },
    { total: totalPx, step: stepPx },
  );
}

/**
 * These routes stream content in after first paint, so the runway a test needs
 * does not exist at domcontentloaded. Waiting for it beats a fixed timeout.
 */
async function waitForRunway(page: Page, minimum: number) {
  await page.waitForFunction(
    (min) => {
      const main = document.getElementById("main-content");
      const fromMain = main ? main.scrollHeight - main.clientHeight : 0;
      const fromDocument = document.documentElement.scrollHeight - window.innerHeight;
      return Math.max(fromMain, fromDocument) >= min;
    },
    minimum,
    { timeout: 20_000 },
  );
}

test.beforeEach(async ({ page }) => {
  await blockExternalRequests(page);
});

for (const { name: sizeName, viewport } of breakpoints) {
  for (const { name: surfaceName, route } of surfaces) {
    test(`${sizeName}: top bar hides on scroll down and returns mid-page on ${surfaceName}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.locator("header#search").first()).toBeVisible({ timeout: 15_000 });
      await waitForRunway(page, requiredRunway);
      await page.waitForTimeout(400);

      const atTop = await readChromeState(page);
      expect(atTop.hidden, "top bar visible at the top").toBe(false);
      expect(atTop.headerTop, "top bar starts at the viewport top").toBeLessThanOrEqual(8);
      // Hero composers sit mid-page and scroll with content; only a search that
      // starts in the chrome band must remain after the top bar collapses.
      const searchStartedInChrome = atTop.searchVisible && atTop.searchTop <= 120;

      await scrollBy(page, atTop.maxOffset + 320, 160);
      await page.waitForTimeout(300);

      const scrolledDown = await readChromeState(page);
      expect(scrolledDown.offset, "descent moved the scroller").toBeGreaterThan(requiredRunway - 200);
      expect(scrolledDown.hidden, "top bar hides on a deliberate scroll down").toBe(true);
      expect(scrolledDown.headerBottom, "hidden top bar is off the top of the viewport").toBeLessThanOrEqual(0);
      if (searchStartedInChrome) {
        expect(scrolledDown.searchVisible, "header search stays on screen while the top bar is hidden").toBe(true);
        expect(
          scrolledDown.searchTop,
          "header search sits near the viewport top after the top bar collapses",
        ).toBeLessThanOrEqual(24);
      }

      // Three deliberate upward steps — nowhere near the top of the page.
      await scrollBy(page, -360, 120);
      await page.waitForTimeout(300);

      const scrolledUp = await readChromeState(page);
      expect(scrolledUp.offset, "the reveal happens well short of the top").toBeGreaterThan(200);
      expect(scrolledUp.hidden, "top bar returns on a deliberate scroll up").toBe(false);
      expect(scrolledUp.headerBottom, "returned top bar is actually on screen").toBeGreaterThan(0);
      expect(scrolledUp.headerTop, "returned top bar sits at the viewport top").toBeLessThanOrEqual(8);
      if (searchStartedInChrome) {
        expect(scrolledUp.searchVisible, "header search remains on screen after the top bar returns").toBe(true);
      }
    });

    test(`${sizeName}: search composer never scroll-hides on ${surfaceName}`, async ({ page }) => {
      // The phone dock hide is phone-only by contract; above that breakpoint the
      // composer lives in the hero or beside the top bar and must stay usable.
      await page.setViewportSize(viewport);
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.locator("header#search").first()).toBeVisible({ timeout: 15_000 });
      await waitForRunway(page, requiredRunway);
      await page.waitForTimeout(400);

      const atTop = await readChromeState(page);
      const searchStartedInChrome = atTop.searchVisible && atTop.searchTop <= 120;
      await scrollBy(page, atTop.maxOffset + 320, 160);
      await page.waitForTimeout(300);

      const scrolledDown = await readChromeState(page);
      expect(scrolledDown.hidden, "the top bar still hides").toBe(true);
      expect(scrolledDown.hiddenBottomComposers, "no composer flips data-scroll-hidden above the phone breakpoint").toBe(
        0,
      );
      if (searchStartedInChrome) {
        expect(scrolledDown.searchVisible, "header search geometry stays on screen").toBe(true);
      }
    });
  }
}
