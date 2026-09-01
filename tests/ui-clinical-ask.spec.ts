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

const localOnlySmartModes = [
  ["prescribing", "/", "medicine that needs regular blood tests", "Warfarin"],
  ["tools", "/tools", "where can I check medication interactions?", "Medication Prescribing"],
  ["calculators", "/calculators/search", "screen depression severity", "PHQ-9"],
  [
    "factsheets",
    "/factsheets/search",
    "information for someone who worries all the time",
    "Generalised anxiety disorder",
  ],
  ["dictionary", "/dictionary/search", "term for hearing a voice that is not there", "Hallucination"],
] as const;

function composer(page: Page) {
  return visibleByTestId(page, "global-search-input");
}

function searchOwner(page: Page, mode: (typeof localOnlySmartModes)[number][0]) {
  return mode === "tools" ? page.getByRole("textbox", { name: "Search tools" }) : composer(page);
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

test("@critical keeps local-only Smart search within five catalogue modes", async ({ page }) => {
  let clinicalAskRequests = 0;
  let universalSearchRequests = 0;
  await page.route("**/api/clinical-ask/stream", async (route) => {
    clinicalAskRequests += 1;
    await route.abort("blockedbyclient");
  });
  await page.route("**/api/search/universal**", async (route) => {
    universalSearchRequests += 1;
    await route.abort("blockedbyclient");
  });

  for (const [mode, pathname, query, expectedResult] of localOnlySmartModes) {
    await page.goto(`/?mode=${mode}`);
    const input = searchOwner(page, mode);
    await input.fill(query);
    if (mode === "tools") {
      for (const excludedMode of ["Documents", "Answer", "Favourites"]) {
        await expect(page.getByRole("option", { name: excludedMode, exact: true })).toHaveCount(0);
      }
    } else {
      await expect(page.getByTestId("smart-search-intent-cue")).toContainText("Smart search");
      await expect(page.getByRole("listbox")).toBeVisible();
      for (const excludedMode of ["Documents", "Answer", "Favourites"]) {
        await expect(page.getByRole("option", { name: excludedMode, exact: true })).toHaveCount(0);
      }
      if (mode === "prescribing") {
        for (const documentAction of ["Browse library", "Scope sources", "Recent documents"]) {
          await expect(page.getByText(documentAction, { exact: true })).toHaveCount(0);
        }
      }
    }
    await input.press("Enter");

    await expect(page).toHaveURL((url) => {
      return (
        url.pathname === pathname &&
        url.searchParams.get("q") === query &&
        url.searchParams.get("run") === "1" &&
        (mode !== "prescribing" || url.searchParams.get("mode") === "prescribing")
      );
    });
    await expect(page.getByText(expectedResult, { exact: true }).first()).toBeVisible();
    expect(clinicalAskRequests).toBe(0);
    expect(universalSearchRequests).toBe(0);
  }
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
  for (const mode of ["documents", "answer", "favourites"]) {
    await page.goto(`/?mode=${mode}`);
    const input = composer(page);
    await input.fill("Which document should I read for this presentation?");
    await expect(page.getByTestId("smart-search-intent-cue")).toHaveCount(0);
    await expect(page.getByTestId("smart-search-rotating-text")).toHaveCount(0);
  }
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
