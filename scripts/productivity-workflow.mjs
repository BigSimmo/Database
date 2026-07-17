#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  analyzeFailureText,
  buildWorkflowPlan,
  readChangeScope,
  runLocalChecks,
  scanOperatorBacklog,
  writeWorkflowEvidence,
} from "./productivity-core.mjs";

const workflows = new Set([
  "flightplan",
  "triage",
  "clinical-proof",
  "design-sweep",
  "rag-lab",
  "operator-closeout",
  "lifecycle",
]);

function usage() {
  console.log(`Usage: node scripts/productivity-workflow.mjs <workflow> [options]

Workflows: flightplan, triage, clinical-proof, design-sweep, rag-lab, operator-closeout, lifecycle
Options:
  --files <a,b>       Plan for explicit paths instead of the current change
  --phase <name>      Lifecycle phase: status, start, handoff, landed, cleanup
  --log <path>        Triage a saved failure log
  --run               Execute local/offline checks only
  --json              Emit structured JSON
  --write-evidence    Save the plan under .local/workflow-evidence
  --help              Show this help

Provider-backed commands are never executed by this tool.`);
}

function parseArgs(argv) {
  const [workflow, ...tokens] = argv;
  const options = {
    workflow,
    files: undefined,
    phase: "status",
    log: undefined,
    run: false,
    json: false,
    writeEvidence: false,
  };
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "--help" || token === "-h") options.help = true;
    else if (token === "--run") options.run = true;
    else if (token === "--json") options.json = true;
    else if (token === "--write-evidence") options.writeEvidence = true;
    else if (token === "--files")
      options.files = (tokens[++index] || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    else if (token === "--phase") options.phase = tokens[++index] || "";
    else if (token === "--log") options.log = tokens[++index] || "";
    else throw new Error(`Unknown option: ${token}`);
  }
  return options;
}

function render(plan) {
  console.log(`\n${plan.summary}`);
  console.log(`Workflow: ${plan.workflow}`);
  console.log(`Changed files: ${plan.files.length ? plan.files.join(", ") : "none detected"}`);
  const activeRisks = Object.entries(plan.risks)
    .filter(([, active]) => active)
    .map(([name]) => name);
  console.log(`Risk classes: ${activeRisks.length ? activeRisks.join(", ") : "none"}`);
  if (plan.diagnosis)
    console.log(`Diagnosis: ${plan.diagnosis.category} (${plan.diagnosis.confidence}) - ${plan.diagnosis.reason}`);
  if (plan.operatorItems) {
    console.log(`\nPending/operator candidates: ${plan.operatorItems.length}`);
    for (const item of plan.operatorItems) console.log(`- ${item.source}:${item.line} ${item.text}`);
  }
  console.log("\nLocal/offline checks:");
  if (!plan.localChecks.length) console.log("- none selected");
  for (const item of plan.localChecks) console.log(`- ${item.command} — ${item.reason}`);
  console.log("\nApproval-required commands:");
  if (!plan.approvalRequired.length) console.log("- none");
  for (const item of plan.approvalRequired) console.log(`- ${item.command} — ${item.reason}`);
  console.log("\nRequired proof:");
  for (const item of plan.proof) console.log(`- ${item}`);
}

function loadKnownFlakes(repoRoot) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(repoRoot, "tests", "flake-ledger.json"), "utf8"));
    const records = Array.isArray(data) ? data : data.flakes || [];
    return records.flatMap((entry) =>
      [entry.title, ...(entry.patterns || [])].filter(Boolean).map((pattern) => ({ id: entry.id, pattern })),
    );
  } catch {
    return [];
  }
}

function loadFailureText(options, repoRoot) {
  if (options.log) return fs.readFileSync(path.resolve(repoRoot, options.log), "utf8");
  const marker = path.join(repoRoot, ".local", "workflow-last-failure.json");
  return fs.existsSync(marker) ? fs.readFileSync(marker, "utf8") : "";
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || !workflows.has(options.workflow)) {
    usage();
    process.exit(options.help ? 0 : 1);
  }
  if (options.run && options.workflow === "operator-closeout") {
    throw new Error(
      "operator-closeout is plan-only; execute approved provider actions individually after confirmation.",
    );
  }

  const repoRoot = process.cwd();
  const scope = readChangeScope(options.files, repoRoot);
  const plan = buildWorkflowPlan(options.workflow, scope.files, { phase: options.phase });
  plan.scope = scope;
  if (options.workflow === "triage") {
    plan.diagnosis = analyzeFailureText(loadFailureText(options, repoRoot), loadKnownFlakes(repoRoot));
  }
  if (options.workflow === "operator-closeout") plan.operatorItems = scanOperatorBacklog(repoRoot);

  if (options.json) console.log(JSON.stringify(plan, null, 2));
  else render(plan);

  if (options.writeEvidence) console.log(`\nEvidence: ${writeWorkflowEvidence(plan, repoRoot)}`);
  if (options.run) {
    const result = runLocalChecks(plan.localChecks, repoRoot);
    if (result.status !== 0) {
      console.error(`\n[workflow] stopped at: ${result.failed}`);
      process.exit(result.status);
    }
  }
}

try {
  main();
  process.exit(0);
} catch (error) {
  console.error(`[productivity-workflow] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
