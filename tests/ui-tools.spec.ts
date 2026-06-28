import { expect, test, type Page } from "playwright/test";

async function gotoLauncher(page: Page, path = "/applications") {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
}

async function expectNoPageHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const documentWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0);
    return documentWidth - document.documentElement.clientWidth;
  });

  expect(overflow).toBeLessThanOrEqual(2);
}

test.describe("Clinical KB applications launcher", () => {
  test.describe.configure({ timeout: 60_000 });

  for (const viewport of [
    { name: "mobile", width: 390, height: 820 },
    { name: "desktop", width: 1280, height: 900 },
  ] as const) {
    test(`applications launcher is usable at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await gotoLauncher(page);

      await expect(page.getByRole("heading", { level: 1, name: "Applications" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Pinned applications" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "All applications" })).toBeVisible();
      if (viewport.name === "mobile") {
        await expect(page.getByTestId("selected-application-panel")).toBeHidden();
        await page.getByTestId("mobile-application-row-medication-prescribing").click();
        const selectedSheet = page.getByRole("dialog", { name: "Selected application" });
        await expect(selectedSheet).toBeVisible();
        await expect(page.getByTestId("selected-application-sheet-panel")).toContainText("Medication Prescribing");
        const mobileLaunchLink = page
          .getByTestId("selected-application-sheet-panel")
          .getByLabel("Launch Medication Prescribing");
        await expect(mobileLaunchLink).toBeVisible();
        await expect(mobileLaunchLink).toHaveAttribute("href", "/?mode=prescribing");
        await expect(mobileLaunchLink).not.toHaveAttribute("target", "_blank");
        await page.getByLabel("Close selected application").click();
        await expect(selectedSheet).toBeHidden();
      } else {
        await expect(page.getByTestId("selected-application-panel")).toContainText("Clinical KB Search");
        const desktopLaunchLink = page.getByTestId("selected-application-panel").getByLabel("Launch Clinical KB Search");
        await expect(desktopLaunchLink).toBeVisible();
        await expect(desktopLaunchLink).toHaveAttribute("href", "/?mode=answer");
      }
      await expect(page.getByLabel("Current app mode: Applications")).toBeVisible();
      await expect(page.getByPlaceholder("Search applications...")).toBeVisible();
      await expect(page.getByLabel("Open selected application")).toBeVisible();
      await expectNoPageHorizontalOverflow(page);
    });
  }

  test("launcher links point to the expected in-app modes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoLauncher(page);

    const medicationLink = page.locator('a[aria-label="Launch Medication Prescribing"]').first();
    await expect(medicationLink).toHaveAttribute("href", "/?mode=prescribing");
    await expect(medicationLink).not.toHaveAttribute("target", "_blank");
    await expect(page.locator('a[aria-label="Launch Documents"]').first()).toHaveAttribute("href", "/?mode=documents");
    await expect(page.locator('a[aria-label="Launch Favourites"]').first()).toHaveAttribute(
      "href",
      "/?mode=favourites",
    );
    await expect(page.locator('a[aria-label="Launch Clinical KB Search"]').first()).toHaveAttribute(
      "href",
      "/?mode=answer",
    );
    // External companion-app launchers were removed; no localhost links should remain.
    await expect(page.locator('a[href^="http://localhost"], a[href^="http://127.0.0.1"]')).toHaveCount(0);
  });

  test("search and filters reduce visible application rows without overflow", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoLauncher(page);

    await page.getByLabel("Search applications").fill("medication");

    await expect(page.getByTestId("application-row-medication-prescribing")).toBeVisible();
    await expect(page.getByTestId("application-row-documents")).toBeHidden();
    await expect(page.getByText("Showing 1 to 2 of 4 applications")).toBeVisible();
    await expectNoPageHorizontalOverflow(page);
  });
});
