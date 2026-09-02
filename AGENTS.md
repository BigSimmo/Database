<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# How these rules are organised

This file is the always-loaded core. It carries the boundaries that prevent irreversible harm, and
the sections a committed gate parses by exact text. Every other rule keeps its heading here and its
full text — verbatim, nothing dropped — in a named reference file. Open the file before acting in
its area.

**Read these first; they prevent damage that cannot be undone, and their full text is below:**
`# Supabase project safety` (merging a migration reaches the live clinical database within
seconds, with no deploy step in between), `# RAG ranking protection`, `# Railway project safety`,
`# API and provider confirmation boundary`, and `# Local server safety`.

| Topic                                                                                                                     | Full text                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Gate selection, the verification tier table, the gate arbiter                                                             | [`docs/agents/verification-gates.md`](docs/agents/verification-gates.md)                     |
| Open PR sync, the `Run PR` sweep, babysitting a PR, review coverage, PR bundling                                          | [`docs/agents/pull-request-workflow.md`](docs/agents/pull-request-workflow.md)               |
| The `upload` shortcut                                                                                                     | [`docs/agents/upload-shortcut.md`](docs/agents/upload-shortcut.md)                           |
| Button and route wiring, the bundle budget                                                                                | [`docs/agents/wiring-and-bundle-budget.md`](docs/agents/wiring-and-bundle-budget.md)         |
| External skill precedence, evidence and calibration                                                                       | [`docs/agents/external-skill-precedence.md`](docs/agents/external-skill-precedence.md)       |
| Deleting code you believe is dead                                                                                         | [`docs/agents/dead-code-deletion.md`](docs/agents/dead-code-deletion.md)                     |
| Claude Code hook scripts                                                                                                  | [`docs/agents/claude-hook-scripts.md`](docs/agents/claude-hook-scripts.md)                   |
| The `bug-hunter` shortcut                                                                                                 | [`docs/agents/bug-hunter-shortcut.md`](docs/agents/bug-hunter-shortcut.md)                   |
| Repository skills, the `/issues` outstanding-work memory                                                                  | [`docs/agents/repository-skills-and-issues.md`](docs/agents/repository-skills-and-issues.md) |
| Codex dependency, review throttling, desktop worktree, reasoning effort, productivity, GitHub review, Cloud; Cursor Cloud | the `docs/agents/codex-*.md` and `docs/agents/cursor-cloud.md` pointers below                |

Five sections stay here in full because a committed test or script reads their exact text:
`## Bare PR publication is not readiness work`, the format-before-push rule,
`# Search chrome behaviour`, `## Anti-conflict and CI-speed operating procedure`, and
`## Codex Cloud environment`. Their wording is code, not prose — moving or rewording it fails
`verify:cheap`.

<!-- BEGIN:dependency-shortcut -->

## Dependency shortcut

For the full Codex dependency shortcut workflow, see [`docs/agents/codex-dependency-shortcut.md`](docs/agents/codex-dependency-shortcut.md).

<!-- END:dependency-shortcut -->

<!-- BEGIN:bug-hunter-shortcut -->

## Bug-hunter shortcut

For the `bug-hunter` targeted defect-discovery shortcut, its execution rules, and its scope and safety limits, see [`docs/agents/bug-hunter-shortcut.md`](docs/agents/bug-hunter-shortcut.md).
<!-- END:bug-hunter-shortcut -->

<!-- BEGIN:codex-review-throttling -->

## Codex review throttling and routing

For Codex review throttling, branch routing, review ledger append rules, and review thread resolution guidance, see [`docs/agents/codex-review-throttling.md`](docs/agents/codex-review-throttling.md) and [`docs/codex-review-protocol.md`](docs/codex-review-protocol.md).

<!-- END:codex-review-throttling -->

<!-- BEGIN:local-server-safety -->

# Local server safety

- If the user says `run`, execute `npm run ensure` and return the printed URL.
- If the user asks for UI/frontend changes, browser QA, screenshots, mobile checks, or a local app link, run `npm run ensure` before opening or testing the app, even if the user did not say `run`.
- Never assume `localhost:3000`, `localhost:3001`, or `localhost:3002`.
- Never attach to a local server unless `/api/local-project-id` confirms it is this project.
- Do not kill or modify other projects' local servers. If the stable project port is busy, let `npm run ensure` choose the next safe project URL.
- Do not run a permanent watcher. Only start or verify the server when the current chat task needs the app or the user asks to run it.

<!-- END:local-server-safety -->

<!-- BEGIN:codex-desktop-worktree-setup -->

# Claude Code hook scripts

For the `.claude/hooks/*.sh` contract — the executable bit in the index, hook registration, line endings, failure behaviour, timeouts, and SessionStart output, see [`docs/agents/claude-hook-scripts.md`](docs/agents/claude-hook-scripts.md).

# Codex Desktop worktree setup

For Windows Codex Desktop worktree bootstrap and dry-run instructions, see [`docs/agents/codex-desktop-worktree-setup.md`](docs/agents/codex-desktop-worktree-setup.md).

<!-- END:codex-desktop-worktree-setup -->

# Reasoning effort calibration

For the Codex reasoning-effort baseline, the Cloud `xhigh` confirmation gate, and the
plan-effort/build-effort table, see
[`docs/agents/codex-reasoning-effort.md`](docs/agents/codex-reasoning-effort.md).

<!-- BEGIN:process-hardening -->

# Process hardening phases

## Bare PR publication is not readiness work

When the user says `open PR`, `create PR`, or `publish PR` without also requesting review, validation, readiness, or CI observation, treat it as a request to publish the prepared change promptly. GitHub is the requested verification surface.

- Inspect only what is necessary to avoid publishing the wrong change: the branch, base, staged/unstaged scope, and PR title/body. Reuse an existing dedicated branch or worktree rather than recreating it. Do not fetch, pull, rebase, review the ledger, inventory history, load a release/handover skill, or create a worktree unless it is necessary to keep unrelated work out of the PR.
- Do **not** run or wait for `npm run format`, dependency installation or linking, `npm run verify:pr-local`, tests, lint, typecheck, builds, browser checks, audits, generated-document synchronization, or CI. Do not invoke a release/readiness workflow for this request.
- If a local commit hook or a readiness-only push guard (format, drift, static, or ledger-write) is the only blocker, publish with `git commit --no-verify` and that guard's own scoped override (`SKIP_FORMAT_GUARD=1`, `SKIP_DRIFT_GUARD=1`, `SKIP_STATIC_GUARD=1`, or `SKIP_LEDGER_WRITE_GUARD=1`, as applicable) instead of `git push --no-verify`; do not spend time preparing dependencies or formatting solely to satisfy the hook. Never skip the push hook wholesale — the auto-merge ownership guard has no override and must never be bypassed, even for a bare-publication request. This exception is limited to the explicit bare-publication request and does not weaken normal-push safeguards.
- Create the PR immediately after the push, using the repository PR template where its policy fields apply. Report the URL and identify all local and hosted checks as unrun by request. Do not babysit CI, amend, or perform follow-up readiness work unless the user asks. This route overrides generic branch-bundling, handover, review, and babysit instructions.

- **For normal engineering pushes, run `npm run format` and commit the result before push.** This rule does not apply to the explicit bare PR publication route above. Formatting is in neither `npm run test`, `npm run typecheck`, nor `npm run lint`, so the ordinary loop can report green while the changed-file CI check or exact-commit pre-push guard fails. Three CI failures on 2026-07-30 came from exactly this (two of them on `ci/circleci: verify`, since removed from the repo by PR #1412). Two traps beyond simply running it:
  - **Formatting without committing does nothing for the push.** A push sends commits, not your working tree, so formatting after committing leaves the unformatted blob on the branch. Amend or add a follow-up commit.
  - **A per-file check is not the repository-wide check.** `prettier --check <file>` on the source file you edited passes while a doc or ledger edit in the same push fails; that was the missed file twice out of three.

  `.githooks/pre-push` carries the guard, and since 2026-07-30 it checks the pushed commit where CI checks it: `guard-push.mjs` puts the pushed SHA in a temporary `git worktree` with an exact-lock `node_modules` linked in and runs Prettier there, so neither the working tree's contents nor its prettier config can vouch for the commit, and a dynamic `prettier.config.*` still loads. An isolated worktree without local dependencies may reuse Prettier only from a registered worktree with a byte-identical lockfile and matching installed Prettier version; if none exists, the guard blocks with the explicit `npm ci --include=dev` remediation instead of skipping formatting. A push that changes prettier policy (`.prettierrc*`, `.prettierignore`, `.editorconfig`, or a `package.json` carrying a `prettier` field) escalates to a whole-tree `prettier --check .`, because a policy change alters the verdict for files the push never touched. But `core.hooksPath` is set by this checkout's `npm install`, so an agent pushing from its own environment bypasses the hook entirely and only CI catches the break — which is why the rule above is still a rule.

For the verification principle, the tier table, and the rest of the gate-selection rules, see [`docs/agents/verification-gates.md`](docs/agents/verification-gates.md).

## Do not pay twice for the verdict GitHub is about to reach

For the rule against re-deriving a verdict GitHub is about to reach, and the gate arbiter's inputs and non-negotiable boundaries, see [`docs/agents/verification-gates.md`](docs/agents/verification-gates.md).
<!-- END:process-hardening -->

<!-- BEGIN:page-and-button-wiring -->

# Deleting code you believe is dead

For what must hold before removing an exported symbol, and the `check:dead-code-candidate` refusal list, see [`docs/agents/dead-code-deletion.md`](docs/agents/dead-code-deletion.md).

# Page and button wiring

For the button, navigation, new-route, and gate rules, see [`docs/agents/wiring-and-bundle-budget.md`](docs/agents/wiring-and-bundle-budget.md).

# Bundle budget

For the three `bundle-budget.json` safeguards, how chunks are attributed, and how to measure them, see [`docs/agents/wiring-and-bundle-budget.md`](docs/agents/wiring-and-bundle-budget.md).
<!-- END:page-and-button-wiring -->

<!-- BEGIN:search-chrome-behaviour -->

# Search chrome behaviour

The shared search chrome must adapt by page ownership, not by ad-hoc padding or route-local overlays. Before changing `MasterSearchHeader`, `GlobalSearchShell`, `ClinicalDashboard`, `DocumentViewer`, phone dock reserves, or search-composer placement, read `docs/search-chrome-behaviour.md`.

- **One owner.** A page either uses the shell/dashboard composer, owns an in-flow hero composer, or owns a document-viewer composer. Do not stack a second fixed search bar or a second dock-sized content pad below a page-owned composer.
- **Phone edge-to-edge contract.** Fixed phone composers are flush to the viewport bottom and paint their own safe-area/home-indicator region while visible. They must not use a non-zero `bottom` gap in edge-to-edge dock mode.
- **Hidden means zero reserve.** When phone search/header/footer chrome scroll-hides, the content-facing reserve is `0rem`; do not restore `0.75rem`, `env(safe-area-inset-bottom)`, or `var(--safe-area-bottom)` as hidden padding. Visible composer chrome may still consume safe-area inset.
- **Header/footer symmetry.** Top header and bottom composer hide/reveal from the same scroll signal where they share a scroll container. If one is hidden, page content behind that edge must be fully visible rather than covered by an opaque white/surface band.
- **Page adaptation.** Standalone mode homes keep the composer in-flow in the hero on phones; submitted/search-result views use the compact bottom dock; answer mode may use overlaid glass header behaviour with matching top reserve; document detail/source routes let `DocumentViewer` own its composer.
- **Default in-page navigation.** When adding or suggesting in-page navigation on any mode page, use the DocumentViewer header as the template: back control, title + active-section subtitle + chevron sheet, ellipsis actions, weighted segment track, and `PhoneHeaderCollapsePortal` so the header attaches under the universal phone header and hides/reveals with that single collapse owner. Do not invent a second sticky/fixed phone nav header or a separate scroll-hide hook. Full contract: `docs/search-chrome-behaviour.md` (“Default in-page navigation template”). Therapy `ModeNav` remains a different multi-route pattern.
- **Guards.** Update the reserve helper, CSS tokens, Playwright phone-scroll coverage, and static contract tests together. Do not silence the existing reserve/overlay tests; add a narrower guard for any new page-specific exception. Run `npm run verify:phone-chrome`; its smart selector must keep focused owner/journey proof before any recommended full `verify:ui` escalation.

<!-- END:search-chrome-behaviour -->

<!-- BEGIN:external-skill-precedence -->

# External skill precedence

For how repository contracts outrank generic external skills and output-style plugins, see [`docs/agents/external-skill-precedence.md`](docs/agents/external-skill-precedence.md).

## Evidence and calibration are never compressed

For the rules on pasting the decisive gate line, stating verified versus assumed, verifying third-party fix claims, and writing PR titles and descriptions as parsed input, see [`docs/agents/external-skill-precedence.md`](docs/agents/external-skill-precedence.md).
<!-- END:external-skill-precedence -->

<!-- BEGIN:supabase-project-safety -->

# Supabase project safety

- This repo targets the live Supabase project `Clinical KB Database`.
- **MERGING TO `main` DEPLOYS TO PRODUCTION.** The Supabase GitHub integration has **"Deploy to
  production" ENABLED**, production branch **`main`** — confirmed by a dashboard read on 2026-08-21,
  after two earlier sessions inferred it wrongly in both directions. Any migration merged to `main` is
  applied to the live clinical database automatically, within seconds (measured at 34 s in
  `docs/audit/live-drift-forensics-2026-08.md` §3.7). There is no separate deploy step to forget and no
  window to hold it back. Therefore:
  - **Treat merge approval as production-deploy approval.** Never merge a PR touching
    `supabase/migrations/**` outside an approved window, and never enable auto-merge on one.
  - **Never write PR metadata promising a deferred deploy.** There is no deploy step to defer to,
    so "AWAITING DEPLOY WINDOW", "deployed manually after merge", "deployment is pending operator
    approval" and "not yet applied" all describe a control this repository does not have — and they are dangerous exactly when believed, because
    they invite a reviewer to merge a change they think is still parked. PR #2502 carried that
    phrase in its own title and reached the live database within minutes of merge; the post-merge
    `live-drift` run caught it as pending-apply drift. State the merge decision instead ("merge only
    inside the approved window"), which is the control that actually exists. `scripts/pr-policy.mjs`
    hard-blocks the claim on any PR touching `supabase/migrations/**` and quotes the offending
    phrase back. The title is always in scope; body statements must name the database subject, so a
    mixed PR keeps saying "do not deploy the staging worker until its image passes smoke tests" —
    a real constraint on something merging does not do. Approval sought BEFORE merge is likewise
    sanctioned and never matched. Patterns and their pinned behaviour table live in
    `scripts/pr-policy.mjs` beside the RAG and governance gates.
  - **After such a PR merges, the schema-application gate is the post-merge `live-drift` workflow**
    (`.github/workflows/live-drift.yml`), which must complete with BOTH `npm run check:drift` and
    `npm run check:migration-history` green. `supabase migration list` is not that gate: it reads the
    recorded history only, so it cannot tell an applied migration from a history row whose statements
    never executed — the exact shape of the fifteen no-statements rows `#Q5JHBJ` exists for.
    `check:drift` compares the live schema itself. A manual `supabase migration list --linked
--project-ref sjrfecxgysukkwxsowpy` read is a useful supplement, but it is provider-backed and so
    needs explicit user confirmation first, per "API and provider confirmation boundary" above. A
    merged-but-unapplied migration is silent drift — the incident this whole programme exists to
    close.
  - **A migration that cannot run inside a transaction cannot ship this way.** The integration applies
    each migration in one transaction, so a bare `CREATE INDEX CONCURRENTLY` migration fails outright.
    Index work stays operator-prebuild + a validate-only guard migration (the `20260804110240` pattern,
    see the guard-migration contract below).
  - **Automatic branching is also ON** (one preview database per PR that changes `supabase/**`, limit
    3). Supabase warns that Branching Compute is **not covered by the organisation's Spend Cap**. CI's
    `Migration replay` job (`db-reset-verify`, `supabase migration up --local`) independently replays
    the whole chain on every database-touching PR, so preview branches are a second net rather than the
    only one.
- Expected project ref: `sjrfecxgysukkwxsowpy`.
- Older unused project ref `qjgitjyhxrwxsrydablr` belongs to `Database`; treat it as stale and do not use it.
- Hosted migrations, `supabase/schema.sql`, `supabase/roles.sql`, CI, and deployment tooling must target role `postgres`; never assume a platform-reserved role. The single older applied migration is immutable and pinned by `npm run check:migration-role`.
- Bare-image storage scaffolding must discover its local schema owner at runtime and must never be reused as hosted migration SQL.
- Run `npm run check:migration-role` after changing Supabase SQL, migration tooling, CI replay, or disaster-recovery instructions.
- Run `npm run check:supabase-project` after changing Supabase env values.
- **Guard-migration contract.** Any mark-applied version, `supabase migration repair --status applied`,
  hand-applied SQL later recorded as a migration, or other history repair MUST ship a fail-fast
  validation guard migration in the same change, following `20260804110240_restore_rag_search_health_indexes.sql`
  exactly (validates presence + `indisvalid`/`indisready` + normalized definition, never builds,
  `set local` timeouts, one `raise exception`). `schema_drift_snapshot()` v2 (`20260818090000`) reports every
  `supabase_migrations` version recorded without executed statements; `check:drift` fails on any such row
  that lacks a reviewed `migration_history` entry in `supabase/drift-allowlist.json` pointing at its guard
  (`guard.class` `validation` is mandatory for versions from 2026-08-18; `superseded`/`no_ddl` are for
  pre-contract history only). Never allowlist a history row bare, and never widen an entry's class to make
  it pass. Enforced offline by `tests/migration-history-guards.test.ts`; index-monitoring decisions on the
  retrieval-critical tables are enforced by `tests/search-health-index-coverage.test.ts` +
  `supabase/search-health-unmonitored-indexes.json` (`required_indexes` changes travel by migration only).
  Full contract: `docs/database-drift-detection.md`.

<!-- END:supabase-project-safety -->

<!-- BEGIN:rag-ranking-protection -->

# RAG ranking protection

Retrieval/ranking behaviour is live-validated and safeguarded. Before touching any protected
surface, read `docs/rag-behaviour/` (README → behaviour-map → refuted-approaches → safeguards).

- **Flag it.** Any task that will touch `src/lib/rag/**`, clinical-search, retrieval-selection,
  released-search-order, ranking-config, evidence/result-sort/answer-ranking, the eval harness
  (`scripts/eval-retrieval.ts`, `scripts/lib/clinical-aliases.ts`, ranking-tuning/snapshot
  tooling), the golden fixture/snapshot, or the retrieval RPCs must say so to the user BEFORE
  editing, even when the change looks incidental (refactor, rename, "just a comment").
- **PR gate.** PRs touching those surfaces fail `pr-policy` without an explicit `RAG impact:`
  line in the body — either `RAG impact: no retrieval behaviour change — <reason>` or
  `RAG impact: behaviour change — canary pair <baseline> -> <post>`. The source-pin contract
  test (`tests/rag-imputation-contract.test.ts`) additionally goes red on any edit to the
  imputation formulas or release-comparator key order.
- **Canary for behaviour.** Any retrieval/ranking/ordering behaviour change requires a live
  eval-canary before/after pair (doc/content recall pinned 1.0, zero per-case rr regressions)
  before it is trusted; regression → immediate single-commit revert + confirmation run.
  Dispatches are provider-backed (~$1–2) and always need explicit user approval.
- **Never** insert a comparator key above the relevance score, bulk-merge the wide
  captured-case alias tier into the strict golden tier, relax the clamped-score contract, or
  adopt tuner recommendations without a measured live gain. Offline-green + review-approved
  was proven insufficient for this surface on 2026-07-20 (see refuted-approaches).

<!-- END:rag-ranking-protection -->

<!-- BEGIN:railway-project-safety -->

# Railway project safety

- This repo deploys to the live Railway project `Database` (`5deaad0b-675a-4c13-978e-5ca2b5b877f9`) in workspace `bigsimmo's Projects`. Full topology: `docs/deployment-architecture.md` §1.
- Production services `Database` (Next.js app tier, serves `https://psychiatry.tools`) and `worker` (ingestion) auto-deploy from `BigSimmo/Database` pushes to `main`; the `staging` environment runs the `app` service.
- The older Railway project `clinical-kb` (`4361c04f-dd3c-4ee9-9e97-49e4e5707b70`) is superseded with zero active deployments; treat it as stale — never `railway link` to it or deploy there.
- The similarly named Supabase project `Clinical KB Database` is the database/auth tier, not a Railway project; see "Supabase project safety" above.
- Railway CLI token auth uses `RAILWAY_API_TOKEN` (personal account token; see `.env.example`). The project-scoped `RAILWAY_TOKEN` is for CI deploys only and cannot list or link projects; Cloud runtime acceptance no longer installs or probes the CLI, so that substitution rule is documentation-enforced until an operator workflow reintroduces CLI checks. Desktop/CLI MCP uses the secret-free `railway` entry (enable in `$CODEX_HOME/config.toml` or via a never-committed local edit — never commit `enabled = true`) plus `codex mcp login railway`; neither repository MCP file activates a hosted ChatGPT/Codex app.
- Railway deploys and mutations fall under the "API and provider confirmation boundary" below; verify target project/environment IDs before any mutation.

<!-- END:railway-project-safety -->

<!-- BEGIN:api-confirmation-boundary -->

# API and provider confirmation boundary

- Never run, modify, test, or otherwise interact with OpenAI, Supabase, GitHub/GitLab, hosted CI, production-like services, or provider-backed workflows without explicit user confirmation.
- Treat indirect API usage inside scripts, tests, release checks, PR tooling, and review automation as confirmation-required too.
- Prefer local, static, mocked, or offline checks. If a recommended verification would touch a provider, report the command and ask before running it.
- `npm run check:supabase-project`, live PR/CI tooling, answer-generation checks, ingestion checks against live services, and release gates that call providers are not automatic.
- Exception: the `Run PR` shortcut (see "## Run PR shortcut") is standing user confirmation for the specific GitHub actions it enumerates, for the duration of that sweep only.

<!-- END:api-confirmation-boundary -->

<!-- BEGIN:upload-shortcut -->

# `upload` shortcut

For the `upload` safe Git handoff workflow — protected branches, required inspection, safe versus confirmation-required actions, branch cleanup, syncing, and the final report, see [`docs/agents/upload-shortcut.md`](docs/agents/upload-shortcut.md).
<!-- END:upload-shortcut -->

<!-- BEGIN:run-pr-shortcut -->

<!-- BEGIN:pr-branch-sync -->

## Open PR branch sync (anti-churn)

For the anti-churn branch-sync mitigations and the `git merge-tree` test that tells staleness from a real conflict, see [`docs/agents/pull-request-workflow.md`](docs/agents/pull-request-workflow.md).
<!-- END:pr-branch-sync -->

## Run PR shortcut

For the `Run PR` open-PR maintenance sweep — what it authorizes, its hard guardrails, and its procedure, see [`docs/agents/pull-request-workflow.md`](docs/agents/pull-request-workflow.md).
<!-- END:run-pr-shortcut -->

## Babysit the pull request, then stop

For the 30-minute post-PR CI budget, what may be done inside it, and how it is enforced, see [`docs/agents/pull-request-workflow.md`](docs/agents/pull-request-workflow.md).

## Automated review coverage (owner decision, 2026-08-22)

For the 2026-08-22 owner decision on automated review coverage, see [`docs/agents/pull-request-workflow.md`](docs/agents/pull-request-workflow.md).

## PR bundling (reduce one-task-one-PR churn)

For when a task may ride an already-open PR, the two-way low-risk test, and what must never be bundled, see [`docs/agents/pull-request-workflow.md`](docs/agents/pull-request-workflow.md).
<!-- BEGIN:anti-conflict-speed -->

## Anti-conflict and CI-speed operating procedure

Goal: fewer false merge conflicts, less cancelled CI, and faster feedback — without weakening required gates, flake policy, provider boundaries, or clinical/RAG safeguards. Do not touch unrelated active PRs unless the user explicitly asks (`Run PR`, sync, or a named PR).

### Prevent conflicts before they start

- Prefer fewer, shorter-lived PRs. Bundle independently low-risk append-only docs/ledger chores (see "## PR bundling") instead of one PR per line.
- Start from a fresh `origin/main` worktree/branch (`newtask`); do not pile new work onto a stale head that already shares hot files with the open queue.
- The legacy `docs/branch-review-ledger.md` and `docs/outstanding-issues.md` are **serial-only**: normal PRs must not add rows there. `npm run ledger:append` creates an immutable review record; `npm run issues:add|update|queue|done` creates one immutable inbox request (`queue` corrects a recommended-execution-queue row; see ledger `#M6JNR8`). One fresh-base, cross-worktree-locked `npm run issues:reconcile` operation applies landed requests to the canonical issue ledger. `check:ledger-write-discipline` rejects direct table-row edits, changed request records, deleted requests, and a canonical issue diff that does not exactly equal its recorded reconciliation transaction.
- Before calling GitHub `DIRTY`/`CONFLICTING` a real conflict, run `git merge-tree --write-tree origin/main <tip>`. Clean tree + behind = sync; dirty tree = real conflict.

### Speed CI without skipping quality

- Assemble every commit for a head before the first push, or wait for the current PR CI run to settle before pushing again. Apply the same settle-first rule to branch syncs: for a behind-but-clean PR with required CI in flight, wait, then perform at most one late `update-branch` / `git merge origin/main` after review and fix work is assembled. Cancel-in-progress remains enabled for pull requests (pushes mid-run cancel Production UI), but is deliberately disabled for base-branch pushes (`tests/ci-cache-safety.test.ts`).
- For Run PR sweeps and normal readiness pushes — never an explicit bare PR publication — run `npm run format` **and commit the result**, then `npm run verify:pr-local` (or the smallest gate that covers the change). Format is in `static-pr` but not in `verify:cheap`; an uncommitted format leaves CI red on the pushed blob. Whole-tree Prettier, not a single edited file.
- If a PR has auto-merge armed, its auto-merge state is user-owned and automation must not disable or re-enable it. Ordinary fast-forward pushes, `update-branch`/merge-main-in syncs, and bundled additions may proceed — GitHub re-validates required checks against the new head before merging, so an additive push cannot slip past that. A force-push, history rewrite, or base/target change while armed still hard-blocks with no override; wait for the user to change that state first.
- Missing CI checks are not a green pass. The `PR mergeability` check uses trusted `pull_request_target` events and refreshes unchanged PR heads after protected-base pushes; it fails explicitly on `mergeable_state: dirty`. Behind-but-clean heads use `npm run sync:pr-branches` / `:apply` with human `gh` auth — never bot `update-branch`.
- Triage and repair actionable review threads early; reply before resolving (`<!-- codex-thread-disposition:resolved -->`). Leave ambiguous or product-sensitive threads open for the owner.
- Babysit dormant: observe fresh CI only at meaningful stage boundaries (at most once every 5 min, ≤30 min per run). If queued/running at limit, record run URL as deferred and continue sweep.
- For sweeps needing local repair, prepare one isolated, exact-lock worktree via `node scripts/setup-codex-worktree.mjs`.
- Treat merge queue state as read-only. Fall back to Actions runs for exact head SHA if `gh pr checks` cannot read check runs.
- Treat outstanding-issue IDs as display locators, not proof that work landed. Queue changes only through `npm run issues:add|update|done`; reconcile via `npm run issues:reconcile` from a dedicated branch after PRs land.
- Keep Playwright blocking tests at zero retries; quarantine via `tests/flake-ledger.json` only after three reproductions on the same SHA.

### Operator sync (explicit only)

- Leave active PRs alone unless requested. Report: `npm run sync:pr-branches`. Apply with confirmation and human/operator auth: `npm run sync:pr-branches:apply`.

<!-- END:anti-conflict-speed -->

<!-- BEGIN:codex-productivity-defaults -->

## Codex productivity defaults

For Codex-specific productivity shortcuts and operating rules, see [`docs/agents/codex-productivity-defaults.md`](docs/agents/codex-productivity-defaults.md).

<!-- END:codex-productivity-defaults -->

<!-- BEGIN:repo-productivity-skills -->

## Repository productivity skills

For the repo-local skill catalogue and the foundational orchestration skills, see [`docs/agents/repository-skills-and-issues.md`](docs/agents/repository-skills-and-issues.md).
<!-- END:repo-productivity-skills -->

## Outstanding-work memory (`/issues`)

For the `/issues` durable cross-session ledger and its inbox and reconciliation discipline, see [`docs/agents/repository-skills-and-issues.md`](docs/agents/repository-skills-and-issues.md).

## Codex GitHub review behavior

For Codex's automated GitHub pull request review and auto-resolve behavior — severity
calibration, PR risk detection, cost controls, the review comment lifecycle, the automatic
resolve trigger, and the primary PR command — see
[`docs/agents/codex-github-review.md`](docs/agents/codex-github-review.md). That file is the
exact text `scripts/check-codex-autofix-workflow.mjs` enforces against the live workflow; do not
let a copy in this file drift from it.

## Codex Cloud environment

For the Codex Cloud environment specification, access profiles, MCP limits, and acceptance checks, see [`docs/agents/codex-cloud-environment.md`](docs/agents/codex-cloud-environment.md).

## Cursor Cloud specific instructions (not Codex Cloud)

For Cursor Cloud agent setup, live-vs-demo mode detection, verification commands, and GitHub
connector guidance, see [`docs/agents/cursor-cloud.md`](docs/agents/cursor-cloud.md).
