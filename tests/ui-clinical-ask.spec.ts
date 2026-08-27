import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "playwright/test";

const formerClinicalAskModes = [
  ["services", "Services"],
  ["forms", "Forms"],
  ["differentials", "Differentials"],
  ["formulation", "Formulation"],
  ["dsm", "DSM-5 Diagnosis"],
  ["specifiers", "Specifiers"],
  ["therapy-compass", "Therapy"],
] as const;

async function composer(page: Page) {
  return page.getByTestId("global-search-input").filter({ visible: true }).first();
}

test.beforeEach(async ({ page }) => {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (
      ["http:", "https:"].includes(url.protocol) &&
      !["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)
    ) {
      await route.abort("blockedbyclient");
    } else await route.fallback();
  });
});

test("@critical omits Ask and Dictate from every supported mode home after typing", async ({ page }) => {
  for (const [mode, label] of formerClinicalAskModes) {
    await page.goto(`/?mode=${mode}`);
    const input = await composer(page);
    await expect(input).toBeVisible();
    await input.fill("Synthetic catalogue search");
    await expect(page.getByRole("button", { name: `Ask ${label}`, exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: `Dictate question for ${label}` })).toHaveCount(0);
    await expect(page.locator("[data-clinical-ask-actions]")).toHaveCount(0);
  }
});

test("@critical keeps the action rail absent after ordinary search submission", async ({ page }) => {
  await page.goto("/?mode=services");
  const input = await composer(page);
  await input.fill("Synthetic service search");
  await input.press("Enter");
  await expect(page).toHaveURL(/\/services\/search\?.*run=1/);
  await expect(await composer(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Ask Services", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Dictate question for Services" })).toHaveCount(0);

  await page.goto("/forms/search?q=probe&run=1");
  await expect(await composer(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Ask Forms", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Dictate question for Forms" })).toHaveCount(0);
});

test("@critical keeps the typed composer accessible and within required viewports", async ({ page }, testInfo) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await page.emulateMedia({
      colorScheme: "dark",
      reducedMotion: "reduce",
      forcedColors: width === 320 ? "active" : "none",
    });
    await page.goto("/?mode=differentials");
    const input = await composer(page);
    await input.fill("Synthetic comparison presentation");
    await expect(page.locator("[data-clinical-ask-actions]")).toHaveCount(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(2);
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    await testInfo.attach(`axe-${width}`, { body: JSON.stringify(axe.violations), contentType: "application/json" });
    expect(axe.violations.filter((item) => item.impact === "critical" || item.impact === "serious")).toEqual([]);
  }
});
