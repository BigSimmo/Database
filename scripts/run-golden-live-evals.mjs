#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const forcedEnv = {
  ...process.env,
  RAG_TEXT_WEAK_OR_RELAXATION: "false",
};

function runEval({ description, args }) {
  const result = spawnSync(npmCommand, ["run", ...args], {
    stdio: "inherit",
    env: forcedEnv,
    windowsHide: true,
  });

  if (result.error) {
    console.error(`[eval] ${description} failed to start: ${String(result.error.message)}`);
    return 1;
  }

  if (result.status && result.status !== 0) {
    console.error(`[eval] ${description} failed with exit code ${result.status}.`);
    return result.status;
  }

  if (result.signal) {
    console.error(`[eval] ${description} exited from signal ${result.signal}.`);
    return 1;
  }

  return 0;
}

const checks = [
  { description: "eval:retrieval:quality", args: ["eval:retrieval:quality"] },
  { description: "eval:quality -- --rag-only", args: ["eval:quality", "--", "--rag-only"] },
];

let firstFailure = 0;
for (const check of checks) {
  const status = runEval(check);
  if (status !== 0 && firstFailure === 0) {
    firstFailure = status;
  }
}

if (firstFailure !== 0) process.exitCode = firstFailure;
