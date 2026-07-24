#!/usr/bin/env node
import http from "node:http";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { appName, localProjectId, projectPortEnd, stableProjectPort } from "../src/lib/local-server-utils.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const totalRamBytes = os.totalmem();
const tenGiB = 10 * 1024 * 1024 * 1024;
if (totalRamBytes < tenGiB) {
  console.error(
    [
      `Host system has less than 10 GiB of total RAM (${(totalRamBytes / 1024 / 1024 / 1024).toFixed(1)} GiB).`,
      "Building Next.js locally requires an 8 GiB Node heap. Your system may crash or OOM during the build.",
      "If you are using Docker Desktop, increase the memory limit in settings.",
    ].join("\n"),
  );
  process.exit(1);
}
const expectedProjectId = localProjectId(projectRoot);
const identityPath = "/api/local-project-id";
const timeoutMs = 350;

function requestJson(port) {
  return new Promise((resolve) => {
    let settled = false;
    let request;

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

    request = http.get(`http://localhost:${port}${identityPath}`, { timeout: timeoutMs }, (response) => {
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

async function findRunningProjectServer() {
  const stablePort = stableProjectPort(projectRoot);

  for (let port = stablePort; port <= projectPortEnd; port += 1) {
    const payload = await requestJson(port);
    if (payload?.appName === appName && payload?.projectId === expectedProjectId) return port;
  }

  return null;
}

if (process.env.ALLOW_BUILD_WITH_DEV_SERVER === "1") {
  console.warn("ALLOW_BUILD_WITH_DEV_SERVER=1 is set; continuing even if the local dev server is running.");
  process.exit(0);
}

const runningPort = await findRunningProjectServer();

if (runningPort) {
  console.error(
    [
      `Refusing to run next build while ${appName} dev server is running at http://localhost:${runningPort}.`,
      "Stop the dev server first, or set ALLOW_BUILD_WITH_DEV_SERVER=1 if this cache churn is intentional.",
    ].join("\n"),
  );
  process.exit(1);
}
