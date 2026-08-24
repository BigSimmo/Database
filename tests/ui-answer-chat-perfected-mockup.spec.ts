import { expect, test } from "playwright/test";

const path = "/mockups/answer-chat-perfected";
const sourceOne = "Source 1, Physical health protocol, page 12";

test.describe("Answer-chat perfected mockup drawer @mockup", () => {
  test("contains keyboard focus, pages sources, and restores the opening mark", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path, { waitUntil: "domcontentloaded" });

    // Scope the trigger and drawer to the interactive phone frame instead of
    // relying on document-wide source-mark ordering in the specimen above it.
    const phoneAnswer = page.getByText("Phone · tap any number").locator("..");
    const opener = phoneAnswer.getByRole("button", { name: sourceOne }).first();
    await opener.click();

    const drawer = phoneAnswer.getByRole("dialog", { name: "Source 1 of 3" });
    await expect(drawer).toBeVisible();
    const controls = drawer.getByRole("button");
    await expect(controls.first()).toBeFocused();
    await controls.last().press("Tab");
    await expect(controls.first()).toBeFocused();

    await page.keyboard.press("ArrowRight");
    const sourceTwoDrawer = phoneAnswer.getByRole("dialog", { name: "Source 2 of 3" });
    await expect(sourceTwoDrawer).toBeVisible();
    await expect(sourceTwoDrawer.getByRole("button", { name: "Previous source" })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(sourceTwoDrawer).toHaveCount(0);
    await expect(opener).toBeFocused();
  });
});
