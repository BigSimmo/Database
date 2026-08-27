-- #DHAR98: Harden search_path on 3 SECURITY DEFINER functions
-- Explicitly pin pg_temp to eliminate search_path hijacking risks on DEFINER bodies.

set local search_path = public, extensions, pg_catalog;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

CREATE OR REPLACE FUNCTION public.set_owner_id_from_auth_uid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, auth, pg_temp
AS $function$
begin
  if new.owner_id is null then
    new.owner_id := auth.uid();
  end if;
  return new;
end;
$function$;

revoke execute on function public.set_owner_id_from_auth_uid() from public, anon, authenticated;
grant execute on function public.set_owner_id_from_auth_uid() to service_role;


create or replace function public.correct_clinical_query_terms(
  input_query text,
  min_sim real default 0.45
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, extensions, pg_temp
as $$
declare
  tokens text[];
  tok text;
  best text;
  best_sim real;
  corrected text[] := array[]::text[];
  changed boolean := false;
begin
  if input_query is null or length(trim(input_query)) = 0 then
    return input_query;
  end if;
  tokens := regexp_split_to_array(lower(input_query), '\s+');
  foreach tok in array tokens loop
    if length(tok) < 4 then
      corrected := corrected || tok;
      continue;
    end if;
    best := null;
    best_sim := 0;
    select candidate.term, candidate.match_sim
      into best, best_sim
    from (
      (
        select
          lower(canonical) as term,
          similarity(lower(alias), tok) as match_sim
        from public.rag_aliases
        where enabled
          and owner_id is null
          and length(alias) between 4 and 40
          and length(canonical) between 4 and 40
          and lower(alias) % tok
        order by similarity(lower(alias), tok) desc, lower(alias)
        limit 32
      )
      union all
      (
        select
          lower(canonical) as term,
          similarity(lower(canonical), tok) as match_sim
        from public.rag_aliases
        where enabled
          and owner_id is null
          and length(canonical) between 4 and 40
          and lower(canonical) % tok
        order by similarity(lower(canonical), tok) desc, lower(canonical)
        limit 32
      )
      union all
      (
        select
          word as term,
          similarity(word, tok) as match_sim
        from public.document_title_words
        where length(word) between 4 and 40
          and word % tok
        order by similarity(word, tok) desc, word
        limit 32
      )
    ) candidate
    order by candidate.match_sim desc, candidate.term
    limit 1;
    if best is not null and best_sim >= min_sim and best <> tok and length(best) >= length(tok) then
      corrected := corrected || best;
      changed := true;
    else
      corrected := corrected || tok;
    end if;
  end loop;
  if not changed then
    return input_query;
  end if;
  return array_to_string(corrected, ' ');
end;
$$;

revoke execute on function public.correct_clinical_query_terms(text, real)
  from public, anon, authenticated;
grant execute on function public.correct_clinical_query_terms(text, real) to service_role;


create or replace function public.create_uploaded_document_with_ingestion_job(
  p_document jsonb,
  p_max_attempts integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_document public.documents%rowtype;
  v_job public.ingestion_jobs%rowtype;
begin
  insert into public.documents (
    id,
    owner_id,
    title,
    description,
    file_name,
    file_type,
    file_size,
    storage_path,
    content_hash,
    status,
    metadata
  ) values (
    (p_document->>'id')::uuid,
    (p_document->>'owner_id')::uuid,
    p_document->>'title',
    nullif(p_document->>'description', ''),
    p_document->>'file_name',
    p_document->>'file_type',
    coalesce((p_document->>'file_size')::bigint, 0),
    p_document->>'storage_path',
    nullif(p_document->>'content_hash', ''),
    'queued',
    coalesce(p_document->'metadata', '{}'::jsonb)
  )
  returning * into v_document;

  insert into public.ingestion_jobs (
    document_id,
    batch_id,
    status,
    stage,
    progress,
    max_attempts
  ) values (
    v_document.id,
    null,
    'pending',
    'queued',
    0,
    p_max_attempts
  )
  returning * into v_job;

  return jsonb_build_object(
    'document', to_jsonb(v_document),
    'job', to_jsonb(v_job)
  );
end;
$$;

revoke execute on function public.create_uploaded_document_with_ingestion_job(jsonb, integer) from public, anon, authenticated;
grant execute on function public.create_uploaded_document_with_ingestion_job(jsonb, integer) to service_role;
