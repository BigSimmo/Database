#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appName, localProjectId, projectPortEnd, stableProjectPort } from "./local-server-utils.mjs";

if (Number(process.versions.node.split(".")[0]) !== 22) {
  console.error(`Clinical KB local server requires Node 22.x. Current runtime: ${process.versions.node}.`);
  process.exit(1);
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const maxPort = 65535;
const identityPath = "/api/local-project-id";
const logPath = path.join(projectRoot, "dev-server.log");
const printUrlOnly = process.argv.slice(2).includes("--print-url");
const debugEnabled = process.env.ENSURE_DEBUG === "1";

function debug(message) {
  if (debugEnabled) console.error(`[ensure-local-server] ${message}`);
}

function localUrl(port) {
  return `http://localhost:${port}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function isPortBusy(port) {
  for (const host of ["127.0.0.1", "localhost", "::1"]) {
    if (await canConnectToHost(port, host)) return true;
  }
  return false;
}

function requestJson(url, timeoutMs = 3500) {
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
    }, timeoutMs + 500);

    request = http.get(url, { timeout: timeoutMs }, (response) => {
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

async function isThisProject(port, attempts = 3) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const payload = await requestJson(`http://localhost:${port}${identityPath}`);
    debug(`identity attempt ${attempt + 1} on ${port}: ${JSON.stringify(payload)}`);
    if (payload?.appName === appName && payload?.projectId === localProjectId(projectRoot)) return true;
    if (attempt < attempts - 1) await sleep(250);
  }
  return false;
}

async function findExistingProjectServer(startPort) {
  for (let port = startPort; port <= projectPortEnd; port += 1) {
    if (await isThisProject(port, 1)) return port;
  }
  return null;
}

async function findStartPort(startPort) {
  for (let port = startPort; port <= maxPort; port += 1) {
    if (await isThisProject(port, 1)) return { port, alreadyRunning: true };
    if (!(await isPortBusy(port))) return { port, alreadyRunning: false };
  }
  throw new Error(`No free local port found from ${startPort} to ${maxPort}.`);
}

function startDevServer(port) {
  debug(`starting dev server on ${port}`);
  const out = fs.openSync(logPath, "a");
  const err = fs.openSync(logPath, "a");
  try {
    const child = spawn(process.execPath, [path.join("scripts", "dev-free-port.mjs"), "--port", String(port)], {
      cwd: projectRoot,
      detached: true,
      env: { ...process.env, PORT: String(port) },
      stdio: ["ignore", out, err],
      windowsHide: true,
    });
    child.unref();
  } finally {
    fs.closeSync(out);
    fs.closeSync(err);
  }
}

async function waitForProject(port) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    if (await isThisProject(port, 1)) return true;
    debug(`waiting for project on ${port}: attempt ${attempt + 1}`);
    await sleep(500);
  }
  return false;
}

async function main() {
  const stablePort = stableProjectPort(projectRoot);
  debug(`stable port ${stablePort}`);
  const existingPort = await findExistingProjectServer(stablePort);
  debug(`existing port ${existingPort ?? "none"}`);

  if (existingPort) {
    console.log(printUrlOnly ? localUrl(existingPort) : `Clinical KB is already running at ${localUrl(existingPort)}`);
    return 0;
  }

  const target = await findStartPort(stablePort);
  debug(`target ${target.port}, alreadyRunning=${target.alreadyRunning}`);

  if (target.alreadyRunning) {
    console.log(printUrlOnly ? localUrl(target.port) : `Clinical KB is already running at ${localUrl(target.port)}`);
    return 0;
  }

  if (target.port !== stablePort && !printUrlOnly) {
    console.log(
      `Stable project port ${stablePort} is serving another local project; starting Clinical KB at ${localUrl(target.port)}`,
    );
  }

  startDevServer(target.port);

  if (await waitForProject(target.port)) {
    console.log(printUrlOnly ? localUrl(target.port) : `Clinical KB is running at ${localUrl(target.port)}`);
    if (!printUrlOnly) console.log(`Server log: ${logPath}`);
    return 0;
  }

  console.error(`Clinical KB did not become ready at ${localUrl(target.port)}. Check ${logPath}`);
  return 1;
}

process.exitCode = await main();
