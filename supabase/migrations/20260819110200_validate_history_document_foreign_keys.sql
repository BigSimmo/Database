-- Phase 6.2 history guard (plan section 6.2; forensics section 1.1 / 3.7 / '6.2 completion'):
-- validate the three document foreign keys that two hand-applied, mark-applied versions added.
-- Ledger anchor #Q5JHBJ (#316 umbrella).
--
--   20260702130000 storage_cleanup_jobs_document_fk   -> storage_cleanup_jobs_document_id_fkey
--   20260712171000 reconcile_visual_eval_document_fks -> rag_visual_eval_cases_document_id_fkey,
--                                                        rag_visual_eval_runs_document_id_fkey
--
-- Each must be a FOREIGN KEY on (document_id) referencing public.documents(id) with ON DELETE SET
-- NULL -- the shape supabase/schema.sql declares and supabase/drift-manifest.json pins
-- ('FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE SET NULL'). The check reads
-- pg_constraint columns (contype / confrelid / confdeltype / conkey / confkey) rather than comparing
-- pg_get_constraintdef text, so the result does not depend on the session search_path rendering
-- 'documents' versus 'public.documents'.
--
-- Like 20260804110240 this migration VALIDATES and never builds: it reads the catalog and raises once,
-- naming every failure. Timeouts use SET LOCAL so they do not leak into later migrations.

set local search_path = public, extensions, pg_catalog;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  missing_constraints text[] := array[]::text[];
  mismatched_constraints text[] := array[]::text[];
  required record;
  table_oid regclass;
  con record;
  document_column smallint;
  documents_id_column smallint;
begin
  select a.attnum
    into documents_id_column
  from pg_attribute as a
  where a.attrelid = to_regclass('public.documents')
    and a.attname = 'id'
    and not a.attisdropped;
  for required in
    select *
    from (
      values
        -- 20260702130000
        ('storage_cleanup_jobs', 'storage_cleanup_jobs_document_id_fkey'),
        -- 20260712171000
        ('rag_visual_eval_cases', 'rag_visual_eval_cases_document_id_fkey'),
        -- 20260712171000
        ('rag_visual_eval_runs', 'rag_visual_eval_runs_document_id_fkey')
    ) as t(table_name, constraint_name)
  loop
    table_oid := to_regclass(format('public.%I', required.table_name));
    if table_oid is null then
      missing_constraints := array_append(missing_constraints, required.constraint_name);
      continue;
    end if;

    select c.contype, c.confrelid, c.confdeltype, c.conkey, c.confkey
      into con
    from pg_constraint as c
    where c.conrelid = table_oid
      and c.conname = required.constraint_name;

    if not found then
      missing_constraints := array_append(missing_constraints, required.constraint_name);
      continue;
    end if;

    select a.attnum
      into document_column
    from pg_attribute as a
    where a.attrelid = table_oid
      and a.attname = 'document_id'
      and not a.attisdropped;

    if con.contype <> 'f'
       or con.confrelid is distinct from to_regclass('public.documents')::oid
       or con.confdeltype <> 'n'
       or con.conkey is distinct from array[document_column]::smallint[]
       or con.confkey is distinct from array[documents_id_column]::smallint[] then
      mismatched_constraints := array_append(mismatched_constraints, required.constraint_name);
    end if;
  end loop;

  if cardinality(missing_constraints) > 0 or cardinality(mismatched_constraints) > 0 then
    raise exception
      'History guard 20260819110200: the document foreign keys recorded by 20260702130000 / 20260712171000 are not in canonical form (FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE SET NULL). Reconcile them out of band, then apply this version. Missing: %; Invalid: (none); Mismatched: %',
      coalesce(nullif(array_to_string(missing_constraints, ', '), ''), '(none)'),
      coalesce(nullif(array_to_string(mismatched_constraints, ', '), ''), '(none)');
  end if;
end
$migration$;
