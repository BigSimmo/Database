# Operator apply — performance and latency remediation

This worktree does not apply migrations. Production rollout remains a separate,
explicitly authorized operation after local replay, review, and backups.

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
