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
 * Offline by default (parses env.ts, .env.example, and check-ci-env.mjs). Live sources are
 * opt-in and names-only:
 *   --gh        run `gh secret list` (names only; values are write-only anyway)
 *   --railway   inspect the pinned production project/environment and both services
 *   --local     report the current process + local env files as NAME/PRESENT/MISSING
 *
 * Never prints a value. Exit 1 only when a hard parity problem is found (an
 * expected secret is absent from a queried live source), else 0.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const githubRepository = "BigSimmo/Database";
const railwayTarget = {
  project: "5deaad0b-675a-4c13-978e-5ca2b5b877f9",
  environment: "6aa16f7b-d3e8-4aa2-9854-ee9ead9fcbd4",
};

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
  "OPENAI_SAFETY_IDENTIFIER_SECRET",
  "RAG_QUERY_HASH_SECRET",
  "HEALTH_DEEP_PROBE_SECRET",
];

export const EXPECTED_RAILWAY_APP_VARIABLES = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_PROJECT_REF",
  "SUPABASE_PROJECT_NAME",
  ...EXPECTED_RAILWAY_SECRETS,
];

export const EXPECTED_RAILWAY_WORKER_VARIABLES = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_PROJECT_REF",
  "SUPABASE_PROJECT_NAME",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
];

export const EXPECTED_GITHUB_VARIABLES = ["PROD_HEALTH_URL"];

export const LOCAL_PRESENCE_NAMES = [
  ...EXPECTED_RAILWAY_APP_VARIABLES,
  "SUPABASE_STAGING_PROJECT_REF",
  "SUPABASE_STAGING_PROJECT_NAME",
  "RAG_PROVIDER_MODE",
  "E2E_USER_EMAIL",
  "E2E_USER_PASSWORD",
];

// E2E credentials are CI-only and are documented by check-ci-env.mjs itself.
// The committed app/deployment example must cover every other presence key.
export const EXPECTED_ENV_EXAMPLE_NAMES = LOCAL_PRESENCE_NAMES.filter((name) => !name.startsWith("E2E_USER_"));

const localEnvFiles = [".env", ".env.local", ".env.development.local"];

/** Zod schema keys from env.ts, including declarations where `.enum` starts on the next line. */
export function parseEnvSchemaNames(envTsText) {
  return [...envTsText.matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*:\s*z\s*\./gm)].map((m) => m[1]);
}

/** UPPER_SNAKE names referenced in check-ci-env.mjs (quoted literals + process.env.X). */
export function parseCiEnvNames(ciEnvText) {
  const names = new Set();
  for (const m of ciEnvText.matchAll(/"([A-Z][A-Z0-9_]*)"/g)) names.add(m[1]);
  for (const m of ciEnvText.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) names.add(m[1]);
  return [...names];
}

/** Active or commented KEY= declarations from the committed example file. */
export function parseEnvExampleNames(envExampleText) {
  return [...envExampleText.matchAll(/^\s*#?\s*([A-Z][A-Z0-9_]*)\s*=/gm)].map((match) => match[1]);
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

function isConfigured(value) {
  const normalized = String(value ?? "").trim();
  return Boolean(normalized) && !/(?:^your-|replace-with|placeholder|<[^>]+>)/i.test(normalized);
}

/** Convert values to a names-only report. Raw values are never returned. */
export function presenceRows(values, names = LOCAL_PRESENCE_NAMES) {
  return names.map((name) => ({ name, status: isConfigured(values[name]) ? "PRESENT" : "MISSING" }));
}

/** Parse an env file directly into a names-only presence report. */
export function parseEnvFilePresence(text, names = LOCAL_PRESENCE_NAMES) {
  const values = {};
  for (const rawLine of text.split(/\r?\n/)) {
    if (rawLine.trimStart().startsWith("#")) continue;
    const match = rawLine.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || !names.includes(match[1])) continue;
    values[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }
  return presenceRows(values, names);
}

export function railwayVariableArgs(service) {
  return [
    "variable",
    "list",
    "--json",
    "--project",
    railwayTarget.project,
    "--environment",
    railwayTarget.environment,
    "--service",
    service,
  ];
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
  const raw = execFileSync("gh", ["secret", "list", "--repo", githubRepository, "--json", "name"], {
    encoding: "utf8",
  });
  return JSON.parse(raw).map((s) => s.name);
}

function ghVariableNames() {
  const raw = execFileSync("gh", ["variable", "list", "--repo", githubRepository, "--json", "name"], {
    encoding: "utf8",
  });
  return JSON.parse(raw).map((variable) => variable.name);
}

function railwayVarNames(service) {
  // Railway has no names-only CLI format. Capture JSON in memory, immediately
  // reduce it to Object.keys(), and never emit or persist the raw response.
  const raw = execFileSync("railway", railwayVariableArgs(service), { encoding: "utf8" });
  return parseRailwayVariableNames(raw);
}

function printLocalPresence() {
  console.log("\nLocal process environment (names/status only):");
  for (const row of presenceRows(process.env)) console.log(`  ${row.name}\t${row.status}`);

  for (const fileName of localEnvFiles) {
    const filePath = path.join(root, fileName);
    console.log(`\n${fileName} (names/status only):`);
    const rows = existsSync(filePath)
      ? parseEnvFilePresence(readFileSync(filePath, "utf8"))
      : LOCAL_PRESENCE_NAMES.map((name) => ({ name, status: "MISSING" }));
    for (const row of rows) console.log(`  ${row.name}\t${row.status}`);
  }
}

function main() {
  const useGh = process.argv.includes("--gh");
  const useRailway = process.argv.includes("--railway");
  const useLocal = process.argv.includes("--local");

  const envTs = readFileSync(path.join(root, "src/lib/env.ts"), "utf8");
  const envExample = readFileSync(path.join(root, ".env.example"), "utf8");
  const ciEnv = readFileSync(path.join(root, "scripts/check-ci-env.mjs"), "utf8");
  const envExampleConfigNames = parseEnvExampleNames(envExample);
  const canonical = new Set([
    ...parseEnvSchemaNames(envTs),
    ...parseCiEnvNames(ciEnv),
    ...envExampleConfigNames,
    ...EXPECTED_GITHUB_VARIABLES,
  ]);

  const problems = [];

  const envExampleNames = new Set(envExampleConfigNames);
  const missingFromExample = EXPECTED_ENV_EXAMPLE_NAMES.filter((name) => !envExampleNames.has(name));
  if (missingFromExample.length > 0) {
    problems.push(`Required config names missing from .env.example: ${missingFromExample.join(", ")}`);
  }

  // Self-consistency: every expected secret must be a name the app/CI actually knows.
  const expectedSecrets = new Set([...EXPECTED_GITHUB_SECRETS, ...EXPECTED_RAILWAY_SECRETS]);
  const unknownExpected = [...expectedSecrets].filter((name) => !canonical.has(name));
  if (unknownExpected.length > 0) {
    problems.push(
      `Expected-secret names not found in env.ts/check-ci-env (typo or drift): ${unknownExpected.join(", ")}`,
    );
  }

  console.log(`Known config names: ${canonical.size} (env.ts schema + CI/ops config + .env.example).`);
  console.log(
    `Required .env.example names: ${EXPECTED_ENV_EXAMPLE_NAMES.length - missingFromExample.length}/${EXPECTED_ENV_EXAMPLE_NAMES.length}.`,
  );
  console.log(`Expected GitHub secrets: ${EXPECTED_GITHUB_SECRETS.join(", ")}`);
  console.log(`Expected GitHub variables: ${EXPECTED_GITHUB_VARIABLES.join(", ")}`);
  console.log(`Expected Railway secrets: ${EXPECTED_RAILWAY_SECRETS.join(", ")}`);

  for (const [flag, enabled, label, getter, sourceExpectedSecrets] of [
    ["--gh", useGh, "GitHub secrets", ghSecretNames, EXPECTED_GITHUB_SECRETS],
    ["--gh", useGh, "GitHub variables", ghVariableNames, EXPECTED_GITHUB_VARIABLES],
    [
      "--railway",
      useRailway,
      "Railway app variables",
      () => railwayVarNames("Database"),
      EXPECTED_RAILWAY_APP_VARIABLES,
    ],
    [
      "--railway",
      useRailway,
      "Railway worker variables",
      () => railwayVarNames("worker"),
      EXPECTED_RAILWAY_WORKER_VARIABLES,
    ],
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
      console.log(
        `  ⚠ outside the checked app/config contract (may be provider- or workflow-managed): ${unknownLive.join(", ")}`,
      );
    }
  }

  if (useLocal) printLocalPresence();
  else console.log("(Local presence: skipped — pass --local; names/status only)");

  if (problems.length > 0) {
    console.error("\nEnv parity problems:");
    for (const p of problems) console.error(`- ${p}`);
    process.exit(1);
  }
  console.log("\nEnv parity OK (names/status only; no values were emitted or persisted).");
}

const invokedDirectly = process.argv[1]?.endsWith("check-env-parity.mjs");
if (invokedDirectly) main();
