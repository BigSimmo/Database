import { expect, test, type Locator, type Page } from "playwright/test";

import { clickWhenHydrated, expectHydrated } from "./playwright-settlement";

/**
 * Call, Refer and Find in demo mode (plan 3.6): the demo handbook is the
 * synthetic "Demonstration Hospital", so every number here is made up.
 */

async function shortTargets(scope: Locator): Promise<string[]> {
  return scope.locator("button, input, a").evaluateAll((nodes) =>
    nodes
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > 1 && rect.height > 1 && rect.height < 47.5;
      })
      .map((node) => node.textContent?.trim() || node.getAttribute("aria-label") || node.tagName),
  );
}

/** In dark mode nothing with a bright fill is taller than 48px (standard §10). */
async function brightBlocksOver48(scope: Locator): Promise<string[]> {
  return scope.locator("*").evaluateAll((nodes) =>
    nodes
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        if (rect.height <= 48.5 || rect.width === 0) return false;
        const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(getComputedStyle(node).backgroundColor);
        if (!match) return false;
        const [, r, g, b, alpha] = match;
        if (alpha !== undefined && Number(alpha) < 0.5) return false;
        return (Number(r) + Number(g) + Number(b)) / 3 > 200;
      })
      .map((node) => `${node.tagName}.${node.getAttribute("data-testid") ?? ""}`),
  );
}

async function open(page: Page, path: string, colorScheme: "light" | "dark") {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
  await page.goto(path);
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`On Call Call, Refer and Find (${colorScheme})`, () => {
    test("Call names the hospital, dials the pause route and keeps short codes desk-only", async ({ page }) => {
      await open(page, "/on-call/call", colorScheme);
      const main = page.getByTestId("on-call-call-main");
      await expect(main.getByTestId("on-call-hospital-line")).toContainText("Demonstration Hospital");
      await expect(main.locator('a[href="tel:0890000000,4455"]')).toHaveCount(1);
      await expect(main).toContainText("then ext 4455");

      const emergency = main.locator("li", { hasText: "Synthetic emergency line" }).first();
      await expect(emergency).toContainText("From a hospital phone");
      await expect(emergency.getByRole("link", { name: /from a mobile/i })).toHaveCount(1);

      await clickWhenHydrated(main.getByRole("button", { name: /Dialling details for Switchboard/ }));
      await expect(page.getByRole("dialog", { name: "Switchboard" })).toBeVisible();
      await page.keyboard.press("Escape");

      await clickWhenHydrated(main.getByRole("button", { name: "Didn't connect: Switchboard" }));
      await expect(page.getByRole("dialog", { name: "Didn't connect" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "Didn't connect" })).toHaveCount(0);

      expect(await main.evaluate((el) => el.scrollWidth <= window.innerWidth)).toBe(true);
      expect(await shortTargets(main)).toEqual([]);
      if (colorScheme === "dark") expect(await brightBlocksOver48(main)).toEqual([]);
    });

    test("Refer opens a referral's detail in a sheet", async ({ page }) => {
      await open(page, "/on-call/refer", colorScheme);
      const main = page.getByTestId("on-call-refer-main");
      await clickWhenHydrated(main.getByRole("button", { name: /Example internal referral route/ }));
      await expect(page.getByTestId("on-call-refer-detail")).toBeVisible();
      await page.keyboard.press("Escape");
      expect(await shortTargets(main)).toEqual([]);
      if (colorScheme === "dark") expect(await brightBlocksOver48(main)).toEqual([]);
    });

    test("Find puts Systems down first, leaves on-site items to Admin, and lands on the anchor", async ({ page }) => {
      await open(page, "/on-call/find#on-call-group-downtime", colorScheme);
      const main = page.getByTestId("on-call-find-main");
      const search = main.getByRole("searchbox", { name: "Search Find" });
      await expectHydrated(search);
      const firstGroup = main.locator('[id^="on-call-group-"]').first();
      await expect(firstGroup).toHaveAttribute("id", "on-call-group-downtime");
      await expect(firstGroup).toBeInViewport();
      await expect(main).not.toContainText("Car park after hours");
      await expect(main.getByTestId("on-call-find-on-site").getByRole("link")).toHaveAttribute(
        "href",
        "/on-call/logistics",
      );
      expect(await shortTargets(main)).toEqual([]);
      if (colorScheme === "dark") expect(await brightBlocksOver48(main)).toEqual([]);
    });
  });
}
