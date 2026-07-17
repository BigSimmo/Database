set lock_timeout = '5s';
set statement_timeout = '60s';

-- Operators rolling this out on a busy database may pre-create this exact
-- index concurrently outside the migration transaction. The IF NOT EXISTS
-- below then becomes a no-op during the eventual authorized migration apply.
create index if not exists documents_registry_projection_lookup_idx
  on public.documents (
    (metadata->>'registry_record_kind'),
    (metadata->>'registry_record_id')
  )
  where metadata->>'source_kind' = 'registry_record';

create or replace function public.cleanup_registry_corpus_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.documents
  where metadata->>'source_kind' = 'registry_record'
    and metadata->>'registry_record_kind' = case tg_table_name
      when 'clinical_registry_records' then pg_catalog.to_jsonb(old)->>'kind'
      when 'medication_records' then 'medication'
      when 'differential_records' then 'differential'
      else null
    end
    and metadata->>'registry_record_id' = old.id::text;

  return old;
end;
$$;

revoke execute on function public.cleanup_registry_corpus_document()
  from public, anon, authenticated, service_role;

drop trigger if exists clinical_registry_records_delete_cleanup on public.clinical_registry_records;
create trigger clinical_registry_records_delete_cleanup
  after delete on public.clinical_registry_records
  for each row execute function public.cleanup_registry_corpus_document();

drop trigger if exists medication_records_delete_cleanup on public.medication_records;
create trigger medication_records_delete_cleanup
  after delete on public.medication_records
  for each row execute function public.cleanup_registry_corpus_document();

drop trigger if exists differential_records_delete_cleanup on public.differential_records;
create trigger differential_records_delete_cleanup
  after delete on public.differential_records
  for each row execute function public.cleanup_registry_corpus_document();
