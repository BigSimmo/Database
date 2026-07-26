#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { childProcessExitCode } from "./child-process-result.mjs";
import { acquireHeavyRunLock } from "./test-run-lock.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
if (args[0] !== "--npm-script" || !args[1]) {
  console.error("Usage: node scripts/run-heavy.mjs --npm-script <script> [forwarded arguments]");
  process.exit(2);
}

const script = args[1];
const rawForwarded = args.slice(2);
const forceLockRelease = rawForwarded.includes("--force-lock-release");
const forwarded = rawForwarded.filter((argument) => argument !== "--force-lock-release");
const mode = script === "typecheck:internal" ? "shared" : "exclusive";
const lock = acquireHeavyRunLock({
  projectRoot,
  command: `npm run ${script}`,
  forceLockRelease,
  mode,
});

function runNpmScript() {
  const npmExecPath = process.env.npm_execpath;
  const child = npmExecPath
    ? spawn(process.execPath, [npmExecPath, "run", script, ...(forwarded.length ? ["--", ...forwarded] : [])], {
        cwd: projectRoot,
        env: lock.environment,
        stdio: "inherit",
      })
    : spawn(
        process.platform === "win32" ? "cmd.exe" : "npm",
        process.platform === "win32"
          ? ["/d", "/s", "/c", `npm run ${script}`]
          : ["run", script, ...(forwarded.length ? ["--", ...forwarded] : [])],
        { cwd: projectRoot, env: lock.environment, stdio: "inherit" },
      );

  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (status, signal) => {
      resolve(childProcessExitCode({ status, signal }));
    });
  });
}

let exitCode = 1;
try {
  exitCode = await runNpmScript();
} finally {
  lock.release();
}
process.exit(exitCode);
