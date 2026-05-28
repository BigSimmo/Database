#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appName, localProjectId, projectPortEnd, stableProjectPort } from "./local-server-utils.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const maxPort = 65535;
const identityPath = "/api/local-project-id";
const logPath = path.join(projectRoot, "dev-server.log");
const printUrlOnly = process.argv.slice(2).includes("--print-url");

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

function requestJson(url, timeoutMs = 900) {
  return new Promise((resolve) => {
    const request = http.get(url, { timeout: timeoutMs }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
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

async function isThisProject(port) {
  const payload = await requestJson(`http://localhost:${port}${identityPath}`);
  return payload?.appName === appName && payload?.projectId === localProjectId(projectRoot);
}

async function findExistingProjectServer(startPort) {
  for (let port = startPort; port <= projectPortEnd; port += 1) {
    if (await isThisProject(port)) return port;
  }
  return null;
}

async function findStartPort(startPort) {
  for (let port = startPort; port <= maxPort; port += 1) {
    if (await isThisProject(port)) return { port, alreadyRunning: true };
    if (!(await isPortBusy(port))) return { port, alreadyRunning: false };
  }
  throw new Error(`No free local port found from ${startPort} to ${maxPort}.`);
}

function startDevServer(port) {
  const out = fs.openSync(logPath, "a");
  const err = fs.openSync(logPath, "a");
  const child = spawn(process.execPath, [path.join("scripts", "dev-free-port.mjs"), "--port", String(port)], {
    cwd: projectRoot,
    detached: true,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", out, err],
    windowsHide: true,
  });
  child.unref();
}

async function waitForProject(port) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    if (await isThisProject(port)) return true;
    await sleep(500);
  }
  return false;
}

const stablePort = stableProjectPort(projectRoot);
const existingPort = await findExistingProjectServer(stablePort);

if (existingPort) {
  console.log(printUrlOnly ? localUrl(existingPort) : `Clinical KB is already running at ${localUrl(existingPort)}`);
  process.exit(0);
}

const target = await findStartPort(stablePort);

if (target.alreadyRunning) {
  console.log(printUrlOnly ? localUrl(target.port) : `Clinical KB is already running at ${localUrl(target.port)}`);
  process.exit(0);
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
  process.exit(0);
}

console.error(`Clinical KB did not become ready at ${localUrl(target.port)}. Check ${logPath}`);
process.exit(1);
