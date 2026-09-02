#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, rmdirSync, writeFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { childProcessExitCode, childProcessFailureSummary } from "./child-process-result.mjs";
import { assertPlaywrightBrowsersReady } from "./playwright-browser-preflight.mjs";
import { removePathSync } from "./retryable-fs.mjs";
import { offlineTestEnvironment } from "./test-environment.mjs";
import { acquireHeavyRunLock } from "./test-run-lock.mjs";
import {
  appName,
  circularProjectPortRange,
  isReservedDevPort,
  localProjectId,
  stableProjectPort,
} from "../src/lib/local-server-utils.mjs";

if (Number(process.versions.node.split(".")[0]) !== 24) {
  console.error(`PsychSift Playwright checks require Node 24.x. Current runtime: ${process.versions.node}.`);
  process.exit(1);
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const playwrightBin = path.join(projectRoot, "node_modules", "playwright", "cli.js");
const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
const identityPath = "/api/local-project-id";
const startupTimeoutMs = 180_000;
const missingErrorComponentsNeedle = "missing required error components";
const routeSmokePaths = [
  "/",
  "/applications",
  "/?mode=tools",
  "/documents/search?mode=documents",
  "/forms/transport-crisis-form",
];
/**
 * The Playwright project whose journeys need a POPULATED Caring Contacts store.
 *
 * `demoSeedRequested()` in `src/lib/caring-contacts-server/demo-seed.ts` excludes this runner's
 * server unless `CARING_CONTACTS_DEMO_SEED=on`, and that exclusion is deliberate: the empty
 * caseload, the "No referral named" wizard notice and the empty schedule day that
 * `tests/ui-caring-contacts-workspace.spec.ts` asserts are real production states, not fixtures,
 * and switching the seed on for THAT server would delete those observations rather than add one.
 * So the activation journey gets a SECOND server on a second port, from the same isolated build,
 * with the seed on — and the primary server's environment is left exactly as it was.
 */
const SEEDED_PROJECT_NAME = "chromium-caring-contacts-seeded";

/**
 * What `playwright test` receives, exactly as the caller wrote it, and what the browser preflight
 * reads. `playwright-browser-preflight.mjs` holds `chromium-caring-contacts-seeded` in its own
 * project -> browser-family table, so the seeded project needs no translation here.
 */
const playwrightArgs = process.argv.slice(2);
/** Whether `args[index]` is the token that NAMES the seeded project, in either CLI spelling. */
const namesSeededProject = (args, index) =>
  args[index] === `--project=${SEEDED_PROJECT_NAME}` ||
  (args[index] === SEEDED_PROJECT_NAME && args[index - 1] === "--project");
const explicitProjectRequested = playwrightArgs.some(
  (argument) => argument === "--project" || argument.startsWith("--project="),
);
const mockupProjectRequested =
  !explicitProjectRequested ||
  playwrightArgs.some(
    (argument, index) =>
      argument === "--project=chromium-mockups" ||
      (argument === "--project" && playwrightArgs[index + 1] === "chromium-mockups"),
  );
const seededServerRequested =
  !explicitProjectRequested || playwrightArgs.some((_argument, index) => namesSeededProject(playwrightArgs, index));

// Fail loud on missing browser binaries before the heavy lock or production build.
// Otherwise launch failures surface as "N failed" product tests and are easy to misread
// when a caller pipes output without `pipefail` (outstanding-issues #120).
const browserPreflight = assertPlaywrightBrowsersReady(playwrightArgs);
const preinstalledChromium = browserPreflight.checked.find(
  (entry) => entry.source === "preinstalled container Chromium (PLAYWRIGHT_BROWSERS_PATH)",
);
if (preinstalledChromium && !process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = preinstalledChromium.path;
  console.error(
    `[playwright] Managed Chromium is unavailable; using the preinstalled container browser at ${preinstalledChromium.path}.`,
  );
}

const requestedRunId = process.env.PLAYWRIGHT_BUILD_ROOT_ID?.trim();
if (requestedRunId && !/^[a-z0-9-]+$/i.test(requestedRunId)) {
  console.error("PLAYWRIGHT_BUILD_ROOT_ID must contain only letters, numbers, and hyphens.");
  process.exit(1);
}
const keepBuildRootValue = process.env.PLAYWRIGHT_KEEP_BUILD_ROOT?.trim();
if (keepBuildRootValue && keepBuildRootValue !== "true") {
  console.error('PLAYWRIGHT_KEEP_BUILD_ROOT must be unset or exactly "true".');
  process.exit(1);
}
const keepBuildRoot = keepBuildRootValue === "true";
if (keepBuildRoot && !requestedRunId) {
  console.error("PLAYWRIGHT_KEEP_BUILD_ROOT requires PLAYWRIGHT_BUILD_ROOT_ID.");
  process.exit(1);
}
const runId = requestedRunId || `${process.pid}-${Date.now()}`;
const relativeRunRoot = `.next-playwright/${runId}`;
const absoluteRunRoot = path.join(projectRoot, relativeRunRoot);
const relativeDistDir = `${relativeRunRoot}/dist`;
const relativeTsConfigPath = `${relativeRunRoot}/tsconfig.json`;
const configuredWaitTimeoutMs = Number(process.env.HEAVY_RUN_WAIT_TIMEOUT_MS);
const waitTimeoutMs = Number.isFinite(configuredWaitTimeoutMs) ? configuredWaitTimeoutMs : undefined;
const ADMISSION_BUSY_EXIT = 75;
const ADMISSION_BUSY_MARKER = "DATABASE_HEAVY_RUN_ADMISSION_BUSY";
// Match only the coordinator's actual capacity/timeout messages (test-run-lock.mjs
// busyMessage() and the initializing-coordinator branch) — not every error that
// merely mentions "Database heavyweight", such as an inherited-lease mismatch or a
// coordinator-directory setup failure. Those are configuration bugs, not admission
// contention, and must keep failing with the ordinary exit 1 below.
const ADMISSION_BUSY_PATTERN =
  /^(?:Database focused-test capacity is full|Another Database heavyweight command is active|A Database heavyweight coordinator is being initialized\b.*retry shortly\.)/;

let lock;
try {
  lock = acquireHeavyRunLock({
    projectRoot,
    command: `playwright ${playwrightArgs.join(" ")}`,
    ...(waitTimeoutMs === undefined ? {} : { waitTimeoutMs }),
  });
} catch (error) {
  const message = String(error?.message ?? error);
  if (ADMISSION_BUSY_PATTERN.test(message)) {
    console.error(ADMISSION_BUSY_MARKER);
    console.error(`Playwright did not run: ${message}`);
    console.error("Wait for the active heavyweight run to finish, then retry this command.");
    process.exit(ADMISSION_BUSY_EXIT);
  }
  console.error(message);
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function canListenOnHost(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (error) => resolve(error.code === "EAFNOSUPPORT" || error.code === "EADDRNOTAVAIL"));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, host);
  });
}

function canConnectToHost(port, host) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    socket.setTimeout(250);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });
}

async function canListen(port) {
  for (const host of ["127.0.0.1", "localhost", "::1"]) if (await canConnectToHost(port, host)) return false;
  for (const host of ["127.0.0.1", "localhost", "::1", "0.0.0.0", "::"]) {
    if (!(await canListenOnHost(port, host))) return false;
  }
  return true;
}

async function findFreePort(startPort) {
  for (const port of circularProjectPortRange(startPort)) {
    if (!isReservedDevPort(port) && (await canListen(port))) return port;
  }
  throw new Error("No free Playwright server port found in the configured project range.");
}

function request(url, { json = false, timeoutMs = 30_000 } = {}) {
  return new Promise((resolve) => {
    const pending = http.get(url, { timeout: timeoutMs }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => (body += chunk));
      response.on("end", () => {
        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 400) return resolve(null);
        if (!json) return resolve(body);
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(null);
        }
      });
    });
    pending.on("timeout", () => {
      pending.destroy();
      resolve(null);
    });
    pending.on("error", () => resolve(null));
  });
}

function isVerifiedProjectPayload(payload) {
  return (
    payload?.appName === appName &&
    payload?.projectId === localProjectId(projectRoot) &&
    payload?.localServer?.safeLocalOrigin === true
  );
}

async function waitForServer(baseUrl, server) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < startupTimeoutMs) {
    // Per-child rather than one module-level slot: this runner owns two servers whenever the
    // seeded project runs, and a shared slot would report the primary's launch failure against
    // the seeded server (or the reverse) and send a reader to the wrong process.
    if (server.launchError) {
      throw new Error(`Playwright-owned Next server failed to launch: ${server.launchError.message}`);
    }
    if (server.exitCode !== null || server.signalCode) {
      throw new Error(
        `Playwright-owned Next server exited before readiness (${server.exitCode !== null ? `code ${server.exitCode}` : `signal ${server.signalCode}`}).`,
      );
    }
    const payload = await request(`${baseUrl}${identityPath}`, { json: true, timeoutMs: 5000 });
    if (isVerifiedProjectPayload(payload)) {
      let healthy = true;
      for (const smokePath of routeSmokePaths) {
        // request() returns null on transport/status failure, or a string body on
        // 2xx/3xx (including empty redirect bodies from legacy route handlers).
        const body = await request(`${baseUrl}${smokePath}`);
        if (body === null || body.includes(missingErrorComponentsNeedle)) {
          healthy = false;
          break;
        }
      }
      if (healthy) return;
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for the Playwright-owned PsychSift server at ${baseUrl}.`);
}

/**
 * One `next start` from this run's isolated build, on one port, with one environment.
 *
 * Both servers go through here so the launch shape — detached process group, inherited stdio, and
 * the per-child `launchError` `waitForServer` reads — cannot drift between them.
 */
function startIsolatedServer(serverPort, env) {
  const child = spawn(process.execPath, [nextBin, "start", "--hostname", "0.0.0.0", "--port", String(serverPort)], {
    cwd: projectRoot,
    detached: process.platform !== "win32",
    env,
    stdio: ["ignore", "inherit", "inherit"],
    windowsHide: true,
  });
  child.once("error", (error) => {
    child.launchError = error;
  });
  return child;
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

let server;
/** The second `next start`, from the same build, holding the Caring Contacts demo population. */
let seededServer;
let cleaned = false;
function cleanup() {
  if (cleaned) return;
  cleaned = true;
  try {
    // BOTH servers, on every exit path. A seeded server left listening holds the heavy-run port
    // and a populated store past the run that owned it.
    stopOwnedProcessTree(seededServer);
    stopOwnedProcessTree(server);
    if (!keepBuildRoot) {
      removePathSync(absoluteRunRoot, { recursive: true });
      try {
        rmdirSync(path.dirname(absoluteRunRoot));
      } catch (error) {
        if (error?.code !== "ENOENT" && error?.code !== "ENOTEMPTY") throw error;
      }
    } else {
      console.log(`Keeping Playwright build root for cache reuse (${relativeRunRoot})`);
    }
  } catch (error) {
    console.error(`Playwright cleanup warning: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    lock.release();
  }
}

process.once("SIGINT", () => {
  cleanup();
  process.exit(130);
});
process.once("SIGTERM", () => {
  cleanup();
  process.exit(143);
});
process.once("exit", cleanup);

try {
  const port = await findFreePort(stableProjectPort(projectRoot));
  const baseUrl = `http://localhost:${port}`;
  mkdirSync(absoluteRunRoot, { recursive: true });
  writeFileSync(
    path.join(absoluteRunRoot, "tsconfig.json"),
    `${JSON.stringify(
      {
        extends: "../../tsconfig.json",
        compilerOptions: {
          // TypeScript 6 deprecates baseUrl (TS5101). Next 16.3+ typechecks this
          // isolated config during `next build`, so silence until paths migrate.
          ignoreDeprecations: "6.0",
          baseUrl: "../..",
          paths: { "@/*": ["src/*"] },
        },
        // Declaring include/exclude here (rather than leaving them unset and
        // inheriting the root tsconfig.json's) is deliberate. TypeScript resolves
        // an extended config's *inherited* relative include/exclude entries
        // against the repo root, so an unset include here would still resolve
        // "**/*.ts" and ".next/dev/types/**/*.ts" against the shared top-level
        // .next/ directory — not this isolated run's own NEXT_DIST_DIR output
        // under `dist/`. That pulls stale/foreign route types from whatever the
        // top-level .next happens to contain (a prior `npm run dev` or `npm run
        // build`) into this run's typecheck. Excluding the repo-root .next/ and
        // pointing at this run's own dist/types + dist/dev/types keeps the
        // isolated build's typecheck scoped to itself (outstanding-issues #210).
        include: [
          "../../next-env.d.ts",
          "../../**/*.ts",
          "../../**/*.tsx",
          "../../**/*.mts",
          "dist/types/**/*.ts",
          "dist/dev/types/**/*.ts",
        ],
        exclude: [
          "../../node_modules",
          "../../scratch/**",
          "../../supabase/functions/**",
          "../../worktrees/**",
          "../../scripts/archive/**",
          "../../.next/**",
        ],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  const offlineEnv = offlineTestEnvironment(lock.environment, {
    PORT: String(port),
    PLAYWRIGHT_BASE_URL: baseUrl,
    NEXT_DIST_DIR: relativeDistDir,
    NEXT_TSCONFIG_PATH: relativeTsConfigPath,
    NODE_ENV: "production",
    PLAYWRIGHT_OFFLINE_MODE: "true",
    NEXT_PUBLIC_MOCKUPS_ENABLED: mockupProjectRequested ? "true" : "false",
  });
  console.log(`Building isolated production Playwright app (${relativeRunRoot})`);

  const buildResult = spawnSync(process.execPath, ["--max-old-space-size=8192", nextBin, "build", "--webpack"], {
    cwd: projectRoot,
    env: offlineEnv,
    stdio: "inherit",
  });
  const buildExitCode = childProcessExitCode(buildResult);
  if (buildExitCode !== 0) {
    const memory = process.memoryUsage();
    console.error(
      `[playwright] build diagnostics: status=${buildResult.status}, signal=${buildResult.signal ?? "none"}, error=${buildResult.error?.message ?? "none"}, memory(rss=${Math.round(memory.rss / (1024 * 1024))}MB, heapTotal=${Math.round(memory.heapTotal / (1024 * 1024))}MB, heapUsed=${Math.round(memory.heapUsed / (1024 * 1024))}MB)`,
    );
    throw new Error(`Playwright production build failed (${childProcessFailureSummary(buildResult)}).`);
  }

  console.log(`Starting isolated production Playwright server at ${baseUrl} (${relativeRunRoot})`);

  server = startIsolatedServer(port, offlineEnv);
  await waitForServer(baseUrl, server);

  // The seeded server, and NOTHING about the primary one above changes to make it exist: it is a
  // second `next start` from the same `dist/`, on its own port, with `CARING_CONTACTS_DEMO_SEED=on`
  // in its own environment. Started only when the seeded project is actually selected, so an
  // ordinary `--project=chromium` run pays neither the port nor the startup for it.
  const testEnv = { ...offlineEnv };
  if (seededServerRequested) {
    const seededPort = await findFreePort(stableProjectPort(projectRoot));
    const seededBaseUrl = `http://localhost:${seededPort}`;
    console.log(`Starting seeded Caring Contacts Playwright server at ${seededBaseUrl} (${relativeRunRoot})`);
    seededServer = startIsolatedServer(seededPort, {
      ...offlineEnv,
      PORT: String(seededPort),
      PLAYWRIGHT_BASE_URL: seededBaseUrl,
      CARING_CONTACTS_DEMO_SEED: "on",
    });
    // The same readiness probe as the primary server: identity, then the route smoke set. A
    // seeded server that answered before its store was built would hand the wizard journey an
    // empty caseload and fail as though the wizard were broken.
    await waitForServer(seededBaseUrl, seededServer);
    testEnv.PLAYWRIGHT_SEEDED_BASE_URL = seededBaseUrl;
  }

  const result = spawnSync(process.execPath, [playwrightBin, "test", ...playwrightArgs], {
    cwd: projectRoot,
    env: testEnv,
    stdio: "inherit",
  });
  const exitCode = childProcessExitCode(result);
  cleanup();
  process.exit(exitCode);
} catch (error) {
  cleanup();
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
