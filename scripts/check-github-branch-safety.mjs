import fs from "node:fs";
import path from "node:path";

const ownerRepo = process.env.GITHUB_REPOSITORY || process.env.REPOSITORY;
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const apiBase = process.env.GITHUB_API_URL || "https://api.github.com";
const expectedRequiredChecks = (process.env.EXPECTED_REQUIRED_CHECKS || "branch-safety,verify,Gitleaks")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const errors = [];
const warnings = [];

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function stripQuotes(value) {
  return value.trim().replace(/^["']|["']$/g, "");
}

function workflowCheckContexts(workflowsDir) {
  const contexts = new Set();
  const workflowFiles = fs.readdirSync(workflowsDir).filter((file) => /\.ya?ml$/i.test(file));

  for (const file of workflowFiles) {
    const workflowPath = path.join(workflowsDir, file);
    const lines = fs.readFileSync(workflowPath, "utf8").split(/\r?\n/);
    let inJobs = false;
    let currentJob = null;
    let currentName = null;

    function flushJob() {
      if (currentJob) {
        contexts.add(currentName || currentJob);
      }
      currentJob = null;
      currentName = null;
    }

    for (const line of lines) {
      if (/^jobs:\s*$/.test(line)) {
        inJobs = true;
        continue;
      }

      if (!inJobs) {
        continue;
      }

      const topLevel = line.match(/^[A-Za-z_][\w-]*:/);
      if (topLevel) {
        flushJob();
        inJobs = false;
        continue;
      }

      const job = line.match(/^  ([A-Za-z_][\w-]*):\s*$/);
      if (job) {
        flushJob();
        currentJob = job[1];
        continue;
      }

      const jobName = line.match(/^    name:\s*(.+?)\s*$/);
      if (currentJob && jobName) {
        currentName = stripQuotes(jobName[1]);
      }
    }

    flushJob();
  }

  return contexts;
}

async function requestJson(pathname) {
  if (!token) {
    throw new Error("GITHUB_TOKEN or GH_TOKEN is required");
  }

  const response = await fetch(`${apiBase}${pathname}`, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${pathname} returned ${response.status}: ${body}`);
  }

  return response.json();
}

function appliesToAllBranches(ruleset) {
  const includes = ruleset.conditions?.ref_name?.include || [];
  return includes.includes("~ALL");
}

function appliesToDefaultBranch(ruleset, defaultBranch) {
  const includes = ruleset.conditions?.ref_name?.include || [];
  return (
    includes.includes("~DEFAULT_BRANCH") ||
    includes.includes(`refs/heads/${defaultBranch}`) ||
    includes.includes("~ALL")
  );
}

function pullRequestRuleIsReviewFree(rule, sourceName) {
  const params = rule.parameters || {};
  if ((params.required_approving_review_count || 0) !== 0) {
    fail(`${sourceName} requires approving reviews`);
  }
  if ((params.required_reviewers || []).length > 0) {
    fail(`${sourceName} requires named reviewers`);
  }
  if (params.require_code_owner_review) {
    fail(`${sourceName} requires code owner review`);
  }
  if (params.require_last_push_approval) {
    fail(`${sourceName} requires last-pusher approval`);
  }
  if (params.required_review_thread_resolution) {
    fail(`${sourceName} requires manual review-thread resolution`);
  }

  return (
    (params.required_approving_review_count || 0) === 0 &&
    (params.required_reviewers || []).length === 0 &&
    !params.require_code_owner_review &&
    !params.require_last_push_approval &&
    !params.required_review_thread_resolution
  );
}

function validateRequiredChecks(sourceName, contexts, knownContexts) {
  const uniqueContexts = [...new Set(contexts)].sort();

  for (const context of uniqueContexts) {
    if (!knownContexts.has(context)) {
      fail(`${sourceName} requires unknown check context "${context}"`);
    }
  }

  for (const expected of expectedRequiredChecks) {
    if (!uniqueContexts.includes(expected)) {
      fail(`${sourceName} does not require expected check "${expected}"`);
    }
  }

  return uniqueContexts;
}

function collectRulesetStatusContexts(rule) {
  return (rule.parameters?.required_status_checks || []).map((check) => check.context).filter(Boolean);
}

async function main() {
  if (!ownerRepo) {
    fail("GITHUB_REPOSITORY or REPOSITORY is required");
  }

  const knownContexts = workflowCheckContexts(path.join(process.cwd(), ".github", "workflows"));

  for (const expected of expectedRequiredChecks) {
    if (!knownContexts.has(expected)) {
      fail(`Expected required check "${expected}" is not emitted by local workflows`);
    }
  }

  if (errors.length > 0) {
    throw new Error("Local workflow check context validation failed");
  }

  const repo = await requestJson(`/repos/${ownerRepo}`);
  const defaultBranch = repo.default_branch;
  const rulesetSummaries = await requestJson(`/repos/${ownerRepo}/rulesets`);
  const rulesets = [];

  for (const summary of rulesetSummaries || []) {
    const detail = await requestJson(`/repos/${ownerRepo}/rulesets/${summary.id}`);
    if (detail?.enforcement === "active") {
      rulesets.push(detail);
    }
  }

  let defaultBranchHasPrGate = false;
  let defaultBranchHasStrictStatusGate = false;

  for (const ruleset of rulesets) {
    for (const rule of ruleset.rules || []) {
      const sourceName = `ruleset "${ruleset.name}"`;

      if (appliesToAllBranches(ruleset) && (rule.type === "pull_request" || rule.type === "required_status_checks")) {
        fail(`${sourceName} applies ${rule.type} to every branch`);
      }

      if (rule.type === "pull_request") {
        const reviewFree = pullRequestRuleIsReviewFree(rule, sourceName);
        if (reviewFree && appliesToDefaultBranch(ruleset, defaultBranch)) {
          defaultBranchHasPrGate = true;
        }
      }

      if (rule.type === "required_status_checks") {
        const contexts = collectRulesetStatusContexts(rule);
        validateRequiredChecks(sourceName, contexts, knownContexts);
        if (
          appliesToDefaultBranch(ruleset, defaultBranch) &&
          rule.parameters?.strict_required_status_checks_policy === true
        ) {
          defaultBranchHasStrictStatusGate = true;
        }
      }
    }
  }

  const protection = await requestJson(`/repos/${ownerRepo}/branches/${defaultBranch}/protection`);

  if (protection) {
    if (protection.required_pull_request_reviews) {
      fail("classic branch protection reintroduced manual PR review settings");
    }

    const contexts = [
      ...(protection.required_status_checks?.contexts || []),
      ...(protection.required_status_checks?.checks || []).map((check) => check.context),
    ].filter(Boolean);

    if (contexts.length > 0) {
      validateRequiredChecks("classic branch protection", contexts, knownContexts);
      if (protection.required_status_checks?.strict === true) {
        defaultBranchHasStrictStatusGate = true;
      }
    }
  } else {
    warn(`classic branch protection is not configured for ${defaultBranch}`);
  }

  if (!defaultBranchHasPrGate) {
    fail(`default branch "${defaultBranch}" does not have a review-free PR gate`);
  }

  if (!defaultBranchHasStrictStatusGate) {
    fail(`default branch "${defaultBranch}" does not have strict required status checks`);
  }

  for (const message of warnings) {
    console.warn(`warning: ${message}`);
  }

  if (errors.length > 0) {
    console.error("Branch safety guard failed:");
    for (const message of errors) {
      console.error(`- ${message}`);
    }
    process.exit(1);
  }

  console.log(`Branch safety guard passed. Required checks: ${expectedRequiredChecks.join(", ")}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
