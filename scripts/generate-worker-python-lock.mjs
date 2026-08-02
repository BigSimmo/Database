#!/usr/bin/env node
/**
 * generate-worker-python-lock — pin worker/python/requirements.txt from
 * worker/python/requirements.in using pip-tools.
 */
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const PYTHON = process.env.PYTHON_BIN?.trim() || (process.platform === "win32" ? "python" : "python3");
const PIP_TOOLS_VERSION = "7.6.0";
const IN_FILE = "worker/python/requirements.in";
const OUT_FILE = "worker/python/requirements.txt";

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { encoding: "utf8", stdio: "pipe", ...opts });
  if (result.status !== 0) {
    throw new Error(
      `Command failed: ${cmd} ${args.join(" ")}\n${result.stderr || ""}\n${result.stdout || ""}`,
    );
  }
  return result;
}

function venvPython(venvDir) {
  return process.platform === "win32" ? path.join(venvDir, "Scripts", "python.exe") : path.join(venvDir, "bin", "python");
}

function ensureVenv(venvDir) {
  if (existsSync(venvDir)) rmSync(venvDir, { recursive: true, force: true });
  run(PYTHON, ["-m", "venv", venvDir]);
  const python = venvPython(venvDir);
  run(python, ["-m", "pip", "install", "setuptools", "wheel"]);
  run(python, ["-m", "pip", "install", `pip-tools==${PIP_TOOLS_VERSION}`]);
}

function pipCompile(venvDir, outputFile) {
  const python = venvPython(venvDir);
  const args = ["-m", "piptools", "compile", "--generate-hashes", "--output-file", outputFile, IN_FILE];
  run(python, args, { env: { ...process.env, CUSTOM_COMPILE_COMMAND: "npm run generate:worker-python-lock" } });
}

function main() {
  if (!existsSync(IN_FILE)) throw new Error(`Missing ${IN_FILE}`);

  const venvDir = mkdtempSync(path.join(tmpdir(), "pip-tools-"));
  try {
    ensureVenv(venvDir);
    pipCompile(venvDir, OUT_FILE);
    console.log(`Generated ${OUT_FILE}`);
  } finally {
    rmSync(venvDir, { recursive: true, force: true });
  }
}

main();
