export const requiredOfflineContractTests = Object.freeze([
  "tests/rag-offline-contract.test.ts",
  "tests/rag-offline-answer.test.ts",
  "tests/rag-answer-fallback.test.ts",
  "tests/retrieval-selection.test.ts",
  "tests/citations.test.ts",
  "tests/smart-rag-api.test.ts",
  "tests/deep-memory.test.ts",
  "tests/deep-memory-transaction-sql.test.ts",
  "tests/retrieval-access-scope.test.ts",
  "tests/retrieval-hydration-scope.test.ts",
  "tests/answer-verification.test.ts",
  "tests/rag-routing.test.ts",
  "tests/cross-document-synthesis.test.ts",
  "tests/rag-comparison.test.ts",
  "tests/rag-claim-support.test.ts",
  "tests/answer-render-policy.test.ts",
  "tests/canonical-answer-table.test.ts",
  "tests/privacy.test.ts",
  "tests/private-rag-access.test.ts",
  "tests/upload-admission.test.ts",
  "tests/privacy-ui.test.ts",
]);

export function validateOfflineContractTests(suites) {
  const failures = [];
  if (!Array.isArray(suites) || suites.length === 0) {
    return ["contract suite list must be a non-empty array"];
  }
  if (!suites.every((suite) => typeof suite === "string" && suite.trim().length > 0)) {
    failures.push("contract suite list contains an invalid path");
  }
  if (new Set(suites).size !== suites.length) failures.push("contract suite list contains duplicates");
  for (const required of requiredOfflineContractTests) {
    if (!suites.includes(required)) failures.push(`missing required suite: ${required}`);
  }
  return failures;
}
