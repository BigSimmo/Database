import type { Route } from "playwright-core";
import { expect, test, type Locator, type Page } from "playwright/test";
import { scrollPrimarySurface } from "./playwright-scroll";
import { answerThreadStorageKey } from "../src/lib/answer-thread-storage";
import { demoAnswer, demoDocuments, getDemoDocument, getDemoDocumentPayload } from "../src/lib/demo-data";
import { deriveGovernanceFromSections } from "../src/lib/medication-records";
import { getMedicationRecord, loadMedicationSnapshot } from "../src/lib/medication-snapshot";
import { medicationToSearchResult, rankMedicationRecords } from "../src/lib/medications";

const dashboardViewports = [
  { name: "small-mobile", width: 320, height: 720 },
  { name: "standard-mobile", width: 375, height: 760 },
  { name: "large-mobile", width: 414, height: 820 },
  { name: "tablet", width: 768, height: 900 },
  { name: "laptop", width: 1280, height: 900 },
  { name: "mobile-landscape", width: 667, height: 375 },
] as const;
const uiAssertionTimeoutMs = 5_000;

async function expectNoPageHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const documentWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0);
    return documentWidth - document.documentElement.clientWidth;
  });

  expect(overflow).toBeLessThanOrEqual(2);
}

async function gotoApp(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
}

async function gotoCriticalApp(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#main-content, main").first()).toBeVisible({ timeout: 30_000 });
}

async function expectSingleMedicationPage(page: Page) {
  // The medication route renders inside GlobalMockupSearchShell, whose Suspense
  // fallback and resolved client subtree both render `children`. During a
  // navigation/hydration overlap the shared data-testid can transiently resolve
  // to two <main> elements and trip Playwright strict mode. Wait for it to settle
  // to exactly one before asserting visibility — a genuine permanent double-render
  // still fails toHaveCount(1), so this does not mask a real regression.
  const medicationPage = page.getByTestId("medication-page-acamprosate");
  if ((await medicationPage.count()) !== 1) {
    await Promise.race([
      page.waitForResponse((response) => response.url().includes("/api/medications/acamprosate") && response.ok(), {
        timeout: 30_000,
      }),
      expect(medicationPage).toHaveCount(1, { timeout: 30_000 }),
    ]).catch(() => undefined);
  }
  await expect(medicationPage).toHaveCount(1, { timeout: 30_000 });
  await expect(medicationPage).toBeVisible({ timeout: 30_000 });
}

function visibleQuestionInput(page: Page) {
  return page.locator('[aria-label^="Search indexed guidelines by question or keyword"]:visible').first();
}

function visibleAnswerSubmitButton(page: Page) {
  return page.locator('[aria-label="Generate source-backed answer"]:visible').first();
}

function visibleAnswerFollowUpSuggestions(page: Page) {
  return page
    .locator(
      '[data-testid="answer-follow-up-suggestions"]:visible, [data-testid="answer-composer-follow-up-suggestions"]:visible',
    )
    .first();
}

async function isVisibleWithoutThrow(locator: Locator) {
  return locator.isVisible().catch(() => false);
}

async function fillVisibleQuestionInput(page: Page, value: string) {
  const questionInput = visibleQuestionInput(page);
  const submitAnswer = visibleAnswerSubmitButton(page);

  await expect(async () => {
    await expect(submitAnswer).toHaveAttribute("title", /Enter a clinical question|Generate a source-backed answer/, {
      timeout: uiAssertionTimeoutMs,
    });
    await expect(questionInput).toBeEditable({ timeout: uiAssertionTimeoutMs });
    await questionInput.fill(value);
    await expect(questionInput).toHaveValue(value, { timeout: uiAssertionTimeoutMs });
    await expect(submitAnswer).toBeEnabled({ timeout: uiAssertionTimeoutMs });
  }).toPass({ timeout: 15_000 });

  return questionInput;
}

async function switchToDocumentSearchMode(page: Page) {
  const legacyDocumentsMode = page.getByRole("button", { name: "Switch to document search mode" });
  if (await isVisibleWithoutThrow(legacyDocumentsMode)) {
    await expect(legacyDocumentsMode).toBeEnabled();
    await expect(async () => {
      await legacyDocumentsMode.click();
      await expect(legacyDocumentsMode).toHaveAttribute("aria-pressed", "true", { timeout: uiAssertionTimeoutMs });
    }).toPass({ timeout: 8_000 });
    return;
  }

  const appModeMenu = page.getByRole("button", { name: /^Mode / });
  if (!(await isVisibleWithoutThrow(appModeMenu))) {
    throw new Error(
      "Could not switch to document search mode: neither the legacy mode toggle nor the app mode menu is visible.",
    );
  }
  await expect(appModeMenu).toBeEnabled();

  await expect(async () => {
    if ((await appModeMenu.getAttribute("aria-expanded")) !== "true") {
      await appModeMenu.click({ force: true });
    }
    const appModeGroup = page.getByRole("menu", { name: "Choose app mode" });
    await expect(appModeGroup).toBeVisible({ timeout: uiAssertionTimeoutMs });
    const documentsMode = appModeGroup.getByRole("menuitemradio", { name: /^Documents\b/ });
    await expect(documentsMode).toBeVisible({ timeout: uiAssertionTimeoutMs });
    await documentsMode.click({ force: true });
    await expect(appModeMenu).toHaveAccessibleName("Mode Documents", { timeout: uiAssertionTimeoutMs });
  }).toPass({ timeout: 8_000 });
}

const readySetupChecks = [
  { id: "env", label: ".env.local configured", status: "ready", detail: "Test environment ready." },
  { id: "project", label: "Clinical KB Database target", status: "ready", detail: "Test Supabase project ready." },
  { id: "schema", label: "supabase/schema.sql applied", status: "ready", detail: "Test schema ready." },
  { id: "search", label: "Search RPC and vector indexes", status: "ready", detail: "Test search schema ready." },
  { id: "openai", label: "OpenAI API key available", status: "ready", detail: "Test OpenAI ready." },
  { id: "worker", label: "npm run worker running", status: "unknown", detail: "Worker not required for UI smoke." },
];

async function mockLocalProjectIdentity(page: Page) {
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
}

async function mockPrivateUnauthenticatedApi(page: Page) {
  await mockLocalProjectIdentity(page);
  await page.route("**/api/setup-status**", async (route) => {
    await route.fulfill({
      json: { demoMode: false, checks: readySetupChecks },
    });
  });
  await page.route(/\/api\/answer(?:\/stream)?(?:\?.*)?$/, async (route) => {
    const body = route.request().postDataJSON() as {
      query?: string;
      documentId?: string;
      documentIds?: string[];
    };
    await fulfillAnswerResponse(
      route,
      demoAnswer(body.query ?? "What monitoring is required?", body.documentId, body.documentIds),
    );
  });
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

type DemoAnswerOverride = (query: string, documentId?: string, documentIds?: string[]) => ReturnType<typeof demoAnswer>;
type MockDemoApiOptions = {
  answerOverride?: DemoAnswerOverride;
  answerDelayMs?: number;
  onAnswerRequest?: (query: string) => void;
};

async function mockDemoApi(page: Page, options: MockDemoApiOptions = {}) {
  await mockLocalProjectIdentity(page);
  await page.route("**/api/setup-status**", async (route) => {
    await route.fulfill({
      json: { demoMode: true, checks: readySetupChecks },
    });
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
  await page.route(/\/api\/medications(?:\/([^/?]+))?(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    const slug = url.pathname.match(/\/api\/medications\/([^/]+)$/)?.[1];
    if (slug) {
      const record = getMedicationRecord(decodeURIComponent(slug));
      if (!record) {
        await route.fulfill({ status: 404, json: { error: `No medication found for "${slug}".` } });
        return;
      }
      const governance = deriveGovernanceFromSections(record);
      await route.fulfill({
        json: {
          record,
          governance: {
            sourceStatus: governance.source_status,
            validationStatus: governance.validation_status,
          },
          demoMode: true,
        },
      });
      return;
    }

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
  await page.route(/\/api\/ingestion\/jobs(?:\?.*)?$/, async (route) => {
    await route.fulfill({ json: { jobs: [], demoMode: true } });
  });
  await page.route(/\/api\/ingestion\/batches(?:\?.*)?$/, async (route) => {
    await route.fulfill({ json: { batches: [], demoMode: true } });
  });
  await page.route(/\/api\/ingestion\/quality(?:\?.*)?$/, async (route) => {
    await route.fulfill({ json: { items: [], demoMode: true } });
  });
  await page.route(/\/api\/answer(?:\/stream)?(?:\?.*)?$/, async (route) => {
    const body = route.request().postDataJSON() as {
      query?: string;
      documentId?: string;
      documentIds?: string[];
    };
    const query = body.query ?? "What monitoring is required?";
    options.onAnswerRequest?.(query);
    if (options.answerDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.answerDelayMs));
    }
    const answer =
      options.answerOverride?.(query, body.documentId, body.documentIds) ??
      demoAnswer(query, body.documentId, body.documentIds);
    await fulfillAnswerResponse(route, {
      ...answer,
      demoMode: true,
    });
  });
  await page.route(/\/api\/search$/, async (route) => {
    const body = route.request().postDataJSON() as { query?: string; mode?: string };
    const query = body.query?.toLowerCase() ?? "";
    if (query.includes("coffee machine")) {
      await route.fulfill({
        json: {
          results: [],
          visualEvidence: [],
          relatedDocuments: [],
          documentMatches: [],
          relevance: { verdict: "none", score: 0, directSourceCount: 0, weakSourceCount: 0 },
          smartPanel: {},
          telemetry: {
            query_class: "unsupported_or_general",
            retrieval_strategy: "unsupported_short_circuit",
            embedding_skipped: true,
          },
          demoMode: true,
        },
      });
      return;
    }
    const isSafetyPlan = query.includes("patient safety plan");
    await route.fulfill({
      json: {
        results: [
          {
            id: isSafetyPlan ? "55555555-5555-4555-8555-555555555555" : "44444444-4444-4444-8444-444444444442",
            document_id: "11111111-1111-4111-8111-111111111111",
            title: isSafetyPlan ? "Synthetic patient safety plan" : "Synthetic lithium monitoring protocol",
            file_name: isSafetyPlan ? "patient-safety-plan.pdf" : "lithium-monitoring.pdf",
            page_number: 1,
            chunk_index: 0,
            section_heading: isSafetyPlan ? "Safety plan contents" : "Monitoring",
            content: isSafetyPlan
              ? "Patient safety plan should include warning signs, supports, coping strategies, means restriction, and crisis contacts."
              : "Lithium monitoring and toxicity safety-net source passage.",
            image_ids: [],
            similarity: 0.9,
            hybrid_score: 0.92,
            images: [],
          },
        ],
        visualEvidence: [],
        relatedDocuments: [],
        documentMatches: [
          {
            document_id: "11111111-1111-4111-8111-111111111111",
            title: isSafetyPlan ? "Synthetic patient safety plan" : "Synthetic lithium monitoring protocol",
            file_name: isSafetyPlan ? "patient-safety-plan.pdf" : "lithium-monitoring.pdf",
            labels: [
              {
                label: isSafetyPlan ? "patient safety plan" : "lithium",
                label_type: isSafetyPlan ? "document" : "medication",
                source: "generated",
                confidence: 0.94,
              },
            ],
            summarySnippet: isSafetyPlan
              ? "Patient safety plan contents and crisis supports."
              : "Lithium monitoring and toxicity safety-net reminders.",
            bestPages: [1],
            bestChunkIds: [
              isSafetyPlan ? "55555555-5555-4555-8555-555555555555" : "44444444-4444-4444-8444-444444444442",
            ],
            imageCount: 1,
            tableCount: 1,
            matchReason: "Matched indexed passage",
            score: 0.92,
          },
        ],
        smartPanel: {},
        telemetry: {
          query_class: isSafetyPlan ? "document_lookup" : "medication_dose_risk",
          retrieval_strategy: "text_fast_path",
          embedding_skipped: true,
        },
        demoMode: true,
      },
    });
  });
  await page.route(/\/api\/documents\/[^/]+\/search(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      json: {
        query: new URL(route.request().url()).searchParams.get("q") ?? "",
        results: [
          {
            id: "55555555-5555-4555-8555-555555555555",
            page_number: 1,
            chunk_index: 2,
            section_heading: "Safety plan contents",
            snippet:
              "Patient safety plan should include warning signs, coping strategies, supports, crisis contacts, and means restriction.",
            matched_terms: ["safety", "plan", "include"],
            image_ids: [],
            score: 2.4,
          },
          {
            id: "44444444-4444-4444-8444-444444444442",
            page_number: 1,
            chunk_index: 0,
            section_heading: "Monitoring",
            snippet: "Lithium monitoring and toxicity safety-net source passage.",
            matched_terms: ["monitoring"],
            image_ids: [],
            score: 1.2,
          },
        ],
        pageHits: [1],
        hitCount: 2,
        strategy: "full_text_trigram_rpc",
        demoMode: true,
      },
    });
  });
  await page.route(/\/api\/documents\/([^/]+)\/signed-url(?:\?.*)?$/, async (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-2) ?? "";
    const document = getDemoDocument(id);
    if (!document) {
      await route.fulfill({ status: 404, json: { error: "Demo document not found." } });
      return;
    }
    await route.fulfill({
      json: { url: document.storage_path, fileType: document.file_type, demoMode: true },
    });
  });
  await page.route(/\/api\/documents\/[^/]+\/summarize$/, async (route) => {
    await route.fulfill({
      json: {
        answer:
          "Key practical points: **clozapine** monitoring requires regular FBC/ANC checks and review of constipation, myocarditis symptoms, metabolic risk, and missed-dose restart rules.",
        grounded: true,
        confidence: "high",
        citations: [],
        sources: [],
        demoMode: true,
      },
    });
  });
  await page.route(/\/api\/documents\/([^/]+)(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    const id = url.pathname.split("/").at(-1) ?? "";
    const selectedChunkId = url.searchParams.get("chunk");
    const payload = getDemoDocumentPayload(id, selectedChunkId);
    if (!payload) {
      await route.fulfill({ status: 404, json: { error: "Demo document not found." } });
      return;
    }
    if (selectedChunkId === "55555555-5555-4555-8555-555555555555") {
      await route.fulfill({
        json: {
          ...payload,
          document: {
            ...payload.document,
            title: "Synthetic patient safety plan",
            file_name: "patient-safety-plan.pdf",
          },
          pages: payload.pages.map((page) => ({
            ...page,
            text: `${page.text}\n\nPatient safety plan should include warning signs, coping strategies, supports, crisis contacts, and means restriction.`,
          })),
          chunks: [
            {
              id: "55555555-5555-4555-8555-555555555555",
              document_id: id,
              page_number: 1,
              chunk_index: 2,
              section_heading: "Safety plan contents",
              content:
                "Patient safety plan should include warning signs, coping strategies, supports, crisis contacts, and means restriction.",
              image_ids: [],
            },
          ],
          demoMode: true,
        },
      });
      return;
    }
    const longSelectedPassage = selectedChunkId
      ? {
          ...payload,
          chunks: payload.chunks.map((chunk) =>
            chunk.id === selectedChunkId ? { ...chunk, content: Array(8).fill(chunk.content).join(" ") } : chunk,
          ),
        }
      : payload;
    await route.fulfill({ json: { ...longSelectedPassage, demoMode: true } });
  });
}

async function expectDomIntegrity(page: Page, options: { mobileNav?: boolean; mobileFabReady?: boolean } = {}) {
  const audit = await page.evaluate(() => {
    const duplicateIds = [...document.querySelectorAll("[id]")]
      .map((element) => element.id)
      .filter((id, index, all) => id && all.indexOf(id) !== index);
    const brokenAriaRefs: Array<{ attr: string; id: string }> = [];

    for (const element of [...document.querySelectorAll("[aria-labelledby],[aria-describedby],[aria-controls]")]) {
      for (const attr of ["aria-labelledby", "aria-describedby", "aria-controls"]) {
        const value = element.getAttribute(attr);
        if (!value) continue;
        for (const id of value.split(/\s+/).filter(Boolean)) {
          if (!document.getElementById(id)) brokenAriaRefs.push({ attr, id });
        }
      }
    }

    return {
      h1Count: document.querySelectorAll("h1,[role='heading'][aria-level='1']").length,
      duplicateIds: [...new Set(duplicateIds)],
      brokenAriaRefs,
      hasFrameworkOverlay: /Unhandled Runtime Error|Build Error|Application error|Next\.js/.test(
        document.body.innerText,
      ),
    };
  });

  expect(audit.h1Count).toBe(1);
  expect(audit.duplicateIds).toEqual([]);
  expect(audit.brokenAriaRefs).toEqual([]);
  expect(audit.hasFrameworkOverlay).toBe(false);

  if (options.mobileNav) {
    await expect(page.getByRole("navigation", { name: "Answer sections" })).toHaveCount(0);
    if (options.mobileFabReady) {
      await expect(page.getByTestId("mobile-section-fab-button")).toBeVisible();
      await expect(page.getByTestId("mobile-section-fab-menu")).toBeHidden();
    } else {
      await expect(page.getByTestId("mobile-section-fab-button")).toHaveCount(0);
      await expect(page.getByTestId("mobile-section-fab-menu")).toHaveCount(0);
    }
  }
}

// Scope opens from the command surface after answer submit and from the "+" menu on mode homes.
async function openScopeControl(page: Page) {
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page
    .getByRole("listbox", { name: /search suggestions/i })
    .waitFor({ state: "hidden", timeout: 5_000 })
    .catch(() => undefined);

  const composer = page.locator('[aria-label^="Search indexed guidelines by question or keyword"]:visible').first();

  await expect(async () => {
    await composer.click();
    const scopeOption = page.getByRole("option", { name: /Scope sources/i });
    if (await scopeOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await scopeOption.click();
    } else {
      const actionMenu = page.getByRole("button", { name: "Open answer options" });
      await expect(actionMenu).toBeVisible();
      await actionMenu.click();
      const actionsMenu = page.getByTestId("daily-actions-menu");
      await expect(actionsMenu).toBeVisible({ timeout: uiAssertionTimeoutMs });
      await actionsMenu.getByRole("menuitem", { name: /^Scope\b/ }).click();
    }
    await expect(page.getByTestId("scope-command-popover")).toBeVisible({
      timeout: uiAssertionTimeoutMs,
    });
  }).toPass({ timeout: 15_000 });
}

async function expectMinTouchTarget(locator: Locator, minSize = 44) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  const measurementTolerance = 2;
  expect(box!.height + measurementTolerance).toBeGreaterThanOrEqual(minSize);
  expect(box!.width + measurementTolerance).toBeGreaterThanOrEqual(minSize);
}

async function tapOutsideActiveSurface(page: Page) {
  const viewport = page.viewportSize() ?? { width: 390, height: 820 };
  await page.mouse.click(Math.max(1, viewport.width - 8), 8);
}

async function scrollMobileTableExpandClearOfFooter(page: Page, clinicalTable: Locator) {
  await clinicalTable.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    const expand = document.querySelector('[data-testid="table-expand-button"]');
    const scrollContainer = document.querySelector("main#main-content");
    const footer = document.querySelector(
      ".answer-footer-search-dock, .dashboard-composer-edge.answer-footer-search-edge",
    );
    if (!expand || !scrollContainer) return;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const expandRect = expand.getBoundingClientRect();
      const footerTop = footer?.getBoundingClientRect().top ?? window.innerHeight;
      const currentOverlap = expandRect.bottom - footerTop + 24;
      if (currentOverlap <= 0) break;
      scrollContainer.scrollTop += currentOverlap;
    }
  });
}

async function openMobileTableFullscreen(page: Page, clinicalTable: Locator) {
  await scrollMobileTableExpandClearOfFooter(page, clinicalTable);
  const expandButton = clinicalTable.getByTestId("table-expand-button");
  const tableSurface = clinicalTable.getByTestId("accessible-table-surface");
  const tableDialog = page.getByTestId("table-fullscreen-dialog");
  await expect(async () => {
    if (await tableDialog.isVisible().catch(() => false)) return;
    if (await expandButton.isVisible().catch(() => false)) {
      await expandButton.click();
    } else {
      await tableSurface.click();
    }
    await expect(tableDialog).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
  return tableDialog;
}

async function openMobileClinicalGuideMenu(page: Page) {
  const trigger = page.getByRole("button", { name: "Open Clinical Guide menu" });
  await expect(trigger).toBeVisible();
  await trigger.click();

  const menu = page.getByRole("dialog", { name: "Clinical Guide" });
  await expect(menu).toBeVisible();
  const menuBox = await menu.boundingBox();
  expect(menuBox).not.toBeNull();
  expect(menuBox!.x).toBeGreaterThanOrEqual(0);
  await expect(menu.getByRole("button", { name: "New chat" })).toBeVisible();
  await expect(menu.getByPlaceholder("Search chats")).toBeVisible();
  await expect(menu.getByText("Recent chats", { exact: true })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Tools", exact: true })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Guide & help" })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Settings", exact: true })).toBeVisible();
  await expect(menu.getByText("Guest")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Clinical KB guide" })).toHaveCount(0);
  await expectNoPageHorizontalOverflow(page);
  return menu;
}

async function waitForDemoDashboardReady(page: Page) {
  await expect(visibleQuestionInput(page)).toBeEnabled();
  await expect(page.getByRole("button", { name: "Open answer options" })).toBeVisible({ timeout: 30000 });
}

async function waitForPersistedAnswerThread(page: Page, minPriorTurns = 1) {
  await expect
    .poll(async () =>
      page.evaluate((storageKey) => {
        try {
          const raw = window.localStorage.getItem(storageKey);
          if (!raw) return 0;
          const parsed = JSON.parse(raw) as { priorTurns?: unknown[] };
          return Array.isArray(parsed.priorTurns) ? parsed.priorTurns.length : 0;
        } catch {
          return 0;
        }
      }, answerThreadStorageKey),
    )
    .toBeGreaterThanOrEqual(minPriorTurns);
}

async function openGuide(page: Page) {
  const viewport = page.viewportSize();
  const dialog = page.getByRole("dialog", { name: "Clinical KB guide" });
  const expandedGuide = page.locator("#clinical-tools-sidebar").getByRole("button", { name: "Guide & help" });
  const railGuide = page.getByRole("button", { name: "Guide and help", exact: true });

  if (viewport && viewport.width >= 768) {
    const trigger = (await expandedGuide.isVisible().catch(() => false)) ? expandedGuide : railGuide;
    await expect(trigger).toBeVisible();
    await expect(trigger).toBeEnabled();
    await expect(async () => {
      if (await dialog.isVisible().catch(() => false)) return;
      await trigger.click();
      await expect(dialog).toBeVisible({ timeout: uiAssertionTimeoutMs });
    }).toPass({ timeout: 10_000 });
  } else {
    const menu = await openMobileClinicalGuideMenu(page);
    await menu.getByRole("button", { name: "Guide & help" }).click();
    await expect(dialog).toBeVisible();
  }

  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Ask and verify")).toBeVisible();
  await expect(dialog.getByText("Top source and citations")).toBeVisible();
  await expect(dialog.getByText("Upload and indexing")).toBeVisible();
  await expect(dialog.getByText("Copying text")).toBeVisible();
  await expectNoPageHorizontalOverflow(page);
  return dialog;
}

function accountSettingsDialog(page: Page) {
  return page.getByRole("dialog", { name: "Account & app" });
}

function accountSetupDialog(page: Page) {
  return page.getByRole("dialog", { name: "Set up your workspace" });
}

async function expectAccountSettingsSurface(settings: Locator) {
  await expect(settings.getByRole("heading", { name: "Account & app" })).toBeVisible();
  await expect(settings.getByRole("heading", { name: "Account", exact: true })).toBeVisible();
  await expect(settings.getByRole("heading", { name: "Clinical defaults", exact: true })).toBeVisible();
  await expect(settings.getByRole("heading", { name: "App preferences", exact: true })).toBeVisible();
  await expect(settings.getByTestId("settings-row-profile")).toBeVisible();
  await expect(settings.getByTestId("settings-row-jurisdiction")).toBeVisible();
  await expect(settings.getByTestId("settings-row-answer-style")).toBeVisible();
  await expect(settings.getByTestId("settings-row-appearance")).toBeVisible();
  await expect(settings).not.toContainText(/admin|database|storage|source review|import pipeline/i);
}

async function expectAccountSetupSurface(setup: Locator) {
  await expect(setup.getByRole("heading", { name: "Set up your workspace" })).toBeVisible();
  await expect(setup.getByLabel("Email address")).toBeVisible();
  await expect(setup.getByRole("button", { name: "Continue", exact: true })).toBeVisible();
  await expect(setup.getByRole("button", { name: "Apple" })).toBeVisible();
  await expect(setup.getByRole("button", { name: "Google" })).toBeVisible();
  await expect(setup.getByRole("button", { name: "Microsoft" })).toBeVisible();
  await expect(setup.getByRole("heading", { name: "Source preferences" })).toBeVisible();
  await expect(setup.getByRole("button", { name: "Guidelines" })).toHaveAttribute("aria-pressed", "true");
  await expect(setup.getByRole("button", { name: "Drug references" })).toHaveAttribute("aria-pressed", "false");
  await expect(setup.getByRole("heading", { name: "Security summary" })).toBeVisible();
  await expect(setup.getByText("No PHI required")).toBeVisible();
  await expect(setup).toContainText("Do not enter patient-identifying information.");
}

async function openUploadDrawer(page: Page) {
  const uploadButton = page.getByRole("button", { name: /Upload document/i });
  const uploadDrawer = page.getByRole("dialog", { name: "Upload and indexing" });
  await expect(uploadButton).toBeVisible();

  await expect(async () => {
    if (await uploadDrawer.isVisible().catch(() => false)) return;
    await uploadButton.click();
    await expect(uploadDrawer).toBeVisible({ timeout: uiAssertionTimeoutMs });
  }).toPass({ timeout: 8_000 });

  return uploadDrawer;
}

async function dismissOverlayByHeaderClick(page: Page) {
  // Portaled integrated action menus cover the hero composer; avoid fixed viewport
  // coordinates that can hit menu tiles (e.g. Clinical tools -> tools mode).
  await page.locator("#search").click({ position: { x: 120, y: 28 } });
}

async function openDailyActions(page: Page, triggerName: string | RegExp = /^Open .+ options$/) {
  const trigger = page.getByRole("button", { name: triggerName });
  const menu = page.getByTestId("daily-actions-menu");

  await expect(trigger).toBeVisible();
  await expect(trigger).toBeEnabled();
  await expect(async () => {
    if (await menu.isVisible().catch(() => false)) return;
    await trigger.click();
    await expect(menu).toBeVisible({ timeout: uiAssertionTimeoutMs });
  }).toPass({ timeout: 20_000 });

  return menu;
}

test.describe("Clinical KB UI smoke coverage", () => {
  test.describe.configure({ timeout: 60000 });

  for (const viewport of dashboardViewports) {
    test(`dashboard loads without page overflow at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await mockPrivateUnauthenticatedApi(page);
      await gotoApp(page, "/");
      await waitForDemoDashboardReady(page);

      await expect(page.getByRole("heading", { level: 1, name: "Clinical Guide" })).toHaveCount(1);
      await expect(page.getByRole("heading", { name: "Answer" })).toBeVisible();
      await expect(visibleQuestionInput(page)).toBeVisible();
      await expect(page.getByRole("button", { name: "Generate source-backed answer" })).toHaveText(/^\s*Ask\s*$/);
      const headerHeight = await page.locator("#search").evaluate((element) => element.getBoundingClientRect().height);
      expect(headerHeight).toBeLessThanOrEqual(viewport.width >= 640 ? 185 : 180);
      await expect(page.getByRole("button", { name: "Open answer options" })).toBeVisible();
      await expect(page.getByTestId("scope-command-popover")).toBeHidden();
      await expect(page.getByTestId("scope-prompts-drawer")).toHaveCount(0);
      await expect(page.getByTestId("mobile-scope-popover")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Search documents" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Upload document" })).toBeVisible();
      await expectDomIntegrity(page, { mobileNav: viewport.width <= 768 });
      if (viewport.width <= 768) {
        await expect(page.getByTestId("mobile-section-fab-button")).toHaveCount(0);
      }
      if (viewport.width < 640) {
        const dailyActionsTrigger = page.getByRole("button", { name: "Open answer options" });
        const dailyActions = await openDailyActions(page);
        const searchAction = dailyActions.getByRole("menuitem", { name: "Search" });
        await expect(searchAction).toBeVisible();
        await expect(dailyActions.getByRole("menuitem", { name: "View evidence" })).toBeVisible();
        await expectMinTouchTarget(searchAction);
        await expect(page.getByRole("dialog", { name: "Clinical KB guide" })).toHaveCount(0);
        await page.keyboard.press("Escape");
        await expect(dailyActions).toBeHidden();
        await expect(dailyActionsTrigger).toBeFocused();
      }
      await expectNoPageHorizontalOverflow(page);
    });
  }

  test("anonymous user can see enabled live search without a forced sign-in gate @critical", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockPrivateUnauthenticatedApi(page);
    await page.route(/\/api\/search(?:\?.*)?$/, async (route) => {
      await route.fulfill({ json: { results: [], telemetry: { retrieval_strategy: "text_fast_path" } } });
    });
    await gotoCriticalApp(page, "/");
    await waitForDemoDashboardReady(page);

    await expect(page.getByText("Create your Clinical Guide account")).toHaveCount(0);
    await expect(page.getByText("Search request was not authorized by the server.")).toHaveCount(0);
    await expect(page.getByTestId("global-search-input")).toBeEnabled();
  });

  test("anonymous mobile user can search without a forced sign-in gate", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 820 });
    await mockPrivateUnauthenticatedApi(page);
    await page.route(/\/api\/search(?:\?.*)?$/, async (route) => {
      await route.fulfill({ json: { results: [], telemetry: { retrieval_strategy: "text_fast_path" } } });
    });
    await gotoApp(page, "/");
    await waitForDemoDashboardReady(page);

    await expect(page.getByText("Create your Clinical Guide account")).toHaveCount(0);
    await expect(page.getByText("Service unavailable")).toHaveCount(0);
    await expect(page.getByText("API unavailable")).toHaveCount(0);
    await expect(page.getByText("Search request was not authorized by the server.")).toHaveCount(0);
    await expect(page.getByTestId("global-search-input")).toBeEnabled();
  });

  test("desktop sidebar mode sync and accessibility affordances stay coherent", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockDemoApi(page);
    await gotoApp(page, "/?mode=tools");

    const sidebar = page.locator("#clinical-tools-sidebar");
    const modeButton = page.getByRole("button", { name: "Mode Tools" });
    await expect(modeButton).toBeVisible();
    const selectedToolSheet = page.getByRole("dialog", { name: "Risk & Safety" });
    if (await isVisibleWithoutThrow(selectedToolSheet)) {
      await selectedToolSheet.getByRole("button", { name: "Close Risk & Safety" }).click();
      await expect(selectedToolSheet).toBeHidden();
    }
    const expandSidebar = page.getByRole("button", { name: "Expand sidebar" });
    await expect(expandSidebar).toBeVisible();
    await expectMinTouchTarget(expandSidebar);
    await expect(page.getByTestId("collapsed-account-settings")).toHaveAccessibleName(
      /G Guest Not signed in\. Set up workspace/,
    );
    await expect(sidebar).toHaveCount(0);
    await expandSidebar.click();
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "View tools" })).toHaveCount(0);
    await expect(sidebar.getByRole("link", { name: "Tools", exact: true })).toHaveAttribute("href", "/?mode=tools");
    await expect(sidebar.getByTestId("sidebar-account-settings")).toHaveAccessibleName(
      /G Guest Not signed in\. Set up workspace/,
    );

    const collapseSidebar = page.getByRole("button", { name: "Collapse sidebar" });
    await expectMinTouchTarget(collapseSidebar);
    await collapseSidebar.click();
    await expect(page.getByTestId("collapsed-account-settings")).toHaveAccessibleName(
      /G Guest Not signed in\. Set up workspace/,
    );

    await expandSidebar.click();
    await sidebar.getByRole("link", { name: "Answer", exact: true }).click();
    await expect(page).toHaveURL(/\/\?mode=answer$/);
    await expect(page.getByRole("button", { name: "Mode Answer" })).toBeVisible();
    await expect(page.getByTestId("answer-section-heading")).toHaveText("Answer");
    await expect(page.getByRole("heading", { name: "Answer" })).toBeVisible();
  });

  test("tablet shows icon rail without drawer trigger or expand control @critical", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await mockDemoApi(page);
    await gotoCriticalApp(page, "/?mode=answer");
    await waitForDemoDashboardReady(page);

    await expect(page.getByRole("button", { name: "Open Clinical Guide menu" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Expand sidebar" })).toHaveCount(0);
    await expect(page.locator("#clinical-tools-sidebar")).toHaveCount(0);
    await expect(page.getByLabel("Clinical Guide collapsed sidebar")).toBeVisible();

    for (const tool of [
      { name: "Answer", href: "/?mode=answer" },
      { name: "Documents", href: "/?mode=documents" },
      { name: "Services", href: "/services" },
      { name: "Forms", href: "/forms" },
      { name: "Favourites", href: "/favourites" },
      { name: "Differentials", href: "/differentials" },
      { name: "Medications", href: "/?mode=prescribing" },
      { name: "Tools", href: "/?mode=tools" },
    ] as const) {
      await expect(page.getByRole("link", { name: tool.name, exact: true })).toHaveAttribute("href", tool.href);
    }

    await expectNoPageHorizontalOverflow(page);
  });

  test("tablet rail highlights the active tool for key routes", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await mockDemoApi(page);

    for (const route of [
      { path: "/?mode=answer", label: "Answer" },
      { path: "/?mode=documents", label: "Documents" },
      { path: "/favourites", label: "Favourites" },
      { path: "/?mode=prescribing", label: "Medications" },
    ] as const) {
      await gotoApp(page, route.path);
      if (route.path.includes("mode=answer")) {
        await waitForDemoDashboardReady(page);
      } else {
        await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
      }

      const activeLink = page.getByRole("link", { name: route.label, exact: true });
      await expect(activeLink).toBeVisible();
      await expect(activeLink).toHaveAttribute("aria-current", "page");
    }
  });

  test("served response headers do not block cross-origin Supabase images", async ({ page }) => {
    // Regression guard for the "all images fail to render" incident: document
    // page images load cross-origin from Supabase Storage signed URLs. A
    // Cross-Origin-Embedder-Policy: require-corp header (or a CSP that drops
    // https: images / the *.supabase.co origin) silently breaks every image
    // while all other tests still pass. Assert the actual served headers.
    const response = await page.request.get("/");
    expect(response.status()).toBe(200);
    const headers = response.headers();

    expect(headers["cross-origin-embedder-policy"]).toBeUndefined();

    const csp = headers["content-security-policy"] ?? "";
    expect(csp).toContain("img-src");
    const imgSrc = csp.split(";").find((directive) => directive.trim().startsWith("img-src"));
    expect(imgSrc).toContain("https:");
    expect(csp).toContain("https://*.supabase.co");
  });

  test("static agent guidance is available and documents mode avoids the app error boundary", async ({ page }) => {
    const llms = await page.request.get("/llms.txt");
    expect(llms.status()).toBe(200);
    const llmsText = await llms.text();
    expect(llmsText).toContain("Clinical Guide");
    expect(llmsText).toContain("rely on cited source evidence");

    await page.setViewportSize({ width: 1280, height: 900 });
    await mockDemoApi(page);
    await gotoApp(page, "/?mode=documents");
    await expect(page.getByRole("button", { name: "Mode Documents" })).toBeVisible();
    await expect(page.getByTestId("document-search-workspace")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Something went wrong" })).toHaveCount(0);
  });

  test("account setup opens from desktop sidebar account affordances while settings stays separate", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockDemoApi(page);
    await gotoCriticalApp(page, "/");
    await waitForDemoDashboardReady(page);

    const settings = accountSettingsDialog(page);
    const setup = accountSetupDialog(page);
    await page.getByRole("button", { name: "Expand sidebar" }).click();
    await expect(page.locator("#clinical-tools-sidebar")).toBeVisible();
    await page.locator("#clinical-tools-sidebar").getByRole("button", { name: "Settings", exact: true }).click();
    await expect(settings).toBeVisible();
    await expectAccountSettingsSurface(settings);
    await expectNoPageHorizontalOverflow(page);

    await settings.getByRole("button", { name: "Close settings" }).click();
    await expect(settings).toBeHidden();

    await page.locator("#clinical-tools-sidebar").getByTestId("sidebar-account-settings").click();
    await expect(setup).toBeVisible();
    await expectAccountSetupSurface(setup);
    await expectNoPageHorizontalOverflow(page);
    await setup.getByRole("button", { name: "Close account setup" }).click();
    await expect(setup).toBeHidden();

    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await page.getByTestId("collapsed-account-settings").click();
    await expect(setup).toBeVisible();
    await expectAccountSetupSurface(setup);
  });

  test("account settings uses a fullscreen settings page below desktop and closes from X and Escape", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 820 });
    await mockDemoApi(page);
    await gotoApp(page, "/");
    await waitForDemoDashboardReady(page);

    const settings = accountSettingsDialog(page);
    const setup = accountSetupDialog(page);
    const menu = await openMobileClinicalGuideMenu(page);
    await menu.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(menu).toHaveCount(0);
    await expect(settings).toBeVisible();
    await expectAccountSettingsSurface(settings);
    const settingsBox = await settings.boundingBox();
    const viewport = await page.evaluate(() => ({
      width: window.visualViewport?.width ?? window.innerWidth,
      height: window.visualViewport?.height ?? window.innerHeight,
    }));
    const fullscreenTolerance = 16;
    expect(settingsBox).not.toBeNull();
    expect(settingsBox!.x).toBeGreaterThanOrEqual(-1);
    expect(settingsBox!.y).toBeLessThanOrEqual(fullscreenTolerance);
    expect(settingsBox!.width + fullscreenTolerance).toBeGreaterThanOrEqual(viewport.width);
    expect(settingsBox!.height + fullscreenTolerance).toBeGreaterThanOrEqual(viewport.height);
    await expectNoPageHorizontalOverflow(page);

    await settings.getByRole("button", { name: "Close settings" }).click();
    await expect(settings).toBeHidden();

    const escapeMenu = await openMobileClinicalGuideMenu(page);
    await escapeMenu.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(settings).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(settings).toBeHidden();

    const accountMenu = await openMobileClinicalGuideMenu(page);
    await accountMenu.getByTestId("sidebar-account-settings").click();
    await expect(accountMenu).toHaveCount(0);
    await expect(setup).toBeVisible();
    await expectAccountSetupSurface(setup);
    const setupBox = await setup.boundingBox();
    expect(setupBox).not.toBeNull();
    expect(setupBox!.x).toBeGreaterThanOrEqual(-1);
    expect(setupBox!.width + fullscreenTolerance).toBeLessThanOrEqual(viewport.width + fullscreenTolerance);
    await expectNoPageHorizontalOverflow(page);
  });

  test("private mode unauthenticated dashboard gates real-mode search", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 820 });
    const answerRequests: string[] = [];
    const unsafeLocalProjectPayload = {
      appName: "Clinical KB",
      projectId: "test-project",
      identityPath: "/api/local-project-id",
      localServer: {
        currentUrl: "http://localhost:4298",
        currentPort: 4298,
        projectPortStart: 4298,
        projectPortEnd: 53210,
        safeLocalOrigin: false,
        requestOrigin: null,
        requestReferer: null,
        unsafeLocalCaller: "http://localhost:3000",
      },
    };
    await mockPrivateUnauthenticatedApi(page);
    await page.route(/\/api\/local-project-id$/, async (route) => {
      await route.fulfill({ json: unsafeLocalProjectPayload });
    });
    await page.route(/\/api\/answer(?:\/stream)?(?:\?.*)?$/, async (route) => {
      answerRequests.push(route.request().url());
      await route.fulfill({ status: 401, json: { error: "Authentication required." } });
    });
    await gotoApp(page, "/");

    const questionInput = visibleQuestionInput(page);
    await questionInput.fill("lithium monitoring");
    await expect(page.getByRole("button", { name: "Generate source-backed answer" })).toBeDisabled();
    await expect(page.getByTestId("answer-grounding-chip")).toHaveCount(0);
    expect(answerRequests).toEqual([]);
    await expect(page.getByRole("heading", { level: 1, name: "Clinical Guide" })).toBeVisible();
    await expectDomIntegrity(page, { mobileNav: true, mobileFabReady: false });
    await expectNoPageHorizontalOverflow(page);
  });

  test("desktop mode options close when clicking outside or opening scope", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockPrivateUnauthenticatedApi(page);
    await gotoApp(page, "/");
    await waitForDemoDashboardReady(page);

    const dailyActionsTrigger = page.getByRole("button", { name: "Open answer options" });
    const dailyActionsMenu = page.getByTestId("daily-actions-menu");
    const appModeTrigger = page.getByRole("button", { name: "Mode Answer" });
    const appModeMenu = page.getByRole("menu", { name: "Choose app mode" });

    await appModeTrigger.click();
    await expect(appModeMenu).toBeVisible();
    await page.mouse.click(640, 430);
    await expect(appModeMenu).toBeHidden();

    await appModeTrigger.click();
    await expect(appModeMenu).toBeVisible();
    await dailyActionsTrigger.click();
    await expect(appModeMenu).toBeHidden();
    await expect(dailyActionsMenu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dailyActionsMenu).toHaveCount(0);

    // First open — use robust retry helper to handle async state update timing.
    await openDailyActions(page, "Open answer options");
    await dismissOverlayByHeaderClick(page);
    await expect(dailyActionsMenu).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Mode Answer" })).toBeVisible();

    // Second open - verify opening the mode menu closes the daily actions surface.
    await openDailyActions(page, "Open answer options");
    await appModeTrigger.click();

    await expect(dailyActionsMenu).toHaveCount(0);
    await expect(appModeMenu).toBeVisible();
    await page.mouse.click(640, 430);
    await expect(appModeMenu).toBeHidden();
    await expectNoPageHorizontalOverflow(page);
  });

  test("demo answer flow reaches a source-backed answer @critical", async ({ browserName, page }) => {
    await page.setViewportSize({ width: 390, height: 820 });
    await mockDemoApi(page);
    await gotoCriticalApp(page, "/");
    await waitForDemoDashboardReady(page);

    const question = "What clozapine monitoring items are shown in the table image?";
    const questionInput = await fillVisibleQuestionInput(page, question);
    await expect(questionInput).toHaveValue(question);
    await visibleAnswerSubmitButton(page).click();

    await expect(page.getByRole("button", { name: "Ask a question" })).toHaveCount(0);
    const questionBubble = page.getByTestId("user-question-bubble");
    await expect(questionBubble).toBeVisible();
    await expect(questionBubble).toContainText(question);

    const plainAnswer = page.getByTestId("plain-answer-response");
    await expect(plainAnswer).toBeVisible();
    await expect(plainAnswer).toContainText("synthetic clozapine table image highlights");
    await expect(plainAnswer.getByTestId("plain-answer-prose")).toBeVisible();
    await expect(page.getByText("Demo", { exact: true })).toHaveCount(0);
    await expect(plainAnswer.locator("ul, ol, li")).toHaveCount(0);
    await expect(plainAnswer.getByTestId("plain-answer-prose").locator("svg")).toHaveCount(0);
    const sourceCapsule = plainAnswer.getByRole("button", { name: "Open answer sources" });
    await expect(sourceCapsule).not.toContainText("Check sources");
    await expectMinTouchTarget(sourceCapsule);
    await sourceCapsule.click();
    const sourceSheet = page.getByRole("dialog", { name: "Sources" });
    await expect(sourceSheet).toBeVisible();
    const sourcePreview = page.getByTestId("source-capsule-preview");
    await expect(sourcePreview).toBeVisible();
    await expect(sourcePreview).toContainText("Best match");
    await expect(sourcePreview.getByTestId("source-capsule-preview-row")).toHaveCount(2);
    const firstPreviewSource = sourcePreview.getByTestId("source-capsule-preview-row").first();
    await expect(firstPreviewSource).toHaveAttribute("href", /\/documents\/.+chunk=/);
    await expectMinTouchTarget(firstPreviewSource);
    await expect(sourcePreview.getByRole("link", { name: /Open S1 source page/i })).toBeVisible();
    await expect(page.getByRole("dialog", { name: /PDF|document/i })).toHaveCount(0);
    const copyQuoteButton = sourcePreview.getByRole("button", { name: "Copy quote" });
    await expect(copyQuoteButton).toBeVisible();
    await expectMinTouchTarget(copyQuoteButton);
    if (browserName === "chromium") {
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
        origin: new URL(page.url()).origin,
      });
      await copyQuoteButton.click();
      await expect(sourcePreview.getByRole("button", { name: "Copied quote" })).toBeVisible();
    }
    await expectNoPageHorizontalOverflow(page);
    await page.keyboard.press("Escape");
    await expect(sourceSheet).toHaveCount(0);
    await expect(sourceCapsule).toBeFocused();
    if (browserName === "chromium") {
      const copyWithSources = plainAnswer.getByRole("button", { name: "Copy answer with source status" });
      await expect(copyWithSources).toBeVisible();
      await expectMinTouchTarget(copyWithSources);
      await copyWithSources.click();
      const copiedText = await page.evaluate(() => navigator.clipboard.readText());
      expect(copiedText).toContain("Clinical answer draft");
      expect(copiedText).toContain("Sources for review");
      expect(copiedText).toContain("/documents/");
    }
    await expect(plainAnswer.getByRole("button", { name: "More answer actions" })).toHaveCount(0);

    const supportCard = page.getByTestId("answer-support-card");
    await expect(supportCard).toBeVisible();
    await expect(supportCard).toContainText("Clinical notes");
    await expect(supportCard).toContainText("Evidence");
    await expect(supportCard).toContainText(/Safety findings|Priority|FBC\/ANC|Myocarditis|Metabolic/i);
    await expect(page.getByTestId("safety-findings-panel")).toHaveCount(0);

    const safetyFindingsTrigger = page.getByTestId("answer-safety-findings-trigger");
    if ((await safetyFindingsTrigger.count()) > 0) {
      await expectMinTouchTarget(safetyFindingsTrigger);
      await safetyFindingsTrigger.click();
      const safetyFindingsSheet = page.getByRole("dialog", { name: "Safety-critical source findings" });
      await expect(safetyFindingsSheet).toBeVisible();
      await expect(safetyFindingsSheet.getByTestId("safety-findings-panel")).toBeVisible();
      expect(await safetyFindingsSheet.getByTestId("safety-finding-row").count()).toBeGreaterThan(0);
      await safetyFindingsSheet.getByRole("button", { name: "Close safety findings" }).click();
      await expect(safetyFindingsSheet).toHaveCount(0);
      await expect(safetyFindingsTrigger).toBeFocused();
    }

    const clinicalTable = page.getByLabel("Inline table preview").first();
    await expect(clinicalTable).toBeVisible();
    await expect(clinicalTable.getByRole("table")).toBeVisible();
    await expect(clinicalTable).toContainText("FBC/ANC");
    await expect(clinicalTable).not.toContainText(/page|p\.|chunk|Synthetic clozapine monitoring protocol/i);
    const openTableSource = clinicalTable.getByRole("link", { name: "Open table source" });
    await expect(openTableSource).toBeVisible();
    await expectMinTouchTarget(openTableSource);
    await expect(clinicalTable.getByRole("button", { name: "Copy table preview" })).toHaveCount(0);
    await expect(clinicalTable.getByRole("button", { name: "More table actions" })).toHaveCount(0);
    const tableExpandButton = clinicalTable.getByTestId("table-expand-button");
    await expect(clinicalTable.getByTestId("accessible-table-surface")).toBeVisible();
    await page.keyboard.press("Escape");
    const tableDialog = await openMobileTableFullscreen(page, clinicalTable);
    await expect(tableDialog.getByRole("table")).toBeVisible();
    await expect(tableDialog).toContainText("FBC/ANC");
    await expect(tableDialog).not.toContainText(/page|p\.|chunk|Synthetic clozapine monitoring protocol/i);
    await expectNoPageHorizontalOverflow(page);
    await page.keyboard.press("Escape");
    await expect(tableDialog).toBeHidden();
    if (await tableExpandButton.isVisible().catch(() => false)) {
      await expect(tableExpandButton).toBeFocused();
    } else {
      await expect(clinicalTable.getByTestId("accessible-table-surface")).toBeFocused();
    }
    if (await tableExpandButton.isVisible().catch(() => false)) {
      await scrollMobileTableExpandClearOfFooter(page, clinicalTable);
      await tableExpandButton.click();
      await expect(tableDialog).toBeVisible();
      await tableDialog.getByRole("button", { name: "Close full-screen table" }).click();
      await expect(tableDialog).toBeHidden();
      await expect(tableExpandButton).toBeFocused();
    }
    await expect(page.locator("#answer-more-detail-drawer")).toHaveCount(0);
    await expect(page.getByTestId("raw-answer-narrative")).toHaveCount(0);
    await expect(page.getByText("Source narrative")).toHaveCount(0);
    await expect(page.getByText("Quality feedback")).toHaveCount(0);
    await expect(page.getByTestId("smart-follow-up-chips")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Compare sources" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Limit to local/current sources" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Search this document only" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Show exact quotes" })).toHaveCount(0);
    await expect(page.getByTestId("answer-top-source-chip")).toHaveCount(0);
    await expect(page.getByTestId("answer-grounding-chip")).toHaveCount(0);
    await expect(page.getByTestId("evidence-rail")).toHaveCount(0);
    await expect(page.getByTestId("evidence-summary-card")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Copy clinical draft" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Copy answer with citations" })).toHaveCount(0);
    await expect(page.getByTestId("answer-safety-notice")).toHaveCount(0);
    await expect(page.getByTestId("mobile-section-fab-button")).toHaveCount(0);
    await expect(page.getByTestId("mobile-section-fab-menu")).toHaveCount(0);
    await expectDomIntegrity(page, { mobileNav: true });

    const clinicalNotesTrigger = page.locator("#answer-clinical-notes-drawer-mobile-trigger");
    await expect(clinicalNotesTrigger).toBeVisible();
    await expect(clinicalNotesTrigger).toContainText("Clinical notes");
    await expect(clinicalNotesTrigger).toContainText(/notes?/i);
    await expectMinTouchTarget(clinicalNotesTrigger);
    await clinicalNotesTrigger.click();
    const clinicalNotesSheet = page.getByRole("dialog", { name: "Clinical notes" });
    await expect(clinicalNotesSheet).toBeVisible();
    await expect(clinicalNotesSheet.getByTestId("clinical-notes-checklist")).toBeVisible();
    await expect(clinicalNotesSheet.getByRole("tab", { name: /Essentials/ })).toBeVisible();
    await expect(clinicalNotesSheet.getByRole("tab", { name: /Actions/ })).toBeVisible();
    await expect(clinicalNotesSheet.getByRole("tab", { name: /Safety/ })).toBeVisible();
    expect(await clinicalNotesSheet.getByTestId("clinical-note-row").count()).toBeGreaterThan(0);
    const linkedNoteRow = clinicalNotesSheet.getByTestId("clinical-note-row").first();
    await expect(linkedNoteRow).toHaveAttribute("href", /\/documents\//);
    await expect(clinicalNotesSheet.getByText("Review toxicity symptoms", { exact: true })).toBeVisible();
    await tapOutsideActiveSurface(page);
    await expect(clinicalNotesSheet).toHaveCount(0);

    const evidenceDrawer = page.locator("#answer-evidence-drawer-mobile-trigger");
    await expect(evidenceDrawer).toBeVisible();
    await expect(evidenceDrawer).toContainText("Evidence");
    await expect(evidenceDrawer).toContainText(/claims?/i);
    await expect(evidenceDrawer).toContainText(/quotes?/i);
    await expect(page.getByTestId("evidence-support-panel")).toHaveCount(0);

    const hierarchy = await page.evaluate(() => {
      const question = document.querySelector('[data-testid="user-question-bubble"]');
      const plainAnswer = document.querySelector('[data-testid="plain-answer-response"]');
      const support = document.querySelector('[data-testid="answer-support-card"]');
      const table = document.querySelector('[aria-label="Inline table preview"]');
      return {
        questionTop: question?.getBoundingClientRect().top ?? 9999,
        plainAnswerTop: plainAnswer?.getBoundingClientRect().top ?? 9999,
        supportTop: support?.getBoundingClientRect().top ?? 9999,
        tableTop: table?.getBoundingClientRect().top ?? 9999,
      };
    });
    expect(hierarchy.questionTop).toBeLessThan(hierarchy.plainAnswerTop);
    expect(hierarchy.plainAnswerTop).toBeLessThan(hierarchy.supportTop);
    expect(hierarchy.supportTop).toBeLessThan(hierarchy.tableTop);

    await evidenceDrawer.click();
    const evidenceSheet = page.getByRole("dialog", { name: "Evidence" });
    await expect(evidenceSheet).toBeVisible();
    await expect(evidenceSheet.getByTestId("mobile-evidence-tabs")).toBeVisible();
    const evidenceSheetOrder = await evidenceSheet.evaluate((element) => {
      const tabs = element.querySelector('[data-testid="mobile-evidence-tabs"]');
      const claims = element.querySelector('[data-testid="evidence-claims-panel"]');
      return {
        tabsTop: tabs?.getBoundingClientRect().top ?? 9999,
        claimsTop: claims?.getBoundingClientRect().top ?? 9999,
      };
    });
    expect(evidenceSheetOrder.tabsTop).toBeLessThan(evidenceSheetOrder.claimsTop);
    await expect(evidenceSheet.getByTestId("mobile-evidence-tab-claims")).toHaveAttribute("aria-selected", "true");
    await expect(evidenceSheet.getByTestId("mobile-evidence-panel-claims")).toBeVisible();
    await expectMinTouchTarget(evidenceSheet.getByTestId("mobile-evidence-tab-claims"));
    const sourcePanelLink = evidenceSheet
      .getByTestId("mobile-evidence-panel-claims")
      .getByTestId("evidence-map-open-source")
      .first();
    await expect(sourcePanelLink).toBeVisible();
    await expect(sourcePanelLink).toHaveAttribute("href", /\/documents\/.+chunk=/);
    await expectMinTouchTarget(sourcePanelLink);
    await evidenceSheet.getByTestId("mobile-evidence-tab-tables").click();
    await expect(evidenceSheet.getByTestId("mobile-evidence-panel-tables")).toBeVisible();
    await expectMinTouchTarget(evidenceSheet.getByTestId("mobile-evidence-tab-tables"));
    const gapsTab = evidenceSheet.getByTestId("mobile-evidence-tab-gaps");
    if (await gapsTab.count()) {
      await gapsTab.click();
      await expect(evidenceSheet.getByTestId("mobile-evidence-panel-gaps")).toBeVisible();
      await expectMinTouchTarget(gapsTab);
    }
    await expect(page.locator('[data-testid="evidence-support-panel"]:visible')).toHaveCount(0);

    await expect(page.getByTestId("answer-section-heading")).toHaveText("Answer");
    await expect(page.getByTestId("answer-header-actions")).toHaveCount(0);

    await expect(page.getByText("Top source detail")).toHaveCount(0);
    await expect(page.getByText("Retrieval details")).toHaveCount(0);
    await tapOutsideActiveSurface(page);
    await expect(evidenceSheet).toHaveCount(0);
    await expect(evidenceDrawer).toBeFocused();

    await openScopeControl(page);
    const scopePopover = page.getByTestId("scope-command-popover");
    await expect(scopePopover).toBeVisible();
    const scopeFilter = scopePopover.locator('[data-testid="document-scope-filter"]');
    await expect(scopeFilter).toBeVisible();
    await expect(scopeFilter).toBeFocused();
    await scopeFilter.fill("lithium");
    await expect(scopePopover).toContainText(/match(?:es)?|No documents match/);
    await expect(scopePopover.getByRole("button", { name: "All documents" })).toBeVisible();
    const popoverMetrics = await scopePopover.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        height: element.getBoundingClientRect().height,
        maxHeight: style.maxHeight,
        overflowY: style.overflowY,
        viewportHeight: window.innerHeight,
      };
    });
    expect(popoverMetrics.overflowY).toBe("auto");
    expect(popoverMetrics.maxHeight).not.toBe("none");
    expect(popoverMetrics.height).toBeLessThanOrEqual(Math.ceil(popoverMetrics.viewportHeight * 0.72));
    await page.keyboard.press("Escape");
    await expect(scopePopover).toBeHidden();
    await expect(async () => {
      await expect(page.getByRole("button", { name: "Open answer options" })).toBeFocused();
    }).toPass({ timeout: 5_000 });
    await expectNoPageHorizontalOverflow(page);
  });

  test("answer failure offers a retry action that re-runs the question", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const answerRequests: string[] = [];
    let answerMode: "error" | "ok" = "error";
    await mockDemoApi(page);
    // Override the answer route so the first attempt fails (non-retryable), then
    // succeeds once the user taps Retry. Registered after mockDemoApi so it wins.
    await page.route(/\/api\/answer(?:\/stream)?(?:\?.*)?$/, async (route) => {
      const body = route.request().postDataJSON() as { query?: string; documentId?: string; documentIds?: string[] };
      answerRequests.push(body.query ?? "");
      if (answerMode === "error") {
        await route.fulfill({
          body: `event: error\ndata: ${JSON.stringify({ error: "Answer generation failed for this question.", status: 400 })}\n\n`,
          contentType: "text/event-stream; charset=utf-8",
          headers: { "Cache-Control": "no-cache, no-transform" },
        });
        return;
      }
      await fulfillAnswerResponse(route, {
        ...demoAnswer(body.query ?? "", body.documentId, body.documentIds),
        demoMode: true,
      });
    });
    await gotoApp(page, "/");
    await waitForDemoDashboardReady(page);

    await fillVisibleQuestionInput(page, "What lithium monitoring is required?");
    await visibleAnswerSubmitButton(page).click();

    const retry = page.getByTestId("answer-error-retry");
    await expect(retry).toBeVisible();
    await expect(page.getByTestId("answer-error")).toContainText("Answer generation failed for this question.");
    await expect(page.getByTestId("answer-error-search-documents")).toBeVisible();
    const requestsBeforeRetry = answerRequests.length;

    answerMode = "ok";
    await retry.click();

    await expect(page.getByTestId("plain-answer-response")).toBeVisible();
    await expect(page.getByTestId("answer-error-retry")).toHaveCount(0);
    expect(answerRequests.length).toBeGreaterThan(requestsBeforeRetry);
    await expectNoPageHorizontalOverflow(page);
  });

  test("answer with no usable results shows a calm recovery panel, not an error alert", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockDemoApi(page, {
      // Empty answer text makes the payload unusable, which the executor surfaces
      // as the "No usable results were found." 404 sentinel.
      answerOverride: (query, documentId, documentIds) => ({
        ...demoAnswer(query, documentId, documentIds),
        answer: "",
      }),
    });
    await gotoApp(page, "/");
    await waitForDemoDashboardReady(page);

    await fillVisibleQuestionInput(page, "A question with no indexed match at all");
    await visibleAnswerSubmitButton(page).click();

    const panel = page.getByTestId("answer-no-results");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("No answer for that yet");
    await expect(page.getByTestId("answer-no-results-rephrase")).toBeVisible();
    await expect(page.getByTestId("answer-no-results-search-documents")).toBeVisible();
    // A calm status panel, never the alarming red error banner.
    await expect(page.getByTestId("answer-error")).toHaveCount(0);
    await expectNoPageHorizontalOverflow(page);
  });

  test("recent searches appear on the answer home and re-run on tap", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const answerRequests: string[] = [];
    await mockDemoApi(page, { onAnswerRequest: (query) => answerRequests.push(query) });
    const recent = "clozapine monitoring schedule";
    // Seed persisted recent queries before the app loads (key mirrors
    // `recentQueryStorageKey` in ClinicalDashboard.tsx).
    await page.addInitScript((value) => {
      window.localStorage.setItem("clinical-kb-recent-queries", JSON.stringify([value]));
    }, recent);
    await gotoApp(page, "/");
    await waitForDemoDashboardReady(page);

    const recentChips = page.getByTestId("answer-recent-queries");
    await expect(recentChips).toBeVisible();
    await expect(recentChips).toContainText("Recent searches");
    const chip = recentChips.getByRole("button", { name: recent });
    await expect(chip).toBeVisible();
    await chip.click();

    await expect(page.getByTestId("plain-answer-response")).toBeVisible();
    expect(answerRequests).toContain(recent);
    await expectNoPageHorizontalOverflow(page);
  });

  test("answer search URL opens chat without the answer home copy", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 820 });
    const answerRequests: string[] = [];
    const question = "What clozapine monitoring items are shown in the table image?";
    await mockDemoApi(page, {
      answerDelayMs: 1500,
      onAnswerRequest: (query) => answerRequests.push(query),
    });

    await page.goto(`/?mode=answer&q=${encodeURIComponent(question)}&focus=1&run=1`, { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("answer-empty-state")).toHaveCount(0);
    await expect(page.getByText("How can I help?", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Loading answer")).toBeVisible();
    await expect.poll(() => answerRequests[0]).toBe(question);

    const questionBubble = page.getByTestId("user-question-bubble");
    await expect(questionBubble).toBeVisible({ timeout: uiAssertionTimeoutMs });
    await expect(questionBubble).toContainText(question);
    await expect(page.getByTestId("plain-answer-response")).toContainText("synthetic clozapine table image highlights");
    await expect(visibleQuestionInput(page)).toHaveValue("");
    await expect(page.getByTestId("answer-empty-state")).toHaveCount(0);
    await expect(page.getByText("How can I help?", { exact: true })).toHaveCount(0);
    expect(answerRequests).toEqual([question]);
    await expectNoPageHorizontalOverflow(page);
  });

  test("answer results surface cross-mode quick links", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockDemoApi(page);
    const question = "What is the maximum dose of clozapine?";
    await page.goto(`/?mode=answer&q=${encodeURIComponent(question)}&run=1`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByTestId("plain-answer-response")).toBeVisible({ timeout: uiAssertionTimeoutMs });

    const answerSurface = page.locator('[data-dashboard-stage="answer-surface"]');
    const strip = answerSurface.getByTestId("cross-mode-links");
    await expect(strip).toBeVisible({ timeout: 15_000 });
    await expect(answerSurface.getByTestId("cross-mode-links")).toHaveCount(1);
    const rail = strip.getByTestId("cross-mode-links-rail");
    await expect(rail).toBeVisible();
    await expect(rail).toHaveClass(/md:flex/);
    await page.keyboard.press("Escape");
    await expect(strip.getByText("Medication", { exact: true })).toBeVisible();
    await expect(strip.getByRole("button", { name: "Search Clozapine in Medication" })).toBeVisible();

    const followUps = answerSurface.getByTestId("answer-follow-up-suggestions");
    if (await followUps.isVisible()) {
      const stripBox = await strip.boundingBox();
      const followUpBox = await followUps.boundingBox();
      expect(stripBox).toBeTruthy();
      expect(followUpBox).toBeTruthy();
      expect(stripBox!.y).toBeLessThan(followUpBox!.y);
    }

    const medicationLink = strip.getByRole("link", { name: "Clozapine", exact: true });
    await expect(medicationLink).toHaveAttribute("href", "/medications/clozapine");
    await medicationLink.click();
    await expect(page).toHaveURL(/\/medications\/clozapine/, { timeout: 15_000 });
    await expectNoPageHorizontalOverflow(page);
  });

  test("answer mode keeps prior turns visible for follow-up questions", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 820 });
    await mockDemoApi(page);
    await gotoApp(page, "/");
    await waitForDemoDashboardReady(page);

    const firstQuestion = "lithium dosing";
    await fillVisibleQuestionInput(page, firstQuestion);
    await visibleAnswerSubmitButton(page).click();

    await expect(page.getByTestId("plain-answer-response")).toHaveCount(1, { timeout: uiAssertionTimeoutMs });
    await expect(page.getByTestId("user-question-bubble")).toHaveCount(1);
    await expect(page.getByTestId("user-question-bubble").first()).toContainText(firstQuestion);
    await expect(visibleAnswerFollowUpSuggestions(page)).toBeVisible();

    const composer = visibleQuestionInput(page);
    await expect(composer).toHaveValue("");
    await expect(composer).toHaveAttribute("placeholder", "Ask a follow-up...");

    const followUp = "what about renal impairment?";
    await fillVisibleQuestionInput(page, followUp);
    await visibleAnswerSubmitButton(page).click();

    await expect(page.getByTestId("user-question-bubble")).toHaveCount(2, { timeout: uiAssertionTimeoutMs });
    await expect(page.getByTestId("user-question-bubble").first()).toContainText(firstQuestion);
    await expect(page.getByTestId("user-question-bubble").nth(1)).toContainText(followUp);
    await expect(page.getByTestId("plain-answer-response")).toHaveCount(1);
    await expect(page.locator('[data-dashboard-stage="answer-thread-turn"][data-collapsed="true"]')).toHaveCount(1);
    await expect(composer).toHaveValue("");
    await expect(page).toHaveURL(/\?mode=answer&q=what\+about\+renal\+impairment\%3F&run=1/);
    await expectNoPageHorizontalOverflow(page);

    await waitForPersistedAnswerThread(page, 1);
    await page.reload();
    await waitForDemoDashboardReady(page);
    await expect(async () => {
      await expect(page.getByTestId("user-question-bubble")).toHaveCount(2);
    }).toPass({ timeout: 15_000 });
    await expect(page.getByTestId("user-question-bubble").first()).toContainText(firstQuestion);
    await expect(page.getByTestId("user-question-bubble").nth(1)).toContainText(followUp);
    await expect(page.locator('[data-dashboard-stage="answer-thread-turn"][data-collapsed="true"]')).toHaveCount(1);
  });

  test("answer follow-up suggestions run the next question", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 820 });
    await mockDemoApi(page);
    await gotoApp(page, "/");
    await waitForDemoDashboardReady(page);

    await fillVisibleQuestionInput(page, "lithium dosing");
    await visibleAnswerSubmitButton(page).click();
    await expect(visibleAnswerFollowUpSuggestions(page)).toBeVisible({ timeout: uiAssertionTimeoutMs });

    const suggestion = visibleAnswerFollowUpSuggestions(page).getByRole("button").first();
    const suggestionText = (await suggestion.textContent())?.trim();
    expect(suggestionText).toBeTruthy();
    await suggestion.click();

    await expect(page.getByTestId("user-question-bubble")).toHaveCount(2, { timeout: uiAssertionTimeoutMs });
    await expect(page.getByTestId("user-question-bubble").nth(1)).toContainText(suggestionText ?? "");
  });

  test("quote follow-up stages a composer draft from evidence quotes", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 820 });
    await mockDemoApi(page);
    await gotoApp(page, "/");
    await waitForDemoDashboardReady(page);

    const question = "What clozapine monitoring items are shown in the table image?";
    await fillVisibleQuestionInput(page, question);
    await visibleAnswerSubmitButton(page).click();
    await expect(page.getByTestId("plain-answer-response")).toBeVisible({ timeout: uiAssertionTimeoutMs });

    const evidenceDrawer = page.locator("#answer-evidence-drawer-mobile-trigger");
    await expect(evidenceDrawer).toBeVisible();
    await evidenceDrawer.click();

    const evidenceSheet = page.getByRole("dialog", { name: "Evidence" });
    await expect(evidenceSheet).toBeVisible();
    await evidenceSheet.getByRole("tab", { name: /Quotes/i }).click();
    await expect(evidenceSheet.getByRole("tabpanel", { name: /Quotes/i })).toBeVisible();

    const followUpButton = evidenceSheet.getByRole("button", { name: /Ask a follow-up from quote/i }).first();
    await expect(followUpButton).toBeVisible();
    await followUpButton.click();

    const composer = visibleQuestionInput(page);
    await expect(composer).toBeFocused();
    await expect(composer).toHaveValue(/Using the quoted source from/i);
    await expect(composer).toHaveValue(/Quote:/i);
    await expect(visibleAnswerSubmitButton(page)).toBeEnabled();
  });

  test("source-only answer keeps support rows honest", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 820 });
    await mockDemoApi(page, {
      answerOverride: (query, documentId, documentIds) => {
        const base = demoAnswer(query, documentId, documentIds);
        return {
          ...base,
          answer:
            "I found source material, but the generated answer included clinical numbers that could not be matched verbatim to its cited source chunks. Review the sources directly before using this for dose, threshold, route, timing, monitoring, or risk decisions.",
          grounded: false,
          confidence: "low",
          answerQualityTier: "source_only",
          fallbackReason: "source_only_no_api",
          citations: [],
          answerSections: [],
          quoteCards: [],
          visualEvidence: [],
        };
      },
    });
    await gotoApp(page, "/");
    await waitForDemoDashboardReady(page);

    await fillVisibleQuestionInput(page, "lithium");
    await visibleAnswerSubmitButton(page).click();

    const sourceOnlyDisclosure = page.getByTestId("source-only-disclosure");
    await expect(sourceOnlyDisclosure).toBeVisible();
    await expect(sourceOnlyDisclosure).toContainText("Source-only");
    await expect(sourceOnlyDisclosure).toContainText("verify passages");
    await expect(sourceOnlyDisclosure).not.toContainText("without the AI model");
    await sourceOnlyDisclosure.getByRole("button", { name: /Source-only/ }).click();
    await expect(sourceOnlyDisclosure).toContainText("without the AI model");

    const supportCard = page.getByTestId("answer-support-card");
    await expect(supportCard).toBeVisible();
    await expect(supportCard).toContainText("Review source match");
    await expect(supportCard).toContainText("Verify cited passages");
    await expect(supportCard).toContainText("Clinical notes");
    await expect(supportCard.getByTestId("answer-evidence-trigger")).toContainText(/sources?|claims?/i);
    await expect(supportCard.getByTestId("answer-evidence-trigger")).not.toContainText("0 claims");

    const clinicalTrigger = page.locator("#answer-clinical-notes-drawer-mobile-trigger");
    await expect(clinicalTrigger).toBeVisible();
    await clinicalTrigger.click();
    const clinicalNotesSheet = page.getByRole("dialog", { name: "Clinical notes" });
    await expect(clinicalNotesSheet).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(clinicalNotesSheet).toHaveCount(0);

    await supportCard.getByTestId("answer-evidence-trigger").click();
    const evidenceSheet = page.getByRole("dialog", { name: "Evidence" });
    await expect(evidenceSheet).toBeVisible();
    await expect(evidenceSheet.getByTestId("mobile-evidence-tabs")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(evidenceSheet).toHaveCount(0);
    await expectNoPageHorizontalOverflow(page);
  });

  for (const viewport of [
    { name: "phone", width: 390, height: 820, sheet: true },
    { name: "tablet", width: 768, height: 1024, sheet: true },
    { name: "near sheet breakpoint", width: 1018, height: 900, sheet: true },
    { name: "desktop", width: 1440, height: 900, sheet: false },
  ] as const) {
    test(`answer support popups adapt at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await mockDemoApi(page);
      await gotoApp(page, "/");
      await waitForDemoDashboardReady(page);

      await fillVisibleQuestionInput(page, "What clozapine monitoring items are shown in the table image?");
      await visibleAnswerSubmitButton(page).click();

      const plainAnswer = page.getByTestId("plain-answer-response");
      await expect(plainAnswer).toBeVisible();
      const supportCard = page.getByTestId("answer-support-card");
      await expect(supportCard).toBeVisible();
      await expectNoPageHorizontalOverflow(page);

      const sourceCapsule = plainAnswer.getByRole("button", { name: "Open answer sources" });
      await expectMinTouchTarget(sourceCapsule);
      await sourceCapsule.click();
      const sourceSurface = page.getByRole("dialog", { name: "Sources" });
      await expect(sourceSurface).toBeVisible();
      await expect(sourceSurface.getByTestId("source-capsule-preview-row").first()).toHaveAttribute(
        "href",
        /\/documents\/.+chunk=/,
      );
      await expectMinTouchTarget(sourceSurface.getByTestId("source-capsule-preview-row").first());
      await page.keyboard.press("Escape");
      await expect(sourceSurface).toHaveCount(0);
      await expect(sourceCapsule).toBeFocused();
      if (!viewport.sheet) {
        await sourceCapsule.click();
        await expect(sourceSurface).toBeVisible();
        await sourceCapsule.click();
        await expect(sourceSurface).toHaveCount(0);
      }

      const clinicalTrigger = page.locator("#answer-clinical-notes-drawer-mobile-trigger");
      await expectMinTouchTarget(clinicalTrigger);
      await clinicalTrigger.click();
      const clinicalSurface = page.getByRole("dialog", { name: "Clinical notes" });
      await expect(clinicalSurface).toBeVisible();
      await expect(clinicalSurface.getByTestId("clinical-notes-checklist")).toBeVisible();
      await expect(clinicalSurface.getByRole("tab", { name: /Actions/ })).toBeVisible();
      await expectMinTouchTarget(clinicalSurface.getByRole("link", { name: /^Source$/ }).first());
      const clinicalCopy = clinicalSurface.getByRole("button", { name: /^(Copy|Copied)$/ }).first();
      await expectMinTouchTarget(clinicalCopy);
      await clinicalCopy.click();
      await page.keyboard.press("Escape");
      await expect(clinicalSurface).toHaveCount(0);
      await expect(clinicalTrigger).toBeVisible();

      const evidenceTrigger = page.locator("#answer-evidence-drawer-mobile-trigger");
      await expectMinTouchTarget(evidenceTrigger);
      await evidenceTrigger.click();
      const evidenceSurface = page.getByRole("dialog", { name: "Evidence" });
      await expect(evidenceSurface).toBeVisible();
      await expect(evidenceSurface.getByTestId("mobile-evidence-tab-claims")).toHaveAttribute("aria-selected", "true");
      await expect(evidenceSurface.getByTestId("mobile-evidence-panel-claims")).toBeVisible();
      await expect(evidenceSurface.getByTestId("evidence-claims-panel")).toBeVisible();
      await expectMinTouchTarget(evidenceSurface.getByRole("link", { name: /^Source$/ }).first());
      const evidenceCopy = evidenceSurface.getByRole("button", { name: /^(Copy|Copied)$/ }).last();
      await expectMinTouchTarget(evidenceCopy);
      await evidenceCopy.click();
      const evidenceTablesTab = evidenceSurface.getByTestId("mobile-evidence-tab-tables");
      if (await evidenceTablesTab.count()) {
        await evidenceTablesTab.click();
        await expect(evidenceSurface.getByTestId("mobile-evidence-panel-tables")).toBeVisible();
        await expectMinTouchTarget(evidenceTablesTab);
      }
      await page.keyboard.press("Escape");
      await expect(evidenceSurface).toHaveCount(0);
      await expect(evidenceTrigger).toBeFocused();

      await expectNoPageHorizontalOverflow(page);
    });
  }

  for (const viewport of [
    { name: "390px mobile", width: 390, height: 820, expands: true },
    { name: "768px tablet", width: 768, height: 1024, expands: true },
    { name: "1440px desktop", width: 1440, height: 900, expands: false },
  ] as const) {
    test(`clinical table mobile expansion at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await mockDemoApi(page);
      await gotoApp(page, "/");
      await waitForDemoDashboardReady(page);

      await fillVisibleQuestionInput(page, "What clozapine monitoring items are shown in the table image?");
      const submitAnswer = visibleAnswerSubmitButton(page);
      await submitAnswer.click();

      const clinicalTable = page.getByLabel("Inline table preview").first();
      await expect(clinicalTable).toBeVisible();
      await expect(clinicalTable).toContainText("FBC/ANC");
      await expect(clinicalTable).not.toContainText(/page|p\.|chunk|Synthetic clozapine monitoring protocol/i);

      const expandButton = clinicalTable.getByTestId("table-expand-button");
      if (!viewport.expands) {
        await expect(page.getByRole("button", { name: "Open answer sources" })).toContainText(/sources?/i);
        await expect(page.getByTestId("table-specific-answer-layout")).toHaveAttribute(
          "data-desktop-table-aside",
          "true",
        );
        const desktopLayout = await page.evaluate(() => {
          const answer = document.querySelector('[data-testid="plain-answer-response"]');
          const support = document.querySelector('[data-testid="answer-support-card"]');
          const table = document.querySelector('[aria-label="Inline table preview"]');
          const answerRect = answer?.getBoundingClientRect();
          const supportRect = support?.getBoundingClientRect();
          const tableRect = table?.getBoundingClientRect();
          return {
            answerRight: answerRect?.right ?? 0,
            answerTop: answerRect?.top ?? 9999,
            supportRight: supportRect?.right ?? 0,
            tableLeft: tableRect?.left ?? 0,
            tableTop: tableRect?.top ?? 9999,
          };
        });
        expect(desktopLayout.tableLeft).toBeGreaterThan(
          Math.max(desktopLayout.answerRight, desktopLayout.supportRight),
        );
        expect(Math.abs(desktopLayout.tableTop - desktopLayout.answerTop)).toBeLessThan(180);
        await expect(expandButton).toHaveCount(0);
        await expectNoPageHorizontalOverflow(page);
        return;
      }

      await page.keyboard.press("Escape");
      const surfaceDialog = await openMobileTableFullscreen(page, clinicalTable);
      await expect(surfaceDialog).toContainText("FBC/ANC");
      await page.keyboard.press("Escape");
      await expect(surfaceDialog).toBeHidden();

      await expect(expandButton).toBeVisible();
      await scrollMobileTableExpandClearOfFooter(page, clinicalTable);
      await expandButton.click();
      const dialog = page.getByTestId("table-fullscreen-dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("table")).toBeVisible();
      await expect(dialog).toContainText("FBC/ANC");
      await expect(dialog).not.toContainText(/page|p\.|chunk|Synthetic clozapine monitoring protocol/i);
      await expectNoPageHorizontalOverflow(page);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(expandButton).toBeFocused();
    });
  }

  test("dashboard favourites mode param redirects to the standalone favourites route", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockDemoApi(page);
    await gotoApp(page, "/?mode=favourites&q=lithium%20set&focus=1");

    await expect(page).toHaveURL(/\/favourites\?q=lithium\+set&focus=1$/);
    await expect(page.getByTestId("favourites-hub")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Favourites command library" })).toBeVisible();
  });

  test("dashboard differentials mode param redirects to the standalone differentials route", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockDemoApi(page);
    await gotoApp(page, "/?mode=differentials&q=acute+confusion&focus=1");

    await expect(page).toHaveURL(/\/differentials\?q=acute\+confusion&focus=1$/);
    await expect(page.getByTestId("differentials-home")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Differentials" })).toBeVisible();
  });

  test("submitted differentials searches stay on the standalone differentials route", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockDemoApi(page);
    await gotoApp(page, "/differentials?q=acute+confusion&focus=1&run=1");

    await expect(page.getByTestId("differentials-search-results")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Mode Differentials" })).toBeVisible();
    await expect(page.getByTestId("differentials-home")).toHaveCount(0);
  });

  test("newer routed differential context wins over an older response", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockDemoApi(page);
    let requestCount = 0;
    await page.route(/\/api\/search$/, async (route) => {
      requestCount += 1;
      const currentRequest = requestCount;
      if (currentRequest === 1) await new Promise((resolve) => setTimeout(resolve, 500));
      const sourceCount = currentRequest === 1 ? 2 : 1;
      await route
        .fulfill({
          json: {
            documentMatches: Array.from({ length: sourceCount }, (_, index) => ({
              document_id: `00000000-0000-4000-8000-00000000000${index}`,
              title: `${currentRequest === 1 ? "Older" : "Current"} source ${index + 1}`,
              file_name: `source-${index + 1}.pdf`,
              score: 0.9 - index * 0.1,
            })),
          },
        })
        .catch(() => undefined);
    });

    await page.goto("/differentials?q=acute+confusion&run=1", { waitUntil: "domcontentloaded" });
    await expect.poll(() => requestCount).toBeGreaterThanOrEqual(1);
    const baselineRequestCount = requestCount;
    await page.evaluate(() => {
      window.history.pushState(null, "", "/differentials?q=acute+confusion&run=1&scope.sourceStatuses=outdated");
    });

    await expect.poll(() => requestCount).toBeGreaterThan(baselineRequestCount);
    const sourceStatus = page.getByRole("heading", { name: "Source status" }).locator("..");
    await expect(sourceStatus).toContainText("1 source");
    await page.waitForTimeout(600);
    await expect(sourceStatus).toContainText("1 source");
    await expect(sourceStatus).not.toContainText("2 sources");
  });

  test("submitted favourites searches stay on the command library route", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockDemoApi(page);
    await gotoApp(page, "/favourites?q=lithium%20set&focus=1&run=1");

    await expect(page.getByTestId("favourites-hub")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Favourites command library" })).toBeVisible();
    await expect(page.getByTestId("favourites-active-filters")).toBeVisible();
  });

  test("favourites route opens the favourites home", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockDemoApi(page);
    await gotoApp(page, "/favourites?q=lithium%20set");

    const globalSearchInput = page.getByRole("combobox", { name: /Search saved favourites/ });
    await expect(page.getByRole("button", { name: "Mode Favourites" })).toBeVisible();
    await expect(globalSearchInput).toBeVisible({ timeout: 30_000 });
    await expect(globalSearchInput).toHaveAttribute("placeholder", "Search favourites...");
    await expect(globalSearchInput).toHaveValue("lithium set");
    await expect(page.getByTestId("favourites-hub")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Favourites command library" })).toBeVisible();
    await expect(page.getByTestId("favourites-active-filters")).toBeVisible();

    await page.getByRole("button", { name: "Start a new chat" }).click();
    await expect(page).toHaveURL(/\?mode=answer&focus=1$/);
    await expect(page.getByRole("button", { name: "Mode Answer" })).toBeVisible();
    await expect(page.getByTestId("global-search-input")).toBeFocused();
  });

  test("favourites hub hydrates saved services from the registry", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockDemoApi(page);
    // mockDemoApi does not cover the registry list used for favourite hydration.
    await page.route(/\/api\/registry\/records(?:\?.*)?$/, async (route) => {
      await route.fulfill({
        json: {
          records: [{ slug: "13yarn", title: "13YARN", subtitle: "Crisis support line" }],
          total: 1,
          demoMode: true,
          governance: {},
        },
      });
    });
    await page.addInitScript(() => {
      window.localStorage.setItem("clinical-kb-saved-services", JSON.stringify(["13yarn"]));
    });
    await gotoApp(page, "/favourites");

    await expect(page.getByTestId("favourites-hub")).toBeVisible();
    // The saved service slug is hydrated to its registry title in the hub.
    await expect(page.getByTestId("favourites-hub").getByText("13YARN").first()).toBeVisible();
  });

  test("favourites command library opens item workspace on row selection at 2xl", async ({ page }) => {
    await page.setViewportSize({ width: 1536, height: 900 });
    await mockDemoApi(page);
    await gotoApp(page, "/favourites");

    await expect(page.getByRole("heading", { name: "Favourites command library" })).toBeVisible();
    await expect(page.getByTestId("favourites-item-workspace")).toHaveCount(0);

    await page.getByTestId("favourite-row-acamprosate-renal-screen").click();
    const workspace = page.getByTestId("favourites-item-workspace");
    await expect(workspace).toBeVisible();
    await expect(workspace.getByRole("heading", { name: "Acamprosate renal screen", level: 3 })).toBeVisible();
  });

  test("app mode menu supports keyboard navigation without removed prototype modes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockDemoApi(page);
    await gotoApp(page, "/?mode=answer");

    const appModeButton = page.getByRole("button", { name: "Mode Answer" });
    await appModeButton.click();
    const appModeMenu = page.getByRole("menu", { name: "Choose app mode" });
    await expect(appModeMenu).toBeVisible();
    const answerMode = appModeMenu.getByRole("menuitemradio", { name: /^Answer\b/ });
    await answerMode.focus();
    await expect(answerMode).toBeFocused();
    await expect(appModeMenu.getByRole("menuitemradio", { name: /^Evidence\b/ })).toHaveCount(0);
    await page.keyboard.press("ArrowDown");
    await expect(appModeMenu.getByRole("menuitemradio", { name: /^Documents\b/ })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(appModeMenu.getByRole("menuitemradio", { name: /^Services\b/ })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(appModeMenu.getByRole("menuitemradio", { name: /^Forms\b/ })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(appModeMenu.getByRole("menuitemradio", { name: /^Favourites\b/ })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(appModeMenu.getByRole("menuitemradio", { name: /^Differentials\b/ })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(appModeMenu.getByRole("menuitemradio", { name: /^Medication\b/ })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(appModeMenu.getByRole("menuitemradio", { name: /^Tools\b/ })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(appModeMenu).toBeHidden();
    await expect(appModeButton).toBeFocused();
  });

  test("prescribing workflow uses in-app medication routes @critical", async ({ page }) => {
    test.setTimeout(120_000);
    // Regression guard: navigating away from a mode home used to throw
    // "Cannot read properties of null (reading 'parentNode')" because the header
    // portaled its search composer straight into a page-owned slot that unmounts
    // on navigation. Narrowly scoped to that error so it won't trip on unrelated
    // console noise.
    const parentNodeErrors: string[] = [];
    page.on("pageerror", (error) => {
      if (String(error).includes("parentNode")) parentNodeErrors.push(String(error));
    });
    page.on("console", (message) => {
      if (message.type() === "error" && message.text().includes("parentNode")) parentNodeErrors.push(message.text());
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockDemoApi(page);
    await gotoCriticalApp(page, "/?mode=prescribing&q=acamprosate%20renal%20dose&run=1");

    const globalSearchInput = page.getByTestId("global-search-input");
    await expect(page.getByRole("button", { name: "Mode Medication" })).toBeVisible({ timeout: 30_000 });
    await expect(globalSearchInput).toHaveAttribute("placeholder", "Search medications...");
    await expect(globalSearchInput).toHaveValue("acamprosate renal dose");

    const acamprosateResult = page.getByTestId("medication-result-acamprosate-desktop");
    await expect(acamprosateResult).toHaveAttribute("href", "/medications/acamprosate");
    await acamprosateResult.click();
    await expect(page).toHaveURL(/\/medications\/acamprosate$/, { timeout: 30_000 });
    await expectSingleMedicationPage(page);

    await gotoCriticalApp(page, "/mockups/medication-prescribing");
    await expect(page).toHaveURL(/\/medications\/acamprosate$/);
    await expectSingleMedicationPage(page);
    expect(parentNodeErrors).toEqual([]);
  });

  test("prescribing workflow shows full mobile action text without horizontal cutoff", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockDemoApi(page);
    await gotoApp(page, "/?mode=prescribing&q=acamprosate%20renal%20dose&run=1");

    const acamprosateCard = page.getByTestId("medication-result-acamprosate-phone");
    await expect(acamprosateCard).toBeVisible({ timeout: 30_000 });
    await expect(acamprosateCard).toContainText("Contraindicated in renal insufficiency");
    await expect(acamprosateCard).toContainText("micromol/L");

    const actionOverflow = await acamprosateCard.evaluate((card) => {
      const action = Array.from(card.querySelectorAll("p")).find((node) =>
        node.textContent?.includes("Contraindicated in renal insufficiency"),
      );
      if (!action) return { found: false, overflows: true };
      return {
        found: true,
        overflows: action.scrollWidth > action.clientWidth + 1,
        textOverflow: getComputedStyle(action).textOverflow,
      };
    });
    expect(actionOverflow.found).toBe(true);
    expect(actionOverflow.overflows).toBe(false);
    expect(actionOverflow.textOverflow).not.toBe("ellipsis");
  });

  test("document search mode lists matching documents and scope actions", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 820 });
    await mockDemoApi(page);
    await gotoCriticalApp(page, "/");
    await waitForDemoDashboardReady(page);

    await switchToDocumentSearchMode(page);
    await expect(page.getByTestId("answer-section-heading")).toHaveText("Document matches");
    await expect(page.getByRole("button", { name: "Find matching documents" })).toBeDisabled();
    await expect(page.getByRole("main").getByRole("heading", { name: "Documents" })).toBeVisible();
    await expect(page.getByTestId("document-search-workspace")).toBeVisible();
    await expect(visibleQuestionInput(page)).toBeVisible();
    await expect(page.getByTestId("document-search-empty-state")).toBeVisible();
    await expect(page.getByRole("region", { name: "Start here" })).toBeVisible();
    const searchInputBox = await visibleQuestionInput(page).boundingBox();
    const startHereBox = await page.getByRole("region", { name: "Start here" }).boundingBox();
    const documentsHeadingBox = await page.getByRole("main").getByRole("heading", { name: "Documents" }).boundingBox();
    expect(searchInputBox).not.toBeNull();
    expect(startHereBox).not.toBeNull();
    expect(documentsHeadingBox).not.toBeNull();
    expect((documentsHeadingBox?.y ?? 0) + (documentsHeadingBox?.height ?? 0)).toBeLessThan(searchInputBox?.y ?? 0);
    expect(searchInputBox?.y ?? 0).toBeLessThan(startHereBox?.y ?? 0);
    const recentDocumentsButton = page.getByRole("button", { name: /Recent documents/i }).first();
    const browseLibraryButton = page.getByRole("button", { name: /Browse library/i }).first();
    const sourcePdfButton = page.getByRole("button", { name: /Open a source PDF/i }).first();
    await expect(recentDocumentsButton).toBeVisible();
    await expect(browseLibraryButton).toBeVisible();
    await expect(sourcePdfButton).toBeVisible();

    await recentDocumentsButton.click();
    const recentDocumentsDialog = page.getByRole("dialog", { name: "Recent documents" });
    await expect(recentDocumentsDialog).toBeVisible();
    await expect(recentDocumentsDialog.getByPlaceholder("Find a document")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(recentDocumentsDialog).toHaveCount(0);

    await browseLibraryButton.click();
    const sourceLibraryDialog = page.getByRole("dialog", { name: "Source library" });
    await expect(sourceLibraryDialog).toBeVisible();
    await expect(sourceLibraryDialog.getByPlaceholder("Find a document")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sourceLibraryDialog).toHaveCount(0);

    await sourcePdfButton.click();
    const sourcePdfDialog = page.getByRole("dialog", { name: "Source PDFs" });
    await expect(sourcePdfDialog).toBeVisible();
    await expect(sourcePdfDialog.getByPlaceholder("Find a source PDF")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sourcePdfDialog).toHaveCount(0);
    await expect(page.getByText("Source library workspace")).toHaveCount(0);
    await expect(page.getByText("Document display")).toHaveCount(0);

    const questionInput = visibleQuestionInput(page);
    await questionInput.fill("lithium monitoring");
    await page.getByRole("button", { name: "Find matching documents" }).click();

    await expect(page).toHaveURL(/\/documents\/search\?.*q=lithium\+monitoring/);
    await expect(page.getByRole("heading", { name: "Find source evidence" })).toBeVisible();
    const documentResults = page.getByRole("region", { name: "Document results" });
    await expect(documentResults).toContainText("Synthetic lithium monitoring protocol");
    await expect(documentResults).toContainText("Best match");
    await expect(documentResults).toContainText("Tables 1");
    await expect(documentResults.getByRole("link", { name: "Open document" }).first()).toBeVisible();
    await expect(page.getByRole("complementary").filter({ hasText: "Selected source" })).toHaveCount(0);
    await expectNoPageHorizontalOverflow(page);
  });

  test("tools mode searches the existing applications registry inside the dashboard", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockPrivateUnauthenticatedApi(page);
    await gotoApp(page, "/?mode=tools&q=medications&focus=1&run=1");

    await expect(page.getByRole("button", { name: "Mode Tools" })).toBeVisible();
    await expect(page.locator('input[placeholder="Search tools..."]:visible').first()).toHaveValue("medications");
    await expect(page.getByTestId("tools-hub")).toBeVisible();
    await expect(page.getByTestId("tools-hub").getByRole("heading", { name: "All tools" })).toBeVisible();
    await expect(page.getByTestId("tools-hub").getByTestId("application-row-medication-prescribing")).toContainText(
      "Medication Prescribing",
    );
    await expect(page.getByTestId("tools-hub").getByText("Selected tool")).toHaveCount(0);
    await expect(page.getByTestId("tools-hub").getByTestId("application-row-medication-prescribing")).toHaveAttribute(
      "href",
      "/?mode=prescribing",
    );
    await expectNoPageHorizontalOverflow(page);
  });

  test("search regressions avoid fetch errors and open viewer hits @critical", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockDemoApi(page);
    await gotoCriticalApp(page, "/");
    await waitForDemoDashboardReady(page);

    await switchToDocumentSearchMode(page);
    const questionInput = visibleQuestionInput(page);

    await questionInput.fill("what is the best coffee machine for my kitchen");
    await page.getByRole("button", { name: "Find matching documents" }).click();
    await expect(page).toHaveURL(/\/documents\/search\?/);
    await expect(page.locator("body")).not.toContainText(/failed to fetch|Search failed/i);
    await expect(page.getByRole("heading", { name: /Search command centre|Find source evidence/ })).toBeVisible();

    const demoDocId = "11111111-1111-4111-8111-111111111111";
    await gotoCriticalApp(page, `/documents/${demoDocId}?chunk=55555555-5555-4555-8555-555555555555`);
    await expect(page).toHaveURL(/chunk=55555555-5555-4555-8555-555555555555/);
    await expect(page.locator("#source-evidence").getByTestId("highlighted-source-passage")).toContainText(
      "Patient safety plan should include",
    );

    const sourceSearch = page.getByLabel("Search within indexed source text").last();
    await sourceSearch.fill("safety plan include");
    const desktopTextPanel = page.getByTestId("desktop-chunk-indexed-text-panel");
    await expect(desktopTextPanel.getByText("Hit 1 of 2").first()).toBeVisible();
    const previousHit = desktopTextPanel.getByRole("button", { name: "Previous document search hit" });
    const nextHit = desktopTextPanel.getByRole("button", { name: "Next document search hit" });
    await expect(previousHit).toHaveAttribute("title", "Previous document search hit");
    await expect(previousHit).toHaveText("");
    await expect(nextHit).toHaveAttribute("title", "Next document search hit");
    await expect(nextHit).toHaveText("");
    await nextHit.click();
    await expect(desktopTextPanel.getByText("Hit 2 of 2")).toBeVisible();
    await expect(desktopTextPanel.locator("mark").filter({ hasText: "safety" }).first()).toBeVisible();
    await expectNoPageHorizontalOverflow(page);
  });

  test("document viewer puts pinned evidence before the PDF preview on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await mockDemoApi(page);
    await gotoApp(
      page,
      "/documents/11111111-1111-4111-8111-111111111111?page=1&chunk=44444444-4444-4444-8444-444444444442",
    );

    const evidence = page.locator('[data-testid="pinned-source-evidence"]:visible').first();
    const preview = page.getByTestId("pdf-preview");
    const toolbar = page.getByTestId("pdf-toolbar");
    const pdfScroller = page.getByTestId("pdf-canvas-scroll");
    const viewerNav = page.getByRole("navigation", { name: "Document viewer sections" }).first();

    await expect(evidence).toBeVisible();
    await expect(evidence.getByText("Highlighted source passage")).toBeVisible();
    await expect(viewerNav.getByRole("link", { name: "Evidence" })).toBeVisible();
    await expect(viewerNav.getByRole("link", { name: "PDF" })).toBeVisible();
    await expect(viewerNav.getByRole("link", { name: "Text" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Synthetic lithium monitoring protocol" })).toBeVisible();
    await page.getByRole("button", { name: "Open document actions" }).first().click();
    const documentActions = page.getByRole("dialog", { name: "This document" });
    await expect(documentActions).toBeVisible();
    await tapOutsideActiveSurface(page);
    await expect(documentActions).toHaveCount(0);
    await expect(preview).toBeVisible();
    const switchToCanvasMode = page.getByRole("button", { name: "Switch to canvas zoom mode" });
    if ((await switchToCanvasMode.count()) > 0) {
      await switchToCanvasMode.click();
    }
    await expect(toolbar).toBeVisible({ timeout: 30000 });
    await expectDomIntegrity(page);

    const evidenceBox = await evidence.boundingBox();
    const previewBox = await preview.boundingBox();
    const indexedTextBox = await page.getByText("Indexed page text", { exact: true }).boundingBox();
    const imagesBox = await page.getByRole("heading", { name: "Tables and diagrams" }).boundingBox();

    expect(evidenceBox).not.toBeNull();
    expect(previewBox).not.toBeNull();
    expect(indexedTextBox).not.toBeNull();
    expect(imagesBox).not.toBeNull();
    expect(evidenceBox!.y).toBeLessThan(previewBox!.y);
    expect(evidenceBox!.height).toBeLessThan(640);
    expect(indexedTextBox!.y).toBeLessThan(previewBox!.y);
    expect(indexedTextBox!.y).toBeLessThan(imagesBox!.y);

    const passageToggle = page.getByTestId("toggle-full-passage").first();
    await expect(passageToggle).toHaveText("Show full passage");
    await passageToggle.click();
    await expect(passageToggle).toHaveText("Show passage preview");
    const expandedEvidenceBox = await evidence.boundingBox();
    expect(expandedEvidenceBox?.height ?? 0).toBeGreaterThan(evidenceBox!.height);
    await viewerNav.getByRole("link", { name: "PDF" }).click();
    await expect(preview).toBeInViewport();
    await viewerNav.getByRole("link", { name: "Text" }).click();
    await expect(page.getByText("Indexed page text", { exact: true })).toBeInViewport();
    await viewerNav.getByRole("link", { name: "PDF" }).click();
    await expect(preview).toBeInViewport();

    const mobilePdfStyles = await toolbar.evaluate((element) => ({
      position: window.getComputedStyle(element).position,
    }));
    expect(mobilePdfStyles.position).toBe("static");

    await expect(pdfScroller).toBeVisible();
    await page.getByRole("button", { name: "Fit page width and enter fullscreen" }).click();
    await expect(page.getByRole("button", { name: "Exit fullscreen document view" })).toBeVisible();
    const fullscreenRootStyles = await page.getByTestId("pdf-fullscreen-root").evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        position: style.position,
        height: style.height,
      };
    });
    expect(fullscreenRootStyles.position).toBe("fixed");
    await page.getByRole("button", { name: "Exit fullscreen document view" }).click();

    const fitWidthScrollStyles = await pdfScroller.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        overflowX: style.overflowX,
        touchAction: style.touchAction,
      };
    });
    expect(fitWidthScrollStyles.overflowX).toBe("hidden");
    expect(fitWidthScrollStyles.touchAction).toContain("pan-y");
    await expectNoPageHorizontalOverflow(page);
  });

  test("phone universal header fully hides while scrolling dashboard main on phones", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoApp(page, "/?mode=answer");

    const header = page.locator("header.universal-header");
    const collapseHost = page.getByTestId("universal-header-collapse");
    await expect(header).toBeVisible();
    await expect(collapseHost).not.toHaveAttribute("data-scroll-hidden", "true");
    await expect.poll(async () => header.evaluate((node) => window.getComputedStyle(node).position)).toBe("relative");

    const main = page.locator("main#main-content");
    await main.evaluate((node) => {
      const spacer = document.createElement("div");
      spacer.setAttribute("data-testid", "header-hide-scroll-spacer");
      spacer.style.height = "2000px";
      node.appendChild(spacer);
    });
    // Step scroll down so the dashboard main listener sees deliberate movement.
    for (const offset of [40, 80, 120, 160, 200]) {
      await main.evaluate((node, top) => {
        node.scrollTop = top;
      }, offset);
    }

    await expect(collapseHost).toHaveAttribute("data-scroll-hidden", "true");
    await expect
      .poll(async () =>
        header.evaluate((node) => {
          const rect = node.getBoundingClientRect();
          return Math.max(0, rect.bottom) - Math.max(0, rect.top);
        }),
      )
      .toBe(0);
  });

  test("document viewer bottom composer hides while scrolling down on phones", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockDemoApi(page);
    await gotoApp(
      page,
      "/documents/11111111-1111-4111-8111-111111111111?page=1&chunk=44444444-4444-4444-8444-444444444442",
    );

    await expect(page.getByRole("heading", { level: 1, name: "Synthetic lithium monitoring protocol" })).toBeVisible();
    const composer = page.locator("form.document-viewer-composer");
    await expect(composer).toBeVisible();
    await expect(composer).not.toHaveAttribute("data-scroll-hidden", "true");

    await page.evaluate(() => {
      const main = window.document.getElementById("main-content");
      const spacer = window.document.createElement("div");
      spacer.setAttribute("data-testid", "composer-hide-scroll-spacer");
      spacer.style.height = "2000px";
      (main ?? window.document.body).appendChild(spacer);
    });

    // Hide on deliberate scroll down past the activation offset.
    for (const offset of [40, 80, 120, 160, 200]) {
      await scrollPrimarySurface(page, offset);
    }
    await expect(composer).toHaveAttribute("data-scroll-hidden", "true");

    // Reappear on scroll up.
    await scrollPrimarySurface(page, 60);
    await expect(composer).not.toHaveAttribute("data-scroll-hidden", "true");

    // Keyboard focus inside the composer reveals it while hidden.
    await scrollPrimarySurface(page, 240);
    await expect(composer).toHaveAttribute("data-scroll-hidden", "true");
    await composer.locator("input").focus();
    await expect(composer).not.toHaveAttribute("data-scroll-hidden", "true");
  });

  test("document summary opens at the top with cleaned bold formatting", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 820 });
    await mockDemoApi(page);
    await gotoApp(
      page,
      "/documents/11111111-1111-4111-8111-111111111111?page=1&chunk=44444444-4444-4444-8444-444444444442",
    );

    await page
      .getByRole("button", { name: /^Answer from this(?: document)?$/ })
      .first()
      .click();

    const generatedSummary = page.getByTestId("generated-clinical-summary");
    await expect(generatedSummary).toBeVisible();
    await expect(generatedSummary).toContainText("clozapine monitoring requires regular FBC/ANC checks");
    await expect(generatedSummary).not.toContainText("Key practical points:");
    await expect(generatedSummary).not.toContainText("**");
    await expect(generatedSummary.locator("strong").filter({ hasText: "clozapine" })).toHaveCount(1);

    const summaryBox = await generatedSummary.boundingBox();
    const previewBox = await page.getByTestId("pdf-preview").boundingBox();
    expect(summaryBox).not.toBeNull();
    expect(previewBox).not.toBeNull();
    expect(summaryBox!.y).toBeLessThan(previewBox!.y);
    await expectNoPageHorizontalOverflow(page);
  });

  test("document viewer failed preview exposes retry recovery", async ({ page }) => {
    await page.route("**/api/setup-status**", async (route) => {
      await route.fulfill({ json: { demoMode: true, checks: readySetupChecks } });
    });
    await page.route(/\/api\/documents\/([^/]+)(?:\?.*)?$/, async (route) => {
      const url = new URL(route.request().url());
      const id = url.pathname.split("/").at(-1) ?? "";
      const payload = getDemoDocumentPayload(id, url.searchParams.get("chunk"));
      await route.fulfill({ json: { ...payload, demoMode: true } });
    });
    await page.route(/\/api\/documents\/[^/]+\/signed-url(?:\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 503,
        json: { error: "Source preview could not be loaded." },
      });
    });
    await page.setViewportSize({ width: 390, height: 820 });
    await gotoApp(
      page,
      "/documents/11111111-1111-4111-8111-111111111111?page=1&chunk=44444444-4444-4444-8444-444444444442",
    );

    await expect(page.getByTestId("pdf-preview").getByText("Source preview could not be loaded.")).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByRole("button", { name: "Retry preview" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Synthetic lithium monitoring protocol" })).toBeVisible();
    await expectDomIntegrity(page);
    await expectNoPageHorizontalOverflow(page);
  });

  test("document viewer private missing source state is coherent", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 820 });
    await mockPrivateUnauthenticatedApi(page);
    await page.route(/\/api\/documents\/[^/]+(?:\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 404,
        json: { error: "Document not found." },
      });
    });
    await page.route(/\/api\/documents\/[^/]+\/signed-url(?:\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 404,
        json: { error: "Document not found." },
      });
    });
    await gotoApp(
      page,
      "/documents/11111111-1111-4111-8111-111111111111?page=1&chunk=44444444-4444-4444-8444-444444444442",
    );

    await expect(page.getByRole("heading", { level: 1, name: /Sign in required|Source unavailable/ })).toBeVisible({
      timeout: 30000,
    });
    await expect(page.locator("body")).toContainText(
      /Sign in to open private source documents\.|Document not found\.|Supabase browser authentication is not configured for private source documents\./,
    );
    await expect(page.getByRole("button", { name: /^Answer from this(?: document)?$/ }).first()).toBeDisabled();
    await expect(page.locator("body")).not.toContainText("loading source");
    await expect(page.locator("body")).not.toContainText("Loading source metadata");
    await expectDomIntegrity(page);
    await expectNoPageHorizontalOverflow(page);
  });

  test("setup status endpoint returns non-secret checklist state", async ({ request }) => {
    const response = await request.get("/api/setup-status");
    expect(response.ok()).toBe(true);

    const payload = await response.json();
    expect(typeof payload.demoMode).toBe("boolean");
    expect(payload.checks).toHaveLength(6);
    expect(payload.checks.map((check: { id: string }) => check.id)).toEqual([
      "env",
      "project",
      "schema",
      "search",
      "openai",
      "worker",
    ]);
    expect(JSON.stringify(payload)).not.toMatch(/sk-|service_role|eyJ/i);
  });

  test("upload drawer exposes setup checklist and explicit upload labels", async ({ page, request }) => {
    await page.setViewportSize({ width: 414, height: 820 });
    await mockPrivateUnauthenticatedApi(page);
    // Upload availability depends on the checkout's env config: env-less servers run in
    // read-only demo mode while .env.local local-auth servers accept uploads. The browser
    // mocks above do not decide enablement, so read the real server flag and branch the
    // enablement assertions on it to keep this test green in both configurations.
    const setupStatusResponse = await request.get("/api/setup-status");
    expect(setupStatusResponse.ok()).toBe(true);
    const serverDemoMode = (await setupStatusResponse.json()).demoMode === true;

    await gotoApp(page, "/");
    await expect(visibleQuestionInput(page)).toBeVisible();

    const uploadDrawer = await openUploadDrawer(page);

    await uploadDrawer.getByRole("tab", { name: /Setup/ }).click();
    await expect(uploadDrawer.getByText("First-run setup checklist")).toBeVisible();
    await expect(uploadDrawer.getByText(".env.local configured")).toBeVisible();
    await expect(uploadDrawer.getByText("Clinical KB Database target")).toBeVisible();
    await expect(uploadDrawer.getByText("supabase/schema.sql applied")).toBeVisible();
    await expect(uploadDrawer.getByText("Search RPC and vector indexes")).toBeVisible();
    await expect(uploadDrawer.getByText("OpenAI API key available")).toBeVisible();
    await expect(uploadDrawer.getByText("npm run worker running")).toBeVisible();
    const uploadTab = uploadDrawer.getByRole("tab", { name: /Upload/ });
    await uploadTab.click();
    await expect(uploadDrawer.getByText("Clinical upload")).toBeVisible();
    await expect(uploadDrawer.getByText("Guideline PDF files")).toBeVisible();
    if (serverDemoMode) {
      await expect(uploadTab).toContainText("Locked");
      await expect(uploadDrawer.getByRole("button", { name: "Guideline PDF files" })).toBeDisabled();
    } else {
      await expect(uploadTab).toContainText("Ready");
      await expect(uploadDrawer.getByRole("button", { name: "Guideline PDF files" })).toBeEnabled();
    }
    await expect(uploadDrawer.getByRole("button", { name: "Upload guidelines" })).toBeVisible();
    await expectNoPageHorizontalOverflow(page);
  });

  test("upload drawer disables uploads in demo mode", async ({ page }) => {
    await page.setViewportSize({ width: 414, height: 820 });
    await mockDemoApi(page);
    await gotoApp(page, "/");

    const uploadDrawer = await openUploadDrawer(page);

    await uploadDrawer.getByRole("tab", { name: /Jobs/ }).click();
    await expect(uploadDrawer.getByText("Indexing progress")).toBeVisible();
    await uploadDrawer.getByRole("tab", { name: /Upload/ }).click();
    await expect(uploadDrawer.getByText("Read-only status")).toBeVisible();
    await expect(uploadDrawer.getByRole("button", { name: "Guideline PDF files" })).toBeDisabled();
    await expect(uploadDrawer.getByRole("button", { name: "Upload guidelines" })).toBeVisible();
    await expectNoPageHorizontalOverflow(page);
  });

  for (const viewport of [
    { name: "mobile", width: 390, height: 820 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1280, height: 900 },
  ]) {
    test(`guide opens and dismisses at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await mockPrivateUnauthenticatedApi(page);
      await gotoApp(page, "/");

      const dialog = await openGuide(page);
      await page.keyboard.press("Shift+Tab");
      expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
      await dialog.getByRole("button", { name: "Close guide" }).click();
      await expect(dialog).toBeHidden();

      const reopenedDialog = await openGuide(page);
      await tapOutsideActiveSurface(page);
      await expect(reopenedDialog).toBeHidden();
      await expectNoPageHorizontalOverflow(page);
    });
  }
});
