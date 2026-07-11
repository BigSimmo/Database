#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vitestBin = path.join(projectRoot, "node_modules", "vitest", "vitest.mjs");
const vitestNeedle = vitestBin.toLowerCase();
const powershell = [
  "Get-CimInstance Win32_Process",
  "| Where-Object {",
  "  $_.CommandLine -and",
  `  $_.CommandLine.ToLower().Contains('${vitestNeedle}') -and`,
  "  $_.CommandLine -notlike '*run-vitest.mjs*' -and",
  "  $_.CommandLine -notlike '*Get-CimInstance*'",
  "}",
  "| ForEach-Object { $_.ProcessId }",
].join(" ");

let runningPids = [];
try {
  const probe = spawnSync("powershell.exe", ["-NoProfile", "-Command", powershell], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const output = probe.status === 0 ? probe.stdout.trim() : "";
  runningPids = output
    .split(/\r?\n/)
    .map((line) => Number.parseInt(line.trim(), 10))
    .filter(Number.isFinite);
} catch {
  runningPids = [];
}

for (const pid of runningPids) {
  try {
    spawnSync("taskkill", ["/F", "/T", "/PID", String(pid)], { stdio: "ignore" });
  } catch {
    // best effort cleanup
  }
}

const args = process.argv.slice(2);
const result = spawnSync(process.execPath, [vitestBin, ...args], {
  stdio: "inherit",
});
process.exit(result.status ?? 0);
