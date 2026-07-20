import type { Locator, Page } from "playwright/test";

/**
 * Phone dock clearance in CSS pixels for #main-content.
 * GlobalSearchShell applies the reserve on an inner pad (so it contributes to
 * scrollHeight); ClinicalDashboard still pads #main-content directly.
 */
export async function readMobileComposerReservePx(main: Locator): Promise<number> {
  return main.evaluate((node) => {
    const pad = node.querySelector<HTMLElement>('[data-testid="mobile-composer-reserve-pad"]');
    if (pad) return Number.parseFloat(window.getComputedStyle(pad).paddingBottom);
    return Number.parseFloat(window.getComputedStyle(node).paddingBottom);
  });
}

/** Scroll the app's primary phone surface (#main-content when present, else the document). */
export async function scrollPrimarySurface(page: Page, top: number) {
  await page.evaluate(async (scrollTop) => {
    const main = document.getElementById("main-content");
    if (main) {
      main.scrollTo({ top: scrollTop, behavior: "auto" });
      // WebKit doesn't reliably emit a native scroll event for programmatic scrollTo.
      main.dispatchEvent(new Event("scroll"));
    } else {
      window.scrollTo({ top: scrollTop, behavior: "auto" });
      window.dispatchEvent(new Event("scroll"));
    }

    // Give React's scroll handler and the browser's layout/paint pipeline a
    // frame each before the next scripted step. Firefox can otherwise coalesce
    // a tight sequence of programmatic scrolls into one event, which does not
    // model the deliberate directional movement these checks exercise.
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    // React may schedule the state commit after the paint callbacks above in
    // Firefox. Yield one browser task so callers assert the committed UI state
    // rather than racing the scroll event's concurrent update.
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  }, top);
}
