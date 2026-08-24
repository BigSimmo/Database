import fs from "node:fs";
import {
  yamlBlock,
  yamlContractSyntaxFailures,
  yamlMappingKeys,
  yamlScalar,
  yamlSequenceItems,
} from "./yaml-contract.mjs";

const workflowPath = process.argv[2] ?? ".github/workflows/codex-autofix-review-comments.yml";
const workflow = fs.readFileSync(workflowPath, "utf8");

const failures = [];
const githubScriptPin = "3a2844b7e9c422d3c10d287c895573f7108da1b3";
const removedRepairSecret = ["CODEX", "TRIGGER", "TOKEN"].join("_");
const resolvedDispositionMarker = "<!-- codex-thread-disposition:resolved -->";

const forbiddenPatterns = [
  {
    pattern: new RegExp(removedRepairSecret),
    message: "The thread-resolution workflow must not read the removed repair-trigger secret.",
  },
  {
    pattern: /@codex/i,
    message: "The workflow must never post or embed a Codex repair command; repair invocation is human-authored.",
  },
  {
    pattern: /^\s{2}pull_request_review:\s*$/m,
    message: "A submitted Codex review must not trigger an automatic repair pass.",
  },
  {
    pattern: /^\s{2}issue_comment:\s*$/m,
    message: "Issue comments are not an authorized workflow repair trigger.",
  },
  {
    pattern:
      /request-codex-autoresolve|Ask Codex to resolve|scopedResolveCommand|routeReasons|highRiskPathPatterns|complexSource(?:File|Churn)Threshold/,
    message: "Automatic repair request and risk-routing logic must not remain in the resolution-only workflow.",
  },
  {
    pattern: /(?:issues|pulls)\.createComment|createReplyForReviewComment|addComment\s*\(/,
    message: "The resolution-only workflow must not create a repair-request comment or reply.",
  },
  {
    pattern: /contains\(\s*github\.event\.comment\.user\.login/,
    message:
      "Do not authorize the Codex connector with a substring login match; require an exact trusted bot identity.",
  },
  {
    pattern: /^concurrency:/m,
    message: "Concurrency must be scoped to the resolution job and pull request.",
  },
  {
    pattern: /^\s*contents:\s*write\s*$/m,
    message: "Do not grant content write permission to the thread-resolution bridge.",
  },
  {
    pattern: /pr\.head\.sha/,
    message: "Do not trust the event payload head for fixed-thread resolution; query the live pull request head.",
  },
  {
    pattern: /uses:\s*actions\/github-script@v\d+/,
    message: "Do not use a mutable github-script tag; pin the reviewed action commit.",
  },
];

for (const { pattern, message } of forbiddenPatterns) {
  if (pattern.test(workflow)) failures.push(message);
}
for (const syntaxFailure of yamlContractSyntaxFailures(workflow)) {
  failures.push(`YAML contract rejected ${syntaxFailure}.`);
}

const requiredChecks = [
  ["trigger", "  pull_request_review_comment:"],
  ["trigger", "    types: [created]"],
  ["open pull request gate", "github.event.pull_request.state == 'open'"],
  ["event-name gate", "github.event_name == 'pull_request_review_comment'"],
  ["workflow token binding", "github-token: ${{ github.token }}"],
  ["bounded job", "    timeout-minutes: 10"],
  ["pinned action", `uses: actions/github-script@${githubScriptPin} # v9.0.0`],
  ["event bot type", "github.event.comment.user.type == 'Bot'"],
  ["exact connector identity", "github.event.comment.user.login == 'chatgpt-codex-connector'"],
  ["exact connector bot identity", "github.event.comment.user.login == 'chatgpt-codex-connector[bot]'"],
  ["runtime bot type", 'reviewComment.user?.type !== "Bot"'],
  ["runtime exact identity", "!allowedCodexBotLogins.has(reviewComment.user.login)"],
  ["reply relationship gate", "!reviewComment.in_reply_to_id"],
  ["exact disposition marker", `const resolvedDispositionMarker = "${resolvedDispositionMarker}"`],
  ["exact first marker line", "dispositionLine !== resolvedDispositionMarker"],
  ["exact second result line", "declaredResultLines[0] !== resultLine"],
  ["exclusive result validation", "Boolean(fixedHeadMatch) === isNoChangeDisposition"],
  ["fixed-head result", "codex-thread-result:fixed-head:([0-9a-f]{40})"],
  ["no-change result", "codex-thread-result:no-change"],
  ["live head query", "headRefOid"],
  ["live state query", "state"],
  ["live current-head validation", "liveHeadRefOid !== fixedHeadMatch[1]"],
  [
    "reply and parent relationship validation",
    "targetCommentIds.every((commentId) => threadCommentIds.has(commentId))",
  ],
  ["paginated thread lookup", "reviewThreads(first: 100, after: $cursor)"],
  ["paginated nested comment lookup", "comments(first: 100, after: $commentsCursor)"],
  ["immediate resolution preflight", "query ResolutionPreflight"],
  ["post-resolution validation", "query ResolutionPostflight"],
  ["thread resolution mutation", "resolveReviewThread(input: { threadId: $threadId })"],
  ["compensating thread mutation", "unresolveReviewThread(input: { threadId: $threadId })"],
  ["single compensation helper", "const compensateResolutionFailure = async (threadId, reason) =>"],
  ["resolution-attempt marker", "let resolutionAttempted = false"],
  ["pre-mutation attempt assignment", "resolutionAttempted = true"],
  ["resolution confirmation", "resolution.resolveReviewThread?.thread?.isResolved !== true"],
  ["postflight thread identity", "postflight.node?.id !== matchingThread.id"],
  ["visible failure", "core.setFailed("],
];

for (const [kind, requiredCheck] of requiredChecks) {
  if (!workflow.includes(requiredCheck)) {
    failures.push(`Codex thread-resolution workflow is missing ${kind}: ${requiredCheck}`);
  }
}

const triggerBlock = yamlBlock(workflow, "on:", 0);
const rootKeys = yamlMappingKeys(workflow, 0);
if (rootKeys.join(",") !== "name,on,permissions,jobs") {
  failures.push("Codex thread-resolution workflow must use the exact root mapping set: name, on, permissions, jobs.");
}
const triggerKeys = yamlMappingKeys(triggerBlock, 2);
const reviewCommentTrigger = yamlBlock(triggerBlock, "pull_request_review_comment:", 2);
if (
  triggerKeys.length !== 1 ||
  triggerKeys[0] !== "pull_request_review_comment" ||
  yamlScalar(reviewCommentTrigger, "types", 4) !== "[created]"
) {
  failures.push("Codex thread-resolution workflow must use the exact pull_request_review_comment created event set.");
}

const jobsBlock = yamlBlock(workflow, "jobs:", 0);
const jobKeys = yamlMappingKeys(jobsBlock, 2);
if (jobKeys.length !== 1 || jobKeys[0] !== "resolve-codex-thread") {
  failures.push("Codex thread-resolution workflow must use the exact job set: resolve-codex-thread only.");
}

const resolutionJob = yamlBlock(jobsBlock, "resolve-codex-thread:", 2);
const workflowPermissions = yamlBlock(workflow, "permissions:", 0);
const jobPermissions = yamlBlock(resolutionJob, "permissions:", 4);
const hasExactPermissionAllowlist =
  yamlMappingKeys(workflowPermissions, 2).join(",") === "contents" &&
  yamlScalar(workflowPermissions, "contents", 2) === "read" &&
  yamlMappingKeys(jobPermissions, 6).join(",") === "contents,pull-requests" &&
  yamlScalar(jobPermissions, "contents", 6) === "read" &&
  yamlScalar(jobPermissions, "pull-requests", 6) === "write";
if (!hasExactPermissionAllowlist) {
  failures.push(
    "Codex thread-resolution workflow must use the exact effective permission allowlist: workflow contents read; job contents read plus pull-requests write.",
  );
}

const stepsBlock = yamlBlock(resolutionJob, "steps:", 4);
const stepItems = yamlSequenceItems(stepsBlock, 6);
const resolutionStep = yamlBlock(stepsBlock, "- name: Resolve Codex review thread on disposition marker", 6);
const stepWith = yamlBlock(resolutionStep, "with:", 8);
if (
  stepItems.length !== 1 ||
  stepItems[0] !== "name: Resolve Codex review thread on disposition marker" ||
  yamlScalar(resolutionStep, "uses", 8) !== `actions/github-script@${githubScriptPin}` ||
  yamlMappingKeys(stepWith, 10).join(",") !== "github-token,script" ||
  yamlScalar(stepWith, "github-token", 10) !== "${{ github.token }}" ||
  yamlScalar(stepWith, "script", 10) !== "|"
) {
  failures.push("Codex thread-resolution workflow must retain the exact pinned step and action wiring.");
}

const expectedConcurrencyGroup =
  "codex-thread-resolution-${{ github.event.pull_request.number }}-${{ github.event.comment.in_reply_to_id || github.event.comment.id }}";
const concurrencyBlock = yamlBlock(resolutionJob, "concurrency:", 4);
const hasExactParentThreadConcurrency =
  yamlMappingKeys(concurrencyBlock, 6).join(",") === "group,cancel-in-progress" &&
  yamlScalar(concurrencyBlock, "group", 6) === expectedConcurrencyGroup &&
  yamlScalar(concurrencyBlock, "cancel-in-progress", 6) === "false";
if (!hasExactParentThreadConcurrency) {
  failures.push("Codex thread-resolution workflow must use the exact PR-namespaced parent-thread concurrency group.");
}

const githubScriptPins = workflow.match(/uses:\s*actions\/github-script@[^\s]+/g) ?? [];
if (githubScriptPins.length !== 1) {
  failures.push("The resolution-only workflow must contain exactly one github-script step.");
}

const resolutionPreflightIndex = workflow.indexOf("const preflight = await github.graphql(resolutionPreflightQuery");
const resolutionMutationIndex = workflow.indexOf("const resolution = await github.graphql(resolveReviewThreadMutation");
const resolutionPostflightIndex = workflow.indexOf("const postflight = await github.graphql(resolutionPostflightQuery");
if (
  resolutionPreflightIndex === -1 ||
  resolutionMutationIndex === -1 ||
  resolutionPostflightIndex === -1 ||
  resolutionPreflightIndex > resolutionMutationIndex ||
  resolutionMutationIndex > resolutionPostflightIndex
) {
  failures.push("The live pull request state/head must be checked immediately before and after thread resolution.");
}

const executableUnresolveCalls = workflow.match(/github\.graphql\(unresolveReviewThreadMutation/g) ?? [];
if (executableUnresolveCalls.length !== 1 || workflow.includes("resolutionApplied")) {
  failures.push("Every post-resolution failure must use the single best-effort compensation helper.");
}

if (failures.length > 0) {
  console.error(`Codex thread-resolution workflow guard failed for ${workflowPath}:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Codex thread-resolution workflow guard passed.");
