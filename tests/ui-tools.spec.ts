import { expect, test, type Page } from "playwright/test";
import type { Route } from "playwright-core";
import { acuteConfusionPresentationWorkflow } from "../src/lib/differentials";
import { demoAnswer, demoDocuments } from "../src/lib/demo-data";

const readySetupChecks = [
  { id: "env", label: ".env.local configured", status: "ready", detail: "Test environment ready." },
  { id: "project", label: "Clinical KB Database target", status: "ready", detail: "Test Supabase project ready." },
  { id: "schema", label: "supabase/schema.sql applied", status: "ready", detail: "Test schema ready." },
  { id: "search", label: "Search RPC and vector indexes", status: "ready", detail: "Test search schema ready." },
  { id: "openai", label: "OpenAI API key available", status: "ready", detail: "Test OpenAI ready." },
  { id: "worker", label: "npm run worker running", status: "unknown", detail: "Worker not required for UI smoke." },
];

async function fulfillAnswerResponse(route: Route, payload: unknown) {
  const pathname = new URL(route.request().url()).pathname;
  if (pathname.endsWith("/stream")) {
    const body = [
      `event: progress\ndata: ${JSON.stringify({ stage: "retrieving", message: "Searching indexed documents." })}`,
      `event: final\ndata: ${JSON.stringify(payload)}`,
      "",
    ].join("\n\n");
    await route.fulfill({
      body,
      contentType: "text/event-stream; charset=utf-8",
      headers: { "Cache-Control": "no-cache, no-transform" },
    });
    return;
  }

  await route.fulfill({ json: payload });
}

async function mockAnswerDashboardApi(page: Page) {
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
    await route.fulfill({ json: { demoMode: true, checks: readySetupChecks } });
  });
  await page.route(/\/api\/documents(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      json: {
        documents: demoDocuments,
        demoMode: true,
        pagination: {
          limit: 150,
          offset: 0,
          total: demoDocuments.length,
          nextOffset: demoDocuments.length,
          hasMore: false,
        },
      },
    });
  });
  await page.route(/\/api\/answer(?:\/stream)?(?:\?.*)?$/, async (route) => {
    const body = route.request().postDataJSON() as { query?: string; documentId?: string; documentIds?: string[] };
    const answer = demoAnswer(body.query ?? "What monitoring is required?", body.documentId, body.documentIds);
    await fulfillAnswerResponse(route, { ...answer, demoMode: true });
  });
  await page.route(/\/api\/ingestion\/jobs(?:\?.*)?$/, async (route) => {
    await route.fulfill({ json: { jobs: [], demoMode: true } });
  });
  await page.route(/\/api\/ingestion\/batches(?:\?.*)?$/, async (route) => {
    await route.fulfill({ json: { batches: [], demoMode: true } });
  });
  await page.route(/\/api\/ingestion\/quality(?:\?.*)?$/, async (route) => {
    await route.fulfill({ json: { items: [], demoMode: true } });
  });
}

async function commandSurfaceOpensAbovePill(page: Page, hintPattern: RegExp) {
  const input = visibleGlobalSearchInput(page).first();
  await expect(input).toBeVisible();
  // Phone footer-dock placement is applied after the header's media-query effect.
  // Opening the command surface before that settles leaves the dropdown on the
  // inline placement (hidden below lg) even though the hint row is already visible.
  await page.waitForFunction(
    () => Boolean(document.querySelector("form.answer-footer-search-dock, form.answer-footer-search-edge")),
    undefined,
    { timeout: 10_000 },
  );
  await input.click();
  await expect(async () => {
    await input.press("ArrowDown");
    await expect(page.getByText(hintPattern)).toBeVisible();
    await expect(page.getByRole("listbox").first()).toBeVisible();
  }).toPass({ timeout: 15_000 });

  const listbox = page.getByRole("listbox").first();
  await expect(listbox).toBeVisible();

  const geometry = await page.evaluate(() => {
    const pill = document.querySelector(".answer-footer-search-pill");
    const dropdown = document.querySelector(".universal-command-dropdown");
    if (!pill || !dropdown) return null;
    const pillRect = pill.getBoundingClientRect();
    const dropdownRect = dropdown.getBoundingClientRect();
    return {
      pillTop: pillRect.top,
      dropdownBottom: dropdownRect.bottom,
    };
  });

  expect(geometry).not.toBeNull();
  expect(geometry?.dropdownBottom ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual((geometry?.pillTop ?? 0) + 2);
}

function launcherLaunchLink(page: Page, title: string) {
  return page.getByRole("link", { name: `Launch ${title}` }).first();
}

async function gotoLauncher(page: Page, path = "/applications") {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
}

async function expectNoPageHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const documentWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0);
    return documentWidth - document.documentElement.clientWidth;
  });

  expect(overflow).toBeLessThanOrEqual(2);
}

function visibleGlobalSearchInput(page: Page) {
  return page.locator('[data-testid="global-search-input"]:visible');
}

async function globalSearchComposerMetrics(page: Page, homeTestId?: string) {
  return visibleGlobalSearchInput(page)
    .first()
    .evaluate((input, homeTestId) => {
      const form = input.closest("form");
      const pill = input.closest(".answer-footer-search-pill");
      const home = homeTestId ? document.querySelector(`[data-testid="${homeTestId}"]`) : null;
      if (!form) return null;

      const formRect = form.getBoundingClientRect();
      const homeRect = home?.getBoundingClientRect();
      const style = window.getComputedStyle(form);

      return {
        formLeft: formRect.left,
        formRight: formRect.right,
        formTop: formRect.top,
        formBottom: formRect.bottom,
        formWidth: formRect.width,
        formCenterX: formRect.left + formRect.width / 2,
        formCenterY: formRect.top + formRect.height / 2,
        homeLeft: homeRect?.left ?? null,
        homeRight: homeRect?.right ?? null,
        homeCenterX: homeRect ? homeRect.left + homeRect.width / 2 : null,
        position: style.position,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        pillClassName: pill?.className?.toString() ?? "",
      };
    }, homeTestId);
}

async function expectVerticalSeparation(page: Page, upperSelector: string, lowerSelector: string, minimumGap = 8) {
  const metrics = await page.evaluate(
    ({ upperSelector, lowerSelector }) => {
      const upper = document.querySelector(upperSelector)?.getBoundingClientRect();
      const lower = document.querySelector(lowerSelector)?.getBoundingClientRect();
      if (!upper || !lower) return null;
      return {
        upperBottom: upper.bottom,
        lowerTop: lower.top,
      };
    },
    { upperSelector, lowerSelector },
  );

  expect(metrics).not.toBeNull();
  expect((metrics?.lowerTop ?? 0) - (metrics?.upperBottom ?? 0)).toBeGreaterThanOrEqual(minimumGap);
}

async function openAppModeMenu(page: Page, currentMode: string) {
  const trigger = page.getByRole("button", { name: `Mode ${currentMode}` });
  const menu = page.getByRole("menu", { name: "Choose app mode" });

  await expect(trigger).toBeVisible();
  await expect(async () => {
    if (await menu.isVisible().catch(() => false)) return;
    await trigger.click();
    await expect(menu).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 20_000 });

  return menu;
}

test.describe("Clinical KB applications launcher", () => {
  test.describe.configure({ timeout: 60_000 });

  for (const viewport of [
    { name: "mobile", width: 390, height: 820 },
    { name: "desktop", width: 1280, height: 900 },
  ] as const) {
    test(`applications launcher is usable at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await gotoLauncher(page);

      await expect(page.getByRole("heading", { level: 1, name: "Applications" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Quick tool shortcuts" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "All applications" })).toBeVisible();
      if (viewport.name === "mobile") {
        await page.getByTestId("application-row-medication-prescribing").click();
        const selectedSheet = page.getByRole("dialog", { name: "Medication Prescribing" });
        await expect(selectedSheet).toBeVisible();
        await expect(selectedSheet.getByRole("heading", { name: "Medication Prescribing" })).toBeVisible();
        const mobileLaunchLink = selectedSheet.locator('a[href="/?mode=prescribing"]').first();
        await expect(mobileLaunchLink).toBeVisible();
        await expect(mobileLaunchLink).toHaveAttribute("href", "/?mode=prescribing");
        await expect(mobileLaunchLink).not.toHaveAttribute("target", "_blank");
        await page.getByRole("button", { name: "Close Medication Prescribing" }).click();
        await expect(selectedSheet).toBeHidden();
      } else {
        await expect(launcherLaunchLink(page, "Clinical KB Search")).toHaveAttribute("href", "/?mode=answer");
      }
      await expect(page.getByLabel("Mode Tools")).toBeVisible();
      await expect(page.getByPlaceholder("Search applications...")).toBeVisible();
      await expect(page.getByLabel("Open selected application")).toBeVisible();
      await expectNoPageHorizontalOverflow(page);
    });
  }

  test("launcher links point to the expected in-app modes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoLauncher(page);

    const medicationLink = launcherLaunchLink(page, "Medication Prescribing");
    await expect(medicationLink).toHaveAttribute("href", "/?mode=prescribing");
    await expect(medicationLink).not.toHaveAttribute("target", "_blank");
    await expect(launcherLaunchLink(page, "Documents")).toHaveAttribute("href", "/?mode=documents");
    await expect(launcherLaunchLink(page, "Services")).toHaveAttribute("href", "/services");
    await expect(launcherLaunchLink(page, "Forms")).toHaveAttribute("href", "/forms");
    await expect(launcherLaunchLink(page, "Saved workflows")).toHaveAttribute("href", "/favourites");
    await expect(launcherLaunchLink(page, "Clinical KB Search")).toHaveAttribute("href", "/?mode=answer");
    // External companion-app launchers were removed; no localhost links should remain.
    await expect(page.locator('a[href^="http://localhost"], a[href^="http://127.0.0.1"]')).toHaveCount(0);
  });

  test("search and filters reduce visible application rows without overflow", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoLauncher(page);

    await page.getByLabel("Search applications").fill("medication");

    await expect(page.getByTestId("application-card-medication-prescribing")).toBeVisible();
    await expect(page.getByTestId("application-card-documents")).toBeHidden();
    await expectNoPageHorizontalOverflow(page);
  });

  test("tools mode embeds the launcher content inside the dashboard", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoLauncher(page, "/?mode=tools&q=medication&focus=1");

    await expect(page.getByRole("button", { name: "Mode Tools" })).toBeVisible();
    await expect(page.locator('input[placeholder="Search tools..."]:visible').first()).toHaveValue("medication");

    const toolsHub = page.getByTestId("tools-hub");
    await expect(toolsHub).toBeVisible();
    await expect(toolsHub.getByTestId("tools-home")).toBeVisible();
    await expect(toolsHub.getByRole("heading", { level: 1, name: "Tools" })).toBeVisible();
    await expect(toolsHub.getByTestId("global-search-input")).toBeVisible();
    await expect(toolsHub.getByRole("heading", { name: "All tools" })).toBeVisible();
    await expect(toolsHub.getByRole("link", { name: "Launch Medication Prescribing" })).toBeVisible();
    await expect(toolsHub.getByTestId("application-card-documents")).toBeHidden();
    await expect(toolsHub.getByTestId("tool-mode-result-medications")).toHaveCount(0);

    await expect(toolsHub.getByRole("link", { name: "Launch Medication Prescribing" })).toHaveAttribute(
      "href",
      "/?mode=prescribing",
    );
    await expectNoPageHorizontalOverflow(page);
  });

  test("mode toggle stays global on the services home route", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoLauncher(page, "/?mode=answer");

    const initialMenu = await openAppModeMenu(page, "Answer");
    await expect(initialMenu).toBeVisible();
    await initialMenu.getByRole("menuitemradio", { name: /^Services\b/ }).click();

    await expect(page).toHaveURL(/\/services$/);
    await expect(page.getByRole("button", { name: "Mode Services" })).toBeVisible();
    await expect(page.getByTestId("services-home")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Find a service" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
    await expect(page.getByTestId("collapsed-account-settings")).toBeVisible();
    await expect(visibleGlobalSearchInput(page)).toHaveCount(1);
    const servicesHomeSearch = page.getByTestId("services-home").getByTestId("global-search-input");
    await expect(servicesHomeSearch).toBeVisible();
    const servicesSearchBox = await servicesHomeSearch.boundingBox();
    const servicesHeadingBox = await page.getByRole("heading", { level: 1, name: "Find a service" }).boundingBox();
    expect(servicesSearchBox).not.toBeNull();
    expect(servicesHeadingBox).not.toBeNull();
    expect((servicesHeadingBox?.y ?? 0) + (servicesHeadingBox?.height ?? 0)).toBeLessThan(servicesSearchBox?.y ?? 0);
    expect((servicesSearchBox?.y ?? 0) + (servicesSearchBox?.height ?? 0) / 2).toBeLessThan(900 * 0.62);
    await expect(visibleGlobalSearchInput(page)).toHaveValue("");
    const servicesMenu = await openAppModeMenu(page, "Services");
    await expect(servicesMenu.getByRole("menuitemradio", { name: /^Answer\b/ })).toBeVisible();
    await expect(servicesMenu.getByRole("menuitemradio", { name: /^Documents\b/ })).toBeVisible();
    await expect(servicesMenu.getByRole("menuitemradio", { name: /^Services\b/ })).toBeVisible();
    await expect(servicesMenu.getByRole("menuitemradio", { name: /^Forms\b/ })).toBeVisible();
    await expect(servicesMenu.getByRole("menuitemradio", { name: /^Differentials\b/ })).toBeVisible();
    await expect(servicesMenu.getByRole("menuitemradio", { name: /^Medication\b/ })).toBeVisible();
    await expect(servicesMenu.getByRole("menuitemradio", { name: /^Tools\b/ })).toBeVisible();
    await expect(async () => {
      if (/\/forms$/.test(page.url())) return;
      const menu = await openAppModeMenu(page, "Services");
      await menu.getByRole("menuitemradio", { name: /^Forms\b/ }).click();
      await expect(page).toHaveURL(/\/forms$/, { timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Mode Forms" })).toBeVisible();
    await expect(page.getByTestId("forms-home")).toBeVisible();
    await expect(page.getByTestId("form-search-results")).toHaveCount(0);
    await expect(visibleGlobalSearchInput(page)).toHaveValue("");
    await expectNoPageHorizontalOverflow(page);
  });

  test("header mode switches open clean services and forms home pages", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    await gotoLauncher(page, "/services?q=13YARN&focus=1&run=1");
    await expect(page.getByRole("button", { name: "Mode Services" })).toBeVisible();
    await expect(page.getByTestId("service-search-results")).toBeVisible();
    await expect(page.getByTestId("service-search-result-13yarn")).toBeVisible();

    let menu = await openAppModeMenu(page, "Services");
    await menu.getByRole("menuitemradio", { name: /^Forms\b/ }).click();

    await expect(page).toHaveURL(/\/forms$/);
    await expect(page.getByRole("button", { name: "Mode Forms" })).toBeVisible();
    await expect(page.getByTestId("forms-home")).toBeVisible();
    await expect(page.getByTestId("form-search-results")).toHaveCount(0);
    await expect(visibleGlobalSearchInput(page)).toHaveCount(1);
    await expect(visibleGlobalSearchInput(page)).toHaveValue("");

    await gotoLauncher(page, "/forms");
    await expect(page.getByRole("button", { name: "Mode Forms" })).toBeVisible();
    await expect(page.getByTestId("forms-home")).toBeVisible();

    menu = await openAppModeMenu(page, "Forms");
    await menu.getByRole("menuitemradio", { name: /^Services\b/ }).click();

    await expect(page).toHaveURL(/\/services$/);
    await expect(page.getByRole("button", { name: "Mode Services" })).toBeVisible();
    await expect(page.getByTestId("services-home")).toBeVisible();
    await expect(page.getByTestId("service-search-results")).toHaveCount(0);
    await expect(visibleGlobalSearchInput(page)).toHaveCount(1);
    await expect(visibleGlobalSearchInput(page)).toHaveValue("");
    await expectNoPageHorizontalOverflow(page);
  });

  test("mode home routes center the shared search on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 820 });

    for (const home of [
      { path: "/services", testId: "services-home", heading: "Find a service" },
      { path: "/forms", testId: "forms-home", heading: "What do you need from forms?" },
      { path: "/differentials", testId: "differentials-home", heading: "Differentials" },
    ] as const) {
      await gotoLauncher(page, home.path);
      await expect(page.getByTestId(home.testId)).toBeVisible();
      await expect(visibleGlobalSearchInput(page)).toHaveCount(1);

      const heroSearch = page.getByTestId(home.testId).getByTestId("global-search-input");
      await expect(heroSearch).toBeVisible();

      const searchBox = await heroSearch.boundingBox();
      const headingBox = await page.getByRole("heading", { level: 1, name: home.heading }).boundingBox();
      expect(searchBox).not.toBeNull();
      expect(headingBox).not.toBeNull();
      expect((headingBox?.y ?? 0) + (headingBox?.height ?? 0)).toBeLessThan(searchBox?.y ?? 0);
      expect((searchBox?.y ?? 0) + (searchBox?.height ?? 0) / 2).toBeLessThan(820 * 0.72);
      const metrics = await globalSearchComposerMetrics(page, home.testId);
      expect(metrics).not.toBeNull();
      expect(metrics?.position).not.toBe("fixed");
      expect(metrics?.formWidth ?? 0).toBeLessThanOrEqual(390 - 16);
      expect(metrics?.pillClassName).toContain("answer-footer-search-pill");
      expect(metrics?.homeCenterX).not.toBeNull();
      expect(Math.abs((metrics?.formCenterX ?? 0) - (metrics?.homeCenterX ?? 0))).toBeLessThanOrEqual(24);
      await expect(page.locator(".mode-home-action").first()).toBeVisible();
      await expectNoPageHorizontalOverflow(page);
    }
  });

  test("phone bottom-dock search opens the command surface above the pill", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 820 });
    await gotoLauncher(page, "/services?q=13YARN&focus=1&run=1");
    await expect(page.getByRole("button", { name: "Mode Services" })).toBeVisible();
    await expect(visibleGlobalSearchInput(page).first()).toBeVisible();
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    await commandSurfaceOpensAbovePill(page, /Searching services/i);
    await expectNoPageHorizontalOverflow(page);
  });

  test("desktop answer footer opens the command surface above the pill", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockAnswerDashboardApi(page);
    await gotoLauncher(page, "/?mode=answer&q=lithium+dosing&run=1");
    await expect(page.getByTestId("plain-answer-response")).toHaveCount(1, { timeout: 30_000 });

    const metrics = await globalSearchComposerMetrics(page);
    expect(metrics?.position).toBe("fixed");
    await commandSurfaceOpensAbovePill(page, /Searching answer/i);
    await expectNoPageHorizontalOverflow(page);
  });

  test("mode home routes center the shared search from tablet up", async ({ page }) => {
    test.setTimeout(150_000);

    for (const viewport of [
      { name: "tablet", width: 768, height: 1024 },
      { name: "desktop", width: 1280, height: 900 },
    ] as const) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      for (const home of [
        { path: "/services", testId: "services-home", heading: "Find a service" },
        { path: "/forms", testId: "forms-home", heading: "What do you need from forms?" },
        { path: "/differentials", testId: "differentials-home", heading: "Differentials" },
      ] as const) {
        await gotoLauncher(page, home.path);
        await expect(page.getByTestId(home.testId)).toBeVisible();
        await expect(visibleGlobalSearchInput(page)).toHaveCount(1);

        // From the tablet breakpoint up the composer is portaled into the hero
        // (inside the mode-home container) rather than floated over the heading.
        const heroSearch = page.getByTestId(home.testId).getByTestId("global-search-input");
        await expect(heroSearch).toBeVisible();

        const searchBox = await heroSearch.boundingBox();
        const headingBox = await page.getByRole("heading", { level: 1, name: home.heading }).boundingBox();
        expect(searchBox).not.toBeNull();
        expect(headingBox).not.toBeNull();
        // Search sits below the heading with no overlap.
        expect((headingBox?.y ?? 0) + (headingBox?.height ?? 0)).toBeLessThanOrEqual(searchBox?.y ?? 0);

        const metrics = await globalSearchComposerMetrics(page, home.testId);
        expect(metrics, `${home.path} at ${viewport.name}`).not.toBeNull();
        expect(metrics?.position).not.toBe("fixed");
        expect(metrics?.pillClassName).toContain("answer-footer-search-pill");
        expect(metrics?.formWidth ?? 0).toBeLessThanOrEqual(viewport.width - 16);
        expect(metrics?.homeLeft).not.toBeNull();
        expect(metrics?.homeRight).not.toBeNull();
        expect(metrics?.homeCenterX).not.toBeNull();
        expect(metrics?.formLeft ?? 0).toBeGreaterThanOrEqual((metrics?.homeLeft ?? 0) - 1);
        expect(metrics?.formRight ?? 0).toBeLessThanOrEqual((metrics?.homeRight ?? viewport.width) + 1);
        expect(Math.abs((metrics?.formCenterX ?? 0) - (metrics?.homeCenterX ?? 0))).toBeLessThanOrEqual(24);
        await expect(page.locator(".mode-home-action").first()).toBeVisible();
        await expectNoPageHorizontalOverflow(page);
      }
    }
  });

  test("search result and detail routes keep top search from tablet up", async ({ page }) => {
    test.setTimeout(150_000);

    for (const viewport of [
      { name: "mobile", width: 390, height: 820 },
      { name: "tablet", width: 768, height: 1024 },
      { name: "desktop", width: 1280, height: 900 },
    ] as const) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      for (const route of [
        { path: "/services?q=13YARN&focus=1&run=1", compactBottomSearch: true },
        { path: "/services/13yarn", compactBottomSearch: false },
      ] as const) {
        await gotoLauncher(page, route.path);
        await expect(page.getByRole("button", { name: "Mode Services" })).toBeVisible({ timeout: 20_000 });
        await expect(visibleGlobalSearchInput(page), `${route.path} at ${viewport.name}`).toHaveCount(1, {
          timeout: 20_000,
        });

        const metrics = await globalSearchComposerMetrics(page);
        expect(metrics, `${route.path} at ${viewport.name}`).not.toBeNull();
        expect(metrics?.pillClassName).toContain("answer-footer-search-pill");
        expect(metrics?.formWidth ?? 0).toBeLessThanOrEqual(viewport.width);

        if (viewport.width < 640) {
          expect(metrics?.position).toBe("fixed");
          expect(metrics?.formCenterY ?? 0).toBeGreaterThan(viewport.height * 0.72);
          if (route.compactBottomSearch) {
            // Search result views drop the chip row and hug the bottom edge
            // on phones so results keep maximum screen space.
            await expect(page.locator(".answer-footer-search-chip:visible")).toHaveCount(0);
            expect(metrics?.formBottom ?? 0).toBeGreaterThanOrEqual(viewport.height - 48);
          } else {
            await expect(page.locator(".answer-footer-search-chip:visible").first()).toBeVisible();
          }
        } else {
          expect(metrics?.position).toBe("sticky");
          expect(metrics?.formCenterY ?? viewport.height).toBeLessThan(viewport.height * 0.25);
        }

        await expectNoPageHorizontalOverflow(page);
      }
    }
  });

  test("mode home deep links preserve focus=1 on initial load", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    await gotoLauncher(page, "/services?focus=1");
    await expect(page.getByTestId("services-home").getByTestId("global-search-input")).toBeVisible();
    await expect(page.getByTestId("services-home").getByTestId("global-search-input")).toBeFocused();

    await gotoLauncher(page, "/forms?focus=1");
    await expect(page.getByTestId("forms-home").getByTestId("global-search-input")).toBeVisible();
    await expect(page.getByTestId("forms-home").getByTestId("global-search-input")).toBeFocused();
  });

  test("services mode shows source-backed records in search results", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoLauncher(page, "/services?q=13YARN&focus=1&run=1");

    await expect(page.getByRole("button", { name: "Mode Services" })).toBeVisible();
    await expect(page.locator('input[placeholder="Search services..."]:visible').first()).toHaveValue("13YARN");
    await expect(page.getByTestId("service-search-results")).toBeVisible();
    await expect(page.getByTestId("service-search-result-13yarn")).toContainText("13YARN");
    await expect(page.getByTestId("service-search-result-13yarn").getByLabel("Open 13YARN")).toHaveAttribute(
      "href",
      "/services/13yarn",
    );
    await expectNoPageHorizontalOverflow(page);
  });

  test("forms mode shows source-backed form records in search results", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoLauncher(page, "/forms?q=transport%20forms&focus=1&run=1");

    await expect(page.getByRole("button", { name: "Mode Forms" })).toBeVisible();
    await expect(visibleGlobalSearchInput(page)).toHaveValue("transport forms");
    await expect(page.getByTestId("form-search-results")).toBeVisible();
    await expect(page.getByTestId("form-search-results")).toContainText("Best matches");
    await expect(page.getByTestId("form-search-result-transport-crisis-form")).toContainText("Transport order");
    await expect(page.getByTestId("form-search-result-extension-transport-order")).toContainText(
      "Extension of Transport Order",
    );
    await expect(page.getByTestId("form-search-result-detention-examination-movement")).toContainText(
      "Detention to enable examination or movement",
    );
    await expect(page.getByTestId("form-search-result-transfer-order")).toContainText("Transfer order");
    await expect(
      page.getByTestId("form-search-result-transport-crisis-form").getByLabel("Open Transport order"),
    ).toHaveAttribute("href", "/forms/transport-crisis-form");
    await expect(page.getByTestId("service-search-results")).toHaveCount(0);
    await expectNoPageHorizontalOverflow(page);
  });

  test("form detail pages keep the shared forms search wired to form results", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoLauncher(page, "/forms/transport-crisis-form");
    await expect(page.getByTestId("form-detail-page")).toBeVisible();

    // Structural coverage — runs on every browser, WebKit included: the form
    // detail page renders inside the shared shell with the Forms-mode composer
    // present and no stale results.
    await expect(page.getByRole("button", { name: "Mode Forms" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Transport order" })).toBeVisible();
    await expect(page.getByTestId("form-search-results")).toHaveCount(0);
    const formsSearchInput = page.locator('input[placeholder="Search forms..."]:visible').first();
    await expect(formsSearchInput).toBeVisible();

    // The shell now seeds its composer state from the URL and only re-syncs on a
    // real navigation, so a programmatic fill on this no-query detail route is no
    // longer wiped by a mount-time frame — the race that used to break CI WebKit
    // (and could flake Firefox). Drive the fill-and-submit as one retried unit
    // regardless, so any residual cross-browser navigation-timing jitter cannot
    // flake the route assertion; the assertions below still verify the result.
    const formsSearchButton = page.getByRole("button", { name: "Search forms" });
    await expect(async () => {
      // A previous attempt's click may have navigated late — after the inner URL
      // wait timed out and triggered a retry. If we have already routed to the
      // results page the detail-page input is gone, so re-filling would throw;
      // treat the completed navigation as success instead.
      if (/\/forms\?/.test(page.url())) return;
      await formsSearchInput.fill("transport forms");
      await expect(formsSearchButton).toBeEnabled({ timeout: 1_000 });
      await formsSearchButton.click();
      await expect(page).toHaveURL(/\/forms\?/, { timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await expect(page.getByTestId("form-search-results")).toBeVisible();
    await expect(page.getByTestId("form-search-result-transport-crisis-form")).toContainText("Transport order");
    await expect(
      page.getByTestId("form-search-result-transport-crisis-form").getByLabel("Open Transport order"),
    ).toHaveAttribute("href", "/forms/transport-crisis-form");
    await expectNoPageHorizontalOverflow(page);
  });

  test("form detail mobile keeps the floating global search clear of decision context", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoLauncher(page, "/forms/transport-crisis-form");

    await expect(page.getByTestId("form-detail-page")).toBeVisible();
    await expect(page.getByTestId("form-decision-context-mobile")).toBeVisible();
    await expect(page.locator('[data-testid="global-search-input"]:visible')).toHaveCount(1);
    await expectVerticalSeparation(
      page,
      '[data-testid="form-decision-context-mobile"] [role="tablist"], [data-testid="form-decision-context-mobile"] > div:nth-child(2)',
      '[data-testid="global-search-input"]',
      8,
    );
    await expectNoPageHorizontalOverflow(page);
  });

  test("forms search mockup is usable without horizontal overflow on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoLauncher(page, "/forms?q=transport&focus=1&run=1");

    await expect(page.getByTestId("form-search-mobile-results")).toBeVisible();
    await expect(page.getByTestId("form-search-mobile-result-transport-crisis-form")).toContainText("Transport order");
    await expect(visibleGlobalSearchInput(page)).toHaveValue("transport");
    await expectNoPageHorizontalOverflow(page);
  });

  test("mode toggle keeps forms separate from services", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoLauncher(page, "/?mode=answer");

    const menu = await openAppModeMenu(page, "Answer");
    await expect(menu.getByRole("menuitemradio", { name: /^Services\b/ })).toBeVisible();
    await menu.getByRole("menuitemradio", { name: /^Forms\b/ }).click();

    await expect(page).toHaveURL(/\/forms$/);
    await expect(page.getByRole("button", { name: "Mode Forms" })).toBeVisible();
    await expect(page.getByTestId("forms-home")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "What do you need from forms?" })).toBeVisible();
    await expect(page.getByTestId("services-home")).toHaveCount(0);
    await expect(page.getByTestId("global-search-input")).toHaveCount(1);
    const formsHomeSearch = page.getByTestId("forms-home").getByTestId("global-search-input");
    await expect(formsHomeSearch).toBeVisible();
    const formsSearchBox = await formsHomeSearch.boundingBox();
    const formsHeadingBox = await page
      .getByRole("heading", { level: 1, name: "What do you need from forms?" })
      .boundingBox();
    expect(formsSearchBox).not.toBeNull();
    expect(formsHeadingBox).not.toBeNull();
    expect((formsHeadingBox?.y ?? 0) + (formsHeadingBox?.height ?? 0)).toBeLessThan(formsSearchBox?.y ?? 0);
    expect((formsSearchBox?.y ?? 0) + (formsSearchBox?.height ?? 0) / 2).toBeLessThan(900 * 0.62);
    await expectNoPageHorizontalOverflow(page);
  });

  test("mode toggle opens the differentials home inside the dashboard", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoLauncher(page, "/?mode=answer");

    const modeButton = page.getByRole("button", { name: "Mode Answer" });
    await expect(modeButton).toBeVisible();
    await modeButton.click();

    await page.getByRole("menuitemradio", { name: /Differentials/ }).click();

    await expect(page.getByRole("button", { name: "Mode Differentials" })).toBeVisible();
    await expect(page.getByTestId("differentials-home")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Differentials" })).toBeVisible();
    await expect(page.locator('input[placeholder="Ask or search a presentation"]:visible').first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Search presentations" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Compare differentials" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent work" })).toBeVisible();
    await expect(page.getByTestId("global-search-input")).toHaveCount(1);
    const differentialsHomeSearch = page.getByTestId("differentials-home").getByTestId("global-search-input");
    await expect(differentialsHomeSearch).toBeVisible();
    // The shell's Suspense swap after client navigation can briefly detach the
    // hero heading, so retry the geometry probe instead of measuring once.
    await expect(async () => {
      const differentialsSearchBox = await differentialsHomeSearch.boundingBox();
      const differentialsHeadingBox = await page
        .getByRole("heading", { level: 1, name: "Differentials" })
        .boundingBox();
      expect(differentialsSearchBox).not.toBeNull();
      expect(differentialsHeadingBox).not.toBeNull();
      expect((differentialsHeadingBox?.y ?? 0) + (differentialsHeadingBox?.height ?? 0)).toBeLessThan(
        differentialsSearchBox?.y ?? 0,
      );
      expect((differentialsSearchBox?.y ?? 0) + (differentialsSearchBox?.height ?? 0) / 2).toBeLessThan(900 * 0.62);
    }).toPass({ timeout: 10_000 });
    await expectNoPageHorizontalOverflow(page);
  });

  test("differentials global search posts the standalone differentials mode", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const searchRequests: Array<Record<string, unknown>> = [];

    await page.route(/\/api\/setup-status(?:\?.*)?$/, async (route) => {
      await route.fulfill({
        json: {
          demoMode: true,
          checks: [
            { id: "env", label: ".env.local configured", status: "ready", detail: "Test environment ready." },
            { id: "project", label: "Clinical KB Database target", status: "ready", detail: "Test project ready." },
            { id: "schema", label: "supabase/schema.sql applied", status: "ready", detail: "Test schema ready." },
            { id: "search", label: "Search RPC and vector indexes", status: "ready", detail: "Test search ready." },
            { id: "openai", label: "OpenAI API key available", status: "ready", detail: "Test OpenAI ready." },
          ],
        },
      });
    });
    await page.route(/\/api\/search(?:\?.*)?$/, async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      searchRequests.push(body);
      await route.fulfill({
        json: {
          results: [
            {
              id: "chunk-acute-confusion",
              document_id: "11111111-1111-4111-8111-111111111111",
              title: "Acute confusion differential guide",
              file_name: "acute-confusion-differentials.pdf",
              page_number: 1,
              chunk_index: 0,
              section_heading: "Differentials",
              content: "Acute confusion with inattention should prioritise delirium and other urgent causes.",
              image_ids: [],
              similarity: 0.91,
              hybrid_score: 0.93,
              images: [],
            },
          ],
          visualEvidence: [],
          relatedDocuments: [],
          documentMatches: [
            {
              document_id: "11111111-1111-4111-8111-111111111111",
              title: "Acute confusion differential guide",
              file_name: "acute-confusion-differentials.pdf",
              labels: [
                {
                  id: "label-delirium",
                  document_id: "11111111-1111-4111-8111-111111111111",
                  label: "Delirium",
                  label_type: "topic",
                  source: "generated",
                  confidence: 0.96,
                },
              ],
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
          scope: { queryMode: body.queryMode },
          sourceGovernanceWarnings: [],
          demoMode: true,
        },
      });
    });

    await gotoLauncher(page, "/differentials");
    await expect(page.getByRole("button", { name: "Mode Differentials" })).toBeVisible();
    await page.locator('input[placeholder="Ask or search a presentation"]:visible').first().fill("acute confusion");
    await expect(page.locator('button[aria-label="Search differential presentations"]:visible')).toBeEnabled();
    await page.locator('button[aria-label="Search differential presentations"]:visible').click();

    await expect.poll(() => searchRequests.length).toBeGreaterThan(0);
    expect(searchRequests.at(-1)).toMatchObject({
      query: "acute confusion",
      mode: "differentials",
      queryMode: "compare_guidance",
    });

    // Evidence arrived, so the results view renders — with the synthetic
    // demonstration-content notice, never presented as reviewed output.
    await expect(page.getByTestId("differentials-search-results")).toBeVisible();
    await expect(page.getByTestId("differentials-demo-content-notice")).toBeVisible();
    await expect(page.getByText("Demonstration ranking").first()).toBeVisible();
  });

  test("differentials presentation comparison page stays wired to differentials mode", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 920 });
    const workflow = acuteConfusionPresentationWorkflow;
    await gotoLauncher(page, "/differentials/presentations");
    await expect(page).toHaveURL(/\/differentials\/presentations\/acute-confusion-encephalopathy/);

    await expect(page.getByRole("button", { name: "Mode Differentials" })).toBeVisible();
    await expect(page.getByTestId("differential-presentation-page")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: workflow.title })).toBeVisible();
    await expect(
      page
        .getByRole("heading", {
          name: `Selected differentials (${workflow.selectedCount} of ${workflow.totalCount})`,
        })
        .first(),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/differentials");
    await expect(page.getByRole("heading", { name: "Safety snapshot" }).first()).toBeVisible();
    await expect(page.getByText("Service details")).toHaveCount(0);
    await expect(page.getByText("Transport order")).toHaveCount(0);
    await expect(page.getByLabel("Differential review sidebar").getByText("Local content only").first()).toBeVisible();
    await expect(
      page.getByLabel("Differential review sidebar").getByText("Source pending review").first(),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy after review" })).toBeVisible();
    await expect(page.getByTestId("global-search-input")).toHaveCount(0);

    const tableScrolls = await page.getByTestId("differential-comparison-scroll").evaluate((element) => {
      return element.scrollWidth > element.clientWidth;
    });
    expect(tableScrolls).toBe(true);
    const desktopTableBox = await page.getByTestId("differential-comparison-scroll").boundingBox();
    expect(desktopTableBox?.width ?? 0).toBeGreaterThan(900);
    await expectNoPageHorizontalOverflow(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await gotoLauncher(page, "/differentials/presentations");

    await expect(page.getByRole("link", { name: "Back to differentials" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Compare", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { level: 1, name: workflow.title })).toBeVisible();
    const mobileComparison = page.getByLabel("Mobile differential comparison");
    await expect(mobileComparison.getByText("Delirium", { exact: true }).first()).toBeVisible();
    await expect(mobileComparison.getByText("Substance intoxication", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Open language and region settings" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start a new comparison" })).toBeVisible();
    await expect(page.getByTestId("global-search-input")).toHaveCount(0);
    await expect(page.getByText("Service details")).toHaveCount(0);
    await expect(page.getByText("Transport order")).toHaveCount(0);
    await expectNoPageHorizontalOverflow(page);
  });

  test("tools mode opens tools directly on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 820 });
    await gotoLauncher(page, "/?mode=tools");

    const toolsHub = page.getByTestId("tools-hub");
    await expect(toolsHub.getByText("Selected tool")).toHaveCount(0);
    await expect(toolsHub.getByTestId("application-row-medication-prescribing")).toHaveAttribute(
      "href",
      "/?mode=prescribing",
    );
    await expectNoPageHorizontalOverflow(page);
  });
});

test.describe("Clinical KB service detail page", () => {
  test.describe.configure({ timeout: 60_000 });

  for (const viewport of [
    { name: "mobile", width: 390, height: 820 },
    { name: "desktop", width: 1280, height: 900 },
  ] as const) {
    test(`13YARN service detail is usable at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await gotoLauncher(page, "/services/13yarn");

      const servicePage = page.getByTestId("service-detail-page");
      const copyContactButton = servicePage.getByRole("button", { name: "Copy contact" }).last();
      await expect(servicePage).toBeVisible();
      await expect(servicePage.getByRole("heading", { level: 1, name: "13YARN" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Back to services" })).toBeVisible();
      await expect(servicePage.getByRole("button", { name: "Save service" })).toBeVisible();
      await expect(copyContactButton).toBeVisible();
      await expect(servicePage.getByRole("link", { name: "Call" })).toHaveAttribute("href", "tel:139276");
      await expect(servicePage.getByRole("button", { name: "Use in navigator" })).toBeVisible();
      await expect(page.getByTestId("global-search-input")).toHaveCount(1);
      await expect(page.getByTestId("global-search-input")).toBeVisible();
      await expect(servicePage.locator('[data-testid="global-search-input"]')).toHaveCount(0);
      await expect(servicePage.getByPlaceholder(/Search services/i)).toHaveCount(0);
      await expectNoPageHorizontalOverflow(page);
    });
  }

  test("service navigator action uses the shared global search route", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoLauncher(page, "/services/13yarn");

    await page.getByTestId("service-detail-page").getByRole("button", { name: "Use in navigator" }).click();
    await expect(page).toHaveURL(/\/services\?/);
    await expect(page).toHaveURL(/run=1/);
    await expect(page).toHaveURL(/focus=1/);
  });

  test("service detail actions save, copy, and back from direct entry", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoLauncher(page, "/services/13yarn");

    const servicePage = page.getByTestId("service-detail-page");
    await servicePage.getByRole("button", { name: "Save service" }).click();
    await expect(page.getByRole("status")).toContainText("Service saved");
    await expect(servicePage.getByRole("button", { name: "Remove saved service" })).toBeVisible();

    await servicePage.getByRole("button", { name: "Copy contact" }).last().click();
    await expect(page.getByRole("status")).toContainText("Contact copied");

    await page.getByRole("button", { name: "Back to services" }).click();
    await expect(page).toHaveURL(/\/services(?:\?|$)/);
  });
});

test.describe("Responsive layout guards", () => {
  test.describe.configure({ timeout: 90_000 });

  // Widths straddle every breakpoint the mockups switch layout at: the sm (640px),
  // lg (1024px), and xl (1280px) grid changes, plus the narrow phone floor (320px).
  const responsiveWidths = [320, 375, 414, 640, 768, 1024, 1280] as const;

  async function settleLayout(page: Page) {
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  }

  const mockupRoutes = [
    { name: "tools command center", path: "/mockups/tools-command-center" },
    { name: "tools split pane", path: "/mockups/tools-split-pane" },
    { name: "tools workflow board", path: "/mockups/tools-workflow-board" },
  ] as const;

  for (const route of mockupRoutes) {
    test(`${route.name} never overflows horizontally across sizes`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await gotoLauncher(page, route.path);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

      for (const width of responsiveWidths) {
        await page.setViewportSize({ width, height: 900 });
        await settleLayout(page);
        await expectNoPageHorizontalOverflow(page);
      }
    });
  }

  const modeHomeRoutes = [
    { name: "prescribing", path: "/?mode=prescribing" },
    { name: "differentials", path: "/?mode=differentials" },
    { name: "services", path: "/?mode=services" },
    { name: "forms", path: "/?mode=forms" },
  ] as const;

  for (const route of modeHomeRoutes) {
    test(`${route.name} mode home never overflows horizontally across sizes`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await gotoLauncher(page, route.path);
      await expect(page.getByRole("heading").first()).toBeVisible();

      for (const width of responsiveWidths) {
        await page.setViewportSize({ width, height: 900 });
        await settleLayout(page);
        await expectNoPageHorizontalOverflow(page);
      }
    });
  }

  test("prescribing mode home bottom-anchors its content on phones but centres on tablet", async ({ page }) => {
    async function verticalWeighting(width: number) {
      // Tall viewport exaggerates the free space so the anchor is unambiguous.
      await page.setViewportSize({ width, height: 900 });
      await gotoLauncher(page, "/?mode=prescribing");
      const home = page.getByTestId("medication-home");
      await expect(home).toBeVisible();
      await settleLayout(page);
      return page.evaluate(() => {
        const rect = document.querySelector('[data-testid="medication-home"]')?.getBoundingClientRect();
        if (!rect) return null;
        return { topGap: rect.top, bottomGap: window.innerHeight - rect.bottom };
      });
    }

    // Phone (< sm): content is pushed toward the bottom, so the gap above exceeds the gap below.
    const phone = await verticalWeighting(375);
    expect(phone).not.toBeNull();
    expect(phone?.topGap ?? 0).toBeGreaterThan(phone?.bottomGap ?? 0);

    // Tablet (>= sm): content is vertically centred, so the two gaps are close to balanced.
    const tablet = await verticalWeighting(768);
    expect(tablet).not.toBeNull();
    const balance = Math.abs((tablet?.topGap ?? 0) - (tablet?.bottomGap ?? 0));
    expect(balance).toBeLessThan(Math.max(tablet?.topGap ?? 0, tablet?.bottomGap ?? 0));
  });
});
