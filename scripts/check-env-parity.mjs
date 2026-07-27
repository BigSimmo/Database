#!/usr/bin/env node
/**
 * check-env-parity — reconcile environment-variable NAMES across the places this
 * repository declares them. Values are never emitted or persisted.
 *
 * Offline by default:
 *   npm run check:env-parity
 *
 * Explicit provider-backed reads:
 *   npm run check:env-parity -- --gh
 *   npm run check:env-parity -- --railway
 *
 * GitHub reads are pinned to BigSimmo/Database. Railway reads are pinned to the
 * live Database project, production environment, and named app/worker services.
 * Railway's JSON format contains raw values, so the response is captured only
 * in memory and immediately reduced to Object.keys().
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const GITHUB_REPOSITORY = "BigSimmo/Database";
const RAILWAY_TARGET = {
  project: "5deaad0b-675a-4c13-978e-5ca2b5b877f9",
  environment: "6aa16f7b-d3e8-4aa2-9854-ee9ead9fcbd4",
};
const PROVIDER_QUERY_TIMEOUT_MS = 30_000;

export const EXPECTED_GITHUB_SECRETS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "RAG_QUERY_HASH_SECRET",
  "HEALTH_DEEP_PROBE_SECRET",
  "E2E_USER_EMAIL",
  "E2E_USER_PASSWORD",
];

export const EXPECTED_GITHUB_VARIABLES = ["PROD_HEALTH_URL"];

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

const EXPECTED_ENV_EXAMPLE_NAMES = [
  ...new Set([
    ...EXPECTED_RAILWAY_APP_VARIABLES,
    ...EXPECTED_RAILWAY_WORKER_VARIABLES,
    "SUPABASE_STAGING_PROJECT_REF",
    "SUPABASE_STAGING_PROJECT_NAME",
    "RAG_PROVIDER_MODE",
  ]),
];

/** Zod schema keys from env.ts, including declarations where `.enum` begins on the next line. */
export function parseEnvSchemaNames(envTsText) {
  return [...envTsText.matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*:\s*z\s*\./gm)].map((match) => match[1]);
}

/** UPPER_SNAKE names referenced in check-ci-env.mjs (quoted literals + process.env.X). */
export function parseCiEnvNames(ciEnvText) {
  const names = new Set();
  for (const match of ciEnvText.matchAll(/"([A-Z][A-Z0-9_]*)"/g)) names.add(match[1]);
  for (const match of ciEnvText.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) names.add(match[1]);
  return [...names];
}

/** Active or commented KEY= declarations from the committed example file. */
export function parseEnvExampleNames(envExampleText) {
  return [...envExampleText.matchAll(/^\s*#?\s*([A-Z][A-Z0-9_]*)\s*=/gm)].map((match) => match[1]);
}

/** Pure diff of live config names against expectations + the known-name universe. */
export function computeParity({ canonical, liveNames, expectedSecrets }) {
  const canon = new Set(canonical);
  const live = new Set(liveNames);
  return {
    missingSecrets: expectedSecrets.filter((name) => !live.has(name)),
    unknownLive: [...live].filter((name) => !canon.has(name)),
  };
}

export function githubListArgs(kind) {
  if (kind !== "secret" && kind !== "variable") throw new Error(`Unsupported GitHub config kind: ${kind}`);
  return [kind, "list", "--repo", GITHUB_REPOSITORY, "--json", "name"];
}

export function railwayVariableArgs(service) {
  if (service !== "Database" && service !== "worker") throw new Error(`Unsupported Railway service: ${service}`);
  return [
    "variable",
    "list",
    "--json",
    "--project",
    RAILWAY_TARGET.project,
    "--environment",
    RAILWAY_TARGET.environment,
    "--service",
    service,
  ];
}

/** Extract Railway variable names from the CLI JSON object without retaining values. */
export function parseRailwayVariableNames(raw) {
  const parsed = JSON.parse(raw);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("Railway variable JSON must be an object");
  }
  return Object.keys(parsed);
}

function githubNames(kind) {
  const raw = execFileSync("gh", githubListArgs(kind), {
    encoding: "utf8",
    timeout: PROVIDER_QUERY_TIMEOUT_MS,
    windowsHide: true,
  });
  return JSON.parse(raw).map((entry) => entry.name);
}

function railwayNames(service) {
  const raw = execFileSync("railway", railwayVariableArgs(service), {
    encoding: "utf8",
    timeout: PROVIDER_QUERY_TIMEOUT_MS,
    windowsHide: true,
  });
  return parseRailwayVariableNames(raw);
}

function reportSource({ enabled, flag, label, getter, expected, canonical, problems }) {
  if (!enabled) {
    console.log(`(${label}: skipped — pass ${flag} to check; names only in output)`);
    return;
  }

  let liveNames;
  try {
    liveNames = getter();
  } catch (error) {
    problems.push(`${label}: could not query (${error.message.split("\n")[0]})`);
    return;
  }

  const { missingSecrets, unknownLive } = computeParity({ canonical, liveNames, expectedSecrets: expected });
  console.log(`\n${label}: ${liveNames.length} names.`);
  if (missingSecrets.length > 0) problems.push(`${label}: missing expected name(s): ${missingSecrets.join(", ")}`);
  if (unknownLive.length > 0) {
    console.log(
      `  info: ${unknownLive.length} provider/workflow-managed name(s) are outside this checked contract: ${unknownLive.join(", ")}`,
    );
  }
}

function main() {
  const useGh = process.argv.includes("--gh");
  const useRailway = process.argv.includes("--railway");

  const envTs = readFileSync(path.join(root, "src/lib/env.ts"), "utf8");
  const ciEnv = readFileSync(path.join(root, "scripts/check-ci-env.mjs"), "utf8");
  const envExample = readFileSync(path.join(root, ".env.example"), "utf8");
  const envExampleNames = parseEnvExampleNames(envExample);
  const canonical = [
    ...new Set([
      ...parseEnvSchemaNames(envTs),
      ...parseCiEnvNames(ciEnv),
      ...envExampleNames,
      ...EXPECTED_GITHUB_VARIABLES,
    ]),
  ];
  const problems = [];

  const exampleSet = new Set(envExampleNames);
  const missingFromExample = EXPECTED_ENV_EXAMPLE_NAMES.filter((name) => !exampleSet.has(name));
  if (missingFromExample.length > 0) {
    problems.push(`Required config names missing from .env.example: ${missingFromExample.join(", ")}`);
  }

  const expectedNames = new Set([
    ...EXPECTED_GITHUB_SECRETS,
    ...EXPECTED_GITHUB_VARIABLES,
    ...EXPECTED_RAILWAY_APP_VARIABLES,
    ...EXPECTED_RAILWAY_WORKER_VARIABLES,
  ]);
  const unknownExpected = [...expectedNames].filter((name) => !canonical.includes(name));
  if (unknownExpected.length > 0) {
    problems.push(`Expected config names not found in the repository contract: ${unknownExpected.join(", ")}`);
  }

  console.log(`Known config names: ${canonical.length} (env.ts + CI/ops config + .env.example).`);
  console.log(
    `Required .env.example names: ${EXPECTED_ENV_EXAMPLE_NAMES.length - missingFromExample.length}/${EXPECTED_ENV_EXAMPLE_NAMES.length}.`,
  );
  console.log(`Expected GitHub secrets: ${EXPECTED_GITHUB_SECRETS.join(", ")}`);
  console.log(`Expected GitHub variables: ${EXPECTED_GITHUB_VARIABLES.join(", ")}`);
  console.log(`Expected Railway app variables: ${EXPECTED_RAILWAY_APP_VARIABLES.join(", ")}`);
  console.log(`Expected Railway worker variables: ${EXPECTED_RAILWAY_WORKER_VARIABLES.join(", ")}`);

  reportSource({
    enabled: useGh,
    flag: "--gh",
    label: "GitHub secrets",
    getter: () => githubNames("secret"),
    expected: EXPECTED_GITHUB_SECRETS,
    canonical,
    problems,
  });
  reportSource({
    enabled: useGh,
    flag: "--gh",
    label: "GitHub variables",
    getter: () => githubNames("variable"),
    expected: EXPECTED_GITHUB_VARIABLES,
    canonical,
    problems,
  });
  reportSource({
    enabled: useRailway,
    flag: "--railway",
    label: "Railway Database variables",
    getter: () => railwayNames("Database"),
    expected: EXPECTED_RAILWAY_APP_VARIABLES,
    canonical,
    problems,
  });
  reportSource({
    enabled: useRailway,
    flag: "--railway",
    label: "Railway worker variables",
    getter: () => railwayNames("worker"),
    expected: EXPECTED_RAILWAY_WORKER_VARIABLES,
    canonical,
    problems,
  });

  if (problems.length > 0) {
    console.error("\nEnvironment parity problems:");
    for (const problem of problems) console.error(`- ${problem}`);
    process.exit(1);
  }
  console.log("\nEnvironment parity OK (names only in output; provider values were not emitted or persisted).");
}

const invokedDirectly = process.argv[1]?.endsWith("check-env-parity.mjs");
if (invokedDirectly) main();
