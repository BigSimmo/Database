import type { Route } from "playwright-core";
import { expect, test, type Page } from "playwright/test";

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
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);

      if (viewport.name === "mobile") {
        const dailyActions = await openDailyActions(page);
        await dailyActions.getByRole("menuitem", { name: /Upload(?: PDF)?/ }).click({ force: true });
        await expect(dailyActions).toBeHidden();
        const uploadSurface = page.getByRole("dialog", { name: "Upload and indexing" });
        await expect(uploadSurface).toBeVisible();
        await expect(uploadSurface.getByRole("button", { name: "Show indexed document files" })).toContainText(
          "24 indexed",
          { timeout: 20_000 },
        );
        const closeUploadSheet = page.getByRole("button", { name: "Close Upload and indexing" });
        if (await closeUploadSheet.isVisible().catch(() => false)) {
          await closeUploadSheet.click();
        }
      }
      await expectNoPageHorizontalOverflow(page);

      const legacyAnswerModeToggle = page.getByRole("button", { name: "Switch to answer mode" });
      if (await legacyAnswerModeToggle.isVisible().catch(() => false)) {
        await legacyAnswerModeToggle.click();
      } else {
        const appModeMenu = page.getByRole("button", { name: /^Mode / });
        await expect(appModeMenu).toBeVisible();
        await appModeMenu.click({ force: true });
        const answerMode = page
          .getByRole("menu", { name: "Choose app mode" })
          .getByRole("menuitemradio", { name: /^Answer\b/ });
        await expect(answerMode).toBeVisible();
        await answerMode.click({ force: true });
        await expect(page.getByRole("button", { name: "Mode Answer" })).toBeVisible();
      }

      await page
        .locator('[aria-label^="Search indexed guidelines by question or keyword"]:visible')
        .first()
        .fill("Show all stress citations and source cards");
      await page.locator('[aria-label="Generate source-backed answer"]:visible').first().click();

      await expect(page.getByLabel("Source-backed answer")).toBeVisible();
      await expect(page.getByTestId("plain-answer-response")).toBeVisible();

      const actionMenu = page.getByRole("button", { name: "Open answer options" });
      await page.keyboard.press("Escape");
<<<<<<< Updated upstream
      await actionMenu.click();
      const actionsMenu = page.getByTestId("daily-actions-menu");
      await expect(actionsMenu).toBeVisible();
      await actionsMenu.getByRole("menuitem", { name: "Scope sources" }).click();
=======
      if (await scopeTrigger.isVisible().catch(() => false)) {
        await scopeTrigger.click();
      } else {
        const dailyActions = await openDailyActions(page);
        await dailyActions.getByRole("menuitem", { name: "Scope sources" }).click();
      }
>>>>>>> Stashed changes
      const scopeContainer = page.getByTestId("scope-command-popover");
      await expect(scopeContainer).toBeVisible();
      await expect(scopeContainer).toBeVisible();
      await expect(
        scopeContainer.getByText(/Type to filter 24 (loaded )?documents\. Selected documents stay pinned here\./),
      ).toBeVisible();
      await expect(
        scopeContainer.getByText(
          /(?:24 documents available|24 available documents)\. Type a title or file name to narrow the (?:loaded )?list\./,
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
