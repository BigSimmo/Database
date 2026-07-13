-- Reconcile intentionally declared operational indexes that were absent on
-- live. Abort rather than waiting indefinitely for a production write lock.
set lock_timeout = '5s';
set statement_timeout = '10min';

create index if not exists api_rate_limits_bucket_updated_idx
  on public.api_rate_limits (bucket, updated_at desc);
create index if not exists audit_logs_action_created_idx
  on public.audit_logs (action, created_at desc);
create index if not exists audit_logs_owner_created_idx
  on public.audit_logs (owner_id, created_at desc);
create index if not exists document_chunks_anchor_idx
  on public.document_chunks (document_id, anchor_id) where anchor_id is not null;
create index if not exists document_images_hash_idx
  on public.document_images (document_id, image_hash) where image_hash is not null;
create index if not exists document_images_structured_profile_gin_idx
  on public.document_images using gin ((metadata -> 'structured_visual_profile'));
create index if not exists document_images_visual_intelligence_version_idx
  on public.document_images ((metadata ->> 'visual_intelligence_version'))
  where metadata ? 'visual_intelligence_version';
create index if not exists document_index_quality_owner_score_idx
  on public.document_index_quality (owner_id, quality_score, updated_at desc);
create index if not exists document_index_units_heading_path_idx
  on public.document_index_units using gin (heading_path);
create index if not exists document_labels_owner_label_idx
  on public.document_labels (owner_id, label_type, label);
create index if not exists document_summaries_owner_idx
  on public.document_summaries (owner_id, generated_at desc);
create unique index if not exists documents_owner_content_hash_unique_idx
  on public.documents (owner_id, content_hash) where content_hash is not null;
create index if not exists documents_search_idx
  on public.documents using gin (search_tsv);
create index if not exists image_caption_cache_owner_hash_idx
  on public.image_caption_cache (owner_id, image_hash, model);
create index if not exists import_batches_owner_status_idx
  on public.import_batches (owner_id, status, created_at desc);
create index if not exists ingestion_job_stages_job_stage_started_idx
  on public.ingestion_job_stages (job_id, stage_name, started_at desc);
create index if not exists ingestion_jobs_document_idx
  on public.ingestion_jobs (document_id);
create index if not exists rag_aliases_alias_trgm_idx
  on public.rag_aliases using gin (lower(alias) extensions.gin_trgm_ops);
create index if not exists rag_aliases_type_enabled_idx
  on public.rag_aliases (alias_type, enabled);
create index if not exists rag_queries_owner_idx
  on public.rag_queries (owner_id, created_at desc);
create index if not exists rag_queries_source_chunk_ids_gin_idx
  on public.rag_queries using gin (source_chunk_ids);
create index if not exists rag_query_misses_aliases_idx
  on public.rag_query_misses using gin (candidate_aliases);
create index if not exists rag_query_misses_normalized_idx
  on public.rag_query_misses (normalized_query, created_at desc);
create index if not exists rag_query_misses_owner_created_idx
  on public.rag_query_misses (owner_id, created_at desc);
create index if not exists rag_query_misses_owner_review_status_created_idx
  on public.rag_query_misses (owner_id, review_status, created_at desc);
