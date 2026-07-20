import fs from "node:fs";

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
  }

  if (
    !/^permissions:\s*$/m.test(workflow) ||
    !workflow.includes("contents: read") ||
    !workflow.includes("pull-requests: read")
  ) {
    failures.push("pr-policy.yml must declare read-only workflow permissions.");
  }
  if (/pull-requests:\s*write/.test(policyJob) || /contents:\s*write/.test(policyJob)) {
    failures.push("pr-policy.yml policy job must not request write permissions.");
  }
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
