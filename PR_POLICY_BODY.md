## Summary

- Reconciles the existing Clinical Ask PR with current `main` by ordinary merge while preserving its history and current-main schema, feedback-error, Playwright, and provenance work.
- Adds the mode-aware Clinical Ask retrieval ladder (catalogue → indexed → allowlisted authority evidence), one-composer UI, governed SSE output, feedback taxonomy, and synthetic speech input.
- Ports the staging-proven OpenAI web-search shape fix: accept `snippet` results and unknown provider metadata, screen the complete raw snippet for prompt injection, then expose at most 2,000 characters.
- Prevents ordinary dates from being classified as phone-number-shaped identifiers and scopes the medication-home browser assertion through the existing visible-owner helper.
- Regenerates the site map and schema drift manifest from the reconciled tree and removes the transient PR body scratch file deleted on `main`.

## Verification

- [x] Historical pre-reconciliation `npm run verify:pr-local` at `5a265fc6bd4c585f77acd5425b8accf411ecae45`: 9,354 passed, 74 skipped; build generated 1,982 pages; 627 offline RAG and 25 adversarial cases passed. It was intentionally not repeated after reconciliation; GitHub is authoritative for the final head.
- [x] Focused reconciled-code-tree Vitest — 5 files and 53/53 tests passed at `8da6c287c2a9b6fc158d2dcbd2253f82a6b642df`.
- [x] Focused reconciled-code-tree Production UI medication-home journey — 1/1 Chromium test passed; its isolated production build compiled, passed TypeScript, and generated 1,984 pages.
- [x] `npm run check:migration-role` — passed.
- [ ] `npm run check:production-readiness` — release gate remains open. Current-main privacy readiness stops first on an unavailable reviewed commit and pending/partial HMAC, retention, ZDR, DPA, APP 8/notice, and PHI-minimisation items; physical iPhone/PWA acceptance and named human approvals also remain outstanding.
- [x] `npm run format` — completed with the reconciled tree unchanged after formatting.
- [x] `git diff --check` — passed.
- [x] Focused push-range and ledger-discipline regression suite — 2 files and 63/63 tests passed at final head `0764fb5813564cc1cb8933267597478ecff9c354`.
- [ ] `npm run verify:ui` — not repeated locally; the targeted regression journey was run and applicable final-head Production UI lanes are required below.
- [ ] `npm run verify:release` — not run; this draft is not release-ready.
- [ ] **`npm run eval:retrieval:quality` (36/36)** — not claimed: Clinical KB Staging intentionally has no governed indexed corpus, so the full retrieval suite cannot provide a meaningful green signal.
- [ ] `npm run eval:rag -- --limit 15` + `npm run eval:quality -- --rag-only` — full batches not claimed for the empty staging corpus. One bounded provider case and one bounded quality case passed within the approved Phase 2 batch.

Fresh final-head GitHub checks are authoritative and must include `PR required`, Gitleaks, PR policy, migration replay, build, and applicable Production UI lanes. They are pending after the reconciliation push and will be updated only from final-head results.

## Evidence classes

- **Exact reconciled-tree local evidence:** Clinical Ask code tree `8da6c287c2a9b6fc158d2dcbd2253f82a6b642df` plus its documentation/ledger descendant and focused push-guard correction at published head `0764fb5813564cc1cb8933267597478ecff9c354`; the focused Vitest sets, targeted medication-home Playwright journey, migration-role guard, production-readiness attempt, formatting, and diff check are listed above.
- **Historical local evidence:** broad `verify:pr-local` at `5a265fc6bd4c585f77acd5425b8accf411ecae45`; not represented as final-head proof.
- **Hosted staging evidence:** migration applied only to Clinical KB Staging (`ikoiolksxqxfxgiyqpnu`, `ap-southeast-2`); protected-staging and cross-tenant canaries passed; one RAG provider case passed with two citations; one RAG quality case passed; one short synthetic transcription passed with no durable application persistence; allowlisted WA Health search returned five `health.wa.gov.au` evidence records after provider-shape normalization; cleanup returned zero temporary state.
- **Provider/data boundary:** synthetic, non-identifying inputs only; no real patient data; OpenAI `store:false`; extended prompt caching disabled; conservative abuse-monitoring retention assumption up to 30 days unless ZDR is confirmed; no provider content persisted.
- **Spend:** exact billed cost was not available from the batch itself, but use was bounded below the approved USD 10 ceiling (two text evaluations, one short audio transcription, four authority searches).
- **Not complete:** named human clinical-authority and contractual/privacy approval, physical iPhone Safari/installed-PWA microphone acceptance, governed-corpus full evaluations, production migration, deployment, merge, and release.

## Risk and rollout

- Risk: Clinical decision-support and external-provider behavior changes. External evidence remains mode-registered, domain-allowlisted, redirect-checked, injection-screened, length-bounded, explicitly marked with unknown review state, and fallback-safe.
- Rollback: set `CLINICAL_ASK_ENABLED=false`; independently set `CLINICAL_ASK_EXTERNAL_SEARCH_ENABLED=false`; use `CLINICAL_ASK_DISABLED_MODES` for mode-level containment. The widened feedback constraint is forward-compatible and can remain in place while the feature is disabled.
- Provider or production effects: the approved bounded provider batch and migration affected Clinical KB Staging only. Production `sjrfecxgysukkwxsowpy` was untouched; this PR does not deploy or enable Clinical Ask.
- RAG impact: behaviour change — canary pair: pre-fix current provider `snippet` shape yielded 0 accepted authority records → post-fix bounded staging canary yielded 5 allowlisted `health.wa.gov.au` evidence records. The existing generic RAG ranking pipeline is not rewritten.

## Clinical Governance Preflight

- [x] Source-backed claims still require linked source verification before clinical use
- [x] No patient-identifiable document workflow was introduced or expanded without explicit governance approval
- [x] Supabase target remains `Clinical KB Database` (`sjrfecxgysukkwxsowpy`)
- [x] Service-role keys and private document access remain server-only
- [x] Demo/synthetic content remains clearly separated from real clinical sources
- [x] Source metadata, review status, and outdated/unknown-source behavior remain conservative
- [x] Deployment classification/TGA SaMD impact was checked when clinical decision-support behavior changed

## Notes

- Keep this PR in draft with auto-merge off.
- Do not merge, deploy, enable production Clinical Ask, touch production Supabase, or claim production readiness until the outstanding human and physical-device gates are complete.
- Raw `.local` receipts, credentials, prompts, audio, and provider content are ignored and uncommitted.
- TGA SaMD classification and final clinical/privacy approval remain named-human release gates; they were considered for this change and are not claimed complete.
