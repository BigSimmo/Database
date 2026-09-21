import { expect, test } from "playwright/test";

/**
 * 19 September 2026, 10:00 Perth. Every figure the CME screens derive from
 * "now" — days remaining, the pace projection, which year an entry falls in —
 * is fixed by this, so the screens are byte-stable between runs. Perth rather
 * than UTC because the CPD year boundary is a Perth midnight: an entry logged
 * at 20:00 on 31 December is in that year, and a UTC comparison would move it
 * to the next.
 *
 * `src/components/cme/cme-dashboard-route.tsx` and
 * `cme-routines-route.tsx` already pass `DEMO_CME_INSTANT`
 * (`src/lib/cme/demo-year.ts`) rather than `new Date()` into the components
 * they wire up, so this freeze is defense in depth against a future change
 * reintroducing a live clock — not a workaround for a live one today. Without
 * it, the day this file's assumptions stop holding is invisible until a
 * screenshot review notices the "days left" figure has quietly moved.
 */
const FROZEN = new Date("2026-09-19T02:00:00Z");

/**
 * The four routes Task 17 takes pixel baselines of. Kept to this exact set —
 * not "every CME route" — because a baseline is only worth taking of a screen
 * that has actually stopped moving; `/cme/routines`, `/cme/setup`, `/cme/plan`
 * and `/cme/customise` are still open surfaces this phase iterates on.
 */
export const CME_BASELINE_ROUTES = ["/cme", "/cme/log", "/cme/new", "/cme/programme"] as const;

const CLINICAL_STATUS_CLASS =
  /\b(?:bg|text|border|ring|fill|stroke)-(?:red|amber|green|orange|rose|emerald|yellow)-[0-9]/;

test.describe("CME on a phone", () => {
  test.use({ viewport: { width: 390, height: 820 } });

  test.beforeEach(async ({ page }) => {
    // `setFixedTime` pins `new Date()` to FROZEN without touching
    // `requestAnimationFrame`. `page.clock.install()` + `pauseAt()` also
    // freezes rAF, which stalls React 19's rAF-deferred Suspense cleanup and
    // strands a hidden duplicate copy of the page in the DOM — do not go
    // back to that combination.
    await page.clock.setFixedTime(FROZEN);
  });

  test("the dashboard leads with position, pace and one action", async ({ page }) => {
    await page.goto("/cme");
    await expect(page.locator("#main-content")).toBeVisible();
    // `toContainText`, not `toHaveText`: the testid sits on the wrapping <p>,
    // whose full text is "32.5of 50 hours logged" — the figure plus its own
    // muted "of N hours logged" sibling span, with no space between them in
    // markup. An exact-text match would pin that whole sentence instead of
    // the one figure this assertion is actually about.
    await expect(page.getByTestId("cme-total-hours")).toContainText("32.5");
    await expect(page.getByTestId("cme-pace-sentence")).toContainText("by 31 December");
    await expect(page.getByTestId("cme-next-action")).toBeVisible();
  });

  test("every baseline route renders its main region at 390px with no sideways scroll", async ({ page }) => {
    for (const route of CME_BASELINE_ROUTES) {
      await page.goto(route);
      await expect(page.locator("#main-content")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${route} scrolls sideways at 390px`).toBeLessThanOrEqual(0);
    }
  });

  /**
   * The dom-level contract (`tests/cme-visual-contract.dom.test.tsx`) checks
   * for the CSS class token that guarantees a 48px floor, because jsdom
   * cannot lay out real pixels. This is the complement: a real Chromium
   * layout, measuring the actual rendered box of every interactive control
   * across every CME baseline route.
   */
  test("every interactive control on a baseline route actually measures at least 48px tall", async ({ page }) => {
    for (const route of CME_BASELINE_ROUTES) {
      await page.goto(route);
      const shortControls = await page.evaluate(() => {
        const nodes = [...document.querySelectorAll<HTMLElement>("button, a[href], [role='button']")];
        return (
          nodes
            .map((node) => ({ node, rect: node.getBoundingClientRect() }))
            // Excludes two shapes that are not an undersized tap target: a
            // zero-size box (not rendered — e.g. inside a closed disclosure),
            // and the root layout's global "Skip to main content" link,
            // which is `sr-only` (a real, correctly-implemented 1x1px
            // visually-hidden-until-focus pattern every page in the app
            // carries, not a CME control at all) until it is focused.
            .filter(({ rect }) => rect.height > 0 && rect.height < 48 && rect.width > 4)
            .map(({ node, rect }) => ({
              label: node.textContent?.trim() || node.getAttribute("aria-label") || node.tagName,
              height: Math.round(rect.height),
            }))
        );
      });
      expect(shortControls, `${route} has a control under 48px tall`).toEqual([]);
    }
  });

  test("paints no clinical status colour anywhere on the dashboard", async ({ page }) => {
    await page.goto("/cme");
    const offenders = await page.evaluate((patternSource) => {
      const pattern = new RegExp(patternSource);
      return [...document.querySelectorAll<HTMLElement>("[class]")]
        .filter((node) => pattern.test(node.className))
        .map((node) => node.className);
    }, CLINICAL_STATUS_CLASS.source);
    expect(offenders).toEqual([]);
  });

  test("the customise screen's reorder controls are real buttons a keyboard can reach and use", async ({ page }) => {
    await page.goto("/cme/customise");
    const list = page.getByTestId("cme-module-order");
    await expect(list).toBeVisible();

    const firstItemLabel = list.getByRole("listitem").first();
    const labelBefore = (await firstItemLabel.textContent())?.trim();

    const moveDown = list.getByRole("button", { name: /move .* down/i }).first();
    await moveDown.focus();
    await expect(moveDown).toBeFocused();
    await page.keyboard.press("Enter");

    const labelAfter = (await list.getByRole("listitem").first().textContent())?.trim();
    expect(labelAfter).not.toBe(labelBefore);
  });
});
