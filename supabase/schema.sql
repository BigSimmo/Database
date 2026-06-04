-- Medical RAG Knowledge Base schema.
-- Run this in the Supabase SQL editor or with the Supabase CLI.
-- Tables are RLS protected; the local Next.js API and worker use the service role.

create schema if not exists extensions;
set search_path = public, extensions;

create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'clinical-documents',
  'clinical-documents',
  false,
  157286400,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]
)
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'clinical-images',
  'clinical-images',
  false,
  52428800,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set public = false;

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  name text not null,
  source_root text,
  include_glob text not null default '**/*.pdf',
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'completed_with_errors', 'failed')),
  total_files integer not null default 0,
  queued_files integer not null default 0,
  skipped_files integer not null default 0,
  failed_files integer not null default 0,
  total_bytes bigint not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  file_name text not null,
  file_type text not null,
  file_size bigint not null default 0,
  storage_path text not null,
  content_hash text,
  source_path text,
  import_batch_id uuid references public.import_batches(id) on delete set null,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'indexed', 'failed')),
  page_count integer not null default 0,
  chunk_count integer not null default 0,
  image_count integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  search_tsv tsvector generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(file_name, ''))
  ) stored,
  title_search_tsv tsvector generated always as (
    to_tsvector(
      'english',
      regexp_replace(
        regexp_replace(coalesce(title, '') || ' ' || coalesce(file_name, ''), '([[:lower:]])([[:upper:]])', '\1 \2', 'g'),
        '[^[:alnum:]]+',
        ' ',
        'g'
      )
    )
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_pages (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  page_number integer not null,
  text text not null default '',
  ocr_used boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, page_number)
);

create table if not exists public.document_images (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  page_number integer,
  storage_path text not null,
  mime_type text not null default 'image/png',
  caption text not null default '',
  bbox jsonb,
  image_type text not null default 'unclear'
    check (image_type in (
      'clinical_table',
      'flowchart_algorithm',
      'form_checklist',
      'risk_matrix',
      'medication_chart',
      'graph',
      'screenshot_ui',
      'photo',
      'logo_decorative',
      'unclear'
    )),
  searchable boolean not null default true,
  clinical_relevance_score real not null default 0,
  skip_reason text,
  source_kind text not null default 'embedded',
  width integer,
  height integer,
  image_hash text,
  perceptual_hash text,
  labels text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.image_caption_cache (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  image_hash text not null,
  model text not null,
  mime_type text,
  caption text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, image_hash, model)
);

create table if not exists public.document_labels (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete set null,
  label text not null,
  label_type text not null
    check (label_type in (
      'topic',
      'document_type',
      'medication',
      'risk',
      'setting',
      'workflow',
      'population',
      'service',
      'custom'
    )),
  source text not null default 'generated'
    check (source in ('generated', 'manual')),
  confidence real not null default 0.5 check (confidence >= 0 and confidence <= 1),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, label_type, label, source)
);

create table if not exists public.document_summaries (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null unique references public.documents(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete set null,
  summary text not null,
  clinical_specifics jsonb not null default '{}'::jsonb,
  source_chunk_ids uuid[] not null default '{}',
  source_image_ids uuid[] not null default '{}',
  model text,
  metadata jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  page_number integer,
  chunk_index integer not null,
  section_heading text,
  content text not null,
  token_estimate integer not null default 0,
  image_ids uuid[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536) not null,
  search_tsv tsvector generated always as (
    to_tsvector('english', coalesce(section_heading, '') || ' ' || content)
  ) stored,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create table if not exists public.ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  batch_id uuid references public.import_batches(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  stage text not null default 'queued',
  progress integer not null default 0 check (progress between 0 and 100),
  error_message text,
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  locked_at timestamptz,
  locked_by text,
  next_run_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rag_queries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  query text not null,
  answer text,
  source_chunk_ids uuid[] not null default '{}',
  model text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.storage_cleanup_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  document_id uuid,
  document_title text,
  document_bucket text not null default 'clinical-documents',
  document_paths text[] not null default '{}',
  image_bucket text not null default 'clinical-images',
  image_paths text[] not null default '{}',
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'failed')),
  attempts integer not null default 0,
  storage_removed integer not null default 0,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists documents_owner_content_hash_unique_idx
  on public.documents(owner_id, content_hash)
  where content_hash is not null;
create index if not exists import_batches_owner_status_idx on public.import_batches(owner_id, status, created_at desc);
create index if not exists documents_status_idx on public.documents(status);
create index if not exists documents_owner_status_idx on public.documents(owner_id, status, created_at desc);
create index if not exists documents_import_batch_idx on public.documents(import_batch_id);
create index if not exists documents_owner_hash_idx on public.documents(owner_id, content_hash);
create index if not exists documents_search_idx on public.documents using gin(search_tsv);
create index if not exists documents_title_search_idx on public.documents using gin(title_search_tsv);
create index if not exists document_pages_document_idx on public.document_pages(document_id, page_number);
create index if not exists document_images_document_idx on public.document_images(document_id, page_number);
create index if not exists document_images_searchable_idx
  on public.document_images(document_id, searchable, image_type, page_number);
create index if not exists document_images_hash_idx
  on public.document_images(document_id, image_hash)
  where image_hash is not null;
create index if not exists document_images_labels_idx
  on public.document_images using gin(labels);
create index if not exists image_caption_cache_owner_hash_idx
  on public.image_caption_cache(owner_id, image_hash, model);
create index if not exists document_labels_owner_label_idx
  on public.document_labels(owner_id, label_type, label);
create index if not exists document_labels_document_idx on public.document_labels(document_id);
create index if not exists document_summaries_owner_idx on public.document_summaries(owner_id, generated_at desc);
create index if not exists document_sections_document_idx
  on public.document_sections(document_id, section_index);
create index if not exists document_sections_chunk_ids_gin_idx
  on public.document_sections using gin(chunk_ids);
create index if not exists document_sections_tags_gin_idx
  on public.document_sections using gin(tags);
create index if not exists document_sections_owner_idx
  on public.document_sections(owner_id);
create index if not exists document_memory_cards_document_idx
  on public.document_memory_cards(document_id, card_type, confidence desc);
create index if not exists document_memory_cards_owner_idx
  on public.document_memory_cards(owner_id);
create index if not exists document_memory_cards_section_idx
  on public.document_memory_cards(section_id);
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
create index if not exists document_chunks_document_idx on public.document_chunks(document_id, chunk_index);
create index if not exists document_chunks_search_idx on public.document_chunks using gin(search_tsv);
create index if not exists document_chunks_embedding_hnsw_idx
  on public.document_chunks using hnsw (embedding vector_cosine_ops);
create index if not exists ingestion_jobs_document_idx on public.ingestion_jobs(document_id);
create index if not exists ingestion_jobs_batch_idx on public.ingestion_jobs(batch_id, status);
create index if not exists ingestion_jobs_claim_idx
  on public.ingestion_jobs(status, next_run_at, created_at)
  where status in ('pending', 'processing');
create index if not exists rag_queries_owner_idx on public.rag_queries(owner_id, created_at desc);
create index if not exists rag_queries_source_chunk_ids_gin_idx
  on public.rag_queries using gin(source_chunk_ids);
create index if not exists storage_cleanup_jobs_owner_status_idx
  on public.storage_cleanup_jobs(owner_id, status, created_at desc);
create index if not exists storage_cleanup_jobs_document_idx
  on public.storage_cleanup_jobs(document_id);

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

drop trigger if exists import_batches_updated_at on public.import_batches;
create trigger import_batches_updated_at
before update on public.import_batches
for each row execute function public.set_updated_at();

drop trigger if exists documents_updated_at on public.documents;
create trigger documents_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

drop trigger if exists ingestion_jobs_updated_at on public.ingestion_jobs;
create trigger ingestion_jobs_updated_at
before update on public.ingestion_jobs
for each row execute function public.set_updated_at();

drop trigger if exists image_caption_cache_updated_at on public.image_caption_cache;
create trigger image_caption_cache_updated_at
before update on public.image_caption_cache
for each row execute function public.set_updated_at();

drop trigger if exists document_sections_updated_at on public.document_sections;
create trigger document_sections_updated_at
before update on public.document_sections
for each row execute function public.set_updated_at();

drop trigger if exists document_memory_cards_updated_at on public.document_memory_cards;
create trigger document_memory_cards_updated_at
before update on public.document_memory_cards
for each row execute function public.set_updated_at();

drop trigger if exists storage_cleanup_jobs_updated_at on public.storage_cleanup_jobs;
create trigger storage_cleanup_jobs_updated_at
before update on public.storage_cleanup_jobs
for each row execute function public.set_updated_at();

create or replace function public.claim_ingestion_jobs(
  p_worker_id text,
  p_claim_limit integer default 1,
  p_stale_after_minutes integer default 45
)
returns table (
  id uuid,
  document_id uuid,
  batch_id uuid,
  status text,
  stage text,
  progress integer,
  error_message text,
  attempt_count integer,
  max_attempts integer,
  locked_at timestamptz,
  locked_by text,
  documents jsonb
)
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  return query
  with candidates as (
    select j.id
    from public.ingestion_jobs j
    join public.documents d on d.id = j.document_id
    where j.attempt_count < j.max_attempts
      and (
        (j.status = 'pending' and coalesce(j.next_run_at, now()) <= now())
        or (
          j.status = 'processing'
          and j.locked_at is not null
          and j.locked_at < now() - make_interval(mins => p_stale_after_minutes)
        )
      )
    order by j.created_at asc
    limit greatest(p_claim_limit, 1)
    for update of j skip locked
  ),
  claimed as (
    update public.ingestion_jobs j
    set
      status = 'processing',
      stage = case when j.stage in ('queued', 'failed') then 'claimed' else j.stage end,
      locked_at = now(),
      locked_by = p_worker_id,
      started_at = coalesce(j.started_at, now()),
      attempt_count = j.attempt_count + 1,
      error_message = null
    from candidates c
    where j.id = c.id
    returning j.*
  )
  select
    c.id,
    c.document_id,
    c.batch_id,
    c.status,
    c.stage,
    c.progress,
    c.error_message,
    c.attempt_count,
    c.max_attempts,
    c.locked_at,
    c.locked_by,
    to_jsonb(d.*) as documents
  from claimed c
  join public.documents d on d.id = c.document_id;
end;
$$;

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

create or replace function public.chunk_image_metadata(chunk_image_ids uuid[])
returns jsonb
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'page_number', i.page_number,
        'storage_path', i.storage_path,
        'caption', i.caption,
        'bbox', i.bbox,
        'image_type', i.image_type,
        'searchable', i.searchable,
        'clinical_relevance_score', i.clinical_relevance_score,
        'source_kind', i.source_kind,
        'sourceKind', i.source_kind,
        'tableLabel', nullif(i.metadata->>'table_label', ''),
        'tableTitle', nullif(i.metadata->>'table_title', ''),
        'tableRole', nullif(i.metadata->>'table_role', ''),
        'tableTextSnippet', nullif(left(coalesce(i.metadata->>'table_text_snippet', i.metadata->>'table_text', ''), 500), ''),
        'width', i.width,
        'height', i.height,
        'labels', i.labels,
        'metadata', i.metadata
      )
      order by i.page_number nulls last, i.created_at
    ),
    '[]'::jsonb
  )
  from public.document_images i
  where i.id = any(chunk_image_ids)
    and i.searchable = true
    and i.image_type <> 'logo_decorative';
$$;

create or replace function public.match_document_chunks(
  query_embedding vector(1536),
  match_count integer default 8,
  min_similarity double precision default 0.15,
  document_filter uuid default null,
  owner_filter uuid default null
)
returns table (
  id uuid,
  document_id uuid,
  title text,
  file_name text,
  page_number integer,
  chunk_index integer,
  section_heading text,
  content text,
  image_ids uuid[],
  source_metadata jsonb,
  similarity double precision,
  images jsonb
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select
    c.id,
    c.document_id,
    d.title,
    d.file_name,
    c.page_number,
    c.chunk_index,
    c.section_heading,
    c.content,
    c.image_ids,
    d.metadata as source_metadata,
    1 - (c.embedding <=> query_embedding) as similarity,
    public.chunk_image_metadata(c.image_ids) as images
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where (document_filter is null or c.document_id = document_filter)
    and (owner_filter is null or d.owner_id = owner_filter)
    and 1 - (c.embedding <=> query_embedding) >= min_similarity
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function public.match_document_chunks_hybrid(
  query_embedding vector(1536),
  query_text text,
  match_count integer default 12,
  min_similarity double precision default 0.12,
  document_filters uuid[] default null,
  owner_filter uuid default null
)
returns table (
  id uuid,
  document_id uuid,
  title text,
  file_name text,
  page_number integer,
  chunk_index integer,
  section_heading text,
  content text,
  image_ids uuid[],
  source_metadata jsonb,
  similarity double precision,
  text_rank double precision,
  hybrid_score double precision,
  rrf_score double precision,
  images jsonb
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  with query as (
    select websearch_to_tsquery('english', coalesce(query_text, '')) as tsq
  ),
  vector_ranked as (
    select
      c.id,
      c.document_id,
      c.page_number,
      c.chunk_index,
      c.section_heading,
      c.content,
      c.image_ids,
      1 - (c.embedding <=> query_embedding) as similarity,
      (
        ts_rank_cd(c.search_tsv, query.tsq) +
        (ts_rank_cd(d.title_search_tsv, query.tsq) * 3.0)
      )::double precision as text_rank,
      row_number() over (order by c.embedding <=> query_embedding) as vector_rank,
      null::bigint as text_match_rank
    from public.document_chunks c
    join public.documents d on d.id = c.document_id
    cross join query
    where (document_filters is null or c.document_id = any(document_filters))
      and (owner_filter is null or d.owner_id = owner_filter)
      and 1 - (c.embedding <=> query_embedding) >= min_similarity
    order by c.embedding <=> query_embedding
    limit greatest(match_count * 6, 48)
  ),
  text_ranked as (
    select
      c.id,
      c.document_id,
      c.page_number,
      c.chunk_index,
      c.section_heading,
      c.content,
      c.image_ids,
      1 - (c.embedding <=> query_embedding) as similarity,
      (
        ts_rank_cd(c.search_tsv, query.tsq) +
        (ts_rank_cd(d.title_search_tsv, query.tsq) * 3.0)
      )::double precision as text_rank,
      null::bigint as vector_rank,
      row_number() over (
        order by
          (
            ts_rank_cd(c.search_tsv, query.tsq) +
            (ts_rank_cd(d.title_search_tsv, query.tsq) * 3.0)
          ) desc,
          c.embedding <=> query_embedding
      ) as text_match_rank
    from public.document_chunks c
    join public.documents d on d.id = c.document_id
    cross join query
    where (document_filters is null or c.document_id = any(document_filters))
      and (owner_filter is null or d.owner_id = owner_filter)
      and (c.search_tsv @@ query.tsq or d.title_search_tsv @@ query.tsq)
    order by (
      ts_rank_cd(c.search_tsv, query.tsq) +
      (ts_rank_cd(d.title_search_tsv, query.tsq) * 3.0)
    ) desc
    limit greatest(match_count * 6, 48)
  ),
  combined as (
    select * from vector_ranked
    union all
    select * from text_ranked
  ),
  scored as (
    select
      id,
      document_id,
      page_number,
      chunk_index,
      section_heading,
      content,
      image_ids,
      max(similarity)::double precision as similarity,
      max(text_rank)::double precision as text_rank,
      min(vector_rank) as vector_rank,
      min(text_match_rank) as text_match_rank
    from combined
    group by id, document_id, page_number, chunk_index, section_heading, content, image_ids
  )
  select
    c.id,
    c.document_id,
    d.title,
    d.file_name,
    c.page_number,
    c.chunk_index,
    c.section_heading,
    c.content,
    c.image_ids,
    d.metadata as source_metadata,
    c.similarity,
    c.text_rank,
    ((c.similarity * 0.72) + (least(c.text_rank, 1) * 0.28))::double precision as hybrid_score,
    (
      coalesce(1.0 / (60 + c.vector_rank), 0) +
      coalesce(1.0 / (60 + c.text_match_rank), 0)
    )::double precision as rrf_score,
    public.chunk_image_metadata(c.image_ids) as images
  from scored c
  join public.documents d on d.id = c.document_id
  order by hybrid_score desc, c.similarity desc, c.text_rank desc
  limit match_count;
$$;

create or replace function public.match_document_memory_cards_hybrid(
  query_embedding vector(1536),
  query_text text,
  match_count integer default 32,
  min_similarity double precision default 0.1,
  document_filters uuid[] default null,
  owner_filter uuid default null
)
returns table (
  id uuid,
  document_id uuid,
  owner_id uuid,
  section_id uuid,
  card_type text,
  title text,
  content text,
  normalized_terms text[],
  page_number integer,
  source_chunk_ids uuid[],
  source_image_ids uuid[],
  confidence real,
  metadata jsonb,
  similarity double precision,
  text_rank double precision,
  hybrid_score double precision,
  rrf_score double precision
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  with query as (
    select websearch_to_tsquery('english', coalesce(query_text, '')) as tsq
  ),
  vector_ranked as (
    select
      m.*,
      1 - (m.embedding <=> query_embedding) as similarity,
      ts_rank_cd(m.search_tsv, query.tsq)::double precision as text_rank,
      row_number() over (order by m.embedding <=> query_embedding) as vector_rank,
      null::bigint as text_match_rank
    from public.document_memory_cards m
    join public.documents d on d.id = m.document_id
    cross join query
    where (document_filters is null or m.document_id = any(document_filters))
      and (owner_filter is null or d.owner_id = owner_filter)
      and 1 - (m.embedding <=> query_embedding) >= min_similarity
    order by m.embedding <=> query_embedding
    limit greatest(match_count * 4, 64)
  ),
  text_ranked as (
    select
      m.*,
      1 - (m.embedding <=> query_embedding) as similarity,
      ts_rank_cd(m.search_tsv, query.tsq)::double precision as text_rank,
      null::bigint as vector_rank,
      row_number() over (
        order by ts_rank_cd(m.search_tsv, query.tsq) desc, m.embedding <=> query_embedding
      ) as text_match_rank
    from public.document_memory_cards m
    join public.documents d on d.id = m.document_id
    cross join query
    where (document_filters is null or m.document_id = any(document_filters))
      and (owner_filter is null or d.owner_id = owner_filter)
      and m.search_tsv @@ query.tsq
    order by ts_rank_cd(m.search_tsv, query.tsq) desc
    limit greatest(match_count * 4, 64)
  ),
  combined as (
    select * from vector_ranked
    union all
    select * from text_ranked
  ),
  scored as (
    select
      id,
      document_id,
      owner_id,
      section_id,
      card_type,
      title,
      content,
      normalized_terms,
      page_number,
      source_chunk_ids,
      source_image_ids,
      confidence,
      metadata,
      max(similarity)::double precision as similarity,
      max(text_rank)::double precision as text_rank,
      min(vector_rank) as vector_rank,
      min(text_match_rank) as text_match_rank
    from combined
    group by
      id,
      document_id,
      owner_id,
      section_id,
      card_type,
      title,
      content,
      normalized_terms,
      page_number,
      source_chunk_ids,
      source_image_ids,
      confidence,
      metadata
  )
  select
    id,
    document_id,
    owner_id,
    section_id,
    card_type,
    title,
    content,
    normalized_terms,
    page_number,
    source_chunk_ids,
    source_image_ids,
    confidence,
    metadata,
    similarity,
    text_rank,
    ((similarity * 0.65) + (least(text_rank, 1) * 0.25) + (confidence * 0.10))::double precision as hybrid_score,
    (
      coalesce(1.0 / (60 + vector_rank), 0) +
      coalesce(1.0 / (60 + text_match_rank), 0)
    )::double precision as rrf_score
  from scored
  order by hybrid_score desc, similarity desc, text_rank desc, confidence desc
  limit match_count;
$$;

create or replace function public.match_documents_for_query(
  query_text text,
  match_count integer default 12,
  owner_filter uuid default null
)
returns table (
  id uuid,
  owner_id uuid,
  title text,
  file_name text,
  status text,
  page_count integer,
  chunk_count integer,
  image_count integer,
  metadata jsonb,
  text_rank double precision,
  match_reason text
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  with query as (
    select websearch_to_tsquery('english', coalesce(query_text, '')) as tsq
  ),
  ranked as (
    select
      d.id,
      d.owner_id,
      d.title,
      d.file_name,
      d.status,
      d.page_count,
      d.chunk_count,
      d.image_count,
      d.metadata,
      (
        (ts_rank_cd(d.title_search_tsv, query.tsq) * 4.0) +
        (ts_rank_cd(d.search_tsv, query.tsq) * 1.5)
      )::double precision as text_rank,
      case
        when d.title_search_tsv @@ query.tsq then 'title'
        when d.search_tsv @@ query.tsq then 'metadata'
        else 'none'
      end as match_reason
    from public.documents d
    cross join query
    where (owner_filter is null or d.owner_id = owner_filter)
      and d.status = 'indexed'
      and (d.title_search_tsv @@ query.tsq or d.search_tsv @@ query.tsq)
  )
  select *
  from ranked
  where text_rank > 0
  order by text_rank desc, page_count desc, title asc
  limit match_count;
$$;

create or replace function public.match_document_chunks_text(
  query_text text,
  match_count integer default 12,
  document_filters uuid[] default null,
  owner_filter uuid default null
)
returns table (
  id uuid,
  document_id uuid,
  title text,
  file_name text,
  page_number integer,
  chunk_index integer,
  section_heading text,
  content text,
  image_ids uuid[],
  source_metadata jsonb,
  similarity double precision,
  text_rank double precision,
  hybrid_score double precision,
  images jsonb
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  with query as (
    select websearch_to_tsquery('english', coalesce(query_text, '')) as tsq
  ),
  ranked as (
    select
      c.id,
      c.document_id,
      d.title,
      d.file_name,
      c.page_number,
      c.chunk_index,
      c.section_heading,
      c.content,
      c.image_ids,
      d.metadata as source_metadata,
      (
        ts_rank_cd(c.search_tsv, query.tsq) +
        (ts_rank_cd(d.title_search_tsv, query.tsq) * 3.0)
      )::double precision as text_rank
    from public.document_chunks c
    join public.documents d on d.id = c.document_id
    cross join query
    where (document_filters is null or c.document_id = any(document_filters))
      and (owner_filter is null or d.owner_id = owner_filter)
      and (c.search_tsv @@ query.tsq or d.title_search_tsv @@ query.tsq)
    order by (
      ts_rank_cd(c.search_tsv, query.tsq) +
      (ts_rank_cd(d.title_search_tsv, query.tsq) * 3.0)
    ) desc
    limit greatest(match_count * 5, 48)
  )
  select
    ranked.id,
    ranked.document_id,
    ranked.title,
    ranked.file_name,
    ranked.page_number,
    ranked.chunk_index,
    ranked.section_heading,
    ranked.content,
    ranked.image_ids,
    ranked.source_metadata,
    least(0.95, 0.56 + (least(ranked.text_rank, 1) * 0.39))::double precision as similarity,
    ranked.text_rank,
    least(0.97, 0.58 + (least(ranked.text_rank, 1) * 0.39))::double precision as hybrid_score,
    public.chunk_image_metadata(ranked.image_ids) as images
  from ranked
  order by hybrid_score desc, text_rank desc
  limit match_count;
$$;

create or replace function public.get_related_document_metadata(
  document_ids uuid[],
  owner_filter uuid default null
)
returns table (
  document_id uuid,
  labels jsonb,
  summary text
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select
    d.id as document_id,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', l.id,
            'document_id', l.document_id,
            'owner_id', l.owner_id,
            'label', l.label,
            'label_type', l.label_type,
            'source', l.source,
            'confidence', l.confidence,
            'metadata', l.metadata,
            'created_at', l.created_at,
            'updated_at', l.updated_at
          )
          order by l.confidence desc, l.label
        )
        from public.document_labels l
        where l.document_id = d.id
          and (owner_filter is null or l.owner_id = owner_filter)
      ),
      '[]'::jsonb
    ) as labels,
    (
      select s.summary
      from public.document_summaries s
      where s.document_id = d.id
        and (owner_filter is null or s.owner_id = owner_filter)
      order by s.generated_at desc
      limit 1
    ) as summary
  from public.documents d
  where d.id = any(document_ids)
    and (owner_filter is null or d.owner_id = owner_filter);
$$;

alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to service_role;
alter default privileges for role postgres in schema public
  grant execute on functions to service_role;

revoke usage on schema public from anon;
grant usage on schema public to authenticated, service_role;

revoke all privileges on all tables in schema public from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant select, insert, update, delete on table
  public.import_batches,
  public.documents,
  public.document_pages,
  public.document_images,
  public.image_caption_cache,
  public.document_labels,
  public.document_summaries,
  public.document_sections,
  public.document_memory_cards,
  public.document_chunks,
  public.ingestion_jobs,
  public.rag_queries,
  public.storage_cleanup_jobs
to service_role;

grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

grant select on table
  public.import_batches,
  public.documents,
  public.document_pages,
  public.document_images,
  public.document_labels,
  public.document_summaries,
  public.document_chunks,
  public.ingestion_jobs,
  public.rag_queries,
  public.storage_cleanup_jobs
to authenticated;

grant insert, update, delete on table public.document_labels to authenticated;

alter table public.import_batches enable row level security;
alter table public.documents enable row level security;
alter table public.document_pages enable row level security;
alter table public.document_images enable row level security;
alter table public.image_caption_cache enable row level security;
alter table public.document_labels enable row level security;
alter table public.document_summaries enable row level security;
alter table public.document_sections enable row level security;
alter table public.document_memory_cards enable row level security;
alter table public.document_chunks enable row level security;
alter table public.ingestion_jobs enable row level security;
alter table public.rag_queries enable row level security;
alter table public.storage_cleanup_jobs enable row level security;

create policy "import batches owner read" on public.import_batches
  for select to authenticated using (owner_id = (select auth.uid()));

create policy "documents owner read" on public.documents
  for select to authenticated using (owner_id = (select auth.uid()));

create policy "pages owner read" on public.document_pages
  for select to authenticated using (
    exists (select 1 from public.documents d where d.id = document_id and d.owner_id = (select auth.uid()))
  );

create policy "images owner read" on public.document_images
  for select to authenticated using (
    exists (select 1 from public.documents d where d.id = document_id and d.owner_id = (select auth.uid()))
  );

create policy "labels owner read" on public.document_labels
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "labels owner manual insert" on public.document_labels
  for insert to authenticated with check (owner_id = (select auth.uid()) and source = 'manual');
create policy "labels owner manual update" on public.document_labels
  for update to authenticated
  using (owner_id = (select auth.uid()) and source = 'manual')
  with check (owner_id = (select auth.uid()) and source = 'manual');
create policy "labels owner manual delete" on public.document_labels
  for delete to authenticated using (owner_id = (select auth.uid()) and source = 'manual');

create policy "summaries owner read" on public.document_summaries
  for select to authenticated using (owner_id = (select auth.uid()));

create policy "document sections owner all" on public.document_sections
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "document memory cards owner all" on public.document_memory_cards
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "image caption cache owner all" on public.image_caption_cache
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "chunks owner read" on public.document_chunks
  for select to authenticated using (
    exists (select 1 from public.documents d where d.id = document_id and d.owner_id = (select auth.uid()))
  );

create policy "jobs owner read" on public.ingestion_jobs
  for select to authenticated using (
    exists (select 1 from public.documents d where d.id = document_id and d.owner_id = (select auth.uid()))
  );

create policy "rag owner read" on public.rag_queries
  for select to authenticated using (owner_id = (select auth.uid()));

create policy "storage cleanup owner read" on public.storage_cleanup_jobs
  for select to authenticated using (owner_id = (select auth.uid()));

create policy "document storage owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'clinical-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "image storage owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'clinical-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
