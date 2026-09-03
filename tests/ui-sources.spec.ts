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
  await expect(page).toHaveURL(/\/sources\/search\?usedBy=dictionary$/);
  await expect(page.getByRole("button", { name: "Remove Used in: Dictionary filter" })).toBeVisible();
});

test("a submitted link to the Sources home forwards to the catalogue", async ({ page }) => {
  // `/sources` served both the home and the catalogue before the split, so this
  // bookmark shape has to keep resolving to results rather than the new home.
  await page.goto("/sources?q=RANZCP&run=1", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/sources\/search\?q=RANZCP&run=1$/);
  await expect(page.getByTestId("sources-catalogue-main")).toBeVisible();
});

test("Sources home offers the catalogue surfaces and owns its composer in the hero", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 820 });
  await page.goto("/sources", { waitUntil: "domcontentloaded" });

  const home = page.getByTestId("sources-home");
  await expect(home).toBeVisible();
  await expect(home.getByRole("heading", { name: "Sources" })).toBeVisible();

  // Standalone mode homes keep the composer in-flow in the hero on phones and
  // reserve no bottom dock (AGENTS.md "Search chrome behaviour").
  await expect(page.locator(".mode-home-composer-slot").getByTestId("global-search-input")).toHaveCount(1);
  await expect(page.locator('form.answer-footer-search-dock[data-footer-variant="compact"]')).toHaveCount(0);

  await page.getByTestId("sources-home-catalogue").click();
  await expect(page).toHaveURL(/\/sources\/search$/);
  await expect(page.getByTestId("sources-catalogue-main")).toBeVisible();
});

test("@critical Sources catalogue filters and opens traceability", async ({ page }) => {
  await page.goto("/sources/search?usedBy=dictionary", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("sources-catalogue-main")).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove Used in: Dictionary filter" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("source");

  await page.getByTestId("sources-filter-trigger-desktop").click();
  const sheet = page.getByTestId("sources-filter-sheet");
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: /D · Review required/ }).click();
  await expect(page).toHaveURL(/band=D/);

  await page.keyboard.press("Escape");
  await page
    .getByRole("link", { name: /view source details/i })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 2, name: "Where this source is used" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to sources" })).toBeVisible();
});

test("Sources remains operable at phone width and under accessibility media", async ({
  page,
  browserName,
}, testInfo) => {
  test.skip(browserName !== "chromium", "forced-colors emulation is Chromium-only");
  await page.setViewportSize({ width: 320, height: 760 });
  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
  await page.goto("/sources/search");
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
