# Clinical governance incident runbooks

Last reviewed: 2026-07-17

These are short operator checklists. Preserve evidence and identifiers, but do not copy patient-identifying question or answer prose into tickets or chat.

## Adverse clinical output

1. Record the answer interaction ID, feedback category, cited source IDs, time, and affected workflow.
2. If harm is plausible, disable the affected answer mode or narrow its source scope; keep direct source browsing available.
3. Quarantine an implicated source through a `decommissioned` or `superseded` source-review event when appropriate.
4. Reproduce with a synthetic or minimised fixture, add a regression test, and identify whether retrieval, generation, rendering, or copy caused the defect.
5. Restore the feature only after the narrow regression and production-readiness checks pass and the clinical owner reviews material clinical-policy changes.

## Source quarantine, recall, or replacement

1. Record an evidence-bearing review event with a reason and replacement document where applicable.
2. If immediate containment is required, disable the affected answer mode or narrow its source scope; do not treat review status alone as a retrieval exclusion.
3. Confirm answer caches for the owner are invalidated after the transaction commits.
4. Before declaring containment, verify the source remains directly browsable but cannot participate in retrieval or answer generation.
5. Re-run source-governance and focused answer tests. Live data repair or migration requires explicit approval.

## Privacy or provider incident

1. Preserve interaction IDs, hashes, timestamps, configuration-posture versions, and provider request IDs; do not preserve raw clinical prose unless an authorised incident process requires it.
2. Disable provider generation or switch to the source-only path if external processing must stop.
3. If raw query persistence, answer persistence, or provider response storage is enabled, disable the affected path. Verify all three controls are off before proceeding.
4. Inspect affected answer copies in `rag_response_cache.payload`; invalidate affected owners and purge incident-related rows where appropriate, then verify the bounded retention purge before assessing other cache and telemetry retention.
5. Escalate notification and breach decisions to the privacy owner; this runbook does not make that legal determination.

## Answer-pipeline rollback

1. Revert or disable the smallest affected generation or ranking feature while retaining source browsing and deterministic source-only answers.
2. Do not weaken danger-source exclusion, query and answer minimisation, or private-document access to restore availability.
3. Run the focused regression, offline RAG evaluation, production-readiness CI check, and local PR mirror before release.
