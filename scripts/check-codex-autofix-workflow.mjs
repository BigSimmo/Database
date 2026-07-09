import { readFileSync } from "node:fs";
import path from "node:path";

const workflowPath = path.join(process.cwd(), ".github", "workflows", "codex-autofix-review-comments.yml");
const workflow = readFileSync(workflowPath, "utf8");
const problems = [];

function requirePattern(label, pattern) {
  if (!pattern.test(workflow)) {
    problems.push(`Missing required workflow guard: ${label}`);
  }
}

requirePattern("pull_request_review submitted trigger", /pull_request_review:\s*\n\s*types:\s*\[submitted\]/);
requirePattern(
  "pull_request_review_comment created trigger",
  /pull_request_review_comment:\s*\n\s*types:\s*\[created\]/,
);
requirePattern("issue_comment created trigger", /issue_comment:\s*\n\s*types:\s*\[created\]/);
requirePattern("open pull request job guard", /github\.event\.pull_request\.state == 'open'/);
requirePattern("open issue comment PR guard", /github\.event\.issue\.pull_request/);
requirePattern("Codex actor guard", /chatgpt-codex-connector/);
requirePattern("review-thread reply skip", /in_reply_to_id/);
requirePattern("auto-resolve request skip", /@codex resolve all review comments/);
requirePattern("approved review skip", /APPROVED/);
requirePattern("head SHA marker", /codex-autoresolve-pr:\$\{pr\.number\}:\$\{headSha\}/);
requirePattern("head SHA label lock", /codex-ar-\$\{headSha\}/);
requirePattern("pull-requests write permission", /pull-requests:\s*write/);
requirePattern(
  "SHA-scoped concurrency queue",
  /codex-autoresolve-\$\{\{ github\.event\.pull_request\.number \|\| github\.event\.issue\.number \}\}-\$\{\{ github\.event\.pull_request\.head\.sha \|\| 'issue-comment' \}\}/,
);
requirePattern("queued concurrency", /cancel-in-progress:\s*false/);
requirePattern("resolve completion summary skip", /isResolveCompletionSummary/);
requirePattern("ensure request label before apply", /ensureRequestLabel/);
requirePattern("comment before label lock", /createComment[\s\S]*ensureRequestLabel/);
requirePattern("permission soft-skip on comment read", /cannot read PR comments/);
requirePattern("AGENTS.md primary command reference", /AGENTS\.md § Codex GitHub review behavior/);

if (workflow.includes("codex-autoresolve-pr:${pr.number} -->") && !workflow.includes("${headSha}")) {
  problems.push("Workflow still uses per-PR-only dedupe marker without head SHA.");
}

if (problems.length > 0) {
  console.error("Codex auto-resolve workflow guard check failed:");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log("Codex auto-resolve workflow guard check passed.");
