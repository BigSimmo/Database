#!/usr/bin/env node
import http from "node:http";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { appName, localProjectId, projectPortEnd, stableProjectPort } from "../src/lib/local-server-utils.mjs";

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

export async function findRunningProjectServer(rootDir = projectRoot) {
  const expectedProjectId = localProjectId(rootDir);
  const stablePort = stableProjectPort(rootDir);
  const maxPort = projectPortEnd;

  for (let port = stablePort; port <= maxPort; port += 1) {
    const payload = await requestJson(port);
    if (payload?.appName === appName && payload?.projectId === expectedProjectId) return port;
  }

  return null;
}

async function main() {
  const ramDecision = evaluateNextBuildRamGuard();
  if (ramDecision === "fail") {
    console.error(formatLowRamBuildMessage());
    process.exit(1);
  }
  if (ramDecision === "warn") {
    console.warn(
      [
        formatLowRamBuildMessage(),
        "Continuing because CI, GITHUB_ACTIONS, or ALLOW_LOW_RAM_BUILD=1 is set (hosted runners often report ~7–8 GiB).",
      ].join("\n"),
    );
  }

  if (process.env.ALLOW_BUILD_WITH_DEV_SERVER === "1") {
    console.warn("ALLOW_BUILD_WITH_DEV_SERVER=1 is set; continuing even if the local dev server is running.");
    return;
  }

  const runningPort = await findRunningProjectServer();
  if (runningPort) {
    console.error(
      [
        `Refusing to run next build while ${appName} dev server is running at http://localhost:${runningPort}.`,
        "Stop the dev server first, or set ALLOW_BUILD_WITH_DEV_SERVER=1 if this cache churn is intentional.",
        `BUILD_REFUSED_DEV_SERVER exit=${DEV_SERVER_BUILD_REFUSED_EXIT_CODE}`,
      ].join("\n"),
    );
    process.exit(DEV_SERVER_BUILD_REFUSED_EXIT_CODE);
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(modulePath);
if (isDirectRun) {
  await main();
}
