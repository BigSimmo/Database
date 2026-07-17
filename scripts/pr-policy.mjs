#!/usr/bin/env node
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

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

function section(body, heading) {
  const source = String(body ?? "");
  const headings = [...source.matchAll(/^##\s+(.+?)\s*$/gim)];
  const matchIndex = headings.findIndex((match) => match[1]?.trim().toLowerCase() === heading.toLowerCase());
  if (matchIndex < 0) return "";
  const start = (headings[matchIndex]?.index ?? 0) + (headings[matchIndex]?.[0].length ?? 0);
  const end = headings[matchIndex + 1]?.index ?? source.length;
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
    value.includes("/") ||
    /^(?:codex|claude|copilot)(?:\b|[-_:])/i.test(value) ||
    (normalized(value) && normalized(value) === normalized(headRef))
  );
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
    } else if (/-\s*\[\s\]/.test(governance)) {
      errors.push("Resolve every Clinical Governance Preflight checkbox before marking the PR ready.");
    }
  }

  if (classification.clinicalRisk || classification.operationalRisk) {
    if (!meaningfulText(riskAndRollout)) {
      errors.push("High-risk changes require the `## Risk and rollout` section.");
    } else {
      if (!/^\s*-?\s*Risk\s*:\s*\S.{2,}$/im.test(riskAndRollout)) {
        errors.push("Risk and rollout must include `Risk: <low|medium|high and rationale>`.");
      }
      if (!/^\s*-?\s*Rollback\s*:\s*\S.{5,}$/im.test(riskAndRollout)) {
        errors.push("Risk and rollout must include a concrete `Rollback: <plan>`.");
      }
    }
  }

  return { classification, errors, ok: errors.length === 0 };
}

function selfTest() {
  const completeBody = `## Summary\n\n- Add a trusted PR policy.\n\n## Verification\n\n- [x] \`npm run verify:pr-local\`\n- [x] \`npm run verify:ui\`\n\n## Risk and rollout\n\n- Risk: low; metadata-only validation.\n- Rollback: revert the workflow commit.\n\n## Clinical Governance Preflight\n\n- [x] Source behavior remains conservative.`;
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
  assert.match(
    evaluatePullRequestPolicy({
      title: "fix: update clinical search",
      body: completeBody.replace(
        "- [x] Source behavior remains conservative.",
        "- [ ] Source behavior remains conservative.",
      ),
      headRef: "codex/search-fix",
      files: ["src/lib/clinical-search.ts"],
    }).errors.join(" "),
    /every Clinical Governance/,
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
  console.error("[pr-policy] self-test passed");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes("--self-test")) selfTest();
  else {
    console.error("usage: pr-policy.mjs --self-test");
    process.exitCode = 1;
  }
}
