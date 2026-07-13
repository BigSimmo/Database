import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(new URL("../.github/workflows/eval-canary.yml", import.meta.url), "utf8");

describe("eval canary workflow input", () => {
  it("validates the dispatch limit outside shell source and passes it as one quoted argument", () => {
    expect(workflow).toContain("ANSWER_CASE_LIMIT: ${{ github.event.inputs.answer_case_limit || '8' }}");
    expect(workflow).toContain('[[ ! "$ANSWER_CASE_LIMIT" =~ ^[0-9]+$ ]]');
    expect(workflow).toContain("ANSWER_CASE_LIMIT < 1 || ANSWER_CASE_LIMIT > 100");
    expect(workflow).toContain('--limit "$ANSWER_CASE_LIMIT"');
    expect(workflow).not.toMatch(/run:.*github\.event\.inputs\.answer_case_limit/);
  });

  it("distinguishes provider outages from retrieval regressions in the failure issue", () => {
    expect(workflow).toContain('title: "Eval canary failure: nightly evaluation did not complete"');
    expect(workflow).toContain("Resolve provider quota/auth/config failures before rerunning");
    expect(workflow).toContain(
      "Do not bisect or revert code until provider health and the failure class are confirmed",
    );
    expect(workflow).not.toContain("Eval canary regression: nightly golden eval failed");
  });
});
