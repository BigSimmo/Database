import fs from "node:fs";
import path from "node:path";

import { OWNER_APPROVAL_CONTEXT, requiredCheckForgeryFindings, workflowTriggers } from "./pr-policy.mjs";
import { yamlBlock } from "./yaml-contract.mjs";

const workflowPath = ".github/workflows/pr-policy.yml";
const ciWorkflowPath = ".github/workflows/ci.yml";
const workflow = fs.readFileSync(workflowPath, "utf8");
const ciWorkflow = fs.readFileSync(ciWorkflowPath, "utf8");
const githubScriptPin = "3a2844b7e9c422d3c10d287c895573f7108da1b3";

const failures = [];

function collectCheckoutRefs(block) {
  return block
    .split(/\r?\n/)
    .map((line) => line.match(/^\s+ref:\s*(.+?)\s*(?:#.*)?$/)?.[1]?.trim())
    .filter(Boolean);
}

function assertCheckoutRefs(block, label, { allowed = [], forbidden = [] }) {
  const refs = collectCheckoutRefs(block);
  for (const ref of refs) {
    if (forbidden.some((pattern) => pattern.test(ref))) {
      failures.push(`${label} must not checkout untrusted ref ${ref}.`);
    }
    if (allowed.length > 0 && !allowed.includes(ref)) {
      failures.push(`${label} checkout ref ${ref} is not in the allowed trusted set.`);
    }
  }
  if (refs.length === 0) {
    failures.push(`${label} is missing an actions/checkout ref declaration.`);
  }
}

function assertPersistCredentialsFalse(block, label) {
  if (!/persist-credentials:\s*false/.test(block)) {
    failures.push(`${label} must set persist-credentials: false on checkout steps.`);
  }
  if (/persist-credentials:\s*true/.test(block)) {
    failures.push(`${label} must not persist checkout credentials.`);
  }
}

const policyJob = yamlBlock(workflow, "policy:", 2);
if (!policyJob) {
  failures.push("pr-policy.yml is missing the policy job.");
} else {
  const checkoutStep = yamlBlock(policyJob, "- name: Checkout trusted policy", 6);
  if (!checkoutStep) {
    failures.push("pr-policy.yml policy job is missing the trusted checkout step.");
  } else {
    assertCheckoutRefs(checkoutStep, "PR policy trusted checkout", {
      allowed: ["${{ github.workflow_sha }}"],
      forbidden: [/github\.event\.pull_request\.head/, /github\.base_ref/, /github\.event\.pull_request\.base\.sha/],
    });
    assertPersistCredentialsFalse(checkoutStep, "PR policy trusted checkout");
  }

  const validateStep = yamlBlock(policyJob, "- name: Validate pull request evidence", 6);
  if (!validateStep) {
    failures.push("pr-policy.yml policy job is missing the validation step.");
  } else {
    if (!validateStep.includes("GITHUB_WORKSPACE}/scripts/pr-policy.mjs")) {
      failures.push("PR policy validation must import scripts/pr-policy.mjs from the trusted checkout.");
    }
    if (!validateStep.includes(`uses: actions/github-script@${githubScriptPin} # v9.0.0`)) {
      failures.push("PR policy validation must use the pinned github-script action.");
    }
    if (!validateStep.includes("github.rest.pulls.get")) {
      failures.push("PR policy validation must fetch the latest PR metadata before evaluating policy.");
    }
    if (
      !validateStep.includes("latestPr.title") ||
      !validateStep.includes("latestPr.body") ||
      !validateStep.includes("latestPr.draft") ||
      !validateStep.includes("latestPr.head.ref")
    ) {
      failures.push("PR policy validation must use refreshed PR metadata for draft, title, body, and head ref.");
    }
    assertOwnerMergeControls(validateStep);
    assertOwnerApprovalStatusControls(validateStep);
  }

  // Two write scopes: pull-requests: write, for removing the stale owner-approved label, and
  // statuses: write, for the `Owner approval` commit status; actions: read lists this
  // workflow's run records to bind approval to the head. Exactly four, declared once at
  // workflow level, where this guard can see all of them.
  const permissionLines = yamlBlock(workflow, "permissions:", 0)
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.replace(/#.*$/, "").trim())
    .filter(Boolean);
  const expectedPermissions = ["contents: read", "pull-requests: write", "statuses: write", "actions: read"];
  if (
    permissionLines.length !== expectedPermissions.length ||
    !expectedPermissions.every((permission) => permissionLines.includes(permission))
  ) {
    failures.push(
      `pr-policy.yml must declare exactly \`${expectedPermissions.join("`, `")}\` at workflow level (found: ${permissionLines.join(", ") || "none"}).`,
    );
  }
  if (/^\s+permissions:/m.test(policyJob)) {
    failures.push("pr-policy.yml policy job must not override the workflow-level permissions.");
  }
}

function indexOfOrInfinity(source, needle) {
  const index = source.indexOf(needle);
  return index < 0 ? Number.POSITIVE_INFINITY : index;
}

function assertOwnerMergeControls(step) {
  // Owner-merge hold and migration history guard (scripts/pr-policy.mjs, C0).
  if (!/enforceOwnerMerge:\s*true\b/.test(step)) {
    failures.push("PR policy validation must call evaluatePullRequestPolicy with enforceOwnerMerge: true.");
  }
  if (!/\bownerApproval,/.test(step) || !/\bbaseMigrationVersions,/.test(step)) {
    failures.push("PR policy validation must pass ownerApproval and baseMigrationVersions to the policy.");
  }
  if (!/fileStatuses:\s*changedFiles\.map/.test(step) || !step.includes("previous_filename")) {
    failures.push(
      "PR policy validation must pass fileStatuses (filename, status, previous_filename) from pulls.listFiles.",
    );
  }

  // Applied migration versions come from the trusted checkout, never the PR head.
  if (!/readdirSync\(\s*`\$\{process\.env\.GITHUB_WORKSPACE\}\/supabase\/migrations`\s*,?\s*\)/.test(step)) {
    failures.push(
      "PR policy validation must read baseMigrationVersions with fs.readdirSync(`${process.env.GITHUB_WORKSPACE}/supabase/migrations`) from the trusted checkout.",
    );
  }
  if (!/baseMigrationVersions\.length === 0/.test(step)) {
    failures.push("PR policy validation must fail closed when the trusted checkout lists no migration versions.");
  }

  // Label removal: exactly one call, gated on a push-like action, before the draft return.
  const removals = step.match(/github\.rest\.issues\.removeLabel\(/g) ?? [];
  if (removals.length !== 1) {
    failures.push(
      `PR policy validation must remove the owner-approved label in exactly one place (found ${removals.length}).`,
    );
  } else {
    const removalIndex = step.indexOf("github.rest.issues.removeLabel(");
    const guard = step
      .slice(0, removalIndex)
      .split(/\r?\n/)
      .reverse()
      .find((line) => /^\s*if \(/.test(line));
    if (!guard || !guard.includes("context.payload.action") || !guard.includes('"synchronize"')) {
      failures.push(
        "PR policy validation must gate owner-approved label removal on context.payload.action including synchronize.",
      );
    }
    if (removalIndex > indexOfOrInfinity(step, "if (latestPr.draft)")) {
      failures.push(
        "PR policy validation must remove a stale owner-approved label before the draft early-return, so a draft cannot carry approval across a push.",
      );
    }
    if (removalIndex > indexOfOrInfinity(step, "evaluatePullRequestPolicy({")) {
      failures.push("PR policy validation must remove a stale owner-approved label before evaluating policy.");
    }
  }
  if (!/error\?\.status !== 404/.test(step)) {
    failures.push("PR policy validation must ignore only a 404 when removing the label, and fail closed otherwise.");
  }

  // Approval: the most recent labeled event, never a GitHub App, and only the repository owner.
  if (!step.includes("github.rest.issues.listEvents") || !step.includes('event.event === "labeled"')) {
    failures.push("PR policy validation must read the owner-approved labeled events to verify approval.");
  }
  if (!step.includes("performed_via_github_app") || !/rejectedReason:/.test(step)) {
    failures.push("PR policy validation must reject an owner-approved label applied through a GitHub App.");
  }
  if (
    !step.includes("ownerActorMatches({") ||
    !/actorLogin:\s*labeled\.actor\?\.login/.test(step) ||
    !/ownerLogin:\s*context\.repo\.owner/.test(step)
  ) {
    failures.push(
      "PR policy validation must require ownerActorMatches({ actorLogin: labeled.actor?.login, ownerLogin: context.repo.owner }).",
    );
  }

  // Approval is bound to the current PR head by run records that name that head — not by
  // GITHUB_SHA (base under pull_request_target) and not by the label strip completing.
  const runsCall = step.match(/github\.paginate\(github\.rest\.actions\.listWorkflowRuns,\s*\{([^}]*)\}\)/);
  if (!runsCall) {
    failures.push(
      "PR policy validation must list PR policy workflow runs with github.paginate(github.rest.actions.listWorkflowRuns, { ... }).",
    );
  } else {
    const runArgs = runsCall[1];
    if (
      !/workflow_id:\s*"pr-policy\.yml"/.test(runArgs) ||
      !/event:\s*"pull_request_target"/.test(runArgs) ||
      !/branch:\s*latestPr\.head\.ref\b/.test(runArgs)
    ) {
      failures.push(
        'PR policy validation must list runs for workflow_id "pr-policy.yml", event "pull_request_target", branch latestPr.head.ref.',
      );
    }
    if (/\bhead_sha\s*:/.test(runArgs)) {
      failures.push(
        "PR policy validation must not pass head_sha to listWorkflowRuns; bind via workflowRunRecordsPrHead on run.head_sha instead (GITHUB_SHA is the base under pull_request_target).",
      );
    }
    if (/\b(?:status|conclusion|created|exclude_pull_requests)\s*:/.test(runArgs)) {
      failures.push(
        "PR policy validation must not filter head runs by status, conclusion or date — cancelled runs are part of the head's record.",
      );
    }
  }
  if (!step.includes("workflowRunRecordsPrHead(run,") || !/headSha:\s*latestPr\.head\.sha\b/.test(step)) {
    failures.push(
      "PR policy validation must filter listed runs with workflowRunRecordsPrHead(run, { headSha: latestPr.head.sha, ... }).",
    );
  }
  if (/\bconclusion\b/.test(step)) {
    failures.push("PR policy validation must not filter head runs by conclusion; cancelled runs count.");
  }
  const bindingIndex = step.indexOf("ownerApprovalCoversHead({");
  const approvals = step.match(/approved:\s*true\b/g) ?? [];
  if (bindingIndex < 0 || !/labeledAt:\s*labeled\.created_at\b/.test(step)) {
    failures.push(
      "PR policy validation must bind approval with ownerApprovalCoversHead({ labeledAt: labeled.created_at, ... }).",
    );
  } else if (approvals.length !== 1 || step.indexOf(approvals[0]) < bindingIndex) {
    failures.push(
      "PR policy validation may grant approval in exactly one place, after ownerApprovalCoversHead has bound it to the current head.",
    );
  } else if (!/binding\.covered\s*\?\s*\{\s*approved:\s*true\b/.test(step)) {
    failures.push("PR policy validation must grant approval only when ownerApprovalCoversHead reports covered.");
  }
  // Owner actor match must reject before the sole approved:true grant.
  const actorReject = step.indexOf("ownerActorMatches({");
  if (actorReject < 0 || actorReject > bindingIndex) {
    failures.push("PR policy validation must check ownerActorMatches before binding approval to the head.");
  }

  // Migration-history override needs added migration contents from the PR head (API read only).
  if (!step.includes("github.rest.repos.getContent") || !step.includes("addedMigrationContents")) {
    failures.push(
      "PR policy validation must fetch added migration contents via repos.getContent at the PR head and pass addedMigrationContents to the policy.",
    );
  }
  if (!/ref:\s*latestPr\.head\.sha\b/.test(step)) {
    failures.push("PR policy validation must read added migration blobs at latestPr.head.sha.");
  }
}

function assertOwnerApprovalStatusControls(step) {
  // Status writes are last-write-wins, so runs for one PR must serialize: a cancelled run's
  // in-flight write could otherwise land after a newer run's verdict.
  const concurrency = yamlBlock(workflow, "concurrency:", 0);
  if (!/^\s+cancel-in-progress:\s*false\s*$/m.test(concurrency) || /cancel-in-progress:\s*true/.test(concurrency)) {
    failures.push(
      "pr-policy.yml concurrency must set cancel-in-progress: false so Owner approval status writers cannot interleave.",
    );
  }

  // statuses: write is safe here only because this workflow never runs branch code. A
  // pull_request / push / workflow_dispatch trigger would run the branch's own copy of this
  // file with that token, which is exactly how a required status gets forged.
  const triggers = workflowTriggers(workflow) ?? [];
  const allowedTriggers = new Set(["pull_request_target", "merge_group"]);
  if (triggers.length === 0 || triggers.some((trigger) => !allowedTriggers.has(trigger))) {
    failures.push(
      `pr-policy.yml may trigger only on pull_request_target and merge_group while it holds statuses: write (found: ${triggers.join(", ") || "unreadable"}).`,
    );
  }

  // One writer, one context.
  const statusWrites = step.match(/github\.rest\.repos\.createCommitStatus\(/g) ?? [];
  if (statusWrites.length !== 1 || !/context:\s*OWNER_APPROVAL_CONTEXT,/.test(step)) {
    failures.push(
      `PR policy validation must write commit statuses through exactly one createCommitStatus call with context: OWNER_APPROVAL_CONTEXT (found ${statusWrites.length}).`,
    );
  }
  if (/\bchecks\.create\b|checks:\s*write/.test(workflow)) {
    failures.push("pr-policy.yml must not create check runs; the hold is reported as a commit status.");
  }

  // States come only from ownerApprovalCommitStatus, except the literal pending set first.
  // No literal success, and never neutral/failure/error, which would pass or turn it red.
  if (/state:\s*["'](?:success|neutral|failure|error)["']/.test(step)) {
    failures.push(
      "PR policy validation must not hard-code an Owner approval success/neutral/failure/error state; states come from ownerApprovalCommitStatus.",
    );
  }

  const pendingFirst = step.search(/setOwnerApprovalStatus\(latestPr\.head\.sha,\s*\{\s*state:\s*"pending",/);
  if (pendingFirst < 0) {
    failures.push("PR policy validation must mark the PR head's Owner approval status pending before evaluating it.");
  } else {
    for (const [needle, label] of [
      ["github.rest.issues.removeLabel(", "the stale-label removal"],
      ["if (latestPr.draft)", "the draft early-return"],
      ["github.rest.issues.listEvents", "reading label events"],
      ["evaluatePullRequestPolicy({", "evaluating policy"],
    ]) {
      if (pendingFirst > indexOfOrInfinity(step, needle)) {
        failures.push(`PR policy validation must mark Owner approval pending before ${label}.`);
      }
    }
  }

  const draftIndex = step.indexOf("if (latestPr.draft)");
  const draftBlock = draftIndex < 0 ? "" : step.slice(draftIndex, step.indexOf("return;", draftIndex));
  if (
    !/setOwnerApprovalStatus\(latestPr\.head\.sha,\s*ownerApprovalCommitStatus\(\{\s*draft:\s*true\s*\}\)\)/.test(
      draftBlock,
    )
  ) {
    failures.push(
      "PR policy validation must report a draft PR's Owner approval status as ownerApprovalCommitStatus({ draft: true }).",
    );
  }

  const finalIndex = step.indexOf(
    "let approvalStatus = ownerApprovalCommitStatus({ ...statusInputs, otherPrsSharingHead });",
  );
  if (
    finalIndex < 0 ||
    finalIndex < indexOfOrInfinity(step, "evaluatePullRequestPolicy({") ||
    !/ownerMergeReasons:\s*result\.ownerMergeReasons,/.test(step) ||
    !/ownerApproved:\s*result\.ownerApproved,/.test(step)
  ) {
    failures.push(
      "PR policy validation must build the final Owner approval status from the evaluated result (result.ownerMergeReasons, result.ownerApproved).",
    );
  }
  // success only while the evaluated head is still the PR head.
  if (
    !/approvalStatus\.state === "success"/.test(step) ||
    !/headStillCurrent = currentPr\.head\.sha === latestPr\.head\.sha/.test(step) ||
    !/if \(headStillCurrent\)\s*\{\s*await setOwnerApprovalStatus\(latestPr\.head\.sha,\s*approvalStatus\)/.test(step)
  ) {
    failures.push(
      "PR policy validation must re-read the PR and post an Owner approval success only while latestPr.head.sha is still the head.",
    );
  }

  // A status belongs to the commit: success needs the list of OTHER open PRs sharing this
  // head (read from open PRs filtered by head sha), and that list is read again after a
  // success is written so a PR opened in between turns it back to pending.
  if (
    !/github\.paginate\(github\.rest\.pulls\.list,\s*\{\s*\.\.\.repo,\s*state:\s*"open"/.test(step) ||
    !/other\.head\?\.sha === latestPr\.head\.sha && other\.number !== latestPr\.number/.test(step) ||
    !/ownerApprovalCommitStatus\(\{\s*\.\.\.statusInputs,\s*otherPrsSharingHead\s*\}\)/.test(step)
  ) {
    failures.push(
      "PR policy validation must build the Owner approval status with otherPrsSharingHead, from open PRs whose head is latestPr.head.sha.",
    );
  }
  const successWrite = step.indexOf("await setOwnerApprovalStatus(latestPr.head.sha, approvalStatus);");
  const recheck = step.indexOf("sharedAfterWrite = await listOtherOpenPrsSharingHead();");
  if (successWrite < 0 || recheck < successWrite) {
    failures.push(
      "PR policy validation must re-list open PRs sharing the head after writing an Owner approval success, and re-post pending if one appeared.",
    );
  }

  // Forgery tripwire inputs: changed workflow contents read at the PR head via the API.
  if (!/\bchangedWorkflowContents,/.test(step) || !/changedWorkflowContents\[file\.filename\]\s*=/.test(step)) {
    failures.push(
      "PR policy validation must read changed workflow contents at the PR head and pass changedWorkflowContents to the policy.",
    );
  }
}

// The tripwire must not fire on the workflows already on this branch — otherwise an ordinary
// edit to any of them would be blocked — and a forging job added here fails this guard locally.
for (const directory of [".github/workflows", ".github/actions"]) {
  if (!fs.existsSync(directory)) continue;
  const surfaces = fs
    .readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.posix.join(path.relative(".", entry.parentPath).split(path.sep).join("/"), entry.name))
    .filter((file) => /^\.github\/(?:workflows\/[^/]+\.ya?ml$|actions\/)/i.test(file));
  const workflowContents = Object.fromEntries(surfaces.map((file) => [file, fs.readFileSync(file, "utf8")]));
  for (const finding of requiredCheckForgeryFindings({ files: surfaces, workflowContents })) {
    failures.push(`Required-check forgery tripwire: ${finding}`);
  }
}
if (!workflow.includes(OWNER_APPROVAL_CONTEXT) && !workflow.includes("OWNER_APPROVAL_CONTEXT")) {
  failures.push("pr-policy.yml must report the Owner approval commit status.");
}

// Whole-workflow: nothing in pr-policy.yml may check out or reference the PR head ref/sha.
if (/github\.event\.pull_request\.head\.(?:sha|ref)|github\.head_ref/.test(workflow)) {
  failures.push("pr-policy.yml must never reference the pull request head ref or sha.");
}
if ((workflow.match(/uses:\s*actions\/checkout@/g) ?? []).length !== 1) {
  failures.push("pr-policy.yml must contain exactly one actions/checkout step (the trusted policy checkout).");
}

const syncJob = yamlBlock(ciWorkflow, "sync-pr-policy-body:", 2);
if (!syncJob) {
  failures.push("ci.yml is missing the sync-pr-policy-body job.");
} else {
  const trustedCheckout = yamlBlock(syncJob, "- name: Checkout trusted policy metadata", 6);
  if (!trustedCheckout) {
    failures.push("sync-pr-policy-body is missing the trusted policy metadata checkout step.");
  } else {
    assertCheckoutRefs(trustedCheckout, "sync-pr-policy-body trusted policy checkout", {
      allowed: ["${{ github.event.pull_request.base.sha }}"],
      forbidden: [/github\.event\.pull_request\.head/],
    });
    assertPersistCredentialsFalse(trustedCheckout, "sync-pr-policy-body trusted policy checkout");
  }

  const applyStep = yamlBlock(syncJob, "- name: Apply PR_POLICY_BODY.md to pull request description", 6);
  if (!applyStep) {
    failures.push("sync-pr-policy-body is missing the PR body sync step.");
  } else {
    if (!applyStep.includes("trusted-policy/scripts/pr-policy.mjs")) {
      failures.push("sync-pr-policy-body must import pr-policy.mjs from the trusted base checkout only.");
    }
    if (!applyStep.includes("existingCheckedItems")) {
      failures.push("sync-pr-policy-body must preserve existing governance attestations.");
    }
    if (
      !applyStep.includes("github.rest.pulls.listFiles") ||
      !applyStep.includes('file.filename === "PR_POLICY_BODY.md"') ||
      !applyStep.includes('file.status === "added"') ||
      !applyStep.includes('file.status === "modified"')
    ) {
      failures.push(
        "sync-pr-policy-body must run only when PR_POLICY_BODY.md was added or modified by the current PR diff.",
      );
    }
    if (/map\(\(item\) => `\s*-\s*\[x\]/i.test(applyStep)) {
      failures.push("sync-pr-policy-body must not synthesize completed Clinical Governance Preflight items.");
    }
    if (/forceChecked|GOVERNANCE_ALL_CHECKED/.test(applyStep)) {
      failures.push(
        "sync-pr-policy-body must not let PR-head markers force-check Clinical Governance Preflight items.",
      );
    }
  }
}

if (failures.length > 0) {
  console.error("PR policy workflow guard failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("PR policy workflow guard passed.");
