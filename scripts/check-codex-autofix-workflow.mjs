import fs from "node:fs";

const workflowPath = ".github/workflows/codex-autofix-review-comments.yml";
const workflow = fs.readFileSync(workflowPath, "utf8");

const failures = [];

const forbiddenPatterns = [
  {
    pattern: /github\.event\.pull_request\.head\.sha/,
    message: "Do not key the Codex auto-resolve workflow on github.event.pull_request.head.sha.",
  },
  {
    pattern: /pr\.head\.sha/,
    message: "Do not key the Codex auto-resolve workflow on pr.head.sha.",
  },
  {
    pattern: /^\s*issue_comment:/m,
    message: "Do not trigger Codex auto-resolve from issue_comment events.",
  },
  {
    pattern: /^\s*pull_request_review:/m,
    message: "Do not trigger Codex auto-resolve from whole pull_request_review events.",
  },
];

for (const { pattern, message } of forbiddenPatterns) {
  if (pattern.test(workflow)) {
    failures.push(message);
  }
}

if (!workflow.includes("group: codex-autoresolve-${{ github.event.pull_request.number }}")) {
  failures.push("Codex auto-resolve concurrency must be scoped to the pull request number only.");
}

if (!workflow.includes("codex-autoresolve-pr:${pr.number}")) {
  failures.push("Codex auto-resolve marker must be scoped to the pull request, not the head SHA.");
}

if (!workflow.includes('sourceBody.includes("@codex resolve all review comments")')) {
  failures.push("Codex auto-resolve workflow must skip comments that already look like resolve requests.");
}

if (failures.length > 0) {
  console.error(`Codex auto-resolve workflow guard failed for ${workflowPath}:`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Codex auto-resolve workflow guard passed.");
