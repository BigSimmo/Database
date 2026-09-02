import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { sourceFrom, sourceSegment } from "./helpers/source-contract";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowPath = path.join(repoRoot, ".github", "workflows", "bundle-budget-refresh.yml");

describe("bundle-budget refresh workflow exists", () => {
  it("ships the scheduled baseline measurement workflow (outstanding issue #QSHHGK)", () => {
    // Before this file existed nothing measured bundle growth on a schedule, so
    // accumulation only surfaced as a failure on whichever unrelated PR landed
    // last. If the workflow is deleted, that regression returns silently.
    expect(existsSync(workflowPath), `expected a workflow at ${workflowPath}`).toBe(true);
  });
});

const workflow = readFileSync(workflowPath, "utf8").replace(/\r\n/g, "\n");
const triggers = sourceSegment(workflow, "\non:\n", "\nconcurrency:\n", { label: "bundle-budget-refresh triggers" });
const job = sourceFrom(workflow, "  bundle-budget-refresh:\n", { label: "bundle-budget-refresh job" });

describe("bundle-budget refresh workflow triggers and privileges", () => {
  it("runs on a weekly schedule and on manual dispatch", () => {
    expect(triggers).toContain("workflow_dispatch: {}");
    expect(triggers).toMatch(/^\s+- cron: "[^"]+"$/m);
    // Weekly: a day-of-week field, not the every-day wildcard.
    const cron = /- cron: "([^"]+)"/.exec(triggers)?.[1] ?? "";
    expect(cron.split(/\s+/)).toHaveLength(5);
    expect(cron.split(/\s+/)[4], `cron "${cron}" must pin a weekday`).not.toBe("*");
  });

  it("stays clear of the crowded Sunday 18:00 UTC slot other weekly workflows use", () => {
    // ci.yml, docker-image.yml and eval-canary.yml all fire at "0 18 * * 0";
    // live-drift.yml at "30 18 * * 0". A cold full build queued behind those is
    // the slot this workflow must not take.
    const cron = /- cron: "([^"]+)"/.exec(triggers)?.[1] ?? "";
    expect(cron).not.toBe("0 18 * * 0");
    expect(cron).not.toBe("30 18 * * 0");
  });

  it("never cancels a measurement already in flight", () => {
    expect(workflow).toContain("group: bundle-budget-refresh");
    expect(workflow).toContain("cancel-in-progress: false");
  });

  it("keeps workflow-level permissions read-only and grants issues: write only on the job", () => {
    expect(workflow).toMatch(/^permissions:\n {2}contents: read\n/m);
    expect(sourceSegment(workflow, "\npermissions:\n", "\njobs:\n", { label: "workflow permissions" })).not.toContain(
      "issues:",
    );
    expect(job).toMatch(/^ {4}permissions:\n {6}contents: read\n(?: {6}#[^\n]*\n)* {6}issues: write$/m);
  });

  it("pins the runner and sets an explicit generous timeout for the cold build", () => {
    expect(job).toContain("runs-on: ubuntu-24.04");
    expect(job).not.toContain("ubuntu-latest");
    const timeout = /^ {4}timeout-minutes: (\d+)$/m.exec(job)?.[1];
    expect(timeout, "the job must set an explicit timeout-minutes").toBeDefined();
    expect(Number(timeout)).toBeGreaterThanOrEqual(30);
  });

  it("checks out full history without credentials, because provenance validation needs it", () => {
    // --refresh-baseline validates that the baseline source SHA is a real commit,
    // an ancestor of HEAD, and a resolvable distance from it. A shallow clone
    // makes that check fail closed.
    expect(job).toContain("uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1");
    expect(job).toContain("fetch-depth: 0");
    expect(job).toContain("persist-credentials: false");
  });

  it("installs dependencies through the shared cached-setup composite action", () => {
    expect(job).toContain("uses: ./.github/actions/setup-node-cached");
  });
});

describe("bundle-budget refresh measurement", () => {
  const measureStep = sourceSegment(job, "      - name: Measure bundle weight", "      - name: Upload", {
    label: "measure step",
  });

  it("removes .next before building, so the check cannot read stale output", () => {
    // AGENTS.md "Bundle budget" → Measuring: `npm run build` reuses a cached
    // .next and the check then reports byte-identical numbers — it will say the
    // budget passes when it does not.
    const removeIndex = measureStep.indexOf("rm -rf .next");
    const buildIndex = measureStep.indexOf("npm run build");
    expect(removeIndex, "expected `rm -rf .next` in the measurement step").toBeGreaterThanOrEqual(0);
    expect(buildIndex, "expected `npm run build` in the measurement step").toBeGreaterThanOrEqual(0);
    expect(removeIndex).toBeLessThan(buildIndex);
  });

  it("does not restore a Next.js build cache that would defeat the cold build", () => {
    expect(job).not.toContain("path: .next/cache");
  });

  it("runs the budget check in refresh mode and captures machine-readable output", () => {
    expect(measureStep).toContain("scripts/check-bundle-budget.mjs --refresh-baseline --json");
    expect(measureStep.indexOf("npm run build")).toBeLessThan(measureStep.indexOf("check-bundle-budget.mjs"));
    expect(measureStep).toContain("set -o pipefail");
  });

  it("uploads the refreshed baseline and fails rather than reporting with no evidence", () => {
    const uploadStep = sourceSegment(job, "      - name: Upload refreshed baseline", "      - name: Publish", {
      label: "upload step",
    });
    expect(uploadStep).toContain("uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7");
    expect(uploadStep).toContain("if-no-files-found: error");
    expect(uploadStep).toContain("bundle-budget.json");
  });
});

describe("bundle-budget refresh stays report-only", () => {
  it("never commits, pushes, or otherwise mutates the repository", () => {
    // scripts/check-github-action-pins.mjs fails the build on workflow-authored
    // branch mutation: bot-authored heads leave required checks awaiting
    // approval. A bot-moved baseline is also a baseline nobody reviewed.
    expect(workflow).not.toMatch(/\bgit\s+push\b/);
    expect(workflow).not.toMatch(/\bgit\s+commit\b/);
    expect(workflow).not.toMatch(/\bgit\s+(?:tag|branch)\b/);
    expect(workflow).not.toContain("create-pull-request");
    expect(workflow).not.toMatch(/\bgh\s+pr\s+create\b/);
    expect(workflow).not.toMatch(/github\s*\.\s*rest\s*\.\s*pulls\b/);
    expect(workflow).not.toMatch(/github\s*\.\s*rest\s*\.\s*git\b/);
    expect(workflow).not.toMatch(/createOrUpdateFileContents/);
    expect(workflow).not.toMatch(/\bgh\s+pr\s+update-branch\b/);
    expect(workflow).not.toContain("sync:pr-branches");
  });

  it("records in the file itself why it must never push, so nobody re-adds it", () => {
    expect(workflow).toContain("REPORT ONLY");
    expect(workflow).toContain("awaiting approval");
  });

  it("publishes into a single rolling labelled issue instead of stacking duplicates", () => {
    const publishStep = sourceFrom(job, "      - name: Publish to rolling issue", { label: "publish step" });
    expect(publishStep).toContain("uses: actions/github-script@3a2844b7e9c422d3c10d287c895573f7108da1b3 # v9.0.0");
    expect(publishStep).toContain('const label = "bundle-budget-refresh";');
    expect(publishStep).toContain("github.rest.issues.listForRepo");
    expect(publishStep).toContain("github.rest.issues.update");
    expect(publishStep).toContain("github.rest.issues.create");
  });

  it("passes step results into github-script via env, never inline template expansion", () => {
    // Inline `${{ }}` interpolation into a script body is the GitHub Actions
    // template-injection pattern; dependency-report.yml uses the same env shape.
    const publishStep = sourceFrom(job, "      - name: Publish to rolling issue", { label: "publish step" });
    const scriptBody = sourceFrom(publishStep, "          script: |\n", { label: "github-script body" });
    expect(publishStep).toContain("REFRESH_OUTCOME: ${{ steps.refresh.outcome }}");
    expect(scriptBody).toContain("process.env.REFRESH_OUTCOME");
    expect(scriptBody).not.toContain("${{");
  });

  it("never puts a status-check function anywhere but an `if:` line", () => {
    // A status function inside an env: value is valid YAML and an invalid Actions
    // schema: the whole workflow fails to parse and creates ZERO jobs. Repo-wide
    // scan lives in tests/ci-cache-safety.test.ts; this is the local guard.
    const offenders = workflow
      .split("\n")
      .map((line, index) => ({ line, number: index + 1 }))
      .filter(({ line }) => /\$\{\{[^}]*\b(?:success|failure|cancelled|always)\s*\(/.test(line))
      .filter(({ line }) => !/^\s*(-\s+)?if\s*:/.test(line))
      .map(({ line, number }) => `${number}: ${line.trim()}`);
    expect(offenders).toEqual([]);
  });
});
