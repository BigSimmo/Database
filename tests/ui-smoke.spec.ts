import type { Route } from "playwright-core";
import { expect, test, type Page } from "playwright/test";
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

async function seedAuthenticatedSession(page: Page) {
  await page.addInitScript(() => {
    const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
    window.localStorage.setItem(
      "sb-sjrfecxgysukkwxsowpy-auth-token",
      JSON.stringify({
        access_token: "test-access-token",
        refresh_token: "test-refresh-token",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: expiresAt,
        user: {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          aud: "authenticated",
          role: "authenticated",
          email: "test@example.com",
          app_metadata: { provider: "email", providers: ["email"] },
          user_metadata: { email: "test@example.com" },
          created_at: new Date().toISOString(),
        },
      }),
    );
  });
}

async function mockPrivateAuthenticatedApi(page: Page) {
  await page.route(/\/api\/setup-status$/, async (route) => {
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
    await route.fulfill({
      json: {
        batches: [
          {
            id: "batch-1",
            owner_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            name: "Duplicate dry run",
            source_root: "D:\\Clinical PDFs",
            include_glob: "**/*.pdf",
            status: "completed",
            total_files: 3,
            queued_files: 1,
            skipped_files: 2,
            failed_files: 0,
            total_bytes: 1024,
            metadata: {},
            completed_at: "2026-05-27T00:00:00.000Z",
            created_at: "2026-05-27T00:00:00.000Z",
            updated_at: "2026-05-27T00:00:00.000Z",
          },
        ],
      },
    });
  });
  await page.route(/\/api\/upload$/, async (route) => {
    await route.fulfill({
      json: {
        duplicate: true,
        duplicateReason: "exact_content_hash",
        document: {
          id: "11111111-1111-4111-8111-111111111111",
          title: "Existing guideline",
          file_name: "guideline.pdf",
          status: "indexed",
        },
        message: 'Exact copy already exists as "Existing guideline"; no duplicate job was queued.',
      },
    });
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

async function expectDomIntegrity(page: Page, options: { mobileNav?: boolean } = {}) {
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
    await expect(page.getByTestId("mobile-section-fab-button")).toBeVisible();
    await expect(page.getByTestId("mobile-section-fab-menu")).toBeHidden();
  }
}

async function waitForDemoDashboardReady(page: Page) {
  await expect(page.getByLabel("Search indexed guidelines by question or keyword")).toBeEnabled();
  await expect(page.getByLabel("Open document scope")).toBeVisible({ timeout: 30000 });
}

async function scrollDashboardToBottom(page: Page) {
  await page
    .locator("main")
    .first()
    .evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
}

async function expectMobileNavTarget(page: Page, label: string, hash: string, sectionText: string) {
  const fabButton = page.getByTestId("mobile-section-fab-button");
  const fabMenu = page.getByTestId("mobile-section-fab-menu");
  await fabButton.click();
  await expect(fabMenu).toBeVisible();
  await fabMenu.getByRole("link", { name: new RegExp(`^${label}`) }).click();
  await expect(fabMenu).toBeHidden();
  await expect(fabButton).toBeFocused();
  await fabButton.click();
  await expect(fabMenu.locator(`a[href="${hash}"]`)).toHaveAttribute("aria-current", "page");
  await page.keyboard.press("Escape");
  await expect(fabMenu).toBeHidden();
  await expect(fabButton).toBeFocused();
  await expect(page.locator(hash)).toBeVisible();
  await expect(page.locator(hash)).toContainText(sectionText);
  await expectNoPageHorizontalOverflow(page);
}

async function openGuide(page: Page) {
  await scrollDashboardToBottom(page);
  const trigger = page.getByTestId("dashboard-guide-trigger");
  await trigger.scrollIntoViewIfNeeded();
  await expect(trigger).toBeVisible();
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Clinical KB guide" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Ask and verify")).toBeVisible();
  await expect(dialog.getByText("Top source and citations")).toBeVisible();
  await expect(dialog.getByText("Upload and indexing")).toBeVisible();
  await expect(dialog.getByText("Copying text")).toBeVisible();
  await expectNoPageHorizontalOverflow(page);
  return dialog;
}

test.describe("Clinical KB UI smoke coverage", () => {
  test.describe.configure({ timeout: 60000 });

  for (const viewport of dashboardViewports) {
    test(`dashboard loads without page overflow at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await mockPrivateUnauthenticatedApi(page);
      await gotoApp(page, "/");

      await expect(page.getByRole("heading", { level: 1, name: "Clinical Guide" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Answer" })).toBeVisible();
      await expect(page.getByLabel("Search indexed guidelines by question or keyword")).toBeVisible();
      await expect(page.getByRole("button", { name: "Generate source-backed answer" })).toHaveText(/^\s*Ask\s*$/);
      const headerHeight = await page.locator("#search").evaluate((element) => element.getBoundingClientRect().height);
      expect(headerHeight).toBeLessThanOrEqual(viewport.width >= 640 ? 185 : 180);
      await expect(page.getByLabel("Open document scope")).toBeVisible();
      await expect(page.getByTestId("scope-command-popover")).toBeHidden();
      await expect(page.getByTestId("scope-prompts-drawer")).toHaveCount(0);
      await expect(page.getByTestId("mobile-scope-popover")).toHaveCount(0);
      await expect(page.getByRole("button", { name: /Use sample question/i }).first()).toBeVisible();
      await expectDomIntegrity(page, { mobileNav: viewport.width <= 768 });
      if (viewport.width <= 768) {
        const fabButton = page.getByTestId("mobile-section-fab-button");
        const fabMenu = page.getByTestId("mobile-section-fab-menu");
        await fabButton.click();
        await expect(fabMenu).toBeVisible();
        await expect(page.getByTestId("mobile-section-fab-status")).toHaveText("No answer yet");
        await expect(page.getByTestId("mobile-section-fab-next-step")).toHaveText("Ask a question first");
        await expect(fabMenu).toContainText("No quotes yet");
        await expect(fabMenu).toContainText("No images yet");
        await page.keyboard.press("Escape");
        await expect(fabMenu).toBeHidden();
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
    await expectDomIntegrity(page, { mobileNav: true });
    await expectNoPageHorizontalOverflow(page);
  });

  test("demo answer flow reaches a source-backed answer", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 820 });
    await mockDemoApi(page);
    await gotoApp(page, "/");
    await waitForDemoDashboardReady(page);

    const questionInput = page.getByLabel("Search indexed guidelines by question or keyword");
    await expect(questionInput).toBeEnabled();
    await expect(page.getByLabel("Open document scope")).toBeVisible();
    const question = "What clozapine monitoring items are shown in the table image?";
    await questionInput.click();
    await questionInput.pressSequentially(question);
    await expect(questionInput).toHaveValue(question);
    await expect(page.getByRole("button", { name: "Generate source-backed answer" })).toBeEnabled();
    await page.getByRole("button", { name: "Generate source-backed answer" }).click();

    await expect(page.getByRole("button", { name: /Use sample question/i })).toHaveCount(0);
    const plainAnswer = page.getByTestId("plain-answer-response");
    await expect(plainAnswer).toBeVisible();
    await expect(plainAnswer).toContainText("synthetic clozapine table image highlights");
    await expect(plainAnswer.getByTestId("plain-answer-prose")).toBeVisible();
    await expect(plainAnswer.locator("ul, ol, li")).toHaveCount(0);
    await expect(plainAnswer.locator("svg")).toHaveCount(0);
    await expect(page.getByTestId("clinical-action-view")).toBeVisible();
    await expect(
      page
        .getByTestId("clinical-action-view")
        .getByRole("heading", { name: "High-yield clinical details", exact: true }),
    ).toBeVisible();
    const clinicalDetails = page.getByTestId("clinical-action-view");
    await expect(clinicalDetails.getByTestId("clinical-detail-summary")).toBeVisible();
    await expect(clinicalDetails.getByTestId("clinical-detail-card").first()).toBeVisible();
    const clinicalTable = clinicalDetails.getByTestId("clinical-detail-table").first();
    await expect(clinicalTable).toBeVisible();
    await expect(clinicalDetails.getByRole("table").first()).toBeVisible();
    await expect(clinicalDetails.getByRole("heading", { name: "Thresholds" })).toBeVisible();
    await expect(clinicalDetails).toContainText("FBC/ANC");
    await expect(clinicalTable).not.toContainText(/page|p\.|chunk|Synthetic clozapine monitoring protocol/i);
    const tableExpandButton = clinicalTable.getByTestId("table-expand-button");
    await expect(tableExpandButton).toBeVisible();
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
    const rawNarrative = page.getByTestId("raw-answer-narrative");
    await expect(rawNarrative).toBeVisible();
    expect(await rawNarrative.evaluate((element) => element.hasAttribute("open"))).toBe(false);
    await expect(page.getByTestId("answer-top-source-chip")).toHaveCount(0);
    await expect(page.getByTestId("answer-grounding-chip")).toHaveCount(0);
    await expect(page.getByTestId("evidence-rail")).toHaveCount(0);
    await expect(page.getByTestId("evidence-summary-card")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Copy clinical draft" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Copy answer with citations" })).toHaveCount(0);
    await expect(page.getByTestId("clinical-action-view").getByText(/Synthetic demo only/i)).toHaveCount(0);
    await expect(
      page
        .getByTestId("clinical-action-view")
        .getByText("Draft only; verify source first before pasting into the medical record."),
    ).toHaveCount(0);
    await expect(page.getByTestId("answer-safety-notice")).toHaveCount(0);
    const fabButton = page.getByTestId("mobile-section-fab-button");
    const fabMenu = page.getByTestId("mobile-section-fab-menu");
    await expect(fabButton).toBeVisible();
    await fabButton.click();
    await expect(fabMenu).toContainText("Answer navigator");
    await expect(page.getByTestId("mobile-section-fab-status")).toHaveText("Ready to verify");
    await expect(page.getByTestId("mobile-section-fab-next-step")).toHaveText("Next: review exact quotes");
    await expect(fabMenu.getByRole("link", { name: /Quotes, \d+ items?/ })).toBeVisible();
    await expect(fabMenu.getByRole("link", { name: /Images, \d+ items?/ })).toBeVisible();
    await expect(fabMenu.getByRole("link", { name: /Sources, \d+ items?/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(fabMenu).toBeHidden();
    await expect(fabButton).toBeFocused();
    await expectDomIntegrity(page, { mobileNav: true });

    const evidenceDrawer = page.locator("details").filter({ hasText: "Evidence & sources" }).first();
    await expect(evidenceDrawer).toBeVisible();
    await expect(evidenceDrawer).toContainText(/top source/i);
    await expect(evidenceDrawer).toContainText(/citations?/i);
    await expect(page.getByText("Review evidence").first()).toBeVisible();
    await expect(page.getByText("Workspace utilities")).toBeVisible();
    expect(await evidenceDrawer.evaluate((element) => element.hasAttribute("open"))).toBe(false);
    await expect(page.getByTestId("evidence-support-panel")).toHaveCount(0);

    const hierarchy = await page.evaluate(() => {
      const plainAnswer = document.querySelector('[data-testid="plain-answer-response"]');
      const structured = document.querySelector('[data-testid="clinical-action-view"]');
      const evidence = Array.from(document.querySelectorAll("details")).find((element) =>
        element.textContent?.includes("Evidence & sources"),
      );
      return {
        plainAnswerTop: plainAnswer?.getBoundingClientRect().top ?? 9999,
        structuredTop: structured?.getBoundingClientRect().top ?? 9999,
        evidenceTop: evidence?.getBoundingClientRect().top ?? 9999,
      };
    });
    expect(hierarchy.plainAnswerTop).toBeLessThan(hierarchy.structuredTop);
    expect(hierarchy.structuredTop).toBeLessThan(hierarchy.evidenceTop);

    await evidenceDrawer.locator("summary").click();
    const evidenceSupport = page.getByTestId("evidence-support-panel");
    await expect(evidenceSupport).toBeVisible();
    await expect(evidenceSupport.getByText("Evidence review")).toBeVisible();
    await expect(evidenceSupport.getByText("Source status", { exact: true })).toBeVisible();
    await expect(evidenceSupport.getByTestId("evidence-counts")).toBeVisible();
    await expect(evidenceSupport.getByRole("link", { name: /Open top source/i })).toBeVisible();
    const safetyNotice = page.getByTestId("answer-safety-notice");
    await expect(safetyNotice).toBeVisible();
    await expect(safetyNotice).toContainText("Draft only; verify source first before pasting into the medical record.");
    await expect(safetyNotice).toContainText("Synthetic demo only: this is not clinical guidance.");

    const headingMetrics = await page.getByTestId("answer-section-heading").evaluate((element) => {
      const icon = element.querySelector("[data-section-heading-icon]");
      const title = element.querySelector("h2");
      const actions = element.querySelector('[data-testid="answer-header-actions"]');
      const iconRect = icon?.getBoundingClientRect();
      const titleRect = title?.getBoundingClientRect();
      const actionsRect = actions?.getBoundingClientRect();
      return {
        iconTitleCenterDelta:
          iconRect && titleRect
            ? Math.abs(iconRect.top + iconRect.height / 2 - (titleRect.top + titleRect.height / 2))
            : 999,
        hasActions: Boolean(actionsRect),
      };
    });
    expect(headingMetrics.iconTitleCenterDelta).toBeLessThanOrEqual(3);
    expect(headingMetrics.hasActions).toBe(false);

    await expectMobileNavTarget(page, "Quotes", "#quotes", "Source quotes");
    await expectMobileNavTarget(page, "Images", "#images", "Tables and diagrams");
    await expectMobileNavTarget(page, "Sources", "#sources", "Source passages");
    await expect(page.getByText("Top source detail")).toHaveCount(0);
    await expect(page.getByText("Retrieval details")).toHaveCount(0);

    await page.getByLabel("Open document scope").click();
    const scopePopover = page.getByTestId("scope-command-popover");
    await expect(scopePopover).toBeVisible();
    const scopeFilter = scopePopover.locator('[data-testid="document-scope-filter"]');
    await expect(scopeFilter).toBeVisible();
    await expect(scopeFilter).toBeFocused();
    await scopeFilter.fill("lithium");
    await expect(scopePopover.getByText("1 match")).toBeVisible();
    await expect(scopePopover.getByRole("button", { name: /Lithium monitoring protocol/i })).toBeVisible();
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
    await expect(page.getByLabel("Open document scope")).toBeFocused();
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

      await page
        .getByRole("button", { name: "Use sample question: What clozapine monitoring items are shown in the table image?" })
        .click();
      await page.getByRole("button", { name: "Generate source-backed answer" }).click();

      const clinicalTable = page.getByTestId("clinical-action-view").getByTestId("clinical-detail-table").first();
      await expect(clinicalTable).toBeVisible();
      await expect(clinicalTable).toContainText("FBC/ANC");
      await expect(clinicalTable).not.toContainText(/page|p\.|chunk|Synthetic clozapine monitoring protocol/i);

      const expandButton = clinicalTable.getByTestId("table-expand-button");
      if (!viewport.expands) {
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

    await page.getByRole("button", { name: "Switch to document search mode" }).click();
    await expect(page.getByRole("heading", { name: "Document matches" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Find matching documents" })).toBeDisabled();
    await expect(page.getByText("Search documents")).toBeVisible();

    const questionInput = page.getByLabel("Search indexed guidelines by question or keyword");
    await questionInput.fill("lithium monitoring");
    await page.getByRole("button", { name: "Find matching documents" }).click();

    await expect(page.getByText("Synthetic lithium monitoring protocol").first()).toBeVisible();
    await expect(page.getByText("1 tables")).toBeVisible();
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

    await page.getByRole("button", { name: "Switch to document search mode" }).click();
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

    await page.getByRole("button", { name: "Summarise document" }).click();

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
    await gotoApp(
      page,
      "/documents/11111111-1111-4111-8111-111111111111?page=1&chunk=44444444-4444-4444-8444-444444444442",
    );

    await expect(
      page.getByTestId("pdf-preview").getByText(/Sign in to open private source documents\.|Document not found\./),
    ).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("heading", { level: 1, name: /Sign in required|Source unavailable/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Summarise document" })).toBeDisabled();
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

    await scrollDashboardToBottom(page);
    const uploadSummary = page.locator("summary").filter({ hasText: "Upload and indexing" }).first();
    await uploadSummary.scrollIntoViewIfNeeded();
    await uploadSummary.click({ force: true });
    const uploadDrawer = page.locator("details").filter({ hasText: "Upload and indexing" }).first();

    await expect(uploadDrawer.getByText("First-run setup checklist")).toBeVisible();
    await expect(uploadDrawer.getByText(".env.local configured")).toBeVisible();
    await expect(uploadDrawer.getByText("Clinical KB Database target")).toBeVisible();
    await expect(uploadDrawer.getByText("supabase/schema.sql applied")).toBeVisible();
    await expect(uploadDrawer.getByText("Search RPC and vector indexes")).toBeVisible();
    await expect(uploadDrawer.getByText("OpenAI API key available")).toBeVisible();
    await expect(uploadDrawer.getByText("npm run worker running")).toBeVisible();
    await expect(uploadDrawer.getByText("Document title optional")).toBeVisible();
    await expect(uploadDrawer.getByText("Guideline file required")).toBeVisible();
    await expectNoPageHorizontalOverflow(page);
  });

  test("duplicate upload warning and exact-copy batch count are visible", async ({ page }) => {
    await page.setViewportSize({ width: 414, height: 820 });
    await seedAuthenticatedSession(page);
    await mockPrivateAuthenticatedApi(page);
    await gotoApp(page, "/");

    await scrollDashboardToBottom(page);
    const uploadSummary = page.locator("summary").filter({ hasText: "Upload and indexing" }).first();
    await uploadSummary.scrollIntoViewIfNeeded();
    await uploadSummary.click({ force: true });
    const uploadDrawer = page.locator("details").filter({ hasText: "Upload and indexing" }).first();

    await expect(uploadDrawer.getByRole("button", { name: "Queue document" })).toBeEnabled({ timeout: 30000 });
    await expect(uploadDrawer.getByText("2 exact copies skipped")).toBeVisible();
    await uploadDrawer.locator('input[name="file"]').setInputFiles({
      name: "guideline.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.7"),
    });
    await uploadDrawer.getByRole("button", { name: "Queue document" }).click();

    await expect(
      uploadDrawer.getByText('Exact copy already exists as "Existing guideline"; no duplicate job was queued.'),
    ).toBeVisible();
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
