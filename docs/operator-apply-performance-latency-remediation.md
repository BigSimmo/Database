# Operator apply — performance and latency remediation

This worktree does not apply migrations. Production rollout remains a separate,
explicitly authorized operation after local replay, review, and backups.

The migration chain orders
`20260717170000_registry_projection_cleanup.sql` immediately before
`20260717171000_public_title_corrector.sql`. Apply them through the normal linked
migration workflow; do not mark either migration applied manually or skip the cleanup
migration to reach the corrector.

The corrector has a separate stale-title-word rollout blocker caused by the earlier
`20260714180000` migration. Clear the invariant in
[deploy-corrector-public-titles.md](deploy-corrector-public-titles.md) before applying
or enabling `20260717171000`.

## Registry projection index on a busy database

`20260717170000_registry_projection_cleanup.sql` creates
`documents_registry_projection_lookup_idx` transactionally so clean local
replay remains deterministic. On a busy production database, pre-create the
exact index outside a transaction:

```sql
create index concurrently if not exists documents_registry_projection_lookup_idx
  on public.documents (
    (metadata->>'registry_record_kind'),
    (metadata->>'registry_record_id')
  )
  where metadata->>'source_kind' = 'registry_record';
```

After the index is valid and ready, the migration's `create index if not
exists` is a no-op. Do not mark the migration applied merely because the index
exists: the cleanup function, hardened privileges, and three lifecycle triggers
must still be installed through the normal authorized migration rollout.

## Bare-column trigram and status/id composite on `documents` (latency audit 2026-07-28)

Authored 2026-07-29 for findings L2-3 and L2-5 in
[audit/latency-audit-2026-07-28.md](audit/latency-audit-2026-07-28.md). Tracked as ledger `#102`.
**No migration file exists for these**, deliberately — see the ordering constraint below.

`documents_title_trgm_idx` (`supabase/schema.sql:687`) indexes the concatenated expression
`lower(coalesce(title, '') || ' ' || coalesce(file_name, ''))`, so it can only serve a predicate
written against that same expression. Two live call sites instead filter the bare columns:

- `src/app/api/documents/route.ts:193` — `title.ilike.%q%,file_name.ilike.%q%`
- `src/lib/rag/rag-candidate-sources.ts:477` — same shape, on the RAG retrieval path

Neither can use the expression index, so both fall back to scanning `documents`. Separately,
`src/lib/search-scope.ts:271-277` pages `.eq("status","indexed").order("id")` to 5,000 rows
against the single-column `documents_status_idx` (`schema.sql:678`), so each page sorts.

**CORRECTED 2026-07-29 — do not treat all three as semantics-neutral.** An earlier version of
this section claimed all three are "additive and semantics-neutral … retrieval recall is
byte-identical", and used that to keep them out of canary-gated territory. That is wrong for the
RAG-path index: `fetchDocumentTitleAliasRows` (`src/lib/rag/rag-candidate-sources.ts:482`) applies
`.limit(12)` with **no `ORDER BY`**, so which twelve rows return is plan-dependent and a new index
can change the title-alias set feeding candidate assembly. No query text changes — but recall does
not follow from that.

- The `documents_title_bare_trgm_idx` benefit to `src/app/api/documents/route.ts:193` is
  ordering-safe: that path is a user-facing document list with no retrieval consequence.
- **CORRECTED AGAIN 2026-07-30 — `documents_status_id_idx` is NOT ordering-safe.** The
  correction above named the unordered `.limit(12)` as the RAG hazard but attributed it only to
  the trigram index. Re-read the statement it is talking about
  (`rag-candidate-sources.ts:482`):

  ```js
  query = query.or(filters).eq("status", "indexed").limit(12);
  ```

  One statement carries **both** `.eq("status", "indexed")` and the unordered `LIMIT 12` — and
  `(status, id)` is exactly the index that serves that equality. So the same mechanism already
  documented for the trigram index applies here verbatim: a new plan for the `status` predicate
  can return a different twelve title-alias rows into candidate assembly. Treat
  `documents_status_id_idx` as **canary-gated**, not as the safe half of this pair.

  The genuinely safe consumer is the other one: `search-scope.ts:271-277` pages with an explicit
  `.order("id")`, so its selection is stable and only its sort cost changes. Two consumers, two
  verdicts — do not generalise from the ordered one to the unordered one, which is the error
  this note corrects.

- The **RAG-path** use of the bare-column trigram indexes is **canary-gated**, full stop. Ordering
  that `.limit(12)` with a stable `ORDER BY` does **not** lift the gate: an unordered `LIMIT` has
  no stable selection to preserve, so imposing an order can pick a different twelve than the
  database happens to return today. That makes it an ordering behaviour change on a retrieval
  surface in its own right, which `AGENTS.md` already requires a live eval-canary pair for. It is
  worth doing on its own merits — an unordered `LIMIT` feeding retrieval candidates is latent
  nondeterminism regardless of this index — but sequencing it first yields **two** canary-gated
  changes, not one gate that ordering unlocks. Do not apply on the retracted semantics-neutral
  claim.

**None of these three is safe to run as a block.** All three are reachable from
`rag-candidate-sources.ts:482`, whose unordered `LIMIT 12` has no stable selection to preserve —
see the two corrections above. The `if not exists` guards make each statement individually
re-runnable; they do **not** make the set semantics-neutral. Every one of them needs the live
eval-canary pair before it stays.

```sql
-- CANARY-GATED: serves the `title ILIKE` half of rag-candidate-sources.ts:482.
create index concurrently if not exists documents_title_bare_trgm_idx
  on public.documents using gin (title gin_trgm_ops);

-- CANARY-GATED: serves the `file_name ILIKE` half of the same unordered LIMIT 12.
create index concurrently if not exists documents_file_name_bare_trgm_idx
  on public.documents using gin (file_name gin_trgm_ops);

-- CANARY-GATED (corrected 2026-07-30; previously mislabelled ordering-safe):
-- (status, id) serves the `.eq("status","indexed")` on that same statement, so it can
-- change which twelve title-alias rows reach candidate assembly. Its OTHER consumer,
-- search-scope.ts:271-277, is ordered and genuinely safe — that is not transitive.
create index concurrently if not exists documents_status_id_idx
  on public.documents (status, id);
```

`CREATE INDEX CONCURRENTLY` cannot run inside a transaction block and does not take a write lock,
but it does two table passes and can leave an `INVALID` index if it fails. Check
`pg_index.indisvalid` for each name afterwards and `DROP INDEX CONCURRENTLY` + retry any invalid
one rather than leaving it in place.

### Operator EXPLAIN diagnostic measurement (`scripts/operator-explain-documents-indexes.sql`)

Before and after applying candidate indexes on the target database in an approved window, execute the diagnostic queries in [scripts/operator-explain-documents-indexes.sql](../scripts/operator-explain-documents-indexes.sql) to measure execution plans, buffer usage, and index selectivity:

1. **Concatenated expression predicate:**

   ```sql
   EXPLAIN (ANALYZE, BUFFERS)
   SELECT id, title, file_name, status FROM public.documents
   WHERE lower(coalesce(title, '') || ' ' || coalesce(file_name, '')) ILIKE '%query%'
   LIMIT 12;
   ```

   _Target plan:_ Bitmap Index Scan on `documents_title_trgm_idx`.

2. **Bare-column ILIKE predicates (RAG & API path):**

   ```sql
   EXPLAIN (ANALYZE, BUFFERS)
   SELECT id, title, file_name, status FROM public.documents
   WHERE (title ILIKE '%query%' OR file_name ILIKE '%query%') AND status = 'indexed'
   LIMIT 12;
   ```

   _Baseline plan:_ `Seq Scan on documents` (expression index cannot serve bare columns).
   _Post-index plan:_ `BitmapOr` over `documents_title_bare_trgm_idx` and `documents_file_name_bare_trgm_idx`.

3. **Status filter ordered by ID (`search-scope.ts` paging):**
   ```sql
   EXPLAIN (ANALYZE, BUFFERS)
   SELECT id, status, title FROM public.documents
   WHERE status = 'indexed' ORDER BY id LIMIT 5000;
   ```
   _Baseline plan:_ `Index Scan` using `documents_status_idx` + in-memory Sort.
   _Post-index plan:_ `Index Scan` using `documents_status_id_idx` with zero sort overhead.

### A migration is required — operator SQL alone does not reach staging, DR, or local replay

**Added 2026-07-29 after PR #1377 review.** `supabase/migrations/` is the source of truth and
`supabase/schema.sql` is a mirror (see the repository layout in `CLAUDE.md`). Running the
statements above by hand creates the indexes **only on the database you ran them against**.
`supabase db push`, the staging tier, disaster-recovery replay, and a local `supabase db reset`
all build from migrations, so without a committed migration they never get these indexes — and a
`required_indexes` registration in `search_schema_health()` would then fail on exactly those
environments.

Follow the pattern this document already uses for `documents_registry_projection_lookup_idx`:
commit an idempotent `create index if not exists` migration, pre-create the indexes
`CONCURRENTLY` on a busy target first, and let the migration land as a no-op there while
recording the lineage for every other environment.

**PR #1377 deliberately ships no migration**, because an additive-index migration without a
synchronized `schema.sql` mirror and regenerated drift manifest is what caused PR #1312 to be
closed. That makes authoring the migration a **required part of `#102`**, not an optional extra:
the runbook below is step one of the sequence, not the whole of it.

### Ordering constraint — do all five steps in one change

**The health-function registration is a migration, not a `schema.sql` edit.** Added 2026-07-29
after PR #1377 review: an earlier version of step 5 said to add the three names to
`required_indexes` "inside `search_schema_health()` (`supabase/schema.sql:3178`)", which reads as a
mirror edit. `schema.sql` is a mirror, so editing it never changes the hosted function and the new
indexes would stay unmonitored on live. `search_schema_health()` is redefined by
`create or replace function` in eleven migrations; `20260705180000_reconcile_search_health_indexes.sql`
is the precedent to copy — it creates indexes **and** carries the updated `required_indexes` array
(`:62`) in the same migration.

1. **Author and commit one idempotent migration**, but **do not deploy it to the busy database
   yet**. It contains both halves, per the `20260705180000` shape:
   - `create index if not exists` for all three indexes (the `20260717170000` pattern);
   - `create or replace function public.search_schema_health()` with
     `documents_title_bare_trgm_idx`, `documents_file_name_bare_trgm_idx` and
     `documents_status_id_idx` added to the `required_indexes` array.

   Without the migration the indexes and the health registration never reach staging, disaster
   recovery, or a local `supabase db reset`, however carefully the remaining steps are followed —
   and deploying it ahead of step 2 builds the indexes inside the migration's transaction, taking
   the very lock this procedure avoids.

2. Create the indexes concurrently on the live database, and confirm all three are valid.
3. Mirror the three `create index` statements **and the identical function body** into
   `supabase/schema.sql`, beside the existing `documents` indexes and at
   `search_schema_health()`'s `required_indexes` (`supabase/schema.sql:3177`). The mirror must
   match the migration exactly or drift validation fails.
4. Regenerate `supabase/drift-manifest.json` with `npm run drift:manifest` (requires Docker).
   `tests/drift-detection.test.ts` pins the manifest to `schema.sql`'s sha256 and fails while it
   is stale.
5. **Deploy the migration last.** On the live database the index half is a no-op — step 2 already
   built them — and the function half registers the three names. Deploying it before step 2 would
   both take the lock and register required indexes that do not yet exist.

Deployment must come last because `search_schema_health()` runs against the live database and
reports a missing required index as a failure. Equally, committing the migration (step 1) without
carrying steps 3–4 in the same change is what caused PR #1312 to be closed on 2026-07-28 — an
additive index migration with no synchronized schema/drift proof. Expect `npm run check:drift` to
report the three indexes as unexpected between steps 2 and 3.

### Rollback — three deployed phases, with the live drop in the middle

**CORRECTED 2026-07-29 after PR #1377 review.** An earlier version of this section listed a single
five-step sequence that removed the `schema.sql` statements and the revert migration together in
step 2, then deployed them in step 4 and dropped concurrently in step 5. That is unsafe, for the
mirror-image of the reason the apply side pre-creates concurrently:

- A forward migration that genuinely reverts the index migration has to **contain the drops**,
  otherwise a fresh `supabase db reset`, a staging rebuild, or disaster-recovery replay runs the
  original `create index` migration and recreates the indexes with nothing to remove them.
- Deploying that migration therefore drops the indexes on the live database at that moment — and
  it cannot do so concurrently. `20260702110000_drop_redundant_indexes.sql` and
  `20260711000000_drop_redundant_registry_sources_record_index.sql` both record why in their
  headers: _"DROP INDEX CONCURRENTLY cannot run inside a transaction block. Supabase migrations
  are wrapped in a transaction by default."_ Both settle for a plain `DROP INDEX` because their
  tables are small. `documents` is not, which is the whole reason this procedure exists.

So a plain `DROP INDEX` in the migration takes the `ACCESS EXCLUSIVE` lock this runbook is written
to avoid, and omitting the drops leaves every replayed environment inconsistent with production.
The resolution is to separate them into three deployments:

**Phase A — retract the health expectations, and deploy.**

1. Author a migration that does the retraction on the hosted database — a
   `create or replace function public.search_schema_health()` with
   `documents_title_bare_trgm_idx`, `documents_file_name_bare_trgm_idx` and
   `documents_status_id_idx` **removed** from `required_indexes`, per the same
   `20260705180000_reconcile_search_health_indexes.sql` precedent the apply side uses. Mirror the
   identical function body into `supabase/schema.sql` (`:3177`) and regenerate
   `supabase/drift-manifest.json`. Retracting in the mirror alone leaves the hosted function still
   requiring all three, so phase B would drop indexes it demands and turn the health check red —
   the exact failure this phase exists to prevent.
2. Deploy that migration alone. The indexes still exist and `schema.sql`/`drift-manifest.json`
   still describe them, so both the health check and drift validation stay green across this phase.

**Phase B — drop concurrently on the live database.**

3. `DROP INDEX CONCURRENTLY IF EXISTS` each of the three, outside any transaction, and confirm each
   is gone. Nothing names them any more, so nothing goes red on their absence — but `check:drift`
   now reports the three as **missing** until phase C lands, exactly mirroring the "unexpected"
   window between apply steps 2 and 3.

**Phase C — carry the removal to every other environment, and deploy.**

4. Remove the three `create index` statements from `supabase/schema.sql`.
5. Add a new forward migration containing `drop index concurrently`-free, idempotent
   `drop index if exists public.<name>;` statements — never by deleting or editing the applied
   create migration. It is a **no-op on the live database**, because phase B already dropped them
   there; its purpose is lineage for staging, disaster recovery, and local replay. A plain
   `DROP INDEX` is safe here for exactly the reason it is unsafe in the merged sequence: by the
   time it reaches a busy production database there is no index left to lock against.
6. Regenerate `supabase/drift-manifest.json` (`npm run drift:manifest`, requires Docker) and deploy
   phase C. `check:drift` returns to green.

Nothing reads these indexes by name outside `search_schema_health()`, and no query text depends on
them, so once phase A has retracted the expectations the drop restores the pre-change plans exactly.

## Safe rollback

Treat rollback as another reviewed forward migration; do not delete or repair the
recorded migration-history row. If registry-delete failures appear after rollout:

1. Pause deletes from `clinical_registry_records`, `medication_records`, and
   `differential_records` so removing cleanup cannot silently create new orphaned
   corpus documents.
2. Preserve diagnostics and take the normal backup. Confirm whether the failure is in
   the trigger function, the registry projection index, or unrelated application code.
3. In a new migration, drop the three delete triggers before dropping
   `public.cleanup_registry_corpus_document()`. The projection index is harmless when
   unused; leave it in place unless lock and dependency review justifies a separate
   `DROP INDEX CONCURRENTLY` outside a migration transaction.
4. Reconcile any registry projection documents created or deleted during the incident
   window before re-enabling registry deletes, then run the normal migration-history,
   drift, privilege, and functional checks.

Do not run these steps against a linked or live project without explicit production
approval. The rollback does not alter `20260717171000_public_title_corrector.sql` or
permit private titles in the corrector vocabulary.
