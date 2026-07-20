import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { validateActionReference } from "./github-action-pins.mjs";
import { yamlBlock } from "./yaml-contract.mjs";

const workflowDir = path.join(process.cwd(), ".github", "workflows");

const runsOnLatestPattern = /^\s*runs-on:\s*ubuntu-latest\s*(?:#.*)?$/;
const failures = [];
const expectedSupabaseCliVersion = "2.108.0";
const expectedSupabaseCliVersionPattern = expectedSupabaseCliVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function discoverGitHubActionFiles(workflowRoot) {
  const workflowDir = path.join(workflowRoot, ".github", "workflows");
  if (!existsSync(workflowDir)) return [];
  return readdirSync(workflowDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
    .map((entry) => path.join(workflowDir, entry.name));
}

for (const filePath of discoverGitHubActionFiles(process.cwd())) {
  const fileName = path.relative(process.cwd(), filePath).replaceAll("\\", "/");
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

// One SHA per action across every workflow AND composite action. Dependabot bumps
// one file at a time, so a laggard can sit on an old major indefinitely; because
// the per-line validation above only covers workflows, a composite skew (e.g.
// setup-node v5 vs v7) was previously invisible. Assert each action name resolves
// to a single SHA everywhere it is used.
function discoverCompositeActionFiles(workflowRoot) {
  const actionsRoot = path.join(workflowRoot, ".github", "actions");
  if (!existsSync(actionsRoot)) return [];
  const files = [];
  for (const entry of readdirSync(actionsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    for (const name of ["action.yml", "action.yaml"]) {
      const candidate = path.join(actionsRoot, entry.name, name);
      if (existsSync(candidate)) files.push(candidate);
    }
  }
  return files;
}

const actionPinPattern = /uses:\s*([^@\s]+)@([0-9a-f]{40})(?:\s*#\s*(\S+))?/;
const shasByAction = new Map();
for (const filePath of [...discoverGitHubActionFiles(process.cwd()), ...discoverCompositeActionFiles(process.cwd())]) {
  const fileName = path.relative(process.cwd(), filePath).replaceAll("\\", "/");
  // Workflow lines are already run through validateActionReference in the first
  // pass; composite files are not, so validate them here. Without this, a
  // non-SHA composite reference (e.g. vendor/action@v1) matches neither the
  // 40-hex actionPinPattern below nor the first pass, so it would slip through
  // unpinned. Local `./` refs are correctly ignored by validateActionReference.
  const isComposite = fileName.startsWith(".github/actions/");
  readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .forEach((line, index) => {
      if (isComposite) {
        const actionFailure = validateActionReference(line);
        if (actionFailure) failures.push(`${fileName}:${index + 1}: ${actionFailure}`);
      }
      const match = actionPinPattern.exec(line);
      if (!match) return;
      const [, name, sha, version] = match;
      if (!shasByAction.has(name)) shasByAction.set(name, new Map());
      const bySha = shasByAction.get(name);
      if (!bySha.has(sha)) bySha.set(sha, { version: version ?? "(no version)", locations: [] });
      bySha.get(sha).locations.push(`${fileName}:${index + 1}`);
    });
}
for (const [name, bySha] of shasByAction) {
  if (bySha.size <= 1) continue;
  const detail = [...bySha.values()]
    .map(({ version, locations }) => `${version} (${locations.join(", ")})`)
    .join(" vs ");
  failures.push(
    `${name} is pinned to ${bySha.size} different SHAs across workflows/composites — standardize on one: ${detail}`,
  );
}

if (failures.length > 0) {
  console.error("GitHub Actions pin check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("GitHub Actions pin check passed.");
