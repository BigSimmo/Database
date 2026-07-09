import type { Page } from "playwright/test";

/** Scroll the app's primary phone surface (#main-content when present, else the document). */
export async function scrollPrimarySurface(page: Page, top: number) {
  await page.evaluate((scrollTop) => {
    const main = document.getElementById("main-content");
    if (main) {
      main.scrollTo({ top: scrollTop, behavior: "auto" });
      // WebKit doesn't reliably emit a native scroll event for programmatic scrollTo.
      main.dispatchEvent(new Event("scroll"));
      return;
    }
    window.scrollTo({ top: scrollTop, behavior: "auto" });
    window.dispatchEvent(new Event("scroll"));
  }, top);
}
