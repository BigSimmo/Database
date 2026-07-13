#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateOfflineContractTests } from "./rag-offline-contract.mjs";

const goldenPath = "scripts/fixtures/rag-retrieval-golden.json";
const cases = JSON.parse(readFileSync(goldenPath, "utf8"));
const failures = [];

function fail(message) {
  failures.push(message);
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateTerm(term, caseId, fieldName) {
  if (Array.isArray(term)) {
    if (term.length === 0 || !term.every(hasText)) {
      fail(`${caseId}: ${fieldName} contains an empty alternative term group.`);
    }
    return;
  }
  if (!hasText(term)) fail(`${caseId}: ${fieldName} contains an empty term.`);
}

function validateGoldenCases() {
  if (!Array.isArray(cases) || cases.length < 10) {
    fail(`${goldenPath} must contain the offline retrieval contract cases.`);
    return;
  }

  const ids = new Set();
  for (const item of cases) {
    if (!hasText(item.id)) fail("Golden retrieval case is missing id.");
    if (ids.has(item.id)) fail(`${item.id}: duplicate golden retrieval case id.`);
    ids.add(item.id);

    if (!hasText(item.query)) fail(`${item.id}: query is required.`);
    if (!hasText(item.expectedQueryClass)) fail(`${item.id}: expectedQueryClass is required.`);
    if (!Number.isInteger(item.topK) || item.topK < 1 || item.topK > 50) {
      fail(`${item.id}: topK must be an integer between 1 and 50.`);
    }
    if (!Array.isArray(item.expectedDocumentSubstrings)) {
      fail(`${item.id}: expectedDocumentSubstrings must be an array.`);
    } else {
      for (const term of item.expectedDocumentSubstrings) validateTerm(term, item.id, "expectedDocumentSubstrings");
    }
    if (!Array.isArray(item.expectedContentTerms) || item.expectedContentTerms.length === 0) {
      fail(`${item.id}: expectedContentTerms must include at least one required term.`);
    } else {
      for (const term of item.expectedContentTerms) validateTerm(term, item.id, "expectedContentTerms");
    }
    if (typeof item.expectTableEvidence !== "boolean") {
      fail(`${item.id}: expectTableEvidence must be boolean.`);
    }
  }
}

validateGoldenCases();

if (failures.length > 0) {
  console.error("Offline RAG preflight failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Offline RAG fixture schema passed (${cases.length} golden retrieval cases).`);

const contractTestsPath = "scripts/fixtures/rag-offline-contract-tests.json";
const contractTests = JSON.parse(readFileSync(contractTestsPath, "utf8"));
const contractTestFailures = validateOfflineContractTests(contractTests);
if (contractTestFailures.length > 0) {
  console.error(`${contractTestsPath} failed the offline safety contract:`);
  for (const failure of contractTestFailures) console.error(`- ${failure}`);
  process.exit(1);
}
const vitestPath = resolve("node_modules/vitest/vitest.mjs");
const offlineEnv = { ...process.env };
for (const key of [
  "RAG_PROVIDER_MODE",
  "OPENAI_API_KEY",
  "OPENAI_ORG_ID",
  "OPENAI_PROJECT_ID",
  "OPENAI_BASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
]) {
  delete offlineEnv[key];
}
const result = spawnSync(process.execPath, [vitestPath, "run", ...contractTests, "--reporter=dot"], {
  env: offlineEnv,
  stdio: "inherit",
});

if (result.error) {
  console.error(`Offline RAG contract tests could not start: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status ?? 1);

console.log("Offline RAG production contract tests passed.");
