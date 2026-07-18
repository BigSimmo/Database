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
