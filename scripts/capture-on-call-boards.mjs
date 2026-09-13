#!/usr/bin/env node
/**
 * Put the built On Call screens beside the artboards they were drawn from.
 *
 * `tests/ui-on-call-boards.spec.ts` proves the drawn elements are on the page.
 * It cannot tell anyone whether the page LOOKS right, and the owner reviews
 * this mode by eye. So this renders each board's artboard and the real route
 * that implements it at the same width, side by side, into one contact sheet
 * per board plus a single index page.
 *
 * It is a review aid, never a gate: there is no pixel comparison and no
 * threshold to tune. A screenshot diff between a hand-drawn comp and a real
 * application is noise — the useful question is "does this read as the same
 * screen", and only a person can answer it.
 *
 * Output goes to the gitignored `.tmp-visual/` scratch tree, like the
 * design-system inventory captures, because these are review baselines rather
 * than committed artefacts.
 *
 * Usage:
 *   npm run ensure                                   # start/verify THIS project's server
 *   node scripts/capture-on-call-boards.mjs
 *   node scripts/capture-on-call-boards.mjs --base-url http://localhost:PORT
 *   node scripts/capture-on-call-boards.mjs --dark
 *
 * Never assumes localhost:3000. Refuses to capture unless /api/local-project-id
 * confirms this project (AGENTS.md local server safety).
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

import { localProjectId } from "../src/lib/local-server-utils.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedProjectId = localProjectId(projectRoot);
const outDir = path.join(projectRoot, ".tmp-visual", "on-call-boards");
const mockupPath = path.join(projectRoot, "docs", "on-call", "design", "prototypes", "on-call-screens.html");

/** The list each section route renders once its entries have arrived. */
const SECTION_LISTS = {
  "/on-call/contacts": "on-call-contacts-section",
  "/on-call/playbook": "on-call-playbook-section",
  "/on-call/referrals": "on-call-referrals-section",
  "/on-call/orientation": "on-call-orientation-section",
  "/on-call/education": "on-call-education-section",
  "/on-call/logistics": "on-call-logistics-section",
  "/on-call/who-is-who": "on-call-who-is-who-section",
};

/** The width every artboard was drawn at. */
const PHONE = { width: 390, height: 844 };

/**
 * Each board, and the route that implements it.
 *
 * A board with no route is one waiting on the database change; it is captured
 * from the drawing alone and labelled, so the sheet shows what is still to come
 * rather than quietly omitting it.
 */
const BOARDS = [
  { no: "01", title: "Home", route: "/on-call" },
  { no: "02", title: "Jump to a group", route: "/on-call/contacts", open: "jump-to" },
  { no: "03", title: "All modes", route: "/on-call/contacts", open: "mode-sheet" },
  { no: "04", title: "Site", route: null, note: "Waiting on the database change" },
  { no: "05", title: "Page menu", route: "/on-call/contacts", open: "page-menu" },
  { no: "06", title: "Contacts", route: "/on-call/contacts" },
  { no: "07", title: "Playbook", route: "/on-call/playbook" },
  { no: "08", title: "Referrals", route: "/on-call/referrals" },
  { no: "09", title: "Forms", route: null, note: "Waiting on the database change" },
  { no: "10", title: "Orientation", route: "/on-call/orientation" },
  { no: "11", title: "Logistics", route: "/on-call/logistics" },
];

function parseArgs(argv) {
  const args = { baseUrl: null, dark: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--base-url") args.baseUrl = argv[index + 1];
    if (argv[index] === "--dark") args.dark = true;
  }
  return args;
}

function requestText(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (response) => {
        let body = "";
        response.on("data", (chunk) => (body += chunk));
        response.on("end", () => resolve({ status: response.statusCode ?? 0, body }));
      })
      .on("error", reject);
  });
}

/** AGENTS.md local server safety: never attach to another project's server. */
async function assertProjectIdentity(baseUrl) {
  let response;
  try {
    response = await requestText(`${baseUrl}/api/local-project-id`);
  } catch (error) {
    console.error(`[on-call:capture] Refusing to capture: ${baseUrl} is not reachable (${error.message}).`);
    console.error("[on-call:capture] Run `npm run ensure` and pass the URL it prints.");
    process.exit(1);
  }
  if (response.status !== 200) {
    console.error(`[on-call:capture] Refusing to capture: /api/local-project-id returned HTTP ${response.status}.`);
    process.exit(1);
  }
  let parsed;
  try {
    parsed = JSON.parse(response.body);
  } catch {
    console.error("[on-call:capture] Refusing to capture: local-project-id response was not JSON.");
    process.exit(1);
  }
  if (parsed.projectId !== expectedProjectId) {
    console.error(
      `[on-call:capture] Refusing to capture: ${baseUrl} belongs to project "${parsed.projectId}", not this one.`,
    );
    process.exit(1);
  }
}

/** Opens whichever overlay the board is drawn with, then waits for it. */
async function openOverlay(page, kind) {
  if (kind === "mode-sheet") {
    await page.getByRole("button", { name: /Mode/ }).first().click();
    await page
      .getByTestId("app-mode-menu-sheet")
      .waitFor({ state: "visible" })
      .catch(() => {});
  }
  if (kind === "page-menu") {
    await page.getByTestId("on-call-section-actions-trigger").click();
    await page.getByRole("dialog").waitFor({ state: "visible" });
  }
  if (kind === "jump-to") {
    await page.getByTestId("on-call-section-section-trigger").click();
    await page.getByRole("dialog").waitFor({ state: "visible" });
  }
  // Sheets animate in; the capture should not catch one mid-slide.
  await page.waitForTimeout(400);
}

async function captureBuilt(browser, baseUrl, board, dark) {
  const context = await browser.newContext({
    viewport: PHONE,
    deviceScaleFactor: 2,
    colorScheme: dark ? "dark" : "light",
  });
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}${board.route}`, { waitUntil: "networkidle" });
    // The entry store fetches on the client, so the page arrives after load.
    // The hub and a section page announce readiness differently: the hub has no
    // page header, and a section page's header renders before its entries do.
    if (board.route === "/on-call") {
      await page.getByTestId("on-call-home-sections").waitFor({ state: "visible", timeout: 20_000 });
    } else {
      await page.getByTestId("on-call-section-detail-header").waitFor({ state: "visible", timeout: 20_000 });
      const list = SECTION_LISTS[board.route];
      if (list) await page.getByTestId(list).waitFor({ state: "visible", timeout: 20_000 });
    }
    await page.waitForTimeout(600);
    if (board.open) await openOverlay(page, board.open);
    const file = path.join(outDir, `board-${board.no}-built${dark ? "-dark" : ""}.png`);
    await page.screenshot({ path: file, fullPage: !board.open });
    return path.basename(file);
  } finally {
    await context.close();
  }
}

async function captureDrawn(browser, board) {
  const context = await browser.newContext({ viewport: { width: 470, height: 1000 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  try {
    await page.goto(`file://${mockupPath}`, { waitUntil: "networkidle" });
    // Each artboard is one `.board`, in drawn order, so the number indexes it.
    const board_ = page.locator("article.board").nth(Number(board.no) - 1);
    const frame = board_.locator(".frame").first();
    await frame.waitFor({ state: "visible" });
    const file = path.join(outDir, `board-${board.no}-drawn.png`);
    await frame.screenshot({ path: file });
    return path.basename(file);
  } finally {
    await context.close();
  }
}

function indexHtml(rows, dark) {
  const cards = rows
    .map(
      (row) => `
    <section class="board">
      <h2>${row.no} &middot; ${row.title}</h2>
      ${row.note ? `<p class="note">${row.note}</p>` : ""}
      <div class="pair">
        <figure><figcaption>Drawn</figcaption><img src="${row.drawn}" alt="Board ${row.no} as drawn" /></figure>
        ${
          row.built
            ? `<figure><figcaption>Built</figcaption><img src="${row.built}" alt="Board ${row.no} as built" /></figure>`
            : `<figure class="missing"><figcaption>Built</figcaption><div>Not built yet</div></figure>`
        }
      </div>
    </section>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>On Call — drawn beside built</title>
<style>
  :root { color-scheme: light; --ink: #14181f; --muted: #5b6472; --line: #e2e6ec; --bg: #f6f7f9; }
  body { margin: 0; padding: 32px; background: var(--bg); color: var(--ink);
         font: 15px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  h1 { font-size: 24px; margin: 0 0 6px; }
  .lede { color: var(--muted); max-width: 60ch; margin: 0 0 28px; }
  .board { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 18px; margin-bottom: 22px; }
  .board h2 { font-size: 16px; margin: 0 0 10px; }
  .note { color: var(--muted); font-size: 13px; margin: -4px 0 12px; }
  .pair { display: flex; gap: 20px; flex-wrap: wrap; align-items: flex-start; }
  figure { margin: 0; }
  figcaption { font-size: 12px; font-weight: 700; text-transform: uppercase;
               letter-spacing: .06em; color: var(--muted); margin-bottom: 8px; }
  img { max-width: 390px; width: 100%; border: 1px solid var(--line); border-radius: 10px; display: block; }
  .missing div { width: 390px; max-width: 100%; height: 300px; display: grid; place-items: center;
                 border: 1px dashed var(--line); border-radius: 10px; color: var(--muted); }
</style>
</head>
<body>
  <h1>On Call — drawn beside built${dark ? " (dark)" : ""}</h1>
  <p class="lede">Each artboard next to the screen the app actually renders, both at 390&nbsp;px.
     A review aid, not a gate: nothing here compares pixels, because a hand-drawn comp and a real
     application never match pixel for pixel and the useful question is whether they read as the
     same screen.</p>
${cards}
</body>
</html>`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = (args.baseUrl ?? process.env.CAPTURE_BASE_URL ?? "").replace(/\/$/, "");
  if (!baseUrl) {
    console.error("[on-call:capture] Pass --base-url http://localhost:PORT (run `npm run ensure` for the URL).");
    process.exit(1);
  }
  await assertProjectIdentity(baseUrl);

  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const rows = [];
  try {
    for (const board of BOARDS) {
      const drawn = await captureDrawn(browser, board);
      const built = board.route ? await captureBuilt(browser, baseUrl, board, args.dark) : null;
      rows.push({ ...board, drawn, built });
      console.log(`[on-call:capture] board ${board.no} ${board.title}: ${built ? "drawn + built" : "drawn only"}`);
    }
  } finally {
    await browser.close();
  }

  const indexPath = path.join(outDir, args.dark ? "index-dark.html" : "index.html");
  fs.writeFileSync(indexPath, indexHtml(rows, args.dark), "utf8");
  console.log(`[on-call:capture] wrote ${indexPath}`);
}

main().catch((error) => {
  console.error("[on-call:capture]", error);
  process.exit(1);
});
