#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { validateOfflineContractTests } from "./rag-offline-contract.mjs";

const goldenPath = "scripts/fixtures/rag-retrieval-golden.json";
const cases = JSON.parse(readFileSync(goldenPath, "utf8"));
const failures = [];
const fail = (message) => failures.push(message);
const hasText = (value) => typeof value === "string" && value.trim().length > 0;

function validateTerm(term, caseId, fieldName) {
  if (Array.isArray(term)) {
    if (term.length === 0 || !term.every(hasText))
      fail(`${caseId}: ${fieldName} contains an empty alternative term group.`);
    return;
  }
  if (!hasText(term)) fail(`${caseId}: ${fieldName} contains an empty term.`);
}

if (!Array.isArray(cases) || cases.length < 10) {
  fail(`${goldenPath} must contain the offline retrieval contract cases.`);
} else {
  const ids = new Set();
  for (const item of cases) {
    if (!hasText(item.id)) fail("Golden retrieval case is missing id.");
    if (ids.has(item.id)) fail(`${item.id}: duplicate golden retrieval case id.`);
    ids.add(item.id);
    if (!hasText(item.query)) fail(`${item.id}: query is required.`);
    if (!hasText(item.expectedQueryClass)) fail(`${item.id}: expectedQueryClass is required.`);
    if (!Number.isInteger(item.topK) || item.topK < 1 || item.topK > 50) fail(`${item.id}: topK must be 1-50.`);
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
    if (typeof item.expectTableEvidence !== "boolean") fail(`${item.id}: expectTableEvidence must be boolean.`);
  }
}

const contractTestsPath = "scripts/fixtures/rag-offline-contract-tests.json";
const contractTests = JSON.parse(readFileSync(contractTestsPath, "utf8"));
failures.push(...validateOfflineContractTests(contractTests));

if (failures.length > 0) {
  console.error("Offline RAG fixture and manifest validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(
  `Offline RAG fixture and manifest validation passed (${cases.length} golden cases, ${contractTests.length} suites).`,
);
