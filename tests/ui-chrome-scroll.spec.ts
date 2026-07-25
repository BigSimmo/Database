import { expect, test, type Page } from "playwright/test";

/**
 * Tablet/desktop header hide-and-return.
 *
 * The reported defect: above the phone breakpoint the header scrolled away with
 * the page and only came back once the reader reached the very top. Two
 * distinct causes, one per scroll-ownership model, so both are swept here:
 *
 *  - GlobalSearchShell hands scrolling back to the document above phones, so
 *    `#main-content`'s React onScroll never fired and nothing reported scroll
 *    at all. Its chrome now sticks to the viewport top and translates away.
 *  - ClinicalDashboard keeps `<main>` as the scrollport at every width, but its
 *    collapse row was gated to `max-sm`, so the header simply never hid.
 *
 * The load-bearing assertion is the reveal *mid-page*: hidden must clear while
 * the reader is still hundreds of pixels down, with the bar back on screen.
 * Asserting only `data-scroll-hidden` would have passed against the old sticky
 * header, which flipped the attribute while sitting far off the viewport top.
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
    // Collapse hosts flip data-scroll-hidden on the grid wrapper; the answer
    // view's overlay glass bar flips it on header#search itself.
    const header = document.querySelector("header#search");
    const hideTarget = document.querySelector('[data-testid="universal-header-collapse"]') ?? header;
    const rect = header?.getBoundingClientRect();
    return {
      offset: Math.round(mainScrolls && main ? main.scrollTop : window.scrollY),
      maxOffset: Math.round(
        mainScrolls && main ? main.scrollHeight - main.clientHeight : doc.scrollHeight - window.innerHeight,
      ),
      hidden: hideTarget?.getAttribute("data-scroll-hidden") === "true",
      headerTop: rect ? Math.round(rect.top) : Number.NaN,
      headerBottom: rect ? Math.round(rect.bottom) : Number.NaN,
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
    test(`${sizeName}: header hides on scroll down and returns mid-page on ${surfaceName}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.locator("header#search").first()).toBeVisible({ timeout: 15_000 });
      await waitForRunway(page, requiredRunway);
      await page.waitForTimeout(400);

      const atTop = await readChromeState(page);
      expect(atTop.hidden, "header visible at the top").toBe(false);
      expect(atTop.headerTop, "header starts at the viewport top").toBeLessThanOrEqual(8);

      await scrollBy(page, atTop.maxOffset + 320, 160);
      await page.waitForTimeout(300);

      const scrolledDown = await readChromeState(page);
      expect(scrolledDown.offset, "descent moved the scroller").toBeGreaterThan(requiredRunway - 200);
      expect(scrolledDown.hidden, "header hides on a deliberate scroll down").toBe(true);
      expect(scrolledDown.headerBottom, "hidden header is off the top of the viewport").toBeLessThanOrEqual(0);

      // Three deliberate upward steps — nowhere near the top of the page.
      await scrollBy(page, -360, 120);
      await page.waitForTimeout(300);

      const scrolledUp = await readChromeState(page);
      expect(scrolledUp.offset, "the reveal happens well short of the top").toBeGreaterThan(200);
      expect(scrolledUp.hidden, "header returns on a deliberate scroll up").toBe(false);
      expect(scrolledUp.headerBottom, "returned header is actually on screen").toBeGreaterThan(0);
      expect(scrolledUp.headerTop, "returned header sits at the viewport top").toBeLessThanOrEqual(8);
    });

    test(`${sizeName}: bottom search composer never scroll-hides on ${surfaceName}`, async ({ page }) => {
      // The phone dock hide is phone-only by contract; above that breakpoint the
      // composer lives in the hero or the header and has nothing to reclaim.
      await page.setViewportSize(viewport);
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.locator("header#search").first()).toBeVisible({ timeout: 15_000 });
      await waitForRunway(page, requiredRunway);
      await page.waitForTimeout(400);

      const atTop = await readChromeState(page);
      await scrollBy(page, atTop.maxOffset + 320, 160);
      await page.waitForTimeout(300);

      const scrolledDown = await readChromeState(page);
      expect(scrolledDown.hidden, "the header still hides").toBe(true);
      expect(scrolledDown.hiddenBottomComposers, "no composer hides above the phone breakpoint").toBe(0);
    });
  }
}
