#!/usr/bin/env node
import { spawnSync } from "node:child_process";

import { classifyChangedFiles } from "./lib/ci-change-scope.mjs";
import { buildPrLocalPlan, formatPrLocalPlan } from "./lib/pr-local-plan.mjs";

const npmExecPath = process.env.npm_execpath;

function getArgValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function run(command, args, options = {}) {
  console.log(`\n> ${[command, ...args].join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error || result.status !== 0) {
    if (options.prerequisiteMessage) console.error(`\n${options.prerequisiteMessage}`);
    else if (result.error) console.error(result.error.message);
    process.exit(result.status ?? 1);
  }
}

function runNpm(args) {
  if (npmExecPath) {
    run(process.execPath, [npmExecPath, ...args]);
    return;
  }
  if (process.platform === "win32") {
    run("cmd.exe", ["/d", "/s", "/c", ["npm", ...args].join(" ")]);
    return;
  }
  run("npm", args);
}

function readScope(args) {
  const filesArg = getArgValue(args, "--files");
  if (filesArg) {
    return classifyChangedFiles(
      filesArg
        .split(",")
        .map((file) => file.trim())
        .filter(Boolean),
    );
  }

  const result = spawnSync(process.execPath, ["scripts/ci-change-scope.mjs", "--json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
  return JSON.parse(result.stdout);
}

function selfTest() {
  const labelsFor = (files, extended = false) =>
    buildPrLocalPlan(classifyChangedFiles(files), { extended }).map((entry) => entry.label);
  const docs = labelsFor(["docs/operator-note.md"]);
  if (docs.join(",") !== "npm run format:check,npm run verify:cheap") {
    throw new Error("Docs-only plan must stay on the two deterministic local gates.");
  }

  const answer = labelsFor(["src/app/api/answer/route.ts"]);
  for (const required of [
    "npm run format:check",
    "npm run verify:cheap",
    "npm run build",
    "npm run eval:rag:offline",
  ]) {
    if (!answer.includes(required)) throw new Error(`Answer-route plan omitted ${required}.`);
  }
  if (answer.includes("npm audit --omit=dev --audit-level=high")) {
    throw new Error("Default PR-local plan selected an extended network lane.");
  }

  const extendedDatabase = labelsFor(["supabase/migrations/20260710000000_example.sql"], true);
  for (const required of ["docker info", "supabase --version", "supabase start", "supabase db reset"]) {
    if (!extendedDatabase.includes(required)) throw new Error(`Extended database plan omitted ${required}.`);
  }

  console.log("PR-local command planner self-test passed.");
}

const args = process.argv.slice(2);
if (args.includes("--self-test")) {
  selfTest();
  process.exit(0);
}

const extended = args.includes("--extended");
const dryRun = args.includes("--dry-run");
if (extended && !dryRun && process.env.ALLOW_EXTENDED_PR_LOCAL !== "true") {
  console.error(
    "Extended PR-local verification can use the network, browser, Docker, and local Supabase. Set ALLOW_EXTENDED_PR_LOCAL=true only after explicit approval.",
  );
  process.exit(2);
}

const scope = readScope(args);
const plan = buildPrLocalPlan(scope, { extended });
console.log(`Changed files: ${scope.files.length > 0 ? scope.files.join(", ") : "(none detected)"}`);
console.log(`Selected PR-local commands (${extended ? "extended" : "provider-free default"}):`);
console.log(formatPrLocalPlan(plan));

if (dryRun) process.exit(0);

for (const entry of plan) {
  if (entry.kind === "npm-script" || entry.command === "npm") runNpm(entry.args);
  else run(entry.command, entry.args, { prerequisiteMessage: entry.prerequisiteMessage });
}
