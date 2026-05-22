#!/usr/bin/env node
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appName, stableProjectPort } from "./local-server-utils.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const maxPort = 65535;

function parseCommand(args) {
  const [firstArg, ...rest] = args;
  if (firstArg === "dev" || firstArg === "start") {
    return { command: firstArg, args: rest };
  }
  return { command: "dev", args };
}

function parsePreferredPort(args) {
  const envPort = Number.parseInt(process.env.PORT ?? "", 10);
  if (Number.isInteger(envPort) && envPort > 0) {
    return { port: envPort, source: "configured" };
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if ((arg === "--port" || arg === "-p") && args[index + 1]) {
      const parsed = Number.parseInt(args[index + 1], 10);
      if (Number.isInteger(parsed) && parsed > 0) {
        return { port: parsed, source: "configured" };
      }
    }
    if (arg.startsWith("--port=")) {
      const parsed = Number.parseInt(arg.split("=")[1] ?? "", 10);
      if (Number.isInteger(parsed) && parsed > 0) {
        return { port: parsed, source: "configured" };
      }
    }
  }

  return { port: stableProjectPort(projectRoot), source: "stable" };
}

function removePortArgs(args) {
  const cleaned = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--port" || arg === "-p") {
      index += 1;
      continue;
    }
    if (arg.startsWith("--port=")) continue;
    cleaned.push(arg);
  }
  return cleaned;
}

function canListenOnHost(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
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
  const hosts = ["127.0.0.1", "localhost", "::1", "0.0.0.0", "::"];
  for (const host of ["127.0.0.1", "localhost", "::1"]) {
    if (await canConnectToHost(port, host)) return false;
  }
  for (const host of hosts) {
    if (!(await canListenOnHost(port, host))) return false;
  }
  return true;
}

async function findFreePort(preferredPort) {
  for (let port = preferredPort; port <= maxPort; port += 1) {
    if (await canListen(port)) return port;
  }
  throw new Error(`No free development port found from ${preferredPort} to ${maxPort}.`);
}

const parsedCommand = parseCommand(process.argv.slice(2));
const forwardedArgs = parsedCommand.args;
const preferred = parsePreferredPort(forwardedArgs);
const preferredPort = preferred.port;
const freePort = await findFreePort(preferredPort);
const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
const url = `http://localhost:${freePort}`;

if (freePort !== preferredPort) {
  const portKind = preferred.source === "stable" ? "Stable project port" : "Configured port";
  console.log(`${portKind} ${preferredPort} was busy; using ${url} instead.`);
} else {
  const portKind = preferred.source === "stable" ? "stable project port" : "configured port";
  console.log(`Starting ${appName} at ${url} (${portKind}).`);
}

if (forwardedArgs.includes("--print-port")) {
  process.exit(0);
}

const child = spawn(
  process.execPath,
  [
    nextBin,
    parsedCommand.command,
    "--hostname",
    "localhost",
    "--port",
    String(freePort),
    ...removePortArgs(forwardedArgs),
  ],
  {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(freePort) },
    stdio: "inherit",
  },
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
