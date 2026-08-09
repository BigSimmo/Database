#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { childProcessExitCode } from "./child-process-result.mjs";
import { phoneChromePlan, renderPhoneChromeCommand } from "./phone-chrome-plan.mjs";

function parseArgs(args) {
  const options = { dryRun: false, files: undefined, fullMode: "auto" };
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (token === "--files") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--files requires a comma-separated path list.");
      options.files = value;
      index += 1;
      continue;
    }
    if (token.startsWith("--full=")) {
      options.fullMode = token.slice("--full=".length);
      continue;
    }
    if (token === "--help" || token === "-h") {
      console.log(
        "Usage: npm run verify:phone-chrome -- [--dry-run] [--files pathA,pathB] [--full=auto|always|never]\n" +
          "  --dry-run     Print the selected stages without executing them.\n" +
          "  --files       Classify an explicit comma-separated changed-file list.\n" +
          "  --full=auto   Run verify:ui only for shared chrome foundations (default).",
      );
      process.exit(0);
    }
    throw new Error(`Unknown option: ${token}`);
  }
  return options;
}

function changedFiles(explicitFiles) {
  if (explicitFiles)
    return explicitFiles
      .split(",")
      .map((file) => file.trim())
      .filter(Boolean);
  const result = execFileSync(process.execPath, ["scripts/ci-change-scope.mjs", "--json"], { encoding: "utf8" });
  return JSON.parse(result).files;
}

/** Stages that invoke an isolated Playwright production build. */
export function isPhoneChromeBrowserStage(stage) {
  const args = stage?.command?.args ?? [];
  if (args.includes("scripts/run-playwright.mjs")) return true;
  if (stage?.command?.executable === "npm" && args.includes("verify:ui")) return true;
  return false;
}

export function phoneChromeSharedBuildEnv(browserStageCount, { pid = process.pid, env = process.env } = {}) {
  if (browserStageCount < 2) return null;
  if (env.PLAYWRIGHT_BUILD_ROOT_ID?.trim() && env.PLAYWRIGHT_KEEP_BUILD_ROOT?.trim() === "true") {
    // Caller already opted into a keep-root session; do not override or auto-clean it.
    return null;
  }
  return {
    PLAYWRIGHT_BUILD_ROOT_ID: `phone-chrome-${pid}`,
    PLAYWRIGHT_KEEP_BUILD_ROOT: "true",
  };
}

export function runPhoneChromeCommand(command, { spawn = spawnSync, env = process.env } = {}) {
  const executable = process.platform === "win32" && command.executable === "npm" ? "cmd.exe" : command.executable;
  const args =
    executable === "cmd.exe" ? ["/d", "/s", "/c", [command.executable, ...command.args].join(" ")] : command.args;
  const result = spawn(executable, args, { stdio: "inherit", env });
  return childProcessExitCode(result);
}

function cleanupSharedBuildRoot(buildRootId, { projectRoot = process.cwd(), rm = rmSync, log = console.log } = {}) {
  if (!buildRootId) return;
  const absoluteRunRoot = path.join(projectRoot, ".next-playwright", buildRootId);
  try {
    rm(absoluteRunRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    log(`[phone-chrome] cleaned shared Playwright build root (.next-playwright/${buildRootId})`);
  } catch (error) {
    log(
      `[phone-chrome] warning: could not clean shared build root ${absoluteRunRoot}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

export function runPhoneChromeStages(
  stages,
  {
    runCommand = runPhoneChromeCommand,
    exit = process.exit,
    log = console.log,
    env = process.env,
    sharedBuildEnv = phoneChromeSharedBuildEnv,
    cleanupBuildRoot = cleanupSharedBuildRoot,
  } = {},
) {
  const browserStages = stages.filter(isPhoneChromeBrowserStage);
  const shared = sharedBuildEnv(browserStages.length, { env });
  const runEnv = shared ? { ...env, ...shared } : env;
  if (shared) {
    log(
      `[phone-chrome] reusing Playwright build root ${shared.PLAYWRIGHT_BUILD_ROOT_ID} across ${browserStages.length} browser stages`,
    );
  }

  let exitCode = 0;
  try {
    for (const stage of stages) {
      log(`\n[phone-chrome:${stage.id}] ${stage.label}`);
      log(`> ${renderPhoneChromeCommand(stage.command)}`);
      exitCode = runCommand(stage.command, { env: runEnv });
      if (exitCode !== 0) {
        // Announce on stderr so a piped caller without pipefail still has an
        // unambiguous failure line in the captured log (outstanding-issues #120).
        console.error(`[phone-chrome] stage "${stage.id}" failed; exiting with code ${exitCode}`);
        break;
      }
    }
  } finally {
    // Clean before process.exit — Node does not run finally after exit().
    if (shared?.PLAYWRIGHT_BUILD_ROOT_ID) {
      const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
      cleanupBuildRoot(shared.PLAYWRIGHT_BUILD_ROOT_ID, { log, projectRoot });
    }
  }
  if (exitCode !== 0) {
    exit(exitCode);
    return exitCode;
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseArgs(process.argv.slice(2));
  const plan = phoneChromePlan(changedFiles(options.files), { fullMode: options.fullMode });
  console.log(`Phone chrome inputs: ${plan.files.length ? plan.files.join(", ") : "(none detected)"}`);
  console.log(`Full UI policy: ${plan.fullMode} (${plan.fullSelected ? "selected" : "not selected"})`);
  for (const note of plan.notes) console.log(`Note: ${note}`);

  if (options.dryRun) {
    console.log("\nPhone chrome verification plan (dry run):");
    for (const stage of plan.stages) console.log(`- [${stage.id}] ${renderPhoneChromeCommand(stage.command)}`);
    const browserCount = plan.stages.filter(isPhoneChromeBrowserStage).length;
    if (browserCount >= 2) {
      console.log(`- shared Playwright build root will be reused across ${browserCount} browser stages (then cleaned)`);
    }
    process.exit(0);
  }

  runPhoneChromeStages(plan.stages);
}
