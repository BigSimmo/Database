import { expect, test, type Page } from "playwright/test";

async function gotoTools(page: Page) {
  await page.goto("/tools", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
}

async function expectNoPageHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const documentWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0);
    return documentWidth - document.documentElement.clientWidth;
  });

  expect(overflow).toBeLessThanOrEqual(2);
}

test.describe("Clinical KB tools launcher", () => {
  test.describe.configure({ timeout: 60_000 });

  for (const viewport of [
    { name: "mobile", width: 390, height: 820 },
    { name: "desktop", width: 1280, height: 900 },
  ] as const) {
    test(`tools launcher is usable at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await gotoTools(page);

      await expect(page.getByRole("heading", { level: 1, name: "Open the right clinical tool." })).toBeVisible();
      await expect(page.getByRole("heading", { name: "All clinical tools" })).toBeVisible();
      await expect(page.getByLabel("Return to Clinical KB dashboard")).toBeVisible();
      await expect(page.getByLabel("Launch priority tool Formulation")).toBeVisible();
      await expect(page.getByLabel("Launch Formulation")).toBeVisible();
      await expect(page.getByLabel("Launch Psychiatry Notes")).toBeVisible();
      await expect(page.getByRole("link", { name: "Launchers" })).toHaveAttribute("href", "#launchers");
      await expectNoPageHorizontalOverflow(page);
    });
  }
});
