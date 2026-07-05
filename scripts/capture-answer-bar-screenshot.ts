import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { demoAnswer, demoDocuments } from "../src/lib/demo-data";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:4298";
const outDir = join(process.cwd(), "scratch", "screenshots");
const outPath = join(outDir, "answer-bar-after-chip-removal.png");
const outBottomPath = join(outDir, "answer-bar-bottom-after-chip-removal.png");

const readySetupChecks = [
  { id: "env", label: ".env.local configured", status: "ready", detail: "Test environment ready." },
  { id: "project", label: "Clinical KB Database target", status: "ready", detail: "Test Supabase project ready." },
  { id: "schema", label: "supabase/schema.sql applied", status: "ready", detail: "Test schema ready." },
  { id: "search", label: "Search RPC and vector indexes", status: "ready", detail: "Test search schema ready." },
  { id: "openai", label: "OpenAI API key available", status: "ready", detail: "Test OpenAI ready." },
  { id: "worker", label: "npm run worker running", status: "unknown", detail: "Worker not required." },
];

async function mockDemoApi(page) {
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
  await page.route(/\/api\/ingestion\/(jobs|batches|quality)(?:\?.*)?$/, async (route) => {
    await route.fulfill({ json: { jobs: [], batches: [], items: [], demoMode: true } });
  });
  await page.route(/\/api\/answer(?:\/stream)?(?:\?.*)?$/, async (route) => {
    const body = route.request().postDataJSON();
    const payload = { ...demoAnswer(body?.query ?? "clozapine monitoring"), demoMode: true };
    if (route.request().url().includes("/stream")) {
      await route.fulfill({
        body: [
          `event: progress\ndata: ${JSON.stringify({ stage: "retrieving", message: "Searching indexed documents." })}`,
          `event: final\ndata: ${JSON.stringify(payload)}`,
          "",
        ].join("\n\n"),
        contentType: "text/event-stream; charset=utf-8",
      });
      return;
    }
    await route.fulfill({ json: payload });
  });
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 820 } });
  await mockDemoApi(page);
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);

  const input = page.locator('[data-testid="global-search-input"]:visible').first();
  await input.waitFor({ state: "visible", timeout: 30000 });
  await input.fill("clozapine monitoring");
  await page.locator('[aria-label="Generate source-backed answer"]:visible').first().click();
  await page.getByTestId("plain-answer-response").waitFor({ timeout: 30000 });
  await page.waitForTimeout(600);

  const chipCount = await page.locator(".answer-footer-search-chip:visible").count();
  if (chipCount > 0) {
    throw new Error(`Expected 0 footer chips in answer mode, found ${chipCount}.`);
  }

  await page.screenshot({ path: outPath, fullPage: false });
  await page.locator("form.answer-footer-search-edge").first().screenshot({ path: outBottomPath });
  console.log(outPath);
  console.log(outBottomPath);
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
