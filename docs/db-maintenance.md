# Database maintenance notes (Supabase `Clinical KB Database`)

Live project `sjrfecxgysukkwxsowpy`. This file records advisor snapshots and the standing
disposition for each finding class, so routine advisor output does not get re-triaged from
scratch (or "fixed" against design intent). All live mutations remain confirmation-required
(`AGENTS.md` — API and provider confirmation boundary).

## Advisor snapshot — 2026-07-20 (read-only, user-authorized)

### Security: 1 INFO — by design, do not fix

- `rls_enabled_no_policy` on `public.document_title_words`: **deliberate fail-closed
  pattern** — RLS enabled, zero policies, all client roles revoked, service-role-only grants
  (`supabase/schema.sql`, the `enable row level security` block for this table; a schema
  comment was deliberately skipped to avoid drift-manifest churn — this entry is the record).
  Adding policies would be a regression. Expected to reappear in every future advisor run.

Everything else clean: no RLS-disabled tables, no exposed SECURITY DEFINER functions (the
`check:function-grants` guard enforces this offline on every PR), no auth misconfigurations
beyond the note below.

### Performance: ~33 INFO "unused index" + 1 Auth note — TRIAGE LIST, not a delete list

`unused_index` findings need interpretation before any action, and several are protected:

| Class                                                | Examples                                                                                                                                                                         | Disposition                                                                                                                                                                                                                                       |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Retrieval-surface indexes**                        | `document_chunks_content_trgm_idx`, `documents_title_trgm_idx`, `document_labels_label_trgm_idx`, `document_summaries_summary_trgm_idx`, `document_index_units_heading_path_idx` | **RAG-protected — do not drop without the full protocol** (`docs/rag-behaviour/safeguards.md`). "Unused" can mean the planner satisfies fast-path queries another way today; dropping changes the retrieval search space and needs a canary pair. |
| **Owner-scoped indexes on the single-tenant corpus** | `*_owner_id_idx`, `*_owner_*_idx` on registry/audit/eval/summary tables                                                                                                          | Live corpus is all-public (`owner_id` NULL), so owner-scoped paths never execute — but the multi-tenant design intends them. Keep unless multi-tenancy is formally abandoned.                                                                     |
| **Operational/rare-path indexes**                    | rate-limit buckets, cleanup jobs, ingestion stages, `rag_query_misses_aliases_idx`, feedback/approval tables                                                                     | Genuinely droppable candidates, but the benefit is negligible at this corpus size (write amplification on low-write tables). Revisit only if write latency or storage becomes a measured problem.                                                 |

Standing rule: unused-index removal is a considered maintenance task with its own migration +
replay + (for retrieval tables) canary pair — never a bulk advisor-driven sweep.

- `auth_db_connections_absolute`: Auth server pinned at 10 connections instead of a
  percentage strategy. Only matters when resizing the instance; auth load here is tiny
  (magic-link/OAuth only). Revisit at the next instance-size change (dashboard config —
  confirmation-required).

## Telemetry retention — open decision (2026-07-20)

`rag_queries` / `rag_retrieval_logs` telemetry grows with live and eval traffic.
`npm run purge:query-logs` exists (owner-scoped, `--older-than-days`, `--dry-run`,
fails loudly on unknown flags) but is **scheduled nowhere** — retention is currently manual
and unbounded. Wiring a schedule is deliberately NOT done unilaterally because it is a
recurring live-deletion job needing an explicit policy: which owner scope, what retention
window (script default 90 days), and where it runs (a small weekly workflow with the
service-role secret is the natural home). Decision recorded here when made.

## Cross-references

- Weekly eval canary + liveness probe: `docs/observability-slos.md` §3 (the `static-pr` job
  warns when the last completed canary is > 8 days old — added after GitHub silently dropped
  the 2026-07-20 scheduled fire).
- RAG-protected surfaces and change protocol: `docs/rag-behaviour/safeguards.md`.
- Hybrid RPC health: `search_schema_health()` execution smoke + `npm run check:indexing`.
