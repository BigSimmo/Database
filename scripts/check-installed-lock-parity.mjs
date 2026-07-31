#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const criticalInstalledPackages = ["next", "react", "react-dom", "eslint", "playwright", "typescript", "vitest"];

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function installedLockParity(projectRoot, packageNames = criticalInstalledPackages) {
  const lockPath = path.join(projectRoot, "package-lock.json");
  const lock = readJson(lockPath);

  return packageNames.map((packageName) => {
    const lockEntry = lock.packages?.[`node_modules/${packageName}`];
    const installedPath = path.join(projectRoot, "node_modules", ...packageName.split("/"), "package.json");
    let installedVersion = null;
    let installedError = null;

    try {
      installedVersion = readJson(installedPath).version ?? null;
    } catch (error) {
      installedError = error instanceof Error ? error.message : String(error);
    }

    const lockedVersion = lockEntry?.version ?? null;
    return {
      packageName,
      lockedVersion,
      installedVersion,
      ok: Boolean(lockedVersion && installedVersion && lockedVersion === installedVersion),
      reason: !lockedVersion
        ? "package is missing from package-lock.json"
        : !installedVersion
          ? `installed package is unavailable (${installedError ?? "unknown read error"})`
          : lockedVersion !== installedVersion
            ? `installed ${installedVersion} does not match locked ${lockedVersion}`
            : null,
    };
  });
}

function parseArgs(args) {
  const options = { json: false, root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..") };
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === "--json") {
      options.json = true;
      continue;
    }
    if (token === "--root") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--root requires a project directory.");
      options.root = path.resolve(value);
      index += 1;
      continue;
    }
    if (token === "--help" || token === "-h") {
      console.log("Usage: npm run check:installed-lock-parity -- [--json] [--root directory]");
      process.exit(0);
    }
    throw new Error(`Unknown option: ${token}`);
  }
  return options;
}

function isDirectExecution() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isDirectExecution()) {
  const options = parseArgs(process.argv.slice(2));
  const results = installedLockParity(options.root);
  const failures = results.filter((result) => !result.ok);

  if (options.json) {
    console.log(JSON.stringify({ ok: failures.length === 0, packages: results }, null, 2));
  } else {
    for (const result of results) {
      if (result.ok) console.log(`[installed-lock-parity] ${result.packageName}: ${result.lockedVersion}`);
      else console.error(`[installed-lock-parity] ${result.packageName}: ${result.reason}`);
    }
  }

  if (failures.length > 0) {
    console.error(
      "Installed dependencies do not match package-lock.json. Run npm ci before interpreting test failures.",
    );
    process.exit(1);
  }
}
