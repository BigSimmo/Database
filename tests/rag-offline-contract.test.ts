import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { requiredOfflineContractTests, validateOfflineContractTests } from "../scripts/rag-offline-contract.mjs";

const requiredSafetySuites = [
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
  "tests/rag-answer-fallback.test.ts",
  "tests/upload-admission.test.ts",
  "tests/privacy-ui.test.ts",
];

describe("offline RAG safety contract", () => {
  it("cannot silently drop a remediation subsystem from the offline runner", () => {
    const suites = JSON.parse(readFileSync("scripts/fixtures/rag-offline-contract-tests.json", "utf8"));

    expect(suites).toEqual(expect.arrayContaining(requiredSafetySuites));
    expect(new Set(suites).size).toBe(suites.length);
    expect(suites).toContain("tests/rag-offline-contract.test.ts");
  });

  it("fails validation when the independent guard or another required suite is removed", () => {
    for (const required of ["tests/rag-offline-contract.test.ts", "tests/rag-claim-support.test.ts"]) {
      const withoutRequired = requiredOfflineContractTests.filter((suite) => suite !== required);
      expect(validateOfflineContractTests(withoutRequired)).toContain(`missing required suite: ${required}`);
    }
  });
});
