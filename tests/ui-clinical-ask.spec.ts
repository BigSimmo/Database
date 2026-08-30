import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "playwright/test";

import { visibleByTestId } from "./playwright-settlement";

const clinicalAskEnabled = process.env.CLINICAL_ASK_ENABLED === "true";
const governedModes = [
  ["services", "Services"],
  ["forms", "Forms"],
  ["differentials", "Differentials"],
  ["formulation", "Formulation"],
  ["dsm", "DSM-5 Diagnosis"],
  ["specifiers", "Specifiers"],
  ["therapy-compass", "Therapy"],
] as const;

function composer(page: Page) {
  return visibleByTestId(page, "global-search-input");
}

function finalFrame(response: Record<string, unknown>) {
  return `event: final\ndata: ${JSON.stringify({ type: "final", payload: { response, feedback: null } })}\n\n`;
}

function answered(mode: (typeof governedModes)[number][0], label: string) {
  return {
    state: "answered",
    mode,
    lead: { id: "lead", text: `Synthetic governed answer for ${label}`, evidenceIds: ["e1"] },
    sections: [
      {
        id: "section",
        title: "Supported option",
        claims: [{ id: "claim", text: "Review the synthetic pathway.", evidenceIds: ["e1"] }],
      },
    ],
    evidence: [
      {
        id: "e1",
        tier: "catalogue",
        title: "Synthetic authority source",
        publisher: "Synthetic authority",
        jurisdiction: null,
        href: "/synthetic-source",
        extract: "Synthetic governed extract.",
        reviewState: "reviewed",
        publishedAt: null,
        updatedAt: null,
        retrievedAt: null,
      },
    ],
    conflicts: [],
    missingInformation: [],
    followUps: [],
    handoffs: [],
  };
}

async function fulfillSse(route: Route, response: Record<string, unknown>) {
  await route.fulfill({
    status: 200,
    contentType: "text/event-stream; charset=utf-8",
    headers: { "cache-control": "no-store" },
    body: finalFrame(response),
  });
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

test("@critical keeps dormant deployments in ordinary search without a Smart promise", async ({ page }) => {
  test.skip(clinicalAskEnabled, "Default-flag proof runs with Clinical Ask disabled.");
  await page.goto("/?mode=services");
  const input = composer(page);
  await expect(input).toBeVisible();
  await input.fill("Which service is best for ongoing support after discharge?");
  await expect(page.getByTestId("smart-search-intent-cue")).toHaveCount(0);
  await expect(page.getByTestId("smart-search-rotating-text")).toHaveCount(0);
  await input.press("Enter");
  await expect(page).toHaveURL(/\/services\/search\?.*run=1/);
});

test("@critical routes governed Smart questions in all seven modes without URL persistence", async ({ page }) => {
  test.skip(!clinicalAskEnabled, "Enabled Smart proof requires CLINICAL_ASK_ENABLED=true.");
  await page.route("**/api/clinical-ask/stream", async (route) => {
    const request = route.request().postDataJSON() as { mode: (typeof governedModes)[number][0] };
    const label = governedModes.find(([mode]) => mode === request.mode)?.[1] ?? request.mode;
    await fulfillSse(route, answered(request.mode, label));
  });

  for (const [mode, label] of governedModes) {
    await page.goto(`/?mode=${mode}`);
    const input = composer(page);
    await expect(input).toBeVisible();
    await input.fill("Which option is best for ongoing support after discharge?");
    await expect(page.getByTestId("smart-search-intent-cue")).toBeVisible();
    await input.press("Enter");
    await expect(page.getByRole("heading", { name: `Synthetic governed answer for ${label}` })).toBeVisible();
    const url = new URL(page.url());
    expect(url.searchParams.has("q")).toBe(false);
    expect(url.searchParams.has("query")).toBe(false);
    expect(url.searchParams.has("run")).toBe(false);
  }
});

test("@critical keeps lookup commands and punctuation-terminated form codes in ordinary search", async ({ page }) => {
  test.skip(!clinicalAskEnabled, "Enabled Smart proof requires CLINICAL_ASK_ENABLED=true.");
  await page.goto("/?mode=forms");
  const input = composer(page);
  await input.fill("form 4A?");
  await expect(page.getByTestId("smart-search-intent-cue")).toHaveCount(0);
  await input.press("Enter");
  await expect(page).toHaveURL(/\/forms\/search\?.*run=1/);
});

test("@critical retains offline questions only in tab memory and returns to an empty focused search", async ({
  page,
}) => {
  test.skip(!clinicalAskEnabled, "Enabled Smart proof requires CLINICAL_ASK_ENABLED=true.");
  await page.goto("/?mode=services");
  const input = composer(page);
  const question = "Which service is best for ongoing support after discharge?";
  const historyLength = await page.evaluate(() => history.length);
  await page.context().setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await input.fill(question);
  await input.press("Enter");

  await expect(page.getByRole("heading", { name: "Clinical Ask could not complete" })).toBeVisible();
  expect(new URL(page.url()).searchParams.has("q")).toBe(false);
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  expect(
    await page.evaluate(
      (rawQuestion) => Object.values(localStorage).some((value) => value.includes(rawQuestion)),
      question,
    ),
  ).toBe(false);

  await page.getByRole("button", { name: "Return to search" }).click();
  await page.context().setOffline(false);
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("");
  expect(new URL(page.url()).searchParams.has("q")).toBe(false);
});

test("@critical keeps mode-unavailable questions private and never offers an automatic fallback", async ({ page }) => {
  test.skip(!clinicalAskEnabled, "Enabled Smart proof requires CLINICAL_ASK_ENABLED=true.");
  await page.route("**/api/clinical-ask/stream", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/event-stream; charset=utf-8",
      body: 'event: error\ndata: {"type":"error","code":"mode_unavailable","retryable":false,"message":"Smart answers are not available for this mode."}\n\n',
    }),
  );
  await page.goto("/?mode=services");
  const input = composer(page);
  const question = "Which service is best for ongoing support after discharge?";
  const historyLength = await page.evaluate(() => history.length);
  await input.fill(question);
  await input.press("Enter");

  await expect(page.getByText("Smart answers are not available for this mode.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry Smart answer" })).toHaveCount(0);
  await expect(input).toHaveValue(question);
  expect(new URL(page.url()).searchParams.has("q")).toBe(false);
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  expect(
    await page.evaluate(
      (rawQuestion) => Object.values(localStorage).some((value) => value.includes(rawQuestion)),
      question,
    ),
  ).toBe(false);
});

test("@critical retries explicitly and continues only after required clarification", async ({ page }) => {
  test.skip(!clinicalAskEnabled, "Enabled Smart proof requires CLINICAL_ASK_ENABLED=true.");
  let requestCount = 0;
  const requestBodies: Array<{ clarificationAnswers?: Record<string, string> }> = [];
  await page.route("**/api/clinical-ask/stream", async (route) => {
    requestCount += 1;
    requestBodies.push(route.request().postDataJSON());
    if (requestCount === 1) {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream; charset=utf-8",
        body: 'event: error\ndata: {"type":"error","code":"provider_unavailable","retryable":true,"message":"Synthetic retry."}\n\n',
      });
      return;
    }
    if (requestCount === 2) {
      await fulfillSse(route, {
        state: "clarification_required",
        mode: "services",
        suggestions: [],
        clarifications: [
          {
            id: "services:careSetting",
            field: "careSetting",
            prompt: "Which care setting is relevant?",
            required: true,
          },
        ],
      });
      return;
    }
    await fulfillSse(route, answered("services", "Services"));
  });

  await page.goto("/?mode=services");
  const input = composer(page);
  await input.fill("Which service is best for ongoing support after discharge?");
  await input.press("Enter");
  await page.getByRole("button", { name: "Retry Smart answer" }).click();

  const clarification = page.getByRole("textbox", { name: "Which care setting is relevant?" });
  const continueButton = page.getByRole("button", { name: "Continue with confirmed context" });
  await expect(clarification).toBeFocused();
  await expect(continueButton).toBeDisabled();
  await clarification.fill("community");
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
  await expect(page.getByRole("heading", { name: "Synthetic governed answer for Services" })).toBeVisible();
  expect(requestBodies[2]?.clarificationAnswers).toEqual({ "services:careSetting": "community" });
});

test("@critical keeps the Smart workspace accessible and within required viewports", async ({ page }, testInfo) => {
  test.skip(!clinicalAskEnabled, "Enabled Smart proof requires CLINICAL_ASK_ENABLED=true.");
  await page.route("**/api/clinical-ask/stream", (route) =>
    fulfillSse(route, answered("differentials", "Differentials")),
  );
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await page.emulateMedia({
      colorScheme: "dark",
      reducedMotion: "reduce",
      forcedColors: width === 320 ? "active" : "none",
    });
    await page.goto("/?mode=differentials");
    const input = composer(page);
    await input.fill("Which differential is best supported by this persistent presentation?");
    await input.press("Enter");
    await expect(page.getByRole("heading", { name: "Synthetic governed answer for Differentials" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(2);
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    await testInfo.attach(`smart-axe-${width}`, {
      body: JSON.stringify(axe.violations),
      contentType: "application/json",
    });
    expect(axe.violations.filter((item) => item.impact === "critical" || item.impact === "serious")).toEqual([]);
  }
});
