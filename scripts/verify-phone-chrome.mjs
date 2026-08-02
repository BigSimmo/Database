#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
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

export function runPhoneChromeCommand(command, { spawn = spawnSync } = {}) {
  const executable = process.platform === "win32" && command.executable === "npm" ? "cmd.exe" : command.executable;
  const args =
    executable === "cmd.exe" ? ["/d", "/s", "/c", [command.executable, ...command.args].join(" ")] : command.args;
  const result = spawn(executable, args, { stdio: "inherit" });
  return childProcessExitCode(result);
}

export function runPhoneChromeStages(
  stages,
  { runCommand = runPhoneChromeCommand, exit = process.exit, log = console.log } = {},
) {
  for (const stage of stages) {
    log(`\n[phone-chrome:${stage.id}] ${stage.label}`);
    log(`> ${renderPhoneChromeCommand(stage.command)}`);
    const exitCode = runCommand(stage.command);
    if (exitCode !== 0) {
      // Announce on stderr so a piped caller without pipefail still has an
      // unambiguous failure line in the captured log (outstanding-issues #120).
      console.error(`[phone-chrome] stage "${stage.id}" failed; exiting with code ${exitCode}`);
      exit(exitCode);
      return exitCode;
    }
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
    process.exit(0);
  }

  runPhoneChromeStages(plan.stages);
}
