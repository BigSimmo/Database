# Mode-aware Clinical Ask and Smart search: current-main handover

Status: **PR #2293 is historical and merged. Current-main Smart natural search is being prepared as a new dormant, ready-for-review code PR. Production remains untouched and activation gates remain open.**

The historical Clinical Ask implementation entered main through
[#2293](https://github.com/BigSimmo/Database/pull/2293) as commit
80be7321213f4111e49345a1f29f5b76409e6be1. It is not the publication
vehicle for the current Smart-search completion. The current work is rebuilt by
intent from fresh origin/main on codex/smart-natural-search-current-main; the
preserved uncommitted 78f0 worktree remains untouched.

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
production-configuration change. It preserves one shared composer and limits
governed Smart answers to Services, Forms, Differentials, Formulation, DSM-5
Diagnosis, Specifiers, and Therapy.

- The server search-app layout projects the enabled mode list into client
  owners. When the global flag is off or a mode is denylisted, the composer
  retains ordinary search/filter behaviour and shows no Smart promise.
- A provider-free deterministic resolver sends explicit questions and
  sufficiently developed clinical case/synthesis statements to Clinical Ask.
  Catalogue phrases, incomplete fragments, lookup commands, compact codes
  (including form 4A?), unsupported modes, and empty input remain search.
- Offline and mode_unavailable failures stay in tab memory. No automatic
  fallback writes the raw question to recents, URL parameters, history,
  browser storage, telemetry, or feedback.
- Retry is explicit and only offered for retryable failures. “Return to search”
  destroys the Smart session and draft, clears routed query state, and focuses
  the empty ordinary composer.
- Clarification responses expose “Continue with confirmed context” only after
  every required answer is non-empty, then rerun the original in-memory
  question with the confirmed context and clarification answers.
- An answered SSE payload fails closed without governed evidence or when a
  visible claim references an unknown evidence ID. Evidence Gap responses may
  still contain zero or partial evidence.
- Smart intent is announced only when crossing from Search to Smart. No Ask
  rail, duplicate composer, microphone control, or new phone-dock reserve is
  introduced.

Exact-head offline, contract, DOM, and browser evidence belongs to the new PR
and must be recorded after the final current-main sync. Do not repeat live
OpenAI, Supabase, staging, audio, or authority-search canaries solely for this
code reconciliation.

### Current exact-tree evidence

The feature branch incorporated origin/main at
0ca012f8ed32554cb50cc231dccd3d412b0472c5 through an ordinary merge. The
following local evidence was then collected on the merged tree:

- 90 focused Smart/Clinical Ask unit, DOM, route, contract, capability, runner,
  session, and shared-header tests passed across 10 files.
- The enabled, provider-free Chromium suite passed all 6 applicable journeys
  (with the default-off-only case skipped). It covers the seven governed modes,
  deterministic catalogue/code routing, offline and unavailable privacy,
  retry, clear, clarification continuation, focus/reset behavior, responsive
  widths, dark mode, reduced motion, forced colors, and Axe.
- The default-off Chromium journey passed and confirmed ordinary search with no
  broken Smart promise.
- The phone-chrome gate passed 135 static/unit contracts and 12 focused
  Chromium/PWA journeys. This is local browser emulation, not physical-device
  acceptance.
- The offline RAG evaluation passed 628 assertions across 36 golden cases and
  26 suites.
- TypeScript, lint, the production build and client-bundle secret scan,
  design-system contracts/adoption/sync, formatting, and diff whitespace checks
  passed.
- The broad UI gate exposed two desktop service-detail scroll-fixture failures.
  An exact origin/main comparison passed both cases and proved that removing
  the disabled Smart-search hint shortened this compact page below a brittle
  700 px loading threshold. The service-detail fixture now requires its real
  650 px runway while retaining the mid-page hide/reveal and composer-owner
  assertions; both focused cases pass.
- `verify:pr-local` reached the full 11,701-test Vitest suite. Its first run
  found four Smart-owned contract defects (the live-region lint pattern, one
  undeclared CSS token, and two stale source-shape assertions); all were fixed,
  and the affected 118 focused tests pass. The remaining six failures are
  Windows Bash exit-127 results in `claude-cloud-profile.test.ts`; the identical
  six failures reproduce on an untouched origin/main worktree. The gate is
  therefore recorded as non-green on this Windows host rather than falsely
  reported as passed. The production build, RAG fixture validation, medication
  interaction index, and medication lexicon report checks that the gate did not
  reach were run separately and passed.

Production readiness remains intentionally non-green. The current privacy
manifest still records the HMAC secret, retention parity, OpenAI ZDR and DPA,
Railway DPA, APP 8 cross-border basis, APP 1/APP 5 notice, and PHI-minimisation
evidence as pending or partial. Named clinical-authority and privacy approval
and physical iPhone Safari/PWA Smart-path acceptance also remain open. These
are activation gates, not evidence supplied by the dormant code PR.

## Phase 3 — Publication and activation boundary

Before publication, fetch origin/main again. If it advanced, merge it normally,
resolve by current-main intent, and rerun only affected checks. Commit the
reviewed exact tree, push without force, and open a **new ready-for-review PR**
with auto-merge off.

The PR must state:

- RAG impact: behaviour change;
- Smart coverage is limited to the seven governed modes;
- PR #2293 staging/provider results are historical rather than exact-head
  proof;
- Clinical Ask remains disabled in production by default;
- production Supabase, migrations, provider configuration, deployment, and
  release were untouched;
- rollback uses CLINICAL_ASK_ENABLED=false,
  CLINICAL_ASK_EXTERNAL_SEARCH_ENABLED=false, and
  CLINICAL_ASK_DISABLED_MODES;
- named clinical-authority and contractual/privacy approval plus physical
  iPhone Safari and installed-PWA Smart-path acceptance remain activation
  gates; and
- microphone-specific acceptance is deferred because microphone controls are
  absent unless dictation is separately reintroduced.

Require the final-head PR required aggregate, Gitleaks, PR policy, migration
replay, build, and applicable Production UI lanes. Leave the PR open for human
review. Do not merge, deploy, enable Clinical Ask, alter production Supabase,
or claim production readiness until activation gates are complete and a
separate action is authorised.

## Evidence classes

- **Exact-head code evidence:** focused unit/DOM/contracts, provider-free
  enabled and default-flag browser journeys, design/phone/UI/RAG gates, final
  local PR verification, and GitHub checks on the pushed head.
- **Historical local evidence:** the broad Clinical Ask gate at 5a265fc6… and
  PR #2293 reconciliation checks.
- **Historical protected-staging evidence:** migration, protected canary,
  bounded synthetic provider/search/audio checks, and cleanup against
  ikoiolksxqxfxgiyqpnu only.
- **Still open for activation:** named human clinical/privacy approvals,
  physical iPhone Safari/PWA acceptance, a populated governed-corpus
  evaluation if required, production enablement, deployment, merge, and
  release.
