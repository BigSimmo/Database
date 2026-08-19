#!/usr/bin/env node
/**
 * sync-open-pr-branches — explicit local/operator helper for refreshing
 * same-repository pull-request branches.
 *
 * Default is dry-run (report only). Pass `--apply` to call GitHub's
 * update-branch API for eligible open same-repo PRs that are behind `main`.
 * A behind branch with required CI still queued or running is deferred so the
 * update does not cancel a healthy run just before it completes.
 *
 * Requires human/operator `gh` auth with pull-requests:write (or an explicitly
 * supplied GH_TOKEN). Never rebases, never merges into main, never force-pushes.
 * This intentionally is not an Actions workflow: heads authored by the default
 * Actions bot leave this repository's required checks awaiting approval.
 *
 * Run:
 *   node scripts/sync-open-pr-branches.mjs
 *   node scripts/sync-open-pr-branches.mjs --apply
 *   npm run sync:pr-branches
 *   npm run sync:pr-branches -- --apply
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const APPLY = process.argv.includes("--apply");
const BASE = "main";
const SKIP_LABELS = new Set(["hold", "do-not-merge", "skip-branch-sync"]);
const ACTIVE_RUN_STATES = new Set(["pending", "queued", "in_progress", "requested", "waiting"]);

function ghJson(args) {
  const result = spawnSync("gh", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `gh ${args.join(" ")} failed`).trim());
  }
  return JSON.parse(result.stdout || "null");
}

function shouldSkip(pr) {
  const labels = new Set((pr.labels || []).map((l) => String(l.name || "").toLowerCase()));
  for (const label of SKIP_LABELS) {
    if (labels.has(label)) return `label:${label}`;
  }
  if (/\b(WIP|do not merge)\b/i.test(String(pr.title || ""))) return "wip-title";
  if (pr.isCrossRepository) return "fork-head";
  return null;
}

export function classifyPr(pr, behindBy) {
  const skip = shouldSkip(pr);
  if (skip) return { action: "skip", reason: skip };
  if (pr.autoMergeRequest) return { action: "skip", reason: "auto-merge-armed" };
  if ((behindBy ?? 0) <= 0) return { action: "skip", reason: "already-current" };
  if (pr.requiredCiInFlight) return { action: "skip", reason: "required-ci-in-flight" };
  return { action: "update", reason: `behind=${behindBy}` };
}

export function hasRequiredCiInFlight(payload) {
  return (payload?.workflow_runs ?? []).some((run) => {
    const isRequiredCi = run?.name === "CI" || /(?:^|\/)ci\.yml$/.test(String(run?.path ?? ""));
    return isRequiredCi && ACTIVE_RUN_STATES.has(String(run?.status ?? "").toLowerCase());
  });
}

export function validateApplyIdentity(viewer) {
  const login = String(viewer?.login ?? "").trim();
  if (!login || /^github-actions(?:\[bot\])?$/i.test(login) || /\[bot\]$/i.test(login)) {
    throw new Error(
      "Refusing PR branch updates without an authenticated human/operator gh identity; bot-authored heads leave required checks awaiting approval.",
    );
  }
  return login;
}

export function repositoryNameWithOwner(repository) {
  const name = String(repository?.nameWithOwner ?? "").trim();
  if (!/^[^/\s]+\/[^/\s]+$/.test(name)) {
    throw new Error("Could not resolve the current GitHub repository nameWithOwner.");
  }
  return name;
}

function main() {
  const repo = repositoryNameWithOwner(ghJson(["repo", "view", "--json", "nameWithOwner"]));
  if (APPLY) {
    const login = validateApplyIdentity(ghJson(["api", "user"]));
    console.log(`Apply identity: ${login}`);
  }
  const prs = ghJson([
    "pr",
    "list",
    "--repo",
    repo,
    "--state",
    "open",
    "--base",
    BASE,
    "--limit",
    "100",
    "--json",
    "number,title,headRefName,headRefOid,labels,isCrossRepository,isDraft,url,autoMergeRequest",
  ]);

  const plan = [];
  for (const pr of prs) {
    let behindBy = 0;
    let requiredCiInFlight = false;
    try {
      const cmp = ghJson([
        "api",
        `repos/${repo}/compare/${encodeURIComponent(BASE)}...${encodeURIComponent(pr.headRefName)}`,
      ]);
      behindBy = cmp.behind_by ?? 0;
      requiredCiInFlight =
        behindBy > 0 && !shouldSkip(pr)
          ? hasRequiredCiInFlight(
              ghJson([
                "api",
                `repos/${repo}/actions/runs?head_sha=${encodeURIComponent(pr.headRefOid)}&event=pull_request&per_page=100`,
              ]),
            )
          : false;
    } catch {
      behindBy = 0;
      requiredCiInFlight = false;
    }
    const decision = classifyPr({ ...pr, requiredCiInFlight }, behindBy);
    plan.push({ pr, behindBy, requiredCiInFlight, ...decision });
  }

  console.log(`Open PRs against ${BASE}: ${plan.length} (${APPLY ? "APPLY" : "dry-run"})`);
  for (const row of plan) {
    console.log(
      `#${row.pr.number} draft=${row.pr.isDraft} behind=${row.behindBy} -> ${row.action} (${row.reason}) ${row.pr.headRefName}`,
    );
  }

  if (!APPLY) {
    console.log("\nDry-run only. Re-run with --apply to update behind branches.");
    return;
  }

  let updated = 0;
  let failed = 0;
  for (const row of plan) {
    if (row.action !== "update") continue;
    const result = spawnSync(
      "gh",
      [
        "api",
        "-X",
        "PUT",
        `repos/${repo}/pulls/${row.pr.number}/update-branch`,
        "-f",
        `expected_head_sha=${row.pr.headRefOid}`,
      ],
      { encoding: "utf8" },
    );
    if (result.status === 0) {
      updated += 1;
      console.log(`UPDATED #${row.pr.number}`);
    } else {
      failed += 1;
      console.error(`FAILED #${row.pr.number}: ${(result.stderr || result.stdout || "").trim()}`);
    }
  }
  console.log(`Done. updated=${updated} failed=${failed}`);
  if (failed > 0) process.exitCode = 1;
}

export function runSyncOpenPrBranches() {
  main();
}

const isEntry =
  Boolean(process.argv[1]) &&
  (import.meta.url === pathToFileURL(process.argv[1]).href ||
    fileURLToPath(import.meta.url) === path.resolve(process.argv[1]));

if (isEntry) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
