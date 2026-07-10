import fs from "node:fs";

const workflowPath = ".github/workflows/codex-autofix-review-comments.yml";
const agentInstructionsPath = "AGENTS.md";
const reviewProtocolPath = "docs/codex-review-protocol.md";
const workflow = fs.readFileSync(workflowPath, "utf8");
const agentInstructions = fs.readFileSync(agentInstructionsPath, "utf8");
const reviewProtocol = fs.readFileSync(reviewProtocolPath, "utf8");

const failures = [];
const scopedResolveCommand = "@codex resolve actionable Codex review findings for this pull request and current head";
const scopedResolvePrompt = `${scopedResolveCommand} using the repository instructions. Always fix P0 and P1 findings. For P2 and lower findings, decide whether each is worth fixing automatically. Fix clear, scoped, low-risk issues with the best minimal change; otherwise reply explaining why the issue is deferred or not actionable. Do not update the branch from main, address unrelated reviews, broaden scope, or create more than one scoped fix commit unless explicitly asked. After each fix or decision, resolve the review conversation if supported. Do not use external APIs, paid services, credentials, dependency changes, or broad refactors unless explicitly authorized. Add targeted tests where behavior changes and run the narrowest relevant validation.`;

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
  {
    pattern: /@codex resolve all review comments/,
    message: "Do not use the broad Codex resolve-all command; use the scoped actionable-findings command.",
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

if (!workflow.includes("group: codex-autoresolve-${{ github.event.pull_request.number }}")) {
  failures.push("Codex auto-resolve concurrency must be scoped to the pull request number only.");
}

if (!workflow.includes("codex-autoresolve-pr:${pr.number}")) {
  failures.push("Codex auto-resolve marker must be scoped to the pull request, not the head SHA.");
}

if (!workflow.includes(`sourceBody.includes("${scopedResolveCommand}")`)) {
  failures.push("Codex auto-resolve workflow must skip comments that already look like scoped resolve requests.");
}

if (!workflow.includes(`"${scopedResolvePrompt}"`)) {
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
