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
      // composer is page-anchored (or in the mode-home hero) and has nothing to reclaim.
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

for (const { name: sizeName, viewport } of breakpoints) {
  test(`${sizeName}: services results search stays page-anchored outside sticky header`, async ({ page }) => {
    // Regression for the defect where PR #1222's sticky collapse wrapper also
    // wrapped the search composer, so /services?q=… glued the pill under the
    // top bar on tablet/desktop. Only header#search may stick; the composer
    // must leave the viewport as the page scrolls.
    await page.setViewportSize(viewport);
    await page.goto("/services?q=services&focus=1&run=1", { waitUntil: "domcontentloaded" });
    await expect(page.locator("header#search").first()).toBeVisible({ timeout: 15_000 });

    const composer = page.locator("form.universal-top-search-edge, form.document-mobile-search-edge").first();
    await expect(composer).toBeVisible({ timeout: 15_000 });

    const atTop = await page.evaluate(() => {
      const header = document.querySelector("header#search");
      const collapse = document.querySelector('[data-testid="universal-header-collapse"]');
      const form = document.querySelector("form.universal-top-search-edge, form.document-mobile-search-edge");
      const headerRect = header?.getBoundingClientRect();
      const formRect = form?.getBoundingClientRect();
      return {
        formInsideCollapse: Boolean(collapse && form && collapse.contains(form)),
        formTop: formRect ? Math.round(formRect.top) : Number.NaN,
        headerBottom: headerRect ? Math.round(headerRect.bottom) : Number.NaN,
        formPosition: form ? getComputedStyle(form).position : "",
      };
    });
    expect(atTop.formInsideCollapse, "search composer must not live inside sticky header chrome").toBe(false);
    expect(atTop.formPosition, "results search is in normal flow, not sticky/fixed under the bar").toBe("static");
    expect(atTop.formTop, "composer starts below the top bar").toBeGreaterThanOrEqual(atTop.headerBottom - 2);

    await waitForRunway(page, requiredRunway);
    await page.waitForTimeout(400);
    await scrollBy(page, 900, 150);
    await page.waitForTimeout(300);

    const afterScroll = await page.evaluate(() => {
      const header = document.querySelector("header#search");
      const form = document.querySelector("form.universal-top-search-edge, form.document-mobile-search-edge");
      const headerRect = header?.getBoundingClientRect();
      const formRect = form?.getBoundingClientRect();
      return {
        formBottom: formRect ? Math.round(formRect.bottom) : Number.NaN,
        headerTop: headerRect ? Math.round(headerRect.top) : Number.NaN,
        headerBottom: headerRect ? Math.round(headerRect.bottom) : Number.NaN,
        scrollY: Math.round(window.scrollY),
      };
    });
    expect(afterScroll.scrollY, "page actually scrolled").toBeGreaterThan(400);
    expect(afterScroll.formBottom, "page-anchored search scrolled off with the content").toBeLessThanOrEqual(8);
  });
}
