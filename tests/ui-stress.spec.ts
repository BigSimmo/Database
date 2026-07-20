import type { Route } from "playwright-core";
import { expect, test, type Page } from "playwright/test";
import { stubZeroTouchPoints } from "./helpers/zero-touch";
import { loadMedicationSnapshot } from "../src/lib/medication-snapshot";

const longTitle =
  "Extremely long synthetic shared-care guideline title covering lithium clozapine perinatal risk ADHD medication review emergency escalation and outpatient monitoring pathways";

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
        appName: "Clinical KB",
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
    await dailyActions.getByRole("menuitem", { name: /^Scope\b/ }).click();
    await expect(page.getByTestId("scope-command-popover")).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 20_000 });
}

test.beforeEach(stubZeroTouchPoints);

test.describe("Clinical KB long-content stress coverage", () => {
  for (const viewport of [
    { name: "mobile", width: 320, height: 740 },
    // Scope opens in a sheet below lg; 1000px keeps the stress path stable on desktop.
    { name: "desktop", width: 1000, height: 900 },
  ]) {
    test(`many documents and citations do not overflow at ${viewport.name}`, async ({ page }) => {
      await mockStressData(page);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/?mode=documents", { waitUntil: "domcontentloaded" });
      await expect(page.locator("#main-content").first()).toBeVisible({ timeout: 15_000 });

      if (viewport.name === "mobile") {
        const dailyActions = await openDailyActions(page);
        // Wait for the sliding bottom sheet to settle before clicking (no force) so
        // the tap lands on Upload rather than an adjacent row mid-animation.
        await dailyActions.getByRole("menuitem", { name: /Upload(?: PDF)?/ }).click();
        await expect(dailyActions).toBeHidden();
        await expect(
          page.getByRole("alert").filter({ hasText: "Upload and indexing tools are admin-only." }),
        ).toContainText("Use the source library to open indexed documents.");
        await expect(page.getByRole("dialog", { name: "Upload and indexing" })).toHaveCount(0);
      }
      await expectNoPageHorizontalOverflow(page);

      // Mode-menu behavior is covered by the launcher suites. This stress test
      // owns only dense answer rendering, so enter that route directly rather
      // than making its result depend on an unrelated menu transition.
      await page.goto("/?mode=answer", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("button", { name: "Mode Answer" })).toBeVisible();

      await page
        .locator('[aria-label^="Search indexed guidelines by question or keyword"]:visible')
        .first()
        .fill("Show all stress citations and source cards");
      await page.locator('[aria-label="Generate source-backed answer"]:visible').first().click();

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
      const evidenceDrawer = page.locator("#answer-evidence-drawer-mobile-trigger");
      await expect(evidenceDrawer).toBeVisible();
      await evidenceDrawer.click();
      const evidenceSheet = page.getByRole("dialog", { name: "Evidence" });
      await expect(evidenceSheet).toBeVisible();
      await expect(evidenceSheet.getByTestId("mobile-evidence-tabs")).toBeVisible();
      await expect(evidenceSheet.getByTestId("mobile-evidence-tab-claims")).toHaveAttribute("aria-selected", "true");
      await expect(evidenceSheet.getByTestId("mobile-evidence-panel-claims")).toBeVisible();
      await expect(page.locator('[data-testid="evidence-support-panel"]:visible')).toHaveCount(0);
      await expectNoPageHorizontalOverflow(page);
    });
  }
});

test.describe("Medication responsive stress coverage", () => {
  test("full-bleed phone rows and tablet cards remain safe across breakpoint boundaries", async ({ page }) => {
    test.setTimeout(90_000);
    await mockMedicationStressData(page);
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/?mode=prescribing&q=acamprosate%20renal%20dose&run=1", { waitUntil: "domcontentloaded" });

    const phoneResult = page.getByTestId("medication-result-acamprosate-phone");
    const desktopResult = page.getByTestId("medication-result-acamprosate-desktop");
    await expect(phoneResult).toBeVisible({ timeout: 30_000 });
    await expect(phoneResult).toHaveAttribute("data-selected", "true");

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

        const metrics = await page.evaluate(() => {
          const workspace = document.querySelector<HTMLElement>(".medication-results-workspace");
          const patient = document.querySelector<HTMLElement>(".medication-patient-strip");
          const filters = document.querySelector<HTMLElement>(".medication-filter-strip");
          const card = document.querySelector<HTMLElement>('[data-testid="medication-result-acamprosate-phone"]');
          const firstFilter = filters?.querySelector<HTMLElement>("button");
          if (!workspace || !patient || !filters || !card || !firstFilter) return null;
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
            cardLeft: cardRect.left,
            cardRight: cardRect.right,
            cardPaddingLeft: Number.parseFloat(cardStyle.paddingLeft),
            cardPaddingRight: Number.parseFloat(cardStyle.paddingRight),
            filterLeft: filterRect.left,
            filterHeight: filterRect.height,
          };
        });
        expect(metrics).not.toBeNull();
        expect(metrics?.filterHeight ?? 0).toBeGreaterThanOrEqual(42);

        if (viewport.width <= 639) {
          expect(Math.abs(metrics?.workspaceLeft ?? Number.POSITIVE_INFINITY)).toBeLessThanOrEqual(1);
          expect(Math.abs((metrics?.workspaceRight ?? 0) - viewport.width)).toBeLessThanOrEqual(1);
          expect(Math.abs(metrics?.patientLeft ?? Number.POSITIVE_INFINITY)).toBeLessThanOrEqual(1);
          expect(Math.abs((metrics?.patientRight ?? 0) - viewport.width)).toBeLessThanOrEqual(1);
          expect(Math.abs(metrics?.cardLeft ?? Number.POSITIVE_INFINITY)).toBeLessThanOrEqual(1);
          expect(Math.abs((metrics?.cardRight ?? 0) - viewport.width)).toBeLessThanOrEqual(1);
          expect(metrics?.cardPaddingLeft ?? 0).toBeGreaterThanOrEqual(15);
          expect(metrics?.cardPaddingRight ?? 0).toBeGreaterThanOrEqual(15);
          expect(metrics?.filterLeft ?? 0).toBeGreaterThanOrEqual(15);
        } else {
          expect(metrics?.cardLeft ?? 0).toBeGreaterThanOrEqual(12);
          expect((metrics?.cardRight ?? viewport.width) + 12).toBeLessThanOrEqual(viewport.width);
        }
      } else {
        await expect(desktopResult).toBeVisible();
        await expect(phoneResult).toBeHidden();
      }
    }

    await page.setViewportSize({ width: 320, height: 720 });
    const scrollGeometry = await page.locator("main#main-content").evaluate((main) => ({
      clientHeight: main.clientHeight,
      scrollHeight: main.scrollHeight,
      pageHeight: document.documentElement.scrollHeight,
      viewportHeight: document.documentElement.clientHeight,
    }));
    expect(scrollGeometry.scrollHeight).toBeGreaterThan(scrollGeometry.clientHeight);
    expect(scrollGeometry.pageHeight - scrollGeometry.viewportHeight).toBeLessThanOrEqual(2);
  });
});
