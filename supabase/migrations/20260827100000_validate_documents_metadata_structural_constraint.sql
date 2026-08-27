-- Enforce structural JSON object constraint on documents.metadata (#S19JRT).
-- Documents metadata must be a JSON object, matching the Zod-level
-- sourceMetadataSchema in src/lib/rag/rag-row-contracts.ts.

set local search_path = public, extensions, pg_catalog;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
begin
  if exists (
    select 1
    from public.documents
    where metadata is null or jsonb_typeof(metadata) <> 'object'
  ) then
    raise exception 'documents.metadata contains null or non-object JSON values';
  end if;
end
$migration$;

alter table public.documents
  drop constraint if exists documents_metadata_object_check;

alter table public.documents
  add constraint documents_metadata_object_check
  check (jsonb_typeof(metadata) = 'object')
  not valid;

alter table public.documents
  validate constraint documents_metadata_object_check;
