import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// Invoked by the existing Actions guard. The exception is tied to the one
// trusted controller and its literal credential, ownership, and state contract.
export function prBatchWorkflowFailures(root) {
  const file = path.join(root, ".github/workflows/pr-batch-runner.yml");
  if (!existsSync(file)) return [];
  const workflow = readFileSync(file, "utf8");
  const controllerFile = path.join(root, "scripts/pr-batch-github.mjs");
  if (!existsSync(controllerFile)) return ["PR batch workflow is missing its trusted adapter"];
  const adapter = readFileSync(controllerFile, "utf8");
  const failures = [];
  for (const required of [
    "workflow_dispatch:",
    "vars.PR_BATCH_ENABLED == 'true'",
    "github.ref == 'refs/heads/main'",
    "group: pr-batch-mutation",
    "cancel-in-progress: false",
    "persist-credentials: false",
    "github-token: ${{ secrets.GH_TOKEN }}",
    "GH_TOKEN: ${{ secrets.GH_TOKEN }}",
    "PR_BATCH_STATE_SIGNING_KEY: ${{ secrets.PR_BATCH_STATE_SIGNING_KEY }}",
    "workflowMain({ github, context, core",
  ])
    if (!workflow.includes(required)) failures.push(`PR batch workflow missing required boundary: ${required}`);
  for (const required of [
    'user.login !== "BigSimmo"',
    'user.type !== "User"',
    "expected_head_sha: pending.head",
    "await this.assertMutation(state, pending)",
    "force: false",
    'loaded.state?.status !== "running"',
    "state-auth.json",
    "createHmac",
  ])
    if (!adapter.includes(required)) failures.push(`PR batch adapter missing required boundary: ${required}`);
  if (!/"--match-head-commit",\s*pending\.head/.test(adapter))
    failures.push("PR batch merge must match its verified head");
  if (
    /ref:\s*\$\{\{\s*github\.event\.pull_request\./.test(workflow) ||
    /npm (?:ci|install)|permission-profile|codex-action@/.test(workflow)
  )
    failures.push("PR batch controller must never execute or install PR code");
  if (/"--admin"|"--force"|disablePullRequestAutoMerge|updateRef\([^;]*force:\s*true|rest\.pulls\.merge/.test(adapter))
    failures.push("PR batch adapter contains a prohibited bypass or auto-merge mutation");
  return failures;
}
