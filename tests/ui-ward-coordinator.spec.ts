import { expect, test, type Page } from "playwright/test";

async function gotoCoordinator(page: Page) {
  await page.goto("/ward-management", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("ward-coordinator")).toBeVisible({ timeout: 15_000 });
}

test.describe("Ward Flow coordinator screen", () => {
  test.describe.configure({ timeout: 45_000 });

  test("presents the five coordination regions", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoCoordinator(page);

    await expect(page.getByRole("region", { name: "Emergency department pressure" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Priority queue" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Statewide flow" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Explainable shortlist" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Exceptions/ })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2);
  });
});
