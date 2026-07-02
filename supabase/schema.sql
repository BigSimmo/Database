-- Medical RAG Knowledge Base schema.
-- Run this in the Supabase SQL editor or with the Supabase CLI.
-- Tables are RLS protected; the local Next.js API and worker use the service role.
--
-- IDX-C2: every embedding column below is vector(1536). This dimension is coupled to the
-- EMBEDDING_DIMENSIONS env var (default 1536) and the OPENAI_EMBEDDING_MODEL. If you change
-- the embedding model, update EMBEDDING_DIMENSIONS AND every vector(N) below together; the
-- worker hard-fails at startup (checkEmbeddingDimension) when they disagree.

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
      'site',
      'topic',
      'document_type',
      'medication',
      'risk',
      'setting',
      'workflow',
      'population',
      'service',
      'clinical_action',
      'care_phase',
      'document_intent',
      'content_feature',
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
      'askable_question',
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
  embedding extensions.vector(1536) not null,
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
  section_path text[] not null default '{}',
  heading_level integer,
  parent_heading text,
  anchor_id text,
  content text not null,
  retrieval_synopsis text,
  content_hash text not null,
  index_generation_id uuid,
  token_estimate integer not null default 0,
  image_ids uuid[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  embedding extensions.vector(1536) not null,
  search_tsv tsvector generated always as (
    to_tsvector('english', coalesce(section_heading, '') || ' ' || coalesce(retrieval_synopsis, '') || ' ' || content)
  ) stored,
  created_at timestamptz not null default now()
);

create table if not exists public.document_table_facts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  document_id uuid not null references public.documents(id) on delete cascade,
  source_chunk_id uuid references public.document_chunks(id) on delete cascade,
  source_image_id uuid references public.document_images(id) on delete set null,
  page_number integer,
  table_title text,
  row_label text,
  clinical_parameter text,
  threshold_value text,
  action text,
  normalized_terms text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  search_tsv tsvector generated always as (
    to_tsvector(
      'english',
      coalesce(table_title, '') || ' ' ||
      coalesce(row_label, '') || ' ' ||
      coalesce(clinical_parameter, '') || ' ' ||
      coalesce(threshold_value, '') || ' ' ||
      coalesce(action, '')
    )
  ) stored,
  created_at timestamptz not null default now()
);

create table if not exists public.document_embedding_fields (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  document_id uuid not null references public.documents(id) on delete cascade,
  source_chunk_id uuid references public.document_chunks(id) on delete cascade,
  field_type text not null check (
    field_type in (
      'document_title',
      'document_summary',
      'section_context',
      'memory_card',
      'chunk_high_yield',
      'table_row',
      'image_caption',
      'clinical_action',
      'threshold_fact'
    )
  ),
  content text not null,
  content_hash text,
  embedding extensions.vector(1536) not null,
  metadata jsonb not null default '{}'::jsonb,
  search_tsv tsvector generated always as (to_tsvector('english', content)) stored,
  created_at timestamptz not null default now()
);

create table if not exists public.document_index_quality (
  document_id uuid primary key references public.documents(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete set null,
  quality_score real not null default 0 check (quality_score >= 0 and quality_score <= 1),
  extraction_quality text not null default 'unknown'
    check (extraction_quality in ('good', 'partial', 'poor', 'unknown')),
  metrics jsonb not null default '{}'::jsonb,
  issues text[] not null default '{}',
  updated_at timestamptz not null default now()
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

create table if not exists public.ingestion_job_stages (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.ingestion_jobs(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  stage_name text not null,
  stage_status text not null default 'started'
    check (stage_status in ('started', 'completed', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  artifact_counts jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
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

create table if not exists public.rag_query_misses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  query text not null,
  normalized_query text not null,
  query_class text,
  route text,
  retrieval_strategy text,
  top_score double precision,
  top_files text[] not null default '{}',
  top_chunk_ids uuid[] not null default '{}',
  expected_file text,
  clicked_document_id uuid,
  clicked_chunk_id uuid,
  cited_chunk_ids uuid[] not null default '{}',
  miss_reason text not null default 'weak_search',
  candidate_aliases text[] not null default '{}',
  candidate_labels jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  review_status text not null default 'new'
    check (review_status in ('new', 'fixed', 'not_in_corpus', 'ambiguous', 'ignored')),
  expected_document_id uuid references public.documents(id) on delete set null,
  expected_chunk_id uuid references public.document_chunks(id) on delete set null,
  review_notes text,
  reviewed_at timestamptz,
  promoted_eval_case boolean not null default false,
  promoted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.rag_aliases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  alias text not null,
  canonical text not null,
  alias_type text not null
    check (alias_type in ('medication', 'document_title', 'acronym', 'service', 'workflow', 'typo', 'clinical_term', 'custom')),
  weight real not null default 1.0,
  enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rag_aliases_alias_nonempty check (btrim(alias) <> ''),
  constraint rag_aliases_canonical_nonempty check (btrim(canonical) <> '')
);

create table if not exists public.rag_response_cache (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  cache_kind text not null check (cache_kind in ('search', 'answer')),
  scope_key text not null,
  normalized_query text not null,
  indexing_version text not null default 'rag-deep-memory-v1',
  dependency_version text not null default 'rag-cache-v1',
  payload jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rag_retrieval_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  query text not null,
  normalized_query text,
  query_class text,
  retrieval_strategy text,
  candidate_count integer not null default 0,
  top_similarity double precision,
  top_text_rank double precision,
  top_hybrid_score double precision,
  top_rrf_score double precision,
  mean_hybrid_score double precision,
  selected_chunk_ids uuid[] not null default '{}',
  selected_document_ids uuid[] not null default '{}',
  selected_count integer not null default 0,
  embedding_latency_ms integer,
  rpc_latency_ms integer,
  rerank_latency_ms integer,
  total_latency_ms integer,
  vector_candidate_count integer,
  text_candidate_count integer,
  memory_card_count integer,
  index_unit_count integer,
  embedding_field_count integer,
  is_miss boolean not null default false,
  miss_reason text,
  embedding_cache_hit boolean,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.api_rate_limits (
  owner_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (owner_id, bucket),
  constraint api_rate_limits_bucket_nonempty check (btrim(bucket) <> '')
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_action_nonempty check (btrim(action) <> '')
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
create index if not exists documents_indexed_owner_title_idx
  on public.documents(owner_id, title, file_name)
  where status = 'indexed';
create index if not exists documents_title_trgm_idx
  on public.documents using gin (lower(coalesce(title, '') || ' ' || coalesce(file_name, '')) gin_trgm_ops);
create index if not exists document_pages_document_idx on public.document_pages(document_id, page_number);
create index if not exists document_images_document_idx on public.document_images(document_id, page_number);
create index if not exists document_images_searchable_idx
  on public.document_images(document_id, searchable, image_type, page_number);
create index if not exists document_images_hash_idx
  on public.document_images(document_id, image_hash)
  where image_hash is not null;
create index if not exists document_images_visual_intelligence_version_idx
  on public.document_images ((metadata->>'visual_intelligence_version'))
  where metadata ? 'visual_intelligence_version';
create index if not exists document_images_visual_family_idx
  on public.document_images ((metadata->>'visual_family_id'))
  where metadata ? 'visual_family_id';
create index if not exists document_images_structured_profile_gin_idx
  on public.document_images using gin ((metadata->'structured_visual_profile'));
create index if not exists image_caption_cache_owner_hash_idx
  on public.image_caption_cache(owner_id, image_hash, model);
create index if not exists document_labels_owner_label_idx
  on public.document_labels(owner_id, label_type, label);
create index if not exists document_labels_document_idx on public.document_labels(document_id);
create index if not exists document_labels_label_trgm_idx
  on public.document_labels using gin (lower(label) gin_trgm_ops);
create index if not exists document_summaries_owner_idx on public.document_summaries(owner_id, generated_at desc);
create index if not exists document_summaries_summary_trgm_idx
  on public.document_summaries using gin (lower(summary) gin_trgm_ops);
create index if not exists document_sections_document_idx
  on public.document_sections(document_id, section_index);
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
create index if not exists document_memory_cards_embedding_hnsw_idx
  on public.document_memory_cards using hnsw (embedding vector_cosine_ops)
  with (m = 24, ef_construction = 128);
create index if not exists document_chunks_document_idx on public.document_chunks(document_id, chunk_index);
create index if not exists document_chunks_generation_idx on public.document_chunks(document_id, index_generation_id);
create unique index if not exists document_chunks_document_generation_chunk_idx
  on public.document_chunks(document_id, index_generation_id, chunk_index)
  where index_generation_id is not null;
create index if not exists document_chunks_content_hash_idx on public.document_chunks(document_id, content_hash);
create index if not exists document_chunks_section_path_gin_idx
  on public.document_chunks using gin(section_path);
create index if not exists document_chunks_anchor_idx
  on public.document_chunks(document_id, anchor_id)
  where anchor_id is not null;
create index if not exists document_chunks_search_idx on public.document_chunks using gin(search_tsv);
create index if not exists document_chunks_content_trgm_idx
  on public.document_chunks using gin (lower(coalesce(section_heading, '') || ' ' || coalesce(content, '')) gin_trgm_ops);
create index if not exists document_chunks_embedding_hnsw_idx
  on public.document_chunks using hnsw (embedding vector_cosine_ops)
  with (m = 24, ef_construction = 128);
create index if not exists document_table_facts_document_idx
  on public.document_table_facts(document_id, page_number);
create index if not exists document_table_facts_chunk_idx
  on public.document_table_facts(source_chunk_id);
create index if not exists document_table_facts_search_idx
  on public.document_table_facts using gin(search_tsv);
create index if not exists document_table_facts_terms_idx
  on public.document_table_facts using gin(normalized_terms);
create index if not exists document_table_facts_owner_idx
  on public.document_table_facts(owner_id);
create index if not exists document_table_facts_owner_document_page_idx
  on public.document_table_facts(owner_id, document_id, page_number);
create index if not exists document_table_facts_source_image_idx
  on public.document_table_facts(source_image_id)
  where source_image_id is not null;
create index if not exists document_embedding_fields_document_idx
  on public.document_embedding_fields(document_id, field_type);
create index if not exists document_embedding_fields_owner_id_idx
  on public.document_embedding_fields(owner_id);
create index if not exists document_embedding_fields_owner_chunk_idx
  on public.document_embedding_fields(owner_id, source_chunk_id)
  where source_chunk_id is not null;
create index if not exists document_embedding_fields_owner_document_created_idx
  on public.document_embedding_fields(owner_id, document_id, created_at desc);
create index if not exists document_embedding_fields_source_chunk_id_idx
  on public.document_embedding_fields(source_chunk_id);
create index if not exists document_embedding_fields_meta_rag_indexing_version_idx
  on public.document_embedding_fields((metadata->>'rag_indexing_version'));
create index if not exists document_embedding_fields_search_tsv_chunk_gin_idx
  on public.document_embedding_fields using gin(search_tsv)
  where source_chunk_id is not null;
create index if not exists document_embedding_fields_embedding_hnsw_idx
  on public.document_embedding_fields using hnsw (embedding vector_cosine_ops)
  with (m = 24, ef_construction = 128);
create unique index if not exists document_embedding_fields_dedup_idx
  on public.document_embedding_fields(document_id, source_chunk_id, field_type, content_hash);

create or replace function public.set_document_embedding_field_content_hash()
returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    NEW.content_hash := md5(coalesce(NEW.content, ''));
  elsif tg_op = 'UPDATE' then
    if NEW.content_hash is null or NEW.content is distinct from OLD.content then
      NEW.content_hash := md5(coalesce(NEW.content, ''));
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists set_document_embedding_field_content_hash on public.document_embedding_fields;
create trigger set_document_embedding_field_content_hash
before insert or update
on public.document_embedding_fields
for each row
execute function public.set_document_embedding_field_content_hash();

create index if not exists document_index_quality_owner_score_idx
  on public.document_index_quality(owner_id, quality_score, updated_at desc);
create index if not exists ingestion_jobs_document_idx on public.ingestion_jobs(document_id);
create index if not exists ingestion_jobs_batch_idx on public.ingestion_jobs(batch_id, status);
create index if not exists ingestion_jobs_claim_idx
  on public.ingestion_jobs(status, next_run_at, created_at)
  where status in ('pending', 'processing');
create index if not exists ingestion_jobs_status_next_run_idx
  on public.ingestion_jobs(status, next_run_at, created_at)
  where status in ('pending', 'processing', 'failed');
create index if not exists ingestion_jobs_document_status_idx
  on public.ingestion_jobs(document_id, status, created_at);
drop index if exists public.ingestion_job_stages_doc_idx;
create index if not exists ingestion_job_stages_document_started_idx
  on public.ingestion_job_stages(document_id, started_at desc);
create index if not exists ingestion_job_stages_job_stage_started_idx
  on public.ingestion_job_stages(job_id, stage_name, started_at desc);
create index if not exists documents_indexing_v3_agent_claim_idx
  on public.documents(status, ((metadata->>'enrichment_status')), ((metadata->>'indexing_v3_agent_status')), updated_at)
  where status = 'indexed';
create index if not exists import_batches_status_created_idx
  on public.import_batches(status, created_at desc)
  where status in ('queued', 'processing');
create index if not exists storage_cleanup_jobs_status_created_idx
  on public.storage_cleanup_jobs(status, created_at)
  where status in ('pending', 'failed');
create index if not exists rag_queries_owner_idx on public.rag_queries(owner_id, created_at desc);
create index if not exists rag_queries_source_chunk_ids_gin_idx
  on public.rag_queries using gin(source_chunk_ids);
create index if not exists rag_query_misses_owner_created_idx
  on public.rag_query_misses(owner_id, created_at desc);
create index if not exists rag_query_misses_owner_review_status_created_idx
  on public.rag_query_misses(owner_id, review_status, created_at desc);
create index if not exists rag_query_misses_normalized_idx
  on public.rag_query_misses(normalized_query, created_at desc);
create index if not exists rag_query_misses_aliases_idx
  on public.rag_query_misses using gin(candidate_aliases);
create index if not exists rag_aliases_owner_enabled_idx
  on public.rag_aliases(owner_id, enabled);
create index if not exists rag_aliases_type_enabled_idx
  on public.rag_aliases(alias_type, enabled);
create index if not exists rag_aliases_alias_trgm_idx
  on public.rag_aliases using gin (lower(alias) gin_trgm_ops);
create index if not exists rag_response_cache_expiry_idx
  on public.rag_response_cache(expires_at);
create index if not exists rag_response_cache_owner_kind_idx
  on public.rag_response_cache(owner_id, cache_kind, updated_at desc);
create unique index if not exists rag_response_cache_key_idx
  on public.rag_response_cache(
    coalesce(owner_id, '00000000-0000-0000-0000-000000000000'::uuid),
    cache_kind,
    scope_key,
    normalized_query,
    indexing_version,
    dependency_version
  );
create index if not exists storage_cleanup_jobs_owner_status_idx
  on public.storage_cleanup_jobs(owner_id, status, created_at desc);
create index if not exists storage_cleanup_jobs_document_idx
  on public.storage_cleanup_jobs(document_id);

create index if not exists rag_retrieval_logs_owner_created_idx
  on public.rag_retrieval_logs(owner_id, created_at desc);
create index if not exists rag_retrieval_logs_miss_idx
  on public.rag_retrieval_logs(is_miss, created_at desc)
  where is_miss = true;
create index if not exists rag_retrieval_logs_strategy_idx
  on public.rag_retrieval_logs(retrieval_strategy, created_at desc);
create index if not exists api_rate_limits_bucket_updated_idx
  on public.api_rate_limits(bucket, updated_at desc);
create index if not exists audit_logs_owner_created_idx
  on public.audit_logs(owner_id, created_at desc);
create index if not exists audit_logs_action_created_idx
  on public.audit_logs(action, created_at desc);

-- Redundant single-column FK indexes removed (covered by composite indexes
-- with the same leading column, e.g. document_chunks_document_idx).

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

create or replace function public.consume_api_rate_limit(
  p_owner_id uuid,
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  limited boolean,
  limit_value integer,
  remaining integer,
  retry_after_seconds integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz := v_now;
  v_count integer;
  v_reset_at timestamptz;
begin
  if p_owner_id is null then
    raise exception 'owner_id is required';
  end if;
  if p_bucket is null or btrim(p_bucket) = '' then
    raise exception 'bucket is required';
  end if;
  if p_limit < 1 then
    raise exception 'limit must be positive';
  end if;
  if p_window_seconds < 1 then
    raise exception 'window must be positive';
  end if;

  loop
    update public.api_rate_limits
    set
      window_start = case
        when window_start + make_interval(secs => p_window_seconds) <= v_now then v_window_start
        else window_start
      end,
      request_count = case
        when window_start + make_interval(secs => p_window_seconds) <= v_now then 1
        else request_count + 1
      end,
      updated_at = v_now
    where owner_id = p_owner_id
      and bucket = p_bucket
    returning request_count, window_start + make_interval(secs => p_window_seconds)
      into v_count, v_reset_at;

    exit when found;

    begin
      insert into public.api_rate_limits(owner_id, bucket, window_start, request_count, updated_at)
      values (p_owner_id, p_bucket, v_window_start, 1, v_now)
      returning request_count, window_start + make_interval(secs => p_window_seconds)
        into v_count, v_reset_at;
      exit;
    exception when unique_violation then
    end;
  end loop;

  return query
  select
    v_count > p_limit as limited,
    p_limit as limit_value,
    greatest(p_limit - v_count, 0) as remaining,
    greatest(1, ceiling(extract(epoch from (v_reset_at - v_now)))::integer) as retry_after_seconds,
    v_reset_at as reset_at;
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

drop trigger if exists rag_response_cache_updated_at on public.rag_response_cache;
create trigger rag_response_cache_updated_at
before update on public.rag_response_cache
for each row execute function public.set_updated_at();

drop trigger if exists rag_aliases_updated_at on public.rag_aliases;
create trigger rag_aliases_updated_at
before update on public.rag_aliases
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
  with eligible as (
    select
      j.id,
      row_number() over (partition by j.document_id order by j.created_at asc, j.id asc) as document_rank
    from public.ingestion_jobs j
    where j.attempt_count < j.max_attempts
      and (
        (j.status = 'pending' and coalesce(j.next_run_at, now()) <= now())
        or (
          j.status = 'processing'
          and j.locked_at is not null
          and j.locked_at < now() - make_interval(mins => p_stale_after_minutes)
        )
      )
      and not exists (
        select 1
        from public.ingestion_jobs active
        where active.document_id = j.document_id
          and active.id <> j.id
          and active.status = 'processing'
          and active.locked_at is not null
          and active.locked_at >= now() - make_interval(mins => p_stale_after_minutes)
      )
  ),
  candidates as (
    select j.id
    from eligible e
    join public.ingestion_jobs j on j.id = e.id
    join public.documents d on d.id = j.document_id
    where e.document_rank = 1
    order by j.created_at asc, j.id asc
    limit greatest(p_claim_limit, 1)
    for update of j, d skip locked
  ),
  claimed as (
    update public.ingestion_jobs j
    set
      status = 'processing',
      stage = case
        when j.status = 'processing' then 'reclaimed stale job'
        when j.stage in ('queued', 'failed') then 'claimed'
        else j.stage
      end,
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

create or replace function public.claim_indexing_v3_agent_jobs(
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
  with eligible as (
    select
      d.id,
      d.import_batch_id,
      state.attempt_count,
      state.max_attempts
    from public.documents d
    cross join lateral (
      select
        coalesce(d.metadata->>'enrichment_status', 'pending') as enrichment_status,
        coalesce(d.metadata->>'indexing_v3_agent_status', 'pending') as agent_status,
        case
          when coalesce(d.metadata->>'indexing_v3_agent_attempt_count', '') ~ '^[0-9]+$'
            then (d.metadata->>'indexing_v3_agent_attempt_count')::integer
          else 0
        end as attempt_count,
        greatest(
          case
            when coalesce(d.metadata->>'indexing_v3_agent_max_attempts', '') ~ '^[0-9]+$'
              then (d.metadata->>'indexing_v3_agent_max_attempts')::integer
            else 3
          end,
          1
        ) as max_attempts,
        case
          when coalesce(d.metadata->>'indexing_v3_agent_locked_at', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
            then (d.metadata->>'indexing_v3_agent_locked_at')::timestamptz
          else null
        end as locked_at,
        case
          when coalesce(d.metadata->>'indexing_v3_agent_next_run_at', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
            then (d.metadata->>'indexing_v3_agent_next_run_at')::timestamptz
          else null
        end as next_run_at
    ) state
    where d.status = 'indexed'
      and state.enrichment_status in ('pending', 'failed', 'processing')
      and state.agent_status not in ('completed', 'needs_enrichment_artifacts')
      and state.attempt_count < state.max_attempts
      and coalesce(state.next_run_at, now()) <= now()
      and (
        state.agent_status <> 'processing'
        or state.locked_at is null
        or state.locked_at < now() - make_interval(mins => p_stale_after_minutes)
      )
    order by coalesce(state.next_run_at, d.updated_at), d.id
    limit greatest(p_claim_limit, 1)
    for update of d skip locked
  ),
  claimed as (
    update public.documents d
    set
      metadata = jsonb_strip_nulls(
        (coalesce(d.metadata, '{}'::jsonb)
          - 'indexing_v3_agent_next_run_at'
          - 'indexing_v3_agent_last_error')
        || jsonb_build_object(
          'indexing_v3_agent_status', 'processing',
          'indexing_v3_agent_version', 'visual-core-v3',
          'indexing_v3_agent_locked_by', p_worker_id,
          'indexing_v3_agent_locked_at', now(),
          'indexing_v3_agent_attempt_count', e.attempt_count + 1,
          'indexing_v3_agent_max_attempts', e.max_attempts,
          'indexing_v3_agent_updated_at', now(),
          'enrichment_status', 'processing'
        )
      ),
      updated_at = now()
    from eligible e
    where d.id = e.id
    returning d.*, e.attempt_count + 1 as claimed_attempt_count, e.max_attempts as claimed_max_attempts
  )
  select
    c.id,
    c.id as document_id,
    c.import_batch_id as batch_id,
    'processing'::text as status,
    'v3 enrichment claimed'::text as stage,
    95::integer as progress,
    null::text as error_message,
    c.claimed_attempt_count,
    c.claimed_max_attempts,
    (c.metadata->>'indexing_v3_agent_locked_at')::timestamptz as locked_at,
    c.metadata->>'indexing_v3_agent_locked_by' as locked_by,
    to_jsonb(c.*) - 'claimed_attempt_count' - 'claimed_max_attempts' as documents
  from claimed c;
end;
$$;

create or replace function public.reset_document_index(p_document_id uuid)
returns void
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  perform set_config('statement_timeout', '180000', true);
  delete from public.document_memory_cards where document_id = p_document_id;
  delete from public.document_sections where document_id = p_document_id;
  delete from public.document_table_facts where document_id = p_document_id;
  delete from public.document_embedding_fields where document_id = p_document_id;
  delete from public.document_index_quality where document_id = p_document_id;
  delete from public.document_chunks where document_id = p_document_id;
  delete from public.document_images where document_id = p_document_id;
  delete from public.document_pages where document_id = p_document_id;
end;
$$;

create or replace function public.commit_document_index_generation(
  p_document_id uuid,
  p_index_generation_id uuid,
  p_status text default 'indexed',
  p_page_count integer default 0,
  p_chunk_count integer default 0,
  p_image_count integer default 0,
  p_metadata jsonb default '{}'::jsonb,
  p_pages jsonb default null,
  p_quality jsonb default null
)
returns jsonb
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  perform set_config('statement_timeout', '180000', true);

  update public.documents
  set
    status = p_status,
    page_count = p_page_count,
    chunk_count = p_chunk_count,
    image_count = p_image_count,
    error_message = null,
    metadata = coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('index_generation_id', p_index_generation_id),
    updated_at = now()
  where id = p_document_id;

  if p_pages is not null then
    delete from public.document_pages
    where document_id = p_document_id;

    insert into public.document_pages (document_id, page_number, text, ocr_used, metadata)
    select
      p_document_id,
      page_row.page_number,
      coalesce(page_row.text, ''),
      coalesce(page_row.ocr_used, false),
      coalesce(page_row.metadata, '{}'::jsonb)
    from jsonb_to_recordset(coalesce(p_pages, '[]'::jsonb)) as page_row(
      page_number integer,
      text text,
      ocr_used boolean,
      metadata jsonb
    )
    where page_row.page_number is not null;
  end if;

  if p_quality is not null then
    insert into public.document_index_quality (
      document_id,
      owner_id,
      quality_score,
      extraction_quality,
      metrics,
      issues,
      updated_at
    )
    values (
      p_document_id,
      nullif(p_quality->>'owner_id', '')::uuid,
      coalesce((p_quality->>'quality_score')::real, 0),
      coalesce(nullif(p_quality->>'extraction_quality', ''), 'unknown'),
      coalesce(p_quality->'metrics', '{}'::jsonb),
      coalesce(
        array(select jsonb_array_elements_text(coalesce(p_quality->'issues', '[]'::jsonb))),
        '{}'::text[]
      ),
      now()
    )
    on conflict on constraint document_index_quality_pkey
    do update set
      owner_id = excluded.owner_id,
      quality_score = excluded.quality_score,
      extraction_quality = excluded.extraction_quality,
      metrics = excluded.metrics,
      issues = excluded.issues,
      updated_at = excluded.updated_at;
  end if;

  -- M13 (audit 2026-07-01): superseded-generation rows always go; legacy
  -- NULL-generation rows go only when this generation wrote replacement rows
  -- into the same table (see 20260702000000_commit_generation_preserve_legacy_artifacts).
  -- Guarantee scope: fully protects document_images/document_memory_cards/
  -- document_sections; chunk-anchored artifacts (table facts, embedding
  -- fields, index units) cascade with their legacy chunks via
  -- source_chunk_id ON DELETE CASCADE when chunks are replaced.
  delete from public.document_chunks
  where document_id = p_document_id
    and (
      (index_generation_id is not null and index_generation_id <> p_index_generation_id)
      or (
        index_generation_id is null
        and exists (
          select 1
          from public.document_chunks replacement
          where replacement.document_id = p_document_id
            and replacement.index_generation_id = p_index_generation_id
        )
      )
    );

  delete from public.document_images
  where document_id = p_document_id
    and (
      (nullif(metadata->>'index_generation_id', '') is not null
        and metadata->>'index_generation_id' <> p_index_generation_id::text)
      or (
        nullif(metadata->>'index_generation_id', '') is null
        and exists (
          select 1
          from public.document_images replacement
          where replacement.document_id = p_document_id
            and replacement.metadata->>'index_generation_id' = p_index_generation_id::text
        )
      )
    );

  delete from public.document_table_facts
  where document_id = p_document_id
    and (
      (nullif(metadata->>'index_generation_id', '') is not null
        and metadata->>'index_generation_id' <> p_index_generation_id::text)
      or (
        nullif(metadata->>'index_generation_id', '') is null
        and exists (
          select 1
          from public.document_table_facts replacement
          where replacement.document_id = p_document_id
            and replacement.metadata->>'index_generation_id' = p_index_generation_id::text
        )
      )
    );

  delete from public.document_embedding_fields
  where document_id = p_document_id
    and (
      (nullif(metadata->>'index_generation_id', '') is not null
        and metadata->>'index_generation_id' <> p_index_generation_id::text)
      or (
        nullif(metadata->>'index_generation_id', '') is null
        and exists (
          select 1
          from public.document_embedding_fields replacement
          where replacement.document_id = p_document_id
            and replacement.metadata->>'index_generation_id' = p_index_generation_id::text
        )
      )
    );

  delete from public.document_index_units
  where document_id = p_document_id
    and (
      (nullif(metadata->>'index_generation_id', '') is not null
        and metadata->>'index_generation_id' <> p_index_generation_id::text)
      or (
        nullif(metadata->>'index_generation_id', '') is null
        and exists (
          select 1
          from public.document_index_units replacement
          where replacement.document_id = p_document_id
            and replacement.metadata->>'index_generation_id' = p_index_generation_id::text
        )
      )
    );

  delete from public.document_memory_cards
  where document_id = p_document_id
    and (
      (nullif(metadata->>'index_generation_id', '') is not null
        and metadata->>'index_generation_id' <> p_index_generation_id::text)
      or (
        nullif(metadata->>'index_generation_id', '') is null
        and exists (
          select 1
          from public.document_memory_cards replacement
          where replacement.document_id = p_document_id
            and replacement.metadata->>'index_generation_id' = p_index_generation_id::text
        )
      )
    );

  delete from public.document_sections
  where document_id = p_document_id
    and (
      (nullif(metadata->>'index_generation_id', '') is not null
        and metadata->>'index_generation_id' <> p_index_generation_id::text)
      or (
        nullif(metadata->>'index_generation_id', '') is null
        and exists (
          select 1
          from public.document_sections replacement
          where replacement.document_id = p_document_id
            and replacement.metadata->>'index_generation_id' = p_index_generation_id::text
        )
      )
    );

  return jsonb_build_object(
    'ok', true,
    'document_id', p_document_id,
    'index_generation_id', p_index_generation_id
  );
end;
$$;

create or replace function public.cleanup_abandoned_document_index_generations(
  p_document_id uuid default null,
  p_limit integer default 100,
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
set search_path = public, extensions, pg_temp
as $$
declare
  target_document_ids uuid[] := '{}'::uuid[];
  chunk_count integer := 0;
  image_count integer := 0;
  table_fact_count integer := 0;
  embedding_field_count integer := 0;
  index_unit_count integer := 0;
  memory_card_count integer := 0;
  section_count integer := 0;
begin
  perform set_config('statement_timeout', '180000', true);

  with candidate_documents as (
    select distinct document_id
    from (
      select c.document_id
      from public.document_chunks c
      join public.documents d on d.id = c.document_id
      where (p_document_id is null or c.document_id = p_document_id)
        and c.index_generation_id is not null
        and c.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '')
        and not exists (
          select 1 from public.ingestion_jobs j
          where j.document_id = c.document_id
            and j.status in ('pending', 'processing')
        )
      union all
      select a.document_id
      from public.document_images a
      join public.documents d on d.id = a.document_id
      where (p_document_id is null or a.document_id = p_document_id)
        and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is not null
        and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '')
        and not exists (
          select 1 from public.ingestion_jobs j
          where j.document_id = a.document_id
            and j.status in ('pending', 'processing')
        )
      union all
      select a.document_id
      from public.document_table_facts a
      join public.documents d on d.id = a.document_id
      where (p_document_id is null or a.document_id = p_document_id)
        and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is not null
        and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '')
        and not exists (
          select 1 from public.ingestion_jobs j
          where j.document_id = a.document_id
            and j.status in ('pending', 'processing')
        )
      union all
      select a.document_id
      from public.document_embedding_fields a
      join public.documents d on d.id = a.document_id
      where (p_document_id is null or a.document_id = p_document_id)
        and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is not null
        and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '')
        and not exists (
          select 1 from public.ingestion_jobs j
          where j.document_id = a.document_id
            and j.status in ('pending', 'processing')
        )
      union all
      select a.document_id
      from public.document_index_units a
      join public.documents d on d.id = a.document_id
      where (p_document_id is null or a.document_id = p_document_id)
        and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is not null
        and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '')
        and not exists (
          select 1 from public.ingestion_jobs j
          where j.document_id = a.document_id
            and j.status in ('pending', 'processing')
        )
      union all
      select a.document_id
      from public.document_memory_cards a
      join public.documents d on d.id = a.document_id
      where (p_document_id is null or a.document_id = p_document_id)
        and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is not null
        and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '')
        and not exists (
          select 1 from public.ingestion_jobs j
          where j.document_id = a.document_id
            and j.status in ('pending', 'processing')
        )
      union all
      select a.document_id
      from public.document_sections a
      join public.documents d on d.id = a.document_id
      where (p_document_id is null or a.document_id = p_document_id)
        and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is not null
        and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '')
        and not exists (
          select 1 from public.ingestion_jobs j
          where j.document_id = a.document_id
            and j.status in ('pending', 'processing')
        )
    ) candidates
    limit least(greatest(coalesce(p_limit, 100), 1), 1000)
  )
  select coalesce(array_agg(document_id), '{}'::uuid[])
  into target_document_ids
  from candidate_documents;

  select count(*) into chunk_count
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where c.document_id = any(target_document_ids)
    and c.index_generation_id is not null
    and c.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

  select count(*) into image_count
  from public.document_images a
  join public.documents d on d.id = a.document_id
  where a.document_id = any(target_document_ids)
    and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is not null
    and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

  select count(*) into table_fact_count
  from public.document_table_facts a
  join public.documents d on d.id = a.document_id
  where a.document_id = any(target_document_ids)
    and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is not null
    and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

  select count(*) into embedding_field_count
  from public.document_embedding_fields a
  join public.documents d on d.id = a.document_id
  where a.document_id = any(target_document_ids)
    and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is not null
    and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

  select count(*) into index_unit_count
  from public.document_index_units a
  join public.documents d on d.id = a.document_id
  where a.document_id = any(target_document_ids)
    and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is not null
    and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

  select count(*) into memory_card_count
  from public.document_memory_cards a
  join public.documents d on d.id = a.document_id
  where a.document_id = any(target_document_ids)
    and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is not null
    and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

  select count(*) into section_count
  from public.document_sections a
  join public.documents d on d.id = a.document_id
  where a.document_id = any(target_document_ids)
    and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is not null
    and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

  if not coalesce(p_dry_run, true) then
    delete from public.document_chunks c
    using public.documents d
    where d.id = c.document_id
      and c.document_id = any(target_document_ids)
      and c.index_generation_id is not null
      and c.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

    delete from public.document_images a
    using public.documents d
    where d.id = a.document_id
      and a.document_id = any(target_document_ids)
      and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is not null
      and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

    delete from public.document_table_facts a
    using public.documents d
    where d.id = a.document_id
      and a.document_id = any(target_document_ids)
      and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is not null
      and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

    delete from public.document_embedding_fields a
    using public.documents d
    where d.id = a.document_id
      and a.document_id = any(target_document_ids)
      and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is not null
      and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

    delete from public.document_index_units a
    using public.documents d
    where d.id = a.document_id
      and a.document_id = any(target_document_ids)
      and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is not null
      and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

    delete from public.document_memory_cards a
    using public.documents d
    where d.id = a.document_id
      and a.document_id = any(target_document_ids)
      and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is not null
      and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

    delete from public.document_sections a
    using public.documents d
    where d.id = a.document_id
      and a.document_id = any(target_document_ids)
      and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is not null
      and nullif(coalesce(a.metadata, '{}'::jsonb)->>'index_generation_id', '') is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');
  end if;

  return jsonb_build_object(
    'ok', true,
    'dry_run', coalesce(p_dry_run, true),
    'document_count', coalesce(array_length(target_document_ids, 1), 0),
    'document_ids', to_jsonb(target_document_ids),
    'counts', jsonb_build_object(
      'document_chunks', chunk_count,
      'document_images', image_count,
      'document_table_facts', table_fact_count,
      'document_embedding_fields', embedding_field_count,
      'document_index_units', index_unit_count,
      'document_memory_cards', memory_card_count,
      'document_sections', section_count
    )
  );
end;
$$;

create or replace function public.refresh_import_batch_status(p_batch_id uuid)
returns jsonb
language plpgsql
set search_path = public, extensions, pg_temp
as $$
declare
  queued_count integer := 0;
  processing_count integer := 0;
  failed_count integer := 0;
  next_status text;
begin
  if p_batch_id is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_batch_id');
  end if;

  select
    count(*) filter (where status = 'pending'),
    count(*) filter (where status = 'processing'),
    count(*) filter (where status = 'failed')
  into queued_count, processing_count, failed_count
  from public.ingestion_jobs
  where batch_id = p_batch_id;

  next_status := case
    when queued_count > 0 or processing_count > 0 then 'processing'
    when failed_count > 0 then 'completed_with_errors'
    else 'completed'
  end;

  update public.import_batches
  set
    status = next_status,
    failed_files = failed_count,
    completed_at = case when next_status = 'processing' then null else now() end
  where id = p_batch_id;

  return jsonb_build_object(
    'ok', true,
    'status', next_status,
    'queued', queued_count,
    'processing', processing_count,
    'failed', failed_count
  );
end;
$$;

create or replace function public.complete_ingestion_job(
  p_job_id uuid,
  p_document_id uuid,
  p_batch_id uuid default null,
  p_stage text default 'indexed'
)
returns jsonb
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  update public.ingestion_jobs
  set
    status = 'completed',
    stage = p_stage,
    progress = 100,
    error_message = null,
    locked_at = null,
    locked_by = null,
    completed_at = now()
  where id = p_job_id
    and document_id = p_document_id;

  update public.ingestion_jobs
  set
    status = 'completed',
    stage = 'superseded by successful index',
    progress = 100,
    error_message = null,
    locked_at = null,
    locked_by = null,
    completed_at = now()
  where document_id = p_document_id
    and id <> p_job_id
    and status in ('pending', 'processing', 'failed');

  if p_batch_id is not null then
    perform public.refresh_import_batch_status(p_batch_id);
  end if;

  return jsonb_build_object('ok', true, 'job_id', p_job_id, 'document_id', p_document_id);
end;
$$;

create or replace function public.fail_or_retry_ingestion_job(
  p_job_id uuid,
  p_document_id uuid,
  p_batch_id uuid default null,
  p_retry boolean default false,
  p_document_status text default 'failed',
  p_stage text default 'failed',
  p_error_message text default null,
  p_next_run_at timestamptz default null
)
returns jsonb
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  update public.documents
  set
    status = p_document_status,
    error_message = p_error_message
  where id = p_document_id;

  update public.ingestion_jobs
  set
    status = case when p_retry then 'pending' else 'failed' end,
    stage = p_stage,
    progress = case when p_retry then 0 else 100 end,
    error_message = p_error_message,
    locked_at = null,
    locked_by = null,
    next_run_at = coalesce(p_next_run_at, next_run_at),
    completed_at = case when p_retry then null else now() end
  where id = p_job_id
    and document_id = p_document_id;

  if p_batch_id is not null then
    perform public.refresh_import_batch_status(p_batch_id);
  end if;

  return jsonb_build_object('ok', true, 'job_id', p_job_id, 'document_id', p_document_id, 'retry', p_retry);
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

create or replace function public.document_label_metadata(p_document_id uuid)
returns jsonb
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select coalesce(
    jsonb_agg(
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
    ),
    '[]'::jsonb
  )
  from public.document_labels l
  where l.document_id = p_document_id;
$$;

create or replace function public.document_summary_text(p_document_id uuid)
returns text
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select s.summary
  from public.document_summaries s
  where s.document_id = p_document_id
  limit 1;
$$;

create or replace function public.is_committed_document_generation(
  row_generation uuid,
  document_metadata jsonb
)
returns boolean
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select row_generation is null
    or row_generation::text = nullif(coalesce(document_metadata, '{}'::jsonb)->>'index_generation_id', '');
$$;

create or replace function public.is_committed_artifact_generation(
  artifact_metadata jsonb,
  document_metadata jsonb
)
returns boolean
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select nullif(coalesce(artifact_metadata, '{}'::jsonb)->>'index_generation_id', '') is null
    or nullif(coalesce(artifact_metadata, '{}'::jsonb)->>'index_generation_id', '') =
      nullif(coalesce(document_metadata, '{}'::jsonb)->>'index_generation_id', '');
$$;

create or replace function public.match_document_chunks(
  query_embedding extensions.vector(1536),
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
  retrieval_synopsis text,
  image_ids uuid[],
  source_metadata jsonb,
  document_labels jsonb,
  document_summary text,
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
    c.retrieval_synopsis,
    c.image_ids,
    d.metadata as source_metadata,
    '[]'::jsonb as document_labels,
    null::text as document_summary,
    1 - (c.embedding <=> query_embedding) as similarity,
    '[]'::jsonb as images
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where (document_filter is null or c.document_id = document_filter)
    and (owner_filter is null or d.owner_id = owner_filter)
    and d.status = 'indexed'
    and public.is_committed_document_generation(c.index_generation_id, d.metadata)
    and 1 - (c.embedding <=> query_embedding) >= min_similarity
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function public.match_document_chunks_hybrid(
  query_embedding extensions.vector(1536),
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
  retrieval_synopsis text,
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
      c.retrieval_synopsis,
      c.image_ids,
      1 - (c.embedding <=> query_embedding) as similarity,
      (
        ts_rank_cd(c.search_tsv, query.tsq) +
        (ts_rank_cd(d.title_search_tsv, query.tsq) * 3.0)
      )::double precision as text_rank,
      row_number() over (order by c.embedding <=> query_embedding) as vector_rank,
      null::bigint as text_match_rank,
      coalesce((d.metadata->'rag_indexing_version') is not null, false) as has_deep_index,
      d.updated_at as doc_updated_at,
      coalesce(
        (select q.quality_score from public.document_index_quality q where q.document_id = c.document_id),
        0.7
      ) as quality_score
    from public.document_chunks c
    join public.documents d on d.id = c.document_id
    cross join query
    where (document_filters is null or c.document_id = any(document_filters))
      and (owner_filter is null or d.owner_id = owner_filter)
      and d.status = 'indexed'
      and public.is_committed_document_generation(c.index_generation_id, d.metadata)
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
      c.retrieval_synopsis,
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
      ) as text_match_rank,
      coalesce((d.metadata->'rag_indexing_version') is not null, false) as has_deep_index,
      d.updated_at as doc_updated_at,
      coalesce(
        (select q.quality_score from public.document_index_quality q where q.document_id = c.document_id),
        0.7
      ) as quality_score
    from public.document_chunks c
    join public.documents d on d.id = c.document_id
    cross join query
    where (document_filters is null or c.document_id = any(document_filters))
      and (owner_filter is null or d.owner_id = owner_filter)
      and d.status = 'indexed'
      and public.is_committed_document_generation(c.index_generation_id, d.metadata)
      and c.search_tsv @@ query.tsq
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
      retrieval_synopsis,
      image_ids,
      max(similarity)::double precision as similarity,
      max(text_rank)::double precision as text_rank,
      min(vector_rank) as vector_rank,
      min(text_match_rank) as text_match_rank,
      max(quality_score)::double precision as quality_score,
      bool_or(has_deep_index) as has_deep_index,
      max(doc_updated_at) as doc_updated_at
    from combined
    group by id, document_id, page_number, chunk_index, section_heading, content, retrieval_synopsis, image_ids
  ),
  scored_metrics as (
    select
      scored.*,
      (
        (scored.similarity * 0.62)
        + (least(scored.text_rank, 1) * 0.22)
        + (scored.quality_score * 0.10)
        + (case when scored.doc_updated_at > now() - interval '90 days' then 0.06 else 0 end)
      )::double precision as hybrid_score,
      (
        coalesce(1.0 / (60 + scored.vector_rank), 0) +
        coalesce(1.0 / (60 + scored.text_match_rank), 0)
      )::double precision as rrf_score
    from scored
  ),
  hybrid_candidates as (
    select id
    from scored_metrics
    order by hybrid_score desc, similarity desc, text_rank desc
    limit match_count
  ),
  vector_candidates as (
    select id
    from scored_metrics
    order by similarity desc, hybrid_score desc
    limit match_count
  ),
  text_candidates as (
    select id
    from scored_metrics
    order by text_rank desc, hybrid_score desc
    limit match_count
  ),
  rrf_candidates as (
    select id
    from scored_metrics
    order by rrf_score desc, hybrid_score desc
    limit match_count
  ),
  candidate_ids as (
    select id from hybrid_candidates
    union
    select id from vector_candidates
    union
    select id from text_candidates
    union
    select id from rrf_candidates
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
    c.retrieval_synopsis,
    c.image_ids,
    d.metadata as source_metadata,
    c.similarity,
    c.text_rank,
    c.hybrid_score,
    c.rrf_score,
    public.chunk_image_metadata(c.image_ids) as images
  from scored_metrics c
  join candidate_ids candidates on candidates.id = c.id
  join public.documents d on d.id = c.document_id
  order by c.hybrid_score desc, c.rrf_score desc, c.similarity desc, c.text_rank desc
  limit match_count;
$$;

create or replace function public.match_document_memory_cards_hybrid_v2(
  query_embedding extensions.vector(1536),
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
      (1 - (m.embedding <=> query_embedding))::double precision as similarity,
      ts_rank_cd(m.search_tsv, query.tsq)::double precision as text_rank,
      row_number() over (order by m.embedding <=> query_embedding) as vector_rank,
      null::bigint as text_match_rank
    from public.document_memory_cards m
    join public.documents d on d.id = m.document_id
    cross join query
    where (document_filters is null or m.document_id = any(document_filters))
      and (owner_filter is null or d.owner_id = owner_filter)
      and d.status = 'indexed'
      and public.is_committed_artifact_generation(m.metadata, d.metadata)
      and (1 - (m.embedding <=> query_embedding)) >= min_similarity
    order by m.embedding <=> query_embedding
    limit greatest(match_count * 6, 96)
  ),
  text_ranked as (
    select
      m.*,
      (1 - (m.embedding <=> query_embedding))::double precision as similarity,
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
      and d.status = 'indexed'
      and public.is_committed_artifact_generation(m.metadata, d.metadata)
      and m.search_tsv @@ query.tsq
    order by ts_rank_cd(m.search_tsv, query.tsq) desc
    limit greatest(match_count * 6, 96)
  ),
  combined as (
    select * from vector_ranked
    union all
    select * from text_ranked
  ),
  scored as (
    select
      id, document_id, owner_id, section_id, card_type, title, content, normalized_terms,
      page_number, source_chunk_ids, source_image_ids, confidence, metadata,
      max(similarity)::double precision as similarity,
      max(text_rank)::double precision as text_rank,
      min(vector_rank) as vector_rank,
      min(text_match_rank) as text_match_rank
    from combined
    group by
      id, document_id, owner_id, section_id, card_type, title, content, normalized_terms,
      page_number, source_chunk_ids, source_image_ids, confidence, metadata
  )
  select
    id, document_id, owner_id, section_id, card_type, title, content, normalized_terms,
    page_number, source_chunk_ids, source_image_ids, confidence, metadata, similarity, text_rank,
    (
      (similarity * 0.62)
      + (least(text_rank, 1) * 0.24)
      + (confidence * 0.10)
      + (
        coalesce(1.0 / (60 + vector_rank), 0)
        + coalesce(1.0 / (60 + text_match_rank), 0)
      ) * 0.04
    )::double precision as hybrid_score,
    (
      coalesce(1.0 / (60 + vector_rank), 0)
      + coalesce(1.0 / (60 + text_match_rank), 0)
    )::double precision as rrf_score
  from scored
  order by hybrid_score desc, similarity desc, text_rank desc, confidence desc
  limit match_count;
$$;

-- plpgsql wrapper: raise HNSW ef_search for recall depth, then delegate to _v2.
create or replace function public.match_document_memory_cards_hybrid(
  query_embedding extensions.vector(1536),
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
language plpgsql
stable
set search_path = public, extensions, pg_temp
as $$
begin
  perform set_config('hnsw.ef_search', '100', true);
  return query
  select *
  from public.match_document_memory_cards_hybrid_v2(
    query_embedding,
    query_text,
    match_count,
    min_similarity,
    document_filters,
    owner_filter
  );
end
$$;

create or replace function public.detect_legacy_ivfflat_indexes()
returns text[]
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select coalesce(array_agg(idx.relname order by idx.relname), array[]::text[])
  from pg_class idx
  join pg_index ix on ix.indexrelid = idx.oid
  join pg_class tab on tab.oid = ix.indrelid
  join pg_namespace tab_ns on tab_ns.oid = tab.relnamespace
  join pg_am am on idx.relam = am.oid
  where idx.relkind = 'i'
    and am.amname = 'ivfflat'
    and tab_ns.nspname = 'public'
    and tab.relname = any (
      array[
        'document_chunks',
        'document_embedding_fields',
        'document_index_units',
        'document_memory_cards',
        'document_table_facts'
      ]
    );
$$;

create or replace function public.search_schema_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_catalog, pg_temp
as $$
declare
  missing text[] := array[]::text[];
  vector_type_oid oid;
  vector_schema text;
  index_name text;
  legacy_ivfflat_indexes text[];
  zero_vec extensions.vector(1536);
  probe_text text := 'schema health probe zzznomatch';
  hybrid_rpcs text[] := array[
    'match_document_chunks_hybrid',
    'match_document_index_units_hybrid',
    'match_document_embedding_fields_hybrid',
    'match_document_memory_cards_hybrid'
  ];
  rpc_name text;
  required_indexes constant text[] := array[
    'documents_title_trgm_idx',
    'document_chunks_content_trgm_idx',
    'document_labels_label_trgm_idx',
    'document_summaries_summary_trgm_idx',
    'document_chunks_embedding_hnsw_idx',
    'document_embedding_fields_embedding_hnsw_idx',
    'document_memory_cards_embedding_hnsw_idx',
    'documents_indexed_owner_title_idx',
    'document_table_facts_owner_document_page_idx',
    'document_embedding_fields_owner_chunk_idx',
    'document_index_units_owner_chunk_type_idx',
    'document_table_facts_source_image_idx',
    'document_pages_document_idx',
    'document_sections_document_idx',
    'document_chunks_document_idx',
    'document_memory_cards_document_idx',
    'document_embedding_fields_document_idx',
    'document_table_facts_document_idx',
    'document_index_units_document_idx',
    'rag_retrieval_logs_owner_created_idx',
    'rag_retrieval_logs_miss_idx',
    'rag_retrieval_logs_strategy_idx'
  ];
begin
  select t.oid, n.nspname
  into vector_type_oid, vector_schema
  from pg_type t
  join pg_namespace n on n.oid = t.typnamespace
  where t.typname = 'vector'
    and n.nspname = 'extensions'
  limit 1;

  if vector_type_oid is null then
    missing := array_append(missing, 'extensions.vector_type');
  end if;

  if to_regprocedure('public.match_document_chunks(extensions.vector, integer, double precision, uuid, uuid)') is null then
    missing := array_append(missing, 'match_document_chunks.extensions_vector_signature');
  end if;
  if to_regprocedure('public.match_document_chunks_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid)') is null then
    missing := array_append(missing, 'match_document_chunks_hybrid.extensions_vector_signature');
  end if;
  if to_regprocedure('public.match_document_chunks_text(text, integer, uuid[], uuid)') is null then
    missing := array_append(missing, 'match_document_chunks_text.signature');
  end if;
  if to_regprocedure('public.match_document_lookup_chunks_text(text, uuid[], integer, uuid)') is null then
    missing := array_append(missing, 'match_document_lookup_chunks_text.signature');
  end if;
  if to_regprocedure('public.match_document_memory_cards_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid)') is null then
    missing := array_append(missing, 'match_document_memory_cards_hybrid.extensions_vector_signature');
  end if;
  if to_regprocedure('public.match_document_memory_cards_hybrid_v2(extensions.vector, text, integer, double precision, uuid[], uuid)') is null then
    missing := array_append(missing, 'match_document_memory_cards_hybrid_v2.extensions_vector_signature');
  end if;
  if to_regprocedure('public.match_document_index_units_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid)') is null then
    missing := array_append(missing, 'match_document_index_units_hybrid.extensions_vector_signature');
  end if;
  if to_regprocedure('public.match_document_embedding_fields_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid)') is null then
    missing := array_append(missing, 'match_document_embedding_fields_hybrid.extensions_vector_signature');
  end if;
  if to_regprocedure('public.match_documents_for_query(text, integer, uuid)') is null then
    missing := array_append(missing, 'match_documents_for_query.signature');
  end if;
  if to_regprocedure('public.match_document_table_facts_text(text, integer, uuid[], uuid)') is null then
    missing := array_append(missing, 'match_document_table_facts_text.signature');
  end if;
  if to_regprocedure('public.explain_retrieval_rpc(text, text, integer, uuid, uuid[], boolean)') is null then
    missing := array_append(missing, 'explain_retrieval_rpc.signature');
  end if;
  if to_regclass('public.rag_retrieval_logs') is null then
    missing := array_append(missing, 'rag_retrieval_logs.table');
  end if;

  foreach index_name in array required_indexes loop
    if not exists (
      select 1
      from pg_class c
      join pg_namespace ns on ns.oid = c.relnamespace
      where ns.nspname = 'public'
        and c.relname = index_name
        and c.relkind = 'i'
    ) then
      missing := array_append(missing, index_name);
    end if;
  end loop;

  -- Execution smoke: invoke each hybrid RPC with a zero vector so silent runtime
  -- breaks (e.g. the historical 42702 ambiguous-id plpgsql regression) surface as
  -- `<rpc>.execution:<sqlstate>` instead of passing a signature-only check. Only
  -- runs when the vector type resolved, so a missing extension is not double
  -- reported; each RPC gets its own sub-block so one failure does not mask others.
  if vector_type_oid is not null then
    zero_vec := (select ('[' || string_agg('0', ',') || ']') from generate_series(1, 1536))::extensions.vector(1536);
    foreach rpc_name in array hybrid_rpcs loop
      begin
        execute format(
          'select 1 from public.%I($1, $2, 1, 0.1, null::uuid[], null::uuid) limit 1',
          rpc_name
        ) using zero_vec, probe_text;
      exception
        when undefined_function then
          missing := array_append(missing, rpc_name || '.execution_signature');
        when others then
          missing := array_append(missing, rpc_name || '.execution:' || SQLSTATE);
      end;
    end loop;
  end if;

  select public.detect_legacy_ivfflat_indexes() into legacy_ivfflat_indexes;

  return jsonb_build_object(
    'ok', cardinality(missing) = 0,
    'missing', missing,
    'vector_extension_schema', vector_schema,
    'legacy_ivfflat_indexes', coalesce(legacy_ivfflat_indexes, array[]::text[]),
    'deferred_hnsw_indexes', array[]::text[],
    'checked_at', now()
  );
end;
$$;

revoke execute on function public.search_schema_health() from public, anon, authenticated;
grant execute on function public.search_schema_health() to service_role;

create or replace function public.explain_retrieval_rpc(
  p_rpc text,
  p_query_text text,
  p_match_count integer default 12,
  p_owner_filter uuid default null,
  p_document_filters uuid[] default null,
  p_analyze boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = public, extensions, pg_temp
as $$
declare
  plan json;
  options text;
  sql text;
begin
  options := case
    when p_analyze then 'analyze true, buffers true, format json'
    else 'analyze false, format json'
  end;

  if p_rpc = 'match_documents_for_query' then
    sql := format('explain (%s) select * from public.match_documents_for_query($1, $2, $3)', options);
    execute sql into plan using p_query_text, p_match_count, p_owner_filter;
  elsif p_rpc = 'match_document_chunks_text' then
    sql := format('explain (%s) select * from public.match_document_chunks_text($1, $2, $3, $4)', options);
    execute sql into plan using p_query_text, p_match_count, p_document_filters, p_owner_filter;
  elsif p_rpc = 'match_document_lookup_chunks_text' then
    sql := format('explain (%s) select * from public.match_document_lookup_chunks_text($1, $2, $3, $4)', options);
    execute sql into plan using p_query_text, p_document_filters, p_match_count, p_owner_filter;
  elsif p_rpc = 'match_document_table_facts_text' then
    sql := format('explain (%s) select * from public.match_document_table_facts_text($1, $2, $3, $4)', options);
    execute sql into plan using p_query_text, p_match_count, p_document_filters, p_owner_filter;
  else
    raise exception 'Unsupported retrieval RPC: %', p_rpc using errcode = '22023';
  end if;

  return coalesce(plan::jsonb, '[]'::jsonb);
end;
$$;

revoke execute on function public.explain_retrieval_rpc(text, text, integer, uuid, uuid[], boolean) from public, anon, authenticated;
grant execute on function public.explain_retrieval_rpc(text, text, integer, uuid, uuid[], boolean) to service_role;

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
    select
      websearch_to_tsquery('english', coalesce(query_text, '')) as tsq,
      lower(coalesce(query_text, '')) as normalized
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
        (ts_rank_cd(d.search_tsv, query.tsq) * 1.5) +
        coalesce(max(ts_rank_cd(to_tsvector('english', l.label), query.tsq)) * 1.2, 0) +
        coalesce(ts_rank_cd(to_tsvector('english', s.summary), query.tsq), 0) +
        (greatest(
          similarity(lower(coalesce(d.title, '') || ' ' || coalesce(d.file_name, '')), query.normalized),
          coalesce(max(similarity(lower(l.label), query.normalized)), 0),
          coalesce(similarity(lower(s.summary), query.normalized), 0)
        ) * 1.6)
      )::double precision as text_rank,
      case
        when d.title_search_tsv @@ query.tsq then 'title'
        when max(l.label) filter (where to_tsvector('english', l.label) @@ query.tsq) is not null then 'label'
        when s.summary is not null and to_tsvector('english', s.summary) @@ query.tsq then 'summary'
        when similarity(lower(coalesce(d.title, '') || ' ' || coalesce(d.file_name, '')), query.normalized) >= 0.18 then 'fuzzy_title'
        when d.search_tsv @@ query.tsq then 'metadata'
        else 'none'
      end as match_reason
    from public.documents d
    left join public.document_labels l on l.document_id = d.id
    left join public.document_summaries s on s.document_id = d.id
    cross join query
    where (owner_filter is null or d.owner_id = owner_filter)
      and d.status = 'indexed'
      and (
        d.title_search_tsv @@ query.tsq
        or d.search_tsv @@ query.tsq
        or to_tsvector('english', coalesce(l.label, '')) @@ query.tsq
        or to_tsvector('english', coalesce(s.summary, '')) @@ query.tsq
        or similarity(lower(coalesce(d.title, '') || ' ' || coalesce(d.file_name, '')), query.normalized) >= 0.18
        or similarity(lower(coalesce(l.label, '')), query.normalized) >= 0.2
        or similarity(lower(coalesce(s.summary, '')), query.normalized) >= 0.16
      )
    group by d.id, d.owner_id, d.title, d.file_name, d.status, d.page_count, d.chunk_count, d.image_count, d.metadata, s.summary, query.tsq, query.normalized
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
  retrieval_synopsis text,
  image_ids uuid[],
  source_metadata jsonb,
  document_labels jsonb,
  document_summary text,
  similarity double precision,
  text_rank double precision,
  hybrid_score double precision,
  lexical_score double precision,
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
      c.retrieval_synopsis,
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
      and d.status = 'indexed'
      and public.is_committed_document_generation(c.index_generation_id, d.metadata)
      and (c.search_tsv @@ query.tsq or d.title_search_tsv @@ query.tsq)
    order by (
      ts_rank_cd(c.search_tsv, query.tsq) +
      (ts_rank_cd(d.title_search_tsv, query.tsq) * 3.0)
    ) desc
    limit least(greatest(match_count * 2, 24), 96)
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
    ranked.retrieval_synopsis,
    ranked.image_ids,
    ranked.source_metadata,
    coalesce(public.document_label_metadata(ranked.document_id), '[]'::jsonb) as document_labels,
    public.document_summary_text(ranked.document_id) as document_summary,
    -- Text-only fallback has NO vector cosine similarity. Do not fabricate one:
    -- a synthetic value here was read downstream as a real semantic score and
    -- could label a pure keyword hit as "strong"/"moderate" evidence (>=0.64).
    -- Leave similarity at 0; the lexical signal lives in lexical_score.
    0::double precision as similarity,
    ranked.text_rank,
    -- Cap hybrid_score well below the 0.64 "moderate" threshold so a lexical-only
    -- row can order amongst its peers but can never masquerade as a moderate/strong
    -- cosine match when merged with vector results.
    least(0.5, 0.18 + (least(ranked.text_rank, 1) * 0.3))::double precision as hybrid_score,
    least(0.99, 0.4 + (least(ranked.text_rank, 1) * 0.59))::double precision as lexical_score,
    public.chunk_image_metadata(ranked.image_ids) as images
  from ranked
  order by lexical_score desc, text_rank desc
  limit match_count;
$$;

create or replace function public.match_document_lookup_chunks_text(
  query_text text,
  document_filters uuid[],
  match_count integer default 24,
  owner_filter uuid default null
)
returns table (
  id uuid,
  document_id uuid,
  page_number integer,
  chunk_index integer,
  section_heading text,
  section_path text[],
  heading_level integer,
  parent_heading text,
  anchor_id text,
  content text,
  retrieval_synopsis text,
  image_ids uuid[],
  text_rank double precision
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  with query as (
    select websearch_to_tsquery('english', coalesce(query_text, '')) as tsq
  )
  select
    c.id,
    c.document_id,
    c.page_number,
    c.chunk_index,
    c.section_heading,
    c.section_path,
    c.heading_level,
    c.parent_heading,
    c.anchor_id,
    c.content,
    c.retrieval_synopsis,
    c.image_ids,
    (
      ts_rank_cd(c.search_tsv, query.tsq) +
      (case when c.section_heading is not null then ts_rank_cd(to_tsvector('english', c.section_heading), query.tsq) * 0.35 else 0 end) +
      (ts_rank_cd(d.title_search_tsv, query.tsq) * 0.25)
    )::double precision as text_rank
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  cross join query
  where document_filters is not null
    and c.document_id = any(document_filters)
    and (owner_filter is null or d.owner_id = owner_filter)
    and d.status = 'indexed'
    and public.is_committed_document_generation(c.index_generation_id, d.metadata)
    and (c.search_tsv @@ query.tsq or d.title_search_tsv @@ query.tsq)
  order by text_rank desc, c.chunk_index asc
  limit least(greatest(match_count, 1), 80);
$$;

revoke execute on function public.match_document_lookup_chunks_text(text, uuid[], integer, uuid) from public, anon, authenticated;
grant execute on function public.match_document_lookup_chunks_text(text, uuid[], integer, uuid) to service_role;

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

create or replace function public.match_document_table_facts_text(
  query_text text,
  match_count integer default 16,
  document_filters uuid[] default null,
  owner_filter uuid default null
)
returns table (
  id uuid,
  document_id uuid,
  source_chunk_id uuid,
  source_image_id uuid,
  page_number integer,
  table_title text,
  row_label text,
  clinical_parameter text,
  threshold_value text,
  action text,
  text_rank double precision,
  match_reason text,
  metadata jsonb
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  with query as (
    select
      websearch_to_tsquery('english', coalesce(query_text, '')) as tsq,
      lower(coalesce(query_text, '')) as normalized,
      regexp_split_to_array(lower(coalesce(query_text, '')), '[^a-z0-9]+') as terms
  ),
  ranked as (
    select
      f.id,
      f.document_id,
      f.source_chunk_id,
      f.source_image_id,
      f.page_number,
      f.table_title,
      f.row_label,
      f.clinical_parameter,
      f.threshold_value,
      f.action,
      (
        ts_rank_cd(f.search_tsv, query.tsq) +
        (
          similarity(
            lower(
              coalesce(f.table_title, '') || ' ' ||
              coalesce(f.row_label, '') || ' ' ||
              coalesce(f.clinical_parameter, '') || ' ' ||
              coalesce(f.threshold_value, '') || ' ' ||
              coalesce(f.action, '')
            ),
            query.normalized
          ) * 0.8
        ) +
        case
          when coalesce(f.threshold_value, '') <> ''
            and regexp_split_to_array(lower(f.threshold_value), '[^a-z0-9]+') && query.terms then 0.12
          else 0
        end +
        case
          when coalesce(f.action, '') <> ''
            and regexp_split_to_array(lower(f.action), '[^a-z0-9]+') && query.terms then 0.1
          else 0
        end
      )::double precision as text_rank,
      case
        when coalesce(f.threshold_value, '') <> '' then 'table_threshold'
        when coalesce(f.action, '') <> '' then 'table_action'
        else 'table_row'
      end as match_reason,
      f.metadata
    from public.document_table_facts f
    join public.documents d on d.id = f.document_id
    cross join query
    where (document_filters is null or f.document_id = any(document_filters))
      and (owner_filter is null or f.owner_id = owner_filter)
      and d.status = 'indexed'
      and public.is_committed_artifact_generation(f.metadata, d.metadata)
      and (
        f.search_tsv @@ query.tsq
        or f.normalized_terms && query.terms
        or similarity(
          lower(
            coalesce(f.table_title, '') || ' ' ||
            coalesce(f.row_label, '') || ' ' ||
            coalesce(f.clinical_parameter, '') || ' ' ||
            coalesce(f.threshold_value, '') || ' ' ||
            coalesce(f.action, '')
          ),
          query.normalized
        ) >= 0.18
      )
  )
  select *
  from ranked
  where text_rank > 0
  order by text_rank desc, page_number asc nulls last
  limit match_count;
$$;

create or replace function public.match_document_embedding_fields_hybrid(
  query_embedding extensions.vector(1536),
  query_text text,
  match_count integer default 16,
  min_similarity double precision default 0.5,
  document_filters uuid[] default null,
  owner_filter uuid default null
)
returns table (
  id uuid,
  document_id uuid,
  source_chunk_id uuid,
  field_type text,
  content text,
  similarity double precision,
  text_rank double precision,
  hybrid_score double precision
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  with query as (
    select websearch_to_tsquery('english', coalesce(query_text, '')) as tsq
  ),
  vector_hits as (
    select f.id
    from public.document_embedding_fields f
    join public.documents d on d.id = f.document_id
    where (document_filters is null or f.document_id = any(document_filters))
      and (owner_filter is null or d.owner_id = owner_filter)
      and d.status = 'indexed'
      and public.is_committed_artifact_generation(f.metadata, d.metadata)
      and f.source_chunk_id is not null
      and 1 - (f.embedding <=> query_embedding) >= min_similarity
    order by f.embedding <=> query_embedding
    limit greatest(match_count * 3, 32)
  ),
  text_hits as (
    select f.id
    from public.document_embedding_fields f
    join public.documents d on d.id = f.document_id
    cross join query
    where (document_filters is null or f.document_id = any(document_filters))
      and (owner_filter is null or d.owner_id = owner_filter)
      and d.status = 'indexed'
      and public.is_committed_artifact_generation(f.metadata, d.metadata)
      and f.source_chunk_id is not null
      and f.search_tsv @@ query.tsq
    order by ts_rank_cd(f.search_tsv, query.tsq) desc
    limit greatest(match_count * 3, 32)
  ),
  candidate_ids as (
    select id from vector_hits
    union
    select id from text_hits
  ),
  ranked as (
    select
      f.id, f.document_id, f.source_chunk_id, f.field_type, f.content,
      (1 - (f.embedding <=> query_embedding))::double precision as similarity,
      ts_rank_cd(f.search_tsv, query.tsq)::double precision as text_rank
    from public.document_embedding_fields f
    join candidate_ids ci on ci.id = f.id
    cross join query
  )
  select
    id, document_id, source_chunk_id, field_type, content, similarity, text_rank,
    ((similarity * 0.7) + (least(text_rank, 1) * 0.3))::double precision as hybrid_score
  from ranked
  order by hybrid_score desc, similarity desc, text_rank desc
  limit match_count;
$$;

create or replace view public.document_strict_gate_status
with (security_invoker = true)
as
with artifact_counts as (
  select
    d.id as document_id,
    d.owner_id,
    d.status as document_status,
    d.updated_at as document_updated_at,
    coalesce(d.metadata->>'enrichment_status', 'pending') as enrichment_status,
    coalesce(d.metadata->>'indexing_v3_agent_status', 'pending') as indexing_v3_agent_status,
    coalesce(q.extraction_quality, 'unknown') as quality_extraction_quality,
    coalesce(q.quality_score, 0)::real as quality_score,
    (select count(*)::integer from public.document_sections s where s.document_id = d.id) as sections,
    (select count(*)::integer from public.document_memory_cards m where m.document_id = d.id) as memory_cards,
    (
      select count(*)::integer
      from public.document_labels l
      where l.document_id = d.id
        and (
          lower(l.source) = 'generated'
          or l.metadata->>'source' = 'generated'
          or l.metadata->>'generated_by' = 'indexing-v3-agent'
          or lower(coalesce(l.metadata->>'generation_source', '')) = 'indexing_v3_agent_parsed_artifacts'
        )
    ) as generated_labels,
    (select count(*)::integer from public.document_index_units u where u.document_id = d.id) as index_units,
    exists (
      select 1
      from public.document_embedding_fields f
      where f.document_id = d.id
        and f.field_type = 'document_title'
      limit 1
    ) as title_embedding,
    exists (
      select 1
      from public.document_embedding_fields f
      where f.document_id = d.id
        and f.field_type = 'document_summary'
      limit 1
    ) as summary_embedding
  from public.documents d
  left join public.document_index_quality q on q.document_id = d.id
),
gate as (
  select
    artifact_counts.*,
    array_remove(array[
      case when sections > 0 then null else 'sections' end,
      case when memory_cards > 0 then null else 'memory_cards' end,
      case when generated_labels > 0 then null else 'generated_labels' end,
      case when index_units > 0 then null else 'index_units' end,
      case when title_embedding then null else 'title_embedding' end,
      case when summary_embedding then null else 'summary_embedding' end
    ], null)::text[] as missing
  from artifact_counts
)
select
  document_id,
  owner_id,
  document_status,
  document_updated_at,
  enrichment_status,
  indexing_v3_agent_status,
  quality_extraction_quality,
  quality_score,
  sections,
  memory_cards,
  generated_labels,
  index_units,
  title_embedding,
  summary_embedding,
  missing,
  cardinality(missing) = 0 as gate_passed,
  jsonb_build_object(
    'sections', sections,
    'memory_cards', memory_cards,
    'generated_labels', generated_labels,
    'index_units', index_units
  ) as counts,
  jsonb_build_object(
    'title_embedding', title_embedding,
    'summary_embedding', summary_embedding
  ) as presence
from gate;

create or replace function public.repair_strict_enrichment_gate_batch(
  p_limit integer default 50
)
returns table (
  document_id uuid,
  missing text[],
  repaired text[],
  status text,
  counts jsonb,
  presence jsonb
)
language plpgsql
security invoker
set search_path = public, extensions, pg_temp
as $$
begin
  return query
  with candidates as (
    select g.*
    from public.document_strict_gate_status g
    where g.document_status = 'indexed'
      and (
        (
          g.gate_passed
          and (
            coalesce(g.enrichment_status, '') <> 'completed'
            or coalesce(g.indexing_v3_agent_status, '') <> 'completed'
            or coalesce(g.quality_extraction_quality, '') <> 'good'
            or exists (
              select 1
              from public.ingestion_jobs j
              where j.document_id = g.document_id
                and j.status in ('pending', 'processing')
            )
          )
        )
        or (
          not g.gate_passed
          and (
            coalesce(g.enrichment_status, '') = 'completed'
            or coalesce(g.indexing_v3_agent_status, '') = 'completed'
          )
        )
      )
    order by g.document_updated_at asc nulls first, g.document_id
    limit greatest(1, least(coalesce(p_limit, 50), 500))
  ),
  updated_documents as (
    update public.documents d
    set
      metadata = case
        when c.gate_passed then
          jsonb_strip_nulls(
            (coalesce(d.metadata, '{}'::jsonb)
              - 'indexing_v3_agent_locked_by'
              - 'indexing_v3_agent_locked_at'
              - 'indexing_v3_agent_next_run_at'
              - 'indexing_v3_agent_last_error'
              - 'completion_gate_missing')
            || jsonb_build_object(
              'indexing_v3_agent_status', 'completed',
              'indexing_v3_agent_updated_at', now(),
              'indexing_v3_agent_deferral_count', 0,
              'completion_gate', jsonb_build_object(
                'result', 'complete',
                'missing', to_jsonb(c.missing),
                'counts', c.counts,
                'presence', c.presence,
                'source', 'repair_strict_enrichment_gate_batch'
              ),
              'enrichment_status', 'completed'
            )
          )
        else
          jsonb_strip_nulls(
            (coalesce(d.metadata, '{}'::jsonb)
              - 'indexing_v3_agent_locked_by'
              - 'indexing_v3_agent_locked_at'
              - 'indexing_v3_agent_next_run_at'
              - 'indexing_v3_agent_last_error')
            || jsonb_build_object(
              'indexing_v3_agent_status', 'deferred',
              'indexing_v3_agent_updated_at', now(),
              'completion_gate_missing', to_jsonb(c.missing),
              'completion_gate', jsonb_build_object(
                'result', 'deferred',
                'missing', to_jsonb(c.missing),
                'counts', c.counts,
                'presence', c.presence,
                'source', 'repair_strict_enrichment_gate_batch'
              ),
              'enrichment_status', 'pending'
            )
          )
      end,
      updated_at = now()
    from candidates c
    where d.id = c.document_id
    returning d.id
  ),
  quality_promotions as (
    insert into public.document_index_quality (
      document_id,
      owner_id,
      quality_score,
      extraction_quality,
      metrics,
      issues,
      updated_at
    )
    select
      c.document_id,
      c.owner_id,
      greatest(c.quality_score, 1)::real,
      'good',
      jsonb_build_object(
        'strict_enrichment_gate', jsonb_build_object(
          'result', 'complete',
          'counts', c.counts,
          'presence', c.presence,
          'source', 'repair_strict_enrichment_gate_batch'
        )
      ),
      '{}'::text[],
      now()
    from candidates c
    where c.gate_passed
    on conflict (document_id)
    do update set
      quality_score = greatest(public.document_index_quality.quality_score, excluded.quality_score),
      extraction_quality = 'good',
      metrics = coalesce(public.document_index_quality.metrics, '{}'::jsonb) || excluded.metrics,
      updated_at = now()
    returning document_id
  ),
  completed_open_jobs as (
    update public.ingestion_jobs j
    set
      status = 'completed',
      stage = 'indexed',
      progress = 100,
      error_message = null,
      locked_at = null,
      locked_by = null,
      completed_at = coalesce(j.completed_at, now()),
      updated_at = now()
    from candidates c
    where c.gate_passed
      and j.document_id = c.document_id
      and j.status in ('pending', 'processing')
    returning j.document_id
  ),
  deferred_open_jobs as (
    update public.ingestion_jobs j
    set
      status = 'pending',
      stage = 'strict_gate_deferred',
      progress = least(j.progress, 95),
      error_message = 'strict enrichment gate missing: ' || array_to_string(c.missing, ','),
      locked_at = null,
      locked_by = null,
      next_run_at = now(),
      completed_at = null,
      updated_at = now()
    from candidates c
    where not c.gate_passed
      and j.document_id = c.document_id
      and j.status in ('pending', 'processing')
    returning j.document_id
  ),
  queued_repair_jobs as (
    insert into public.ingestion_jobs (
      document_id,
      status,
      stage,
      progress,
      error_message,
      next_run_at
    )
    select
      c.document_id,
      'pending',
      'strict_gate_repair',
      95,
      'strict enrichment gate missing: ' || array_to_string(c.missing, ','),
      now()
    from candidates c
    where not c.gate_passed
      and not exists (
        select 1
        from public.ingestion_jobs j
        where j.document_id = c.document_id
          and j.status in ('pending', 'processing')
      )
    returning document_id
  )
  select
    c.document_id,
    c.missing,
    array_remove(array[
      case when c.gate_passed then 'metadata_completed' else 'metadata_deferred' end,
      case when c.gate_passed then 'quality_good' else null end,
      case when exists (select 1 from completed_open_jobs j where j.document_id = c.document_id) then 'open_jobs_completed' else null end,
      case when exists (select 1 from deferred_open_jobs j where j.document_id = c.document_id) then 'open_jobs_deferred' else null end,
      case when exists (select 1 from queued_repair_jobs j where j.document_id = c.document_id) then 'repair_job_queued' else null end
    ], null)::text[] as repaired,
    case when c.gate_passed then 'completed' else 'deferred' end as status,
    c.counts,
    c.presence
  from candidates c
  where exists (select 1 from updated_documents u where u.id = c.document_id)
  order by c.document_updated_at asc nulls first, c.document_id;
end;
$$;

revoke all on table public.document_strict_gate_status from public, anon, authenticated;
grant select on table public.document_strict_gate_status to service_role;
revoke execute on function public.repair_strict_enrichment_gate_batch(integer) from public, anon, authenticated;
grant execute on function public.repair_strict_enrichment_gate_batch(integer) to service_role;

create or replace function public.complete_strict_enrichment_job(
  p_document_id uuid,
  p_job_id uuid default null,
  p_stage text default 'indexed; enrichment completed',
  p_agent_version text default 'visual-core-v3',
  p_visual_indexing_version text default 'visual-v3'
)
returns table (
  ok boolean,
  document_id uuid,
  gate_passed boolean,
  missing text[],
  status text,
  counts jsonb,
  presence jsonb,
  completed_job_ids uuid[]
)
language plpgsql
security invoker
set search_path = public, extensions, pg_temp
as $$
declare
  gate_row record;
begin
  perform 1
  from public.documents d
  where d.id = p_document_id
  for update;

  if not found then
    return query
    select
      false,
      p_document_id,
      false,
      array['document_not_found']::text[],
      'missing_document',
      '{}'::jsonb,
      '{}'::jsonb,
      '{}'::uuid[];
    return;
  end if;

  select *
  into gate_row
  from public.document_strict_gate_status g
  where g.document_id = p_document_id;

  if not found then
    return query
    select
      false,
      p_document_id,
      false,
      array['strict_gate_status_missing']::text[],
      'blocked_missing_artifacts',
      '{}'::jsonb,
      '{}'::jsonb,
      '{}'::uuid[];
    return;
  end if;

  if not gate_row.gate_passed then
    return query
    select
      false,
      p_document_id,
      false,
      gate_row.missing,
      'blocked_missing_artifacts',
      gate_row.counts,
      gate_row.presence,
      '{}'::uuid[];
    return;
  end if;

  update public.documents d
  set
    metadata = jsonb_strip_nulls(
      (coalesce(d.metadata, '{}'::jsonb)
        - 'indexing_v3_agent_locked_by'
        - 'indexing_v3_agent_locked_at'
        - 'indexing_v3_agent_next_run_at'
        - 'indexing_v3_agent_last_error'
        - 'completion_gate_missing')
      || jsonb_build_object(
        'indexing_v3_agent_status', 'completed',
        'indexing_v3_agent_version', p_agent_version,
        'indexing_v3_agent_updated_at', now(),
        'indexing_v3_agent_deferral_count', 0,
        'visual_indexing_version', p_visual_indexing_version,
        'completion_gate', jsonb_build_object(
          'result', 'complete',
          'missing', to_jsonb(gate_row.missing),
          'counts', gate_row.counts,
          'presence', gate_row.presence,
          'source', 'complete_strict_enrichment_job'
        ),
        'enrichment_status', 'completed'
      )
    ),
    updated_at = now()
  where d.id = p_document_id;

  insert into public.document_index_quality (
    document_id,
    owner_id,
    quality_score,
    extraction_quality,
    metrics,
    issues,
    updated_at
  )
  values (
    p_document_id,
    gate_row.owner_id,
    greatest(coalesce(gate_row.quality_score, 0), 1)::real,
    'good',
    jsonb_build_object(
      'strict_enrichment_gate', jsonb_build_object(
        'result', 'complete',
        'counts', gate_row.counts,
        'presence', gate_row.presence,
        'source', 'complete_strict_enrichment_job'
      )
    ),
    '{}'::text[],
    now()
  )
  on conflict on constraint document_index_quality_pkey
  do update set
    quality_score = greatest(public.document_index_quality.quality_score, excluded.quality_score),
    extraction_quality = 'good',
    metrics = coalesce(public.document_index_quality.metrics, '{}'::jsonb) || excluded.metrics,
    issues = '{}'::text[],
    updated_at = now();

  return query
  select
    true,
    p_document_id,
    true,
    gate_row.missing,
    'completed',
    gate_row.counts,
    gate_row.presence,
    '{}'::uuid[];
end;
$$;

revoke execute on function public.complete_strict_enrichment_job(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.complete_strict_enrichment_job(uuid, uuid, text, text, text) to service_role;

create or replace function public.invoke_indexing_v3_agent(p_limit integer default 1)
returns bigint
language plpgsql
security definer
set search_path = public, extensions, vault, pg_temp
as $$
declare
  v_request_id bigint;
  v_secret text;
begin
  select decrypted_secret
    into v_secret
  from vault.decrypted_secrets
  where name = 'indexing_v3_agent_secret'
  limit 1;

  if nullif(v_secret, '') is null then
    raise exception 'indexing_v3_agent_secret is missing from Supabase Vault';
  end if;

  select net.http_post(
    url := 'https://sjrfecxgysukkwxsowpy.supabase.co/functions/v1/indexing-v3-agent?limit=' || greatest(1, least(coalesce(p_limit, 1), 10))::text,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-indexing-agent-secret', v_secret
    ),
    body := jsonb_build_object('source', 'pg_cron', 'worker', 'v3-indexing-worker', 'ts', now()),
    timeout_milliseconds := 60000
  ) into v_request_id;

  return v_request_id;
end;
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
  public.document_table_facts,
  public.document_embedding_fields,
  public.document_index_quality,
  public.ingestion_jobs,
  public.ingestion_job_stages,
  public.rag_queries,
  public.rag_query_misses,
  public.rag_aliases,
  public.rag_response_cache,
  public.api_rate_limits,
  public.audit_logs,
  public.storage_cleanup_jobs,
  public.rag_retrieval_logs
to service_role;

revoke all on public.audit_logs from anon, authenticated;
grant select, insert, update, delete on table public.audit_logs to service_role;

grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
revoke execute on function public.claim_indexing_v3_agent_jobs(text, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_indexing_v3_agent_jobs(text, integer, integer) to service_role;
revoke execute on function public.invoke_indexing_v3_agent(integer) from public, anon, authenticated;
grant execute on function public.invoke_indexing_v3_agent(integer) to service_role;

grant select on table
  public.import_batches,
  public.documents,
  public.document_pages,
  public.document_images,
  public.document_labels,
  public.document_summaries,
  public.document_chunks,
  public.document_table_facts,
  public.document_embedding_fields,
  public.document_index_quality,
  public.ingestion_jobs,
  public.rag_queries,
  public.rag_query_misses,
  public.rag_aliases,
  public.storage_cleanup_jobs,
  public.rag_retrieval_logs
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
alter table public.document_table_facts enable row level security;
alter table public.document_embedding_fields enable row level security;
alter table public.document_index_quality enable row level security;
alter table public.ingestion_jobs enable row level security;
alter table public.ingestion_job_stages enable row level security;
alter table public.rag_queries enable row level security;
alter table public.rag_query_misses enable row level security;
alter table public.rag_aliases enable row level security;
alter table public.rag_response_cache enable row level security;
alter table public.api_rate_limits enable row level security;
alter table public.audit_logs enable row level security;
alter table public.storage_cleanup_jobs enable row level security;
alter table public.rag_retrieval_logs enable row level security;

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

create policy "table facts owner read" on public.document_table_facts
  for select to authenticated using (
    exists (select 1 from public.documents d where d.id = document_id and d.owner_id = (select auth.uid()))
  );

create policy "embedding fields owner read" on public.document_embedding_fields
  for select to authenticated using (
    exists (select 1 from public.documents d where d.id = document_id and d.owner_id = (select auth.uid()))
  );

create policy "index quality owner read" on public.document_index_quality
  for select to authenticated using (owner_id = (select auth.uid()));

create policy "jobs owner read" on public.ingestion_jobs
  for select to authenticated using (
    exists (select 1 from public.documents d where d.id = document_id and d.owner_id = (select auth.uid()))
  );

create policy "ingestion job stages service role all" on public.ingestion_job_stages
  for all to service_role
  using (true)
  with check (true);

create policy "rag owner read" on public.rag_queries
  for select to authenticated using (owner_id = (select auth.uid()));

create policy "rag misses owner read" on public.rag_query_misses
  for select to authenticated using (owner_id = (select auth.uid()));

create policy "rag retrieval logs owner read" on public.rag_retrieval_logs
  for select to authenticated using (owner_id = (select auth.uid()));

create policy "rag aliases owner read" on public.rag_aliases
  for select to authenticated using (owner_id is null or owner_id = (select auth.uid()));

create policy "rag response cache service role all" on public.rag_response_cache
  for all to service_role
  using (true)
  with check (true);

create policy "api rate limits service role all" on public.api_rate_limits
  for all to service_role
  using (true)
  with check (true);

create policy "audit logs service role all" on public.audit_logs
  for all to service_role
  using (true)
  with check (true);

create policy "storage cleanup owner read" on public.storage_cleanup_jobs
  for select to authenticated using (owner_id = (select auth.uid()));

create policy "document storage owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'clinical-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "image storage owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'clinical-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create table if not exists public.document_index_units (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  document_id uuid not null references public.documents(id) on delete cascade,
  unit_type text not null check (unit_type in ('document_profile', 'section_summary', 'page_text', 'chunk_evidence', 'table_fact', 'askable_question', 'clinical_fact', 'threshold', 'workflow_step', 'medication_monitoring', 'alias', 'vocabulary_term', 'visual_summary', 'flowchart_step', 'diagram_decision', 'risk_matrix_cell', 'medication_chart_row', 'chart_finding', 'visual_askable_question', 'table_threshold')),
  source_chunk_id uuid references public.document_chunks(id) on delete cascade,
  source_image_id uuid references public.document_images(id) on delete set null,
  page_start integer,
  page_end integer,
  heading_path text[] not null default '{}',
  title text not null,
  content text not null,
  normalized_terms text[] not null default '{}',
  source_span jsonb,
  quality_score real not null default 0.7 check (quality_score >= 0 and quality_score <= 1),
  extraction_mode text not null default 'deterministic' check (extraction_mode in ('deterministic', 'model_heavy', 'hybrid')),
  embedding extensions.vector(1536) not null,
  metadata jsonb not null default '{}'::jsonb,
  search_tsv tsvector generated always as (to_tsvector('english', coalesce(unit_type, '') || ' ' || coalesce(title, '') || ' ' || coalesce(content, ''))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists document_index_units_document_idx on public.document_index_units(document_id, unit_type, page_start);
create index if not exists document_index_units_owner_type_idx on public.document_index_units(owner_id, unit_type, quality_score desc);
create index if not exists document_index_units_owner_chunk_type_idx
  on public.document_index_units(owner_id, source_chunk_id, unit_type)
  where source_chunk_id is not null;
create index if not exists document_index_units_chunk_idx on public.document_index_units(source_chunk_id) where source_chunk_id is not null;
create index if not exists document_index_units_image_idx on public.document_index_units(source_image_id) where source_image_id is not null;
create index if not exists document_index_units_terms_idx on public.document_index_units using gin(normalized_terms);
create index if not exists document_index_units_heading_path_idx on public.document_index_units using gin(heading_path);
create index if not exists document_index_units_search_idx on public.document_index_units using gin(search_tsv);
-- Intentionally no HNSW index on document_index_units.embedding: the hybrid RPC is
-- text-candidate-gated so the vector path never used it (0 lifetime scans; dropped
-- live 2026-07-02 by the drop_legacy_vector_indexes migration). Re-add only if the
-- RPC is rewritten to take a vector-first candidate path.

drop trigger if exists document_index_units_updated_at on public.document_index_units;
create trigger document_index_units_updated_at
before update on public.document_index_units
for each row execute function public.set_updated_at();

create or replace function public.match_document_index_units_hybrid(
  query_embedding extensions.vector(1536),
  query_text text,
  match_count integer default 24,
  min_similarity double precision default 0.1,
  document_filters uuid[] default null,
  owner_filter uuid default null
)
returns table (
  id uuid,
  document_id uuid,
  source_chunk_id uuid,
  source_image_id uuid,
  unit_type text,
  title text,
  content text,
  page_start integer,
  page_end integer,
  heading_path text[],
  normalized_terms text[],
  source_span jsonb,
  quality_score real,
  extraction_mode text,
  similarity double precision,
  text_rank double precision,
  hybrid_score double precision,
  metadata jsonb
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  with query as (
    select websearch_to_tsquery('english', coalesce(query_text, '')) as tsq,
      regexp_split_to_array(lower(coalesce(query_text, '')), '\s+') as terms
  ),
  ranked as (
    select u.id, u.document_id, u.source_chunk_id, u.source_image_id, u.unit_type, u.title, u.content, u.page_start,
      u.page_end, u.heading_path, u.normalized_terms, u.source_span, u.quality_score, u.extraction_mode,
      (1 - (u.embedding <=> query_embedding))::double precision as similarity,
      (ts_rank_cd(u.search_tsv, query.tsq)
        + case when u.normalized_terms && query.terms then 0.25 else 0 end
        + case when u.unit_type in ('askable_question', 'table_fact', 'clinical_fact', 'threshold', 'workflow_step', 'medication_monitoring', 'alias', 'visual_summary', 'flowchart_step', 'diagram_decision', 'risk_matrix_cell', 'medication_chart_row', 'chart_finding', 'visual_askable_question', 'table_threshold') then 0.06
               when u.unit_type = 'section_summary' then 0.03
               else 0 end
      )::double precision as text_rank,
      u.metadata
    from public.document_index_units u
    join public.documents d on d.id = u.document_id
    cross join query
    where d.status = 'indexed'
      and (document_filters is null or u.document_id = any(document_filters))
      and (owner_filter is null or d.owner_id = owner_filter)
      and public.is_committed_artifact_generation(u.metadata, d.metadata)
      and u.source_chunk_id is not null
      and (u.search_tsv @@ query.tsq or u.normalized_terms && query.terms)
    order by text_rank desc
    limit greatest(match_count * 3, 48)
  )
  select id, document_id, source_chunk_id, source_image_id, unit_type, title, content, page_start, page_end, heading_path,
    normalized_terms, source_span, quality_score, extraction_mode, similarity, text_rank,
    (
      (similarity * 0.52)
      + (least(text_rank, 1) * 0.28)
      + (quality_score * 0.12)
      + (case when extraction_mode in ('model_heavy', 'hybrid') then 0.04 else 0 end)
      + (case when unit_type in ('askable_question', 'threshold', 'table_fact', 'table_threshold', 'visual_askable_question') then 0.04
              when unit_type in ('workflow_step', 'medication_monitoring', 'flowchart_step', 'diagram_decision', 'medication_chart_row', 'risk_matrix_cell') then 0.03
              else 0 end)
    )::double precision as hybrid_score,
    metadata
  from ranked
  order by hybrid_score desc, similarity desc, text_rank desc
  limit match_count;
$$;

create or replace function public.reset_document_index(p_document_id uuid)
returns void
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  perform set_config('statement_timeout', '180000', true);
  delete from public.document_index_units where document_id = p_document_id;
  delete from public.document_memory_cards where document_id = p_document_id;
  delete from public.document_sections where document_id = p_document_id;
  delete from public.document_table_facts where document_id = p_document_id;
  delete from public.document_embedding_fields where document_id = p_document_id;
  delete from public.document_index_quality where document_id = p_document_id;
  delete from public.document_chunks where document_id = p_document_id;
  delete from public.document_images where document_id = p_document_id;
  delete from public.document_pages where document_id = p_document_id;
end;
$$;

create or replace function public.analyze_rag_tables()
returns void
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  analyze public.document_chunks;
  analyze public.document_memory_cards;
  analyze public.document_index_units;
  analyze public.document_embedding_fields;
  analyze public.document_table_facts;
  analyze public.documents;
end;
$$;

revoke execute on function public.analyze_rag_tables() from public, anon, authenticated;
grant execute on function public.analyze_rag_tables() to service_role;

alter table public.document_index_units enable row level security;
grant select, insert, update, delete on table public.document_index_units to service_role;
grant select on table public.document_index_units to authenticated;
grant execute on function public.match_document_index_units_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid) to service_role;
revoke execute on function public.commit_document_index_generation(uuid, uuid, text, integer, integer, integer, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.commit_document_index_generation(uuid, uuid, text, integer, integer, integer, jsonb, jsonb, jsonb) to service_role;
revoke execute on function public.cleanup_abandoned_document_index_generations(uuid, integer, boolean) from public, anon, authenticated;
grant execute on function public.cleanup_abandoned_document_index_generations(uuid, integer, boolean) to service_role;
revoke execute on function public.is_committed_document_generation(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.is_committed_document_generation(uuid, jsonb) to service_role;
revoke execute on function public.is_committed_artifact_generation(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.is_committed_artifact_generation(jsonb, jsonb) to service_role;

create policy "document index units owner read" on public.document_index_units
  for select to authenticated using (
    exists (select 1 from public.documents d where d.id = document_id and d.owner_id = (select auth.uid()))
  );
