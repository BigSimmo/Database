# Mode-aware Clinical Ask: three-phase local handover

Status: **Cloud implementation and focused review complete; local integration and approval-gated acceptance remain.**

The implementation snapshot reviewed in Cloud is `fb7000e0ac018024508b59941fb2b849698288b5` on branch `work`.
It has no upstream and was 1 commit ahead / 62 commits behind `origin/main` when this handover was prepared. Preserve
that snapshot: do not reset, clean, overwrite, or force-push it.

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

## Phase 1 — Integrate current main and close local proof

**Authority:** local repository only; no providers, hosted migration, push, or deployment.

1. Create a disposable integration branch/worktree from the reviewed snapshot. Fetch current refs if authorised, then
   inspect the prospective merge tree. Because the snapshot is 62 commits behind, do not rewrite `work`; choose the
   repository-approved merge/rebase/cherry-pick route only after inspecting conflicts.
2. Resolve conflicts conservatively around the shared composer, `globals.css`, feedback route/taxonomy, Playwright
   registries, and readiness documentation. Preserve ordinary Search, generic Answer, owner scope, ranking, and the
   one-composer rule.
3. Run the focused proof, then the browser and final selector—without stacking equivalent broad gates:

   ```bash
   npm test -- tests/clinical-ask-context.test.ts tests/clinical-ask-orchestrator.test.ts \
     tests/clinical-ask-response-governance.test.ts tests/clinical-ask-workspace.dom.test.tsx \
     tests/speech-transcription-route.test.ts
   npm run typecheck
   npm run ensure
   npm run test:e2e:critical
   # Stop the task-owned dev server before the build-owning final gate.
   npm run verify:pr-local
   git diff --check
   ```

4. The decisive acceptance is a green `verify:pr-local` on the final integrated tree. If process tests time out, record
   their exact names and run only the smallest reproducer before one classified correction/rerun. Do not relabel a
   timeout as a pass.

**Exit:** integrated branch is clean; focused tests, critical Chromium, and the final selector are green; the local
migration remains unapplied; synthetic evidence is recorded under `.local/clinical-ask-evidence/`.

## Phase 2 — Run the single approved staging and governance batch

**Authority required before starting:** exact protected Supabase staging project, migration permission, synthetic-only
provider prompts/audio, provider spend ceiling, allowed data egress/region/retention, and permission to write local
evidence receipts. Never use real patient or production data.

1. Confirm the target, apply the existing feedback migration through the authorised workflow, and record
   `hosted-migration.json`. Repository presence is not hosted-state proof.
2. Obtain dated authority/source-governance and contractual/privacy approval; record `authority-approval.json` and
   `contractual-basis.json`.
3. Run the approved batch:

   ```bash
   npm run check:supabase-project
   npm run check:production-readiness
   npm run eval:retrieval:quality
   npm run eval:rag -- --limit 15
   npm run eval:quality -- --rag-only
   ```

4. Run the protected-staging pre/post canary with synthetic inputs only and record
   `protected-staging-canary.json`. Any identifier leak, unsupported clinical conclusion/number, invalid citation,
   arbitrary authority, existing Search/Answer regression, or source-review concealment is a hard failure.
5. Complete physical iPhone Safari and installed-PWA microphone acceptance separately and record
   `physical-iphone-acceptance.json`; Chromium emulation is not device evidence.

**Exit:** hosted migration, provider canaries, authority governance, contractual/privacy basis, and physical-device
evidence are present, scoped, dated, inspected, and green. This is still not deployment authority.

## Phase 3 — Publish the reviewed handoff

**Authority required before starting:** explicit permission to push the named integration branch and open/update the
named PR. Deployment, merge, and release remain separate decisions.

1. Confirm branch, upstream, clean status, exact HEAD, ahead/behind, changed paths, migration state, and evidence
   separation. Run `npm run format`, commit the result, and do not force-push.
2. Push and create the PR using the repository template. Declare `RAG impact: behaviour change`; list offline/mock,
   hosted-provider, migration, governance, and physical-device evidence separately; include rollback flags
   (`CLINICAL_ASK_ENABLED`, external-search flag, and disabled-mode denylist).
3. Resolve only review threads actually fixed after the fix is pushed. Do not merge, deploy, or release until required
   CI and human clinical/privacy/source-governance approvals are complete.

**Exit:** a reviewable PR exists at the verified head with truthful checks and approvals. Only a later authorised
decision may call the feature implementation-complete, deployed, production-ready, or active.

## Cloud evidence and known boundary

- The final Cloud review fixed clarification progression, unsafe auxiliary model output, deterministic handoff
  navigation, and transcription-model exposure.
- Focused tests and TypeScript passed after those fixes; the review is recorded under `docs/branch-review-records/`.
- A previous broad `verify:pr-local` reached 7,948 unit tests but was non-green because five unrelated process tests
  timed out and three newly exposed contract failures required correction. The contract failures were corrected and
  focused proof passed; a fresh final gate belongs to Phase 1 after current-main integration.
- No live OpenAI, Supabase, hosted retrieval, external authority, hosted migration, real data, push, PR mutation,
  deployment, merge, or release occurred in Cloud.
