import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(new URL("../.github/workflows/codex-run-pr-operator.yml", import.meta.url), "utf8");

function job(name: string, nextName?: string) {
  const start = workflow.indexOf(`  ${name}:`);
  expect(start).toBeGreaterThan(-1);
  const end = nextName ? workflow.indexOf(`  ${nextName}:`, start + name.length + 3) : workflow.length;
  expect(end).toBeGreaterThan(start);
  return workflow.slice(start, end);
}

describe("Codex Run PR operator workflow", () => {
  const prepare = job("prepare", "repair");
  const repair = job("repair", "publish");
  const publish = job("publish", "mutate");
  const mutate = job("mutate");

  it("accepts only the exact human operator trigger for an open same-repository feature PR", () => {
    expect(prepare).toContain("github.event.comment.user.login == 'BigSimmo'");
    expect(prepare).toContain("github.event.comment.body == '/codex-run-pr'");
    expect(prepare).toContain("pr.head.repo?.full_name !== `${owner}/${repo}`");
    expect(prepare).toContain("protectedBranch");
    expect(prepare).toContain('pr.state !== "open" || pr.merged');
  });

  it("collects the complete bounded Run PR control-plane evidence", () => {
    expect(prepare).toContain("open_pull_requests: openPullRequests");
    expect(prepare).toContain("unresolved_review_thread_count: unresolvedThreadCount");
    expect(prepare).toContain("reviews,");
    expect(prepare).toContain("issue_comments: issueComments");
    expect(prepare).toContain("required_checks: requiredChecks");
    expect(prepare).toContain("check_runs: checkRuns");
    expect(prepare).toContain("workflow_runs: workflowRuns");
    expect(prepare).toContain("bounded_log_tail: boundedLog");
  });

  it("keeps GitHub credentials out of the unprivileged Codex repair job", () => {
    expect(repair).toContain("openai/codex-action@52fe01ec70a42f454c9d2ebd47598f9fd6893d56 # v1");
    expect(repair).toContain("safety-strategy: unprivileged-user");
    expect(repair).toContain("persist-credentials: false");
    expect(repair).toContain("npm ci --ignore-scripts");
    expect(repair).toContain('git show "$BASE_SHA:.github/codex/prompts/run-pr-operator.md"');
    expect(repair).toContain("${{ runner.temp }}/codex-run-pr-trusted/prompt.md");
    expect(repair).toContain("CONTEXT_SHA256: ${{ needs.prepare.outputs.context_sha256 }}");
    expect(repair).toContain("! -name .git");
    expect(repair).toContain('git merge --no-edit "$BASE_SHA"');
    expect(repair).not.toContain("secrets.GH_TOKEN");
    expect(repair).not.toContain("github-token:");
    expect(repair).not.toContain("./.github/actions/");
  });

  it("seals only bounded descendants and excludes policy or credential-bearing paths", () => {
    expect(repair).toContain('git merge-base --is-ancestor "$EXPECTED_HEAD" HEAD');
    expect(repair).toContain(".github/*|.env|.env.*|*.pem|*.key|.gitmodules");
    expect(repair).toContain('git diff --cached --binary "$EXPECTED_HEAD"');
    expect(repair).toContain("(120000|160000)");
    expect(repair).toContain("sha256sum .codex-run-pr/context.json");
    expect(repair).toContain("1048576");
    expect(repair).toContain("git bundle create");
  });

  it("publishes only an exact, race-free, ordinary feature-branch update as BigSimmo", () => {
    expect(publish).toContain("secrets.GH_TOKEN");
    expect(publish).toContain('test "$identity" = "BigSimmo"');
    expect(publish).toContain('test "$remote_head" = "$EXPECTED_HEAD"');
    expect(publish).toContain('git push origin "$RESULT_SHA:refs/heads/$HEAD_REF"');
    expect(publish).not.toMatch(/--force|--delete|push\s+origin\s+:(?:refs\/heads\/)?/u);
  });

  it("revalidates bounded review threads and failed runs before remote mutations", () => {
    expect(mutate).toContain("secrets.GH_TOKEN");
    expect(mutate).toContain("Duplicate review-thread disposition");
    expect(mutate).toContain("The bounded PR context changed after collection.");
    expect(mutate).toContain("allowedActions");
    expect(mutate).toContain("Review thread ${disposition.thread_id} changed after evidence collection.");
    expect(mutate).toContain("resolveReviewThread");
    expect(mutate).toContain("rerun-failed-jobs");
    expect(mutate).toContain('currentRun.conclusion !== "failure"');
    expect(mutate).not.toContain("pulls.merge");
    expect(mutate).not.toContain("pulls.update");
    expect(mutate).not.toContain("pulls.delete");
  });
});
