#!/usr/bin/env node
/**
 * check-env-parity — reconcile environment-variable NAMES across the places this
 * repo declares them, without ever reading or printing a single value.
 *
 * Config truth is scattered: the canonical Zod schema in src/lib/env.ts, the CI
 * browser-env checker (scripts/check-ci-env.mjs), GitHub repo secrets, and Railway
 * runtime vars. A name present in one place but missing in another has broken main
 * CI before (e.g. RAG_QUERY_HASH_SECRET). This diffs the name sets and reports gaps.
 *
 * Offline by default (parses env.ts + check-ci-env.mjs only). Live sources are
 * opt-in and names-only:
 *   --gh        run `gh secret list` (names only; values are write-only anyway)
 *   --railway   run `railway variables` (names only) if the CLI is available
 *
 * Never prints a value. Exit 1 only when a hard parity problem is found (an
 * expected secret is absent from a queried live source), else 0.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// Vars that MUST be supplied as deployment/CI secrets (never committed). Each is
// asserted to exist in the canonical name set below, so this list cannot silently
// drift from the schema.
export const EXPECTED_GITHUB_SECRETS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "RAG_QUERY_HASH_SECRET",
  "HEALTH_DEEP_PROBE_SECRET",
  "E2E_USER_EMAIL",
  "E2E_USER_PASSWORD",
];

export const EXPECTED_RAILWAY_SECRETS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "RAG_QUERY_HASH_SECRET",
  "HEALTH_DEEP_PROBE_SECRET",
];

/** Zod schema keys from env.ts: lines shaped like `  NAME: z.…`. */
export function parseEnvSchemaNames(envTsText) {
  return [...envTsText.matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*:\s*z\./gm)].map((m) => m[1]);
}

/** UPPER_SNAKE names referenced in check-ci-env.mjs (quoted literals + process.env.X). */
export function parseCiEnvNames(ciEnvText) {
  const names = new Set();
  for (const m of ciEnvText.matchAll(/"([A-Z][A-Z0-9_]*)"/g)) names.add(m[1]);
  for (const m of ciEnvText.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) names.add(m[1]);
  return [...names];
}

/** Pure diff of live secret names against expectations + the known-name universe. */
export function computeParity({ canonical, liveNames, expectedSecrets }) {
  const canon = new Set(canonical);
  const live = new Set(liveNames);
  return {
    missingSecrets: expectedSecrets.filter((name) => !live.has(name)),
    unknownLive: [...live].filter((name) => !canon.has(name)),
  };
}

/** Extract Railway variable names from the CLI's JSON object without exposing values. */
export function parseRailwayVariableNames(raw) {
  const parsed = JSON.parse(raw);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("Railway variable JSON must be an object");
  }
  return Object.keys(parsed);
}

function ghSecretNames() {
  const raw = execFileSync("gh", ["secret", "list", "--json", "name"], { encoding: "utf8" });
  return JSON.parse(raw).map((s) => s.name);
}

function railwayVarNames() {
  const raw = execFileSync("railway", ["variable", "list", "--json"], { encoding: "utf8" });
  return parseRailwayVariableNames(raw);
}

function main() {
  const useGh = process.argv.includes("--gh");
  const useRailway = process.argv.includes("--railway");

  const envTs = readFileSync(path.join(root, "src/lib/env.ts"), "utf8");
  const ciEnv = readFileSync(path.join(root, "scripts/check-ci-env.mjs"), "utf8");
  const canonical = new Set([...parseEnvSchemaNames(envTs), ...parseCiEnvNames(ciEnv)]);

  const problems = [];

  // Self-consistency: every expected secret must be a name the app/CI actually knows.
  const expectedSecrets = new Set([...EXPECTED_GITHUB_SECRETS, ...EXPECTED_RAILWAY_SECRETS]);
  const unknownExpected = [...expectedSecrets].filter((name) => !canonical.has(name));
  if (unknownExpected.length > 0) {
    problems.push(
      `Expected-secret names not found in env.ts/check-ci-env (typo or drift): ${unknownExpected.join(", ")}`,
    );
  }

  console.log(`Known env names: ${canonical.size} (env.ts schema + check-ci-env).`);
  console.log(`Expected GitHub secrets: ${EXPECTED_GITHUB_SECRETS.join(", ")}`);
  console.log(`Expected Railway secrets: ${EXPECTED_RAILWAY_SECRETS.join(", ")}`);

  for (const [flag, enabled, label, getter, sourceExpectedSecrets] of [
    ["--gh", useGh, "GitHub secrets", ghSecretNames, EXPECTED_GITHUB_SECRETS],
    ["--railway", useRailway, "Railway variables", railwayVarNames, EXPECTED_RAILWAY_SECRETS],
  ]) {
    if (!enabled) {
      console.log(`(${label}: skipped — pass ${flag} to check; names only, no values)`);
      continue;
    }
    let liveNames;
    try {
      liveNames = getter();
    } catch (error) {
      problems.push(`${label}: could not query (${error.message.split("\n")[0]})`);
      continue;
    }
    const { missingSecrets, unknownLive } = computeParity({
      canonical: [...canonical],
      liveNames,
      expectedSecrets: sourceExpectedSecrets,
    });
    console.log(`\n${label}: ${liveNames.length} names.`);
    if (missingSecrets.length > 0) problems.push(`${label}: missing expected secret(s): ${missingSecrets.join(", ")}`);
    if (unknownLive.length > 0) {
      console.log(`  ⚠ present but not in env.ts (possible stale/typo): ${unknownLive.join(", ")}`);
    }
  }

  if (problems.length > 0) {
    console.error("\nEnv parity problems:");
    for (const p of problems) console.error(`- ${p}`);
    process.exit(1);
  }
  console.log("\nEnv parity OK (names only; no values were read).");
}

const invokedDirectly = process.argv[1]?.endsWith("check-env-parity.mjs");
if (invokedDirectly) main();
