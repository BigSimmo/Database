#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const requiredClinicalGovernanceItems = [
  "Source-backed claims still require linked source verification before clinical use",
  "No patient-identifiable document workflow was introduced or expanded without explicit governance approval",
  "Supabase target remains `Clinical KB Database` (`sjrfecxgysukkwxsowpy`)",
  "Service-role keys and private document access remain server-only",
  "Demo/synthetic content remains clearly separated from real clinical sources",
  "Source metadata, review status, and outdated/unknown-source behavior remain conservative",
  "Deployment classification/TGA SaMD impact was checked when clinical decision-support behavior changed",
];

const clinicalRiskPatterns = [
  /^supabase\//,
  /^src\/app\/api\//,
  /^src\/(?:lib|app|components)\/.*(?:auth|permission|privacy|security|rag|retriev|rank|search|answer|clinical|citation|source|document|upload|download)/i,
  /^scripts\/.*(?:ingest|reindex|migration|governance|production|drift|supabase)/i,
];

const operationalRiskPatterns = [
  /^\.github\/(?:actions|workflows)\//,
  /^(?:package|package-lock)\.json$/,
  /^(?:next|playwright|vitest)(?:\..+)?\.config\.[cm]?[jt]s$/,
  /^(?:Dockerfile|railway(?:\.[^.]+)?\.json|nixpacks\.toml)$/,
];

const uiPatterns = [
  /^src\/app\/(?!api\/)/,
  /^src\/(?:components|styles)\//,
  /^public\//,
  /^tests\/ui-.*\.spec\.ts$/,
  /^playwright(?:\..*)?\.config\.ts$/,
];

function normalizePath(filePath) {
  return String(filePath ?? "")
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\.\/+/, "");
}

function normalizeSectionHeading(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+#+\s*$/, "")
    .trim()
    .toLowerCase();
}

function section(body, heading) {
  const source = String(body ?? "");
  const headings = [...source.matchAll(/^(#{2,6})[ \t]+(.+?)[ \t]*$/gim)];
  const targetHeading = normalizeSectionHeading(heading);
  const matchIndex = headings.findIndex((match) => normalizeSectionHeading(match[2]) === targetHeading);
  if (matchIndex < 0) return "";
  const start = (headings[matchIndex]?.index ?? 0) + (headings[matchIndex]?.[0].length ?? 0);
  // Markdown outline semantics: the section runs until the next heading of the
  // same or shallower level. Deeper headings (### under ##) are sub-structure
  // and stay inside the section, so checklist evidence after them still counts.
  const level = headings[matchIndex][1].length;
  const next = headings.slice(matchIndex + 1).find((match) => match[1].length <= level);
  const end = next?.index ?? source.length;
  return source.slice(start, end).trim();
}

function meaningfulText(value) {
  const normalized = String(value ?? "")
    .replace(/<!--[^]*?-->/g, "")
    .replace(/^\s*[-*]\s*/gm, "")
    .trim();
  return Boolean(normalized && !/^(?:-|n\/?a|none|todo|tbd)$/i.test(normalized));
}

function checkedCommand(value, command) {
  const escaped = command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`-\\s*\\[[xX]\\]\\s*[^\\n]*${escaped}`, "i").test(value);
}

function explicitNotRun(value, scope = "verification") {
  const escaped = scope.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const withoutComments = String(value ?? "").replace(/<!--[^]*?-->/g, "");
  return new RegExp(`${escaped}[^\\n]{0,40}not run\\s*:\\s*\\S.{5,}`, "i").test(withoutComments);
}

function branchLikeTitle(title, headRef) {
  const value = String(title ?? "").trim();
  const normalized = (input) =>
    String(input ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  return (
    /^(?:codex|claude|copilot)(?:\b|[-_:])/i.test(value) ||
    (normalized(value) && normalized(value) === normalized(headRef))
  );
}

function checkedChecklistItem(value, item) {
  const escaped = item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^\\s*-\\s*\\[[xX]\\]\\s*${escaped}\\s*$`, "m").test(value);
}

function fieldValue(value, field) {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    String(value ?? "")
      .match(new RegExp(`^\\s*-?\\s*${escaped}\\s*:\\s*(.+?)\\s*$`, "im"))?.[1]
      ?.trim() ?? ""
  );
}

function substantiveRisk(value) {
  return value.length >= 12 && !/^(?:low|medium|high)[.!]?$/i.test(value);
}

function substantiveRollback(value) {
  return value.length >= 12 && !/^(?:none|n\/?a|not applicable|no rollback|no-?op)\b/i.test(value);
}

export function classifyPullRequestFiles(files) {
  const normalized = [...new Set((files ?? []).map(normalizePath).filter(Boolean))];
  return {
    files: normalized,
    clinicalRisk: normalized.some((file) => clinicalRiskPatterns.some((pattern) => pattern.test(file))),
    operationalRisk: normalized.some((file) => operationalRiskPatterns.some((pattern) => pattern.test(file))),
    ui: normalized.some((file) => uiPatterns.some((pattern) => pattern.test(file))),
  };
}

export function evaluatePullRequestPolicy({ title, body, headRef, files }) {
  const errors = [];
  const classification = classifyPullRequestFiles(files);
  const summary = section(body, "Summary");
  const verification = section(body, "Verification");
  const riskAndRollout = section(body, "Risk and rollout");
  const governance = section(body, "Clinical Governance Preflight");

  if (String(title ?? "").trim().length < 12)
    errors.push("Use a specific, outcome-focused PR title (at least 12 characters).");
  if (branchLikeTitle(title, headRef)) errors.push("Replace the branch-style PR title with an outcome-focused title.");
  if (!meaningfulText(summary)) errors.push("Complete the `## Summary` section with the outcome and affected area.");
  if (!meaningfulText(verification)) {
    errors.push("Complete the `## Verification` section with exact results or a reason checks were not run.");
  } else if (!/-\s*\[[xX]\]/.test(verification) && !explicitNotRun(verification)) {
    errors.push("Verification must contain a checked result or an explicit `Verification not run: <reason>` entry.");
  }

  if (
    classification.ui &&
    !checkedCommand(verification, "npm run verify:ui") &&
    !explicitNotRun(verification, "UI verification")
  ) {
    errors.push("UI changes require checked `npm run verify:ui` evidence or `UI verification not run: <reason>`.");
  }

  if (classification.clinicalRisk) {
    if (!meaningfulText(governance)) {
      errors.push("Clinical-risk paths require the `## Clinical Governance Preflight` section.");
    } else {
      const missingGovernance = requiredClinicalGovernanceItems.filter(
        (item) => !checkedChecklistItem(governance, item),
      );
      if (missingGovernance.length > 0) {
        errors.push(
          `Resolve every required Clinical Governance Preflight item before marking the PR ready (missing: ${missingGovernance.join("; ")}).`,
        );
      }
    }
  }

  if (classification.clinicalRisk || classification.operationalRisk) {
    if (!meaningfulText(riskAndRollout)) {
      errors.push("High-risk changes require the `## Risk and rollout` section.");
    } else {
      if (!substantiveRisk(fieldValue(riskAndRollout, "Risk"))) {
        errors.push("Risk and rollout must include `Risk: <low|medium|high and rationale>`.");
      }
      if (!substantiveRollback(fieldValue(riskAndRollout, "Rollback"))) {
        errors.push("Risk and rollout must include a concrete `Rollback: <plan>`.");
      }
    }
  }

  return { classification, errors, ok: errors.length === 0 };
}

function selfTest() {
  const completeGovernance = requiredClinicalGovernanceItems.map((item) => `- [x] ${item}`).join("\n");
  const completeBody = `## Summary\n\n- Add a trusted PR policy.\n\n## Verification\n\n- [x] \`npm run verify:pr-local\`\n- [x] \`npm run verify:ui\`\n\n## Risk and rollout\n\n- Risk: low; metadata-only validation.\n- Rollback: revert the workflow commit.\n\n## Clinical Governance Preflight\n\n${completeGovernance}`;
  assert.equal(
    evaluatePullRequestPolicy({
      title: "ci: enforce pull request evidence",
      body: completeBody,
      headRef: "codex/pr-policy",
      files: [".github/workflows/pr-policy.yml"],
    }).ok,
    true,
  );
  assert.match(
    evaluatePullRequestPolicy({
      title: "Codex/pr-policy",
      body: "",
      headRef: "codex/pr-policy",
      files: [],
    }).errors.join(" "),
    /branch-style/,
  );
  assert.match(
    evaluatePullRequestPolicy({
      title: "fix: update search behavior",
      body: completeBody.replace("- [x] `npm run verify:ui`\n", ""),
      headRef: "codex/search-fix",
      files: ["src/components/search.tsx"],
    }).errors.join(" "),
    /verify:ui/,
  );
  // Outline semantics: a ### sub-heading inside a required section must not
  // truncate it — checklist evidence after the sub-heading still counts.
  assert.equal(
    evaluatePullRequestPolicy({
      title: "ci: enforce pull request evidence",
      body: completeBody.replace("## Verification\n\n", "## Verification\n\n### Unit tests\n\n"),
      headRef: "codex/pr-policy",
      files: [".github/workflows/pr-policy.yml"],
    }).ok,
    true,
  );
  assert.match(
    evaluatePullRequestPolicy({
      title: "fix: update clinical search",
      body: completeBody.replace(`- [x] ${requiredClinicalGovernanceItems[0]}`, "- [x] Safe"),
      headRef: "codex/search-fix",
      files: ["src/lib/clinical-search.ts"],
    }).errors.join(" "),
    /every required Clinical Governance/,
  );
  assert.equal(
    evaluatePullRequestPolicy({
      title: "fix: handle /api/search failures",
      body: completeBody,
      headRef: "codex/api-search-failures",
      files: ["docs/process-hardening.md"],
    }).ok,
    true,
  );
  assert.match(
    evaluatePullRequestPolicy({
      title: "ci: enforce pull request evidence",
      body: completeBody.replace("Risk: low; metadata-only validation.", "Risk: low"),
      headRef: "codex/pr-policy",
      files: [".github/workflows/pr-policy.yml"],
    }).errors.join(" "),
    /Risk and rollout must include/,
  );
  assert.match(
    evaluatePullRequestPolicy({
      title: "ci: enforce pull request evidence",
      body: completeBody.replace("Rollback: revert the workflow commit.", "Rollback: none because this is small"),
      headRef: "codex/pr-policy",
      files: [".github/workflows/pr-policy.yml"],
    }).errors.join(" "),
    /concrete `Rollback/,
  );
  assert.match(
    evaluatePullRequestPolicy({
      title: "docs: explain the review process",
      body: "## Summary\n\n- Useful documentation.\n\n## Verification\n\n- [ ] `npm run verify:pr-local`\n<!-- Use `Verification not run: <reason>` when blocked. -->",
      headRef: "codex/review-docs",
      files: ["docs/process-hardening.md"],
    }).errors.join(" "),
    /checked result/,
  );
  assert.deepEqual(classifyPullRequestFiles(["src/app/api/search/route.ts"]), {
    files: ["src/app/api/search/route.ts"],
    clinicalRisk: true,
    operationalRisk: false,
    ui: false,
  });
  assert.equal(
    section("### Summary ###\n\n- concise summary\n\n### Verification\n\n- [x] `npm run verify:pr-local`\n", "Summary"),
    "- concise summary",
  );
  const template = readFileSync(new URL("../.github/pull_request_template.md", import.meta.url), "utf8");
  for (const item of requiredClinicalGovernanceItems)
    assert.match(template, new RegExp(`- \\[ \\] ${item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  const workflow = readFileSync(new URL("../.github/workflows/pr-policy.yml", import.meta.url), "utf8");
  assert.match(
    workflow,
    /ref:\s*\$\{\{\s*github\.workflow_sha\s*\}\}/,
    "PR policy workflow must checkout github.workflow_sha for a deterministic trusted tree.",
  );
  assert.doesNotMatch(
    workflow,
    /ref:\s*\$\{\{\s*github\.base_ref\s*\}\}/,
    "PR policy workflow must not checkout the moving base branch ref.",
  );
  assert.doesNotMatch(
    workflow,
    /ref:\s*\$\{\{\s*github\.event\.pull_request\.base\.sha\s*\}\}/,
    "PR policy workflow must not checkout a potentially stale pull_request.base.sha.",
  );
  console.error("[pr-policy] self-test passed");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes("--self-test")) selfTest();
  else {
    console.error("usage: pr-policy.mjs --self-test");
    process.exitCode = 1;
  }
}
