-- The filename matches the version recorded by the hosted migration operation.
-- Preserve the repository's fail-closed default ACL while limiting direct
-- service-role access to operational reads. Visibility mutations remain behind
-- set_document_corpus_access_mode(), which serializes and snapshots the change.
revoke all on table public.document_corpus_access_state
  from public, anon, authenticated, service_role;
revoke all on table public.document_corpus_access_snapshots
  from public, anon, authenticated, service_role;
grant select on table public.document_corpus_access_state to service_role;
grant select on table public.document_corpus_access_snapshots to service_role;

-- The primary key starts with activation_id, so it cannot support the
-- document_id lookup PostgreSQL performs for ON DELETE CASCADE.
create index if not exists document_corpus_access_snapshots_document_id_idx
  on public.document_corpus_access_snapshots (document_id);

revoke all on function public.set_document_corpus_access_mode(text)
  from public, anon, authenticated, service_role;
grant execute on function public.set_document_corpus_access_mode(text) to service_role;
