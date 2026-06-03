drop index if exists public.documents_title_search_idx;

alter table public.documents
  drop column if exists title_search_tsv;

alter table public.documents
  add column title_search_tsv tsvector generated always as (
    to_tsvector(
      'english',
      regexp_replace(
        regexp_replace(coalesce(title, '') || ' ' || coalesce(file_name, ''), '([[:lower:]])([[:upper:]])', '\1 \2', 'g'),
        '[^[:alnum:]]+',
        ' ',
        'g'
      )
    )
  ) stored;

create index if not exists documents_title_search_idx on public.documents using gin(title_search_tsv);
