#!/usr/bin/env node
import http from "node:http";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import {
  appName,
  circularProjectPortRange,
  localProjectId,
  stableProjectPort,
} from "../src/lib/local-server-utils.mjs";

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(modulePath), "..");
const tenGiB = 10 * 1024 * 1024 * 1024;

/**
 * Local/Docker Desktop builds allocate an 8 GiB Node heap, so hosts under
 * 10 GiB total RAM are refused. GitHub-hosted runners (host Build and Docker
 * buildx) commonly report ~7–8 GiB even though this project's Next build
 * completes there regularly — hard-failing on that measurement made CI flaky.
 * Soften when CI/GITHUB_ACTIONS is set, or when the caller opts in with
 * ALLOW_LOW_RAM_BUILD=1 (CI Docker image builds pass that build-arg).
 *
 * @param {{ totalRamBytes?: number, env?: { readonly [key: string]: string | undefined } }} [options]
 * @returns {"ok" | "warn" | "fail"}
 */
export function evaluateNextBuildRamGuard(options = {}) {
  const totalRamBytes = options.totalRamBytes ?? os.totalmem();
  const env = options.env ?? process.env;
  if (totalRamBytes >= tenGiB) return "ok";
  const allowLowRam = env.CI === "true" || env.GITHUB_ACTIONS === "true" || env.ALLOW_LOW_RAM_BUILD === "1";
  return allowLowRam ? "warn" : "fail";
}

export function formatLowRamBuildMessage(totalRamBytes = os.totalmem()) {
  return [
    `Host system has less than 10 GiB of total RAM (${(totalRamBytes / 1024 / 1024 / 1024).toFixed(1)} GiB).`,
    "Building Next.js locally requires an 8 GiB Node heap. Your system may crash or OOM during the build.",
    "If you are using Docker Desktop, increase the memory limit in settings.",
  ].join("\n");
}

/** Distinct from generic failures so verify:pr-local can name a refused build (#167). */
export const DEV_SERVER_BUILD_REFUSED_EXIT_CODE = 76;

function requestJson(port) {
  return new Promise((resolve) => {
    let settled = false;
    let request;
    const timeoutMs = 350;

    const settle = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(fallback);
      resolve(value);
    };

    const fallback = setTimeout(() => {
      request?.destroy();
      settle(null);
    }, timeoutMs + 100);

    request = http.get(`http://localhost:${port}/api/local-project-id`, { timeout: timeoutMs }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        try {
          settle(JSON.parse(body));
        } catch {
          settle(null);
        }
      });
    });

    request.on("timeout", () => {
      request.destroy();
      settle(null);
    });
    request.on("error", () => settle(null));
  });
}

/**
 * The port this checkout's dev server is listening on, or null.
 *
 * Probes the whole project port range, wrapping at the top — not `stablePort`
 * upward. `dev-free-port.mjs` honours any `PORT` or `--port`, so a server can sit
 * *below* the stable port (`PORT=3130` against a stable 3131) and an upward-only
 * scan never reaches it. That blind spot let the guard clear this project's dev
 * output, and permit a concurrent production build, while the dev server was
 * still using it. `run-playwright.mjs`, `run-lighthouse-budget.mjs` and
 * `measure-cls-attribution.mjs` already locate the server this way; this was the
 * one that did not.
 *
 * A port outside the project range entirely (`PORT=9999`) is still missed, and
 * cannot be found from here: the build process cannot see the environment the
 * dev server was started in.
 */
export async function findRunningProjectServer(rootDir = projectRoot) {
  const expectedProjectId = localProjectId(rootDir);

  for (const port of circularProjectPortRange(stableProjectPort(rootDir))) {
    const payload = await requestJson(port);
    if (payload?.appName === appName && payload?.projectId === expectedProjectId) return port;
  }

  return null;
}

async function main() {
  const result = await runNextBuildGuard();
  if (result.status === "low-ram") process.exit(1);
  if (result.status === "dev-server-running") process.exit(DEV_SERVER_BUILD_REFUSED_EXIT_CODE);
}

/**
 * Check whether a production build may begin without mutating dev output.
 *
 * A server probe is necessarily advisory: `npm run dev` accepts ports outside
 * the managed range and a server can start after the probe. Keep this guard to
 * refusing known concurrent servers; deleting `.next/dev` requires startup and
 * build coordination that this process does not own.
 */
export async function runNextBuildGuard({
  rootDir = projectRoot,
  env = process.env,
  evaluateRamGuard = evaluateNextBuildRamGuard,
  findServer = findRunningProjectServer,
  error = console.error,
  warn = console.warn,
} = {}) {
  const ramDecision = evaluateRamGuard();
  if (ramDecision === "fail") {
    error(formatLowRamBuildMessage());
    return { status: "low-ram" };
  }
  if (ramDecision === "warn") {
    warn(
      [
        formatLowRamBuildMessage(),
        "Continuing because CI, GITHUB_ACTIONS, or ALLOW_LOW_RAM_BUILD=1 is set (hosted runners often report ~7–8 GiB).",
      ].join("\n"),
    );
  }

  if (env.ALLOW_BUILD_WITH_DEV_SERVER === "1") {
    warn("ALLOW_BUILD_WITH_DEV_SERVER=1 is set; continuing even if the local dev server is running.");
    return { status: "ok" };
  }

  const runningPort = await findServer(rootDir);
  if (runningPort) {
    error(
      [
        `Refusing to run next build while ${appName} dev server is running at http://localhost:${runningPort}.`,
        "Stop the dev server first, or set ALLOW_BUILD_WITH_DEV_SERVER=1 if this cache churn is intentional.",
        `BUILD_REFUSED_DEV_SERVER exit=${DEV_SERVER_BUILD_REFUSED_EXIT_CODE}`,
      ].join("\n"),
    );
    return { status: "dev-server-running", port: runningPort };
  }

  return { status: "ok" };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(modulePath);
if (isDirectRun) {
  await main();
}
