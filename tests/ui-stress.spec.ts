import type { Route } from "playwright-core";
import { expect, test, type Locator, type Page } from "playwright/test";
import { stubZeroTouchPoints } from "./helpers/zero-touch";
import { loadMedicationSnapshot } from "../src/lib/medication-snapshot";
import { PATIENT_PROFILE_STORAGE_KEY } from "../src/lib/patient-profile-storage";
import { readPrimaryScrollGeometry } from "./playwright-scroll";

const longTitle =
  "Extremely long synthetic shared-care guideline title covering lithium clozapine perinatal risk ADHD medication review emergency escalation and outpatient monitoring pathways";

async function waitForReactEventHandler(locator: Locator, eventName: "onChange" | "onSubmit") {
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

function makeDocument(index: number) {
  return {
    id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    title: `${longTitle} ${index}`,
    description: null,
    file_name: `very-long-uploaded-guideline-file-name-for-responsive-layout-stress-case-${index}.pdf`,
    file_type: "application/pdf",
    file_size: 100_000 + index,
    storage_path: `/stress/document-${index}.pdf`,
    status: "indexed",
    page_count: 24 + index,
    chunk_count: 12 + index,
    image_count: index % 3,
    error_message: null,
    created_at: "2026-05-19T00:00:00.000Z",
    updated_at: "2026-05-19T00:00:00.000Z",
  };
}

function makeSource(index: number) {
  const document = makeDocument((index % 18) + 1);
  return {
    id: `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    document_id: document.id,
    title: document.title,
    file_name: document.file_name,
    page_number: (index % 9) + 1,
    chunk_index: index,
    section_heading: `Long section heading ${index}`,
    content:
      "This deliberately long stress-test passage checks wrapping, source-card density, citation chips, action rows, and document titles without relying on production data changes.",
    image_ids: [],
    similarity: 0.91 - index / 100,
    source_strength: "strong",
    images: [],
  };
}

function citationFromSource(source: ReturnType<typeof makeSource>) {
  return {
    chunk_id: source.id,
    document_id: source.document_id,
    title: source.title,
    file_name: source.file_name,
    page_number: source.page_number,
    chunk_index: source.chunk_index,
    similarity: source.similarity,
  };
}

function makeStressAnswer() {
  const sources = Array.from({ length: 20 }, (_, index) => makeSource(index + 1));
  const citations = sources.slice(0, 14).map(citationFromSource);
  const quoteCards = sources.slice(0, 10).map((source) => ({
    ...citationFromSource(source),
    quote:
      "This exact quote is intentionally long enough to test wrapping in quote cards and action rows without causing layout overflow.",
    section_heading: source.section_heading,
    source_strength: "strong",
  }));

  return {
    answer:
      "Stress answer with many citations and long source names. The UI should wrap dense evidence cleanly, keep action rows reachable, and avoid page-level horizontal scrolling.",
    grounded: true,
    confidence: "high",
    citations,
    sources,
    quoteCards,
    answerSections: Array.from({ length: 6 }, (_, index) => ({
      heading: `Stress detail section ${index + 1}`,
      body: "Long detail copy validates that answer detail cards wrap without compressing adjacent content or creating horizontal overflow.",
      citation_chunk_ids: sources.slice(index, index + 3).map((source) => source.id),
    })),
    evidenceSummary: {
      document_count: 18,
      total_sources: sources.length,
      quote_count: quoteCards.length,
      image_count: 0,
      source_strength: "strong",
      summary: "Stress response spanning many documents and citations.",
    },
    sourceCoverage: {
      documents_used: 18,
      pages: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      strongest_similarity: 0.91,
      has_images: false,
    },
    conflictsOrGaps: [],
    visualEvidence: [],
    bestSource: {
      ...citationFromSource(sources[0]),
      source_strength: "strong",
      score: 0.91,
      snippet: "Stress best source snippet.",
      quote: "Stress best source exact quote.",
      section_heading: sources[0].section_heading,
      image_count: 0,
      viewer_href: `/documents/${sources[0].document_id}?page=1&chunk=${sources[0].id}`,
    },
    documentBreakdown: Array.from({ length: 18 }, (_, index) => {
      const document = makeDocument(index + 1);
      return {
        document_id: document.id,
        title: document.title,
        file_name: document.file_name,
        top_similarity: 0.9 - index / 100,
        source_strength: "strong",
        source_count: 2,
        quote_count: 1,
        pages: [1, 2, 3],
      };
    }),
  };
}

function answerStreamBody(payload: unknown) {
  return [
    `event: progress\ndata: ${JSON.stringify({ stage: "retrieving", message: "Searching indexed documents." })}`,
    `event: final\ndata: ${JSON.stringify(payload)}`,
    "",
  ].join("\n\n");
}

async function fulfillAnswerResponse(route: Route, payload: unknown) {
  const pathname = new URL(route.request().url()).pathname;
  if (pathname.endsWith("/stream")) {
    await route.fulfill({
      body: answerStreamBody(payload),
      contentType: "text/event-stream; charset=utf-8",
      headers: { "Cache-Control": "no-cache, no-transform" },
    });
    return;
  }

  await route.fulfill({ json: payload });
}

async function mockStressData(page: Page) {
  const documents = Array.from({ length: 24 }, (_, index) => makeDocument(index + 1));

  await page.route(/\/api\/local-project-id$/, async (route) => {
    await route.fulfill({
      json: {
        appName: "PsychSift",
        projectId: "test-clinical-kb",
        identityPath: "/api/local-project-id",
        localServer: {
          currentUrl: "http://localhost:4298",
          currentPort: 4298,
          projectPortStart: 4000,
          projectPortEnd: 5999,
          safeLocalOrigin: true,
          requestOrigin: null,
          requestReferer: null,
          unsafeLocalCaller: null,
        },
      },
    });
  });
  await page.route(/\/api\/documents(?:\?.*)?$/, async (route) => {
    await route.fulfill({ json: { documents, demoMode: true } });
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
  await page.route("**/api/setup-status**", async (route) => {
    await route.fulfill({
      json: {
        demoMode: true,
        checks: [
          { id: "env", label: ".env.local configured", status: "ready", detail: "Mocked env ready." },
          {
            id: "project",
            label: "Clinical KB Database target",
            status: "ready",
            detail: "Mocked Supabase project ready.",
          },
          { id: "schema", label: "supabase/schema.sql applied", status: "ready", detail: "Mocked schema ready." },
          { id: "search", label: "Search RPC and vector indexes", status: "ready", detail: "Mocked search ready." },
          { id: "openai", label: "OpenAI API key available", status: "ready", detail: "Mocked key ready." },
          { id: "worker", label: "npm run worker running", status: "ready", detail: "Mocked worker ready." },
        ],
      },
    });
  });
  await page.route(/\/api\/answer(?:\/stream)?(?:\?.*)?$/, async (route) => {
    await fulfillAnswerResponse(route, makeStressAnswer());
  });
}

async function mockMedicationStressData(page: Page) {
  await mockStressData(page);

  const records = loadMedicationSnapshot();
  const orderedRecords = [
    ...records.filter((record) => record.slug === "acamprosate"),
    ...records.filter((record) => record.slug !== "acamprosate"),
  ].slice(0, 12);

  await page.route(/\/api\/medications(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      json: {
        records,
        matches: orderedRecords.map((medication, index) => ({
          medication,
          result: {
            id: medication.slug,
            name: medication.name,
            indication: `${medication.subclass || medication.category} with deliberately extended indication text for narrow-screen wrapping`,
            match: index === 0 ? "Exact clinical fit" : "Related match",
            dose: "Initial and maintenance dosing with a deliberately extended regimen that must wrap without widening the viewport",
            ceiling: "Maximum recommended dose with renal and hepatic adjustment",
            action:
              "Review contraindications, renal function, hepatic function, interactions, pregnancy status, monitoring requirements, and follow-up before prescribing.",
            actionTone: index % 2 === 0 ? "danger" : "warning",
            tone: index === 0 ? "teal" : "slate",
            href: `/medications/${medication.slug}`,
          },
          score: 100 - index,
          reasons: ["Responsive stress fixture"],
        })),
        total: records.length,
        governance: {},
        demoMode: true,
      },
    });
  });
  await page.route(/\/api\/search\/universal(?:\?.*)?$/, async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q")?.trim() ?? "";
    await route.fulfill({ json: { query, groups: [], tookMs: 0, domainOrder: [], demoMode: true } });
  });

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

async function expectNoPageHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const documentWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0);
    return documentWidth - document.documentElement.clientWidth;
  });

  expect(overflow).toBeLessThanOrEqual(2);
}

async function openDailyActions(page: Page) {
  const trigger = page.getByRole("button", { name: /^Open .+ options$/ });
  const menu = page.getByTestId("daily-actions-menu");

  await expect(trigger).toBeVisible();
  await expect(trigger).toBeEnabled();
  await expect(async () => {
    if (await menu.isVisible().catch(() => false)) return;
    await trigger.click();
    await expect(menu).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 20_000 });

  return menu;
}

async function openScopeControl(page: Page) {
  const composer = page.locator('[aria-label^="Search indexed guidelines by question or keyword"]:visible').first();
  const viewportWidth = page.viewportSize()?.width ?? 0;
  const preferMenuPath = viewportWidth >= 640;

  await expect(async () => {
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await page
      .getByRole("listbox", { name: /search suggestions/i })
      .waitFor({ state: "hidden", timeout: 5_000 })
      .catch(() => undefined);

    if (!preferMenuPath) {
      await composer.click();
      const scopeOption = page.getByRole("option", { name: /Scope sources/i });
      if (await scopeOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await scopeOption.click();
        if (
          await page
            .getByTestId("scope-command-popover")
            .isVisible({ timeout: 2_000 })
            .catch(() => false)
        ) {
          return;
        }
      }
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
    }

    const dailyActions = await openDailyActions(page);
    // No force-click: the mobile "+" menu is a bottom sheet that slides up, so wait
    // for the row to settle rather than clicking mid-animation (which lands on the
    // adjacent row).
    await dailyActions.getByRole("button", { name: /^Scope\b/ }).click();
    await expect(page.getByTestId("scope-command-popover")).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 20_000 });
}

test.beforeEach(stubZeroTouchPoints);

test.describe("PsychSift long-content stress coverage", () => {
  for (const viewport of [
    { name: "mobile", width: 320, height: 740 },
    // Scope opens in a sheet below lg; 1000px keeps the stress path stable on desktop.
    { name: "desktop", width: 1000, height: 900 },
  ]) {
    test(`many documents and citations do not overflow at ${viewport.name}`, async ({ page }) => {
      await mockStressData(page);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/documents", { waitUntil: "domcontentloaded" });
      await expect(page.locator("#main-content").first()).toBeVisible({ timeout: 15_000 });

      if (viewport.name === "mobile") {
        const dailyActions = await openDailyActions(page);
        await expect(dailyActions.getByRole("button", { name: /Add document|Upload PDF/ })).toHaveCount(0);
        await expect(page.locator('input[type="file"]')).toHaveCount(0);
        await page.keyboard.press("Escape");
        await expect(dailyActions).toBeHidden();
      }
      await expectNoPageHorizontalOverflow(page);

      // Mode-menu behavior is covered by the launcher suites. This stress test
      // owns only dense answer rendering, so enter that route directly rather
      // than making its result depend on an unrelated menu transition.
      await page.goto("/?mode=answer", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("button", { name: "Mode Answer" })).toBeVisible();

      // Production hydration can briefly replace the server-rendered composer.
      // Require one settled owner with live React handlers before typing, or the
      // replacement can lose the value and leave the submit button disabled.
      const sharedHomeSurface = page.getByTestId("shared-home-empty-state");
      await expect(sharedHomeSurface).toHaveCount(1, { timeout: 15_000 });
      const questionInput = sharedHomeSurface.locator(
        '[aria-label^="Search indexed guidelines by question or keyword"]',
      );
      await expect(questionInput).toHaveCount(1);
      const answerForm = questionInput.locator("xpath=ancestor::form[1]");
      await waitForReactEventHandler(questionInput, "onChange");
      await waitForReactEventHandler(answerForm, "onSubmit");
      await questionInput.fill("Show all stress citations and source cards");
      await expect(questionInput).toHaveValue("Show all stress citations and source cards");
      const submit = answerForm.getByRole("button", { name: "Generate source-backed answer" });
      await expect(submit).toBeEnabled({ timeout: 15_000 });
      await submit.click();

      await expect(page.getByLabel("Source-backed answer")).toBeVisible();
      await expect(page.getByTestId("plain-answer-response")).toBeVisible();

      await openScopeControl(page);
      const scopeContainer = page.getByTestId("scope-command-popover");
      await expect(
        scopeContainer.getByText(/Type to filter 24 (loaded )?documents\. Selected documents stay pinned here\./),
      ).toBeVisible();
      await expect(
        scopeContainer.getByText(
          /(?:\d+ documents available|\d+ available documents|\d+ loaded of \d+)\. Type a title or file name to narrow the (?:loaded )?list\./,
        ),
      ).toBeVisible();
      const scopeFilter = scopeContainer.locator('[data-testid="document-scope-filter"]');
      await expect(scopeFilter).toBeVisible();
      await expect(scopeFilter).toBeFocused();
      await scopeFilter.fill("case-24");
      await expect(scopeContainer.getByText("1 match")).toBeVisible();
      await expect(
        scopeContainer.getByRole("button", { name: /responsive-layout-stress-case-24\.pdf/i }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(scopeContainer).toBeHidden();
      await expectNoPageHorizontalOverflow(page);

      await expect(page.locator("#answer-more-detail-drawer")).toHaveCount(0);
      await expect(page.getByTestId("smart-follow-up-chips")).toHaveCount(0);
      await expect(page.getByText("Quality feedback")).toHaveCount(0);
      await expect(page.getByText("Source narrative")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Copy clinical draft" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Copy answer with citations" })).toHaveCount(0);
      await expect(page.getByTestId("evidence-rail")).toHaveCount(0);
      await expect(page.getByTestId("evidence-summary-card")).toHaveCount(0);
      // The evidence sheet gave way to the source rail and its per-source drawer;
      // under long titles and narrow viewports neither may overflow.
      await expect(page.locator("#answer-evidence-drawer-mobile-trigger")).toHaveCount(0);
      const sourceRail = page.getByTestId("answer-source-rail");
      await expect(sourceRail).toBeVisible();
      await sourceRail.getByTestId("answer-source-rail-row").first().click();
      const sourceDrawer = page.getByTestId("answer-source-drawer");
      await expect(sourceDrawer).toBeVisible();
      // Opened from a rail card, so no support sentence: the passage is the
      // panel's first content at every one of these widths.
      await expect(sourceDrawer.getByTestId("answer-source-drawer-support")).toHaveCount(0);
      await expect(sourceDrawer.getByTestId("answer-source-drawer-passage")).toBeVisible();
      await expectNoPageHorizontalOverflow(page);
      await page.keyboard.press("Escape");
      await expect(sourceDrawer).toHaveCount(0);
      await expect(page.locator('[data-testid="evidence-support-panel"]:visible')).toHaveCount(0);
      await expectNoPageHorizontalOverflow(page);
    });
  }
});

test.describe("Medication responsive stress coverage", () => {
  test("phone and tablet cards remain inset and safe across breakpoint boundaries", async ({ page }) => {
    test.setTimeout(90_000);
    await mockMedicationStressData(page);
    await page.addInitScript(
      ({ storageKey }) => {
        window.sessionStorage.setItem(
          storageKey,
          JSON.stringify({
            scr: 140,
            scrUnit: "umol/L",
            medications: [],
          }),
        );
      },
      { storageKey: PATIENT_PROFILE_STORAGE_KEY },
    );
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/?mode=prescribing&q=acamprosate%20renal%20dose&run=1", { waitUntil: "domcontentloaded" });

    const phoneResult = page.getByTestId("medication-result-acamprosate-phone");
    const desktopResult = page.getByTestId("medication-result-acamprosate-desktop");
    await expect(phoneResult).toBeVisible({ timeout: 30_000 });
    await expect(phoneResult).toHaveAttribute("data-selected", "true");
    await expect(phoneResult).toHaveAttribute("data-verdict", "danger");
    await expect(phoneResult.getByRole("group", { name: /^Danger\. For this patient\./ })).toBeVisible();
    await expect(page.getByTestId("universal-also-matches")).toHaveCount(0);

    const viewports = [
      { width: 320, height: 720 },
      { width: 390, height: 844 },
      { width: 639, height: 820 },
      { width: 640, height: 820 },
      { width: 768, height: 1024 },
      { width: 1024, height: 900 },
      { width: 1440, height: 920 },
      { width: 1920, height: 1080 },
    ] as const;

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.evaluate(
        () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
      );
      await expectNoPageHorizontalOverflow(page);

      if (viewport.width < 1024) {
        await expect(phoneResult).toBeVisible();
        await expect(desktopResult).toBeHidden();

        const metrics = await page.evaluate((viewportWidth) => {
          const workspace = document.querySelector<HTMLElement>(".medication-results-workspace");
          const patient = document.querySelector<HTMLElement>(".medication-patient-strip");
          const card = document.querySelector<HTMLElement>('[data-testid="medication-result-acamprosate-phone"]');
          const firstFilter = document.querySelector<HTMLElement>(
            viewportWidth < 640
              ? '[data-testid="medication-filter-trigger-phone"]'
              : '[data-testid="medication-filter-trigger-desktop"]',
          );
          if (!workspace || !patient || !card || !firstFilter) return null;
          const workspaceRect = workspace.getBoundingClientRect();
          const patientRect = patient.getBoundingClientRect();
          const cardRect = card.getBoundingClientRect();
          const filterRect = firstFilter.getBoundingClientRect();
          const cardStyle = getComputedStyle(card);
          return {
            workspaceLeft: workspaceRect.left,
            workspaceRight: workspaceRect.right,
            patientLeft: patientRect.left,
            patientRight: patientRect.right,
            patientVisible: patientRect.width > 0 && patientRect.height > 0,
            cardLeft: cardRect.left,
            cardRight: cardRect.right,
            cardPaddingLeft: Number.parseFloat(cardStyle.paddingLeft),
            cardPaddingRight: Number.parseFloat(cardStyle.paddingRight),
            filterLeft: filterRect.left,
            filterHeight: filterRect.height,
          };
        }, viewport.width);
        expect(metrics).not.toBeNull();
        expect(metrics?.filterHeight ?? 0).toBeGreaterThanOrEqual(viewport.width < 640 ? 48 : 40);

        if (viewport.width <= 639) {
          expect(metrics?.workspaceLeft ?? 0).toBeGreaterThanOrEqual(12);
          expect(metrics?.workspaceRight ?? viewport.width).toBeLessThanOrEqual(viewport.width - 12);
          // Phone replaces the in-flow patient strip with the dock pill.
          await expect(page.getByTestId("patient-details-dock-action")).toBeVisible();
          expect(Math.abs((metrics?.cardLeft ?? 0) - (metrics?.workspaceLeft ?? 0))).toBeLessThanOrEqual(1);
          expect(Math.abs((metrics?.cardRight ?? 0) - (metrics?.workspaceRight ?? viewport.width))).toBeLessThanOrEqual(
            1,
          );
          expect(metrics?.cardPaddingLeft ?? 0).toBeGreaterThanOrEqual(15);
          expect(metrics?.cardPaddingRight ?? 0).toBeGreaterThanOrEqual(15);
          expect(metrics?.filterLeft ?? 0).toBeGreaterThanOrEqual(15);
        } else {
          expect(metrics?.patientVisible).toBe(true);
          expect(Math.abs((metrics?.patientLeft ?? 0) - (metrics?.workspaceLeft ?? 0))).toBeLessThanOrEqual(1);
          expect(
            Math.abs((metrics?.patientRight ?? 0) - (metrics?.workspaceRight ?? viewport.width)),
          ).toBeLessThanOrEqual(1);
          expect(metrics?.cardLeft ?? 0).toBeGreaterThanOrEqual(12);
          expect((metrics?.cardRight ?? viewport.width) + 12).toBeLessThanOrEqual(viewport.width);
        }
      } else {
        await expect(desktopResult).toBeVisible();
        await expect(phoneResult).toBeHidden();

        const columnMetrics = await page
          .locator('[data-testid^="medication-result-"][data-testid$="-desktop"]:visible')
          .evaluateAll((rows) =>
            rows.map((row) => {
              const ceiling = row.querySelector<HTMLElement>('[data-medication-cell="ceiling"]');
              const action = row.querySelector<HTMLElement>('[data-medication-cell="action"]');
              const table = row.parentElement?.parentElement;
              if (!ceiling || !action || !table) return null;
              const ceilingRect = ceiling.getBoundingClientRect();
              const actionRect = action.getBoundingClientRect();
              const rowRect = row.getBoundingClientRect();
              const tableRect = table.getBoundingClientRect();
              return {
                columnGap: actionRect.left - ceilingRect.right,
                ceilingOverflow: ceiling.scrollWidth - ceiling.clientWidth,
                rightEdgeOverflow: rowRect.right - tableRect.right,
              };
            }),
          );
        expect(columnMetrics.every(Boolean)).toBe(true);
        for (const metrics of columnMetrics) {
          expect(metrics?.columnGap ?? 0).toBeGreaterThanOrEqual(12);
          expect(metrics?.ceilingOverflow ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(1);
          expect(metrics?.rightEdgeOverflow ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(1);
        }
      }
    }

    await page.setViewportSize({ width: 320, height: 720 });
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    );
    await expect.poll(async () => (await readPrimaryScrollGeometry(page)).owner).toBe("document");
    const scrollGeometry = await readPrimaryScrollGeometry(page);
    const chromeGeometry = await page.locator("main#main-content").evaluate((main) => ({
      keyboardHeight: document.documentElement.style.getPropertyValue("--keyboard-height").trim(),
      overflowY: window.getComputedStyle(main).overflowY,
    }));
    expect(scrollGeometry.scrollHeight).toBeGreaterThan(scrollGeometry.clientHeight + 40);
    expect(chromeGeometry.overflowY).toBe("visible");
    expect(chromeGeometry.keyboardHeight === "" || chromeGeometry.keyboardHeight === "0px").toBe(true);

    await phoneResult.focus();
    await expect(phoneResult).toBeFocused();
    await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
    await expect(phoneResult.getByRole("group", { name: /^Danger\. For this patient\./ })).toBeVisible();
    await expectNoPageHorizontalOverflow(page);
  });
});
