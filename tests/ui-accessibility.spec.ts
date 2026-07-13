import { expect, test, type Page } from "playwright/test";

const readySetupChecks = [
  { id: "env", label: ".env.local configured", status: "ready", detail: "Test environment ready." },
  { id: "project", label: "Clinical KB Database target", status: "ready", detail: "Test Supabase project ready." },
  { id: "schema", label: "supabase/schema.sql applied", status: "ready", detail: "Test schema ready." },
  { id: "search", label: "Search RPC and vector indexes", status: "ready", detail: "Test search schema ready." },
  { id: "openai", label: "OpenAI API key available", status: "ready", detail: "Test OpenAI ready." },
  { id: "worker", label: "npm run worker running", status: "unknown", detail: "Worker not required for UI smoke." },
];
const uiAssertionTimeoutMs = 5_000;

async function mockMinimalDashboardApi(page: Page) {
  await page.route("**/api/setup-status**", async (route) => {
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
  await expect(page.getByRole("heading", { level: 1, name: "Clinical Guide" })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Answer" })).toBeVisible();
  await expect(page.locator('[aria-label^="Search indexed guidelines by question or keyword"]:visible')).toBeVisible();
  await expect(page.getByRole("button", { name: "Open answer options" })).toBeVisible();
  await expectNoPageHorizontalOverflow(page);
}

async function openScopeControl(page: Page) {
  const trigger = page.getByRole("button", { name: "Open answer options" });
  const menu = page.getByTestId("daily-actions-menu");

  await expect(async () => {
    if (await menu.isVisible().catch(() => false)) return;
    await trigger.click();
    await expect(menu).toBeVisible({ timeout: uiAssertionTimeoutMs });
  }).toPass({ timeout: 10_000 });

  await menu.getByRole("menuitem", { name: "Scope", exact: true }).click();
  await expect(page.locator('[data-testid="scope-command-popover"]:visible')).toBeVisible({
    timeout: uiAssertionTimeoutMs,
  });
}

test.describe("Clinical KB accessibility media smoke", () => {
  test.describe.configure({ timeout: 60_000 });

  test("dashboard remains usable with reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await mockMinimalDashboardApi(page);
    await gotoApp(page);

    await expectDashboardUsable(page);
    await openScopeControl(page);
    await expectNoPageHorizontalOverflow(page);
  });

  test("dashboard remains usable with forced colors", async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await page.setViewportSize({ width: 390, height: 844 });
    await mockMinimalDashboardApi(page);
    await gotoApp(page);

    await expectDashboardUsable(page);
    await openScopeControl(page);
    await expectNoPageHorizontalOverflow(page);
  });

  test("dashboard remains usable at 200 percent zoom", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockMinimalDashboardApi(page);
    await gotoApp(page);
    await page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });

    await expectDashboardUsable(page);
    await expectNoPageHorizontalOverflow(page);
  });
});
