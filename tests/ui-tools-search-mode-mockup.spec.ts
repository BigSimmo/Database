import { expect, test, type Page } from "playwright/test";

const mockupPath = "/mockups/tools-search-mode?mode=tools&q=Compare";

async function gotoMockup(page: Page, width: number, height = 900) {
  await page.setViewportSize({ width, height });
  await page.goto(mockupPath, { waitUntil: "domcontentloaded" });
  const mockup = page.locator('[data-testid="tools-search-mode-mockup"]:visible');
  await expect(mockup).toBeVisible();
  await expect(page.locator('[data-testid="global-search-input"]:visible')).toHaveValue("Compare");
  return mockup;
}

async function expectNoHorizontalOverflow(page: Page) {
  const geometry = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(Math.max(geometry.body, geometry.document)).toBeLessThanOrEqual(geometry.viewport + 1);
}

test.describe("Perfected Tools results mode mockup @mockup", () => {
  test("desktop uses universal search and keeps results beside the selected-tool panel", async ({ page }) => {
    const mockup = await gotoMockup(page, 1440);

    await expect(mockup.getByRole("heading", { level: 1, name: "Compare" })).toBeVisible();
    await expect(mockup.getByText("1 tool", { exact: true })).toBeVisible();
    await expect(mockup.getByRole("heading", { level: 2, name: "Differentials" }).first()).toBeVisible();
    await expect(mockup.locator("aside").getByRole("heading", { name: "Best for" })).toBeVisible();
    await expect(mockup.getByTestId("tools-search-mode-hero")).toHaveCount(0);
    await expect(mockup.getByText("Also matches in other modes")).toHaveCount(0);
    await expect(mockup.getByText("Dose converter")).toHaveCount(0);

    await mockup.getByTestId("tools-search-filter-trigger-wide").click();
    const filterSheet = page.locator('[data-testid="tools-search-filter-sheet"]:visible');
    await filterSheet.getByRole("radio", { name: /Treatment/ }).click();
    await filterSheet.getByRole("button", { name: "Done" }).click();
    await expect(mockup.getByText("0 tools", { exact: true })).toBeVisible();
    await expect(mockup.getByRole("heading", { name: "No tools match" })).toBeVisible();
    await expect(mockup.locator("aside")).toHaveCount(0);
    await mockup.getByTestId("tools-search-filter-trigger-wide").click();
    await filterSheet.getByRole("radio", { name: /All tools/ }).click();
    await filterSheet.getByRole("button", { name: "Done" }).click();
    await expect(mockup.getByRole("heading", { level: 2, name: "Differentials" }).first()).toBeVisible();
    await expect(mockup.locator("aside").getByRole("heading", { name: "Differentials" })).toBeVisible();

    const output = mockup.locator("aside").getByRole("button", { name: "Output" });
    await output.click();
    await expect(output).toHaveAttribute("aria-expanded", "true");
    await expect(mockup.locator("#desktop-tool-detail-output")).toContainText("Ranked differentials");

    await page.locator('[data-testid="global-search-input"]:visible').fill("Safety");
    await expect(mockup.getByRole("heading", { level: 1, name: "Safety" })).toBeVisible();
    await expect(mockup.locator("aside").getByRole("heading", { name: "Risk & Safety" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("phone keeps results visible until Details opens the preferred bottom sheet", async ({ page }) => {
    const mockup = await gotoMockup(page, 390, 844);

    const sheet = page.locator('[data-testid="tools-search-detail-sheet"]:visible');
    await expect(sheet).toHaveCount(0);
    await expect(mockup.getByRole("heading", { level: 1, name: "Compare" })).toBeVisible();
    await expect(mockup.getByRole("heading", { level: 2, name: "Differentials" })).toBeVisible();

    const details = mockup.getByRole("button", { name: "View details for Differentials" });
    await details.click();
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("heading", { name: "Differentials" })).toBeVisible();
    await expect(sheet.getByRole("heading", { name: "Best for" })).toBeVisible();

    const neededInput = sheet.getByRole("button", { name: "Needed input" });
    await neededInput.click();
    await expect(neededInput).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);

    await details.click();
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: "Close Differentials" }).click();
    await expect(details).toBeFocused();
    await expectNoHorizontalOverflow(page);
  });

  test("phone filter sheet follows the shared local-filter behavior", async ({ page }) => {
    const mockup = await gotoMockup(page, 390, 844);
    const trigger = mockup.getByTestId("tools-search-filter-trigger-phone");

    await trigger.click();
    const filterSheet = page.locator('[data-testid="tools-search-filter-sheet"]:visible');
    await expect(filterSheet).toBeVisible();
    await expect(filterSheet.getByText("1 showing", { exact: true })).toBeVisible();

    const assessment = filterSheet.getByRole("radio", { name: /Assessment/ });
    await assessment.click();
    await expect(assessment).toHaveAttribute("aria-checked", "true");
    await expect(filterSheet).toBeVisible();
    await expect(filterSheet.getByText("1 showing", { exact: true })).toBeVisible();
    await filterSheet.getByRole("button", { name: "Done" }).click();
    await expect(filterSheet).toHaveCount(0);
    await expect(trigger).toContainText("1");

    await trigger.click();
    const treatment = filterSheet.getByRole("radio", { name: /Treatment/ });
    await treatment.click();
    await expect(treatment).toHaveAttribute("aria-checked", "true");
    await expect(filterSheet.getByText("0 showing", { exact: true })).toBeVisible();
    await filterSheet.getByRole("button", { name: "Clear filters" }).click();
    await expect(filterSheet).toBeVisible();
    await expect(filterSheet.getByRole("radio", { name: /All tools/ })).toHaveAttribute("aria-checked", "true");
    await expect(filterSheet.getByText("1 showing", { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("keeps its shared controls and tool sheet legible in forced colors with reduced motion", async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
    const mockup = await gotoMockup(page, 390, 844);

    await mockup.getByRole("button", { name: "View details for Differentials" }).click();
    const sheet = page.locator('[data-testid="tools-search-detail-sheet"]:visible');
    await expect(sheet.getByText("Source-backed")).toBeVisible();
    await expect(sheet.getByRole("link", { name: "Compare Differentials" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  for (const width of [320, 390, 639, 768, 1440, 1920]) {
    test(`has no horizontal overflow at ${width}px`, async ({ page }) => {
      await gotoMockup(page, width, 900);
      await expectNoHorizontalOverflow(page);
    });
  }
});
