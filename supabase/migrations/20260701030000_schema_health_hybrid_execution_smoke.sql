-- P0.2: search_schema_health() only checked function *signatures* and index existence, so it never
-- caught the live-only plpgsql drift that made every hybrid retrieval RPC throw 42702
-- ("column reference id is ambiguous") at run time. Add an execution smoke: actually invoke each of
-- the four hybrid RPCs with a zero vector + a tiny probe query and limit 1, catching any error and
-- reporting it in `missing` as `<rpc>.execution:<sqlstate>`. This turns a silent, app-swallowed RPC
-- failure into a red check in check:indexing / check:production-readiness / setup-status.
-- The zero vector never matches (cosine distance of a zero vector is NaN, so vector_hits is empty and
-- text_hits only matches the nonsense probe), so the smoke is cheap; we only care that the plan
-- executes without a parse/plan error.

create or replace function public.search_schema_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_catalog, pg_temp
as $$
declare
  missing text[] := array[]::text[];
  vector_type_oid oid;
  vector_schema text;
  zero_vec extensions.vector(1536);
  probe_text text := 'schema health probe zzznomatch';
  hybrid_rpcs text[] := array[
    'match_document_chunks_hybrid',
    'match_document_index_units_hybrid',
    'match_document_embedding_fields_hybrid',
    'match_document_memory_cards_hybrid'
  ];
  rpc_name text;
begin
  select t.oid, n.nspname
  into vector_type_oid, vector_schema
  from pg_type t
  join pg_namespace n on n.oid = t.typnamespace
  where t.typname = 'vector'
    and n.nspname = 'extensions'
  limit 1;

  if vector_type_oid is null then
    missing := array_append(missing, 'extensions.vector_type');
  end if;

  if vector_type_oid is not null and not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'match_document_chunks'
      and p.proargtypes[0] = vector_type_oid
  ) then
    missing := array_append(missing, 'match_document_chunks.extensions_vector_signature');
  end if;

  if vector_type_oid is not null and not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'match_document_chunks_hybrid'
      and p.proargtypes[0] = vector_type_oid
  ) then
    missing := array_append(missing, 'match_document_chunks_hybrid.extensions_vector_signature');
  end if;

  if vector_type_oid is not null and not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'match_document_memory_cards_hybrid'
      and p.proargtypes[0] = vector_type_oid
  ) then
    missing := array_append(missing, 'match_document_memory_cards_hybrid.extensions_vector_signature');
  end if;

  if not exists (select 1 from pg_class where relname = 'documents_title_trgm_idx') then
    missing := array_append(missing, 'documents_title_trgm_idx');
  end if;
  if not exists (select 1 from pg_class where relname = 'document_chunks_content_trgm_idx') then
    missing := array_append(missing, 'document_chunks_content_trgm_idx');
  end if;
  if not exists (select 1 from pg_class where relname = 'document_labels_label_trgm_idx') then
    missing := array_append(missing, 'document_labels_label_trgm_idx');
  end if;
  if not exists (select 1 from pg_class where relname = 'document_summaries_summary_trgm_idx') then
    missing := array_append(missing, 'document_summaries_summary_trgm_idx');
  end if;

  -- Execution smoke: only run when the vector type resolved, so we do not double-report a
  -- missing extension. Each RPC is invoked in its own sub-block so one failure does not mask others.
  if vector_type_oid is not null then
    zero_vec := (select ('[' || string_agg('0', ',') || ']') from generate_series(1, 1536))::extensions.vector(1536);
    foreach rpc_name in array hybrid_rpcs loop
      begin
        execute format(
          'select 1 from public.%I($1, $2, 1, 0.1, null::uuid[], null::uuid) limit 1',
          rpc_name
        ) using zero_vec, probe_text;
      exception
        when undefined_function then
          missing := array_append(missing, rpc_name || '.execution_signature');
        when others then
          missing := array_append(missing, rpc_name || '.execution:' || SQLSTATE);
      end;
    end loop;
  end if;

  return jsonb_build_object(
    'ok', cardinality(missing) = 0,
    'missing', missing,
    'vector_extension_schema', vector_schema,
    'checked_at', now()
  );
end;
$$;

grant execute on function public.search_schema_health()
to service_role;
