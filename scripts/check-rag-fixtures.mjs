#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { validateOfflineContractTests } from "./rag-offline-contract.mjs";

const goldenPath = "scripts/fixtures/rag-retrieval-golden.json";
const cases = JSON.parse(readFileSync(goldenPath, "utf8"));
const failures = [];
const fail = (message) => failures.push(message);
const hasText = (value) => typeof value === "string" && value.trim().length > 0;

function hasExactKeys(value, expected, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${path} must be an object.`);
    return false;
  }
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  const unknown = actual.filter((key) => !required.includes(key));
  const missing = required.filter((key) => !actual.includes(key));
  if (unknown.length > 0 || missing.length > 0) {
    fail(
      `${path} must contain exactly [${required.join(", ")}]` +
        (unknown.length > 0 ? `; unknown [${unknown.join(", ")}]` : "") +
        (missing.length > 0 ? `; missing [${missing.join(", ")}]` : ""),
    );
    return false;
  }
  return true;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(value) {
  return `sha256:${createHash("sha256").update(canonicalJson(value), "utf8").digest("hex")}`;
}

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

const programmePath = "src/data/rag-programme-failures.v1.json";
const programme = JSON.parse(readFileSync(programmePath, "utf8"));
const protectedProgrammeCaseIds = [
  "direct-evidence-generic-refusal",
  "trusted-document-admission-access",
  "broad-multi-intent-partial",
  "uploaded-australian-augmentation",
  "site-specifier-direct",
  "site-differential-direct",
  "site-medication-direct",
  "site-cross-domain-coverage",
  "uploaded-guideline-primary",
  "site-product-primary",
  "site-changed-deleted-stale",
  "uploaded-public-conflict",
  "site-public-read-parity",
  "site-admin-publication-only",
  "source-role-mismatch",
  "site-sync-unavailable",
  "australian-augmentation-unavailable",
  "healthdirect-exclusion",
  "link-only-etg-amh",
  "blocked-reference-upload",
  "narrow-fact-concise",
  "broad-supported-sections",
  "broad-management-strong-route",
  "eight-section-completion",
  "anaphoric-follow-up",
  "incremental-reconciliation",
];
hasExactKeys(programme, ["schemaVersion", "caseSetFingerprint", "cases"], programmePath);
if (programme?.schemaVersion !== 1 || !Array.isArray(programme?.cases)) {
  fail(`${programmePath} must use schemaVersion 1 and contain cases.`);
} else {
  const programmeIds = new Set();
  for (const [index, item] of programme.cases.entries()) {
    const casePath = `${programmePath}.cases[${index}]`;
    hasExactKeys(item, ["id", "latencyTargetMs", "privacyReview", "expectedDocuments", "expectation"], casePath);
    if (!hasText(item?.id)) fail("Programme fixture case is missing id.");
    if (programmeIds.has(item?.id)) fail(`${item.id}: duplicate programme fixture case id.`);
    programmeIds.add(item?.id);
    hasExactKeys(item?.privacyReview, ["status", "reviewedOn", "reviewerRole"], `${casePath}.privacyReview`);
    if (
      item?.privacyReview?.status !== "approved_deidentified" ||
      item?.privacyReview?.reviewerRole !== "clinical_governance" ||
      !hasText(item?.privacyReview?.reviewedOn)
    ) {
      fail(`${item?.id ?? "unknown"}: approved de-identification review metadata is required.`);
    }
    if (!Number.isInteger(item?.latencyTargetMs) || item.latencyTargetMs <= 0) {
      fail(`${item?.id ?? "unknown"}: latencyTargetMs must be a positive integer.`);
    }
    if (!Array.isArray(item?.expectedDocuments) || !item.expectedDocuments.every(hasText)) {
      fail(`${item?.id ?? "unknown"}: expectedDocuments must be a string array.`);
    }
    const expectation = item?.expectation;
    hasExactKeys(
      expectation,
      [
        "expectedCorpusScopes",
        "expectedSourceRoles",
        "expectedSiteDomains",
        "expectedPublicSiteContentState",
        "expectedSubquestionPurposes",
        "minimumDirectSubquestions",
        "allowedAnswerShapes",
        "requireSupportedPart",
        "requireExactGap",
        "expectedConflict",
        "forbiddenFallbackReasons",
        "requiredFacts",
        "forbiddenPatterns",
        "incrementalEligibility",
      ],
      `${casePath}.expectation`,
    );
    for (const field of [
      "expectedCorpusScopes",
      "expectedSourceRoles",
      "expectedSiteDomains",
      "expectedSubquestionPurposes",
      "allowedAnswerShapes",
      "forbiddenFallbackReasons",
      "requiredFacts",
      "forbiddenPatterns",
    ]) {
      if (!Array.isArray(expectation?.[field])) fail(`${item?.id ?? "unknown"}: ${field} must be an array.`);
    }
    if (!Number.isInteger(expectation?.minimumDirectSubquestions) || expectation.minimumDirectSubquestions < 0) {
      fail(`${item?.id ?? "unknown"}: minimumDirectSubquestions must be a non-negative integer.`);
    }
    if (typeof expectation?.requireSupportedPart !== "boolean" || typeof expectation?.requireExactGap !== "boolean") {
      fail(`${item?.id ?? "unknown"}: support and exact-gap requirements must be boolean.`);
    }
    if (!hasText(expectation?.expectedPublicSiteContentState)) {
      fail(`${item?.id ?? "unknown"}: expectedPublicSiteContentState is required.`);
    }
    if (!hasText(expectation?.incrementalEligibility)) {
      fail(`${item?.id ?? "unknown"}: incrementalEligibility is required.`);
    }
    if (expectation?.expectedConflict !== null) {
      hasExactKeys(
        expectation?.expectedConflict,
        ["localDocumentId", "australianDocumentId", "requireVisibleFields"],
        `${casePath}.expectation.expectedConflict`,
      );
      if (
        !hasText(expectation?.expectedConflict?.localDocumentId) ||
        !hasText(expectation?.expectedConflict?.australianDocumentId) ||
        !Array.isArray(expectation?.expectedConflict?.requireVisibleFields)
      ) {
        fail(`${item?.id ?? "unknown"}: expectedConflict must bind both documents and visible fields.`);
      }
    }
  }
  for (const id of protectedProgrammeCaseIds) {
    if (!programmeIds.has(id)) fail(`${programmePath} is missing protected case ${id}.`);
  }
  for (const id of programmeIds) {
    if (!protectedProgrammeCaseIds.includes(id)) fail(`${programmePath} contains unexpected case ${id}.`);
  }
  if (programme.cases.length !== protectedProgrammeCaseIds.length) {
    fail(`${programmePath} must contain exactly ${protectedProgrammeCaseIds.length} canonical cases.`);
  }
  const sortedCases = [...programme.cases].sort((left, right) => String(left.id).localeCompare(String(right.id)));
  const actualFingerprint = fingerprint({ schemaVersion: programme.schemaVersion, cases: sortedCases });
  if (programme.caseSetFingerprint !== actualFingerprint) {
    fail(
      `${programmePath} fingerprint mismatch: expected ${programme.caseSetFingerprint}, received ${actualFingerprint}.`,
    );
  }
}

if (failures.length > 0) {
  console.error("Offline RAG fixture and manifest validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(
  `Offline RAG fixture and manifest validation passed (${cases.length} golden cases, ${contractTests.length} suites, ${programme.cases.length} programme cases).`,
);
