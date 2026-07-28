import { expect, test, type Locator, type Page } from "playwright/test";

const path = "/mockups/document-top-navigation";
const expectedSections = ["Summary", "PDF", "Evidence", "Images"];

async function gotoMockup(page: Page) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { level: 1, name: "Document title bar + attached page navigation" }),
  ).toBeVisible({
    timeout: 15_000,
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const documentWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0);
    return documentWidth - document.documentElement.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(2);
}

async function expectNavigationContract(preview: Locator) {
  const navigation = preview.getByRole("navigation", { name: "Document page sections" });
  await expect(navigation.getByRole("button")).toHaveText(expectedSections);
  await expect(navigation.getByRole("button", { name: "Overview" })).toHaveCount(0);
  await expect(navigation.getByRole("button", { name: "Text" })).toHaveCount(0);
  await expect(navigation.getByRole("button", { name: "Summary" })).toHaveAttribute("aria-current", "page");
}

test.describe("Document top navigation mockups @mockup", () => {
  test.describe.configure({ timeout: 60_000 });

  test("keeps all three desktop and phone concepts on the perfected navigation contract", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await gotoMockup(page);

    const previews = page.locator("article[data-direction][data-device]");
    await expect(previews).toHaveCount(6);
    for (let index = 0; index < 6; index += 1) {
      await expectNavigationContract(previews.nth(index));
    }
    await expectNoHorizontalOverflow(page);
  });

  test("focuses and operates the bottom document search from the title bar", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoMockup(page);

    const preview = page.locator('article[data-direction="continuous"][data-device="phone"]');
    const searchInput = preview.getByRole("searchbox", { name: "Search within this document" });
    await preview.locator("header").getByRole("button", { name: "Go to document search" }).click();
    await expect(searchInput).toBeFocused();

    await searchInput.fill("clozapine");
    await preview
      .getByRole("search", { name: "Search within this document" })
      .getByRole("button", {
        name: "Search document text",
      })
      .click();
    await expect(preview.getByText("Showing document text matches for “clozapine”.")).toBeVisible();
  });

  test("does not overflow across the required responsive widths", async ({ page }) => {
    await gotoMockup(page);
    for (const width of [320, 390, 639, 768, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
      await expectNoHorizontalOverflow(page);
    }
  });
});
