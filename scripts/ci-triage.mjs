#!/usr/bin/env node
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

export function failedJobNames(jobs) {
  return [
    ...new Set(
      (jobs ?? [])
        .filter((job) => job.conclusion === "failure")
        .map((job) => job.name)
        .filter(Boolean),
    ),
  ];
}

export function selectLatestDefaultBranchRun(runs, { currentRunId, defaultBranch }) {
  return (runs ?? [])
    .filter(
      (run) =>
        run.id !== currentRunId &&
        run.event === "push" &&
        run.head_branch === defaultBranch &&
        run.status === "completed" &&
        Boolean(run.conclusion),
    )
    .sort(
      (left, right) =>
        Date.parse(right.run_started_at ?? right.created_at) - Date.parse(left.run_started_at ?? left.created_at),
    )[0];
}

export function classifyFailedJobs(failedNames, mainRun, mainFailedNames) {
  const mainFailures = new Set(mainRun?.conclusion === "failure" ? mainFailedNames : []);
  return failedNames.map((name) => ({
    name,
    classification: mainFailures.has(name) ? "main-side" : "needs-investigation",
  }));
}

export function buildTriageBody(classifications, mainRun) {
  const marker = "<!-- ci-triage -->";
  const lines = classifications.map(({ name, classification }) =>
    classification === "main-side"
      ? `- \`${name}\` — **main-side**: the same job also failed on the latest completed \`main\` CI run.`
      : `- \`${name}\` — **needs investigation**: inspect the failing step and uploaded diagnostics; rerun only after classifying the cause.`,
  );
  const baseline = mainRun
    ? `Compared with main CI run [#${mainRun.run_number}](${mainRun.html_url}) (${mainRun.conclusion}).`
    : "No completed main CI baseline was available; no failure was labeled main-side.";
  return [
    marker,
    "### CI triage",
    `CI failed on this PR. Automated classification of the ${classifications.length} failed job(s):`,
    "",
    ...lines,
    "",
    baseline,
    "",
    "_Classification is evidence routing, not permission to ignore a failure. Exact quarantined Playwright identities remain governed by the flake ledger._",
  ].join("\n");
}

function selfTest() {
  const runs = [
    {
      id: 2,
      event: "push",
      head_branch: "main",
      status: "completed",
      conclusion: "failure",
      run_started_at: "2026-07-17T02:00:00Z",
    },
    {
      id: 1,
      event: "push",
      head_branch: "main",
      status: "completed",
      conclusion: "success",
      run_started_at: "2026-07-17T01:00:00Z",
    },
    {
      id: 3,
      event: "pull_request",
      head_branch: "main",
      status: "completed",
      conclusion: "failure",
      run_started_at: "2026-07-17T03:00:00Z",
    },
  ];
  assert.equal(selectLatestDefaultBranchRun(runs, { currentRunId: 99, defaultBranch: "main" })?.id, 2);
  assert.deepEqual(
    failedJobNames([
      { name: "Build", conclusion: "failure" },
      { name: "Lint", conclusion: "success" },
    ]),
    ["Build"],
  );
  assert.deepEqual(classifyFailedJobs(["Build", "Lint"], runs[0], ["Build"]), [
    { name: "Build", classification: "main-side" },
    { name: "Lint", classification: "needs-investigation" },
  ]);
  assert.match(
    buildTriageBody([{ name: "Build", classification: "main-side" }], null),
    /No completed main CI baseline/,
  );
  console.error("[ci-triage] self-test passed");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes("--self-test")) selfTest();
  else {
    console.error("usage: ci-triage.mjs --self-test");
    process.exitCode = 1;
  }
}
