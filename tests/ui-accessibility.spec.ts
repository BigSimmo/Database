import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "playwright/test";
import { stubZeroTouchPoints } from "./helpers/zero-touch";

const readySetupChecks = [
  { id: "env", label: ".env.local configured", status: "ready", detail: "Test environment ready." },
  { id: "project", label: "Clinical KB Database target", status: "ready", detail: "Test Supabase project ready." },
  { id: "schema", label: "supabase/schema.sql applied", status: "ready", detail: "Test schema ready." },
  { id: "search", label: "Search RPC and vector indexes", status: "ready", detail: "Test search schema ready." },
  { id: "openai", label: "OpenAI API key available", status: "ready", detail: "Test OpenAI ready." },
  { id: "worker", label: "npm run worker running", status: "unknown", detail: "Worker not required for UI smoke." },
];
const uiAssertionTimeoutMs = 5_000;

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

async function mockMinimalDashboardApi(page: Page) {
  await blockExternalRequests(page);
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
  await page.route(/\/api\/ingestion\/quality(?:\?.*)?$/, async (route) => {
    await route.fulfill({ json: { items: [] } });
  });
  await page.route(/\/api\/registry\/records(?:\?.*)?$/, async (route) => {
    await route.fulfill({ json: { records: [], total: 0, governance: {} } });
  });
  await page.route(/\/api\/search\/universal(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      json: {
        query: "",
        contextMode: "differentials",
        preferredDomains: [],
        domainOrder: [],
        groups: [],
      },
    });
  });
}

async function mockDifferentialSearch(page: Page) {
  await page.route(/\/api\/search(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      json: {
        results: [],
        visualEvidence: [],
        relatedDocuments: [],
        documentMatches: [
          {
            document_id: "11111111-1111-4111-8111-111111111111",
            title: "Acute confusion differential guide",
            file_name: "acute-confusion-differentials.pdf",
            labels: [],
            summarySnippet: "Reviewed acute confusion differential guidance.",
            bestPages: [1],
            bestChunkIds: ["chunk-acute-confusion"],
            imageCount: 0,
            tableCount: 0,
            matchReason: "Matched indexed passage",
            score: 0.93,
          },
        ],
        relevance: { verdict: "strong", score: 0.91, directSourceCount: 1, weakSourceCount: 0 },
        smartPanel: {},
        telemetry: { query_class: "differential_compare", retrieval_strategy: "text_fast_path" },
        scope: { queryMode: "compare_guidance" },
        sourceGovernanceWarnings: [],
        demoMode: true,
      },
    });
  });
}

async function gotoApp(page: Page, path = "/") {
  await page.goto(path, { waitUntil: "domcontentloaded" });
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

test.beforeEach(stubZeroTouchPoints);

test.describe("Clinical KB accessibility coverage", () => {
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

  test("scripted scrolls honour the reduced-motion preference", async ({ page }) => {
    // ANIM-01 (WCAG 2.3.3): the scripted scrollTo/scrollIntoView calls resolve their
    // behaviour through resolveScrollBehavior(), so a reduced-motion preference must
    // turn them into instant ("auto") jumps instead of smooth animations. Record the
    // behaviour argument every scroll call receives, then trigger a known one.
    await page.addInitScript(() => {
      const store: string[] = [];
      (window as unknown as { __scrollBehaviors: string[] }).__scrollBehaviors = store;
      const record = (behavior?: ScrollBehavior) => store.push(behavior ?? "auto");
      const origScrollTo = Element.prototype.scrollTo;
      Element.prototype.scrollTo = function scrollTo(this: Element, ...args: unknown[]) {
        const options = args[0];
        if (options && typeof options === "object" && "behavior" in options) {
          record((options as ScrollToOptions).behavior);
        }
        return (origScrollTo as (...callArgs: unknown[]) => void).apply(this, args);
      } as typeof Element.prototype.scrollTo;
      const origScrollIntoView = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = function scrollIntoView(this: Element, ...args: unknown[]) {
        const options = args[0];
        if (options && typeof options === "object" && "behavior" in options) {
          record((options as ScrollIntoViewOptions).behavior);
        }
        return (origScrollIntoView as (...callArgs: unknown[]) => void).apply(this, args);
      } as typeof Element.prototype.scrollIntoView;
    });

    const readBehaviours = () =>
      page.evaluate(() => (window as unknown as { __scrollBehaviors: string[] }).__scrollBehaviors);
    const resetBehaviours = () =>
      page.evaluate(() => {
        (window as unknown as { __scrollBehaviors: string[] }).__scrollBehaviors.length = 0;
      });

    await page.setViewportSize({ width: 1280, height: 800 });
    await mockMinimalDashboardApi(page);

    // Reduced motion → every scripted scroll must be an instant "auto" jump.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoApp(page);
    await expectDashboardUsable(page);
    await resetBehaviours();
    await page.getByRole("button", { name: "New chat" }).first().click();
    await expect.poll(readBehaviours).not.toHaveLength(0);
    const reduced = await readBehaviours();
    expect(reduced, "reduced motion must not animate scripted scrolls").not.toContain("smooth");
    expect(reduced.every((behaviour) => behaviour === "auto")).toBe(true);

    // No preference → the same action animates smoothly.
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await resetBehaviours();
    await page.getByRole("button", { name: "New chat" }).first().click();
    await expect.poll(readBehaviours).not.toHaveLength(0);
    expect(await readBehaviours(), "no-preference should animate scripted scrolls").toContain("smooth");
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

  test("phone privacy link meets the tap target and guests do not poll private ingestion routes", async ({ page }) => {
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
      [page.getByRole("link", { name: "Privacy and data processing", exact: true })].map((target) =>
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

  test("solid-button label tokens stay legible with forced colors", async ({ browserName, page }) => {
    test.skip(
      browserName === "webkit",
      "WebKit has no forced-colors implementation; Playwright's forcedColors emulation cannot engage the @media (forced-colors: active) token remap under test (the guarded glyph-backplate behavior is Chromium's).",
    );
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

  test("differential result types are pressed filters instead of tabs", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockMinimalDashboardApi(page);
    await mockDifferentialSearch(page);
    await gotoApp(page, "/differentials");

    await page.locator('input[placeholder="Ask or search a presentation"]:visible').first().fill("acute confusion");
    await page.locator('button[aria-label="Search differential presentations"]:visible').click();
    await expect(page.getByTestId("differentials-search-results")).toBeVisible();

    const filterGroup = page.getByRole("group", { name: "Result type" });
    await expect(filterGroup).toBeVisible();
    await expect(filterGroup.getByRole("tab")).toHaveCount(0);
    const allFilter = filterGroup.getByRole("button", { name: /^All \(\d+\)$/ });
    const presentationsFilter = filterGroup.getByRole("button", { name: /^Presentations \(\d+\)$/ });
    const diagnosesFilter = filterGroup.getByRole("button", { name: /^Diagnoses \(\d+\)$/ });
    await expect(allFilter).toHaveAttribute("aria-pressed", "true");
    await expect(presentationsFilter).toHaveAttribute("aria-pressed", "false");

    await presentationsFilter.focus();
    await page.keyboard.press("Space");
    await expect(presentationsFilter).toHaveAttribute("aria-pressed", "true");
    await expect(allFilter).toHaveAttribute("aria-pressed", "false");

    await diagnosesFilter.focus();
    await page.keyboard.press("Enter");
    await expect(diagnosesFilter).toHaveAttribute("aria-pressed", "true");
    await expect(presentationsFilter).toHaveAttribute("aria-pressed", "false");
  });

  test("guest upload action exposes the admin boundary and opens the source library", async ({ page }) => {
    await page.setViewportSize({ width: 414, height: 820 });
    await mockMinimalDashboardApi(page);
    await gotoApp(page);

    const menuTrigger = page.getByRole("button", { name: "Open answer options" });
    await expect(menuTrigger).toBeVisible();
    await menuTrigger.click();
    const menu = page.getByTestId("daily-actions-menu");
    await expect(menu).toBeVisible();
    await menu.getByRole("menuitem", { name: "Add document" }).click();
    await expect(page.getByRole("dialog", { name: "Upload and indexing" })).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: "Source library" })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Upload and indexing tools are admin-only" })).toContainText(
      "Upload and indexing tools are admin-only. Use the source library to open indexed documents.",
    );
  });

  test("Therapy Compass preserves focus, selection, tap targets, and fixed paper tokens", async ({
    page,
  }, testInfo) => {
    test.setTimeout(300_000);
    await page.emulateMedia({ colorScheme: "dark" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/therapy-compass", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Therapy mode", exact: true })).toBeVisible({
      timeout: 60_000,
    });

    for (const width of [320, 390, 639, 768, 1440, 1920]) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
      await expectNoPageHorizontalOverflow(page);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/therapy-compass/search", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Therapy Search" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: "Search", exact: true })).toHaveAttribute("aria-current", "page");

    const searchInput = page.getByRole("textbox", { name: "Search therapies" });
    await searchInput.focus();
    const inputFocus = await searchInput.evaluate((element) => {
      const style = getComputedStyle(element);
      return { outlineStyle: style.outlineStyle, outlineWidth: Number.parseFloat(style.outlineWidth) };
    });
    expect(inputFocus.outlineStyle).not.toBe("none");
    expect(inputFocus.outlineWidth).toBeGreaterThanOrEqual(2);

    const clearButtonSize = await page
      .locator('[data-screen-label="Search"]')
      .getByRole("button", { name: "Clear", exact: true })
      .evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return { width: bounds.width, height: bounds.height };
      });
    expect(clearButtonSize.height).toBeGreaterThanOrEqual(44);

    await expectNoPageHorizontalOverflow(page);

    await page.goto("/therapy-compass/cognitive-behavioural-therapy-cbt/brief", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByRole("heading", { name: "Brief Intervention" })).toBeVisible({ timeout: 60_000 });
    const durationGroup = page.getByRole("group", { name: "Brief intervention duration" });
    const fiveMinuteButton = durationGroup.getByRole("button", { name: "5 minutes", exact: true });
    const fifteenMinuteButton = durationGroup.getByRole("button", { name: "15 minutes", exact: true });
    await expect(fiveMinuteButton).toHaveAttribute("aria-pressed", "true");
    await fifteenMinuteButton.click();
    await expect(fiveMinuteButton).toHaveAttribute("aria-pressed", "false");
    await expect(fifteenMinuteButton).toHaveAttribute("aria-pressed", "true");

    await page.goto("/therapy-compass/cognitive-behavioural-therapy-cbt/sheet", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByRole("heading", { name: "Patient Sheet Builder" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: "Plain", exact: true })).toHaveAttribute("aria-pressed", "true");

    const clinicianSwitch = page.getByRole("switch", { name: "Show clinician footer" });
    const clinicianSwitchSize = await clinicianSwitch.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return { width: bounds.width, height: bounds.height };
    });
    expect(clinicianSwitchSize.width).toBeGreaterThanOrEqual(44);
    expect(clinicianSwitchSize.height).toBeGreaterThanOrEqual(44);

    const therapyPicker = page.locator("button.tc-screens-sheets-screen-051");
    await expect(therapyPicker).toHaveAttribute("aria-expanded", "false");
    await therapyPicker.click();
    await expect(therapyPicker).toHaveAttribute("aria-expanded", "true");
    await therapyPicker.click();
    await expect(therapyPicker).toHaveAttribute("aria-expanded", "false");

    const paper = page.locator(".tc-paper");
    const paperColors = await paper.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        background: style.backgroundColor,
        ink: style.getPropertyValue("--tc-paper-ink").trim(),
        muted: style.getPropertyValue("--tc-paper-muted").trim(),
      };
    });
    expect(paperColors).toEqual({ background: "rgb(255, 255, 255)", ink: "#0f1720", muted: "#5b6472" });

    const editable = paper.locator('[contenteditable="true"]').first();
    await editable.focus();
    const editableOutline = await editable.evaluate((element) => getComputedStyle(element).outlineStyle);
    expect(editableOutline).not.toBe("none");
    await expectNoBlockingAxeViolations(page, testInfo);
  });
});
