import { expect, test, type Locator, type Page } from "playwright/test";

const readySetupChecks = [
  { id: "env", label: ".env.local configured", status: "ready", detail: "Test environment ready." },
  { id: "project", label: "Clinical KB Database target", status: "ready", detail: "Test Supabase project ready." },
  { id: "schema", label: "supabase/schema.sql applied", status: "ready", detail: "Test schema ready." },
  { id: "search", label: "Search RPC and vector indexes", status: "ready", detail: "Test search schema ready." },
  { id: "openai", label: "OpenAI API key available", status: "ready", detail: "Test OpenAI ready." },
  { id: "worker", label: "npm run worker running", status: "unknown", detail: "Worker not required for UI smoke." },
];

async function waitForReactEventHandler(locator: Locator, eventName: "onClick") {
  await expect
    .poll(
      async () =>
        locator.evaluate((element, reactEventName) => {
          const propsKey = Object.keys(element).find((key) => key.startsWith("__reactProps$"));
          if (!propsKey) return false;
          const props = (element as unknown as Record<string, Record<string, unknown>>)[propsKey];
          return typeof props?.[reactEventName] === "function";
        }, eventName),
      { timeout: 15_000 },
    )
    .toBe(true);
}

async function mockGuideShell(page: Page) {
  await page.route(/\/api\/local-project-id$/, async (route) => {
    await route.fulfill({
      json: {
        appName: "Clinical KB",
        projectId: "test-project",
        identityPath: "/api/local-project-id",
        localServer: {
          currentUrl: "http://localhost:4298",
          currentPort: 4298,
          projectPortStart: 4298,
          projectPortEnd: 53210,
          safeLocalOrigin: true,
          requestOrigin: null,
          requestReferer: null,
          unsafeLocalCaller: null,
        },
      },
    });
  });
  await page.route("**/api/setup-status**", async (route) => {
    await route.fulfill({ json: { demoMode: false, checks: readySetupChecks } });
  });
}

async function openGuide(page: Page) {
  const menuTrigger = page.getByRole("button", { name: "Open Clinical Guide menu" });
  await expect(menuTrigger).toBeVisible({ timeout: 15_000 });
  await waitForReactEventHandler(menuTrigger, "onClick");
  await menuTrigger.click();

  const menu = page.getByRole("dialog", { name: "Clinical Guide" });
  await expect(menu).toBeVisible();
  const settingsTrigger = menu.getByRole("button", { name: "Settings", exact: true });
  await waitForReactEventHandler(settingsTrigger, "onClick");
  await settingsTrigger.click();

  const settings = page.getByRole("dialog", { name: "Account & app" });
  await expect(settings).toBeVisible();
  const guideTrigger = settings.getByRole("button", { name: "Guide & help", exact: true });
  await waitForReactEventHandler(guideTrigger, "onClick");
  await guideTrigger.click();

  const dialog = page.getByRole("dialog", { name: "Clinical KB guide" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByPlaceholder("Search the guide")).toBeVisible();
  return dialog;
}

test.describe("Clinical KB Guide Centre chrome", () => {
  test("phone header and bottom search chrome hide together and leave the tab order", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 820 });
    await mockGuideShell(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#main-content").first()).toBeVisible({ timeout: 15_000 });

    const dialog = await openGuide(page);
    const scrollBody = dialog.locator(".polished-scroll");
    const footer = dialog.locator("[data-guide-mobile-footer]");
    const header = dialog.locator('[data-sheet-header="true"]');

    await expect(footer.locator("[data-guide-universal-search]")).toBeVisible();
    await expect(footer.locator("[data-guide-tour-action-row]")).toBeVisible();

    await scrollBody.evaluate((element) => {
      element.scrollTop = 140;
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await expect(footer).toHaveAttribute("aria-hidden", "true");
    await expect(footer).toHaveAttribute("inert", "");
    await expect(header).toHaveAttribute("aria-hidden", "true");
    await expect(header).toHaveAttribute("inert", "");

    await dialog.getByRole("button", { name: "Ask a better question" }).focus();
    const tabStopCount = await dialog.locator('button, input, [href], [tabindex]:not([tabindex="-1"])').count();
    for (let tabIndex = 0; tabIndex <= tabStopCount; tabIndex += 1) {
      await page.keyboard.press("Tab");
      await expect.poll(() => footer.evaluate((element) => element.contains(document.activeElement))).toBe(false);
      await expect.poll(() => header.evaluate((element) => element.contains(document.activeElement))).toBe(false);
    }

    await scrollBody.evaluate((element) => {
      element.scrollTop = 0;
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await expect(footer).toHaveAttribute("aria-hidden", "false");
    await expect(footer).not.toHaveAttribute("inert");
    await expect(header).toHaveAttribute("aria-hidden", "false");
    await expect(header).not.toHaveAttribute("inert");
  });
});
