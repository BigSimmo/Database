import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(new URL("../.github/workflows/eval-canary.yml", import.meta.url), "utf8");

describe("eval canary workflow input", () => {
  it("runs weekly on Monday morning in Australia/Perth", () => {
    expect(workflow).toContain('- cron: "0 18 * * 0"');
    expect(workflow).not.toContain('- cron: "0 18 * * *"');
    expect(workflow).toContain("Sunday 18:00 UTC = Monday 02:00 Australia/Perth");
  });

  it("validates the dispatch limit outside shell source and passes it as one quoted argument", () => {
    expect(workflow).toContain("ANSWER_CASE_LIMIT: ${{ github.event.inputs.answer_case_limit || '44' }}");
    expect(workflow).toContain('[[ ! "$ANSWER_CASE_LIMIT" =~ ^[0-9]+$ ]]');
    expect(workflow).toContain("ANSWER_CASE_LIMIT < 1 || ANSWER_CASE_LIMIT > 100");
    expect(workflow).toContain('--limit "$ANSWER_CASE_LIMIT"');
    expect(workflow).not.toMatch(/run:.*github\.event\.inputs\.answer_case_limit/);
  });

  it("distinguishes provider outages from retrieval regressions in the failure issue", () => {
    expect(workflow).toContain('title: "Eval canary failure: weekly evaluation did not complete"');
    expect(workflow).toContain("Resolve provider quota/auth/config failures before rerunning");
    expect(workflow).toContain(
      "Do not bisect or revert code until provider health and the failure class are confirmed",
    );
    expect(workflow).not.toContain("Eval canary regression:");
  });

  it("captures eval logs and adds deterministic failure classification to the issue", () => {
    expect(workflow).toContain("set -o pipefail");
    expect(workflow).toContain("tee .local/eval-canary/golden-retrieval.log");
    expect(workflow).toContain("tee .local/eval-canary/answer-quality.log");
    expect(workflow).toContain("--output-dir .local/eval-canary/quality-reports");
    expect(workflow).toContain(
      "await import(pathToFileURL(`${process.env.GITHUB_WORKSPACE}/scripts/productivity-core.mjs`).href)",
    );
    expect(workflow).toContain("analyzeFailureText(failureText)");
    expect(workflow).toContain("`Failure class: ${diagnosis.category} (${diagnosis.confidence})`");
    expect(workflow).toContain("`Step outcomes: ${JSON.stringify(stepOutcomes)}`");
  });
});
