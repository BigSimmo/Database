#!/usr/bin/env node
/**
 * measure-cls-attribution — attribute mobile CLS to the DOM elements that move.
 *
 * Ledger `#147`. Lighthouse tells you a route's CLS but not what shifted: its
 * `layout-shift-elements` audit returned zero items on every route here, and the
 * `cumulative-layout-shift` audit carries only `debugdata`. This drives Chromium
 * directly with a `PerformanceObserver` on `layout-shift`, which exposes
 * `entry.sources[].node` — so a breach becomes a named element and a pixel
 * delta rather than a number to reason about.
 *
 * It also records a timeline of `--phone-overlay-chrome-h` writes, because the
 * dominant finding on this codebase was a *round trip*: the reserve is published
 * at one value and corrected moments later, moving all main content down and
 * back. A single after-the-fact reading cannot see that; only the sequence can.
 *
 * Build and serve mirror `scripts/run-lighthouse-budget.mjs` exactly — offline
 * provider env, demo corpus, inert loopback Supabase, and an isolated
 * `.next-playwright/<run-id>/dist` output (that prefix is required by the boot
 * guard in `next.config.ts`). Same app as the Lighthouse budget measures, so the
 * numbers are comparable with the run recorded in `#147`.
 *
 * **CLS reproduces offline; LCP does not.** The four mobile CLS numbers matched
 * the live production dispatch to three decimals, because layout shift is
 * deterministic structure. LCP does not reproduce here at all — a loopback
 * server has no network latency — so do not read LCP off this harness.
 *
 * Provider-free and DB-free. Nothing here contacts OpenAI, hosted Supabase, or
 * any live service.
 *
 * Usage:
 *   node scripts/measure-cls-attribution.mjs [--out <file>] [--routes a,b,c]
 *                                            [--port <n>] [--settle-ms <n>]
 *
 * Chromium: honours `CHROME_PATH` or `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`, and
 * otherwise lets Playwright resolve its own browser (which respects
 * `PLAYWRIGHT_BROWSERS_PATH`). In containers where the browser lives outside a
 * standard location and neither variable is set, `chrome-launcher`-style
 * resolution fails on every route — set one of them.
 */
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { offlineTestEnvironment } from "./test-environment.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
};

const routes = flag("routes", "/dsm,/documents/search,/forms,/therapy-compass,/")
  .split(",")
  .map((route) => route.trim())
  .filter(Boolean);
const port = Number(flag("port", "4611"));
const settleMs = Number(flag("settle-ms", "6000"));
const outFile = path.resolve(projectRoot, flag("out", "cls-attribution.json"));
const baseUrl = `http://127.0.0.1:${port}`;

const runId = `lighthouse-cls-${process.pid}-${Date.now()}`;
const relativeRunRoot = `.next-playwright/${runId}`;
const absoluteRunRoot = path.join(projectRoot, relativeRunRoot);

mkdirSync(absoluteRunRoot, { recursive: true });
writeFileSync(
  path.join(absoluteRunRoot, "tsconfig.json"),
  `${JSON.stringify({ extends: "../../tsconfig.json", compilerOptions: { noEmit: true } }, null, 2)}\n`,
  "utf8",
);

const env = offlineTestEnvironment(process.env, {
  PORT: String(port),
  NEXT_DIST_DIR: `${relativeRunRoot}/dist`,
  NEXT_TSCONFIG_PATH: `${relativeRunRoot}/tsconfig.json`,
  NODE_ENV: "production",
  PLAYWRIGHT_OFFLINE_MODE: "true",
  NEXT_PUBLIC_MOCKUPS_ENABLED: "false",
});

/** Resolves once the isolated server answers, or rejects if it dies first. */
function waitForServer(url, child) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 120_000;
    let exited = false;
    child.on("exit", () => {
      exited = true;
    });
    const poll = () => {
      if (exited) return reject(new Error("isolated server exited before becoming ready"));
      if (Date.now() > deadline) return reject(new Error("isolated server did not become ready within 120s"));
      http
        .get(url, (response) => {
          response.resume();
          resolve();
        })
        .on("error", () => setTimeout(poll, 500));
    };
    poll();
  });
}

/**
 * Injected before any app code runs. Records layout shifts with their source
 * elements, plus every write to the phone chrome reserve.
 */
const PAGE_INSTRUMENTATION = () => {
  window.__clsEntries = [];
  window.__reserveTimeline = [];

  let lastReserve = null;
  const recordReserve = () => {
    const value = document.documentElement.style.getPropertyValue("--phone-overlay-chrome-h").trim() || "(unset)";
    if (value === lastReserve) return;
    lastReserve = value;
    const stack = document.querySelector(".phone-sticky-header-stack");
    window.__reserveTimeline.push({
      t: Math.round(performance.now()),
      value,
      stackHeight: stack ? Math.round(stack.getBoundingClientRect().height) : null,
    });
  };

  // An init script can run before <html> exists. Attaching straight to
  // document.documentElement then throws, and because that happens before the
  // PerformanceObserver below is installed it takes the CLS measurement down
  // with it — reporting a uniform CLS of 0 on every route. That is a false
  // clean bill, not a pass, and it voided a run of this harness before the
  // guard existed. Treat an all-zero result as suspect, not as good news.
  const attachReserveObserver = () => {
    if (!document.documentElement) return false;
    new MutationObserver(recordReserve).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style"],
    });
    recordReserve();
    return true;
  };
  if (!attachReserveObserver()) {
    document.addEventListener("readystatechange", function retry() {
      if (attachReserveObserver()) document.removeEventListener("readystatechange", retry);
    });
  }

  /** A short ancestor-anchored selector, enough to identify the element in review. */
  const describe = (node) => {
    if (!node || node.nodeType !== 1) return { selector: "(no element)", tag: null, text: null };
    const segments = [];
    let current = node;
    for (let depth = 0; current && current.nodeType === 1 && depth < 4; depth += 1) {
      let segment = current.tagName.toLowerCase();
      if (current.id) {
        segments.unshift(`${segment}#${current.id}`);
        break;
      }
      const classes = (current.getAttribute("class") || "").trim().split(/\s+/).filter(Boolean).slice(0, 3).join(".");
      segments.unshift(classes ? `${segment}.${classes}` : segment);
      current = current.parentElement;
    }
    return {
      selector: segments.join(" > "),
      tag: node.tagName.toLowerCase(),
      text: (node.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80),
    };
  };

  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      // CLS excludes shifts within 500ms of user input; so does this.
      if (entry.hadRecentInput) continue;
      window.__clsEntries.push({
        value: entry.value,
        startTime: entry.startTime,
        sources: (entry.sources || []).map((source) => ({
          ...describe(source.node),
          from: source.previousRect ? { y: source.previousRect.y, h: source.previousRect.height } : null,
          to: source.currentRect ? { y: source.currentRect.y, h: source.currentRect.height } : null,
        })),
      });
    }
  }).observe({ type: "layout-shift", buffered: true });
};

console.log(`[cls] building offline production app (${relativeRunRoot})`);
const build = spawnSync(process.execPath, ["--max-old-space-size=8192", nextBin, "build", "--webpack"], {
  cwd: projectRoot,
  env,
  stdio: ["ignore", "ignore", "inherit"],
});
if (build.status !== 0) {
  rmSync(absoluteRunRoot, { recursive: true, force: true });
  throw new Error(`production build failed (status ${build.status})`);
}

console.log(`[cls] serving at ${baseUrl}`);
const server = spawn(process.execPath, [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: projectRoot,
  detached: process.platform !== "win32",
  env,
  stdio: ["ignore", "ignore", "inherit"],
});

try {
  await waitForServer(baseUrl, server);

  // playwright ships CJS, so a dynamic import would put the namespace on
  // `.default`; createRequire resolves it from the project either way.
  const { chromium } = createRequire(path.join(projectRoot, "package.json"))("playwright");
  const executablePath = process.env.CHROME_PATH || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;
  const browser = await chromium.launch(executablePath ? { executablePath } : {});

  const results = {};
  for (const route of routes) {
    // Lighthouse's mobile emulation, so these numbers sit beside its reports.
    const context = await browser.newContext({
      viewport: { width: 412, height: 823 },
      deviceScaleFactor: 1.75,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.addInitScript(PAGE_INSTRUMENTATION);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

    await page.goto(`${baseUrl}${route}`, { waitUntil: "load", timeout: 90_000 });
    // CLS keeps accruing well past `load`; sample after things settle.
    await page.waitForTimeout(settleMs);
    const entries = await page.evaluate(() => window.__clsEntries || []);
    const timeline = await page.evaluate(() => window.__reserveTimeline || []);
    await context.close();

    const total = entries.reduce((sum, entry) => sum + entry.value, 0);
    const bySource = new Map();
    for (const entry of entries) {
      // The whole entry value is charged to each of its sources: one shift is
      // one relayout and every source moved in it. Read as "involved in shifts
      // worth X", not as a partition of CLS.
      for (const source of entry.sources) {
        const key = source.selector || "(unknown)";
        const current = bySource.get(key) || { value: 0, count: 0, sample: source };
        current.value += entry.value;
        current.count += 1;
        bySource.set(key, current);
      }
    }

    results[route] = {
      total,
      entryCount: entries.length,
      sources: [...bySource.entries()].sort((a, b) => b[1].value - a[1].value).slice(0, 8),
      entries,
      reserveTimeline: timeline,
    };

    console.log(`[cls] ${route.padEnd(20)} CLS=${total.toFixed(3)}  shifts=${entries.length}`);
    for (const step of timeline) {
      console.log(`        reserve t=${step.t}ms ${step.value} (stack=${step.stackHeight})`);
    }
  }

  await browser.close();
  writeFileSync(outFile, `${JSON.stringify(results, null, 2)}\n`, "utf8");
  console.log(`[cls] wrote ${path.relative(projectRoot, outFile)}`);

  const allZero = Object.values(results).every((result) => result.total === 0);
  if (allZero) {
    console.error(
      "::error::every route reported CLS 0 with no shift entries. That is the known " +
        "instrumentation failure, not a clean result — check the init script installed correctly.",
    );
    process.exitCode = 1;
  }
} finally {
  try {
    if (server.pid) process.kill(process.platform === "win32" ? server.pid : -server.pid, "SIGTERM");
  } catch {
    /* already exited */
  }
  rmSync(absoluteRunRoot, { recursive: true, force: true });
}
