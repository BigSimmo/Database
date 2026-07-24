# Operator runbook index

This file preserves provider-action detail and runbook links. It is **not** an independent task queue:
[`outstanding-issues.md`](outstanding-issues.md) is the repository's single universal ledger, and an
operator row is executable only while a corresponding recommended row exists there. Status here is
supporting evidence that must be reconciled with that ledger and verified live before action.

**How to use:** follow the universal ledger order, then use the matching row here for provider detail.
`Status` values are
`⏳ pending`, `🔎 verify` (may already be done — confirm before repeating), `✅ done`, `—` (n/a).
Update the row (and its runbook) when an action lands. The sequenced flow with exact commands and
approval gates is [launch-operator-runbook.md](launch-operator-runbook.md); this table is the index.
Code + ops remediation waves from the 2026-07-14 multi-skill audit live in
[audit-remediation-plan-2026-07-14.md](audit-remediation-plan-2026-07-14.md).
Findings inventory for handover: [audit-handover-2026-07-14.md](audit-handover-2026-07-14.md).

> Status is historical/runbook evidence and **must be confirmed against live state** before acting.
> A pending row absent from the recommended universal queue is not authorization or recommended work.

## Launch-gating actions

| Action                                                                     | Status     | Blocked by           | Verify command                                                                                              | Runbook                                                                                                                                                                         |
| -------------------------------------------------------------------------- | ---------- | -------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Apply July-8 migration batch (a–g) to live                                 | ✅ done    | —                    | `SUPABASE_ENVIRONMENT=production npm run check:july8-live-batch` (2026-07-13: 6 live, apply=no-op)          | [operator-apply-july8-batch.md](operator-apply-july8-batch.md)                                                                                                                  |
| Apply drift-codify forward migration (step 1h)                             | ✅ done    | —                    | Applied and drift/readiness verified 2026-07-13; verify only unless new reviewed drift is found             | [database-drift-detection.md](database-drift-detection.md)                                                                                                                      |
| Apply repo-ahead migrations to live (post-2026-07-13)                      | ✅ done    | —                    | Zero unsafe title-word rows; `npm run check:drift`; then `eval:retrieval:quality` (36/36) for the corrector | [deploy-corrector-public-titles.md](deploy-corrector-public-titles.md) · [operator-apply-performance-latency-remediation.md](operator-apply-performance-latency-remediation.md) |
| Full release gate (bounded OpenAI spend)                                   | ⏳ pending | migrations 1 applied | `npm run verify:release`; `npm run eval:quality -- --rag-only`                                              | [launch-operator-runbook.md §2](launch-operator-runbook.md)                                                                                                                     |
| Provision staging Supabase project (`Clinical KB Staging`, ap-southeast-2) | ✅ done    | —                    | Archived run `29795051547` proves the dedicated staging tenancy harness and cleanup; do not reprovision     | [staging-setup.md](staging-setup.md) · [archived evidence](archive/staging-tenancy-evidence-29795051547/staging-tenancy-evidence.json)                                          |
| Staging soak + rollback rehearsal on Railway                               | ⏳ pending | staging provisioned  | `scripts/soak-test.ts --confirm-staging` (answer p95 ≤ 25 s)                                                | [launch-operator-runbook.md §4](launch-operator-runbook.md) · [capacity-review.md](capacity-review.md)                                                                          |
| Production deploy to Railway                                               | ✅ done    | —                    | App deployment recorded live 2026-07-14; re-verify with `GET /api/health` and deployment readiness          | [deployment-architecture.md](deployment-architecture.md)                                                                                                                        |

## Post-deploy actions

| Action                                                                | Status     | Blocked by                     | Verify command                                                                      | Runbook                                                                                                     |
| --------------------------------------------------------------------- | ---------- | ------------------------------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Redeploy worker (one always-on instance)                              | ✅ done    | —                              | Worker deployment recorded live 2026-07-14; re-verify with `npm run reindex:health` | [worker-deploy-runbook.md](worker-deploy-runbook.md)                                                        |
| Seed registry / differentials / medications (prod)                    | ⏳ pending | prod deploy                    | Services/Forms surfaces non-empty                                                   | [launch-operator-runbook.md §6](launch-operator-runbook.md)                                                 |
| Switch auth connection cap 10-absolute → percentage-based (dashboard) | ⏳ pending | before first vertical scale-up | dashboard — not SQL/MCP settable                                                    | [auth-connection-cap-runbook.md](auth-connection-cap-runbook.md) · [capacity-review.md](capacity-review.md) |
| Wire SLO warn/page thresholds into a real alert channel               | ⏳ pending | host metrics exist             | nightly eval canary green from `main` (one `workflow_dispatch`)                     | [observability-slos.md](observability-slos.md)                                                              |

## Standing secret / config placement (per environment)

Each environment gets **separate** service-role + OpenAI keys (per-env blast radius). Placement is a
dashboard/CLI action, never committed.

| Secret / config                            | Status     | Where                                | Notes                                                                                                                                                                                                             |
| ------------------------------------------ | ---------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RAG_QUERY_HASH_SECRET` (prod)             | 🔎 verify  | Railway runtime secret               | GitHub repo secret present since 2026-07-10 (CI green); confirm the SAME value is set in Railway runtime. PIA-2 fail-closed guard requires it at boot (min 16 chars)                                              |
| `HEALTH_DEEP_PROBE_SECRET` (prod + GitHub) | ⚠️ partial | Railway runtime + GitHub repo secret | Railway production was set and the authorized deep probe returned healthy on 2026-07-19. GitHub remains pending: set the same value as a repo secret, set `PROD_HEALTH_URL`, then enable the ops-digest schedule. |
| `SUPABASE_SERVICE_ROLE_KEY` (per env)      | ⏳ pending | Railway runtime secret               | accepts the `sb_secret_…` key                                                                                                                                                                                     |
| `OPENAI_API_KEY` (per env)                 | ⏳ pending | Railway runtime secret               | `RAG_PROVIDER_MODE=auto`                                                                                                                                                                                          |
| OpenAI DPA / ZDR execution                 | ⏳ pending | OpenAI account + legal               | app endpoints are ZDR-eligible; execution is operator + legal — see [openai-cross-border-basis.md](openai-cross-border-basis.md)                                                                                  |

## Disaster-recovery re-creation (does NOT survive a schema restore)

Per [disaster-recovery-runbook.md](disaster-recovery-runbook.md) — config & secrets are the layer a schema
restore does not bring back:

| Action                                                                                                             | Status     | Notes                            |
| ------------------------------------------------------------------------------------------------------------------ | ---------- | -------------------------------- |
| Re-create pg_cron schedules                                                                                        | ⏳ pending | e.g. ingestion / retention crons |
| Re-add Vault secrets (`cron_ingestion_jwt`)                                                                        | ⏳ pending | —                                |
| Re-set custom GUCs                                                                                                 | ⏳ pending | —                                |
| Redeploy edge functions                                                                                            | ⏳ pending | needs Deno v2.x                  |
| Re-enter dashboard config (auth providers/SSO redirect URLs, connection-pool caps, per-project keys, `E2E_USER_*`) | ⏳ pending | —                                |
