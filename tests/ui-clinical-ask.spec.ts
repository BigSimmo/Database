import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "playwright/test";

import { visibleByTestId } from "./playwright-settlement";

const smartModes = [
  ["services", "/services/search", "Where can a young person get support after discharge?"],
  ["forms", "/forms/search", "Which form extends detention?"],
  ["differentials", "/differentials/search", "What can cause hearing voices?"],
  ["formulation", "/formulation/search", "Why do I keep going over it?"],
  ["dsm", "/dsm/search", "Which diagnoses involve elevated mood?"],
  ["specifiers", "/specifiers/search", "Which specifier describes anxiety symptoms?"],
  ["therapy-compass", "/therapy-compass/search", "Which therapy helps with emotion regulation?"],
] as const;

function composer(page: Page) {
  return visibleByTestId(page, "global-search-input");
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

test("@critical keeps natural-language Smart search inside all seven selected modes", async ({ page }) => {
  let clinicalAskRequests = 0;
  await page.route("**/api/clinical-ask/stream", async (route) => {
    clinicalAskRequests += 1;
    await route.abort("blockedbyclient");
  });

  for (const [mode, pathname, query] of smartModes) {
    await page.goto(`/?mode=${mode}`);
    const input = composer(page);
    await expect(input).toBeVisible();
    await input.fill(query);
    await expect(page.getByTestId("smart-search-intent-cue")).toContainText("Smart search");
    await expect(page.getByRole("button", { name: "Get Smart answer" })).toHaveCount(0);
    await input.press("Enter");

    await expect(page).toHaveURL((url) => {
      return url.pathname === pathname && url.searchParams.get("q") === query && url.searchParams.get("run") === "1";
    });
    await expect(page.locator(".search-band-subject:visible")).toContainText(query);
  }

  expect(clinicalAskRequests).toBe(0);
});

test("@critical keeps compact codes literal and uses the ordinary Forms result route", async ({ page }) => {
  let clinicalAskRequests = 0;
  await page.route("**/api/clinical-ask/stream", async (route) => {
    clinicalAskRequests += 1;
    await route.abort("blockedbyclient");
  });

  await page.goto("/?mode=forms");
  const input = composer(page);
  await input.fill("form 4A?");
  await expect(page.getByTestId("smart-search-intent-cue")).toHaveCount(0);
  await input.press("Enter");
  await expect(page).toHaveURL((url) => {
    return url.pathname === "/forms/search" && url.searchParams.get("q") === "form 4A?";
  });
  expect(clinicalAskRequests).toBe(0);
});

test("@critical keeps unsupported modes free of a Smart promise", async ({ page }) => {
  await page.goto("/?mode=documents");
  const input = composer(page);
  await input.fill("Which document should I read for this presentation?");
  await expect(page.getByTestId("smart-search-intent-cue")).toHaveCount(0);
  await expect(page.getByTestId("smart-search-rotating-text")).toHaveCount(0);
});

test("@critical keeps the one-composer Smart cue accessible across phone and desktop", async ({ page }, testInfo) => {
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: width === 320 ? 844 : 900 });
    await page.emulateMedia({
      colorScheme: "dark",
      reducedMotion: "reduce",
      forcedColors: width === 320 ? "active" : "none",
    });
    await page.goto("/?mode=differentials");
    const input = composer(page);
    await input.fill("What can cause hearing voices?");
    await expect(page.getByText("Smart search selected for Differentials.")).toHaveCount(1);
    if (width >= 640) await expect(page.getByTestId("smart-search-intent-cue")).toBeVisible();
    await expect(page.locator('[data-testid="global-search-input"]:visible')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);

    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    await testInfo.attach(`smart-search-axe-${width}`, {
      body: JSON.stringify(axe.violations),
      contentType: "application/json",
    });
    expect(axe.violations.filter((item) => item.impact === "critical" || item.impact === "serious")).toEqual([]);
  }
});
