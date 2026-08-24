# Site-content publication and synchronization

This runbook owns the source-only Task 3 control plane for public registry site content. Legacy rows in `clinical_registry_records`, `medication_records`, and `differential_records` remain owner-scoped drafts and provenance. They are never public read authority merely because they exist.

## Public lifecycle

1. An administrator POSTs a bounded command to `/api/site-content/publications`. The server derives the actor and performs a P03 preflight, while the granted mutation RPC locks the selected legacy row and independently derives its canonical record and projection-specific allowlisted render bytes. Caller-supplied record/render JSON is never accepted.
2. The RPC inserts an immutable ownerless publication, advances the singleton change epoch once, marks the exact logical head pending, and inserts one ordered outbox event atomically.
3. The deterministic offline planner combines the exact P03 static manifest and records with the exact current public dynamic population. A reviewed plan is content-addressed and handed to its event through `record_site_content_sync_event_plan`.
4. The JWT-protected `site-content-sync` Edge Function claims one plan-ready event at a time, reclaims expired processing leases with a fresh token/generation, and heartbeats during provider work. Every heartbeat, stage, or failure is fenced by event id, worker id, lease token, lease generation, and database-clock expiry. It calls the embedding provider only for added or changed rows that cannot reuse a compatible vector.
5. Staging writes every planned row, including unchanged carry-forward and retirement tombstones bound to their immutable retirement publications, into immutable release-scoped artifacts. The only accepted physical/provider dimension is 1536. SQL recomputes semantic fields, vector dimensions/identity, counts, provider-free checks, and dynamic/release digests; activation separately binds the complete current head population to the same immutable plan and exact content-addressed P05 recovery receipt.
6. All seven public registry GET routes read only `read_site_content_public_records`. Before initial activation only, bundled seeds remain available. After initialization, a missing, pending, or inconsistent record is omitted; no owner row or seed fallback is allowed.

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

The guarded source write path additionally requires `--write`, matching `--project-ref` and `--confirm-project-ref`, `--expected-state-digest`, `--expected-plan-digest`, `--expected-reconciliation-digest`, `--recovery-evidence`, `--provider-authorization`, and `--event-sequence`. It performs all offline identity checks before loading project/provider/Supabase modules or writing `--out`, then records only the immutable plan/event handoff. Task 3 source verification does not exercise that live path. A retirement input must also carry the exact logical-id to retirement-publication mapping so the tombstone, event plan, stage, and activation bind the same immutable publication.

## Queue operations

- Due `pending`/`retry_pending` events and expired `processing` leases with an immutable recorded plan are claimable in event-sequence order. Each reclaim increments the generation and replaces the token, so an old ABA mutation remains a zero-row result.
- A newer publication terminally supersedes older pending/retry/processing/ready work and abandons its candidate release. A current head whose epoch is newer than the served release remains fail-closed whenever it still has a pending-event pointer, including after quarantine or supersession. It becomes readable only after a release representing that exact current head activates and clears the pointer.
- Failures use fixed codes only: `provider_failure`, `poison_payload`, or `staging_failure`. Content, actor/owner identity, vectors, and provider responses must never enter logs.
- Backoff uses database time and is bounded. The fifth failed claim is quarantined. The prior immutable release remains retained for rollback, but the affected stale bytes are not presented as current while the newer head is unrepresented.
- There is no scheduler in Task 3. Deploying/invoking the worker and configuring scheduler credentials/cadence are hosted follow-up gates.

## Activation and rollback

Callers must validate recovery evidence with P05 `assertRecoveryReadinessForOperation(..., "site_release", projectRef)` and parse the exact content-addressed activation or rollback receipt before the mutation RPC. SQL independently recomputes the receipt identity before insertion. Activation closes only matching ready events and retains the previous release and its rendered bytes. Rollback accepts only that retained previous release named by the activation receipt and atomically switches the active pointer; it validates and records the newly current recovery-evidence digest rather than requiring it to equal the historical activation digest. Public reads come from release-scoped records even when the mutable head is newer. Rollback never reconstructs, re-embeds, copies mutable drafts, deletes the failed release, decrements the publication epoch, or reuses a lease.

## Local verification and residual gates

`npm run drift:manifest` replays `supabase/schema.sql` in a worktree-owned scratch Docker container and regenerates the drift manifest. `npm run check:migration-role`, `npm run check:function-grants`, the focused Vitest selector, typecheck, and documentation inventory checks provide source evidence only.

Hosted/provider acceptance remains open until the exact-target migration is applied and replayed; grants, forced RLS, and default ACLs are inspected; current recovery/retained-release evidence exists; the JWT worker and scheduler are deployed; concurrent lease/retry/quarantine behavior is observed; changed-only embedding cost is canaried; activation and retained-previous rollback are drilled; and deployed public render parity is proven. Request snapshots, retrieval, and answer-quality acceptance belong to later tasks.
