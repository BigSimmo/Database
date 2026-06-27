import type { Route } from "playwright-core";
import { expect, test, type Locator, type Page } from "playwright/test";
import { demoAnswer, demoDocuments, getDemoDocument, getDemoDocumentPayload } from "../src/lib/demo-data";

const dashboardViewports = [
  { name: "small-mobile", width: 320, height: 720 },
  { name: "standard-mobile", width: 375, height: 760 },
  { name: "large-mobile", width: 414, height: 820 },
  { name: "tablet", width: 768, height: 900 },
  { name: "laptop", width: 1280, height: 900 },
  { name: "mobile-landscape", width: 667, height: 375 },
] as const;

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

function visibleQuestionInput(page: Page) {
  return page.locator('[aria-label="Search indexed guidelines by question or keyword"]:visible').first();
}

async function isVisibleWithoutThrow(locator: Locator) {
  return locator.isVisible().catch(() => false);
}

async function fillVisibleQuestionInput(page: Page, value: string) {
  const questionInput = visibleQuestionInput(page);
  const submitAnswer = page.getByRole("button", { name: "Generate source-backed answer" });

  await expect(async () => {
    await expect(submitAnswer).toHaveAttribute("title", /Enter a clinical question|Generate a source-backed answer/, {
      timeout: 1_000,
    });
    await expect(questionInput).toBeEditable({ timeout: 1_000 });
    await questionInput.fill(value);
    await expect(questionInput).toHaveValue(value, { timeout: 1_000 });
    await expect(submitAnswer).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });

  return questionInput;
}

async function switchToDocumentSearchMode(page: Page) {
  const legacyDocumentsMode = page.getByRole("button", { name: "Switch to document search mode" });
  if (await isVisibleWithoutThrow(legacyDocumentsMode)) {
    await expect(legacyDocumentsMode).toBeEnabled();
    await expect(async () => {
      await legacyDocumentsMode.click();
      await expect(legacyDocumentsMode).toHaveAttribute("aria-pressed", "true", { timeout: 1_000 });
    }).toPass({ timeout: 8_000 });
    return;
  }

  const appModeMenu = page.getByRole("button", { name: /^Current app mode:/ });
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
    const appModeGroup = page.getByRole("group", { name: "Choose app mode" });
    await expect(appModeGroup).toBeVisible({ timeout: 2_000 });
    const documentsMode = appModeGroup.getByRole("button", { name: /^Documents\b/ });
    await expect(documentsMode).toBeVisible({ timeout: 3_000 });
    await documentsMode.click({ force: true });
    await expect(appModeMenu).toHaveAccessibleName("Current app mode: Documents", { timeout: 2_000 });
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

async function mockPrivateUnauthenticatedApi(page: Page) {
  await page.route(/\/api\/setup-status$/, async (route) => {
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

async function mockDemoApi(page: Page) {
  await page.route(/\/api\/setup-status$/, async (route) => {
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
  await page.route(/\/api\/ingestion\/jobs(?:\?.*)?$/, async (route) => {
    await route.fulfill({ json: { jobs: [], demoMode: true } });
  });
  await page.route(/\/api\/ingestion\/batches(?:\?.*)?$/, async (route) => {
    await route.fulfill({ json: { batches: [], demoMode: true } });
  });
  await page.route(/\/api\/answer(?:\/stream)?(?:\?.*)?$/, async (route) => {
    const body = route.request().postDataJSON() as {
      query?: string;
      documentId?: string;
      documentIds?: string[];
    };
    await fulfillAnswerResponse(route, {
      ...demoAnswer(body.query ?? "What monitoring is required?", body.documentId, body.documentIds),
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

// The document-scope control renders as two breakpoint-complementary triggers
// (a mobile sheet button and a desktop popover summary). Both share a stable
// data-testid; :visible resolves to whichever one applies at the current width.
function scopeTrigger(page: Page) {
  return page.locator('[data-testid="scope-trigger"]:visible');
}

async function expectMinTouchTarget(locator: Locator, minSize = 44) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  const measurementTolerance = 0.01;
  expect(box!.height + measurementTolerance).toBeGreaterThanOrEqual(minSize);
  expect(box!.width + measurementTolerance).toBeGreaterThanOrEqual(minSize);
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
  await expect(menu.getByText("Top tools", { exact: true })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Guide & help" })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Settings" })).toBeVisible();
  await expect(menu.getByText("Dr A. Khan")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Clinical KB guide" })).toHaveCount(0);
  await expectNoPageHorizontalOverflow(page);
  return menu;
}

async function waitForDemoDashboardReady(page: Page) {
  await expect(visibleQuestionInput(page)).toBeEnabled();
  await expect(scopeTrigger(page)).toBeVisible({ timeout: 30000 });
}

async function openGuide(page: Page) {
  const viewport = page.viewportSize();
  const trigger =
    viewport && viewport.width >= 1024 ? page.getByRole("button", { name: "Guide & help" }).first() : null;
  if (trigger) {
    await expect(trigger).toBeVisible();
    await trigger.click();
  } else {
    const menu = await openMobileClinicalGuideMenu(page);
    await menu.getByRole("button", { name: "Guide & help" }).click();
  }

  const dialog = page.getByRole("dialog", { name: "Clinical KB guide" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Ask and verify")).toBeVisible();
  await expect(dialog.getByText("Top source and citations")).toBeVisible();
  await expect(dialog.getByText("Upload and indexing")).toBeVisible();
  await expect(dialog.getByText("Copying text")).toBeVisible();
  await expectNoPageHorizontalOverflow(page);
  return dialog;
}

async function openUploadDrawer(page: Page) {
  const uploadButton = page.getByRole("button", { name: /Upload document/i });
  const uploadDrawer = page.getByRole("dialog", { name: "Upload and indexing" });
  await expect(uploadButton).toBeVisible();

  await expect(async () => {
    if (await uploadDrawer.isVisible().catch(() => false)) return;
    await uploadButton.click();
    await expect(uploadDrawer).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 8_000 });

  return uploadDrawer;
}

test.describe("Clinical KB UI smoke coverage", () => {
  test.describe.configure({ timeout: 60000 });

  for (const viewport of dashboardViewports) {
    test(`dashboard loads without page overflow at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await mockPrivateUnauthenticatedApi(page);
      await gotoApp(page, "/");

      await expect(page.getByRole("heading", { level: 1, name: "Clinical Guide" })).toHaveCount(1);
      await expect(page.getByRole("heading", { name: "Answer" })).toBeVisible();
      await expect(page.getByLabel("Search indexed guidelines by question or keyword")).toBeVisible();
      await expect(page.getByRole("button", { name: "Generate source-backed answer" })).toHaveText(/^\s*Ask\s*$/);
      const headerHeight = await page.locator("#search").evaluate((element) => element.getBoundingClientRect().height);
      expect(headerHeight).toBeLessThanOrEqual(viewport.width >= 640 ? 185 : 180);
      await expect(scopeTrigger(page)).toBeVisible();
      await expect(page.getByTestId("scope-command-popover")).toBeHidden();
      await expect(page.getByTestId("scope-prompts-drawer")).toHaveCount(0);
      await expect(page.getByTestId("mobile-scope-popover")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Ask a question" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Search documents" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Upload document" })).toBeVisible();
      await expectDomIntegrity(page, { mobileNav: viewport.width <= 768 });
      if (viewport.width <= 768) {
        await expect(page.getByTestId("mobile-section-fab-button")).toHaveCount(0);
      }
      if (viewport.width < 640) {
        const dailyActionsTrigger = page.getByRole("button", { name: "Open daily actions" });
        await dailyActionsTrigger.click();
        const dailyActions = page.getByRole("dialog", { name: "Daily actions" });
        await expect(dailyActions).toBeVisible();
        await expect(dailyActions.getByTestId("daily-actions-sheet")).toBeVisible();
        const addDocument = dailyActions.getByRole("button", { name: "Add document" });
        await expect(addDocument).toBeVisible();
        await expect(dailyActions.getByRole("button", { name: "Clinical tools" })).toBeVisible();
        await expectMinTouchTarget(addDocument);
        await expect(page.getByRole("dialog", { name: "Clinical KB guide" })).toHaveCount(0);
        await page.keyboard.press("Escape");
        await expect(dailyActions).toHaveCount(0);
        await expect(dailyActionsTrigger).toBeFocused();
      }
      await expectNoPageHorizontalOverflow(page);
    });
  }

  test("private mode unauthenticated dashboard gates real-mode search", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 820 });
    const answerRequests: string[] = [];
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
            safeLocalOrigin: false,
            requestOrigin: null,
            requestReferer: null,
            unsafeLocalCaller: "http://localhost:3000",
          },
        },
      });
    });
    await mockPrivateUnauthenticatedApi(page);
    await page.route(/\/api\/answer(?:\/stream)?(?:\?.*)?$/, async (route) => {
      answerRequests.push(route.request().url());
      await route.fulfill({ status: 401, json: { error: "Authentication required." } });
    });
    await gotoApp(page, "/");

    const questionInput = page.getByLabel("Search indexed guidelines by question or keyword");
    await questionInput.fill("lithium monitoring");
    await expect(page.getByRole("button", { name: "Generate source-backed answer" })).toBeDisabled();
    await expect(page.getByTestId("answer-grounding-chip")).toHaveCount(0);
    expect(answerRequests).toEqual([]);
    await expect(page.getByRole("heading", { level: 1, name: "Clinical Guide" })).toBeVisible();
    await expectDomIntegrity(page, { mobileNav: true, mobileFabReady: false });
    await expectNoPageHorizontalOverflow(page);
  });

  test("demo answer flow reaches a source-backed answer", async ({ browserName, page }) => {
    await page.setViewportSize({ width: 390, height: 820 });
    await mockDemoApi(page);
    await gotoApp(page, "/");
    await waitForDemoDashboardReady(page);

    const questionInput = page.getByLabel("Search indexed guidelines by question or keyword");
    await expect(questionInput).toBeEnabled();
    await expect(scopeTrigger(page)).toBeVisible();
    const question = "What clozapine monitoring items are shown in the table image?";
    await questionInput.click();
    await questionInput.pressSequentially(question);
    await expect(questionInput).toHaveValue(question);
    await expect(page.getByRole("button", { name: "Generate source-backed answer" })).toBeEnabled();
    await page.getByRole("button", { name: "Generate source-backed answer" }).click();

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
    const sourceSheet = page.getByRole("dialog", { name: "Sources behind this answer" });
    await expect(sourceSheet).toBeVisible();
    const sourcePreview = page.getByTestId("source-capsule-preview");
    await expect(sourcePreview).toBeVisible();
    await expect(sourcePreview).toContainText("Sources behind this answer");
    await expect(sourcePreview.getByTestId("source-capsule-preview-row")).toHaveCount(2);
    await expect(sourcePreview.getByRole("link", { name: /Open PDF drawer/i })).toBeVisible();
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
    await expectMinTouchTarget(plainAnswer.getByRole("button", { name: "More answer actions" }));

    const keyItems = page.getByLabel("Key monitoring items");
    await expect(keyItems).toBeVisible();
    await expect(keyItems).toContainText("FBC/ANC");
    await expect(keyItems).toContainText("Myocarditis");
    await expect(keyItems).toContainText("Metabolic");

    const clinicalTable = page.getByLabel("Inline table preview").first();
    await expect(clinicalTable).toBeVisible();
    await expect(clinicalTable.getByRole("table")).toBeVisible();
    await expect(clinicalTable).toContainText("FBC/ANC");
    await expect(clinicalTable).not.toContainText(/page|p\.|chunk|Synthetic clozapine monitoring protocol/i);
    const openTableSource = clinicalTable.getByRole("link", { name: "Open table source" });
    const copyTablePreview = clinicalTable.getByRole("button", { name: "Copy table preview" });
    const moreTableActions = clinicalTable.getByRole("button", { name: "More table actions" });
    await expect(openTableSource).toBeVisible();
    await expect(copyTablePreview).toBeVisible();
    await expect(moreTableActions).toBeVisible();
    await expectMinTouchTarget(openTableSource);
    await expectMinTouchTarget(copyTablePreview);
    await expectMinTouchTarget(moreTableActions);
    const tableExpandButton = clinicalTable.getByTestId("table-expand-button");
    await expect(tableExpandButton).toBeVisible();
    await expectMinTouchTarget(tableExpandButton);
    await tableExpandButton.click();
    const tableDialog = page.getByTestId("table-fullscreen-dialog");
    await expect(tableDialog).toBeVisible();
    await expect(tableDialog.getByRole("table")).toBeVisible();
    await expect(tableDialog).toContainText("FBC/ANC");
    await expect(tableDialog).not.toContainText(/page|p\.|chunk|Synthetic clozapine monitoring protocol/i);
    await expectNoPageHorizontalOverflow(page);
    await page.keyboard.press("Escape");
    await expect(tableDialog).toBeHidden();
    await expect(tableExpandButton).toBeFocused();
    await tableExpandButton.click();
    await expect(tableDialog).toBeVisible();
    await tableDialog.getByRole("button", { name: "Close full-screen table" }).click();
    await expect(tableDialog).toBeHidden();
    await expect(tableExpandButton).toBeFocused();
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

    const clinicalNotesDrawer = page.locator("details").filter({ hasText: "Clinical notes 1" }).first();
    const clinicalNotesSummary = clinicalNotesDrawer.locator("summary");
    await expect(clinicalNotesSummary.getByText("Safety notes", { exact: true })).toBeVisible();
    await expect(clinicalNotesSummary.getByText(/Monitoring, safety, escalation/)).toBeHidden();

    const evidenceDrawer = page.locator("#answer-evidence-drawer-mobile-trigger");
    await expect(evidenceDrawer).toBeVisible();
    await expect(evidenceDrawer).toContainText("Evidence");
    await expect(evidenceDrawer).toContainText(/sources?/i);
    await expect(evidenceDrawer).toContainText(/quotes?/i);
    await expect(page.getByTestId("evidence-support-panel")).toHaveCount(0);

    const hierarchy = await page.evaluate(() => {
      const question = document.querySelector('[data-testid="user-question-bubble"]');
      const plainAnswer = document.querySelector('[data-testid="plain-answer-response"]');
      const keyItems = document.querySelector('[aria-label="Key monitoring items"]');
      const table = document.querySelector('[aria-label="Inline table preview"]');
      const evidence = document.querySelector("#answer-evidence-drawer-mobile-trigger");
      return {
        questionTop: question?.getBoundingClientRect().top ?? 9999,
        plainAnswerTop: plainAnswer?.getBoundingClientRect().top ?? 9999,
        keyItemsTop: keyItems?.getBoundingClientRect().top ?? 9999,
        tableTop: table?.getBoundingClientRect().top ?? 9999,
        evidenceTop: evidence?.getBoundingClientRect().top ?? 9999,
      };
    });
    expect(hierarchy.questionTop).toBeLessThan(hierarchy.plainAnswerTop);
    expect(hierarchy.plainAnswerTop).toBeLessThan(hierarchy.keyItemsTop);
    expect(hierarchy.keyItemsTop).toBeLessThan(hierarchy.tableTop);
    expect(hierarchy.tableTop).toBeLessThan(hierarchy.evidenceTop);

    await evidenceDrawer.click();
    const evidenceSheet = page.getByRole("dialog", { name: "Evidence" });
    await expect(evidenceSheet).toBeVisible();
    await expect(evidenceSheet.getByTestId("mobile-evidence-tabs")).toBeVisible();
    const evidenceSheetOrder = await evidenceSheet.evaluate((element) => {
      const tabs = element.querySelector('[data-testid="mobile-evidence-tabs"]');
      const review = element.querySelector('[data-testid="answer-review-panel"]');
      return {
        tabsTop: tabs?.getBoundingClientRect().top ?? 9999,
        reviewTop: review?.getBoundingClientRect().top ?? 9999,
      };
    });
    expect(evidenceSheetOrder.tabsTop).toBeLessThan(evidenceSheetOrder.reviewTop);
    await expect(evidenceSheet.getByTestId("mobile-evidence-tab-tables")).toHaveAttribute("aria-selected", "true");
    await expect(evidenceSheet.getByTestId("mobile-evidence-panel-tables")).toBeVisible();
    await expectMinTouchTarget(evidenceSheet.getByTestId("mobile-evidence-tab-tables"));
    await evidenceSheet.getByTestId("mobile-evidence-tab-sources").click();
    await expect(evidenceSheet.getByTestId("mobile-evidence-panel-sources")).toBeVisible();
    await expect(page.locator('[data-testid="evidence-support-panel"]:visible')).toHaveCount(0);

    await expect(page.getByTestId("answer-section-heading")).toHaveText("Answer");
    await expect(page.getByTestId("answer-header-actions")).toHaveCount(0);

    await expect(page.getByText("Top source detail")).toHaveCount(0);
    await expect(page.getByText("Retrieval details")).toHaveCount(0);

    await scopeTrigger(page).click();
    const scopePopover = page.locator('[data-testid="scope-command-popover"]:visible');
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
    await expect(scopeTrigger(page)).toBeFocused();
    await expectNoPageHorizontalOverflow(page);
  });

  for (const viewport of [
    { name: "320px mobile", width: 320, height: 820, expands: true },
    { name: "390px mobile", width: 390, height: 820, expands: true },
    { name: "1280px desktop", width: 1280, height: 900, expands: false },
  ] as const) {
    test(`clinical table mobile expansion at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await mockDemoApi(page);
      await gotoApp(page, "/");
      await waitForDemoDashboardReady(page);

      await fillVisibleQuestionInput(page, "What clozapine monitoring items are shown in the table image?");
      const submitAnswer = page.getByRole("button", { name: "Generate source-backed answer" });
      await submitAnswer.click();

      const clinicalTable = page.getByLabel("Inline table preview").first();
      await expect(clinicalTable).toBeVisible();
      await expect(clinicalTable).toContainText("FBC/ANC");
      await expect(clinicalTable).not.toContainText(/page|p\.|chunk|Synthetic clozapine monitoring protocol/i);

      const expandButton = clinicalTable.getByTestId("table-expand-button");
      if (!viewport.expands) {
        await expect(page.getByRole("button", { name: "Open answer sources" })).toContainText("Source-backed");
        await expect(page.getByTestId("table-specific-answer-layout")).toHaveAttribute(
          "data-desktop-table-aside",
          "true",
        );
        const desktopLayout = await page.evaluate(() => {
          const answer = document.querySelector('[data-testid="plain-answer-response"]');
          const keyItems = document.querySelector('[aria-label="Key monitoring items"]');
          const table = document.querySelector('[aria-label="Inline table preview"]');
          const answerRect = answer?.getBoundingClientRect();
          const keyRect = keyItems?.getBoundingClientRect();
          const tableRect = table?.getBoundingClientRect();
          return {
            answerRight: answerRect?.right ?? 0,
            answerTop: answerRect?.top ?? 9999,
            keyRight: keyRect?.right ?? 0,
            tableLeft: tableRect?.left ?? 0,
            tableTop: tableRect?.top ?? 9999,
          };
        });
        expect(desktopLayout.tableLeft).toBeGreaterThan(Math.max(desktopLayout.answerRight, desktopLayout.keyRight));
        expect(Math.abs(desktopLayout.tableTop - desktopLayout.answerTop)).toBeLessThan(180);
        await expect(expandButton).toHaveCount(0);
        await expectNoPageHorizontalOverflow(page);
        return;
      }

      await clinicalTable.getByTestId("accessible-table-surface").click();
      const surfaceDialog = page.getByTestId("table-fullscreen-dialog");
      await expect(surfaceDialog).toBeVisible();
      await expect(surfaceDialog).toContainText("FBC/ANC");
      await page.keyboard.press("Escape");
      await expect(surfaceDialog).toBeHidden();

      await expect(expandButton).toBeVisible();
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

  test("document search mode lists matching documents and scope actions", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 820 });
    await mockDemoApi(page);
    await gotoApp(page, "/");
    await waitForDemoDashboardReady(page);

    await switchToDocumentSearchMode(page);
    await expect(page.getByTestId("answer-section-heading")).toHaveText("Document matches");
    await expect(page.getByRole("button", { name: "Find matching documents" })).toBeDisabled();
    await expect(page.getByRole("main").getByRole("heading", { name: "Documents" })).toBeVisible();
    await expect(page.getByTestId("document-search-workspace")).toBeVisible();
    await expect(visibleQuestionInput(page)).toBeVisible();
    await expect(page.getByTestId("document-search-empty-state")).toBeVisible();
    await expect(page.getByText(`${demoDocuments.length} sources indexed`)).toBeVisible();
    await expect(page.getByRole("button", { name: /Resume Lithium monitoring guideline/i })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Document shortcuts" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Suggested searches" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "monitoring", exact: true })).toHaveCount(0);
    await expect(page.getByText("Source library workspace")).toHaveCount(0);
    await expect(page.getByText("Document display")).toHaveCount(0);

    const questionInput = page.getByLabel("Search indexed guidelines by question or keyword");
    await questionInput.fill("lithium monitoring");
    await page.getByRole("button", { name: "Find matching documents" }).click();

    await expect(page.getByText("Synthetic lithium monitoring protocol").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "1 document" })).toBeVisible();
    await expect(page.getByText("1 table").first()).toBeVisible();
    await expect(page.getByTestId("document-search-workspace")).toContainText("Best match");
    await expect(page.getByTestId("document-search-workspace")).toContainText("High relevance");
    await expect(page.getByRole("button", { name: "Lithium", exact: true })).toBeVisible();
    await expect(page.getByText("Tag facets")).toHaveCount(0);
    await expect(page.getByTestId("document-search-workspace")).not.toContainText(
      /No direct support|Partial support|source support|direct support/i,
    );
    await expectMinTouchTarget(page.getByRole("link", { name: /Open Synthetic lithium/i }).first());
    await expect(page.getByRole("button", { name: /Scope search to/i }).first()).toBeVisible();
    await page
      .getByRole("button", { name: /Answer from/i })
      .first()
      .click();
    await expect(page.getByRole("heading", { name: "Answer" })).toBeVisible();
    await expectNoPageHorizontalOverflow(page);
  });

  test("search regressions avoid fetch errors and open viewer hits", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockDemoApi(page);
    await gotoApp(page, "/");
    await waitForDemoDashboardReady(page);

    await switchToDocumentSearchMode(page);
    const questionInput = page.getByLabel("Search indexed guidelines by question or keyword");

    await questionInput.fill("what is the best coffee machine for my kitchen");
    await page.getByRole("button", { name: "Find matching documents" }).click();
    await expect(page.locator("body")).not.toContainText(/failed to fetch|Search failed/i);
    await expect(page.locator("body")).toContainText(/No matching documents|No document matches|No indexed source/i);

    await questionInput.fill("What should a patient safety plan include?");
    await page.getByRole("button", { name: "Find matching documents" }).click();
    await expect(page.getByText("Synthetic patient safety plan").first()).toBeVisible();
    const viewerLink = page.locator('a[href*="chunk=55555555-5555-4555-8555-555555555555"]').first();
    await expect(viewerLink).toBeVisible();
    await viewerLink.click();
    await expect(page).toHaveURL(/chunk=55555555-5555-4555-8555-555555555555/);
    await expect(page.locator("#source-evidence").getByTestId("highlighted-source-passage")).toContainText(
      "Patient safety plan should include",
    );

    const sourceSearch = page.getByLabel("Search within indexed source text").last();
    await sourceSearch.fill("safety plan include");
    const desktopTextPanel = page.getByTestId("desktop-chunk-indexed-text-panel");
    await expect(desktopTextPanel.getByText("Hit 1 of 2").first()).toBeVisible();
    await expect(desktopTextPanel.getByRole("button", { name: "Next document search hit" })).toBeVisible();
    await desktopTextPanel.getByRole("button", { name: "Next document search hit" }).click();
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
    await expect(page.getByRole("heading", { level: 1, name: "Synthetic lithium monitoring protocol" })).toBeVisible();
    await expect(preview).toBeVisible();
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

  test("document summary opens at the top with cleaned bold formatting", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 820 });
    await mockDemoApi(page);
    await gotoApp(
      page,
      "/documents/11111111-1111-4111-8111-111111111111?page=1&chunk=44444444-4444-4444-8444-444444444442",
    );

    await page.getByRole("button", { name: /^Answer from this(?: document)?$/ }).first().click();

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
    await page.route(/\/api\/setup-status$/, async (route) => {
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

  test("upload drawer exposes setup checklist and explicit upload labels", async ({ page }) => {
    await page.setViewportSize({ width: 414, height: 820 });
    await mockPrivateUnauthenticatedApi(page);
    await gotoApp(page, "/");
    await expect(page.getByLabel("Search indexed guidelines by question or keyword")).toBeVisible();

    const uploadDrawer = await openUploadDrawer(page);

    await uploadDrawer.getByRole("tab", { name: /Setup/ }).click();
    await expect(uploadDrawer.getByText("First-run setup checklist")).toBeVisible();
    await expect(uploadDrawer.getByText(".env.local configured")).toBeVisible();
    await expect(uploadDrawer.getByText("Clinical KB Database target")).toBeVisible();
    await expect(uploadDrawer.getByText("supabase/schema.sql applied")).toBeVisible();
    await expect(uploadDrawer.getByText("Search RPC and vector indexes")).toBeVisible();
    await expect(uploadDrawer.getByText("OpenAI API key available")).toBeVisible();
    await expect(uploadDrawer.getByText("npm run worker running")).toBeVisible();
    await uploadDrawer.getByRole("tab", { name: /Upload/ }).click();
    await expect(uploadDrawer.getByText("Document title optional")).toBeVisible();
    await expect(uploadDrawer.getByText("Guideline files required")).toBeVisible();
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
    await expect(
      uploadDrawer.getByText(
        "Demo mode is read-only. Configure Supabase, OpenAI, and the local worker before uploading private guideline files.",
      ),
    ).toBeVisible();
    await expect(uploadDrawer.locator('input[name="file"]')).toBeDisabled();
    await expectNoPageHorizontalOverflow(page);
  });

  for (const viewport of [
    { name: "mobile", width: 390, height: 820 },
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
      await page.keyboard.press("Escape");
      await expect(reopenedDialog).toBeHidden();
      await expectNoPageHorizontalOverflow(page);
    });
  }
});
