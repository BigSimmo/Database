#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";
const [targetScript, ...forwardArgs] = process.argv.slice(2);

if (!targetScript) {
  console.error("Usage: node scripts/run-eval-safe.mjs <script> [args...]");
  process.exit(1);
}

function normalizeCommandLine(value) {
  return value.toLowerCase().replaceAll("/", "\\");
}

function toDateOrDefault(rawValue) {
  if (!rawValue) return null;
  const dateValue = Date.parse(rawValue);
  if (!Number.isNaN(dateValue)) return dateValue;

  // WMI date format example: 20260701123015.000000+000
  if (rawValue.length >= 14) {
    const normalized = rawValue.slice(0, 14);
    const candidate = [
      normalized.slice(0, 4),
      normalized.slice(4, 6),
      normalized.slice(6, 8),
      normalized.slice(8, 10),
      normalized.slice(10, 12),
      normalized.slice(12, 14),
    ];
    const iso = `${candidate[0]}-${candidate[1]}-${candidate[2]}T${candidate[3]}:${candidate[4]}:${candidate[5]}Z`;
    const parsed = Date.parse(iso);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

function shouldTerminateCandidate(commandLine) {
  const normalizedCommandLine = normalizeCommandLine(commandLine);
  const hasRepoScripts = normalizedCommandLine.includes("\\scripts\\");

  if (normalizedCommandLine.includes("\\run-eval-safe.mjs")) return false;

  if (hasRepoScripts && normalizedCommandLine.includes("\\node_modules\\tsx\\dist\\cli.mjs")) {
    if (normalizedCommandLine.includes("\\scripts\\eval-")) return true;
    if (normalizedCommandLine.includes("\\scripts\\eval")) return true;
    return false;
  }

  if (hasRepoScripts && normalizedCommandLine.includes("\\scripts\\run-tsx.mjs")) {
    return normalizedCommandLine.includes("\\scripts\\eval");
  }

  if (
    hasRepoScripts &&
    normalizedCommandLine.includes("\\node_modules\\tsx\\dist\\preflight.cjs") &&
    normalizedCommandLine.includes(" --import ")
  ) {
    return true;
  }

  if (normalizedCommandLine.includes("\\node_modules\\playwright")) {
    return true;
  }

  if (
    normalizedCommandLine.includes("\\node_modules\\vitest\\vitest.mjs") &&
    normalizedCommandLine.includes("\\tests\\")
  ) {
    return true;
  }

  if (normalizedCommandLine.includes("\\node_modules\\next\\dist\\bin\\next")) {
    return true;
  }

  if (normalizedCommandLine.includes("\\node_modules\\next\\dist\\server\\lib\\start-server.js")) {
    return true;
  }

  if (normalizedCommandLine.includes("\\node_modules\\next\\dist\\compiled\\jest-worker\\processchild.js")) {
    return true;
  }

  if (normalizedCommandLine.includes("\\.next\\build\\") || normalizedCommandLine.includes("\\.next\\dev\\build\\")) {
    return true;
  }

  return false;
}

function listRepoNodeProcesses() {
  if (!isWindows) return [];

  const command = [
    "$root = [Environment]::GetEnvironmentVariable('RUN_EVAL_GUARD_REPO_ROOT')",
    "if (-not $root) { exit 0 }",
    "$root = (Resolve-Path $root).Path.ToLowerInvariant()",
    "$matches = Get-CimInstance Win32_Process | Where-Object {",
    "  $_.Name -like 'node*' -and",
    "  $_.CommandLine -and",
    "  $_.CommandLine.ToLowerInvariant().Contains($root)",
    "} | Select-Object ProcessId, ParentProcessId, CommandLine, CreationDate",
    "$matches | ConvertTo-Json -Compress",
  ];

  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NoLogo", "-NonInteractive", "-Command", command.join("\n")],
    {
      encoding: "utf8",
      env: { ...process.env, RUN_EVAL_GUARD_REPO_ROOT: projectRoot },
      cwd: projectRoot,
      windowsHide: true,
    },
  );

  if (result.status !== 0) return [];

  const raw = (result.stdout || "").trim();
  if (!raw || raw === "null") return [];
  try {
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    return rows.map((item) => ({
      pid: Number.parseInt(item?.ProcessId ?? "0", 10),
      parentPid: Number.parseInt(item?.ParentProcessId ?? "0", 10),
      commandLine: String(item?.CommandLine ?? ""),
      createdAtMs: toDateOrDefault(item?.CreationDate ?? ""),
    }));
  } catch {
    return [];
  }
}

function listCandidateProcesses() {
  if (!isWindows) return [];

  return listRepoNodeProcesses().filter((candidate) => {
    if (!candidate?.commandLine) return false;
    return shouldTerminateCandidate(candidate.commandLine);
  });
}

function getDescendantPids(rootPid, allProcesses = listRepoNodeProcesses()) {
  const visited = new Set([rootPid]);
  const queue = [rootPid];

  while (queue.length > 0) {
    const pid = queue.shift();
    for (const process of allProcesses) {
      if (process?.parentPid === pid && !visited.has(process.pid)) {
        visited.add(process.pid);
        queue.push(process.pid);
      }
    }
  }

  return Array.from(visited);
}

function terminateProcesses(pids, context) {
  if (!isWindows) return 0;

  let killed = 0;
  for (const pid of pids) {
    if (!Number.isFinite(pid) || pid <= 0) continue;
    const killedResult = spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
      cwd: projectRoot,
      stdio: "ignore",
      windowsHide: true,
    });
    if (killedResult.status === 0) killed += 1;
  }

  if (killed > 0) {
    const prefix = context ? `[eval] ${context}: ` : "[eval] ";
    console.log(`${prefix}terminated ${killed} lingering node process(es) for this repo.`);
  }

  return killed;
}

function cleanupResidualEvaluationProcesses() {
  if (!isWindows) return;

  const selfPid = process.pid;
  const candidates = listCandidateProcesses().filter((candidate) => candidate.pid > 0 && candidate.pid !== selfPid);
  if (candidates.length === 0) return;
  const pids = candidates.map((candidate) => candidate.pid);
  terminateProcesses(pids, "cleanupResidualEvaluationProcesses");
}

function terminateEvalProcessTree(pid) {
  if (!isWindows || !pid || pid <= 0) return;
  const processSnapshot = listRepoNodeProcesses();
  const descendants = getDescendantPids(pid, processSnapshot);
  terminateProcesses(descendants, "terminateEvalProcessTree");
}

function terminateEvalProcess(pid) {
  if (!pid || pid <= 0) return;
  terminateEvalProcessTree(pid);
}

function runEvalScript() {
  const targetPath = resolve(projectRoot, targetScript);
  const command = process.execPath;
  const commandArgs = [resolve(projectRoot, "scripts", "run-tsx.mjs"), targetPath, ...forwardArgs];

  const child = spawn(command, commandArgs, {
    cwd: projectRoot,
    stdio: "inherit",
    windowsHide: true,
    shell: false,
  });

  const stopEvalProcess = () => {
    terminateEvalProcess(child.pid);
  };

  const stopEvalProcessWithTimeout = () => {
    stopEvalProcess();
    setTimeout(() => {
      terminateProcesses([child.pid], "force-stop-eval");
    }, 3000);
  };

  process.once("SIGINT", () => {
    stopEvalProcessWithTimeout();
    process.exit(130);
  });

  process.once("SIGTERM", () => {
    stopEvalProcessWithTimeout();
    process.exit(143);
  });

  child.once("close", (code, signal) => {
    process.removeAllListeners("SIGINT");
    process.removeAllListeners("SIGTERM");
    if (signal) {
      stopEvalProcess();
      process.exit(1);
    } else {
      stopEvalProcess();
      process.exit(code ?? 0);
    }
  });

  child.once("error", (error) => {
    stopEvalProcess();
    console.error(error instanceof Error ? error.message : `Failed to launch eval script: ${String(error)}`);
    process.exit(1);
  });
}

cleanupResidualEvaluationProcesses();
runEvalScript();
