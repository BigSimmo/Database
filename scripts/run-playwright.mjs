#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appName, localProjectId, projectPortEnd, stableProjectPort } from "./local-server-utils.mjs";

if (Number(process.versions.node.split(".")[0]) !== 24) {
  console.error(`Clinical KB Playwright checks require Node 24.x. Current runtime: ${process.versions.node}.`);
  process.exit(1);
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const playwrightBin = path.join(projectRoot, "node_modules", "playwright", "cli.js");
const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
const identityPath = "/api/local-project-id";
const startupTimeoutMs = 120_000;
const missingErrorComponentsNeedle = "missing required error components";
const routeSmokePaths = ["/", "/applications"];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function canListenOnHost(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();
    // An unsupported address family (e.g. no IPv6 in the container) cannot
    // host a conflicting listener, so it must not veto the port.
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
  for (const host of ["127.0.0.1", "localhost", "::1"]) {
    if (await canConnectToHost(port, host)) return false;
  }
  for (const host of ["127.0.0.1", "localhost", "::1", "0.0.0.0", "::"]) {
    if (!(await canListenOnHost(port, host))) return false;
  }
  return true;
}

async function findFreePort(startPort) {
  for (let port = startPort; port <= projectPortEnd; port += 1) {
    if (await canListen(port)) return port;
  }
  throw new Error(`No free Playwright server port found from ${startPort} to ${projectPortEnd}.`);
}

function requestJson(url) {
  return new Promise((resolve) => {
    const request = http.get(url, { timeout: 5000 }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        if (response.statusCode !== 200) {
          resolve(null);
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(null);
        }
      });
    });
    request.on("timeout", () => {
      request.destroy();
      resolve(null);
    });
    request.on("error", () => resolve(null));
  });
}

function requestText(url, timeoutMs = 30_000) {
  return new Promise((resolve) => {
    const request = http.get(url, { timeout: timeoutMs }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 400) {
          resolve(null);
          return;
        }
        resolve(body);
      });
    });
    request.on("timeout", () => {
      request.destroy();
      resolve(null);
    });
    request.on("error", () => resolve(null));
  });
}

async function hasHealthyRouteComponents(baseUrl) {
  for (const smokePath of routeSmokePaths) {
    const body = await requestText(`${baseUrl}${smokePath}`);
    if (!body || body.includes(missingErrorComponentsNeedle)) {
      return false;
    }
  }
  return true;
}

async function waitForServer(baseUrl) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < startupTimeoutMs) {
    const payload = await requestJson(`${baseUrl}${identityPath}`);
    if (isVerifiedProjectPayload(payload) && (await hasHealthyRouteComponents(baseUrl))) {
      return;
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for Clinical KB at ${baseUrl}.`);
}

function isVerifiedProjectPayload(payload) {
  return (
    payload?.appName === appName &&
    payload?.projectId === localProjectId(projectRoot) &&
    payload?.localServer?.safeLocalOrigin === true
  );
}

async function findExistingProjectServer() {
  const baseUrl = `http://localhost:${stableProjectPort(projectRoot)}`;
  const payload = await requestJson(`${baseUrl}${identityPath}`);
  return isVerifiedProjectPayload(payload) ? baseUrl : null;
}

function runPlaywright(baseUrl) {
  return spawnSync(process.execPath, [playwrightBin, "test", ...process.argv.slice(2)], {
    cwd: projectRoot,
    env: { ...process.env, PLAYWRIGHT_BASE_URL: baseUrl },
    stdio: "inherit",
  });
}

function stopProcessTree(child) {
  if (!child.pid || child.exitCode !== null) return;
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

function stopExistingProjectDevServers() {
  if (process.platform !== "win32") return;

  const command = `
$repo = $env:PLAYWRIGHT_PROJECT_ROOT
$patterns = @(
  "*$repo\\node_modules\\next\\dist\\bin\\next dev*",
  "*$repo\\node_modules\\next\\dist\\server\\lib\\start-server.js*",
  "*$repo\\.next\\dev\\build\\*"
)
$targets = Get-CimInstance Win32_Process | Where-Object {
  if (-not $_.CommandLine) { return $false }
  foreach ($pattern in $patterns) {
    if ($_.CommandLine -like $pattern) { return $true }
  }
  return $false
}
foreach ($target in $targets) {
  Stop-Process -Id $target.ProcessId -Force -ErrorAction SilentlyContinue
}
`;

  spawnSync("powershell.exe", ["-NoProfile", "-Command", command], {
    cwd: projectRoot,
    env: { ...process.env, PLAYWRIGHT_PROJECT_ROOT: projectRoot },
    stdio: "ignore",
  });
}

const existingBaseUrl = await findExistingProjectServer();
if (existingBaseUrl) {
  if (await hasHealthyRouteComponents(existingBaseUrl)) {
    console.log(`Using existing Clinical KB server at ${existingBaseUrl}`);
    const result = runPlaywright(existingBaseUrl);
    process.exit(result.status ?? (result.signal ? 1 : 0));
  }

  console.log(`Existing Clinical KB server at ${existingBaseUrl} failed route-component smoke; restarting it.`);
  stopExistingProjectDevServers();
  await sleep(1000);
}

stopExistingProjectDevServers();
await sleep(1000);

const port = await findFreePort(stableProjectPort(projectRoot));
const baseUrl = `http://localhost:${port}`;
console.log(`Starting Playwright-owned Clinical KB server at ${baseUrl}`);

const server = spawn(process.execPath, [nextBin, "dev", "--hostname", "0.0.0.0", "--port", String(port)], {
  cwd: projectRoot,
  detached: process.platform !== "win32",
  env: { ...process.env, PORT: String(port), PLAYWRIGHT_BASE_URL: baseUrl },
  stdio: ["ignore", "inherit", "inherit"],
  windowsHide: true,
});

let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  stopProcessTree(server);
};

process.once("SIGINT", () => {
  stop();
  process.exit(130);
});
process.once("SIGTERM", () => {
  stop();
  process.exit(143);
});
process.once("exit", stop);

try {
  await waitForServer(baseUrl);
  const result = runPlaywright(baseUrl);
  stop();
  process.exit(result.status ?? (result.signal ? 1 : 0));
} catch (error) {
  stop();
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
