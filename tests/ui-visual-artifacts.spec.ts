import { expect, test, type Page, type TestInfo } from "playwright/test";

const documentPath =
  "/documents/11111111-1111-4111-8111-111111111111?page=1&chunk=44444444-4444-4444-8444-444444444442";
async function attachViewportScreenshot(
  page: Page,
  testInfo: TestInfo,
  name: string,
  viewport: { width: number; height: number },
  path: string,
) {
  await page.setViewportSize(viewport);
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#main-content").first()).toBeVisible({ timeout: uiLoadTimeoutMs });
  await expect(page.locator("body")).toBeVisible();

  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: false }),
    contentType: "image/png",
  });
}

test.describe("Clinical KB visual QA artifacts", () => {
  test("captures dashboard and document viewer screenshots", async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await attachViewportScreenshot(page, testInfo, "dashboard-mobile", { width: 390, height: 820 }, "/");
    await attachViewportScreenshot(page, testInfo, "dashboard-desktop", { width: 1280, height: 900 }, "/");
    await attachViewportScreenshot(page, testInfo, "document-mobile", { width: 390, height: 820 }, documentPath);
    await attachViewportScreenshot(page, testInfo, "document-desktop", { width: 1280, height: 900 }, documentPath);
  });
});
