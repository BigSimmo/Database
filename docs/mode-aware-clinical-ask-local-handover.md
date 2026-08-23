# Mode-aware Clinical Ask: reconciled local handover

Status: **local integration and the bounded protected-staging/provider batch are complete; final GitHub checks, named human approvals, and physical-device acceptance remain.**

PR [#2293](https://github.com/BigSimmo/Database/pull/2293) retains the original Clinical Ask history and is being reconciled with current `main` by an ordinary merge. The PR must remain a draft with auto-merge disabled until the remaining gates below are complete.

## Binding references

- [Accepted architecture decision](adr/0001-use-a-shared-local-first-clinical-ask-orchestrator.md)
- [Approved design specification](superpowers/specs/2026-08-21-mode-aware-clinical-ask-design.md)
- [Twelve-task implementation plan](superpowers/plans/2026-08-22-mode-aware-clinical-ask-implementation.md)
- [Cloud implementation handover](prompts/mode-aware-clinical-ask-codex-cloud-handover.md)
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

## Phase 1 — Local integration and proof: complete

The reviewed Clinical Ask tree was integrated locally and verified at `5a265fc6bd4c585f77acd5425b8accf411ecae45`. This is historical pre-reconciliation evidence, not proof of the later PR head.

- `npm run verify:pr-local` passed: 9,354 tests passed, 74 skipped; the production build generated 1,982 pages; 627 offline RAG and 25 adversarial cases passed.
- The exact reconciled code tree `8da6c287c2a9b6fc158d2dcbd2253f82a6b642df` passed the five-file focused suite (53/53) and the single medication-home Production UI journey (1/1); its isolated production build compiled, passed TypeScript, and generated 1,984 pages.
- `npm run check:migration-role` passed. `npm run check:production-readiness` remains release-gated by current-main privacy readiness before it reaches the Clinical Ask device finding: its reviewed commit is unavailable and HMAC, retention, ZDR, DPA, APP 8/notice, and PHI-minimisation entries remain pending or partial. Physical iPhone/PWA acceptance remains separately deferred.
- The immutable repository review ledger records the reconciled code tree under scope `PR #2293 full diff and Clinical Ask reconciliation`, with no new P0/P1 finding and the four planned P2 repairs applied.
- The merge into PR #2293 preserves the existing HTTP and SSE request/response contracts, current-main schema changes, the widened Clinical Ask feedback taxonomy, current-main Playwright/provenance configuration, and the Clinical Ask UI shard.
- The live-proven authority-search adapter accepts current OpenAI `snippet` results and unknown metadata, screens the complete raw snippet for prompt injection, and exposes at most 2,000 characters.
- Date-shaped questions no longer trigger the generic phone-number identifier warning, and the medication-home browser assertion is scoped through the existing visible-owner helper.
- Raw `.local` receipts, credentials, prompts, audio, and provider content remain ignored and uncommitted.

GitHub checks on the final pushed PR head are authoritative. The full local PR gate and live provider canaries must not be repeated solely for reconciliation.

## Phase 2 — Protected staging and provider acceptance: bounded batch complete

The approved hosted target was **Clinical KB Staging** (`ikoiolksxqxfxgiyqpnu`, Supabase `ap-southeast-2`). Production **Clinical KB Database** (`sjrfecxgysukkwxsowpy`) was not modified.

- The existing Clinical Ask feedback migration was applied to staging and was not applied to production. No new production migration is introduced by reconciliation.
- Inputs were synthetic and non-identifying. No real patient data was used.
- OpenAI requests used `store:false`; extended prompt caching stayed disabled. Provider abuse-monitoring retention is conservatively assumed to be up to 30 days unless zero-data-retention status is separately confirmed.
- The protected-staging canary and cross-tenant isolation harness passed.
- One bounded RAG provider case passed through the strong route with two citations.
- One bounded RAG quality case passed.
- One short synthetic audio transcription passed with no durable application persistence.
- The allowlisted WA Health external-search canary passed after provider-shape normalization, returning five authority records from `health.wa.gov.au` and persisting no provider content.
- Cleanup confirmed a zero state for temporary staging artifacts.
- Exact billed spend was not available from the batch itself. The run was bounded below the authorised USD 10 ceiling: two text evaluations, one short audio transcription, and four authority searches.
- The intentionally empty governed staging corpus means the full 36-case retrieval suite and 15-case provider batch were not a meaningful green acceptance signal and were not claimed as passed.

Evidence receipts remain local under `.local/clinical-ask-evidence/`. They are operational evidence, not repository content.

## Phase 3 — PR closeout and remaining release gates

PR #2293 introduces a new Clinical Ask retrieval ladder: catalogue evidence, then indexed evidence, then allowlisted external authority evidence. Declare `RAG impact: behaviour change`; do not describe this as a no-behaviour-change refactor.

Before any merge or production enablement:

1. Require the final-head `PR required` aggregate, Gitleaks, PR policy, migration replay, build, and applicable Production UI lanes to pass.
2. Confirm the PR is conflict-free and the previously resolved review threads remain resolved.
3. Obtain named human clinical-authority and contractual/privacy approval. The prior role labels (`Clinician Review` and `Privacy Review`) are not named-person approval.
4. Complete physical iPhone Safari and installed-PWA microphone acceptance. Chromium emulation is not physical-device evidence.
5. If full retrieval-quality/provider acceptance is required, first populate a governed staging corpus and approve a separate bounded run.

Rollback remains available through `CLINICAL_ASK_ENABLED=false`, `CLINICAL_ASK_EXTERNAL_SEARCH_ENABLED=false`, and the disabled-mode denylist. The widened feedback category constraint is forward-compatible and need not be reversed when the feature is disabled.

Do not merge, deploy, enable production Clinical Ask, alter production Supabase, or claim production readiness until these gates are complete and separately authorised.

## Evidence boundaries

- **Current code evidence:** focused exact-tree reconciliation checks and final GitHub CI at the pushed PR head.
- **Historical local evidence:** the broad local gate at `5a265fc6bd4c585f77acd5425b8accf411ecae45`.
- **Hosted staging evidence:** migration, protected canary, bounded OpenAI/search/audio checks, and cleanup against `ikoiolksxqxfxgiyqpnu` only.
- **Not complete:** named human clinical/privacy approvals, physical iPhone/PWA acceptance, governed-corpus full evaluations, production migration, deployment, merge, and release.
