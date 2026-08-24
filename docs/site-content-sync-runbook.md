# Site-content publication and synchronization

This runbook owns the source-only Task 3 control plane for public registry site content. Legacy rows in `clinical_registry_records`, `medication_records`, and `differential_records` remain owner-scoped drafts and provenance. They are never public read authority merely because they exist.

## Public lifecycle

1. An administrator POSTs a bounded command to `/api/site-content/publications`. The server derives the actor, normalizes and locks the selected legacy row, and invokes one publication RPC.
2. The RPC inserts an immutable ownerless publication, advances the singleton change epoch once, marks the exact logical head pending, and inserts one ordered outbox event atomically.
3. The deterministic offline planner combines the exact P03 static manifest and records with the exact current public dynamic population. A reviewed plan is content-addressed and handed to its event through `record_site_content_sync_event_plan`.
4. The JWT-protected `site-content-sync` Edge Function claims only plan-ready events. Every heartbeat, stage, or failure is fenced by event id, worker id, lease token, lease generation, and database-clock expiry. It calls the embedding provider only for added or changed rows that cannot reuse a compatible vector.
5. Staging creates immutable release-scoped artifacts. Activation is a separate atomic RPC that requires the expected epoch/digest, complete population, provider-free must-pass checks, and exact current P05 recovery evidence and activation receipt.
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

Initial adoption requires the reconciliation file. A write request also requires the exact project reference, expected state digest, and current recovery-evidence file. Task 3 deliberately refuses to execute that provider/target-backed path.

## Queue operations

- `pending` and `retry_pending` events with an immutable recorded plan are claimable in event-sequence order.
- A claim increments `attempt_count` and `lease_generation` and issues a new token. Stale or ABA leases change no event or release state.
- Failures use fixed codes only: `provider_failure`, `poison_payload`, or `staging_failure`. Content, actor/owner identity, vectors, and provider responses must never enter logs.
- Backoff uses database time and is bounded. The fifth failed claim is quarantined. Quarantine leaves the exact public head pending and therefore unavailable; it never restores the previous RAG projection.
- There is no scheduler in Task 3. Deploying/invoking the worker and configuring scheduler credentials/cadence are hosted follow-up gates.

## Activation and rollback

Callers must validate recovery evidence with P05 `assertRecoveryReadinessForOperation(..., "site_release", projectRef)` and parse the exact content-addressed activation or rollback receipt before the mutation RPC. Activation closes only matching ready events and retains the previous release. Rollback accepts only that retained previous release named by the activation receipt; it never reconstructs, re-embeds, copies mutable drafts, deletes the failed release, decrements the epoch, or reuses a lease.

## Local verification and residual gates

`npm run drift:manifest` replays `supabase/schema.sql` in a worktree-owned scratch Docker container and regenerates the drift manifest. `npm run check:migration-role`, `npm run check:function-grants`, the focused Vitest selector, typecheck, and documentation inventory checks provide source evidence only.

Hosted/provider acceptance remains open until the exact-target migration is applied and replayed; grants, forced RLS, and default ACLs are inspected; current recovery/retained-release evidence exists; the JWT worker and scheduler are deployed; concurrent lease/retry/quarantine behavior is observed; changed-only embedding cost is canaried; activation and retained-previous rollback are drilled; and deployed public render parity is proven. Request snapshots, retrieval, and answer-quality acceptance belong to later tasks.
