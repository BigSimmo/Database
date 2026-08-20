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

  test("ranks emergency departments worst first and filters the queue when one is chosen", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoCoordinator(page);

    const strip = page.getByRole("region", { name: "Emergency department pressure" });
    const cards = strip.locator('[data-testid^="ward-ed-"]');
    await expect(cards).toHaveCount(8);

    // The worst department leads, and says why it is worst.
    const worst = cards.first();
    await expect(worst).toContainText("waiting");
    await expect(worst).toContainText("longest");

    // Choosing one filters the queue to that department and says so.
    //
    // The click itself is retried, not just the assertion after it: a click landing before
    // React attaches the card's handler is swallowed silently (same "unhydrated first click"
    // race documented on the app-mode trigger in ui-smoke.spec.ts), so asserting the filter
    // once flakes on that race rather than on a real regression. `--repeat-each=3` reproduced
    // it 2 of 3 runs with a bare `.click()` here, even with this test run alone.
    const queue = page.getByRole("region", { name: "Priority queue" });
    const before = await queue.locator('[data-testid^="ward-queue-row-"]').count();
    await expect(async () => {
      if (
        await queue
          .getByText("Filtered to", { exact: false })
          .isVisible()
          .catch(() => false)
      )
        return;
      await worst.click();
      await expect(queue).toContainText("Filtered to", { timeout: 2_000 });
    }).toPass({ timeout: 15_000 });
    const after = await queue.locator('[data-testid^="ward-queue-row-"]').count();
    expect(after).toBeLessThan(before);

    // And clearing restores it — same retry, for the same reason, on the clear click.
    const clearFilter = queue.getByRole("button", { name: /Clear filter/ });
    await expect(async () => {
      if ((await queue.locator('[data-testid^="ward-queue-row-"]').count()) === before) return;
      await clearFilter.click();
      await expect(queue.locator('[data-testid^="ward-queue-row-"]')).toHaveCount(before, { timeout: 2_000 });
    }).toPass({ timeout: 15_000 });
  });
});
