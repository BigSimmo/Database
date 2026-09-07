#!/usr/bin/env node
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runTsxPath = resolve(projectRoot, "scripts", "run-tsx.mjs");
const generatorPath = resolve(projectRoot, "scripts", "generate-repo-awareness-snapshot.ts");
const forwardArgs = process.argv.slice(2);

const child = spawn(process.execPath, [runTsxPath, generatorPath, ...forwardArgs], {
  cwd: projectRoot,
  env: process.env,
  stdio: "inherit",
  windowsHide: true,
});

child.once("error", (error) => {
  console.error(error.message);
  process.exit(1);
});

child.once("close", (code, signal) => {
  process.exit(signal ? 1 : (code ?? 0));
});
