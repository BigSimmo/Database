import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { sourceFrom, sourceSegment } from "./helpers/source-contract";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflow = readFileSync(path.join(repoRoot, ".github", "workflows", "dependency-report.yml"), "utf8").replace(
  /\r\n/g,
  "\n",
);
const job = sourceFrom(workflow, "  dependency-report:\n", { label: "dependency-report job" });

/**
 * These pin the half of the fix that lives outside the script. The script can now
 * say "unavailable", but that only matters if the workflow acts on it — the
 * previous version had no gate at all, so a run where npm never answered produced
 * a green job, a rolling issue reading "none 🎉", and `severity=none`.
 */
describe("dependency-report workflow evidence gate", () => {
  it("fails the run when either measurement did not complete", () => {
    expect(job).toContain("- name: Require a complete measurement");
    expect(job).toContain("if: ${{ steps.report.outputs.evidence_complete != 'true' }}");
    expect(job).toMatch(/Require a complete measurement[\s\S]*exit 1/);
  });

  it("publishes the incomplete report before failing, so the evidence still lands", () => {
    // Order matters: a gate placed before publication would leave the PREVIOUS
    // fortnight's numbers as the newest thing in the rolling issue.
    expect(job.indexOf("- name: Publish to rolling issue")).toBeLessThan(
      job.indexOf("- name: Require a complete measurement"),
    );
  });

  it("does not fail the run merely because vulnerabilities were found", () => {
    // Findings are data for the existing security gates and the notification
    // policy. Only missing evidence is a run failure, so the gate must key on
    // evidence_complete and never on severity.
    const gate = sourceFrom(job, "      - name: Require a complete measurement\n", { label: "evidence gate step" });
    expect(gate).not.toMatch(/outputs\.severity/);
    expect(gate).toContain("outputs.outdated_state");
    expect(gate).toContain("outputs.audit_state");
  });

  it("never coerces an unknown outdated count back to a number", () => {
    // `Number(process.env.OUTDATED_COUNT || "0")` was the erasure: the one place
    // the old script detected unavailability was undone before the workflow saw it.
    expect(job).not.toContain('Number(process.env.OUTDATED_COUNT || "0")');
    expect(job).toContain('const outdated = process.env.OUTDATED_COUNT || "unknown";');
    expect(job).toContain('const severity = process.env.SEVERITY || "unknown";');
  });

  it("comments on the rolling issue when the measurement is incomplete", () => {
    expect(job).toContain("Dependency evidence incomplete");
    expect(job).toContain("Absent counts are unknown, not zero.");
  });

  it("keeps step outputs out of inline template expansion in the script body", () => {
    // Same template-injection guard the bundle workflow documents: values reach
    // the script through env, never through `${{ }}` inside `script:`.
    // Bounded to the publish step: sourceFrom would run to end of file and pick
    // up the evidence gate's own (legitimate) env-level step references.
    const script = sourceSegment(job, "          script: |\n", "\n      # The report is published FIRST", {
      label: "publish script body",
    });
    expect(script).not.toMatch(/\$\{\{\s*steps\./);
  });
});
