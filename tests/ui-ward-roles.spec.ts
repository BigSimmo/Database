import { expect, test, type Page } from "playwright/test";

import { unitById } from "@/components/ward-management/ward-sites";

async function gotoWard(page: Page, unitId: string) {
  await page.goto(`/ward-management/ward/${unitId}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("ward-unit-screen")).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState("networkidle");
}

test.describe("Ward screen", () => {
  test.describe.configure({ timeout: 45_000 });

  test("shows one unit's own capacity and answers an incoming referral", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });
    await gotoWard(page, "bty-adult-secure");

    // One unit, not twenty-two.
    await expect(page.getByTestId("ward-unit-screen")).toContainText("BTY Adult Secure");
    await expect(page.locator('[data-testid^="ward-unit-card-"]')).toHaveCount(1);

    // Its beds reconcile on screen.
    const beds = page.getByTestId("ward-unit-beds");
    await expect(beds).toContainText("Ready");
    await expect(beds).toContainText("Occupied");

    // A decline requires a reason from the fixed list, and out-of-catchment is offered.
    // Unconditional: bty-adult-secure holds a live referral at seed (WF-017, verified against
    // the real fixture — see the task report), so this must not hide behind an `if (count())`
    // that can silently never run.
    const incoming = page.locator('[data-testid^="ward-incoming-"]');
    await expect(incoming).not.toHaveCount(0);
    await incoming
      .first()
      .getByRole("button", { name: /Decline/ })
      .click();
    const reasons = page.getByRole("group", { name: /Decline reason/ });
    await expect(reasons).toContainText(/out of catchment/i);
  });

  /**
   * Addendum R40 (Global Constraint): an id `unitById` cannot resolve must render an explicit
   * empty state naming the id — never a substituted unit, never `?? allUnits()[0]`. This id is
   * checked against the real fixture below to prove it genuinely resolves to nothing, so the test
   * cannot silently start passing against a real unit if the fixture ever grows an id like this.
   */
  test("names an unresolved unit id rather than substituting a different ward", async ({ page }) => {
    const bogusUnitId = "nonexistent-unit-does-not-exist";
    expect(unitById(bogusUnitId), "fixture assumption: this id resolves to no real unit").toBeUndefined();

    await page.goto(`/ward-management/ward/${bogusUnitId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-unit-screen")).toBeVisible({ timeout: 15_000 });

    // Names the id, in real visible text — never a generic "not found" with the id swallowed.
    await expect(page.getByTestId("ward-unit-screen")).toContainText(bogusUnitId);
    // And never a substituted unit: no unit card is rendered at all for this route.
    await expect(page.locator('[data-testid^="ward-unit-card-"]')).toHaveCount(0);
    await expect(page.getByTestId("ward-unit-beds")).toHaveCount(0);
  });
});
