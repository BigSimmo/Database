#!/usr/bin/env node
/**
 * Pin Gitleaks to the workflow event's base/head SHAs and the checked-out commit.
 *
 * The stock gitleaks-action re-queries the PR commits API mid-run; a concurrent
 * push can move the tip so the scan range is not in the workspace (#097).
 * Event payload SHAs are immutable for the run — use those, then verify HEAD.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { childProcessExitCode } from "./child-process-result.mjs";

const zeroSha = /^0{40}$/;

/** Keep in lockstep with `.github/workflows/secret-scan.yml` env pins. */
export const PINNED_GITLEAKS_LINUX_X64 = {
  version: "8.24.3",
  sha256: "9991e0b2903da4c8f6122b5c3186448b927a5da4deef1fe45271c3793f4ee29c",
};

export function resolveGitleaksScanRange({ eventName, pinnedBase, pinnedHead, checkedOutHead }) {
  if (!pinnedHead || !checkedOutHead) {
    throw new Error("pinnedHead and checkedOutHead are required for a pinned Gitleaks scan.");
  }
  if (pinnedHead !== checkedOutHead) {
    throw new Error(
      `Checked-out HEAD ${checkedOutHead} does not match pinned event head ${pinnedHead}. ` +
        "Refuse to scan an unstable tip (issue #097).",
    );
  }

  const base = typeof pinnedBase === "string" ? pinnedBase.trim() : "";
  const useRange =
    (eventName === "pull_request" || eventName === "pull_request_target" || eventName === "push") &&
    base.length > 0 &&
    !zeroSha.test(base);

  if (useRange) {
    return { mode: "range", base, head: pinnedHead, logOpts: `${base}..${pinnedHead}` };
  }

  // schedule / workflow_dispatch / unreachable before-sha: scan the tip commit only.
  return { mode: "tip", base: null, head: pinnedHead, logOpts: "-1" };
}

function selfTest() {
  const head = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const base = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

  const pr = resolveGitleaksScanRange({
    eventName: "pull_request",
    pinnedBase: base,
    pinnedHead: head,
    checkedOutHead: head,
  });
  if (pr.mode !== "range" || pr.logOpts !== `${base}..${head}`) {
    throw new Error(`expected PR range scan, got ${JSON.stringify(pr)}`);
  }

  let failed = false;
  try {
    resolveGitleaksScanRange({
      eventName: "pull_request",
      pinnedBase: base,
      pinnedHead: head,
      checkedOutHead: "cccccccccccccccccccccccccccccccccccccccc",
    });
  } catch {
    failed = true;
  }
  if (!failed) throw new Error("expected mismatch between pinned head and checkout to throw");

  const schedule = resolveGitleaksScanRange({
    eventName: "schedule",
    pinnedBase: "",
    pinnedHead: head,
    checkedOutHead: head,
  });
  if (schedule.mode !== "tip" || schedule.logOpts !== "-1") {
    throw new Error(`expected tip scan for schedule, got ${JSON.stringify(schedule)}`);
  }

  const zeroBefore = resolveGitleaksScanRange({
    eventName: "push",
    pinnedBase: "0000000000000000000000000000000000000000",
    pinnedHead: head,
    checkedOutHead: head,
  });
  if (zeroBefore.mode !== "tip") {
    throw new Error(`expected tip scan for zero before-sha, got ${JSON.stringify(zeroBefore)}`);
  }

  const workflowPath = join(dirname(fileURLToPath(import.meta.url)), "..", ".github", "workflows", "secret-scan.yml");
  const workflow = readFileSync(workflowPath, "utf8");
  if (!workflow.includes(`GITLEAKS_VERSION: "${PINNED_GITLEAKS_LINUX_X64.version}"`)) {
    throw new Error(`secret-scan.yml must pin GITLEAKS_VERSION to ${PINNED_GITLEAKS_LINUX_X64.version}`);
  }
  if (!workflow.includes(`GITLEAKS_LINUX_X64_SHA256: "${PINNED_GITLEAKS_LINUX_X64.sha256}"`)) {
    throw new Error("secret-scan.yml must pin GITLEAKS_LINUX_X64_SHA256 to the release checksum");
  }
  if (!workflow.includes("sha256sum -c -")) {
    throw new Error("secret-scan.yml must verify the Gitleaks archive with sha256sum before install");
  }

  console.log("Pinned Gitleaks range self-test passed.");
}

function runGit(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (childProcessExitCode(result) !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function main(argv) {
  if (argv.includes("--self-test")) {
    selfTest();
    return;
  }

  const eventName = process.env.GITHUB_EVENT_NAME || "";
  const pinnedBase = process.env.GITLEAKS_PINNED_BASE || "";
  const pinnedHead = process.env.GITLEAKS_PINNED_HEAD || "";
  const gitleaksBin = process.env.GITLEAKS_BIN || "gitleaks";
  const checkedOutHead = runGit(["rev-parse", "HEAD"]);
  const range = resolveGitleaksScanRange({
    eventName,
    pinnedBase,
    pinnedHead,
    checkedOutHead,
  });

  console.log(`Pinned Gitleaks scan mode=${range.mode} log-opts=${range.logOpts}`);
  const args = ["detect", "--source=.", `--log-opts=${range.logOpts}`, "--redact", "--verbose", "--exit-code=1"];
  const result = spawnSync(gitleaksBin, args, { stdio: "inherit" });
  process.exit(childProcessExitCode(result));
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main(process.argv.slice(2));
}
