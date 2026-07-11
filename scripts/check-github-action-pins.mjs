import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const workflowDir = path.join(process.cwd(), ".github", "workflows");

const supportedMajorRanges = new Map([
  [
    "actions/checkout",
    {
      min: 4,
      max: 6,
      reason:
        "v6 is the currently supported and documented major that this repo has vetted; upgrading to v7 should be a deliberate, reviewed decision.",
    },
  ],
  [
    "peter-evans/create-or-update-comment",
    {
      min: 5,
      max: 5,
      reason: "create-or-update-comment v6 is not a documented published major for this workflow.",
    },
  ],
  [
    "actions/github-script",
    {
      min: 8,
      max: 9,
      reason: "v7 uses the end-of-life Node 20 action runtime; use a Node 24 based release.",
    },
  ],
]);

const usesPattern = /^\s*uses:\s*([^@\s]+)@v(\d+)\s*(?:#.*)?$/;
const runsOnLatestPattern = /^\s*runs-on:\s*ubuntu-latest\s*(?:#.*)?$/;
const failures = [];
const expectedSupabaseCliVersion = "2.108.0";

for (const fileName of readdirSync(workflowDir)
  .filter((name) => /\.ya?ml$/i.test(name))
  .sort()) {
  const filePath = path.join(workflowDir, fileName);
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);

  lines.forEach((line, index) => {
    if (runsOnLatestPattern.test(line)) {
      failures.push(
        `${fileName}:${index + 1}: runs-on uses ubuntu-latest. Pin GitHub-hosted Linux jobs to ubuntu-24.04 so CI is not tied to the moving ubuntu-latest alias.`,
      );
    }

    const match = line.match(usesPattern);
    if (!match) return;

    const [, action, rawMajor] = match;
    const range = supportedMajorRanges.get(action);
    if (!range) return;

    const major = Number(rawMajor);
    if (!Number.isInteger(major) || major < range.min || major > range.max) {
      failures.push(
        `${fileName}:${index + 1}: ${action}@v${rawMajor} is outside supported range v${range.min}-v${range.max}. ${range.reason}`,
      );
    }
  });
}

const ciWorkflowPath = path.join(workflowDir, "ci.yml");
const ciWorkflow = readFileSync(ciWorkflowPath, "utf8");
const requiredCiFragments = [
  `SUPABASE_CLI_VERSION: ${expectedSupabaseCliVersion}`,
  "version: ${{ env.SUPABASE_CLI_VERSION }}",
  "id: supabase-docker-cache",
  "supabase-docker-${{ runner.os }}-cli-${{ env.SUPABASE_CLI_VERSION }}-",
  "if: success() && steps.supabase-docker-cache.outputs.cache-hit != 'true'",
];

for (const fragment of requiredCiFragments) {
  if (!ciWorkflow.includes(fragment)) {
    failures.push(`ci.yml: missing required pinned Supabase/cache contract: ${fragment}`);
  }
}

if (/\bversion:\s*latest\b/.test(ciWorkflow)) {
  failures.push("ci.yml: required workflow tooling must not use version: latest.");
}

const sastWorkflowPath = path.join(workflowDir, "sast.yml");
const sastWorkflow = readFileSync(sastWorkflowPath, "utf8");
if (!/^\s{4}continue-on-error:\s*true\s*$/m.test(sastWorkflow)) {
  failures.push("sast.yml: Semgrep must remain advisory while it depends on mutable registry rules.");
}
if (!/src worker scripts supabase\/functions/.test(sastWorkflow)) {
  failures.push("sast.yml: Semgrep must scan Supabase Edge Function source.");
}

if (failures.length > 0) {
  console.error("GitHub Actions pin check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("GitHub Actions pin check passed.");
