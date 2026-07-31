import type { Page } from "playwright/test";

/**
 * Playwright's Linux WebKit build advertises phantom touch points on the touch-free CI
 * runner, tripping the fine-pointer/zero-touch gate on the search command surface
 * (commandDropdownCanDisplay) that Chromium and Firefox pass via the zero-touch fallback.
 * Report the runner's real capability so WebKit exercises the same desktop surfaces.
 * Register as a beforeEach (or call inside one) BEFORE the page under test navigates.
 */
export async function stubZeroTouchPoints({ page }: { page: Page }) {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "maxTouchPoints", { configurable: true, get: () => 0 });
  });
}
