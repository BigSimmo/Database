import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

import { getPlaywrightBaseUrl } from "./playwright-base-url";
import { demoAnswer, demoDocuments } from "../src/lib/demo-data";

const outputDir = process.env.SCREENSHOT_DIR ?? join(process.cwd(), "artifacts", "screenshots");
mkdirSync(outputDir, { recursive: true });

const question = "What clozapine monitoring items are shown in the table image?";

const readySetupChecks = [
  { id: "env", label: ".env.local configured", status: "ready", detail: "Test environment ready." },
  { id: "project", label: "Clinical KB Database target", status: "ready", detail: "Test Supabase project ready." },
  { id: "schema", label: "supabase/schema.sql applied", status: "ready", detail: "Test schema ready." },
  { id: "search", label: "Search RPC and vector indexes", status: "ready", detail: "Test search schema ready." },
  { id: "openai", label: "OpenAI API key available", status: "ready", detail: "Test OpenAI ready." },
  { id: "worker", label: "npm run worker running", status: "unknown", detail: "Worker not required for UI smoke." },
];

function answerStreamBody(payload: unknown) {
  return [
    `event: progress\ndata: ${JSON.stringify({ stage: "retrieving", message: "Searching indexed documents." })}`,
    `event: final\ndata: ${JSON.stringify(payload)}`,
    "",
  ].join("\n\n");
}

async function mockDemoApi(page: import("playwright-core").Page, baseUrl: string) {
  await page.route(/\/api\/local-project-id$/, async (route) => {
    await route.fulfill({
      json: {
        appName: "Clinical KB",
        projectId: "test-project",
        identityPath: "/api/local-project-id",
        localServer: {
          currentUrl: baseUrl,
          currentPort: Number(new URL(baseUrl).port || 4298),
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
  await page.route("**/api/setup-status**", async (route) => {
    await route.fulfill({ json: { demoMode: true, checks: readySetupChecks } });
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
  await page.route(/\/api\/answer(?:\/stream)?(?:\?.*)?$/, async (route) => {
    const body = route.request().postDataJSON() as {
      query?: string;
      documentId?: string;
      documentIds?: string[];
    };
    const payload = demoAnswer(body?.query ?? question, body?.documentId, body?.documentIds);
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
  });
}

async function main() {
  const baseUrl = getPlaywrightBaseUrl();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 820 } });
  await mockDemoApi(page, baseUrl);
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => undefined);

  const questionInput = page
    .locator('[aria-label^="Search indexed guidelines by question or keyword"]:visible')
    .first();
  await questionInput.fill(question);
  await page.locator('[aria-label="Generate source-backed answer"]:visible').first().click();

  await page.getByTestId("plain-answer-response").waitFor({ state: "visible", timeout: 30_000 });
  await page.getByTestId("answer-follow-up-suggestions").waitFor({ state: "visible", timeout: 30_000 });
  await page.getByTestId("answer-support-action-row").waitFor({ state: "attached", timeout: 30_000 });

  const mainContent = page.locator("#main-content");

  await mainContent.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await page.waitForTimeout(500);
  const expandedPath = join(outputDir, "support-chips-expanded-at-bottom.png");
  await page.screenshot({ path: expandedPath, fullPage: false });

  await mainContent.evaluate((element) => {
    element.scrollTop = Math.max(0, element.scrollHeight - element.clientHeight - 180);
  });
  await page
    .waitForFunction(() => {
      const row = document.querySelector('[data-testid="answer-support-action-row"]');
      return row?.getAttribute("data-collapsed") === "true";
    }, { timeout: 10_000 })
    .catch(() => undefined);
  await page.waitForTimeout(500);
  const collapsedPath = join(outputDir, "support-chips-collapsed-above-composer.png");
  await page.screenshot({ path: collapsedPath, fullPage: false });

  const collapsed = await page.getByTestId("answer-support-action-row").getAttribute("data-collapsed");
  console.log(JSON.stringify({ outputDir, collapsed, expandedPath, collapsedPath, baseUrl }, null, 2));

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
