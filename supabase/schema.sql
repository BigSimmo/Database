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
  -- Typed mirror of metadata->>'index_generation_id' (the committed index
  -- generation pointer). The JSON stays the source of truth for every writer;
  -- GENERATED ALWAYS means the column can never drift. Malformed non-UUID
  -- values generate NULL, matching the old text-comparison reader semantics.
  index_generation_id uuid generated always as (
    case
      when metadata->>'index_generation_id'
        ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        then (metadata->>'index_generation_id')::uuid
      else null
    end
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
  index_generation_id uuid,
  caption_confidence real,
  clinical_priority_score real,
  crop_completeness real,
  image_quality_score real,
  ocr_text_density real,
  structured_extraction_confidence real,
  visual_duplicate_group text,
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
  index_generation_id uuid,
  producer text,
  artifact_generation_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists document_sections_legacy_section_index_key
  on public.document_sections(document_id, section_index)
  where artifact_generation_id is null;
create unique index if not exists document_sections_producer_generation_section_index_key
  on public.document_sections(document_id, producer, artifact_generation_id, section_index)
  where producer is not null and artifact_generation_id is not null;
create index if not exists document_sections_producer_generation_idx
  on public.document_sections(document_id, producer, artifact_generation_id);

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
  index_generation_id uuid,
  producer text,
  artifact_generation_id uuid,
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

create index if not exists document_memory_cards_producer_generation_idx
  on public.document_memory_cards(document_id, producer, artifact_generation_id);

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
  content_hash text,
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
  index_generation_id uuid,
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
  content_hash text not null,
  embedding extensions.vector(1536) not null,
  index_generation_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  search_tsv tsvector generated always as (to_tsvector('english', content)) stored,
  created_at timestamptz not null default now()
) with (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

create table if not exists public.document_index_quality (
  document_id uuid primary key references public.documents(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete set null,
  quality_score real not null default 0 check (quality_score >= 0 and quality_score <= 1),
  extraction_quality text not null default 'unknown'
    check (extraction_quality in ('good', 'partial', 'poor', 'unknown')),
  anchor_coverage real,
  model_fallback_rate real,
  noisy_unit_rate real,
  retrievable_visual_hit boolean,
  source_span_coverage real,
  typed_unit_coverage real,
  metrics jsonb not null default '{}'::jsonb,
  issues text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- NOTE: this table is declared here, before document_strict_gate_status and the
-- late grant/RLS sections that reference it, so a from-scratch replay of this
-- file succeeds (DR rehearsal 2026-07-06; see docs/disaster-recovery-runbook.md).
-- Its updated_at trigger stays below with the other triggers (set_updated_at is
-- defined later in this file).
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
  index_generation_id uuid,
  producer text,
  artifact_generation_id uuid,
  embedding extensions.vector(1536) not null,
  metadata jsonb not null default '{}'::jsonb,
  search_tsv tsvector generated always as (to_tsvector('english', coalesce(unit_type, '') || ' ' || coalesce(title, '') || ' ' || coalesce(content, ''))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists document_index_units_document_idx on public.document_index_units(document_id, unit_type, page_start);
create index if not exists document_index_units_producer_generation_idx
  on public.document_index_units(document_id, producer, artifact_generation_id);
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

-- Autovacuum tuning observed live on the high-churn RAG tables (advisor-era).
-- Values must match live exactly; `npm run check:drift` compares reloptions.
alter table public.document_chunks set (
  autovacuum_vacuum_scale_factor = 0.05, autovacuum_vacuum_threshold = 1000,
  autovacuum_analyze_scale_factor = 0.02, autovacuum_analyze_threshold = 500
);
alter table public.document_pages set (
  autovacuum_vacuum_scale_factor = 0.05, autovacuum_vacuum_threshold = 1000,
  autovacuum_analyze_scale_factor = 0.02, autovacuum_analyze_threshold = 500
);
alter table public.document_images set (
  autovacuum_vacuum_scale_factor = 0.05, autovacuum_vacuum_threshold = 1000,
  autovacuum_analyze_scale_factor = 0.02, autovacuum_analyze_threshold = 500
);
alter table public.document_table_facts set (
  autovacuum_vacuum_scale_factor = 0.05, autovacuum_vacuum_threshold = 1000,
  autovacuum_analyze_scale_factor = 0.02, autovacuum_analyze_threshold = 500
);
alter table public.document_labels set (
  autovacuum_vacuum_scale_factor = 0.05, autovacuum_vacuum_threshold = 200,
  autovacuum_analyze_scale_factor = 0.02, autovacuum_analyze_threshold = 100
);

-- Content-quality guards observed live. Originally added there as NOT VALID;
-- validated by 20260713104000_validate_content_not_blank_constraints.sql after
-- the 2026-07-13 audit confirmed zero violating rows, so the canonical replay
-- creates them validated.
do $guard$
begin
  if not exists (select 1 from pg_constraint where conname = 'document_chunks_content_not_blank') then
    alter table public.document_chunks
      add constraint document_chunks_content_not_blank check (length(btrim(content)) > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'document_embedding_fields_content_not_blank') then
    alter table public.document_embedding_fields
      add constraint document_embedding_fields_content_not_blank check (length(btrim(content)) > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'document_index_units_content_not_blank') then
    alter table public.document_index_units
      add constraint document_index_units_content_not_blank check (length(btrim(content)) > 0);
  end if;
end
$guard$;

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
  -- R24e: no FK to ingestion_jobs. Live has no such constraint and job_id holds
  -- indexing_v3_agent_jobs ids, not ingestion_jobs ids (see migration
  -- 20260708140000). document_id -> documents ON DELETE CASCADE is the real FK.
  job_id uuid not null,
  document_id uuid not null references public.documents(id) on delete cascade,
  stage_name text not null,
  stage_status text not null default 'started'
    check (stage_status in ('started', 'completed', 'failed')),
  error_class text,
  retry_count integer not null default 0,
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
  updated_at timestamptz not null default now(),
  constraint storage_cleanup_jobs_document_id_fkey
    foreign key (document_id)
    references public.documents(id)
    on delete set null
);

create unique index if not exists documents_owner_content_hash_unique_idx
  on public.documents(owner_id, content_hash)
  where content_hash is not null;
create index if not exists import_batches_owner_status_idx on public.import_batches(owner_id, status, created_at desc);
create index if not exists documents_status_idx on public.documents(status);
create index if not exists documents_owner_status_idx on public.documents(owner_id, status, created_at desc);
create index if not exists documents_import_batch_idx on public.documents(import_batch_id);
create index if not exists documents_search_idx on public.documents using gin(search_tsv);
create index if not exists documents_title_search_idx on public.documents using gin(title_search_tsv);
create index if not exists documents_owner_id_covering_idx on public.documents(owner_id, id);
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
create index if not exists ingestion_jobs_status_next_run_idx
  on public.ingestion_jobs(status, next_run_at, created_at)
  where status in ('pending', 'processing', 'failed');
create index if not exists ingestion_jobs_document_status_idx
  on public.ingestion_jobs(document_id, status, created_at);
-- R17 (docs/ingestion-concurrency-fix-workorder.md): structural guard against
-- more than one open job per document. Migration
-- 20260708170000_ingestion_jobs_one_open_per_document.sql applies the same
-- index transactionally via `db push`; operators on a busy queue may use the
-- CONCURRENTLY variant documented in docs/operator-apply-july8-batch.md instead.
create unique index if not exists ingestion_jobs_one_open_per_document_uidx
  on public.ingestion_jobs(document_id)
  where status in ('pending', 'processing');
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
create index if not exists rag_aliases_canonical_trgm_idx
  on public.rag_aliases using gin (lower(canonical) gin_trgm_ops);
create index if not exists rag_response_cache_expiry_idx
  on public.rag_response_cache(expires_at);
create index if not exists rag_response_cache_owner_kind_idx
  on public.rag_response_cache(owner_id, cache_kind, updated_at desc);

create or replace function public.purge_expired_rag_response_cache()
returns integer
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_deleted integer;
begin
  delete from public.rag_response_cache where expires_at <= now();
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke execute on function public.purge_expired_rag_response_cache() from public, anon, authenticated;
grant execute on function public.purge_expired_rag_response_cache() to service_role;
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

create table if not exists public.api_rate_limit_subjects (
  subject_key text not null,
  bucket text not null,
  window_start timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (subject_key, bucket),
  constraint api_rate_limit_subjects_subject_key_nonempty check (btrim(subject_key) <> ''),
  constraint api_rate_limit_subjects_bucket_nonempty check (btrim(bucket) <> '')
);

create index if not exists api_rate_limit_subjects_bucket_updated_idx
  on public.api_rate_limit_subjects(bucket, updated_at desc);

create or replace function public.consume_api_subject_rate_limit(
  p_subject_key text,
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
  if p_subject_key is null or btrim(p_subject_key) = '' then
    raise exception 'subject_key is required';
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
    update public.api_rate_limit_subjects
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
    where subject_key = p_subject_key
      and bucket = p_bucket
    returning request_count, window_start + make_interval(secs => p_window_seconds)
      into v_count, v_reset_at;

    exit when found;

    begin
      insert into public.api_rate_limit_subjects(subject_key, bucket, window_start, request_count, updated_at)
      values (p_subject_key, p_bucket, v_window_start, 1, v_now)
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

revoke all privileges on table public.api_rate_limit_subjects from public, anon, authenticated;
grant select, insert, update, delete on table public.api_rate_limit_subjects to service_role;
revoke execute on function public.consume_api_subject_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_subject_rate_limit(text, text, integer, integer) to service_role;

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
  id uuid, document_id uuid, batch_id uuid, status text, stage text, progress integer,
  error_message text, attempt_count integer, max_attempts integer, locked_at timestamptz,
  locked_by text, documents jsonb
)
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  insert into public.indexing_v3_agent_jobs (
    document_id, status, enrichment_status, next_run_at, version, metadata, created_at, updated_at
  )
  select d.id, 'pending', coalesce(d.metadata->>'enrichment_status', 'pending'),
    case when coalesce(d.metadata->>'indexing_v3_agent_next_run_at', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
      then (d.metadata->>'indexing_v3_agent_next_run_at')::timestamptz else null end,
    coalesce(nullif(d.metadata->>'indexing_v3_agent_version', ''), 'visual-core-v3'),
    '{}'::jsonb, coalesce(d.created_at, now()), now()
  from public.documents d
  where d.status = 'indexed'
    and not exists (
      select 1 from public.ingestion_jobs i
      where i.document_id = d.id and i.status in ('pending', 'processing')
    )
    and d.metadata ? 'indexing_v3_agent_status'
    and coalesce(d.metadata->>'indexing_v3_agent_status', 'pending')
          not in ('completed', 'needs_enrichment_artifacts')
  on conflict (document_id) do nothing;

  return query
  with eligible_jobs as (
    select j.id, j.document_id, j.attempt_count, j.max_attempts
    from public.indexing_v3_agent_jobs j
    join public.documents d on d.id = j.document_id and d.status = 'indexed'
    where j.status not in ('completed', 'needs_enrichment_artifacts')
      and not exists (
        select 1 from public.ingestion_jobs i
        where i.document_id = j.document_id and i.status in ('pending', 'processing')
      )
      and j.enrichment_status in ('pending', 'failed', 'processing')
      and j.attempt_count < j.max_attempts
      and coalesce(j.next_run_at, now()) <= now()
      and (j.status <> 'processing' or j.locked_at is null
        or j.locked_at < now() - make_interval(mins => p_stale_after_minutes))
    order by coalesce(j.next_run_at, j.updated_at), j.id
    limit greatest(p_claim_limit, 1)
    for update of j skip locked
  ),
  claimed_jobs as (
    update public.indexing_v3_agent_jobs j
    set status = 'processing', enrichment_status = 'processing', locked_by = p_worker_id,
      locked_at = now(), attempt_count = e.attempt_count + 1, last_error = null,
      next_run_at = null, updated_at = now()
    from eligible_jobs e where j.id = e.id returning j.*
  ),
  patched_documents as (
    update public.documents d
    set metadata = jsonb_strip_nulls(
        (coalesce(d.metadata, '{}'::jsonb) - 'indexing_v3_agent_next_run_at' - 'indexing_v3_agent_last_error')
        || jsonb_build_object(
          'indexing_v3_agent_status', 'processing',
          'indexing_v3_agent_version', cj.version,
          'indexing_v3_agent_locked_by', p_worker_id,
          'indexing_v3_agent_locked_at', cj.locked_at,
          'indexing_v3_agent_attempt_count', cj.attempt_count,
          'indexing_v3_agent_max_attempts', cj.max_attempts,
          'indexing_v3_agent_updated_at', now(),
          'enrichment_status', 'processing'
        )
      ), updated_at = now()
    from claimed_jobs cj
    where d.id = cj.document_id and d.status = 'indexed'
    returning d.*, cj.id as job_id, cj.attempt_count as job_attempt_count,
              cj.max_attempts as job_max_attempts, cj.locked_at as job_locked_at
  )
  select pd.job_id, pd.id, pd.import_batch_id, 'processing'::text, 'v3 enrichment claimed'::text,
    95::integer, null::text, pd.job_attempt_count, pd.job_max_attempts, pd.job_locked_at,
    p_worker_id,
    to_jsonb(pd.*) - 'job_id' - 'job_attempt_count' - 'job_max_attempts' - 'job_locked_at'
  from patched_documents pd;
end;
$$;

create or replace function public.jsonb_merge_deep(target_obj jsonb, patch_obj jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, extensions, pg_temp
as $$
declare
  merged jsonb := coalesce(target_obj, '{}'::jsonb);
  key text;
  incoming_value jsonb;
begin
  for key, incoming_value in
    select j.key, j.value
    from jsonb_each(coalesce(patch_obj, '{}'::jsonb)) as j
  loop
    -- JSON null means "delete this key" so worker deltas can clear sticky
    -- error/gate fields that the old full-replace used to wipe implicitly.
    if incoming_value = 'null'::jsonb then
      merged := merged - key;
    elsif jsonb_typeof(merged -> key) = 'object' and jsonb_typeof(incoming_value) = 'object' then
      merged := jsonb_set(
        merged,
        array[key],
        public.jsonb_merge_deep(merged -> key, incoming_value),
        true
      );
    else
      merged := jsonb_set(merged, array[key], incoming_value, true);
    end if;
  end loop;
  return merged;
end;
$$;

create or replace function public.apply_document_metadata_patch(
  p_document_id uuid,
  p_metadata_patch jsonb
)
returns void
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  update public.documents
  set
    metadata = public.jsonb_merge_deep(
      coalesce(metadata, '{}'::jsonb),
      coalesce(p_metadata_patch, '{}'::jsonb)
    ),
    updated_at = now()
  where id = p_document_id;
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
    updated_at = now()
  where id = p_document_id;

  -- R5: merge worker-owned keys onto live metadata instead of full-replace.
  perform public.apply_document_metadata_patch(
    p_document_id,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('index_generation_id', p_index_generation_id)
  );

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

  -- Preserve legacy NULL-generation rows unless this generation wrote replacements.
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

  -- artifact tables: use typed column where set; fall back to metadata when typed is NULL
  -- because the writer still populates metadata.index_generation_id rather than the typed
  -- column.  Without the metadata fallback, stale null-typed rows from a prior run would
  -- never be cleaned up (the typed-column EXISTS guard would always be false), allowing
  -- artifact rows to accumulate across re-indexes.
  delete from public.document_images
  where document_id = p_document_id
    and (
      (index_generation_id is not null and index_generation_id <> p_index_generation_id)
      or (
        index_generation_id is null
        and (metadata->>'index_generation_id')::uuid is distinct from p_index_generation_id
        and exists (
          select 1
          from public.document_images replacement
          where replacement.document_id = p_document_id
            and (
              replacement.index_generation_id = p_index_generation_id
              or (replacement.index_generation_id is null
                  and (replacement.metadata->>'index_generation_id')::uuid = p_index_generation_id)
            )
        )
      )
    );

  delete from public.document_table_facts
  where document_id = p_document_id
    and (
      (index_generation_id is not null and index_generation_id <> p_index_generation_id)
      or (
        index_generation_id is null
        and (metadata->>'index_generation_id')::uuid is distinct from p_index_generation_id
        and exists (
          select 1
          from public.document_table_facts replacement
          where replacement.document_id = p_document_id
            and (
              replacement.index_generation_id = p_index_generation_id
              or (replacement.index_generation_id is null
                  and (replacement.metadata->>'index_generation_id')::uuid = p_index_generation_id)
            )
        )
      )
    );

  delete from public.document_embedding_fields
  where document_id = p_document_id
    and (
      (index_generation_id is not null and index_generation_id <> p_index_generation_id)
      or (
        index_generation_id is null
        and (metadata->>'index_generation_id')::uuid is distinct from p_index_generation_id
        and exists (
          select 1
          from public.document_embedding_fields replacement
          where replacement.document_id = p_document_id
            and (
              replacement.index_generation_id = p_index_generation_id
              or (replacement.index_generation_id is null
                  and (replacement.metadata->>'index_generation_id')::uuid = p_index_generation_id)
            )
        )
      )
    );

  delete from public.document_index_units
  where document_id = p_document_id
    and (
      (index_generation_id is not null and index_generation_id <> p_index_generation_id)
      or (
        index_generation_id is null
        and (metadata->>'index_generation_id')::uuid is distinct from p_index_generation_id
        and exists (
          select 1
          from public.document_index_units replacement
          where replacement.document_id = p_document_id
            and (
              replacement.index_generation_id = p_index_generation_id
              or (replacement.index_generation_id is null
                  and (replacement.metadata->>'index_generation_id')::uuid = p_index_generation_id)
            )
        )
      )
    );

  delete from public.document_memory_cards
  where document_id = p_document_id
    and (
      (index_generation_id is not null and index_generation_id <> p_index_generation_id)
      or (
        index_generation_id is null
        and (metadata->>'index_generation_id')::uuid is distinct from p_index_generation_id
        and exists (
          select 1
          from public.document_memory_cards replacement
          where replacement.document_id = p_document_id
            and (
              replacement.index_generation_id = p_index_generation_id
              or (replacement.index_generation_id is null
                  and (replacement.metadata->>'index_generation_id')::uuid = p_index_generation_id)
            )
        )
      )
    );

  delete from public.document_sections
  where document_id = p_document_id
    and (
      (index_generation_id is not null and index_generation_id <> p_index_generation_id)
      or (
        index_generation_id is null
        and (metadata->>'index_generation_id')::uuid is distinct from p_index_generation_id
        and exists (
          select 1
          from public.document_sections replacement
          where replacement.document_id = p_document_id
            and (
              replacement.index_generation_id = p_index_generation_id
              or (replacement.index_generation_id is null
                  and (replacement.metadata->>'index_generation_id')::uuid = p_index_generation_id)
            )
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

create or replace function public.commit_document_deep_memory_generation(
  p_document_id uuid,
  p_producer text,
  p_artifact_generation_id uuid,
  p_rag_memory_version text,
  p_document_intelligence_version text,
  p_section_count integer,
  p_memory_card_count integer,
  p_index_unit_counts_by_type jsonb,
  p_repaired_anchor_count integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_document_metadata jsonb;
  v_document_owner_id uuid;
  v_committed_index_generation uuid;
  v_total_section_count integer;
  v_total_memory_card_count integer;
  v_total_index_unit_count integer;
  v_section_count integer;
  v_memory_card_count integer;
  v_index_unit_count integer;
  v_expected_index_unit_count integer;
  v_index_unit_counts_by_type jsonb;
begin
  if nullif(btrim(p_producer), '') is null
    or nullif(btrim(p_rag_memory_version), '') is null
    or nullif(btrim(p_document_intelligence_version), '') is null
  then
    raise exception 'Deep-memory producer must be non-empty.' using errcode = '22023';
  end if;
  if p_artifact_generation_id is null then
    raise exception 'Deep-memory artifact generation must be set.' using errcode = '22023';
  end if;
  if p_section_count is null or p_memory_card_count is null or p_repaired_anchor_count is null
    or p_section_count < 0 or p_memory_card_count < 0 or p_repaired_anchor_count < 0
  then
    raise exception 'Deep-memory counts cannot be negative.' using errcode = '22023';
  end if;
  if p_index_unit_counts_by_type is null or jsonb_typeof(p_index_unit_counts_by_type) <> 'object' then
    raise exception 'Deep-memory index-unit counts must be an object.' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_each(p_index_unit_counts_by_type) item
    where jsonb_typeof(item.value) <> 'number'
      or (item.value #>> '{}')::numeric < 0
      or trunc((item.value #>> '{}')::numeric) <> (item.value #>> '{}')::numeric
      or (item.value #>> '{}')::numeric > 2147483647
  ) then
    raise exception 'Deep-memory index-unit counts must be nonnegative integers.' using errcode = '22023';
  end if;

  select coalesce(d.metadata, '{}'::jsonb), d.owner_id
  into v_document_metadata, v_document_owner_id
  from public.documents d
  where d.id = p_document_id
  for update;

  if not found then
    raise exception 'Document % does not exist.', p_document_id using errcode = 'P0002';
  end if;

  begin
    v_committed_index_generation := nullif(v_document_metadata->>'index_generation_id', '')::uuid;
  exception when invalid_text_representation then
    raise exception 'Document % has an invalid committed index generation.', p_document_id using errcode = '22023';
  end;
  if v_committed_index_generation is null then
    raise exception 'Document % has no committed index generation.', p_document_id using errcode = '23514';
  end if;
  if v_committed_index_generation = p_artifact_generation_id then
    raise exception 'Staged deep-memory generation must differ from the committed index generation.' using errcode = '23514';
  end if;

  -- A generation UUID is a single-producer staging boundary. Reject collisions
  -- rather than interpreting another producer's rows as part of this commit.
  if exists (
    select 1 from public.document_sections
    where document_id = p_document_id
      and artifact_generation_id = p_artifact_generation_id
      and producer is distinct from p_producer
  ) or exists (
    select 1 from public.document_memory_cards
    where document_id = p_document_id
      and artifact_generation_id = p_artifact_generation_id
      and producer is distinct from p_producer
  ) or exists (
    select 1 from public.document_index_units
    where document_id = p_document_id
      and artifact_generation_id = p_artifact_generation_id
      and producer is distinct from p_producer
  ) then
    raise exception 'Deep-memory artifact generation belongs to another producer.' using errcode = '23514';
  end if;

  -- Re-check producer evidence inside the transaction. Legacy NULL-generation
  -- local-worker rows predate explicit producer metadata and are the only
  -- unlabelled shape eligible for producer-scoped replacement.
  if exists (
    select 1 from public.document_sections
    where document_id = p_document_id
      and (
        (producer is not null and nullif(metadata->>'generated_by', '') is distinct from producer)
        or (producer is null and nullif(metadata->>'generated_by', '') is not null and metadata->>'generated_by' <> p_producer)
        or (producer is null and artifact_generation_id is not null)
        or (
          producer is null
          and nullif(metadata->>'generated_by', '') is null
          and not (
            p_producer = 'local-worker'
            and artifact_generation_id is null
            and metadata->>'rag_indexing_version' = 'rag-deep-memory-v1'
          )
        )
      )
  ) or exists (
    select 1 from public.document_memory_cards
    where document_id = p_document_id
      and (
        (producer is not null and nullif(metadata->>'generated_by', '') is distinct from producer)
        or (producer is null and nullif(metadata->>'generated_by', '') is not null and metadata->>'generated_by' <> p_producer)
        or (producer is null and artifact_generation_id is not null)
        or (
          producer is null
          and nullif(metadata->>'generated_by', '') is null
          and not (p_producer = 'local-worker' and artifact_generation_id is null)
        )
      )
  ) or exists (
    select 1 from public.document_index_units
    where document_id = p_document_id
      and (
        (producer is not null and nullif(metadata->>'generated_by', '') is distinct from producer)
        or (producer is null and nullif(metadata->>'generated_by', '') is not null and metadata->>'generated_by' <> p_producer)
        or (producer is null and artifact_generation_id is not null)
        or (
          producer is null
          and nullif(metadata->>'generated_by', '') is null
          and not (p_producer = 'local-worker' and artifact_generation_id is null)
        )
      )
  ) then
    raise exception 'Deep-memory artifact producer evidence is contradictory or ambiguous.' using errcode = '23514';
  end if;

  select count(*) into v_total_section_count
  from public.document_sections
  where document_id = p_document_id
    and artifact_generation_id = p_artifact_generation_id;

  select count(*) into v_total_memory_card_count
  from public.document_memory_cards
  where document_id = p_document_id
    and artifact_generation_id = p_artifact_generation_id;

  select count(*) into v_total_index_unit_count
  from public.document_index_units
  where document_id = p_document_id
    and artifact_generation_id = p_artifact_generation_id;

  select count(*) into v_section_count
  from public.document_sections
  where document_id = p_document_id
    and producer = p_producer
    and artifact_generation_id = p_artifact_generation_id
    and index_generation_id = p_artifact_generation_id
    and owner_id is not distinct from v_document_owner_id
    and metadata->>'generated_by' = p_producer
    and metadata->>'artifact_generation_id' = p_artifact_generation_id::text
    and metadata->>'index_generation_id' = p_artifact_generation_id::text;

  select count(*) into v_memory_card_count
  from public.document_memory_cards
  where document_id = p_document_id
    and producer = p_producer
    and artifact_generation_id = p_artifact_generation_id
    and index_generation_id = p_artifact_generation_id
    and owner_id is not distinct from v_document_owner_id
    and metadata->>'generated_by' = p_producer
    and metadata->>'artifact_generation_id' = p_artifact_generation_id::text
    and metadata->>'index_generation_id' = p_artifact_generation_id::text;

  select coalesce(sum(unit_count), 0)::integer, coalesce(jsonb_object_agg(unit_type, unit_count), '{}'::jsonb)
  into v_index_unit_count, v_index_unit_counts_by_type
  from (
    select unit_type, count(*)::integer as unit_count
    from public.document_index_units
    where document_id = p_document_id
      and producer = p_producer
      and artifact_generation_id = p_artifact_generation_id
      and index_generation_id = p_artifact_generation_id
      and owner_id is not distinct from v_document_owner_id
      and metadata->>'generated_by' = p_producer
      and metadata->>'artifact_generation_id' = p_artifact_generation_id::text
      and metadata->>'index_generation_id' = p_artifact_generation_id::text
    group by unit_type
  ) staged_index_units;

  select coalesce(sum(value::integer), 0)
  into v_expected_index_unit_count
  from jsonb_each_text(coalesce(p_index_unit_counts_by_type, '{}'::jsonb));

  if v_total_section_count <> v_section_count
    or v_total_memory_card_count <> v_memory_card_count
    or v_total_index_unit_count <> coalesce(v_index_unit_count, 0)
    or v_section_count <> p_section_count
    or v_memory_card_count <> p_memory_card_count
    or coalesce(v_index_unit_count, 0) <> v_expected_index_unit_count
    or v_index_unit_counts_by_type <> coalesce(p_index_unit_counts_by_type, '{}'::jsonb)
  then
    raise exception 'Staged deep-memory artifact counts do not match the commit contract.' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.document_memory_cards card
    left join public.document_sections section
      on section.id = card.section_id
      and section.document_id = p_document_id
      and section.producer = p_producer
      and section.artifact_generation_id = p_artifact_generation_id
    where card.document_id = p_document_id
      and card.producer = p_producer
      and card.artifact_generation_id = p_artifact_generation_id
      and card.section_id is not null
      and section.id is null
  ) then
    raise exception 'Staged memory cards reference a section outside the staged generation.' using errcode = '23514';
  end if;

  -- Refuse to null another producer's section reference through ON DELETE SET
  -- NULL. This keeps the "other producers untouched" guarantee literal.
  if exists (
    select 1
    from public.document_memory_cards card
    join public.document_sections section on section.id = card.section_id
    where section.document_id = p_document_id
      and section.artifact_generation_id is distinct from p_artifact_generation_id
      and (
        section.producer = p_producer
        or (
          section.producer is null
          and (
            section.metadata->>'generated_by' = p_producer
            or (
              p_producer = 'local-worker'
              and nullif(section.metadata->>'generated_by', '') is null
              and section.metadata->>'rag_indexing_version' = 'rag-deep-memory-v1'
            )
          )
        )
      )
      and not (
        (card.producer = p_producer and card.metadata->>'generated_by' = p_producer)
        or (card.producer is null and card.metadata->>'generated_by' = p_producer)
        or (
          p_producer = 'local-worker'
          and card.producer is null
          and card.artifact_generation_id is null
          and nullif(card.metadata->>'generated_by', '') is null
        )
      )
  ) then
    raise exception 'Another producer references an older section owned by this producer.' using errcode = '23514';
  end if;

  update public.document_sections
  set
    index_generation_id = v_committed_index_generation,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'generated_by', p_producer,
      'artifact_generation_id', p_artifact_generation_id,
      'index_generation_id', v_committed_index_generation
    ),
    updated_at = now()
  where document_id = p_document_id
    and producer = p_producer
    and artifact_generation_id = p_artifact_generation_id;

  update public.document_memory_cards
  set
    index_generation_id = v_committed_index_generation,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'generated_by', p_producer,
      'artifact_generation_id', p_artifact_generation_id,
      'index_generation_id', v_committed_index_generation
    ),
    updated_at = now()
  where document_id = p_document_id
    and producer = p_producer
    and artifact_generation_id = p_artifact_generation_id;

  update public.document_index_units
  set
    index_generation_id = v_committed_index_generation,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'generated_by', p_producer,
      'artifact_generation_id', p_artifact_generation_id,
      'index_generation_id', v_committed_index_generation
    ),
    updated_at = now()
  where document_id = p_document_id
    and producer = p_producer
    and artifact_generation_id = p_artifact_generation_id;

  delete from public.document_memory_cards
  where document_id = p_document_id
    and artifact_generation_id is distinct from p_artifact_generation_id
    and (
      (producer = p_producer and metadata->>'generated_by' = p_producer)
      or (producer is null and metadata->>'generated_by' = p_producer)
      or (
        p_producer = 'local-worker'
        and producer is null
        and artifact_generation_id is null
        and nullif(metadata->>'generated_by', '') is null
      )
    );

  delete from public.document_index_units
  where document_id = p_document_id
    and artifact_generation_id is distinct from p_artifact_generation_id
    and (
      (producer = p_producer and metadata->>'generated_by' = p_producer)
      or (producer is null and metadata->>'generated_by' = p_producer)
      or (
        p_producer = 'local-worker'
        and producer is null
        and artifact_generation_id is null
        and nullif(metadata->>'generated_by', '') is null
      )
    );

  delete from public.document_sections
  where document_id = p_document_id
    and artifact_generation_id is distinct from p_artifact_generation_id
    and (
      (producer = p_producer and metadata->>'generated_by' = p_producer)
      or (
        producer is null
        and (
          metadata->>'generated_by' = p_producer
          or (
            p_producer = 'local-worker'
            and nullif(metadata->>'generated_by', '') is null
            and metadata->>'rag_indexing_version' = 'rag-deep-memory-v1'
          )
        )
      )
    );

  -- This is deliberately the final logical mutation. Any error above rolls
  -- back both activation and producer-scoped cleanup before metadata advertises
  -- the new deep-memory generation.
  perform public.apply_document_metadata_patch(
    p_document_id,
    jsonb_build_object(
      'rag_indexing_version', p_rag_memory_version,
      'rag_memory_version', p_rag_memory_version,
      'rag_memory_updated_at', now(),
      'document_intelligence_version', p_document_intelligence_version,
      'document_intelligence_updated_at', now(),
      'section_count', p_section_count,
      'memory_card_count', p_memory_card_count,
      'index_unit_count', v_expected_index_unit_count,
      'index_unit_counts_by_type', coalesce(p_index_unit_counts_by_type, '{}'::jsonb),
      'repaired_anchor_count', p_repaired_anchor_count,
      'deep_memory_generations', jsonb_build_object(p_producer, p_artifact_generation_id)
    )
  );

  return jsonb_build_object(
    'document_id', p_document_id,
    'producer', p_producer,
    'artifact_generation_id', p_artifact_generation_id,
    'index_generation_id', v_committed_index_generation,
    'section_count', p_section_count,
    'memory_card_count', p_memory_card_count,
    'index_unit_count', v_expected_index_unit_count
  );
end;
$$;

revoke execute on function public.commit_document_deep_memory_generation(uuid, text, uuid, text, text, integer, integer, jsonb, integer) from public, anon, authenticated;
grant execute on function public.commit_document_deep_memory_generation(uuid, text, uuid, text, text, integer, integer, jsonb, integer) to service_role;

create or replace function public.commit_document_index_generation(
  p_job_id uuid,
  p_worker_id text,
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
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_job public.ingestion_jobs%rowtype;
begin
  select * into v_job
  from public.ingestion_jobs
  where id = p_job_id
  for update;

  if not found
    or v_job.document_id is distinct from p_document_id
    or v_job.status is distinct from 'processing'
    or v_job.locked_by is distinct from p_worker_id
  then
    raise exception using errcode = 'P0001', message = 'ingestion_lease_lost';
  end if;

  return public.commit_document_index_generation(
    p_document_id, p_index_generation_id, p_status, p_page_count, p_chunk_count,
    p_image_count, p_metadata, p_pages, p_quality
  );
end;
$$;

revoke execute on function public.commit_document_index_generation(
  uuid, uuid, text, integer, integer, integer, jsonb, jsonb, jsonb
) from public, anon, authenticated, service_role;
revoke execute on function public.commit_document_index_generation(
  uuid, text, uuid, uuid, text, integer, integer, integer, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.commit_document_index_generation(
  uuid, text, uuid, uuid, text, integer, integer, integer, jsonb, jsonb, jsonb
) to service_role;

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

  -- Collect distinct document_ids that have stale (non-committed) artifact rows.
  -- document_chunks uses its typed column; artifact tables use their new typed columns.
  with candidate_documents as (
    select distinct document_id
    from (
      -- document_chunks (typed index_generation_id)
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
      -- document_images (typed index_generation_id)
      select a.document_id
      from public.document_images a
      join public.documents d on d.id = a.document_id
      where (p_document_id is null or a.document_id = p_document_id)
        and a.index_generation_id is not null
        and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '')
        and not exists (
          select 1 from public.ingestion_jobs j
          where j.document_id = a.document_id
            and j.status in ('pending', 'processing')
        )
      union all
      -- document_table_facts (typed index_generation_id)
      select a.document_id
      from public.document_table_facts a
      join public.documents d on d.id = a.document_id
      where (p_document_id is null or a.document_id = p_document_id)
        and a.index_generation_id is not null
        and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '')
        and not exists (
          select 1 from public.ingestion_jobs j
          where j.document_id = a.document_id
            and j.status in ('pending', 'processing')
        )
      union all
      -- document_embedding_fields (typed index_generation_id)
      select a.document_id
      from public.document_embedding_fields a
      join public.documents d on d.id = a.document_id
      where (p_document_id is null or a.document_id = p_document_id)
        and a.index_generation_id is not null
        and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '')
        and not exists (
          select 1 from public.ingestion_jobs j
          where j.document_id = a.document_id
            and j.status in ('pending', 'processing')
        )
      union all
      -- document_index_units (typed index_generation_id)
      select a.document_id
      from public.document_index_units a
      join public.documents d on d.id = a.document_id
      where (p_document_id is null or a.document_id = p_document_id)
        and a.index_generation_id is not null
        and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '')
        and not exists (
          select 1 from public.ingestion_jobs j
          where j.document_id = a.document_id
            and j.status in ('pending', 'processing')
        )
      union all
      -- document_memory_cards (typed index_generation_id)
      select a.document_id
      from public.document_memory_cards a
      join public.documents d on d.id = a.document_id
      where (p_document_id is null or a.document_id = p_document_id)
        and a.index_generation_id is not null
        and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '')
        and not exists (
          select 1 from public.ingestion_jobs j
          where j.document_id = a.document_id
            and j.status in ('pending', 'processing')
        )
      union all
      -- document_sections (typed index_generation_id)
      select a.document_id
      from public.document_sections a
      join public.documents d on d.id = a.document_id
      where (p_document_id is null or a.document_id = p_document_id)
        and a.index_generation_id is not null
        and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '')
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

  -- Count stale rows (typed column comparisons)
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
    and a.index_generation_id is not null
    and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

  select count(*) into table_fact_count
  from public.document_table_facts a
  join public.documents d on d.id = a.document_id
  where a.document_id = any(target_document_ids)
    and a.index_generation_id is not null
    and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

  select count(*) into embedding_field_count
  from public.document_embedding_fields a
  join public.documents d on d.id = a.document_id
  where a.document_id = any(target_document_ids)
    and a.index_generation_id is not null
    and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

  select count(*) into index_unit_count
  from public.document_index_units a
  join public.documents d on d.id = a.document_id
  where a.document_id = any(target_document_ids)
    and a.index_generation_id is not null
    and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

  select count(*) into memory_card_count
  from public.document_memory_cards a
  join public.documents d on d.id = a.document_id
  where a.document_id = any(target_document_ids)
    and a.index_generation_id is not null
    and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

  select count(*) into section_count
  from public.document_sections a
  join public.documents d on d.id = a.document_id
  where a.document_id = any(target_document_ids)
    and a.index_generation_id is not null
    and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

  if not coalesce(p_dry_run, true) then
    -- Audit R23: the pending/processing-job guard was only evaluated during
    -- candidate selection, before the seven count statements above. A reindex
    -- enqueued and claimed in that window would have its freshly-staged (still
    -- uncommitted, generation-mismatched) rows deleted mid-build. Re-filter to
    -- documents that STILL have no open job immediately before deleting, so the
    -- exposure window shrinks to this block instead of spanning candidate
    -- selection plus the counts.
    select coalesce(array_agg(doc_id), '{}'::uuid[])
    into target_document_ids
    from unnest(target_document_ids) as doc_id
    where not exists (
      select 1 from public.ingestion_jobs j
      where j.document_id = doc_id
        and j.status in ('pending', 'processing')
    );

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
      and a.index_generation_id is not null
      and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

    delete from public.document_table_facts a
    using public.documents d
    where d.id = a.document_id
      and a.document_id = any(target_document_ids)
      and a.index_generation_id is not null
      and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

    delete from public.document_embedding_fields a
    using public.documents d
    where d.id = a.document_id
      and a.document_id = any(target_document_ids)
      and a.index_generation_id is not null
      and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

    delete from public.document_index_units a
    using public.documents d
    where d.id = a.document_id
      and a.document_id = any(target_document_ids)
      and a.index_generation_id is not null
      and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

    delete from public.document_memory_cards a
    using public.documents d
    where d.id = a.document_id
      and a.document_id = any(target_document_ids)
      and a.index_generation_id is not null
      and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');

    delete from public.document_sections a
    using public.documents d
    where d.id = a.document_id
      and a.document_id = any(target_document_ids)
      and a.index_generation_id is not null
      and a.index_generation_id::text is distinct from nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '');
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

  -- Audit R9: two jobs of the same batch finishing in overlapping transactions
  -- each counted the batch before the other committed, so both computed
  -- 'processing' and the second write pinned the batch as processing forever.
  -- Locking the import_batches row first serializes concurrent refreshes: the
  -- second caller blocks here until the first commits, then its count below
  -- sees the first's committed job state.
  perform 1 from public.import_batches where id = p_batch_id for update;

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
  p_stage text default 'indexed',
  p_worker_id text default null
)
returns jsonb
language plpgsql
set search_path = public, extensions, pg_temp
as $$
declare
  v_matched integer;
begin
  -- Audit R1/R2: when the caller passes its worker id, fence the completion on
  -- `locked_by = p_worker_id`. A worker that lost its lease to a stale reclaim
  -- (or a resumed zombie) then matches 0 rows and returns lease_lost WITHOUT
  -- superseding siblings or touching the batch — the reclaimer owns the outcome.
  -- p_worker_id null preserves the pre-fence behavior for older callers.
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
    and document_id = p_document_id
    and (p_worker_id is null or locked_by = p_worker_id);
  get diagnostics v_matched = row_count;

  if p_worker_id is not null and v_matched = 0 then
    return jsonb_build_object('ok', false, 'reason', 'lease_lost', 'job_id', p_job_id, 'document_id', p_document_id);
  end if;

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
  p_next_run_at timestamptz default null,
  p_worker_id text default null
)
returns jsonb
language plpgsql
set search_path = public, extensions, pg_temp
as $$
declare
  v_job public.ingestion_jobs%rowtype;
  v_retry boolean;
begin
  -- Lock the job row so the ownership check and the write are atomic.
  select * into v_job
  from public.ingestion_jobs
  where id = p_job_id and document_id = p_document_id
  for update;

  -- Audit R1/R2: a fenced caller (p_worker_id set) must still hold the lease,
  -- otherwise a resumed zombie could demote a document the reclaimer already
  -- indexed. Return lease_lost without touching the document or job.
  if p_worker_id is not null and (v_job.id is null or v_job.locked_by is distinct from p_worker_id) then
    return jsonb_build_object('ok', false, 'reason', 'lease_lost', 'job_id', p_job_id, 'document_id', p_document_id, 'retry', false);
  end if;

  -- Audit R7: re-pending a job whose attempt_count already reached max_attempts
  -- would strand it as permanently-unclaimable 'pending' (claim requires
  -- attempt_count < max_attempts), pinning its batch as 'processing' forever.
  -- Downgrade such a retry to terminal 'failed' so the queue can drain.
  v_retry := p_retry and coalesce(v_job.attempt_count, 0) < coalesce(v_job.max_attempts, 0);

  update public.documents
  set
    status = p_document_status,
    error_message = p_error_message
  where id = p_document_id;

  update public.ingestion_jobs
  set
    status = case when v_retry then 'pending' else 'failed' end,
    stage = p_stage,
    progress = case when v_retry then 0 else 100 end,
    error_message = p_error_message,
    locked_at = null,
    locked_by = null,
    next_run_at = coalesce(p_next_run_at, next_run_at),
    completed_at = case when v_retry then null else now() end
  where id = p_job_id
    and document_id = p_document_id;

  if p_batch_id is not null then
    perform public.refresh_import_batch_status(p_batch_id);
  end if;

  return jsonb_build_object('ok', true, 'job_id', p_job_id, 'document_id', p_document_id, 'retry', v_retry);
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
  where l.document_id = p_document_id
    and coalesce(l.metadata->>'review_status', 'new') <> 'hidden'
    and coalesce(l.metadata->>'hidden', 'false') <> 'true';
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

-- Typed overload: NULL row generation keeps legacy rows visible; otherwise
-- compare typed to typed (NULL document generation yields NULL -> filtered,
-- exactly like the old text comparison against a missing metadata key).
create or replace function public.is_committed_document_generation(
  row_generation uuid,
  document_generation uuid
)
returns boolean
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select row_generation is null
    or row_generation = document_generation;
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

create or replace function public.retrieval_owner_matches(owner_filter uuid, row_owner_id uuid)
returns boolean
language sql
immutable
parallel safe
set search_path = public, pg_catalog
as $$
  select case
    when owner_filter is null then false -- fail CLOSED (was: true) — no DB-level global escape hatch
    when owner_filter = '00000000-0000-0000-0000-000000000000'::uuid then row_owner_id is null -- public corpus only
    else row_owner_id = owner_filter -- exact owner
  end;
$$;

-- Finding #11 (corpus-grounded relevance): deterministic in/out-of-corpus signal for the
-- unsupported-query soft tail. Reports, per query term and scoped exactly like retrieval,
-- whether the term stems to a usable tsquery, how many indexed document titles match it (the
-- corpus's own topic vocabulary), whether any committed chunk has ever seen it, and the scoped
-- corpus size for genericity shares. Read-only, additive, service_role-only.
-- App-side consumer: src/lib/corpus-grounding.ts. Migration: 20260707100000.
create or replace function public.corpus_topic_term_stats(
  terms text[],
  owner_filter uuid default null
)
returns table (
  term text,
  has_ts_signal boolean,
  title_doc_count integer,
  chunk_present boolean,
  total_doc_count integer
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  with input_terms as (
    select distinct lower(btrim(t.term)) as term
    from unnest(coalesce(terms, array[]::text[])) with ordinality as t(term, ord)
    where btrim(t.term) <> ''
      and t.ord <= 8
  ),
  totals as (
    select count(*)::integer as total_doc_count
    from public.documents d
    where public.retrieval_owner_matches(owner_filter, d.owner_id)
      and d.status = 'indexed'
  )
  select
    it.term,
    plainto_tsquery('english', it.term) <> ''::tsquery as has_ts_signal,
    (
      select count(*)::integer
      from public.documents d
      where public.retrieval_owner_matches(owner_filter, d.owner_id)
        and d.status = 'indexed'
        and d.title_search_tsv @@ plainto_tsquery('english', it.term)
    ) as title_doc_count,
    exists (
      select 1
      from public.document_chunks c
      join public.documents d on d.id = c.document_id
      where public.retrieval_owner_matches(owner_filter, d.owner_id)
        and d.status = 'indexed'
        and public.is_committed_document_generation(c.index_generation_id, d.index_generation_id)
        and c.search_tsv @@ plainto_tsquery('english', it.term)
    ) as chunk_present,
    totals.total_doc_count
  from input_terms it
  cross join totals;
$$;

revoke all on function public.corpus_topic_term_stats(text[], uuid) from public;
revoke all on function public.corpus_topic_term_stats(text[], uuid) from anon;
revoke all on function public.corpus_topic_term_stats(text[], uuid) from authenticated;
grant execute on function public.corpus_topic_term_stats(text[], uuid) to service_role;

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
    and public.retrieval_owner_matches(owner_filter, d.owner_id)
    and d.status = 'indexed'
    and public.is_committed_document_generation(c.index_generation_id, d.index_generation_id)
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
      and public.retrieval_owner_matches(owner_filter, d.owner_id)
      and d.status = 'indexed'
      and public.is_committed_document_generation(c.index_generation_id, d.index_generation_id)
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
      and public.retrieval_owner_matches(owner_filter, d.owner_id)
      and d.status = 'indexed'
      and public.is_committed_document_generation(c.index_generation_id, d.index_generation_id)
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
      and public.retrieval_owner_matches(owner_filter, d.owner_id)
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
      and public.retrieval_owner_matches(owner_filter, d.owner_id)
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
set plan_cache_mode = 'force_custom_plan'
as $$
BEGIN
  PERFORM set_config('hnsw.ef_search', '100', true);
  RETURN QUERY
select *
  from public.match_document_memory_cards_hybrid_v2(
    query_embedding,
    query_text,
    match_count,
    min_similarity,
    document_filters,
    owner_filter
  );
END
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
  commit_fn_def text;
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
  -- Verified live equivalents: same table/column intent, different migration-era name.
  index_aliases constant jsonb := jsonb_build_object(
    'documents_title_trgm_idx', jsonb_build_array('documents_title_search_tsv_idx', 'documents_title_search_idx'),
    'document_chunks_content_trgm_idx', jsonb_build_array('document_chunks_search_tsv_idx', 'document_chunks_search_idx'),
    'document_table_facts_owner_document_page_idx', jsonb_build_array('document_table_facts_owner_idx'),
    'document_pages_document_idx', jsonb_build_array('document_pages_document_id_page_number_key'),
    'document_sections_document_idx', jsonb_build_array('document_sections_document_id_idx'),
    'rag_retrieval_logs_owner_created_idx', jsonb_build_array('rag_retrieval_logs_owner_id_idx')
  );
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
    )
    and not (
      index_aliases ? index_name
      and exists (
        select 1
        from pg_class c
        join pg_namespace ns on ns.oid = c.relnamespace
        where ns.nspname = 'public'
          and c.relkind = 'i'
          and c.relname in (
            select jsonb_array_elements_text(index_aliases -> index_name)
          )
      )
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

  -- Audit M13: live DB must include the preserve-legacy-artifacts guard from
  -- 20260702000000_commit_generation_preserve_legacy_artifacts.sql.
  commit_fn_def := pg_get_functiondef(
    to_regprocedure(
      'public.commit_document_index_generation(uuid, uuid, text, integer, integer, integer, jsonb, jsonb, jsonb)'
    )
  );
  if commit_fn_def is null then
    missing := array_append(missing, 'commit_document_index_generation.signature');
  elsif position('from public.document_chunks replacement' in commit_fn_def) = 0 then
    missing := array_append(
      missing,
      'commit_document_index_generation.preserve_legacy_artifacts_migration'
    );
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

-- ============================================================================
-- Live-only objects codified 2026-07-07 (drift reconciliation).
-- These functions/triggers existed on the live project (raw-SQL era) but in
-- neither this file nor any migration. Captured verbatim from live
-- pg_get_functiondef; migration 20260707000000_codify_live_observed_drift.sql
-- carries the same definitions so branch databases converge.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_owner_id_from_auth_uid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
begin
  if new.owner_id is null then
    new.owner_id := auth.uid();
  end if;
  return new;
end;
$function$;


-- Service-role repair for bounded legacy imports. Each call assigns one index
-- generation atomically across the document and every retrieval artifact.
create or replace function public.backfill_legacy_index_health_batch(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'extensions', 'pg_temp'
as $$
declare
  repaired_count integer;
begin
  drop table if exists pg_temp.legacy_generation_repair;
  create temporary table legacy_generation_repair on commit drop as
  select candidate.document_id, gen_random_uuid() as generation_id
  from (
    select distinct ch.document_id
    from public.document_chunks ch
    join public.documents d on d.id = ch.document_id
    where d.status = 'indexed' and ch.index_generation_id is null
    order by ch.document_id
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  ) candidate;
  select count(*) into repaired_count from legacy_generation_repair;
  if repaired_count = 0 then return jsonb_build_object('repaired_documents', 0); end if;

  insert into public.document_labels (document_id, owner_id, label, label_type, source, confidence, metadata)
  select d.id, d.owner_id, lower(coalesce(nullif(trim(d.file_type), ''), 'document')),
         'document_type', 'generated', 0.70,
         jsonb_build_object('repair_source', 'db_repair', 'anchored', true, 'from', 'documents.file_type')
  from public.documents d join legacy_generation_repair repair on repair.document_id = d.id
  where not exists (select 1 from public.document_labels l where l.document_id = d.id and l.source = 'generated')
  on conflict (document_id, label_type, label, source) do nothing;

  update public.document_chunks row set index_generation_id = repair.generation_id, metadata = coalesce(row.metadata, '{}'::jsonb) || jsonb_build_object('index_generation_id', repair.generation_id) from legacy_generation_repair repair where row.document_id = repair.document_id;
  update public.document_images row set index_generation_id = repair.generation_id, metadata = coalesce(row.metadata, '{}'::jsonb) || jsonb_build_object('index_generation_id', repair.generation_id) from legacy_generation_repair repair where row.document_id = repair.document_id;
  update public.document_table_facts row set index_generation_id = repair.generation_id, metadata = coalesce(row.metadata, '{}'::jsonb) || jsonb_build_object('index_generation_id', repair.generation_id) from legacy_generation_repair repair where row.document_id = repair.document_id;
  update public.document_embedding_fields row set index_generation_id = repair.generation_id, metadata = coalesce(row.metadata, '{}'::jsonb) || jsonb_build_object('index_generation_id', repair.generation_id) from legacy_generation_repair repair where row.document_id = repair.document_id;
  update public.document_index_units row set index_generation_id = repair.generation_id, metadata = coalesce(row.metadata, '{}'::jsonb) || jsonb_build_object('index_generation_id', repair.generation_id) from legacy_generation_repair repair where row.document_id = repair.document_id;
  update public.document_memory_cards row set index_generation_id = repair.generation_id, metadata = coalesce(row.metadata, '{}'::jsonb) || jsonb_build_object('index_generation_id', repair.generation_id) from legacy_generation_repair repair where row.document_id = repair.document_id;
  update public.document_sections row set index_generation_id = repair.generation_id, metadata = coalesce(row.metadata, '{}'::jsonb) || jsonb_build_object('index_generation_id', repair.generation_id) from legacy_generation_repair repair where row.document_id = repair.document_id;
  update public.document_summaries row set metadata = coalesce(row.metadata, '{}'::jsonb) || jsonb_build_object('index_generation_id', repair.generation_id) from legacy_generation_repair repair where row.document_id = repair.document_id;
  update public.document_labels row set metadata = coalesce(row.metadata, '{}'::jsonb) || jsonb_build_object('index_generation_id', repair.generation_id) from legacy_generation_repair repair where row.document_id = repair.document_id;
  update public.documents row set metadata = coalesce(row.metadata, '{}'::jsonb) || jsonb_build_object('index_generation_id', repair.generation_id), updated_at = now() from legacy_generation_repair repair where row.id = repair.document_id;
  return jsonb_build_object('repaired_documents', repaired_count);
end;
$$;
revoke all on function public.backfill_legacy_index_health_batch(integer) from public, anon, authenticated;
grant execute on function public.backfill_legacy_index_health_batch(integer) to service_role;

revoke execute on function public.fail_or_retry_ingestion_job(uuid, uuid, uuid, boolean, text, text, text, timestamp with time zone, text) from public, anon, authenticated;
grant execute on function public.fail_or_retry_ingestion_job(uuid, uuid, uuid, boolean, text, text, text, timestamp with time zone, text) to service_role;

revoke execute on function public.complete_ingestion_job(uuid, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.complete_ingestion_job(uuid, uuid, uuid, text, text) to service_role;

revoke execute on function public.set_owner_id_from_auth_uid() from public, anon, authenticated;
grant execute on function public.set_owner_id_from_auth_uid() to service_role;

drop trigger if exists trg_set_owner_id_rag_queries on public.rag_queries;
create trigger trg_set_owner_id_rag_queries
before insert on public.rag_queries
for each row execute function public.set_owner_id_from_auth_uid();

drop trigger if exists trg_set_owner_id_rag_query_misses on public.rag_query_misses;
create trigger trg_set_owner_id_rag_query_misses
before insert on public.rag_query_misses
for each row execute function public.set_owner_id_from_auth_uid();

CREATE OR REPLACE FUNCTION public.purge_expired_rag_queries(p_retention_days integer DEFAULT 30)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog', 'pg_temp'
AS $function$
declare
  v_deleted integer;
begin
  if p_retention_days < 1 then
    raise exception 'retention days must be positive';
  end if;
  delete from public.rag_queries where created_at < now() - make_interval(days => p_retention_days);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$function$;

revoke execute on function public.purge_expired_rag_queries(integer) from public, anon, authenticated;
grant execute on function public.purge_expired_rag_queries(integer) to service_role;

CREATE OR REPLACE FUNCTION public.purge_expired_rag_query_misses(p_retention_days integer DEFAULT 90)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog', 'pg_temp'
AS $function$
declare
  v_deleted integer;
begin
  if p_retention_days < 1 then
    raise exception 'retention days must be positive';
  end if;
  delete from public.rag_query_misses where created_at < now() - make_interval(days => p_retention_days);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$function$;

revoke execute on function public.purge_expired_rag_query_misses(integer) from public, anon, authenticated;
grant execute on function public.purge_expired_rag_query_misses(integer) to service_role;

CREATE OR REPLACE FUNCTION public.correct_clinical_query_terms(input_query text, min_sim real DEFAULT 0.45)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
 SET pg_trgm.similarity_threshold = 0.3
AS $function$
declare
  tokens text[];
  tok text;
  best text;
  best_sim real;
  vocab text[];
  corrected text[] := array[]::text[];
  changed boolean := false;
begin
  if min_sim is null or min_sim < 0.3 or min_sim > 1 then
    raise exception 'min_sim must be between 0.3 and 1.0' using errcode = '22023';
  end if;

  if input_query is null or length(trim(input_query)) = 0 then
    return input_query;
  end if;

  -- Build the known-term vocabulary once per call. Every source is scoped to the
  -- public (null-owner) corpus: this function is SECURITY DEFINER and bypasses RLS, and
  -- both rag_aliases and documents carry owner-scoped private rows (deep-memory persists
  -- owner-scoped aliases/canonicals), so an unscoped read would leak private-document
  -- terms across tenants. Mirrors migration 20260717120000_corrector_public_titles_only.
  select array_agg(distinct term) into vocab
  from (
    select lower(alias) as term from public.rag_aliases where enabled and owner_id is null and length(alias) between 4 and 40
    union
    select lower(canonical) from public.rag_aliases where enabled and owner_id is null and length(canonical) between 4 and 40
    union
    select w from public.documents d, lateral unnest(regexp_split_to_array(lower(d.title), '[^a-z]+')) as w
    where d.status = 'indexed' and d.owner_id is null and length(w) between 4 and 40
  ) t;

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
$function$;

revoke execute on function public.correct_clinical_query_terms(text, real) from public, anon, authenticated;
grant execute on function public.correct_clinical_query_terms(text, real) to service_role;

-- NOTE: unlike invoke_indexing_v3_agent (URL moved to a GUC by 20260702160000),
-- the live definition still hardcodes the project URL. Codified as-is; migrate
-- to the GUC pattern in a follow-up if this RPC stays.
CREATE OR REPLACE FUNCTION public.invoke_ingestion_worker(p_limit integer DEFAULT 25)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'vault', 'pg_temp'
AS $function$
declare
  v_request_id bigint;
  v_jwt text;
  v_limit integer := greatest(1, least(coalesce("p_limit", 25), 200));
begin
  select "decrypted_secret" into v_jwt
  from "vault"."decrypted_secrets"
  where "name" = 'cron_ingestion_jwt'
  limit 1;

  if v_jwt is null or length(trim(v_jwt)) = 0 then
    raise exception 'Missing Vault secret: cron_ingestion_jwt';
  end if;

  select "net"."http_post"(
    url := 'https://sjrfecxgysukkwxsowpy.supabase.co/functions/v1/ingestion-worker?limit=' || v_limit::text,
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || v_jwt
    ),
    body := jsonb_build_object('source','pg_cron','worker','ingestion-worker','ts', now()),
    timeout_milliseconds := 60000
  )
  into v_request_id;

  return v_request_id;
end;
$function$;

revoke execute on function public.invoke_ingestion_worker(integer) from public, anon, authenticated;
grant execute on function public.invoke_ingestion_worker(integer) to service_role;

-- Full-inventory drift snapshot backing `npm run check:drift`. The expected
-- state lives in supabase/drift-manifest.json (generated from a scratch replay
-- of this file via `npm run drift:manifest`). Keep this definition byte-identical
-- to supabase/migrations/20260706200000_schema_drift_snapshot.sql; a unit test
-- in tests/supabase-schema.test.ts enforces it. See docs/database-drift-detection.md.
create or replace function public.schema_drift_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  snapshot jsonb;
  buckets jsonb := '[]'::jsonb;
begin
  select jsonb_build_object(
    'snapshot_version', 1,
    'captured_at', now(),
    'extensions', coalesce((
      select jsonb_agg(jsonb_build_object('name', e.extname, 'schema', n.nspname) order by e.extname)
      from pg_extension e
      join pg_namespace n on n.oid = e.extnamespace
      where e.extname <> 'plpgsql'
    ), '[]'::jsonb),
    'tables', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', c.relname,
        'rls_enabled', c.relrowsecurity,
        'rls_forced', c.relforcerowsecurity,
        'reloptions', (select array_agg(o.opt order by o.opt) from unnest(c.reloptions) o(opt)),
        'acl', (select array_agg(a.item::text order by a.item::text) from unnest(coalesce(c.relacl, acldefault('r', c.relowner))) a(item)),
        'columns', (
          select jsonb_agg(jsonb_build_object(
            'name', att.attname,
            'type', format_type(att.atttypid, att.atttypmod),
            'not_null', att.attnotnull,
            'identity', att.attidentity,
            'generated', att.attgenerated,
            'default', pg_get_expr(ad.adbin, ad.adrelid)
          ) order by att.attname)
          from pg_attribute att
          left join pg_attrdef ad on ad.adrelid = att.attrelid and ad.adnum = att.attnum
          where att.attrelid = c.oid and att.attnum > 0 and not att.attisdropped
        )
      ) order by c.relname)
      from pg_class c
      where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
    ), '[]'::jsonb),
    'views', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', c.relname,
        'def_hash', md5(regexp_replace(pg_get_viewdef(c.oid), '\s+', '', 'g'))
      ) order by c.relname)
      from pg_class c
      where c.relnamespace = 'public'::regnamespace and c.relkind in ('v', 'm')
    ), '[]'::jsonb),
    'functions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'signature', p.oid::regprocedure::text,
        'def_hash', md5(regexp_replace(regexp_replace(regexp_replace(pg_get_functiondef(p.oid), '/\*.*?\*/', '', 'gs'), '--[^\n]*', '', 'g'), '\s+', '', 'g')),
        'acl', (select array_agg(a.item::text order by a.item::text) from unnest(coalesce(p.proacl, acldefault('f', p.proowner))) a(item))
      ) order by p.oid::regprocedure::text)
      from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and p.prokind = 'f'
        and not exists (
          select 1 from pg_depend dep
          where dep.classid = 'pg_proc'::regclass and dep.objid = p.oid and dep.deptype = 'e'
        )
    ), '[]'::jsonb),
    'indexes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', ci.relname,
        'table', ct.relname,
        'def', pg_get_indexdef(ci.oid),
        'def_hash', md5(regexp_replace(pg_get_indexdef(ci.oid), '\s+', '', 'g'))
      ) order by ci.relname)
      from pg_index i
      join pg_class ci on ci.oid = i.indexrelid
      join pg_class ct on ct.oid = i.indrelid
      where ct.relnamespace = 'public'::regnamespace
        and ci.relnamespace = 'public'::regnamespace
    ), '[]'::jsonb),
    'policies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'schema', pol.schemaname,
        'table', pol.tablename,
        'name', pol.policyname,
        'permissive', pol.permissive,
        'roles', (select array_agg(r.role::text order by r.role::text) from unnest(pol.roles) r(role)),
        'cmd', pol.cmd,
        'qual', pol.qual,
        'with_check', pol.with_check
      ) order by pol.schemaname, pol.tablename, pol.policyname)
      from pg_policies pol
      where pol.schemaname in ('public', 'storage')
    ), '[]'::jsonb),
    'constraints', coalesce((
      select jsonb_agg(jsonb_build_object(
        'table', ct.relname,
        'name', con.conname,
        'def', pg_get_constraintdef(con.oid)
      ) order by ct.relname, con.conname)
      from pg_constraint con
      join pg_class ct on ct.oid = con.conrelid
      where con.connamespace = 'public'::regnamespace and ct.relkind = 'r'
    ), '[]'::jsonb),
    'triggers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'table', ct.relname,
        'name', t.tgname,
        'def', pg_get_triggerdef(t.oid)
      ) order by ct.relname, t.tgname)
      from pg_trigger t
      join pg_class ct on ct.oid = t.tgrelid
      where ct.relnamespace = 'public'::regnamespace and not t.tgisinternal
    ), '[]'::jsonb)
  ) into snapshot;

  if to_regclass('storage.buckets') is not null then
    execute 'select coalesce(jsonb_agg(jsonb_build_object('
      || '''id'', b.id, ''public'', b.public, ''file_size_limit'', b.file_size_limit, '
      || '''allowed_mime_types'', b.allowed_mime_types) order by b.id), ''[]''::jsonb) '
      || 'from storage.buckets b'
      into buckets;
  end if;

  return snapshot || jsonb_build_object('storage_buckets', buckets);
end;
$$;

revoke execute on function public.schema_drift_snapshot() from public, anon, authenticated;
grant execute on function public.schema_drift_snapshot() to service_role;

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
    left join public.document_labels l
      on l.document_id = d.id
      and coalesce(l.metadata->>'review_status', 'new') <> 'hidden'
      and coalesce(l.metadata->>'hidden', 'false') <> 'true'
    left join public.document_summaries s on s.document_id = d.id
    cross join query
    where public.retrieval_owner_matches(owner_filter, d.owner_id)
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

drop function if exists public.match_document_chunks_text(text, integer, uuid[], uuid);

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
  -- The chunk/title disjunction is split into two separately indexable probes:
  -- OR-ing predicates across document_chunks and documents defeated both GIN
  -- indexes and sequential-scanned every chunk (2026-07-13 audit, finding 1).
  -- Chunk-content matches probe document_chunks_search_idx directly.
  chunk_hits as (
    select c.id
    from public.document_chunks c
    cross join query
    where c.search_tsv @@ query.tsq
      and (document_filters is null or c.document_id = any(document_filters))
  ),
  -- Title matches probe documents_title_search_idx, then fan out to that
  -- document's chunks through document_chunks_document_idx.
  title_chunk_hits as (
    select c.id
    from public.documents d
    cross join query
    join public.document_chunks c on c.document_id = d.id
    where d.title_search_tsv @@ query.tsq
      and (document_filters is null or c.document_id = any(document_filters))
  ),
  lexical_candidates as (
    select chunk_hits.id from chunk_hits
    union
    select title_chunk_hits.id from title_chunk_hits
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
    from lexical_candidates cand
    join public.document_chunks c on c.id = cand.id
    join public.documents d on d.id = c.document_id
    cross join query
    where public.retrieval_owner_matches(owner_filter, d.owner_id)
      and d.status = 'indexed'
      and public.is_committed_document_generation(c.index_generation_id, d.index_generation_id)
    order by (
      ts_rank_cd(c.search_tsv, query.tsq) +
      (ts_rank_cd(d.title_search_tsv, query.tsq) * 3.0)
    ) desc
    limit least(greatest(match_count * 2, 24), 96)
  ),
  -- Batch-fetch label metadata for all distinct document_ids in the result set.
  -- One query replaces N per-row calls to document_label_metadata().
  doc_labels as (
    select
      l.document_id,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id',          l.id,
            'document_id', l.document_id,
            'owner_id',    l.owner_id,
            'label',       l.label,
            'label_type',  l.label_type,
            'source',      l.source,
            'confidence',  l.confidence,
            'metadata',    l.metadata,
            'created_at',  l.created_at,
            'updated_at',  l.updated_at
          )
          order by l.confidence desc, l.label
        ),
        '[]'::jsonb
      ) as labels
    from public.document_labels l
    where l.document_id in (select distinct ranked.document_id from ranked)
      and coalesce(l.metadata->>'review_status', 'new') <> 'hidden'
      and coalesce(l.metadata->>'hidden', 'false') <> 'true'
    group by l.document_id
  ),
  -- Batch-fetch summary text for all distinct document_ids in the result set.
  -- One query replaces N per-row calls to document_summary_text().
  doc_summaries as (
    select distinct on (s.document_id)
      s.document_id,
      s.summary
    from public.document_summaries s
    where s.document_id in (select distinct ranked.document_id from ranked)
    order by s.document_id
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
    coalesce(doc_labels.labels,   '[]'::jsonb) as document_labels,
    doc_summaries.summary                       as document_summary,
    -- Text-only fallback has NO vector cosine similarity. Do not fabricate one:
    -- a synthetic value here was read downstream as a real semantic score and
    -- could label a pure keyword hit as "strong"/"moderate" evidence (>=0.64).
    -- Leave similarity at 0; the lexical signal lives in lexical_score.
    0::double precision                                                              as similarity,
    ranked.text_rank,
    -- Cap hybrid_score well below the 0.64 "moderate" threshold so a lexical-only
    -- row can order amongst its peers but can never masquerade as a moderate/strong
    -- cosine match when merged with vector results.
    least(0.5,  0.18 + (least(ranked.text_rank, 1) * 0.3))::double precision       as hybrid_score,
    least(0.99, 0.4  + (least(ranked.text_rank, 1) * 0.59))::double precision      as lexical_score,
    public.chunk_image_metadata(ranked.image_ids)                                   as images
  from ranked
  left join doc_labels    on doc_labels.document_id    = ranked.document_id
  left join doc_summaries on doc_summaries.document_id = ranked.document_id
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
    and public.retrieval_owner_matches(owner_filter, d.owner_id)
    and d.status = 'indexed'
    and public.is_committed_document_generation(c.index_generation_id, d.index_generation_id)
    and (c.search_tsv @@ query.tsq or d.title_search_tsv @@ query.tsq)
  order by text_rank desc, c.chunk_index asc
  limit least(greatest(match_count, 1), 80);
$$;

revoke execute on function public.match_document_lookup_chunks_text(text, uuid[], integer, uuid) from public, anon, authenticated;
grant execute on function public.match_document_lookup_chunks_text(text, uuid[], integer, uuid) to service_role;

create or replace function public.search_document_chunks(
  p_document_id uuid,
  p_query text,
  match_count integer default 20,
  p_owner_id uuid default null
)
returns table (
  id uuid,
  page_number integer,
  chunk_index integer,
  section_heading text,
  content text,
  image_ids uuid[],
  text_rank real,
  trigram_score real
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  with normalized as (
    select
      websearch_to_tsquery('english', coalesce(p_query, '')) as query_tsv,
      lower(trim(coalesce(p_query, ''))) as query_text
  ),
  tokens as (
    select distinct token
    from normalized,
      lateral regexp_split_to_table(normalized.query_text, '\s+') as token
    where length(token) >= 3
  )
  select
    c.id,
    c.page_number,
    c.chunk_index,
    c.section_heading,
    c.content,
    c.image_ids,
    ts_rank_cd(c.search_tsv, normalized.query_tsv)::real as text_rank,
    similarity(lower(coalesce(c.section_heading, '') || ' ' || c.content), normalized.query_text)::real as trigram_score
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  cross join normalized
  where c.document_id = p_document_id
    and d.status = 'indexed'
    and public.is_committed_document_generation(c.index_generation_id, d.index_generation_id)
    and (
      (p_owner_id is null and d.owner_id is null)
      or (p_owner_id is not null and (d.owner_id is null or d.owner_id = p_owner_id))
    )
    and (
      c.search_tsv @@ normalized.query_tsv
      or lower(coalesce(c.section_heading, '') || ' ' || c.content) % normalized.query_text
      or lower(coalesce(c.section_heading, '') || ' ' || c.content) like '%' || normalized.query_text || '%'
      or exists (
        select 1
        from tokens t
        where lower(coalesce(c.section_heading, '') || ' ' || c.content) like '%' || t.token || '%'
          or lower(coalesce(c.section_heading, '') || ' ' || c.content) % t.token
      )
    )
  order by
    ts_rank_cd(c.search_tsv, normalized.query_tsv) desc,
    similarity(lower(coalesce(c.section_heading, '') || ' ' || c.content), normalized.query_text) desc,
    c.chunk_index asc
  limit least(greatest(match_count, 1), 80);
$$;

revoke execute on function public.search_document_chunks(uuid, text, integer, uuid) from public, anon, authenticated;
grant execute on function public.search_document_chunks(uuid, text, integer, uuid) to service_role;

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
          and public.retrieval_owner_matches(owner_filter, l.owner_id)
          and coalesce(l.metadata->>'review_status', 'new') <> 'hidden'
          and coalesce(l.metadata->>'hidden', 'false') <> 'true'
      ),
      '[]'::jsonb
    ) as labels,
    (
      select s.summary
      from public.document_summaries s
      where s.document_id = d.id
        and public.retrieval_owner_matches(owner_filter, s.owner_id)
      order by s.generated_at desc
      limit 1
    ) as summary
  from public.documents d
  where d.id = any(document_ids)
    and public.retrieval_owner_matches(owner_filter, d.owner_id);
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
set plan_cache_mode = 'force_custom_plan'
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
      and public.retrieval_owner_matches(owner_filter, f.owner_id)
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
set plan_cache_mode = 'force_custom_plan'
as $$
  with query as (
    select websearch_to_tsquery('english', coalesce(query_text, '')) as tsq
  ),
  vector_hits as (
    select f.id
    from public.document_embedding_fields f
    join public.documents d on d.id = f.document_id
    where (document_filters is null or f.document_id = any(document_filters))
      and public.retrieval_owner_matches(owner_filter, d.owner_id)
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
      and public.retrieval_owner_matches(owner_filter, d.owner_id)
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

create or replace function public.match_document_embedding_fields_text(
  query_text text, match_count integer default 16, min_text_rank double precision default 0.0,
  document_filters uuid[] default null, owner_filter uuid default null
)
returns table (
  id uuid, document_id uuid, source_chunk_id uuid, field_type text, content text, text_rank double precision
)
language sql stable set search_path = public, extensions, pg_temp
as $$
  with q as (select websearch_to_tsquery('english', coalesce(query_text, '')) as tsq),
  ranked as (
    select f.id, f.document_id, f.source_chunk_id, f.field_type, f.content,
      ts_rank_cd(f.search_tsv, q.tsq)::double precision as text_rank
    from public.document_embedding_fields f
    join public.documents d on d.id = f.document_id
    cross join q
    where f.source_chunk_id is not null
      and (document_filters is null or f.document_id = any(document_filters))
      and public.retrieval_owner_matches(owner_filter, d.owner_id)
      and d.status = 'indexed' and f.search_tsv @@ q.tsq
  )
  select * from ranked where text_rank >= min_text_rank
  order by text_rank desc, id limit match_count;
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
declare
  v_processing_lock_timeout interval := make_interval(mins => 45);
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
          case
            when coalesce(d.metadata->>'indexing_v3_agent_status', '') = 'processing'
              and (
                case
                  when coalesce(d.metadata->>'indexing_v3_agent_locked_at', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
                    then (d.metadata->>'indexing_v3_agent_locked_at')::timestamptz
                  else null
                end
              ) >= now() - v_processing_lock_timeout
              then jsonb_strip_nulls(
                (coalesce(d.metadata, '{}'::jsonb)
                  - 'indexing_v3_agent_next_run_at'
                  - 'indexing_v3_agent_last_error')
                || jsonb_build_object(
                  'indexing_v3_agent_status', 'processing',
                  'indexing_v3_agent_updated_at', now(),
                  'completion_gate_missing', to_jsonb(c.missing),
                  'completion_gate', jsonb_build_object(
                    'result', 'deferred',
                    'missing', to_jsonb(c.missing),
                    'counts', c.counts,
                    'presence', c.presence,
                    'source', 'repair_strict_enrichment_gate_batch'
                  ),
                  'enrichment_status', 'processing'
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
          end
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

-- Guarded: hosted Supabase denies ALTER DATABASE SET to the migration role
-- (42501); swallow insufficient_privilege so schema replay succeeds on hosted.
-- invoke_indexing_v3_agent falls back to the hardcoded URL when the GUC is unset.
do $$
begin
  execute format('alter database %I set app.indexing_v3_agent_base_url = %L',
                 current_database(), 'https://sjrfecxgysukkwxsowpy.supabase.co');
exception
  when insufficient_privilege then
    raise notice 'Skipping ALTER DATABASE SET app.indexing_v3_agent_base_url (insufficient privilege on hosted Supabase).';
end
$$;

create or replace function public.invoke_indexing_v3_agent(p_limit integer default 1)
returns bigint
language plpgsql
security definer
set search_path = public, extensions, vault, pg_temp
as $$
declare
  v_request_id bigint;
  v_secret     text;
  v_base_url   text;
begin
  select decrypted_secret
    into v_secret
  from vault.decrypted_secrets
  where name = 'indexing_v3_agent_secret'
  limit 1;

  if nullif(v_secret, '') is null then
    raise exception 'indexing_v3_agent_secret is missing from Supabase Vault';
  end if;

  -- Prefer the GUC; fall back to the hardcoded production URL so that
  -- existing deployments that have not yet set the GUC continue to work.
  v_base_url := coalesce(
    nullif(current_setting('app.indexing_v3_agent_base_url', true), ''),
    'https://sjrfecxgysukkwxsowpy.supabase.co'
  );

  select net.http_post(
    url := v_base_url || '/functions/v1/indexing-v3-agent?limit='
           || greatest(1, least(coalesce(p_limit, 1), 10))::text,
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

-- Reassert the creating role's future-object defaults. Global revokes remove
-- built-in/default grants; application grants stay scoped to schema public.
alter default privileges for role postgres
  revoke all privileges on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all privileges on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres
  revoke all privileges on sequences from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all privileges on sequences from public, anon, authenticated, service_role;
alter default privileges for role postgres
  revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to service_role;
alter default privileges for role postgres in schema public
  grant execute on functions to service_role;

-- Performance remediation: registry projection lifecycle cleanup.
create index if not exists documents_registry_projection_lookup_idx
  on public.documents (
    (metadata->>'registry_record_kind'),
    (metadata->>'registry_record_id')
  )
  where metadata->>'source_kind' = 'registry_record';

create or replace function public.cleanup_registry_corpus_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.documents
  where metadata->>'source_kind' = 'registry_record'
    and metadata->>'registry_record_kind' = case tg_table_name
      when 'clinical_registry_records' then pg_catalog.to_jsonb(old)->>'kind'
      when 'medication_records' then 'medication'
      when 'differential_records' then 'differential'
      else null
    end
    and metadata->>'registry_record_id' = old.id::text;
  return old;
end;
$$;

revoke execute on function public.cleanup_registry_corpus_document()
  from public, anon, authenticated, service_role;

-- Performance remediation: privacy-preserving indexed title vocabulary.
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

-- Backend-only RLS policy: browser roles retain neither table privileges nor a
-- matching policy, while service-role trigger and corrector access is explicit.
drop policy if exists "document title words service role all" on public.document_title_words;
create policy "document title words service role all" on public.document_title_words
  for all to service_role using (true) with check (true);

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

create or replace function public.enforce_document_title_word_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1
  from public.documents d
  where d.id = new.document_id
    and d.owner_id is null
    and d.status = 'indexed'
    and pg_catalog.length(new.word) between 4 and 40
    and new.word = any (
      pg_catalog.regexp_split_to_array(pg_catalog.lower(d.title), '[^a-z]+')
    )
  for share;

  if not found then
    raise exception 'document_title_words rows require a current indexed public document title'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_document_title_word_scope()
  from public, anon, authenticated, service_role;
drop trigger if exists document_title_words_enforce_public_scope
  on public.document_title_words;
create trigger document_title_words_enforce_public_scope
  before insert or update on public.document_title_words
  for each row execute function public.enforce_document_title_word_scope();

drop trigger if exists documents_sync_title_words on public.documents;
create trigger documents_sync_title_words
  after insert or update of title, status, owner_id or delete on public.documents
  for each row execute function public.sync_document_title_words();

delete from public.document_title_words dtw
where not exists (
  select 1
  from public.documents d
  where d.id = dtw.document_id
    and d.owner_id is null
    and d.status = 'indexed'
    and pg_catalog.length(dtw.word) between 4 and 40
    and dtw.word = any (
      pg_catalog.regexp_split_to_array(pg_catalog.lower(d.title), '[^a-z]+')
    )
);

insert into public.document_title_words (word, document_id)
select distinct pg_catalog.lower(title_word), d.id
from public.documents d
cross join lateral pg_catalog.unnest(
  pg_catalog.regexp_split_to_array(pg_catalog.lower(d.title), '[^a-z]+')
) as title_word
where d.owner_id is null and d.status = 'indexed'
  and pg_catalog.length(title_word) between 4 and 40
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
  public.api_rate_limit_subjects,
  public.audit_logs,
  public.storage_cleanup_jobs,
  public.rag_retrieval_logs
to service_role;

revoke all on public.audit_logs from anon, authenticated;
grant select, insert, update, delete on table public.audit_logs to service_role;

grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
revoke execute on function public.cleanup_registry_corpus_document() from service_role;
revoke execute on function public.sync_document_title_words() from service_role;
revoke execute on function public.enforce_document_title_word_scope() from service_role;
revoke execute on function public.claim_indexing_v3_agent_jobs(text, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_indexing_v3_agent_jobs(text, integer, integer) to service_role;
revoke execute on function public.match_document_embedding_fields_text(text, integer, double precision, uuid[], uuid) from public, anon, authenticated;
grant execute on function public.match_document_embedding_fields_text(text, integer, double precision, uuid[], uuid) to service_role;
revoke execute on function public.invoke_indexing_v3_agent(integer) from public, anon, authenticated;
grant execute on function public.invoke_indexing_v3_agent(integer) to service_role;

-- Browser clients do not receive direct table privileges. Public and signed-in
-- access is mediated by the server routes, while the owner policies below stay
-- in place as defense in depth if the Data API posture changes later.

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
alter table public.api_rate_limit_subjects enable row level security;
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
  for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "labels owner manual insert" on public.document_labels
  for insert to authenticated
  with check ((select auth.uid()) = owner_id and source = 'manual');
create policy "labels owner manual update" on public.document_labels
  for update to authenticated
  using ((select auth.uid()) = owner_id and source = 'manual')
  with check ((select auth.uid()) = owner_id and source = 'manual');
create policy "labels owner manual delete" on public.document_labels
  for delete to authenticated
  using ((select auth.uid()) = owner_id and source = 'manual');

create policy "summaries owner read" on public.document_summaries
  for select to authenticated
  using ((select auth.uid()) = owner_id);

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

create policy "api rate limit subjects service role all" on public.api_rate_limit_subjects
  for all to service_role
  using (true)
  with check (true);

create policy "audit logs service role all" on public.audit_logs
  for all to service_role
  using (true)
  with check (true);

create policy "storage cleanup owner read" on public.storage_cleanup_jobs
for select to authenticated
using ((select auth.uid()) = owner_id);

create policy "document storage owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'clinical-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "image storage owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'clinical-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

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
set plan_cache_mode = 'force_custom_plan'
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
      and public.retrieval_owner_matches(owner_filter, d.owner_id)
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

revoke execute on function public.reset_document_index(uuid) from public, anon, authenticated;
grant execute on function public.reset_document_index(uuid) to service_role;

create or replace function public.analyze_rag_tables()
returns void
language plpgsql
set search_path = public, extensions, pg_temp
as $$
declare
  table_names constant text[] := array[
    'documents',
    'document_chunks',
    'document_pages',
    'document_images',
    'document_sections',
    'document_memory_cards',
    'document_table_facts',
    'document_embedding_fields',
    'document_index_quality',
    'document_index_units',
    'rag_queries',
    'rag_query_misses',
    'rag_retrieval_logs',
    'rag_aliases',
    'ingestion_jobs'
  ];
  table_name text;
begin
  foreach table_name in array table_names loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('analyze public.%I', table_name);
    end if;
  end loop;
end;
$$;

revoke execute on function public.analyze_rag_tables() from public, anon, authenticated;
grant execute on function public.analyze_rag_tables() to service_role;

alter table public.document_index_units enable row level security;
grant select, insert, update, delete on table public.document_index_units to service_role;
revoke execute on function public.match_document_index_units_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid) from public, anon, authenticated;
grant execute on function public.match_document_index_units_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid) to service_role;
revoke execute on function public.jsonb_merge_deep(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.jsonb_merge_deep(jsonb, jsonb) to service_role;
revoke execute on function public.apply_document_metadata_patch(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.apply_document_metadata_patch(uuid, jsonb) to service_role;
revoke execute on function public.commit_document_index_generation(uuid, uuid, text, integer, integer, integer, jsonb, jsonb, jsonb) from public, anon, authenticated, service_role;
revoke execute on function public.cleanup_abandoned_document_index_generations(uuid, integer, boolean) from public, anon, authenticated;
grant execute on function public.cleanup_abandoned_document_index_generations(uuid, integer, boolean) to service_role;
revoke execute on function public.is_committed_document_generation(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.is_committed_document_generation(uuid, jsonb) to service_role;
revoke execute on function public.is_committed_document_generation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.is_committed_document_generation(uuid, uuid) to service_role;
revoke execute on function public.is_committed_artifact_generation(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.is_committed_artifact_generation(jsonb, jsonb) to service_role;

-- Typed overload: NULL keeps legacy artifacts visible; otherwise compare to committed id
create or replace function public.is_committed_artifact_generation(
  artifact_generation_id uuid,
  document_metadata jsonb
)
returns boolean
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select artifact_generation_id is null
    or artifact_generation_id::text =
       nullif(coalesce(document_metadata, '{}'::jsonb)->>'index_generation_id', '');
$$;

revoke execute on function public.is_committed_artifact_generation(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.is_committed_artifact_generation(uuid, jsonb) to service_role;

create policy "document index units owner read" on public.document_index_units
  for select to authenticated using (
    exists (select 1 from public.documents d where d.id = document_id and d.owner_id = (select auth.uid()))
  );

-- -------------------------------------------------------------------------
-- indexing_v3_agent_jobs: dedicated worker-state table (Finding #1)
-- Replaces JSONB claim state in documents.metadata with typed rows that
-- support SKIP LOCKED on a small, hot table instead of a full-table scan.
-- -------------------------------------------------------------------------

create table if not exists public.indexing_v3_agent_jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  -- v3 agent processing status (mirrors metadata->>'indexing_v3_agent_status')
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'needs_enrichment_artifacts')),
  -- enrichment pipeline status (mirrors metadata->>'enrichment_status')
  enrichment_status text not null default 'pending'
    check (enrichment_status in ('pending', 'processing', 'completed', 'failed', 'needs_enrichment_artifacts')),
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  locked_by text,
  locked_at timestamptz,
  next_run_at timestamptz,
  version text not null default 'visual-core-v3',
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per document; re-running resets the row in-place
create unique index if not exists indexing_v3_agent_jobs_document_id_idx
  on public.indexing_v3_agent_jobs(document_id);

-- Hot path for claim: eligible candidates ordered by next_run_at
create index if not exists indexing_v3_agent_jobs_claim_idx
  on public.indexing_v3_agent_jobs(status, enrichment_status, next_run_at, id)
  where status not in ('completed', 'needs_enrichment_artifacts');

-- Operational: find stale processing jobs
create index if not exists indexing_v3_agent_jobs_locked_at_idx
  on public.indexing_v3_agent_jobs(locked_at)
  where status = 'processing';

-- RLS + grants (service_role only, same as ingestion_jobs)
alter table public.indexing_v3_agent_jobs enable row level security;

create policy "indexing v3 agent jobs service role all"
  on public.indexing_v3_agent_jobs
  for all to service_role
  using (true)
  with check (true);

grant select, insert, update, delete
  on table public.indexing_v3_agent_jobs to service_role;

create or replace function public.update_indexing_v3_agent_job_status(
  p_document_id uuid,
  p_status text,         -- 'completed', 'failed', 'needs_enrichment_artifacts', 'pending'
  p_error text default null,
  p_next_run_at timestamptz default null
)
returns jsonb
language plpgsql
set search_path = public, extensions, pg_temp
as $$
declare
  v_job_id uuid;
begin
  if p_status not in ('pending', 'completed', 'failed', 'needs_enrichment_artifacts') then
    raise exception 'invalid status %', p_status;
  end if;

  update public.indexing_v3_agent_jobs
  set
    status = p_status,
    enrichment_status = case
      when p_status = 'completed' then 'completed'
      when p_status = 'failed' then 'failed'
      when p_status = 'needs_enrichment_artifacts' then 'needs_enrichment_artifacts'
      else enrichment_status
    end,
    last_error = p_error,
    next_run_at = case
      when p_status = 'pending' then coalesce(p_next_run_at, now())
      else null
    end,
    locked_by = null,
    locked_at = null,
    updated_at = now()
  where document_id = p_document_id
  returning id into v_job_id;

  return jsonb_build_object(
    'ok', v_job_id is not null,
    'job_id', v_job_id,
    'document_id', p_document_id,
    'status', p_status
  );
end;
$$;

revoke execute on function public.update_indexing_v3_agent_job_status(uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.update_indexing_v3_agent_job_status(uuid, text, text, timestamptz) to service_role;

comment on index public.documents_indexing_v3_agent_claim_idx is
  'Retained for backward compatibility while edge function still writes enrichment_status / indexing_v3_agent_status to documents.metadata. Drop after edge function migration.';

comment on table public.indexing_v3_agent_jobs is
  'Dedicated worker-state table for the v3 indexing / enrichment agent. Replaces JSONB state in documents.metadata. claim_indexing_v3_agent_jobs uses SKIP LOCKED here; update_indexing_v3_agent_job_status completes/fails a job. See migration 20260702190000 for transition notes.';

create or replace function public.request_indexing_v3_enrichment(
  p_document_id uuid,
  p_owner_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_job_id uuid;
  v_job_status text;
begin
  -- Validate without taking the document lock. The job row is created/locked
  -- first below so request and claim paths share one lock order.
  perform 1
  from public.documents
  where id = p_document_id and owner_id = p_owner_id and status = 'indexed';
  if not found then
    raise exception using errcode = 'P0001', message = 'document_not_available_for_enrichment';
  end if;

  insert into public.indexing_v3_agent_jobs (
    document_id, status, enrichment_status, attempt_count, max_attempts, version, metadata
  ) values (
    p_document_id, 'pending', 'pending', 0, 3, 'visual-core-v3', '{}'::jsonb
  )
  on conflict (document_id) do nothing
  returning id, status into v_job_id, v_job_status;

  if v_job_id is null then
    select id, status into v_job_id, v_job_status
    from public.indexing_v3_agent_jobs
    where document_id = p_document_id
    for update;
  end if;

  if v_job_id is null then
    raise exception using errcode = 'P0001', message = 'enrichment_job_unavailable';
  end if;
  if v_job_status = 'processing' then
    raise exception using errcode = 'P0001', message = 'enrichment_active';
  end if;

  perform 1
  from public.documents
  where id = p_document_id and owner_id = p_owner_id and status = 'indexed'
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'document_not_available_for_enrichment';
  end if;

  if exists (
    select 1 from public.ingestion_jobs
    where document_id = p_document_id and status in ('pending', 'processing')
  ) then
    raise exception using errcode = 'P0001', message = 'ingestion_active';
  end if;

  update public.indexing_v3_agent_jobs
  set status = 'pending',
      enrichment_status = 'pending',
      attempt_count = 0,
      locked_by = null,
      locked_at = null,
      next_run_at = null,
      last_error = null,
      updated_at = now()
  where id = v_job_id;

  update public.documents
  set metadata = (coalesce(metadata, '{}'::jsonb)
      - 'indexing_v3_agent_locked_by' - 'indexing_v3_agent_locked_at'
      - 'indexing_v3_agent_last_error' - 'indexing_v3_agent_next_run_at'
      - 'indexing_v3_agent_attempt_count' - 'indexing_v3_agent_max_attempts')
      || jsonb_build_object(
        'enrichment_status', 'pending',
        'indexing_v3_agent_status', 'pending',
        'indexing_v3_agent_updated_at', now()
      ),
      updated_at = now()
  where id = p_document_id and owner_id = p_owner_id;

  return jsonb_build_object('ok', true, 'job_id', v_job_id);
end;
$$;

revoke execute on function public.request_indexing_v3_enrichment(uuid, uuid) from public, anon, authenticated;
grant execute on function public.request_indexing_v3_enrichment(uuid, uuid) to service_role;


create table if not exists public.rag_visual_eval_cases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  document_id uuid references public.documents(id) on delete set null,
  case_name text not null, query text not null,
  expected_unit_types text[] not null default '{}'::text[],
  expected_terms text[] not null default '{}'::text[],
  expected_image_type text, active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rag_visual_eval_cases_doc_idx on public.rag_visual_eval_cases(document_id, active);
create index if not exists rag_visual_eval_cases_owner_id_idx on public.rag_visual_eval_cases(owner_id);

create table if not exists public.rag_visual_eval_runs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.rag_visual_eval_cases(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  passed boolean not null, top_hit boolean not null, matched_count integer not null default 0,
  hit_payload jsonb not null default '{}'::jsonb, run_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists rag_visual_eval_runs_case_id_idx on public.rag_visual_eval_runs(case_id);
create index if not exists rag_visual_eval_runs_document_id_idx on public.rag_visual_eval_runs(document_id);

alter table public.rag_visual_eval_cases enable row level security;
alter table public.rag_visual_eval_runs enable row level security;
drop policy if exists "rag visual eval cases service role all" on public.rag_visual_eval_cases;
create policy "rag visual eval cases service role all" on public.rag_visual_eval_cases for all to service_role using (true) with check (true);
drop policy if exists "rag visual eval runs service role all" on public.rag_visual_eval_runs;
create policy "rag visual eval runs service role all" on public.rag_visual_eval_runs for all to service_role using (true) with check (true);
grant select, insert, update, delete on table public.rag_visual_eval_cases to service_role;
grant select, insert, update, delete on table public.rag_visual_eval_runs to service_role;

-- Curated clinical registry backing the Services and Forms modes: structured
-- records (contacts, eligibility, referral pathways, criteria) for real WA
-- entities, seeded from reviewed fixtures and linkable to verifying source
-- documents in the indexed corpus. Owner-scoped like every other app table;
-- ownership is enforced at the API layer via the service-role client.
create table if not exists public.clinical_registry_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('service', 'form')),
  slug text not null check (btrim(slug) <> ''),
  title text not null check (btrim(title) <> ''),
  subtitle text,
  route text,
  eligibility text,
  cost text,
  referral text,
  location text,
  best_use text,
  catalogue_label text,
  navigator_query text,
  tags text[] not null default '{}',
  catchments text[] not null default '{}',
  status_chips jsonb not null default '[]'::jsonb,
  primary_contact jsonb,
  contacts jsonb not null default '[]'::jsonb,
  summary_cards jsonb not null default '[]'::jsonb,
  referral_info jsonb not null default '[]'::jsonb,
  criteria jsonb not null default '[]'::jsonb,
  verification jsonb not null default '{}'::jsonb,
  source jsonb not null default '{}'::jsonb,
  catalog_payload jsonb not null default '{}'::jsonb,
  -- Governance columns mirror the search-scope enums so registry records carry
  -- the same conservative source metadata as documents (missing -> unknown).
  source_status text not null default 'unknown'
    check (source_status in ('current', 'review_due', 'outdated', 'unknown')),
  validation_status text not null default 'unverified'
    check (validation_status in ('unverified', 'locally_reviewed', 'approved')),
  last_reviewed_at date,
  review_due_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, kind, slug)
);

-- Source-document linkage: which indexed corpus documents verify a registry
-- record. FK integrity keeps links honest when documents are deleted.
create table if not exists public.clinical_registry_record_sources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  record_id uuid not null references public.clinical_registry_records(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  unique (record_id, document_id)
);

create index if not exists clinical_registry_records_owner_kind_idx
  on public.clinical_registry_records(owner_id, kind, title);
-- No standalone record_id index: the unique (record_id, document_id) index's
-- leading column serves record_id lookups (20260711000000 dropped the redundant
-- clinical_registry_record_sources_record_idx).
create index if not exists clinical_registry_record_sources_document_idx
  on public.clinical_registry_record_sources(document_id);

drop trigger if exists clinical_registry_records_updated_at on public.clinical_registry_records;
create trigger clinical_registry_records_updated_at
  before update on public.clinical_registry_records
  for each row execute function public.set_updated_at();

-- Service-role only: reads and writes go through the API layer, which enforces
-- owner scoping on every query (application-layer model, same as documents).
alter table public.clinical_registry_records enable row level security;
alter table public.clinical_registry_record_sources enable row level security;

revoke all on public.clinical_registry_records from anon, authenticated;
revoke all on public.clinical_registry_record_sources from anon, authenticated;

grant select, insert, update, delete on table public.clinical_registry_records to service_role;
grant select, insert, update, delete on table public.clinical_registry_record_sources to service_role;

drop policy if exists "registry records service role all" on public.clinical_registry_records;
create policy "registry records service role all" on public.clinical_registry_records
  for all to service_role using (true) with check (true);

drop policy if exists "registry record sources service role all" on public.clinical_registry_record_sources;
create policy "registry record sources service role all" on public.clinical_registry_record_sources
  for all to service_role using (true) with check (true);

-- -------------------------------------------------------------------------
-- Medication catalogue (Prescribing mode)
-- -------------------------------------------------------------------------

create table if not exists public.medication_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null check (btrim(slug) <> ''),
  name text not null check (btrim(name) <> ''),
  class text not null default '',
  subclass text not null default '',
  category text not null default '',
  accent text not null default '#0f766e',
  tag text not null default '',
  schedule text not null default '',
  stats jsonb not null default '[]'::jsonb,
  sections jsonb not null default '[]'::jsonb,
  quick jsonb not null default '[]'::jsonb,
  source_status text not null default 'unknown'
    check (source_status in ('current', 'review_due', 'outdated', 'unknown')),
  validation_status text not null default 'unverified'
    check (validation_status in ('unverified', 'locally_reviewed', 'approved')),
  last_reviewed_at date,
  review_due_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug)
);

create index if not exists medication_records_owner_name_idx
  on public.medication_records(owner_id, name);
create index if not exists medication_records_owner_category_idx
  on public.medication_records(owner_id, category);
create index if not exists medication_records_owner_schedule_idx
  on public.medication_records(owner_id, schedule);

drop trigger if exists medication_records_updated_at on public.medication_records;
create trigger medication_records_updated_at
  before update on public.medication_records
  for each row execute function public.set_updated_at();

alter table public.medication_records enable row level security;

revoke all on public.medication_records from anon, authenticated;

grant select, insert, update, delete on table public.medication_records to service_role;

drop policy if exists "medication records service role all" on public.medication_records;
create policy "medication records service role all" on public.medication_records
  for all to service_role using (true) with check (true);

-- -------------------------------------------------------------------------
-- Differential catalogue (Differentials mode)
-- -------------------------------------------------------------------------

create table if not exists public.differential_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('presentation', 'diagnosis')),
  slug text not null check (btrim(slug) <> ''),
  title text not null check (btrim(title) <> ''),
  subtitle text,
  status text not null check (status in ('emergent', 'urgent', 'routine')),
  clinical_hinge text,
  tags text[] not null default '{}',
  payload jsonb not null default '{}'::jsonb,
  source jsonb not null default '{}'::jsonb,
  source_status text not null default 'unknown'
    check (source_status in ('current', 'review_due', 'outdated', 'unknown')),
  validation_status text not null default 'unverified'
    check (validation_status in ('unverified', 'locally_reviewed', 'approved')),
  last_reviewed_at date,
  review_due_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, kind, slug)
);

create index if not exists differential_records_owner_kind_title_idx
  on public.differential_records(owner_id, kind, title);
create index if not exists differential_records_owner_status_idx
  on public.differential_records(owner_id, status);

drop trigger if exists differential_records_updated_at on public.differential_records;
create trigger differential_records_updated_at
  before update on public.differential_records
  for each row execute function public.set_updated_at();

alter table public.differential_records enable row level security;

revoke all on public.differential_records from anon, authenticated;

grant select, insert, update, delete on table public.differential_records to service_role;

drop policy if exists "differential records service role all" on public.differential_records;
create policy "differential records service role all" on public.differential_records
  for all to service_role using (true) with check (true);

create table if not exists public.source_review_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  reviewer_id uuid not null,
  decision text not null check (decision in ('locally_reviewed', 'approved', 'rejected', 'decommissioned', 'superseded')),
  reason text not null check (char_length(reason) between 3 and 2000),
  evidence_references text[] not null default '{}',
  prior_document_status text not null,
  new_document_status text not null,
  prior_validation_status text not null,
  new_validation_status text not null,
  review_date date,
  replacement_document_id uuid,
  created_at timestamptz not null default now()
);

alter table public.source_review_events enable row level security;
revoke all on table public.source_review_events from anon, authenticated;
grant select, insert on table public.source_review_events to service_role;
drop policy if exists "source review events service role" on public.source_review_events;
create policy "source review events service role"
  on public.source_review_events for all to service_role using (true) with check (true);

create or replace function public.prevent_source_review_event_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'source_review_events is append-only';
end;
$$;

drop trigger if exists source_review_events_immutable on public.source_review_events;
create trigger source_review_events_immutable
before update or delete on public.source_review_events
for each row execute function public.prevent_source_review_event_mutation();

create or replace function public.record_source_review(
  p_document_id uuid,
  p_reviewer_id uuid,
  p_decision text,
  p_reason text,
  p_evidence_references text[] default '{}',
  p_review_date date default null,
  p_replacement_document_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_document public.documents%rowtype;
  v_metadata jsonb;
  v_prior_status text;
  v_prior_validation text;
  v_new_status text;
  v_new_validation text;
  v_event public.source_review_events%rowtype;
begin
  if p_decision not in ('locally_reviewed', 'approved', 'rejected', 'decommissioned', 'superseded') then raise exception 'invalid source review decision'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'source review reason is required'; end if;
  if p_decision in ('locally_reviewed', 'approved') and coalesce(cardinality(p_evidence_references), 0) = 0 then raise exception 'evidence references are required for source promotion'; end if;
  if p_decision = 'superseded' and p_replacement_document_id is null then raise exception 'replacement document is required for supersession'; end if;
  if p_replacement_document_id is not null and not exists (select 1 from public.documents where id = p_replacement_document_id and owner_id = p_reviewer_id) then raise exception 'replacement document not found'; end if;
  select * into v_document from public.documents where id = p_document_id and owner_id = p_reviewer_id for update;
  if not found then raise exception 'document not found'; end if;
  v_metadata := coalesce(v_document.metadata, '{}'::jsonb);
  v_prior_status := coalesce(v_metadata->>'document_status', 'unknown');
  v_prior_validation := coalesce(v_metadata->>'clinical_validation_status', 'unverified');
  if p_decision in ('rejected', 'decommissioned', 'superseded') then
    v_new_status := 'outdated';
    v_new_validation := case when p_decision = 'rejected' then 'unverified' else v_prior_validation end;
  else
    v_new_status := case when p_review_date is not null and p_review_date < (now() at time zone 'Australia/Perth')::date then 'review_due' else 'current' end;
    v_new_validation := p_decision;
  end if;
  v_metadata := v_metadata || jsonb_build_object(
    'document_status', v_new_status,
    'clinical_validation_status', v_new_validation,
    'review_date', to_jsonb(p_review_date),
    'provenance_basis', case when p_decision in ('locally_reviewed', 'approved') then 'reviewer_verified' else coalesce(v_metadata->>'provenance_basis', 'unknown') end,
    'governance_disposition', p_decision,
    'governance_updated_at', now(),
    'governance_updated_by', p_reviewer_id
  );
  insert into public.source_review_events (
    document_id, reviewer_id, decision, reason, evidence_references, prior_document_status,
    new_document_status, prior_validation_status, new_validation_status, review_date, replacement_document_id
  ) values (
    p_document_id, p_reviewer_id, p_decision, trim(p_reason), coalesce(p_evidence_references, '{}'),
    v_prior_status, v_new_status, v_prior_validation, v_new_validation, p_review_date, p_replacement_document_id
  ) returning * into v_event;
  update public.documents set metadata = v_metadata, updated_at = now() where id = p_document_id;
  return to_jsonb(v_event);
end;
$$;

revoke all on function public.record_source_review(uuid, uuid, text, text, text[], date, uuid) from public, anon, authenticated;
grant execute on function public.record_source_review(uuid, uuid, text, text, text[], date, uuid) to service_role;

create table if not exists public.rag_answer_feedback (
  id uuid primary key default gen_random_uuid(),
  interaction_id uuid not null unique,
  owner_id uuid references auth.users(id) on delete set null,
  feedback_category text not null check (feedback_category in ('verified', 'needs_correction', 'source_insufficient', 'wrong_source', 'missing_source', 'unsupported_answer', 'numeric_error', 'outdated_guidance')),
  answer_hash text not null,
  cited_source_ids uuid[] not null default '{}',
  source_ids uuid[] not null default '{}',
  route text,
  model text,
  provider_request_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists rag_answer_feedback_owner_id_idx
  on public.rag_answer_feedback (owner_id);
alter table public.rag_answer_feedback enable row level security;
revoke all on table public.rag_answer_feedback from anon, authenticated;
grant select, insert, delete on table public.rag_answer_feedback to service_role;
drop policy if exists "rag answer feedback service role" on public.rag_answer_feedback;
create policy "rag answer feedback service role" on public.rag_answer_feedback for all to service_role using (true) with check (true);

create or replace function public.purge_expired_rag_response_cache(p_limit integer default 1000)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_deleted integer;
begin
  if p_limit < 1 or p_limit > 10000 then raise exception 'purge limit must be between 1 and 10000'; end if;
  with expired as (select id from public.rag_response_cache where expires_at <= now() order by expires_at asc limit p_limit)
  delete from public.rag_response_cache cache using expired where cache.id = expired.id;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;
revoke all on function public.purge_expired_rag_response_cache(integer) from public, anon, authenticated;
grant execute on function public.purge_expired_rag_response_cache(integer) to service_role;
-- Codified live operational indexes retained after the 2026-07-13 drift audit.
-- None are exact duplicates; FK, generation, owner, and retrieval access paths
-- remain explicit so scratch replay matches the proven production schema.
create index if not exists audit_logs_owner_id_idx on public.audit_logs (owner_id);
create index if not exists clinical_registry_record_sources_owner_id_idx on public.clinical_registry_record_sources (owner_id);
create unique index if not exists differential_records_owner_slug_kind_uidx on public.differential_records (owner_id, slug, kind);
create index if not exists document_chunks_document_id_idx on public.document_chunks (document_id);
create index if not exists document_chunks_meta_rag_indexing_version_idx on public.document_chunks ((metadata ->> 'rag_indexing_version'));
create index if not exists document_embedding_fields_document_generation_idx on public.document_embedding_fields (document_id, index_generation_id) where index_generation_id is not null;
create index if not exists document_embedding_fields_document_id_idx on public.document_embedding_fields (document_id);
create index if not exists document_images_created_at_idx on public.document_images (created_at);
create index if not exists document_images_document_generation_idx on public.document_images (document_id, index_generation_id) where index_generation_id is not null;
create index if not exists document_images_document_id_idx on public.document_images (document_id);
create index if not exists document_images_duplicate_group_idx on public.document_images (document_id, visual_duplicate_group);
create index if not exists document_images_priority_idx on public.document_images (document_id, clinical_priority_score desc, page_number);
create index if not exists document_images_searchable_idx1 on public.document_images (searchable);
create index if not exists document_index_quality_document_id_idx on public.document_index_quality (document_id);
create index if not exists document_index_quality_owner_id_idx on public.document_index_quality (owner_id);
create index if not exists document_index_units_document_generation_idx on public.document_index_units (document_id, index_generation_id) where index_generation_id is not null;
create index if not exists document_index_units_document_id_idx on public.document_index_units (document_id);
create index if not exists document_index_units_owner_document_created_idx on public.document_index_units (owner_id, document_id, created_at desc);
create index if not exists document_index_units_owner_id_idx on public.document_index_units (owner_id);
create index if not exists document_index_units_source_chunk_id_idx on public.document_index_units (source_chunk_id);
create index if not exists document_index_units_source_image_id_idx on public.document_index_units (source_image_id);
create index if not exists document_labels_owner_id_idx on public.document_labels (owner_id);
create index if not exists document_memory_cards_document_generation_idx on public.document_memory_cards (document_id, index_generation_id) where index_generation_id is not null;
create index if not exists document_memory_cards_document_id_idx on public.document_memory_cards (document_id);
create index if not exists document_memory_cards_owner_document_created_idx on public.document_memory_cards (owner_id, document_id, created_at desc);
create index if not exists document_sections_document_generation_idx on public.document_sections (document_id, index_generation_id) where index_generation_id is not null;
create index if not exists document_sections_document_id_idx on public.document_sections (document_id);
create index if not exists document_summaries_owner_id_idx on public.document_summaries (owner_id);
create index if not exists document_table_facts_document_generation_idx on public.document_table_facts (document_id, index_generation_id) where index_generation_id is not null;
create index if not exists document_table_facts_title_row_param_trgm_idx on public.document_table_facts using gin (lower(coalesce(table_title, '') || ' ' || coalesce(row_label, '') || ' ' || coalesce(clinical_parameter, '')) extensions.gin_trgm_ops);
create index if not exists documents_indexed_updated_at_idx on public.documents (updated_at, id) where status = 'indexed';
create index if not exists documents_owner_updated_at_indexed_idx on public.documents (owner_id, updated_at desc) where status = 'indexed';
create index if not exists image_caption_cache_owner_id_idx on public.image_caption_cache (owner_id);
create index if not exists import_batches_owner_id_idx on public.import_batches (owner_id);
create index if not exists ingestion_job_stages_job_idx on public.ingestion_job_stages (job_id, started_at desc);
create index if not exists ingestion_jobs_status_idx on public.ingestion_jobs (status);
create index if not exists ingestion_jobs_updated_at_idx on public.ingestion_jobs (updated_at);
create index if not exists rag_queries_owner_id_idx on public.rag_queries (owner_id);
create index if not exists rag_query_misses_expected_chunk_id_idx on public.rag_query_misses (expected_chunk_id);
create index if not exists rag_query_misses_expected_document_id_idx on public.rag_query_misses (expected_document_id);
create index if not exists rag_query_misses_owner_id_idx on public.rag_query_misses (owner_id);
create index if not exists rag_response_cache_owner_id_idx on public.rag_response_cache (owner_id);
create index if not exists rag_retrieval_logs_owner_id_idx on public.rag_retrieval_logs (owner_id);

-- Codified live-ahead governance and retrieval functions (2026-07-13).
CREATE OR REPLACE FUNCTION public.get_related_document_metadata(document_ids uuid[], owner_filter uuid DEFAULT NULL::uuid)
 RETURNS TABLE(document_id uuid, labels jsonb, summary text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
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
    and public.retrieval_owner_matches(owner_filter, d.owner_id);
$function$;

CREATE OR REPLACE FUNCTION public.get_visual_evidence_cards(p_document_id uuid, p_limit integer DEFAULT 40)
 RETURNS TABLE(unit_id uuid, unit_type text, unit_title text, unit_content text, source_image_id uuid, image_storage_path text, image_caption text, page_number integer, image_type text, unit_quality_score real, unit_metadata jsonb)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  select
    u.id as unit_id,
    u.unit_type,
    u.title as unit_title,
    u.content as unit_content,
    u.source_image_id,
    i.storage_path as image_storage_path,
    i.caption as image_caption,
    coalesce(u.page_start, i.page_number) as page_number,
    i.image_type,
    u.quality_score as unit_quality_score,
    u.metadata as unit_metadata
  from public.document_index_units u
  left join public.document_images i on i.id = u.source_image_id
  where u.document_id = p_document_id
    and u.source_image_id is not null
    and u.unit_type in (
      'visual_summary',
      'flowchart_step',
      'diagram_decision',
      'risk_matrix_cell',
      'medication_chart_row',
      'table_threshold',
      'chart_finding',
      'visual_askable_question',
      'table_fact'
    )
  order by u.quality_score desc nulls last, page_number asc nulls last
  limit greatest(1, least(coalesce(p_limit, 40), 200));
$function$;

CREATE OR REPLACE FUNCTION public.match_document_chunks(query_embedding vector, match_count integer DEFAULT 8, min_similarity double precision DEFAULT 0.15, document_filter uuid DEFAULT NULL::uuid, owner_filter uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, document_id uuid, title text, file_name text, page_number integer, chunk_index integer, section_heading text, content text, retrieval_synopsis text, image_ids uuid[], source_metadata jsonb, document_labels jsonb, document_summary text, similarity double precision, images jsonb)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
  PERFORM set_config('hnsw.ef_search', '100', true);
  RETURN QUERY
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
    and public.retrieval_owner_matches(owner_filter, d.owner_id)
    and d.status = 'indexed'
    and public.is_committed_document_generation(c.index_generation_id, d.index_generation_id)
    and 1 - (c.embedding <=> query_embedding) >= min_similarity
  order by c.embedding <=> query_embedding
  limit match_count;
END
$function$;

CREATE OR REPLACE FUNCTION public.match_document_chunks_hybrid(query_embedding vector, query_text text, match_count integer DEFAULT 12, min_similarity double precision DEFAULT 0.12, document_filters uuid[] DEFAULT NULL::uuid[], owner_filter uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, document_id uuid, title text, file_name text, page_number integer, chunk_index integer, section_heading text, content text, retrieval_synopsis text, image_ids uuid[], source_metadata jsonb, similarity double precision, text_rank double precision, hybrid_score double precision, rrf_score double precision, images jsonb)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  with query as (select websearch_to_tsquery('english', coalesce(query_text, '')) as tsq),
  vector_ranked as (
    select c.id, c.document_id, c.page_number, c.chunk_index, c.section_heading, c.content, c.retrieval_synopsis, c.image_ids,
      1 - (c.embedding <=> query_embedding) as similarity,
      (ts_rank_cd(c.search_tsv, query.tsq) + (ts_rank_cd(d.title_search_tsv, query.tsq) * 3.0))::double precision as text_rank,
      row_number() over (order by c.embedding <=> query_embedding) as vector_rank, null::bigint as text_match_rank,
      coalesce((d.metadata->'rag_indexing_version') is not null, false) as has_deep_index, d.updated_at as doc_updated_at,
      coalesce(q.quality_score, 0.7)::double precision as quality_score
    from public.document_chunks c join public.documents d on d.id = c.document_id
    left join public.document_index_quality q on q.document_id = c.document_id cross join query
    where (document_filters is null or c.document_id = any(document_filters)) and public.retrieval_owner_matches(owner_filter, d.owner_id)
      and d.status = 'indexed' and public.is_committed_document_generation(c.index_generation_id, d.index_generation_id)
      and 1 - (c.embedding <=> query_embedding) >= min_similarity
    order by c.embedding <=> query_embedding limit greatest(match_count * 6, 48)
  ),
  text_ranked as (
    select c.id, c.document_id, c.page_number, c.chunk_index, c.section_heading, c.content, c.retrieval_synopsis, c.image_ids,
      1 - (c.embedding <=> query_embedding) as similarity,
      (ts_rank_cd(c.search_tsv, query.tsq) + (ts_rank_cd(d.title_search_tsv, query.tsq) * 3.0))::double precision as text_rank,
      null::bigint as vector_rank,
      row_number() over (order by (ts_rank_cd(c.search_tsv, query.tsq) + (ts_rank_cd(d.title_search_tsv, query.tsq) * 3.0)) desc, c.embedding <=> query_embedding) as text_match_rank,
      coalesce((d.metadata->'rag_indexing_version') is not null, false) as has_deep_index, d.updated_at as doc_updated_at,
      coalesce(q.quality_score, 0.7)::double precision as quality_score
    from public.document_chunks c join public.documents d on d.id = c.document_id
    left join public.document_index_quality q on q.document_id = c.document_id cross join query
    where (document_filters is null or c.document_id = any(document_filters)) and public.retrieval_owner_matches(owner_filter, d.owner_id)
      and d.status = 'indexed' and public.is_committed_document_generation(c.index_generation_id, d.index_generation_id)
      and c.search_tsv @@ query.tsq
    order by (ts_rank_cd(c.search_tsv, query.tsq) + (ts_rank_cd(d.title_search_tsv, query.tsq) * 3.0)) desc limit greatest(match_count * 6, 48)
  ),
  combined as (select * from vector_ranked union all select * from text_ranked),
  scored as (
    select id, document_id, page_number, chunk_index, section_heading, content, retrieval_synopsis, image_ids,
      max(similarity)::double precision as similarity, max(text_rank)::double precision as text_rank,
      min(vector_rank) as vector_rank, min(text_match_rank) as text_match_rank,
      max(quality_score)::double precision as quality_score, bool_or(has_deep_index) as has_deep_index, max(doc_updated_at) as doc_updated_at
    from combined group by id, document_id, page_number, chunk_index, section_heading, content, retrieval_synopsis, image_ids
  ),
  scored_metrics as (
    select scored.*,
      ((scored.similarity * 0.62) + (least(scored.text_rank, 1) * 0.22) + (scored.quality_score * 0.10) + (case when scored.doc_updated_at > now() - interval '90 days' then 0.06 else 0 end))::double precision as hybrid_score,
      (coalesce(1.0 / (60 + scored.vector_rank), 0) + coalesce(1.0 / (60 + scored.text_match_rank), 0))::double precision as rrf_score
    from scored
  ),
  hybrid_candidates as (select id from scored_metrics order by hybrid_score desc, similarity desc, text_rank desc limit match_count),
  vector_candidates as (select id from scored_metrics order by similarity desc, hybrid_score desc limit match_count),
  text_candidates as (select id from scored_metrics order by text_rank desc, hybrid_score desc limit match_count),
  rrf_candidates as (select id from scored_metrics order by rrf_score desc, hybrid_score desc limit match_count),
  candidate_ids as (select id from hybrid_candidates union select id from vector_candidates union select id from text_candidates union select id from rrf_candidates)
  select c.id, c.document_id, d.title, d.file_name, c.page_number, c.chunk_index, c.section_heading, c.content, c.retrieval_synopsis, c.image_ids,
    d.metadata as source_metadata, c.similarity, c.text_rank, c.hybrid_score, c.rrf_score, public.chunk_image_metadata(c.image_ids) as images
  from scored_metrics c join candidate_ids candidates on candidates.id = c.id join public.documents d on d.id = c.document_id
  order by c.hybrid_score desc, c.rrf_score desc, c.similarity desc, c.text_rank desc limit match_count;
$function$;


CREATE OR REPLACE FUNCTION public.match_document_embedding_fields_text(query_text text, match_count integer DEFAULT 16, min_text_rank double precision DEFAULT 0.0, document_filters uuid[] DEFAULT NULL::uuid[], owner_filter uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, document_id uuid, source_chunk_id uuid, field_type text, content text, text_rank double precision)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  with q as (select websearch_to_tsquery('english', coalesce(query_text, '')) as tsq),
  ranked as (
    select f.id, f.document_id, f.source_chunk_id, f.field_type, f.content,
      ts_rank_cd(f.search_tsv, q.tsq)::double precision as text_rank
    from public.document_embedding_fields f
    join public.documents d on d.id = f.document_id
    cross join q
    where f.source_chunk_id is not null
      and (document_filters is null or f.document_id = any(document_filters))
      and (owner_filter is null or d.owner_id = owner_filter)
      and d.status = 'indexed' and f.search_tsv @@ q.tsq
  )
  select * from ranked where text_rank >= min_text_rank
  order by text_rank desc, id limit match_count;
$function$;

drop function if exists public.match_document_table_facts_text(text, integer, uuid[], uuid);

CREATE OR REPLACE FUNCTION public.match_document_table_facts_text(query_text text, match_count integer DEFAULT 16, document_filters uuid[] DEFAULT NULL::uuid[], owner_filter uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, document_id uuid, source_chunk_id uuid, source_image_id uuid, page_number integer, table_title text, row_label text, clinical_parameter text, threshold_value text, action text, text_rank double precision, match_reason text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
 SET plan_cache_mode TO 'force_custom_plan'
AS $function$
  with query as (
    select
      websearch_to_tsquery('english', coalesce(query_text, '')) as tsq,
      lower(trim(regexp_replace(coalesce(query_text, ''), '\\s+', ' ', 'g'))) as normalized,
      string_to_array(lower(trim(regexp_replace(coalesce(query_text, ''), '\\s+', ' ', 'g'))), ' ')::text[] as tokens
  ),
  doc_scope as (
    select d.id, d.metadata
    from public.documents d
    where d.status = 'indexed'
      and public.retrieval_owner_matches(owner_filter, d.owner_id)
      and (document_filters is null or d.id = any(document_filters))
  ),
  fts_matches as (
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
      ts_rank_cd(f.search_tsv, q.tsq)::double precision as text_rank,
      case
        when coalesce(f.threshold_value, '') <> '' then 'table_threshold'
        when coalesce(f.action, '') <> '' then 'table_action'
        else 'table_row'
      end as match_reason
    from query q
    join public.document_table_facts f on f.search_tsv @@ q.tsq
    join doc_scope ds on ds.id = f.document_id
    where public.is_committed_artifact_generation(f.metadata, ds.metadata)
    order by ts_rank_cd(f.search_tsv, q.tsq) desc
    limit greatest(match_count * 5, 64)
  ),
  term_matches as (
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
      0.45::double precision as text_rank,
      'term_overlap'::text as match_reason
    from query q
    join public.document_table_facts f
      on cardinality(q.tokens) > 0
     and f.normalized_terms && q.tokens
    join doc_scope ds on ds.id = f.document_id
    where public.is_committed_artifact_generation(f.metadata, ds.metadata)
    limit greatest(match_count * 4, 48)
  ),
  trgm_matches as (
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
      (similarity(lower(coalesce(f.table_title, '') || ' ' || coalesce(f.row_label, '') || ' ' || coalesce(f.clinical_parameter, '')), q.normalized) * 0.8)::double precision as text_rank,
      'trgm_similarity'::text as match_reason
    from query q
    join public.document_table_facts f
      on lower(coalesce(f.table_title, '') || ' ' || coalesce(f.row_label, '') || ' ' || coalesce(f.clinical_parameter, '')) % q.normalized
    join doc_scope ds on ds.id = f.document_id
    where public.is_committed_artifact_generation(f.metadata, ds.metadata)
      and similarity(lower(coalesce(f.table_title, '') || ' ' || coalesce(f.row_label, '') || ' ' || coalesce(f.clinical_parameter, '')), q.normalized) >= 0.18
    order by similarity(lower(coalesce(f.table_title, '') || ' ' || coalesce(f.row_label, '') || ' ' || coalesce(f.clinical_parameter, '')), q.normalized) desc
    limit greatest(match_count * 4, 48)
  ),
  combined as (
    select * from fts_matches
    union all
    select * from term_matches
    union all
    select * from trgm_matches
  ),
  deduped as (
    select distinct on (c.id)
      c.id,
      c.document_id,
      c.source_chunk_id,
      c.source_image_id,
      c.page_number,
      c.table_title,
      c.row_label,
      c.clinical_parameter,
      c.threshold_value,
      c.action,
      c.text_rank,
      c.match_reason
    from combined c
    order by c.id, c.text_rank desc
  )
  select
    d.id,
    d.document_id,
    d.source_chunk_id,
    d.source_image_id,
    d.page_number,
    d.table_title,
    d.row_label,
    d.clinical_parameter,
    d.threshold_value,
    d.action,
    d.text_rank,
    d.match_reason
  from deduped d
  where d.text_rank > 0
  order by d.text_rank desc, d.page_number asc nulls last
  limit match_count;
$function$;

CREATE OR REPLACE FUNCTION public.match_documents_for_query(query_text text, match_count integer DEFAULT 12, owner_filter uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, owner_id uuid, title text, file_name text, status text, page_count integer, chunk_count integer, image_count integer, metadata jsonb, text_rank double precision, match_reason text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
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
    where public.retrieval_owner_matches(owner_filter, d.owner_id)
      and d.status = 'indexed'
      and (d.title_search_tsv @@ query.tsq or d.search_tsv @@ query.tsq)
  )
  select *
  from ranked
  where text_rank > 0
  order by text_rank desc, page_count desc, title asc
  limit match_count;
$function$;

CREATE OR REPLACE FUNCTION public.repair_enrichment_quality_batch(p_limit integer DEFAULT 25)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 100));
  v_result jsonb;
begin
  with candidate_docs as (
    select d.id as document_id, d.owner_id, d.title
    from public.documents d
    left join public.document_index_quality q on q.document_id = d.id
    where d.status = 'indexed'
      and (
        q.document_id is null
        or q.extraction_quality in ('partial','poor','unknown')
        or not exists (select 1 from public.document_embedding_fields e where e.document_id = d.id and e.field_type = 'document_title')
      )
    order by d.updated_at asc nulls first
    limit v_limit
  ),
  doc_avg_embedding as (
    select c.document_id,
           avg(ch.embedding) as avg_embedding,
           (array_agg(ch.id order by ch.chunk_index asc))[1] as sample_chunk_id
    from candidate_docs c
    join public.document_chunks ch on ch.document_id = c.document_id
    where ch.embedding is not null
    group by c.document_id
  ),
  ensured_summary as (
    insert into public.document_summaries (id, document_id, owner_id, summary, clinical_specifics, source_chunk_ids, source_image_ids, model, metadata)
    select gen_random_uuid(), c.document_id, c.owner_id,
           left(coalesce((select string_agg(left(ch.content, 300), E'\n\n' order by ch.chunk_index) from (select * from public.document_chunks ch where ch.document_id = c.document_id order by ch.chunk_index limit 3) ch), c.title, 'Document summary unavailable'), 3000),
           '{}'::jsonb,
           coalesce((select array_agg(ch.id order by ch.chunk_index) from (select * from public.document_chunks ch where ch.document_id = c.document_id order by ch.chunk_index limit 5) ch), '{}'::uuid[]),
           '{}'::uuid[],
           'deterministic-repair-v1',
           jsonb_build_object('repair_source','db_repair','anchored',true)
    from candidate_docs c
    where not exists (select 1 from public.document_summaries s where s.document_id = c.document_id)
    returning document_id
  ),
  ensured_sections as (
    insert into public.document_sections (id, document_id, owner_id, section_index, heading, heading_path, page_start, page_end, chunk_ids, summary, tags, extraction_quality, metadata)
    select gen_random_uuid(), c.document_id, c.owner_id, 1,
           coalesce(nullif(trim((select ch.section_heading from public.document_chunks ch where ch.document_id = c.document_id order by ch.chunk_index asc limit 1)), ''), 'Main Section'),
           coalesce((select ch.section_path from public.document_chunks ch where ch.document_id = c.document_id order by ch.chunk_index asc limit 1), array['Main Section']::text[]),
           coalesce((select min(ch.page_number) from public.document_chunks ch where ch.document_id = c.document_id), 1),
           coalesce((select max(ch.page_number) from public.document_chunks ch where ch.document_id = c.document_id), 1),
           coalesce((select array_agg(ch.id order by ch.chunk_index) from public.document_chunks ch where ch.document_id = c.document_id), '{}'::uuid[]),
           left(coalesce((select summary from public.document_summaries s where s.document_id = c.document_id limit 1), c.title, 'Section summary unavailable'), 3000),
           array['repair_generated']::text[], 'partial', jsonb_build_object('repair_source','db_repair','anchored',true)
    from candidate_docs c
    where not exists (select 1 from public.document_sections s where s.document_id = c.document_id)
    returning document_id
  ),
  ensured_memory_cards as (
    insert into public.document_memory_cards (id, document_id, owner_id, section_id, card_type, title, content, normalized_terms, page_number, source_chunk_ids, source_image_ids, confidence, metadata, embedding)
    select gen_random_uuid(), s.document_id, s.owner_id, s.id, 'section_summary',
           left(coalesce(nullif(trim(s.heading),''), 'Section Memory'), 200), left(s.summary, 4000),
           array_remove(regexp_split_to_array(lower(coalesce(s.heading,'')), '\\W+'), '')::text[],
           coalesce(s.page_start, 1), coalesce(s.chunk_ids, '{}'::uuid[]), '{}'::uuid[], 0.70,
           jsonb_build_object('repair_source','db_repair','anchored',true,'from','document_sections.summary'),
           coalesce((select ch.embedding from public.document_chunks ch where ch.id = any(s.chunk_ids) and ch.embedding is not null order by ch.chunk_index asc limit 1), dae.avg_embedding)
    from public.document_sections s
    join candidate_docs c on c.document_id = s.document_id
    left join doc_avg_embedding dae on dae.document_id = s.document_id
    where not exists (select 1 from public.document_memory_cards mc where mc.document_id = s.document_id)
      and length(trim(coalesce(s.summary,''))) > 0
      and coalesce((select ch.embedding from public.document_chunks ch where ch.id = any(s.chunk_ids) and ch.embedding is not null order by ch.chunk_index asc limit 1), dae.avg_embedding) is not null
    returning document_id
  ),
  ensured_title_embedding as (
    insert into public.document_embedding_fields (id, owner_id, document_id, source_chunk_id, field_type, content, embedding, metadata, content_hash)
    select gen_random_uuid(), c.owner_id, c.document_id, dae.sample_chunk_id, 'document_title',
           left(coalesce(nullif(trim(c.title),''), 'Untitled document'), 2000), dae.avg_embedding,
           jsonb_build_object('repair_source','db_repair','anchored',true,'derived_embedding','avg_chunk_embedding'),
           encode(digest(coalesce(c.title,'Untitled document'),'sha256'),'hex')
    from candidate_docs c
    join doc_avg_embedding dae on dae.document_id = c.document_id
    where not exists (select 1 from public.document_embedding_fields e where e.document_id = c.document_id and e.field_type = 'document_title')
    returning document_id
  ),
  ensured_summary_embedding as (
    insert into public.document_embedding_fields (id, owner_id, document_id, source_chunk_id, field_type, content, embedding, metadata, content_hash)
    select gen_random_uuid(), c.owner_id, c.document_id, dae.sample_chunk_id, 'document_summary',
           left(coalesce((select s.summary from public.document_summaries s where s.document_id = c.document_id limit 1), c.title, 'Document summary unavailable'), 4000),
           dae.avg_embedding,
           jsonb_build_object('repair_source','db_repair','anchored',true,'derived_embedding','avg_chunk_embedding'),
           encode(digest(coalesce((select s.summary from public.document_summaries s where s.document_id = c.document_id limit 1), c.title, 'Document summary unavailable'),'sha256'),'hex')
    from candidate_docs c
    join doc_avg_embedding dae on dae.document_id = c.document_id
    where not exists (select 1 from public.document_embedding_fields e where e.document_id = c.document_id and e.field_type = 'document_summary')
    returning document_id
  ),
  ensured_index_units_section as (
    insert into public.document_index_units (id, owner_id, document_id, unit_type, source_chunk_id, source_image_id, page_start, page_end, heading_path, title, content, normalized_terms, source_span, quality_score, extraction_mode, embedding, metadata)
    select gen_random_uuid(), c.owner_id, s.document_id, 'section_summary',
           (select ch.id from public.document_chunks ch where ch.id = any(s.chunk_ids) order by ch.chunk_index asc limit 1),
           null, s.page_start, s.page_end, coalesce(s.heading_path, array[s.heading]::text[]),
           left(coalesce(nullif(trim(s.heading),''), 'Section summary'), 200), left(s.summary, 4000),
           array_remove(regexp_split_to_array(lower(coalesce(s.heading,'')), '\\W+'), '')::text[],
           jsonb_build_object('anchor','section','section_id',s.id,'chunk_ids',s.chunk_ids),
           0.72, 'deterministic',
           coalesce((select ch.embedding from public.document_chunks ch where ch.id = any(s.chunk_ids) and ch.embedding is not null order by ch.chunk_index asc limit 1), dae.avg_embedding),
           jsonb_build_object('repair_source','db_repair','anchored',true,'unit_origin','section_summary')
    from public.document_sections s
    join candidate_docs c on c.document_id = s.document_id
    left join doc_avg_embedding dae on dae.document_id = s.document_id
    where length(trim(coalesce(s.summary,''))) > 0
      and coalesce((select ch.embedding from public.document_chunks ch where ch.id = any(s.chunk_ids) and ch.embedding is not null order by ch.chunk_index asc limit 1), dae.avg_embedding) is not null
      and not exists (select 1 from public.document_index_units u where u.document_id = s.document_id and u.unit_type = 'section_summary')
    returning document_id
  ),
  ensured_index_units_table as (
    insert into public.document_index_units (id, owner_id, document_id, unit_type, source_chunk_id, source_image_id, page_start, page_end, heading_path, title, content, normalized_terms, source_span, quality_score, extraction_mode, embedding, metadata)
    select gen_random_uuid(), tf.owner_id, tf.document_id, 'table_fact', tf.source_chunk_id, tf.source_image_id,
           tf.page_number, tf.page_number, array[coalesce(tf.table_title,'Table')]::text[],
           left(coalesce(tf.table_title, 'Table fact'), 200),
           left(concat_ws(' | ', nullif(tf.row_label,''), nullif(tf.clinical_parameter,''), nullif(tf.threshold_value,''), nullif(tf.action,'')), 4000),
           coalesce(tf.normalized_terms, '{}'::text[]),
           jsonb_build_object('anchor','table_fact','table_fact_id',tf.id,'page',tf.page_number,'source_image_id',tf.source_image_id),
           0.78, 'hybrid',
           coalesce((select ch.embedding from public.document_chunks ch where ch.id = tf.source_chunk_id and ch.embedding is not null), dae.avg_embedding),
           jsonb_build_object('repair_source','db_repair','anchored',true,'unit_origin','table_fact')
    from public.document_table_facts tf
    join candidate_docs c on c.document_id = tf.document_id
    left join doc_avg_embedding dae on dae.document_id = tf.document_id
    where length(trim(concat_ws(' ', nullif(tf.row_label,''), nullif(tf.clinical_parameter,''), nullif(tf.threshold_value,''), nullif(tf.action,'')))) > 0
      and coalesce((select ch.embedding from public.document_chunks ch where ch.id = tf.source_chunk_id and ch.embedding is not null), dae.avg_embedding) is not null
      and not exists (
        select 1 from public.document_index_units u
        where u.document_id = tf.document_id and u.unit_type = 'table_fact' and u.source_span ->> 'table_fact_id' = tf.id::text
      )
    returning document_id
  ),
  ensured_index_units_questions as (
    insert into public.document_index_units (id, owner_id, document_id, unit_type, source_chunk_id, source_image_id, page_start, page_end, heading_path, title, content, normalized_terms, source_span, quality_score, extraction_mode, embedding, metadata)
    select gen_random_uuid(), c.owner_id, ch.document_id, 'askable_question', ch.id, null, ch.page_number, ch.page_number,
           coalesce(ch.section_path, array[coalesce(ch.section_heading,'Section')]::text[]), 'Askable question',
           left(regexp_replace(ch.content, E'\\s+', ' ', 'g'), 4000),
           array_remove(regexp_split_to_array(lower(coalesce(ch.section_heading,'')), '\\W+'), '')::text[],
           jsonb_build_object('anchor','chunk','chunk_id',ch.id,'page',ch.page_number), 0.66, 'deterministic', ch.embedding,
           jsonb_build_object('repair_source','db_repair','anchored',true,'unit_origin','question_like_chunk')
    from candidate_docs c
    join lateral (
      select ch.* from public.document_chunks ch
      where ch.document_id = c.document_id and ch.embedding is not null and ch.content ~* '\\?'
      order by ch.chunk_index asc limit 2
    ) ch on true
    where not exists (select 1 from public.document_index_units u where u.document_id = ch.document_id and u.unit_type = 'askable_question' and u.source_chunk_id = ch.id)
    returning document_id
  ),
  gate as (
    select c.document_id,
           exists (select 1 from public.document_memory_cards mc where mc.document_id = c.document_id) as has_memory,
           exists (select 1 from public.document_sections s where s.document_id = c.document_id) as has_sections,
           exists (select 1 from public.document_embedding_fields e where e.document_id = c.document_id and e.field_type = 'document_title') as has_title_emb,
           exists (select 1 from public.document_embedding_fields e where e.document_id = c.document_id and e.field_type = 'document_summary') as has_summary_emb,
           exists (select 1 from public.document_index_units u where u.document_id = c.document_id and u.unit_type in ('section_summary','clinical_fact','threshold','workflow_step','medication_monitoring','askable_question','table_fact','alias','vocabulary_term')) as has_canonical_units
    from candidate_docs c
  ),
  upsert_quality as (
    insert into public.document_index_quality (document_id, owner_id, quality_score, extraction_quality, metrics, issues, updated_at, retrievable_visual_hit, typed_unit_coverage, anchor_coverage, source_span_coverage, model_fallback_rate, noisy_unit_rate)
    select g.document_id, d.owner_id,
           case when g.has_memory and g.has_sections and g.has_title_emb and g.has_summary_emb and g.has_canonical_units then 0.84 else 0.68 end,
           case when g.has_memory and g.has_sections and g.has_title_emb and g.has_summary_emb and g.has_canonical_units then 'good' else 'partial' end,
           jsonb_build_object('memory_cards', g.has_memory, 'sections', g.has_sections, 'title_embedding', g.has_title_emb, 'summary_embedding', g.has_summary_emb, 'canonical_units', g.has_canonical_units, 'quality_gate','db_repair_v1'),
           array_remove(array[
             case when not g.has_memory then 'no memory cards' end,
             case when not g.has_sections then 'no structured sections' end,
             case when not g.has_title_emb then 'missing document title embedding' end,
             case when not g.has_summary_emb then 'missing document summary embedding' end,
             case when not g.has_canonical_units then 'missing canonical index units' end
           ]::text[], null),
           now(), false,
           case when g.has_canonical_units then 1.0 else 0.0 end,
           case when g.has_sections then 1.0 else 0.0 end,
           case when g.has_canonical_units then 1.0 else 0.0 end,
           0.0, 0.0
    from gate g join public.documents d on d.id = g.document_id
    on conflict (document_id) do update set
      quality_score = excluded.quality_score,
      extraction_quality = excluded.extraction_quality,
      metrics = excluded.metrics,
      issues = excluded.issues,
      updated_at = excluded.updated_at,
      retrievable_visual_hit = excluded.retrievable_visual_hit,
      typed_unit_coverage = excluded.typed_unit_coverage,
      anchor_coverage = excluded.anchor_coverage,
      source_span_coverage = excluded.source_span_coverage,
      model_fallback_rate = excluded.model_fallback_rate,
      noisy_unit_rate = excluded.noisy_unit_rate
    returning document_id, extraction_quality
  ),
  defer_jobs as (
    update public.ingestion_jobs j
    set status = case when q.extraction_quality = 'good' then j.status else 'pending' end,
        stage = case when q.extraction_quality = 'good' then 'indexed + enrichment backfill v3' else 'indexed; enrichment deferred' end,
        error_message = case when q.extraction_quality = 'good' then null else 'quality gate: missing required enrichment artifacts' end,
        updated_at = now(),
        next_run_at = case when q.extraction_quality = 'good' then j.next_run_at else now() + interval '10 minutes' end
    from (select uq.document_id, uq.extraction_quality from upsert_quality uq) q
    where j.id = (select j2.id from public.ingestion_jobs j2 where j2.document_id = q.document_id order by j2.created_at desc limit 1)
    returning j.document_id
  )
  select jsonb_build_object(
    'processed_docs', (select count(*) from candidate_docs),
    'summaries_inserted', (select count(*) from ensured_summary),
    'sections_inserted', (select count(*) from ensured_sections),
    'memory_cards_inserted', (select count(*) from ensured_memory_cards),
    'title_embeddings_inserted', (select count(*) from ensured_title_embedding),
    'summary_embeddings_inserted', (select count(*) from ensured_summary_embedding),
    'section_units_inserted', (select count(*) from ensured_index_units_section),
    'table_units_inserted', (select count(*) from ensured_index_units_table),
    'question_units_inserted', (select count(*) from ensured_index_units_questions),
    'quality_rows_upserted', (select count(*) from upsert_quality),
    'jobs_gated', (select count(*) from defer_jobs),
    'good_after_gate', (select count(*) from upsert_quality where extraction_quality = 'good'),
    'partial_after_gate', (select count(*) from upsert_quality where extraction_quality <> 'good')
  ) into v_result;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.repair_strict_enrichment_gate_batch(p_limit integer DEFAULT 50)
 RETURNS TABLE(document_id uuid, missing text[], repaired text[], status text, counts jsonb, presence jsonb)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.run_all_visual_eval_cases(p_limit integer DEFAULT 10)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_total integer := 0;
  v_passed integer := 0;
  v_failed integer := 0;
  v_case record;
  v_result jsonb;
begin
  for v_case in
    select id
    from public.rag_visual_eval_cases
    where active = true
    order by created_at asc
  loop
    v_total := v_total + 1;
    v_result := public.run_visual_eval_case(v_case.id, p_limit);
    if coalesce((v_result->>'passed')::boolean, false) then
      v_passed := v_passed + 1;
    else
      v_failed := v_failed + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'cases_run', v_total,
    'passed', v_passed,
    'failed', v_failed,
    'run_at', now()
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.run_visual_eval_case(p_case_id uuid, p_limit integer DEFAULT 8)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_case public.rag_visual_eval_cases%rowtype;
  v_hits integer := 0;
  v_top_hit boolean := false;
  v_passed boolean := false;
  v_payload jsonb := '[]'::jsonb;
begin
  select * into v_case
  from public.rag_visual_eval_cases
  where id = p_case_id
    and active = true;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'eval case not found or inactive');
  end if;

  with ranked as (
    select
      u.id,
      u.unit_type,
      u.title,
      u.content,
      u.source_image_id,
      i.image_type,
      ts_rank_cd(u.search_tsv, websearch_to_tsquery('english', v_case.query)) as rank_score
    from public.document_index_units u
    left join public.document_images i on i.id = u.source_image_id
    where u.document_id = v_case.document_id
      and (
        u.search_tsv @@ websearch_to_tsquery('english', v_case.query)
        or lower(coalesce(u.content,'')) like '%' || lower(v_case.query) || '%'
      )
    order by rank_score desc nulls last, u.quality_score desc nulls last
    limit greatest(1, least(coalesce(p_limit,8),50))
  )
  select
    count(*)::int,
    coalesce((
      select (r.unit_type = any(v_case.expected_unit_types))
      from ranked r
      order by r.rank_score desc nulls last
      limit 1
    ), false),
    coalesce(jsonb_agg(to_jsonb(ranked.*)), '[]'::jsonb)
  into v_hits, v_top_hit, v_payload
  from ranked
  where (
      cardinality(v_case.expected_unit_types) = 0
      or ranked.unit_type = any(v_case.expected_unit_types)
    )
    and (
      v_case.expected_image_type is null
      or ranked.image_type = v_case.expected_image_type
    )
    and (
      cardinality(v_case.expected_terms) = 0
      or exists (
        select 1
        from unnest(v_case.expected_terms) t
        where lower(ranked.content) like '%' || lower(t) || '%'
      )
    );

  v_passed := (v_hits > 0);

  insert into public.rag_visual_eval_runs (
    case_id,
    document_id,
    passed,
    top_hit,
    matched_count,
    hit_payload,
    run_metadata
  ) values (
    v_case.id,
    v_case.document_id,
    v_passed,
    v_top_hit,
    v_hits,
    v_payload,
    jsonb_build_object('query', v_case.query, 'limit', p_limit)
  );

  return jsonb_build_object(
    'ok', true,
    'case_id', v_case.id,
    'passed', v_passed,
    'top_hit', v_top_hit,
    'matched_count', v_hits,
    'hits', v_payload
  );
end;
$function$;

-- Preserve the production ACLs for live-only/captured RPCs. CREATE FUNCTION
-- grants PUBLIC execute by default on a fresh database unless explicitly revoked.
revoke execute on function public.get_visual_evidence_cards(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.get_visual_evidence_cards(uuid, integer) to service_role;

revoke execute on function public.match_document_table_facts_text(text, integer, uuid[], uuid)
  from public, anon, authenticated;
grant execute on function public.match_document_table_facts_text(text, integer, uuid[], uuid) to service_role;

revoke execute on function public.repair_enrichment_quality_batch(integer)
  from public, anon, authenticated;
grant execute on function public.repair_enrichment_quality_batch(integer) to service_role;

revoke execute on function public.run_all_visual_eval_cases(integer)
  from public, anon, authenticated;
grant execute on function public.run_all_visual_eval_cases(integer) to service_role;

revoke execute on function public.run_visual_eval_case(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.run_visual_eval_case(uuid, integer) to service_role;

-- Owner-plus-public retrieval wrappers. Kept in the canonical schema snapshot
-- so fresh environments and drift detection reproduce migration 20260713020000.
-- Additive owner-plus-public retrieval wrappers. They delegate to the current
-- stable signatures and do not replace live-ahead retrieval bodies.

create or replace function public.retrieval_owner_matches_v2(
  owner_filter uuid,
  row_owner_id uuid,
  include_public boolean default true
)
returns boolean language sql immutable
set search_path = public, extensions, pg_temp
as $$
  select owner_filter is not null and (
    row_owner_id = owner_filter
    or (coalesce(include_public, false) and row_owner_id is null)
    or (owner_filter = '00000000-0000-0000-0000-000000000000'::uuid and row_owner_id is null)
  );
$$;

create or replace function public.corpus_topic_term_stats_v2(
  terms text[],
  owner_filter uuid default '00000000-0000-0000-0000-000000000000'::uuid,
  include_public boolean default true
) returns table (
  term text, has_ts_signal boolean, title_doc_count integer, chunk_present boolean, total_doc_count integer
) language sql stable set search_path = public, extensions, pg_temp as $$
  with combined as (
    select * from public.corpus_topic_term_stats($1, $2)
    union all
    select * from public.corpus_topic_term_stats($1, '00000000-0000-0000-0000-000000000000'::uuid)
    where $3 and $2 <> '00000000-0000-0000-0000-000000000000'::uuid
  )
  select term, bool_or(has_ts_signal), sum(title_doc_count)::integer,
    bool_or(chunk_present), sum(total_doc_count)::integer
  from combined group by term order by term;
$$;

-- Single-pass scoped implementations for the production retrieval hotspots.
-- Access and generation predicates are applied before candidate ranking.
create or replace function public.match_document_chunks_text_scoped(
  query_text text,
  match_count integer,
  document_filters uuid[],
  owner_filter uuid,
  include_public boolean
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
  -- Keep the chunk/title probes separate so each GIN index remains usable.
  -- Apply access and committed-generation gates before candidate union/ranking.
  chunk_hits as (
    select c.id
    from public.document_chunks c
    join public.documents d on d.id = c.document_id
    cross join query
    where c.search_tsv @@ query.tsq
      and (document_filters is null or c.document_id = any(document_filters))
      and public.retrieval_owner_matches_v2(owner_filter, d.owner_id, include_public)
      and d.status = 'indexed'
      and public.is_committed_document_generation(c.index_generation_id, d.index_generation_id)
  ),
  title_chunk_hits as (
    select c.id
    from public.documents d
    cross join query
    join public.document_chunks c on c.document_id = d.id
    where d.title_search_tsv @@ query.tsq
      and (document_filters is null or c.document_id = any(document_filters))
      and public.retrieval_owner_matches_v2(owner_filter, d.owner_id, include_public)
      and d.status = 'indexed'
      and public.is_committed_document_generation(c.index_generation_id, d.index_generation_id)
  ),
  lexical_candidates as (
    select chunk_hits.id from chunk_hits
    union
    select title_chunk_hits.id from title_chunk_hits
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
    from lexical_candidates cand
    join public.document_chunks c on c.id = cand.id
    join public.documents d on d.id = c.document_id
    cross join query
    order by (
      ts_rank_cd(c.search_tsv, query.tsq) +
      (ts_rank_cd(d.title_search_tsv, query.tsq) * 3.0)
    ) desc
    limit least(greatest(match_count * 2, 24), 96)
  ),
  doc_labels as (
    select
      l.document_id,
      coalesce(
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
      ) as labels
    from public.document_labels l
    where l.document_id in (select distinct ranked.document_id from ranked)
      and coalesce(l.metadata->>'review_status', 'new') <> 'hidden'
      and coalesce(l.metadata->>'hidden', 'false') <> 'true'
    group by l.document_id
  ),
  doc_summaries as (
    select distinct on (s.document_id)
      s.document_id,
      s.summary
    from public.document_summaries s
    where s.document_id in (select distinct ranked.document_id from ranked)
    order by s.document_id
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
    coalesce(doc_labels.labels, '[]'::jsonb) as document_labels,
    doc_summaries.summary as document_summary,
    0::double precision as similarity,
    ranked.text_rank,
    least(0.5, 0.18 + (least(ranked.text_rank, 1) * 0.3))::double precision as hybrid_score,
    least(0.99, 0.4 + (least(ranked.text_rank, 1) * 0.59))::double precision as lexical_score,
    public.chunk_image_metadata(ranked.image_ids) as images
  from ranked
  left join doc_labels on doc_labels.document_id = ranked.document_id
  left join doc_summaries on doc_summaries.document_id = ranked.document_id
  order by hybrid_score desc, text_rank desc, ranked.id
  limit match_count;
$$;

create or replace function public.match_document_index_units_hybrid_scoped(
  query_embedding extensions.vector(1536),
  query_text text,
  match_count integer,
  min_similarity double precision,
  document_filters uuid[],
  owner_filter uuid,
  include_public boolean
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
set plan_cache_mode = 'force_custom_plan'
as $$
  with query as (
    select websearch_to_tsquery('english', coalesce(query_text, '')) as tsq,
      regexp_split_to_array(lower(coalesce(query_text, '')), '\s+') as terms
  ),
  -- Split the OR into separately indexable GIN probes. Both branches enforce
  -- the full access/generation scope before their ids can enter the union.
  text_hits as (
    select u.id
    from public.document_index_units u
    join public.documents d on d.id = u.document_id
    cross join query
    where u.search_tsv @@ query.tsq
      and d.status = 'indexed'
      and (document_filters is null or u.document_id = any(document_filters))
      and public.retrieval_owner_matches_v2(owner_filter, d.owner_id, include_public)
      and public.is_committed_artifact_generation(u.metadata, d.metadata)
      and u.source_chunk_id is not null
  ),
  term_hits as (
    select u.id
    from public.document_index_units u
    join public.documents d on d.id = u.document_id
    cross join query
    where u.normalized_terms && query.terms
      and d.status = 'indexed'
      and (document_filters is null or u.document_id = any(document_filters))
      and public.retrieval_owner_matches_v2(owner_filter, d.owner_id, include_public)
      and public.is_committed_artifact_generation(u.metadata, d.metadata)
      and u.source_chunk_id is not null
  ),
  candidate_ids as (
    select text_hits.id from text_hits
    union
    select term_hits.id from term_hits
  ),
  ranked as (
    select
      u.id,
      u.document_id,
      u.source_chunk_id,
      u.source_image_id,
      u.unit_type,
      u.title,
      u.content,
      u.page_start,
      u.page_end,
      u.heading_path,
      u.normalized_terms,
      u.source_span,
      u.quality_score,
      u.extraction_mode,
      (1 - (u.embedding <=> query_embedding))::double precision as similarity,
      (
        ts_rank_cd(u.search_tsv, query.tsq)
        + case when u.normalized_terms && query.terms then 0.25 else 0 end
        + case
            when u.unit_type in (
              'askable_question', 'table_fact', 'clinical_fact', 'threshold',
              'workflow_step', 'medication_monitoring', 'alias', 'visual_summary',
              'flowchart_step', 'diagram_decision', 'risk_matrix_cell',
              'medication_chart_row', 'chart_finding', 'visual_askable_question',
              'table_threshold'
            ) then 0.06
            when u.unit_type = 'section_summary' then 0.03
            else 0
          end
      )::double precision as text_rank,
      u.metadata
    from candidate_ids candidates
    join public.document_index_units u on u.id = candidates.id
    cross join query
    order by text_rank desc
    limit greatest(match_count * 3, 48)
  )
  select
    id,
    document_id,
    source_chunk_id,
    source_image_id,
    unit_type,
    title,
    content,
    page_start,
    page_end,
    heading_path,
    normalized_terms,
    source_span,
    quality_score,
    extraction_mode,
    similarity,
    text_rank,
    (
      (similarity * 0.52)
      + (least(text_rank, 1) * 0.28)
      + (quality_score * 0.12)
      + (case when extraction_mode in ('model_heavy', 'hybrid') then 0.04 else 0 end)
      + (case
          when unit_type in ('askable_question', 'threshold', 'table_fact', 'table_threshold', 'visual_askable_question') then 0.04
          when unit_type in ('workflow_step', 'medication_monitoring', 'flowchart_step', 'diagram_decision', 'medication_chart_row', 'risk_matrix_cell') then 0.03
          else 0
        end)
    )::double precision as hybrid_score,
    metadata
  from ranked
  order by hybrid_score desc, id
  limit match_count;
$$;

create or replace function public.match_document_chunks_text_v2(
  query_text text,
  match_count integer default 12,
  document_filters uuid[] default null,
  owner_filter uuid default '00000000-0000-0000-0000-000000000000'::uuid,
  include_public boolean default true
)
returns table (
  id uuid, document_id uuid, title text, file_name text, page_number integer,
  chunk_index integer, section_heading text, content text, retrieval_synopsis text,
  image_ids uuid[], source_metadata jsonb, document_labels jsonb, document_summary text,
  similarity double precision, text_rank double precision, hybrid_score double precision,
  lexical_score double precision, images jsonb
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select *
  from public.match_document_chunks_text_scoped(
    $1,
    least(greatest(coalesce($2, 12), 1), 96),
    $3,
    $4,
    $5
  );
$$;

create or replace function public.match_document_chunks_hybrid_v2(
  query_embedding extensions.vector(1536), query_text text, match_count integer default 12,
  min_similarity double precision default 0.12, document_filters uuid[] default null,
  owner_filter uuid default '00000000-0000-0000-0000-000000000000'::uuid,
  include_public boolean default true
) returns table (
  id uuid, document_id uuid, title text, file_name text, page_number integer,
  chunk_index integer, section_heading text, content text, retrieval_synopsis text,
  image_ids uuid[], source_metadata jsonb, similarity double precision,
  text_rank double precision, hybrid_score double precision, rrf_score double precision, images jsonb
) language sql stable set search_path = public, extensions, pg_temp as $$
  with combined as (
    select * from public.match_document_chunks_hybrid($1, $2, $3, $4, $5, $6)
    union all
    select * from public.match_document_chunks_hybrid($1, $2, $3, $4, $5, '00000000-0000-0000-0000-000000000000'::uuid)
    where $7 and $6 <> '00000000-0000-0000-0000-000000000000'::uuid
  ), deduped as (
    select *, row_number() over (partition by id order by hybrid_score desc, rrf_score desc) as access_rank
    from combined
  )
  select id, document_id, title, file_name, page_number, chunk_index, section_heading, content,
    retrieval_synopsis, image_ids, source_metadata, similarity, text_rank, hybrid_score, rrf_score, images
  from deduped where access_rank = 1
  order by hybrid_score desc, rrf_score desc, id
  limit greatest(1, least($3, 100));
$$;

create or replace function public.match_document_chunks_v2(
  query_embedding extensions.vector(1536), match_count integer default 8,
  min_similarity double precision default 0.15, document_filter uuid default null,
  owner_filter uuid default '00000000-0000-0000-0000-000000000000'::uuid,
  include_public boolean default true
) returns table (
  id uuid, document_id uuid, title text, file_name text, page_number integer,
  chunk_index integer, section_heading text, content text, retrieval_synopsis text,
  image_ids uuid[], source_metadata jsonb, document_labels jsonb, document_summary text,
  similarity double precision, images jsonb
) language sql stable set search_path = public, extensions, pg_temp as $$
  with combined as (
    select * from public.match_document_chunks($1, $2, $3, $4, $5)
    union all
    select * from public.match_document_chunks($1, $2, $3, $4, '00000000-0000-0000-0000-000000000000'::uuid)
    where $6 and $5 <> '00000000-0000-0000-0000-000000000000'::uuid
  ), deduped as (
    select *, row_number() over (partition by id order by similarity desc) as access_rank
    from combined
  )
  select id, document_id, title, file_name, page_number, chunk_index, section_heading, content,
    retrieval_synopsis, image_ids, source_metadata, document_labels, document_summary, similarity, images
  from deduped where access_rank = 1
  order by similarity desc, id
  limit greatest(1, least($2, 100));
$$;

create or replace function public.get_related_document_metadata_v2(
  document_ids uuid[],
  owner_filter uuid default '00000000-0000-0000-0000-000000000000'::uuid,
  include_public boolean default true
) returns table (document_id uuid, labels jsonb, summary text)
language sql stable set search_path = public, extensions, pg_temp as $$
  with combined as (
    select * from public.get_related_document_metadata($1, $2)
    union all
    select * from public.get_related_document_metadata($1, '00000000-0000-0000-0000-000000000000'::uuid)
    where $3 and $2 <> '00000000-0000-0000-0000-000000000000'::uuid
  ), deduped as (
    select *, row_number() over (partition by document_id order by document_id) as access_rank from combined
  )
  select document_id, labels, summary from deduped where access_rank = 1 order by document_id;
$$;

create or replace function public.match_document_lookup_chunks_text_v2(
  query_text text, document_filters uuid[], match_count integer default 24,
  owner_filter uuid default '00000000-0000-0000-0000-000000000000'::uuid,
  include_public boolean default true
) returns table (
  id uuid, document_id uuid, page_number integer, chunk_index integer, section_heading text,
  section_path text[], heading_level integer, parent_heading text, anchor_id text, content text,
  retrieval_synopsis text, image_ids uuid[], text_rank double precision
) language sql stable set search_path = public, extensions, pg_temp as $$
  with combined as (
    select * from public.match_document_lookup_chunks_text($1, $2, $3, $4)
    union all
    select * from public.match_document_lookup_chunks_text($1, $2, $3, '00000000-0000-0000-0000-000000000000'::uuid)
    where $5 and $4 <> '00000000-0000-0000-0000-000000000000'::uuid
  ), ranked as (select *, row_number() over (partition by id order by text_rank desc) access_rank from combined)
  select id, document_id, page_number, chunk_index, section_heading, section_path, heading_level,
    parent_heading, anchor_id, content, retrieval_synopsis, image_ids, text_rank
  from ranked where access_rank = 1 order by text_rank desc, id limit greatest(1, least($3, 100));
$$;

create or replace function public.match_documents_for_query_v2(
  query_text text, match_count integer default 12,
  owner_filter uuid default '00000000-0000-0000-0000-000000000000'::uuid,
  include_public boolean default true
) returns table (
  id uuid, owner_id uuid, title text, file_name text, status text, page_count integer,
  chunk_count integer, image_count integer, metadata jsonb, text_rank double precision, match_reason text
) language sql stable set search_path = public, extensions, pg_temp as $$
  with combined as (
    select * from public.match_documents_for_query($1, $2, $3)
    union all
    select * from public.match_documents_for_query($1, $2, '00000000-0000-0000-0000-000000000000'::uuid)
    where $4 and $3 <> '00000000-0000-0000-0000-000000000000'::uuid
  ), ranked as (select *, row_number() over (partition by id order by text_rank desc) access_rank from combined)
  select id, owner_id, title, file_name, status, page_count, chunk_count, image_count, metadata, text_rank, match_reason
  from ranked where access_rank = 1 order by text_rank desc, id limit greatest(1, least($2, 100));
$$;

create or replace function public.match_document_table_facts_text_v2(
  query_text text, match_count integer default 16, document_filters uuid[] default null,
  owner_filter uuid default '00000000-0000-0000-0000-000000000000'::uuid,
  include_public boolean default true
) returns table (
  id uuid, document_id uuid, source_chunk_id uuid, source_image_id uuid, page_number integer,
  table_title text, row_label text, clinical_parameter text, threshold_value text, action text,
  text_rank double precision, match_reason text, metadata jsonb
) language sql stable set search_path = public, extensions, pg_temp as $$
  with combined as (
    select fact.id, fact.document_id, fact.source_chunk_id, fact.source_image_id, fact.page_number,
      fact.table_title, fact.row_label, fact.clinical_parameter, fact.threshold_value, fact.action,
      fact.text_rank, fact.match_reason, coalesce(to_jsonb(fact)->'metadata', '{}'::jsonb) as metadata
    from public.match_document_table_facts_text($1, $2, $3, $4) fact
    union all
    select fact.id, fact.document_id, fact.source_chunk_id, fact.source_image_id, fact.page_number,
      fact.table_title, fact.row_label, fact.clinical_parameter, fact.threshold_value, fact.action,
      fact.text_rank, fact.match_reason, coalesce(to_jsonb(fact)->'metadata', '{}'::jsonb) as metadata
    from public.match_document_table_facts_text($1, $2, $3, '00000000-0000-0000-0000-000000000000'::uuid) fact
    where $5 and $4 <> '00000000-0000-0000-0000-000000000000'::uuid
  ), ranked as (select *, row_number() over (partition by id order by text_rank desc) access_rank from combined)
  select id, document_id, source_chunk_id, source_image_id, page_number, table_title, row_label,
    clinical_parameter, threshold_value, action, text_rank, match_reason, metadata
  from ranked where access_rank = 1 order by text_rank desc, id limit greatest(1, least($2, 100));
$$;

create or replace function public.match_document_embedding_fields_hybrid_v2(
  query_embedding extensions.vector(1536), query_text text, match_count integer default 16,
  min_similarity double precision default 0.5, document_filters uuid[] default null,
  owner_filter uuid default '00000000-0000-0000-0000-000000000000'::uuid,
  include_public boolean default true
) returns table (
  id uuid, document_id uuid, source_chunk_id uuid, field_type text, content text,
  similarity double precision, text_rank double precision, hybrid_score double precision
) language sql stable set search_path = public, extensions, pg_temp as $$
  with combined as (
    select * from public.match_document_embedding_fields_hybrid($1, $2, $3, $4, $5, $6)
    union all
    select * from public.match_document_embedding_fields_hybrid($1, $2, $3, $4, $5, '00000000-0000-0000-0000-000000000000'::uuid)
    where $7 and $6 <> '00000000-0000-0000-0000-000000000000'::uuid
  ), ranked as (select *, row_number() over (partition by id order by hybrid_score desc) access_rank from combined)
  select id, document_id, source_chunk_id, field_type, content, similarity, text_rank, hybrid_score
  from ranked where access_rank = 1 order by hybrid_score desc, id limit greatest(1, least($3, 100));
$$;

create or replace function public.match_document_index_units_hybrid_v2(
  query_embedding extensions.vector(1536),
  query_text text,
  match_count integer default 24,
  min_similarity double precision default 0.1,
  document_filters uuid[] default null,
  owner_filter uuid default '00000000-0000-0000-0000-000000000000'::uuid,
  include_public boolean default true
)
returns table (
  id uuid, document_id uuid, source_chunk_id uuid, source_image_id uuid, unit_type text, title text,
  content text, page_start integer, page_end integer, heading_path text[], normalized_terms text[],
  source_span jsonb, quality_score real, extraction_mode text, similarity double precision,
  text_rank double precision, hybrid_score double precision, metadata jsonb
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select *
  from public.match_document_index_units_hybrid_scoped(
    $1,
    $2,
    least(greatest(coalesce($3, 24), 1), 96),
    $4,
    $5,
    $6,
    $7
  );
$$;

create or replace function public.match_document_memory_cards_hybrid_v3(
  query_embedding extensions.vector(1536), query_text text, match_count integer default 32,
  min_similarity double precision default 0.1, document_filters uuid[] default null,
  owner_filter uuid default '00000000-0000-0000-0000-000000000000'::uuid,
  include_public boolean default true
) returns table (
  id uuid, document_id uuid, owner_id uuid, section_id uuid, card_type text, title text, content text,
  normalized_terms text[], page_number integer, source_chunk_ids uuid[], source_image_ids uuid[], confidence real,
  metadata jsonb, similarity double precision, text_rank double precision, hybrid_score double precision, rrf_score double precision
) language sql stable set search_path = public, extensions, pg_temp as $$
  with combined as (
    select * from public.match_document_memory_cards_hybrid_v2($1, $2, $3, $4, $5, $6)
    union all
    select * from public.match_document_memory_cards_hybrid_v2($1, $2, $3, $4, $5, '00000000-0000-0000-0000-000000000000'::uuid)
    where $7 and $6 <> '00000000-0000-0000-0000-000000000000'::uuid
  ), ranked as (select *, row_number() over (partition by id order by hybrid_score desc, rrf_score desc) access_rank from combined)
  select id, document_id, owner_id, section_id, card_type, title, content, normalized_terms, page_number,
    source_chunk_ids, source_image_ids, confidence, metadata, similarity, text_rank, hybrid_score, rrf_score
  from ranked where access_rank = 1 order by hybrid_score desc, rrf_score desc, id limit greatest(1, least($3, 100));
$$;

revoke all on function public.match_document_chunks_text_scoped(text, integer, uuid[], uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.match_document_chunks_text_scoped(text, integer, uuid[], uuid, boolean)
  to service_role;
revoke all on function public.match_document_index_units_hybrid_scoped(
  extensions.vector, text, integer, double precision, uuid[], uuid, boolean
) from public, anon, authenticated;
grant execute on function public.match_document_index_units_hybrid_scoped(
  extensions.vector, text, integer, double precision, uuid[], uuid, boolean
) to service_role;

revoke all on function public.retrieval_owner_matches_v2(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.corpus_topic_term_stats_v2(text[], uuid, boolean) from public, anon, authenticated;
revoke all on function public.match_document_chunks_text_v2(text, integer, uuid[], uuid, boolean) from public, anon, authenticated;
revoke all on function public.match_document_chunks_hybrid_v2(extensions.vector, text, integer, double precision, uuid[], uuid, boolean) from public, anon, authenticated;
revoke all on function public.match_document_chunks_v2(extensions.vector, integer, double precision, uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.get_related_document_metadata_v2(uuid[], uuid, boolean) from public, anon, authenticated;
revoke all on function public.match_document_lookup_chunks_text_v2(text, uuid[], integer, uuid, boolean) from public, anon, authenticated;
revoke all on function public.match_documents_for_query_v2(text, integer, uuid, boolean) from public, anon, authenticated;
revoke all on function public.match_document_table_facts_text_v2(text, integer, uuid[], uuid, boolean) from public, anon, authenticated;
revoke all on function public.match_document_embedding_fields_hybrid_v2(extensions.vector, text, integer, double precision, uuid[], uuid, boolean) from public, anon, authenticated;
revoke all on function public.match_document_index_units_hybrid_v2(extensions.vector, text, integer, double precision, uuid[], uuid, boolean) from public, anon, authenticated;
revoke all on function public.match_document_memory_cards_hybrid_v3(extensions.vector, text, integer, double precision, uuid[], uuid, boolean) from public, anon, authenticated;
grant execute on function public.retrieval_owner_matches_v2(uuid, uuid, boolean) to service_role;
grant execute on function public.corpus_topic_term_stats_v2(text[], uuid, boolean) to service_role;
grant execute on function public.match_document_chunks_text_v2(text, integer, uuid[], uuid, boolean) to service_role;
grant execute on function public.match_document_chunks_hybrid_v2(extensions.vector, text, integer, double precision, uuid[], uuid, boolean) to service_role;
grant execute on function public.match_document_chunks_v2(extensions.vector, integer, double precision, uuid, uuid, boolean) to service_role;
grant execute on function public.get_related_document_metadata_v2(uuid[], uuid, boolean) to service_role;
grant execute on function public.match_document_lookup_chunks_text_v2(text, uuid[], integer, uuid, boolean) to service_role;
grant execute on function public.match_documents_for_query_v2(text, integer, uuid, boolean) to service_role;
grant execute on function public.match_document_table_facts_text_v2(text, integer, uuid[], uuid, boolean) to service_role;
grant execute on function public.match_document_embedding_fields_hybrid_v2(extensions.vector, text, integer, double precision, uuid[], uuid, boolean) to service_role;
grant execute on function public.match_document_index_units_hybrid_v2(extensions.vector, text, integer, double precision, uuid[], uuid, boolean) to service_role;
grant execute on function public.match_document_memory_cards_hybrid_v3(extensions.vector, text, integer, double precision, uuid[], uuid, boolean) to service_role;

do $$
begin
  if public.retrieval_owner_matches_v2(null, null, true)
    or not public.retrieval_owner_matches_v2('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', null, true)
    or not public.retrieval_owner_matches_v2('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true)
    or public.retrieval_owner_matches_v2('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true)
  then raise exception 'retrieval_owner_matches_v2 truth table failed'; end if;
end $$;
-- Require durable operator evidence before an owned document can enter the public corpus.
-- Historical public rows are deliberately left untouched for separate operator investigation.

create table if not exists public.document_publication_approvals (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  expected_prior_owner_id uuid not null,
  approving_operator_id uuid not null,
  decision text not null check (decision in ('approved', 'keep_private', 'quarantine')),
  reason text not null check (char_length(trim(reason)) between 3 and 2000),
  evidence_references text[] not null check (cardinality(evidence_references) > 0),
  manifest_digest text not null check (manifest_digest ~ '^[0-9a-f]{64}$'),
  reviewed_state_digest text,
  approved_at timestamptz not null default now(),
  constraint document_publication_approvals_reviewed_state_digest_format
    check (reviewed_state_digest is null or reviewed_state_digest ~ '^[0-9a-f]{64}$'),
  unique (document_id, expected_prior_owner_id, manifest_digest)
);

create index if not exists document_publication_approvals_document_idx
  on public.document_publication_approvals(document_id, approved_at desc);

alter table public.document_publication_approvals enable row level security;
revoke all on table public.document_publication_approvals from public, anon, authenticated;
grant select, insert on table public.document_publication_approvals to service_role;

drop policy if exists "document publication approvals service role" on public.document_publication_approvals;
create policy "document publication approvals service role"
  on public.document_publication_approvals for all to service_role using (true) with check (true);

create or replace function public.prevent_document_publication_approval_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'document_publication_approvals is append-only';
end;
$$;

revoke all on function public.prevent_document_publication_approval_mutation() from public, anon, authenticated;

drop trigger if exists document_publication_approvals_immutable on public.document_publication_approvals;
create trigger document_publication_approvals_immutable
before update or delete on public.document_publication_approvals
for each row execute function public.prevent_document_publication_approval_mutation();

create or replace function public.document_publication_state_digest(
  p_document_id uuid,
  p_expected_owner_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'document', to_jsonb(d) - array['owner_id', 'created_at', 'updated_at', 'search_tsv', 'title_search_tsv'],
          'pages', coalesce((select jsonb_agg(to_jsonb(p) - array['created_at', 'updated_at'] order by p.page_number, p.id) from public.document_pages p where p.document_id = d.id), '[]'::jsonb),
          'images', coalesce((select jsonb_agg(to_jsonb(i) - array['created_at', 'updated_at'] order by i.page_number nulls last, i.id) from public.document_images i where i.document_id = d.id and public.is_committed_document_generation(i.index_generation_id, d.index_generation_id)), '[]'::jsonb),
          'labels', coalesce((select jsonb_agg(to_jsonb(l) - array['owner_id', 'created_at', 'updated_at'] order by l.id) from public.document_labels l where l.document_id = d.id), '[]'::jsonb),
          'summaries', coalesce((select jsonb_agg(to_jsonb(s) - array['owner_id', 'created_at', 'updated_at'] order by s.id) from public.document_summaries s where s.document_id = d.id), '[]'::jsonb),
          'sections', coalesce((select jsonb_agg(to_jsonb(s) - array['owner_id', 'created_at', 'updated_at'] order by s.section_index, s.id) from public.document_sections s where s.document_id = d.id and public.is_committed_artifact_generation(coalesce(s.artifact_generation_id, s.index_generation_id), d.metadata)), '[]'::jsonb),
          'memory_cards', coalesce((select jsonb_agg(to_jsonb(m) - array['owner_id', 'embedding', 'search_tsv', 'created_at', 'updated_at'] order by m.id) from public.document_memory_cards m where m.document_id = d.id and public.is_committed_artifact_generation(coalesce(m.artifact_generation_id, m.index_generation_id), d.metadata)), '[]'::jsonb),
          'chunks', coalesce((select jsonb_agg(to_jsonb(c) - array['embedding', 'search_tsv', 'created_at'] order by c.chunk_index, c.id) from public.document_chunks c where c.document_id = d.id and public.is_committed_document_generation(c.index_generation_id, d.index_generation_id)), '[]'::jsonb),
          'table_facts', coalesce((select jsonb_agg(to_jsonb(f) - array['owner_id', 'search_tsv', 'created_at'] order by f.id) from public.document_table_facts f where f.document_id = d.id and public.is_committed_document_generation(f.index_generation_id, d.index_generation_id)), '[]'::jsonb),
          'embedding_fields', coalesce((select jsonb_agg(to_jsonb(f) - array['owner_id', 'embedding', 'search_tsv', 'created_at'] order by f.id) from public.document_embedding_fields f where f.document_id = d.id and public.is_committed_document_generation(f.index_generation_id, d.index_generation_id)), '[]'::jsonb),
          'index_quality', coalesce((select to_jsonb(q) - array['owner_id', 'updated_at'] from public.document_index_quality q where q.document_id = d.id), '{}'::jsonb),
          'index_units', coalesce((select jsonb_agg(to_jsonb(u) - array['owner_id', 'embedding', 'search_tsv', 'created_at', 'updated_at'] order by u.id) from public.document_index_units u where u.document_id = d.id and public.is_committed_artifact_generation(coalesce(u.artifact_generation_id, u.index_generation_id), d.metadata)), '[]'::jsonb)
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )
  from public.documents d
  where d.id = p_document_id
    and d.owner_id = p_expected_owner_id;
$$;

revoke all on function public.document_publication_state_digest(uuid, uuid) from public, anon, authenticated;
grant execute on function public.document_publication_state_digest(uuid, uuid) to service_role;

create or replace function public.require_document_publication_approval_state_digest()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.reviewed_state_digest is null then
    raise exception 'publication approval requires a reviewed content/state digest';
  end if;
  return new;
end;
$$;

revoke all on function public.require_document_publication_approval_state_digest() from public, anon, authenticated;

drop trigger if exists document_publication_approvals_require_state_digest on public.document_publication_approvals;
create trigger document_publication_approvals_require_state_digest
before insert on public.document_publication_approvals
for each row execute function public.require_document_publication_approval_state_digest();

create or replace function public.guard_document_publication_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_approval_id uuid;
  v_manifest_digest text;
  v_reviewed_state_digest text;
  v_current_state_digest text;
begin
  if tg_op = 'INSERT' then
    if new.owner_id is null then
      raise exception 'public documents must be created as owned rows before approved publication';
    end if;
    return new;
  end if;

  if old.owner_id is not null and new.owner_id is null then
    begin
      v_approval_id := nullif(new.metadata->>'publication_approval_id', '')::uuid;
    exception when invalid_text_representation then
      raise exception 'public document transition has an invalid publication approval id';
    end;
    v_manifest_digest := lower(coalesce(new.metadata->>'publication_manifest_digest', ''));
    v_reviewed_state_digest := lower(coalesce(new.metadata->>'publication_reviewed_state_digest', ''));

    if v_approval_id is null
      or v_manifest_digest !~ '^[0-9a-f]{64}$'
      or v_reviewed_state_digest !~ '^[0-9a-f]{64}$' then
      raise exception 'public document transition requires publication approval evidence';
    end if;

    if not exists (
      select 1
      from public.document_publication_approvals approval
      where approval.id = v_approval_id
        and approval.document_id = old.id
        and approval.expected_prior_owner_id = old.owner_id
        and approval.decision = 'approved'
        and approval.manifest_digest = v_manifest_digest
        and approval.reviewed_state_digest = v_reviewed_state_digest
    ) then
      raise exception 'public document transition approval does not match the reviewed document state';
    end if;

    perform 1 from public.document_pages where document_id = old.id for update;
    perform 1 from public.document_images where document_id = old.id for update;
    perform 1 from public.document_labels where document_id = old.id for update;
    perform 1 from public.document_summaries where document_id = old.id for update;
    perform 1 from public.document_sections where document_id = old.id for update;
    perform 1 from public.document_memory_cards where document_id = old.id for update;
    perform 1 from public.document_chunks where document_id = old.id for update;
    perform 1 from public.document_table_facts where document_id = old.id for update;
    perform 1 from public.document_embedding_fields where document_id = old.id for update;
    perform 1 from public.document_index_quality where document_id = old.id for update;
    perform 1 from public.document_index_units where document_id = old.id for update;

    v_current_state_digest := public.document_publication_state_digest(old.id, old.owner_id);
    if v_current_state_digest is distinct from v_reviewed_state_digest then
      raise exception 'public document transition content changed after review';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_document_publication_transition() from public, anon, authenticated;

drop trigger if exists documents_require_publication_approval on public.documents;
create trigger documents_require_publication_approval
before insert or update on public.documents
for each row execute function public.guard_document_publication_transition();

create or replace function public.publish_approved_documents(
  p_documents jsonb,
  p_manifest_digest text,
  p_expected_count integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry jsonb;
  v_document public.documents%rowtype;
  v_document_id uuid;
  v_expected_owner_id uuid;
  v_expected_state_digest text;
  v_current_state_digest text;
  v_approval_id uuid;
  v_manifest_digest text := lower(trim(coalesce(p_manifest_digest, '')));
  v_count integer;
  v_results jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_documents) is distinct from 'array' then
    raise exception 'publication documents must be a JSON array';
  end if;
  if v_manifest_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'publication manifest digest must be a lowercase SHA-256 value';
  end if;

  v_count := jsonb_array_length(p_documents);
  if p_expected_count is null or p_expected_count < 1 or p_expected_count <> v_count then
    raise exception 'publication expected count % does not match manifest count %', p_expected_count, v_count;
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_documents) entry
    group by entry->>'document_id'
    having count(*) > 1
  ) then
    raise exception 'publication manifest contains duplicate document ids';
  end if;

  for v_entry in select value from jsonb_array_elements(p_documents)
  loop
    begin
      v_document_id := nullif(v_entry->>'document_id', '')::uuid;
      v_expected_owner_id := nullif(v_entry->>'expected_owner_id', '')::uuid;
    exception when invalid_text_representation then
      raise exception 'publication manifest contains an invalid document or owner id';
    end;
    v_expected_state_digest := lower(coalesce(v_entry->>'expected_state_digest', ''));
    if v_document_id is null or v_expected_owner_id is null then
      raise exception 'publication manifest requires document_id and expected_owner_id';
    end if;
    if v_expected_state_digest !~ '^[0-9a-f]{64}$' then
      raise exception 'publication manifest requires expected_state_digest';
    end if;

    -- The parent lock serializes document/generation changes and conflicts with
    -- FK key-share locks taken by new child rows. Existing artifact rows are
    -- locked below before the canonical state digest is recomputed.
    select * into v_document
    from public.documents
    where id = v_document_id
    for update;
    if not found then
      raise exception 'publication document % was not found', v_document_id;
    end if;
    if v_document.owner_id is distinct from v_expected_owner_id then
      raise exception 'publication document % owner changed from the manifest expectation', v_document_id;
    end if;
    if v_document.status <> 'indexed' then
      raise exception 'publication document % is not indexed', v_document_id;
    end if;

    perform 1 from public.document_pages where document_id = v_document_id for update;
    perform 1 from public.document_images where document_id = v_document_id for update;
    perform 1 from public.document_labels where document_id = v_document_id for update;
    perform 1 from public.document_summaries where document_id = v_document_id for update;
    perform 1 from public.document_sections where document_id = v_document_id for update;
    perform 1 from public.document_memory_cards where document_id = v_document_id for update;
    perform 1 from public.document_chunks where document_id = v_document_id for update;
    perform 1 from public.document_table_facts where document_id = v_document_id for update;
    perform 1 from public.document_embedding_fields where document_id = v_document_id for update;
    perform 1 from public.document_index_quality where document_id = v_document_id for update;
    perform 1 from public.document_index_units where document_id = v_document_id for update;

    select approval.id into v_approval_id
    from public.document_publication_approvals approval
    where approval.document_id = v_document_id
      and approval.expected_prior_owner_id = v_expected_owner_id
      and approval.decision = 'approved'
      and approval.manifest_digest = v_manifest_digest
      and approval.reviewed_state_digest = v_expected_state_digest
    order by approval.approved_at desc, approval.id desc
    limit 1;
    if v_approval_id is null then
      raise exception 'publication document % lacks matching approved evidence', v_document_id;
    end if;

    if exists (
      select 1 from public.document_labels where document_id = v_document_id and owner_id is distinct from v_expected_owner_id
      union all select 1 from public.document_summaries where document_id = v_document_id and owner_id is distinct from v_expected_owner_id
      union all select 1 from public.document_sections where document_id = v_document_id and owner_id is distinct from v_expected_owner_id
      union all select 1 from public.document_memory_cards where document_id = v_document_id and owner_id is distinct from v_expected_owner_id
      union all select 1 from public.document_table_facts where document_id = v_document_id and owner_id is distinct from v_expected_owner_id
      union all select 1 from public.document_embedding_fields where document_id = v_document_id and owner_id is distinct from v_expected_owner_id
      union all select 1 from public.document_index_quality where document_id = v_document_id and owner_id is distinct from v_expected_owner_id
      union all select 1 from public.document_index_units where document_id = v_document_id and owner_id is distinct from v_expected_owner_id
    ) then
      raise exception 'publication document % has mismatched artifact ownership', v_document_id;
    end if;

    v_current_state_digest := public.document_publication_state_digest(v_document_id, v_expected_owner_id);
    if v_current_state_digest is distinct from v_expected_state_digest then
      raise exception 'publication document % changed after review', v_document_id;
    end if;

    update public.document_labels set owner_id = null, updated_at = now() where document_id = v_document_id;
    update public.document_summaries set owner_id = null, updated_at = now() where document_id = v_document_id;
    update public.document_sections set owner_id = null, updated_at = now() where document_id = v_document_id;
    update public.document_memory_cards set owner_id = null, updated_at = now() where document_id = v_document_id;
    update public.document_table_facts set owner_id = null where document_id = v_document_id;
    update public.document_embedding_fields set owner_id = null where document_id = v_document_id;
    update public.document_index_quality set owner_id = null, updated_at = now() where document_id = v_document_id;
    update public.document_index_units set owner_id = null, updated_at = now() where document_id = v_document_id;

    update public.documents
    set owner_id = null,
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'public_corpus', true,
          'publication_approval_id', v_approval_id,
          'publication_manifest_digest', v_manifest_digest,
          'publication_reviewed_state_digest', v_expected_state_digest,
          'published_at', now()
        ),
        updated_at = now()
    where id = v_document_id;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'document_id', v_document_id,
      'previous_owner_id', v_expected_owner_id,
      'approval_id', v_approval_id,
      'reviewed_state_digest', v_expected_state_digest,
      'outcome', 'published'
    ));
  end loop;

  return jsonb_build_object(
    'manifest_digest', v_manifest_digest,
    'published_count', v_count,
    'documents', v_results
  );
end;
$$;

revoke all on function public.publish_approved_documents(jsonb, text, integer) from public, anon, authenticated;
grant execute on function public.publish_approved_documents(jsonb, text, integer) to service_role;
-- Serialize permanent document deletion with ingestion job creation. The
-- parent row lock conflicts with the FK key-share lock taken by a concurrent
-- ingestion_jobs insert: either the job commits first and deletion returns an
-- active_job outcome, or deletion commits first and the insert receives 23503.
create or replace function public.delete_document_if_idle(
  p_document_id uuid,
  p_owner_id uuid,
  p_document_bucket text,
  p_image_bucket text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document public.documents%rowtype;
  v_active_job public.ingestion_jobs%rowtype;
  v_cleanup_job_id uuid;
  v_image_paths text[] := '{}'::text[];
  v_chunk_ids uuid[] := '{}'::uuid[];
begin
  if p_document_id is null or p_owner_id is null then
    raise exception 'Document and owner identifiers are required.' using errcode = '22023';
  end if;
  if nullif(btrim(p_document_bucket), '') is null or nullif(btrim(p_image_bucket), '') is null then
    raise exception 'Storage bucket names are required.' using errcode = '22023';
  end if;

  select d.*
    into v_document
    from public.documents d
   where d.id = p_document_id
     and d.owner_id = p_owner_id
   for update;

  if not found then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  select j.*
    into v_active_job
    from public.ingestion_jobs j
   where j.document_id = p_document_id
     and j.status in ('pending', 'processing')
   order by j.created_at asc, j.id asc
   limit 1;

  if found then
    return jsonb_build_object(
      'outcome', 'active_job',
      'job_id', v_active_job.id,
      'job_status', v_active_job.status
    );
  end if;

  select coalesce(array_agg(distinct i.storage_path order by i.storage_path)
                          filter (where i.storage_path is not null and btrim(i.storage_path) <> ''), '{}'::text[])
    into v_image_paths
    from public.document_images i
   where i.document_id = p_document_id;

  select coalesce(array_agg(c.id order by c.id), '{}'::uuid[])
    into v_chunk_ids
    from public.document_chunks c
   where c.document_id = p_document_id;

  insert into public.storage_cleanup_jobs (
    owner_id,
    document_id,
    document_title,
    document_bucket,
    document_paths,
    image_bucket,
    image_paths,
    status,
    metadata
  ) values (
    p_owner_id,
    p_document_id,
    v_document.title,
    p_document_bucket,
    case
      when v_document.storage_path is null or btrim(v_document.storage_path) = '' then '{}'::text[]
      else array[v_document.storage_path]
    end,
    p_image_bucket,
    v_image_paths,
    'pending',
    jsonb_build_object(
      'operation', 'permanent_document_delete',
      'created_by', 'delete_document_if_idle'
    )
  )
  returning id into v_cleanup_job_id;

  if cardinality(v_chunk_ids) > 0 then
    delete from public.rag_queries
     where source_chunk_ids && v_chunk_ids;
    delete from public.rag_query_misses
     where top_chunk_ids && v_chunk_ids
        or cited_chunk_ids && v_chunk_ids;
  end if;

  delete from public.rag_query_misses
   where clicked_document_id = p_document_id
      or expected_document_id = p_document_id;

  delete from public.rag_response_cache
   where owner_id = p_owner_id
     and cache_kind in ('search', 'answer');

  delete from public.documents where id = p_document_id;

  return jsonb_build_object(
    'outcome', 'deleted',
    'cleanup_job_id', v_cleanup_job_id,
    'document_title', v_document.title,
    'source_path', v_document.storage_path,
    'image_paths', to_jsonb(v_image_paths)
  );
end;
$$;

revoke all on function public.delete_document_if_idle(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.delete_document_if_idle(uuid, uuid, text, text)
  to service_role;


create or replace function public.retry_ingestion_job_if_idle(
  p_job_id uuid,
  p_owner_id uuid,
  p_stale_before timestamptz,
  p_max_attempts integer,
  p_next_run_at timestamptz,
  p_document_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.ingestion_jobs%rowtype;
  v_document_status text;
begin
  if p_job_id is null or p_owner_id is null or p_stale_before is null
     or p_next_run_at is null or p_document_updated_at is null
     or p_max_attempts is null or p_max_attempts < 1 then
    raise exception 'Retry identifiers, timestamps, and max attempts are required.' using errcode = '22023';
  end if;

  select j.*
    into v_job
  from public.ingestion_jobs j
  join public.documents d on d.id = j.document_id
   where j.id = p_job_id
     and d.owner_id = p_owner_id
   for update of d, j;

  if not found then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  select status
    into v_document_status
  from public.documents
  where id = v_job.document_id;
  if v_job.status = 'completed' then
    return jsonb_build_object('outcome', 'completed');
  end if;
  if v_job.status = 'processing'
     and v_job.locked_at is not null
     and v_job.locked_at >= p_stale_before then
    return jsonb_build_object('outcome', 'active_worker');
  end if;

  update public.ingestion_jobs
     set status = 'pending',
         stage = 'queued',
         progress = 0,
         error_message = null,
         attempt_count = 0,
         max_attempts = p_max_attempts,
         locked_at = null,
         locked_by = null,
         next_run_at = p_next_run_at,
         completed_at = null
   where id = p_job_id
  returning * into v_job;

  update public.documents
     set status = case when v_document_status = 'indexed' then status else 'queued' end,
         error_message = null,
         updated_at = p_document_updated_at
   where id = v_job.document_id
     and owner_id = p_owner_id;
  if not found then
    raise exception 'Retry document disappeared while its row lock was held.' using errcode = '23503';
  end if;

  return jsonb_build_object('outcome', 'queued', 'job', to_jsonb(v_job));
end;
$$;

revoke all on function public.retry_ingestion_job_if_idle(uuid, uuid, timestamptz, integer, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.retry_ingestion_job_if_idle(uuid, uuid, timestamptz, integer, timestamptz, timestamptz)
  to service_role;
-- Catalog-level, fail-closed verification for future objects created by
-- postgres. A missing pg_default_acl row must be interpreted through
-- acldefault(), including PostgreSQL's built-in PUBLIC EXECUTE on functions.

create or replace function public.default_privileges_status(
  p_role_name text default 'postgres',
  p_schema_name text default 'public'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role_oid oid;
  v_namespace_oid oid;
  v_entries text[] := '{}'::text[];
  v_safe boolean := false;
  v_has_unexpected_grantee boolean := false;
  v_has_grantable boolean := false;
begin
  select oid into v_role_oid from pg_catalog.pg_roles where rolname = p_role_name;
  select oid into v_namespace_oid from pg_catalog.pg_namespace where nspname = p_schema_name;

  if v_role_oid is null or v_namespace_oid is null then
    return jsonb_build_object(
      'role_exists', v_role_oid is not null,
      'schema_exists', v_namespace_oid is not null,
      'safe', false,
      'entries', '[]'::jsonb
    );
  end if;

  with object_types(object_type, object_code) as (
    values ('table'::text, 'r'::"char"), ('sequence'::text, 'S'::"char"), ('function'::text, 'f'::"char")
  ), effective_acls as (
    select
      ot.object_type,
      coalesce(global_acl.defaclacl, pg_catalog.acldefault(ot.object_code, v_role_oid))
        || coalesce(schema_acl.defaclacl, '{}'::aclitem[]) as acl
    from object_types ot
    left join pg_catalog.pg_default_acl global_acl
      on global_acl.defaclrole = v_role_oid
     and global_acl.defaclnamespace = 0
     and global_acl.defaclobjtype = ot.object_code
    left join pg_catalog.pg_default_acl schema_acl
      on schema_acl.defaclrole = v_role_oid
     and schema_acl.defaclnamespace = v_namespace_oid
     and schema_acl.defaclobjtype = ot.object_code
  ), exploded as (
    select distinct
      ea.object_type,
      case when privilege.grantee = 0 then 'PUBLIC' else grantee.rolname end as grantee,
      lower(privilege.privilege_type) as privilege_type,
      privilege.is_grantable
    from effective_acls ea
    cross join lateral pg_catalog.aclexplode(ea.acl) privilege
    left join pg_catalog.pg_roles grantee on grantee.oid = privilege.grantee
  )
  select
    coalesce(
      array_agg(format('%s:%s:%s', object_type, grantee, privilege_type)
                order by object_type, grantee, privilege_type),
      '{}'::text[]
    ),
    coalesce(bool_or(grantee not in (p_role_name, 'service_role')), false),
    coalesce(bool_or(is_grantable), false)
  into v_entries, v_has_unexpected_grantee, v_has_grantable
  from exploded;

  v_safe :=
    not v_has_unexpected_grantee
    and not v_has_grantable
    and not exists (
      select 1 from unnest(v_entries) entry
       where entry like 'table:PUBLIC:%'
          or entry like 'table:anon:%'
          or entry like 'table:authenticated:%'
          or entry like 'sequence:PUBLIC:%'
          or entry like 'sequence:anon:%'
          or entry like 'sequence:authenticated:%'
          or entry = 'function:PUBLIC:execute'
          or entry like 'function:anon:%'
          or entry like 'function:authenticated:%'
    )
    and 'table:service_role:select' = any(v_entries)
    and 'table:service_role:insert' = any(v_entries)
    and 'table:service_role:update' = any(v_entries)
    and 'table:service_role:delete' = any(v_entries)
    and 'sequence:service_role:usage' = any(v_entries)
    and 'sequence:service_role:select' = any(v_entries)
    and 'function:service_role:execute' = any(v_entries)
    and not exists (
      select 1 from unnest(v_entries) entry
       where entry like 'table:service_role:%'
         and entry <> all(array[
           'table:service_role:select', 'table:service_role:insert',
           'table:service_role:update', 'table:service_role:delete'
         ])
    )
    and not exists (
      select 1 from unnest(v_entries) entry
       where entry like 'sequence:service_role:%'
         and entry <> all(array['sequence:service_role:usage', 'sequence:service_role:select'])
    )
    and not exists (
      select 1 from unnest(v_entries) entry
       where entry like 'function:service_role:%'
         and entry <> 'function:service_role:execute'
    );

  return jsonb_build_object(
    'role_exists', true,
    'schema_exists', true,
    'safe', v_safe,
    'entries', to_jsonb(v_entries)
  );
end;
$$;

revoke all on function public.default_privileges_status(text, text)
  from public, anon, authenticated;
grant execute on function public.default_privileges_status(text, text)
  to service_role;

do $$
declare
  v_status jsonb;
begin
  alter default privileges for role postgres
    revoke all privileges on tables from public, anon, authenticated, service_role;
  alter default privileges for role postgres in schema public
    revoke all privileges on tables from public, anon, authenticated, service_role;
  alter default privileges for role postgres
    revoke all privileges on sequences from public, anon, authenticated, service_role;
  alter default privileges for role postgres in schema public
    revoke all privileges on sequences from public, anon, authenticated, service_role;
  alter default privileges for role postgres
    revoke execute on functions from public, anon, authenticated, service_role;
  alter default privileges for role postgres in schema public
    revoke execute on functions from public, anon, authenticated, service_role;
  alter default privileges for role postgres in schema public
    grant select, insert, update, delete on tables to service_role;
  alter default privileges for role postgres in schema public
    grant usage, select on sequences to service_role;
  alter default privileges for role postgres in schema public
    grant execute on functions to service_role;

  v_status := public.default_privileges_status('postgres', 'public');
  if not coalesce((v_status->>'safe')::boolean, false) then
    raise exception using
      errcode = '42501',
      message = 'Unsafe postgres default privileges in schema public; migration blocked.',
      detail = v_status::text,
      hint = 'Reapply the postgres default-privilege repair and retry the migration.';
  end if;
end;
$$;

-- Account-owned application data. Public content remains anonymous-readable
-- through server routes; favourites and preferences require an authenticated
-- owner at both the API and RLS layers.
create table if not exists public.user_favourites (
  user_id uuid not null references auth.users(id) on delete cascade,
  content_type text not null,
  content_key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, content_type, content_key),
  constraint user_favourites_content_type_check
    check (content_type in ('service', 'form', 'differential')),
  constraint user_favourites_content_key_check
    check (content_key = btrim(content_key) and char_length(content_key) between 1 and 180)
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint user_preferences_object_check check (jsonb_typeof(preferences) = 'object'),
  constraint user_preferences_size_check check (pg_column_size(preferences) <= 16384)
);

alter table public.user_favourites enable row level security;
alter table public.user_preferences enable row level security;

revoke all on table public.user_favourites from public, anon, authenticated;
revoke all on table public.user_preferences from public, anon, authenticated;
grant select, insert, update, delete on table public.user_favourites to service_role;
grant select, insert, update, delete on table public.user_preferences to service_role;

create policy "users read own favourites" on public.user_favourites
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "users insert own favourites" on public.user_favourites
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "users delete own favourites" on public.user_favourites
  for delete to authenticated using ((select auth.uid()) = user_id);
create policy "users read own preferences" on public.user_preferences
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "users insert own preferences" on public.user_preferences
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "users update own preferences" on public.user_preferences
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "users delete own preferences" on public.user_preferences
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke insert, update, delete on table storage.objects from anon, authenticated;
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

create or replace function public.consume_summary_rate_limits_atomic(
  p_owner_id uuid,
  p_subject_key text,
  p_answer_limit integer,
  p_answer_window_seconds integer,
  p_summary_limit integer,
  p_summary_window_seconds integer,
  p_global_answer_limit integer,
  p_global_answer_window_seconds integer
)
returns table (
  bucket text,
  limited boolean,
  limit_value integer,
  remaining integer,
  retry_after_seconds integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_policy record;
  v_count integer;
  v_remaining integer;
  v_reset_at timestamptz;
  v_min_remaining integer := 2147483647;
  v_success_limit integer;
  v_success_reset_at timestamptz;
begin
  if (p_owner_id is null) = (p_subject_key is null or pg_catalog.btrim(p_subject_key) = '') then
    raise exception 'exactly one owner_id or subject_key is required';
  end if;
  if p_answer_limit is null or p_answer_limit < 1
    or p_answer_window_seconds is null or p_answer_window_seconds < 1
    or p_summary_limit is null or p_summary_limit < 1
    or p_summary_window_seconds is null or p_summary_window_seconds < 1
    or p_global_answer_limit is null or p_global_answer_limit < 1
    or p_global_answer_window_seconds is null or p_global_answer_window_seconds < 1 then
    raise exception 'limits and windows must be positive';
  end if;

  if p_owner_id is not null then
    insert into public.api_rate_limits (owner_id, bucket, window_start, request_count, updated_at)
    values
      (p_owner_id, 'answer', v_now, 0, v_now),
      (p_owner_id, 'document_summarize', v_now, 0, v_now)
    on conflict on constraint api_rate_limits_pkey do nothing;
    perform 1
    from public.api_rate_limits as rl
    where rl.owner_id = p_owner_id and rl.bucket in ('answer', 'document_summarize')
    order by rl.bucket
    for update;
    for v_policy in
      select * from (values
        ('answer'::text, 1, p_answer_limit, p_answer_window_seconds),
        ('document_summarize'::text, 2, p_summary_limit, p_summary_window_seconds)
      ) as policy(bucket, ordinal, limit_value, window_seconds)
      order by ordinal
    loop
      update public.api_rate_limits as rl
      set
        window_start = case
          when rl.window_start + pg_catalog.make_interval(secs => v_policy.window_seconds) <= v_now then v_now
          else rl.window_start
        end,
        request_count = case
          when rl.window_start + pg_catalog.make_interval(secs => v_policy.window_seconds) <= v_now then 1
          else rl.request_count + 1
        end,
        updated_at = v_now
      where rl.owner_id = p_owner_id and rl.bucket = v_policy.bucket
      returning rl.request_count,
        rl.window_start + pg_catalog.make_interval(secs => v_policy.window_seconds)
      into v_count, v_reset_at;
      v_remaining := greatest(v_policy.limit_value - v_count, 0);
      if v_remaining < v_min_remaining then
        v_min_remaining := v_remaining;
        v_success_limit := v_policy.limit_value;
        v_success_reset_at := v_reset_at;
      end if;
      if v_count > v_policy.limit_value then
        return query select
          v_policy.bucket::text,
          true,
          v_policy.limit_value::integer,
          0,
          greatest(1, pg_catalog.ceil(extract(epoch from (v_reset_at - v_now)))::integer),
          v_reset_at;
        return;
      end if;
    end loop;
  else
    insert into public.api_rate_limit_subjects (subject_key, bucket, window_start, request_count, updated_at)
    values
      (p_subject_key, 'answer', v_now, 0, v_now),
      ('anon:answer:global', 'answer', v_now, 0, v_now),
      (p_subject_key, 'document_summarize', v_now, 0, v_now)
    on conflict on constraint api_rate_limit_subjects_pkey do nothing;
    perform 1
    from public.api_rate_limit_subjects as rl
    where (rl.subject_key, rl.bucket) in (
      (p_subject_key, 'answer'),
      ('anon:answer:global', 'answer'),
      (p_subject_key, 'document_summarize')
    )
    order by rl.subject_key, rl.bucket
    for update;
    for v_policy in
      select * from (values
        ('answer'::text, 1, p_subject_key, p_answer_limit, p_answer_window_seconds, 'answer'::text),
        ('answer'::text, 2, 'anon:answer:global', p_global_answer_limit, p_global_answer_window_seconds, 'answer'::text),
        ('document_summarize'::text, 3, p_subject_key, p_summary_limit, p_summary_window_seconds, 'document_summarize'::text)
      ) as policy(bucket, ordinal, subject_key, limit_value, window_seconds, rejection_bucket)
      order by ordinal
    loop
      update public.api_rate_limit_subjects as rl
      set
        window_start = case
          when rl.window_start + pg_catalog.make_interval(secs => v_policy.window_seconds) <= v_now then v_now
          else rl.window_start
        end,
        request_count = case
          when rl.window_start + pg_catalog.make_interval(secs => v_policy.window_seconds) <= v_now then 1
          else rl.request_count + 1
        end,
        updated_at = v_now
      where rl.subject_key = v_policy.subject_key and rl.bucket = v_policy.bucket
      returning rl.request_count,
        rl.window_start + pg_catalog.make_interval(secs => v_policy.window_seconds)
      into v_count, v_reset_at;
      v_remaining := greatest(v_policy.limit_value - v_count, 0);
      if v_remaining < v_min_remaining then
        v_min_remaining := v_remaining;
        v_success_limit := v_policy.limit_value;
        v_success_reset_at := v_reset_at;
      end if;
      if v_count > v_policy.limit_value then
        return query select
          v_policy.rejection_bucket::text,
          true,
          v_policy.limit_value::integer,
          0,
          greatest(1, pg_catalog.ceil(extract(epoch from (v_reset_at - v_now)))::integer),
          v_reset_at;
        return;
      end if;
    end loop;
  end if;
  return query select
    null::text,
    false,
    v_success_limit,
    v_min_remaining,
    greatest(1, pg_catalog.ceil(extract(epoch from (v_success_reset_at - v_now)))::integer),
    v_success_reset_at;
end;
$$;

revoke execute on function public.consume_summary_rate_limits_atomic(
  uuid, text, integer, integer, integer, integer, integer, integer
) from public, anon, authenticated;
grant execute on function public.consume_summary_rate_limits_atomic(
  uuid, text, integer, integer, integer, integer, integer, integer
) to service_role;

-- Catalog-level, fail-closed verification for future objects created by
-- postgres. A missing pg_default_acl row must be interpreted through
-- acldefault(), including PostgreSQL's built-in PUBLIC EXECUTE on functions.

create or replace function public.default_privileges_status(
  p_role_name text default 'postgres',
  p_schema_name text default 'public'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role_oid oid;
  v_namespace_oid oid;
  v_entries text[] := '{}'::text[];
  v_safe boolean := false;
  v_has_unexpected_grantee boolean := false;
  v_has_grantable boolean := false;
begin
  select oid into v_role_oid from pg_catalog.pg_roles where rolname = p_role_name;
  select oid into v_namespace_oid from pg_catalog.pg_namespace where nspname = p_schema_name;

  if v_role_oid is null or v_namespace_oid is null then
    return jsonb_build_object(
      'role_exists', v_role_oid is not null,
      'schema_exists', v_namespace_oid is not null,
      'safe', false,
      'entries', '[]'::jsonb
    );
  end if;

  with object_types(object_type, object_code) as (
    values ('table'::text, 'r'::"char"), ('sequence'::text, 'S'::"char"), ('function'::text, 'f'::"char")
  ), effective_acls as (
    select
      ot.object_type,
      coalesce(global_acl.defaclacl, pg_catalog.acldefault(ot.object_code, v_role_oid))
        || coalesce(schema_acl.defaclacl, '{}'::aclitem[]) as acl
    from object_types ot
    left join pg_catalog.pg_default_acl global_acl
      on global_acl.defaclrole = v_role_oid
     and global_acl.defaclnamespace = 0
     and global_acl.defaclobjtype = ot.object_code
    left join pg_catalog.pg_default_acl schema_acl
      on schema_acl.defaclrole = v_role_oid
     and schema_acl.defaclnamespace = v_namespace_oid
     and schema_acl.defaclobjtype = ot.object_code
  ), exploded as (
    select distinct
      ea.object_type,
      case when privilege.grantee = 0 then 'PUBLIC' else grantee.rolname end as grantee,
      lower(privilege.privilege_type) as privilege_type,
      privilege.is_grantable
    from effective_acls ea
    cross join lateral pg_catalog.aclexplode(ea.acl) privilege
    left join pg_catalog.pg_roles grantee on grantee.oid = privilege.grantee
  )
  select
    coalesce(
      array_agg(format('%s:%s:%s', object_type, grantee, privilege_type)
                order by object_type, grantee, privilege_type),
      '{}'::text[]
    ),
    coalesce(bool_or(grantee not in (p_role_name, 'service_role')), false),
    coalesce(bool_or(is_grantable), false)
  into v_entries, v_has_unexpected_grantee, v_has_grantable
  from exploded;

  v_safe :=
    not v_has_unexpected_grantee
    and not v_has_grantable
    and not exists (
      select 1 from unnest(v_entries) entry
       where entry like 'table:PUBLIC:%'
          or entry like 'table:anon:%'
          or entry like 'table:authenticated:%'
          or entry like 'sequence:PUBLIC:%'
          or entry like 'sequence:anon:%'
          or entry like 'sequence:authenticated:%'
          or entry = 'function:PUBLIC:execute'
          or entry like 'function:anon:%'
          or entry like 'function:authenticated:%'
    )
    and 'table:service_role:select' = any(v_entries)
    and 'table:service_role:insert' = any(v_entries)
    and 'table:service_role:update' = any(v_entries)
    and 'table:service_role:delete' = any(v_entries)
    and 'sequence:service_role:usage' = any(v_entries)
    and 'sequence:service_role:select' = any(v_entries)
    and 'function:service_role:execute' = any(v_entries)
    and not exists (
      select 1 from unnest(v_entries) entry
       where entry like 'table:service_role:%'
         and entry <> all(array[
           'table:service_role:select', 'table:service_role:insert',
           'table:service_role:update', 'table:service_role:delete'
         ])
    )
    and not exists (
      select 1 from unnest(v_entries) entry
       where entry like 'sequence:service_role:%'
         and entry <> all(array['sequence:service_role:usage', 'sequence:service_role:select'])
    )
    and not exists (
      select 1 from unnest(v_entries) entry
       where entry like 'function:service_role:%'
         and entry <> 'function:service_role:execute'
    );

  return jsonb_build_object(
    'role_exists', true,
    'schema_exists', true,
    'safe', v_safe,
    'entries', to_jsonb(v_entries)
  );
end;
$$;

revoke all on function public.default_privileges_status(text, text)
  from public, anon, authenticated;
grant execute on function public.default_privileges_status(text, text)
  to service_role;

do $$
declare
  v_status jsonb;
begin
  alter default privileges for role postgres
    revoke all privileges on tables from public, anon, authenticated, service_role;
  alter default privileges for role postgres in schema public
    revoke all privileges on tables from public, anon, authenticated, service_role;
  alter default privileges for role postgres
    revoke all privileges on sequences from public, anon, authenticated, service_role;
  alter default privileges for role postgres in schema public
    revoke all privileges on sequences from public, anon, authenticated, service_role;
  alter default privileges for role postgres
    revoke execute on functions from public, anon, authenticated, service_role;
  alter default privileges for role postgres in schema public
    revoke execute on functions from public, anon, authenticated, service_role;
  alter default privileges for role postgres in schema public
    grant select, insert, update, delete on tables to service_role;
  alter default privileges for role postgres in schema public
    grant usage, select on sequences to service_role;
  alter default privileges for role postgres in schema public
    grant execute on functions to service_role;

  v_status := public.default_privileges_status('postgres', 'public');
  if not coalesce((v_status->>'safe')::boolean, false) then
    raise exception using
      errcode = '42501',
      message = 'Unsafe postgres default privileges in schema public; reassertion blocked.',
      detail = v_status::text,
      hint = 'Reapply the postgres default-privilege repair and retry the migration.';
  end if;
end;
$$;
