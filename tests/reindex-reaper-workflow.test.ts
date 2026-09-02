import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { yamlBlock } from "../scripts/yaml-contract.mjs";

// Raw-text assertions, matching tests/ingestion-autopilot-workflow.test.ts and
// tests/live-drift-workflow.test.ts. A YAML parser would normalise away the exact
// shell text these guards depend on (which branch runs first, what `--apply` sits
// behind), and this repo declares no YAML dependency for tests.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowPath = path.join(repoRoot, ".github", "workflows", "reindex-reaper.yml");

describe("reindex reaper workflow", () => {
  it("exists and has the expected top-level structure", () => {
    expect(existsSync(workflowPath)).toBe(true);
    const workflow = readFileSync(workflowPath, "utf8").replace(/\r\n/g, "\n");
    for (const key of ["name:", "on:", "concurrency:", "permissions:", "env:", "jobs:"]) {
      expect(workflow).toMatch(new RegExp(`^${key}`, "m"));
    }
    expect(yamlBlock(workflow, "reindex-reaper:", 2)).not.toBe("");
  });

  it("states the blast radius and the inert posture in its opening comment", () => {
    const header = readFileSync(workflowPath, "utf8").replace(/\r\n/g, "\n").split("\n").slice(0, 5).join("\n");
    expect(header).toMatch(/seven artifact tables/);
    expect(header).toMatch(/EVERY tenant/);
    expect(header).toMatch(/INERT/);
    expect(header).toMatch(/repository owner's decision/);
  });

  it("is reachable only from a trusted dispatch or the schedule", () => {
    const workflow = readFileSync(workflowPath, "utf8").replace(/\r\n/g, "\n");
    expect(workflow).toMatch(/^  repository_dispatch:$/m);
    expect(workflow).toContain("types: [reindex-reaper]");
    expect(workflow).toMatch(/^  schedule:$/m);
    expect(workflow).toMatch(/^    - cron: "[^"]+"$/m);

    // A manual branch-selectable trigger would let a same-repository writer point a
    // secret-bearing, destructive workflow at their own definition.
    for (const trigger of ["workflow_dispatch", "push", "pull_request", "pull_request_target"]) {
      expect(workflow).not.toMatch(new RegExp(`^  ${trigger}:`, "m"));
    }
  });

  it("gates the whole job on the (deliberately unset) enable variable", () => {
    const workflow = readFileSync(workflowPath, "utf8").replace(/\r\n/g, "\n");
    const job: string = yamlBlock(workflow, "reindex-reaper:", 2);
    expect(job).toMatch(/^    if: vars\.REINDEX_REAPER_ENABLED == 'true'$/m);
  });

  it("double-gates the apply path and never lets the schedule reach it", () => {
    const workflow = readFileSync(workflowPath, "utf8").replace(/\r\n/g, "\n");
    const runStep: string = yamlBlock(
      yamlBlock(workflow, "reindex-reaper:", 2),
      "- name: Reap abandoned reindex generations",
      6,
    );
    expect(runStep).toContain("APPLY_REQUESTED: ${{ github.event.client_payload.apply || 'false' }}");
    expect(runStep).toContain("APPLY_ALLOWED: ${{ vars.REINDEX_REAPER_APPLY }}");
    expect(runStep).toContain('elif [ "$APPLY_REQUESTED" = "true" ] && [ "$APPLY_ALLOWED" = "true" ]; then');

    // Comments describing the gates are not gates, so compare executable lines only.
    const executable = runStep
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("#"))
      .join("\n");

    // Exactly one --apply invocation, and it sits behind the elif above.
    const applyLines = executable.split("\n").filter((line) => line.includes("--apply"));
    expect(applyLines).toHaveLength(1);
    expect(applyLines[0]).toContain("npm run reindex:cleanup-staged -- --apply --yes");

    // The scheduled branch is evaluated first and does not fall through, so cron
    // can only ever reach the read-only alert probe.
    const scheduleBranchIndex = executable.indexOf('if [ "$GITHUB_EVENT_NAME" = "schedule" ]; then');
    const applyIndex = executable.indexOf("--apply");
    expect(scheduleBranchIndex).toBeGreaterThan(-1);
    expect(applyIndex).toBeGreaterThan(scheduleBranchIndex);
    expect(executable).toContain("npm run reindex:cleanup-staged -- --alert-on-abandoned");
  });

  it("defaults to a dry run on every path", () => {
    const workflow = readFileSync(workflowPath, "utf8").replace(/\r\n/g, "\n");
    const runStep: string = yamlBlock(
      yamlBlock(workflow, "reindex-reaper:", 2),
      "- name: Reap abandoned reindex generations",
      6,
    );
    // The fall-through branch runs the script with no flags, and the script itself
    // is dry-run unless --apply is passed.
    expect(runStep).toMatch(/^\s+npm run reindex:cleanup-staged$/m);
    const invocations = runStep
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("#") && line.includes("npm run reindex:cleanup-staged"));
    expect(invocations).toHaveLength(3);
  });

  it("pins the production Supabase identity and never names the stale project ref", () => {
    const workflow = readFileSync(workflowPath, "utf8").replace(/\r\n/g, "\n");
    expect(workflow).toContain("NEXT_PUBLIC_SUPABASE_URL: https://sjrfecxgysukkwxsowpy.supabase.co");
    expect(workflow).toContain("SUPABASE_PROJECT_REF: sjrfecxgysukkwxsowpy");
    expect(workflow).toContain("SUPABASE_PROJECT_NAME: Clinical KB Database");
    expect(workflow).toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: placeholder-ci-anon-key");
    expect(workflow).not.toContain("qjgitjyhxrwxsrydablr");
    expect(workflow).toContain("npm run check:supabase-project");
  });

  it("keeps the service-role secret step-scoped and preflights it", () => {
    const workflow = readFileSync(workflowPath, "utf8").replace(/\r\n/g, "\n");
    const secretLines = workflow.split("\n").filter((line) => line.includes("SUPABASE_SERVICE_ROLE_KEY:"));
    expect(secretLines).toEqual([
      "          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}",
      "          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}",
    ]);
    expect(workflow).toContain("::error::Reindex reaper cannot run — missing repo secret SUPABASE_SERVICE_ROLE_KEY");
  });

  it("serialises runs and can raise an alert issue", () => {
    const workflow = readFileSync(workflowPath, "utf8").replace(/\r\n/g, "\n");
    const concurrency: string = yamlBlock(workflow, "concurrency:", 0);
    expect(concurrency).toContain("group: reindex-reaper");
    expect(concurrency).toContain("cancel-in-progress: false");

    const permissions: string = yamlBlock(workflow, "permissions:", 0);
    expect(permissions).toContain("contents: read");
    expect(permissions).toContain("issues: write");

    expect(workflow).toContain("if: failure() && github.event_name == 'schedule'");
    expect(workflow).toContain("npm run reindex:cleanup-staged");
  });
});
