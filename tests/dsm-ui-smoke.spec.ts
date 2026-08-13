import { expect, test } from "playwright/test";

import { blockExternalRequests } from "./helpers/phone-scroll";

test.beforeEach(async ({ page }) => {
  await blockExternalRequests(page);
});

test("DSM result action remains inside the results card at the 1024px breakpoint", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/dsm/search?q=major+depressive", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#main-content").first()).toBeVisible({ timeout: 15_000 });

  const dsmPage = page.getByTestId("dsm-search-page");
  await expect(dsmPage).toBeVisible();

  const resultsSection = dsmPage.locator('section[aria-label="DSM diagnosis results"]');
  const result = dsmPage.getByTestId("dsm-search-result").filter({ hasText: "Major depressive disorder" });
  const openDiagnosis = result.getByRole("link", { name: "Open Major depressive disorder" });

  await expect(resultsSection).toBeVisible();
  await expect(result).toBeVisible();
  await expect(openDiagnosis).toBeVisible();

  await expect
    .poll(async () => {
      const [sectionBox, actionBox] = await Promise.all([resultsSection.boundingBox(), openDiagnosis.boundingBox()]);
      if (!sectionBox || !actionBox) return Number.POSITIVE_INFINITY;
      return Math.max(
        0,
        sectionBox.x - actionBox.x,
        actionBox.x + actionBox.width - (sectionBox.x + sectionBox.width),
      );
    })
    .toBeLessThanOrEqual(1);

  const actionBox = await openDiagnosis.boundingBox();
  expect(actionBox?.width ?? 0).toBeGreaterThanOrEqual(48);
});
