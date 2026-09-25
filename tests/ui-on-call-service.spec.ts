import { expect, test } from "playwright/test";

test.describe("Invited handbook phone experience", () => {
  for (const width of [320, 390, 430, 1280]) {
    test(`readable service, handbook and orientation at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ colorScheme: width === 390 ? "dark" : "light", reducedMotion: "reduce" });
      await page.goto("/on-call/service");
      const workspace = page.getByTestId("service-page").filter({ visible: true });
      await expect(workspace).toHaveCount(1);
      await expect(workspace).toBeVisible();
      await expect(workspace.getByTestId("service-context-banner")).toContainText("Synthetic");
      await expect(workspace.getByTestId("service-handbook")).toBeVisible();
      await expect(workspace.getByRole("link", { name: /Chief Psychiatrist.*forms/ })).toBeVisible();
      expect(await workspace.evaluate((el) => el.scrollWidth <= window.innerWidth)).toBe(true);
      const shortTargets = await workspace
        .locator("button, select, input:not([type=checkbox]), a")
        .evaluateAll((nodes) =>
          nodes
            .filter((node) => {
              const rect = node.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0 && rect.height < 47.5;
            })
            .map((node) => node.textContent?.trim() || node.getAttribute("aria-label")),
        );
      expect(shortTargets).toEqual([]);
      await workspace.getByRole("button", { name: "Orientation", exact: true }).click();
      await expect(workspace.getByTestId("service-orientation")).toBeVisible();
      await expect(workspace.getByRole("heading", { name: "Before leaving", exact: true })).toBeVisible();
      expect(await workspace.evaluate((el) => el.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }

  test("finds the exact local extension and never offers a public dial action", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/on-call/service");
    await page.getByRole("searchbox", { name: "Search service handbook" }).fill("coordination extension");
    await page.getByRole("button", { name: "Open first result" }).click();
    const entry = page.getByTestId("service-entry-61000000-0000-4000-8000-000000000001");
    await expect(entry).toBeFocused();
    await expect(entry.getByRole("button", { name: /Copy extension/ })).toBeVisible();
    await expect(entry.locator('a[href^="tel:"]')).toHaveCount(0);
  });

  test("copies only a blank structure and opens explicit learning capture", async ({ page }) => {
    // Clipboard permissions are Chromium-only names: Firefox rejects "clipboard-read" and WebKit
    // "clipboard-write", so granting them failed this test before it started on every non-Chromium
    // project. The question here is what the page writes, so capture it with the same in-page
    // clipboard the answer Copy journeys in ui-smoke.spec.ts use.
    await page.addInitScript(() => {
      let clipboardText = "";
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          readText: async () => clipboardText,
          writeText: async (value: string) => {
            clipboardText = value;
          },
        },
      });
    });
    await page.goto("/on-call/service");
    const telephone = page
      .locator("div")
      .filter({ has: page.getByText("Telephone advice structure", { exact: true }) })
      .last();
    await telephone.getByRole("button", { name: "Copy blank structure" }).click();
    expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n")).toContain(
      "Reason for call\nInformation provided",
    );
    const resources = page.getByTestId("handbook-resources");
    await resources.getByRole("link", { name: "Log this learning", exact: true }).first().click();
    await expect(page).toHaveURL(/\/cme\/new\?title=/);
    await expect(page.getByRole("button", { name: /^Save/ })).toBeDisabled();
  });
});
