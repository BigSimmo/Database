import { expect, test, type Locator, type Page } from "playwright/test";
import { stubZeroTouchPoints } from "./helpers/zero-touch";
import type { Route } from "playwright-core";
import { acuteConfusionPresentationWorkflow, differentialRecords } from "../src/lib/differentials";
import { demoAnswer, demoDocuments } from "../src/lib/demo-data";
import { formRecords, rankFormRecords } from "../src/lib/forms";
import { loadMedicationSnapshot } from "../src/lib/medication-snapshot";
import { medicationToSearchResult, rankMedicationRecords } from "../src/lib/medications";
import { sortResultItems } from "../src/lib/result-sort";
import { serviceRecords } from "../src/lib/services";
import { openAppModeMenu } from "./playwright-app-mode";
import { readMobileComposerReservePx, scrollPrimarySurface } from "./playwright-scroll";

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

async function blockExternalRequests(page: Page) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !["localhost", "127.0.0.1", "::1"].includes(url.hostname)
    ) {
      await route.abort("blockedbyclient");
      return;
    }
    await route.fallback();
  });
}

function waitForDifferentialCatalogQuery(page: Page, query: string) {
  const expectedQuery = query.trim().toLowerCase();
  return Promise.all(
    ["diagnosis", "presentation"].map((kind) =>
      page.waitForResponse(
        (response) => {
          const url = new URL(response.url());
          return (
            url.pathname === "/api/differentials" &&
            url.searchParams.get("kind") === kind &&
            url.searchParams.get("q")?.trim().toLowerCase() === expectedQuery &&
            response.ok()
          );
        },
        { timeout: 30_000 },
      ),
    ),
  );
}

async function submitDifferentialSearch(page: Page, query: string) {
  const submit = page.locator('button[aria-label="Search differential presentations"]:visible');
  await expect(submit).toBeEnabled();
  await Promise.all([waitForDifferentialCatalogQuery(page, query), submit.click()]);
}

async function mockAnswerDashboardApi(page: Page) {
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
  await page.route(/\/api\/medications(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get("q")?.trim() || undefined;
    const limit = Number(url.searchParams.get("limit") ?? "50");
    const records = loadMedicationSnapshot();
    const matches = query ? rankMedicationRecords(records, query, limit) : undefined;
    await route.fulfill({
      json: {
        records,
        matches: matches?.map((match) => ({
          medication: match.medication,
          result: medicationToSearchResult(match),
          score: match.score,
          reasons: match.reasons,
        })),
        total: records.length,
        governance: {},
        demoMode: true,
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
  await page.route(/\/api\/registry\/records(?:\?.*)?$/, async (route) => {
    const kind = new URL(route.request().url()).searchParams.get("kind");
    const records = kind === "form" ? formRecords : serviceRecords;
    await route.fulfill({
      json: {
        records,
        total: records.length,
        demoMode: true,
        governance: {},
      },
    });
  });
  await page.route(/\/api\/registry\/records\/[^/?]+(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    const slug = decodeURIComponent(url.pathname.split("/").pop() ?? "");
    const kind = url.searchParams.get("kind");
    const record =
      kind === "form"
        ? formRecords.find((form) => form.slug === slug)
        : serviceRecords.find((service) => service.slug === slug);
    if (!record) {
      await route.fulfill({ status: 404, json: { error: "Registry record not found" } });
      return;
    }
    await route.fulfill({
      json: {
        record,
        linkedDocuments: [],
        governance: { sourceStatus: "current", validationStatus: "unverified" },
        demoMode: true,
      },
    });
  });
}

async function mockDifferentialCatalogApi(page: Page) {
  await page.route(/\/api\/differentials(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get("q")?.trim() ?? "";
    const kind = url.searchParams.get("kind") ?? "diagnosis";

    if (kind === "presentation") {
      await route.fulfill({
        json: {
          matches: [
            {
              workflow: acuteConfusionPresentationWorkflow,
              score: 1,
              reasons: [`Matched ${query}`],
            },
          ],
          demoMode: true,
        },
      });
      return;
    }

    await route.fulfill({
      json: {
        matches: differentialRecords.slice(0, 20).map((record, index) => ({
          record,
          score: 1 - index / 10,
          reasons: [`Matched ${query}`],
        })),
        demoMode: true,
      },
    });
  });
}

async function commandSurfaceOpensAbovePill(page: Page) {
  const input = visibleGlobalSearchInput(page).first();
  await expect(input).toBeVisible();
  // Phone footer-dock placement is applied after the header's media-query effect.
  // Opening the command surface before that settles leaves the dropdown on the
  // inline placement (hidden below lg) even though the footer composer is visible.
  await page.waitForFunction(
    () => Boolean(document.querySelector("form.answer-footer-search-dock, form.answer-footer-search-edge")),
    undefined,
    { timeout: 10_000 },
  );
  await input.click();
  await expect(async () => {
    await input.press("ArrowDown");
    await expect(page.getByRole("listbox").first()).toBeVisible();
    await expect(page.getByRole("option").first()).toBeVisible();
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

async function gotoLauncher(page: Page, path = "/?mode=tools") {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#main-content").first()).toBeVisible({ timeout: 15_000 });
}

async function waitForReactEventHandler(locator: Locator, eventName: "onClick" | "onSubmit" = "onClick") {
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

async function expectNoPageHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const documentWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0);
    return documentWidth - document.documentElement.clientWidth;
  });

  expect(overflow).toBeLessThanOrEqual(2);
}

async function expectMinTouchTarget(locator: Locator, minSize = 44) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  const measurementTolerance = 2;
  expect(box!.height + measurementTolerance).toBeGreaterThanOrEqual(minSize);
  expect(box!.width + measurementTolerance).toBeGreaterThanOrEqual(minSize);
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

test.beforeEach(stubZeroTouchPoints);

test.describe("Clinical KB tools launcher", () => {
  test.describe.configure({ timeout: 60_000 });

  for (const viewport of [
    { name: "mobile", width: 390, height: 820 },
    { name: "desktop", width: 1280, height: 900 },
  ] as const) {
    test(`tools launcher is usable at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await gotoLauncher(page);

      await expect(page.getByRole("heading", { level: 1, name: "Tools" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Quick tool shortcuts" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "All tools" })).toBeVisible();
      await expect(page.locator("#launcher-results-panel")).toHaveAttribute("role", "group");
      await expect(page.locator("#launcher-results-panel")).toHaveAttribute("aria-label", "All tools");
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
        await expect(page.getByRole("button", { name: "View details for Clinical KB Search" })).toBeVisible();
      }
      await expect(page.getByLabel("Mode Tools")).toBeVisible();
      await expect(visibleGlobalSearchInput(page)).toHaveCount(1);
      if (viewport.name === "mobile") {
        // Phones dock the compact shared search at the bottom edge.
        await expect(page.locator("form.answer-footer-search-dock").getByTestId("global-search-input")).toBeVisible();
      } else {
        await expect(page.getByTestId("tools-home").getByTestId("global-search-input")).toBeVisible();
      }
      await expect(page.getByTestId("tools-local-search-input")).toHaveCount(0);
      await expectNoPageHorizontalOverflow(page);
    });
  }

  test("standalone tools route uses the shared global search", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoLauncher(page, "/tools");

    await expect(page.getByRole("heading", { level: 1, name: "Tools" })).toBeVisible();
    await expect(visibleGlobalSearchInput(page)).toHaveCount(1);
    await expect(page.getByTestId("tools-home").getByTestId("global-search-input")).toBeVisible();
    await expect(page.getByTestId("tools-local-search-input")).toHaveCount(0);

    // Typing in the shared composer live-filters the tools grid, matching /?mode=tools.
    await visibleGlobalSearchInput(page).fill("medication");
    await expect(page.getByTestId("application-card-medication-prescribing")).toBeVisible();
    await expect(page.getByTestId("application-card-documents")).toBeHidden();
    await expectNoPageHorizontalOverflow(page);
  });

  test("launcher links point to the expected in-app modes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoLauncher(page);

    for (const [title, href] of [
      ["Medication Prescribing", "/?mode=prescribing"],
      ["Documents", "/?mode=documents"],
      ["Services", "/services"],
      ["Forms", "/forms"],
      ["Saved workflows", "/favourites"],
      ["Clinical KB Search", "/?mode=answer"],
    ] as const) {
      const detailsButton = page.getByRole("button", { name: `View details for ${title}` });
      await expect(detailsButton).toHaveAttribute("aria-haspopup", "dialog");
      await detailsButton.click();
      const dialog = page.getByRole("dialog", { name: title });
      await expect(dialog.locator(`a[href="${href}"]`).first()).toBeVisible();
      await page.getByRole("button", { name: `Close ${title}` }).click();
    }
    // External companion-app launchers were removed; no localhost links should remain.
    await expect(page.locator('a[href^="http://localhost"], a[href^="http://127.0.0.1"]')).toHaveCount(0);
  });

  test("search and filters reduce visible application rows without overflow", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoLauncher(page);

    await visibleGlobalSearchInput(page).fill("medication");

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
    const medicationDetails = toolsHub.getByRole("button", { name: "View details for Medication Prescribing" });
    await expect(medicationDetails).toHaveAttribute("aria-haspopup", "dialog");
    await expect(toolsHub.getByTestId("application-card-documents")).toBeHidden();
    await expect(toolsHub.getByTestId("tool-mode-result-medications")).toHaveCount(0);

    await medicationDetails.click();
    const medicationDialog = page.getByRole("dialog", { name: "Medication Prescribing" });
    await expect(medicationDialog).toBeVisible();
    const medicationLaunch = medicationDialog.locator('a[href="/?mode=prescribing"]').first();
    await expect(medicationLaunch).toBeVisible();
    await expect(medicationLaunch).toHaveAttribute("href", "/?mode=prescribing");
    await expectNoPageHorizontalOverflow(page);
  });

  test("mode toggle stays global on the services home route", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    // Asserts the collapsed rail affordance below; seed the remembered
    // preference now that new users default to the labelled sidebar.
    await page.addInitScript(() => window.localStorage.setItem("clinical-kb-sidebar-collapsed", "1"));
    await gotoLauncher(page, "/?mode=answer");

    const answerMenu = await openAppModeMenu(page, "Answer");
    const servicesMode = answerMenu.getByRole("menuitemradio", { name: /^Services\b/ });
    await waitForReactEventHandler(servicesMode);
    await servicesMode.click();
    await expect(page).toHaveURL(/\/services$/, { timeout: 20_000 });

    await expect(page).toHaveURL(/\/services$/);
    await expect(page.getByRole("button", { name: "Mode Services" })).toBeVisible();
    await expect(page.getByTestId("services-home")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Services" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
    await expect(page.getByTestId("collapsed-account-settings")).toBeVisible();
    await expect(visibleGlobalSearchInput(page)).toHaveCount(1);
    const servicesHomeSearch = page.getByTestId("services-home").getByTestId("global-search-input");
    await expect(servicesHomeSearch).toBeVisible();
    const servicesSearchBox = await servicesHomeSearch.boundingBox();
    const servicesHeadingBox = await page.getByRole("heading", { level: 1, name: "Services" }).boundingBox();
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
    const formsMode = servicesMenu.getByRole("menuitemradio", { name: /^Forms\b/ });
    await waitForReactEventHandler(formsMode);
    await formsMode.click();
    await expect(page).toHaveURL(/\/forms$/, { timeout: 20_000 });
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
    const formsMode = menu.getByRole("menuitemradio", { name: /^Forms\b/ });
    await expect(formsMode).toBeVisible();
    await waitForReactEventHandler(formsMode);
    await formsMode.click();

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
    const servicesMode = menu.getByRole("menuitemradio", { name: /^Services\b/ });
    await expect(servicesMode).toBeVisible();
    await waitForReactEventHandler(servicesMode);
    await servicesMode.click();

    await expect(page).toHaveURL(/\/services$/);
    await expect(page.getByRole("button", { name: "Mode Services" })).toBeVisible();
    await expect(page.getByTestId("services-home")).toBeVisible();
    await expect(page.getByTestId("service-search-results")).toHaveCount(0);
    await expect(visibleGlobalSearchInput(page)).toHaveCount(1);
    await expect(visibleGlobalSearchInput(page)).toHaveValue("");
    await expectNoPageHorizontalOverflow(page);
  });

  test("phone keeps the answer home search centered in the hero with the privacy notice", async ({ page }) => {
    await mockAnswerDashboardApi(page);
    await page.setViewportSize({ width: 390, height: 820 });

    await gotoLauncher(page, "/?mode=answer");
    await expect(page.getByTestId("answer-empty-state")).toBeVisible();
    await expect(visibleGlobalSearchInput(page)).toHaveCount(1, { timeout: 15_000 });

    const heroSearch = page.getByTestId("answer-empty-state").getByTestId("global-search-input");
    await expect(heroSearch).toBeVisible();

    const searchBox = await heroSearch.boundingBox();
    const headingBox = await page.getByRole("heading", { level: 2, name: "How can I help?" }).boundingBox();
    const mainBox = await page.locator("#main-content").boundingBox();
    expect(searchBox).not.toBeNull();
    expect(headingBox).not.toBeNull();
    expect(mainBox).not.toBeNull();
    expect((headingBox?.y ?? 0) + (headingBox?.height ?? 0)).toBeLessThan(searchBox?.y ?? 0);
    // The home centres its hero+search block in the scrollable main pane on
    // phones (below the sticky header), not necessarily the full viewport.
    const searchMidpoint = (searchBox?.y ?? 0) + (searchBox?.height ?? 0) / 2;
    const mainTop = mainBox?.y ?? 0;
    const mainHeight = mainBox?.height ?? 820;
    expect(searchMidpoint).toBeLessThan(mainTop + mainHeight * 0.72);
    expect(searchMidpoint).toBeGreaterThan(mainTop + mainHeight * 0.08);
    const metrics = await globalSearchComposerMetrics(page, "answer-empty-state");
    expect(metrics).not.toBeNull();
    expect(metrics?.position).not.toBe("fixed");
    expect(metrics?.formWidth ?? 0).toBeLessThanOrEqual(390 - 16);
    expect(metrics?.pillClassName).toContain("answer-footer-search-pill");
    expect(metrics?.homeCenterX).not.toBeNull();
    expect(Math.abs((metrics?.formCenterX ?? 0) - (metrics?.homeCenterX ?? 0))).toBeLessThanOrEqual(24);
    await expect(page.locator(".answer-footer-search-chip:visible")).toHaveCount(0);
    // The home hero is the only phone surface with the APP-5 privacy notice.
    await expect(page.getByTestId("answer-composer-privacy-warning")).toBeVisible();
    await expectNoPageHorizontalOverflow(page);
  });

  test("phone mode homes keep the in-flow hero pill, matching the answer home", async ({ page }) => {
    await mockAnswerDashboardApi(page);
    await page.setViewportSize({ width: 390, height: 820 });

    for (const home of [
      { path: "/services", testId: "services-home" },
      { path: "/forms", testId: "forms-home" },
      { path: "/differentials", testId: "differentials-home" },
      { path: "/factsheets", testId: "factsheets-home-main" },
      { path: "/favourites", testId: "favourites-hub" },
      { path: "/tools", testId: "tools-home" },
    ] as const) {
      await gotoLauncher(page, home.path);
      await expect(page.getByTestId(home.testId)).toBeVisible();
      await expect(visibleGlobalSearchInput(page)).toHaveCount(1, { timeout: 15_000 });

      // The composer sits in the middle of the hero (in-flow) at phone width too,
      // not docked to the bottom edge: it renders inside the mode-home composer
      // slot and there is no fixed bottom dock.
      await expect(page.locator(".mode-home-composer-slot").getByTestId("global-search-input"), home.path).toHaveCount(
        1,
      );
      await expect(page.locator("form.answer-footer-search-dock"), home.path).toHaveCount(0);

      const metrics = await globalSearchComposerMetrics(page, home.testId);
      expect(metrics, home.path).not.toBeNull();
      // In-flow (not viewport-fixed), scrolls with the content, and stays within
      // the phone column. The pill class is shared with the dock, so it still
      // reads answer-footer-search-pill.
      expect(metrics?.position, home.path).not.toBe("fixed");
      expect(metrics?.formWidth ?? 0).toBeLessThanOrEqual(390);
      expect(metrics?.pillClassName).toContain("answer-footer-search-pill");
      // The APP-5 privacy notice rides the hero pill on phones too (as on desktop).
      await expect(page.getByTestId("answer-composer-privacy-warning"), home.path).toBeVisible();

      // The in-flow composer must not cover the page with the universal sheet.
      const heroInput = page.locator(".mode-home-composer-slot").getByTestId("global-search-input");
      await heroInput.click();
      await heroInput.press("ArrowDown");
      await expect(page.locator(".universal-command-dropdown:visible")).toHaveCount(0);
      await expect(page.getByRole("listbox")).toHaveCount(0);
      await expectNoPageHorizontalOverflow(page);
    }
  });

  // Required-gate guard for the bug class PR #456 fixed and then reintroduced in
  // a narrower form: a mode-home page rendering with NO search composer at some
  // width. Presence plus hero containment are asserted at the extreme widths on
  // one dashboard-shell home and one standalone-shell home; the full 5-route
  // design spec stays in the advisory "mode home routes center the shared
  // search on mobile" test above.
  for (const viewport of [
    { name: "phone", width: 390, height: 820 },
    { name: "desktop", width: 1280, height: 900 },
  ] as const) {
    for (const home of [
      { path: "/?mode=answer", testId: "answer-empty-state" },
      { path: "/services", testId: "services-home" },
    ] as const) {
      test(`mode home search composer is present at ${viewport.name} width on ${home.path} @critical`, async ({
        page,
      }) => {
        await mockAnswerDashboardApi(page);
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await gotoLauncher(page, home.path);
        await expect(page.getByTestId(home.testId)).toBeVisible();
        // The composer must never vanish: exactly one visible search input.
        await expect(visibleGlobalSearchInput(page)).toHaveCount(1, { timeout: 15_000 });
        // The hero owns the composer at every width: the answer home and every
        // standalone mode home keep the in-flow hero pill, phones included.
        await expect(page.getByTestId(home.testId).getByTestId("global-search-input")).toBeVisible();
      });
    }
  }

  test("answer composer keeps the PHI warning visible before submission @critical", async ({ page }) => {
    await mockAnswerDashboardApi(page);

    for (const viewport of [
      { width: 390, height: 820 },
      { width: 1280, height: 900 },
    ] as const) {
      await page.setViewportSize(viewport);
      await gotoLauncher(page, "/?mode=answer");

      const warning = page.getByTestId("answer-composer-privacy-warning");
      await expect(warning).toBeVisible();
      await expect(warning).toContainText("Do not enter patient-identifiable information.");
      await expect(warning.getByRole("link", { name: "Privacy and data processing" })).toBeVisible();
      await expect(visibleGlobalSearchInput(page)).toHaveAttribute(
        "aria-describedby",
        "answer-composer-privacy-warning",
      );
      // The composer notice is the single site-wide privacy element — no other
      // /privacy link (e.g. the old hero-footer duplicate) may render with it.
      await expect(page.locator('a[href="/privacy"]')).toHaveCount(1);
    }
  });

  for (const home of [
    { path: "/?mode=answer", testId: "answer-empty-state", heroTestId: "answer-empty-state" },
    { path: "/?mode=documents", testId: "document-search-empty-state", heroTestId: "document-search-empty-state" },
    { path: "/?mode=prescribing", testId: "medication-home", heroTestId: "medication-home" },
    { path: "/?mode=tools", testId: "tools-home", heroTestId: "tools-home" },
    { path: "/services", testId: "services-home", heroTestId: "services-home-template" },
    { path: "/forms", testId: "forms-home", heroTestId: "forms-home-template" },
    { path: "/differentials", testId: "differentials-home", heroTestId: "differentials-home-template" },
  ] as const) {
    test(`mode home hero uses the shared mobile sizing on ${home.path}`, async ({ page }) => {
      await mockAnswerDashboardApi(page);
      await page.setViewportSize({ width: 390, height: 820 });
      await gotoLauncher(page, home.path);
      const homeRegion = page.getByTestId(home.testId);
      await expect(homeRegion).toBeVisible();

      const icon = homeRegion.locator(".mode-home-icon").first();
      await expect(icon).toBeVisible();
      const iconBox = await icon.boundingBox();
      expect(iconBox, `${home.path} hero icon`).not.toBeNull();

      // ModeHomeHero gives its heading the deterministic id `<heroTestId>-title`
      // (role/name lookups can collide with sr-only section headings).
      const heading = page.locator(`#${home.heroTestId}-title`);
      await expect(heading).toBeVisible();
      const headingFontSize = await heading.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
      const subtitle = heading.locator("xpath=following-sibling::p[1]");
      await expect(subtitle).toBeVisible();
      const subtitleFontSize = await subtitle.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));

      const metrics = {
        iconWidth: Math.round(iconBox?.width ?? 0),
        iconHeight: Math.round(iconBox?.height ?? 0),
        headingFontSize,
        subtitleFontSize,
      };
      expect(metrics.iconWidth).toBe(44);
      expect(metrics.iconHeight).toBe(44);
      expect(metrics.headingFontSize).toBeCloseTo(23.2, 1);
      expect(metrics.subtitleFontSize).toBeCloseTo(14, 1);

      await expectNoPageHorizontalOverflow(page);
    });
  }

  test("phone bottom-dock search keeps the command results sheet hidden", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 820 });
    await gotoLauncher(page, "/services?q=13YARN&focus=1&run=1");
    await expect(page.getByRole("button", { name: "Mode Services" })).toBeVisible();
    const input = visibleGlobalSearchInput(page).first();
    await expect(input).toBeVisible();

    // Phones keep the full search results in the page instead of opening a
    // command sheet over the small viewport.
    await input.click();
    await input.press("ArrowDown");
    await expect(page.locator(".universal-command-dropdown:visible")).toHaveCount(0);
    await expect(page.getByRole("listbox", { name: "Services search suggestions" })).toHaveCount(0);
    await expectNoPageHorizontalOverflow(page);
  });

  test("tablet mode homes keep the shared search in the hero, not the bottom dock", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    for (const home of ["/services", "/forms", "/differentials", "/tools"]) {
      await gotoLauncher(page, home);
      const heroInput = page.locator(".mode-home-composer-slot").getByTestId("global-search-input");
      await expect(heroInput).toBeVisible({ timeout: 15_000 });
      await expect(page.locator("form.answer-footer-search-dock")).toHaveCount(0);

      // The pill sits in the flow of the hero, not fixed to the viewport bottom.
      const geometry = await heroInput.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, viewportHeight: window.innerHeight };
      });
      expect(geometry.top).toBeGreaterThan(0);
      expect(geometry.bottom).toBeLessThan(geometry.viewportHeight - 40);
      await expectNoPageHorizontalOverflow(page);
    }
  });

  test("desktop answer footer opens the command surface above the pill", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockAnswerDashboardApi(page);
    await gotoLauncher(page, "/?mode=answer&q=lithium+dosing&run=1");
    await expect(page.getByTestId("plain-answer-response")).toHaveCount(1, { timeout: 30_000 });

    const metrics = await globalSearchComposerMetrics(page);
    expect(metrics?.position).toBe("fixed");
    await expect(page.locator(".answer-footer-search-chip:visible")).toHaveCount(0);
    await commandSurfaceOpensAbovePill(page);
    await expectNoPageHorizontalOverflow(page);
  });

  for (const viewport of [
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1280, height: 900 },
  ] as const) {
    for (const home of [
      { path: "/?mode=answer", testId: "answer-empty-state", heading: "How can I help?", headingLevel: 2 },
      { path: "/?mode=documents", testId: "document-search-empty-state", heading: "Documents", headingLevel: 2 },
      {
        path: "/?mode=prescribing",
        testId: "medication-home",
        heading: "Medication",
        headingLevel: 2,
      },
      { path: "/services", testId: "services-home", heading: "Services", headingLevel: 1 },
      { path: "/forms", testId: "forms-home", heading: "Forms", headingLevel: 1 },
      { path: "/differentials", testId: "differentials-home", heading: "Differentials", headingLevel: 1 },
      { path: "/tools", testId: "tools-home", heading: "Tools", headingLevel: 1 },
    ] as const) {
      test(`mode home search is centered at ${viewport.name} width on ${home.path}`, async ({ page }) => {
        await mockAnswerDashboardApi(page);
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await gotoLauncher(page, home.path);
        await expect(page.getByTestId(home.testId)).toBeVisible();
        await expect(visibleGlobalSearchInput(page)).toHaveCount(1);

        // From the tablet breakpoint up the composer is portaled into the hero
        // (inside the mode-home container) rather than floated over the heading.
        const heroSearch = page.getByTestId(home.testId).getByTestId("global-search-input");
        await expect(heroSearch).toBeVisible();

        const searchBox = await heroSearch.boundingBox();
        // Scope to the mode-home container and match exactly: the standalone
        // "Medication" hero title is otherwise a substring of the answer
        // section's sr-only "Medication matches" heading (strict-mode clash).
        const headingBox = await page
          .getByTestId(home.testId)
          .getByRole("heading", { level: home.headingLevel, name: home.heading, exact: true })
          .boundingBox();
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
        await expectNoPageHorizontalOverflow(page);
      });
    }
  }

  for (const viewport of [
    { name: "mobile", width: 390, height: 820 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1280, height: 900 },
  ] as const) {
    for (const route of [
      { path: "/services?q=13YARN&focus=1&run=1", modeButton: "Mode Services", compactBottomSearch: true },
      { path: "/services/13yarn", modeButton: "Mode Services", compactBottomSearch: true },
      { path: "/forms?q=transport&focus=1&run=1", modeButton: "Mode Forms", compactBottomSearch: true },
      { path: "/favourites?q=lithium&focus=1&run=1", modeButton: "Mode Favourites", compactBottomSearch: true },
      {
        path: "/differentials?q=acute+confusion&focus=1&run=1",
        modeButton: "Mode Differentials",
        compactBottomSearch: true,
      },
    ] as const) {
      test(`search route keeps the correct composer at ${viewport.name} width on ${route.path}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await gotoLauncher(page, route.path);
        await expect(page.getByRole("button", { name: route.modeButton })).toBeVisible({ timeout: 20_000 });
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
          await expect(page.locator(".answer-footer-search-chip:visible")).toHaveCount(0);
          if (route.compactBottomSearch) {
            // Edge-to-edge dock: the form itself must sit flush to the viewport
            // bottom (safe-area is padding inside the form, not a `bottom` gap).
            expect(metrics?.formBottom ?? 0).toBeGreaterThanOrEqual(viewport.height - 2);
          }
        } else {
          expect(metrics?.position).toBe("sticky");
          expect(metrics?.formCenterY ?? viewport.height).toBeLessThan(viewport.height * 0.25);
          await expect(page.locator(".answer-footer-search-chip:visible")).toHaveCount(0);
        }

        await expectNoPageHorizontalOverflow(page);
      });
    }
  }

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

  test("forms mode shows registry-backed form records without unsupported pathway claims", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockAnswerDashboardApi(page);
    await gotoLauncher(page, "/forms?q=transport%20forms&focus=1&run=1");

    await expect(page.getByRole("button", { name: "Mode Forms" })).toBeVisible();
    await expect(visibleGlobalSearchInput(page)).toHaveValue("transport forms");
    await expect(page.getByTestId("form-search-results")).toBeVisible();
    await expect(page.getByTestId("form-search-results")).toContainText("Best matches");
    await expect(page.getByTestId("form-search-result-transport-crisis-form")).toContainText("Transport order");
    await expect(page.getByTestId("form-search-result-extension-transport-order")).toContainText(
      "Extension of transport order",
    );
    await expect(page.getByTestId("form-search-result-detention-examination-movement")).toContainText(
      "Detention order",
    );
    await expect(page.getByTestId("form-search-result-transfer-order")).toContainText("Transfer order");
    await expect(
      page.getByTestId("form-search-result-transport-crisis-form").getByLabel("Open Transport order"),
    ).toHaveAttribute("href", "/forms/transport-crisis-form");
    await expect(page.getByRole("button", { name: "Refine" })).toHaveCount(0);
    await expect(page.getByTestId("form-search-results")).not.toContainText(/pathway/i);
    await expect(page.getByText(/Evidence 278|Pathways 12|Tasks 8|Source verified|Aligned to MHA 2014/)).toHaveCount(0);
    await expect(page.getByText(/PSOLIS Transport|View full pathway/)).toHaveCount(0);
    await expect(page.getByTestId("service-search-results")).toHaveCount(0);
    await expectNoPageHorizontalOverflow(page);
  });

  test("result sorting persists in the URL and restores through browser history", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockAnswerDashboardApi(page);
    await gotoLauncher(page, "/forms?q=transport%20forms&focus=1&run=1");

    const results = page.getByTestId("form-search-results");
    const visibleSort = page.locator('select[aria-label="Sort results"]:visible');
    const expectedAlphaFirstTestId = `form-search-result-${
      sortResultItems(rankFormRecords(formRecords, "transport forms"), "alpha", (match) => match.service.title)[0]
        ?.service.slug
    }`;
    await expect(results.locator('article[data-testid^="form-search-result-"]').first()).toHaveAttribute(
      "data-testid",
      "form-search-result-transport-crisis-form",
    );

    await visibleSort.selectOption("alpha");
    await expect(page).toHaveURL(/\bsort=alpha\b/);
    await expect(results.locator('article[data-testid^="form-search-result-"]').first()).toHaveAttribute(
      "data-testid",
      expectedAlphaFirstTestId,
    );

    await page.goBack();
    await expect(visibleSort).toHaveValue("relevance");
    await expect(results.locator('article[data-testid^="form-search-result-"]').first()).toHaveAttribute(
      "data-testid",
      "form-search-result-transport-crisis-form",
    );

    await page.goForward();
    await expect(visibleSort).toHaveValue("alpha");
    await expect(results.locator('article[data-testid^="form-search-result-"]').first()).toHaveAttribute(
      "data-testid",
      expectedAlphaFirstTestId,
    );
    await expectNoPageHorizontalOverflow(page);
  });

  test("form detail pages keep the shared forms search wired to form results", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockAnswerDashboardApi(page);
    await gotoLauncher(page, "/forms/transport-crisis-form");
    await expect(page.getByTestId("form-detail-page")).toBeVisible({ timeout: 30_000 });

    // Structural coverage — runs on every browser, WebKit included: the form
    // detail page renders inside the shared shell with the Forms-mode composer
    // present and no stale results.
    await expect(page.getByRole("button", { name: "Mode Forms" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Transport order" })).toBeVisible();
    await expect(page.getByTestId("form-search-results")).toHaveCount(0);
    const formsSearchInput = page.locator('input[placeholder="Search forms..."]:visible').first();
    await expect(formsSearchInput).toBeVisible();

    await expect(page.getByText("Loading your forms registry...")).toBeHidden({ timeout: 30_000 });
    const formsSearchButton = page.getByRole("button", { name: "Search forms" });
    await formsSearchInput.fill("transport forms");
    await expect(formsSearchButton).toBeEnabled();
    await waitForReactEventHandler(formsSearchButton.locator("xpath=ancestor::form[1]"), "onSubmit");
    await formsSearchButton.click();
    await expect(page).toHaveURL(/\/forms\?.*\bq=transport(?:\+|%20)forms\b/, { timeout: 20_000 });
    await expect(page.getByTestId("form-search-results")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("form-search-result-transport-crisis-form")).toContainText("Transport order");
    await expect(
      page.getByTestId("form-search-result-transport-crisis-form").getByLabel("Open Transport order"),
    ).toHaveAttribute("href", "/forms/transport-crisis-form");
    await expectNoPageHorizontalOverflow(page);
  });

  test("form detail mobile renders decision context after the form content", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockAnswerDashboardApi(page);
    await gotoLauncher(page, "/forms/transport-crisis-form");

    await expect(page.getByTestId("form-detail-page")).toBeVisible();
    await expect(page.getByTestId("form-decision-context-mobile")).toBeVisible();
    await expect(page.locator('[data-testid="global-search-input"]:visible')).toHaveCount(1);

    // Decision context now stacks below the priority facts and source snapshot
    // on phones — the primary form content reads first.
    await expectVerticalSeparation(
      page,
      '[aria-label="Priority facts"]',
      '[data-testid="form-decision-context-mobile"]',
      8,
    );
    await expectNoPageHorizontalOverflow(page);
  });

  test("forms search mockup is usable without horizontal overflow on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockAnswerDashboardApi(page);
    await gotoLauncher(page, "/forms?q=transport&focus=1&run=1");

    await expect(page.getByTestId("form-search-mobile-results")).toBeVisible();
    await expect(page.getByTestId("form-search-mobile-result-transport-crisis-form")).toContainText("Transport order");
    await expect(page.getByTestId("form-search-mobile-results")).not.toContainText(/pathway/i);
    await expect(page.getByText(/PSOLIS Transport|View full pathway|Source verified/)).toHaveCount(0);
    await expect(visibleGlobalSearchInput(page)).toHaveValue("transport");
    await expectNoPageHorizontalOverflow(page);
  });

  test("phone bottom search dock stays edge-to-edge with safe-area padding inside the form", async ({ page }) => {
    // Guards the white-strip regression: a non-zero CSS `bottom` on the dock
    // (or a 100dvh shell dead band) leaves blank page chrome under the pill.
    // Safe-area must be padding inside a form flush to the viewport bottom.
    await page.setViewportSize({ width: 390, height: 844 });
    const safeAreaBottom = 34;

    for (const route of [
      { path: "/forms?q=transport&run=1", resultsTestId: "form-search-mobile-results" },
      { path: "/differentials?q=acute+confusion&run=1", resultsTestId: "differentials-search-results" },
    ] as const) {
      await gotoLauncher(page, route.path);
      await expect(page.getByTestId(route.resultsTestId)).toBeVisible({ timeout: 20_000 });
      const dock = page.locator("form.answer-footer-search-dock");
      await expect(dock, route.path).toBeVisible();
      await expect(dock, route.path).not.toHaveAttribute("data-scroll-hidden", "true");

      await page.evaluate((inset) => {
        document.documentElement.style.setProperty("--safe-area-bottom", `${inset}px`);
      }, safeAreaBottom);

      const geometry = await dock.evaluate((node) => {
        const style = window.getComputedStyle(node);
        const formRect = node.getBoundingClientRect();
        const pill = node.querySelector(".answer-footer-search-pill");
        const pillRect = pill?.getBoundingClientRect();
        return {
          bottomCss: style.bottom,
          paddingBottom: Number.parseFloat(style.paddingBottom),
          formBottom: formRect.bottom,
          pillBottom: pillRect?.bottom ?? null,
          viewportHeight: window.innerHeight,
        };
      });

      expect(geometry.bottomCss, route.path).toBe("0px");
      expect(Math.abs(geometry.formBottom - geometry.viewportHeight), route.path).toBeLessThanOrEqual(1);
      expect(geometry.paddingBottom, route.path).toBeGreaterThanOrEqual(safeAreaBottom - 1);
      expect(geometry.pillBottom, route.path).not.toBeNull();
      // Pill sits above the safe-area pad; do not require exact px (borders/gaps).
      expect(geometry.pillBottom!, route.path).toBeLessThanOrEqual(
        geometry.viewportHeight - safeAreaBottom + 2,
      );
    }
  });

  test("phone bottom search dock hides while scrolling down on search results", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoLauncher(page, "/forms?q=transport&focus=1&run=1");

    await expect(page.getByTestId("form-search-mobile-results")).toBeVisible();
    const dock = page.locator("form.answer-footer-search-dock");
    await expect(dock).toBeVisible();
    await expect(dock).not.toHaveAttribute("data-scroll-hidden", "true");
    const main = page.locator("#main-content");
    // Safari reports its translucent bottom toolbar through the safe-area
    // inset. Make that region deliberately large so this catches the exact
    // toolbar-sized blank band seen on an iPhone, even in Chromium CI.
    await page.evaluate(() => {
      document.documentElement.style.setProperty("--safe-area-bottom", "112px");
    });
    await expect.poll(async () => readMobileComposerReservePx(main)).toBeGreaterThan(112);
    const visibleMainGeometry = await main.evaluate((node) => {
      const style = window.getComputedStyle(node);
      return {
        bottom: Math.round(node.getBoundingClientRect().bottom),
        marginBottom: Number.parseFloat(style.marginBottom),
        viewportHeight: window.innerHeight,
      };
    });
    expect(visibleMainGeometry.marginBottom).toBe(0);
    expect(Math.abs(visibleMainGeometry.bottom - visibleMainGeometry.viewportHeight)).toBeLessThanOrEqual(1);
    const transition = await dock.evaluate((node) => {
      const style = window.getComputedStyle(node);
      const durationMs = Math.max(
        ...style.transitionDuration.split(",").map((value) => {
          const normalized = value.trim();
          const duration = Number.parseFloat(normalized);
          return normalized.endsWith("ms") ? duration : duration * 1000;
        }),
      );
      return { durationMs, property: style.transitionProperty };
    });
    expect(transition.property).toMatch(/transform|all/);
    expect(transition.durationMs).toBeGreaterThanOrEqual(100);

    // focus=1 leaves the composer focused; hide-on-scroll stays off while it has focus.
    const input = visibleGlobalSearchInput(page).first();
    await input.focus();
    await page.keyboard.press("Escape");
    await input.blur();
    await expect(dock).not.toHaveAttribute("data-command-open", "true");

    // Inject a spacer to ensure the container is scrollable even with minimal search results
    await page.evaluate(() => {
      const container = document.getElementById("main-content");
      if (container) {
        const spacer = document.createElement("div");
        spacer.id = "test-scroll-spacer";
        spacer.style.height = "2000px";
        spacer.style.minHeight = "2000px";
        spacer.style.display = "block";
        container.appendChild(spacer);
      }
    });

    // Treat the deliberate scroll and its resulting UI state as one retriable
    // action. Firefox/WebKit can finish the focus=1 hydration effect after the
    // first scripted blur/scroll, which legitimately keeps the dock visible.
    await expect(async () => {
      await input.blur();
      await expect(input).not.toBeFocused({ timeout: 1_000 });
      await scrollPrimarySurface(page, 0);
      for (const offset of [40, 80, 120, 160, 200]) {
        await scrollPrimarySurface(page, offset);
      }
      await expect(dock).toHaveAttribute("data-scroll-hidden", "true", { timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await expect
      .poll(async () => dock.evaluate((node) => window.getComputedStyle(node).transform !== "none"))
      .toBe(true);
    await expect.poll(async () => readMobileComposerReservePx(main)).toBeLessThanOrEqual(13);
    const hiddenMainGeometry = await main.evaluate((node) => {
      const style = window.getComputedStyle(node);
      return {
        bottom: Math.round(node.getBoundingClientRect().bottom),
        marginBottom: Number.parseFloat(style.marginBottom),
        viewportHeight: window.innerHeight,
      };
    });
    expect(hiddenMainGeometry.marginBottom).toBe(0);
    expect(Math.abs(hiddenMainGeometry.bottom - hiddenMainGeometry.viewportHeight)).toBeLessThanOrEqual(1);

    await scrollPrimarySurface(page, 60);
    await expect(dock).not.toHaveAttribute("data-scroll-hidden", "true");
    await expect
      .poll(async () => dock.evaluate((node) => window.getComputedStyle(node).transform === "none"))
      .toBe(true);
    await expect.poll(async () => readMobileComposerReservePx(main)).toBeGreaterThan(112);
  });

  test("tablet and desktop forms results keep non-phone bottom clearance", async ({ page }) => {
    // Phone dock reserve (max-sm) must not leak into sm+/lg layouts.
    for (const viewport of [
      { width: 768, height: 1024, label: "tablet" },
      { width: 1280, height: 900, label: "desktop" },
    ] as const) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await gotoLauncher(page, "/forms?q=transport&run=1");
      await expect(page.getByTestId("form-search-results")).toBeVisible();
      const main = page.locator("#main-content");
      await page.evaluate(() => {
        document.documentElement.style.setProperty("--safe-area-bottom", "112px");
      });
      const geometry = await main.evaluate((node) => {
        const style = window.getComputedStyle(node);
        return {
          paddingBottom: Number.parseFloat(style.paddingBottom),
          marginBottom: Number.parseFloat(style.marginBottom),
        };
      });
      // sm+ uses static desktop padding (pb-8 = 32px) or larger desktop dock
      // clearance — never the phone hide-collapse path alone.
      expect(geometry.paddingBottom, viewport.label).toBeGreaterThanOrEqual(32);
      // Phone-only hide transform should not be active on these widths.
      const dock = page.locator("form.answer-footer-search-dock");
      if ((await dock.count()) > 0 && (await dock.first().isVisible())) {
        await expect(dock.first()).not.toHaveAttribute("data-scroll-hidden", "true");
      }
    }
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
    await expect(page.getByRole("heading", { level: 1, name: "Forms" })).toBeVisible();
    await expect(page.getByTestId("services-home")).toHaveCount(0);
    await expect(page.getByTestId("global-search-input")).toHaveCount(1);
    const formsHomeSearch = page.getByTestId("forms-home").getByTestId("global-search-input");
    await expect(formsHomeSearch).toBeVisible();
    const formsSearchBox = await formsHomeSearch.boundingBox();
    const formsHeadingBox = await page.getByRole("heading", { level: 1, name: "Forms" }).boundingBox();
    expect(formsSearchBox).not.toBeNull();
    expect(formsHeadingBox).not.toBeNull();
    expect((formsHeadingBox?.y ?? 0) + (formsHeadingBox?.height ?? 0)).toBeLessThan(formsSearchBox?.y ?? 0);
    expect((formsSearchBox?.y ?? 0) + (formsSearchBox?.height ?? 0) / 2).toBeLessThan(900 * 0.62);
    await expectNoPageHorizontalOverflow(page);
  });

  test("mode toggle opens the differentials home inside the dashboard", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoLauncher(page, "/?mode=answer");

    const menu = await openAppModeMenu(page, "Answer");
    await menu.getByRole("menuitemradio", { name: /^Differentials\b/ }).click();

    await expect(page.getByRole("button", { name: "Mode Differentials" })).toBeVisible();
    await expect(page.getByTestId("differentials-home")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Differentials" })).toBeVisible();
    await expect(page.locator('input[placeholder="Ask or search a presentation"]:visible').first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Search presentations" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Compare differentials" })).toBeVisible();
    await expect(
      page.getByTestId("differentials-home").getByRole("region", { name: /^(Recent work|Library matches)$/ }),
    ).toBeVisible();
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
    await submitDifferentialSearch(page, "acute confusion");

    await expect.poll(() => searchRequests.length).toBeGreaterThan(0);
    expect(searchRequests.at(-1)).toMatchObject({
      query: "acute confusion",
      mode: "differentials",
      queryMode: "compare_guidance",
    });

    // Evidence arrived, so the results view renders — ranked from the imported
    // differentials catalogue with a real query-matched result row.
    await expect(page.getByTestId("differentials-search-results")).toBeVisible();
    await expect(page.getByTestId("differentials-catalogue-notice")).toBeVisible();
    await expect(page.getByText("Catalogue ranking").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Delirium / Acute Confusion / Encephalopathy" }).first()).toBeVisible();
  });

  test("differentials evidence-backed search badges stay single-line on narrow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    await page.route(/\/api\/setup-status(?:\?.*)?$/, async (route) => {
      await route.fulfill({
        json: {
          demoMode: true,
          checks: [
            { id: "env", label: ".env.local configured", status: "ready", detail: "Test environment ready." },
            { id: "project", label: "[REDACTED] target", status: "ready", detail: "Test project ready." },
            { id: "schema", label: "supabase/schema.sql applied", status: "ready", detail: "Test schema ready." },
            { id: "search", label: "Search RPC and vector indexes", status: "ready", detail: "Test search ready." },
            { id: "openai", label: "OpenAI API key available", status: "ready", detail: "Test OpenAI ready." },
          ],
        },
      });
    });
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

    await gotoLauncher(page, "/differentials");
    await page.locator('input[placeholder="Ask or search a presentation"]:visible').first().fill("acute confusion");
    await submitDifferentialSearch(page, "acute confusion");

    await expect(page.getByTestId("differentials-search-results")).toBeVisible();
    const tabs = page.getByTestId("differential-result-type-tabs");
    await expect(tabs).toBeVisible();
    await expect(tabs).toHaveAttribute("role", "group");
    await expect(tabs).toHaveAttribute("aria-label", "Result type");
    await expect(tabs.getByRole("button", { name: /All \(\d+\)/ })).toBeVisible();
    await expect(tabs.getByRole("button", { name: /Presentations \(\d+\)/ })).toBeVisible();
    await expect(tabs.getByRole("button", { name: /Diagnoses \(\d+\)/ })).toBeVisible();

    const tabMetrics = await tabs.getByRole("button").evaluateAll((buttons) =>
      buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        return { height: rect.height, scrollHeight: button.scrollHeight };
      }),
    );
    for (const tab of tabMetrics) {
      expect(tab.scrollHeight).toBeLessThanOrEqual(tab.height + 1);
    }

    const emergentBadge = page.getByTestId("differential-status-badge").first();
    await expect(emergentBadge).toBeVisible();
    await expect(emergentBadge).toHaveText(/Emergent/i);
    const badgeMetrics = await emergentBadge.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { height: rect.height, scrollHeight: element.scrollHeight };
    });
    expect(badgeMetrics.height).toBeGreaterThanOrEqual(22);
    expect(badgeMetrics.scrollHeight).toBeLessThanOrEqual(badgeMetrics.height + 1);
    await expectNoPageHorizontalOverflow(page);
  });

  test("differentials search badges stay single-line on narrow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    await page.route(/\/api\/setup-status(?:\?.*)?$/, async (route) => {
      await route.fulfill({
        json: {
          demoMode: true,
          checks: [
            { id: "env", label: ".env.local configured", status: "ready", detail: "Test environment ready." },
            { id: "project", label: "[REDACTED] target", status: "ready", detail: "Test project ready." },
            { id: "schema", label: "supabase/schema.sql applied", status: "ready", detail: "Test schema ready." },
            { id: "search", label: "Search RPC and vector indexes", status: "ready", detail: "Test search ready." },
            { id: "openai", label: "OpenAI API key available", status: "ready", detail: "Test OpenAI ready." },
          ],
        },
      });
    });
    await page.route(/\/api\/search(?:\?.*)?$/, async (route) => {
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

    await gotoLauncher(page, "/differentials");
    await page.locator('input[placeholder="Ask or search a presentation"]:visible').first().fill("acute confusion");
    await submitDifferentialSearch(page, "acute confusion");

    await expect(page.getByTestId("differentials-search-results")).toBeVisible();
    const tabs = page.getByTestId("differential-result-type-tabs");
    await expect(tabs).toBeVisible();
    await expect(tabs).toHaveAttribute("role", "group");
    await expect(tabs).toHaveAttribute("aria-label", "Result type");
    await expect(tabs.getByRole("button", { name: "All (8)" })).toBeVisible();
    await expect(tabs.getByRole("button", { name: "Presentations (1)" })).toBeVisible();
    await expect(tabs.getByRole("button", { name: "Diagnoses (7)" })).toBeVisible();

    const tabMetrics = await tabs.getByRole("button").evaluateAll((tabElements) =>
      tabElements.map((tab) => {
        const rect = tab.getBoundingClientRect();
        return { height: rect.height, scrollHeight: tab.scrollHeight };
      }),
    );
    for (const tab of tabMetrics) {
      expect(tab.scrollHeight).toBeLessThanOrEqual(tab.height + 1);
    }

    const emergentBadge = page.getByTestId("differential-status-badge").first();
    await expect(emergentBadge).toBeVisible();
    await expect(emergentBadge).toHaveText(/Emergent/i);
    const badgeMetrics = await emergentBadge.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { height: rect.height, scrollHeight: element.scrollHeight };
    });
    expect(badgeMetrics.height).toBeGreaterThanOrEqual(22);
    expect(badgeMetrics.scrollHeight).toBeLessThanOrEqual(badgeMetrics.height + 1);

    // Tall results must be top-aligned: Best Answer stays reachable at scrollTop 0.
    const mainContent = page.locator("#main-content");
    await expect.poll(() => mainContent.evaluate((element) => element.scrollTop)).toBe(0);
    const bestAnswer = page.getByTestId("differential-best-answer");
    await expect(bestAnswer).toBeVisible();
    const foldLayout = await bestAnswer.evaluate((best) => {
      const main = document.querySelector("#main-content");
      const header = document.querySelector("header.universal-header");
      if (!main) return null;
      const bestRect = best.getBoundingClientRect();
      const headerBottom = header?.getBoundingClientRect().bottom ?? main.getBoundingClientRect().top;
      return {
        scrollTop: main.scrollTop,
        bestTop: bestRect.top,
        bestBottom: bestRect.bottom,
        headerBottom,
        viewportHeight: window.innerHeight,
      };
    });
    expect(foldLayout).not.toBeNull();
    expect(foldLayout!.scrollTop).toBe(0);
    // Best Answer must start in the visible fold under the chrome — not clipped
    // above the scrollport (the ModeHomeMain justify-center regression). Bound
    // to the header band rather than a tight viewport fraction so tall chrome /
    // safe-area insets do not flake the upper-half check.
    expect(foldLayout!.bestTop).toBeGreaterThanOrEqual(foldLayout!.headerBottom - 2);
    expect(foldLayout!.bestTop).toBeLessThan(foldLayout!.headerBottom + 240);

    // Phone list hides the featured best answer, so ranks must start at 1.
    const mobileCards = page.getByTestId("differential-mobile-result-card");
    await expect(mobileCards.first()).toBeVisible();
    await expect(mobileCards.first().getByTestId("differential-mobile-result-rank")).toHaveText("1");
    const ranks = await mobileCards.getByTestId("differential-mobile-result-rank").allTextContents();
    expect(ranks).toEqual(ranks.map((_, index) => String(index + 1)));

    // Status badge sits on its own meta row below the title, never beside it.
    const titleBadgeLayout = await mobileCards.first().evaluate((card) => {
      const title = card.querySelector("a span.line-clamp-2") ?? card.querySelector("a");
      const badge = card.querySelector('[data-testid="differential-status-badge"]');
      if (!title || !badge) return null;
      const titleRect = title.getBoundingClientRect();
      const badgeRect = badge.getBoundingClientRect();
      return { titleBottom: titleRect.bottom, badgeTop: badgeRect.top };
    });
    expect(titleBadgeLayout).not.toBeNull();
    expect(titleBadgeLayout!.badgeTop).toBeGreaterThanOrEqual(titleBadgeLayout!.titleBottom - 1);

    const cardOverflow = await mobileCards.evaluateAll((cards) =>
      cards.map((card) => ({
        overflowX: card.scrollWidth > card.clientWidth + 1,
        width: card.clientWidth,
      })),
    );
    for (const card of cardOverflow) {
      expect(card.overflowX).toBe(false);
    }

    await expectNoPageHorizontalOverflow(page);
  });

  test("mobile differential compare dock hides on scroll down and stays tappable when revealed", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await mockAnswerDashboardApi(page);
    await mockDifferentialCatalogApi(page);
    await page.route(/\/api\/search(?:\?.*)?$/, async (route) => {
      await route.fulfill({
        json: {
          results: [],
          visualEvidence: [],
          relatedDocuments: [],
          documentMatches: [],
          relevance: { verdict: "weak", score: 0, directSourceCount: 0, weakSourceCount: 0 },
          smartPanel: {},
          telemetry: { query_class: "differential_compare", retrieval_strategy: "text_fast_path" },
          scope: { queryMode: "compare_guidance" },
          sourceGovernanceWarnings: [],
          demoMode: true,
        },
      });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoLauncher(page, "/differentials");

    const input = page.locator('input[placeholder="Ask or search a presentation"]:visible').first();
    const submit = page.locator('button[aria-label="Search differential presentations"]:visible');
    await input.fill("acute confusion");
    await expect(submit).toBeEnabled();
    const searchResponse = page.waitForResponse(
      (response) => response.url().includes("/api/search") && response.request().method() === "POST",
    );
    await submit.click();
    await searchResponse;

    const compareAction = page.getByTestId("differentials-compare-selected-mobile");
    const dock = page.locator("form.answer-footer-search-dock");
    const scrollport = page.getByTestId("differentials-search-results");
    const mainContent = page.locator("#main-content");
    await expect(scrollport).toBeVisible();
    await expect(page.locator("#differentials-mobile-compare-addon-slot")).toHaveCount(1);
    await expect(compareAction).toBeVisible();
    await expect(compareAction).toContainText("Compare selected");
    await expect(dock).not.toHaveAttribute("data-scroll-hidden", "true");

    // Keep the composer focused while measuring end-of-list clearance so
    // hide-on-scroll cannot collapse --mobile-composer-reserve mid-check.
    await input.focus();
    await expect(dock).not.toHaveAttribute("data-scroll-hidden", "true");
    await expect.poll(async () => readMobileComposerReservePx(mainContent)).toBeGreaterThan(180);
    await mainContent.evaluate((element) => element.scrollTo({ top: element.scrollHeight, behavior: "instant" }));
    await expect(dock).not.toHaveAttribute("data-scroll-hidden", "true");
    await expect.poll(async () => readMobileComposerReservePx(mainContent)).toBeGreaterThan(180);
    const clearance = await page.evaluate(() => {
      const main = document.getElementById("main-content");
      const last = document.querySelector('[data-testid="differential-mobile-result-card"]:last-of-type');
      const dock = document.querySelector("form.answer-footer-search-dock");
      const style = main ? window.getComputedStyle(main) : null;
      const pad = main?.querySelector<HTMLElement>('[data-testid="mobile-composer-reserve-pad"]');
      return {
        lastBottom: last?.getBoundingClientRect().bottom ?? null,
        dockTop: dock?.getBoundingClientRect().top ?? null,
        reservePx: pad
          ? Number.parseFloat(window.getComputedStyle(pad).paddingBottom)
          : style
            ? Number.parseFloat(style.paddingBottom)
            : null,
        reserve: style?.getPropertyValue("--mobile-composer-reserve").trim() ?? null,
        scrollHidden: dock?.getAttribute("data-scroll-hidden"),
        url: window.location.href,
      };
    });
    expect(clearance, JSON.stringify(clearance)).toMatchObject({
      scrollHidden: null,
    });
    expect(clearance.lastBottom ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(clearance.dockTop ?? 0);

    // Compare lives in the dock addon slot above the search pill.
    const revealedGeometry = await compareAction.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const dockRect = element.closest("form")?.getBoundingClientRect();
      const centreX = rect.left + rect.width / 2;
      const centreY = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(centreX, centreY);
      return {
        top: rect.top,
        bottom: rect.bottom,
        dockTop: dockRect?.top ?? null,
        dockBottom: dockRect?.bottom ?? null,
        viewportHeight: window.innerHeight,
        receivesPointer: hit === element || element.contains(hit),
      };
    });
    expect(revealedGeometry.dockTop).not.toBeNull();
    expect(revealedGeometry.top).toBeGreaterThanOrEqual(revealedGeometry.dockTop!);
    expect(revealedGeometry.bottom).toBeLessThanOrEqual(revealedGeometry.dockBottom!);
    expect(revealedGeometry.receivesPointer).toBe(true);
    // Last card must clear the floating compare CTA, not only the composer dock.
    expect(clearance.lastBottom ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(revealedGeometry.top);

    const reservePx = await readMobileComposerReservePx(mainContent);
    const dockHeight = await dock.evaluate((element) => element.getBoundingClientRect().height);
    expect(reservePx).toBeGreaterThanOrEqual(dockHeight);

    // Ensure enough scroll room for hide thresholds even with a short result list.
    await page.evaluate(() => {
      const container = document.getElementById("main-content");
      if (!container) return;
      const spacer = document.createElement("div");
      spacer.id = "test-scroll-spacer";
      spacer.style.height = "2000px";
      spacer.style.minHeight = "2000px";
      spacer.style.display = "block";
      container.appendChild(spacer);
    });

    // Apply the Safari toolbar simulation after the visible-dock clearance
    // checks above. A collapsed reserve that still includes the toolbar inset
    // must fail the ≤13px assertion below.
    await page.evaluate(() => {
      document.documentElement.style.setProperty("--safe-area-bottom", "112px");
    });
    await expect.poll(async () => readMobileComposerReservePx(mainContent)).toBeGreaterThan(200);

    await expect(async () => {
      await input.blur();
      await expect(input).not.toBeFocused({ timeout: 1_000 });
      await scrollPrimarySurface(page, 0);
      for (const offset of [40, 80, 120, 160, 200]) {
        await scrollPrimarySurface(page, offset);
      }
      await expect(dock).toHaveAttribute("data-scroll-hidden", "true", { timeout: 1_000 });
    }).toPass({ timeout: 15_000 });

    await expect
      .poll(async () => dock.evaluate((node) => window.getComputedStyle(node).transform !== "none"))
      .toBe(true);
    await expect.poll(async () => readMobileComposerReservePx(mainContent)).toBeLessThanOrEqual(13);

    // Wait for the hide transition to finish so the in-dock Compare bar is fully
    // off-screen (translateY(100%) parks the dock top on the viewport bottom edge).
    await expect
      .poll(async () =>
        compareAction.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return {
            top: rect.top,
            viewportHeight: window.innerHeight,
            offscreen: rect.top >= window.innerHeight - 1,
          };
        }),
      )
      .toMatchObject({ offscreen: true });

    await scrollPrimarySurface(page, 60);
    await expect(dock).not.toHaveAttribute("data-scroll-hidden", "true");
    await expect(compareAction).toBeVisible();
    // Poll through the reveal transition: a single elementFromPoint sample can
    // miss while translateY is still easing back into the viewport on CI.
    await expect
      .poll(async () =>
        compareAction.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
          return hit === element || element.contains(hit);
        }),
      )
      .toBe(true);
    await expectNoPageHorizontalOverflow(page);

    // The result cards and compare bar remain in their non-desktop layout up
    // to 1023px, so the composer must keep providing the portal host on tablet.
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator("#differentials-mobile-compare-addon-slot")).toHaveCount(1);
    await expect(compareAction).toBeVisible();
    await expect(compareAction).toContainText("Compare selected");
  });

  test("diagnosis detail actions stay tappable and tabs stay single-line", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await gotoLauncher(page, "/differentials/diagnoses/delirium");
    await expect(page.getByTestId("differential-detail-page")).toBeVisible();
    // The desktop action cluster must keep its intrinsic width (shrink-0) so the
    // icon action does not get crushed below the 44px tap standard.
    await expectMinTouchTarget(page.getByRole("button", { name: "Save diagnosis" }));

    // Tabs: no page overflow and single-line labels at the narrowest width.
    await page.setViewportSize({ width: 320, height: 700 });
    await expect(page.getByTestId("differential-detail-page")).toBeVisible();
    await expectNoPageHorizontalOverflow(page);
    const overviewTab = page.getByRole("tab", { name: "Overview" });
    await expect(overviewTab).toBeVisible();
    // Count rendered label lines from text-node rects (an icon rect would bridge
    // two wrapped lines and mask a wrap); the tab label must stay on one line.
    const overviewLineCount = await overviewTab.evaluate((element) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const rects: DOMRect[] = [];
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!(node.textContent ?? "").trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          if (rect.height > 4 && rect.width > 1) rects.push(rect);
        }
      }
      rects.sort((a, b) => a.top - b.top);
      let lines = 0;
      let lineBottom = Number.NEGATIVE_INFINITY;
      for (const rect of rects) {
        if (rect.top >= lineBottom - 4) {
          lines += 1;
          lineBottom = rect.bottom;
        } else {
          lineBottom = Math.max(lineBottom, rect.bottom);
        }
      }
      return lines;
    });
    expect(overviewLineCount).toBe(1);
  });

  test("differentials presentation comparison page stays wired to differentials mode", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 920 });
    const workflow = acuteConfusionPresentationWorkflow;
    await gotoLauncher(page, "/differentials/presentations");
    await expect(page).toHaveURL(/\/differentials\/presentations\/acute-confusion-encephalopathy/, { timeout: 30_000 });

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
    await expect(page.getByRole("button", { name: "Edit columns" })).toBeDisabled();
    await expect(page.getByText("Long press to reorder. Tap to remove.")).toHaveCount(0);
    await expect(page.getByTestId("global-search-input")).toHaveCount(0);

    const tableScrolls = await page.getByTestId("differential-comparison-scroll").evaluate((element) => {
      return element.scrollWidth > element.clientWidth;
    });
    expect(tableScrolls).toBe(true);
    const desktopTableBox = await page.getByTestId("differential-comparison-scroll").boundingBox();
    expect(desktopTableBox?.width ?? 0).toBeGreaterThan(900);
    await expectNoPageHorizontalOverflow(page);

    await gotoLauncher(page, "/differentials/presentations?ids=wernicke-encephalopathy");
    await expect(page).toHaveURL(/ids=wernicke-encephalopathy/);
    await expect(
      page.getByRole("heading", { name: `Selected differentials (1 of ${workflow.totalCount})` }).first(),
    ).toBeVisible();
    await expect(
      page.locator("span:visible", { hasText: `+${workflow.totalCount - 1} not selected` }).first(),
    ).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await gotoLauncher(page, "/differentials/presentations");

    await expect(page.getByTestId("differential-presentation-page")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("link", { name: "Back to differentials" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Compare", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { level: 1, name: workflow.title })).toBeVisible();
    const mobileComparison = page.getByLabel("Mobile differential comparison");
    await expect(mobileComparison.getByRole("button", { name: "Column filters unavailable" })).toBeDisabled();
    await expect(mobileComparison.getByText("Delirium", { exact: true }).first()).toBeVisible();
    await expect(mobileComparison.getByText("Substance intoxication", { exact: true }).first()).toBeVisible();
    const languageControl = page.getByRole("button", { name: "Language and region settings (coming soon)" });
    await expect(languageControl).toBeVisible();
    await expect(languageControl).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByRole("button", { name: "Start a new comparison" })).toBeVisible();
    await expect(page.getByTestId("global-search-input")).toHaveCount(0);
    await expect(page.getByText("Service details")).toHaveCount(0);
    await expect(page.getByText("Transport order")).toHaveCount(0);
    await expectNoPageHorizontalOverflow(page);
  });

  test("tools mode opens tool details before navigation on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 820 });
    await gotoLauncher(page, "/?mode=tools");

    const toolsHub = page.getByTestId("tools-hub");
    await expect(toolsHub.getByText("Selected tool")).toHaveCount(0);
    const detailsButton = toolsHub.getByRole("button", { name: "View details for Medication Prescribing" });
    await expect(detailsButton).toHaveAttribute("aria-haspopup", "dialog");
    await detailsButton.click();
    await expect(page.getByRole("dialog", { name: "Medication Prescribing" })).toBeVisible();
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
      await mockAnswerDashboardApi(page);
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

  test("long mobile service details clear the bottom search dock at the scroll endpoint", async ({ page }) => {
    await mockAnswerDashboardApi(page);
    await page.setViewportSize({ width: 390, height: 820 });
    await gotoLauncher(page, "/services/city-east-community-mental-health-service");

    const servicePage = page.getByTestId("service-detail-page");
    const footer = servicePage.getByText("Information accuracy may vary. Confirm locally before use.");
    const scrollport = page.locator("#main-content");
    const dock = page.locator("form.answer-footer-search-dock, form.answer-footer-search-edge").first();
    const dockInput = visibleGlobalSearchInput(page).first();
    await expect(servicePage).toBeVisible();
    await expect(dock).toBeVisible();
    // Keep the dock focused so hide-on-scroll cannot collapse --mobile-composer-reserve
    // while we measure end-of-page clearance under a still-visible composer.
    await dockInput.focus();
    await expect(dock).not.toHaveAttribute("data-scroll-hidden", "true");
    // The compact dock reserve is 5.5rem (88px) plus any safe-area inset.
    await expect.poll(async () => readMobileComposerReservePx(scrollport)).toBeGreaterThanOrEqual(80);
    await scrollport.evaluate((element) => element.scrollTo({ top: element.scrollHeight, behavior: "instant" }));
    await expect(dock).not.toHaveAttribute("data-scroll-hidden", "true");

    await expect
      .poll(() => scrollport.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop))
      .toBeLessThanOrEqual(1);

    const clearance = await footer.evaluate((element) => {
      const scrollElement = document.querySelector<HTMLElement>("#main-content");
      const dockElement = document.querySelector<HTMLElement>(
        "form.answer-footer-search-dock, form.answer-footer-search-edge",
      );
      const servicePage = document.querySelector<HTMLElement>('[data-testid="service-detail-page"]');
      if (!scrollElement || !dockElement) return null;
      const scrollStyle = window.getComputedStyle(scrollElement);
      const pad = scrollElement.querySelector<HTMLElement>('[data-testid="mobile-composer-reserve-pad"]');
      return {
        footerBottom: element.getBoundingClientRect().bottom,
        scrollBottom: scrollElement.getBoundingClientRect().bottom,
        dockTop: dockElement.getBoundingClientRect().top,
        dockHeight: dockElement.getBoundingClientRect().height,
        reservePx: pad
          ? Number.parseFloat(window.getComputedStyle(pad).paddingBottom)
          : Number.parseFloat(scrollStyle.paddingBottom),
        reserve: scrollStyle.getPropertyValue("--mobile-composer-reserve").trim(),
        scrollTop: scrollElement.scrollTop,
        scrollHeight: scrollElement.scrollHeight,
        clientHeight: scrollElement.clientHeight,
        serviceBottom: servicePage?.getBoundingClientRect().bottom ?? null,
        serviceHeight: servicePage?.getBoundingClientRect().height ?? null,
        scrollHidden: dockElement.getAttribute("data-scroll-hidden"),
      };
    });

    expect(clearance, JSON.stringify(clearance)).not.toBeNull();
    expect(clearance!.reservePx, JSON.stringify(clearance)).toBeGreaterThanOrEqual(80);
    expect(clearance!.footerBottom, JSON.stringify(clearance)).toBeLessThanOrEqual(clearance!.dockTop - 8);
  });

  test("service navigator action uses the shared global search route", async ({ page }) => {
    await mockAnswerDashboardApi(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoLauncher(page, "/services/13yarn");

    await page.getByTestId("service-detail-page").getByRole("button", { name: "Use in navigator" }).click();
    await expect(page).toHaveURL(/\/services\?/);
    await expect(page).toHaveURL(/run=1/);
    await expect(page).toHaveURL(/focus=1/);
  });

  test("service detail actions save, copy, and back from direct entry", async ({ page }) => {
    await mockAnswerDashboardApi(page);
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
    test(`${route.name} never overflows horizontally across sizes @mockup`, async ({ page }) => {
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

  test("prescribing mode home centres above the phone composer and balances on tablet", async ({ page }) => {
    async function verticalWeighting(width: number) {
      // Tall viewport exaggerates the free space so the anchor is unambiguous.
      await page.setViewportSize({ width, height: 900 });
      await gotoLauncher(page, "/?mode=prescribing");
      const home = page.getByTestId("medication-home");
      await expect(home).toBeVisible();
      await settleLayout(page);
      const measure = () =>
        page.evaluate(() => {
          const rect = document.querySelector('[data-testid="medication-home"]')?.getBoundingClientRect();
          if (!rect) return null;
          return { topGap: rect.top, bottomGap: window.innerHeight - rect.bottom };
        });
      // The smart-search hint/prompt rows render at first paint and are hidden
      // by a post-hydration check on phone, shrinking the measured home ~50px
      // shortly after load. Poll until two consecutive measurements match so
      // the guard asserts the settled layout, not the transient one.
      let result = await measure();
      await expect(async () => {
        const next = await measure();
        const stable =
          result !== null && next !== null && result.topGap === next.topGap && result.bottomGap === next.bottomGap;
        result = next;
        expect(stable).toBe(true);
      }).toPass({ timeout: 10_000 });
      return result;
    }

    // Phone (< sm): the home block centres within the space above the bottom
    // composer reserve, so it sits mid-screen leaning toward the top edge.
    const phone = await verticalWeighting(375);
    expect(phone).not.toBeNull();
    expect(phone?.topGap ?? 0).toBeLessThan(phone?.bottomGap ?? 0);

    // Tablet hero-composer homes include the portaled search shell in the measured
    // block, so viewport gap balance is looser than phone bottom-anchoring.
    const tablet = await verticalWeighting(768);
    expect(tablet).not.toBeNull();
    const balance = Math.abs((tablet?.topGap ?? 0) - (tablet?.bottomGap ?? 0));
    expect(balance).toBeLessThan(Math.max(tablet?.topGap ?? 0, tablet?.bottomGap ?? 0) * 1.45);
  });

  test("prescribing mobile shortcuts and checks are distinct, actionable, and scrollable", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 760 });
    await mockAnswerDashboardApi(page);
    await gotoLauncher(page, "/?mode=prescribing");

    const home = page.getByTestId("medication-home");
    await expect(home).toBeVisible();
    await expect(home).toContainText("Check renal dosing and contraindications.");
    await expect(home).toContainText("Review opioid-use precautions before prescribing.");
    await expect(home).toContainText("Check maximum dose and titration guidance.");

    const checksRegion = home.getByRole("region", { name: "Medication checks" });
    const checkButtons = checksRegion.getByRole("button");
    await expect(checkButtons).toHaveCount(4);
    for (const button of await checkButtons.all()) await expectMinTouchTarget(button);

    const rowMetrics = await checksRegion.locator(".answer-suggestion-row-scroll").evaluate((row) => {
      const style = getComputedStyle(row);
      return {
        overflows: row.scrollWidth > row.clientWidth + 1,
        maskImage: style.maskImage || style.webkitMaskImage,
      };
    });
    expect(rowMetrics.overflows).toBe(true);
    expect(rowMetrics.maskImage).not.toBe("none");
    await expectNoPageHorizontalOverflow(page);

    const capabilitySearches = [
      ["Dose", "medication dose adjustment"],
      ["Safety", "medication contraindications and cautions"],
      ["Monitoring", "medication baseline and follow-up monitoring"],
      ["Access", "medication PBS access and brand availability"],
    ] as const;

    for (const [label, query] of capabilitySearches) {
      await gotoLauncher(page, "/?mode=prescribing");
      await page.getByTestId("medication-home").getByRole("button", { name: label, exact: true }).click();
      await expect(visibleGlobalSearchInput(page).first()).toHaveValue(query);
      await expect(page.getByTestId("medication-home")).toHaveCount(0);
    }

    await gotoLauncher(page, "/?mode=prescribing&q=acamprosate%20renal%20dose&run=1");
    const resultCard = page.getByTestId("medication-result-acamprosate-phone");
    const bottomDock = page.locator("form.answer-footer-search-dock");
    await expect(resultCard).toBeVisible();
    await expect(bottomDock).toBeVisible();
    await page.locator("main#main-content").evaluate((main) => main.scrollTo({ top: main.scrollHeight }));
    const resultBox = await resultCard.boundingBox();
    const dockBox = await bottomDock.boundingBox();
    expect(resultBox).not.toBeNull();
    expect(dockBox).not.toBeNull();
    expect(resultBox!.y + resultBox!.height).toBeLessThanOrEqual(dockBox!.y + 2);
  });

  test("differentials recent work remains touch-sized inside its mobile scroll row", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 760 });
    await mockAnswerDashboardApi(page);
    await gotoLauncher(page, "/?mode=differentials");

    const recentWork = page.getByTestId("differentials-home-template").getByRole("region", { name: "Recent work" });
    await expect(recentWork).toBeVisible();
    const recentButtons = recentWork.locator(".answer-suggestion-row-scroll").getByRole("button");
    expect(await recentButtons.count()).toBeGreaterThan(1);
    for (const button of await recentButtons.all()) await expectMinTouchTarget(button);

    const rowMetrics = await recentWork.locator(".answer-suggestion-row-scroll").evaluate((row) => {
      const style = getComputedStyle(row);
      return {
        overflows: row.scrollWidth > row.clientWidth + 1,
        maskImage: style.maskImage || style.webkitMaskImage,
      };
    });
    expect(rowMetrics.overflows).toBe(true);
    expect(rowMetrics.maskImage).not.toBe("none");
    await expectNoPageHorizontalOverflow(page);
  });
});
