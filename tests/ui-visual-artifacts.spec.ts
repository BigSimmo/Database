import { expect, test } from "playwright/test";

const documentPath =
  "/documents/11111111-1111-4111-8111-111111111111?page=1&chunk=44444444-4444-4444-8444-444444444442";

test.describe("Clinical KB visual QA artifacts", () => {
  test("dashboard visual baseline", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#main-content").first()).toBeVisible({ timeout: 15_000 });
    
    // Mask dynamic content if necessary, using fullPage pixelmatch
    await expect(page).toHaveScreenshot({ maxDiffPixelRatio: 0.001, fullPage: true });
  });

  test("document viewer visual baseline", async ({ page }) => {
    await page.goto(documentPath, { waitUntil: "domcontentloaded" });
    await expect(page.locator("#main-content").first()).toBeVisible({ timeout: 15_000 });
    
    await expect(page).toHaveScreenshot({ maxDiffPixelRatio: 0.001, fullPage: true });
  });
});
