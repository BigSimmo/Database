import { expect, test } from "playwright/test";

test.describe("Therapy search query ownership", () => {
  test("clearing a deep-linked query resets the URL-backed Therapy state", async ({ page }) => {
    await page.goto("/therapy-compass/search?q=anxiety", { waitUntil: "domcontentloaded" });

    const ribbon = page.getByTestId("search-query-ribbon");
    const heading = ribbon.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText("anxiety", { timeout: 60_000 });

    const clearSearch = ribbon.getByTestId("therapy-clear-search");
    await expect(clearSearch).toBeVisible();
    await clearSearch.click();

    await expect(page).toHaveURL(/\/therapy-compass\/search$/);
    await expect(heading).toHaveText("All");
    await expect(clearSearch).toHaveCount(0);
  });
});
