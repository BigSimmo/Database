# Site-content publication and synchronization

This runbook owns the source-only Task 3 control plane for public registry site content. Legacy rows in `clinical_registry_records`, `medication_records`, and `differential_records` remain owner-scoped drafts and provenance. They are never public read authority merely because they exist.

## Public lifecycle

1. An administrator POSTs a bounded command to `/api/site-content/publications`. The service client performs only the P03 source/digest preflight; the mutation uses that request's validated Bearer or SSR-cookie user-context client. SQL requires `auth.uid()`, locks that exact `auth.users` row, derives administrator authority from immutable app metadata, and writes the actor plus database-time authorization attestation. Service-role mutation and caller-supplied actor, record, or render JSON are rejected.
2. The RPC inserts an immutable ownerless publication, advances the singleton change epoch once, marks the exact logical head pending, and inserts one ordered outbox event atomically.
3. The deterministic offline planner combines the exact P03 static manifest and records with the exact current public dynamic population. A reviewed plan is content-addressed and handed to its event through `record_site_content_sync_event_plan`.
4. The JWT-protected `site-content-sync` Edge Function first records one database-clock, five-minute admitted invocation, then claims one plan-ready event at a time, reclaims expired processing leases with a fresh token/generation, and heartbeats during provider work. Every heartbeat, stage, failure, and invocation terminal is fenced. It calls the embedding provider only for added or changed rows that cannot reuse a compatible vector. Missing, expired, unterminated, stale, or latest-failed invocation evidence makes readiness stop.
5. Staging writes every planned row, including unchanged carry-forward and retirement tombstones bound to their immutable retirement publications, into immutable release-scoped artifacts. The only accepted physical/provider dimension is 1536. SQL recomputes semantic fields, vector dimensions/identity, counts, provider-free checks, and dynamic/release digests; activation separately binds the complete current head population to the same immutable plan and exact content-addressed P05 recovery receipt.
6. All seven public registry GET routes read only `read_site_content_public_records`. The migration freezes the exact P03 dynamic seed population into the content-addressed epoch-zero release. Bundled TypeScript seeds are used only if the database has no retained active release identity; an epoch-zero rollback serves the frozen database rows even though the RAG lane remains uninitialized. After initialization, a missing, pending, or inconsistent record is omitted; no owner row or seed fallback is allowed.

## Source-only planning

The CLI reads no environment or live state and is a dry run unless `--write` is supplied:

```sh
node scripts/run-tsx.mjs scripts/sync-site-content-corpus.ts \
  --manifest <static-manifest.json> \
  --dynamic <exact-public-population.json> \
  --reconciliation <reviewed-plan.json> \
  --out <plan.json>
```

Initial adoption requires the exact content-addressed reconciliation file. It contains one trusted canonical-public snapshot per logical group and one disposition per locked source row, so duplicate owner rows share a logical id but retain unique source identities. Each group has exactly one `adopt`; every `identical_duplicate` must independently equal the trusted snapshot and every `retire` must independently differ. SQL re-derives every source record and governance hash when recording the plan and again at initial activation.

Initial adoption is deliberately ordered and must not be compressed into one privileged script:

1. Disable or hold the worker.
2. Generate and independently review the deterministic reconciliation plan offline.
3. Have an authenticated administrator POST the exact `{ "action": "record_reconciliation", "plan": ... }` command. The database derives the reviewer from `auth.uid()`; the CLI never accepts an actor or administrator token.
4. Publish every `adopt` disposition in deterministic plan order using the persisted plan digest.
5. Capture the final current `changeEpoch` and every pending event sequence.
6. Regenerate the exact final public population and event plan, attach that content-addressed plan to every pending event, and verify its counts and digest.
7. Enable the worker, claim and process all events, stage the candidate, and activate it.

The guarded source write path additionally requires `--write`, matching `--project-ref` and `--confirm-project-ref`, `--expected-state-digest`, `--expected-plan-digest`, `--recovery-evidence`, `--provider-authorization`, and `--event-sequence`. Initial-adoption plans require `--reconciliation`; only the guarded initial-adoption write also requires the matching `--expected-reconciliation-digest`. Post-adoption plans and writes require both reconciliation arguments to be absent so the reviewed plan retains its null reconciliation identity. The CLI performs all offline identity checks before loading project/provider/Supabase modules or writing `--out`, then records only the immutable plan/event handoff. Task 3 source verification does not exercise that live path. A retirement input must also carry the exact logical-id to retirement-publication mapping so the tombstone, event plan, stage, and activation bind the same immutable publication.

## Queue operations

- Due `pending`/`retry_pending` events and expired `processing` leases with an immutable recorded plan are claimable in event-sequence order. Each reclaim increments the generation and replaces the token, so an old ABA mutation remains a zero-row result.
- A newer publication terminally supersedes older pending/retry/processing/ready work and abandons its candidate release. A current head whose epoch is newer than the served release remains fail-closed whenever it still has a pending-event pointer, including after quarantine or supersession. It becomes readable only after a release representing that exact current head activates and clears the pointer.
- A collection read is all-or-nothing while any head is outstanding; it never exposes a partial clinical catalogue. A bounded unaffected detail may continue to use the retained release, while an affected detail is withheld even if its event pointer is missing.
- Failures use fixed codes only: `provider_failure`, `poison_payload`, or `staging_failure`. Content, actor/owner identity, vectors, and provider responses must never enter logs.
- Backoff uses database time and is bounded. The fifth failed claim is quarantined. The prior immutable release remains retained for rollback, but the affected stale bytes are not presented as current while the newer head is unrepresented.
- There is no scheduler in Task 3. Deploying/invoking the worker and configuring scheduler credentials/cadence are hosted follow-up gates.

## Offline freshness and readiness

CI and local source verification use only the committed, content-free evidence fixture:

```sh
node scripts/run-tsx.mjs scripts/check-site-content-freshness.ts --evidence tests/fixtures/site-content/release-evidence-current.json
```

The CLI validates exact population identity sets, immutable administrator attestation aggregates, supersession closure, governance, digests, queue ages, leases, and fresh successful invocation evidence. Its deployment SHA is provenance only; live currentness is bound solely by the server-only `SITE_CONTENT_EXPECTED_STATIC_MANIFEST_DIGEST`. It emits only fixed reasons and the capped public health projection. It reads no environment, Git, provider, network, or Supabase state in offline mode.

Authorized deep health and unauthenticated readiness run the service-only aggregate health RPC only after the ordinary Supabase probe succeeds. Shallow health remains database-free. A healthy exact retained bootstrap without an expected digest reports `disabled`; initialized `current` and valid `updating` are ready. Integrity, static mismatch, retry/quarantine, over-age work, lease, or worker failures return 503 without raw RPC evidence, actor/worker identities, epochs, full digests, routes, content, or provider errors.

## Activation and rollback

Callers must validate recovery evidence with P05 `assertRecoveryReadinessForOperation(..., "site_release", projectRef)` and parse the exact content-addressed activation or rollback receipt before the mutation RPC. SQL independently recomputes the receipt identity before insertion. The singleton stores `active_transition_receipt_id`; activation and rollback change that pointer atomically with the active release and decision watermark. Activation closes only matching ready events and retains the previous release and its rendered bytes.

Rollback accepts only the retained predecessor named by the exact currently pointed activation receipt. It is rejected while a candidate, live event, pending pointer, or head newer than the served watermark exists, and a rollback receipt cannot itself be rolled back. The canonical `change_epoch` is monotonic; rollback sets `served_change_epoch` to that current epoch, keeps completed events and heads untouched, and stores the rollback receipt pointer. A rollback to the retained epoch-zero release remains `initialized = true`: reads use its frozen database bytes, never bundled seeds, while health and RAG remain unavailable because the all-zero manifest is identity rather than deployment authority. A later publication advances the canonical epoch and becomes exact pending work; after it is staged, activation may move forward from the validated rollback transition. Rollback never reconstructs, re-embeds, copies mutable drafts, deletes the failed release, decrements the publication epoch, reopens events, or reuses a lease.

## Local verification and residual gates

`npm run drift:manifest` replays `supabase/schema.sql` in a worktree-owned scratch Docker container and regenerates the drift manifest. `npm run check:migration-role`, `npm run check:function-grants`, the focused Vitest selector, typecheck, and documentation inventory checks provide source evidence only.

Hosted/provider acceptance remains open until the exact-target migration is applied and replayed; grants, forced RLS, and default ACLs are inspected; current recovery/retained-release evidence exists; the JWT worker and scheduler are deployed; concurrent lease/retry/quarantine behavior is observed; changed-only embedding cost is canaried; activation and retained-previous rollback are drilled; and deployed public render parity is proven. Request snapshots, retrieval, and answer-quality acceptance belong to later tasks.
