# Launch operator runbook

**Single sequenced runbook for the operator-gated launch steps.** It ties together the detailed docs
(linked per step) into one ordered flow with exact commands and explicit approval gates. Nothing here
runs automatically — every **⏸ PAUSE** is a provider-touching action (Supabase / Railway / OpenAI /
GitHub) that needs your explicit go-ahead, per the AGENTS.md provider boundary.

Host note: production app + worker run on **Railway** (user directive 2026-07-12), not Fly. The image is
host-agnostic. Railway has no Sydney region (closest Singapore); data at rest stays in Supabase Sydney,
so this is a latency/SLO tradeoff only — confirm answer-p95 in the staging soak (step 4).

Legend: **⏸ PAUSE** = provider action, needs your approval · **✅ verify** = check to run after.

---

## Order at a glance

```text
0. Pre-flight identity check
1. Apply pending live migrations  (July-8 batch + PIA-4 + drift-codify)   [Supabase]
2. Run the full release gate                                              [live keys]
3. Provision staging + seed                                               [Supabase + Railway]
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

## 1. Apply pending live migrations 🧑 Supabase

Detailed runbook: [operator-apply-july8-batch.md](operator-apply-july8-batch.md). Apply **in this order**
when the ingestion queue is quiet. **Do not redeploy the worker until step `20260708130000` is live.**

| #   | Migration                                             | Note                                        |
| --- | ----------------------------------------------------- | ------------------------------------------- |
| a   | `20260708140000_drop_ingestion_job_stages_job_id_fk`  | no-op on live                               |
| b   | `20260708130000_ingestion_concurrency_rpc_hardening`  | **worker-redeploy blocker**                 |
| c   | `20260708150000_ensure_retrieval_owner_matches`       | helper before fail-closed                   |
| d   | `20260708160001_retrieval_owner_matches_fail_closed`  | tenancy fail-closed (#409)                  |
| e   | `20260708310000_r5_document_metadata_merge`           | R5 deep-merge (#408)                        |
| f   | `20260708170000_ingestion_jobs_one_open_per_document` | R17 — approved manual `CONCURRENTLY` path   |
| g   | `20260708120000_rag_query_misses_retention`           | **PIA-4** purge cron                        |
| h   | `<drift-codify-forward>`                              | **only after task 1.2 lands** — see step 1b |

**⏸ PAUSE:** apply via `supabase db push` (queue quiet) or the R17 manual `CREATE UNIQUE INDEX CONCURRENTLY`
path in the July-8 doc. R17 manual path is an approved exception to the live-change guardrail; record
the migration history entry and reconcile schema.sql after manual execution to prevent untracked drift.
R17 uses its own version so history/repair can't collide with `20260708160001`.

**✅ verify:**

```bash
SUPABASE_ENVIRONMENT=production npm run check:july8-live-batch
npm run check:drift
npm run check:indexing              # search_schema_health() ok
npm run eval:retrieval:quality      # must stay 36/36 (retrieval-affecting: step d + drift-codify)
```

### 1b. Drift-codify apply (task 1.2)

The forward-codify migration (live-diverged `match_document_chunks` `hnsw.ef_search=100` wrapper + `*_text`
multi-strategy bodies) is authored + validated with normalized fingerprint comparison vs a Docker replay
before it reaches you, so its apply is an **idempotent no-op on live**. **This step is blocked until the
migration artifact is committed and execution-time live fingerprint recapture is completed.** Before
applying, recapture live fingerprints using the exact committed capture query and compare normalized md5s
against the committed table. Abort on mismatch. Apply as step 1h only after verification, then re-run
`check:drift` + `eval:retrieval:quality` (36/36). Background:
[database-drift-detection.md](database-drift-detection.md).

## 2. Full release gate 🧑 live keys

Clears the accumulated verification debt (universal search, cross-mode links, rag.ts decomp).

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
   `RAG_PROVIDER_MODE=auto`. Keep one warm instance (no scale-to-zero); health `/api/health`.
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
no scale-to-zero, health `/api/health`. I'll prep the Railway service config via the `use-railway` skill.

**✅ verify:** `GET /api/health` → `{"status":"ok"}`; `npm run check:deployment-readiness`.

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
- Worker redeploy is blocked until `20260708130000` is live.
- Any retrieval/ranking change re-runs `eval:retrieval:quality` 36/36 before it ships.
- Each environment gets separate service-role + OpenAI keys (per-env blast radius).
