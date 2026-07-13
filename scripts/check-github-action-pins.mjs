import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { yamlBlock } from "./yaml-contract.mjs";

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
const expectedSupabaseCliVersionPattern = expectedSupabaseCliVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
const migrationJob = yamlBlock(ciWorkflow, "db-reset-verify:", 2);
const setupSupabaseStep = yamlBlock(migrationJob, "- name: Setup Supabase CLI", 6);
const restoreSupabaseStep = yamlBlock(migrationJob, "- name: Restore Supabase Docker image cache", 6);
const saveSupabaseStep = yamlBlock(migrationJob, "- name: Save Supabase Docker images", 6);
if (!new RegExp(`^  SUPABASE_CLI_VERSION: ${expectedSupabaseCliVersionPattern}$`, "m").test(ciWorkflow)) {
  failures.push(`ci.yml: global SUPABASE_CLI_VERSION must remain pinned to ${expectedSupabaseCliVersion}.`);
}
if (!/^          version: \$\{\{ env\.SUPABASE_CLI_VERSION \}\}$/m.test(setupSupabaseStep)) {
  failures.push("ci.yml: db-reset-verify Setup Supabase CLI must use the pinned env version.");
}
if (
  !/^        id: supabase-docker-cache$/m.test(restoreSupabaseStep) ||
  !restoreSupabaseStep.includes("supabase-docker-${{ runner.os }}-cli-${{ env.SUPABASE_CLI_VERSION }}-")
) {
  failures.push("ci.yml: db-reset-verify cache step must own the pinned Supabase cache id/key.");
}
if (
  !/^        if: success\(\) && steps\.supabase-docker-cache\.outputs\.cache-hit != 'true'$/m.test(saveSupabaseStep)
) {
  failures.push("ci.yml: db-reset-verify save step must be gated by its own cache-hit output.");
}

if (/\bversion:\s*latest\b/.test(ciWorkflow)) {
  failures.push("ci.yml: required workflow tooling must not use version: latest.");
}

const sastWorkflowPath = path.join(workflowDir, "sast.yml");
const sastWorkflow = readFileSync(sastWorkflowPath, "utf8");
const semgrepJob = yamlBlock(sastWorkflow, "semgrep:", 2);
const semgrepScanStep = yamlBlock(semgrepJob, "- name: Semgrep scan", 6);
if (/^    continue-on-error:\s*true\s*$/m.test(semgrepJob)) {
  failures.push("sast.yml: only the Semgrep scan step may be advisory; job setup failures must block.");
}
if (!/^        continue-on-error:\s*true\s*$/m.test(semgrepScanStep)) {
  failures.push("sast.yml: the Semgrep scan step must remain advisory while registry rules are mutable.");
}
if (!/^          src worker scripts supabase\/functions\s*$/m.test(semgrepScanStep)) {
  failures.push("sast.yml: the Semgrep scan command must target src, worker, scripts, and supabase/functions.");
}

if (failures.length > 0) {
  console.error("GitHub Actions pin check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("GitHub Actions pin check passed.");
