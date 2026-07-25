-- REVOKE ALL on core tables from public/anon/authenticated
revoke all privileges on table
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
from public, anon, authenticated;

-- REVOKE EXECUTE on 5 internal maintenance RPCs
revoke execute on function public.correct_clinical_query_terms(text, real) from public, anon, authenticated;
revoke execute on function public.purge_expired_rag_response_cache(integer) from public, anon, authenticated;
revoke execute on function public.update_indexing_v3_agent_job_status(uuid, text, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.request_indexing_v3_enrichment(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.cleanup_abandoned_document_index_generations(uuid, integer, boolean) from public, anon, authenticated;
revoke execute on function public.detect_legacy_ivfflat_indexes() from public, anon, authenticated;
revoke execute on function public.document_summary_text(uuid) from public, anon, authenticated;
revoke execute on function public.search_document_chunks(uuid, text, integer, uuid) from public, anon, authenticated;
revoke execute on function public.set_document_embedding_field_content_hash() from public, anon, authenticated;

