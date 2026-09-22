import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

const WORKFLOW = path.join(process.cwd(), ".github/workflows/claude-review.yml");

describe("Claude review workflow", () => {
  it("keeps #NNAWDT inside the report-step run script after YAML parse", () => {
    const doc = parse(readFileSync(WORKFLOW, "utf8")) as {
      jobs: {
        review: {
          steps: Array<{ name?: string; run?: string; "continue-on-error"?: boolean }>;
        };
      };
    };
    const report = doc.jobs.review.steps.find((step) => step.name === "Report a review that could not run");
    expect(report, "missing report step").toBeDefined();
    expect(report?.run, "YAML # comment must not truncate the warning").toContain("#NNAWDT");
    expect(report?.run?.trimStart().startsWith("echo ")).toBe(true);
  });

  it("documents the inline-run YAML comment trap that painted red after #2981", () => {
    // Reproduce the failure shape from 2026-09-22: an unquoted scalar is cut at `#`,
    // so the shell sees an unclosed double-quote and exits 2.
    const truncated = parse('run: echo "Tracked as #NNAWDT."') as { run: string };
    expect(truncated.run).toBe('echo "Tracked as');
    expect(truncated.run).not.toContain("#NNAWDT");
    expect(truncated.run.endsWith('"')).toBe(false);
  });

  it("keeps continue-on-error on the review step only, not the job", () => {
    const raw = readFileSync(WORKFLOW, "utf8");
    expect(raw).not.toMatch(/^ {4}continue-on-error:\s*true\s*$/m);
    const doc = parse(raw) as {
      jobs: {
        review: {
          "continue-on-error"?: boolean;
          steps: Array<{ name?: string; "continue-on-error"?: boolean }>;
        };
      };
    };
    expect(doc.jobs.review["continue-on-error"]).toBeUndefined();
    const review = doc.jobs.review.steps.find((step) => step.name === "Review the pull request");
    expect(review?.["continue-on-error"]).toBe(true);
  });
});
