import { spawn } from "node:child_process";

const parallelTasks = [
  "check:runtime",
  "check:github-actions",
  "check:ci-scope",
  "check:ci-triage",
  "check:pr-policy",
  "check:gate-manifest",
  "check:branch-review-ledger",
  "sitemap:check",
  "docs:check-index",
  "docs:check-scripts",
  "docs:check-links",
  "check:knip",
  "check:maintainability-budgets",
  "brand:check",
  "check:assets",
  "check:therapy-data-index",
  "check:type-scale",
  "check:icon-scale",
  "check:design-system-contract",
  "check:migration-role",
  "check:function-grants",
  "check:owner-scope",
  "lint"
];

async function runTask(task) {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", task], { shell: true, stdio: "pipe" });
    let output = "";
    child.stdout.on("data", (data) => output += data.toString());
    child.stderr.on("data", (data) => output += data.toString());
    child.on("close", (code) => {
      if (code !== 0) {
        console.error(output);
        reject(new Error(`${task}`));
      } else {
        console.log(`✔ ${task}`);
        resolve();
      }
    });
  });
}

async function run() {
  console.log("Starting parallel verification...");
  try {
    await Promise.all(parallelTasks.map(runTask));
    await runTask("typecheck");

    console.log("Starting tests...");
    await new Promise((resolve, reject) => {
      const child = spawn("npm", ["run", "test"], { shell: true, stdio: "inherit" });
      child.on("close", (code) => {
        if (code !== 0) reject(new Error("test"));
        else resolve();
      });
    });
  } catch (err) {
    console.error(`\n✘ [FAILED] ${err.message}`);
    process.exit(1);
  }
}

run();
