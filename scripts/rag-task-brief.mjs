import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { parseLocalAgentOptions, planLocalAgent } from "./lib/rag-local-agent-policy.mjs";

const root = resolve(import.meta.dirname, "..");

function value(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const next = process.argv[index + 1];
  if (!next || next.startsWith("--")) fail(`${name} requires a value`);
  return next;
}

function fail(message) {
  console.error(`[rag-task-brief] FAIL: ${message}`);
  process.exit(1);
}

const variant = value("--variant", "cloud");
const phaseId = value("--phase");
const requestedTask = value("--task");
const outputPath = value("--out");
if (!["cloud", "local"].includes(variant)) fail("--variant must be cloud or local");
if (!phaseId || requestedTask === null) fail("--phase and --task are required");

const packageRoot = join(root, "docs", "superpowers", "rag-upgrade", variant);
const manifest = JSON.parse(readFileSync(join(packageRoot, "programme-manifest.json"), "utf8"));
let localPlan = null;
if (variant === "local") {
  try {
    // Canonical policy is the sole machine owner; generated body provenance is separate.
    const policyManifest = JSON.parse(
      readFileSync(join(root, "docs/superpowers/rag-upgrade/canonical/programme-manifest.json"), "utf8"),
    );
    localPlan = planLocalAgent(policyManifest, parseLocalAgentOptions(process.argv.slice(2), ["--variant", "--out"]));
  } catch (error) {
    fail(error.message);
  }
}
const phase = manifest.phases.find((candidate) => candidate.id === phaseId);
if (!phase) fail(`unknown Cloud implementation phase ${phaseId}`);
const taskNumber = Number(requestedTask);
if (!Number.isInteger(taskNumber) || !phase.tasks.includes(taskNumber)) {
  fail(`task ${requestedTask} is not scheduled in ${phaseId}`);
}

const planRelative = manifest.plans[phase.plan];
if (!planRelative) fail(`${phaseId} has no executable plan`);
const planPath = join(packageRoot, ...planRelative.split("/"));
const markdown = readFileSync(planPath, "utf8");
const sourceHash = createHash("sha256").update(readFileSync(planPath)).digest("hex");
const headings = [...markdown.matchAll(/^### Task (\d+):[^\n]*$/gm)];
const headingIndex = headings.findIndex((heading) => Number(heading[1]) === taskNumber);
if (headingIndex === -1) fail(`Task ${taskNumber} was not found in ${planRelative}`);
const taskBody = markdown
  .slice(headings[headingIndex].index, headings[headingIndex + 1]?.index ?? markdown.length)
  .trim();

const header = [
  `# Exact task brief: ${phaseId}/${phase.plan}/task-${taskNumber}`,
  "",
  `Package variant: ${variant}`,
  `Plan: ${planRelative}`,
  `Execution predecessor: ${phase.executionPredecessor ?? "none"}`,
  localPlan
    ? `Local ${localPlan.role} route: ${localPlan.dispatch ? `${localPlan.dispatch.model} / ${localPlan.dispatch.reasoning_effort}` : localPlan.status}`
    : `Implementation route: ${phase.implementationModel} / ${phase.implementationReasoning}`,
  `Skill profiles: ${(manifest.phaseSkillProfiles?.[phaseId] ?? []).join(", ")}`,
  "",
  `Source path: docs/superpowers/rag-upgrade/${variant}/${planRelative}`,
  `Source SHA-256: ${sourceHash}`,
  "Provenance: working-tree generated package bytes; not committed proof or acceptance.",
  ...(localPlan
    ? [
        "",
        "Local intended dispatch (not authorization or runtime evidence):",
        "```json",
        JSON.stringify(localPlan, null, 2),
        "```",
        ...(localPlan.requiredBrief
          ? [
              `Required continuation: ${localPlan.requiredBrief}`,
              "Preserve accepted Task5 74ed0ae7cf78e327688c5915cc9c59bdd7fc56d6 and the protected 30-file assessed snapshot. R3 product implementation remains paused until separately resumed.",
            ]
          : []),
      ]
    : []),
  "",
].join("\n");
const brief = `${header}${taskBody}\n`;

if (outputPath) {
  const absoluteOutput = resolve(root, outputPath);
  mkdirSync(dirname(absoluteOutput), { recursive: true });
  writeFileSync(absoluteOutput, brief, "utf8");
  console.log(`[rag-task-brief] PASS: wrote ${outputPath}`);
} else {
  process.stdout.write(brief);
}
