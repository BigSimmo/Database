#!/usr/bin/env node
/**
 * check-dev-drive-cache.mjs — Verify npm package cache registration in Windows Dev Drive trusted cache (#6SMMB4).
 *
 * On Windows workstations hosting worktrees on a Dev Drive (e.g. D:, ReFS),
 * verifies whether `npm config get cache` resolves to a path on a Dev Drive volume
 * and whether that cache directory is trusted by Microsoft Defender.
 */
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function resolveNpmCache(exec = execFileSync) {
  try {
    const isWin = process.platform === "win32";
    const stdout = isWin
      ? exec("cmd.exe", ["/c", "npm", "config", "get", "cache"], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        })
      : exec("npm", ["config", "get", "cache"], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        });
    return stdout.trim();
  } catch {
    return process.env.npm_config_cache || "";
  }
}

export function inspectDevDriveTrust(cachePath, { platform = process.platform, exec = spawnSync } = {}) {
  if (platform !== "win32") {
    return {
      status: "skipped",
      reason: "Dev Drive trust verification is specific to Windows workstations.",
      cachePath,
    };
  }

  if (!cachePath) {
    return {
      status: "warning",
      reason: "Could not resolve npm cache directory path.",
      cachePath: "",
    };
  }

  const drive = path.parse(path.resolve(cachePath)).root.replace(/[\/\\]$/, "");
  const queryResult = exec("fsutil", ["devdrv", "query", drive], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  const output = `${queryResult.stdout ?? ""}\n${queryResult.stderr ?? ""}`.trim();

  if (queryResult.status !== 0) {
    if (output.includes("Error 5") || output.includes("Access is denied")) {
      return {
        status: "info",
        reason: `fsutil devdrv query requires elevation (Error 5). From an elevated administrator prompt run: fsutil devdrv trust "${cachePath}"`,
        cachePath,
        drive,
        elevated: false,
      };
    }
    return {
      status: "warning",
      reason: `Could not query Dev Drive status for volume ${drive}: ${output || "unknown error"}`,
      cachePath,
      drive,
    };
  }

  const isTrusted = /trusted/i.test(output) && !/not trusted/i.test(output);
  return {
    status: isTrusted ? "ok" : "untrusted",
    reason: isTrusted
      ? `Dev Drive on ${drive} is trusted.`
      : `Dev Drive on ${drive} is not registered as trusted. Run elevated: fsutil devdrv trust "${cachePath}"`,
    cachePath,
    drive,
    elevated: true,
    rawOutput: output,
  };
}

export function exitCodeForDevDriveResult(result) {
  if (result.status === "ok") return 0;
  if (result.status === "skipped" || result.status === "info") return 0;
  return 1;
}

export function runCheck({ log = console.log, warn = console.warn, inspect = inspectDevDriveTrust } = {}) {
  const cachePath = resolveNpmCache();
  const result = inspect(cachePath);

  if (result.status === "ok") {
    log(`[devdrv-cache] OK: npm cache (${result.cachePath}) on ${result.drive} is registered in trusted Dev Drive.`);
    return 0;
  }
  if (result.status === "skipped" || result.status === "info") {
    log(`[devdrv-cache] ${result.reason}`);
    return 0;
  }
  warn(`[devdrv-cache] ${result.status === "untrusted" ? "FAIL" : "WARN"}: ${result.reason}`);
  return exitCodeForDevDriveResult(result);
}

function selfTest() {
  const linuxResult = inspectDevDriveTrust("/home/user/.npm", { platform: "linux" });
  if (linuxResult.status !== "skipped") throw new Error("Linux platform should be skipped");

  const deniedExec = () => ({ status: 1, stdout: "", stderr: "Failed to open the volume. Error 5: Access is denied." });
  const deniedResult = inspectDevDriveTrust("D:\\.npm-cache", { platform: "win32", exec: deniedExec });
  if (deniedResult.status !== "info" || deniedResult.elevated !== false) {
    throw new Error("Access denied should return info status with non-elevated flag");
  }

  const trustedExec = () => ({
    status: 0,
    stdout: "This is a Developer Volume (Dev Drive). Volume is trusted.",
    stderr: "",
  });
  const trustedResult = inspectDevDriveTrust("D:\\.npm-cache", { platform: "win32", exec: trustedExec });
  if (trustedResult.status !== "ok" || trustedResult.elevated !== true) {
    throw new Error("Trusted output should return ok status");
  }

  const untrustedExec = () => ({
    status: 0,
    stdout: "This is a Developer Volume (Dev Drive). Volume is not trusted.",
    stderr: "",
  });
  const untrustedResult = inspectDevDriveTrust("D:\\.npm-cache", { platform: "win32", exec: untrustedExec });
  if (untrustedResult.status !== "untrusted") {
    throw new Error("Untrusted output should return untrusted status");
  }
  if (exitCodeForDevDriveResult(untrustedResult) !== 1) {
    throw new Error("Untrusted result should map to exit code 1");
  }
  if (exitCodeForDevDriveResult({ status: "warning", reason: "missing cache" }) !== 1) {
    throw new Error("Warning result should map to exit code 1");
  }

  console.log("[devdrv-cache] self-test passed.");
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes("--self-test")) {
    process.exit(selfTest());
  }
  process.exit(runCheck());
}
