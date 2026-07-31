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

// Legacy PR checklist phrasing predates the canonical governance list above.
// Each item maps to one or more matcher groups; a group is satisfied only when
// every regex in that group matches at least one checked checklist entry.
const legacyClinicalGovernanceEvidence = new Map([
  [
    requiredClinicalGovernanceItems[0],
    [
      [
        /\bcitation requirements?\b/i,
        /\bsource verification\b/i,
        /\bprovenance\b/i,
        /\bclinical-content governance\b/i,
      ],
    ],
  ],
  [
    requiredClinicalGovernanceItems[1],
    [[/\bpatient-data handling\b/i, /\bprivacy controls?\b/i, /\bdocument-access behavior\b/i]],
  ],
  [requiredClinicalGovernanceItems[2], [[/\bconfigured supabase project\/target\b/i]]],
  [requiredClinicalGovernanceItems[3], [[/\bservice-role credentials?\b/i, /\bserver-side only\b/i]]],
  [requiredClinicalGovernanceItems[4], [[/\bclinical-content governance\b/i, /\bsource verification\b/i]]],
  [
    requiredClinicalGovernanceItems[5],
    [[/\bprovenance\b/i, /\bclinical-content governance\b/i, /\bsource verification\b/i]],
  ],
  [requiredClinicalGovernanceItems[6], [[/\bsamd\/tga assessment\b/i]]],
]);

const clinicalRiskPatterns = [
  /^supabase\//,
  /^src\/app\/api\//,
  // Library-layer behavior carries the clinical logic (retrieval, ranking,
  // answer generation, ingestion, source governance, privacy) so it keeps the
  // full token set.
  /^src\/lib\/.*(?:auth|permission|privacy|security|rag|retriev|rank|search|answer|clinical|citation|source|document|upload|download)/i,
  // Presentation surfaces (pages + components) are clinical-risk only when they
  // touch access control, privacy, patient data, or document upload/download —
  // NOT merely because a UI file lives under a clinically-named directory (the
  // whole src/components/clinical-dashboard tree) or is named after a
  // search/answer/source feature whose logic actually lives in src/lib.
  /^src\/(?:app|components)\/.*(?:auth|permission|privacy|security|upload|download|patient)/i,
  /^scripts\/.*(?:ingest|reindex|migration|governance|production|drift|supabase)/i,
];

const operationalRiskPatterns = [
  /^\.github\/(?:actions|workflows)\//,
  /^(?:package|package-lock)\.json$/,
  /^(?:next|playwright|vitest)(?:\..+)?\.config\.[cm]?[jt]s$/,
  /^(?:Dockerfile|railway(?:\.[^.]+)?\.json|nixpacks\.toml)$/,
];

// RAG-ranking protected surfaces (docs/rag-behaviour/safeguards.md). Narrower than
// clinicalRiskPatterns: these files change (or re-measure) retrieval/ranking ORDERING
// behaviour, which is live-validated — offline-green plus review-approved was proven
// insufficient here on 2026-07-20 (Phase C regression, canary #55). A PR touching any of
// them must carry an explicit `RAG impact:` declaration (see evaluatePullRequestPolicy).
const ragRankingPatterns = [
  /^src\/lib\/rag\//,
  /^src\/lib\/(?:clinical-search|retrieval-selection|released-search-order|ranking-config|evidence|result-sort|answer-ranking|evidence-relevance|semantic-rerank|eval-document-matching)\.ts$/,
  /^scripts\/(?:eval-retrieval|build-ranking-snapshot|tune-search-weights)\.ts$/,
  /^scripts\/lib\/(?:clinical-aliases|ranking-tuning|ranking-snapshot-builder)\.ts$/,
  /^scripts\/fixtures\/(?:rag-retrieval-golden|rag-ranking-candidate-snapshot\.v1)\.json$/,
  // The contract-pinning tests are protected too: weakening them is the evasion route.
  /^tests\/(?:rag-fast-path-ordering|ranking-tuning|retrieval-selection|rag-second-stage-ranking|eval-retrieval|rag-imputation-contract)\.test\.ts$/,
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

export function section(body, heading) {
  const source = String(body ?? "");
  const headings = [...source.matchAll(/^(#{1,6})[ \t]+(.+?)[ \t]*$/gim)];
  const targetHeading = normalizeSectionHeading(heading);
  // Collect content from ALL matching sections and join them. This handles
  // accidental duplicate headings (e.g. a prose rationale block and a separate
  // checklist block under the same heading) by combining their content rather
  // than silently returning only the first occurrence and missing the checklist.
  const parts = [];
  headings.forEach((match, matchIndex) => {
    if (normalizeSectionHeading(match[2]) !== targetHeading) return;
    const start = (match.index ?? 0) + match[0].length;
    // Markdown outline semantics: the section runs until the next heading of the
    // same or shallower level. Deeper headings (### under ##) are sub-structure
    // and stay inside the section, so checklist evidence after them still counts.
    const level = match[1].length;
    const next = headings.slice(matchIndex + 1).find((m) => m[1].length <= level);
    const end = next?.index ?? source.length;
    const content = source.slice(start, end).trim();
    if (content) parts.push(content);
  });
  return parts.join("\n\n");
}

function meaningfulText(value) {
  const normalized = String(value ?? "")
    .replace(/<!--[^]*?-->/g, "")
    // Sub-headings kept inside a section by the outline-aware boundary are
    // structure, not content — a section holding only headings is still empty.
    .replace(/^\s*#{1,6}[ \t]+\S.*$/gm, "")
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

function checkedChecklistEntries(value) {
  return [...String(value ?? "").matchAll(/^\s*-\s*\[[xX]\]\s*(.+?)\s*$/gm)].map((match) => match[1].trim());
}

function governanceMatcherGroupSatisfied(group, checkedEntries) {
  return group.every((matcher) => checkedEntries.some((entry) => matcher.test(entry)));
}

function governanceItemSatisfied(checkedEntries, item) {
  if (checkedEntries.some((entry) => entry === item)) return true;
  const matcherGroups = legacyClinicalGovernanceEvidence.get(item);
  if (!matcherGroups || matcherGroups.length === 0) return false;
  return matcherGroups.some((group) => governanceMatcherGroupSatisfied(group, checkedEntries));
}

// Used by ci.yml to detect which governance items an existing PR body already
// satisfies (including legacy phrasing) before syncing the checklist.
export function collectSatisfiedGovernanceItems(value) {
  const checkedEntries = checkedChecklistEntries(value);
  return requiredClinicalGovernanceItems.filter((item) => governanceItemSatisfied(checkedEntries, item));
}

// Tolerant matching for the policy gate itself: affirm every item is checked
// without demanding the exact required wording. Authors may lightly reword or
// reformat the checklist, but a clinical-risk PR must leave no box unchecked
// and must cover at least the required number of governance items.
function governanceBoxStats(value) {
  const source = String(value ?? "");
  return {
    checked: (source.match(/-\s*\[[xX]\]/g) ?? []).length,
    unchecked: (source.match(/-\s*\[ \]/g) ?? []).length,
  };
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
    ragRanking: normalized.some((file) => ragRankingPatterns.some((pattern) => pattern.test(file))),
    ui: normalized.some((file) => uiPatterns.some((pattern) => pattern.test(file))),
  };
}

// The `RAG impact:` declaration a ragRanking PR must carry: either an explicit
// no-behaviour-change statement (with a reason) or a canary-pair reference. Matched anywhere
// in the body, list-marker tolerant, case-insensitive.
export function ragImpactDeclared(body) {
  const match = String(body ?? "").match(/^[\s>*-]*\*{0,2}RAG impact\*{0,2}:\s*(\S[^\n]*)/im);
  if (!match) return { declared: false, satisfied: false };
  const detail = match[1].trim();
  const noChange = /no\s+(?:retrieval\s+|ranking\s+)?behaviou?r\s+change/i.test(detail);
  const canary = /canar/i.test(detail);
  return { declared: true, satisfied: (noChange || canary) && detail.length >= 12 };
}

export function evaluatePullRequestPolicy({ title, body, headRef, files }) {
  // Two conditions block the PR (hard failure): a clinical-risk diff without a
  // complete Clinical Governance Preflight, and a RAG-ranking-surface diff
  // without an explicit `RAG impact:` declaration. Every other metadata
  // expectation (title, summary, verification, UI, risk and rollout) is
  // advisory: it is surfaced as a warning so authors still get the nudge, but
  // it never fails the check or blocks a merge.
  const errors = [];
  const warnings = [];
  const classification = classifyPullRequestFiles(files);
  const summary = section(body, "Summary");
  // The summary must be its own prose: content nested under a sub-heading
  // (e.g. a mis-levelled `### Verification`) belongs to that sub-topic and
  // cannot stand in for the required outcome summary.
  const summaryDirect = summary.replace(/^[ \t]*#{1,6}[ \t]+\S[^]*$/m, "");
  const verification = section(body, "Verification");
  const riskAndRollout = section(body, "Risk and rollout");
  const governance = section(body, "Clinical Governance Preflight");

  if (String(title ?? "").trim().length < 12)
    warnings.push("Use a specific, outcome-focused PR title (at least 12 characters).");
  if (branchLikeTitle(title, headRef))
    warnings.push("Replace the branch-style PR title with an outcome-focused title.");
  if (!meaningfulText(summaryDirect))
    warnings.push("Complete the `## Summary` section with the outcome and affected area.");
  if (!meaningfulText(verification)) {
    warnings.push("Complete the `## Verification` section with exact results or a reason checks were not run.");
  } else if (!/-\s*\[[xX]\]/.test(verification) && !explicitNotRun(verification)) {
    warnings.push(
      "Verification should contain a checked result or an explicit `Verification not run: <reason>` entry.",
    );
  }

  if (
    classification.ui &&
    !checkedCommand(verification, "npm run verify:ui") &&
    !explicitNotRun(verification, "UI verification")
  ) {
    warnings.push(
      "UI changes should include checked `npm run verify:ui` evidence or `UI verification not run: <reason>`.",
    );
  }

  // Blocking gate: a PR touching RAG-ranking protected surfaces must declare its impact
  // explicitly (docs/rag-behaviour/safeguards.md — layer 1). Ordering behaviour is
  // live-validated; the declaration forces every session/task to consciously state either
  // "no behaviour change" (with a reason) or the canary pair covering the change.
  if (classification.ragRanking) {
    const ragImpact = ragImpactDeclared(body);
    if (!ragImpact.declared) {
      errors.push(
        "This PR touches RAG-ranking protected surfaces. Add a `RAG impact:` line to the body — either `RAG impact: no retrieval behaviour change — <reason>` or `RAG impact: behaviour change — canary pair <baseline> -> <post>` (see docs/rag-behaviour/safeguards.md).",
      );
    } else if (!ragImpact.satisfied) {
      errors.push(
        "The `RAG impact:` line must state `no retrieval behaviour change — <reason>` or reference the validating canary pair (see docs/rag-behaviour/safeguards.md).",
      );
    }
  }

  // Blocking gate: a clinical-risk PR must carry a complete Clinical Governance
  // Preflight. This is the only other condition that fails the check.
  if (classification.clinicalRisk) {
    if (!meaningfulText(governance)) {
      errors.push("Clinical-risk paths require the `## Clinical Governance Preflight` section.");
    } else {
      const { checked, unchecked } = governanceBoxStats(governance);
      if (unchecked > 0 || checked < requiredClinicalGovernanceItems.length) {
        errors.push(
          `Check every Clinical Governance Preflight item before marking the PR ready (all ${requiredClinicalGovernanceItems.length} boxes checked, none left unchecked).`,
        );
      }
    }
  }

  if (classification.clinicalRisk || classification.operationalRisk) {
    if (!meaningfulText(riskAndRollout)) {
      warnings.push("High-risk changes should include the `## Risk and rollout` section.");
    } else {
      if (!substantiveRisk(fieldValue(riskAndRollout, "Risk"))) {
        warnings.push("Risk and rollout should include `Risk: <low|medium|high and rationale>`.");
      }
      if (!substantiveRollback(fieldValue(riskAndRollout, "Rollback"))) {
        warnings.push("Risk and rollout should include a concrete `Rollback: <plan>`.");
      }
    }
  }

  return { classification, errors, warnings, ok: errors.length === 0 };
}

function selfTest() {
  const completeGovernance = requiredClinicalGovernanceItems.map((item) => `- [x] ${item}`).join("\n");
  const completeBody = `## Summary\n\n- Add a trusted PR policy.\n\nRAG impact: no retrieval behaviour change — metadata-only validation.\n\n## Verification\n\n- [x] \`npm run verify:pr-local\`\n- [x] \`npm run verify:ui\`\n\n## Risk and rollout\n\n- Risk: low; metadata-only validation.\n- Rollback: revert the workflow commit.\n\n## Clinical Governance Preflight\n\n${completeGovernance}`;
  assert.equal(
    evaluatePullRequestPolicy({
      title: "ci: enforce pull request evidence",
      body: completeBody,
      headRef: "codex/pr-policy",
      files: [".github/workflows/pr-policy.yml"],
    }).ok,
    true,
  );
  // Advisory metadata issues are surfaced as warnings and NEVER block the check.
  const branchStyle = evaluatePullRequestPolicy({
    title: "Codex/pr-policy",
    body: "",
    headRef: "codex/pr-policy",
    files: [],
  });
  assert.match(branchStyle.warnings.join(" "), /branch-style/);
  assert.equal(branchStyle.ok, true, "advisory-only issues must not fail the check");
  assert.match(
    evaluatePullRequestPolicy({
      title: "fix: update search behavior",
      body: completeBody.replace("- [x] `npm run verify:ui`\n", ""),
      headRef: "codex/search-fix",
      files: ["src/components/search.tsx"],
    }).warnings.join(" "),
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
  // A section whose only content is a nested sub-heading is still empty: the
  // outline-aware boundary must not let heading lines satisfy meaningfulText.
  assert.match(
    evaluatePullRequestPolicy({
      title: "fix: something meaningful here",
      body: "## Summary\n\n### Verification\n\n- [x] `npm run verify:pr-local`\n",
      headRef: "codex/x",
      files: ["docs/a.md"],
    }).warnings.join(" "),
    /## Summary/,
  );
  // ...but a level-1 heading is shallower than ## and DOES end the section, so
  // evidence stranded after it must not count toward the preceding section.
  assert.match(
    evaluatePullRequestPolicy({
      title: "fix: update search behavior",
      body: completeBody.replace("- [x] `npm run verify:ui`\n", "# Appendix\n\n- [x] `npm run verify:ui`\n"),
      headRef: "codex/search-fix",
      files: ["src/components/search.tsx"],
    }).warnings.join(" "),
    /verify:ui/,
  );
  // Tolerant governance: a lightly reworded but still-checked item passes — the
  // check no longer demands the exact required wording.
  assert.equal(
    evaluatePullRequestPolicy({
      title: "fix: update clinical search",
      body: completeBody.replace(
        `- [x] ${requiredClinicalGovernanceItems[0]}`,
        "- [x] Reviewed: linked-source verification for clinical use is unchanged",
      ),
      headRef: "codex/search-fix",
      files: ["src/lib/clinical-search.ts"],
    }).ok,
    true,
  );
  // ...but an unchecked governance box still fails a clinical-risk PR.
  assert.match(
    evaluatePullRequestPolicy({
      title: "fix: update clinical search",
      body: completeBody.replace(
        `- [x] ${requiredClinicalGovernanceItems[0]}`,
        `- [ ] ${requiredClinicalGovernanceItems[0]}`,
      ),
      headRef: "codex/search-fix",
      files: ["src/lib/clinical-search.ts"],
    }).errors.join(" "),
    /Clinical Governance Preflight/,
  );
  // ...and dropping an item below the required count fails too.
  assert.match(
    evaluatePullRequestPolicy({
      title: "fix: update clinical search",
      body: completeBody.replace(`- [x] ${requiredClinicalGovernanceItems[0]}\n`, ""),
      headRef: "codex/search-fix",
      files: ["src/lib/clinical-search.ts"],
    }).errors.join(" "),
    /Clinical Governance Preflight/,
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
    }).warnings.join(" "),
    /Risk and rollout should include/,
  );
  assert.match(
    evaluatePullRequestPolicy({
      title: "ci: enforce pull request evidence",
      body: completeBody.replace("Rollback: revert the workflow commit.", "Rollback: none because this is small"),
      headRef: "codex/pr-policy",
      files: [".github/workflows/pr-policy.yml"],
    }).warnings.join(" "),
    /concrete `Rollback/,
  );
  assert.match(
    evaluatePullRequestPolicy({
      title: "docs: explain the review process",
      body: "## Summary\n\n- Useful documentation.\n\n## Verification\n\n- [ ] `npm run verify:pr-local`\n<!-- Use `Verification not run: <reason>` when blocked. -->",
      headRef: "codex/review-docs",
      files: ["docs/process-hardening.md"],
    }).warnings.join(" "),
    /checked result/,
  );
  assert.deepEqual(classifyPullRequestFiles(["src/app/api/search/route.ts"]), {
    files: ["src/app/api/search/route.ts"],
    clinicalRisk: true,
    operationalRisk: false,
    ragRanking: false,
    ui: false,
  });
  // Narrowed classification: presentation-only UI under the clinically-named
  // component tree is a UI change, not a clinical-governance change, so it no
  // longer auto-demands the preflight.
  assert.deepEqual(classifyPullRequestFiles(["src/components/clinical-dashboard/settings-dialog.tsx"]), {
    files: ["src/components/clinical-dashboard/settings-dialog.tsx"],
    clinicalRisk: false,
    operationalRisk: false,
    ragRanking: false,
    ui: true,
  });
  // RAG-ranking protected surfaces (docs/rag-behaviour/safeguards.md): a PR touching them
  // without a `RAG impact:` declaration is hard-blocked...
  const ragUndeclared = evaluatePullRequestPolicy({
    title: "fix: adjust release ordering tie-break",
    body: completeBody.replace(/^RAG impact:.*\n\n/m, ""),
    headRef: "codex/ordering-fix",
    files: ["src/lib/released-search-order.ts"],
  });
  assert.equal(ragUndeclared.ok, false, "RAG-surface PRs without a RAG impact line must block");
  assert.match(ragUndeclared.errors.join(" "), /RAG impact/);
  // ...a vague declaration (neither no-change nor canary) also blocks...
  assert.match(
    evaluatePullRequestPolicy({
      title: "fix: adjust release ordering tie-break",
      body: completeBody.replace(/^RAG impact:.*$/m, "RAG impact: probably fine"),
      headRef: "codex/ordering-fix",
      files: ["src/lib/released-search-order.ts"],
    }).errors.join(" "),
    /RAG impact/,
  );
  // ...an explicit no-behaviour-change declaration passes (with governance complete)...
  assert.equal(
    evaluatePullRequestPolicy({
      title: "docs: clarify release-order comments",
      body: completeBody,
      headRef: "codex/ordering-docs",
      files: ["src/lib/released-search-order.ts"],
    }).ok,
    true,
    "a declared no-behaviour-change RAG PR must pass",
  );
  // ...and a canary-pair declaration passes for behaviour changes.
  assert.equal(
    evaluatePullRequestPolicy({
      title: "feat: retrieval ordering change",
      body: completeBody.replace(
        /^RAG impact:.*$/m,
        "RAG impact: behaviour change — canary pair run 54 -> post-merge dispatch planned",
      ),
      headRef: "codex/ordering-change",
      files: ["src/lib/rag/rag-candidate-sources.ts", "tests/rag-fast-path-ordering.test.ts"],
    }).ok,
    true,
    "a canary-pair-declared RAG behaviour change must pass",
  );
  // The golden fixture and contract tests are protected surfaces too.
  assert.equal(classifyPullRequestFiles(["scripts/fixtures/rag-retrieval-golden.json"]).ragRanking, true);
  assert.equal(classifyPullRequestFiles(["tests/ranking-tuning.test.ts"]).ragRanking, true);
  // Answer synthesis is clinical-risk but NOT rag-ranking (retrieval ordering is the
  // protected axis here; generation keeps the governance gate only).
  assert.equal(classifyPullRequestFiles(["src/lib/answer-synthesis.ts"]).ragRanking, false);
  // ...but privacy/access-control UI surfaces stay gated.
  assert.equal(classifyPullRequestFiles(["src/components/privacy-input-notice.tsx"]).clinicalRisk, true);
  // ...and clinical behavior in the library layer stays gated.
  assert.equal(classifyPullRequestFiles(["src/lib/clinical-search.ts"]).clinicalRisk, true);
  // End-to-end: a dashboard UI PR with Summary + UI verification + risk but no
  // Clinical Governance Preflight now passes (previously it failed on the
  // clinically-named path alone).
  assert.equal(
    evaluatePullRequestPolicy({
      title: "fix: tidy home page spacing",
      body: "## Summary\n\n- Remove the redundant quick-actions row and tidy spacing.\n\n## Verification\n\n- [x] `npm run verify:ui`\n\n## Risk and rollout\n\n- Risk: low; presentation-only removal of a duplicate action row.\n- Rollback: revert this commit.",
      headRef: "claude/home-page-spacing",
      files: ["src/components/clinical-dashboard/answer-empty-state.tsx", "src/app/globals.css"],
    }).ok,
    true,
  );
  // Block-only contract: a completely bare body on non-clinical files raises
  // several advisory warnings but never blocks the check.
  const bare = evaluatePullRequestPolicy({
    title: "x",
    body: "",
    headRef: "codex/whatever",
    files: ["src/components/ui/button.tsx"],
  });
  assert.equal(bare.ok, true, "non-clinical PRs must never be blocked by advisory metadata gaps");
  assert.ok(bare.warnings.length > 0, "advisory gaps should still be surfaced as warnings");
  // ...but a clinical-risk PR with no governance section is the one hard block.
  const clinicalBlocked = evaluatePullRequestPolicy({
    title: "fix: adjust answer synthesis grounding",
    body: "## Summary\n\n- Tweak synthesis.",
    headRef: "codex/answer-fix",
    files: ["src/lib/answer-synthesis.ts"],
  });
  assert.equal(clinicalBlocked.ok, false, "clinical-risk PRs missing governance must still block");
  assert.match(clinicalBlocked.errors.join(" "), /Clinical Governance Preflight/);
  assert.equal(
    section("### Summary ###\n\n- concise summary\n\n### Verification\n\n- [x] `npm run verify:pr-local`\n", "Summary"),
    "- concise summary",
  );
  // Duplicate section headings: content from all occurrences must be combined
  // so that a prose block followed by a checklist block (same heading) is
  // treated as a single section for checklist matching purposes.
  assert.equal(
    evaluatePullRequestPolicy({
      title: "ci: enforce pull request evidence",
      body:
        "## Summary\n\n- Add a trusted PR policy.\n\n## Verification\n\n- [x] `npm run verify:pr-local`\n- [x] `npm run verify:ui`\n\n## Risk and rollout\n\n- Risk: low; metadata-only validation.\n- Rollback: revert the workflow commit.\n\n## Clinical Governance Preflight\n\nProse rationale for the change.\n\n## Clinical Governance Preflight\n\n" +
        completeGovernance,
      headRef: "codex/pr-policy",
      files: [".github/workflows/pr-policy.yml"],
    }).ok,
    true,
    "duplicate section headings should combine content for checklist matching",
  );
  assert.deepEqual(
    collectSatisfiedGovernanceItems(`- [x] This change does not alter citation requirements, source verification, provenance, or clinical-content governance.
- [x] This change does not alter privacy controls, patient-data handling, authentication, authorization, or document-access behavior.
- [x] Any Supabase service-role credentials used by the migration-history diagnostic remain CI/server-side only and are not exposed to clients.
- [x] This change does not alter the configured Supabase project/target or perform a production database migration.
- [x] No SaMD/TGA assessment is required because this change has no clinical decision-support impact.`),
    requiredClinicalGovernanceItems,
    "legacy governance attestations should map onto required checklist coverage",
  );
  assert.doesNotMatch(
    collectSatisfiedGovernanceItems(
      "- [x] This change does not alter citation requirements, source verification, or clinical-content governance.",
    ).join("\n"),
    new RegExp(requiredClinicalGovernanceItems[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    "legacy coverage should fail when a required signal (provenance) is missing",
  );
  assert.deepEqual(
    collectSatisfiedGovernanceItems(`- [x] ${requiredClinicalGovernanceItems[2]}
- [x] This change does not alter citation requirements, source verification, provenance, or clinical-content governance.
- [x] This change does not alter privacy controls, patient-data handling, authentication, authorization, or document-access behavior.
- [x] Any Supabase service-role credentials used by the migration-history diagnostic remain CI/server-side only and are not exposed to clients.
- [x] No SaMD/TGA assessment is required because this change has no clinical decision-support impact.`),
    requiredClinicalGovernanceItems,
    "mixed canonical + legacy governance attestations should satisfy all required items",
  );
  assert.equal(
    collectSatisfiedGovernanceItems("- [x] Legacy governance text without the expected policy keywords.").length,
    0,
    "malformed legacy attestations must not satisfy governance coverage",
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
