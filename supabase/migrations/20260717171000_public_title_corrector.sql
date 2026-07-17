set lock_timeout = '5s';
set statement_timeout = '60s';

create table if not exists public.document_title_words (
  word text not null,
  document_id uuid not null references public.documents(id) on delete cascade,
  primary key (word, document_id),
  constraint document_title_words_word_length check (length(word) between 4 and 40),
  constraint document_title_words_lowercase check (word = lower(word))
);

create index if not exists document_title_words_word_trgm_idx
  on public.document_title_words using gin (word extensions.gin_trgm_ops);

create index if not exists document_title_words_document_id_idx
  on public.document_title_words (document_id);

create index if not exists rag_aliases_canonical_trgm_idx
  on public.rag_aliases using gin (lower(canonical) extensions.gin_trgm_ops);

alter table public.document_title_words enable row level security;
revoke all on table public.document_title_words from public, anon, authenticated;
grant select, insert, update, delete on table public.document_title_words to service_role;

create or replace function public.sync_document_title_words()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' then
    delete from public.document_title_words where document_id = old.id;
  end if;

  if tg_op <> 'DELETE' and new.owner_id is null and new.status = 'indexed' then
    insert into public.document_title_words (word, document_id)
    select distinct lower(title_word), new.id
    from pg_catalog.unnest(pg_catalog.regexp_split_to_array(lower(new.title), '[^a-z]+')) as title_word
    where length(title_word) between 4 and 40
    on conflict do nothing;
  end if;

  return null;
end;
$$;

revoke execute on function public.sync_document_title_words()
  from public, anon, authenticated, service_role;

drop trigger if exists documents_sync_title_words on public.documents;
create trigger documents_sync_title_words
  after insert or update of title, status, owner_id or delete on public.documents
  for each row execute function public.sync_document_title_words();

insert into public.document_title_words (word, document_id)
select distinct lower(title_word), d.id
from public.documents d
cross join lateral unnest(regexp_split_to_array(lower(d.title), '[^a-z]+')) as title_word
where d.owner_id is null and d.status = 'indexed'
  and length(title_word) between 4 and 40
on conflict do nothing;

create or replace function public.correct_clinical_query_terms(
  input_query text,
  min_sim real default 0.45
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, extensions
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
