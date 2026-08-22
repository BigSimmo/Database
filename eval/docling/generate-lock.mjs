#!/usr/bin/env node
/**
 * generate-lock — pin eval/docling/requirements.txt from eval/docling/requirements.in
 * with pip-tools, imitating scripts/generate-worker-python-lock.mjs.
 *
 * Python 3.11 only: the lab image is Debian bookworm (node:24-bookworm-slim), whose
 * python3 is 3.11, and a hashed lock is only valid for the interpreter that resolved
 * it. This script never reads or writes anything under worker/python/ — the lab keeps
 * its own dependency universe by design (docs/rag-improvement/README.md §B3).
 *
 * Usage: npm run generate:docling-lab-lock   (set PYTHON_BIN to a Python 3.11 if the
 * default `python3` is not 3.11). Network: PyPI plus the CPU-only torch index named
 * in requirements.in — provider-neutral package registries, no OpenAI/Supabase.
 */
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const LAB_DIR = path.dirname(fileURLToPath(import.meta.url));
const IN_FILE = path.join(LAB_DIR, "requirements.in");
const OUT_FILE = path.join(LAB_DIR, "requirements.txt");
const PYTHON = process.env.PYTHON_BIN?.trim() || (process.platform === "win32" ? "python" : "python3");
const PIP_TOOLS_VERSION = "7.6.0";
const REQUIRED_PYTHON = "3.11";
const GENERATE_COMMAND = "npm run generate:docling-lab-lock";

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { encoding: "utf8", stdio: "pipe", ...opts });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(" ")}\n${result.stderr || ""}\n${result.stdout || ""}`);
  }
  return result;
}

function pythonMajorMinor(python) {
  const result = run(python, ["-c", "import sys; print(f'{sys.version_info[0]}.{sys.version_info[1]}')"]);
  return result.stdout.trim();
}

function venvPython(venvDir) {
  return process.platform === "win32"
    ? path.join(venvDir, "Scripts", "python.exe")
    : path.join(venvDir, "bin", "python");
}

function assertLockShape() {
  const lock = readFileSync(OUT_FILE, "utf8");
  if (!lock.includes(`pip-compile`)) throw new Error(`${OUT_FILE}: missing pip-compile provenance header`);
  if (!/==\d/.test(lock)) throw new Error(`${OUT_FILE}: no exact version pins found`);
  if (!lock.includes("--hash=sha256:")) throw new Error(`${OUT_FILE}: no sha256 hashes found`);
}

function main() {
  if (!existsSync(IN_FILE)) throw new Error(`Missing ${IN_FILE}`);
  const actual = pythonMajorMinor(PYTHON);
  if (actual !== REQUIRED_PYTHON) {
    throw new Error(
      `docling lab lock generation requires Python ${REQUIRED_PYTHON}; ${PYTHON} is Python ${actual}. ` +
        `Set PYTHON_BIN to the matching interpreter.`,
    );
  }

  const venvDir = mkdtempSync(path.join(tmpdir(), "docling-lab-pip-tools-"));
  try {
    run(PYTHON, ["-m", "venv", venvDir]);
    const python = venvPython(venvDir);
    run(python, ["-m", "pip", "install", "setuptools", "wheel"]);
    run(python, ["-m", "pip", "install", `pip-tools==${PIP_TOOLS_VERSION}`]);
    // --allow-unsafe pins setuptools/wheel INTO the lock. Without it pip-tools omits
    // them as "unsafe", and the image build's `pip install --require-hashes` then
    // refuses torch's `setuptools>=77.0.3` runtime requirement as an unpinned
    // dependency — the exact failure of docling-lab run 32164356999 (2026-08-18).
    run(
      python,
      ["-m", "piptools", "compile", "--generate-hashes", "--allow-unsafe", "--output-file", OUT_FILE, IN_FILE],
      {
        env: { ...process.env, CUSTOM_COMPILE_COMMAND: GENERATE_COMMAND },
      },
    );
    assertLockShape();
    console.log(`Generated ${OUT_FILE} for Python ${REQUIRED_PYTHON}`);
  } finally {
    rmSync(venvDir, { recursive: true, force: true });
  }
}

main();
