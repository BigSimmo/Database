#!/usr/bin/env node
import { spawnSync } from "node:child_process";
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
const forwarded = args.slice(2);
const lock = acquireHeavyRunLock({ projectRoot, command: `npm run ${script}` });
let exitCode = 1;
try {
  const npmExecPath = process.env.npm_execpath;
  const result = npmExecPath
    ? spawnSync(process.execPath, [npmExecPath, "run", script, ...(forwarded.length ? ["--", ...forwarded] : [])], {
        cwd: projectRoot,
        env: lock.environment,
        stdio: "inherit",
      })
    : spawnSync(
        process.platform === "win32" ? "cmd.exe" : "npm",
        process.platform === "win32"
          ? ["/d", "/s", "/c", `npm run ${script}`]
          : ["run", script, ...(forwarded.length ? ["--", ...forwarded] : [])],
        { cwd: projectRoot, env: lock.environment, stdio: "inherit" },
      );
  exitCode = childProcessExitCode(result);
} finally {
  lock.release();
}
process.exit(exitCode);
