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

alter table public.documents add column if not exists content_hash text;
alter table public.documents add column if not exists source_path text;
alter table public.documents add column if not exists import_batch_id uuid references public.import_batches(id) on delete set null;

alter table public.ingestion_jobs add column if not exists batch_id uuid references public.import_batches(id) on delete set null;
alter table public.ingestion_jobs add column if not exists attempt_count integer not null default 0;
alter table public.ingestion_jobs add column if not exists max_attempts integer not null default 3;
alter table public.ingestion_jobs add column if not exists locked_at timestamptz;
alter table public.ingestion_jobs add column if not exists locked_by text;
alter table public.ingestion_jobs add column if not exists next_run_at timestamptz not null default now();

create unique index if not exists documents_owner_content_hash_unique_idx
  on public.documents(owner_id, content_hash)
  where content_hash is not null;

create index if not exists import_batches_owner_status_idx on public.import_batches(owner_id, status, created_at desc);
create index if not exists documents_owner_status_idx on public.documents(owner_id, status, created_at desc);
create index if not exists documents_import_batch_idx on public.documents(import_batch_id);
create index if not exists documents_owner_hash_idx on public.documents(owner_id, content_hash);
create index if not exists document_pages_document_idx on public.document_pages(document_id, page_number);
create index if not exists document_images_document_idx on public.document_images(document_id, page_number);
create index if not exists ingestion_jobs_document_idx on public.ingestion_jobs(document_id);
create index if not exists ingestion_jobs_batch_idx on public.ingestion_jobs(batch_id, status);
create index if not exists ingestion_jobs_claim_idx
  on public.ingestion_jobs(status, next_run_at, created_at)
  where status in ('pending', 'processing');
create index if not exists rag_queries_owner_idx on public.rag_queries(owner_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
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
set search_path = public, pg_temp
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
set search_path = public, pg_temp
as $$
begin
  delete from public.document_chunks where document_id = p_document_id;
  delete from public.document_images where document_id = p_document_id;
  delete from public.document_pages where document_id = p_document_id;
end;
$$;

drop function if exists public.match_document_chunks(vector, integer, double precision, uuid);
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
set search_path = public, pg_temp
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
    and (owner_filter is null or d.owner_id = owner_filter)
    and 1 - (c.embedding <=> query_embedding) >= min_similarity
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

drop function if exists public.match_document_chunks_hybrid(vector, text, integer, double precision, uuid[]);
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
  images jsonb
)
language sql
stable
set search_path = public, pg_temp
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
    join public.documents d on d.id = c.document_id
    cross join query
    where (document_filters is null or c.document_id = any(document_filters))
      and (owner_filter is null or d.owner_id = owner_filter)
      and 1 - (c.embedding <=> query_embedding) >= min_similarity
    order by c.embedding <=> query_embedding
    limit greatest(match_count * 6, 48)
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
    join public.documents d on d.id = c.document_id
    cross join query
    where (document_filters is null or c.document_id = any(document_filters))
      and (owner_filter is null or d.owner_id = owner_filter)
      and c.search_tsv @@ query.tsq
    order by ts_rank_cd(c.search_tsv, query.tsq) desc
    limit greatest(match_count * 6, 48)
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
    d.metadata as source_metadata,
    c.similarity,
    c.text_rank,
    ((c.similarity * 0.72) + (least(c.text_rank, 1) * 0.28))::double precision as hybrid_score,
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

grant select, insert, update, delete on table public.import_batches to service_role;
grant select on table public.import_batches to authenticated;
grant execute on function public.claim_ingestion_jobs(text, integer, integer) to service_role;
grant execute on function public.reset_document_index(uuid) to service_role;

alter table public.import_batches enable row level security;

drop policy if exists "import batches owner read" on public.import_batches;
create policy "import batches owner read" on public.import_batches
  for select to authenticated using (owner_id = (select auth.uid()));

drop policy if exists "documents owner read" on public.documents;
drop policy if exists "documents owner write" on public.documents;
drop policy if exists "pages owner read" on public.document_pages;
drop policy if exists "images owner read" on public.document_images;
drop policy if exists "chunks owner read" on public.document_chunks;
drop policy if exists "jobs owner read" on public.ingestion_jobs;
drop policy if exists "rag owner read" on public.rag_queries;
drop policy if exists "rag owner insert" on public.rag_queries;

create policy "documents owner read" on public.documents
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "documents owner write" on public.documents
  for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy "pages owner read" on public.document_pages
  for select to authenticated using (
    exists (select 1 from public.documents d where d.id = document_id and d.owner_id = (select auth.uid()))
  );

create policy "images owner read" on public.document_images
  for select to authenticated using (
    exists (select 1 from public.documents d where d.id = document_id and d.owner_id = (select auth.uid()))
  );

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
create policy "rag owner insert" on public.rag_queries
  for insert to authenticated with check (owner_id = (select auth.uid()));

drop policy if exists "document storage owner read" on storage.objects;
drop policy if exists "image storage owner read" on storage.objects;

create policy "document storage owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'clinical-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "image storage owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'clinical-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
