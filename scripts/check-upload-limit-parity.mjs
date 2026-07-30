import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const uploadLimitSourcePath = path.join(projectRoot, "src", "lib", "upload-limits.ts");
const dockerfilePath = path.join(projectRoot, "Dockerfile");
const trackedNames = new Set(["MAX_UPLOAD_MB", "NEXT_PUBLIC_MAX_UPLOAD_MB"]);

export function readUploadLimitCeiling(source = readFileSync(uploadLimitSourcePath, "utf8")) {
  const match = source.match(/export const MAX_UPLOAD_MB_CEILING\s*=\s*(\d+)\s*;/);
  if (!match) throw new Error("Could not read MAX_UPLOAD_MB_CEILING from src/lib/upload-limits.ts.");
  return Number(match[1]);
}

export function loadLocalUploadLimitEnv(env = process.env, filePath = path.join(projectRoot, ".env.local")) {
  if (!existsSync(filePath)) return env;

  const resolved = { ...env };
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    if (line.trimStart().startsWith("#")) continue;
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || !trackedNames.has(match[1]) || resolved[match[1]] !== undefined) continue;
    resolved[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }
  return resolved;
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
  console.log("upload-limit parity self-test passed.");
}

function main() {
  if (process.argv.includes("--self-test")) {
    selfTest();
    return;
  }

  const ceiling = readUploadLimitCeiling();
  const result = evaluateUploadLimitParity(loadLocalUploadLimitEnv(), ceiling);
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
