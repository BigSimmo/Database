#!/usr/bin/env node
/**
 * Capture redesign “current” baselines after `npm run ensure`.
 *
 * Two modes:
 *
 * 1. Comps mode (default) — writes desktop (1280×900) + phone (390×844) PNGs under
 *    public/mockups/mode-page-redesign-2026-07/current/, matching the comps README.
 *
 * 2. Inventory mode (`--inventory`) — walks the design-system inventory routes across
 *    light/dark × desktop/320px, plus forced-colors and print where relevant, and writes
 *    into the gitignored `.tmp-visual/` scratch tree. These are review baselines for
 *    design-system work; they are never committed (see .gitignore "Visual-QA capture
 *    scratch"). Re-point a detached capture worktree at any tip and re-run to diff.
 *
 * Usage:
 *   node scripts/ensure-local-server.mjs           # or: npm run ensure
 *   node scripts/capture-mockup-screenshots.mjs
 *   node scripts/capture-mockup-screenshots.mjs --inventory --label wave-m1
 *   node scripts/capture-mockup-screenshots.mjs --inventory --only therapy
 *   node scripts/capture-mockup-screenshots.mjs --base-url http://localhost:PORT
 *   node scripts/capture-mockup-screenshots.mjs --print-url-only
 *
 * Never assumes localhost:3000. Refuses to capture unless /api/local-project-id
 * confirms this project (AGENTS.md local server safety).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

import { localProjectId } from "../src/lib/local-server-utils.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedProjectId = localProjectId(projectRoot);
const compsOutDir = path.join(projectRoot, "public", "mockups", "mode-page-redesign-2026-07", "current");
const inventoryRoot = path.join(projectRoot, ".tmp-visual", "ds-v2-baseline");
/** Seeded demo document used for provenance/source inventory captures. */
const DEMO_DOCUMENT_ID = "11111111-1111-4111-8111-111111111111";

const DESKTOP = { width: 1280, height: 900 };
const PHONE = { width: 390, height: 844 };
/** 320px is the blocking narrow breakpoint (GATES §"320px is blocking"). */
const PHONE_320 = { width: 320, height: 844 };

/** Production routes used as “current” comps for #162–#164. */
const TARGETS = [
  { name: "tools-search", path: "/tools?q=lithium" },
  { name: "services-search", path: "/services?q=perth" },
  { name: "favourites-home", path: "/favourites" },
  { name: "favourites-search", path: "/favourites?q=lithium" },
];

/**
 * Design-system inventory surfaces, grouped by the categories the DS work order uses:
 * answer · headers · therapy · forms · catalogues · docs · provenance · print.
 * `print: true` additionally captures an `emulateMedia({ media: "print" })` pass.
 */
const INVENTORY = [
  { group: "answer", name: "answer-home", path: "/", print: true },
  { group: "answer", name: "answer-query", path: "/?q=lithium%20monitoring", print: true },
  { group: "headers", name: "headers-tools", path: "/tools?q=lithium" },
  { group: "headers", name: "headers-doc-search", path: "/documents/search?q=lithium" },
  { group: "therapy", name: "therapy-home", path: "/therapy-compass" },
  { group: "therapy", name: "therapy-search", path: "/therapy-compass/search" },
  { group: "therapy", name: "therapy-compare", path: "/therapy-compass/compare" },
  { group: "therapy", name: "therapy-pathways", path: "/therapy-compass/pathways" },
  { group: "therapy", name: "therapy-recommend", path: "/therapy-compass/recommend" },
  { group: "forms", name: "forms-home", path: "/forms" },
  { group: "catalogues", name: "cat-dsm", path: "/dsm" },
  { group: "catalogues", name: "cat-factsheets", path: "/factsheets" },
  { group: "catalogues", name: "cat-specifiers", path: "/specifiers" },
  { group: "catalogues", name: "cat-formulation", path: "/formulation" },
  { group: "catalogues", name: "cat-calculators", path: "/calculators" },
  { group: "catalogues", name: "cat-differentials", path: "/differentials" },
  { group: "catalogues", name: "cat-favourites", path: "/favourites" },
  { group: "docs", name: "docs-search", path: "/documents/search" },
  // /documents/source* require a valid id or they redirect to /documents/search.
  {
    group: "provenance",
    name: "prov-source",
    path: `/documents/source?id=${DEMO_DOCUMENT_ID}&page=1`,
    print: true,
    expectPathPrefix: `/documents/${DEMO_DOCUMENT_ID}`,
  },
  {
    group: "provenance",
    name: "prov-evidence",
    path: `/documents/source/evidence?id=${DEMO_DOCUMENT_ID}&page=1`,
    print: true,
    expectPathPrefix: `/documents/${DEMO_DOCUMENT_ID}`,
  },
  { group: "print", name: "print-safety-plan", path: "/safety-plan", print: true },
  { group: "print", name: "print-colour-coding", path: "/reference/colour-coding", print: true },
];

/** Screen variants captured for every inventory route. */
const INVENTORY_VARIANTS = [
  { label: "light-desktop", viewport: DESKTOP, dark: false },
  { label: "light-320", viewport: PHONE_320, dark: false },
  { label: "dark-desktop", viewport: DESKTOP, dark: true },
  { label: "dark-320", viewport: PHONE_320, dark: true },
  { label: "hcm-desktop", viewport: DESKTOP, dark: false, forcedColors: true },
  { label: "hcm-320", viewport: PHONE_320, dark: false, forcedColors: true },
];

function parseArgs(argv) {
  const args = {
    baseUrl: null,
    printUrlOnly: false,
    help: false,
    inventory: false,
    label: "baseline",
    outDir: null,
    only: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--print-url-only") args.printUrlOnly = true;
    else if (a === "--inventory") args.inventory = true;
    else if (a === "--base-url") {
      args.baseUrl = argv[i + 1];
      i += 1;
    } else if (a.startsWith("--base-url=")) {
      args.baseUrl = a.slice("--base-url=".length);
    } else if (a === "--label") {
      args.label = argv[i + 1];
      i += 1;
    } else if (a.startsWith("--label=")) {
      args.label = a.slice("--label=".length);
    } else if (a === "--out-dir") {
      args.outDir = argv[i + 1];
      i += 1;
    } else if (a.startsWith("--out-dir=")) {
      args.outDir = a.slice("--out-dir=".length);
    } else if (a === "--only") {
      args.only = argv[i + 1];
      i += 1;
    } else if (a.startsWith("--only=")) {
      args.only = a.slice("--only=".length);
    }
  }
  return args;
}

function requestText(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        resolve({
          status: res.statusCode ?? 0,
          body: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });
    req.on("error", () => resolve({ status: 0, body: "" }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ status: 0, body: "" });
    });
  });
}

function resolveBaseUrlFromEnsure() {
  const result = spawnSync(
    process.execPath,
    [path.join(projectRoot, "scripts", "ensure-local-server.mjs"), "--print-url"],
    {
      cwd: projectRoot,
      encoding: "utf8",
      env: process.env,
    },
  );
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout || "ensure --print-url failed");
    process.exit(result.status ?? 1);
  }
  const line = (result.stdout || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => /^https?:\/\//.test(l));
  if (!line) {
    console.error("ensure --print-url did not print a URL");
    process.exit(1);
  }
  return line.replace(/\/$/, "");
}

async function assertProjectIdentity(baseUrl) {
  const { status, body } = await requestText(`${baseUrl}/api/local-project-id`);
  if (status !== 200) {
    console.error(`[mockups:capture] Refusing to capture: could not verify /api/local-project-id (HTTP ${status}).`);
    process.exit(1);
  }
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    console.error("[mockups:capture] Refusing to capture: local-project-id response was not JSON");
    process.exit(1);
  }
  const got = typeof parsed?.projectId === "string" ? parsed.projectId.trim() : "";
  if (!got) {
    console.error("[mockups:capture] Refusing to capture: local-project-id response missing projectId");
    process.exit(1);
  }
  if (got !== expectedProjectId) {
    console.error(`[mockups:capture] Refusing to capture: server projectId ${got} !== ${expectedProjectId}`);
    process.exit(1);
  }
  console.log(`[mockups:capture] Confirmed local project id ${expectedProjectId}`);
}

async function settle(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  try {
    await page.waitForLoadState("networkidle", { timeout: 15_000 });
  } catch {
    // Routes with background polling never reach networkidle; the settle delay is enough.
  }
  await new Promise((r) => setTimeout(r, 600));
}

async function captureComps(browser, baseUrl) {
  fs.mkdirSync(compsOutDir, { recursive: true });
  for (const target of TARGETS) {
    for (const [label, viewport] of [
      ["desktop", DESKTOP],
      ["phone", PHONE],
    ]) {
      const page = await browser.newPage({
        viewport,
        deviceScaleFactor: 1,
        reducedMotion: "reduce",
      });
      const url = `${baseUrl}${target.path}`;
      console.log(`[mockups:capture] ${target.name} ${label} → ${url}`);
      await settle(page, url);
      const file = path.join(compsOutDir, `current-${target.name}-${label}.png`);
      await page.screenshot({ path: file, fullPage: false });
      await page.close();
      console.log(`[mockups:capture] Wrote ${path.relative(projectRoot, file)}`);
    }
  }
  console.log(`[mockups:capture] Done (${TARGETS.length * 2} files in current/)`);
}

async function captureInventory(browser, baseUrl, args) {
  const outDir = args.outDir ? path.resolve(projectRoot, args.outDir) : path.join(inventoryRoot, args.label);
  fs.mkdirSync(outDir, { recursive: true });

  const routes = args.only ? INVENTORY.filter((r) => r.group === args.only || r.name.includes(args.only)) : INVENTORY;
  if (routes.length === 0) {
    console.error(`[mockups:capture] --only ${args.only} matched no inventory route`);
    process.exit(1);
  }

  let written = 0;
  const failures = [];

  for (const route of routes) {
    const variants = [...INVENTORY_VARIANTS];
    if (route.print) {
      variants.push({ label: "print-desktop", viewport: DESKTOP, dark: false, print: true });
    }
    for (const variant of variants) {
      const file = path.join(outDir, `${route.group}__${route.name}__${variant.label}.png`);
      const url = `${baseUrl}${route.path}`;
      let page;
      try {
        page = await browser.newPage({
          viewport: variant.viewport,
          deviceScaleFactor: 1,
          reducedMotion: "reduce",
          colorScheme: variant.dark ? "dark" : "light",
        });
        if (variant.dark) {
          // Production puts `.dark` on documentElement; set it pre-paint.
          await page.addInitScript(() => {
            document.documentElement.classList.add("dark");
          });
        }
        if (variant.forcedColors) await page.emulateMedia({ forcedColors: "active" });
        if (variant.print) await page.emulateMedia({ media: "print" });
        await settle(page, url);
        if (route.expectPathPrefix) {
          const landed = new URL(page.url()).pathname;
          if (!landed.startsWith(route.expectPathPrefix)) {
            throw new Error(`expected path prefix ${route.expectPathPrefix} after navigation, landed on ${landed}`);
          }
        }
        await page.screenshot({ path: file, fullPage: true });
        written += 1;
        console.log(`[mockups:capture] ${route.name} ${variant.label} → ${path.basename(file)}`);
      } catch (error) {
        failures.push(`${route.name} ${variant.label}: ${error?.message ?? error}`);
        console.warn(`[mockups:capture] FAILED ${route.name} ${variant.label}: ${error?.message}`);
      } finally {
        if (page) await page.close().catch(() => {});
      }
    }
  }

  console.log(
    `[mockups:capture] Inventory done — ${written} PNGs in ${path.relative(projectRoot, outDir)}` +
      (failures.length ? ` (${failures.length} failed)` : ""),
  );
  for (const f of failures) console.log(`[mockups:capture]   FAIL ${f}`);
  return { written, failures, outDir };
}

async function capture() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage: node scripts/capture-mockup-screenshots.mjs [options]

Comps mode (default): desktop ${DESKTOP.width}×${DESKTOP.height} and phone ${PHONE.width}×${PHONE.height}
PNGs into ${path.relative(projectRoot, compsOutDir)}.

  --inventory            capture the design-system inventory matrix instead
                         (light/dark × desktop/${PHONE_320.width}px, forced-colors, print)
  --label <name>         inventory subdirectory name (default "baseline")
  --out-dir <path>       explicit output directory (repo-relative or absolute)
  --only <group|name>    limit inventory to one group (answer, headers, therapy, forms,
                         catalogues, docs, provenance, print) or a route name substring
  --base-url <url>       skip ensure and use this URL
  --print-url-only       resolve the URL via ensure --print-url, then exit

Inventory output goes to ${path.relative(projectRoot, inventoryRoot)}/<label>/ which is
gitignored — these baselines are review evidence and are never committed.

Run \`node scripts/ensure-local-server.mjs\` first (or pass --base-url).`);
    process.exit(0);
  }

  const baseUrl = (args.baseUrl || resolveBaseUrlFromEnsure()).replace(/\/$/, "");
  if (args.printUrlOnly) {
    console.log(baseUrl);
    process.exit(0);
  }

  console.log(`[mockups:capture] Base URL ${baseUrl}`);
  await assertProjectIdentity(baseUrl);

  const browser = await chromium.launch({ headless: true });
  try {
    if (args.inventory) {
      const { failures } = await captureInventory(browser, baseUrl, args);
      if (failures.length > 0) process.exitCode = 1;
    } else {
      await captureComps(browser, baseUrl);
    }
  } finally {
    await browser.close();
  }
}

capture().catch((error) => {
  console.error(error);
  process.exit(1);
});
