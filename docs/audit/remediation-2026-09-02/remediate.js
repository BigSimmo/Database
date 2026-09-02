export const meta = {
  name: 'audit-remediation-wave',
  description: 'Implement audit fix packages test-first in isolated worktrees, adversarially review each, one fix round',
  phases: [
    { title: 'Implement', detail: 'one implementer per package, in its own worktree' },
    { title: 'Review', detail: 'one adversarial reviewer per package' },
    { title: 'Fix round', detail: 'implementer applies blocking review items, reviewer re-checks' },
  ],
}
const SP = args.sp
const IDS = args.ids
const PKG_FILE = `${SP}/remediation/packages.json`
const FINDINGS_DIR = `${SP}/remediation/findings`

const IMPL_SCHEMA = { type: 'object', required: ['package', 'commits', 'findings_fixed', 'findings_skipped', 'tests_added', 'files_touched', 'residual_risk', 'needs_owner_decision'], properties: { package: { type: 'string' }, commits: { type: 'array', items: { type: 'string' } }, findings_fixed: { type: 'array', items: { type: 'string' } }, findings_skipped: { type: 'array', items: { type: 'object', required: ['id', 'reason'], properties: { id: { type: 'string' }, reason: { type: 'string' } } } }, tests_added: { type: 'array', items: { type: 'string' } }, files_touched: { type: 'array', items: { type: 'string' } }, residual_risk: { type: 'string' }, needs_owner_decision: { type: 'array', items: { type: 'string' } } } }
const REVIEW_SCHEMA = { type: 'object', required: ['pass', 'blocking', 'notes'], properties: { pass: { type: 'boolean' }, blocking: { type: 'array', items: { type: 'object', required: ['finding', 'problem', 'required_change'], properties: { finding: { type: 'string' }, problem: { type: 'string' }, required_change: { type: 'string' } } } }, notes: { type: 'array', items: { type: 'string' } } } }

const RULES = (id) => `HARD RULES (violating any one fails the package):
- Work ONLY inside the worktree /home/user/wt/${id} on branch claude/audit-fix-${id}. Every command runs there (cd /home/user/wt/${id} first; use absolute paths). Never touch /home/user/Database (the main checkout) or any other /home/user/wt/* directory. Never run git checkout/switch/stash/rebase/reset --hard, never change branch.
- Edit ONLY files inside the package's "owned" list (packages.json). If a fix needs another file, do not edit it: record the finding under findings_skipped with the reason and the file.
- Never: git push; npm install/ci/update (except where the package notes explicitly approve a registry call); npm run format on the whole tree (use "npx prettier --write <file>" on the files you touched); any npm run verify:*; any eval:*; check:production-readiness; check:supabase-project; anything that talks to OpenAI, Supabase, Railway, Sentry, GitHub or hosted CI. The local PostgreSQL, if running, is a local container process and may be used only by p16 for the Caring Contacts suite.
- Never edit docs/outstanding-issues.md, docs/branch-review-ledger.md, docs/branch-review-records/**, docs/outstanding-issues-inbox/**, tests/flake-ledger.json, diff-integrity.json, bundle-budget.json, or the five gate-parsed AGENTS.md sections. Never skip, delete, quarantine or weaken a test. Never delete an exported symbol or a file. Never add or remove a document under docs/ or a page route (the repo-awareness snapshot is regenerated elsewhere).
- Never change RAG ranking, ordering, selection, comparator keys, relevance scores, golden fixtures, the eval harness or retrieval RPCs. Read ${SP}/remediation/findings/_never-touch.md before starting.
- No model identifiers anywhere in code, comments or commit messages.`

const implPrompt = (id) => `You are the IMPLEMENTER for audit remediation package "${id}" in the PsychSift repository (a clinical reference tool for a psychiatrist; failure behaviour must degrade conservatively, never guess).

Read, in this order: (1) ${PKG_FILE} — use the entry with id "${id}": name, findings, owned files, notes (the notes carry the agreed approach per finding; follow them). (2) Every finding file ${FINDINGS_DIR}/<id>.md for the ids listed (each is the audit's verified finding with file:line, trigger, impact, proof, fix sketch, the skeptic's verdict and any Stage-5 correction blockquote — the blockquotes are the latest word). (3) ${FINDINGS_DIR}/_never-touch.md. (4) /home/user/wt/${id}/AGENTS.md top-to-bottom (it is short) and any docs the package notes name. Line numbers in findings were taken on an older main; re-locate by content.

${RULES(id)}

METHOD, per finding, in the package's listed order:
1. Re-verify the defect on this branch (open the file; run the smallest proof). If it is already fixed on main, record it under findings_skipped with reason "already fixed on main at <commit>".
2. Test first: add the failing test case(s) the finding names (or the closest test file that already exists), run "npm run test:focused -- --files <that test>" and confirm the new case fails for the right reason.
3. Make the smallest fix that the finding and the package notes describe. Follow existing patterns; design tokens not hex; keep behaviour changes to the finding.
4. Run "npm run test:focused -- --files <tests you touched plus the module's existing tests>", then "npx eslint <touched files>" and "npx tsc --noEmit -p tsconfig.typecheck.json" (typecheck once at the end is fine). Run "npx prettier --write" on the files you touched.
5. Commit that finding on its own: message "<area>: <what changed> (<finding id>)", a body that names the defect, the trigger and the test that proves it, then the two trailers on their own lines at the end:
Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FSPY4VSqg7WVukCvmHQP9t
If the repository's pre-commit hook regenerates a generated document, include that regenerated file in the commit and list it in files_touched.
6. After the last finding: "git status --porcelain" must be empty; "git log --oneline origin/main..HEAD" lists your commits.

If a finding cannot be fixed within the owned files, needs a product or clinical decision, would change RAG ordering, or needs a network/provider call, do NOT improvise — put it in findings_skipped or needs_owner_decision with a precise reason and move on. Do not widen scope. Return the structured result: package id, the commit SHAs with subjects, findings fixed, findings skipped with reasons, tests added, files touched, one paragraph of residual risk, and owner decisions needed.`

const reviewPrompt = (id, impl, round) => `You are the ADVERSARIAL REVIEWER for audit remediation package "${id}" (round ${round}). Your job is to try to refute every fix the implementer claims. READ-ONLY: never edit, create, delete or format any file, never commit, never git checkout/stash/reset; you may run focused tests and eslint/tsc.

Context: read ${PKG_FILE} (entry "${id}"), each ${FINDINGS_DIR}/<finding>.md the entry lists, and ${FINDINGS_DIR}/_never-touch.md. The implementer reported: ${JSON.stringify(impl)}.

In /home/user/wt/${id}: run "git log --oneline origin/main..HEAD" and "git diff origin/main...HEAD --stat", then read the full diff ("git diff origin/main...HEAD") and open every touched file in context. For EACH finding claimed fixed, answer with evidence:
a) Does the new test fail without the fix? (Check by reading; if cheap, temporarily reason about the pre-fix code path — do not modify files.) Does it assert the actual failure the finding describes, or something weaker?
b) Does the diff change any behaviour beyond the finding (wider regex, new default, removed guard, changed error tone or wording elsewhere)?
c) Did any touched file fall outside the package's owned list? Any never-touch surface (src/lib/rag/**, ranking/ordering/selection, ledgers, inbox, records, flake ledger, diff-integrity, bundle budget, gate-parsed AGENTS.md sections)? Any test skipped, deleted or weakened? Any export or file deleted? Any document or route added or removed?
d) Was a Stage-5 correction blockquote or a package note ignored (e.g. the microphone pin, the double-flag exception, the Playwright offline exception, gate-manifest counts, the owner-scope allowlist rule, migration transaction rules)?
e) Run "npm run test:focused -- --files <the touched tests>" and "npx eslint <touched source files>"; quote the decisive output line.
Also check each findings_skipped reason is true (open the file: is it really already fixed / really outside the owned files?).

Return pass=true only if nothing blocking remains. A blocking item is a regression risk, a missing or weak test, a scope or never-touch violation, a false skip reason, or a failing focused test. Put everything else in notes. For each blocking item give the finding id, the concrete problem with file:line, and the exact required change.`

const fixPrompt = (id, impl, review) => `You are the IMPLEMENTER for audit remediation package "${id}" returning for ONE fix round. Your earlier result: ${JSON.stringify(impl)}. The adversarial reviewer found these BLOCKING items: ${JSON.stringify(review.blocking)} and these notes: ${JSON.stringify(review.notes)}.

Read ${PKG_FILE} (entry "${id}"), the finding files under ${FINDINGS_DIR}/ for the blocked findings, and ${FINDINGS_DIR}/_never-touch.md again.

${RULES(id)}

Address every blocking item exactly as required (if a required change is itself wrong or unsafe, say so in residual_risk and leave that finding under findings_skipped with the reason instead of forcing it). Add or strengthen tests first, then fix, run "npm run test:focused -- --files <tests>", eslint and tsc on touched files, prettier on touched files, and commit each change with the same message format and the two trailers (Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com> / Claude-Session: https://claude.ai/code/session_01FSPY4VSqg7WVukCvmHQP9t). "git status --porcelain" must be empty at the end. Return the updated structured result covering the whole package (all commits, all findings fixed/skipped).`

const pkgOpts = (id, phase, label) => ({ label, phase, schema: IMPL_SCHEMA, effort: args.effort?.[id] ?? 'high', agentType: args.agentType?.[id] ?? 'general-purpose' })

const results = await pipeline(
  IDS,
  (id) => agent(implPrompt(id), pkgOpts(id, 'Implement', `impl:${id}`)),
  (impl, id) => impl ? agent(reviewPrompt(id, impl, 1), { label: `review:${id}`, phase: 'Review', schema: REVIEW_SCHEMA, effort: 'high' }).then((review) => ({ impl, review })) : null,
  (r, id) => {
    if (!r) return null
    if (!r.review || (r.review.pass && !(r.review.blocking || []).length)) return r
    log(`${id}: reviewer blocked ${r.review.blocking.length} item(s); running fix round`)
    return agent(fixPrompt(id, r.impl, r.review), pkgOpts(id, 'Fix round', `fix:${id}`)).then((fix) => ({ ...r, fix }))
  },
  (r, id) => (r && r.fix) ? agent(reviewPrompt(id, r.fix, 2), { label: `review2:${id}`, phase: 'Fix round', schema: REVIEW_SCHEMA, effort: 'high' }).then((review2) => ({ ...r, review2 })) : r,
)
return Object.fromEntries(IDS.map((id, i) => [id, results[i]]))
