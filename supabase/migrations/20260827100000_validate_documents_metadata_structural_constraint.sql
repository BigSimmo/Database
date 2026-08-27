-- Enforce structural JSON object constraint on documents.metadata (#S19JRT).
-- Documents metadata must be a JSON object, matching the Zod-level
-- sourceMetadataSchema in src/lib/rag/rag-row-contracts.ts.
--
-- Adds the constraint NOT VALID only. The Supabase integration applies each
-- migration in one transaction; ADD CONSTRAINT ... NOT VALID takes an ACCESS
-- EXCLUSIVE lock on public.documents, and validating in the same transaction
-- would hold that lock for the full-table scan VALIDATE CONSTRAINT performs,
-- blocking reads for the duration. VALIDATE CONSTRAINT runs instead in the
-- later migration 20260827100500_validate_documents_metadata_object_constraint.sql,
-- which only needs a SHARE UPDATE EXCLUSIVE lock (reads and writes continue).

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
