import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "playwright/test";

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
  await expect(page.locator("#main-content").first()).toBeVisible({ timeout: 15_000 });
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
  }).toPass({ timeout: 15_000 });

  await menu.getByRole("menuitem", { name: "Scope", exact: true }).click({ timeout: 15_000 });
  await expect(page.locator('[data-testid="scope-command-popover"]:visible')).toBeVisible({
    timeout: uiAssertionTimeoutMs,
  });
}

const axeWcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
// Advisory gate: only fail on the impacts a clinician-facing release must not ship.
// Lower-impact findings stay visible in the attached report without blocking the lane.
const axeBlockingImpacts = new Set(["critical", "serious"]);

async function expectNoBlockingAxeViolations(page: Page, testInfo: TestInfo, options?: { disableRules?: string[] }) {
  const builder = new AxeBuilder({ page }).withTags(axeWcagTags);
  if (options?.disableRules?.length) builder.disableRules(options.disableRules);
  const results = await builder.analyze();

  await testInfo.attach("axe-violations", {
    body: JSON.stringify(results.violations, null, 2),
    contentType: "application/json",
  });

  const blocking = results.violations.filter((violation) => axeBlockingImpacts.has(violation.impact ?? ""));
  const summary = blocking.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.help} — ${violation.nodes.length} node(s), see ${violation.helpUrl}`,
  );
  expect(summary, "axe found critical/serious WCAG A/AA violations").toEqual([]);
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

  test("mode menu dismisses when keyboard focus leaves its wrapper", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockMinimalDashboardApi(page);
    await gotoApp(page);
    await expectDashboardUsable(page);

    const modeButton = page.getByRole("button", { name: "Mode Answer", exact: true });
    const modeMenu = page.getByRole("menu", { name: "Choose app mode", exact: true });
    await modeButton.click();
    await expect(modeMenu).toBeVisible();
    await expect(modeButton).toHaveAttribute("aria-expanded", "true");

    await modeButton.press("Shift+Tab");
    await expect(modeMenu).toBeHidden();
    await expect(modeButton).toHaveAttribute("aria-expanded", "false");
  });

  test("phone quick actions meet the tap target and guests do not poll private ingestion routes", async ({ page }) => {
    const privateIngestionRequests: string[] = [];
    page.on("request", (request) => {
      if (/\/api\/ingestion\/(?:jobs|batches|quality)(?:\?|$)/.test(request.url())) {
        privateIngestionRequests.push(request.url());
      }
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await mockMinimalDashboardApi(page);
    await gotoApp(page);
    await expectDashboardUsable(page);

    const targetSizes = await Promise.all(
      [
        page.getByRole("button", { name: "Search documents", exact: true }),
        page.getByRole("button", { name: "Upload document", exact: true }),
        page.getByRole("link", { name: "Privacy and data processing", exact: true }),
      ].map((target) =>
        target.evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          return { width: bounds.width, height: bounds.height };
        }),
      ),
    );

    for (const targetSize of targetSizes) {
      expect(targetSize.width).toBeGreaterThanOrEqual(44);
      expect(targetSize.height).toBeGreaterThanOrEqual(44);
    }
    expect(privateIngestionRequests).toEqual([]);
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

  test("solid-button label tokens stay legible with forced colors", async ({ page }) => {
    // Chromium paints a Canvas backplate behind every glyph run in forced-colors
    // mode: a label whose color resolves into the Canvas/ButtonFace family
    // disappears into its own backplate (axe cannot see this — it reads CSS,
    // not painted pixels). Lock the glyph tokens to a non-Canvas resolution.
    await page.emulateMedia({ forcedColors: "active" });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await mockMinimalDashboardApi(page);
    await gotoApp(page);
    await expectDashboardUsable(page);

    const newChat = page.getByRole("button", { name: "New chat" }).first();
    await expect(newChat).toBeVisible();
    const { canvas, buttonLabelColor, tokenColors } = await newChat.evaluate((button) => {
      const probe = document.createElement("span");
      document.body.append(probe);
      const resolveColor = (value: string) => {
        probe.style.color = "";
        probe.style.color = value;
        return getComputedStyle(probe).color;
      };
      const resolvedCanvas = resolveColor("Canvas");
      const glyphTokens = [
        "--command-contrast",
        "--primary-contrast",
        "--clinical-accent-contrast",
        "--danger-solid-contrast",
      ].map((token) => [token, resolveColor(`var(${token})`)] as const);
      probe.remove();
      return {
        canvas: resolvedCanvas,
        buttonLabelColor: getComputedStyle(button).color,
        tokenColors: glyphTokens,
      };
    });

    expect(buttonLabelColor).not.toBe(canvas);
    for (const [token, color] of tokenColors) {
      expect(`${token}: ${color}`).not.toBe(`${token}: ${canvas}`);
    }
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

  test("dashboard passes axe WCAG A/AA scan with default colors", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockMinimalDashboardApi(page);
    await gotoApp(page);

    // Scan only after the usability gate: the shell double-renders during hydration and a
    // premature scan reports duplicated-landmark false positives.
    await expectDashboardUsable(page);
    await expectNoBlockingAxeViolations(page, testInfo);
  });

  test("dashboard passes axe WCAG A/AA scan with forced colors", async ({ page }, testInfo) => {
    await page.emulateMedia({ forcedColors: "active" });
    await page.setViewportSize({ width: 390, height: 844 });
    await mockMinimalDashboardApi(page);
    await gotoApp(page);

    await expectDashboardUsable(page);
    // color-contrast is unreliable under forced-colors emulation (the OS palette overrides
    // author colors); contrast is asserted by the default-colors scan instead.
    await expectNoBlockingAxeViolations(page, testInfo, { disableRules: ["color-contrast"] });
  });
});
