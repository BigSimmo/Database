import fs from "node:fs";

const workflowPath = process.argv[2] ?? ".github/workflows/codex-autofix-review-comments.yml";
const agentInstructionsPath = "AGENTS.md";
const reviewProtocolPath = "docs/codex-review-protocol.md";
const workflow = fs.readFileSync(workflowPath, "utf8");
const agentInstructions = fs.readFileSync(agentInstructionsPath, "utf8");
const reviewProtocol = fs.readFileSync(reviewProtocolPath, "utf8");

const failures = [];
const githubScriptPin = "3a2844b7e9c422d3c10d287c895573f7108da1b3";
const scopedResolveCommand = "@codex resolve actionable Codex review findings for this pull request and current head";
const resolvedDispositionMarker = "<!-- codex-thread-disposition:resolved -->";
const scopedResolvePrompt = `\${scopedResolveCommand} using the repository instructions. This is the pull request's single automatic repair pass: do not perform a fresh review, create new standalone findings, or request another review. Work only the existing unresolved Codex threads on the current head. Always fix P0 and P1 findings. For P2 and lower findings, fix only clear, scoped, low-risk issues; otherwise disposition them with a concise reason. After fixing or dispositioning a thread, reply in that thread with \${resolvedDispositionMarker} as the first line, followed by a concise summary; that marker authorizes the workflow to close that exact thread. If human input or new authorization is required, do not use the marker and leave the thread open with the blocker. Finish only after every actionable thread is fixed or dispositioned and closed, or explicitly left open for a human decision. Do not update the branch from main, address unrelated reviews, broaden scope, or create more than one scoped fix commit. Do not use external APIs, paid services, credentials, dependency changes, or broad refactors unless explicitly authorized. Add targeted tests where behavior changes and run the narrowest relevant validation.`;

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
    pattern: /^\s*contents:\s*write\s*$/m,
    message: "Do not grant content write permission to the Codex auto-resolve bridge.",
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

for (const [path, contents] of [
  [agentInstructionsPath, agentInstructions],
  [reviewProtocolPath, reviewProtocol],
]) {
  if (/resolve all review comments/i.test(contents)) {
    failures.push(`${path} must not instruct Codex to resolve all review comments.`);
  }
}

if (!agentInstructions.includes(scopedResolveCommand)) {
  failures.push(`${agentInstructionsPath} must contain the scoped actionable-findings command.`);
}

if (!reviewProtocol.includes("If the user clearly asks to fix confirmed findings, make the smallest safe change")) {
  failures.push(`${reviewProtocolPath} must preserve the scoped fix boundary.`);
}

if (
  !reviewProtocol.includes("Ask before any OpenAI, Supabase, GitHub/GitLab, hosted CI, or provider-backed workflow")
) {
  failures.push(`${reviewProtocolPath} must preserve the provider confirmation boundary.`);
}

const requiredInstructionChecks = [
  [agentInstructionsPath, agentInstructions, "one automatic repair pass per pull request lifetime"],
  [agentInstructionsPath, agentInstructions, resolvedDispositionMarker],
  [reviewProtocolPath, reviewProtocol, "Treat GitHub automatic review as one pass per pull request"],
  [reviewProtocolPath, reviewProtocol, resolvedDispositionMarker],
  [reviewProtocolPath, reviewProtocol, "Do not start a new review"],
];

for (const [path, contents, requiredCheck] of requiredInstructionChecks) {
  if (!contents.includes(requiredCheck)) {
    failures.push(`${path} is missing automatic review lifecycle guidance: ${requiredCheck}`);
  }
}

const requiredTriggerAndPermissionChecks = [
  "  pull_request_review_comment:",
  "    types: [created]",
  "  contents: read",
  "  issues: write",
  "  models: read",
  "  pull-requests: write",
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

if (!workflow.includes("codex-autoresolve-pr:${pr.number}")) {
  failures.push("Codex auto-resolve marker must be scoped to the pull request for a single lifetime pass.");
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

const requiredThreadResolutionChecks = [
  `const resolvedDispositionMarker = "${resolvedDispositionMarker}"`,
  "replyBody.startsWith(resolvedDispositionMarker)",
  "reviewThreads(first: 100, after: $cursor)",
  "resolveReviewThread(input: { threadId: $threadId })",
  "pull-requests: write",
  "core.setFailed(message)",
];

for (const requiredCheck of requiredThreadResolutionChecks) {
  if (!workflow.includes(requiredCheck)) {
    failures.push(`Codex auto-resolve workflow is missing direct review-thread resolution: ${requiredCheck}`);
  }
}

const requiredDedupeChecks = [
  'comment.user?.type === "Bot"',
  'comment.user.login === "github-actions[bot]"',
  "const maxAutoResolveRequests = 1",
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

if (!workflow.includes(`const resolvedDispositionMarker = "${resolvedDispositionMarker}";`)) {
  failures.push("Codex auto-resolve workflow must define the resolved thread disposition marker exactly once.");
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
