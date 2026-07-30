import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import nextEnv from "@next/env";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const uploadLimitSourcePath = path.join(projectRoot, "src", "lib", "upload-limits.ts");
const dockerfilePath = path.join(projectRoot, "Dockerfile");
const { loadEnvConfig, resetEnv } = nextEnv;

export function readUploadLimitCeiling(source = readFileSync(uploadLimitSourcePath, "utf8")) {
  const match = source.match(/export const MAX_UPLOAD_MB_CEILING\s*=\s*(\d+)\s*;/);
  if (!match) throw new Error("Could not read MAX_UPLOAD_MB_CEILING from src/lib/upload-limits.ts.");
  return Number(match[1]);
}

export function loadProductionUploadLimitEnv(projectDir = projectRoot) {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    return loadEnvConfig(projectDir, false, console, true).combinedEnv;
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
}

function parseConfiguredLimit(rawValue, name, ceiling) {
  const normalized = String(rawValue ?? "").trim();
  if (!normalized) return { value: ceiling };
  if (!/^\d+$/.test(normalized)) return { error: `${name} must be a positive integer no greater than ${ceiling}.` };

  const value = Number(normalized);
  if (!Number.isSafeInteger(value) || value < 1 || value > ceiling) {
    return { error: `${name} must be a positive integer no greater than ${ceiling}.` };
  }
  return { value };
}

export function evaluateUploadLimitParity(env, ceiling) {
  const server = parseConfiguredLimit(env.MAX_UPLOAD_MB, "MAX_UPLOAD_MB", ceiling);
  const client = parseConfiguredLimit(env.NEXT_PUBLIC_MAX_UPLOAD_MB, "NEXT_PUBLIC_MAX_UPLOAD_MB", ceiling);
  const errors = [server.error, client.error].filter(Boolean);

  if (errors.length === 0 && server.value !== client.value) {
    errors.push(
      `MAX_UPLOAD_MB resolves to ${server.value} MB but NEXT_PUBLIC_MAX_UPLOAD_MB resolves to ${client.value} MB. Set both to the same value and rebuild so the browser pre-check matches the server.`,
    );
  }

  return { ok: errors.length === 0, errors, serverValue: server.value, clientValue: client.value };
}

export function evaluateDockerUploadLimitContract(source = readFileSync(dockerfilePath, "utf8")) {
  const requiredLines = [
    "ARG MAX_UPLOAD_MB=150",
    "ARG NEXT_PUBLIC_MAX_UPLOAD_MB=",
    "ENV MAX_UPLOAD_MB=${MAX_UPLOAD_MB}",
    "ENV NEXT_PUBLIC_MAX_UPLOAD_MB=${NEXT_PUBLIC_MAX_UPLOAD_MB}",
  ];
  const sourceLines = source.split(/\r?\n/);
  const missing = requiredLines.filter((line) => !sourceLines.includes(line));
  return missing.length === 0 ? null : `Dockerfile cannot enforce upload-limit parity; missing: ${missing.join(", ")}.`;
}

function selfTest() {
  assert.equal(readUploadLimitCeiling("export const MAX_UPLOAD_MB_CEILING = 150;"), 150);
  assert.deepEqual(evaluateUploadLimitParity({}, 150), {
    ok: true,
    errors: [],
    serverValue: 150,
    clientValue: 150,
  });
  assert.equal(evaluateUploadLimitParity({ MAX_UPLOAD_MB: "50", NEXT_PUBLIC_MAX_UPLOAD_MB: "50" }, 150).ok, true);
  assert.match(evaluateUploadLimitParity({ MAX_UPLOAD_MB: "50" }, 150).errors.join(" "), /50 MB.*150 MB/);
  assert.match(evaluateUploadLimitParity({ NEXT_PUBLIC_MAX_UPLOAD_MB: "50" }, 150).errors.join(" "), /150 MB.*50 MB/);
  assert.match(evaluateUploadLimitParity({ MAX_UPLOAD_MB: "151" }, 150).errors.join(" "), /positive integer/);
  assert.match(
    evaluateUploadLimitParity({ NEXT_PUBLIC_MAX_UPLOAD_MB: "not-a-number" }, 150).errors.join(" "),
    /positive integer/,
  );
  assert.equal(
    evaluateDockerUploadLimitContract(
      [
        "ARG MAX_UPLOAD_MB=150",
        "ARG NEXT_PUBLIC_MAX_UPLOAD_MB=",
        "ENV MAX_UPLOAD_MB=${MAX_UPLOAD_MB}",
        "ENV NEXT_PUBLIC_MAX_UPLOAD_MB=${NEXT_PUBLIC_MAX_UPLOAD_MB}",
      ].join("\n"),
    ),
    null,
  );
  assert.match(evaluateDockerUploadLimitContract("ARG NEXT_PUBLIC_MAX_UPLOAD_MB=\n"), /ARG MAX_UPLOAD_MB/);

  const envDir = mkdtempSync(path.join(os.tmpdir(), "upload-limit-parity-"));
  const previousEnv = {
    MAX_UPLOAD_MB: process.env.MAX_UPLOAD_MB,
    NEXT_PUBLIC_MAX_UPLOAD_MB: process.env.NEXT_PUBLIC_MAX_UPLOAD_MB,
    NODE_ENV: process.env.NODE_ENV,
  };
  try {
    delete process.env.MAX_UPLOAD_MB;
    delete process.env.NEXT_PUBLIC_MAX_UPLOAD_MB;
    writeFileSync(path.join(envDir, ".env"), "MAX_UPLOAD_MB=10\nNEXT_PUBLIC_MAX_UPLOAD_MB=10\n");
    writeFileSync(path.join(envDir, ".env.production"), "MAX_UPLOAD_MB=20\nNEXT_PUBLIC_MAX_UPLOAD_MB=20\n");
    writeFileSync(path.join(envDir, ".env.local"), "MAX_UPLOAD_MB=30\nNEXT_PUBLIC_MAX_UPLOAD_MB=30\n");
    writeFileSync(path.join(envDir, ".env.production.local"), "MAX_UPLOAD_MB=40\nNEXT_PUBLIC_MAX_UPLOAD_MB=40\n");
    const loaded = loadProductionUploadLimitEnv(envDir);
    assert.equal(loaded.MAX_UPLOAD_MB, "40");
    assert.equal(loaded.NEXT_PUBLIC_MAX_UPLOAD_MB, "40");
  } finally {
    resetEnv();
    for (const [name, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    rmSync(envDir, { recursive: true, force: true });
  }
  console.log("upload-limit parity self-test passed.");
}

function main() {
  if (process.argv.includes("--self-test")) {
    selfTest();
    return;
  }

  const ceiling = readUploadLimitCeiling();
  const result = evaluateUploadLimitParity(loadProductionUploadLimitEnv(), ceiling);
  const dockerProblem = evaluateDockerUploadLimitContract();
  if (!result.ok || dockerProblem) {
    console.error("Upload-limit parity failed:");
    for (const error of result.errors) console.error(`- ${error}`);
    if (dockerProblem) console.error(`- ${dockerProblem}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Upload-limit parity passed: client and server both resolve to ${result.serverValue} MB.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
