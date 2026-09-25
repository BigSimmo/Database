import fs from "node:fs";
import path from "node:path";

import { requiredCheckForgeryFindings, workflowTriggers } from "./pr-policy.mjs";
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
    assertMigrationHistoryControls(validateStep);
    assertNoOwnerApprovalHold(validateStep);
  }

  // Read-only scopes only: contents for the trusted checkout and repos.getContent,
  // pull-requests for PR metadata and the changed-file list. No writes.
  const permissionLines = yamlBlock(workflow, "permissions:", 0)
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.replace(/#.*$/, "").trim())
    .filter(Boolean);
  const expectedPermissions = ["contents: read", "pull-requests: read"];
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

function assertMigrationHistoryControls(step) {
  if (!/enforceMigrationHistory:\s*true\b/.test(step)) {
    failures.push("PR policy validation must call evaluatePullRequestPolicy with enforceMigrationHistory: true.");
  }
  if (!/\bbaseMigrationVersions,/.test(step)) {
    failures.push("PR policy validation must pass baseMigrationVersions to the policy.");
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

  // Migration-history override needs added migration contents from the PR head (API read only).
  if (!step.includes("github.rest.repos.getContent") || !step.includes("addedMigrationContents")) {
    failures.push(
      "PR policy validation must fetch added migration contents via repos.getContent at the PR head and pass addedMigrationContents to the policy.",
    );
  }
  if (!/ref:\s*latestPr\.head\.sha\b/.test(step)) {
    failures.push("PR policy validation must read added migration blobs at latestPr.head.sha.");
  }

  // Forgery tripwire inputs: changed workflow contents read at the PR head via the API.
  if (!/\bchangedWorkflowContents,/.test(step) || !/changedWorkflowContents\[file\.filename\]\s*=/.test(step)) {
    failures.push(
      "PR policy validation must read changed workflow contents at the PR head and pass changedWorkflowContents to the policy.",
    );
  }
}

function assertNoOwnerApprovalHold(step) {
  if (
    /OWNER_APPROVAL|OWNER_APPROVED|ownerApproval|ownerMergeReasons|ownerHoldViaStatus|ownerApprovalCommitStatus|createCommitStatus|removeLabel|ownerApprovalCoversHead|workflowRunRecordsPrHead|ownerActorMatches/.test(
      step,
    )
  ) {
    failures.push(
      "PR policy validation must not implement the retired owner-approval hold (label, status, or run-record binding).",
    );
  }
  if (/statuses:\s*write|actions:\s*read|pull-requests:\s*write/.test(workflow)) {
    failures.push(
      "pr-policy.yml must not declare statuses: write, actions: read, or pull-requests: write — those existed only for the owner-approval hold.",
    );
  }
  if (/\blabeled\b|\bunlabeled\b/.test(workflow.match(/types:\s*\[[^\]]*\]/)?.[0] ?? "")) {
    failures.push(
      "pr-policy.yml must not listen for labeled/unlabeled events — those existed only for the owner-approved label.",
    );
  }
  if (!/if \(latestPr\.draft\)/.test(step)) {
    failures.push("PR policy validation must still early-return for draft PRs.");
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

const triggers = workflowTriggers(workflow) ?? [];
const allowedTriggers = new Set(["pull_request_target", "merge_group"]);
if (triggers.length === 0 || triggers.some((trigger) => !allowedTriggers.has(trigger))) {
  failures.push(
    `pr-policy.yml may trigger only on pull_request_target and merge_group (found: ${triggers.join(", ") || "unreadable"}).`,
  );
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
