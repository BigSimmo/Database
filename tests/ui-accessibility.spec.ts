import { expect, test, type Page } from "playwright/test";

const readySetupChecks = [
  { id: "env", label: ".env.local configured", status: "ready", detail: "Test environment ready." },
  { id: "project", label: "Clinical KB Database target", status: "ready", detail: "Test Supabase project ready." },
  { id: "schema", label: "supabase/schema.sql applied", status: "ready", detail: "Test schema ready." },
  { id: "search", label: "Search RPC and vector indexes", status: "ready", detail: "Test search schema ready." },
  { id: "openai", label: "OpenAI API key available", status: "ready", detail: "Test OpenAI ready." },
  { id: "worker", label: "npm run worker running", status: "unknown", detail: "Worker not required for UI smoke." },
];

async function mockMinimalDashboardApi(page: Page) {
  await page.route(/\/api\/setup-status$/, async (route) => {
    await route.fulfill({
      json: { demoMode: false, checks: readySetupChecks },
    });
  });
  await page.route(/\/api\/documents(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      json: {
        documents: [],
        pagination: { limit: 150, offset: 0, total: 0, nextOffset: 0, hasMore: false },
      },
    });
  });
  await page.route(/\/api\/ingestion\/jobs(?:\?.*)?$/, async (route) => {
    await route.fulfill({ json: { jobs: [] } });
  });
  await page.route(/\/api\/ingestion\/batches(?:\?.*)?$/, async (route) => {
    await route.fulfill({ json: { batches: [] } });
  });
}

async function gotoApp(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
}

async function expectNoPageHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const documentWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0);
    return documentWidth - document.documentElement.clientWidth;
  });

  expect(overflow).toBeLessThanOrEqual(2);
}

async function expectDashboardUsable(page: Page) {
  await expect(page.getByRole("heading", { level: 1, name: "Clinical Guide" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Answer" })).toBeVisible();
  await expect(page.getByLabel("Search indexed guidelines by question or keyword")).toBeVisible();
  await expect(page.locator('[data-testid="scope-trigger"]:visible')).toBeVisible();
  await expectNoPageHorizontalOverflow(page);
}

async function openScopeControl(page: Page) {
  const scopeTrigger = page.locator('[data-testid="scope-trigger"]:visible');

  await expect(async () => {
    await scopeTrigger.click();
    await expect(page.locator('[data-testid="scope-command-popover"]:visible')).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 10_000 });
}

test.describe("Clinical KB accessibility media smoke", () => {
  test.describe.configure({ timeout: 60_000 });

  test("dashboard remains usable with reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 820 });
    await mockMinimalDashboardApi(page);
    await gotoApp(page);

    await expectDashboardUsable(page);
    await openScopeControl(page);
    await expectNoPageHorizontalOverflow(page);
  });

  test("dashboard remains usable with forced colors", async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await page.setViewportSize({ width: 390, height: 820 });
    await mockMinimalDashboardApi(page);
    await gotoApp(page);

    await expectDashboardUsable(page);
    await openScopeControl(page);
    await expectNoPageHorizontalOverflow(page);
  });
});
