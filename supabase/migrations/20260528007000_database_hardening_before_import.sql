-- Harden Data API exposure before large imports.
-- The app uses server-owned API routes for writes, so browser roles only need
-- read access plus manual document-label edits.

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

grant select, insert, update, delete on all tables in schema public to service_role;
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
  public.rag_queries
to authenticated;

grant insert, update, delete on table public.document_labels to authenticated;

drop policy if exists "documents owner insert" on public.documents;
drop policy if exists "documents owner update" on public.documents;
drop policy if exists "documents owner delete" on public.documents;
drop policy if exists "rag owner insert" on public.rag_queries;

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

create index if not exists storage_cleanup_jobs_owner_status_idx
  on public.storage_cleanup_jobs(owner_id, status, created_at desc);
create index if not exists storage_cleanup_jobs_document_idx
  on public.storage_cleanup_jobs(document_id);
create index if not exists rag_queries_source_chunk_ids_gin_idx
  on public.rag_queries using gin(source_chunk_ids);

drop trigger if exists storage_cleanup_jobs_updated_at on public.storage_cleanup_jobs;
create trigger storage_cleanup_jobs_updated_at
before update on public.storage_cleanup_jobs
for each row execute function public.set_updated_at();

alter table public.storage_cleanup_jobs enable row level security;

drop policy if exists "storage cleanup owner read" on public.storage_cleanup_jobs;
create policy "storage cleanup owner read" on public.storage_cleanup_jobs
for select to authenticated
using ((select auth.uid()) = owner_id);

grant select, insert, update, delete on table public.storage_cleanup_jobs to service_role;
revoke all privileges on table public.storage_cleanup_jobs from anon, authenticated;
grant select on table public.storage_cleanup_jobs to authenticated;
