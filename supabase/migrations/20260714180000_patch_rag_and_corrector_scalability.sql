-- Cascade deletion trigger for registry records to clean up RAG corpus documents
create or replace function public.cleanup_registry_corpus_document()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
begin
  delete from public.documents
  where metadata->>'source_kind' = 'registry_record'
    and (metadata->>'registry_record_id')::uuid = OLD.id;
  return OLD;
end;
$$;

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


-- Scalable Spelling Corrector Vocabulary Indexing
create table if not exists public.document_title_words (
  word text not null,
  document_id uuid not null references public.documents(id) on delete cascade,
  primary key (word, document_id)
);

create index if not exists document_title_words_word_trgm_idx 
  on public.document_title_words using gin (word extensions.gin_trgm_ops);

alter table public.document_title_words enable row level security;
revoke all on public.document_title_words from anon, authenticated;
grant select, insert, update, delete on table public.document_title_words to service_role;

-- Populate table from existing documents
insert into public.document_title_words (word, document_id)
select distinct lower(w), d.id
from public.documents d,
     lateral unnest(regexp_split_to_array(lower(d.title), '[^a-z]+')) as w
where d.status = 'indexed'
  and length(w) between 4 and 40
on conflict do nothing;

-- Sync trigger on documents to keep title words vocabulary updated
create or replace function public.sync_document_title_words()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
begin
  if TG_OP = 'DELETE' or (TG_OP = 'UPDATE' and OLD.status = 'indexed' and NEW.status <> 'indexed') then
    delete from public.document_title_words where document_id = OLD.id;
  end if;

  if (TG_OP = 'INSERT' and NEW.status = 'indexed') or 
     (TG_OP = 'UPDATE' and NEW.status = 'indexed' and (OLD.status <> 'indexed' or OLD.title <> NEW.title)) then
    
    if TG_OP = 'UPDATE' then
      delete from public.document_title_words where document_id = NEW.id;
    end if;

    insert into public.document_title_words (word, document_id)
    select distinct lower(w), NEW.id
    from unnest(regexp_split_to_array(lower(NEW.title), '[^a-z]+')) as w
    where length(w) between 4 and 40
    on conflict do nothing;
  end if;

  return null;
end;
$$;

drop trigger if exists documents_sync_title_words on public.documents;
create trigger documents_sync_title_words
  after insert or update or delete on public.documents
  for each row execute function public.sync_document_title_words();

-- Optimize spelling corrector to query index table
CREATE OR REPLACE FUNCTION public.correct_clinical_query_terms(input_query text, min_sim real DEFAULT 0.45)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  vocab text[];
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

  select array_agg(distinct term) into vocab
  from (
    select lower(alias) as term from public.rag_aliases where enabled and length(alias) between 4 and 40
    union
    select lower(canonical) from public.rag_aliases where enabled and length(canonical) between 4 and 40
    union
    select word from public.document_title_words where length(word) between 4 and 40
  ) t;

  tokens := regexp_split_to_array(lower(input_query), '\s+');
  foreach tok in array tokens loop
    if length(tok) < 4 or tok = any(vocab) then
      corrected := corrected || tok;
      continue;
    end if;
    best := null;
    best_sim := 0;
    select v, similarity(v, tok) into best, best_sim
    from unnest(vocab) as v
    order by similarity(v, tok) desc
    limit 1;
    if best is not null and best_sim >= min_sim and best <> tok and length(best) >= length(tok) then
      corrected := corrected || best;
      changed := true;
    else
      corrected := corrected || tok;
    end if;
  end loop;

  if changed then
    return array_to_string(corrected, ' ');
  end if;
  return input_query;
end;
$function$;
