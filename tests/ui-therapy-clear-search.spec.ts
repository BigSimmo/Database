import { expect, test } from "playwright/test";

test.describe("Therapy search query ownership", () => {
  test("clearing a deep-linked query preserves filters and the phone tap target", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/therapy-compass/search?q=anxiety", { waitUntil: "domcontentloaded" });

    const ribbon = page.getByTestId("search-query-ribbon");
    const heading = ribbon.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText("anxiety", { timeout: 60_000 });

    const clearSearch = ribbon.getByTestId("therapy-clear-search");
    await expect(clearSearch).toBeVisible();
    const clearBox = await clearSearch.boundingBox();
    expect(clearBox?.width ?? 0).toBeGreaterThanOrEqual(48);
    expect(clearBox?.height ?? 0).toBeGreaterThanOrEqual(48);

    const filterTrigger = ribbon.getByTestId("therapy-filter-trigger");
    await filterTrigger.click();
    const filterSheet = page.getByTestId("therapy-filter");
    const anxietyFilter = filterSheet.getByRole("button", { name: /Anxiety/ });
    await anxietyFilter.click();
    await expect(anxietyFilter).toHaveAttribute("aria-pressed", "true");
    await filterSheet.getByTestId("therapy-filter-done").click();
    await expect(filterTrigger).toHaveAccessibleName(/1 filter active/);

    await clearSearch.click();

    await expect(page).toHaveURL(/\/therapy-compass\/search$/);
    await expect(heading).toHaveText("All");
    await expect(clearSearch).toHaveCount(0);
    await expect(filterTrigger).toHaveAccessibleName(/1 filter active/);

    await filterTrigger.click();
    await expect(page.getByTestId("therapy-filter").getByRole("button", { name: /Anxiety/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
