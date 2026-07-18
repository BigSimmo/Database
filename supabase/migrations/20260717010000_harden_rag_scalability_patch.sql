-- Forward-only hardening for the registry cleanup and RAG scalability WIP.
-- This intentionally corrects the earlier July 14 migrations without assuming
-- whether either version has already been applied in an external environment.

create index if not exists rag_aliases_canonical_trgm_idx
  on public.rag_aliases using gin (lower(canonical) extensions.gin_trgm_ops);

create or replace function public.cleanup_registry_corpus_document()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
begin
  delete from public.documents
  where metadata->>'source_kind' = 'registry_record'
    and metadata->>'registry_record_id' = OLD.id::text
    and metadata->>'registry_record_kind' = case TG_TABLE_NAME
      when 'clinical_registry_records' then to_jsonb(OLD)->>'kind'
      when 'medication_records' then 'medication'
      when 'differential_records' then 'differential'
      else null
    end;
  return OLD;
end;
$$;

revoke execute on function public.cleanup_registry_corpus_document() from public, anon, authenticated;
revoke execute on function public.sync_document_title_words() from public, anon, authenticated;

create or replace function public.correct_clinical_query_terms(input_query text, min_sim real default 0.45)
returns text
language plpgsql
stable security definer
set search_path to 'public', 'extensions', 'pg_temp'
set pg_trgm.similarity_threshold = 0.3
as $$
declare
  tokens text[];
  tok text;
  best text;
  best_sim real;
  corrected text[] := array[]::text[];
  changed boolean := false;
begin
  if min_sim is null or min_sim < 0.3 or min_sim > 1 then
    raise exception 'min_sim must be between 0.3 and 1.0' using errcode = '22023';
  end if;

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
    select candidate.term, similarity(candidate.term, tok)
      into best, best_sim
    from (
      (
        select lower(alias) as term
        from public.rag_aliases
        where enabled
          and length(alias) between 4 and 40
          and lower(alias) % tok
        order by similarity(lower(alias), tok) desc, lower(alias)
        limit 32
      )
      union all
      (
        select lower(canonical) as term
        from public.rag_aliases
        where enabled
          and length(canonical) between 4 and 40
          and lower(canonical) % tok
        order by similarity(lower(canonical), tok) desc, lower(canonical)
        limit 32
      )
      union all
      (
        select word as term
        from public.document_title_words
        where length(word) between 4 and 40
          and word % tok
        order by similarity(word, tok) desc, word
        limit 32
      )
    ) candidate
    order by similarity(candidate.term, tok) desc, candidate.term
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

revoke execute on function public.correct_clinical_query_terms(text, real) from public, anon, authenticated;
grant execute on function public.correct_clinical_query_terms(text, real) to service_role;

drop index if exists public.document_table_facts_text_trgm_idx;
