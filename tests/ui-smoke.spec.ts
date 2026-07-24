import type { Route } from "playwright-core";
import { expect, test, type Locator, type Page } from "playwright/test";
import { stubZeroTouchPoints } from "./helpers/zero-touch";
import { readMobileComposerReservePx, scrollPrimarySurface } from "./playwright-scroll";
import { answerThreadStorageKey } from "../src/lib/answer-thread-storage";
import { documentSummaryQuestion } from "../src/lib/answer-contract";
import { demoAnswer, demoDocuments, demoSummary, getDemoDocument, getDemoDocumentPayload } from "../src/lib/demo-data";
import { formRecords } from "../src/lib/forms";
import { deriveGovernanceFromSections } from "../src/lib/medication-records";
import { getMedicationRecord, loadMedicationSnapshot } from "../src/lib/medication-snapshot";
import { medicationToSearchResult, rankMedicationRecords, type MedicationRecord } from "../src/lib/medications";
import { serviceRecords } from "../src/lib/services";
import { recentQueryStorageKey } from "../src/lib/recent-query-storage";

const dashboardViewports = [
  { name: "small-mobile", width: 320, height: 720 },
  { name: "standard-mobile", width: 375, height: 760 },
  { name: "large-mobile", width: 414, height: 820 },
  { name: "tablet", width: 768, height: 900 },
  { name: "laptop", width: 1280, height: 900 },
  { name: "mobile-landscape", width: 667, height: 375 },
] as const;
const uiAssertionTimeoutMs = 30_000;
const demoAnswerThreadOwnerId = "local-demo-session";
const demoAnswerThreadStorageKey = `${answerThreadStorageKey}:${demoAnswerThreadOwnerId}`;
const demoRecentQueryStorageKey = `${recentQueryStorageKey}:${demoAnswerThreadOwnerId}`;

async function expectNoPageHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const documentWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0);
    return documentWidth - document.documentElement.clientWidth;
  });

  expect(overflow).toBeLessThanOrEqual(2);
}

async function installClipboardMock(page: Page) {
  await page.addInitScript(() => {
    let clipboardText = "";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        readText: async () => clipboardText,
        writeText: async (value: string) => {
          clipboardText = value;
        },
      },
    });
  });
}

async function gotoApp(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#main-content").first()).toBeVisible({ timeout: 15_000 });
}

async function waitForReactEventHandler(locator: Locator, eventName: "onChange" | "onClick" | "onScroll" | "onSubmit") {
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

async function activateFocusedControl(page: Page, control: Locator) {
  await control.focus();
  await expect(control).toBeFocused();
  await page.keyboard.press("Enter");
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

async function submitDocumentSearch(page: Page) {
  const submit = page.getByRole("button", { name: "Find matching documents" });
  await expect(submit).toBeEnabled();
  await waitForReactEventHandler(submit.locator("xpath=ancestor::form[1]"), "onSubmit");
  const response = page.waitForResponse(
    (candidate) => new URL(candidate.url()).pathname === "/api/search" && candidate.ok(),
    { timeout: 30_000 },
  );
  await Promise.all([response, submit.click()]);
  await expect(page.getByRole("heading", { name: "Finding matching documents" })).toHaveCount(0, {
    timeout: 30_000,
  });
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
    await waitForReactEventHandler(legacyDocumentsMode, "onClick");
    await legacyDocumentsMode.click();
    await expect(legacyDocumentsMode).toHaveAttribute("aria-pressed", "true", { timeout: uiAssertionTimeoutMs });
    return;
  }

  const appModeMenu = page.getByRole("button", { name: /^Mode / });
  if (!(await isVisibleWithoutThrow(appModeMenu))) {
    throw new Error(
      "Could not switch to document search mode: neither the legacy mode toggle nor the app mode menu is visible.",
    );
  }
  await expect(appModeMenu).toBeEnabled();
  await waitForReactEventHandler(appModeMenu, "onClick");
  // Scope/Escape deferred focus restore can race a mode-menu open; if the scope
  // surface is open, wait for it to dismiss before opening the mode menu.
  const scopePopover = page.getByTestId("scope-command-popover");
  if (await isVisibleWithoutThrow(scopePopover)) {
    await scopePopover.waitFor({ state: "hidden", timeout: uiAssertionTimeoutMs });
  }
  await appModeMenu.click({ force: true });
  const appModeGroup = page.getByRole("menu", { name: "Choose app mode" });
  await expect(appModeGroup).toBeVisible({ timeout: uiAssertionTimeoutMs });
  const documentsMode = appModeGroup.getByRole("menuitemradio", { name: /^Documents\b/ });
  await expect(documentsMode).toBeVisible({ timeout: uiAssertionTimeoutMs });
  await waitForReactEventHandler(documentsMode, "onClick");
  await documentsMode.click({ force: true });
  await expect(appModeMenu).toHaveAccessibleName("Mode Documents", { timeout: uiAssertionTimeoutMs });
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
    `event: progress\ndata: ${JSON.stringify({ stage: "ranking", message: "Selecting governed sources." })}`,
    `event: progress\ndata: ${JSON.stringify({ stage: "complete", message: "Answer ready.", elapsedMs: 1250 })}`,
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
  onAnswerRequest?: (
    query: string,
    scope: { documentId?: string; documentIds?: string[]; summaryMode?: boolean },
  ) => void;
};

async function blockExternalRequests(page: Page) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)
    ) {
      await route.abort("blockedbyclient");
      return;
    }
    await route.fallback();
  });
}

function medicationIndexRecords(records: MedicationRecord[]): MedicationRecord[] {
  return records.map((record) => ({
    slug: record.slug,
    name: record.name,
    class: record.class,
    subclass: record.subclass,
    category: record.category,
    accent: record.accent,
    tag: record.tag,
    schedule: record.schedule,
    stats: [],
    sections: [],
    quick: [],
  }));
}

async function mockDemoApi(page: Page, options: MockDemoApiOptions = {}) {
  await blockExternalRequests(page);
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
    const fullRecords = loadMedicationSnapshot();
    const records = url.searchParams.get("fields") === "index" ? medicationIndexRecords(fullRecords) : fullRecords;
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
  await page.route(/\/api\/registry\/records(?:\?.*)?$/, async (route) => {
    const kind = new URL(route.request().url()).searchParams.get("kind");
    const records = kind === "form" ? formRecords : serviceRecords;
    await route.fulfill({
      json: {
        records,
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
      summaryMode?: boolean;
    };
    const query = typeof body.query === "string" ? body.query.trim() : "";
    if (!query || query.length > 2000) {
      await route.fulfill({ status: 400, json: { error: "A query between 1 and 2000 characters is required." } });
      return;
    }
    options.onAnswerRequest?.(query, {
      documentId: body.documentId,
      documentIds: body.documentIds,
      summaryMode: body.summaryMode,
    });
    if (options.answerDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.answerDelayMs));
    }
    const answer =
      options.answerOverride?.(query, body.documentId, body.documentIds) ??
      (body.summaryMode && body.documentId
        ? demoSummary(body.documentId)
        : demoAnswer(query, body.documentId, body.documentIds));
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
  await page.route(/\/api\/search\/universal(?:\?.*)?$/, async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q")?.trim() ?? "";
    await route.fulfill({
      json: {
        query,
        groups: [],
        tookMs: 0,
        domainOrder: [],
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
  const bottomDock = page.locator("form.answer-footer-search-dock");
  if (await bottomDock.isVisible().catch(() => false)) {
    // Prior sheet/scroll interactions can leave the phone dock translated off-screen.
    // Restore it before opening scope so the click lands in the viewport.
    await scrollPrimarySurface(page, 0);
    await expect(bottomDock).not.toHaveAttribute("data-scroll-hidden", "true");
  }

  // If the composer is scrolled out of view on mobile, scroll the container to the top to reveal it
  await scrollPrimarySurface(page, 0);

  await composer.click();
  const scopeOption = page.getByRole("option", { name: /Scope sources/i });
  if (await scopeOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await scopeOption.click();
  } else {
    const actionMenu = page.getByRole("button", { name: "Open answer options" });
    await expect(actionMenu).toBeVisible();
    await waitForReactEventHandler(actionMenu, "onClick");
    await actionMenu.click();
    const actionsMenu = page.getByTestId("daily-actions-menu");
    await expect(actionsMenu).toBeVisible({ timeout: uiAssertionTimeoutMs });
    await actionsMenu.getByRole("menuitem", { name: /^Scope\b/ }).click();
  }
  await expect(page.getByTestId("scope-command-popover")).toBeVisible({ timeout: uiAssertionTimeoutMs });
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
  const tableDialog = page.getByTestId("table-fullscreen-dialog");
  await expect(expandButton).toBeVisible();
  await waitForReactEventHandler(expandButton, "onClick");
  await expandButton.click();
  await expect(tableDialog).toBeVisible({ timeout: 15_000 });
  return tableDialog;
}

async function openMobileClinicalGuideMenu(page: Page) {
  const trigger = page.getByRole("button", { name: "Open Clinical Guide menu" });
  await expect(trigger).toBeVisible();
  await waitForReactEventHandler(trigger, "onClick");
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
          const raw = window.sessionStorage.getItem(storageKey);
          if (!raw) return 0;
          const parsed = JSON.parse(raw) as { priorTurns?: unknown[] };
          return Array.isArray(parsed.priorTurns) ? parsed.priorTurns.length : 0;
        } catch {
          return 0;
        }
      }, demoAnswerThreadStorageKey),
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
    await waitForReactEventHandler(trigger, "onClick");
    await trigger.click();
    await expect(dialog).toBeVisible({ timeout: uiAssertionTimeoutMs });
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
  await expect(setup.getByRole("button", { name: "Apple sign-in unavailable" })).toBeDisabled();
  await expect(setup.getByRole("button", { name: "Google sign-in unavailable" })).toBeDisabled();
  await expect(setup.getByRole("button", { name: "Microsoft sign-in unavailable" })).toBeDisabled();
  await expect(setup.getByRole("heading", { name: "What your account saves" })).toBeVisible();
  await expect(setup.getByText(/Recent questions stay in this browser session/i)).toBeVisible();
  await expect(setup.getByRole("heading", { name: "Security summary" })).toBeVisible();
  await expect(setup.getByText("No PHI required")).toBeVisible();
  await expect(setup).toContainText("Do not enter patient-identifying information.");
}

async function expectAdminOnlyUploadNotice(page: Page) {
  const menu = await openDailyActions(page);
  const uploadAction = menu.getByRole("menuitem", { name: "Add document" });
  await expect(uploadAction).toBeVisible();
  await uploadAction.click();
  await expect(page.getByRole("alert").filter({ hasText: "Upload and indexing tools are admin-only." })).toContainText(
    "Use the source library to open indexed documents.",
  );
  await expect(page.getByRole("dialog", { name: "Upload and indexing" })).toHaveCount(0);
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
  await waitForReactEventHandler(trigger, "onClick");
  await trigger.click();
  await expect(menu).toBeVisible({ timeout: uiAssertionTimeoutMs });

  return menu;
}

test.beforeEach(stubZeroTouchPoints);

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
    await gotoApp(page, "/");
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

  test("mobile search focus is singular, visible, and contained at clipped edges", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 820 });
    await mockPrivateUnauthenticatedApi(page);
    await gotoApp(page, "/?mode=answer");
    await waitForDemoDashboardReady(page);

    const universalInput = visibleQuestionInput(page);
    const restingPillBorder = await universalInput.evaluate((element) => {
      const pill = element.closest(".answer-footer-search-pill");
      return pill ? getComputedStyle(pill).borderColor : null;
    });
    await universalInput.focus();
    const universalFocus = await universalInput.evaluate((element) => {
      const inputStyle = getComputedStyle(element);
      const pill = element.closest(".answer-footer-search-pill");
      const pillStyle = pill ? getComputedStyle(pill) : null;
      return {
        inputOutline: inputStyle.outlineStyle,
        inputShadow: inputStyle.boxShadow,
        pillBorder: pillStyle?.borderColor ?? null,
        pillShadow: pillStyle?.boxShadow ?? null,
      };
    });
    expect(universalFocus.inputOutline).toBe("none");
    expect(universalFocus.inputShadow).toBe("none");
    expect(universalFocus.pillBorder).not.toBe(restingPillBorder);
    expect(universalFocus.pillShadow).not.toBe("none");

    const menu = await openMobileClinicalGuideMenu(page);
    const closeMenu = menu.getByRole("button", { name: "Close Clinical Guide menu" });
    const newChat = menu.getByRole("button", { name: "New chat" });
    const restingButtonShadow = await newChat.evaluate((element) => getComputedStyle(element).boxShadow);
    await closeMenu.focus();
    await page.keyboard.press("Tab");
    // Firefox includes scrollable containers in the tab order; the sheet body
    // (overflow-y-auto) sits between Close and "New chat" in DOM order and
    // genuinely overflows at this viewport. Step over it when focused.
    const onScrollableBody = await page.evaluate(() => {
      const element = document.activeElement;
      return element instanceof HTMLElement && element.classList.contains("overflow-y-auto");
    });
    if (onScrollableBody) await page.keyboard.press("Tab");
    await expect(newChat).toBeFocused();
    const buttonFocus = await newChat.evaluate((element) => {
      const style = getComputedStyle(element);
      return { outlineStyle: style.outlineStyle, boxShadow: style.boxShadow };
    });
    expect(buttonFocus.outlineStyle).toBe("solid");
    expect(buttonFocus.boxShadow).toBe(restingButtonShadow);

    const chatSearch = menu.getByRole("searchbox", { name: "Search recent chats" });
    await chatSearch.focus();
    const fieldFocus = await chatSearch.evaluate((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const outlineWidth = Number.parseFloat(style.outlineWidth);
      const outlineOffset = Number.parseFloat(style.outlineOffset);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth,
        outlineOffset,
        paintedTop: rect.top - outlineOffset - outlineWidth,
        paintedRight: rect.right + outlineOffset + outlineWidth,
        paintedBottom: rect.bottom + outlineOffset + outlineWidth,
        paintedLeft: rect.left - outlineOffset - outlineWidth,
        rect: { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left },
      };
    });
    expect(fieldFocus.outlineStyle).toBe("solid");
    expect(fieldFocus.outlineWidth).toBeGreaterThanOrEqual(2);
    expect(fieldFocus.outlineOffset).toBeLessThan(0);
    expect(fieldFocus.paintedTop).toBeGreaterThanOrEqual(fieldFocus.rect.top);
    expect(fieldFocus.paintedRight).toBeLessThanOrEqual(fieldFocus.rect.right);
    expect(fieldFocus.paintedBottom).toBeLessThanOrEqual(fieldFocus.rect.bottom);
    expect(fieldFocus.paintedLeft).toBeGreaterThanOrEqual(fieldFocus.rect.left);
    await expectNoPageHorizontalOverflow(page);
  });

  test("desktop sidebar defaults to the labelled state for new users", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockDemoApi(page);
    await gotoApp(page, "/?mode=answer");
    await waitForDemoDashboardReady(page);

    // No stored preference (PT-10): eight icon-only destinations demand recall,
    // so first-run desktop shows the labelled sidebar; collapse is remembered.
    await expect(page.locator("#clinical-tools-sidebar")).toBeVisible();
    await expect(page.getByRole("button", { name: "Collapse sidebar" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Expand sidebar" })).toHaveCount(0);
  });

  test("desktop sidebar mode sync and accessibility affordances stay coherent", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockDemoApi(page);
    // This journey exercises the remembered-collapsed rail; new users now
    // default to the labelled sidebar, so seed the stored preference.
    await page.addInitScript(() => window.localStorage.setItem("clinical-kb-sidebar-collapsed", "1"));
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
    await gotoApp(page, "/?mode=answer");
    await waitForDemoDashboardReady(page);

    await expect(page.getByRole("button", { name: "Open Clinical Guide menu" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Expand sidebar" })).toHaveCount(0);
    // With the labelled default the expanded panel exists in the DOM but stays
    // display:none below lg; tablet must still only present the icon rail.
    await expect(page.locator("#clinical-tools-sidebar")).toBeHidden();
    await expect(page.getByLabel("Clinical Guide collapsed sidebar")).toBeVisible();

    for (const tool of [
      { name: "Answer", href: "/?mode=answer" },
      { name: "Documents", href: "/?mode=documents" },
      { name: "Services", href: "/services" },
      // The rail speaks the catalogue-maturity badge as part of the Forms name.
      { name: "Forms (Early access)", href: "/forms" },
      { name: "Tools", href: "/?mode=tools" },
      { name: "Therapy mode", href: "/therapy-compass" },
      // Demo mode still exposes Favourites via the account-library rail entry.
      { name: "Favourites", href: "/favourites" },
    ] as const) {
      await expect(page.getByRole("link", { name: tool.name, exact: true })).toHaveAttribute("href", tool.href);
    }
    // Specialist catalogues stay out of the persistent rail (MODE picker / Tools hub).
    await expect(page.getByRole("link", { name: "Differentials", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Medication", exact: true })).toHaveCount(0);

    await expectNoPageHorizontalOverflow(page);
  });

  test("tablet rail highlights the active tool for key routes", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await mockDemoApi(page);

    for (const route of [
      { path: "/?mode=answer", label: "Answer" },
      { path: "/?mode=documents", label: "Documents" },
      { path: "/favourites", label: "Favourites" },
      { path: "/?mode=tools", label: "Tools" },
      { path: "/therapy-compass", label: "Therapy mode" },
    ] as const) {
      await gotoApp(page, route.path);
      if (route.path.includes("mode=answer")) {
        await waitForDemoDashboardReady(page);
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
    // the *.supabase.co image origin) silently breaks every image
    // while all other tests still pass. Assert the actual served headers.
    const response = await page.request.get("/");
    expect(response.status()).toBe(200);
    const headers = response.headers();

    expect(headers["cross-origin-embedder-policy"]).toBeUndefined();

    const csp = headers["content-security-policy"] ?? "";
    expect(csp).toContain("img-src");
    const imgSrc = csp.split(";").find((directive) => directive.trim().startsWith("img-src"));
    expect(imgSrc).toContain("https://*.supabase.co");
    expect(imgSrc?.trim().split(/\s+/)).not.toContain("https:");
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
    // Exercises both collapsed and expanded account affordances; seed the
    // remembered-collapsed preference now that new users default to labelled.
    await page.addInitScript(() => window.localStorage.setItem("clinical-kb-sidebar-collapsed", "1"));
    await gotoApp(page, "/");
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

  test("offline browser gate remains in demo mode when private endpoints are mocked", async ({ page }) => {
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
    await expect(page.getByRole("button", { name: "Generate source-backed answer" })).toBeEnabled();
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
    await expect(page.getByTestId("app-mode-menu-sheet")).toHaveCount(0);
    await expectNoPageHorizontalOverflow(page);
  });

  test("phone mode menu opens as a scrollable bottom sheet with the full mode list", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockPrivateUnauthenticatedApi(page);
    await gotoApp(page, "/");
    await waitForDemoDashboardReady(page);

    const appModeTrigger = page.getByRole("button", { name: "Mode Answer" });
    await waitForReactEventHandler(appModeTrigger, "onClick");
    await appModeTrigger.click();

    const modeSheet = page.getByTestId("app-mode-menu-sheet");
    const appModeMenu = page.getByRole("menu", { name: "Choose app mode" });
    await expect(modeSheet).toBeVisible();
    await expect(modeSheet).toHaveAttribute("role", "dialog");
    await expect(appModeMenu).toBeVisible();
    await expect(appModeTrigger).toHaveAttribute("aria-expanded", "true");
    await expect(appModeTrigger).toHaveAttribute("aria-controls", "app-mode-menu");

    // Full list must be present (not clipped out of the DOM by the old max-height panel).
    const modeOptions = appModeMenu.getByRole("menuitemradio");
    expect(await modeOptions.count()).toBeGreaterThanOrEqual(10);
    await expect(appModeMenu.getByRole("menuitemradio", { name: /^Tools\b/ })).toBeAttached();
    await expect(appModeMenu.getByRole("menuitemradio", { name: /^Medication\b/ })).toBeAttached();

    // Scroll the sheet body so a lower mode is interactable, then select it.
    const toolsMode = appModeMenu.getByRole("menuitemradio", { name: /^Tools\b/ });
    await toolsMode.scrollIntoViewIfNeeded();
    await expect(toolsMode).toBeVisible();
    await toolsMode.click();

    await expect(modeSheet).toHaveCount(0);
    await expect(appModeMenu).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Mode Tools" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mode Tools" })).toBeFocused();
    await expectNoPageHorizontalOverflow(page);
  });

  test("phone mode menu dismisses via backdrop and restores focus to the Mode button", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockPrivateUnauthenticatedApi(page);
    await gotoApp(page, "/");
    await waitForDemoDashboardReady(page);

    const appModeTrigger = page.getByRole("button", { name: "Mode Answer" });
    await waitForReactEventHandler(appModeTrigger, "onClick");
    await appModeTrigger.click();

    const modeSheet = page.getByTestId("app-mode-menu-sheet");
    await expect(modeSheet).toBeVisible();

    // Click the dimmed backdrop (outside the dialog panel) to dismiss.
    await page
      .locator(".fixed.inset-0.z-\\[100\\]")
      .first()
      .click({ position: { x: 8, y: 8 } });
    await expect(modeSheet).toHaveCount(0);
    await expect(appModeTrigger).toBeFocused();
    await expect(appModeTrigger).toHaveAttribute("aria-expanded", "false");
  });

  test("desktop mode action placement coalesces scroll updates per frame", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockPrivateUnauthenticatedApi(page);
    await gotoApp(page, "/");
    await waitForDemoDashboardReady(page);

    const trigger = page.getByRole("button", { name: "Open answer options" });
    await trigger.evaluate((element) => {
      const originalGetBoundingClientRect = element.getBoundingClientRect.bind(element);
      element.dataset.placementReadCount = "0";
      element.getBoundingClientRect = () => {
        element.dataset.placementReadCount = String(Number(element.dataset.placementReadCount ?? "0") + 1);
        return originalGetBoundingClientRect();
      };
    });

    await openDailyActions(page, "Open answer options");
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    await trigger.evaluate((element) => {
      element.dataset.placementReadCount = "0";
    });

    const placementReads = await page.evaluate(async () => {
      for (let index = 0; index < 20; index += 1) {
        window.dispatchEvent(new Event("scroll"));
      }
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const triggerElement = document.querySelector<HTMLElement>('button[aria-label="Open answer options"]');
      return Number(triggerElement?.dataset.placementReadCount ?? "0");
    });

    expect(placementReads).toBeLessThanOrEqual(1);
  });

  test("demo answer flow reaches a source-backed answer @critical", async ({ browserName, page }) => {
    await page.setViewportSize({ width: 390, height: 820 });
    await mockDemoApi(page);
    await gotoApp(page, "/");
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

    // Safety findings are MANDATORY for this clozapine fixture — the answer is saturated
    // with monitoring/FBC-ANC/metabolic/myocarditis language that extractSafetyFindings
    // keys on. A regression that drops them (so the trigger never mounts — it only renders
    // when safetyFindings.length > 0, see answer-result-surface.tsx) must FAIL this
    // @critical smoke, not pass silently on an absent trigger (audit F3 / C6). Asserting
    // the trigger is visible unconditionally enforces "safety findings present".
    const safetyFindingsTrigger = page.getByTestId("answer-safety-findings-trigger");
    await expect(safetyFindingsTrigger).toBeVisible();
    await expectMinTouchTarget(safetyFindingsTrigger);
    await safetyFindingsTrigger.click();
    const safetyFindingsSheet = page.getByRole("dialog", { name: "Safety-critical source findings" });
    await expect(safetyFindingsSheet).toBeVisible();
    await expect(safetyFindingsSheet.getByTestId("safety-findings-panel")).toBeVisible();
    expect(await safetyFindingsSheet.getByTestId("safety-finding-row").count()).toBeGreaterThan(0);
    await safetyFindingsSheet.getByRole("button", { name: "Close safety findings" }).click();
    await expect(safetyFindingsSheet).toHaveCount(0);
    await expect(safetyFindingsTrigger).toBeFocused();

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
      const reopenedTableDialog = await openMobileTableFullscreen(page, clinicalTable);
      await reopenedTableDialog.getByRole("button", { name: "Close full-screen table" }).click();
      await expect(reopenedTableDialog).toBeHidden();
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
    const essentialsTab = clinicalNotesSheet.getByRole("tab", { name: /Essentials/ });
    const actionsTab = clinicalNotesSheet.getByRole("tab", { name: /Actions/ });
    const safetyTab = clinicalNotesSheet.getByRole("tab", { name: /Safety/ });
    await expect(essentialsTab).toBeVisible();
    await expect(actionsTab).toBeVisible();
    await expect(safetyTab).toBeVisible();
    await expect(actionsTab).toHaveAttribute("aria-selected", "true");
    await actionsTab.focus();
    await page.keyboard.press("ArrowRight");
    await expect(safetyTab).toBeFocused();
    await expect(safetyTab).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowLeft");
    await expect(actionsTab).toBeFocused();
    await expect(actionsTab).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Home");
    await expect(essentialsTab).toBeFocused();
    await expect(essentialsTab).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("End");
    await expect(safetyTab).toBeFocused();
    await expect(safetyTab).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowLeft");
    await expect(actionsTab).toBeFocused();
    await expect(actionsTab).toHaveAttribute("aria-selected", "true");
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

  for (const viewport of [
    { name: "desktop", width: 1280, height: 900 },
    { name: "390x844 mobile", width: 390, height: 844 },
  ] as const) {
    test(`actual answer Copy control preserves ordinary prose at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await mockDemoApi(page, {
        answerOverride: (query, documentId, documentIds) => ({
          ...demoAnswer(query, documentId, documentIds),
          visualEvidence: [],
        }),
      });
      await installClipboardMock(page);
      await gotoApp(page, "/");
      await waitForDemoDashboardReady(page);

      await fillVisibleQuestionInput(page, "What lithium toxicity symptoms need review?");
      await visibleAnswerSubmitButton(page).click();
      const answerSurface = page.getByTestId("plain-answer-response");
      await expect(answerSurface).toBeVisible({ timeout: uiAssertionTimeoutMs });
      await answerSurface.getByRole("button", { name: "Copy answer with source status" }).click();

      const copiedText = await page.evaluate(() => navigator.clipboard.readText());
      expect(copiedText).toContain("toxicity safety-net review");
      expect(copiedText).toContain("Sources for review");
      expect(copiedText).not.toContain("Clinical tables");
    });

    test(`actual answer Copy control matches the visible clinical table at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await mockDemoApi(page, {
        answerOverride: (query, documentId, documentIds) => {
          const base = demoAnswer(query, documentId, documentIds);
          const table = base.visualEvidence?.[0];
          if (!table) return base;
          const secondTable = {
            ...table,
            id: `${table.id}-second`,
            image_id: `${table.image_id}-second`,
            source_chunk_id: base.sources[1]?.id ?? table.source_chunk_id,
            viewer_href: "/documents/second-table?page=7&chunk=second-table-chunk",
            title: "Synthetic metabolic monitoring guideline",
            page_number: 7,
            tableTitle: "Metabolic monitoring",
            tableColumns: ["Parameter", "Timing"],
            tableRows: [["HbA1c", "At baseline and review"]],
          };
          return {
            ...base,
            sourceGovernanceWarnings: [
              {
                code: "review_due_source" as const,
                severity: "warning" as const,
                message: "One or more supporting sources are due for review.",
              },
            ],
            visualEvidence: [
              {
                ...table,
                tableTitle: "ANC actions",
                tableColumns: ["ANC range", "", "Action"],
                tableRows: [
                  ["1.0–1.5 × 10⁹/L", "", "Increase monitoring"],
                  ["<1.0 × 10⁹/L", "", "Withhold and seek specialist advice"],
                ],
              },
              secondTable,
            ],
          };
        },
      });
      await installClipboardMock(page);
      await gotoApp(page, "/");
      await waitForDemoDashboardReady(page);

      await fillVisibleQuestionInput(page, "What clozapine monitoring items are shown in the table image?");
      await visibleAnswerSubmitButton(page).click();
      const firstTable = page.getByRole("table", { name: "ANC actions" });
      const secondTable = page.getByRole("table", { name: "Metabolic monitoring" });
      await expect(firstTable).toBeVisible({ timeout: uiAssertionTimeoutMs });
      await expect(firstTable).toContainText("1.0–1.5 × 10⁹/L");
      await expect(firstTable).toContainText("Withhold and seek specialist advice");
      await expect(secondTable).toBeVisible({ timeout: uiAssertionTimeoutMs });
      await expect(secondTable).toContainText("HbA1c");
      await expect(secondTable).toContainText("At baseline and review");
      await expect(page.getByTestId("canonical-table-caveat")).toContainText("headers are incomplete");

      const answerSurface = page.getByTestId("plain-answer-response");
      await answerSurface.getByRole("button", { name: "Copy answer with source status" }).click();
      const copiedText = await page.evaluate(() => navigator.clipboard.readText());
      expect(copiedText).toContain("ANC range | [header missing] | Action");
      expect(copiedText).toContain("1.0–1.5 × 10⁹/L | [blank] | Increase monitoring");
      expect(copiedText).toContain("<1.0 × 10⁹/L | [blank] | Withhold and seek specialist advice");
      expect(copiedText).toContain("Table headers are incomplete");
      expect(copiedText).toContain("One or more supporting sources are due for review.");
      expect(copiedText).toContain("Source: Synthetic clozapine monitoring protocol with image evidence, page 2");
      expect(copiedText).toContain("Metabolic monitoring");
      expect(copiedText).toContain("Parameter | Timing");
      expect(copiedText).toContain("HbA1c | At baseline and review");
    });
  }

  for (const viewport of [
    { name: "mobile", width: 390, height: 844 },
    { name: "200% zoom equivalent", width: 640, height: 450 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1280, height: 900 },
  ] as const) {
    test(`privacy warnings and links are available before clinical input at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await mockDemoApi(page);
      await gotoApp(page, "/");
      await waitForDemoDashboardReady(page);

      const composer = visibleQuestionInput(page);
      const composerForm = composer.locator("xpath=ancestor::form[1]");
      const composerWarning = composerForm.getByText("Do not enter patient-identifiable information.");
      await expect(composerForm.getByRole("note")).toBeVisible();
      const composerPrivacyLink = composerForm.getByRole("link", { name: "Privacy and data processing" });
      await expect(composerWarning).toBeVisible();
      await expect(composerPrivacyLink).toBeVisible();
      await composerPrivacyLink.focus();
      await expect(composerPrivacyLink).toBeFocused();

      await page.goto("/privacy", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.getByRole("heading", { level: 1, name: "Privacy & data handling" })).toBeVisible();
      await expect(page.getByText("This is draft product information", { exact: false })).toBeVisible();
      await expectNoPageHorizontalOverflow(page);
    });
  }

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

  // Regression for PR #563: on phones a rendered answer must be content-sized and
  // top-aligned, NOT inherit the centred-home viewport-height floor. Otherwise a
  // short answer stretches the section to ~full height and `main` scrolls down into
  // the near-black shell; the fixed composer reserve must also hug the real dock.
  test("phone short answer stays top-aligned with no phantom scroll into black", async ({ page }) => {
    // Tall phone viewport so the deliberately short answer comfortably fits — that
    // is the whole point: content shorter than the viewport must not scroll.
    await page.setViewportSize({ width: 390, height: 900 });
    await mockDemoApi(page, {
      // Keep this a genuinely short answer as the shared answer contract grows:
      // rich support, safety, and related-document fields are covered elsewhere.
      answerOverride: (query, documentId, documentIds) => {
        const base = demoAnswer(query, documentId, documentIds);
        return {
          ...base,
          answer: "Verify the cited passages before using any clinical numbers.",
          answerSections: [],
          visualEvidence: [],
          quoteCards: [],
          documentBreakdown: [],
          evidenceSummary: undefined,
          sourceCoverage: undefined,
          conflictsOrGaps: [],
          bestSource: undefined,
          smartPanel: undefined,
          relatedDocuments: [],
          sources: base.sources.map((source) => ({
            ...source,
            content: "This indexed passage directly supports the short answer.",
          })),
        };
      },
    });
    await gotoApp(page, "/");
    await waitForDemoDashboardReady(page);

    await fillVisibleQuestionInput(page, "lithium dosing");
    await visibleAnswerSubmitButton(page).click();
    await expect(page.getByTestId("plain-answer-response")).toBeVisible({ timeout: 15_000 });
    // Wait for streaming to finish (deterministic) so the geometry below reads the
    // final, settled layout — replaces a fixed 400ms sleep.
    await expect(page.getByTestId("answer-streaming")).toHaveCount(0);

    const geo = await page.evaluate(() => {
      const main = document.querySelector("main#main-content");
      const header = document.querySelector("header");
      const surface = document.querySelector('[data-dashboard-stage="answer-surface"]');
      const alsoMatches = document.querySelector('[data-testid="universal-also-matches"]');
      return {
        scrollHeight: main?.scrollHeight ?? 0,
        clientHeight: main?.clientHeight ?? 0,
        headerBottom: header ? Math.round(header.getBoundingClientRect().bottom) : 0,
        surfaceTop: surface ? Math.round(surface.getBoundingClientRect().top) : 0,
        alsoMatchesHeight: alsoMatches ? Math.ceil(alsoMatches.getBoundingClientRect().height) : 0,
      };
    });
    // Content-sized section => no unexplained phantom scroll. Submitted universal
    // matches are real content below the answer, so their compact panel may account
    // for the overflow; the old viewport floor created much more empty scroll.
    const permittedOverflow = geo.alsoMatchesHeight > 0 ? geo.alsoMatchesHeight + 24 : 4;
    expect(geo.scrollHeight - geo.clientHeight).toBeLessThanOrEqual(permittedOverflow);
    // Top-aligned: the answer sits just under the header, not pushed toward the dock
    // (a bottom-anchor regression would push surfaceTop far down the viewport).
    expect(geo.surfaceTop - geo.headerBottom).toBeGreaterThanOrEqual(0);
    expect(geo.surfaceTop - geo.headerBottom).toBeLessThanOrEqual(160);
    await expectNoPageHorizontalOverflow(page);
  });

  test("phone long answer stays scrollable and clear of the composer dock", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 760 });
    const longBody = Array.from(
      { length: 16 },
      (_, index) =>
        `Paragraph ${index + 1}: the lithium source supports baseline renal, thyroid, calcium, weight, blood pressure and interacting-medicine checks, plus escalation for vomiting, diarrhoea, dehydration, tremor, confusion or ataxia.`,
    ).join("\n\n");
    await mockDemoApi(page, {
      answerOverride: (query, documentId, documentIds) => ({
        ...demoAnswer(query, documentId, documentIds),
        answer: longBody,
      }),
    });
    await gotoApp(page, "/");
    await waitForDemoDashboardReady(page);

    await fillVisibleQuestionInput(page, "lithium dosing");
    await visibleAnswerSubmitButton(page).click();
    await expect(page.getByTestId("plain-answer-response")).toBeVisible({ timeout: 15_000 });
    // Wait for streaming to finish (deterministic) so the geometry below reads the
    // final, settled layout — replaces a fixed 400ms sleep.
    await expect(page.getByTestId("answer-streaming")).toHaveCount(0);
    // Apply the Safari toolbar simulation after answer navigation has settled;
    // the submit flow may update the URL and replace earlier document styles.
    await page.evaluate(() => {
      document.documentElement.style.setProperty("--safe-area-bottom", "112px");
    });
    const main = page.locator("main#main-content");
    const bottomDock = page.locator("form.answer-footer-search-dock");
    // Start from the top so the assertions describe the resting, top-aligned
    // view and the hide reporter has observed the restored position.
    await scrollPrimarySurface(page, 0);
    await expect(bottomDock).not.toHaveAttribute("data-scroll-hidden", "true");
    await expect
      .poll(async () => main.evaluate((el) => Number.parseFloat(window.getComputedStyle(el).paddingBottom)))
      .toBeGreaterThan(200);

    const geo = await page.evaluate(() => {
      const main = document.querySelector("main#main-content");
      const header = document.querySelector("header");
      const surface = document.querySelector('[data-dashboard-stage="answer-surface"]');
      return {
        scrollHeight: main?.scrollHeight ?? 0,
        clientHeight: main?.clientHeight ?? 0,
        mainBottom: main ? Math.round(main.getBoundingClientRect().bottom) : 0,
        mainMarginBottom: main ? Number.parseFloat(window.getComputedStyle(main).marginBottom) : -1,
        mainPaddingBottom: main ? Number.parseFloat(window.getComputedStyle(main).paddingBottom) : 0,
        viewportHeight: window.innerHeight,
        headerBottom: header ? Math.round(header.getBoundingClientRect().bottom) : 0,
        surfaceTop: surface ? Math.round(surface.getBoundingClientRect().top) : 0,
      };
    });
    // A long answer overflows and scrolls, still top-aligned under the header.
    expect(geo.scrollHeight).toBeGreaterThan(geo.clientHeight + 40);
    expect(geo.surfaceTop - geo.headerBottom).toBeLessThanOrEqual(160);
    // The scrollport itself remains edge-to-edge. Its content padding—not an
    // outer margin—keeps the answer endpoint clear of the visible composer and
    // Safari toolbar.
    const composerInputTop = await visibleQuestionInput(page).evaluate((el) =>
      Math.round(el.getBoundingClientRect().top),
    );
    expect(geo.mainMarginBottom).toBe(0);
    expect(Math.abs(geo.mainBottom - geo.viewportHeight)).toBeLessThanOrEqual(1);
    expect(geo.mainPaddingBottom).toBeGreaterThan(112);
    expect(geo.mainPaddingBottom + 4).toBeGreaterThanOrEqual(geo.mainBottom - composerInputTop);

    // Once the fixed dock is actually hidden, release both the composer and
    // Safari toolbar reserve. The scrollport dimensions stay stable while its
    // bottom padding contracts; the bottom-clamp guard must keep the dock from
    // immediately reappearing as a false upward gesture. Do not compare total
    // scrollHeight here because universal matches can finish streaming while
    // this test moves the scrollport.
    const scrollGeometryBeforeHide = await main.evaluate((el) => ({
      clientHeight: el.clientHeight,
      paddingBottom: Number.parseFloat(window.getComputedStyle(el).paddingBottom),
    }));
    // WebKit retains focus on the submitted composer more aggressively than
    // Chromium. Move focus to the scroll surface to model the user dismissing
    // the composer before scrolling; focused composer chrome must stay visible.
    await expect(async () => {
      await main.focus();
      await scrollPrimarySurface(page, 0);
      await expect(bottomDock).not.toHaveAttribute("data-scroll-hidden", "true", { timeout: 1_000 });
      for (const offset of [120, 240, 360]) {
        await scrollPrimarySurface(page, offset);
      }
      await expect(bottomDock).toHaveAttribute("data-scroll-hidden", "true", { timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await expect
      .poll(async () => main.evaluate((el) => Number.parseFloat(window.getComputedStyle(el).paddingBottom)))
      .toBeLessThanOrEqual(13);
    const scrollGeometryAfterHide = await main.evaluate((el) => ({
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      paddingBottom: Number.parseFloat(window.getComputedStyle(el).paddingBottom),
    }));
    expect(scrollGeometryBeforeHide.paddingBottom).toBeGreaterThan(200);
    expect(scrollGeometryAfterHide.clientHeight).toBe(scrollGeometryBeforeHide.clientHeight);
    expect(scrollGeometryAfterHide.scrollHeight).toBeGreaterThan(scrollGeometryAfterHide.clientHeight);
    await expect(bottomDock).toHaveAttribute("data-scroll-hidden", "true");
    await expectNoPageHorizontalOverflow(page);
  });

  test("recent searches appear on the answer home and re-run on tap", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const answerRequests: string[] = [];
    await mockDemoApi(page, { onAnswerRequest: (query) => answerRequests.push(query) });
    const recent = "clozapine monitoring schedule";
    // Seed the owner-scoped session history before the app loads.
    await page.addInitScript(
      ({ storageKey, value }) => {
        window.sessionStorage.setItem(storageKey, JSON.stringify([value]));
      },
      { storageKey: demoRecentQueryStorageKey, value: recent },
    );
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

  test("legacy unscoped recent-query storage is purged and never displayed @critical", async ({ page }) => {
    // 2026-07-13 audit finding 4: a historical clinical query written by an
    // older build into the unscoped localStorage key must not resurface for
    // whoever uses the browser next, and must be deleted on load.
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockDemoApi(page);
    const legacyQuery = "legacy cross-user clozapine query";
    await page.addInitScript(
      ({ storageKey, value }) => {
        window.localStorage.setItem(storageKey, JSON.stringify([value]));
        window.sessionStorage.setItem(storageKey, JSON.stringify([value]));
      },
      { storageKey: recentQueryStorageKey, value: legacyQuery },
    );
    await gotoApp(page, "/");
    await waitForDemoDashboardReady(page);

    await expect(page.getByText(legacyQuery)).toHaveCount(0);
    await expect.poll(() => page.evaluate((key) => window.localStorage.getItem(key), recentQueryStorageKey)).toBeNull();
    await expect
      .poll(() => page.evaluate((key) => window.sessionStorage.getItem(key), recentQueryStorageKey))
      .toBeNull();
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

  test("stopping generation exposes a stable rerun action without answer output", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockDemoApi(page, { answerDelayMs: 1500 });
    const question = "What monitoring is required for clozapine?";
    await page.goto(`/?mode=answer&q=${encodeURIComponent(question)}&run=1`, { waitUntil: "domcontentloaded" });

    const stop = page.getByTestId("stop-answer");
    await expect(stop).toBeVisible();
    await stop.focus();
    await page.keyboard.press("Enter");

    const cancelled = page.getByTestId("answer-cancelled");
    await expect(cancelled).toContainText("Generation stopped");
    await expect(cancelled.getByRole("button", { name: "Run again" })).toBeVisible();
    await expect(page.getByTestId("plain-answer-response")).toHaveCount(0);
    await expect(page.getByTestId("answer-streaming")).toHaveCount(0);
    // Intentional fixed wait: this asserts a NEGATIVE (no answer streams in after
    // Stop), so there is no event to await — we give a late async render time to
    // (wrongly) appear, then confirm it did not.
    await page.waitForTimeout(1700);
    await expect(page.getByTestId("plain-answer-response")).toHaveCount(0);
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
    await waitForReactEventHandler(medicationLink, "onClick");
    await medicationLink.click();
    await expect(page).toHaveURL(/\/medications\/clozapine/, { timeout: 45_000 });
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
    { name: "390px mobile", width: 390, height: 844, expands: true },
    { name: "768px tablet", width: 768, height: 1024, expands: true },
    { name: "1280px desktop", width: 1280, height: 800, expands: false },
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
      const tableSurface = clinicalTable.getByTestId("accessible-table-surface");
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

      await expect(tableSurface).not.toHaveAttribute("role", "button");
      await expect(tableSurface).not.toHaveAttribute("tabindex");
      await expect(expandButton).toHaveAttribute("aria-expanded", "false");
      await page.keyboard.press("Escape");
      const surfaceDialog = await openMobileTableFullscreen(page, clinicalTable);
      await expect(expandButton).toHaveAttribute("aria-expanded", "true");
      await expect(surfaceDialog.getByRole("button", { name: "Close full-screen table" })).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      expect(await surfaceDialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
      await page.keyboard.press("Tab");
      expect(await surfaceDialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
      await expect(surfaceDialog).toContainText("FBC/ANC");
      await page.keyboard.press("Escape");
      await expect(surfaceDialog).toBeHidden();
      await expect(expandButton).toHaveAttribute("aria-expanded", "false");

      await expect(expandButton).toBeVisible();
      const dialog = await openMobileTableFullscreen(page, clinicalTable);
      await expect(dialog.getByRole("table")).toBeVisible();
      await expect(dialog).toContainText("FBC/ANC");
      await expect(dialog).not.toContainText(/page|p\.|chunk|Synthetic clozapine monitoring protocol/i);
      const modal = page.getByRole("dialog", { name: /clozapine monitoring/i });
      await expect(modal).toBeVisible();
      await page.keyboard.press("Shift+Tab");
      expect(await modal.evaluate((element) => element.contains(document.activeElement))).toBe(true);
      await page.keyboard.press("Tab");
      expect(await modal.evaluate((element) => element.contains(document.activeElement))).toBe(true);
      await expectNoPageHorizontalOverflow(page);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(expandButton).toBeFocused();
    });
  }

  test("dashboard favourites mode param redirects to the standalone favourites route", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockDemoApi(page);
    const redirectMeasureErrors: string[] = [];
    page.on("pageerror", (error) => {
      if (error.message.includes("cannot have a negative time stamp")) redirectMeasureErrors.push(error.message);
    });
    await gotoApp(page, "/?mode=favourites&q=lithium%20set&focus=1");

    await expect(page).toHaveURL(/\/favourites\?q=lithium\+set&focus=1$/);
    await expect(page.getByTestId("favourites-hub")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Favourites command library" })).toBeVisible();
    expect(redirectMeasureErrors).toEqual([]);
  });

  test("dashboard differentials mode param redirects to the standalone differentials route", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockDemoApi(page);
    await gotoApp(page, "/?mode=differentials&q=acute+confusion&focus=1");

    await expect(page).toHaveURL(/\/differentials\?q=acute\+confusion&focus=1$/);
    await expect(page.getByTestId("differentials-home")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Differentials" })).toBeVisible();
  });

  test("DSM diagnosis mode redirects into the local catalogue and opens a diagnosis", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockDemoApi(page);
    await gotoApp(page, "/?mode=dsm&q=major+depressive&focus=1&run=1");

    await expect(page).toHaveURL(/\/dsm\/search\?q=major\+depressive&focus=1&run=1$/, {
      timeout: 30_000,
    });
    await expect(page.getByTestId("dsm-search-page")).toBeVisible();

    const result = page.getByTestId("dsm-search-result").filter({ hasText: "Major depressive disorder" });
    await expect(result).toBeVisible();
    await expectMinTouchTarget(result.getByRole("button", { name: "Add Major depressive disorder to comparison" }));
    await expectMinTouchTarget(result.getByRole("link", { name: "Open Major depressive disorder" }));

    await result.getByRole("link", { name: "Open Major depressive disorder" }).click();
    await expect(page).toHaveURL(/\/dsm\/diagnoses\/major-depressive-disorder$/, { timeout: 30_000 });
    await expect(page.getByTestId("dsm-diagnosis-page")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Major depressive disorder" })).toBeVisible();
    await expect(page.getByRole("link", { name: "DSM-5 Diagnosis home" })).toHaveAttribute("href", "/dsm");
    await expectNoPageHorizontalOverflow(page);
  });

  test("DSM category filter dropdown opens to the correct option by keyboard", async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 850 });
    await mockDemoApi(page);
    await gotoApp(page, "/dsm/search?q=depression");

    await expect(page.getByTestId("dsm-search-page")).toBeVisible();
    const trigger = page.getByTestId("dsm-category-filter");
    const options = page.getByRole("menuitemradio");

    // ArrowUp opens the menu with focus on the LAST option (reverse entry). This
    // guards against a regression where a competing focus-on-open effect raced
    // the key handler and stole focus back to the active item.
    await trigger.focus();
    await page.keyboard.press("ArrowUp");
    await expect(options.last()).toBeFocused();

    // Escape closes the menu and restores focus to the trigger.
    await page.keyboard.press("Escape");
    await expect(options.first()).toBeHidden();
    await expect(trigger).toBeFocused();

    // ArrowDown opens the menu with focus on the active option ("All categories").
    await page.keyboard.press("ArrowDown");
    await expect(options.first()).toBeFocused();
    await expect(options.first()).toHaveAttribute("aria-checked", "true");

    // Options sit outside the Tab sequence (tabIndex=-1), so one Tab press from a
    // non-final option leaves the whole widget in a single step and closes the
    // menu instead of stepping through every category link.
    await page.keyboard.press("Tab");
    await expect(options.first()).toBeHidden();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(options).toHaveCount(0);

    // Space activates the focused option (announced as a menuitemradio) even
    // though the underlying element is an anchor, applying the category filter.
    await trigger.focus();
    await page.keyboard.press("ArrowDown");
    await expect(options.first()).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(options.nth(1)).toBeFocused();
    await page.keyboard.press("Space");
    await expect(page).toHaveURL(/[?&]category=/);
  });

  test("dashboard specifiers mode param redirects to the standalone specifiers route", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockDemoApi(page);
    await gotoApp(page, "/?mode=specifiers&q=anxious+distress&focus=1&run=1");

    // /?mode=specifiers → /specifiers (Specifiers is its own mode, distinct from Formulation)
    await expect(page).toHaveURL(/\/specifiers\?q=anxious\+distress&focus=1&run=1$/);
    await expect(page.getByRole("heading", { level: 1, name: "Matches for “anxious distress”" })).toBeVisible();
  });

  test("dashboard formulation mode param redirects to the standalone formulation route", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockDemoApi(page);
    await gotoApp(page, "/?mode=formulation&q=I+keep+going+over+it&focus=1&run=1");

    await expect(page).toHaveURL(/\/formulation\?q=I\+keep\+going\+over\+it&focus=1&run=1$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Mechanisms matching “I keep going over it”" }),
    ).toBeVisible();
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
    let resolveCurrentResponse!: () => void;
    const currentResponseDelivered = new Promise<void>((resolve) => {
      resolveCurrentResponse = resolve;
    });
    await page.route(/\/api\/search$/, async (route) => {
      requestCount += 1;
      const currentRequest = requestCount;
      if (currentRequest === 1) await new Promise((resolve) => setTimeout(resolve, 500));
      const sourceCount = currentRequest === 1 ? 2 : 1;
      try {
        await route.fulfill({
          json: {
            documentMatches: Array.from({ length: sourceCount }, (_, index) => ({
              document_id: `00000000-0000-4000-8000-00000000000${index}`,
              title: `${currentRequest === 1 ? "Older" : "Current"} source ${index + 1}`,
              file_name: `source-${index + 1}.pdf`,
              score: 0.9 - index * 0.1,
            })),
          },
        });
        if (currentRequest > 1) resolveCurrentResponse();
      } catch (error) {
        if (currentRequest > 1) throw error;
      }
    });

    await page.goto("/differentials?q=acute+confusion&run=1", { waitUntil: "domcontentloaded" });
    await expect.poll(() => requestCount).toBeGreaterThanOrEqual(1);
    const baselineRequestCount = requestCount;
    await page.evaluate(() => {
      window.history.pushState(null, "", "/differentials?q=acute+confusion&run=1&scope.sourceStatuses=outdated");
    });

    await expect.poll(() => requestCount).toBeGreaterThan(baselineRequestCount);
    await currentResponseDelivered;
    const sourceStatus = page.getByRole("heading", { name: "Source status" }).locator("..");
    const singularSourceCount = sourceStatus.getByText("1 source", { exact: true });
    await expect(singularSourceCount).toBeVisible();
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
    // Override the shared registry fixture with the saved-service scenario.
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

  test("favourites command library exposes truthful item details and a keyboard-operable action menu", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1536, height: 900 });
    await mockDemoApi(page);
    await gotoApp(page, "/favourites");

    await expect(page.getByRole("heading", { name: "Favourites command library" })).toBeVisible();
    await expect(page.getByTestId("favourites-item-workspace")).toHaveCount(0);

    await page.getByTestId("favourite-row-lithium-monitoring-guideline").locator("button[aria-pressed]").click();
    const workspace = page.getByTestId("favourites-item-workspace");
    await expect(workspace).toBeVisible();
    await expect(workspace.getByRole("heading", { name: "Lithium monitoring guideline", level: 3 })).toBeVisible();

    await workspace.getByRole("button", { name: "Evidence" }).click();
    await expect(workspace).not.toContainText("BNF - Acamprosate");
    await workspace.getByRole("button", { name: "Notes" }).click();
    await expect(workspace).toContainText("No personal note is saved for this item.");

    const moreActions = page.getByRole("button", { name: "More actions for Lithium monitoring guideline" });
    await moreActions.focus();
    await page.keyboard.press("ArrowDown");
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem", { name: "Ask Lithium monitoring guideline" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(menu.getByRole("menuitem", { name: "Copy citation" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(menu.getByRole("menuitem", { name: "Copied" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(moreActions).toBeFocused();
  });

  test("favourites disable item selection below xl while keeping navigation and actions", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockDemoApi(page);
    await gotoApp(page, "/favourites");

    const hub = page.getByTestId("favourites-hub");
    await expect(hub.locator('article[role="button"]')).toHaveCount(0);
    const card = hub.locator("article").filter({ hasText: "Acamprosate renal screen" });
    const openItem = card.getByRole("link", { name: "Open Acamprosate renal screen" });
    const moreActions = card.getByRole("button", { name: "More actions for Acamprosate renal screen" });

    await expect(card).toBeVisible();
    await expect(card.locator("button[aria-pressed]")).toHaveCount(0);
    await expectMinTouchTarget(openItem);
    await expectMinTouchTarget(moreActions);
    await expectNoPageHorizontalOverflow(page);

    await page.setViewportSize({ width: 1180, height: 820 });
    const row = page.getByTestId("favourite-row-acamprosate-renal-screen");
    await expect(row).toBeVisible();
    await expect(row.locator("button[aria-pressed]")).toBeHidden();
    await expect(row.locator("td").first().getByRole("link")).toBeVisible();
    await expect(row.getByRole("link", { name: "Open Acamprosate renal screen" })).toBeVisible();
    await expect(row.getByRole("button", { name: "More actions for Acamprosate renal screen" })).toBeVisible();

    await page.setViewportSize({ width: 1536, height: 900 });
    const selectItem = row.locator("button[aria-pressed]");
    await expect(selectItem).toBeVisible();
    await selectItem.click();
    await expect(page.getByTestId("favourites-item-workspace")).toBeVisible();

    await page.setViewportSize({ width: 1180, height: 820 });
    await expect(page.getByTestId("favourites-item-workspace")).toBeHidden();
    await expect(selectItem).toBeHidden();
    await expect(row).not.toHaveClass(/(^|\s)bg-\[/);
    await expectNoPageHorizontalOverflow(page);
  });

  test("app mode menu supports keyboard navigation without removed prototype modes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockDemoApi(page);
    await gotoApp(page, "/?mode=answer");

    const appModeButton = page.getByRole("button", { name: "Mode Answer" });
    await waitForReactEventHandler(appModeButton, "onClick");
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
    await expect(appModeMenu.getByRole("menuitemradio", { name: /^DSM-5 Diagnosis\b/ })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(appModeMenu.getByRole("menuitemradio", { name: /^Specifiers\b/ })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(appModeMenu.getByRole("menuitemradio", { name: /^Formulation\b/ })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(appModeMenu.getByRole("menuitemradio", { name: /^Medication\b/ })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(appModeMenu.getByRole("menuitemradio", { name: /^Tools\b/ })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(appModeMenu).toBeHidden();
    await expect(appModeButton).toBeFocused();

    await appModeButton.click();
    await expect(appModeMenu).toBeVisible();
    await appModeMenu.getByRole("menuitemradio", { name: /^Answer\b/ }).focus();
    await page.keyboard.press("Tab");
    await expect(appModeMenu).toBeHidden();
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
    await gotoApp(page, "/?mode=prescribing&q=acamprosate%20renal%20dose&run=1");

    const globalSearchInput = page.getByTestId("global-search-input");
    await expect(page.getByRole("button", { name: "Mode Medication" })).toBeVisible({ timeout: 30_000 });
    await expect(globalSearchInput).toHaveAttribute("placeholder", "Search medication dosing or safety...");
    await expect(globalSearchInput).toHaveValue("acamprosate renal dose");

    const acamprosateResult = page.getByTestId("medication-result-acamprosate-desktop");
    await expect(acamprosateResult).toHaveAttribute("href", "/medications/acamprosate");
    await acamprosateResult.click();
    await expect(page).toHaveURL(/\/medications\/acamprosate$/, { timeout: 30_000 });
    await expectSingleMedicationPage(page);
    await expect(page.getByRole("link", { name: "Medications" })).toBeVisible();

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

    await acamprosateCard.click();
    await expect(page).toHaveURL(/\/medications\/acamprosate$/, { timeout: 30_000 });
    const backLink = page.getByRole("link", { name: "Back", exact: true });
    await expect(backLink).toBeVisible();
    await expectMinTouchTarget(backLink);
    await backLink.click();
    await expect(page).toHaveURL(/[?&]mode=prescribing/);
  });

  test("document search mode lists matching documents and scope actions @critical", async ({ page }) => {
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
    await expect(page.getByRole("region", { name: "Start here" })).toBeVisible();
    const searchInputBox = await visibleQuestionInput(page).boundingBox();
    const startHereBox = await page.getByRole("region", { name: "Start here" }).boundingBox();
    const documentsHeadingBox = await page.getByRole("main").getByRole("heading", { name: "Documents" }).boundingBox();
    expect(searchInputBox).not.toBeNull();
    expect(startHereBox).not.toBeNull();
    expect(documentsHeadingBox).not.toBeNull();
    expect((documentsHeadingBox?.y ?? 0) + (documentsHeadingBox?.height ?? 0)).toBeLessThan(searchInputBox?.y ?? 0);
    // Phones dock the compact composer at the bottom edge, below the hero content.
    expect(searchInputBox?.y ?? 0).toBeGreaterThan(startHereBox?.y ?? 0);
    await expect(page.locator('form.answer-footer-search-dock[data-footer-variant="compact"]')).toHaveCount(1);
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

    // The mode switch above is covered independently. Submit from the canonical
    // route so a dev-only cross-segment remount cannot abort the mocked POST.
    await gotoApp(page, "/documents/search?mode=documents");
    const questionInput = visibleQuestionInput(page);
    await expect(questionInput).toBeVisible();
    await waitForReactEventHandler(questionInput, "onChange");
    await questionInput.fill("lithium monitoring");
    await submitDocumentSearch(page);

    await expect(page).toHaveURL(/\/documents\/search\?.*q=lithium\+monitoring/);
    const documentWorkspace = page.getByTestId("document-search-workspace");
    await expect(documentWorkspace.getByRole("heading", { name: /document/i }).first()).toBeVisible();
    await expect(documentWorkspace.getByTestId("document-results-controls")).toBeVisible();
    const resultsControls = documentWorkspace.getByTestId("document-results-controls");
    await expect(resultsControls.getByLabel("Sort results")).toBeVisible();
    await expect(resultsControls.getByRole("button", { name: "Open document library" })).toBeVisible();
    await expect(documentWorkspace.getByText("Documents overview")).toHaveCount(0);
    await expect(documentWorkspace.getByRole("button", { name: /Browse library/i })).toHaveCount(0);
    await expect(page.getByTestId("cross-mode-links")).toHaveCount(0);
    await expect(page.getByText(/Also in your library/i)).toHaveCount(0);

    const documentResults = page.getByRole("article").filter({ hasText: "Synthetic Lithium Monitoring Protocol" });
    await expect(documentResults).toBeVisible();
    await expect(documentResults).toContainText("Best match");
    await expect(documentResults).toContainText("1 table");

    const typeFilters = resultsControls.getByLabel("Filter by result type");
    if ((await typeFilters.count()) > 0) {
      const tablesFilter = typeFilters.getByRole("button", { name: /Tables/i });
      await expect(tablesFilter).toBeVisible();
      await tablesFilter.click();
      await expect(tablesFilter).toHaveAttribute("aria-pressed", "true");
      await expect(documentResults).toBeVisible();
      await typeFilters.getByRole("button", { name: /^All/i }).click();
    }

    await resultsControls.getByLabel("Sort results").selectOption("alpha");
    await expect(page).toHaveURL(/[?&]sort=alpha/);
    await resultsControls.getByLabel("Sort results").selectOption("relevance");

    const openDocumentLink = documentResults
      .getByRole("link", { name: /Open Synthetic lithium monitoring protocol/i })
      .last();
    await expect(openDocumentLink).toBeVisible();
    // Exact viewer target built from mockDemoApi's lithium result (document_id / bestPages[0] /
    // bestChunkIds[0]): a link to the wrong document, page, or chunk must fail this assertion.
    await expect(openDocumentLink).toHaveAttribute(
      "href",
      "/documents/11111111-1111-4111-8111-111111111111?page=1&chunk=44444444-4444-4444-8444-444444444442",
    );
    await expect(page.getByRole("complementary", { name: "Selected document evidence" })).toBeVisible();
    await expectNoPageHorizontalOverflow(page);

    await resultsControls.getByRole("button", { name: "Open document library" }).click();
    const resultsLibraryDialog = page.getByRole("dialog", { name: "Source library" });
    await expect(resultsLibraryDialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(resultsLibraryDialog).toHaveCount(0);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(documentResults).toBeVisible();
    await expect(documentResults).toContainText("Best match");
  });

  test("dashboard defers source and administration requests until their surfaces open @critical", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockDemoApi(page);
    const requestCounts = { documents: 0, jobs: 0, batches: 0, quality: 0 };
    page.on("request", (request) => {
      const pathname = new URL(request.url()).pathname;
      if (pathname === "/api/documents") requestCounts.documents += 1;
      if (pathname === "/api/ingestion/jobs") requestCounts.jobs += 1;
      if (pathname === "/api/ingestion/batches") requestCounts.batches += 1;
      if (pathname === "/api/ingestion/quality") requestCounts.quality += 1;
    });

    await gotoApp(page, "/");
    await waitForDemoDashboardReady(page);
    expect(requestCounts).toEqual({ documents: 0, jobs: 0, batches: 0, quality: 0 });

    await openScopeControl(page);
    await expect.poll(() => requestCounts.documents).toBe(1);
    expect(requestCounts.jobs).toBe(0);
    expect(requestCounts.batches).toBe(0);
    expect(requestCounts.quality).toBe(0);
    await page.keyboard.press("Escape");

    await switchToDocumentSearchMode(page);
    await page
      .getByRole("button", { name: /Browse library/i })
      .first()
      .click();
    await expect.poll(() => requestCounts.documents).toBe(1);
    expect(requestCounts.jobs).toBe(0);
    expect(requestCounts.batches).toBe(0);
    expect(requestCounts.quality).toBe(0);
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
    const detailsButton = page
      .getByTestId("tools-hub")
      .getByRole("button", { name: "View details for Medication Prescribing" });
    await expect(detailsButton).toHaveAttribute("aria-haspopup", "dialog");
    await detailsButton.click();
    await expect(
      page.getByRole("dialog", { name: "Medication Prescribing" }).locator('a[href="/?mode=prescribing"]').first(),
    ).toBeVisible();
    await expectNoPageHorizontalOverflow(page);
  });

  test("services decision rail exposes only functional review and comparison actions", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockDemoApi(page);
    await gotoApp(page, "/services?q=mental%20health&focus=1&run=1");

    const navigator = page.getByRole("main");
    await expect(navigator).toBeVisible();
    await expect(navigator.getByRole("button", { name: "Edit" })).toHaveCount(0);
    const reviewDetails = navigator.getByRole("button", { name: "Review details" });
    await expect(reviewDetails).toBeEnabled();
    await reviewDetails.click();
    await expect(navigator.locator("#service-checklist-details")).toBeVisible();
    const viewDetails = navigator.getByRole("button", { name: "View details" });
    await expect(viewDetails).toBeEnabled();
    await viewDetails.click();
    await expect(navigator.locator("#service-confidence-details")).toBeVisible();
    const compare = navigator.getByRole("button", { name: /Compare selected/ });
    await expect(compare).toBeEnabled();
    await expect(compare).toHaveAttribute("title", "Compare selected services");
    await compare.click();
    await expect(navigator.getByRole("region", { name: "Selected service comparison" })).toBeVisible();
    const clear = navigator.getByRole("button", { name: "Clear", exact: true });
    await expect(clear).toBeEnabled();
    await clear.click();
    await expect(navigator.getByText("Selected services (0)")).toBeVisible();
    await expect(compare).toHaveAttribute("title", "Select at least two services before comparing");
  });

  test("search regressions avoid fetch errors and open viewer hits @critical", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockDemoApi(page);
    await gotoApp(page, "/");
    await waitForDemoDashboardReady(page);

    await gotoApp(page, "/documents/search?mode=documents");
    const questionInput = visibleQuestionInput(page);
    await expect(questionInput).toBeVisible();
    await waitForReactEventHandler(questionInput, "onChange");

    await questionInput.fill("what is the best coffee machine for my kitchen");
    await submitDocumentSearch(page);
    await expect(page).toHaveURL(/\/documents\/search\?/);
    await expect(page.locator("body")).not.toContainText(/failed to fetch|Search failed/i);
    await expect(page.getByRole("heading", { name: "No matching documents" }).first()).toBeVisible();

    const demoDocId = "11111111-1111-4111-8111-111111111111";
    await gotoApp(page, `/documents/${demoDocId}?chunk=44444444-4444-4444-8444-444444444442`);
    await expect(page).toHaveURL(/chunk=44444444-4444-4444-8444-444444444442/);
    await expect(page.locator("#source-evidence").getByTestId("highlighted-source-passage")).toContainText(
      "Escalate review when there is vomiting",
    );
    await expect(
      page.getByTestId("source-chunk-indexed-text-panel").getByTestId("highlighted-indexed-source-chunk"),
    ).toBeVisible();

    const sourceSearch = page.getByLabel("Search within indexed source text").last();
    await sourceSearch.fill("safety plan include");
    const desktopTextPanel = page.getByTestId("source-chunk-indexed-text-panel");
    await expect(desktopTextPanel.getByText("Hit 1 of 2").first()).toBeVisible();
    await expect(desktopTextPanel.locator("mark").filter({ hasText: "safety" }).first()).toBeVisible();
    const previousHit = desktopTextPanel.getByRole("button", { name: "Previous document search hit" });
    const nextHit = desktopTextPanel.getByRole("button", { name: "Next document search hit" });
    await expect(previousHit).toHaveAttribute("title", "Previous document search hit");
    await expect(previousHit).toHaveText("");
    await expect(nextHit).toHaveAttribute("title", "Next document search hit");
    await expect(nextHit).toHaveText("");
    await nextHit.click();
    await expect(desktopTextPanel.getByText("Hit 2 of 2")).toBeVisible();
    await expectNoPageHorizontalOverflow(page);
  });

  test("document viewer hydrates once and signs downloads only on demand @critical", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockDemoApi(page);

    const documentId = "11111111-1111-4111-8111-111111111111";
    const browserDetailRequests: string[] = [];
    const setupRequests: string[] = [];
    const signedUrlRequests: Array<"preview" | "download"> = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname === `/api/documents/${documentId}`) browserDetailRequests.push(request.url());
      if (url.pathname === "/api/setup-status") setupRequests.push(request.url());
    });
    await page.route(/\/api\/documents\/([^/]+)\/signed-url(?:\?.*)?$/, async (route) => {
      const url = new URL(route.request().url());
      const id = url.pathname.split("/").at(-2) ?? "";
      const document = getDemoDocument(id);
      if (!document) {
        await route.fulfill({ status: 404, json: { error: "Demo document not found." } });
        return;
      }
      const requestKind = url.searchParams.get("download") === "true" ? "download" : "preview";
      signedUrlRequests.push(requestKind);
      if (requestKind === "download") await new Promise((resolve) => setTimeout(resolve, 250));
      await route.fulfill({
        json: { url: document.storage_path, fileType: document.file_type, demoMode: true },
      });
    });

    await gotoApp(page, `/documents/${documentId}?page=1&chunk=44444444-4444-4444-8444-444444444442`);
    await expect(page.getByRole("heading", { level: 1, name: "Synthetic lithium monitoring protocol" })).toBeVisible();
    await expect(page.getByTestId("source-chunk-indexed-text-panel")).toHaveCount(1);
    await expect.poll(() => signedUrlRequests.filter((kind) => kind === "preview").length).toBe(1);
    expect(browserDetailRequests).toHaveLength(0);
    expect(setupRequests).toHaveLength(0);
    expect(signedUrlRequests.filter((kind) => kind === "download")).toHaveLength(0);

    const downloadButton = page.getByRole("button", { name: "Download", exact: true });
    await expect(downloadButton).toBeEnabled();
    await downloadButton.dblclick();
    await expect.poll(() => signedUrlRequests.filter((kind) => kind === "download").length).toBe(1);
  });

  test("document viewer puts the PDF preview first with pinned evidence after it on mobile", async ({ page }) => {
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
    await expect(page.locator("#source-text")).toBeVisible();
    await expect(
      page.getByTestId("source-chunk-indexed-text-panel").getByTestId("highlighted-indexed-source-chunk"),
    ).toBeVisible();
    await expect(viewerNav.getByRole("link", { name: "Evidence" })).toBeVisible();
    await expect(viewerNav.getByRole("link", { name: "PDF" })).toBeVisible();
    await expect(viewerNav.getByRole("link", { name: "Text" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Synthetic lithium monitoring protocol" })).toBeVisible();
    await expect(preview).toBeVisible();
    const switchToCanvasMode = page.getByRole("button", { name: "Switch to canvas zoom mode" });
    if ((await switchToCanvasMode.count()) > 0) {
      await switchToCanvasMode.click();
    }
    await expect(toolbar).toBeVisible({ timeout: 30000 });
    const enterFullscreen = page.getByRole("button", { name: "Fit page width and enter fullscreen" });
    // The toolbar is mounted before pdf.js finishes painting. Wait for its
    // existing pagesReady signal so late canvas height changes cannot move a
    // target between Firefox's actionability check and pointer dispatch.
    await expect(enterFullscreen).toBeEnabled({ timeout: 30000 });
    await expect(pdfScroller.locator("canvas")).toBeVisible();

    await expectDomIntegrity(page);

    const evidenceBox = await evidence.boundingBox();
    const previewBox = await preview.boundingBox();
    const indexedTextHeading = page
      .getByTestId("source-chunk-indexed-text-panel")
      .getByRole("heading", { name: "Indexed source text", exact: true });
    const indexedTextBox = await indexedTextHeading.boundingBox();
    const imagesBox = await page.getByRole("heading", { name: "Tables and diagrams" }).boundingBox();

    expect(evidenceBox).not.toBeNull();
    expect(previewBox).not.toBeNull();
    expect(indexedTextBox).not.toBeNull();
    expect(imagesBox).not.toBeNull();
    expect(previewBox!.y).toBeLessThan(evidenceBox!.y);
    expect(evidenceBox!.height).toBeLessThan(640);
    expect(previewBox!.y).toBeLessThan(indexedTextBox!.y);
    expect(indexedTextBox!.y).toBeLessThan(imagesBox!.y);

    const passageToggle = page.getByTestId("toggle-full-passage").first();
    await expect(passageToggle).toHaveText("Show full passage");
    // Keyboard activation is intentional here: pdf.js can resize the canvas
    // while Firefox is calculating pointer coordinates, but a focused native
    // button must keep its expand/collapse behavior through that layout shift.
    await activateFocusedControl(page, passageToggle);
    await expect(passageToggle).toHaveText("Show passage preview");
    const expandedEvidenceBox = await evidence.boundingBox();
    expect(expandedEvidenceBox?.height ?? 0).toBeGreaterThan(evidenceBox!.height);
    await activateFocusedControl(page, viewerNav.getByRole("link", { name: "PDF" }));
    await expect(preview).toBeInViewport();
    await activateFocusedControl(page, viewerNav.getByRole("link", { name: "Text" }));
    await expect(indexedTextHeading).toBeInViewport();
    await activateFocusedControl(page, viewerNav.getByRole("link", { name: "PDF" }));
    await expect(preview).toBeInViewport();

    const mobilePdfStyles = await toolbar.evaluate((element) => ({
      position: window.getComputedStyle(element).position,
    }));
    expect(mobilePdfStyles.position).toBe("static");

    await expect(pdfScroller).toBeVisible();
    await enterFullscreen.click();
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

    // Exercise the independent actions sheet last. Its portal/focus teardown
    // causes a deferred root commit in Firefox; no subsequent target should be
    // selected against the pre-teardown layout.
    await page.getByRole("button", { name: "Open document actions" }).first().click();
    const documentActions = page.getByRole("dialog", { name: "This document" });
    await expect(documentActions).toBeVisible();
    await tapOutsideActiveSurface(page);
    await expect(documentActions).toHaveCount(0);
    await expectNoPageHorizontalOverflow(page);
  });

  test("document viewer smart summary is structured with badges and demoted indexing details", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockDemoApi(page);
    await gotoApp(page, "/documents/11111111-1111-4111-8111-111111111111?page=1");

    await expect(page.getByRole("heading", { level: 1, name: "Synthetic lithium monitoring protocol" })).toBeVisible({
      timeout: 30_000,
    });
    const summaryCard = page.getByTestId("high-yield-summary");
    await expect(summaryCard).toBeVisible();
    await expect(summaryCard).toHaveJSProperty("open", false);
    await summaryCard.getByText("High-yield summary", { exact: true }).click();
    await expect(summaryCard).toHaveJSProperty("open", true);
    // Smart summary: badge cluster from labels + detected phrases, structured
    // sections, and no document-header boilerplate leaking through.
    await expect(summaryCard.getByText("Narrow therapeutic index", { exact: true })).toBeVisible();
    await expect(summaryCard.getByTestId("formatted-high-yield-summary")).toBeVisible();
    await expect(summaryCard).not.toContainText("Reference #");
    await expect(summaryCard).not.toContainText("Service/Department/Unit");

    // The old meta-only "Document details" card is gone; indexing metadata is
    // demoted behind a collapsed disclosure at the bottom of the sidebar.
    await expect(page.getByText("Document details", { exact: true })).toHaveCount(0);
    const indexingDetails = page.getByTestId("indexing-details");
    await expect(indexingDetails).toBeVisible();
    await expect(indexingDetails.getByText("rag-deep-memory-v1")).toBeHidden();
    await indexingDetails.getByText("Indexing details", { exact: true }).click();
    await expect(indexingDetails.getByText("rag-deep-memory-v1")).toBeVisible();

    await expectDomIntegrity(page);
    await expectNoPageHorizontalOverflow(page);
  });

  test("document viewer content disclosures are naturally closed and mutually exclusive by default", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockDemoApi(page);
    await gotoApp(page, "/documents/11111111-1111-4111-8111-111111111111?page=1");

    await expect(page.getByRole("heading", { level: 1, name: "Synthetic lithium monitoring protocol" })).toBeVisible({
      timeout: 30_000,
    });
    const indexedText = page.locator("#source-text");
    const summary = page.getByTestId("high-yield-summary");
    const images = page.locator("#source-images");
    const indexingDetails = page.getByTestId("indexing-details");
    const viewerNav = page.getByRole("navigation", { name: "Document viewer sections" }).first();
    const clickViewerNav = async (name: "Images" | "Summary" | "Text") => {
      const link = viewerNav.getByRole("link", { name });
      await waitForReactEventHandler(link, "onClick");
      await activateFocusedControl(page, link);
    };

    await expect(indexedText).toBeVisible();
    for (const disclosure of [summary, images, indexingDetails]) {
      await expect(disclosure).toHaveJSProperty("open", false);
    }

    const summaryContent = summary.getByTestId("formatted-high-yield-summary");
    await expect(summaryContent).toBeHidden();
    await clickViewerNav("Images");
    await expect(images).toHaveJSProperty("open", true);
    await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
    await page.emulateMedia({ media: "print" });
    await expect(summaryContent).toBeVisible();
    await page.emulateMedia({ media: "screen" });
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    await expect(summaryContent).toBeHidden();
    await expect(images).toHaveJSProperty("open", true);

    await clickViewerNav("Text");
    await expect(indexedText).toBeInViewport();
    await expect(images).toHaveJSProperty("open", false);

    await clickViewerNav("Summary");
    await expect(summary).toHaveJSProperty("open", true);
    await expect(indexedText).toBeVisible();

    await clickViewerNav("Images");
    await expect(images).toHaveJSProperty("open", true);
    await expect(summary).toHaveJSProperty("open", false);

    await indexingDetails.getByText("Indexing details", { exact: true }).click();
    await expect(indexingDetails).toHaveJSProperty("open", true);
    await expect(images).toHaveJSProperty("open", false);

    await expectDomIntegrity(page);
    await expectNoPageHorizontalOverflow(page);
  });

  test("answer glass header overlays main and fully hides while scrolling on phones", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoApp(page, "/?mode=answer");

    const header = page.locator("header.universal-header");
    await expect(header).toBeVisible();
    await expect(header).not.toHaveAttribute("data-scroll-hidden", "true");
    // Answer mode takes the header out of flow (absolute over <main>) so
    // content frosts under the glass bar; <main> must reserve the header's
    // exact height as top padding or short answers regain phantom scroll.
    await expect.poll(async () => header.evaluate((node) => window.getComputedStyle(node).position)).toBe("absolute");
    const main = page.locator("main#main-content");
    const reserve = await main.evaluate((node) => Number.parseFloat(window.getComputedStyle(node).paddingTop));
    const headerHeight = await header.evaluate((node) => node.getBoundingClientRect().height);
    expect(Math.abs(reserve - headerHeight)).toBeLessThanOrEqual(2);

    await waitForReactEventHandler(main, "onScroll");
    await main.evaluate((node) => {
      const spacer = document.createElement("div");
      spacer.setAttribute("data-testid", "header-hide-scroll-spacer");
      spacer.style.height = "2000px";
      node.appendChild(spacer);
    });
    // Step scroll down so the dashboard main listener sees deliberate movement.
    for (const offset of [40, 80, 120, 160, 200]) {
      await scrollPrimarySurface(page, offset);
    }

    await expect(header).toHaveAttribute("data-scroll-hidden", "true");
    await expect
      .poll(async () =>
        header.evaluate((node) => {
          const rect = node.getBoundingClientRect();
          return Math.max(0, rect.bottom) - Math.max(0, rect.top);
        }),
      )
      .toBe(0);
    // The scrim tail (taller than the bar) may leave only a whisper at the top
    // edge while hidden — bound it so it can't grow into a visible band.
    const scrimBottom = await page
      .locator(".edge-glass-header-backdrop")
      .evaluate((node) => node.getBoundingClientRect().bottom);
    expect(scrimBottom).toBeLessThanOrEqual(34);

    // Any deliberate scroll up slides the glass bar back in.
    for (const offset of [160, 120, 60]) {
      await scrollPrimarySurface(page, offset);
    }
    await expect(header).not.toHaveAttribute("data-scroll-hidden", "true");
  });

  test("private-scope alert stays reachable while the answer view scrolls", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockDemoApi(page);
    // An unauthenticated session with a routed private-scope ref resolves to
    // privateScopeStatus="unavailable", which renders the recovery alert.
    await gotoApp(page, "/?mode=answer&scopeRef=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");

    const alert = page.getByTestId("private-scope-unavailable");
    await expect(alert).toBeVisible({ timeout: 15000 });

    const main = page.locator("#main-content");
    await waitForReactEventHandler(main, "onScroll");
    await main.evaluate((node) => {
      const spacer = document.createElement("div");
      spacer.style.height = "2000px";
      node.appendChild(spacer);
    });
    for (const offset of [80, 160, 260, 380]) {
      await main.evaluate((node, top) => {
        node.scrollTop = top;
      }, offset);
    }

    // Sticky inside <main>: the recovery actions must remain on-screen (they
    // used to scroll away with content, stranding the user mid-thread).
    await expect(alert).toBeVisible();
    const box = await alert.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeLessThanOrEqual(200);
  });

  test("answer glass header hides and returns on desktop widths too", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 860 });
    await gotoApp(page, "/?mode=answer");

    const header = page.locator("header.universal-header");
    await expect(header).toBeVisible();
    await expect.poll(async () => header.evaluate((node) => window.getComputedStyle(node).position)).toBe("absolute");

    const main = page.locator("main#main-content");
    await waitForReactEventHandler(main, "onScroll");
    await main.evaluate((node) => {
      const spacer = document.createElement("div");
      spacer.style.height = "2400px";
      node.appendChild(spacer);
    });
    for (const offset of [40, 90, 150, 220, 300]) {
      await scrollPrimarySurface(page, offset);
    }
    await expect(header).toHaveAttribute("data-scroll-hidden", "true");

    for (const offset of [250, 200, 140]) {
      await scrollPrimarySurface(page, offset);
    }
    await expect(header).not.toHaveAttribute("data-scroll-hidden", "true");
  });

  test("non-answer phone header keeps the in-flow collapse hide", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockDemoApi(page);
    await gotoApp(page, "/?mode=documents");

    const header = page.locator("header.universal-header");
    const collapseHost = page.getByTestId("universal-header-collapse");
    await expect(header).toBeVisible();
    await expect(collapseHost).not.toHaveAttribute("data-scroll-hidden", "true");
    // Non-answer modes keep the header in flow — their sm+ composer renders
    // beneath it, which the absolute answer-mode overlay would bury.
    await expect.poll(async () => header.evaluate((node) => window.getComputedStyle(node).position)).toBe("relative");

    const main = page.locator("main#main-content");
    await waitForReactEventHandler(main, "onScroll");
    await main.evaluate((node) => {
      const spacer = document.createElement("div");
      spacer.style.height = "2000px";
      node.appendChild(spacer);
    });
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

    // A descendant may become the active scroller. Its near-zero offset must
    // establish a new baseline rather than looking like a large upward gesture
    // relative to the deeply scrolled main container.
    await main.evaluate(async (node) => {
      const nested = document.createElement("div");
      nested.dataset.testid = "nested-scroll-intent-source";
      nested.style.height = "40px";
      nested.style.overflowY = "auto";
      const content = document.createElement("div");
      content.style.height = "200px";
      nested.appendChild(content);
      node.appendChild(nested);
      nested.scrollTop = 4;
      nested.dispatchEvent(new Event("scroll"));
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    });
    await expect(collapseHost).toHaveAttribute("data-scroll-hidden", "true");

    // At the bottom, collapsing the in-flow header can reflow the scroll
    // surface and clamp scrollTop. That geometry-driven event is not an upward
    // user gesture and must not immediately reveal the header. The collapse
    // -budget gate refuses to START a hide at the bottom edge (that is the
    // #964 "locks to the bottom" trap), so hide with runway remaining first,
    // then ride the clamp to the bottom while hidden.
    await main.evaluate((node) => {
      node.scrollTop = 0;
    });
    await expect(collapseHost).not.toHaveAttribute("data-scroll-hidden", "true");
    const visibleMaxOffset = await main.evaluate((node) => node.scrollHeight - node.clientHeight);
    await main.evaluate((node, top) => {
      node.scrollTop = top;
    }, visibleMaxOffset - 400);
    await expect(collapseHost).toHaveAttribute("data-scroll-hidden", "true");
    await main.evaluate((node) => {
      node.scrollTop = node.scrollHeight - node.clientHeight;
    });
    await expect(collapseHost).toHaveAttribute("data-scroll-hidden", "true");
    await expect.poll(async () => collapseHost.getAttribute("data-scroll-hidden"), { timeout: 1_000 }).toBe("true");
    // The hidden attribute flips before the 240ms grid-row transition has
    // released the header's layout space. Wait for rendered geometry so this
    // assertion cannot race the animation on faster or slower CI runners.
    await expect
      .poll(async () =>
        header.evaluate((node) => {
          const rect = node.getBoundingClientRect();
          return Math.max(0, rect.bottom) - Math.max(0, rect.top);
        }),
      )
      .toBe(0);
    await main.evaluate((node) => {
      node.scrollTop = Math.max(0, node.scrollTop - 24);
    });
    await expect(collapseHost).not.toHaveAttribute("data-scroll-hidden", "true");
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
    // The chunk deep link intentionally scrolls the highlighted passage into
    // view, which can initially hide the phone composer. Returning to the top
    // must restore it before the explicit hide-on-scroll checks below.
    await scrollPrimarySurface(page, 0);
    await expect(composer).not.toHaveAttribute("data-scroll-hidden", "true");
    await page.evaluate(() => {
      document.documentElement.style.setProperty("--safe-area-bottom", "112px");
    });
    const viewerContent = page.getByTestId("document-viewer-content");
    const main = page.locator("#main-content");
    // DocumentViewer owns the floating dock. The shell must keep only a tiny
    // pad even when Safari's toolbar inset is large — otherwise #932's
    // max(2rem, --safe-area-bottom) shell reserve recreates the blank band
    // under the viewer while the viewer itself collapses correctly.
    await expect.poll(async () => readMobileComposerReservePx(main)).toBeLessThanOrEqual(13);
    await expect
      .poll(async () =>
        viewerContent.evaluate((node) => Number.parseFloat(window.getComputedStyle(node).paddingBottom)),
      )
      .toBeGreaterThan(250);

    await waitForReactEventHandler(main, "onScroll");
    await page.evaluate(() => {
      const main = window.document.getElementById("main-content");
      const spacer = window.document.createElement("div");
      spacer.setAttribute("data-testid", "composer-hide-scroll-spacer");
      spacer.style.height = "2000px";
      (main ?? window.document.body).appendChild(spacer);
    });

    // Hide on deliberate scroll down past the activation offset. The chunk
    // deep-link effect can finish late in Chromium and move the scrollport once
    // more, so treat reset + deliberate movement as one retriable action.
    await expect(async () => {
      await scrollPrimarySurface(page, 0);
      await expect(composer).not.toHaveAttribute("data-scroll-hidden", "true", { timeout: 1_000 });
      for (const offset of [40, 80, 120, 160, 200]) {
        await scrollPrimarySurface(page, offset);
      }
      await expect(composer).toHaveAttribute("data-scroll-hidden", "true", { timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await expect
      .poll(async () =>
        viewerContent.evaluate((node) => Number.parseFloat(window.getComputedStyle(node).paddingBottom)),
      )
      .toBeLessThanOrEqual(13);
    await expect.poll(async () => readMobileComposerReservePx(main)).toBeLessThanOrEqual(13);

    // Reappear on scroll up.
    await scrollPrimarySurface(page, 60);
    await expect(composer).not.toHaveAttribute("data-scroll-hidden", "true");
    await expect
      .poll(async () =>
        viewerContent.evaluate((node) => Number.parseFloat(window.getComputedStyle(node).paddingBottom)),
      )
      .toBeGreaterThan(250);
    await expect.poll(async () => readMobileComposerReservePx(main)).toBeLessThanOrEqual(13);

    // Keyboard focus inside the composer reveals it while hidden.
    await scrollPrimarySurface(page, 240);
    await expect(composer).toHaveAttribute("data-scroll-hidden", "true");
    await composer.locator("input").focus();
    await expect(composer).not.toHaveAttribute("data-scroll-hidden", "true");
    await expect
      .poll(async () =>
        viewerContent.evaluate((node) => Number.parseFloat(window.getComputedStyle(node).paddingBottom)),
      )
      .toBeGreaterThan(250);
    await expect.poll(async () => readMobileComposerReservePx(main)).toBeLessThanOrEqual(13);
  });

  test("document questions use the shared answer stream with progress and cleaned bold formatting", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 820 });
    const answerRequests: Array<{ query: string; documentId?: string; summaryMode?: boolean }> = [];
    let legacySummaryRequestCount = 0;
    page.on("request", (request) => {
      if (/\/api\/documents\/[^/]+\/summarize$/.test(new URL(request.url()).pathname)) {
        legacySummaryRequestCount += 1;
      }
    });
    await mockDemoApi(page, {
      onAnswerRequest: (query, scope) =>
        answerRequests.push({ query, documentId: scope.documentId, summaryMode: scope.summaryMode }),
      answerOverride: (query, documentId, documentIds) => ({
        ...demoAnswer(query, documentId, documentIds),
        answer:
          "Key practical points: **clozapine** monitoring requires regular FBC/ANC checks and review of constipation, myocarditis symptoms, metabolic risk, and missed-dose restart rules.",
      }),
    });
    await gotoApp(
      page,
      "/documents/11111111-1111-4111-8111-111111111111?page=1&chunk=44444444-4444-4444-8444-444444444442",
    );

    const composer = page.locator("form.document-viewer-composer");
    await composer
      .getByRole("textbox", { name: "Search or answer from this document" })
      .fill("How is clozapine monitored?");
    await activateFocusedControl(page, composer.getByRole("button", { name: "Answer from this document" }));

    const generatedSummary = page.getByTestId("generated-clinical-summary");
    await expect(generatedSummary).toBeVisible();
    await expect(page.getByTestId("answer-progress-stepper")).toHaveAttribute("data-progress-state", "complete");
    await expect(page.getByText(/Answer ready in 1s/)).toBeVisible();
    await expect(generatedSummary).toContainText("clozapine monitoring requires regular FBC/ANC checks");
    await expect(generatedSummary).not.toContainText("Key practical points:");
    await expect(generatedSummary).not.toContainText("**");
    await expect(generatedSummary.locator("strong").filter({ hasText: "clozapine" })).toHaveCount(1);

    const summaryBox = await generatedSummary.boundingBox();
    const previewBox = await page.getByTestId("pdf-preview").boundingBox();
    expect(summaryBox).not.toBeNull();
    expect(previewBox).not.toBeNull();
    expect(summaryBox!.y).toBeLessThan(previewBox!.y);
    expect(answerRequests).toEqual([
      {
        query: "How is clozapine monitored?",
        documentId: "11111111-1111-4111-8111-111111111111",
        summaryMode: undefined,
      },
    ]);
    expect(legacySummaryRequestCount).toBe(0);

    await composer.getByRole("textbox", { name: "Search or answer from this document" }).fill("");
    // The generated answer intentionally smooth-scrolls into view. WebKit can
    // move the fixed pointer target during that animation, so exercise the
    // native submit control by keyboard for this immediate follow-up action.
    await activateFocusedControl(page, composer.getByRole("button", { name: "Answer from this document" }));
    await expect.poll(() => answerRequests.length).toBe(2);
    expect(answerRequests[1]).toEqual({
      query: documentSummaryQuestion,
      documentId: "11111111-1111-4111-8111-111111111111",
      summaryMode: true,
    });
    expect(legacySummaryRequestCount).toBe(0);
    await expectNoPageHorizontalOverflow(page);
  });

  test("document viewer failed preview exposes retry recovery @critical", async ({ page }) => {
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

  test("document viewer missing source state is coherent", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 820 });
    await mockPrivateUnauthenticatedApi(page);
    await page.route(/\/api\/documents\/[^/]+\/signed-url(?:\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 404,
        json: { error: "Document not found." },
      });
    });
    await gotoApp(
      page,
      "/documents/99999999-9999-4999-8999-999999999999?page=1&chunk=99999999-9999-4999-8999-999999999998",
    );

    await expect(page.getByRole("heading", { level: 1, name: "Source unavailable" })).toBeVisible({
      timeout: 30000,
    });
    await expect(page.locator("body")).toContainText(/Demo document not found\./i);
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

  test("production upload action remains admin-only for unauthenticated users", async ({ page, request }) => {
    await page.setViewportSize({ width: 414, height: 820 });
    await mockPrivateUnauthenticatedApi(page);
    const setupStatusResponse = await request.get("/api/setup-status");
    expect(setupStatusResponse.ok()).toBe(true);
    expect((await setupStatusResponse.json()).demoMode).toBe(true);

    await gotoApp(page, "/");
    await expect(visibleQuestionInput(page)).toBeVisible();

    await expectAdminOnlyUploadNotice(page);
    await expectNoPageHorizontalOverflow(page);
  });

  test("demo upload action cannot bypass the production admin gate", async ({ page }) => {
    await page.setViewportSize({ width: 414, height: 820 });
    await mockDemoApi(page);
    await gotoApp(page, "/");

    await expectAdminOnlyUploadNotice(page);
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
