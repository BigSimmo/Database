-- Medical RAG Knowledge Base schema.
-- Run this in the Supabase SQL editor or with the Supabase CLI.
-- Tables are RLS protected; the local Next.js API and worker use the service role.

create extension if not exists vector;
create extension if not exists pg_trgm;
create extension if not exists "uuid-ossp";

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

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  file_name text not null,
  file_type text not null,
  file_size bigint not null default 0,
  storage_path text not null,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'indexed', 'failed')),
  page_count integer not null default 0,
  chunk_count integer not null default 0,
  image_count integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
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
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
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
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  stage text not null default 'queued',
  progress integer not null default 0 check (progress between 0 and 100),
  error_message text,
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

create index if not exists documents_status_idx on public.documents(status);
create index if not exists document_chunks_document_idx on public.document_chunks(document_id, chunk_index);
create index if not exists document_chunks_search_idx on public.document_chunks using gin(search_tsv);
create index if not exists document_chunks_embedding_hnsw_idx
  on public.document_chunks using hnsw (embedding vector_cosine_ops);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists documents_updated_at on public.documents;
create trigger documents_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

drop trigger if exists ingestion_jobs_updated_at on public.ingestion_jobs;
create trigger ingestion_jobs_updated_at
before update on public.ingestion_jobs
for each row execute function public.set_updated_at();

create or replace function public.match_document_chunks(
  query_embedding vector(1536),
  match_count integer default 8,
  min_similarity double precision default 0.15,
  document_filter uuid default null
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
  similarity double precision,
  images jsonb
)
language sql
stable
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
    1 - (c.embedding <=> query_embedding) as similarity,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', i.id,
            'page_number', i.page_number,
            'storage_path', i.storage_path,
            'caption', i.caption,
            'bbox', i.bbox
          )
        )
        from public.document_images i
        where i.id = any(c.image_ids)
      ),
      '[]'::jsonb
    ) as images
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where (document_filter is null or c.document_id = document_filter)
    and 1 - (c.embedding <=> query_embedding) >= min_similarity
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function public.match_document_chunks_hybrid(
  query_embedding vector(1536),
  query_text text,
  match_count integer default 12,
  min_similarity double precision default 0.12,
  document_filters uuid[] default null
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
  similarity double precision,
  text_rank double precision,
  hybrid_score double precision,
  images jsonb
)
language sql
stable
as $$
  with query as (
    select websearch_to_tsquery('english', coalesce(query_text, '')) as tsq
  ),
  vector_candidates as (
    select
      c.id,
      c.document_id,
      c.page_number,
      c.chunk_index,
      c.section_heading,
      c.content,
      c.image_ids,
      1 - (c.embedding <=> query_embedding) as similarity,
      ts_rank_cd(c.search_tsv, query.tsq)::double precision as text_rank
    from public.document_chunks c
    cross join query
    where (document_filters is null or c.document_id = any(document_filters))
      and 1 - (c.embedding <=> query_embedding) >= min_similarity
    order by c.embedding <=> query_embedding
    limit greatest(match_count * 4, 24)
  ),
  text_candidates as (
    select
      c.id,
      c.document_id,
      c.page_number,
      c.chunk_index,
      c.section_heading,
      c.content,
      c.image_ids,
      1 - (c.embedding <=> query_embedding) as similarity,
      ts_rank_cd(c.search_tsv, query.tsq)::double precision as text_rank
    from public.document_chunks c
    cross join query
    where (document_filters is null or c.document_id = any(document_filters))
      and c.search_tsv @@ query.tsq
    order by ts_rank_cd(c.search_tsv, query.tsq) desc
    limit greatest(match_count * 4, 24)
  ),
  combined as (
    select * from vector_candidates
    union
    select * from text_candidates
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
    c.similarity,
    c.text_rank,
    ((c.similarity * 0.75) + (least(c.text_rank, 1) * 0.25))::double precision as hybrid_score,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', i.id,
            'page_number', i.page_number,
            'storage_path', i.storage_path,
            'caption', i.caption,
            'bbox', i.bbox
          )
        )
        from public.document_images i
        where i.id = any(c.image_ids)
      ),
      '[]'::jsonb
    ) as images
  from combined c
  join public.documents d on d.id = c.document_id
  order by hybrid_score desc, c.similarity desc, c.text_rank desc
  limit match_count;
$$;

alter table public.documents enable row level security;
alter table public.document_pages enable row level security;
alter table public.document_images enable row level security;
alter table public.document_chunks enable row level security;
alter table public.ingestion_jobs enable row level security;
alter table public.rag_queries enable row level security;

create policy "documents owner read" on public.documents
  for select to authenticated using (owner_id = auth.uid());
create policy "documents owner write" on public.documents
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "pages owner read" on public.document_pages
  for select to authenticated using (
    exists (select 1 from public.documents d where d.id = document_id and d.owner_id = auth.uid())
  );

create policy "images owner read" on public.document_images
  for select to authenticated using (
    exists (select 1 from public.documents d where d.id = document_id and d.owner_id = auth.uid())
  );

create policy "chunks owner read" on public.document_chunks
  for select to authenticated using (
    exists (select 1 from public.documents d where d.id = document_id and d.owner_id = auth.uid())
  );

create policy "jobs owner read" on public.ingestion_jobs
  for select to authenticated using (
    exists (select 1 from public.documents d where d.id = document_id and d.owner_id = auth.uid())
  );

create policy "rag owner read" on public.rag_queries
  for select to authenticated using (owner_id = auth.uid());
create policy "rag owner insert" on public.rag_queries
  for insert to authenticated with check (owner_id = auth.uid());

create policy "document storage owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'clinical-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "image storage owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'clinical-images' and (storage.foldername(name))[1] = auth.uid()::text);
