import { expect, test, type Page } from "playwright/test";
import { readPrimaryScrollGeometry } from "./playwright-scroll";

/**
 * Tablet/desktop top-bar hide-and-return, with breakpoint-specific search ownership.
 *
 * Two defects are guarded here:
 *
 *  1. Above the phone breakpoint the top bar used to scroll away with the page
 *     and only return at the very top (no scroll reporter / sticky travel).
 *  2. Search must stay pinned on tablets but belong to normal page flow on
 *     desktop, where it scrolls away independently from the sticky top bar.
 *
 * The load-bearing assertions are (a) the reveal *mid-page* and (b) the search
 * input staying pinned on tablet but leaving the viewport on desktop. Asserting only
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
// These result/detail pages own the generic page-flow slot on desktop.
const surfaces = [
  { name: "shell results", route: "/forms?q=form%201A&run=1" },
  { name: "shell service detail", route: "/services/13yarn" },
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
  searchPlacement: string | null;
  searchInsideDesktopPageSlot: boolean;
  searchHasStickyAncestor: boolean;
  desktopPageSearchClearsFollowingContent: boolean | null;
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
    const searchForm = search?.closest("form");
    const desktopPageSlot = searchForm?.closest<HTMLElement>('[data-testid="desktop-page-search-composer-slot"]');
    const followingContent = desktopPageSlot
      ? Array.from(desktopPageSlot.parentElement?.children ?? [])
          .slice(Array.from(desktopPageSlot.parentElement?.children ?? []).indexOf(desktopPageSlot) + 1)
          .find((element) => {
            const candidateRect = element.getBoundingClientRect();
            return candidateRect.width > 0 && candidateRect.height > 0;
          })
      : null;
    let searchHasStickyAncestor = false;
    for (let node = searchForm?.parentElement ?? null; node && !searchHasStickyAncestor; node = node.parentElement) {
      searchHasStickyAncestor = window.getComputedStyle(node).position === "sticky";
    }
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
      searchPlacement: searchForm?.dataset.composerPlacement ?? null,
      searchInsideDesktopPageSlot: Boolean(searchForm?.closest('[data-testid="desktop-page-search-composer-slot"]')),
      searchHasStickyAncestor,
      desktopPageSearchClearsFollowingContent:
        desktopPageSlot && followingContent
          ? desktopPageSlot.getBoundingClientRect().bottom <= followingContent.getBoundingClientRect().top + 1
          : null,
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

test("1024px bounded main scrolling preserves focused page search", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/?mode=prescribing&q=a&run=1", { waitUntil: "domcontentloaded" });
  const input = page.getByTestId("global-search-input");
  await expect(input).toBeVisible({ timeout: 15_000 });
  await expect
    .poll(async () => (await readPrimaryScrollGeometry(page)).maxScrollTop, { timeout: 20_000 })
    .toBeGreaterThanOrEqual(requiredRunway);
  await expect.poll(async () => (await readPrimaryScrollGeometry(page)).owner).toBe("main");
  await input.focus();
  await expect(input).toBeFocused();

  await scrollBy(page, 320, 80);

  await expect.poll(async () => (await readPrimaryScrollGeometry(page)).owner).toBe("main");
  await expect.poll(async () => (await readPrimaryScrollGeometry(page)).scrollTop).toBeGreaterThan(0);
  await expect(input, "bounded desktop main scrolling must preserve deliberate keyboard focus").toBeFocused();
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
      expect(atTop.searchVisible, "search starts on screen").toBe(true);
      if (sizeName === "desktop") {
        expect(atTop.searchPlacement).toBe("desktop-page");
        expect(atTop.searchInsideDesktopPageSlot).toBe(true);
        expect(atTop.searchHasStickyAncestor).toBe(false);
        expect(atTop.desktopPageSearchClearsFollowingContent).toBe(true);
      }

      await scrollBy(page, atTop.maxOffset + 320, 160);
      await page.waitForTimeout(300);

      const scrolledDown = await readChromeState(page);
      expect(scrolledDown.offset, "descent moved the scroller").toBeGreaterThan(requiredRunway - 200);
      expect(scrolledDown.hidden, "top bar hides on a deliberate scroll down").toBe(true);
      expect(scrolledDown.headerBottom, "hidden top bar is off the top of the viewport").toBeLessThanOrEqual(0);
      if (sizeName === "tablet") {
        expect(scrolledDown.searchVisible, "header search stays on screen while the top bar is hidden").toBe(true);
        expect(
          scrolledDown.searchTop,
          "header search sits near the viewport top after the top bar collapses",
        ).toBeLessThanOrEqual(24);
      } else {
        expect(scrolledDown.searchVisible, "desktop page search scrolls away with page content").toBe(false);
      }

      // Three deliberate upward steps — nowhere near the top of the page.
      await scrollBy(page, -360, 120);
      await page.waitForTimeout(300);

      const scrolledUp = await readChromeState(page);
      expect(scrolledUp.offset, "the reveal happens well short of the top").toBeGreaterThan(200);
      expect(scrolledUp.hidden, "top bar returns on a deliberate scroll up").toBe(false);
      expect(scrolledUp.headerBottom, "returned top bar is actually on screen").toBeGreaterThan(0);
      expect(scrolledUp.headerTop, "returned top bar sits at the viewport top").toBeLessThanOrEqual(8);
      if (sizeName === "tablet") {
        expect(scrolledUp.searchVisible, "header search remains on screen after the top bar returns").toBe(true);
      } else {
        expect(scrolledUp.searchVisible, "returning the desktop top bar does not re-anchor page search").toBe(false);
      }
    });

    test(`${sizeName}: search composer keeps its breakpoint owner on ${surfaceName}`, async ({ page }) => {
      // data-scroll-hidden is reserved for the phone dock. Tablet search stays
      // pinned; desktop search leaves by ordinary page scrolling instead.
      await page.setViewportSize(viewport);
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.locator("header#search").first()).toBeVisible({ timeout: 15_000 });
      await waitForRunway(page, requiredRunway);
      await page.waitForTimeout(400);

      const atTop = await readChromeState(page);
      expect(atTop.searchVisible).toBe(true);
      await scrollBy(page, atTop.maxOffset + 320, 160);
      await page.waitForTimeout(300);

      const scrolledDown = await readChromeState(page);
      expect(scrolledDown.hidden, "the top bar still hides").toBe(true);
      expect(
        scrolledDown.hiddenBottomComposers,
        "no composer flips data-scroll-hidden above the phone breakpoint",
      ).toBe(0);
      if (sizeName === "tablet") {
        expect(scrolledDown.searchVisible, "header search geometry stays on screen").toBe(true);
      } else {
        expect(atTop.searchInsideDesktopPageSlot).toBe(true);
        expect(scrolledDown.searchVisible, "desktop composer follows page flow off-screen").toBe(false);
      }
    });
  }
}
