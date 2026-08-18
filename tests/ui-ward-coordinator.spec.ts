import { expect, test, type Page } from "playwright/test";

async function gotoCoordinator(page: Page) {
  await page.goto("/ward-management", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("ward-coordinator")).toBeVisible({ timeout: 15_000 });
  // The console is visible from the first paint, but this dev environment settles the route
  // shortly after (a second same-URL navigation event follows the first). A click issued in
  // that window can be lost even though every element is already visible and stable, so wait
  // for network activity to quiesce — the one reliable, non-arbitrary signal available here —
  // before the first interaction. Mirrors `gotoWardFlow` in ui-ward-management.spec.ts (Task 4
  // review Important 6: a retry loop around the click was masking this instead of fixing it).
  await page.waitForLoadState("networkidle");
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

  // The shortlist region is still a placeholder (Task 7 builds the real explainable shortlist),
  // but its placeholder text already names the selected movement, so the wiring this test is
  // actually about — a queue click driving `selectedMovementId` through to that region, and a
  // second click moving the selection rather than adding to it — is real Task 5 behaviour with
  // a real home, not a gap. Task 7 replaces the shortlist body without touching this contract.
  test("queue selection drives the explainable shortlist", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoCoordinator(page);

    const queue = page.getByRole("region", { name: "Priority queue" });
    const shortlist = page.getByRole("complementary", { name: "Explainable shortlist" });
    await expect(shortlist).toContainText("Select a movement");

    const rows = queue.locator('[data-testid^="ward-queue-row-"]');
    const firstRow = rows.first();
    const firstId = (await firstRow.getAttribute("data-testid"))?.replace("ward-queue-row-", "");
    await firstRow.click();
    await expect(firstRow).toHaveAttribute("aria-pressed", "true");
    await expect(shortlist).toContainText(String(firstId));

    // A second selection replaces the first rather than accumulating.
    const secondRow = rows.nth(1);
    const secondId = (await secondRow.getAttribute("data-testid"))?.replace("ward-queue-row-", "");
    await secondRow.click();
    await expect(secondRow).toHaveAttribute("aria-pressed", "true");
    await expect(firstRow).toHaveAttribute("aria-pressed", "false");
    await expect(shortlist).toContainText(String(secondId));
  });

  // Implemented when the exceptions drawer is built out — Task 8.
  test.fixme("the exceptions drawer drives movement selection", () => {});

  test("orders by clinical tier first and labels the score as operational, not clinical", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoCoordinator(page);

    const queue = page.getByRole("region", { name: "Priority queue" });
    const tiers = await queue
      .locator('[data-testid^="ward-queue-row-"] [data-tier]')
      .evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute("data-tier"))));
    expect(tiers).toEqual([...tiers].sort((a, b) => a - b));

    // The score must never read as clinical severity.
    await expect(queue).toContainText("Operational");
    await expect(queue).not.toContainText("Severity");
    await expect(queue).not.toContainText("Acuity");

    // Selecting a movement drives the rest of the screen.
    await queue.locator('[data-testid^="ward-queue-row-"]').first().click();
    const shortlist = page.getByRole("complementary", { name: "Explainable shortlist" });
    const selectedId = await queue.locator('[aria-pressed="true"]').getAttribute("data-testid");
    await expect(shortlist).toContainText(String(selectedId).replace("ward-queue-row-", ""));
  });

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

    // The rendered sequence itself is non-increasing on the two keys `edPressure` ranks by.
    // Asserting only that card 1 "contains some text" (above) stays true even if the rows were
    // reversed — this pins the ordering property instead (Task 4 review Important 1). It reads
    // the actual numeric sort keys off `data-breaching`/`data-longest-minutes` rather than
    // hard-coding "PEEL is first", so it keeps validating the rule if the fixture data changes.
    const sortKeys = await cards.evaluateAll((nodes) =>
      nodes.map((node) => ({
        breaching: Number(node.getAttribute("data-breaching")),
        longestMinutes: Number(node.getAttribute("data-longest-minutes")),
      })),
    );
    for (let i = 1; i < sortKeys.length; i++) {
      const prev = sortKeys[i - 1];
      const curr = sortKeys[i];
      const doesNotOutrankPrevious =
        curr.breaching < prev.breaching ||
        (curr.breaching === prev.breaching && curr.longestMinutes <= prev.longestMinutes);
      expect(
        doesNotOutrankPrevious,
        `card ${i} ${JSON.stringify(curr)} must not rank above card ${i - 1} ${JSON.stringify(prev)}`,
      ).toBe(true);
    }

    // Choosing one filters the queue to that department and says so — and to exactly that
    // department's own movements, not merely to some smaller set of the same rough size. A
    // filter that names the clicked department while quietly showing a different one's patients
    // is worse than no filter, and `after < before` alone cannot tell the two apart (Task 4
    // review Important 2).
    const worstEdId = (await worst.getAttribute("data-testid"))?.replace("ward-ed-", "");
    const worstWaiting = Number(await worst.getAttribute("data-waiting"));
    const queue = page.getByRole("region", { name: "Priority queue" });
    const before = await queue.locator('[data-testid^="ward-queue-row-"]').count();
    await worst.click();
    await expect(queue).toContainText("Filtered to");
    const rows = queue.locator('[data-testid^="ward-queue-row-"]');
    await expect(rows).toHaveCount(worstWaiting);
    const originIds = await rows.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-origin-ed")));
    for (const originId of originIds) {
      expect(originId).toBe(worstEdId);
    }
    expect(worstWaiting).toBeLessThan(before);

    // And clearing restores it.
    await queue.getByRole("button", { name: /Clear filter/ }).click();
    await expect(queue.locator('[data-testid^="ward-queue-row-"]')).toHaveCount(before);
  });
});
