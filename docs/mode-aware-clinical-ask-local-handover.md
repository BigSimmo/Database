# Mode-aware Clinical Ask and Smart search: current-main handover

Status: **PR #2293 and the earlier Smart-search PR are historical and merged. This current-main local correction separates provider-free Smart catalogue search from dormant Clinical Ask. It is not yet committed or published. Production remains untouched.**

The historical Clinical Ask implementation entered main through
[#2293](https://github.com/BigSimmo/Database/pull/2293) as commit
80be7321213f4111e49345a1f29f5b76409e6be1. It is not the publication
vehicle for the current Smart-search completion. The current work is rebuilt by
intent from current main on
`codex/chat-smart-natural-mode-search-pr-2480-landed-verify`; the preserved
uncommitted 78f0 worktree remains untouched.

## Binding references

- [Accepted architecture decision](adr/0001-use-a-shared-local-first-clinical-ask-orchestrator.md)
- [Approved design specification](superpowers/specs/2026-08-21-mode-aware-clinical-ask-design.md)
- [Original implementation plan](superpowers/plans/2026-08-22-mode-aware-clinical-ask-implementation.md)
- [Clinical governance](clinical-governance.md)
- [Privacy impact assessment](privacy-impact-assessment.md)
- [OpenAI and RAG operations](openai-rag-operations.md)
- [Production-readiness checklist](production-readiness-checklist.md)
- [Search and one-composer behaviour](search-chrome-behaviour.md)
- [Wiring conventions](wiring-conventions.md)
- [Verification rules](process-hardening.md)
- [Review protocol](codex-review-protocol.md)
- [Physical iPhone/PWA acceptance](phone-chrome-physical-acceptance.md)
- [Pull-request governance checklist](../.github/pull_request_template.md)

## Phase 1 — Historical Clinical Ask and protected-staging evidence

The local and hosted evidence below predates the current Smart-search branch. It
remains useful background but is not exact-head proof for the new PR.

- The historical local Clinical Ask tree at
  5a265fc6bd4c585f77acd5425b8accf411ecae45 passed its broad local gate.
- The later PR #2293 reconciliation fixed provider snippet handling,
  full-snippet injection screening, date/phone-shape detection, and
  visible-owner Playwright scoping before merging into main.
- The approved hosted target was **Clinical KB Staging**
  (ikoiolksxqxfxgiyqpnu, Supabase ap-southeast-2). The Clinical Ask feedback
  migration, protected-staging canary, cross-tenant isolation harness, bounded
  synthetic OpenAI/search/audio checks, and cleanup completed there.
- Production **Clinical KB Database** (sjrfecxgysukkwxsowpy) was not modified.
  No real patient data was used.
- OpenAI requests used store:false; extended prompt caching stayed disabled.
  Provider abuse-monitoring retention remains conservatively assumed to be up
  to 30 days unless ZDR is separately confirmed.
- Exact billed spend was unavailable, so the batch is truthfully recorded as
  bounded below the authorised USD 10 ceiling, not as an exact spend.
- The governed staging corpus was intentionally empty. The full retrieval suite
  was therefore not a meaningful hosted acceptance signal and was not claimed
  as green.

Historical receipts remain ignored under .local/clinical-ask-evidence/. Raw
credentials, prompts, audio, provider content, and .local workflow receipts
must stay uncommitted.

## Phase 2 — Current-main Smart natural search

The current branch adds no schema, migration, provider, authority-registry, or
production-configuration change. It preserves one shared composer and provides
provider-free Smart catalogue interpretation in Services, Forms,
Differentials, Formulation, DSM-5 Diagnosis, Specifiers, and Therapy.

- Enter always opens the selected mode's ordinary results surface, including
  for questions and developed natural-language phrases.
- Controlled, mode-specific aliases broaden deterministic ranking at low
  weight. The original query remains in the composer and URL; no prose answer
  is generated and no provider or Clinical Ask request is made.
- Compact codes such as `form 4A?` stay literal. Unsupported modes retain their
  existing deterministic behaviour and show no Smart promise.
- Smart interpretation no longer depends on `CLINICAL_ASK_ENABLED` or the
  Clinical Ask mode allowlist. Clinical Ask remains a separately governed,
  dormant answer workflow with its existing evidence and activation gates.
- Smart intent is announced only when crossing from literal to natural-language
  search. No Ask rail, duplicate composer, microphone control, or new
  phone-dock reserve is introduced.

Do not repeat live OpenAI, Supabase, staging, audio, or authority-search
canaries for this change: Smart catalogue interpretation has no hosted or paid
dependency.

### Current local exact-tree evidence

The current-main correction is based on `7f5aba1891db6916bc0306b79f17e362051aecd4`
in the isolated `codex/chat-smart-natural-mode-search-pr-2480-landed-verify`
worktree. It is locally modified and not committed or published.

- 208 focused interpreter, ranker, route, API, DOM, and owner-contract tests
  pass across 13 files.
- Production Chromium passes four focused journeys: natural-language routing
  through all seven supported modes, literal compact-code routing, unsupported
  mode honesty, single-composer responsive behavior, dark mode, reduced motion,
  forced colors, and Axe. The route spy observed zero Clinical Ask requests.
- The production-style browser build and TypeScript compilation pass.
- Repository lint, documentation links, formatting, and diff whitespace checks
  pass.
- Mode-specific interpretation is an explicit opt-in at the seven mode-search
  owners. Universal discovery and Clinical Ask evidence selection retain their
  existing ranking contracts.

Production readiness and the named-human/physical-device gates continue to
apply to Clinical Ask activation only. They do not block provider-free Smart
catalogue search, which has no runtime activation flag.

## Phase 3 — Publication and activation boundary

PR [#2459](https://github.com/BigSimmo/Database/pull/2459) is historical and
must not be reused. Publication of this correction requires a new PR after an
explicit publication request. Before that PR, fetch `origin/main`, merge it
normally if it advanced, and rerun only affected checks.

The new PR should state:

- RAG impact: behaviour change;
- Smart coverage is limited to the seven governed modes;
- PR #2293 staging/provider results are historical rather than exact-head
  proof;
- Smart mode search is provider-free and has no activation flag;
- Clinical Ask remains a separate dormant governed-answer workflow;
- production Supabase, migrations, provider configuration, deployment, and
  release were untouched;
- rollback of Smart interpretation is a code revert; Clinical Ask flags are not
  Smart-search rollback controls;
- named clinical-authority, contractual/privacy, and physical-device approval
  remain Clinical Ask activation gates only; and
- microphone-specific acceptance is deferred because microphone controls are
  absent unless dictation is separately reintroduced.

Require the final-head PR required aggregate, Gitleaks, PR policy, build, and
applicable Production UI lanes. Leave the PR open for human review. Do not
merge, deploy, enable Clinical Ask, or alter production Supabase without a
separate explicit request.

## Evidence classes

- **Current local code evidence:** focused unit/DOM/contracts, provider-free
  browser journeys, TypeScript, lint, formatting, documentation, and diff
  checks on the uncommitted local tree.
- **Historical local evidence:** the broad Clinical Ask gate at 5a265fc6… and
  PR #2293 reconciliation checks.
- **Historical protected-staging evidence:** migration, protected canary,
  bounded synthetic provider/search/audio checks, and cleanup against
  ikoiolksxqxfxgiyqpnu only.
- **Still open for Clinical Ask activation:** named human clinical/privacy
  approvals, physical iPhone Safari/PWA acceptance, a populated governed-corpus
  evaluation if required, production enablement, deployment, and release.
- **Still open for Smart publication:** final current-main sync, commit, push,
  new PR, and final-head GitHub checks.
