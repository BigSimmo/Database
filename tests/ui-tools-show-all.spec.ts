import { expect, test, type Page } from "playwright/test";
import { expectNoPageHorizontalOverflow } from "./helpers/spec-navigation";

async function gotoLauncher(page: Page, path = "/tools") {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#main-content").first()).toBeVisible({ timeout: 15_000 });
}

test("Show all opens the unfiltered tools search mode", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoLauncher(page, "/?mode=tools");

  const showAll = page.getByRole("link", { name: "Show all tools" });
  await expect(showAll).toBeVisible();
  await expect(showAll).toHaveText("Show all");
  await expect(showAll).toHaveAttribute("href", "/tools");

  const showAllBox = await showAll.boundingBox();
  expect(showAllBox?.height).toBeGreaterThanOrEqual(48);

  await showAll.focus();
  await expect(showAll).toBeFocused();

  await Promise.all([page.waitForURL(/\/tools$/), page.keyboard.press("Enter")]);

  const results = page.getByTestId("tools-search-results-page");
  await expect(results).toBeVisible();
  await expect(results.getByRole("heading", { level: 1, name: "All tools" })).toBeVisible();
  await expect(results.getByRole("link", { name: "Open PsychSift Search" })).toHaveAttribute("href", "/?mode=answer");
  await expect(results.getByRole("button", { name: "View details for PsychSift Search" })).toBeVisible();
  await expect(page.getByTestId("global-search-input")).toHaveCount(0);
  await expectNoPageHorizontalOverflow(page);
});
