import { expect, test } from "playwright/test";

const path = "/mockups/answer-chat-perfected";
const sourceOne = "Source 1, Physical health protocol, page 12";

test.describe("Answer-chat perfected mockup drawer @mockup", () => {
  test("contains keyboard focus, pages sources, and restores the opening mark", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path, { waitUntil: "domcontentloaded" });

    // The first two source-one marks belong to the standalone specimen. The
    // next one is in the phone answer frame that owns the drawer.
    const opener = page.getByRole("button", { name: sourceOne }).nth(2);
    await opener.click();

    const sourceOneDrawers = page.locator('[role="dialog"][aria-label="Source 1 of 3"]');
    await expect(sourceOneDrawers).toHaveCount(2);
    const drawer = sourceOneDrawers.first();
    await expect(drawer).toBeFocused();

    const controls = drawer.getByRole("button");
    await controls.last().press("Tab");
    await expect(controls.first()).toBeFocused();

    await page.keyboard.press("ArrowRight");
    const sourceTwoDrawers = page.locator('[role="dialog"][aria-label="Source 2 of 3"]');
    await expect(sourceTwoDrawers.first()).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(sourceOneDrawers).toHaveCount(1);
    await expect(opener).toBeFocused();
  });
});
