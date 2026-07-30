import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import nextEnv from "@next/env";

const { loadEnvConfig, resetEnv } = nextEnv;

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const uploadLimitSourcePath = path.join(projectRoot, "src", "lib", "upload-limits.ts");

export function readUploadLimitCeiling(source = readFileSync(uploadLimitSourcePath, "utf8")) {
  const match = source.match(/export const MAX_UPLOAD_MB_CEILING\s*=\s*(\d+)\s*;/);
  if (!match) throw new Error("Could not read MAX_UPLOAD_MB_CEILING from src/lib/upload-limits.ts.");
  return Number(match[1]);
}

export function loadProductionUploadLimitEnv(directory = projectRoot) {
  return loadEnvConfig(directory, false, console, true).combinedEnv;
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
  const serverRaw = env.UPLOAD_LIMIT_PARITY_SERVER_MB ?? env.MAX_UPLOAD_MB;
  const server = parseConfiguredLimit(serverRaw, "MAX_UPLOAD_MB", ceiling);
  const client = parseConfiguredLimit(env.NEXT_PUBLIC_MAX_UPLOAD_MB, "NEXT_PUBLIC_MAX_UPLOAD_MB", ceiling);
  const errors = [server.error, client.error].filter(Boolean);

  if (errors.length === 0 && server.value !== client.value) {
    errors.push(
      `MAX_UPLOAD_MB resolves to ${server.value} MB but NEXT_PUBLIC_MAX_UPLOAD_MB resolves to ${client.value} MB. Set both to the same value and rebuild so the browser pre-check matches the server.`,
    );
  }

  return { ok: errors.length === 0, errors, serverValue: server.value, clientValue: client.value };
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
  assert.equal(
    evaluateUploadLimitParity({ UPLOAD_LIMIT_PARITY_SERVER_MB: "50", NEXT_PUBLIC_MAX_UPLOAD_MB: "50" }, 150).ok,
    true,
  );
  assert.match(evaluateUploadLimitParity({ MAX_UPLOAD_MB: "50" }, 150).errors.join(" "), /50 MB.*150 MB/);
  assert.match(evaluateUploadLimitParity({ NEXT_PUBLIC_MAX_UPLOAD_MB: "50" }, 150).errors.join(" "), /150 MB.*50 MB/);
  assert.match(evaluateUploadLimitParity({ MAX_UPLOAD_MB: "151" }, 150).errors.join(" "), /positive integer/);
  assert.match(
    evaluateUploadLimitParity({ NEXT_PUBLIC_MAX_UPLOAD_MB: "not-a-number" }, 150).errors.join(" "),
    /positive integer/,
  );

  const directory = mkdtempSync(path.join(tmpdir(), "upload-limit-env-"));
  const preserved = {
    NODE_ENV: process.env.NODE_ENV,
    MAX_UPLOAD_MB: process.env.MAX_UPLOAD_MB,
    NEXT_PUBLIC_MAX_UPLOAD_MB: process.env.NEXT_PUBLIC_MAX_UPLOAD_MB,
  };
  try {
    delete process.env.MAX_UPLOAD_MB;
    delete process.env.NEXT_PUBLIC_MAX_UPLOAD_MB;
    process.env.NODE_ENV = "production";
    writeFileSync(path.join(directory, ".env"), "MAX_UPLOAD_MB=25\nNEXT_PUBLIC_MAX_UPLOAD_MB=25\n");
    writeFileSync(path.join(directory, ".env.production"), 'MAX_UPLOAD_MB="50"\nNEXT_PUBLIC_MAX_UPLOAD_MB="50"\n');
    const loaded = loadProductionUploadLimitEnv(directory);
    assert.equal(loaded.MAX_UPLOAD_MB, "50");
    assert.equal(loaded.NEXT_PUBLIC_MAX_UPLOAD_MB, "50");
  } finally {
    resetEnv();
    for (const [name, value] of Object.entries(preserved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    rmSync(directory, { recursive: true, force: true });
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
  if (!result.ok) {
    console.error("Upload-limit parity failed:");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Upload-limit parity passed: client and server both resolve to ${result.serverValue} MB.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
