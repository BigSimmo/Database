#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { childProcessExitCode, childProcessFailureSummary } from "./child-process-result.mjs";
import { offlineTestEnvironment } from "./test-environment.mjs";
import { acquireHeavyRunLock } from "./test-run-lock.mjs";
import {
  appName,
  isReservedDevPort,
  localProjectId,
  projectPortEnd,
  stableProjectPort,
} from "../src/lib/local-server-utils.mjs";

if (Number(process.versions.node.split(".")[0]) !== 24) {
  console.error(`Clinical KB Playwright checks require Node 24.x. Current runtime: ${process.versions.node}.`);
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
const playwrightArgs = process.argv.slice(2);
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
const runId = `${process.pid}-${Date.now()}`;
const relativeRunRoot = `.next-playwright/${runId}`;
const absoluteRunRoot = path.join(projectRoot, relativeRunRoot);
const relativeDistDir = `${relativeRunRoot}/dist`;
const relativeTsConfigPath = `${relativeRunRoot}/tsconfig.json`;

let lock;
try {
  lock = acquireHeavyRunLock({ projectRoot, command: `playwright ${playwrightArgs.join(" ")}` });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
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
  for (let port = startPort; port <= projectPortEnd; port += 1) {
    if (!isReservedDevPort(port) && (await canListen(port))) return port;
  }
  throw new Error(`No free Playwright server port found from ${startPort} to ${projectPortEnd}.`);
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
    if (serverLaunchError) {
      throw new Error(`Playwright-owned Next server failed to launch: ${serverLaunchError.message}`);
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
        const body = await request(`${baseUrl}${smokePath}`);
        if (!body || body.includes(missingErrorComponentsNeedle)) {
          healthy = false;
          break;
        }
      }
      if (healthy) return;
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for the Playwright-owned Clinical KB server at ${baseUrl}.`);
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
let serverLaunchError;
let cleaned = false;
function cleanup() {
  if (cleaned) return;
  cleaned = true;
  try {
    stopOwnedProcessTree(server);
    rmSync(absoluteRunRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    try {
      rmdirSync(path.dirname(absoluteRunRoot));
    } catch (error) {
      if (error?.code !== "ENOENT" && error?.code !== "ENOTEMPTY") throw error;
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
          baseUrl: "../..",
          paths: { "@/*": ["src/*"] },
        },
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
    throw new Error(`Playwright production build failed (${childProcessFailureSummary(buildResult)}).`);
  }

  console.log(`Starting isolated production Playwright server at ${baseUrl} (${relativeRunRoot})`);

  server = spawn(process.execPath, [nextBin, "start", "--hostname", "0.0.0.0", "--port", String(port)], {
    cwd: projectRoot,
    detached: process.platform !== "win32",
    env: offlineEnv,
    stdio: ["ignore", "inherit", "inherit"],
    windowsHide: true,
  });
  server.once("error", (error) => {
    serverLaunchError = error;
  });

  await waitForServer(baseUrl, server);
  const result = spawnSync(process.execPath, [playwrightBin, "test", ...playwrightArgs], {
    cwd: projectRoot,
    env: offlineEnv,
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
