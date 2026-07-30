#!/usr/bin/env node
/**
 * run-lighthouse-budget — measure this build's routes with Lighthouse and grade the
 * result against the committed baseline (`scripts/check-lighthouse-budget.mjs`).
 *
 * Builds and serves an isolated production app the same way the Playwright runner
 * does: offline provider mode, demo corpus, inert loopback Supabase URL, a safe
 * project port, and an isolated `.next-lighthouse/<run-id>` output directory. That
 * matters for two reasons — the production boot guard only permits this profile when
 * credentials are absent, and demo mode makes the measured pages deterministic so a
 * number movement means the app changed rather than the corpus.
 *
 * Lighthouse itself comes from `npx --yes lighthouse@<pinned>`, matching
 * `.github/workflows/live-web-vitals.yml`. It is deliberately not a devDependency:
 * it pulls a large tree that nothing else in the repo imports, and pinning at the
 * call site keeps the two Lighthouse entry points on one version.
 *
 * A per-route Lighthouse failure is NOT downgraded to a warning here (unlike the
 * live workflow, which is grading a flaky public network): a route that produced no
 * report is incomplete evidence, and the grader fails closed on it.
 *
 * Flags: --dry-run (print the plan and exit), --update (refresh the baseline),
 *        --keep (leave reports in place), --dir <path>.
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { childProcessExitCode, childProcessFailureSummary } from "./child-process-result.mjs";
import { offlineTestEnvironment } from "./test-environment.mjs";
import { acquireHeavyRunLock } from "./test-run-lock.mjs";
import { loadBudget } from "./check-lighthouse-budget.mjs";
import { circularProjectPortRange, isReservedDevPort, stableProjectPort } from "../src/lib/local-server-utils.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const update = argv.includes("--update");
const keep = argv.includes("--keep");
const dirIndex = argv.indexOf("--dir");
const reportDirectory = path.resolve(projectRoot, dirIndex >= 0 ? (argv[dirIndex + 1] ?? "lighthouse") : "lighthouse");

const runId = `${process.pid}-${Date.now()}`;
const relativeDistDir = path.join(".next-lighthouse", runId);
const absoluteDistDir = path.join(projectRoot, relativeDistDir);

/** Filename-safe slug, matching scripts/summarise-web-vitals.mjs `routeSlug`. */
function slugFor(route) {
  return route.replace(/^\//, "").replaceAll("/", "-") || "root";
}

function canConnect(port, host) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    socket.once("connect", () => socket.destroy(void resolve(true)));
    socket.once("error", () => resolve(false));
    setTimeout(() => socket.destroy(void resolve(false)), 500);
  });
}

async function findFreePort(startPort) {
  for (const port of circularProjectPortRange(startPort)) {
    if (isReservedDevPort(port)) continue;
    if (!(await canConnect(port, "127.0.0.1"))) return port;
  }
  throw new Error("No free Lighthouse server port found in the configured project range.");
}

function get(url) {
  return new Promise((resolve) => {
    const request = http.get(url, { timeout: 5_000 }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => resolve(response.statusCode === 200 ? body : null));
    });
    request.on("timeout", () => request.destroy(void resolve(null)));
    request.on("error", () => resolve(null));
  });
}

async function waitForServer(baseUrl, server) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (server.exitCode !== null || server.signalCode) {
      throw new Error("Lighthouse-owned Next server exited before it became ready.");
    }
    // Same identity check the rest of the repo's tooling uses, so this can never
    // attach to another project's server on a shared machine.
    const body = await get(`${baseUrl}/api/local-project-id`);
    if (body) return;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Timed out waiting for the Lighthouse-owned server at ${baseUrl}.`);
}

let server = null;
let released = false;
let lock = null;

function cleanup() {
  if (released) return;
  released = true;
  if (server?.pid) {
    try {
      process.kill(process.platform === "win32" ? server.pid : -server.pid, "SIGTERM");
    } catch {
      /* already gone */
    }
  }
  try {
    rmSync(absoluteDistDir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
  lock?.release();
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

const budget = loadBudget();
const routes = budget.routes ?? [];
const strategies = budget.strategies ?? ["mobile", "desktop"];
/**
 * Pinned in `lighthouse-budget.json` so this runner and the live-domain workflow
 * share one version; `tests/check-lighthouse-budget.test.ts` fails if they drift.
 * The env override exists for a deliberate one-off comparison, not for CI.
 */
const LIGHTHOUSE_VERSION = process.env.LIGHTHOUSE_VERSION ?? budget.lighthouseVersion ?? "12.8.2";

if (routes.length === 0) {
  console.error("run-lighthouse-budget: lighthouse-budget.json lists no routes to measure.");
  process.exit(1);
}

if (dryRun) {
  console.log("run-lighthouse-budget plan");
  console.log(`  lighthouse    npx --yes lighthouse@${LIGHTHOUSE_VERSION}`);
  console.log(`  reports       ${path.relative(projectRoot, reportDirectory)}/<strategy>-<slug>.json`);
  console.log(`  enforce       ${Boolean(budget.enforce)}`);
  console.log(`  baseline      ${budget.baseline ? `${Object.keys(budget.baseline).length} run(s)` : "none recorded"}`);
  for (const strategy of strategies) {
    for (const route of routes)
      console.log(`  measure       ${strategy} ${route} -> ${strategy}-${slugFor(route)}.json`);
  }
  process.exit(0);
}

try {
  // Lighthouse drives a real browser against a production build, so it takes the
  // same exclusive admission as Playwright rather than racing a concurrent build.
  lock = acquireHeavyRunLock({ command: "run-lighthouse-budget" });

  const port = await findFreePort(stableProjectPort(projectRoot));
  const baseUrl = `http://localhost:${port}`;
  mkdirSync(absoluteDistDir, { recursive: true });
  mkdirSync(reportDirectory, { recursive: true });

  const offlineEnv = offlineTestEnvironment(lock.environment ?? process.env, {
    PORT: String(port),
    NEXT_DIST_DIR: relativeDistDir,
    NODE_ENV: "production",
    PLAYWRIGHT_OFFLINE_MODE: "true",
    NEXT_PUBLIC_MOCKUPS_ENABLED: "false",
  });

  console.log(`Building isolated production app for Lighthouse (${relativeDistDir})`);
  const build = spawnSync(process.execPath, ["--max-old-space-size=8192", nextBin, "build", "--webpack"], {
    cwd: projectRoot,
    env: offlineEnv,
    stdio: "inherit",
  });
  if (childProcessExitCode(build) !== 0) {
    throw new Error(`Lighthouse production build failed (${childProcessFailureSummary(build)}).`);
  }

  console.log(`Starting isolated production server at ${baseUrl}`);
  server = spawn(process.execPath, [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: projectRoot,
    detached: process.platform !== "win32",
    env: offlineEnv,
    stdio: ["ignore", "inherit", "inherit"],
    windowsHide: true,
  });
  await waitForServer(baseUrl, server);

  const chromePath = process.env.CHROME_PATH ?? process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? "";
  const failures = [];

  for (const strategy of strategies) {
    for (const route of routes) {
      const output = path.join(reportDirectory, `${strategy}-${slugFor(route)}.json`);
      console.log(`Measuring ${strategy} ${route}`);
      const result = spawnSync(
        "npx",
        [
          "--yes",
          `lighthouse@${LIGHTHOUSE_VERSION}`,
          `${baseUrl}${route}`,
          "--output=json",
          `--output-path=${output}`,
          `--preset=${strategy === "desktop" ? "desktop" : "perf"}`,
          "--only-categories=performance",
          "--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage",
          "--max-wait-for-load=60000",
          "--quiet",
        ],
        {
          cwd: projectRoot,
          env: { ...offlineEnv, ...(chromePath ? { CHROME_PATH: chromePath } : {}) },
          stdio: "inherit",
        },
      );
      // Not downgraded to a warning: the grader treats a missing report as
      // incomplete evidence and fails, which is the behaviour we want locally too.
      if (childProcessExitCode(result) !== 0) failures.push(`${strategy} ${route}`);
    }
  }

  if (failures.length > 0) console.log(`::warning::lighthouse failed for ${failures.join(", ")}`);

  const gradeArgs = ["--dir", path.relative(projectRoot, reportDirectory), ...(update ? ["--update"] : [])];
  const grade = spawnSync(
    process.execPath,
    [path.join(projectRoot, "scripts", "check-lighthouse-budget.mjs"), ...gradeArgs],
    {
      cwd: projectRoot,
      env: process.env,
      stdio: "inherit",
    },
  );

  if (!keep) rmSync(reportDirectory, { recursive: true, force: true });
  const exitCode = childProcessExitCode(grade);
  cleanup();
  process.exit(exitCode);
} catch (error) {
  cleanup();
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
