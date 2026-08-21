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

/**
 * Job names the baseline run actually EXECUTED — a `skipped` job verified nothing.
 *
 * CI is path-scoped, so a docs-only push to main reports `success` with Lighthouse, Production UI
 * and Build all skipped. Citing that run as the comparison made the triage comment read as
 * "main is green for this job" when main had never measured it: exactly how the mobile-`/` CLS
 * regression behind PR #2199 was waved through, and the same trap ledger `#5DYBQQ` records.
 */
export function executedJobNames(jobs) {
  return [
    ...new Set(
      (jobs ?? [])
        .filter((job) => job.conclusion && job.conclusion !== "skipped")
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

export function classifyFailedJobs(failedNames, mainRun, mainFailedNames, mainExecutedNames) {
  const mainFailures = new Set(mainRun?.conclusion === "failure" ? mainFailedNames : []);
  // Omitted (undefined) means the caller could not establish what the baseline ran, so every job
  // keeps its previous classification rather than being wrongly reported as unbaselined.
  const mainExecuted = mainExecutedNames === undefined ? null : new Set(mainExecutedNames);
  return failedNames.map((name) => {
    if (mainFailures.has(name)) return { name, classification: "main-side" };
    if (mainRun && mainExecuted && !mainExecuted.has(name)) return { name, classification: "unbaselined" };
    return { name, classification: "needs-investigation" };
  });
}

export function buildTriageBody(classifications, mainRun) {
  const marker = "<!-- ci-triage -->";
  const lines = classifications.map(({ name, classification }) => {
    if (classification === "main-side") {
      return `- \`${name}\` — **main-side**: the same job also failed on the latest completed \`main\` CI run.`;
    }
    if (classification === "unbaselined") {
      return (
        `- \`${name}\` — **not baselined**: this job did NOT run on the \`main\` comparison below ` +
        `(path-scoped skip), so that run says nothing about it either way. Treat the comparison as absent, ` +
        `not green, and inspect the failing step.`
      );
    }
    return `- \`${name}\` — **needs investigation**: inspect the failing step and uploaded diagnostics; rerun only after classifying the cause.`;
  });
  const unbaselined = classifications.filter(({ classification }) => classification === "unbaselined");
  const baseline = mainRun
    ? `Compared with main CI run [#${mainRun.run_number}](${mainRun.html_url}) (${mainRun.conclusion}).` +
      (unbaselined.length
        ? ` That run's conclusion is an aggregate and did not exercise ${unbaselined
            .map(({ name }) => `\`${name}\``)
            .join(", ")}.`
        : "")
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
      run_number: 1234,
      html_url: "https://github.com/o/r/actions/runs/1",
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
  assert.equal(selectLatestDefaultBranchRun([], { currentRunId: 99, defaultBranch: "main" }), undefined);
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
  assert.deepEqual(classifyFailedJobs(["Build"], null, []), [{ name: "Build", classification: "needs-investigation" }]);
  assert.deepEqual(
    executedJobNames([
      { name: "Build", conclusion: "success" },
      { name: "Lighthouse budget", conclusion: "skipped" },
      { name: "Queued", conclusion: null },
    ]),
    ["Build"],
  );
  // A green aggregate that skipped the failing job must not read as a green baseline for it.
  const skippedBaseline = classifyFailedJobs(["Lighthouse budget"], runs[1], [], ["Build"]);
  assert.deepEqual(skippedBaseline, [{ name: "Lighthouse budget", classification: "unbaselined" }]);
  assert.match(buildTriageBody(skippedBaseline, runs[1]), /did not exercise `Lighthouse budget`/);
  assert.match(buildTriageBody(skippedBaseline, runs[1]), /\*\*not baselined\*\*/);
  // Omitted executed-name list keeps the previous behaviour rather than inventing a verdict.
  assert.deepEqual(classifyFailedJobs(["Lighthouse budget"], runs[1], []), [
    { name: "Lighthouse budget", classification: "needs-investigation" },
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
