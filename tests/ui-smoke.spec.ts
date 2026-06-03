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
    await route.fulfill({
      json: {
        results: [
          {
            id: "44444444-4444-4444-8444-444444444442",
            document_id: "11111111-1111-4111-8111-111111111111",
            title: "Synthetic lithium monitoring protocol",
            file_name: "lithium-monitoring.pdf",
            page_number: 1,
            chunk_index: 0,
            section_heading: "Monitoring",
            content: "Lithium monitoring and toxicity safety-net source passage.",
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
            title: "Synthetic lithium monitoring protocol",
            file_name: "lithium-monitoring.pdf",
            labels: [{ label: "lithium", label_type: "medication", source: "generated", confidence: 0.94 }],
            summarySnippet: "Lithium monitoring and toxicity safety-net reminders.",
            bestPages: [1],
            bestChunkIds: ["44444444-4444-4444-8444-444444444442"],
            imageCount: 1,
            tableCount: 1,
            matchReason: "Matched indexed passage",
            score: 0.92,
          },
        ],
        smartPanel: {},
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
    await expect(page.getByRole("navigation", { name: "Answer sections" })).toBeVisible();
  }
}

async function waitForDemoDashboardReady(page: Page) {
  await expect(page.getByLabel("Search indexed guidelines by question or keyword")).toBeEnabled();
  await expect(page.getByTestId("scope-prompts-drawer").getByText("3 documents")).toBeAttached({ timeout: 30000 });
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
  await page.getByRole("link", { name: label }).click();
  await expect(page.locator(`nav a[href="${hash}"]`)).toHaveAttribute("aria-current", "page");
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
      if (viewport.width >= 640) {
        const scopeDrawer = page.getByTestId("scope-prompts-drawer");
        await expect(scopeDrawer).toBeVisible();
        expect(await scopeDrawer.evaluate((element) => element.hasAttribute("open"))).toBe(false);
        await expect(scopeDrawer).toContainText("Scope & prompts");
      }
      await expectDomIntegrity(page, { mobileNav: viewport.width < 1024 });
      await expectNoPageHorizontalOverflow(page);
    });
  }

  test("private mode unauthenticated dashboard allows public search", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 820 });
    await mockPrivateUnauthenticatedApi(page);
    await gotoApp(page, "/");

    const questionInput = page.getByLabel("Search indexed guidelines by question or keyword");
    await questionInput.fill("lithium monitoring");
    await expect(page.getByRole("button", { name: "Generate source-backed answer" })).toBeEnabled();
    await page.getByRole("button", { name: "Generate source-backed answer" }).click();
    await expect(page.getByTestId("answer-grounding-chip")).toBeVisible();
    await expect(page.getByText("Sign in before searching private guideline documents")).toHaveCount(0);
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
    await expect(page.getByLabel("Open document scope and prompt controls")).toBeVisible();
    const question = "What toxicity safety-net symptoms should be reviewed for lithium?";
    await questionInput.click();
    await questionInput.pressSequentially(question);
    await expect(questionInput).toHaveValue(question);
    await expect(page.getByRole("button", { name: "Generate source-backed answer" })).toBeEnabled();
    await page.getByRole("button", { name: "Generate source-backed answer" }).click();

    await expect(page.getByTestId("answer-grounding-chip")).toBeVisible();
    await expect(page.getByTestId("clinical-action-view")).toBeVisible();
    await expect(
      page.getByTestId("clinical-action-view").getByRole("heading", { name: "Action", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByTestId("clinical-action-view").getByRole("heading", { name: "Thresholds", exact: true }),
    ).toBeVisible();
    const rawNarrative = page.getByTestId("raw-answer-narrative");
    await expect(rawNarrative).toBeVisible();
    expect(await rawNarrative.evaluate((element) => element.hasAttribute("open"))).toBe(false);
    await expect(page.getByTestId("answer-top-source-chip")).toBeVisible();
    await expect(page.getByTestId("answer-grounding-chip")).toBeVisible();
    await expect(page.getByTestId("clinical-action-view").getByText(/Synthetic demo only/i)).toBeVisible();
    await expect(
      page.getByText("Draft only; verify source first before pasting into the medical record.").first(),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Quotes, \d+ items?/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Images, \d+ items?/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Sources, \d+ items?/ })).toBeVisible();
    await expectDomIntegrity(page, { mobileNav: true });

    const hierarchy = await page.evaluate(() => {
      const safety = document.querySelector('[data-testid="safety-findings-panel"]');
      const verify = document.querySelector('[data-testid="verify-source-strip"]');
      const copy = document.querySelector('[data-testid="copy-governance-strip"]');
      return {
        safetyTop: safety?.getBoundingClientRect().top ?? 9999,
        verifyTop: verify?.getBoundingClientRect().top ?? 9999,
        copyTop: copy?.getBoundingClientRect().top ?? 9999,
      };
    });
    expect(hierarchy.safetyTop).toBeLessThan(hierarchy.verifyTop);
    expect(hierarchy.verifyTop).toBeLessThan(hierarchy.copyTop);

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
        actionHeight: actionsRect?.height ?? 999,
      };
    });
    expect(headingMetrics.iconTitleCenterDelta).toBeLessThanOrEqual(3);
    expect(headingMetrics.actionHeight).toBeLessThanOrEqual(34);

    await expectMobileNavTarget(page, "Quotes", "#quotes", "Source quotes");
    await expectMobileNavTarget(page, "Images", "#images", "Tables and diagrams");
    await expectMobileNavTarget(page, "Sources", "#sources", "Source passages");

    await page.getByLabel("Open document scope and prompt controls").click();
    const mobileScopePopover = page.getByTestId("mobile-scope-popover");
    await expect(mobileScopePopover).toBeVisible();
    const popoverMetrics = await mobileScopePopover.evaluate((element) => {
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
    await expectNoPageHorizontalOverflow(page);
  });

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
    expect(payload.checks).toHaveLength(5);
    expect(payload.checks.map((check: { id: string }) => check.id)).toEqual([
      "env",
      "project",
      "schema",
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
      await dialog.getByRole("button", { name: "Close guide" }).click();
      await expect(dialog).toBeHidden();

      const reopenedDialog = await openGuide(page);
      await page.keyboard.press("Escape");
      await expect(reopenedDialog).toBeHidden();
      await expectNoPageHorizontalOverflow(page);
    });
  }
});
