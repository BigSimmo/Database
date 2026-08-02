import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "playwright/test";
import { stubZeroTouchPoints } from "./helpers/zero-touch";
import { visibleByTestId } from "./playwright-settlement";

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

  test("an open sheet deactivates the page behind it and releases it on close", async ({ page }) => {
    // jsdom cannot enforce `inert`, so the browser is the only place the modal
    // containment contract (and its release) can actually be proven.
    await page.setViewportSize({ width: 390, height: 844 });
    await mockMinimalDashboardApi(page);
    await gotoApp(page);
    await expectDashboardUsable(page);

    const readState = () =>
      page.evaluate(() => {
        const marked = Array.from(document.querySelectorAll('[data-sheet-inert="true"]'));
        const dialog = document.querySelector('[role="dialog"]');
        const background = marked.flatMap((element) => Array.from(element.querySelectorAll("button, a[href]"))).at(0);
        let focusRefused: boolean | null = null;
        if (background instanceof HTMLElement) {
          const before = document.activeElement;
          background.focus();
          focusRefused = document.activeElement !== background;
          if (before instanceof HTMLElement) before.focus();
        }
        return {
          marked: marked.length,
          allInert: marked.every((element) => element.hasAttribute("inert")),
          dialogIsMarked: dialog != null && dialog.closest('[data-sheet-inert="true"]') != null,
          focusInDialog: dialog != null && document.activeElement != null && dialog.contains(document.activeElement),
          focusRefused,
          overflow: document.body.style.overflow,
        };
      });

    const modeButton = page.getByRole("button", { name: "Mode Answer", exact: true });
    await modeButton.click();
    await expect(page.locator('[role="dialog"]').first()).toBeVisible();

    const open = await readState();
    expect(open.marked, "background should be deactivated behind the sheet").toBeGreaterThan(0);
    expect(open.allInert).toBe(true);
    expect(open.dialogIsMarked, "the sheet itself must stay interactive").toBe(false);
    expect(open.focusInDialog).toBe(true);
    expect(open.focusRefused, "the browser must refuse focus into the deactivated background").toBe(true);
    expect(open.overflow).toBe("hidden");

    await page.keyboard.press("Escape");
    await expect(page.locator('[role="dialog"]').first()).toBeHidden();

    await expect
      .poll(async () => (await readState()).marked, { message: "inert markers must be released on close" })
      .toBe(0);
    expect(await page.locator("[inert]").count()).toBe(0);
    await expect(modeButton).toBeFocused();
    expect((await readState()).overflow).toBe("");
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

  test("differential result types use an accessible mobile filter instead of tabs", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockMinimalDashboardApi(page);
    await mockDifferentialSearch(page);
    await gotoApp(page, "/differentials");

    // Retry fill-then-enabled together: the server-rendered composer is visible
    // before React controls it, and a fill landing in that gap is discarded by
    // hydration, leaving the search button disabled and the click a no-op.
    const presentationInput = page.locator('input[placeholder="Ask or search a presentation"]:visible').first();
    const differentialSubmit = page.locator('button[aria-label="Search differential presentations"]:visible');
    await expect(async () => {
      await presentationInput.fill("acute confusion");
      await expect(presentationInput).toHaveValue("acute confusion");
      await expect(differentialSubmit).toBeEnabled({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    await differentialSubmit.click();
    await expect(visibleByTestId(page, "differentials-search-results")).toBeVisible();

    const filterSelect = page.getByTestId("differential-result-type-select");
    await expect(filterSelect).toBeVisible();
    await expect(filterSelect).toHaveAccessibleName("Filter by result type");
    await expect(filterSelect).toHaveValue("all");
    await expect(page.getByRole("tab")).toHaveCount(0);

    await filterSelect.focus();
    await expect(filterSelect).toBeFocused();
    await filterSelect.selectOption("presentation");
    await expect(filterSelect).toHaveValue("presentation");
    await filterSelect.selectOption("diagnosis");
    await expect(filterSelect).toHaveValue("diagnosis");
  });

  test("guest upload action exposes the admin boundary and opens Sources", async ({ page }) => {
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
    const sourcesDialog = page.getByRole("dialog", { name: "Sources" });
    await expect(sourcesDialog).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Upload and indexing tools are admin-only" })).toContainText(
      "Upload and indexing tools are admin-only. Use Sources to open indexed documents.",
    );
    await sourcesDialog.getByRole("button", { name: "Close Sources" }).click();
    await expect(sourcesDialog).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const activeElement = document.activeElement;
          return activeElement instanceof HTMLElement
            ? `${activeElement.tagName}:${activeElement.getAttribute("aria-label") ?? activeElement.textContent?.trim() ?? ""}:${activeElement.getClientRects().length > 0 ? "visible" : "hidden"}`
            : "none";
        }),
      )
      .toBe("BUTTON:Open documents options:visible");
  });

  test("Therapy Compass preserves focus, selection, tap targets, and fixed paper tokens", async ({
    page,
  }, testInfo) => {
    test.setTimeout(300_000);
    await page.emulateMedia({ colorScheme: "dark" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/therapy-compass", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Therapy", exact: true })).toBeVisible({
      timeout: 60_000,
    });

    for (const width of [320, 390, 639, 768, 1440, 1920]) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
      await expectNoPageHorizontalOverflow(page);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/therapy-compass/search", { waitUntil: "domcontentloaded" });
    // The shared `ModeNav` routes with real hrefs, so the current page is a
    // link with `aria-current`, not a button with an onClick. Deep links,
    // middle-click, back and prefetch all work as a result.
    await expect(
      page.getByRole("navigation", { name: "Therapy pages" }).getByRole("link", { name: "Search", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    const therapyRibbon = page.getByTestId("search-query-ribbon");
    await expect(therapyRibbon.getByRole("heading", { name: "All", level: 1 })).toBeVisible({ timeout: 60_000 });
    await expect(therapyRibbon.getByRole("group", { name: "Filter therapy results" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Search therapies" })).toHaveCount(0);
    // Topics and availability used to be two native `<select>`s faking
    // multi-select: `value` pinned to "", a literal "✓ " prefix in option text,
    // and the placeholder row doing the reporting ("1 topics selected"). A
    // listbox cannot express "three of these are on", so assistive technology
    // was told the opposite of what the visible text said. Both are now
    // `aria-pressed` toggles inside a dialog, matching the wide viewport.
    const therapyFilterTrigger = therapyRibbon.getByTestId("therapy-filter-trigger");
    await expect(therapyFilterTrigger).toBeVisible();
    await expect(therapyFilterTrigger).toHaveAccessibleName(/Filter/);
    await expect(therapyFilterTrigger).toHaveAttribute("aria-haspopup", "dialog");

    await therapyFilterTrigger.focus();
    const triggerFocus = await therapyFilterTrigger.evaluate((element) => {
      const style = getComputedStyle(element);
      return { outlineStyle: style.outlineStyle, outlineWidth: Number.parseFloat(style.outlineWidth) };
    });
    expect(triggerFocus.outlineStyle).not.toBe("none");
    expect(triggerFocus.outlineWidth).toBeGreaterThanOrEqual(2);

    const triggerSize = await therapyFilterTrigger.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return { width: bounds.width, height: bounds.height };
    });
    // 44, not 48. This trigger sits in the ribbon's utility row beside
    // `ResultSortControl`, which is `min-h-tap` (44px) — raising only this
    // control would leave the row visibly ragged. The repo's `min-h-12` rule
    // exists to stop generic a11y advice pulling production down to `min-h-11`
    // (a known `ui-smoke` flake), not to override a page's own row rhythm; the
    // sheet's own toggles, which have the room, are `min-h-12`.
    expect(triggerSize.width).toBeGreaterThanOrEqual(44);
    expect(triggerSize.height).toBeGreaterThanOrEqual(44);

    await therapyFilterTrigger.click();
    const therapyFilterPanel = page.getByTestId("therapy-filter-panel");
    await expect(therapyFilterPanel).toBeVisible();
    await expect(therapyFilterTrigger).toHaveAttribute("aria-expanded", "true");
    const therapyPanelId = await therapyFilterPanel.getAttribute("id");
    expect(therapyPanelId).toBeTruthy();
    await expect(therapyFilterTrigger).toHaveAttribute("aria-controls", therapyPanelId!);

    // The state the old select could not express: selection is on the control
    // itself, and turning one on leaves the others alone.
    const cbtToggle = therapyFilterPanel.getByRole("button", { name: "CBT" });
    const reviewedToggle = therapyFilterPanel.getByRole("button", { name: "Reviewed only" });
    await expect(cbtToggle).toHaveAttribute("aria-pressed", "false");
    await cbtToggle.click();
    await expect(cbtToggle).toHaveAttribute("aria-pressed", "true");
    await reviewedToggle.click();
    await expect(reviewedToggle).toHaveAttribute("aria-pressed", "true");
    await expect(cbtToggle).toHaveAttribute("aria-pressed", "true");

    await therapyFilterPanel.getByTestId("therapy-filter-clear").click();
    await expect(cbtToggle).toHaveAttribute("aria-pressed", "false");
    await expect(reviewedToggle).toHaveAttribute("aria-pressed", "false");

    await therapyFilterPanel.getByTestId("therapy-filter-done").click();
    await expect(therapyFilterPanel).toHaveCount(0);

    // End-to-end guard the component tests cannot give: it is `SearchScreen`
    // that decides what the trigger counts. A query-only session must offer
    // Clear all (the phone's only route to `clearSearch`) while the badge still
    // reports no filters, because a search term is not a filter.
    await page.goto("/therapy-compass/search?q=anxiety", { waitUntil: "domcontentloaded" });
    await expect(therapyRibbon.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 60_000 });
    const queryOnlyTrigger = therapyRibbon.getByTestId("therapy-filter-trigger");
    await expect(queryOnlyTrigger).toHaveAccessibleName(/No filters active/);
    await queryOnlyTrigger.click();
    const queryOnlyPanel = page.getByTestId("therapy-filter-panel");
    await expect(queryOnlyPanel.getByTestId("therapy-filter-clear")).toBeVisible();
    await queryOnlyPanel.getByTestId("therapy-filter-done").click();

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

    // Sheet builder therapy picker — the only aria-expanded control in the builder rail.
    const builderPicker = page.locator("[data-therapy-root] button[aria-expanded]").first();
    await expect(builderPicker).toHaveAttribute("aria-expanded", "false");
    await builderPicker.click();
    await expect(builderPicker).toHaveAttribute("aria-expanded", "true");
    await builderPicker.click();
    await expect(builderPicker).toHaveAttribute("aria-expanded", "false");

    const paper = page.locator("[data-therapy-paper]");
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
  // The accent rail must be the card's real border-top and must actually win the
  // cascade. Tailwind's utilities layer outranks `@layer components`, and the band
  // root also carries `border` / `border-[color:var(--border)]`, so a layered rule
  // silently degrades to a neutral 1px border while every class-presence assertion
  // still passes. Assert computed style, not classes.
  test("search results band renders the accent rail and survives forced colors", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/services?q=CMHT&run=1", { waitUntil: "domcontentloaded" });
    const band = page.locator('[data-testid="search-query-ribbon"]:visible').first();
    await expect(band).toBeVisible({ timeout: 20_000 });

    const rail = await band.evaluate((node) => {
      const style = getComputedStyle(node);
      return { width: style.borderTopWidth, color: style.borderTopColor, leftColor: style.borderLeftColor };
    });
    expect(rail.width, "accent rail must be 2px, not the neutral 1px border").toBe("2px");
    expect(rail.color, "accent rail must use the clinical accent, not --border").not.toBe(rail.leftColor);
    expect(rail.color).not.toBe("rgb(229, 231, 235)");

    // Under forced colors the rail survives as thickness, since --clinical-accent
    // resolves to LinkText and would otherwise match the other three borders.
    // Poll: the forced-colors style recalc does not always land on the first
    // read after emulateMedia resolves.
    await page.emulateMedia({ forcedColors: "active" });
    await expect
      .poll(async () => band.evaluate((node) => getComputedStyle(node).borderTopWidth), { timeout: 10_000 })
      .toBe("3px");
    await page.emulateMedia({ forcedColors: "none" });
  });

  test("fault recovery actions wrap instead of clipping on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    // Differentials is the widest fault: Retry plus two "Browse …" links. Their
    // combined width exceeds a 390px panel, and the band root is
    // `overflow-hidden`, so without wrapping the trailing link is cut off.
    await page.route("**/api/differentials**", (route) => route.fulfill({ status: 500, json: { error: "down" } }));
    await page.goto("/differentials?q=acute+confusion&run=1", { waitUntil: "domcontentloaded" });

    const fault = page.locator('[data-testid="search-query-ribbon-fault"]:visible').first();
    await expect(fault).toBeVisible({ timeout: 20_000 });

    const actions = fault.locator("a, button");
    await expect(actions).toHaveCount(3);

    const panelBox = await fault.boundingBox();
    expect(panelBox).not.toBeNull();
    const boxes = await actions.evaluateAll((nodes) =>
      nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top };
      }),
    );

    for (const box of boxes) {
      expect(box.left, "a recovery action must not start left of the fault panel").toBeGreaterThanOrEqual(
        panelBox!.x - 1,
      );
      expect(box.right, "a recovery action must not be clipped by the overflow-hidden band").toBeLessThanOrEqual(
        panelBox!.x + panelBox!.width + 1,
      );
    }

    // Proof the row actually wrapped rather than merely fitting: three actions
    // this wide cannot share one line at 390px.
    expect(new Set(boxes.map((box) => Math.round(box.top))).size).toBeGreaterThan(1);
  });
});
