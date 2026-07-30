#!/usr/bin/env node
import { pathToFileURL } from "node:url";

export const DEFAULT_MAX_UPLOAD_MB = 150;

function parseUploadLimit(name, rawValue, fallback, errors) {
  const value = rawValue?.trim();
  if (!value) return fallback;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > DEFAULT_MAX_UPLOAD_MB) {
    errors.push(`${name} must be an integer from 1 to ${DEFAULT_MAX_UPLOAD_MB}.`);
    return fallback;
  }
  return parsed;
}

/** Pure policy used by the standalone check and focused tests. */
export function inspectUploadLimitConfiguration(environment = {}) {
  const errors = [];
  const serverMb = parseUploadLimit("MAX_UPLOAD_MB", environment.MAX_UPLOAD_MB, DEFAULT_MAX_UPLOAD_MB, errors);
  const clientMb = parseUploadLimit(
    "NEXT_PUBLIC_MAX_UPLOAD_MB",
    environment.NEXT_PUBLIC_MAX_UPLOAD_MB,
    DEFAULT_MAX_UPLOAD_MB,
    errors,
  );

  if (serverMb !== clientMb) {
    errors.push(
      `MAX_UPLOAD_MB (${serverMb}) and NEXT_PUBLIC_MAX_UPLOAD_MB (${clientMb}) must match before building or releasing.`,
    );
  }

  return { ok: errors.length === 0, serverMb, clientMb, errors };
}

function main() {
  const result = inspectUploadLimitConfiguration(process.env);
  if (!result.ok) {
    console.error("Upload limit configuration is inconsistent:");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Upload limit configuration OK: client and server are ${result.serverMb} MB.`);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
