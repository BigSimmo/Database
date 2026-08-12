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
    expect(workflow).toContain("ANSWER_CASE_LIMIT: ${{ github.event.client_payload.answer_case_limit || '44' }}");
    expect(workflow).toContain('[[ ! "$ANSWER_CASE_LIMIT" =~ ^[0-9]+$ ]]');
    expect(workflow).toContain("ANSWER_CASE_LIMIT < 1 || ANSWER_CASE_LIMIT > 100");
    expect(workflow).toContain('--limit "$ANSWER_CASE_LIMIT"');
    expect(workflow).not.toMatch(/run:.*github\.event\.client_payload\.answer_case_limit/);
  });

  it("loads on-demand evaluations from the trusted default branch", () => {
    expect(workflow).not.toMatch(/^  workflow_dispatch:/m);
    expect(workflow).toContain("repository_dispatch:");
    expect(workflow).toContain("types: [eval-canary]");
    expect(workflow).not.toMatch(/^\s+ref:\s+\$\{\{/m);
    expect(workflow).toContain('echo "EVAL_GIT_SHA=$(git rev-parse HEAD)" >> "$GITHUB_ENV"');
  });

  it("scopes production provider secrets to the live steps", () => {
    expect(workflow).not.toMatch(
      /^(?: {0,6})env:\n(?: {2,8}[^\n]+\n)* {2,8}(?:SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY):/m,
    );

    const installStart = workflow.indexOf("      - name: Install dependencies");
    const projectGuardStart = workflow.indexOf("      - name: Guard Supabase project identity");
    expect(installStart).toBeGreaterThan(-1);
    expect(projectGuardStart).toBeGreaterThan(installStart);
    expect(workflow.slice(installStart, projectGuardStart)).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(workflow.slice(installStart, projectGuardStart)).not.toContain("OPENAI_API_KEY");
  });

  it("opens the failure issue for scheduled AND dispatched runs", () => {
    // A red dispatch is usually half of a canary pair gating a behaviour change — it must
    // not fail silently while only weekly runs get an issue.
    expect(workflow).toContain(
      "if: failure() && (github.event_name == 'schedule' || github.event_name == 'repository_dispatch')",
    );
    expect(workflow).toContain('context.eventName === "schedule" ? "Weekly (scheduled)" : "Dispatched"');
  });

  it("feeds every eval log and live step outcome into the failure issue", () => {
    expect(workflow).toContain('".local/eval-canary/answer-targeting.log"');
    expect(workflow).toContain('validate_override: "${{ steps.validate_override.outcome }}"');
    expect(workflow).toContain('answer_targeting: "${{ steps.answer_targeting.outcome }}"');
  });

  it("distinguishes provider outages from retrieval regressions in the failure issue", () => {
    expect(workflow).toContain('title: "Eval canary failure: evaluation did not complete"');
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
    expect(workflow).toContain("--source-governance-results .local/eval-canary/golden-retrieval.json");
    expect(workflow).toContain(
      "await import(pathToFileURL(`${process.env.GITHUB_WORKSPACE}/scripts/productivity-core.mjs`).href)",
    );
    expect(workflow).toContain("analyzeFailureText(failureText)");
    expect(workflow).toContain("`Failure class: ${diagnosis.category} (${diagnosis.confidence})`");
    expect(workflow).toContain("`Step outcomes: ${JSON.stringify(stepOutcomes)}`");
  });
});
