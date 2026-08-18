import { expect, test, type Page } from "playwright/test";

async function gotoCoordinator(page: Page) {
  await page.goto("/ward-management", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("ward-coordinator")).toBeVisible({ timeout: 15_000 });
}

/**
 * `.screen` sets `overflow: hidden`, so `document.documentElement` can never report an
 * overflow regardless of what breaks inside it — measuring the document was a test that could
 * not fail (Task 3 review Important 1). The region grid is the element whose track widths
 * actually constrain the five-region layout, so it is the element whose scroll box has to stay
 * within its client box.
 */
async function expectNoRegionGridOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const grid = document.querySelector('[data-testid="ward-coordinator-region-grid"]');
    if (!grid) return null;
    return grid.scrollWidth - grid.clientWidth;
  });
  expect(overflow).not.toBeNull();
  expect(overflow).toBeLessThanOrEqual(2);
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

    await expectNoRegionGridOverflow(page);
  });

  // The equivalent coverage for these two lived on WardManagementConsole, which Task 3 stopped
  // rendering at /ward-management. Task 9 deletes that component; until then the behaviour has
  // no home on the coordinator screen and these stay fixme so the gap is visible in the runner
  // (not just in a ledger row) rather than silently dropped.

  // Implemented when the shortlist region stops being a placeholder — Task 5/7.
  test.fixme("queue selection drives the explainable shortlist", () => {});

  // Implemented when the exceptions drawer is built out — Task 8.
  test.fixme("the exceptions drawer drives movement selection", () => {});
});
