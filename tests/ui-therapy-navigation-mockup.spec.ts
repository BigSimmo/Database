import { expect, test, type Page } from "playwright/test";

const routes = [
  { name: "rail", path: "/mockups/therapy-navigation-rail" },
  { name: "dock", path: "/mockups/therapy-navigation-dock" },
  { name: "context", path: "/mockups/therapy-navigation-context" },
] as const;

const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "tablet", width: 768, height: 900 },
  { name: "phone", width: 390, height: 844 },
] as const;

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0) - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);
}

test.describe("Therapy navigation mockups @mockup", () => {
  test.describe.configure({ timeout: 90_000 });

  for (const route of routes) {
    test(`${route.name} renders at desktop, tablet, and phone sizes`, async ({ page }) => {
      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await page.goto(route.path, { waitUntil: "domcontentloaded" });
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });
        await expect(page.getByRole("navigation", { name: /Therapy sections|Therapy navigation/ }).first()).toBeVisible();
        await expectNoHorizontalOverflow(page);
      }
    });
  }
});
