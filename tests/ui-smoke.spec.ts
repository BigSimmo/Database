Warning: truncated output (original token count: 77866)
Total output lines: 6009

import AxeBuilder from "@axe-core/playwright";
import type { Route } from "playwright-core";
import { expect, test, type Locator, type Page } from "playwright/test";
import { stubZeroTouchPoints } from "./helpers/zero-touch";
import {
  appendPrimaryScrollSpacer,
  readMobileComposerReservePx,
  readPrimaryScrollAndDomGeometry,
  readPrimaryScrollGeometry,
  scrollPrimarySurface,
} from "./playwright-scroll";
import { expectSingleSettledOwner, visibleByTestId } from "./playwright-settlement";
import { answerThreadStorageKey } from "../src/lib/answer-thread-storage";
import { documentSummaryQuestion } from "../src/lib/answer-contract";
import { demoAnswer, demoDocuments, demoSummary, getDemoDocument, getDemoDocumentPayload } from "../src/lib/demo-data";
import { formRecords } from "../src/lib/forms";
import { deriveGovernanceFromSections } from "../src/lib/medication-records";
import { getMedicationRecord, loadMedicationSnapshot } from "../src/lib/medication-snapshot";
import { searchMedicationCatalog } from "../src/lib/medication-query";
import { medicationToSearchResult, type MedicationRecord } from "../src/lib/medications";
import { serviceRecords } from "../src/lib/services";
import { recentQueryStorageKey } from "../src/lib/recent-query-storage";

const dashboardViewports = [
  // Representative owners only: one phone (<640), tablet (≤768), laptop, and
  // landscape. Extra phone widths (375/414) duplicated the same overflow + Ask
  // asserts without a distinct layout branch.
  { name: "small-mobile", width: 320, height: 720 },
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

async function expectDocumentOwnerFillsFrame(page: Page, owner: Locator) {
  // Next streaming can leave a hidden DocumentFrame clone (#093); bare getByTestId
  // then trips strict mode with 2 matches (seen under mobile-composer-reserve-pad).
  const surround = visibleByTestId(page, "document-frame-surround");
  const content = visibleByTestId(page, "document-frame-content");
  await expect(surround).toBeVisible();
  await expect(content).toBeVisible();
  await expect(owner).toBeVisible();

  await expect
    .poll(async () => {
      const [surroundGeometry, contentBox, ownerBox] = await Promise.all([
        surround.evaluate((element) => {
          const style = window.getComputedStyle(element);
          return {
            clientWidth: element.clientWidth,
            paddingLeft: Number.parseFloat(style.paddingLeft),
            paddingRight: Number.parseFloat(style.paddingRight),
          };
        }),
        content.boundingBox(),
        owner.boundingBox(),
      ]);
      if (!contentBox || !ownerBox) return Number.POSITIVE_INFINITY;
      const availableWidth =
        surroundGeometry.clientWidth - surroundGeometry.paddingLeft - surroundGeometry.paddingRight;
      return Math.max(Math.abs(contentBox.width - availableWidth), Math.abs(ownerBox.width - availableWidth));
    })
    .toBeLessThanOrEqual(2);
}

async function revealPhoneHeaderControl(page: Page, control: Locator) {
  const { scrollTop } = await readPrimaryScrollGeometry(page);
  if (scrollTop > 0) await scrollPrimarySurface(page, Math.max(0, scrollTop - 48));
  await expect(control).toBeInViewport();
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
  const questionInput = page.locator('[aria-label^="Search indexed guidelines by question or keyword"]:visible');
  const submitAnswer = page.locator('[aria-label="Generate source-backed answer"]:visible');

  // Production HTML can be visible before React owns the controlled input.
  // Filling during that gap is immediately overwritten by hydration and leaves
  // the submit button disabled, so establish the live handler boundary first.
  await waitForReactEventHandler(questionInput, "onChange");
  await expect(async () => {
    // A production navigation can briefly overlap or replace the server-rendered
    // composer. Require one settled React owner before filling so the new client
    // tree cannot discard the value and leave submit disabled.
    await expect(questionInput).toHaveCount(1, { timeout: uiAssertionTimeoutMs });
    await expect(submitAnswer).toHaveCount(1, { timeout: uiAssertionTimeoutMs });
    await waitForReactEventHandler(questionInput, "onChange");
    await waitForReactEventHandler(questionInput.locator("xpath=ancestor::form[1]"), "onSubmit");
    await expect(submitAnswer).toHaveAttribute("title", /Enter a clinical question|Generate a source-backed answer/, {
      timeout: uiAssertionTimeoutMs,
    });
    await expect(questionInput).toBeEditable({ timeout: uiAssertionTimeoutMs });
    await questionInput.fill(value);
    await expect(questionInput).toHaveValue(value, { timeout: uiAssertionTimeoutMs });
    await expect(submitAnswer).toBeEnabled({ timeout: uiAssertionTimeoutMs });
  }).toPass({ timeout: uiAssertionTimeoutMs });

  return questionInput;
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
        appName: "PsychSift",
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
  return records.map((record) => {
    const brandRows = record.sections
      .filter((section) => section.type === "form")
      .flatMap((section) => section.rows)
      .filter((row) => /brand\s*names?/i.test(row.key));
    return {
      slug: record.slug,
      name: record.name,
      class: record.class,
      subclass: record.subclass,
      category: record.category,
      accent: record.accent,
      tag: record.tag,
      schedule: record.schedule,
      stats: [],
      sections: brandRows.length
        ? [{ title: "Formulation & Access", type: "form", rows: brandRows.map((row) => ({ ...row })) }]
        : [],
      quick: [],
    };
  });
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
    const ranked = query ? searchMedicationCatalog(fullRecords, query, limit) : undefined;
    await route.fulfill({
      json: {
        records,
        matches: ranked?.matches.map((match) => ({
          medication: match.medication,
          result: medicationToSearchResult(match),
          score: match.score,
          reasons: match.reasons,
        })),
        interpretation: ranked
          ? {
              correctedQuery:
                ranked.analysis.corrections.length && ranked.analysis.correctedQuery !== ranked.analysis.originalQuery
                  ? ranked.analysis.correctedQuery
                  : undefined,
              corrections: ranked.analysis.corrections.length ? ranked.analysis.corrections : undefined,
              appliedExpansions: ranked.analysis.expansions.length ? ranked.analysis.expansions : undefined,
            }
          : undefined,
        total: records.length,
        governance: {},
        demoMode: true,
      },
    });
  });
  await page.route(/\/api\/registry\/records(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    const kind = url.searchParams.get("kind");
    const view = url.searchParams.get("view") ?? "full";
    const records = kind === "form" ? formRecords : serviceRecords;
    await route.fulfill({
      json: {
        records,
        total: records.length,
        verifiedCount: 0,
        ...(view === "full" ? { governance: {} } : {}),
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
        confidence: …65866 tokens truncated…getByRole("heading", { level: 1, name: "Synthetic lithium monitoring protocol" })).toBeVisible();
    const composer = page.locator("form.document-viewer-composer");
    await page.getByRole("button", { name: "Open document actions" }).click();
    await page.getByRole("dialog", { name: "This document" }).getByRole("button", { name: "Search document" }).click();
    await expect(composer).toBeVisible();
    await composer.locator("input").evaluate((element) => element.blur());
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

    await appendPrimaryScrollSpacer(page, { heightPx: 2000, testId: "composer-hide-scroll-spacer" });
    await expect.poll(async () => (await readPrimaryScrollGeometry(page)).owner).toBe("document");

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

    await scrollPrimarySurface(page, 0);
    await composer.getByRole("button", { name: "Close document search" }).click();
    await expect(composer).toHaveCount(0);
    await expect(viewerContent).toHaveAttribute("data-phone-footer-owner", "none");
    await expect
      .poll(async () =>
        viewerContent.evaluate((node) => Number.parseFloat(window.getComputedStyle(node).paddingBottom)),
      )
      .toBeLessThanOrEqual(13);
  });

  test("document search stays separate from the shared answer stream and summary action", async ({ page }) => {
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
    await page.getByRole("button", { name: "Open document actions" }).click();
    await page.getByRole("dialog", { name: "This document" }).getByRole("button", { name: "Search document" }).click();
    await composer.getByRole("textbox", { name: "Search within this document" }).fill("safety plan include");
    await activateFocusedControl(page, composer.getByRole("button", { name: "Search within this document" }));
    await expect(page.getByTestId("source-chunk-indexed-text-panel").getByText("Hit 1 of 2").first()).toBeVisible();
    expect(answerRequests).toEqual([]);

    const openDocumentActions = page.getByRole("button", { name: "Open document actions" });
    await composer.getByRole("button", { name: "Close document search" }).click();
    await expect(composer).toHaveCount(0);
    await expect(openDocumentActions).toBeFocused();
    await openDocumentActions.click();
    const documentActions = page.getByRole("dialog", { name: "This document" });
    await documentActions.getByRole("button", { name: "Answer from this", exact: true }).click();

    const generatedSummary = page.getByTestId("generated-clinical-summary");
    await expect(generatedSummary).toBeVisible();
    await expect(page.getByTestId("answer-progress")).toHaveAttribute("data-progress-state", "complete");
    // The completed wait prints no visible chrome: the summary card arriving is
    // the completion signal, and an elapsed time is a timing boast rather than
    // anything a reader acts on. The announcement survives for screen readers.
    await expect(page.getByText(/Answer ready in/)).toHaveCount(0);
    await expect(page.getByTestId("answer-progress").getByRole("status")).toContainText("Answer ready.");
    await expect(generatedSummary).toContainText("clozapine monitoring requires regular FBC/ANC checks");
    await expect(generatedSummary).not.toContainText("Key practical points:");
    await expect(generatedSummary).not.toContainText("**");
    await expect(generatedSummary.locator("strong").filter({ hasText: "clozapine" })).toHaveCount(1);

    // The generated answer deliberately smooth-scrolls into view. Read both
    // boxes in one browser evaluation so viewport motion cannot corrupt their
    // relative order between independent Playwright round trips.
    const answerGeometry = await readPrimaryScrollAndDomGeometry(page, {
      summary: '[data-testid="generated-clinical-summary"]',
      preview: '[data-testid="pdf-preview"]',
    });
    expect(answerGeometry.nodes.summary.count).toBe(1);
    expect(answerGeometry.nodes.preview.count).toBe(1);
    expect(answerGeometry.nodes.summary.rect).not.toBeNull();
    expect(answerGeometry.nodes.preview.rect).not.toBeNull();
    expect(answerGeometry.nodes.summary.rect!.top).toBeLessThan(answerGeometry.nodes.preview.rect!.top);
    expect(answerRequests).toEqual([
      {
        query: documentSummaryQuestion,
        documentId: "11111111-1111-4111-8111-111111111111",
        summaryMode: true,
      },
    ]);
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

    // Missing/unowned documents now resolve through the segment not-found boundary
    // (page.tsx calls notFound() on PublicApiError 404) instead of DocumentViewer.
    await expect(page.getByRole("heading", { level: 1, name: "Document Not Found" })).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByRole("status")).toContainText(/unavailable|private|missing|removed/i);
    await expect(page.getByRole("link", { name: /Return to document library/i })).toBeVisible();
    await expect(page.getByRole("status")).not.toContainText("loading source");
    await expect(page.getByRole("status")).not.toContainText("Loading source metadata");
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

  test("production site does not offer document uploads to unauthenticated users", async ({ page, request }) => {
    await page.setViewportSize({ width: 414, height: 820 });
    await mockPrivateUnauthenticatedApi(page);
    const setupStatusResponse = await request.get("/api/setup-status");
    expect(setupStatusResponse.ok()).toBe(true);
    expect((await setupStatusResponse.json()).demoMode).toBe(true);

    await gotoApp(page, "/");
    await expect(visibleQuestionInput(page)).toBeVisible();

    await expectDocumentUploadUnavailable(page);
    await expectNoPageHorizontalOverflow(page);
  });

  test("demo site does not offer document uploads", async ({ page }) => {
    await page.setViewportSize({ width: 414, height: 820 });
    await mockDemoApi(page);
    await gotoApp(page, "/");

    await expectDocumentUploadUnavailable(page);
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
      await expect.poll(async () => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
      await page.keyboard.press("Shift+Tab");
      await expect.poll(async () => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
      await page.keyboard.press("Tab");
      await expect.poll(async () => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
      await dialog.getByRole("button", { name: "Close guide" }).click();
      await expect(dialog).toBeHidden();
      const restoredSettings = accountSettingsDialog(page);
      await expect(restoredSettings).toBeVisible();
      await expect(restoredSettings.getByRole("button", { name: "Guide & help", exact: true })).toBeFocused();

      const reopenedDialog = await openGuide(page);
      if (viewport.width >= 1024) {
        await tapOutsideActiveSurface(page);
      } else {
        await page.keyboard.press("Escape");
      }
      await expect(reopenedDialog).toBeHidden();
      await expectNoPageHorizontalOverflow(page);
    });
  }

  test("guide centre topic navigation and tour progress remain accessible", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 820 });
    await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
    await mockPrivateUnauthenticatedApi(page);
    await gotoApp(page, "/");

    const dialog = await openGuide(page);
    const guideScrollBody = dialog.locator(".polished-scroll");
    const mobileFooter = dialog.locator("[data-guide-mobile-footer]");
    const mobileHeader = dialog.locator('[data-sheet-header="true"]');
    await guideScrollBody.evaluate((element) => {
      element.scrollTop = 140;
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await expect(mobileFooter).toHaveAttribute("aria-hidden", "true");
    await expect(mobileFooter).toHaveAttribute("inert", "");
    // Only the dock hides. The pinned header compacts, while "Close guide" and
    // the view tabs stay reachable however far the reader has scrolled.
    await expect(mobileHeader).toHaveClass(/guide-centre-header--compact/);
    await expect(mobileHeader).toHaveAttribute("aria-hidden", "false");
    await expect(mobileHeader).not.toHaveAttribute("inert");
    await expect(dialog.getByRole("button", { name: "Close guide" })).toBeVisible();

    /**
     * The invariant is that a HIDDEN dock is not keyboard-reachable, and the way
     * to test it is to try to focus it directly. The old tab sweep could not:
     * tabbing scrolls the container, and a scroll back up legitimately reveals
     * the dock. Measured 2026-08-19 at 390x820, the very first Tab already put
     * `scrollTop` at 0 and `aria-hidden` at "false", so the sweep asserted
     * against a dock that was correctly visible and focusable every time — it
     * failed CI while testing nothing. (It is also why pinning `tabIndex={-1}`
     * on the dock buttons could not fix it.)
     */
    const dockWhileHidden = await mobileFooter.evaluate((element) => {
      const button = element.querySelector("button");
      const before = document.activeElement;
      button?.focus({ preventScroll: true });
      return {
        hidden: element.getAttribute("aria-hidden") === "true",
        inert: element.hasAttribute("inert"),
        focusMovedIntoDock: element.contains(document.activeElement),
        focusMovedAtAll: document.activeElement !== before,
      };
    });
    // Guard the guard: a dock that was not hidden would make the rest vacuous.
    expect(dockWhileHidden.hidden).toBe(true);
    expect(dockWhileHidden.inert).toBe(true);
    expect(dockWhileHidden.focusMovedIntoDock).toBe(false);
    expect(dockWhileHidden.focusMovedAtAll).toBe(false);

    await guideScrollBody.evaluate((element) => {
      element.scrollTop = 0;
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await expect(mobileFooter).toHaveAttribute("aria-hidden", "false");
    await expect(mobileFooter).not.toHaveAttribute("inert");
    await expect(mobileHeader).not.toHaveClass(/guide-centre-header--compact/);
    // The dock carries the guided tour and nothing else — no composer, no input.
    await expect(dialog.locator("[data-guide-universal-search]")).toHaveCount(0);
    await expect(dialog.locator("input")).toHaveCount(0);

    await dialog.getByRole("button", { name: "All topics" }).click();
    await dialog.getByRole("button", { name: /Privacy & safe use/ }).click();
    await expect(dialog.getByRole("heading", { name: "Privacy and safe use" })).toBeFocused();

    await dialog.getByRole("button", { name: "Guide home" }).click();
    await dialog.getByRole("button", { name: "Start guided tour" }).click();
    await expect(dialog.getByRole("heading", { level: 2, name: "The evidence-first workflow" })).toBeFocused();
    await dialog.getByRole("button", { name: "Continue" }).click();
    await expect(dialog.getByRole("heading", { level: 2, name: "Ask for one decision at a time" })).toBeFocused();

    const axeResults = await new AxeBuilder({ page })
      .include('[data-testid="clinical-kb-guide-centre"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      axeResults.violations
        .filter((violation) => violation.impact === "critical" || violation.impact === "serious")
        .map((violation) => violation.id),
    ).toEqual([]);

    await dialog.getByRole("button", { name: "Close guide" }).click();
    await expect(dialog).toBeHidden();
    const reopenedDialog = await openGuide(page);
    await reopenedDialog.getByRole("button", { name: "Resume guided tour" }).click();
    await expect(
      reopenedDialog.getByRole("heading", { level: 2, name: "Ask for one decision at a time" }),
    ).toBeFocused();
    await expectNoPageHorizontalOverflow(page);
  });

  test("guide centre phone dock paints through the bottom safe area", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 820 });
    await mockPrivateUnauthenticatedApi(page);
    await gotoApp(page, "/");

    const dialog = await openGuide(page);
    const band = dialog.locator(".guide-tour-dock");
    await expect(band).toBeVisible();
    // Seed the inset on :root and wait until content padding includes it. An
    // inline style on the dialog node is lost when React re-renders the Sheet,
    // which made contentPaddingBottom flake at 80px (5rem + 0) instead of 114px
    // (5rem + 34px). Re-seed inside the poll so a late Sheet render cannot
    // measure the unseeded token.
    await expect
      .poll(
        async () => {
          await page.evaluate(() => {
            document.documentElement.style.setProperty("--safe-area-bottom", "34px");
          });
          return band.evaluate((element) => {
            const contentElement = element.closest('[role="dialog"]')?.querySelector("[data-guide-content]");
            return contentElement ? Number.parseFloat(window.getComputedStyle(contentElement).paddingBottom) : 0;
          });
        },
        { message: "guide content padding must include the seeded 34px safe-area inset (5rem + 34px)" },
      )
      .toBeGreaterThanOrEqual(114);

    const painted = await band.evaluate((element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const scrim = element.querySelector(".answer-footer-search-backdrop");
      const scrimStyle = scrim ? window.getComputedStyle(scrim) : null;
      const action = element.querySelector<HTMLElement>("[data-guide-tour-action-row] button");
      const actionRect = action?.getBoundingClientRect();
      const contentElement = element.closest('[role="dialog"]')?.querySelector("[data-guide-content]");
      return {
        background: style.backgroundColor,
        borderTopWidth: style.borderTopWidth,
        boxShadow: style.boxShadow,
        paddingBottom: Number.parseFloat(style.paddingBottom),
        left: Math.round(rect.left),
        right: Math.round(window.innerWidth - rect.right),
        bottom: Math.round(window.innerHeight - rect.bottom),
        scrimDisplay: scrimStyle?.display ?? null,
        scrimHeight: scrimStyle ? Math.round(Number.parseFloat(scrimStyle.height)) : 0,
        scrimBackground: scrimStyle?.backgroundImage ?? "",
        scrimMask: scrimStyle?.maskImage || scrimStyle?.getPropertyValue("-webkit-mask-image") || "",
        actionBottomClearance: actionRect ? Math.round(window.innerHeight - actionRect.bottom) : 0,
        contentPaddingBottom: contentElement
          ? Number.parseFloat(window.getComputedStyle(contentElement).paddingBottom)
          : 0,
      };
    });

    // The wrapper remains a flush, transparent dock; its child scrim owns paint.
    expect(painted.background).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    expect(painted.borderTopWidth).toBe("0px");
    expect(painted.boxShadow === "none" || /rgba\(0, 0, 0, 0\)/.test(painted.boxShadow)).toBe(true);
    expect(painted.left).toBe(0);
    expect(painted.right).toBe(0);
    expect(painted.bottom).toBe(0);

    // At a seeded 34px inset, the guide-specific 130px scrim remains compact
    // while its opaque terminal mask keeps the Home Indicator region painted.
    expect(painted.scrimDisplay).toBe("block");
    expect(painted.scrimHeight).toBeGreaterThanOrEqual(130);
    expect(painted.scrimHeight).toBeLessThan(160);
    expect(painted.scrimBackground).not.toBe("none");
    expect(painted.scrimMask).toMatch(/100%/);
    expect(painted.scrimMask).not.toMatch(/transparent 100%/);
    expect(painted.paddingBottom).toBeGreaterThanOrEqual(44);
    expect(painted.actionBottomClearance).toBeGreaterThanOrEqual(44);
    expect(painted.contentPaddingBottom).toBeGreaterThanOrEqual(114);

    const action = band.locator("[data-guide-tour-action-row] button");
    await expect(action).toHaveCount(1);
    const pill = await action.evaluate((element) => {
      const style = window.getComputedStyle(element);
      const probe = document.createElement("div");
      probe.style.backgroundColor = "var(--command)";
      element.parentElement?.append(probe);
      const commandFill = window.getComputedStyle(probe).backgroundColor;
      probe.remove();
      return {
        background: style.backgroundColor,
        commandFill,
        borderRadius: Number.parseFloat(style.borderTopLeftRadius),
        minHeight: Number.parseFloat(style.minHeight),
      };
    });
    expect(pill.borderRadius).toBeGreaterThan(100);
    expect(pill.minHeight).toBeGreaterThanOrEqual(48);
    expect(pill.background).toBe(pill.commandFill);
  });
});
