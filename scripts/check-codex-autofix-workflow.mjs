import fs from "node:fs";

const workflowPath = process.argv[2] ?? ".github/workflows/codex-autofix-review-comments.yml";
const workflow = fs.readFileSync(workflowPath, "utf8");

const failures = [];
const githubScriptPin = "3a2844b7e9c422d3c10d287c895573f7108da1b3";
const scopedResolveCommand = "@codex resolve actionable Codex review findings for this pull request and current head";
const scopedResolvePrompt = `\${scopedResolveCommand} using the repository instructions. Always fix P0 and P1 findings. For P2 and lower findings, decide whether each is worth fixing automatically. Fix clear, scoped, low-risk issues with the best minimal change; otherwise reply explaining why the issue is deferred or not actionable. Do not update the branch from main, address unrelated reviews, broaden scope, or create more than one scoped fix commit unless explicitly asked. After each fix or decision, resolve the review conversation if supported. Do not use external APIs, paid services, credentials, dependency changes, or broad refactors unless explicitly authorized. Add targeted tests where behavior changes and run the narrowest relevant validation.`;

const forbiddenPatterns = [
  {
    pattern: /^\s*issue_comment:/m,
    message: "Do not trigger Codex auto-resolve from issue_comment events.",
  },
  {
    pattern: /^\s*pull_request_review:/m,
    message: "Do not trigger Codex auto-resolve from whole pull_request_review events.",
  },
  {
    pattern: /@codex resolve all review comments/,
    message: "Do not use the broad Codex resolve-all command; use the scoped actionable-findings command.",
  },
  {
    pattern: /contains\(\s*github\.event\.comment\.user\.login/,
    message:
      "Do not authorize the Codex connector with a substring login match; require an exact trusted bot identity.",
  },
  {
    pattern: /sourceBody\.includes\("codex-autoresolve(?:-pr)?:"\)/,
    message: "Do not treat an auto-resolve marker mentioned anywhere in a review finding as a self-triggered request.",
  },
  {
    pattern: /existingComments\.some\(\(comment\) => \(comment\.body \|\| ""\)\.includes\(marker\)\)/,
    message: "Do not trust auto-resolve markers from arbitrary pull request commenters.",
  },
  {
    pattern: /^concurrency:/m,
    message:
      "Do not apply Codex auto-resolve concurrency to the whole workflow; unrelated review comments must not displace an authorized pending job.",
  },
  {
    pattern: /^\s*(?:contents|pull-requests):\s*write\s*$/m,
    message: "Do not grant content or pull-request write permission to the Codex auto-resolve bridge.",
  },
  {
    pattern: /uses:\s*actions\/github-script@v\d+/,
    message: "Do not use a mutable github-script tag; pin the reviewed action commit.",
  },
];

for (const { pattern, message } of forbiddenPatterns) {
  if (pattern.test(workflow)) {
    failures.push(message);
  }
}

const requiredTriggerAndPermissionChecks = [
  "  pull_request_review_comment:",
  "    types: [created]",
  "  contents: read",
  "  issues: write",
  "  pull-requests: read",
  `uses: actions/github-script@${githubScriptPin} # v9.0.0`,
  "github.event.pull_request.state == 'open'",
];

for (const requiredCheck of requiredTriggerAndPermissionChecks) {
  if (!workflow.includes(requiredCheck)) {
    failures.push(`Codex auto-resolve workflow is missing trigger or permission check: ${requiredCheck}`);
  }
}

const requiredConcurrencyChecks = [
  "    concurrency:",
  "      group: codex-autoresolve-${{ github.event.pull_request.number }}",
  "      cancel-in-progress: false",
];

for (const requiredCheck of requiredConcurrencyChecks) {
  if (!workflow.includes(requiredCheck)) {
    failures.push(`Codex auto-resolve workflow is missing authorized job concurrency check: ${requiredCheck}`);
  }
}

if (!workflow.includes("codex-autoresolve:${pr.head.sha}")) {
  failures.push("Codex auto-resolve marker must be scoped to the pull request head SHA.");
}

const requiredIdentityChecks = [
  "github.event.comment.user.type == 'Bot'",
  "github.event.comment.user.login == 'chatgpt-codex-connector'",
  "github.event.comment.user.login == 'chatgpt-codex-connector[bot]'",
  'reviewComment.user?.type !== "Bot"',
  "!allowedCodexBotLogins.has(reviewComment.user.login)",
];

for (const requiredCheck of requiredIdentityChecks) {
  if (!workflow.includes(requiredCheck)) {
    failures.push(`Codex auto-resolve workflow is missing trusted connector identity check: ${requiredCheck}`);
  }
}

const requiredSelfTriggerChecks = [
  'sourceBody.startsWith("<!-- codex-autoresolve:")',
  'sourceBody.startsWith("<!-- codex-autoresolve-pr:")',
  "hasAutoResolveMarker && sourceBody.includes(scopedResolveCommand)",
];

for (const requiredCheck of requiredSelfTriggerChecks) {
  if (!workflow.includes(requiredCheck)) {
    failures.push(`Codex auto-resolve workflow is missing strict self-trigger check: ${requiredCheck}`);
  }
}

const requiredDedupeChecks = [
  'comment.user?.type === "Bot"',
  'comment.user.login === "github-actions[bot]"',
  "const maxAutoResolveRequests = 3",
  "const trustedExistingRequests = existingComments.filter(",
  '.trimStart().startsWith("<!-- codex-autoresolve")',
  '(comment.body || "").includes(marker)',
  "trustedExistingRequests.length >= maxAutoResolveRequests",
  "core.setFailed(message)",
];

for (const requiredCheck of requiredDedupeChecks) {
  if (!workflow.includes(requiredCheck)) {
    failures.push(`Codex auto-resolve workflow is missing trusted duplicate-marker check: ${requiredCheck}`);
  }
}

if (!workflow.includes(`uses: actions/github-script@${githubScriptPin} # v9.0.0`)) {
  failures.push("Codex auto-resolve workflow must use the reviewed immutable github-script pin.");
}

if (!workflow.includes(`const scopedResolveCommand = "${scopedResolveCommand}";`)) {
  failures.push("Codex auto-resolve workflow must define the scoped actionable-findings command exactly once.");
}

if (!workflow.includes(`\`${scopedResolvePrompt}\``)) {
  failures.push("Codex auto-resolve workflow must emit the scoped actionable-findings resolve prompt.");
}

if (failures.length > 0) {
  console.error(`Codex auto-resolve workflow guard failed for ${workflowPath}:`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Codex auto-resolve workflow guard passed.");
