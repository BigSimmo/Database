import { expect, test, type Page } from "playwright/test";

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

async function openAppModeMenu(page: Page, currentMode: string) {
  const trigger = page.getByRole("button", { name: `Current app mode: ${currentMode}` });
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
      await expect(page.getByRole("region", { name: "Pinned applications" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "All applications" })).toBeVisible();
      if (viewport.name === "mobile") {
        await expect(page.getByTestId("selected-application-panel")).toBeHidden();
        await page.getByTestId("mobile-application-row-medication-prescribing").click();
        const selectedSheet = page.getByRole("dialog", { name: "Selected application" });
        await expect(selectedSheet).toBeVisible();
        await expect(page.getByTestId("selected-application-sheet-panel")).toContainText("Medication Prescribing");
        const mobileLaunchLink = page
          .getByTestId("selected-application-sheet-panel")
          .getByLabel("Launch Medication Prescribing");
        await expect(mobileLaunchLink).toBeVisible();
        await expect(mobileLaunchLink).toHaveAttribute("href", "/?mode=prescribing");
        await expect(mobileLaunchLink).not.toHaveAttribute("target", "_blank");
        await page.getByLabel("Close selected application").click();
        await expect(selectedSheet).toBeHidden();
      } else {
        await expect(page.getByTestId("selected-application-panel")).toContainText("Clinical KB Search");
        const desktopLaunchLink = page
          .getByTestId("selected-application-panel")
          .getByLabel("Launch Clinical KB Search");
        await expect(desktopLaunchLink).toBeVisible();
        await expect(desktopLaunchLink).toHaveAttribute("href", "/?mode=answer");
      }
      await expect(page.getByLabel("Current app mode: Tools")).toBeVisible();
      await expect(page.getByPlaceholder("Search applications...")).toBeVisible();
      await expect(page.getByLabel("Open selected application")).toBeVisible();
      await expectNoPageHorizontalOverflow(page);
    });
  }

  test("launcher links point to the expected in-app modes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoLauncher(page);

    const medicationLink = page.locator('a[aria-label="Launch Medication Prescribing"]').first();
    await expect(medicationLink).toHaveAttribute("href", "/?mode=prescribing");
    await expect(medicationLink).not.toHaveAttribute("target", "_blank");
    await expect(page.locator('a[aria-label="Launch Documents"]').first()).toHaveAttribute("href", "/?mode=documents");
    await expect(page.locator('a[aria-label="Launch Services"]').first()).toHaveAttribute("href", "/services");
    await expect(page.locator('a[aria-label="Launch Forms"]').first()).toHaveAttribute("href", "/forms");
    await expect(page.locator('a[aria-label="Launch Favourites"]').first()).toHaveAttribute("href", "/favourites");
    await expect(page.locator('a[aria-label="Launch Clinical KB Search"]').first()).toHaveAttribute(
      "href",
      "/?mode=answer",
    );
    // External companion-app launchers were removed; no localhost links should remain.
    await expect(page.locator('a[href^="http://localhost"], a[href^="http://127.0.0.1"]')).toHaveCount(0);
  });

  test("search and filters reduce visible application rows without overflow", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoLauncher(page);

    await page.getByLabel("Search applications").fill("medication");

    await expect(page.getByTestId("application-row-medication-prescribing")).toBeVisible();
    await expect(page.getByTestId("application-row-documents")).toBeHidden();
    await expect(page.getByText("Showing 1 to 1 of 7 applications")).toBeVisible();
    await expectNoPageHorizontalOverflow(page);
  });

  test("tools mode embeds the launcher content inside the dashboard", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoLauncher(page, "/?mode=tools&q=medication&focus=1");

    await expect(page.getByRole("button", { name: "Current app mode: Tools" })).toBeVisible();
    await expect(page.locator('input[placeholder="Search tools..."]:visible').first()).toHaveValue("medication");

    const toolsHub = page.getByTestId("tools-hub");
    await expect(toolsHub).toBeVisible();
    await expect(toolsHub.getByRole("heading", { name: "Tools", exact: true })).toBeVisible();
    await expect(toolsHub.getByRole("region", { name: "Pinned tools" })).toBeVisible();
    await expect(toolsHub.getByRole("heading", { name: "All tools" })).toBeVisible();
    await expect(toolsHub.getByTestId("application-row-medication-prescribing")).toBeVisible();
    await expect(toolsHub.getByTestId("application-row-documents")).toBeHidden();
    await expect(toolsHub.getByText("Showing 1 to 1 of 7 tools")).toBeVisible();
    await expect(toolsHub.getByTestId("selected-application-panel")).toContainText("Selected tool");
    await expect(toolsHub.getByTestId("tool-mode-result-medications")).toHaveCount(0);

    const launchLink = toolsHub
      .getByTestId("application-row-medication-prescribing")
      .getByLabel("Launch Medication Prescribing");
    await expect(launchLink).toHaveAttribute("href", "/?mode=prescribing");
    await expectNoPageHorizontalOverflow(page);
  });

  test("mode toggle stays global on the services home route", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoLauncher(page, "/?mode=answer");

    const initialMenu = await openAppModeMenu(page, "Answer");
    await expect(initialMenu).toBeVisible();
    await initialMenu.getByRole("menuitemradio", { name: /^Services\b/ }).click();

    await expect(page).toHaveURL(/\/services$/);
    await expect(page.getByRole("button", { name: "Current app mode: Services" })).toBeVisible();
    await expect(page.getByTestId("services-home")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Find a service" })).toBeVisible();
    await expect(page.getByTestId("global-search-input")).toHaveCount(1);
    const servicesHomeSearch = page.getByTestId("services-home").getByTestId("global-search-input");
    await expect(servicesHomeSearch).toBeVisible();
    const servicesSearchBox = await servicesHomeSearch.boundingBox();
    const servicesHeadingBox = await page.getByRole("heading", { level: 1, name: "Find a service" }).boundingBox();
    expect(servicesSearchBox).not.toBeNull();
    expect(servicesHeadingBox).not.toBeNull();
    expect((servicesHeadingBox?.y ?? 0) + (servicesHeadingBox?.height ?? 0)).toBeLessThan(servicesSearchBox?.y ?? 0);
    expect((servicesSearchBox?.y ?? 0) + (servicesSearchBox?.height ?? 0) / 2).toBeLessThan(900 * 0.62);
    await expect(page.getByTestId("global-search-input")).toHaveValue("");
    const servicesMenu = await openAppModeMenu(page, "Services");
    await expect(servicesMenu.getByRole("menuitemradio", { name: /^Answer\b/ })).toBeVisible();
    await expect(servicesMenu.getByRole("menuitemradio", { name: /^Documents\b/ })).toBeVisible();
    await expect(servicesMenu.getByRole("menuitemradio", { name: /^Services\b/ })).toBeVisible();
    await expect(servicesMenu.getByRole("menuitemradio", { name: /^Forms\b/ })).toBeVisible();
    await expect(servicesMenu.getByRole("menuitemradio", { name: /^Differentials\b/ })).toBeVisible();
    await expect(servicesMenu.getByRole("menuitemradio", { name: /^Medication\b/ })).toBeVisible();
    await expect(servicesMenu.getByRole("menuitemradio", { name: /^Tools\b/ })).toBeVisible();
    await servicesMenu.getByRole("menuitemradio", { name: /^Forms\b/ }).click();
    await expect(page).toHaveURL(/\/forms$/);
    await expect(page.getByRole("button", { name: "Current app mode: Forms" })).toBeVisible();
    await expect(page.getByTestId("forms-home")).toBeVisible();
    await expect(page.getByTestId("form-search-results")).toHaveCount(0);
    await expect(page.getByTestId("global-search-input")).toHaveValue("");
    await expectNoPageHorizontalOverflow(page);
  });

  test("header mode switches open clean services and forms home pages", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    await gotoLauncher(page, "/services?q=13YARN&focus=1&run=1");
    await expect(page.getByRole("button", { name: "Current app mode: Services" })).toBeVisible();
    await expect(page.getByTestId("service-search-results")).toBeVisible();

    let menu = await openAppModeMenu(page, "Services");
    await menu.getByRole("menuitemradio", { name: /^Forms\b/ }).click();

    await expect(page).toHaveURL(/\/forms$/);
    await expect(page.getByRole("button", { name: "Current app mode: Forms" })).toBeVisible();
    await expect(page.getByTestId("forms-home")).toBeVisible();
    await expect(page.getByTestId("form-search-results")).toHaveCount(0);
    await expect(page.getByTestId("global-search-input")).toHaveCount(1);
    await expect(page.getByTestId("global-search-input")).toHaveValue("");

    await gotoLauncher(page, "/forms");
    await expect(page.getByRole("button", { name: "Current app mode: Forms" })).toBeVisible();
    await expect(page.getByTestId("forms-home")).toBeVisible();

    menu = await openAppModeMenu(page, "Forms");
    await menu.getByRole("menuitemradio", { name: /^Services\b/ }).click();

    await expect(page).toHaveURL(/\/services$/);
    await expect(page.getByRole("button", { name: "Current app mode: Services" })).toBeVisible();
    await expect(page.getByTestId("services-home")).toBeVisible();
    await expect(page.getByTestId("service-search-results")).toHaveCount(0);
    await expect(page.getByTestId("global-search-input")).toHaveCount(1);
    await expect(page.getByTestId("global-search-input")).toHaveValue("");
    await expectNoPageHorizontalOverflow(page);
  });

  test("mode home routes keep the shared search at the bottom on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 820 });

    for (const home of [
      { path: "/services", testId: "services-home", heading: "Find a service" },
      { path: "/forms", testId: "forms-home", heading: "What do you need from forms?" },
      { path: "/differentials", testId: "differentials-home", heading: "Differentials" },
    ] as const) {
      await gotoLauncher(page, home.path);
      await expect(page.getByTestId(home.testId)).toBeVisible();
      await expect(page.getByTestId("global-search-input")).toHaveCount(1);

      const searchBox = await page.getByTestId("global-search-input").boundingBox();
      const headingBox = await page.getByRole("heading", { level: 1, name: home.heading }).boundingBox();
      expect(searchBox).not.toBeNull();
      expect(headingBox).not.toBeNull();
      expect((searchBox?.y ?? 0) + (searchBox?.height ?? 0) / 2).toBeGreaterThan(820 * 0.72);
      expect((headingBox?.y ?? 0) + (headingBox?.height ?? 0)).toBeLessThan(searchBox?.y ?? 0);
      await expectNoPageHorizontalOverflow(page);
    }
  });

  test("mode home deep links preserve focus=1 on initial load", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    for (const path of ["/services?focus=1", "/forms?focus=1"]) {
      await gotoLauncher(page, path);
      const sharedSearch = page.getByTestId("global-search-input");
      await expect(sharedSearch).toBeVisible();
      await expect(sharedSearch).toBeFocused();
    }
  });

  test("services mode shows source-backed records in search results", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoLauncher(page, "/services?q=13YARN&focus=1&run=1");

    await expect(page.getByRole("button", { name: "Current app mode: Services" })).toBeVisible();
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

    await expect(page.getByText("WA MHA FORMS")).toBeVisible();
    await expect(page.getByText("Forms / Search")).toBeVisible();
    await expect(page.getByLabel("Search forms, clocks, sources")).toHaveValue("");
    await expect(page.getByLabel("Current forms query")).toHaveValue("transport forms");
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

    // Structural coverage — runs on every browser, WebKit included: the form
    // detail page renders inside the shared shell with the Forms-mode composer
    // present and no stale results.
    await expect(page.getByRole("button", { name: "Current app mode: Forms" })).toBeVisible();
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

  test("forms search mockup is usable without horizontal overflow on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoLauncher(page, "/forms?q=transport&focus=1&run=1");

    await expect(page.getByTestId("form-search-mobile-results")).toBeVisible();
    await expect(page.getByTestId("form-search-mobile-result-transport-crisis-form")).toContainText("Transport order");
    await expect(page.getByPlaceholder("Ask or search forms...")).toHaveValue("");
    await expectNoPageHorizontalOverflow(page);
  });

  test("mode toggle keeps forms separate from services", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoLauncher(page, "/?mode=answer");

    const menu = await openAppModeMenu(page, "Answer");
    await expect(menu.getByRole("menuitemradio", { name: /^Services\b/ })).toBeVisible();
    await menu.getByRole("menuitemradio", { name: /^Forms\b/ }).click();

    await expect(page).toHaveURL(/\/forms$/);
    await expect(page.getByRole("button", { name: "Current app mode: Forms" })).toBeVisible();
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

    const modeButton = page.getByRole("button", { name: "Current app mode: Answer" });
    await expect(modeButton).toBeVisible();
    await modeButton.click();

    await page.getByRole("menuitemradio", { name: /Differentials/ }).click();

    await expect(page.getByRole("button", { name: "Current app mode: Differentials" })).toBeVisible();
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
    await expect(page.getByRole("button", { name: "Current app mode: Differentials" })).toBeVisible();
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
    await gotoLauncher(page, "/differentials/presentations");

    await expect(page.getByRole("button", { name: "Current app mode: Differentials" })).toBeVisible();
    await expect(page.getByTestId("differential-presentation-page")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Acute confusion / encephalopathy" })).toBeVisible();
    await expect(page.getByText("Selected differentials (6 of 8)")).toBeVisible();
    await expect(page.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/differentials");
    await expect(page.getByRole("heading", { name: "Safety snapshot" }).first()).toBeVisible();
    await expect(page.getByText("Service details")).toHaveCount(0);
    await expect(page.getByText("Transport order")).toHaveCount(0);
    await expect(page.getByText("Local only")).toBeVisible();
    await expect(page.getByText("Offline ready")).toBeVisible();
    await expect(page.getByText("Source pending review").first()).toBeVisible();
    await expect(page.locator("header").getByRole("button", { name: "Copy after review" })).toBeVisible();
    await expect(page.getByTestId("global-search-input")).toHaveCount(0);

    const tableScrolls = await page.getByTestId("differential-comparison-scroll").evaluate((element) => {
      return element.scrollWidth > element.clientWidth;
    });
    expect(tableScrolls).toBe(true);
    await expectNoPageHorizontalOverflow(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await gotoLauncher(page, "/differentials/presentations");

    await expect(page.getByRole("link", { name: "Back to differentials" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Compare", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { level: 1, name: "Acute confusion / encephalopathy" })).toBeVisible();
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

  test("tools mode opens the selected tool slide-up on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 820 });
    await gotoLauncher(page, "/?mode=tools");

    const toolsHub = page.getByTestId("tools-hub");
    await expect(toolsHub.getByTestId("selected-application-panel")).toBeHidden();
    await toolsHub.getByTestId("mobile-application-row-medication-prescribing").click();

    const selectedSheet = page.getByRole("dialog", { name: "Selected tool" });
    await expect(selectedSheet).toBeVisible();
    await expect(page.getByTestId("selected-application-sheet-panel")).toContainText("Medication Prescribing");
    const mobileLaunchLink = page
      .getByTestId("selected-application-sheet-panel")
      .getByLabel("Launch Medication Prescribing");
    await expect(mobileLaunchLink).toHaveAttribute("href", "/?mode=prescribing");
    await page.getByLabel("Close selected tool").click();
    await expect(selectedSheet).toBeHidden();
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
