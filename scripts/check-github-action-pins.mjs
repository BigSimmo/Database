import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateActionReference } from "./github-action-pins.mjs";
import { yamlBlock } from "./yaml-contract.mjs";

const workflowDir = path.join(process.cwd(), ".github", "workflows");

const runsOnLatestPattern = /^\s*runs-on:\s*ubuntu-latest\s*(?:#.*)?$/;
const failures = [];
const expectedSupabaseCliVersion = "2.108.0";
const expectedSupabaseCliVersionPattern = expectedSupabaseCliVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function discoverWorkflowFiles(root) {
  const workflowDir = path.join(root, ".github", "workflows");
  if (!existsSync(workflowDir)) return [];
  return readdirSync(workflowDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
    .map((entry) => path.join(workflowDir, entry.name));
}

function discoverCompositeActionFiles(root) {
  const actionsDir = path.join(root, ".github", "actions");
  if (!existsSync(actionsDir)) return [];
  const files = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
      } else if (/^action\.ya?ml$/i.test(entry.name)) {
        files.push(fullPath);
      }
    }
  };
  visit(actionsDir);
  return files;
}

function discoverGitHubActionFiles(root) {
  return [...discoverWorkflowFiles(root), ...discoverCompositeActionFiles(root)];
}

function collectPinFailures(root) {
  const failures = [];
  for (const filePath of discoverGitHubActionFiles(root)) {
    const fileName = path.relative(root, filePath).replaceAll("\\", "/");
    const lines = readFileSync(filePath, "utf8").split(/\r?\n/);

    lines.forEach((line, index) => {
      if (runsOnLatestPattern.test(line)) {
        failures.push(
          `${fileName}:${index + 1}: runs-on uses ubuntu-latest. Pin GitHub-hosted Linux jobs to ubuntu-24.04 so CI is not tied to the moving ubuntu-latest alias.`,
        );
      }

      const actionFailure = validateActionReference(line);
      if (actionFailure) failures.push(`${fileName}:${index + 1}: ${actionFailure}`);
    });
  }
  return failures;
}

function selfTest() {
  const root = mkdtempSync(path.join(os.tmpdir(), "github-action-pin-check-"));
  try {
    const workflowDir = path.join(root, ".github", "workflows");
    const actionDir = path.join(root, ".github", "actions", "fixture");
    mkdirSync(workflowDir, { recursive: true });
    mkdirSync(actionDir, { recursive: true });
    writeFileSync(path.join(workflowDir, "ok.yml"), "name: ok\n", "utf8");
    writeFileSync(
      path.join(actionDir, "action.yml"),
      "name: fixture\nruns:\n  using: composite\n  steps:\n    - uses: actions/cache@v6\n",
      "utf8",
    );

    const failures = collectPinFailures(root);
    if (
      !failures.some(
        (failure) => failure.includes(".github/actions/fixture/action.yml") && failure.includes("actions/cache@v6"),
      )
    ) {
      throw new Error("self-test failed: composite action uses entries were not scanned");
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

if (process.argv.includes("--self-test")) {
  selfTest();
  console.log("GitHub Actions pin check self-test passed.");
  process.exit(0);
}

selfTest();
failures.push(...collectPinFailures(process.cwd()));

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
