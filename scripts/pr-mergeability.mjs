#!/usr/bin/env node
/**
 * Classify GitHub PR mergeability for the pull_request_target signal job.
 *
 * When a PR has a real content conflict, GitHub cannot build refs/pull/N/merge,
 * so every pull_request-triggered workflow is skipped with no failing check
 * (#116). This helper turns that silence into an explicit fail/pass/retry
 * verdict from mergeable / mergeable_state. It never updates branches.
 */
export function classifyMergeability({ mergeable, mergeableState, draft, state: prState, merged } = {}) {
  if (merged === true || String(prState ?? "").toLowerCase() === "closed") {
    return {
      ok: true,
      action: "skip",
      reason: merged === true ? "merged" : "closed",
      message: "Closed PR: mergeability no longer needs to be computed.",
    };
  }
  if (draft) {
    return {
      ok: true,
      action: "skip",
      reason: "draft",
      message: "Draft PR: mergeability will be enforced when the PR is marked ready for review.",
    };
  }

  const state = String(mergeableState ?? "")
    .trim()
    .toLowerCase();

  if (mergeable === null || mergeable === undefined || state === "" || state === "unknown") {
    return {
      ok: true,
      action: "retry",
      reason: "computing",
      message: "GitHub has not finished computing mergeability yet; retry shortly.",
    };
  }

  // Fail only on real content conflicts. `behind` / `blocked` / `unstable` still
  // produce a merge ref, so pull_request CI can run; those states must not page
  // operators as "CI disappeared". GitHub's boolean `mergeable` alone is not
  // used as a fail signal because it can lag or disagree with mergeable_state.
  if (state === "dirty") {
    return {
      ok: false,
      action: "fail",
      reason: "conflict",
      message:
        "This PR has a real merge conflict with its base branch, so GitHub cannot build refs/pull/<n>/merge and pull_request CI (CI, Gitleaks, Semgrep, …) will not run. Resolve the conflict locally (git merge origin/main or rebase), push, and treat a missing check list as a conflict signal — not a green pass. Behind-but-clean staleness is a different case; use npm run sync:pr-branches (report) / sync:pr-branches:apply (human gh identity).",
    };
  }

  return {
    ok: true,
    action: "pass",
    reason: state || "clean",
    message: `Mergeability is ${state || "clean"}; pull_request CI can run.`,
  };
}

function assert(condition, label) {
  if (!condition) throw new Error(`self-test failed: ${label}`);
}

function selfTest() {
  const merged = classifyMergeability({ merged: true, state: "closed" });
  assert(merged.ok === true && merged.action === "skip" && merged.reason === "merged", "merged PRs skip");
  const closed = classifyMergeability({ merged: false, state: "closed" });
  assert(closed.ok === true && closed.action === "skip" && closed.reason === "closed", "closed PRs skip");
  assert(classifyMergeability({ draft: true }).action === "skip", "drafts skip");
  assert(classifyMergeability({ mergeable: null, mergeableState: "unknown" }).action === "retry", "unknown retries");
  assert(classifyMergeability({ mergeable: undefined, mergeableState: "" }).action === "retry", "empty retries");

  const conflict = classifyMergeability({ mergeable: false, mergeableState: "dirty" });
  assert(conflict.ok === false && conflict.action === "fail", "dirty fails");
  assert(conflict.message.includes("merge conflict"), "conflict message names the cause");

  assert(classifyMergeability({ mergeable: true, mergeableState: "behind" }).ok === true, "behind passes");
  assert(classifyMergeability({ mergeable: true, mergeableState: "blocked" }).ok === true, "blocked passes");
  assert(
    classifyMergeability({ mergeable: false, mergeableState: "blocked" }).ok === true,
    "blocked ignores boolean lag",
  );
  assert(classifyMergeability({ mergeable: true, mergeableState: "clean" }).action === "pass", "clean passes");
  assert(
    classifyMergeability({ mergeable: false, mergeableState: "unstable" }).ok === true,
    "unstable still has a merge ref",
  );

  console.log("pr-mergeability self-test passed.");
}

if (process.argv.includes("--self-test")) {
  selfTest();
}
