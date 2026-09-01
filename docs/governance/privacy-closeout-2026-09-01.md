# Privacy governance closeout evidence — 2026-09-01

This record reconciles the privacy-readiness register against current provider checks and existing
operator/legal evidence. It contains no secret values, provider tokens, patient data, or clinical row
content. The status authority remains
[`privacy-readiness.v1.json`](privacy-readiness.v1.json).

## Evidence collected for accountable-owner review

| Requirement                            | Result   | Evidence                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PRIV-PROVIDER-PRODUCTION-HMAC-SECRET` | Verified | `npm run check:env-parity -- --gh --railway` passed on 2026-09-01. The production `RAG_QUERY_HASH_SECRET` name was present in GitHub and the pinned Railway production services. The checker emitted names only and did not persist values. The PsychSift owner explicitly approved the evidence as Production platform owner on 2026-09-01. |

The contextual owner approval was received in Codex task
`01a04af2-74bf-7e40-aa14-4a9e78295b33` after the two requested approvals were described. The task
content is retained outside Git. This repository stores the sanitized role, decision, date, scope,
and opaque task reference only; it does not claim identity authentication, a handwritten signature,
or approval of any other governance item.

This review did not accept provider terms. With the account owner's explicit approval, it changed
reversible provider controls to the privacy-minimal available settings and submitted a ZDR request.
OpenAI acknowledged receipt, but approval and configured-retention evidence remain pending.

## OpenAI evidence contradiction

Repository ledger items `#053` and `#HVTYAT` say that API zero data retention, disabled input/output
sharing, and an executed DPA `v.010126` were verified in August 2026. Those are useful leads, but they
are repository assertions, not the secure provider/account and countersigned-contract references
required by the status authority.

After authentication on 2026-09-01, an OpenAI Platform owner review confirmed that the signed-in
user is the sole visible organisation member and has the `Owner` role. The account exposes one
Personal organisation and its Default project. API feedback sharing, evaluation/fine-tuning
sharing, and API input/output sharing were all disabled. With explicit approval, API call logging
was changed from `Enabled per call` to `Disabled`. Hosted MCP, web search, file search, image
generation, code interpreter, and container networking were also set to `Disabled`. These settings
reduce optional provider processing but do not confer ZDR. The data-retention screen did not show
current ZDR entitlement, configured retention type, or endpoint coverage. The project contains app-labelled API keys, but the
production Railway value is OAuth-redacted, so this review did not compare or expose secret material
and cannot prove which project key production uses.

The application does set `store:false` by default. That is a useful request-level control, not proof
of organisation/project ZDR, Embeddings coverage, or prompt-cache deletion behavior. The current
provider evidence therefore contradicts rather than substantiates the old repository ZDR claim.
`PRIV-PROVIDER-OPENAI-ZDR` remains pending until OpenAI approves the request and the account owner
supplies the configured organisation/project retention type through OpenAI's Admin API or a sanitized
OpenAI support record. On 2026-09-01, OpenAI acknowledged receipt of an `API for Enterprise` sales
request for ZDR covering Responses, Embeddings, prompt caching, the applicable DPA, and Australia
data-residency options. Receipt is outreach evidence, not approval or configured-retention evidence.

No current countersigned DPA was available. No candidate OpenAI or Railway DPA file was found by
filename in the user's likely OneDrive, Documents, or Downloads locations. The decision-ready
evidence and attestation fields are in
[`privacy-role-attestation-pack-2026-09-01.md`](privacy-role-attestation-pack-2026-09-01.md).

## Retention schedule evidence

Read-only production inspection on 2026-09-01 found all four expected jobs active:

| Job                         | Schedule     | Operation                          |
| --------------------------- | ------------ | ---------------------------------- |
| `purge-expired-rag-queries` | `30 3 * * *` | 30-day query purge                 |
| `purge-rag-retrieval-logs`  | `0 3 * * *`  | 90-day retrieval-log purge         |
| `purge-rag-query-misses`    | `45 3 * * *` | 90-day query-miss purge            |
| `purge-rag-response-cache`  | `15 * * * *` | bounded hourly expired-cache purge |

The obsolete unbounded response-cache job was absent. The staging project initially did not have the
`cron` schema, although all required purge functions and tables were present and the historical
retention migrations were recorded. With explicit operator approval, staging migration
`20260901033250_enable_staging_privacy_retention_schedules` enabled `pg_cron` and reconciled the four
jobs. Post-apply inspection found all four jobs active with the schedules and commands above.

The technical parity gap is closed. On 2026-09-01, the PsychSift owner explicitly approved the
verified retention schedules as Database operations owner. The supporting technical record covers
the staging identity, migration, post-state, and rollback; it does not claim the owner separately
restated each detail. `PRIV-PROVIDER-RETENTION-SCHEDULE-PARITY` is therefore **verified**. Rollback is
to unschedule those four named jobs; `pg_cron` must be dropped only if no unrelated jobs exist.

## Remaining accountable decisions

These items cannot be closed by an automated repository review or by broad implementation permission.
Each requires the named role to create or retain evidence and then update the readiness register.

### Railway DPA and APP 8 basis

Railway's current public DPA requires the customer to submit its DocuSign form and becomes binding
only when Railway executes it. Its standard Exhibit A currently says that sensitive or
special-category data is **none**, while this PIA assumes incidental health information can pass
through the Singapore-hosted application and worker. Before real-patient use:

1. An authorised legal signatory must obtain a countersigned DPA or negotiated enterprise schedule
   that expressly covers the actual sensitive-health-data flow.
2. Record the legal entity, agreement version/date, processing locations, retention terms, and
   subscribed subprocessor-change process outside the public repository.
3. A privacy adviser must determine and record the complete APP 8 basis for both Railway and OpenAI.

Do not mark `PRIV-LEGAL-RAILWAY-DPA` or `PRIV-LEGAL-APP8-CROSS-BORDER-BASIS` complete merely because
the public form exists. Current official references:

- <https://railway.com/legal/dpa>
- <https://railway.com/legal/enterprise-agreement>
- <https://www.oaic.gov.au/privacy/australian-privacy-principles/read-the-australian-privacy-principles>

### APP 1 / APP 5 notice

The product already places a persistent do-not-enter-identifiers warning beside relevant inputs and
publishes a detailed `/privacy` processing notice. A privacy adviser must approve that wording as the
organisation's final notice/policy, name the accountable organisation and contact channel, and confirm
that the overseas recipient/country disclosures are sufficient. Until then,
`PRIV-LEGAL-APP1-APP5-NOTICE` remains pending.

### Clinical PHI minimisation

The application warns against identifiers and blocks some identifier-shaped Clinical Ask input, but
does not guarantee de-identification and does not scrub all outbound free text. The Clinical safety
owner must either approve the current warning-and-workflow control for the intended deployment or
require an additional control and supporting evaluation. Until that decision is recorded,
`PRIV-CLINICAL-PHI-MINIMISATION` remains partial.

## Release position

The structural manifest should pass. The release-mode privacy gate must continue to fail closed on the
six unresolved items: OpenAI ZDR, OpenAI DPA, Railway DPA, whole-of-flow APP 8 basis, APP 1/APP 5
approval, and clinical PHI minimisation. The production HMAC and retention-parity owner attestations
are verified. This is the intended governance boundary, not a tooling failure.
