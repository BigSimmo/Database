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

- `documents_status_id_idx` and the `documents_title_bare_trgm_idx` benefit to
  `src/app/api/documents/route.ts:193` are ordering-safe: that path is a user-facing document
  list with no retrieval consequence.
- The **RAG-path** use of the bare-column trigram indexes is **canary-gated**, or must be preceded
  by making that `.limit(12)` deterministic with a stable `ORDER BY`. **Note the ordering fix is
  not itself free:** an unordered `LIMIT` has no stable selection to preserve, so imposing an order
  can select a different twelve than the database returns today — it is worth doing because
  unordered `LIMIT` on a retrieval input is latent nondeterminism, but its own recall impact needs
  validating. Either way, do not apply on the retracted semantics-neutral claim.

Create them outside a transaction:

```sql
create index concurrently if not exists documents_title_bare_trgm_idx
  on public.documents using gin (title gin_trgm_ops);

create index concurrently if not exists documents_file_name_bare_trgm_idx
  on public.documents using gin (file_name gin_trgm_ops);

create index concurrently if not exists documents_status_id_idx
  on public.documents (status, id);
```

`CREATE INDEX CONCURRENTLY` cannot run inside a transaction block and does not take a write lock,
but it does two table passes and can leave an `INVALID` index if it fails. Check
`pg_index.indisvalid` for each name afterwards and `DROP INDEX CONCURRENTLY` + retry any invalid
one rather than leaving it in place.

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

1. **Author and commit the idempotent migration** (`create index if not exists`, per the
   `20260717170000` pattern). Without this the indexes never reach staging, disaster recovery, or
   a local `supabase db reset`, however carefully the remaining steps are followed.
2. Create the indexes concurrently on the live database, and confirm all three are valid. The
   migration's `if not exists` then lands as a no-op there while carrying the lineage everywhere
   else.
3. Mirror the three `create index` statements into `supabase/schema.sql` beside the existing
   `documents` indexes.
4. Regenerate `supabase/drift-manifest.json` with `npm run drift:manifest` (requires Docker).
   `tests/drift-detection.test.ts` pins the manifest to `schema.sql`'s sha256 and fails while it
   is stale.
5. Only then add `documents_title_bare_trgm_idx`, `documents_file_name_bare_trgm_idx` and
   `documents_status_id_idx` to the `required_indexes` list inside `search_schema_health()`
   (`supabase/schema.sql:3178`).

Step 5 must come last: `search_schema_health()` runs against the live database and reports a
missing required index as a failure, so registering the names before the indexes exist turns a
health check red. Equally, committing the migration (step 1) without carrying steps 3–4 in the same change is what
caused PR #1312 to be closed on 2026-07-28 — an additive index migration with no synchronized
schema/drift proof. Expect `npm run check:drift` to report the three indexes as unexpected
between steps 2 and 3.

### Rollback — retract the expectations before dropping the indexes

Reverse the sequence, and **remove the expectations first**. Dropping a physical index while
`required_indexes` still names it leaves `search_schema_health()` red, and dropping it while
`schema.sql`/`drift-manifest.json` still describe it fails drift validation:

1. Remove the three names from `required_indexes` in `search_schema_health()`.
2. Remove the `create index` statements from `supabase/schema.sql` and revert the migration as a
   new forward migration — never by deleting the applied one.
3. Regenerate `supabase/drift-manifest.json`.
4. Deploy those expectation changes.
5. Only then `DROP INDEX CONCURRENTLY` each index.

Nothing reads these indexes by name outside `search_schema_health()`, and no query text depends on
them, so once the expectations are retracted the drop restores the pre-change plans exactly.

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
