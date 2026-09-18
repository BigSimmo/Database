import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const workflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");

/**
 * DELIVERY, NOT DETECTION (ledger #T82ND3 and #TN512M).
 *
 * `pr-required` answers "is this change broken?". Until this routing job existed nothing answered
 * "is `main` broken right now?", and a post-merge failure has nothing left to block: measured
 * 2026-09-16, CI on `main` failed six of its last eight pushes since 2026-09-13 with no workflow
 * reporting it, and a re-read of the four most recent red runs on 2026-09-18 found the only failing
 * jobs were `release-browser-matrix (firefox)` and `(webkit)` while `pr-required` went green each
 * time. The routing job is the entire fix, so it is the part most worth pinning — silence is the
 * state the repository returns to if it is removed.
 */
describe("main CI failure routing", () => {
  const routingIndex = workflow.indexOf("  main-failure-routing:");
  const routing = workflow.slice(routingIndex);

  it("routes a red main run to a pinned issue, which is its only delivery path", () => {
    expect(routingIndex).toBeGreaterThan(-1);
    expect(routing).toContain('const title = "CI on main is failing"');
    expect(routing).toContain("issues.create(");
  });

  // Only `main` pushes. A pull request already has `pr-required` blocking it, and opening an issue
  // per red branch push would make the label meaningless within a day.
  it("fires only on pushes to main", () => {
    expect(routing).toMatch(/github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/);
  });

  /**
   * `always()`, not `!cancelled()`. A cancelled `main` run verified nothing, and a run that quietly
   * verified nothing is exactly the invisibility this job exists to end — `cancel-in-progress` is
   * deliberately disabled for base-branch pushes for the same reason.
   */
  it("still reports when the run was cancelled rather than failed", () => {
    expect(routing).toContain("always() && github.event_name == 'push'");
    expect(routing).toContain('value === "cancelled"');
  });

  /**
   * An alert that never clears becomes wallpaper, which is the failure mode #9Z197J records for the
   * browser matrix. A green run must close the issue, so an open issue always means main is red now.
   */
  it("closes the issue on the next green main run", () => {
    expect(routing).toMatch(/if \(!red\)/);
    expect(routing).toContain('state: "closed"');
  });

  /**
   * Ownership is matched on this job's own marker first. `?? open[0]` was removed from live-drift's
   * equivalent for a reason worth not relearning: harmless when updating a body, but on the green
   * path it CLOSES whatever it matched, and closing someone else's issue is not recoverable by a
   * workflow.
   */
  it("matches its own issue by marker or exact title, never by 'first labelled issue'", () => {
    expect(routing).toContain('const label = "main-ci-failure"');
    expect(routing).toContain("<!-- main-ci-routing:v1 -->");
    expect(routing).toMatch(/const owned = \(issue\) =>[\s\S]*?MARKER[\s\S]*?issue\.title === title/);
    expect(routing).not.toContain("?? open[0]");
  });

  /**
   * The issue is close to useless if it only says the run was red. #9Z197J is a standing failure of
   * two named matrix legs, and naming them is what turns "main is red again" into a row somebody can
   * already recognise. The job listing is read-only and falls back to the declared results, so a
   * naming failure can never swallow the alert itself.
   */
  it("names the failing jobs, including individual matrix legs", () => {
    expect(routing).toContain("listJobsForWorkflowRun");
    expect(routing).toContain("actions: read");
    expect(routing).toContain("### Failing jobs");
    expect(routing).toMatch(/jobListing = `unavailable/);
  });

  /**
   * `issues: write` must stay scoped to a job that never checks out or executes repository code —
   * the same split live-drift.yml and live-domain-monitor.yml use. Every other job in ci.yml keeps
   * the workflow-level `contents: read`.
   */
  it("keeps issues: write on a job that runs no repository code", () => {
    const beforeRouting = workflow
      .slice(0, routingIndex)
      .split("\n")
      .filter((line) => !line.trim().startsWith("#"))
      .join("\n");
    expect(beforeRouting).not.toContain("issues: write");
    expect(routing).not.toContain("actions/checkout@");
    expect(routing).not.toContain("setup-node-cached");
  });

  /**
   * Step results travel through `env:`, never inline template expansion inside `script:`. An
   * expression interpolated into the script body is a template-injection surface, and the commit
   * subject read here is attacker-influenceable text on any branch that reaches main.
   */
  it("passes every run-derived value through env rather than inline expansion", () => {
    expect(routing).toContain("HEAD_MESSAGE: ${{ github.event.head_commit.message }}");
    expect(routing).toContain("process.env.HEAD_MESSAGE");
    const script = routing.slice(routing.indexOf("script: |"));
    expect(script).not.toMatch(/\$\{\{/);
  });

  /**
   * REPORT ONLY. `scripts/check-github-action-pins.mjs` forbids workflow-authored branch mutation,
   * and a red `main` is a fact to deliver, not to auto-repair.
   */
  it("mutates nothing", () => {
    expect(routing).not.toContain("updateBranch");
    expect(routing).not.toContain("pulls.merge");
    expect(routing).not.toContain("git push");
  });

  /**
   * #9Z197J's recorded remedy, verbatim in effect: do NOT add `release-browser-matrix` to
   * `pr-required`'s needs. It never runs on a `pull_request` event, so aggregating a skipped job
   * would change nothing while making every PR wait on a ~45-minute matrix. The post-merge signal is
   * the fix. This pins the decision so a later edit has to argue with it.
   */
  it("does not make the browser matrix a PR-required check", () => {
    const prRequired = workflow.slice(
      workflow.indexOf("  pr-required:"),
      workflow.indexOf("  release-browser-matrix:"),
    );
    expect(prRequired).not.toContain("release-browser-matrix");
    expect(routing).toContain("needs: [pr-required, release-browser-matrix, visual-baseline]");
  });
});
