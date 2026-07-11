#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const isWindows = process.platform === "win32";

function runNpmScript(script) {
  console.log(`\n> npm run ${script}`);
  const result = isWindows
    ? spawnSync("cmd.exe", ["/d", "/s", "/c", `npm run ${script}`], { stdio: "inherit" })
    : spawnSync("npm", ["run", script], { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function readScope() {
  const result = spawnSync(process.execPath, ["scripts/ci-change-scope.mjs", "--json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
  return JSON.parse(result.stdout);
}

const scope = readScope();
console.log(`Changed files: ${scope.files.length > 0 ? scope.files.join(", ") : "(none detected)"}`);

for (const script of ["check:runtime", "format:check", "lint", "typecheck", "test"]) {
  runNpmScript(script);
}

if (scope.build_changed) {
  runNpmScript("build");
} else {
  console.log("\nSkipping build: no build-affecting source, config, package, or container changes detected.");
}

if (scope.rag_eval_changed) {
  runNpmScript("eval:rag:offline");
}
