import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "playwright/test";

async function blockExternalRequests(page: Page) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)
    ) {
      await route.abort("blockedbyclient");
      return;
    }
    await route.fallback();
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0) - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);
}

test.beforeEach(async ({ page }) => {
  await blockExternalRequests(page);
});

test("Dictionary sources redirects into the Sources catalogue", async ({ page }) => {
  await page.goto("/dictionary/sources", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/sources\?usedBy=dictionary$/);
  await expect(page.getByLabel("Filter by application usage")).toHaveValue("dictionary");
});

test("@critical Sources catalogue filters and opens traceability", async ({ page }) => {
  await page.goto("/sources?usedBy=dictionary", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1, name: "Sources" })).toBeVisible();
  await expect(page.getByLabel("Filter by application usage")).toHaveValue("dictionary");
  await page.getByLabel("Filter by quality band").selectOption("D");
  await expect(page.getByRole("status")).toContainText("source");
  await page
    .getByRole("link", { name: /view source details/i })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 2, name: "Source locations" })).toBeVisible();
  await expect(page.getByText("Application location")).toBeVisible();
});

test("Sources remains operable at phone width and under accessibility media", async ({
  page,
  browserName,
}, testInfo) => {
  test.skip(browserName !== "chromium", "forced-colors emulation is Chromium-only");
  await page.setViewportSize({ width: 320, height: 760 });
  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
  await page.goto("/sources");
  await expect(page.getByTestId("sources-catalogue-main")).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus-visible")).toHaveCount(1);
  await expectNoHorizontalOverflow(page);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  await testInfo.attach("sources-axe", {
    body: JSON.stringify(axe.violations, null, 2),
    contentType: "application/json",
  });
  expect(
    axe.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious"),
  ).toEqual([]);
});
