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

> **Correction (Stage 4, verification-router):** this finding is wrong as stated. Grepping
> workflow YAML for the npm-script name misses an indirect invocation: `package.json`'s
> `build:internal` chain runs `check-client-bundle-secrets.mjs` after `next build`, and CI's
> `build` job runs `npm run build` on every PR where `build_changed` is true. The check **does**
> run, in CI, blocking — through `build:internal`, not as its own named step. The real issue is
> narrower than "orphaned": the npm-script alias `check:client-bundle-secrets` itself is what's
> unwired everywhere (never invoked under that name), which is a naming/discoverability problem,
> not a coverage gap. See the verification-router response below for the full trace.

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

> **Correction (Stage 4, red team):** the "strict superset" claim above does not survive
> tracing the actual regex. `check:design-system-contract`'s CSS z-index detector only matches
> a bare integer literal (`/^-?\d+$/`) — it would **not** catch `z-index: var(--z-sidebar-flyout, 50)`,
> the exact live example this finding cited as proof of superset coverage. The CSS half is also
> a ratchet against a baseline (tolerates existing debt, blocks only growth), not a hard zero
> gate like the ESLint rule. Combined with the `verify:pr-local` gap (G1) — `check:design-system-contract`
> never runs there, so removing the ESLint rule removes all _local_ z-index enforcement for
> anyone following the recommended PR-handoff workflow — this proposal should be treated as
> **MIXED, not safe as originally framed**. See the red team response below for the full trace.

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

> **Correction (Stage 4, red team): this proposal is factually wrong — withdrawn, not just
> flagged.** `check-type-scale.mjs`'s own header states it is "already wired into `verify:cheap`
> with the backlog cleared to 0, so this is a hard zero gate (no baseline) — **unlike the
> ratcheting design-system contract**" — the script's own author directly contradicts "same
> family" framing. `check:design-system-contract` enforces most of its metrics via a baseline
> ratchet that tolerates pre-existing debt; folding a hard-zero gate into that architecture
> risks silently downgrading "must never regress from zero" into "must not get worse than
> whatever's already there." This family is also the specific, named precedent
> `check:gate-manifest`'s own header cites for why it exists at all ("type/icon/brand being
> promoted after that exact miss"). **Reclassify C3 as LOAD-BEARING, do not touch** — see the
> red team response below.

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

> **Note (Stage 4, red team):** the factual premise holds up on inspection, but the red team
> points out this proposal runs directly against this document's own G3 caution above — G3
> warns that "a consolidation that also removes a distinct test file without anyone noticing"
> recreates the exact PR #2481 blind spot (mass Playwright test deletion with no gate catching
> it). J1 proposes eliminating the independent, non-Vitest detector and making the whole
> defense rest on one test file surviving, plus (per verification-router below) makes detection
> newly dependent on the `test` gate's own arbiter-deferral state, which it isn't today. Not
> withdrawn, but Josh should weigh this tension directly rather than read J1 as a clean win.

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

Three fresh agents reviewed the synthesis above (Tiers 1–4 and the never-touch list) without
seeing this audit's working reasoning or the eight family reports underneath it — only the
document itself. Two argued opposite directions (every proposed change is load-bearing; the
proposal doesn't go far enough) and a third, `verification-router`, checked the synthesis
against how the repo's routing actually works today. Corrections they found are already
folded inline above as blockquotes at the relevant finding; this section is their full,
verbatim responses, disagreements and all — deliberately not smoothed into one voice.

**Where they landed, at a glance:**

| Finding                                                                                                                                                                              | Original stance           | Where it landed after Stage 4                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1 (z-index ladder → design-system-contract)                                                                                                                                         | Safe implementation merge | **MIXED** — "strict superset" claim disproven on the cited example; removing it also strips all _local_ enforcement per G1                                                                                 |
| C2 (brand:check + check:assets merge)                                                                                                                                                | Safe implementation merge | **MIXED** — the split was deliberate (avoids an `svgo` lockfile/audit-classification trap); same `check:gate-manifest` precedent family as C3                                                              |
| C3 (type-scale/icon-scale → design-system-contract)                                                                                                                                  | Safe implementation merge | **WITHDRAWN — reclassified LOAD-BEARING.** Factually wrong: the target script is explicitly a hard-zero gate, not the ratcheting family it was claimed to match                                            |
| J1 (drop cross-mode-index `--check`, keep only the Vitest test)                                                                                                                      | Judgment call             | **Tension acknowledged, not resolved** — runs against the document's own G3 caution; also creates a new arbiter-deferral dependency                                                                        |
| J2 (re-label shard/browser-revision CLIs as diagnostic)                                                                                                                              | Judgment call             | **Substance confirmed safe; execution risk flagged** — both script names are hard-coded into multiple agent runbooks; a rename (not just a label change) would need `check:docs-script-refs` to stay green |
| G2 (`check:client-bundle-secrets` orphaned)                                                                                                                                          | Real gap, wire it in      | **CORRECTED** — it already runs, blocking, via the `build:internal` chain; the real issue is the npm-script alias is unwired, not the detection                                                            |
| G1 (`verify:pr-local` heavy-scope gap)                                                                                                                                               | Real gap                  | **Confirmed accurate** by direct source read                                                                                                                                                               |
| Blue team's cross-family finds (`no-hardcoded-hex`, `check:repo-awareness-snapshot`, Tier-4 retirement cases, `check:skills` hardcoded counts, workflow trigger/schedule collisions) | —                         | **New findings, not in the original synthesis** — see blue team response in full below                                                                                                                     |

---

### Red team

_Prompted to argue every gate proposed for removal or merger is load-bearing._

# Adversarial review — gate-consolidation-audit-2026-09-02

I read the audit in full and then read the actual source: `eslint-rules/require-z-index-ladder.mjs`, `scripts/design-system-contract-utils.mjs`, `scripts/check-design-system-contract.mjs`, `scripts/design-system-contract-baseline.json`, `scripts/generate-brand-assets.ts`, `scripts/check-assets.mjs`, `scripts/check-type-scale.mjs`, `scripts/check-icon-scale.mjs`, `scripts/check-gate-manifest.mjs`, `scripts/build-cross-mode-differentials-index.mjs`, `tests/cross-mode-differentials-index.test.ts`, `scripts/check-playwright-browser-revision.mjs`, `scripts/playwright-browser-preflight.mjs`, `scripts/playwright-pr-shards.mjs`, `tests/playwright-pr-shards.test.ts`, `scripts/check-docs-script-refs.mjs`, `scripts/verify-pr-local.mjs`, `eslint.config.mjs`, and `.github/workflows/ci.yml`. Two of the five proposals rest on a factual claim that direct reading disproves.

#### C1 — fold `require-z-index-ladder` into `check:design-system-contract`

**MIXED — do not remove the ESLint rule as proposed.**

The ladder sets are genuinely identical: `require-z-index-ladder.mjs` line 11 and `design-system-contract-utils.mjs` line 766 both define `{0,5,10,20,30,40,60,80-85,95,100,110}`. But the document's proof that the script is a "strict superset" is wrong on its own cited example. `check-design-system-contract`'s CSS z-index detector (`design-system-contract-utils.mjs` line 1867) is `prop === "z-index" && /^-?\d+$/.test(declaration.value.trim())` — it only matches a bare integer literal. `sidebar-live-shell.module.css:145` is `z-index: var(--z-sidebar-flyout, 50);` — a `var()` expression, not a bare integer — so this specific "live example" the audit cites as proof would **not** actually be flagged today. Worse, even where the CSS check does fire, it isn't a hard gate: it's recorded via `recordDebt("rawCssZIndices", …)`, which is compared against `design-system-contract-baseline.json` (`value <= baselineValue`, current baseline 4, all in `globals.css`) — a ratchet that tolerates existing debt and only blocks growth. The TSX class-level check (`unapprovedZIndexFindings`) is a hard `assert(length === 0)`, but the CSS half is not. So "strict superset" is not established; the audit's own evidence for it doesn't survive tracing the regex.

The more consequential problem is routing. `scripts/verify-pr-local.mjs` line 34 defines `staticHeavyScripts = ["lint", "typecheck", "test"]` — it runs `lint` (which carries the ESLint rule) but never runs `check:design-system-contract`, a fact the audit's own G1 finding already established. `CLAUDE.md` recommends `verify:pr-local` as "the gate for PR handoff." If z-index enforcement is removed from lint and relies solely on `check:design-system-contract`, a contributor following that recommended workflow gets zero local z-index enforcement — the violation would only surface in CI's `static_heavy_changed` conditional step, after push, generating exactly the CI round-trip this repo's arbiter philosophy exists to avoid. Scoping also isn't identical: `eslint.config.mjs`'s `MOCKUP_IGNORES` (glob-based) and `design-system-contract-utils.mjs`'s `isPrototype()` (substring-based, plus an extra `/favourites-page-mockups/` carve-out) are close but not the same test, and the ESLint rule covers `.js/.jsx` while the script only walks `.css/.ts/.tsx` — currently moot (zero `.js/.jsx` under `src`) but not a structural guarantee.

#### C2 — merge `brand:check`/`check:assets` implementations

**MIXED.** `check-assets.mjs`'s own header explains the separation was deliberate: it exists specifically "so as not to require an `svgo` lockfile delta," because adding `svgo` would flip CI's `lockfile_changed` classification and make pre-existing `exceljs`/`brace-expansion` audit highs blocking. That's a CI-classification decision, not an accident — a merge needs to preserve it. The two scripts also run on different engines today (`generate-brand-assets.ts` via `run-tsx.mjs`, importing the TypeScript `@/lib/brand-mark` source; `check-assets.mjs` is a dependency-free `.mjs`), so "one script" has to pick a host format, and picking the `.mjs` side risks losing the real `@/` path-aliased source of truth in favor of a hand-copied literal. Both already share the identical `static_heavy_changed` CI trigger, so that specific risk is low. The larger risk: `check-gate-manifest.mjs`'s own header names **this exact script family** — "type/icon/brand being promoted after that exact miss" — as one of only two documented incidents that caused `check:gate-manifest` to be built at all. This isn't a generic risk; it's the specific, cited precedent for what goes wrong when this family of scripts gets restructured. At least ten maintained docs (`docs/design-system/GATES.md`, `docs/testing.md`, `docs/design-system-contract.md`, etc.) reference `brand:check`/`check:assets` by name, and `docs:check-scripts` (blocking in `verify:cheap` and CI) exists specifically to fail on a stale reference after a rename.

#### C3 — fold `check:type-scale`/`check:icon-scale` into `check:design-system-contract`

**LOAD-BEARING — do not touch.** This is the clearest factual error in the document. `check-type-scale.mjs`'s own header states: "Already wired into `verify:cheap` with the backlog cleared to 0, so this is a hard zero gate (no baseline) — **unlike the ratcheting design-system contract**." That is the script's author directly contradicting the audit's claim that it is "structurally identical in shape and routing... same family." `check:design-system-contract` enforces most of its metrics via a baseline ratchet (`value <= baselineValue` against `design-system-contract-baseline.json`), which by design tolerates pre-existing debt. Folding a hard-zero gate into that architecture risks silently converting "must never regress from zero" into "must not get worse than whatever's already there" — the precise silent-downgrade the tier claims won't happen, contradicted by the target file's own documented intent. This carries the same `check:gate-manifest` precedent as C2 (this family is literally the type/icon/brand incident named in that script's header) and the same doc-reference exposure via `docs:check-scripts`.

#### J1 — drop `check:cross-mode-index`'s `--check` mode, keep only the Vitest test

**MIXED, lean load-bearing.** Unlike C1/C3, the factual premise here checks out: `build-cross-mode-differentials-index.mjs`'s own comment describes the two mechanisms accurately as complementary detectors of the same drift. The objection is structural, not factual. This document itself, one section earlier (Tier 1, finding G3), states: "PR #2481 dropped 74 of `ui-smoke.spec.ts`'s 82 tests under an unrelated commit message, with squash auto-merge armed, and was only kept off `main` by an incidental merge conflict — 'No gate would have caught it.' ... a consolidation that also removes a distinct test file without anyone noticing would recreate exactly that risk with no backstop." J1 then proposes doing exactly that for cross-mode-index: eliminating the independent, non-Vitest detector and making the entire defense rest on the survival of one test file — the audit warns against its own next recommendation three paragraphs later. A standalone script also doesn't depend on any file-to-test mapping heuristic; a bare `npm run check:cross-mode-index --check` in `verify:cheap:internal` runs unconditionally, while a Vitest-only detector's reliability in a `test:focused` iterative loop depends on that mapping correctly associating `data/differentials-snapshot.json` changes with this specific test. `check:therapy-data-index` was checked for the same pattern and found not to duplicate — so this is a narrow, single-instance ask, which somewhat limits the blast radius, but the redundancy-removal argument still runs directly against the document's own G3 caution.

#### J2 — re-label `check:playwright-pr-shards`/`check:playwright-browser-revision` as diagnostic, not gates

**GENUINELY SAFE in substance, real risk in execution.** Both claims check out on inspection: `playwright-browser-preflight.mjs` imports `playwrightBrowserRevisionCheck` directly from `check-playwright-browser-revision.mjs`, and `tests/playwright-pr-shards.test.ts` imports `prUiSpecProfiles`/`productionSpecFilePattern` directly from `scripts/playwright-pr-shards.mjs` — these are shared modules, not reimplementations, and neither script appears anywhere in `verify:cheap:internal` or `.github/workflows/ci.yml` today (confirmed by direct grep). So relabeling costs nothing in coverage. The risk is entirely in what "re-labeled" means in practice. These exact script names are hard-coded, verbatim, into operational runbooks other AI agents follow with no other context: `docs/codex-cloud.md` step 1 literally says "Run `npm run check:installed-lock-parity` and `npm run check:playwright-browser-revision`," and the same name appears in `docs/agents/cursor-cloud.md`, `docs/testing.md`, `docs/development-speed-playbook.md`, multiple `docs/prompts/*` handovers, and several immutable `branch-review-ledger`/`branch-review-records` rows. `check-docs-script-refs.mjs`'s own header states its purpose is precisely to stop "a renamed/removed script [leaving] stale instructions that the agents (Codex/Claude/Cursor) then follow" — it is blocking in `verify:cheap` and CI. An actual rename fails that gate outright; even a same-named "diagnostic, not gate" recharacterization risks an agent deprioritizing a check tied to two dated, real incidents (`#255`, `#312`) precisely because "not a gate" reads as "skip it" under this repo's own smallest-gate philosophy. If the change stays confined to prose in whatever document currently counts "78 `check:*` gates," it's safe; if it touches the npm script names themselves, it isn't.

---

### Blue team

_Prompted to argue the consolidation does not go far enough._

# Where the consolidation audit stopped short

I read the full audit document, including all eight per-family tables and the Tier 1–4 findings. It is careful, well-evidenced work — but it is conservative in a way its own stated premise ("the sheer count is itself a problem") doesn't justify. Below is a ranked list of what should also be on the table, each backed by reading the actual scripts rather than pattern-matching names.

#### 1. `no-hardcoded-hex` is C1 all over again, and the document's own table sits it right next to the finding it should have triggered

C1 flagged `require-z-index-ladder` as a true duplicate of `check:design-system-contract`'s z-index sub-check, because both assert the same rule and the script is a superset. I read `scripts/design-system-contract-utils.mjs` and found the _identical_ relationship exists for colour, and the document missed it even though the lint family's own table lists `no-hardcoded-hex` (ROUTINE, "no incident found") one row above `require-z-index-ladder` (ROUTINE, "duplicate found").

`no-hardcoded-hex` (`eslint-rules/no-hardcoded-hex.mjs`) flags one narrow shape: `bg-[#…]`, `text-[#…]`, `border-[#…]` Tailwind arbitrary-value literals. `check:design-system-contract`'s `RAW_COLOR` pattern (`/#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch)\(/gi`) scans the _entire text_ of every non-exempt `.css/.ts/.tsx` file, ratcheted to a **zero baseline that only shrinks** (`rawColorLiterals` metric, asserted `<= baseline` on every run). A string like `bg-[#123abc]` contains `#123abc`, which the raw-color regex matches directly — there's no scope where the ESLint rule fires and the script wouldn't already have caught the same literal as a `rawColorLiterals` regression. The exemption list in `RAW_COLOR_EXEMPTIONS` covers only theme-token files, brand artwork, diagnostic visualisations, and a print sheet — none of it overlaps the Tailwind-utility literals the ESLint rule targets. This is a strict superset relationship, exactly like C1, just for a different value class. **Proposal: retire `no-hardcoded-hex` the same way C1 proposes retiring the z-index ladder rule**, and note the loss of in-editor instant feedback as the same real, acknowledged tradeoff C1 already names.

_(Editorial note added after Stage 4 assembly: the red team's finding above shows C1's own "strict superset" claim for z-index did not survive tracing the regex — the CSS half of `check:design-system-contract` is a ratchet, not a hard gate, and misses `var()`-expression z-indices. Whether the *colour* superset claim here holds up to the same scrutiny was not independently re-checked; the same verification the red team applied to C1 should be applied before acting on this one.)_

#### 2. `check:repo-awareness-snapshot` is a cross-family duplication engine the eight-way split was structurally unable to see

This is the single biggest miss. `check:repo-awareness-snapshot` sits in the "static/consistency" table as one ROUTINE line ("no incident found"). Reading `scripts/generate-repo-awareness-snapshot.ts` shows it isn't one check — it's four, and three of the four re-derive facts another family's gates already own:

- **Routes.** `buildRoutesSection()` calls `collectSiteMapData()` straight out of `scripts/generate-site-map.ts` — the exact generator `sitemap:check` (docs/workflow family) uses to validate `docs/site-map.md`. Both gates now independently serialize the same route discovery into two separate committed artifacts (`docs/site-map.md` and `data/repo-awareness-snapshot.json`), each requiring its own regeneration command (`sitemap:update` vs `snapshot:repo-awareness`) and each failing separately on the same underlying route change.
- **Documentation.** `buildDocumentationSection()` computes `catalogued`/`uncatalogued` doc counts against `docs/README.md`. That's the same question `docs:check-index` (`scripts/check-codebase-index-coverage.mjs`) asks about `docs/codebase-index.md` — "is the doc navigation index stale relative to what's on disk" — just pointed at a different catalogue file. `docs:check-inventory` (`scripts/update-docs-inventory.mjs`) is a third variant of the same concern, checking two headline counts (script files, npm scripts) in `docs/scripts-index.md`.
- **Review state.** `buildReviewStateSection()` and its helper `splitRecordCells()` independently re-parse `docs/branch-review-ledger.md` plus the archive and immutable records, with their own escape-aware 6-column row parser. That is a second, separately maintained parser of the exact format the "ledger trio" (`check:branch-review-ledger`, `check:outstanding-issues`, `check:ledger-write-discipline`) exists specifically to protect — the document calls that trio "the strongest-evidenced cluster in the entire audit" (5 named incidents) in the very next table, without connecting the dots that a fourth, independent parser of the same frozen format is exactly the kind of drift risk that cluster was built to eliminate.

None of this was flagged because the static-family agent owns `check:repo-awareness-snapshot` and the docs/workflow-family agent owns `sitemap:check`/`docs:check-index`/the ledger trio — different agents, no cross-reference, and the synthesis step didn't re-scan for it either. **Proposal: this needs a real architectural decision, not a script merge** — either the snapshot generator should read the _outputs_ of `generate-site-map.ts` and the ledger tooling rather than re-deriving them from raw inputs, or the four generated artifacts (`docs/site-map.md`, `docs/codebase-index.md`, `docs/scripts-index.md`, `data/repo-awareness-snapshot.json`) should be reduced to fewer sources of truth. This is a bigger finding than anything in Tier 2/3 and belongs above them, not in a single ROUTINE table row.

#### 3. Retirement cases the document declined to make, despite naming its own evidence

The document's Tier 4 treats "ROUTINE, no incident found" as "genuinely undetermined." For several of these, the absence of evidence _is_ the evidence, given how well this repo otherwise documents incidents (the document says so itself in its evidence-base section):

- **`check:maintainability-budgets`** (`scripts/check-maintainability-budgets.mjs`) is a hardcoded 4-file line-count ceiling (`ClinicalDashboard.tsx`, `rag.ts`, `DocumentViewer.tsx`, `indexing-v3-agent/index.ts`). It has never caught anything per the audit's own row, it duplicates no other gate's _intent_, but it also protects nothing a code reviewer wouldn't notice on any PR that grows one of four named files by hundreds of lines — and every time one of those files is deliberately restructured, the budget has to be hand-edited anyway (the comments in the file already describe two such manual edits). This is busywork with a maintenance tax, not protection.
- **`check:env-parity`** is offline-by-default and only checks _names_, not values, and its provider-backed modes (`--gh`, `--railway`) already require explicit confirmation under this repo's own provider boundary. The offline default's blast radius is a local `.env.local` typo — something that fails loudly the moment the app tries to read the missing var. No incident, no unique failure mode that doesn't self-report elsewhere.
- **`check:local-presence`** exists to auto-fill three local-only HMAC secrets. Its only failure mode is "a dev doesn't have a local secret," which breaks obviously and immediately on first use of the feature that needs it (safety-identifier hashing, health probe). It is a convenience script mislabeled as a gate.
- **`docs:check-inventory`** (two integers: script file count, npm script count) is now doubly redundant per point 2 above — even setting the repo-awareness overlap aside, it's a documentation-freshness check whose entire failure surface is "someone added a script and forgot to run `npm run docs:update`," already caught in spirit by `docs:check-index`'s broader coverage check.
- **`check:coverage-inventory`** sits inside the CI `coverage` job with `test:coverage` right next to it — the document itself only found "no incident found," and offers no account of what distinct failure class it catches that a coverage-floor regression (which `test:coverage` already guards, per PR #1383/ledger #192) would miss.

#### 4. `check:skills`'s hardcoded per-surface counts are brittle busywork wearing a load-bearing costume

`scripts/list-database-skills.mjs` hardcodes `expectedRepositorySkillSurfaceCounts: { Codex: 43, Claude: 8, Cursor: 15, "PsychSift plugin": 1 }`. Every time a skill is added or removed on any of four surfaces, this literal has to be hand-edited or the gate goes red for a reason unrelated to skill quality. The document calls this "thin evidence" and leaves it as-is. The frontmatter-validation half of this script (checking `short_description`/`default_prompt` presence and shape) is legitimate and load-bearing in spirit; the hardcoded-count assertion is not — it's an anti-pattern that makes routine, expected repository growth look like a gate failure. Separating them, and dropping the count assertion specifically, is a low-risk cut the document had the material to recommend and didn't.

#### 5. Structural bloat the per-gate framing genuinely cannot see

Two findings only show up by reading workflow trigger blocks side by side, which a `check:*`-script-scoped audit never does:

- **Three workflows fire on the identical event triple.** `claude.yml`, `claude-backlink.yml`, and `codex-autofix-review-comments.yml` all trigger on exactly `issue_comment: [created]`, `pull_request_review_comment: [created]`, `pull_request_review: [submitted]`. Every PR review comment in the repo now spins up to three separate GitHub Actions runners, each independently evaluating its own `if:` gate to decide whether to do anything. They serve different purposes (respond to @claude, post a session backlink, ask Codex to auto-resolve), but nothing stops them from being jobs inside one workflow sharing one trigger block — which would cut the 23-workflow count by two with zero coverage loss, the same "implementation-only merge" logic Tier 2 already applies to `brand:check`/`check:assets`.
- **Three scheduled workflows fire at the same instant, weekly.** `ci.yml`, `docker-image.yml`, and `eval-canary.yml` all carry `cron: "0 18 * * 0"` — Sunday 18:00 UTC, exactly. `live-drift.yml` was deliberately staggered 30 minutes later ("aligned with the existing Sunday off-peak cadence," per its own comment), which shows someone _did_ think about stagger for one of these four — just not the other three, which now collide on runner queue time every week. This is a cheap, concrete fix (offset two of the three by a few minutes) that a gate-by-gate audit has no way to notice, because none of these are `check:*` scripts — they're scheduling metadata.

#### The meta-point the conservative framing obscures

The document's own opening names the problem as _count_, not _risk_: "the sheer count is itself a problem: the clearest symptom is that the repo needed a dedicated `gates` skill." But Tier 4's disposition — "genuinely undetermined; not proposing removal without more signal than 'no incident found'" — quietly flips the burden of proof. For `check:drift`, `check:owner-scope`, the RAG canary: guilty-until-proven-innocent is exactly right, and the document is correct not to touch any of them. For a zero-incident, zero-cost, narrow-scope hygiene script, treating "no incident" as insufficient grounds for removal is backwards relative to the stated goal — it guarantees the count never shrinks, because nothing routine will ever accumulate an incident large enough to clear that bar on its own. The document also never corrects its own headline "78 `check:*` scripts" framing even though its own tables show at least five entries (`test:focused`, `check:playwright-pr-shards`, `check:playwright-browser-revision`, `check:base-freshness`, `check:stale-docs`) are explicitly _not gates_ by the document's own description ("never fails by design," "diagnostic convenience," "dev-loop tool, not a gate"). Recategorizing those out of the count is a free, zero-risk consolidation of the number itself that the document had all the material to make and left undone.

---

### Verification-router

_Prompted to check the synthesis against how the repo actually routes verification today._

# Verification Router review: gate-consolidation-audit-2026-09-02.md

#### 1. Fact-checking the document's routing claims against source

**G1 (`verify:pr-local` heavy-scope gap) — confirmed accurate by direct read.** `scripts/verify-pr-local.mjs` line 34 is literally `const staticHeavyScripts = ["lint", "typecheck", "test"];`. The `docsScripts` and `workflowScripts` arrays (lines 11–32) and the `static_heavy_changed` branch (lines 119–137) never reference `check:knip`, `check:maintainability-budgets`, `brand:check`, `check:assets`, `check:therapy-data-index`, `check:cross-mode-index`, `check:mha-act-sections`, `check:type-scale`, `check:icon-scale`, or `check:design-system-contract`. I confirmed all ten of those _are_ present as `static_heavy_changed`-conditional steps in `.github/workflows/ci.yml`'s `static-pr` job (lines 323–391) and _are_ in `verify:cheap:internal` in `package.json`. So the gap is real exactly as described: a contributor who runs only `verify:pr-local` before a product-code push gets none of this generated-artifact-drift protection locally, and only finds out post-push via CI.

**check:gate-manifest — confirmed, and more narrowly scoped than the prose implies.** `scripts/check-gate-manifest.mjs` parses `verify:cheap:internal` from `package.json` and asserts every gate in it (mapped through a small `CI_EQUIVALENT` table, e.g. `test → test:coverage`) appears as a `run: npm run <gate>` line inside the `static-pr` job specifically (or elsewhere in `ci.yml` for the mapped equivalent). It says nothing about `verify:pr-local` — the one-way invariant is `verify:cheap` vs. CI only. The document's summary line ("CI must run at least what `verify:cheap:internal` runs, never less") is correct; a reader could mistake it for also covering `verify:pr-local`, which it does not, and G1 is exactly the proof that it doesn't. Worth being explicit about that boundary since it matters for point 2.

**G2 (`check:client-bundle-secrets` "orphaned") — this is where the document is wrong, and it's the most consequential correction here.** Grepping `.github/workflows/*.yml` for the literal string `client-bundle-secrets` does return zero hits, which is what the audit reports. But `package.json` line 26 shows `"build:internal": "node scripts/guard-next-build.mjs && npm run check:upload-limit-parity && node ... next build --webpack && node scripts/check-client-bundle-secrets.mjs"`, and `"build": "node scripts/run-heavy.mjs --npm-script build:internal"`. CI's `build` job (`ci.yml` line ~583) runs `run: npm run build` on every PR where `build_changed` is true — which is most product PRs (the `buildPatterns` list covers `src`, `data`, `worker`, `public`, config files). `scripts/run-heavy.mjs` propagates the child exit code via `process.exit(exitCode)`, and the `&&` chain means a non-zero exit from `check-client-bundle-secrets.mjs` fails `npm run build`, which fails the required `Build` job. So the check **does run, in CI, blocking, in exactly the place the document itself proposes wiring it** ("right after the build step, since it needs `.next/static` to exist") — it's just invoked through `build:internal` rather than as its own named `npm run check:client-bundle-secrets` step. The document's method (grep for the npm-script name in workflow YAML) missed an indirect invocation path that `check-gate-manifest.mjs`'s own `aggregatesRunning()` logic is specifically built to catch for gates _inside_ its scope — but `check:client-bundle-secrets` isn't in `verify:cheap:internal`, so that machinery never got applied to it here. G2 should be downgraded from "orphaned load-bearing gap" to "the npm-script alias is genuinely unwired everywhere, but the underlying detection already runs and blocks via `build`" — a documentation/naming clarity issue, not a coverage gap.

I did not independently re-verify the family-table incident citations (PR numbers, ledger entries) — those rest on the document's own evidence-gathering pass, which I'm taking on its word rather than re-deriving.

#### 2. Would Tier 2/3, if implemented, violate the manifest invariant or arbiter/receipts contracts?

No, but with one real interaction worth surfacing. `check-gate-manifest.mjs` also asserts two documented _counts_ stay in sync with the actual chain: CLAUDE.md's "N static/consistency gates" (currently 34, confirmed by grep) and the gates skill's "check X of Y" (currently 37, i.e. 34 + lint/typecheck/test). C2 (merge `brand:check`+`check:assets`) and C3 (fold `type-scale`/`icon-scale` into `design-system-contract`) each reduce the static-gate count, so implementing them correctly _requires_ touching `package.json`'s `verify:cheap:internal`, the corresponding `static-pr` steps in `ci.yml`, CLAUDE.md's count, and the gates skill's count together — and `check:gate-manifest` will fail closed on any of those four being missed. That's the invariant working as a forcing function, not a landmine. Also worth noting: since none of C1/C2/C3/J1's target scripts are in `verify:pr-local` today (per G1), consolidating them changes nothing about what `verify:pr-local` runs before or after — a clean non-interaction.

J1 (drop the standalone `check:cross-mode-index --check` and rely solely on `tests/cross-mode-differentials-index.test.ts` inside `npm run test`) does interact with the arbiter in a way the document doesn't mention. I confirmed `npm run test` always routes through `scripts/run-vitest.mjs`, which calls `gate-arbiter.mjs`'s `arbitrate()` on _every_ invocation — including the nested `npm run test` inside `verify:cheap:internal`'s `&&` chain, not just a standalone `npm test`. `test`/`vitest` is an `ARBITRATED_GATE` with a `CLEAN_WINDOW_BY_CLASS` (12 clean "source"-class runs before deferral is even recommended, and only under opt-in `GATE_ARBITER=enforce`). Today, `check:cross-mode-index` is a separate, non-arbitrated npm script, so it always executes inside `verify:cheap` regardless of the `test` gate's arbiter state. After J1, cross-mode-index detection becomes fully dependent on a gate that _can_ be advisory-deferred. This isn't a violation of any contract — deferral is opt-in and advisory by design — but it is a real compounding-risk point the document should name rather than silently accept, since it changes an always-on detector into one gated behind another gate's own deferral policy.

Receipts (`gate-receipts.mjs`) only memoize `lint`, `typecheck`, and non-coverage Vitest identities by content signature. None of the Tier 2/3 target scripts are receipt-memoized gates, so there's no signature-collision risk from renaming or merging them.

#### 3. Is the document's own recommended verification tier for itself correct?

The diff is `docs/audit/gate-consolidation-audit-2026-09-02.md` only (confirmed: `git diff --stat origin/main...HEAD` shows exactly one file, 397 insertions, zero deletions). I traced this through `scripts/ci-change-scope.mjs`: `docPatterns` matches `docs/**` and `*.md` generally, this file isn't the generated medication-lexicon report, and it matches none of `sourcePatterns`/`dbPatterns`/`workflowPatterns`/`buildPatterns`. So it classifies as `docs_changed: true`, `static_heavy_changed: false`, `docs_only: true`. Per AGENTS.md's own pyramid this is squarely Tier 1 ("documentation... relevant format/docs check only"), and the correct command is `npm run verify:pr-local` (its `docs_changed` branch: `check:runtime`, `check:installed-lock-parity`, `format:changed`, plus the doc-integrity chain — `sitemap:check`, `check:repo-awareness-snapshot`, `docs:check-index`, `docs:check-inventory`, `docs:check-scripts`, `docs:check-links`, the three ledger checks). Not `verify:cheap` — AGENTS.md is explicit that `verify:cheap` isn't the default for a documented-low-risk PR-handoff change. I also checked whether the new file needs any index entry: `check-docs-links.mjs` and `check-docs-script-refs.mjs` both explicitly exclude `docs/audit/` from their scan scope, so this file needs no companion edit elsewhere, and I confirmed `npx prettier --check` on the file passes cleanly. So the smallest correct gate here is real and cheap, and there's no reason it wasn't run.

The drafting session doesn't appear to have run or reported it, though — the document states "Nothing in this document has been acted on" and lists no verification evidence at all (no gate name, no decisive output line), which is a real gap against AGENTS.md's own "paste the decisive line" rule. Before this is pushed and a PR opened, I'd run `npm run verify:pr-local` (docs branch) and quote its summary line, plus commit any `format:changed` fix it surfaces.

#### 4. Confident-but-subtly-wrong claims

- **G2's "wired nowhere" framing** (§1 above) is the clearest case — contradicted by `package.json`'s `build:internal` chain and CI's `build` job.
- **The Tier-1/Tier-2 framing slightly understates how `check-gate-manifest.mjs`'s count self-test constrains implementation.** The document treats C2/C3 as "implementation-only, zero coverage loss," which is true for detection but not for the mechanical blast radius — four files must move together (`package.json`, `ci.yml`, `CLAUDE.md`, `.claude/skills/gates/SKILL.md`) or CI goes red on the count check alone, independent of whether the merged assertions are correct.
- **J1 undersells the arbiter interaction** noted in §2 — worth adding a line rather than treating it as a pure "faster, same answer" swap.
- Everything else I spot-checked (the unconditional `static-pr` steps, `ci-change-scope.mjs`'s scope flags, the receipts/arbiter gate-identity boundaries, `docs/audit/` exclusion from the doc-index scans) matched the document's description on direct source read.

Files read for this review: `docs/audit/gate-consolidation-audit-2026-09-02.md`, `scripts/verify-pr-local.mjs`, `scripts/check-gate-manifest.mjs`, `scripts/gate-arbiter.mjs`, `scripts/ci-change-scope.mjs`, `.github/workflows/ci.yml`, `package.json`, `scripts/run-heavy.mjs`, `scripts/run-vitest.mjs`, `CLAUDE.md`, `.claude/skills/gates/SKILL.md`.
