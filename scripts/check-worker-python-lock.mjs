#!/usr/bin/env node
/**
 * check-worker-python-lock — verify that worker/python/requirements.txt is
 * in sync with worker/python/requirements.in and is a hashed lockfile.
 */
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
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
  run(
    python,
    ["-m", "piptools", "compile", "--generate-hashes", "--output-file", outputFile, IN_FILE],
    { env: { ...process.env, CUSTOM_COMPILE_COMMAND: "npm run generate:worker-python-lock" } },
  );
}

function normalize(contents) {
  return contents
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "" && !line.trim().startsWith("#"))
    .join("\n");
}

function assertHashedLockfile(contents) {
  const lines = contents.split(/\r?\n/);
  const hasPinned = lines.some((line) => /==/.test(line));
  const hasHash = lines.some((line) => /--hash=sha256:/.test(line));
  if (!hasPinned) throw new Error("requirements.txt does not contain pinned (==) versions");
  if (!hasHash) throw new Error("requirements.txt does not contain --hash=sha256 entries");
}

function main() {
  if (!existsSync(IN_FILE)) throw new Error(`Missing ${IN_FILE}`);
  if (!existsSync(OUT_FILE)) throw new Error(`Missing ${OUT_FILE}`);

  const committed = readFileSync(OUT_FILE, "utf8");
  assertHashedLockfile(committed);

  const venvDir = mkdtempSync(path.join(tmpdir(), "pip-tools-check-"));
  let generated;
  try {
    ensureVenv(venvDir);
    const tempOut = path.join(venvDir, "requirements.txt");
    pipCompile(venvDir, tempOut);
    generated = readFileSync(tempOut, "utf8");
  } finally {
    rmSync(venvDir, { recursive: true, force: true });
  }

  if (normalize(committed) !== normalize(generated)) {
    writeFileSync("tmp/requirements-generated-diff.txt", `--- committed\n+++ generated\n${committed}\n---\n${generated}`);
    throw new Error(
      `${OUT_FILE} is out of sync with ${IN_FILE}. Regenerate with: npm run generate:worker-python-lock`,
    );
  }

  console.log(`${OUT_FILE} is in sync with ${IN_FILE}`);
}

main();
