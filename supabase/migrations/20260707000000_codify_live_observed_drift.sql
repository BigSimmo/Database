-- Codify live-observed drift (2026-07-07 full-inventory drift audit).
--
-- The schema_drift_snapshot() three-way comparison (live vs schema.sql replay
-- vs migration-chain replay; see docs/database-drift-detection.md) found these
-- objects present on the LIVE project but in neither repo lineage — the same
-- raw-SQL-era class as the 20260705230000 reconciliation wave. Every statement
-- below is byte-aligned with live and idempotent: applying to live is a no-op;
-- applying to branch/preview/fresh databases converges them with live.
--
-- Worker/app code writes several of these columns (e.g.
-- document_index_quality.noisy_unit_rate, ingestion_job_stages.error_class),
-- so a branch database without them breaks ingestion.

set search_path = public, extensions, pg_temp;

-- document_images: visual-intelligence-era columns (live-only until now)
alter table public.document_images add column if not exists caption_confidence real;
alter table public.document_images add column if not exists clinical_priority_score real;
alter table public.document_images add column if not exists crop_completeness real;
alter table public.document_images add column if not exists image_quality_score real;
alter table public.document_images add column if not exists ocr_text_density real;
alter table public.document_images add column if not exists structured_extraction_confidence real;
alter table public.document_images add column if not exists visual_duplicate_group text;

-- document_index_quality: OCR/coverage metric columns (live-only until now)
alter table public.document_index_quality add column if not exists anchor_coverage real;
alter table public.document_index_quality add column if not exists model_fallback_rate real;
alter table public.document_index_quality add column if not exists noisy_unit_rate real;
alter table public.document_index_quality add column if not exists retrievable_visual_hit boolean;
alter table public.document_index_quality add column if not exists source_span_coverage real;
alter table public.document_index_quality add column if not exists typed_unit_coverage real;

-- ingestion_job_stages: failure-classification columns (live-only until now)
alter table public.ingestion_job_stages add column if not exists error_class text;
alter table public.ingestion_job_stages add column if not exists retry_count integer not null default 0;

-- content_hash nullability: align both directions with live.
alter table public.document_chunks alter column content_hash drop not null;
update public.document_embedding_fields set content_hash = md5(coalesce(content, '')) where content_hash is null;
alter table public.document_embedding_fields alter column content_hash set not null;

-- indexing_v3_agent_jobs.id default is extensions-qualified on live.
alter table public.indexing_v3_agent_jobs alter column id set default extensions.gen_random_uuid();

-- Autovacuum tuning present on live for the high-churn RAG tables.
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

-- Content-quality CHECK constraints, present on live as NOT VALID.
do $guard$
begin
  if not exists (select 1 from pg_constraint where conname = 'document_chunks_content_not_blank') then
    alter table public.document_chunks
      add constraint document_chunks_content_not_blank check (length(btrim(content)) > 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'document_embedding_fields_content_not_blank') then
    alter table public.document_embedding_fields
      add constraint document_embedding_fields_content_not_blank check (length(btrim(content)) > 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'document_index_units_content_not_blank') then
    alter table public.document_index_units
      add constraint document_index_units_content_not_blank check (length(btrim(content)) > 0) not valid;
  end if;
end
$guard$;

-- Live-only functions and triggers (captured verbatim from live
-- pg_get_functiondef; also declared in supabase/schema.sql).

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

CREATE OR REPLACE FUNCTION public.correct_clinical_query_terms(input_query text, min_sim real DEFAULT 0.45)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  vocab text[];
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

  -- Build the known-term vocabulary once per call.
  select array_agg(distinct term) into vocab
  from (
    select lower(alias) as term from public.rag_aliases where enabled and length(alias) between 4 and 40
    union
    select lower(canonical) from public.rag_aliases where enabled and length(canonical) between 4 and 40
    union
    select w from public.documents d, lateral unnest(regexp_split_to_array(lower(d.title), '[^a-z]+')) as w
    where d.status = 'indexed' and length(w) between 4 and 40
  ) t;

  tokens := regexp_split_to_array(lower(input_query), '\s+');
  foreach tok in array tokens loop
    if length(tok) < 4 or tok = any(vocab) then
      corrected := corrected || tok;
      continue;
    end if;
    best := null;
    best_sim := 0;
    select v, similarity(v, tok) into best, best_sim
    from unnest(vocab) as v
    order by similarity(v, tok) desc
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

-- ACL tightening already true on live: service-role-only execute.
revoke execute on function public.match_document_index_units_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid) from public, anon, authenticated;
revoke execute on function public.reset_document_index(uuid) from public, anon, authenticated;
grant execute on function public.reset_document_index(uuid) to service_role;
