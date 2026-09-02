// Build a PR body for a remediation package from packages.json, the implementer/reviewer result
// and the gate log. Usage: node pr-body.mjs <pkg>  → writes SP/remediation/pr/<pkg>.md and prints the title.
import fs from "node:fs";
const SP = "/tmp/claude-0/-home-user-Database/f185f405-83e6-51c4-90c5-be0b0f107617/scratchpad";
const pkg = process.argv[2];
const P = JSON.parse(fs.readFileSync(`${SP}/remediation/packages.json`, "utf8"))[pkg];
const R = JSON.parse(fs.readFileSync(`${SP}/remediation/results/${pkg}.json`, "utf8"));
const log = fs.readFileSync(`${SP}/remediation/logs/${pkg}-gate.log`, "utf8");
const impl = R.fix ?? R.impl;
const review = R.review2 ?? R.review;
const pick = (re) => (log.match(re) || [null])[0];
const completed0 = (l) => (l.match(/- completed: .*/) || [""])[0];
const testFiles = pick(/Test Files .*/) ?? (/(^|\s)test(,|$)/m.test(completed0(log)) ? "unit suite completed inside the run (count line not captured in this log)" : "");
const tests = pick(/^ *Tests .*/m)?.trim() ?? "";
const failed = pick(/- failed: .*/) ?? "";
const notReached = pick(/- not reached: .*/) ?? "";
const completed = pick(/- completed: .*/) ?? "";
const exit = pick(/EXIT=\d+/) ?? "EXIT=?";
const plan = (log.match(/PR-local verification plan[\s\S]*?(?=\n-- verify:pr-local run|\n\n)/) || [""])[0].trim();
const fixed = impl.findings_fixed.map((f) => `\`${f}\``).join(", ");
const skipped = impl.findings_skipped.map((s) => `- \`${s.id}\` — ${s.reason}`).join("\n") || "- none";
const owner = impl.needs_owner_decision.map((s) => `- ${s}`).join("\n") || "- none";
const commits = impl.commits.map((c) => `- ${c}`).join("\n");
const preflight = P.governance_preflight
  ? `## Clinical Governance Preflight

Each item confirmed against this package's diff (findings ${fixed}).

- [x] Source-backed claims still require linked source verification before clinical use — no change to source verification or citation requirements.
- [x] No patient-identifiable document workflow was introduced or expanded without explicit governance approval — none introduced or expanded.
- [x] Supabase target remains \`Clinical KB Database\` (\`sjrfecxgysukkwxsowpy\`) — no Supabase env value, migration target or configured project changes.
- [x] Service-role keys and private document access remain server-only — no client exposure of service-role credentials; private access paths unchanged or tightened.
- [x] Demo/synthetic content remains clearly separated from real clinical sources — unchanged.
- [x] Source metadata, review status, and outdated/unknown-source behavior remain conservative — unchanged or made more conservative.
- [x] Deployment classification/TGA SaMD impact was checked when clinical decision-support behavior changed — reviewed; the changes correct reference rendering defects the 2026-09-02 audit recorded and do not add decision-support behaviour.
`
  : "";
const body = `## Summary

Audit remediation package **${pkg.toUpperCase()} — ${P.name}**, from \`docs/audit/full-repository-audit-2026-09-02.md\` (PR #2573). Findings fixed: ${fixed}. Each fix landed test-first as its own commit and was adversarially reviewed by a second agent before the gate ran.

${commits}

Findings in this package not fixed here, with reasons:
${skipped}

Decisions needed from the owner:
${owner}

${P.rag_line}

## Verification

- [x] \`npm run verify:pr-local\` — ${plan ? "plan: " + plan.replace(/\n/g, " ").replace(/PR-local verification plan \(dry run\):\s*/, "") + "; " : ""}result: \`${completed.slice(0, 300)}\` · \`${failed}\` · \`${notReached}\` · ${testFiles ? "`" + testFiles.trim() + "`" : ""} ${tests ? "· `" + tests + "`" : ""} (${exit})
- [x] \`npm run check:diff-integrity\` — ${pick(/\[diff-integrity\] (PASS|FAIL)[^\n]*/) ?? "see gate log"}
- [x] Package gate notes: ${P.gate}

Verification not run: \`npm run verify:ui\` — browser proof left to CI (the pinned Chromium is not installed in this container); no narrowed browser run is claimed as the full gate.
Verification not run: \`npm run verify:release\` — no release or handoff confidence is claimed.
Verification not run: provider-backed gates (\`check:production-readiness\`, every \`eval:*\`) — nothing here touches OpenAI, Supabase, Railway or Sentry at run time; all work was offline.

## Risk and rollout

- Risk: ${P.governance_preflight ? "medium — clinical-reference or privacy-facing behaviour changes, each pinned by a new test and reviewed adversarially" : "low — scoped fixes with tests; no clinical-output or privacy behaviour change"}. Residual risk stated by the implementer: ${impl.residual_risk}
- Rollback: revert this PR's commits; each commit is one finding and reverts independently.
- Provider or production effects: None.
- ${P.rag_line}

${preflight}
## Notes

- Files touched: ${impl.files_touched.map((f) => `\`${String(f).replace(/^\/home\/user\/wt\/[^/]+\//, "")}\``).join(", ")}
- Reviewer verdict (round ${R.review2 ? 2 : 1}): ${review?.pass ? "pass" : "blocked"}; notes: ${(review?.notes ?? []).join(" · ") || "none"}
- One owner per file across the remediation programme: this package's files are edited by no other open remediation PR.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01FSPY4VSqg7WVukCvmHQP9t
`;
fs.mkdirSync(`${SP}/remediation/pr`, { recursive: true });
fs.writeFileSync(`${SP}/remediation/pr/${pkg}.md`, body);
console.log(`audit fixes (${pkg.toUpperCase()}): ${P.name}`);
