-- Fix #2: Remove duplicate/incomplete reset_document_index definition.
--
-- schema.sql contained two definitions of reset_document_index. The first
-- (lines 1075-1091) did NOT delete from document_index_units. The second
-- (later in the file) does delete from document_index_units and is the
-- authoritative live version. Because CREATE OR REPLACE is last-write-wins,
-- the second definition is what the database actually runs. This migration
-- is a no-op CREATE OR REPLACE of the correct complete definition, making
-- migration history authoritative and preventing any future schema replay
-- from accidentally deploying the incomplete version first.

create or replace function public.reset_document_index(p_document_id uuid)
returns void
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  perform set_config('statement_timeout', '180000', true);
  -- document_index_units must be deleted first (references document_chunks via FK).
  delete from public.document_index_units where document_id = p_document_id;
  delete from public.document_memory_cards where document_id = p_document_id;
  delete from public.document_sections where document_id = p_document_id;
  delete from public.document_table_facts where document_id = p_document_id;
  delete from public.document_embedding_fields where document_id = p_document_id;
  delete from public.document_index_quality where document_id = p_document_id;
  delete from public.document_chunks where document_id = p_document_id;
  delete from public.document_images where document_id = p_document_id;
  delete from public.document_pages where document_id = p_document_id;
end;
$$;

-- Validation: confirm the function exists with the correct signature.
do $$
begin
  if to_regprocedure('public.reset_document_index(uuid)') is null then
    raise exception 'reset_document_index(uuid) not found after migration';
  end if;
end;
$$;
