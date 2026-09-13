# RAG adaptive activation: setup and continuation

This is the repository handoff for the adaptive coverage and privacy prerequisite repair, based on
merged PR #2790 (`c6d677e569ee9faedefa31c96eb927ab5fbd433d`). It records the accepted setup and remaining
work; it does not approve a release. Refresh mutable provider, branch and ingestion-owner state before
resuming. The privacy status authority remains [privacy-readiness.v1.json](privacy-readiness.v1.json).

## Current result

- PR #2790 was merged and deployed. The deployed guest checks still found incomplete clinician
  answers. Production was last observed in legacy mode with adaptive answers/rendering disabled.
- Read-only production inspection on 2026-09-13 found all four governed v3 retrieval RPCs present,
  2,851 legacy public documents, zero documents with governed scope, zero eligible governed document
  candidates and zero active site publications. Public status alone is not source approval.
- All four production retention jobs were unique, active and matched the committed schedules and
  commands. The obsolete cache job was absent. This proves configuration, not purge execution or
  renewed owner approval. The [role pack](privacy-role-attestation-pack-2026-09-01.md) records the limits.
- This change corrects activation/release documentation and adds [unsigned completion drafts](privacy-completion-drafts-2026-09-13.md).
  No source eligibility, runtime flags, product behavior, approvals or deployed configuration changed.

## Existing work and next action

Continue the existing ingestion programme rather than creating another ingestion pipeline. Its
worktree was last inspected at `38552bafe0`, branch `codex/rag-local-build-20260822`, with U07 accepted
locally and U08 unstarted. U08 egress safety, U09 fidelity evidence and U10 immutable technical receipts
and atomic activation remain prerequisites, followed by the required merge/deployment and live
control-plane proof. Local U07 acceptance is not hosted activation evidence.

The existing acquisition/publication sequence is a real source-activation manifest v1, generated
exact-version acquisition manifest, then post-index clinical review and publication manifest v2.
The implementation owners are `scripts/plan-public-source-acquisition.ts`,
`scripts/fetch-approved-public-source-versions.ts`, `scripts/promote-public-documents-batch.ts`,
`src/lib/publication-manifest.ts` and the document reviews API. Do not run old apply paths around the
current ingestion gates or infer licences, roles, version dates or reviewer approval from titles.

The smallest proposed first publication is one relevant exact-version Australian public source with
confirmed indexing rights and qualified review. It enables only the answer facets and source roles it
actually supports, not broad adaptive coverage. Source selection and approval remain outstanding.

In parallel, obtain the actual operator identity/privacy contact and the six pending/partial
provider/privacy/clinical decisions. The completion drafts are ready for those facts and decisions;
they are not signed agreements or provider retention entitlements.

Only after populated governed retrieval and release prerequisites pass, apply the accepted component
lanes and the settings documented in [deployment architecture](../deployment-architecture.md#adaptive-answer-release-activation-proof).
Then verify the exact served commit, actual v20 answer contract, populated evidence coverage and guest
rendering using the saved clinician cases. A flag or health capability bit alone is not answer-quality
acceptance. Preserve the explicit legacy rollback and fail-closed source admission.

## Agent and efficiency setup

Use the existing `rag-local-smart-agents-v1` policy and applicable repository instructions. Preferred
orchestrator: Astra High. When delegation is permitted and useful, use Terra Medium for bounded
mechanical work, Sol High for routine diagnosis and Astra High for sensitive governance/reasoning.
Preserve higher formal review floors where required. These are routing preferences, not a claim of
automatic runtime enforcement or verified provider routing.

Keep one writer, explicit file ownership, bounded context and independent required review. Do not
launch agents for small publication tasks. At a new phase, check ownership, changed constraints,
existing evidence and the smallest sufficient next action; do not repeat the full plan or skill
inventory. Reuse passing evidence and avoid duplicate local/CI gates. Keep one current checkpoint and
distinguish local, hosted, merged, deployed and clinically accepted states.

## Evidence and durable local setup

Prior verification for the documentation/evidence repair:

- `npm run check:privacy-readiness` — passed, 11 requirements, history checked.
- `npm run check:production-readiness` — failed on five pending and one partial requirement; the
  subsequent runtime/provider stage was not reached.
- Scoped Prettier and `git diff --check` — passed before publication packaging.
- Independent governance review — no unsafe status promotion; two wording corrections applied.

The PR publication request does not rerun those gates, add product tests or monitor CI. This new
continuation document has not received a separate test/format gate. GitHub remains the requested
verification surface; this is not release readiness.

The stable local root is `C:/Users/joshs/.codex/project-handoffs/rag-answer-quality/`:

- `START-HERE.md` points to current status; historical checkpoints remain intact.
- `execution-ledger.json` is the current controller record, with ownership, routing, evidence and next action.
- `ADAPTIVE-ACTIVATION-20260913.json` holds sanitized production observations and conditional activation settings.
- `EFFICIENCY-PLAYBOOK.md` and the existing programme plans retain the detailed execution approach.
- `checkpoints/20260913-adaptive-prerequisites/` preserves the pre-publication owned files with SHA-256 hashes.

The existing ingestion worktree is `C:/Users/joshs/.codex/worktrees/rag-local-build-20260822/Database`;
its governing continuation is `docs/superpowers/plans/2026-08-31-ingestion-first-continuation.md`.
Global operating preferences remain under
`C:/Users/joshs/.codex/project-handoffs/operating-preferences/automatic-execution-policy-20260913.md`.
These local paths survive branch changes but are not proof of an off-device backup. The PR stores this
sanitized continuation plus the project documentation; credentials, private correspondence and local
machine configuration are not publication artifacts. Preserve unrelated worktree files.
