create table if not exists public.document_sections (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete set null,
  section_index integer not null,
  heading text not null,
  heading_path text[] not null default '{}',
  page_start integer,
  page_end integer,
  chunk_ids uuid[] not null default '{}',
  summary text not null default '',
  tags text[] not null default '{}',
  extraction_quality text not null default 'unknown'
    check (extraction_quality in ('good', 'partial', 'poor', 'unknown')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, section_index)
);

create table if not exists public.document_memory_cards (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete set null,
  section_id uuid references public.document_sections(id) on delete set null,
  card_type text not null
    check (card_type in (
      'section_summary',
      'table_row',
      'threshold',
      'medication',
      'risk',
      'workflow',
      'definition',
      'citation_anchor'
    )),
  title text not null,
  content text not null,
  normalized_terms text[] not null default '{}',
  page_number integer,
  source_chunk_ids uuid[] not null default '{}',
  source_image_ids uuid[] not null default '{}',
  confidence real not null default 0.5 check (confidence >= 0 and confidence <= 1),
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536) not null,
  search_tsv tsvector generated always as (
    to_tsvector(
      'english',
      coalesce(title, '') || ' ' || coalesce(content, '')
    )
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create index if not exists document_sections_document_idx
  on public.document_sections(document_id, section_index);
create index if not exists document_sections_chunk_ids_gin_idx
  on public.document_sections using gin(chunk_ids);
create index if not exists document_sections_tags_gin_idx
  on public.document_sections using gin(tags);
create index if not exists document_memory_cards_document_idx
  on public.document_memory_cards(document_id, card_type, confidence desc);
create index if not exists document_memory_cards_search_idx
  on public.document_memory_cards using gin(search_tsv);
create index if not exists document_memory_cards_terms_idx
  on public.document_memory_cards using gin(normalized_terms);
create index if not exists document_memory_cards_source_chunks_idx
  on public.document_memory_cards using gin(source_chunk_ids);
create index if not exists document_memory_cards_source_images_idx
  on public.document_memory_cards using gin(source_image_ids);
create index if not exists document_memory_cards_embedding_hnsw_idx
  on public.document_memory_cards using hnsw (embedding vector_cosine_ops);

drop trigger if exists document_sections_updated_at on public.document_sections;
create trigger document_sections_updated_at
before update on public.document_sections
for each row execute function public.set_updated_at();

drop trigger if exists document_memory_cards_updated_at on public.document_memory_cards;
create trigger document_memory_cards_updated_at
before update on public.document_memory_cards
for each row execute function public.set_updated_at();

create or replace function public.reset_document_index(p_document_id uuid)
returns void
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  delete from public.document_memory_cards where document_id = p_document_id;
  delete from public.document_sections where document_id = p_document_id;
  delete from public.document_chunks where document_id = p_document_id;
  delete from public.document_images where document_id = p_document_id;
  delete from public.document_pages where document_id = p_document_id;
end;
$$;

create or replace function public.stamp_document_deep_memory_version(
  p_document_id uuid,
  p_version text
)
returns void
language plpgsql
set search_path = public, extensions, pg_temp
as $$
declare
  stamped_at timestamptz := now();
begin
  update public.documents
  set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'rag_indexing_version', p_version,
    'rag_memory_version', p_version,
    'rag_memory_updated_at', stamped_at
  )
  where id = p_document_id;

  update public.document_chunks
  set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'rag_indexing_version', p_version,
    'rag_memory_version', p_version,
    'rag_memory_updated_at', stamped_at
  )
  where document_id = p_document_id;
end;
$$;

revoke all privileges on table public.document_sections from anon, authenticated;
revoke all privileges on table public.document_memory_cards from anon, authenticated;
grant select, insert, update, delete on table public.document_sections to service_role;
grant select, insert, update, delete on table public.document_memory_cards to service_role;
grant execute on function public.stamp_document_deep_memory_version(uuid, text) to service_role;
grant execute on function public.reset_document_index(uuid) to service_role;

alter table public.document_sections enable row level security;
alter table public.document_memory_cards enable row level security;
