#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { childProcessExitCode } from "./child-process-result.mjs";
import { typescriptBuildInfoPath } from "./test-cache-path.mjs";
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
// Read-only typechecks share the capped lease (at most two across worktrees).
// Both the full and source-only wrappers must match — a hard-coded
// `typecheck:internal` check left `typecheck:source:internal` exclusive.
const sharedTypecheckScripts = new Set(["typecheck:internal", "typecheck:source:internal"]);
const mode = sharedTypecheckScripts.has(script) ? "shared" : "exclusive";
const typecheckBuildInfo =
  mode === "shared"
    ? typescriptBuildInfoPath(
        projectRoot,
        undefined,
        script === "typecheck:source:internal" ? "tsconfig.typecheck.tsbuildinfo" : "tsconfig.tsbuildinfo",
      )
    : null;
if (typecheckBuildInfo) mkdirSync(path.dirname(typecheckBuildInfo), { recursive: true });
const effectiveForwarded = typecheckBuildInfo ? [...forwarded, "--tsBuildInfoFile", typecheckBuildInfo] : forwarded;
const configuredWaitTimeoutMs = Number(process.env.HEAVY_RUN_WAIT_TIMEOUT_MS);
const waitTimeoutMs = Number.isFinite(configuredWaitTimeoutMs) ? configuredWaitTimeoutMs : undefined;
const lock = acquireHeavyRunLock({
  projectRoot,
  command: `npm run ${script}`,
  forceLockRelease,
  mode,
  ...(waitTimeoutMs === undefined ? {} : { waitTimeoutMs }),
});

function runNpmScript() {
  const npmExecPath = process.env.npm_execpath;
  // Always forward effectiveForwarded (includes injected --tsBuildInfoFile for
  // shared typechecks). The pre-push hook invokes this via plain `node`, so
  // npm_execpath is usually unset — dropping the injection there would share
  // the base config's in-repo buildinfo across different include graphs.
  const npmArgs = effectiveForwarded.length ? ["--", ...effectiveForwarded] : [];
  const child = npmExecPath
    ? spawn(process.execPath, [npmExecPath, "run", script, ...npmArgs], {
        cwd: projectRoot,
        env: lock.environment,
        stdio: "inherit",
      })
    : spawn(
        process.platform === "win32" ? "cmd.exe" : "npm",
        process.platform === "win32"
          ? [
              "/d",
              "/s",
              "/c",
              ["npm", "run", script, ...npmArgs].map((part) => (/\s/.test(part) ? `"${part}"` : part)).join(" "),
            ]
          : ["run", script, ...npmArgs],
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
