# Launch operator runbook

**Single sequenced runbook for the operator-gated launch steps.** It ties together the detailed docs
(linked per step) into one ordered flow with exact commands and explicit approval gates. Nothing here
runs automatically — every **⏸ PAUSE** is a provider-touching action (Supabase / Railway / OpenAI /
GitHub) that needs your explicit go-ahead, per the AGENTS.md provider boundary.

**Current-state note (2026-07-14):** production app and worker deployment is already recorded as live.
Use this as a verification/release sequence, not evidence that staging, migrations, or first deployment
are still pending. Confirm current provider state before repeating any historical action.

Host note: production app + worker run on **Railway** (user directive 2026-07-12), not Fly. The image is
host-agnostic. Railway has no Sydney region (closest Singapore); data at rest stays in Supabase Sydney,
so this creates both a latency/SLO tradeoff and overseas processing that must be covered by the approved
privacy/processor record. Confirm answer-p95 in the staging soak (step 4).

Legend: **⏸ PAUSE** = provider action, needs your approval · **✅ verify** = check to run after.

---

## Order at a glance

```text
0. Pre-flight identity check
1. Confirm completed migrations; apply only any explicitly unresolved control [Supabase]
2. Run the full release gate before the next release                     [live keys]
3. Provision staging + seed, only if still absent                         [Supabase + Railway]
4. Staging soak + rollback rehearsal                                      [Railway]
5. Production deploy                                                       [Railway]
6. Post-deploy: worker, registry seed, auth conn cap, observability wiring
```

---

## 0. Pre-flight (read-only)

```bash
npm run check:supabase-project     # must report Clinical KB Database / sjrfecxgysukkwxsowpy
npx supabase migration list --linked
npm run reindex:health             # note jobs_pending / jobs_processing (needed for step 1 R17)
```

## 1. Confirm migration state; apply only unresolved controls 🧑 Supabase

The July-8 ingestion/tenancy batch and the retrieval drift-codification work are recorded as applied and
verified on 2026-07-13. Their detailed procedures remain for staging/disaster recovery; do **not** reapply
them merely because they appear below. First compare linked migration history and verify the remaining
PIA-4 retention migrations. **Do not redeploy the worker until `20260708130000` is confirmed live.**

| Group | Migration/control                                                                                | Recorded status                                     | Operator action                                                                                            |
| ----- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| a–f   | July-8 ingestion/tenancy batch in [operator-apply-july8-batch.md](operator-apply-july8-batch.md) | **Verified live 2026-07-13**                        | Verify only; redeploy the worker if that recorded remaining action is still open.                          |
| g     | `20260708120000_rag_query_misses_retention`                                                      | **Applied and verified live 2026-07-14**            | Job 13 is active with the 90-day retention window.                                                         |
| h     | `20260713201542_consolidate_rag_response_cache_retention`                                        | **Applied and verified live 2026-07-14**            | Job 16 is active and bounded; obsolete duplicate job confirmed absent.                                     |
| i     | Retrieval RPC forward-codification (`20260713062107`…`20260713062139`)                           | **Applied and drift/readiness verified 2026-07-13** | Verify only; see [forward-codify-retrieval-rpcs-workorder.md](forward-codify-retrieval-rpcs-workorder.md). |

**⏸ PAUSE:** if and only if linked history shows migration `20260708120000` or `20260713201542` absent,
apply the reviewed committed migration through the normal guarded workflow. Do not use this status
reconciliation as authority to replay the verified July-8 or forward-codification groups.

After applying, query `cron.job` and expect exactly these active retention jobs: `purge-rag-query-misses`
at `45 3 * * *` and `purge-rag-response-cache` at `15 * * * *`. The obsolete
`purge-expired-rag-response-cache` name must be absent.

**✅ verify:**

```bash
SUPABASE_ENVIRONMENT=production npm run check:july8-live-batch
npm run check:drift
npm run check:indexing              # search_schema_health() ok
npm run eval:retrieval:quality      # must stay 36/36 (retrieval-affecting: step d + drift-codify)
```

### 1b. Drift-codify status (task 1.2) — complete

The reviewed forward-codify migrations were applied on 2026-07-13 after scratch replay and fingerprint
validation. `check:drift` passed and production readiness reported READY. The authoritative evidence and
historical replay procedure are in
[forward-codify-retrieval-rpcs-workorder.md](forward-codify-retrieval-rpcs-workorder.md). No further apply
is pending unless a new drift check identifies a new, separately reviewed difference.

## 2. Full release gate 🧑 live keys

Run before the next release when provider-backed verification is explicitly approved.

**⏸ PAUSE** (bounded OpenAI spend):

```bash
npm run verify:release              # full Playwright matrix + check:production-readiness
                                    # + governance:release + eval:quality:release
npm run eval:retrieval:quality      # 36/36
npm run eval:quality -- --rag-only  # grounded-supported must not drop; citation-failure 0
```

Record outcomes in release notes / [process-hardening.md](process-hardening.md).

## 3. Provision staging + seed 🧑 Supabase + Railway (billable)

Detailed: [staging-setup.md](staging-setup.md). No code change — the identity guard activates on env.

1. **⏸ PAUSE** create Supabase project `Clinical KB Staging`, same org, **ap-southeast-2**, generate DB
   password (Supabase MCP `create_project` after `confirm_cost`, or dashboard). Record `<staging-ref>`.
2. `supabase link --project-ref <staging-ref>` → `supabase db push` → `npm run check:indexing`.
3. Seed synthetic (~50 docs, **never** production clinical docs):
   ```bash
   npm run samples && npm run import:docs
   npm run registry:seed -- --owner-id <owner> --write --confirm
   npm run differentials:seed && npm run medications:seed
   ```
4. Capture staging keys (`sb_publishable_…`, `sb_secret_…`).

## 4. Staging soak + rollback rehearsal 🧑 Railway

1. Build image (real staging publishable key inlines into the client bundle):
   ```bash
   docker build --build-arg NEXT_PUBLIC_SUPABASE_URL=https://<staging-ref>.supabase.co \
     --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<staging sb_publishable_…> \
     -t clinical-kb-app:staging .
   ```
   (Local Docker can OOM on the 8 GiB Next heap — prefer the CI image-build workflow if it wedges.)
2. **⏸ PAUSE** deploy to Railway staging + set runtime secrets (staging values, distinct from prod):
   `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `SUPABASE_PROJECT_REF=<staging-ref>`,
   `SUPABASE_PROJECT_NAME=Clinical KB Staging`, `SUPABASE_STAGING_PROJECT_REF=<staging-ref>`,
   `SUPABASE_STAGING_PROJECT_NAME=Clinical KB Staging`, `RAG_QUERY_HASH_SECRET` (staging),
   `RAG_PROVIDER_MODE=auto`. Keep one warm instance (no scale-to-zero); Railway
   health `/api/health/ready` (manual smoke: `GET /api/health`).
3. **✅ verify** boot + soak (soak is hard-guarded against production):
   ```bash
   npx tsx scripts/soak-test.ts --target https://<staging-host> --confirm-staging \
     --users 30 --duration-s 600 --ramp-s 120
   ```
   Targets ([capacity-review.md](capacity-review.md) §4): search p95 ≤ 3 s, **answer p95 ≤ 25 s**
   (watch this given the Railway↔Sydney hop), non-429 error rate < 1 %.
4. Rehearse rollback = redeploy the previous Railway image tag; confirm health returns.

## 5. Production deploy 🧑 Railway

Decision record: [deployment-architecture.md](deployment-architecture.md) §2. Same image contract, prod
build-args + secrets.

**⏸ PAUSE:** authorize the Railway account/service, build with the **production** publishable key, set
runtime secrets (**incl. `RAG_QUERY_HASH_SECRET`** — PIA-2 fail-closed guard requires it at boot;
`SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `SUPABASE_PROJECT_REF/NAME` for prod). One warm instance,
no scale-to-zero, Railway health `/api/health/ready`. I'll prep the Railway service config via the `use-railway` skill.

**✅ verify:** `GET /api/health/ready` (and manual `GET /api/health` → `{"status":"ok"}`); `npm run check:deployment-readiness`.

## 6. Post-deploy

- **Worker** 🧑 — build `Dockerfile.worker`, run **one** always-on instance in the same region with prod
  secrets. **Only after migration `20260708130000` is live.** Confirms via `npm run reindex:health`.
  Full build/run/verify recipe + the required env and secrets:
  [worker-deploy-runbook.md](worker-deploy-runbook.md).
- **Registry seed (prod)** 🧑 — `npm run registry:seed -- --owner-id <prod-owner-uuid> --write --confirm`
  (+ `differentials:seed` for the slug-retitle prune). Until seeded, Services/Forms show empty.
- **Auth connection cap** 🧑 — before the first vertical scale-up, switch Supabase auth from the 10-absolute
  cap to **percentage-based** allocation in the dashboard ([capacity-review.md](capacity-review.md) §3).
  Not settable via SQL/MCP.
- **Observability wiring** 🧑 — once host metrics exist, wire the warn/page SLO thresholds
  ([observability-slos.md](observability-slos.md) §2) into a real alert channel; confirm the nightly eval
  canary is green from `main` (one `workflow_dispatch` run).

---

## Standing guardrails

- Never raw-SQL against live — committed migration + `schema.sql` reconciliation only.
- Never redeploy a worker image that expects the hardened completion RPC until `20260708130000` is confirmed live.
- Any retrieval/ranking change re-runs `eval:retrieval:quality` 36/36 before it ships.
- Each environment gets separate service-role + OpenAI keys (per-env blast radius).
