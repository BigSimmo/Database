/**
 * Computed-style parity capture for the chrome-class @layer migration.
 *
 * Captures getComputedStyle snapshots for the header/composer chrome across
 * deterministic app states, so a CSS refactor can prove pixel-identical
 * output: capture a baseline at the pre-change commit, re-capture after each
 * change, and diff the JSON. Selectors are refactor-stable (testids, aria
 * labels, structure) — never the chrome class names being migrated.
 *
 * Usage:
 *   npx tsx scripts/capture-chrome-parity.ts --label baseline [--out <dir>]
 *   npx tsx scripts/capture-chrome-parity.ts --compare <a.json> <b.json>
 *
 * Requires the dev server (npm run ensure) at PLAYWRIGHT_BASE_URL or
 * http://localhost:3500. Snapshots are machine-specific; keep them out of
 * the repo (default output dir is scratch/chrome-parity, git-ignored by the
 * format gate and never committed).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, type BrowserContext, type Page, type Route } from "playwright-core";

import { demoAnswer, demoDocuments, getDemoDocumentPayload } from "../src/lib/demo-data";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3500";
const DOCUMENT_PATH =
  "/documents/11111111-1111-4111-8111-111111111111?page=1&chunk=44444444-4444-4444-8444-444444444442";
const QUERY_TEXT = "Synthetic lithium monitoring guidance";

const readySetupChecks = [
  { id: "env", label: ".env.local configured", status: "ready", detail: "Parity environment ready." },
  { id: "project", label: "Clinical KB Database target", status: "ready", detail: "Parity Supabase ready." },
  { id: "schema", label: "supabase/schema.sql applied", status: "ready", detail: "Parity schema ready." },
  { id: "search", label: "Search RPC and vector indexes", status: "ready", detail: "Parity search ready." },
  { id: "openai", label: "OpenAI API key available", status: "ready", detail: "Parity OpenAI ready." },
  { id: "worker", label: "npm run worker running", status: "unknown", detail: "Worker not required." },
];

const capturedProperties = [
  "display",
  "box-shadow",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "row-gap",
  "column-gap",
  "min-height",
  "height",
  "width",
  "font-size",
  "font-weight",
  "line-height",
  "letter-spacing",
  "color",
  "background-color",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "border-top-color",
  "border-bottom-color",
  "border-top-left-radius",
  "border-bottom-right-radius",
  "transition-property",
  "transition-duration",
  "transform",
  "top",
  "right",
  "bottom",
  "left",
  "isolation",
] as const;

/** Refactor-stable selector groups. `pseudo` captures an extra pseudo-element snapshot. */
const selectorGroups: Array<{ key: string; selector: string; pseudo?: string }> = [
  { key: "header", selector: "header#search", pseudo: "::after" },
  { key: "header-buttons", selector: "header#search button" },
  { key: "mode-pill", selector: '[aria-label^="Current app mode"]' },
  { key: "composer-form", selector: 'form:has([data-testid="global-search-input"])' },
  { key: "composer-children", selector: 'form:has([data-testid="global-search-input"]) > *' },
  { key: "composer-pill-children", selector: 'form:has([data-testid="global-search-input"]) > div > *' },
  { key: "composer-input", selector: '[data-testid="global-search-input"]', pseudo: "::placeholder" },
  { key: "composer-buttons", selector: 'form:has([data-testid="global-search-input"]) button' },
  { key: "evidence-chip", selector: 'button[aria-label="Open evidence-backed answer sources"]' },
  { key: "evidence-chip-icon", selector: 'button[aria-label="Open evidence-backed answer sources"] svg' },
  { key: "scope-chip", selector: 'button[aria-label="Open source scope"]' },
  { key: "scope-chip-icon", selector: 'button[aria-label="Open source scope"] svg' },
  { key: "viewer-header", selector: "main header, body > div > header", pseudo: "::after" },
  { key: "viewer-composer", selector: 'form:has(input[placeholder^="Search or answer"])' },
  { key: "viewer-composer-children", selector: 'form:has(input[placeholder^="Search or answer"]) > *' },
];

type Snapshot = Record<string, Record<string, string>>;

async function mockApis(page: Page) {
  await page.route("**/api/setup-status**", async (route) => {
    await route.fulfill({ json: { demoMode: true, checks: readySetupChecks } });
  });
  await page.route(/\/api\/documents\/[0-9a-f-]+(?:\?.*)?$/, async (route) => {
    const id = new URL(route.request().url()).pathname.split("/").pop() ?? "";
    const payload = getDemoDocumentPayload(id);
    if (payload) await route.fulfill({ json: payload });
    else await route.fulfill({ status: 404, json: { error: "not found" } });
  });
  await page.route(/\/api\/documents(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      json: {
        documents: demoDocuments,
        demoMode: true,
        pagination: { limit: 150, offset: 0, total: demoDocuments.length, nextOffset: demoDocuments.length, hasMore: false },
      },
    });
  });
  await page.route(/\/api\/ingestion\/(jobs|batches|quality)(?:\?.*)?$/, async (route) => {
    await route.fulfill({ json: { jobs: [], batches: [], items: [], demoMode: true } });
  });
  await page.route(/\/api\/answer(?:\/stream)?(?:\?.*)?$/, async (route: Route) => {
    const body = route.request().postDataJSON() as { query?: string; documentId?: string; documentIds?: string[] };
    const payload = { ...demoAnswer(body.query ?? QUERY_TEXT, body.documentId, body.documentIds), demoMode: true };
    if (new URL(route.request().url()).pathname.endsWith("/stream")) {
      await route.fulfill({
        body: [
          `event: progress\ndata: ${JSON.stringify({ stage: "retrieving", message: "Searching indexed documents." })}`,
          `event: final\ndata: ${JSON.stringify(payload)}`,
          "",
        ].join("\n\n"),
        contentType: "text/event-stream; charset=utf-8",
        headers: { "Cache-Control": "no-cache, no-transform" },
      });
      return;
    }
    await route.fulfill({ json: payload });
  });
}

async function captureState(page: Page, groups = selectorGroups): Promise<Snapshot> {
  return page.evaluate(
    ({ groupList, properties }) => {
      const snapshot: Record<string, Record<string, string>> = {};
      for (const group of groupList) {
        const elements = Array.from(document.querySelectorAll(group.selector));
        elements.forEach((element, index) => {
          const record: Record<string, string> = {};
          const style = getComputedStyle(element);
          for (const property of properties) record[property] = style.getPropertyValue(property);
          snapshot[`${group.key}[${index}]`] = record;
          if (group.pseudo) {
            const pseudoStyle = getComputedStyle(element, group.pseudo);
            const pseudoRecord: Record<string, string> = {};
            for (const property of properties) pseudoRecord[property] = pseudoStyle.getPropertyValue(property);
            snapshot[`${group.key}[${index}]${group.pseudo}`] = pseudoRecord;
          }
        });
      }
      return snapshot;
    },
    { groupList: groups, properties: capturedProperties as unknown as string[] },
  );
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(500);
}

async function captureAll(context: BrowserContext, dark: boolean): Promise<Record<string, Snapshot>> {
  const states: Record<string, Snapshot> = {};
  const page = await context.newPage();
  await mockApis(page);
  if (dark) {
    await page.addInitScript(() => window.localStorage.setItem("clinical-kb-theme", "dark"));
  }
  const suffix = dark ? "dark" : "light";

  for (const viewport of [
    { tag: "mobile", width: 390, height: 820 },
    { tag: "desktop", width: 1280, height: 900 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    // 1. Home (desktop-home / mobile composer variants).
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await settle(page);
    states[`home-${viewport.tag}-${suffix}`] = await captureState(page);

    // 2. Answer-footer state: type + submit the mocked answer.
    const input = page.locator('[data-testid="global-search-input"]:visible').first();
    await input.fill(QUERY_TEXT);
    await page.keyboard.press("Control+Enter");
    await page
      .getByTestId("plain-answer-response")
      .waitFor({ timeout: 20_000 })
      .catch(() => undefined);
    await settle(page);
    states[`answer-${viewport.tag}-${suffix}`] = await captureState(page);

    // 3. Focus sub-state (focus-within ring on the pill).
    await input.focus();
    await page.waitForTimeout(250);
    states[`answer-focus-${viewport.tag}-${suffix}`] = await captureState(page);

    // 4. Document viewer chrome.
    await page.goto(`${BASE}${DOCUMENT_PATH}`, { waitUntil: "domcontentloaded" });
    await settle(page);
    states[`document-${viewport.tag}-${suffix}`] = await captureState(page);
  }

  await page.close();
  return states;
}

function compare(fileA: string, fileB: string): number {
  const a = JSON.parse(readFileSync(fileA, "utf8")) as Record<string, Snapshot>;
  const b = JSON.parse(readFileSync(fileB, "utf8")) as Record<string, Snapshot>;
  const differences: string[] = [];
  const stateKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const state of stateKeys) {
    const stateA = a[state] ?? {};
    const stateB = b[state] ?? {};
    const elementKeys = new Set([...Object.keys(stateA), ...Object.keys(stateB)]);
    for (const element of elementKeys) {
      const recordA = stateA[element];
      const recordB = stateB[element];
      if (!recordA || !recordB) {
        differences.push(`${state} :: ${element} :: ${!recordA ? "missing in A" : "missing in B"}`);
        continue;
      }
      for (const property of Object.keys(recordA)) {
        if (recordA[property] !== recordB[property]) {
          differences.push(`${state} :: ${element} :: ${property}: "${recordA[property]}" -> "${recordB[property]}"`);
        }
      }
    }
  }
  if (differences.length === 0) {
    console.log(`PARITY OK — no computed-style differences (${stateKeys.size} states)`);
    return 0;
  }
  console.error(`PARITY FAILED — ${differences.length} difference(s):`);
  for (const difference of differences.slice(0, 200)) console.error(`  ${difference}`);
  if (differences.length > 200) console.error(`  … and ${differences.length - 200} more`);
  return 1;
}

async function main() {
  const args = process.argv.slice(2);
  const compareIndex = args.indexOf("--compare");
  if (compareIndex !== -1) {
    process.exit(compare(args[compareIndex + 1], args[compareIndex + 2]));
  }

  const labelIndex = args.indexOf("--label");
  const label = labelIndex !== -1 ? args[labelIndex + 1] : "capture";
  const outIndex = args.indexOf("--out");
  const outDir = outIndex !== -1 ? args[outIndex + 1] : path.join(process.cwd(), "scratch", "chrome-parity");
  mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  const all: Record<string, Snapshot> = {};
  for (const dark of [false, true]) {
    const context = await browser.newContext({ deviceScaleFactor: 1 });
    Object.assign(all, await captureAll(context, dark));
    await context.close();
  }
  await browser.close();

  const outPath = path.join(outDir, `${label}.json`);
  writeFileSync(outPath, JSON.stringify(all, null, 1));
  const stateCount = Object.keys(all).length;
  const elementCount = Object.values(all).reduce((sum, state) => sum + Object.keys(state).length, 0);
  console.log(`captured ${stateCount} states / ${elementCount} element snapshots -> ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
