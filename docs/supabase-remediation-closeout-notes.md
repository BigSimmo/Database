# Clinical KB — Supabase remediation closeout notes

Short deferred list after Codex PRs. **No DDL in this note.** Owned by Documentation (not Issues).

**Projects:** prod `sjrfecxgysukkwxsowpy` · staging `ikoiolksxqxfxgiyqpnu`

## 1. File / defer (after Codex)

| #   | Item                                                      | When / notes                                                                                        |
| --- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | Confirm ingestion-worker fully gone                       | **PR1.** Cron already absent; still have Vault leftovers `cron_ingestion_jwt` / `cron_ingestion_jw` |
| 2   | `indexing-v3-agent` JWT/secret dual-gate                  | After **PR2/PR3.** Cron invokes every minute; Vault `indexing_v3_agent_secret`                      |
| 3   | `FORCE RLS` on six `force_rls=false` control-plane tables | Later — see §2 list                                                                                 |
| 4   | FK indexes / unused indexes                               | Only with evidence; do not batch-drop                                                               |
| 5   | `PROXY_AUTH` dedicated secret                             | Quiet change window only                                                                            |

## 2. Intentional RLS-on / no-policy (prod, fail-closed)

**16** prod `public` tables keep **RLS enabled with no policies** on purpose: **service_role fail-closed** (anon/authenticated get nothing). Do not treat these as defects.

**Staging:** no RLS-no-policy tables.

### `force_rls=false` (6) — later FORCE RLS candidates (§1.3)

- `clinical_quality_feedback_triage`
- `clinical_quality_feedback_triage_events`
- `document_corpus_access_snapshots`
- `document_corpus_access_state`
- `public_source_activation_guards`
- `public_source_cleanup_mutation_guards`

### `force_rls=true` (10)

- `site_content_public_records`
- `site_content_publications`
- `site_content_reconciliation_plans`
- `site_content_release_receipts`
- `site_content_release_records`
- `site_content_releases`
- `site_content_sync_event_plans`
- `site_content_sync_events`
- `site_content_sync_state`
- `site_content_sync_worker_invocations`

## 3. Staging / prod apply status (operator)

- **Prod (`sjrfecxgysukkwxsowpy`): DONE.** Both migrations applied — `revoke_site_content_definer_execute` `20260921065646` and `audit_logs_append_only` `20260921065653`. Prod security WARNs cleared.
- **Staging:** earlier applied `audit_logs_append_only` only; site-content revoke was not testable there (functions absent).
- **Staging Auth:** leaked-password WARN remains until Joshua toggles Auth dashboard.

## 4. Railway env inventory (names only)

Names-only check — **no values recorded.**

| Present by name             | Where                              |
| --------------------------- | ---------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY` | Prod app, prod worker, staging app |

| Not present on Railway by name            | Where it lives instead           |
| ----------------------------------------- | -------------------------------- |
| `INDEXING_V3_AGENT_SECRET`                | Vault `indexing_v3_agent_secret` |
| Cron JWT (`cron_ingestion_jwt` / related) | Vault `cron_ingestion_jwt`       |
| `PROXY_AUTH` / signing secret             | Not on Railway by name           |

## 5. Out of scope here

- No schema/DDL from this closeout file.
- Auth dashboard CAPTCHA/signup vs [`multi-user-auth-setup.md`](multi-user-auth-setup.md) stays operator-owned when Phase 1 Auth finishes.

_Updated 2026-09-21 — Railway names-only inventory appended; Documentation owns._
