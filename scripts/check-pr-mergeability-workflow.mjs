#!/usr/bin/env node
/**
 * Contract guard for .github/workflows/pr-mergeability.yml.
 * Mirrors the trusted pull_request_target shape used by pr-policy.yml so the
 * conflict signal never executes PR-head code or mutates branches.
 */
import fs from "node:fs";
import { yamlBlock } from "./yaml-contract.mjs";

const workflowPath = ".github/workflows/pr-mergeability.yml";
const workflow = fs.readFileSync(workflowPath, "utf8");
const githubScriptPin = "3a2844b7e9c422d3c10d287c895573f7108da1b3";
const checkoutPin = "3d3c42e5aac5ba805825da76410c181273ba90b1";
const failures = [];

function collectCheckoutRefs(block) {
  return block
    .split(/\r?\n/)
    .map((line) => line.match(/^\s+ref:\s*(.+?)\s*(?:#.*)?$/)?.[1]?.trim())
    .filter(Boolean);
}

if (!/^on:\s*$/m.test(workflow) || !workflow.includes("pull_request_target:")) {
  failures.push("pr-mergeability.yml must trigger on pull_request_target.");
}
if (/^\s*pull_request:\s*$/m.test(workflow)) {
  failures.push("pr-mergeability.yml must not use pull_request (that event is skipped when the merge ref is missing).");
}
if (
  !/^permissions:\s*$/m.test(workflow) ||
  !workflow.includes("contents: read") ||
  !workflow.includes("pull-requests: read")
) {
  failures.push("pr-mergeability.yml must declare read-only workflow permissions.");
}
if (/pull-requests:\s*write/.test(workflow) || /contents:\s*write/.test(workflow)) {
  failures.push("pr-mergeability.yml must not request write permissions.");
}
if (/updateBranch|update-branch|sync:pr-branches:apply|sync-open-pr-branches\.mjs\s+--apply/.test(workflow)) {
  failures.push("pr-mergeability.yml must not mutate PR branches.");
}

const job = yamlBlock(workflow, "mergeability:", 2);
if (!job) {
  failures.push("pr-mergeability.yml is missing the mergeability job.");
} else {
  if (!/runs-on:\s*ubuntu-24\.04/.test(job)) {
    failures.push("pr-mergeability job must pin runs-on to ubuntu-24.04.");
  }
  const checkoutStep = yamlBlock(job, "- name: Checkout trusted classifier", 6);
  if (!checkoutStep) {
    failures.push("pr-mergeability job is missing the trusted checkout step.");
  } else {
    if (!checkoutStep.includes(`uses: actions/checkout@${checkoutPin}`)) {
      failures.push("pr-mergeability checkout must use the pinned actions/checkout SHA.");
    }
    const refs = collectCheckoutRefs(checkoutStep);
    if (!refs.includes("${{ github.workflow_sha }}")) {
      failures.push("pr-mergeability checkout must use github.workflow_sha.");
    }
    if (refs.some((ref) => /pull_request\.head|base_ref|pull_request\.base\.sha/.test(ref))) {
      failures.push("pr-mergeability checkout must not use untrusted PR refs.");
    }
    if (!/persist-credentials:\s*false/.test(checkoutStep) || /persist-credentials:\s*true/.test(checkoutStep)) {
      failures.push("pr-mergeability checkout must set persist-credentials: false.");
    }
  }

  const signalStep = yamlBlock(job, "- name: Signal real merge conflicts", 6);
  if (!signalStep) {
    failures.push("pr-mergeability job is missing the conflict signal step.");
  } else {
    if (!signalStep.includes(`uses: actions/github-script@${githubScriptPin} # v9.0.0`)) {
      failures.push("pr-mergeability signal step must use the pinned github-script action.");
    }
    if (!signalStep.includes("GITHUB_WORKSPACE}/scripts/pr-mergeability.mjs")) {
      failures.push("pr-mergeability signal step must import scripts/pr-mergeability.mjs from the trusted checkout.");
    }
    if (!signalStep.includes("github.rest.pulls.get")) {
      failures.push("pr-mergeability signal step must refresh PR metadata before classifying.");
    }
    if (!signalStep.includes("classifyMergeability")) {
      failures.push("pr-mergeability signal step must call classifyMergeability.");
    }
  }
}

if (failures.length > 0) {
  console.error("PR mergeability workflow guard failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("PR mergeability workflow guard passed.");
