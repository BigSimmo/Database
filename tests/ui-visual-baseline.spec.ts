import { expect, test, type Locator, type Page } from "playwright/test";

/**
 * Pixel baselines for the surfaces whose appearance is the product.
 *
 * This is the gate `tests/ui-visual-artifacts.spec.ts` was never able to be: that
 * spec attaches four screenshots for a human to eyeball, so nothing fails when a
 * surface silently changes. Here each target is compared against a committed
 * baseline.
 *
 * Three deliberate constraints, each from a defect this repo has already paid for:
 *
 * 1. **Never `fullPage`.** Under CI load Next.js leaves a hidden duplicate page
 *    root in the stream (ledger #093), so a whole-page capture can contain the
 *    layout twice. Every target is clipped to a locator.
 * 2. **Demo mode only.** The Playwright runner forces `NEXT_PUBLIC_DEMO_MODE` and
 *    offline providers (`scripts/test-environment.mjs`), so content comes from the
 *    synthetic corpus and is byte-stable between runs. A live-provider run would
 *    re-baseline on every answer.
 * 3. **Motion off, carets hidden.** Both are frame-timing noise rather than
 *    appearance; the suite already runs `reducedMotion: "reduce"`.
 *
 * Baselines are platform-suffixed (see `playwright.visual.config.ts`). A run on a
 * platform with no committed baseline fails with "snapshot doesn't exist" rather
 * than silently passing — adopt baselines from the CI artifact, not from a
 * developer laptop, or font hinting alone will make every subsequent run red.
 */

const documentPath =
  "/documents/11111111-1111-4111-8111-111111111111?page=1&chunk=44444444-4444-4444-8444-444444444442";

const phone = { width: 390, height: 820 } as const;
const desktop = { width: 1280, height: 900 } as const;

type BaselineTarget = {
  readonly name: string;
  readonly route: string;
  /** Clipped region. Must resolve to exactly one visible element. */
  readonly selector: string;
  readonly viewport: { readonly width: number; readonly height: number };
  /**
   * Regions to paint over before comparing. Only for genuinely non-deterministic
   * content — a mask is a hole in the gate, so prefer making the fixture stable.
   */
  readonly mask?: readonly string[];
};

const targets: readonly BaselineTarget[] = [
  {
    name: "dashboard-shell",
    route: "/",
    selector: "#main-content",
    viewport: desktop,
  },
  {
    name: "dashboard-shell-phone",
    route: "/",
    selector: "#main-content",
    viewport: phone,
  },
  {
    name: "search-results-band",
    route: "/services?q=CMHT&run=1",
    selector: '[data-testid="search-query-ribbon"]',
    viewport: desktop,
  },
  {
    name: "search-results-band-phone",
    route: "/services?q=CMHT&run=1",
    selector: '[data-testid="search-query-ribbon"]',
    viewport: phone,
  },
  {
    name: "document-viewer",
    route: documentPath,
    selector: "#main-content",
    viewport: desktop,
  },
  {
    name: "therapy-compass-home",
    route: "/therapy-compass",
    selector: "#main-content",
    viewport: desktop,
  },
];

async function settle(page: Page, target: BaselineTarget): Promise<Locator> {
  await page.setViewportSize({ ...target.viewport });
  await page.goto(target.route, { waitUntil: "domcontentloaded" });

  const region = page.locator(target.selector).first();
  await expect(region).toBeVisible({ timeout: 20_000 });
  // Web fonts swapping in after the capture is the most common source of a
  // one-pixel-everywhere diff, so wait for them explicitly rather than sleeping.
  // The promise is mapped to undefined because it resolves to a FontFaceSet, which
  // Playwright cannot serialise back out of the page.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  return region;
}

test.describe("visual baselines", () => {
  test.describe.configure({ timeout: 90_000 });

  for (const target of targets) {
    test(`${target.name} matches its baseline`, async ({ page }) => {
      const region = await settle(page, target);

      await expect(region).toHaveScreenshot(`${target.name}.png`, {
        animations: "disabled",
        caret: "hide",
        // CSS pixels, so a runner with a different device-pixel-ratio does not
        // produce a differently-sized image against the same baseline.
        scale: "css",
        mask: (target.mask ?? []).map((selector) => page.locator(selector)),
      });
    });
  }
});
