# Gate consolidation audit — 2026-09-02

**Status: proposal only. Nothing in this document has been acted on.** This branch changes
no `package.json` script, no GitHub Actions workflow, and no check script — only this file.
Every recommendation below is for a human (Josh) to read and decide on.

## Why this exists

The repo has 78 `check:*` npm scripts, 284 npm scripts total, and 23 GitHub Actions
workflows. Every one was added for a real reason — usually a real incident. But the sheer
count is itself a problem: the clearest symptom is that the repo needed a dedicated `gates`
skill whose entire job is helping a session figure out which of these to run. This audit's
job was to find out, gate by gate, whether that complexity is still earning its keep, and to
propose where it plausibly could be trimmed — without weakening anything that protects the
live clinical database, retrieval ranking, clinical output, or security.

## Method

1. **Evidence gathering.** Two things were checked before anything else: the local
   `gate-arbiter` yield ledger and `gate-receipts` duplication data (the built-in tools for
   answering "has this gate ever caught anything"), and a full read of
   `.github/workflows/ci.yml` to map exactly what runs where.
2. **Eight-family fan-out.** Eight agents ran in parallel, one per family (static/consistency;
   lint and type; unit and coverage; browser and Playwright; database and migration; RAG and
   clinical; docs and workflow; security and secrets). Each answered, per gate: what failure
   class it catches that nothing else catches; where it runs; whether it has ever actually
   failed (with cited evidence, not inference); and whether it overlaps another gate. Each
   gate was classified LOAD-BEARING (protects against a real incident or a documented,
   consequential invariant) or ROUTINE (general hygiene, no known incident).
3. **This synthesis.** Below.
4. **Red team / blue team / verification-router.** Two fresh agents, neither shown this
   synthesis's reasoning, argued respectively that every proposed change is wrong (load-bearing)
   and that the proposal doesn't go far enough. A third pass, `verification-router`, checked the
   synthesis against how the repo's routing actually works today. All three responses are
   appended verbatim in full — the disagreement between them is the point.

## The evidence base has a real limitation — say it plainly

The local `gate-arbiter` and `gate-receipts` stores were **completely empty** in this session's
container: `npm run arbiter:status` reported "no observations recorded yet," and
`npm run receipts` showed 0 valid receipts for every tracked gate identity (lint, typecheck,
vitest). This is a fresh, ephemeral clone with no history — not a sign the mechanisms are
broken, just that they had nothing to report here. So **no claim in this document rests on
live per-gate yield data**; every "has it ever failed" answer instead comes from
`AGENTS.md`/`CLAUDE.md`, `docs/outstanding-issues.md`, `docs/branch-review-ledger.md`,
`docs/process-hardening.md`, script/test docstrings, and `git log`. That is a materially
different (and in most cases richer — this repo documents its incidents unusually well) kind
of evidence than a receipts ledger would have given, but it is not the same thing, and the
family reports say explicitly, gate by gate, when no such evidence could be found rather than
inferring one.

## CI routing, as it actually is today (not as folklore has it)

- The only **unconditional** static-pr steps on every PR are `check:runtime`,
  `check:installed-lock-parity`, `check:ci-scope`, `check:verification-plan`.
- Nearly everything else in the 35-script `verify:cheap:internal` chain is **conditional** in
  CI on `static_heavy_changed`, `workflow_changed`, or `docs_changed || static_heavy_changed`
  — all of it still runs on any PR that trips those flags, which in practice is most product
  PRs, but a narrowly-scoped PR (pure docs, pure workflow) legitimately skips large parts of
  the chain by design.
- `verify:pr-local` is **not** a subset of `verify:cheap` and is **not** what most people
  assume it is — see finding G1 below.
- `check:drift` and `check:migration-history` (the two gates behind this repo's worst
  documented incident, `#Q5JHBJ`) **never run on a pull request at all**, by deliberate
  design — they are post-merge/scheduled-only (`live-drift.yml`).
- `check:gate-manifest` is the one-way invariant the task explicitly protects: CI must run at
  least what `verify:cheap:internal` runs, never less. Nothing below proposes inverting that.

## Cross-cutting findings, ranked by confidence

These are the load-bearing conclusions of this audit — the eight family reports underneath
are the evidence for them. Ranked roughly from "safe to act on" to "needs a human decision."

### Tier 1 — real coverage gaps (higher priority than any merger; nothing to remove here)

**G1. `verify:pr-local` silently skips an entire category of drift detection that
`verify:cheap` and CI both catch.** Reading `scripts/verify-pr-local.mjs` directly: its
`staticHeavyScripts` constant is only `["lint", "typecheck", "test"]`, plus a short list of
docs/RAG-fixture/medication checks added conditionally. It never runs `check:knip`,
`check:maintainability-budgets`, `brand:check`, `check:assets`, `check:therapy-data-index`,
`check:cross-mode-index`, `check:mha-act-sections`, `check:type-scale`, `check:icon-scale`, or
`check:design-system-contract` under any scope. A contributor who runs only
`npm run verify:pr-local` before pushing — which `CLAUDE.md` recommends as "the gate for PR
handoff" — gets **none** of this generated-artifact-drift protection locally; CI's
`static_heavy_changed` step is the only thing that ever catches it, and only after a push.
This isn't a redundancy to trim, it's a documented mismatch between what the repo's own
handoff guidance implies `verify:pr-local` covers and what it actually runs. **Proposal: either
add a bounded "generated-artifact drift" subset to `verify:pr-local`'s heavy-scope script list,
or update `CLAUDE.md`/`docs/process-hardening.md` to say explicitly that this category is
CI-only.** Confidence: high that the gap is real (confirmed by direct source reading, not
inference); the fix is a documentation-or-behavior choice for Josh, not something this branch
should just do.

**G2. `check:client-bundle-secrets` is a real, documented, load-bearing-in-intent check that
is not wired into anything.** It greps the _built_ `.next/static` output for leaked
server-only secret patterns (`sk-proj-`, `sb_secret_…`, etc.) — the only gate that would catch
a secret reaching the actual bundled JavaScript a browser downloads, as opposed to
`tests/client-secret-surface.test.ts` (which is wired, and does run) which only catches a
secret being _imported_ into a client module, not one interpolated into a template string or
otherwise reaching the bundle by a path that import-graph analysis can't see. It appears in
`package.json` and in documentation, but not in `verify:cheap`, not in `verify:pr-local`, and
not in any CI workflow. **Proposal: wire it into the `build` CI job (it needs `.next/static` to
already exist, so it belongs right after the build step, not in `static-pr`) rather than
proposing its removal — this is a gap to close, not a redundancy to cut.** Confidence: high
that it's currently orphaned (confirmed by grepping every workflow file); the decision to wire
it in vs. formally retire it is Josh's.

**G3. Nothing in the repo asserts a floor on Playwright test count.** `docs/outstanding-issues.md`
already documents a near-miss: PR #2481 dropped 74 of `ui-smoke.spec.ts`'s 82 tests under an
unrelated commit message, with squash auto-merge armed, and was only kept off `main` by an
incidental merge conflict — "No gate would have caught it." This is not this audit's finding
originally (it's already recorded), but it is directly relevant to a consolidation
conversation: before trimming any Playwright coverage, note that the family already has one
documented blind spot for silent mass-deletion, and a consolidation that also removes a
distinct test file without anyone noticing would recreate exactly that risk with no backstop.
Not proposing a new gate here — flagging the existing gap so it's visible.

### Tier 2 — real overlap, genuinely safe to consolidate (implementation-only, zero coverage loss)

**C1. Custom ESLint rule `require-z-index-ladder` vs. `check:design-system-contract`'s
z-index sub-check.** Both assert the _identical_ `ALLOWED_Z_INDEX_RUNGS` set
(`{0,5,10,20,30,40,60,80–85,95,100,110}`), confirmed byte-identical by direct source
comparison. `check:design-system-contract` is a strict superset for this specific violation
class: it reaches `.css`/`.module.css` z-index declarations the ESLint AST rule structurally
cannot see (the lint-family agent found a live example: `sidebar-live-shell.module.css`'s
off-ladder `z-index: var(--z-sidebar-flyout, 50)`), in addition to the `z-[N]` TSX literals
both catch. **Proposal: retire the z-index check from `require-z-index-ladder` and rely on
`check:design-system-contract` alone for this violation class** (the ESLint rule's other
possible future violations, if any were added, would need separate treatment — but today this
rule does nothing else). This does lose the "instant, in-editor" feedback speed of an ESLint
rule versus a script that only runs in `verify:cheap`/CI-conditional — that tradeoff is real
and is exactly the kind of thing the red team below was asked to argue against.

**C2. `brand:check` and `check:assets` both validate the same single file
(`src/app/icon.svg`) for different, non-overlapping properties** (generator-equivalence vs.
required-substring presence). Neither is redundant in coverage — this is a proposal to merge
the _implementation_ (one script, one invocation, both assertions kept intact) purely to
reduce script count, not to drop either check. Zero coverage risk if done as a literal
concatenation of the two assertion sets.

**C3. `check:type-scale` and `check:icon-scale` are structurally identical in shape and
routing to `check:design-system-contract` (same trigger, same job, same family of "generated
design-token drift").** Folding them in as named sub-checks of one runner (again, purely an
implementation consolidation — every existing assertion preserved, same npm-script-count
reduction as C2) would cut two of the 78 `check:*` entries without touching detection surface.
Not proposing this for `brand:check`/`check:assets` vs. `design-system-contract` beyond what
C2 already covers, since those two check a genuinely different file class.

### Tier 3 — real overlap where consolidation needs a judgment call, not just an implementation merge

**J1. `check:cross-mode-index` (the standalone script) and
`tests/cross-mode-differentials-index.test.ts` answer the identical question** ("is the
committed index equal to the live projection") through two different mechanisms — the Vitest
test is described by its own family report as running faster since it's inside the ordinary
`npm run test` invocation everyone already runs. **Proposal for Josh's judgment: drop the
standalone script's `--check` mode and rely on the Vitest test alone for detection, keeping the
script only for its `--write` (regeneration) mode.** This is not a pure implementation merge
like Tier 2 because it changes which command a contributor runs to get the same answer, and
because the standalone `--check` invocation is currently listed explicitly in CI/`verify:cheap`
— removing it changes what those chains do, even if nothing regresses. `check:therapy-data-index`
was checked for the same pattern and does **not** have this duplication (no equivalent
standalone Vitest test was found for it).

**J2. `check:playwright-pr-shards` and `check:playwright-browser-revision` are both
local-only diagnostic CLIs whose actual protective logic already runs automatically
elsewhere** — the shard-membership invariant is separately enforced in CI via
`tests/playwright-pr-shards.test.ts` (part of the ordinary unit suite), and the
browser-revision check's core logic is embedded in `assertPlaywrightBrowsersReady`, which
`run-playwright.mjs` calls before _every_ Playwright invocation, local and CI. **These two
standalone `check:*` npm scripts may be pure debugging conveniences with no independent
detection value of their own** — but per the browser family's evidence, `check:playwright-browser-revision`
specifically is tied to two dated real incidents (`#255`, `#312`) where the _embedded_ preflight
check itself needed hardening, not the standalone CLI. Removing the standalone CLI would not
remove the protection (that lives in the shared preflight); it would only remove a diagnostic
tool useful when a session needs to debug _why_ Playwright preflight is failing. Recommend
keeping both as diagnostic tools, explicitly re-labeled as such rather than "gates," so the
78-script count reflects reality — this is a documentation fix, not a removal.

### Tier 4 — worth reviewing but this audit could not establish enough to recommend anything

- `check:m13-migration` / `check:july8-live-batch` — already archived to `scripts/archive/`,
  historical, provider-backed, kept "for provenance." Already effectively out of the active
  gate count; no action needed.
- `check:source-catalogue` — protects clinical-source citation integrity (a core product
  invariant per `CLAUDE.md`: "Answers must be verifiable against linked sources") yet is wired
  into **no** automatic gate chain at all (not `verify:cheap`, not CI, not `verify:pr-local`).
  Unlike G2 (client-bundle-secrets, which has a documented sibling test partially covering the
  same ground), nothing else in the repo checks this. This reads as a possible second G-tier
  gap, but the static-family agent could not establish whether it has ever caught anything or
  why it sits outside every gate chain — flagging for Josh to investigate rather than
  recommending a specific fix.
- `check:coverage-inventory`, `check:skills`, `docs:check-inventory`,
  `check:repo-awareness-snapshot` — all classified ROUTINE with no citable incident found by
  their respective family agents. None is expensive, and none showed evidence of active harm
  either. Genuinely undetermined; not proposing removal without more signal than "no incident
  found in a repo whose docs are otherwise unusually good at recording incidents."

## Never touch — restated explicitly, per this task's own instructions

Nothing below is proposed for weakening, removal, or moving out of its current chain, and the
family reports independently converged on all of these as LOAD-BEARING with strong evidence:

- **`check:drift`, `check:migration-history`, `live-drift.yml`, `tests/migration-history-guards.test.ts`,
  `tests/search-health-index-coverage.test.ts`** — the migration-history guard contract exists
  because of a real production incident (`#Q5JHBJ`, fifteen-then-twenty no-statements history
  rows). A clean record since the guard-migration contract landed is the guard working, not
  evidence it's unneeded.
- **`check:github-actions` and the auto-merge ownership guard in `guard-push.mjs`** — same
  category: a clean record is the point.
- **The RAG ranking safeguard stack** — `eval:rag` (live canary), `eval:rag:offline`,
  `eval:rag:adversarial:offline`, `tests/rag-imputation-contract.test.ts`, the `RAG impact:`
  PR-body gate. This family has the single richest incident record in the whole audit (the
  2026-07-20 live regression that passed 121/121 offline tests and code review, then failed
  3/36 live) and is explicit textbook proof that offline-green is not sufficient here. Any
  proposal to rely on a cheaper offline substitute for ordering-behaviour changes on this
  surface would be wrong on the evidence, not just against the rules of this task.
- **`check:owner-scope`, `check:function-grants`, `check:default-acl`, `caring-contacts:db:test`,
  `check:migration-role`, `check:supabase-project`** — tenant-isolation and live-database-target
  guards.
- **Gitleaks secret scanning, `npm audit`, `ingestion-sast`, `check:image-content-contract`** —
  security/credential-exposure gates.
- **`check:privacy-readiness`, `check:clinical-hazard-controls`** — privacy/clinical governance
  sign-off manifests.
- **`check:gate-manifest`** itself, and the one-way invariant it enforces.

## Per-family reports

The full agent reports (each 2,000–3,500 words, with per-gate evidence citations) are not
reproduced in full here to keep this document readable — they were used directly to build the
findings above. Condensed summary tables follow; ask for the full underlying report on any
specific gate if the table line isn't enough to act on.

### Static / consistency

| Gate                                            | Class                            | Where                                                | Notable                                                                                                         |
| ----------------------------------------------- | -------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `check:runtime`                                 | LOAD-BEARING                     | verify:cheap/pr-local/ui/release; CI unconditional   | EBADENGINE, PRs #1611/#1697/#1705/#1740                                                                         |
| `check:installed-lock-parity`                   | LOAD-BEARING                     | same + postinstall                                   | underlies guard-push's Prettier reuse                                                                           |
| `check:ci-scope` self-test                      | LOAD-BEARING                     | verify:cheap; CI unconditional                       | #SDQSFD — RAG eval CI coverage hole, #137                                                                       |
| `check:verification-plan` self-test             | LOAD-BEARING                     | verify:cheap; CI unconditional                       | see G1 above                                                                                                    |
| `check:upload-limit-parity`                     | LOAD-BEARING                     | verify:cheap; CI heavy                               | PR #1441, real Dockerfile/app-config mismatch                                                                   |
| `check:medication-lexicon-report`               | LOAD-BEARING                     | verify:cheap/pr-local(cond.); CI heavy               | #331/#333 — stale for weeks, zero CI coverage until fixed                                                       |
| `check:knip`                                    | LOAD-BEARING                     | verify:cheap; CI heavy                               | caught real unlisted `@sentry/core` dep, ledger 2026-07-31                                                      |
| `check:maintainability-budgets`                 | ROUTINE                          | verify:cheap; CI heavy                               | ratchets on every extraction PR, no confirmed live catch                                                        |
| `check:type-scale` / `check:icon-scale`         | ROUTINE                          | verify:cheap; CI heavy                               | see C3                                                                                                          |
| `brand:check` / `check:assets`                  | ROUTINE                          | verify:cheap; CI heavy                               | see C2                                                                                                          |
| `check:therapy-data-index`                      | LOAD-BEARING                     | verify:cheap; CI heavy                               | fixed self-destructive generator bug pre-2026-08-12                                                             |
| `check:cross-mode-index`                        | LOAD-BEARING                     | verify:cheap; CI heavy                               | see J1                                                                                                          |
| `check:mha-act-sections`                        | LOAD-BEARING (clinical-adjacent) | verify:cheap; CI heavy                               | protects legal-citation accuracy under changed statute                                                          |
| `check:design-system-contract`                  | LOAD-BEARING                     | verify:cheap; CI heavy                               | 3 recent commits fixing real drift incl. clinical-labeling issue                                                |
| `check:gate-manifest`                           | LOAD-BEARING                     | verify:cheap; CI on workflow\|\|heavy                | exists because the type/icon/brand and sitemap/therapy groups both merged green once with no CI coverage, twice |
| `check:repo-awareness-snapshot`                 | ROUTINE                          | verify:cheap/pr-local(docs); CI docs\|\|heavy        | no incident found                                                                                               |
| `check:dev-drive-cache`                         | ROUTINE (workstation-only)       | local only                                           | #6SMMB4, but single-workstation blast radius                                                                    |
| `check:env-parity`                              | ROUTINE                          | local only                                           | no incident found                                                                                               |
| `check:npm-ci-dry-run`                          | LOAD-BEARING                     | local, wired into verify:pr-local on lockfile change | plausible EBADENGINE-adjacent value                                                                             |
| `check:base-freshness`                          | ROUTINE (never fails)            | local, SessionStart hook                             | advisory by design                                                                                              |
| `check:primary-checkout-lease`                  | LOAD-BEARING                     | local only                                           | #077, real concurrency data hazard                                                                              |
| `check:local-presence`                          | ROUTINE                          | local only                                           | no incident found                                                                                               |
| `check:dead-code-candidate`                     | LOAD-BEARING                     | local, on-demand                                     | **PR #2204** — 1,644-line sweep walked back 7 times; strongest single incident in this family                   |
| `check:stale-docs`                              | ROUTINE (advisory by design)     | local only                                           | never fails by design                                                                                           |
| `check:source-catalogue`                        | uncertain — see Tier 4           | local only, **wired nowhere**                        | protects citation integrity, no chain runs it                                                                   |
| `check:ledger-stamp-retention`                  | LOAD-BEARING                     | local, on-demand                                     | tied to a 7-PR silent merge-loss sweep                                                                          |
| `verify:cheap` / `verify:pr-local` (aggregates) | LOAD-BEARING                     | local                                                | see G1 — not equivalent chains                                                                                  |
| `gate-arbiter.mjs` / `gate-receipts.mjs`        | LOAD-BEARING (meta)              | local only                                           | both have dated Codex-review-caught near-misses (PR #2245, PR #2216)                                            |

### Lint and type

| Gate                                                    | Class                         | Where                                                                                                                                  | Notable                                                                                                                                           |
| ------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base ESLint (Next core-web-vitals + typescript + hooks) | LOAD-BEARING                  | lint; verify:cheap/pr-local(heavy); CI heavy; pre-push guard                                                                           | PR #1606 react-hooks violation reached CI before pre-push guard existed                                                                           |
| `require-button-wiring`                                 | LOAD-BEARING                  | same                                                                                                                                   | the named "Language and region" defect, fixed 2026-07-21                                                                                          |
| `no-hardcoded-hex`                                      | ROUTINE                       | same                                                                                                                                   | no incident found; sole detector for its narrow scope                                                                                             |
| `require-lucide-icon-aria`                              | ROUTINE                       | same                                                                                                                                   | partial, self-documented overlap with axe-core for icon-only buttons only                                                                         |
| `require-z-index-ladder`                                | ROUTINE — **duplicate found** | same                                                                                                                                   | see C1                                                                                                                                            |
| `restrict-suppress-hydration-warning`                   | LOAD-BEARING                  | same, no mockup exemption                                                                                                              | **PR #1131**, real CI-red catch on a skip-link                                                                                                    |
| TypeScript typecheck                                    | LOAD-BEARING                  | verify:cheap/pr-local(heavy); CI heavy; pre-push                                                                                       | PR #1618 caught a real type error; also #210/PR #2501 — the gate's own reliability has twice been a real operational cost (stale generated types) |
| Prettier/format                                         | LOAD-BEARING                  | format:changed (unconditional on PR/push); format:check (schedule/dispatch); pre-push isolated-worktree guard; **not in verify:cheap** | 3 real CI failures 2026-07-30                                                                                                                     |
| `check:knip`                                            | see static family             |                                                                                                                                        | boundary case, claimed by both families                                                                                                           |

### Unit and coverage

| Gate                                         | Class                                    | Where                                                                   | Notable                                                            |
| -------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `npm run test` (bare)                        | LOAD-BEARING                             | local only — **never runs bare in CI**                                  | base layer everything below sits inside                            |
| `test:coverage`                              | LOAD-BEARING                             | CI `coverage` job (coverage_changed, currently == static_heavy_changed) | floor drift caught and ratcheted, PR #1383, ledger #192            |
| `check:coverage-inventory`                   | ROUTINE                                  | CI `coverage` job                                                       | no incident found                                                  |
| `test:focused`                               | ROUTINE (dev-loop tool, not a gate)      | local only                                                              | fail-closed by design                                              |
| `test:ci-workflows`                          | ROUTINE (deliberate, self-guarded dedup) | CI (workflow_changed && !coverage_changed)                              | own contract test enforces it never diverges from `test`'s content |
| gate-receipts (vitest)                       | LOAD-BEARING (mechanism)                 | local only                                                              | correctness pinned by its own test                                 |
| `tests/route-reachability.test.ts`           | LOAD-BEARING                             | inside `npm run test`                                                   | the `/tools` orphan-route class                                    |
| `tests/gate-receipts.test.ts`                | LOAD-BEARING                             | inside `npm run test`                                                   | #XN95DM, real Windows false-red                                    |
| `tests/rag-imputation-contract.test.ts`      | LOAD-BEARING                             | inside `npm run test`                                                   | the 2026-07-20 incident's direct codified defense                  |
| `tests/migration-history-guards.test.ts`     | LOAD-BEARING                             | inside `npm run test`                                                   | `#Q5JHBJ`                                                          |
| `tests/search-health-index-coverage.test.ts` | LOAD-BEARING                             | inside `npm run test`                                                   | #316, 20 missing live indexes, 33-day red streak                   |
| `tests/session-start-hook.test.ts`           | LOAD-BEARING                             | inside `npm run test`                                                   | the hook executable-bit incident, PRs #1611/#1697/#1705/#1740      |
| `tests/ci-cache-safety.test.ts`              | LOAD-BEARING (bundle of ~57 assertions)  | inside `npm run test`; subset also in `test:ci-workflows`               | #095, #TF6TPJ, #HSSHRG each independently evidenced                |

### Browser and Playwright

| Gate                                            | Class                                         | Where                                 | Notable                                                                                                |
| ----------------------------------------------- | --------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `test:e2e:critical` (`ui-critical-fast`)        | LOAD-BEARING but not a distinct detector      | CI only, required                     | same tests as `ui-critical`, run sooner — fail-fast optimization, not a different failure class        |
| `test:e2e:pr:shard` (`ui-critical`)             | LOAD-BEARING                                  | CI only, required                     | #093, #146 — real races/bugs only reproducible under real CI load                                      |
| `verify:ui`                                     | LOAD-BEARING (local convenience)              | **local only**                        | union of the two CI jobs above, unsharded                                                              |
| `test:e2e:advisory`                             | ROUTINE                                       | CI, `continue-on-error`               | flake ledger currently empty                                                                           |
| `test:e2e:visual`                               | ROUTINE (advisory by design)                  | CI, never on PR                       | #278, real pinned-chrome overlap caught                                                                |
| `verify:lighthouse` / `check:lighthouse-budget` | LOAD-BEARING but never hard-required          | CI + local                            | #147, #TYZK23 — real measured incidents; **never `require_success` in `pr-required`, despite framing** |
| `release-browser-matrix` (Firefox/WebKit)       | LOAD-BEARING                                  | CI only, never on PR                  | named Firefox reload-hang incident (matrix run 4012)                                                   |
| `verify:phone-chrome`                           | LOAD-BEARING (dispatcher, no unique detector) | local only                            | wraps the above for smart local selection                                                              |
| `check:playwright-pr-shards`                    | see J2                                        | local only                            | invariant separately CI-enforced                                                                       |
| `check:playwright-browser-revision`             | see J2                                        | local only, logic embedded everywhere | #255, #312                                                                                             |

### Database and migration

| Gate                                             | Class                         | Where                                                              | Notable                                                                                 |
| ------------------------------------------------ | ----------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `check:migration-role`                           | LOAD-BEARING                  | local + CI heavy                                                   | pins the one immutable applied migration                                                |
| `check:function-grants`                          | LOAD-BEARING                  | local + CI heavy                                                   | prevents anon-callable SECURITY DEFINER RPCs                                            |
| `check:owner-scope`                              | LOAD-BEARING                  | local + CI heavy                                                   | replaces a one-time manual tenancy audit (0/33 gaps at the time) with a continuous one  |
| `check:default-acl`                              | LOAD-BEARING                  | local only, provider-backed                                        | verifies the live effect of the immutable revoke migration                              |
| `check:drift`                                    | LOAD-BEARING, **never touch** | post-merge only (`live-drift.yml`)                                 | `#Q5JHBJ`                                                                               |
| `check:migration-history`                        | LOAD-BEARING, **never touch** | post-merge only                                                    | broke hosted Preview branching once, 2026-08-19                                         |
| `check:supabase-project`                         | LOAD-BEARING                  | local + one CI step; internal dependency of every other live check | prevents targeting the stale `qjgitjyhxrwxsrydablr` ref                                 |
| `check:m13-migration` / `check:july8-live-batch` | ROUTINE (historical)          | local only, archived                                               | already inert, provenance-only                                                          |
| `db-reset-verify` (CI)                           | LOAD-BEARING                  | CI only, required                                                  | full local chain replay proved the `#Q5JHBJ` reconciliation was consistent before merge |
| `caring-contacts:db:test`                        | LOAD-BEARING                  | CI only, required                                                  | sole proof of real RLS correctness for that subsystem                                   |
| `live-drift.yml`                                 | LOAD-BEARING, **never touch** | post-merge/scheduled/manual only                                   | the schema-application gate per AGENTS.md                                               |
| `tests/migration-history-guards.test.ts`         | LOAD-BEARING, **never touch** | local + CI (unit suite)                                            | proves a guard's SQL actually validates its claim                                       |
| `tests/search-health-index-coverage.test.ts`     | LOAD-BEARING                  | local + CI (unit suite)                                            | the 20-missing-index incident                                                           |

### RAG and clinical

| Gate                                               | Class                                  | Where                                              | Notable                                                                                                                                           |
| -------------------------------------------------- | -------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check:rag:fixtures`                               | LOAD-BEARING                           | local; CI when RAG unchanged                       | cheap subset of eval:rag:offline                                                                                                                  |
| `eval:rag:offline`                                 | LOAD-BEARING                           | local; CI when RAG changed                         | **documented coverage gap**: PR #2065 reached main because the classifier regex missed `src/lib/rag/**`; the live canary caught it, not this gate |
| `eval:rag:adversarial:offline`                     | LOAD-BEARING                           | local; CI when RAG changed                         | sole pin on prompt-injection defenses                                                                                                             |
| `eval:rag` (live canary)                           | **LOAD-BEARING, never touch**          | scheduled/dispatch only, never on PR               | canary #55 (2026-07-20, 3/36 fail, reverted), and a second independent catch on PR #2065/#2088                                                    |
| `eval:quality` / `eval:retrieval:quality`          | LOAD-BEARING                           | local only, provider-backed                        | mechanism confirmed, no specific incident citation found                                                                                          |
| `tests/rag-imputation-contract.test.ts`            | **LOAD-BEARING, never touch**          | local + CI (unit suite)                            | the strongest-evidenced single gate in this whole audit                                                                                           |
| `check:clinical-hazard-controls`                   | LOAD-BEARING                           | local only (`governance:release`)                  | no incident found; governance manifest                                                                                                            |
| `check:medication-interactions`                    | LOAD-BEARING                           | local only, offline                                | no incident found                                                                                                                                 |
| `check:document-label-coverage` / `-governance`    | LOAD-BEARING                           | local only, provider-backed                        | overlapping but complementary lenses on the same data                                                                                             |
| `check:retrieval-owner-migration`                  | LOAD-BEARING                           | local only, provider-backed                        | tests the **live deployed RPC**, not code — no offline substitute                                                                                 |
| `check:production-readiness:ci` vs bare/`:release` | LOAD-BEARING, **strictness gap noted** | `:ci` in CI safety job; bare/`:release` local only | CI's privacy sub-check is structural-only — passing does **not** prove sign-off is complete; only the local `:release` variant does               |
| `RAG impact:` PR-body gate                         | LOAD-BEARING                           | separate `pr-policy` workflow                      | forces a conscious declaration, orthogonal to the code-level pins                                                                                 |

### Docs and workflow

| Gate                                                                                                    | Class                                           | Where                                     | Notable                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `check:github-actions`                                                                                  | LOAD-BEARING                                    | local + CI (workflow_changed)             | #992 — cross-file SHA-pin skew was previously invisible                                                                                                                                                |
| `check:gitleaks-pinned`                                                                                 | LOAD-BEARING                                    | local + CI                                | #097, mid-scan race                                                                                                                                                                                    |
| `check:ci-triage`                                                                                       | LOAD-BEARING                                    | local + CI; runtime `ci-triage.yml`       | #5DYBQQ — real CLS regression (PR #2199) waved through by an earlier, weaker version                                                                                                                   |
| `check:pr-policy`                                                                                       | LOAD-BEARING                                    | local + CI; runtime `pr-policy.yml`       | 3 incidents: 44% false-positive clinical-risk rate, PR #2502 deploy-deferral near-miss, two more holes found fixing it                                                                                 |
| `check:skills`                                                                                          | ROUTINE                                         | local + CI                                | thin evidence                                                                                                                                                                                          |
| `check:pr-mergeability`                                                                                 | LOAD-BEARING                                    | local + CI; runtime `pr-mergeability.yml` | #116 (silent conflict), #2242 (merged-PR re-fire)                                                                                                                                                      |
| `test:ci-workflows`                                                                                     | LOAD-BEARING as bundle, spans families          | local + CI                                | see unit/coverage family                                                                                                                                                                               |
| Ledger trio (`check:branch-review-ledger`, `check:outstanding-issues`, `check:ledger-write-discipline`) | **LOAD-BEARING, all three, never touch**        | local + CI (docs\|\|heavy)                | **5 distinct named incidents** — #133, PR #1430 (whole table duplicated 4×), a 3×-in-one-hour loss on 2026-07-29, #313, a 2026-07-28 encoding repair. Strongest-evidenced cluster in the entire audit. |
| `docs:check-index`                                                                                      | LOAD-BEARING (by consequence, no citable catch) | local + CI                                | protects the doc every AI session is told to read first                                                                                                                                                |
| `docs:check-inventory` / `docs:check-scripts`                                                           | ROUTINE                                         | local + CI                                | thin evidence, real stated rationale                                                                                                                                                                   |
| `docs:check-links`                                                                                      | LOAD-BEARING                                    | local + CI                                | real precedent (vendored SKILL.md path breaks)                                                                                                                                                         |
| `sitemap:check`                                                                                         | LOAD-BEARING                                    | local + CI                                | 3 real named defects, plus a documented prior CI gap                                                                                                                                                   |
| `check:codex-autofix-workflow`                                                                          | LOAD-BEARING                                    | local + CI (codex_autofix_changed)        | 3 sequential hardening commits on a bot with commit access — #447, #455, #635                                                                                                                          |
| `check:stale-docs`                                                                                      | ROUTINE by explicit design                      | local only, never fails                   |                                                                                                                                                                                                        |
| `sync-pr-policy-body`                                                                                   | LOAD-BEARING                                    | CI only                                   | #230, the only write-path job in this family                                                                                                                                                           |

### Security and secrets

| Gate                                           | Class                                 | Where                                        | Notable                                                                                                                                                 |
| ---------------------------------------------- | ------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gitleaks scan (`secret-scan.yml`)              | **LOAD-BEARING, never touch**         | CI only, sole detector by design             | never caught a real secret, but fires regularly on confirmed false positives (`.gitleaksignore`, 93 lines) — proves it's live, not vestigial            |
| `check:gitleaks-pinned` self-test              | LOAD-BEARING                          | local + CI                                   | protects the scan above, doesn't duplicate it                                                                                                           |
| `npm audit`                                    | **LOAD-BEARING, never touch**         | CI only (safety job)                         | two confirmed real fixes, one named directly in a PR title                                                                                              |
| `ingestion-sast` (blocking Semgrep)            | **LOAD-BEARING, never touch**         | CI only, digest-pinned                       | guards the untrusted-upload parsing surface; no confirmed live finding yet, but the surface itself (attacker-controlled document parsing) is the reason |
| Repo-wide advisory Semgrep                     | ROUTINE (advisory by explicit design) | CI only, `continue-on-error`                 | never blocks, by design                                                                                                                                 |
| `check:image-content-contract`                 | **LOAD-BEARING, never touch**         | CI only, blocking                            | prevents `.env`/`.pem`/test-suite files reaching a shipped container                                                                                    |
| Trivy scan + SBOM                              | ROUTINE (advisory by explicit design) | CI only, `continue-on-error`                 | not even listed in `SECURITY.md`'s enforced-controls section                                                                                            |
| `check:owner-scope`                            | see DB family                         |                                              | claimed by both                                                                                                                                         |
| `check:privacy-readiness` (bare vs `:release`) | **LOAD-BEARING, never touch**         | bare in CI safety job; `:release` local only | same strictness gap noted by the RAG family — CI passing ≠ sign-off complete                                                                            |
| `check:client-bundle-secrets`                  | LOAD-BEARING in intent, **orphaned**  | not wired anywhere                           | see G2                                                                                                                                                  |
| `tests/client-secret-surface.test.ts`          | LOAD-BEARING                          | Vitest suite (coverage job)                  | the wired half of the pair above                                                                                                                        |

---

## Stage 4 — adversarial review

The two responses below are from fresh agents that saw only the synthesis above (Tiers 1–4 and
the never-touch list), not this audit's working reasoning. A third, `verification-router`,
checked the synthesis against how the repo actually routes verification today. All three are
reproduced verbatim, disagreements included.

<!-- STAGE4_RED_TEAM_PLACEHOLDER -->

<!-- STAGE4_BLUE_TEAM_PLACEHOLDER -->

<!-- STAGE4_VERIFICATION_ROUTER_PLACEHOLDER -->
