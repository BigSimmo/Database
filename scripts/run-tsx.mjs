#!/usr/bin/env node
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveTsxCli } from "./resolve-tsx-cli.mjs";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/run-tsx.mjs <script.ts> [args...]");
  process.exit(1);
}

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tsxCli = resolveTsxCli(projectRoot);
const hook = new URL("./enable-server-only-stub.mjs", import.meta.url).href;
const child = spawn(process.execPath, [tsxCli, "--import", hook, ...args], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
  windowsHide: true,
});

child.once("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
child.once("close", (code, signal) => {
  process.exit(signal ? 1 : (code ?? 1));
});
