import { expect, test, type Locator, type Page } from "playwright/test";

const path = "/mockups/document-top-navigation";
const expectedSections = ["Summary", "PDF", "Evidence", "Images"];

async function gotoMockup(page: Page) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { level: 1, name: "A document menu that feels attached to the source" }),
  ).toBeVisible({ timeout: 15_000 });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const pageWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0);
    return pageWidth - document.documentElement.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(2);
}

async function expectNavigationContract(preview: Locator) {
  const navigation = preview.getByRole("navigation", { name: "Document page sections" });
  await expect(navigation.getByRole("button")).toHaveText(expectedSections);
  await expect(navigation.getByRole("button", { name: "Summary" })).toHaveAttribute("aria-current", "page");
  await expect(preview.getByTestId("mock-global-header")).toBeVisible();
}

test.describe("Document top navigation mockups @mockup", () => {
  test.describe.configure({ timeout: 60_000 });

  test("provides all three concepts at desktop, tablet, and phone sizes", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await gotoMockup(page);

    const previews = page.locator("article[data-concept][data-device]");
    await expect(previews).toHaveCount(9);
    for (let index = 0; index < 9; index += 1) {
      await expectNavigationContract(previews.nth(index));
    }
    await expectNoHorizontalOverflow(page);
  });

  test("updates the active section without confusing navigation with document actions", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 900 });
    await gotoMockup(page);

    const preview = page.locator('article[data-concept="rail"][data-device="tablet"]');
    await preview.getByRole("button", { name: "Evidence" }).click();
    await expect(preview.getByRole("button", { name: "Evidence" })).toHaveAttribute("aria-current", "page");
    await expect(preview.getByRole("heading", { level: 4, name: "Evidence" })).toBeVisible();
    await expect(preview.getByRole("button", { name: "More document actions" })).toBeVisible();
  });

  test("keeps the page overflow-free across required responsive widths", async ({ page }) => {
    await gotoMockup(page);
    for (const width of [320, 390, 639, 768, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
      await expectNoHorizontalOverflow(page);
    }
  });
});
