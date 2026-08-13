import { expect, test, type Page } from "playwright/test";

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

test.beforeEach(async ({ page }) => {
  await blockExternalRequests(page);
});

test("DSM result action remains inside the results card at the 1024px breakpoint", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/dsm/search?q=major+depressive", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#main-content").first()).toBeVisible({ timeout: 15_000 });

  const dsmPage = page.getByTestId("dsm-search-page");
  const resultsSection = dsmPage.locator('section[aria-label="DSM diagnosis results"]');
  const result = dsmPage.getByTestId("dsm-search-result").filter({ hasText: "Major depressive disorder" });
  const openDiagnosis = result.getByRole("link", { name: "Open Major depressive disorder" });

  await expect(dsmPage).toBeVisible();
  await expect(resultsSection).toBeVisible();
  await expect(result).toBeVisible();
  await expect(openDiagnosis).toBeVisible();

  const sectionBox = await resultsSection.boundingBox();
  const actionBox = await openDiagnosis.boundingBox();
  expect(sectionBox).not.toBeNull();
  expect(actionBox).not.toBeNull();
  if (!sectionBox || !actionBox) {
    throw new Error("Expected DSM results and action bounding boxes");
  }

  const sectionRight = sectionBox.x + sectionBox.width;
  const actionRight = actionBox.x + actionBox.width;
  expect(actionBox.x).toBeGreaterThanOrEqual(sectionBox.x - 1);
  expect(actionRight).toBeLessThanOrEqual(sectionRight + 1);
  expect(actionBox.width).toBeGreaterThanOrEqual(48);
});
