#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const zeroSha = "0".repeat(40);
const git = (args) => execFileSync("git", args, { encoding: "utf8" }).trim();

function resolveBase() {
  const eventBase = process.env.LEDGER_WRITE_BASE_SHA || "";
  if (
    process.env.GITHUB_EVENT_NAME !== "pull_request" ||
    !/^refs\/pull\/\d+\/merge$/.test(process.env.GITHUB_REF || "")
  ) {
    return eventBase === zeroSha ? "" : eventBase;
  }
  const expectedHead = process.env.LEDGER_WRITE_HEAD_SHA || "";
  const parents = git(["rev-list", "--parents", "-n", "1", "HEAD"]).split(/\s+/);
  if (parents.length !== 3 || !expectedHead || parents[2] !== expectedHead) {
    throw new Error("Ledger comparison requires the GitHub PR merge with the expected PR head as its second parent.");
  }
  const actualBase = parents[1];
  if (
    !/^[a-f0-9]{40}$/.test(eventBase) ||
    eventBase === zeroSha ||
    spawnSync("git", ["merge-base", "--is-ancestor", eventBase, actualBase]).status !== 0
  ) {
    throw new Error("Ledger comparison event base is not an ancestor of the checked-out PR merge base.");
  }
  return actualBase;
}

function selfTest() {
  const fixtureRoot = mkdtempSync(path.join(os.tmpdir(), "psychsift-ledger-ci-base-"));
  const fixtureGit = (args) =>
    execFileSync("git", args, { cwd: fixtureRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  fixtureGit(["init", "--quiet"]);
  fixtureGit(["config", "user.name", "Ledger fixture"]);
  fixtureGit(["config", "user.email", "ledger-fixture@example.invalid"]);
  writeFileSync(path.join(fixtureRoot, "base.txt"), "initial base\n");
  fixtureGit(["add", "base.txt"]);
  fixtureGit(["commit", "--quiet", "-m", "initial base"]);
  const eventBase = fixtureGit(["rev-parse", "HEAD"]);
  fixtureGit(["checkout", "--quiet", "-b", "pr"]);
  writeFileSync(path.join(fixtureRoot, "pr.txt"), "PR work\n");
  fixtureGit(["add", "pr.txt"]);
  fixtureGit(["commit", "--quiet", "-m", "PR work"]);
  const prHead = fixtureGit(["rev-parse", "HEAD"]);
  fixtureGit(["checkout", "--quiet", "-b", "current-main", eventBase]);
  writeFileSync(path.join(fixtureRoot, "base.txt"), "advanced base\n");
  fixtureGit(["add", "base.txt"]);
  fixtureGit(["commit", "--quiet", "-m", "advance main"]);
  const actualBase = fixtureGit(["rev-parse", "HEAD"]);
  fixtureGit(["merge", "--quiet", "--no-ff", "pr", "-m", "GitHub merge fixture"]);
  const env = {
    ...process.env,
    GITHUB_EVENT_NAME: "pull_request",
    GITHUB_REF: "refs/pull/123/merge",
    LEDGER_WRITE_BASE_SHA: eventBase,
    LEDGER_WRITE_HEAD_SHA: prHead,
  };
  const run = (overrides = {}) =>
    spawnSync(process.execPath, [scriptPath], { cwd: fixtureRoot, env: { ...env, ...overrides }, encoding: "utf8" });
  assert.equal(run().status, 0);
  assert.equal(run().stdout.trim(), actualBase, "stale event base must resolve to the actual merged main parent");
  assert.notEqual(actualBase, eventBase);
  assert.notEqual(run({ LEDGER_WRITE_HEAD_SHA: eventBase }).status, 0, "wrong PR head must fail closed");
  assert.notEqual(run({ LEDGER_WRITE_BASE_SHA: prHead }).status, 0, "unrelated event base must fail closed");
  assert.notEqual(run({ LEDGER_WRITE_HEAD_SHA: "" }).status, 0, "missing PR head must fail closed");
  assert.equal(
    run({ GITHUB_EVENT_NAME: "push", GITHUB_REF: "refs/heads/main" }).stdout.trim(),
    eventBase,
    "push comparison must retain the explicit before SHA",
  );
  assert.equal(
    run({ GITHUB_EVENT_NAME: "merge_group" }).stdout.trim(),
    eventBase,
    "queue comparison must retain its explicit base SHA",
  );
  assert.equal(
    run({ GITHUB_EVENT_NAME: "push", LEDGER_WRITE_BASE_SHA: zeroSha }).stdout.trim(),
    "",
    "initial pushes retain automatic base resolution",
  );
  fixtureGit(["checkout", "--quiet", "pr"]);
  assert.notEqual(run().status, 0, "a branch head masquerading as a merge ref must fail closed");
  console.log("ledger CI comparison-base self-test passed.");
}

try {
  if (process.argv.includes("--self-test")) selfTest();
  else console.log(resolveBase());
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
