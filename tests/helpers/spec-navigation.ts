import { expect, type Page } from "playwright/test";

/**
 * Shared by ui-accessibility.spec.ts, ui-document-image-status-mockup.spec.ts,
 * ui-smoke.spec.ts, ui-stress.spec.ts, ui-tools-show-all.spec.ts and
 * ui-tools.spec.ts, which previously each carried a byte-identical inline copy
 * (md5 0bae7b2e332efabceb3f4f4d23c5ba66 for the whole function body). A change
 * to the `<= 2`px overflow allowance had to be made six times, and byte-identical
 * inline copies are exactly the region a whole-file rewrite tool can silently
 * re-diverge (the #Y30AXB failure mode). Extracted with no assertion change
 * (L127).
 */
export async function expectNoPageHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const documentWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0);
    return documentWidth - document.documentElement.clientWidth;
  });

  expect(overflow).toBeLessThanOrEqual(2);
}

/**
 * Shared by ui-accessibility.spec.ts and ui-smoke.spec.ts, whose inline
 * `gotoApp` bodies were byte-identical (only the default-argument signature
 * differed, and every ui-smoke.spec.ts call site already passes an explicit
 * path, so making the parameter optional here changes no call's behaviour).
 */
export async function gotoApp(page: Page, path = "/") {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#main-content").first()).toBeVisible({ timeout: 15_000 });
}
