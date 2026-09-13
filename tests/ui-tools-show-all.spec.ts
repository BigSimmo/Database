import { expect, test, type Page } from "playwright/test";
import { expectNoPageHorizontalOverflow } from "./helpers/spec-navigation";

async function gotoLauncher(page: Page, path = "/tools") {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#main-content").first()).toBeVisible({ timeout: 15_000 });
}

/**
 * Tools used to have two surfaces: a hub at `/?mode=tools` whose "Show all" chip
 * linked across to the directory at `/tools`. Which one a clinician landed on
 * depended only on how they arrived. `/?mode=tools` now redirects, so the chip has
 * nothing left to link to and the assertion worth keeping is that the alias lands on
 * the one directory with its verb shortcuts intact.
 */
test("the legacy tools alias lands on the single tools directory", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoLauncher(page, "/?mode=tools");

  await page.waitForURL(/\/tools$/);

  const results = page.getByTestId("tools-search-results-page");
  await expect(results).toBeVisible();
  await expect(results.getByRole("heading", { level: 1, name: "All tools" })).toBeVisible();
  await expect(page.getByTestId("tools-shortcuts")).toBeVisible();
  await expect(results.getByRole("link", { name: "Open PsychSift Search" })).toHaveAttribute("href", "/?mode=answer");
  await expect(results.getByRole("button", { name: "View details for PsychSift Search" })).toBeVisible();
  await expect(page.getByTestId("global-search-input")).toHaveCount(0);
  await expectNoPageHorizontalOverflow(page);
});
