import fs from "node:fs";

const workflowPath = ".github/workflows/pr-policy.yml";
const ciWorkflowPath = ".github/workflows/ci.yml";
const workflow = fs.readFileSync(workflowPath, "utf8");
const ciWorkflow = fs.readFileSync(ciWorkflowPath, "utf8");
const githubScriptPin = "3a2844b7e9c422d3c10d287c895573f7108da1b3";

const failures = [];

const forbiddenPatterns = [
  {
    pattern: /ref:\s*\$\{\{\s*github\.event\.pull_request\.head\.sha\s*\}\}/,
    message: "PR policy workflow must not checkout the untrusted PR head SHA.",
  },
  {
    pattern: /ref:\s*\$\{\{\s*github\.base_ref\s*\}\}/,
    message: "PR policy workflow must not checkout the moving base branch ref.",
  },
  {
    pattern: /ref:\s*\$\{\{\s*github\.event\.pull_request\.base\.sha\s*\}\}/,
    message: "PR policy workflow must not checkout a potentially stale pull_request.base.sha.",
  },
  {
    pattern: /persist-credentials:\s*true/,
    message: "PR policy workflow must not persist checkout credentials.",
  },
  {
    pattern: /pull-requests:\s*write/,
    message: "PR policy workflow must remain read-only for pull requests.",
  },
  {
    pattern: /contents:\s*write/,
    message: "PR policy workflow must not grant contents write permission.",
  },
  {
    pattern: /uses:\s*actions\/github-script@v\d+/,
    message: "PR policy workflow must pin github-script to an immutable commit.",
  },
];

for (const { pattern, message } of forbiddenPatterns) {
  if (pattern.test(workflow)) {
    failures.push(message);
  }
}

const requiredChecks = [
  "pull_request_target:",
  "contents: read",
  "pull-requests: read",
  "ref: ${{ github.workflow_sha }}",
  "persist-credentials: false",
  `uses: actions/github-script@${githubScriptPin} # v9.0.0`,
  "GITHUB_WORKSPACE}/scripts/pr-policy.mjs",
  "github.event_name == 'pull_request_target'",
];

for (const requiredCheck of requiredChecks) {
  if (!workflow.includes(requiredCheck)) {
    failures.push(`PR policy workflow is missing required hardening check: ${requiredCheck}`);
  }
}

const syncJob = ciWorkflow.match(/sync-pr-policy-body:[\s\S]*?(?=\n  [a-z0-9-]+:|$)/)?.[0] ?? "";
if (!syncJob) {
  failures.push("ci.yml is missing the sync-pr-policy-body job.");
} else {
  const syncForbiddenPatterns = [
    {
      pattern: /trusted-policy\/scripts\/pr-policy\.mjs/,
      message: "sync-pr-policy-body must import pr-policy.mjs from the trusted base checkout only.",
    },
    {
      pattern: /existingCheckedItems/,
      message: "sync-pr-policy-body must preserve existing governance attestations instead of auto-checking items.",
    },
    {
      pattern: /ref:\s*\$\{\{\s*github\.event\.pull_request\.base\.sha\s*\}\}[\s\S]*path:\s*trusted-policy/,
      message: "sync-pr-policy-body must checkout trusted policy metadata from the PR base SHA.",
    },
  ];

  for (const { pattern, message } of syncForbiddenPatterns) {
    if (!pattern.test(syncJob)) {
      failures.push(message);
    }
  }

  if (/map\(\(item\) => `\s*-\s*\[x\]/i.test(syncJob)) {
    failures.push("sync-pr-policy-body must not synthesize completed Clinical Governance Preflight items.");
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
