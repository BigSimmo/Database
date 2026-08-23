#!/usr/bin/env node
/**
 * measure-cls-attribution — attribute responsive CLS to the DOM elements that move.
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
 *                                            [--profiles <names>] [--port <n>]
 *                                            [--settle-ms <n>]
 *                                            [--exercise-offline]
 *                                            [--exercise-local-identity-unavailable]
 *
 * Chromium: honours `CHROME_PATH` or `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`, and
 * otherwise lets Playwright resolve its own browser (which respects
 * `PLAYWRIGHT_BROWSERS_PATH`). In containers where the browser lives outside a
 * standard location and neither variable is set, `chrome-launcher`-style
 * resolution fails on every route — set one of them.
 */
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  browserProfileCellKey,
  buildClsAttributionOutput,
  missingReadinessFlags,
  parseBrowserProfiles,
} from "./lib/cls-attribution-options.mjs";
import { waitForHttpReadiness } from "./lib/http-readiness.mjs";
import { offlineTestEnvironment } from "./test-environment.mjs";
import { removePathSync } from "./retryable-fs.mjs";
import { acquireHeavyRunLock } from "./test-run-lock.mjs";
import {
  appName,
  circularProjectPortRange,
  isReservedDevPort,
  localProjectId,
  projectPortEnd,
  projectPortStart,
  stableProjectPort,
} from "../src/lib/local-server-utils.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
};

function canConnect(port, host) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    socket.once("connect", () => socket.destroy(void resolve(true)));
    socket.once("error", () => resolve(false));
    setTimeout(() => socket.destroy(void resolve(false)), 500);
  });
}

async function findFreePort(startPort) {
  for (const candidate of circularProjectPortRange(startPort)) {
    if (isReservedDevPort(candidate)) continue;
    if (!(await canConnect(candidate, "127.0.0.1"))) return candidate;
  }
  throw new Error("No free CLS server port found in the configured project range.");
}

const routes = flag("routes", "/dsm,/documents/search,/forms,/therapy-compass,/")
  .split(",")
  .map((route) => route.trim())
  .filter(Boolean);
const profilesFlag = flag("profiles", undefined);
const profilesExplicit = argv.includes("--profiles");
const profiles = parseBrowserProfiles(profilesFlag);
const exerciseOffline = argv.includes("--exercise-offline");
const exerciseLocalIdentityUnavailable = argv.includes("--exercise-local-identity-unavailable");
const portFlag = flag("port", null);
const port = portFlag === null ? await findFreePort(stableProjectPort(projectRoot)) : Number(portFlag);
if (!Number.isInteger(port) || port < projectPortStart || port > projectPortEnd || isReservedDevPort(port)) {
  throw new Error(
    `--port must be an available managed project port between ${projectPortStart} and ${projectPortEnd}; received ${portFlag}.`,
  );
}
const settleMs = Number(flag("settle-ms", "6000"));
const transitionSettleMs = Number(flag("transition-settle-ms", "1000"));
const ASSET_READINESS_TIMEOUT_MS = 15_000;
if (!Number.isFinite(settleMs) || settleMs < 0)
  throw new Error(`--settle-ms must be non-negative; received ${settleMs}.`);
if (!Number.isFinite(transitionSettleMs) || transitionSettleMs < 0) {
  throw new Error(`--transition-settle-ms must be non-negative; received ${transitionSettleMs}.`);
}
const outFile = path.resolve(projectRoot, flag("out", "cls-attribution.json"));
const baseUrl = `http://127.0.0.1:${port}`;

const runId = `lighthouse-cls-${process.pid}-${Date.now()}`;
const relativeRunRoot = `.next-playwright/${runId}`;
const absoluteRunRoot = path.join(projectRoot, relativeRunRoot);

const env = offlineTestEnvironment(process.env, {
  PORT: String(port),
  NEXT_DIST_DIR: `${relativeRunRoot}/dist`,
  NEXT_TSCONFIG_PATH: `${relativeRunRoot}/tsconfig.json`,
  NODE_ENV: "production",
  PLAYWRIGHT_OFFLINE_MODE: "true",
  NEXT_PUBLIC_MOCKUPS_ENABLED: "false",
  // Keep the isolated production build inside instrumentation.ts's provider-free
  // offline contract. ClinicalDashboard's local identity gate still disables
  // demo search and exposes the degraded notice during the explicit fault.
  NEXT_PUBLIC_DEMO_MODE: "true",
});

function writeResultsArtifact(resultCells) {
  const results = buildClsAttributionOutput(resultCells, { profilesExplicit, profiles });
  mkdirSync(path.dirname(outFile), { recursive: true });
  const temporaryOutFile = `${outFile}.${process.pid}.tmp`;
  try {
    writeFileSync(temporaryOutFile, `${JSON.stringify(results, null, 2)}\n`, "utf8");
    renameSync(temporaryOutFile, outFile);
  } catch (error) {
    removePathSync(temporaryOutFile);
    throw error;
  }
  return results;
}

function isThisProject(body) {
  try {
    const payload = JSON.parse(body);
    return (
      payload.appName === appName &&
      payload.projectId === localProjectId(projectRoot) &&
      payload.localServer?.safeLocalOrigin === true
    );
  } catch {
    return false;
  }
}

/** Resolves once the isolated server identifies itself, or rejects if it dies first. */
async function waitForServer(url, child) {
  await waitForHttpReadiness({
    url: `${url}/api/local-project-id`,
    isReady: ({ statusCode, body }) => statusCode === 200 && isThisProject(body),
    hasExited: () => child.exitCode !== null || child.signalCode !== null,
    timeoutMs: 120_000,
    requestTimeoutMs: 5_000,
    pollIntervalMs: 500,
    exitErrorMessage: "isolated server exited before becoming ready",
    timeoutErrorMessage: "isolated server did not become ready within 120s",
  });
}

/**
 * Injected before any app code runs. Records layout shifts with their source
 * elements, plus every write to the phone chrome reserve.
 */
const PAGE_INSTRUMENTATION = () => {
  window.__clsEntries = [];
  window.__reserveTimeline = [];
  window.__clsPhases = [{ phase: "initial", t: performance.now() }];
  window.__clsObserverReady = false;
  window.__reserveObserverReady = false;
  window.__geometryObserverReady = false;

  const geometryTargets = {
    modeHomeComposerSlot: ".mode-home-composer-slot",
    phoneStickyHeader: ".phone-sticky-header-stack",
    desktopHeaderCollapse: '[data-testid="universal-header-collapse"]',
  };
  const lcpCandidates = {
    rootStartState: {
      selector: "#shared-home-empty-state-title",
      matches: (node) => node.matches("#shared-home-empty-state-title"),
    },
    documentsStartState: {
      selector: "main p (documents explanatory copy)",
      matches: (node) =>
        node.matches("main p") &&
        (node.textContent || "").includes("Enter a query in the Documents composer to search the indexed sources."),
    },
  };
  window.__responsiveGeometry = Object.fromEntries(
    Object.entries(geometryTargets).map(([key, selector]) => [key, { selector, firstPaint: null }]),
  );
  window.__lcpCandidateTimings = Object.fromEntries(
    Object.entries(lcpCandidates).map(([key, candidate]) => [
      key,
      {
        selector: candidate.selector,
        firstPresentAt: null,
        firstVisibleAt: null,
        events: [],
      },
    ]),
  );

  const roundedRect = (rect) => ({
    x: Math.round(rect.x * 100) / 100,
    y: Math.round(rect.y * 100) / 100,
    width: Math.round(rect.width * 100) / 100,
    height: Math.round(rect.height * 100) / 100,
  });
  const visibleElement = (elements) =>
    elements.find((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    }) ||
    elements[0] ||
    null;
  const elementSnapshot = (elements) => {
    const element = visibleElement(elements);
    if (!element) return { t: Math.round(performance.now()), present: false, visible: false, count: 0, rect: null };
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const visible = rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    return {
      t: Math.round(performance.now()),
      present: true,
      visible,
      count: elements.length,
      rect: roundedRect(rect),
    };
  };
  const matchingCandidates = (candidate) =>
    Array.from(document.querySelectorAll("#shared-home-empty-state-title, main p")).filter(candidate.matches);

  let geometryFrame = null;
  const sampleResponsiveSurfaces = () => {
    geometryFrame = null;
    for (const [key, selector] of Object.entries(geometryTargets)) {
      const snapshot = elementSnapshot(Array.from(document.querySelectorAll(selector)));
      if (!window.__responsiveGeometry[key].firstPaint && snapshot.present) {
        window.__responsiveGeometry[key].firstPaint = snapshot;
      }
    }

    for (const [key, candidate] of Object.entries(lcpCandidates)) {
      const snapshot = elementSnapshot(matchingCandidates(candidate));
      const timeline = window.__lcpCandidateTimings[key];
      const previous = timeline.events.at(-1);
      if (timeline.firstPresentAt === null && snapshot.present) timeline.firstPresentAt = snapshot.t;
      if (timeline.firstVisibleAt === null && snapshot.visible) timeline.firstVisibleAt = snapshot.t;
      if (!previous || previous.present !== snapshot.present || previous.visible !== snapshot.visible) {
        timeline.events.push(snapshot);
      }
    }
  };
  const scheduleResponsiveSample = () => {
    if (geometryFrame !== null) return;
    geometryFrame = requestAnimationFrame(sampleResponsiveSurfaces);
  };
  const attachGeometryObserver = () => {
    if (!document.documentElement) return false;
    new MutationObserver(scheduleResponsiveSample).observe(document.documentElement, {
      attributes: true,
      childList: true,
      subtree: true,
    });
    window.__geometryObserverReady = true;
    scheduleResponsiveSample();
    return true;
  };
  if (!attachGeometryObserver()) {
    document.addEventListener("readystatechange", function retry() {
      if (attachGeometryObserver()) document.removeEventListener("readystatechange", retry);
    });
  }

  window.__markClsPhase = (phase) => {
    window.__clsPhases.push({ phase, t: performance.now() });
    scheduleResponsiveSample();
  };
  window.__captureClsSnapshot = () => {
    sampleResponsiveSurfaces();
    return {
      geometry: Object.fromEntries(
        Object.entries(geometryTargets).map(([key, selector]) => [
          key,
          {
            ...window.__responsiveGeometry[key],
            settled: elementSnapshot(Array.from(document.querySelectorAll(selector))),
          },
        ]),
      ),
      lcpCandidates: Object.fromEntries(
        Object.entries(lcpCandidates).map(([key, candidate]) => [
          key,
          {
            ...window.__lcpCandidateTimings[key],
            settled: elementSnapshot(matchingCandidates(candidate)),
          },
        ]),
      ),
    };
  };

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
    window.__reserveObserverReady = true;
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

  const clsObserver = new PerformanceObserver((list) => {
    const phaseForStartTime = (startTime) => {
      let phase = window.__clsPhases[0]?.phase ?? "initial";
      for (const boundary of window.__clsPhases) {
        if (boundary.t > startTime) break;
        phase = boundary.phase;
      }
      return phase;
    };
    for (const entry of list.getEntries()) {
      // CLS excludes shifts within 500ms of user input; so does this.
      if (entry.hadRecentInput) continue;
      window.__clsEntries.push({
        phase: phaseForStartTime(entry.startTime),
        value: entry.value,
        startTime: entry.startTime,
        sources: (entry.sources || []).map((source) => ({
          ...describe(source.node),
          from: source.previousRect ? { y: source.previousRect.y, h: source.previousRect.height } : null,
          to: source.currentRect ? { y: source.currentRect.y, h: source.currentRect.height } : null,
        })),
      });
    }
  });
  clsObserver.observe({ type: "layout-shift", buffered: true });
  window.__clsObserverReady = true;
};

async function waitForLoadedAssets(page) {
  await page.waitForFunction(
    () =>
      document.readyState === "complete" &&
      window.__clsObserverReady === true &&
      window.__reserveObserverReady === true &&
      window.__geometryObserverReady === true,
    undefined,
    { timeout: 30_000 },
  );
  await page.evaluate(async (timeoutMs) => {
    const waitForImage = (image) =>
      new Promise((resolve) => {
        if (image.complete) {
          resolve();
          return;
        }
        const finish = () => {
          image.removeEventListener("load", finish);
          image.removeEventListener("error", finish);
          resolve();
        };
        image.addEventListener("load", finish, { once: true });
        image.addEventListener("error", finish, { once: true });
        // Close the race where the resource completes after the first check but
        // before both listeners are installed.
        if (image.complete) finish();
      });
    const assetsReady = Promise.all([
      document.fonts?.ready ?? Promise.resolve(),
      ...Array.from(document.images, waitForImage),
    ]);
    await new Promise((resolve, reject) => {
      const timeout = window.setTimeout(
        () => reject(new Error(`Asset readiness timed out after ${timeoutMs}ms.`)),
        timeoutMs,
      );
      assetsReady.then(
        () => {
          clearTimeout(timeout);
          resolve();
        },
        (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      );
    });
  }, ASSET_READINESS_TIMEOUT_MS);
}

async function markPhase(page, phase) {
  await page.evaluate((nextPhase) => window.__markClsPhase?.(nextPhase), phase);
}

const localIdentityPattern = "**/api/local-project-id**";

function isSetupStatusResponse(response, expectedStatus) {
  try {
    return new URL(response.url()).pathname === "/api/setup-status" && response.status() === expectedStatus;
  } catch {
    return false;
  }
}

function isLocalIdentityResponse(response, expectedStatus) {
  try {
    return new URL(response.url()).pathname === "/api/local-project-id" && response.status() === expectedStatus;
  } catch {
    return false;
  }
}

function waitForHealthyLocalIdentityResponse(page) {
  return page
    .waitForResponse(
      async (response) => isLocalIdentityResponse(response, 200) && isThisProject(await response.text()),
      { timeout: 30_000 },
    )
    .catch((error) => {
      throw new Error(
        "Initial local identity validation failed: expected a 200 /api/local-project-id response matching appName, projectId, and safeLocalOrigin=true within 30000ms.",
        { cause: error },
      );
    });
}

async function waitForHealthySetupResponse(page) {
  const response = page.waitForResponse((candidate) => isSetupStatusResponse(candidate, 200), { timeout: 30_000 });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await response;
}

async function waitForDegradedNotice(page, state) {
  await page.waitForFunction(
    ({ expectedState }) => {
      const main = document.querySelector("#main-content");
      if (!main) return false;
      const titles = Array.from(main.querySelectorAll("span")).filter((element) => {
        const text = (element.textContent || "").trim();
        return text === "Offline" || text === "Service unavailable";
      });
      if (expectedState === "absent") return titles.length === 0;
      const expectedTitle = expectedState === "offline" ? "Offline" : "Service unavailable";
      return titles.some((element) => {
        if ((element.textContent || "").trim() !== expectedTitle) return false;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      });
    },
    { expectedState: state },
    { timeout: 10_000 },
  );
}

async function requireNoDegradedNoticeBeforeIdentityFault(page) {
  try {
    await waitForDegradedNotice(page, "absent");
  } catch (error) {
    throw new Error("Cannot exercise local identity outage: degraded notice was present before fault installation.", {
      cause: error,
    });
  }
}

async function exerciseDegradedTransitions({ page, context }) {
  if (exerciseOffline) {
    await markPhase(page, "offline");
    await context.setOffline(true);
    await waitForDegradedNotice(page, "offline");
    await page.waitForTimeout(transitionSettleMs);

    await markPhase(page, "reconnecting");
    await context.setOffline(false);
    await page.waitForFunction(() => navigator.onLine === true, undefined, { timeout: 10_000 });
    await waitForHealthySetupResponse(page);
    await waitForDegradedNotice(page, "absent");
    await page.waitForTimeout(transitionSettleMs);
  }

  if (exerciseLocalIdentityUnavailable) {
    await requireNoDegradedNoticeBeforeIdentityFault(page);
    let localIdentityUnavailableInterceptHits = 0;
    const unavailableHandler = async (route) => {
      localIdentityUnavailableInterceptHits += 1;
      await route.fulfill({ status: 503, json: { error: "Deterministic local identity outage." } });
    };
    await page.route(localIdentityPattern, unavailableHandler, { times: 1 });
    let exerciseError = null;
    try {
      const unavailableResponse = page.waitForResponse((response) => isLocalIdentityResponse(response, 503), {
        timeout: 30_000,
      });
      await markPhase(page, "local-identity-unavailable");
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await unavailableResponse;
      await waitForDegradedNotice(page, "service-unavailable");
      await page.waitForTimeout(transitionSettleMs);
    } catch (error) {
      exerciseError = error;
    } finally {
      await page.unroute(localIdentityPattern, unavailableHandler);
    }
    if (localIdentityUnavailableInterceptHits !== 1) {
      throw new Error(
        `Expected one local identity outage intercept; observed ${localIdentityUnavailableInterceptHits}.`,
      );
    }
    if (exerciseError) throw exerciseError;
  }
}

function stopOwnedProcessTree(child) {
  if (!child?.pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

let server = null;
let browser = null;
const lock = acquireHeavyRunLock({ projectRoot, command: "measure-cls-attribution" });
try {
  writeResultsArtifact([]);
  mkdirSync(absoluteRunRoot, { recursive: true });
  writeFileSync(
    path.join(absoluteRunRoot, "tsconfig.json"),
    // The root config explicitly includes `.next/types`. Use the source-health
    // base so an isolated run cannot ingest stale validators from a root build;
    // Next still validates the generated types in this run's dist tree.
    `${JSON.stringify({ extends: "../../tsconfig.typecheck.json", compilerOptions: { noEmit: true } }, null, 2)}\n`,
    "utf8",
  );

  console.log(`[cls] building offline production app (${relativeRunRoot})`);
  const build = spawnSync(process.execPath, ["--max-old-space-size=8192", nextBin, "build", "--webpack"], {
    cwd: projectRoot,
    env,
    stdio: ["ignore", "ignore", "inherit"],
  });
  if (build.status !== 0) throw new Error(`production build failed (status ${build.status})`);

  console.log(`[cls] serving at ${baseUrl}`);
  server = spawn(process.execPath, [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: projectRoot,
    detached: process.platform !== "win32",
    env,
    stdio: ["ignore", "ignore", "inherit"],
  });
  await waitForServer(baseUrl, server);

  // playwright ships CJS, so a dynamic import would put the namespace on
  // `.default`; createRequire resolves it from the project either way.
  const { chromium } = createRequire(path.join(projectRoot, "package.json"))("playwright");
  const executablePath = process.env.CHROME_PATH || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;
  browser = await chromium.launch(executablePath ? { executablePath } : {});

  const resultCells = [];
  for (const profile of profiles) {
    for (const route of routes) {
      const context = await browser.newContext({
        viewport: { width: profile.width, height: profile.height },
        deviceScaleFactor: profile.dpr,
        isMobile: profile.isMobile,
        hasTouch: profile.hasTouch,
      });
      try {
        const page = await context.newPage();
        await page.addInitScript(PAGE_INSTRUMENTATION);
        const cdp = await context.newCDPSession(page);
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

        const initialHealthyLocalIdentityResponse = exerciseLocalIdentityUnavailable
          ? waitForHealthyLocalIdentityResponse(page)
          : null;
        await page.goto(`${baseUrl}${route}`, { waitUntil: "load", timeout: 90_000 });
        await initialHealthyLocalIdentityResponse;
        await waitForLoadedAssets(page);
        await markPhase(page, "healthy");
        // CLS keeps accruing well past `load`; sample after things settle.
        await page.waitForTimeout(settleMs);
        await exerciseDegradedTransitions({ page, context });
        const entries = await page.evaluate(() => window.__clsEntries || []);
        const timeline = await page.evaluate(() => window.__reserveTimeline || []);
        const phases = await page.evaluate(() => window.__clsPhases || []);
        const surfaces = await page.evaluate(() => window.__captureClsSnapshot());
        const instrumentation = await page.evaluate(() => ({
          clsObserverReady: window.__clsObserverReady === true,
          reserveObserverReady: window.__reserveObserverReady === true,
          geometryObserverReady: window.__geometryObserverReady === true,
        }));

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

        const cellKey = browserProfileCellKey(profile.name, route);
        const result = {
          route,
          profile: { ...profile },
          exercises: {
            offlineReconnect: exerciseOffline,
            localIdentityUnavailable: exerciseLocalIdentityUnavailable,
          },
          total,
          entryCount: entries.length,
          sources: [...bySource.entries()].sort((a, b) => b[1].value - a[1].value).slice(0, 8),
          entries,
          reserveTimeline: timeline,
          phases,
          geometry: surfaces.geometry,
          lcpCandidates: surfaces.lcpCandidates,
          instrumentation,
        };
        resultCells.push({ cellKey, route, result });
        writeResultsArtifact(resultCells);

        console.log(
          `[cls] ${profile.name.padEnd(20)} ${route.padEnd(20)} CLS=${total.toFixed(3)} shifts=${entries.length}`,
        );
        for (const step of timeline) {
          console.log(`        reserve t=${step.t}ms ${step.value} (stack=${step.stackHeight})`);
        }
      } finally {
        await context.close();
      }
    }
  }

  await browser.close();
  browser = null;
  writeResultsArtifact(resultCells);
  console.log(`[cls] wrote ${path.relative(projectRoot, outFile)}`);

  const cellsMissingInstrumentation = resultCells
    .map(({ cellKey, result }) => ({ cellKey, missing: missingReadinessFlags(result.instrumentation) }))
    .filter(({ missing }) => missing.length > 0);
  if (cellsMissingInstrumentation.length > 0) {
    console.error(
      `::error::CLS instrumentation readiness missing for ${cellsMissingInstrumentation
        .map(({ cellKey, missing }) => `${cellKey}: ${missing.join(",")}`)
        .join("; ")}. Treat those cells as failed evidence, not clean zero-CLS results.`,
    );
    process.exitCode = 1;
  }
} finally {
  try {
    try {
      await browser?.close();
    } catch {
      /* browser failed before it could close */
    }
    try {
      stopOwnedProcessTree(server);
    } finally {
      removePathSync(absoluteRunRoot, { recursive: true });
    }
  } finally {
    lock.release();
  }
}
