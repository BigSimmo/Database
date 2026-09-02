# Audit remediation programme — PsychSift — 2026-09-02

## Context

The 2026-09-02 full repository audit (`docs/audit/full-repository-audit-2026-09-02.md`, merged in
PR #2573) recorded 162 distinct findings: 3 High, 30 Medium, 129 Low. Josh has asked for them to be
resolved with multiple subagents fanning out simultaneously. Decisions already taken (2026-09-02):

- **Scope:** all 3 High, every Medium that is a code or document fix, and the Lows with a clear
  mechanical fix. Items needing a product decision, clinical authorship, a live service, or a
  dead-code deletion stay out (listed under "Deferred" so nothing is silently dropped).
- **Database:** the two migration-shaped fixes are **prepared as a draft PR and never merged by this
  programme**; Josh merges inside an approved window. Nothing reaches the live database.
- **Ledger:** one ledger PR files the §16 rows and closes the stale rows with the repo's own commands
  (`issues:add|update|done`), never by hand-editing; it also carries the review records.
- **Network:** `npm update browserslist` and `npm audit` against the public npm registry are approved.
  No OpenAI, Supabase, Railway or Sentry call at any point; no provider-backed gate.

Standing constraints from `AGENTS.md`: RAG-protected surfaces need the `RAG impact:` PR line and no
ranking/ordering change; ledgers are never hand-edited; `check:gate-manifest` counts move with any
added gate; `diff-integrity` floors are never raised; no test is skipped or quarantined; no dead
code is deleted without `check:dead-code-candidate`; no force pushes, no pushes to `main`, no
auto-merge set by automation; format before push; one owner per file across parallel work.

## Shape of the work

**16 work packages, one branch and one PR each, files owned by exactly one package.** Packages are
grouped by subsystem so parallel agents never edit the same file. Each package runs as a
`pipeline` of two agents: an **implementer** (does the fixes test-first in its own worktree,
commits locally, returns a structured report) and an **adversarial reviewer** (fresh agent, reads
the diff, tries to refute each fix — behaviour regression, missing test, never-touch surface
touched, RAG ordering change — and either passes the package or returns fix requests that the
implementer applies in one more round). The orchestrator then runs the package's gate in the
worktree, formats, pushes, opens a draft PR with the template body, and subscribes to it. Josh
merges; the ledger PR lands last.

Agent budget: 16 implementers + 16 reviewers + up to 8 fix rounds ≈ 40 agents, far below the audit's
first attempt. Concurrency: 2 agents per Workflow on this 4-CPU container, so packages run as
**four concurrent Workflows** (8 agents at once); heavy gates are serialised by the orchestrator
because `verify:pr-local` runs the full unit suite and a build (about 15 min each; the repo's
test-run lock forbids two at once).

### Worktrees (isolation without conflicts)

The orchestrator creates one worktree per package before any agent starts, off the freshly fetched
`origin/main`, and links the exact-lock `node_modules` the way the repo's own push guard does:

```
git worktree add -b claude/audit-fix-<pkg> /home/user/Database/.claude/worktrees/<pkg> origin/main
ln -s /home/user/Database/node_modules /home/user/Database/.claude/worktrees/<pkg>/node_modules
```

Agents receive the absolute worktree path and are forbidden to touch anything outside it, to push,
to run `npm install`, `npm run format` on the whole tree, or any `verify:*`/provider command.
Worktrees are removed only after their PR has merged (Josh's call; `node scripts/clean-worktree.mjs
--merged` lists them).

## Work packages

Legend — **G** = gate the orchestrator runs before push (per `docs/agents/verification-gates.md`):
G-heavy = `npm run verify:pr-local` (chosen automatically once `src/`, `scripts/`, `.github/` or
`data/` change); G-docs = `verify:pr-local` light docs plan; G-rag = G-heavy plus the offline RAG
evals the classifier adds, with the `RAG impact:` line. Every package also runs
`npm run test:focused -- --files <its tests>` inside the agent loop.

| Pkg | Name | Findings (report ids) | Files owned (nothing else) | G |
| --- | --- | --- | --- | --- |
| P1 | Medication reference correctness | H1 badge decimal/mg-per-mL; H2 LOW→success tone; M22 lexicon sign-off bound to content hash | `src/lib/medication-badges.ts`, `src/lib/medication-interactions.ts`, `src/components/clinical-dashboard/medication-considerations.tsx`, `docs/medication-interaction-lexicon-review.md`, `scripts/check-medication-lexicon-report.mjs` (+ tests) | G-heavy, governance preflight |
| P2 | Clinical text and table rendering (answer path, RAG-adjacent) | H3 header/body misalignment; L19 empty brackets; M1 clipboard truncation marker; M9 hyphenated-phrase deletion; M8 `unknown` status caveat; L111 257-char cut; L109 quadratic regex; L64 test for `RAG_TEXT_WEAK_OR_RELAXATION` branch (test only) | `src/components/AccessibleTable.tsx`, `src/lib/clinical-safety.ts`, `src/lib/source-text-sanitizer.ts`, `src/lib/source-governance.ts`, `src/lib/ward-output.ts`, `src/lib/answer-*.ts` text helpers (+ tests). Read `docs/rag-behaviour/safeguards.md` first; no ranking, ordering or comparator change | G-rag: `RAG impact: no retrieval behaviour change — text rendering only` |
| P3 | Session and patient-context privacy | M4 patient profile cleared on sign-out/expiry/user change via its change event; M10 favourites microsecond timestamps; L2 favourites keys scoped or cleared; L6 Care Plan draft cleared on sign-out; L1 logger key regex; L8 Sentry `ignoreErrors` exact matchers | `src/lib/patient-profile-storage.ts`, `src/lib/supabase/client.tsx` (sign-out path only), `src/components/favourites/favourites-storage.ts`, `src/components/care-plan/**/plan-draft.ts`, `src/lib/logger.ts`, `sentry.*.config.ts`, `docs/codebase-index.md:793` (+ tests) | G-heavy, governance preflight |
| P4 | Dormant Clinical Ask made truly dormant | M16 speech route 404 before any provider call + `Permissions-Policy: microphone=()` + `tests/security-headers.test.ts` pin; L33 stream route flag before limiter, 404; L16 catalogue fallback no longer substitutes the whole catalogue; L17 client surfaces 401/429 codes; L124 empty "Review extract" disclosure removed; M34 PIA sentence about the composer (text only) | `src/app/api/speech/transcribe/**`, `src/app/api/clinical-ask/**`, `src/lib/clinical-ask/**`, `src/components/clinical-ask/**`, `src/lib/security-headers.ts` (microphone directive only), the PIA paragraph on Clinical Ask (+ tests) | G-heavy, governance preflight |
| P5 | Developer hub and administrator routes | L30 gate honours `NEXT_PUBLIC_MOCKUPS_ENABLED` only under the proxy's double-flag exception + assertion in `production-readiness.ts`; L31 gate re-checked on client navigation; L32/L43 rate limits on the admin ingestion routes; L29 `/api/health/ready` rate-limited; M11 quality review row bound; L14 timezone on stamps; L15 failed-jobs count; L80/L82/L76/L69/L121 hub text and comment drift; L81 `hub-panels.ts:134` 15→16 | `src/lib/developer-area/**`, `src/components/developer-area/**`, `src/app/mockups/development/**`, `src/app/api/ingestion/**`, `src/app/api/health/**`, `scripts/production-readiness.ts` (one assertion), `tests/proxy.test.ts` (added cases only) | G-heavy |
| P6 | Caring Contacts live surface | M13 launcher card hidden or "demonstration only" unless `isCaringContactsDemoEnabled()` (keeps the Playwright offline exception); L113 registry fallbacks; L50 document `CARING_CONTACTS_DATABASE_URL` in `.env.example` and the operator doc; L74 Phase 2B handover and progress ledger corrected | `src/lib/tools-catalog.ts`, `src/lib/app-modes.ts` fallbacks, `.env.example`, `docs/caring-contacts/**` (except hazard log), `docs/deployment-architecture.md` (one paragraph) (+ tests) | G-heavy, governance preflight |
| P7 | Scripts, test safety and ledger tooling | M15 loopback guard + opt-in honoured inside `run-vitest.mjs`; M18 `enrich:documents` needs `--write`, `--all-owners`, `checkSupabaseProject()`; M28 + L59 `/issues` reader honours `issues:queue` outcomes and the pending inbox; L26 `clean:artifacts` glob; L60 report-only sweeps offline by default; L35 `design-sync.mjs` pins; L128 one `findOwnerIdByEmail`; L133 `ledger:lookup` output; L63 untrack `supabase/.branches/_current_branch` | `scripts/**` (except those owned by P8b/P11), `caring-contacts/run-db-tests.mjs`, `.gitignore`, `tests/` for those scripts | G-heavy |
| P8a | CI workflows and supply chain | M19 `npm update browserslist` + `npm audit --omit=dev --audit-level=high` green (approved registry calls); M20 Dependabot `pip` ecosystem + Trivy results surfaced; M25 staging isolation failure notification; M29 web-vitals default routes; L36 Semgrep image digest; L37 secret-scan permissions; L38 `@claude` workflow collaborator check; L54 Railway watch patterns; L55 `allowScripts`; L20 `@types/node` major; L91 CODEOWNERS RAG paths; L92 Codex auto-resolve path list; L129 overrides block | `.github/workflows/*` **except `ci.yml`**, `.github/dependabot.yml`, `CODEOWNERS`, `package.json` (`overrides`, `allowScripts`, dev types) + `package-lock.json`, `railway*.json` | G-heavy + `check:github-actions`, `check:gitleaks-pinned`, `check:npm-ci-dry-run` |
| P8b | Local gates and orphaned tests | M24 `staticHeavyGuards` in `verify-pr-local.mjs` + `assertPlan` expectations; M30 `check:medication-interactions` in `static-pr` + index-vs-snapshot test; M33 `check:clinical-hazard-controls` in `static-pr` with full-history fetch and a behaviour assertion; L22 regex escape; L47 + `#J43Z6B` narrowing: extend `check-owner-scope-api.mjs` to `src/lib/**` importers of `createAdminClient` **only if** the allowlist of deliberate public-corpus reads is complete (else report, do not widen); M31 restore the 320 px AccessibleTable journey; M32 collect `ui-tools-show-all.spec.ts`; gate-manifest counts in `CLAUDE.md` and `.claude/skills/gates/SKILL.md` moved in the same commit | `.github/workflows/ci.yml`, `scripts/verify-pr-local.mjs`, `scripts/check-gate-manifest.mjs` (only if needed), `scripts/check-clinical-hazard-controls.mjs`, `scripts/check-owner-scope-api.mjs`, `scripts/playwright-pr-shards.mjs`, `playwright.config.ts`, `tests/verification-plan*.test.ts`, `tests/playwright-pr-shards.test.ts`, the restored spec, `CLAUDE.md` count line, gates skill count line, `docs/agents/test-deletion-guard.md` note | G-heavy + `check:gate-manifest`, `check:verification-plan`, `check:ci-scope`, `check:playwright-pr-shards`, `check:browser-test-plan` |
| P9 | Agent tooling and permissions | M21 enumerate safe `git push` spellings in `.claude/settings.json`; M35 review-agent scopes cover `src/lib/rag/**`; L39 Cursor Supabase MCP `features=docs,development`; L40 deny rules for `mcp__Supabase__*` spellings; L41 checksum pins in provisioning scripts where the upstream publishes them; L61 PR-handoff hook text aligned with `docs/agents/pull-request-workflow.md`; L62 Cursor `repo-auditor` wording; L102 Cursor skill path condition; L132 `.cursorignore` BOM | `.claude/**` (settings, agents, hooks), `.cursor/**`, `.mcp.json`, `scripts/setup-claude-cloud.sh` pins, `.cursorignore` | `npm run check:skills`, `check:codex-cloud`, `check:claude-hooks` equivalents + G-docs |
| P10 | Privacy and governance documents | M2 PIA inventory adds browser-side answer/query persistence (12 h TTL); M7 `/privacy` copy no longer claims "no shared corpus" (state the public corpus and owner-scoped private documents accurately) + PIA; L103 retention migration attestation text; L104 SLO doc marks unmeasured thresholds; L7 calculator "Source" label → "Governance reference"; L5 brand preview `noindex` and no third-party preconnect; L4 crisis-line re-verification cadence note beside `verifiedOn` | `src/app/privacy/**`, `src/components/privacy/**`, `docs/privacy-impact-assessment*.md`, `docs/observability-slos.md`, `src/components/calculators/**` (label only), `public/brand/preview.html`, `src/components/care-plan/mockups/fixtures.ts` comment + doc (+ `tests/privacy-page.dom.test.tsx`) | G-heavy, governance preflight |
| P11 | Documentation drift sweep | L72, L73, L77, L79, L83, L84 (site-map generator caveat string + README robots sentence), L85, L86 (`llms.txt` brand + `tests/ui-smoke.spec.ts:1478` pin), L87, L89 (catalogue the 44 scripts), L96, L97 (root `design-qa.md` → mark superseded, do not delete), L99 (add the 32 root docs and 18 `docs/agents` files to `docs/README.md`), L100 (site-map fallback text for 9 routes), L101 | `docs/**` not owned by P3/P4/P6/P10, `README.md`, `mockups/README.md`, `public/llms.txt`, `public/robots.txt` (only if the README sentence is the wrong side), `scripts/generate-site-map.ts` string + `docs/site-map.md` regen, `tests/ui-smoke.spec.ts` line 1478 only | G-docs (G-heavy if the generator or spec changes) + `docs:check-links`, `docs:check-index`, `sitemap:check` |
| P12 | Ledger housekeeping — lands **last** | §16 rows via `issues:add`; closures via `issues:done` for `#A95DRY`, `#9P4XAE` (after inbox check), `#HDCF2B`, `#100`, `#W98GR7`, the four hub rows, L48's two rows; `issues:update` for `#J43Z6B`, `#QSHHGK`, `#Y30AXB` (L88), `#1S81R8`/`#TDKW4W` (hazard-log gap), Care Plan (L51) and Ward Flow plans (L52) rows; `ledger:append` records for every merged programme PR; regenerate both snapshots | `docs/outstanding-issues-inbox/**` (new requests only), `docs/branch-review-records/**` (new only), `data/outstanding-issues-snapshot.json`, `data/repo-awareness-snapshot.json` | `check:outstanding-issues`, `check:branch-review-ledger`, `check:ledger-write-discipline`, `check:repo-awareness-snapshot` + G-docs |
| P13 | Sandboxes and UI tidy-ups | L66 bed-release reducer tests; L65 `resume-plan` reducer test; L67 unit tests for the four ESLint rules + a service-worker test for `/forms-pdf/*.pdf`; L115/L135 dead ternary; L126 offline page mark + `lang="en-AU"`; L127 shared Playwright helpers (`expectNoPageHorizontalOverflow`, `gotoApp`) moved to `tests/helpers` | `tests/ward-*.test.ts`, `tests/caring-contacts-mockup-*.test.ts`, `tests/eslint-rules*.test.ts`, `tests/sw*.test.ts`, `tests/helpers/**`, the six specs that inline the helpers, `src/components/reference/colour-coding-reference-content.tsx`, `src/app/offline/**`, `src/app/global-error.tsx` | G-heavy (`plan:browser` dry run for the spec edits; browser proof left to CI) |
| P14 | Worker, ingestion and caches | L3 safe logging in the assertion tagger; L12 per-image error isolation + MIME cap; L13 `markJobFailure` guard, `limit` validation, GET rejected; L24 dormant edge function cannot stamp `indexed`; L11 committed-generation predicate fails closed in TS; L21 error-vs-empty cache key; L134 cache refresh keeps position; L117 docling lab keys | `worker/**`, `supabase/functions/ingestion-worker/**` (guard only, no migration), `src/lib/ingestion*.ts`, `src/lib/rag-cache.ts` or `src/lib/rag/cache*.ts` (cache keys only), `eval/docling/**` (+ tests) | G-heavy + `check:worker-python-locks:static`; `RAG impact: no retrieval behaviour change — cache keys only` if a `src/lib/rag/` file is touched |
| P15 | Edge, API and app-shell hardening | L28 CSRF guard adds an `Origin` allow check; L34 CSP drops the unused Sentry ingest origins; L110 `Vary` on `/api/setup-status`; L108 `WebVitalsReporter` no-op in production; L112 view-all links target final paths; L9 legacy `?mode=` redirect; L44 warn loudly when `RAG_QUERY_HASH_SECRET` is unset outside production | `src/proxy.ts`, `src/lib/security-headers.ts` (CSP only), `src/lib/api-csrf*.ts`, `src/app/api/setup-status/**`, `src/components/WebVitalsReporter*.tsx`, `src/lib/universal-search*.ts` links, `src/lib/mode-redirects.ts`, `src/lib/env.ts` warning only (+ tests) | G-heavy |
| P16 | Database — **prepare only, never merged here** | M12 migration nulling child owners on `set_document_corpus_access_mode('public')` + fail-fast validation guard migration per the `20260804110240` contract + updated header comment; M23 `check:migration-history` non-zero exit on `localOnly` (its own commit, flagged never-touch); L25 Caring Contacts audit guard for `pathway_versions`/`retention_state` (separate database, separate commit) | `supabase/migrations/<new>.sql` ×2, `supabase/schema.sql` regen, `scripts/check-migration-history.mjs`, `caring-contacts/supabase/migrations/<new>.sql`, `docs/database-drift-detection.md` (L73 folded in) | G-heavy + `check:migration-role`, `check:function-grants`, `check:owner-scope`; CI `Migration replay`; PR body says "merge only inside the approved window", draft, no auto-merge |

Waves (four Workflows at a time, two agents each): **Wave 1** P1, P2, P3, P4, P5, P6, P8b, P16 (highest consequence, longest gates). **Wave 2** P7, P8a, P9, P10, P11, P13, P14, P15. **P12 last**, after Josh has merged the code PRs, so its review records carry real merge SHAs and its two snapshot regenerations conflict with nothing.

## Agent contract (both roles)

Implementer prompt (per package) carries: the worktree path; the exact finding text from the report
(`### id` block plus the Stage-5 correction blockquotes, extracted by the orchestrator so agents do
not read the 790 KB report); the owned-files list as a hard boundary; the never-touch list from §12;
the rule "test first — write the failing case, then the fix; `npm run test:focused -- --files …`
must pass; `npx eslint` and `npx tsc --noEmit -p tsconfig.typecheck.json` on touched files"; commit
per finding with the required trailers and no model identifiers; no push, no install, no format of
the whole tree, no provider call, no ledger/inbox edit, no test skipped or deleted, no export
deleted. Output schema: `{package, commits[], findings_fixed[], findings_skipped[{id, reason}],
tests_added[], files_touched[], residual_risk, needs_owner_decision[]}`. `agentType` is the matching
review agent where one fits (`clinical-governance-reviewer` for P1/P2/P10, `supabase-schema-guardian`
for P16, `ingestion-worker-reviewer` for P14, `frontend-ui-reviewer` for P5/P13), else
general-purpose; effort `high` for P1, P2, P3, P4, P5, P8b, P14, P15, P16, `medium` otherwise.

Reviewer prompt: read `git diff origin/main...HEAD` in the worktree, open every touched file, run the
package's focused tests, and for each fix answer: does the test fail without the fix; does the diff
change any behaviour beyond the finding; did it touch a file outside the owned list, a never-touch
surface, or a ranking/ordering path; is any Stage-5 caution ignored. Output
`{pass, blocking[{finding, problem, required_change}], notes[]}`. Blocking items go back to the same
implementer (one round, `SendMessage`-style continuation via a second `agent()` call with the
blocking list); a second failure parks the package with the report attached, never a forced pass.

Orchestrator per package after review: `git status --porcelain` clean apart from the package's
commits; `npm run format` in the worktree and commit the result; the package's gate (heavy gates
serialised); `npm run check:diff-integrity`; `npm run verify:pr-local -- --dry-run` printed into the
PR body's Verification section with the decisive closing lines; push with the pre-push guard;
draft PR from the template (Summary, Verification with decisive lines, Risk and rollout, `RAG
impact:` where required, full Clinical Governance Preflight for clinical-risk packages, Notes);
`subscribe_pr_activity`. No auto-merge is set; Josh merges each PR. If `origin/main` moves before
push, `git merge origin/main` (never rebase) and regenerate generated files with the tooling.

## Wave 3 — the owner's later decision (2026-09-02): fix ALL findings

Josh asked that everything be fixed, including the items below. They become five more packages
run after wave 2, each making the reasonable engineering call and stating it in its PR; clinical
content is produced as DRAFT for his sign-off, never as clinical authority:

- **P17** dead-code triage under the repository protocol (L114, L119, L120, L122, L123, L125):
  delete only what `check:dead-code-candidate` allows; refusals recorded.
- **P18** design decisions made explicit (M3 narrower threshold rule, L53 bundle-ceiling decision
  record + tooling re-baseline, L52/L56 verified plan ticks + rule wording, L95 AGENTS.md claim
  paragraph, L46 one extracted dashboard component).
- **P19** security design items (L27 claims token expiry + request binding, L42 aggregate anonymous
  ceiling, L23 eval-capture ownership validation, L68 mobile Playwright projects decision, L41 pins).
- **P20** data, generated types and dependencies (L45 specifiers generator + freshness gate, L49
  docling revision pin, L118 `database.types.ts`, L131 pdfjs/zip de-duplication — registry approved).
- **P21** clinical governance drafts (M6 hazard log + message-review pack as DRAFT requiring
  clinical sign-off; L4 crisis-line verification record with a six-monthly cadence).

P11 now catalogues every uncatalogued document (L99 in full). The list below is retained as the
original reasoning; every item on it is now assigned.

## Originally deferred — now assigned to wave 3 (kept for the record)

M3 (bare-integer thresholds: a recorded design trade-off), M6 (hazard log and message-review pack:
clinical governance content, recover from the 2026-08-19 session outputs or author under clinical
sign-off), L4's actual number re-verification, L27 (proxy claims token redesign), L42 (aggregate
anonymous ceiling policy), L45 (specifiers index generator), L49 (docling model hash pin needs the
Hugging Face revision), L52/L56 (plan checkbox policy), L53 (bundle ceiling decision), L57/L58
(ledger tooling policy), L68 (mobile Playwright projects on the blocking path), L95 (AGENTS.md
gate-parsed-sections claim), L99 remainder of the catalogue, L114/L119/L120/L122/L123 (dead-code
triage, never deletion), L118 (types regeneration needs the Supabase CLI against a schema), L131
(pdfjs de-duplication), L23 (eval capture ownership, protected surface), L46, and every §9 ledger
closure that the inbox already carries (`#B0530F`, `#27TWKM`).

## Verification of the programme itself

- Every PR body quotes its gate's decisive closing lines; deferred gates are named as deferred; no
  narrowed browser run is ever called `verify:ui`.
- `git merge-tree --write-tree origin/main <tip>` clean for every branch before push.
- After each PR merges: `prlanded` content check (`git diff --stat <squash> <tip>` empty) and one
  `ledger:append` record, all carried by P12.
- Final report to Josh: table of packages → PR URL → CI state → findings fixed / skipped with reasons.

## Traps already known

Two agents editing one file (hence the ownership table; the reviewer checks it); cold worktrees
without `node_modules` (symlink); heavy gates in parallel (serialised); `data/*-snapshot.json`
regeneration in more than one PR (only P12 regenerates; no other package adds or removes a doc or
route); gate-manifest counts (P8b moves them with the gates); the `microphone=(self)` test pin
(P4 updates it); the Playwright offline exception on the developer gate and the Caring Contacts card
(P5/P6 keep it); `check:owner-scope` widening reddening every heavy PR (P8b assembles the allowlist
first or reports); migrations deploy on merge (P16 is draft-only, body says so, `pr-policy` blocks
the deferred-deploy phrasing so the body states the merge decision instead); session usage limit
(≈40 agents total, four Workflows at a time, no per-finding vote fan-out).
