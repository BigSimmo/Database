import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8").replace(/\s+/g, " ");
const documentIndexUnitsMigration = readFileSync(
  new URL("../supabase/migrations/20260612006000_document_index_units.sql", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");
const bulkIngestionMigration = readFileSync(
  new URL("../supabase/migrations/20260527000000_bulk_ingestion.sql", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");
const lexicalScoreMigration = readFileSync(
  new URL("../supabase/migrations/20260617000000_text_search_lexical_score.sql", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");
const perDocTokenSearchMigration = readFileSync(
  new URL("../supabase/migrations/20260617001000_per_document_token_search.sql", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");
const strictGateRepairMigration = readFileSync(
  new URL("../supabase/migrations/20260625033425_strict_enrichment_gate_repair.sql", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");
const indexingV3AgentWorkerHardeningMigration = readFileSync(
  new URL("../supabase/migrations/20260625000000_indexing_v3_agent_worker_hardening.sql", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");
const atomicStrictCompletionMigration = readFileSync(
  new URL("../supabase/migrations/20260625033944_atomic_strict_enrichment_completion.sql", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");
const dropDuplicateStageIndexMigration = readFileSync(
  new URL("../supabase/migrations/20260626000000_drop_duplicate_ingestion_job_stage_index.sql", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");
const phase7RetrievalPerformanceMigration = readFileSync(
  new URL("../supabase/migrations/20260626020000_phase7_retrieval_rpc_performance.sql", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");
const atomicReindexMigration = readFileSync(
  new URL("../supabase/migrations/20260628000000_atomic_reindex_generation_commit.sql", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");
const abandonedReindexRecoveryMigration = readFileSync(
  new URL("../supabase/migrations/20260629000000_abandoned_reindex_generation_recovery.sql", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");
const auditLogsServiceRolePolicyMigration = readFileSync(
  new URL("../supabase/migrations/20260630090000_audit_logs_service_role_policy.sql", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");
const migrationDirectoryUrl = new URL("../supabase/migrations/", import.meta.url);

function parseMigrationStem(fileName: string) {
  const stem = fileName.match(/^\d+_(.+)\.sql$/)?.[1];
  return stem ?? null;
}
const preserveLegacyArtifactCommitMigration = readFileSync(
  new URL("../supabase/migrations/20260702000000_commit_generation_preserve_legacy_artifacts.sql", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");
const promoteIndexGenerationIdMigration = readFileSync(
  new URL("../supabase/migrations/20260702180000_promote_index_generation_id_columns.sql", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");
const indexingV3AgentJobsMigration = readFileSync(
  new URL("../supabase/migrations/20260702190000_indexing_v3_agent_jobs_table.sql", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");
const clinicalRegistryRecordsMigration = readFileSync(
  new URL("../supabase/migrations/20260703020000_clinical_registry_records.sql", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");
const medicationRecordsMigration = readFileSync(
  new URL("../supabase/migrations/20260705010000_medication_records.sql", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");
const registryCatalogPayloadMigration = readFileSync(
  new URL("../supabase/migrations/20260705030000_registry_catalog_payload.sql", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");

function extractTextChunkFunction(sql: string) {
  const start = sql.indexOf("function public.match_document_chunks_text");
  const end = sql.indexOf("$$;", start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end);
}

function extractIndexUnitHybridFunction(sql: string) {
  const start = sql.indexOf("create or replace function public.match_document_index_units_hybrid");
  const end = sql.indexOf("$$;", start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end);
}

describe("Supabase schema Data API grants", () => {
  it("explicitly grants service-role access for upload and ingestion tables", () => {
    expect(schema).toContain("public.import_batches,");
    expect(schema).toContain("public.document_labels,");
    expect(schema).toContain("public.document_summaries,");
    expect(schema).toContain("public.storage_cleanup_jobs");
    expect(schema).toMatch(
      /grant select, insert, update, delete on table .*public\.documents, .*public\.document_pages, .*public\.document_images, .*public\.image_caption_cache, .*public\.document_labels, .*public\.document_summaries, .*public\.document_sections, .*public\.document_memory_cards, .*public\.document_chunks, .*public\.ingestion_jobs, .*public\.rag_queries, .*public\.storage_cleanup_jobs.* to service_role;/,
    );
    expect(schema).toContain("grant execute on all functions in schema public to service_role;");
  });

  it("keeps browser Data API grants read-only except manual labels", () => {
    expect(schema).toContain("revoke all privileges on all tables in schema public from anon, authenticated;");
    expect(schema).toContain("revoke execute on all functions in schema public from public, anon, authenticated;");
    expect(schema).toMatch(
      /grant select on table .*public\.documents, .*public\.document_pages, .*public\.document_images, .*public\.document_labels, .*public\.document_summaries, .*public\.document_chunks, .*public\.ingestion_jobs, .*public\.rag_queries, .*public\.storage_cleanup_jobs.* to authenticated;/,
    );
    expect(schema).not.toContain("grant select, insert, update, delete on table public.documents to authenticated;");
    expect(schema).not.toContain("grant select, insert on table public.rag_queries to authenticated;");
    const authenticatedSelectGrant = schema.match(/grant select on table ([^;]+) to authenticated;/)?.[1] ?? "";
    expect(authenticatedSelectGrant).not.toContain("public.document_sections");
    expect(authenticatedSelectGrant).not.toContain("public.document_memory_cards");
    expect(schema).not.toMatch(/grant [^;]* on table [^;]*public\.document_sections[^;]* to authenticated;/);
    expect(schema).not.toMatch(/grant [^;]* on table [^;]*public\.document_memory_cards[^;]* to authenticated;/);
    expect(schema).not.toMatch(/grant [^;]* on table [^;]* to anon;/);
  });

  it("enables RLS where baseline owner policies are created", () => {
    for (const tableName of [
      "import_batches",
      "documents",
      "document_pages",
      "document_images",
      "document_chunks",
      "ingestion_jobs",
      "rag_queries",
    ]) {
      expect(bulkIngestionMigration).toContain(`alter table public.${tableName} enable row level security`);
      expect(schema).toContain(`alter table public.${tableName} enable row level security`);
    }
  });

  it("supports bulk import queue claiming and reindex resets", () => {
    expect(schema).toContain("create table if not exists public.import_batches");
    expect(schema).toContain("content_hash text");
    expect(schema).toContain(
      "create unique index if not exists documents_owner_content_hash_unique_idx on public.documents(owner_id, content_hash) where content_hash is not null;",
    );
    expect(schema).toContain("create or replace function public.claim_ingestion_jobs");
    expect(schema).toContain("row_number() over (partition by j.document_id order by j.created_at asc, j.id asc)");
    expect(schema).toContain("where active.document_id = j.document_id");
    expect(schema).toContain("and active.status = 'processing'");
    expect(schema).toContain("for update of j, d skip locked");
    expect(schema).toContain("when j.status = 'processing' then 'reclaimed stale job'");
    expect(schema).toContain("create or replace function public.reset_document_index");
    expect(schema).toContain("create or replace function public.refresh_import_batch_status");
    expect(schema).toContain("create or replace function public.complete_ingestion_job");
    expect(schema).toContain("create or replace function public.fail_or_retry_ingestion_job");
    expect(schema).toContain("count(*) filter (where status = 'pending')");
    expect(schema).toContain("failed_files = failed_count");
    expect(schema).toContain("perform public.refresh_import_batch_status(p_batch_id);");
    expect(schema).toContain("delete from public.document_memory_cards where document_id = p_document_id;");
    expect(schema).toContain("delete from public.document_sections where document_id = p_document_id;");
  });

  it("keeps replacement reindex generations invisible until commit", () => {
    for (const sql of [schema, atomicReindexMigration]) {
      expect(sql).toContain("create or replace function public.commit_document_index_generation");
      expect(sql).toContain("document_chunks_document_generation_chunk_idx");
      expect(sql).toContain("create or replace function public.is_committed_document_generation");
      expect(sql).toContain("create or replace function public.is_committed_artifact_generation");
      expect(sql).toContain("p_pages jsonb default null");
      expect(sql).toContain("p_quality jsonb default null");
      expect(sql).toContain("insert into public.document_pages");
      expect(sql).toContain("insert into public.document_index_quality");
    }
    expect(schema).toContain("public.is_committed_document_generation(c.index_generation_id, d.metadata)");
    expect(schema).toContain("public.is_committed_artifact_generation(m.metadata, d.metadata)");
    expect(schema).toContain("public.is_committed_artifact_generation(f.metadata, d.metadata)");
    expect(schema).toContain("public.is_committed_artifact_generation(u.metadata, d.metadata)");
    for (const sql of [schema, atomicReindexMigration]) {
      expect(sql).toContain(
        "revoke execute on function public.commit_document_index_generation(uuid, uuid, text, integer, integer, integer, jsonb, jsonb, jsonb) from public, anon, authenticated",
      );
      expect(sql).toContain(
        "revoke execute on function public.is_committed_document_generation(uuid, jsonb) from public, anon, authenticated",
      );
      expect(sql).toContain(
        "revoke execute on function public.is_committed_artifact_generation(jsonb, jsonb) from public, anon, authenticated",
      );
    }
    expect(schema).toContain(
      "grant execute on function public.commit_document_index_generation(uuid, uuid, text, integer, integer, integer, jsonb, jsonb, jsonb) to service_role",
    );
    expect(atomicReindexMigration).toContain("atomic reindex patch did not match match_document_chunks_hybrid");
    expect(atomicReindexMigration).toContain("atomic reindex patch did not match match_document_index_units_hybrid");
  });

  it("preserves NULL-generation artifacts until replacements exist", () => {
    for (const sql of [preserveLegacyArtifactCommitMigration]) {
      expect(sql).toContain(
        "index_generation_id is null and exists ( select 1 from public.document_chunks replacement",
      );
      expect(sql).toContain(
        "nullif(metadata->>'index_generation_id', '') is null and exists ( select 1 from public.document_images replacement",
      );
      expect(sql).toContain("from public.document_chunks replacement");
      expect(sql).toContain("from public.document_images replacement");
      expect(sql).toContain("from public.document_table_facts replacement");
      expect(sql).toContain("from public.document_embedding_fields replacement");
      expect(sql).toContain("from public.document_index_units replacement");
      expect(sql).toContain("from public.document_memory_cards replacement");
      expect(sql).toContain("from public.document_sections replacement");
    }

    for (const sql of [schema, promoteIndexGenerationIdMigration]) {
      expect(sql).toContain(
        "index_generation_id is null and exists ( select 1 from public.document_chunks replacement",
      );
      expect(sql).toContain("(metadata->>'index_generation_id')::uuid is distinct from p_index_generation_id");
      expect(sql).toContain("replacement.index_generation_id = p_index_generation_id");
      expect(sql).toContain(
        "replacement.index_generation_id is null and (replacement.metadata->>'index_generation_id')::uuid = p_index_generation_id",
      );
      expect(sql).toContain("from public.document_chunks replacement");
      expect(sql).toContain("from public.document_images replacement");
      expect(sql).toContain("from public.document_table_facts replacement");
      expect(sql).toContain("from public.document_embedding_fields replacement");
      expect(sql).toContain("from public.document_index_units replacement");
      expect(sql).toContain("from public.document_memory_cards replacement");
      expect(sql).toContain("from public.document_sections replacement");
    }
  });

  it("can identify and clean abandoned staged reindex generations", () => {
    for (const sql of [schema, abandonedReindexRecoveryMigration]) {
      expect(sql).toContain("create or replace function public.cleanup_abandoned_document_index_generations");
      expect(sql).toContain("p_dry_run boolean default true");
      expect(sql).toContain("j.status in ('pending', 'processing')");
      expect(sql).toContain("c.index_generation_id is not null");
      expect(sql).toContain("metadata, '{}'::jsonb)->>'index_generation_id'");
      expect(sql).toContain("if not coalesce(p_dry_run, true) then");
      expect(sql).toContain("'document_chunks', chunk_count");
      expect(sql).toContain("'document_index_units', index_unit_count");
      expect(sql).toContain(
        "revoke execute on function public.cleanup_abandoned_document_index_generations(uuid, integer, boolean) from public, anon, authenticated",
      );
      expect(sql).toContain(
        "grant execute on function public.cleanup_abandoned_document_index_generations(uuid, integer, boolean) to service_role",
      );
    }
  });

  it("keeps indexing-v3 enrichment claiming separate from raw ingestion jobs", () => {
    expect(schema).toContain("create table if not exists public.ingestion_job_stages");
    expect(schema).toContain("job_id uuid not null references public.ingestion_jobs(id) on delete cascade");
    expect(indexingV3AgentWorkerHardeningMigration).toContain(
      "drop constraint if exists ingestion_job_stages_job_id_fkey",
    );
    expect(indexingV3AgentWorkerHardeningMigration).toContain(
      "add constraint ingestion_job_stages_job_id_fkey foreign key (job_id) references public.ingestion_jobs(id) on delete cascade",
    );
    expect(schema).toContain("drop index if exists public.ingestion_job_stages_doc_idx");
    expect(schema).toContain("create index if not exists ingestion_job_stages_document_started_idx");
    for (const sql of [schema, indexingV3AgentJobsMigration]) {
      expect(sql).toContain("create table if not exists public.indexing_v3_agent_jobs");
      expect(sql).toContain("document_id uuid not null references public.documents(id) on delete cascade");
      expect(sql).toContain("create index if not exists indexing_v3_agent_jobs_claim_idx");
      expect(sql).toContain("create or replace function public.claim_indexing_v3_agent_jobs");
      expect(sql).toContain("from public.indexing_v3_agent_jobs j");
      expect(sql).toContain("j.enrichment_status in ('pending', 'failed', 'processing')");
      expect(sql).toContain("update public.indexing_v3_agent_jobs j");
      expect(sql).toContain("'indexing_v3_agent_locked_by', p_worker_id");
      expect(sql).toContain("'indexing_v3_agent_attempt_count', cj.attempt_count");
      expect(sql).toContain("create or replace function public.update_indexing_v3_agent_job_status");
      expect(sql).toContain(
        "grant execute on function public.update_indexing_v3_agent_job_status(uuid, text, text, timestamptz) to service_role",
      );
    }
    expect(schema).toContain(
      "grant execute on function public.claim_indexing_v3_agent_jobs(text, integer, integer) to service_role",
    );
    expect(schema).toContain("alter table public.ingestion_job_stages enable row level security");
    expect(schema).toContain('create policy "ingestion job stages service role all" on public.ingestion_job_stages');
    expect(schema).toContain("alter table public.indexing_v3_agent_jobs enable row level security");
    expect(schema).toContain(
      'create policy "indexing v3 agent jobs service role all" on public.indexing_v3_agent_jobs',
    );
    const authenticatedSelectGrant = schema.match(/grant select on table ([^;]+) to authenticated;/)?.[1] ?? "";
    expect(authenticatedSelectGrant).not.toContain("public.ingestion_job_stages");
    expect(authenticatedSelectGrant).not.toContain("public.indexing_v3_agent_jobs");
  });

  it("keeps the cron indexing-v3 invoker in the schema snapshot with service-role-only execute grants", () => {
    expect(schema).toContain("create or replace function public.invoke_indexing_v3_agent");
    expect(schema).toContain("returns bigint");
    expect(schema).toContain("security definer");
    expect(schema).toContain("set search_path = public, extensions, vault, pg_temp");
    expect(schema).toContain("from vault.decrypted_secrets");
    expect(schema).toContain("where name = 'indexing_v3_agent_secret'");
    // The GUC default is set through a privilege-guarded DO block so schema
    // replay succeeds on hosted Supabase (ALTER DATABASE SET is denied there).
    expect(schema).toContain("alter database %I set app.indexing_v3_agent_base_url = %L");
    expect(schema).toContain("when insufficient_privilege then");
    expect(schema).toContain("nullif(current_setting('app.indexing_v3_agent_base_url', true), '')");
    expect(schema).toContain("select net.http_post(");
    expect(schema).toContain("v_base_url || '/functions/v1/indexing-v3-agent?limit='");
    expect(schema).toContain("'https://sjrfecxgysukkwxsowpy.supabase.co'");
    expect(schema).toContain("/functions/v1/indexing-v3-agent?limit=");
    expect(schema).toContain(
      "revoke execute on function public.invoke_indexing_v3_agent(integer) from public, anon, authenticated",
    );
    expect(schema).toContain("grant execute on function public.invoke_indexing_v3_agent(integer) to service_role");
  });

  it("drops the stale duplicate ingestion_job_stages document index", () => {
    for (const sql of [schema, dropDuplicateStageIndexMigration]) {
      expect(sql).toContain("drop index if exists public.ingestion_job_stages_doc_idx");
    }
    expect(schema).toContain("create index if not exists ingestion_job_stages_document_started_idx");
    expect(schema).not.toContain("create index if not exists ingestion_job_stages_doc_idx");
  });

  it("centralizes the indexing-v3 strict completion gate and repair RPC", () => {
    for (const sql of [schema, strictGateRepairMigration]) {
      expect(sql).toContain("create or replace view public.document_strict_gate_status");
      expect(sql).toContain("with (security_invoker = true)");
      expect(sql).toContain("create or replace function public.repair_strict_enrichment_gate_batch");
      expect(sql).toContain("security invoker");
      expect(sql).toContain("case when sections > 0 then null else 'sections' end");
      expect(sql).toContain("case when memory_cards > 0 then null else 'memory_cards' end");
      expect(sql).toContain("case when generated_labels > 0 then null else 'generated_labels' end");
      expect(sql).toContain("case when index_units > 0 then null else 'index_units' end");
      expect(sql).toContain("case when title_embedding then null else 'title_embedding' end");
      expect(sql).toContain("case when summary_embedding then null else 'summary_embedding' end");
      expect(sql).toContain("or l.metadata->>'generated_by' = 'indexing-v3-agent'");
      expect(sql).toContain(
        "lower(coalesce(l.metadata->>'generation_source', '')) = 'indexing_v3_agent_parsed_artifacts'",
      );
      expect(sql).toContain("'indexing_v3_agent_status', 'completed'");
      expect(sql).toContain("'indexing_v3_agent_status', 'deferred'");
      expect(sql).toContain("coalesce(d.metadata->>'indexing_v3_agent_status', '') = 'processing'");
      expect(sql).toContain("then (d.metadata->>'indexing_v3_agent_locked_at')::timestamptz");
      expect(sql).toContain("'enrichment_status', 'processing'");
      expect(sql).toContain("stage = 'strict_gate_deferred'");
      expect(sql).toContain("'strict_gate_repair'");
      expect(sql).toContain("extraction_quality = 'good'");
      expect(sql).toContain("revoke all on table public.document_strict_gate_status from public, anon, authenticated");
      expect(sql).toContain("grant select on table public.document_strict_gate_status to service_role");
      expect(sql).toContain(
        "revoke execute on function public.repair_strict_enrichment_gate_batch(integer) from public, anon, authenticated",
      );
      expect(sql).toContain(
        "grant execute on function public.repair_strict_enrichment_gate_batch(integer) to service_role",
      );
    }
  });

  it("atomically completes strict enrichment only after the canonical gate passes", () => {
    for (const sql of [schema, atomicStrictCompletionMigration]) {
      expect(sql).toContain("create or replace function public.complete_strict_enrichment_job");
      expect(sql).toContain("security invoker");
      expect(sql).toContain("from public.document_strict_gate_status g");
      expect(sql).toContain("if not found then");
      expect(sql).toContain("if not gate_row.gate_passed then");
      expect(sql).toContain("'blocked_missing_artifacts'");
      expect(sql).toContain("'indexing_v3_agent_status', 'completed'");
      expect(sql).toContain("'enrichment_status', 'completed'");
      expect(sql).toContain("'source', 'complete_strict_enrichment_job'");
      expect(sql).toContain("extraction_quality = 'good'");
      expect(sql).toContain("on conflict on constraint document_index_quality_pkey");
      expect(sql).toContain("'{}'::uuid[]");
      expect(sql).not.toContain("perform public.refresh_import_batch_status(batch_ref)");
      expect(sql).toContain(
        "revoke execute on function public.complete_strict_enrichment_job(uuid, uuid, text, text, text) from public, anon, authenticated",
      );
      expect(sql).toContain(
        "grant execute on function public.complete_strict_enrichment_job(uuid, uuid, text, text, text) to service_role",
      );
    }
  });

  it("supports service-role-only durable API rate limiting", () => {
    expect(schema).toContain("create table if not exists public.api_rate_limits");
    expect(schema).toContain("create table if not exists public.api_rate_limit_subjects");
    expect(schema).toContain("primary key (owner_id, bucket)");
    expect(schema).toContain("primary key (subject_key, bucket)");
    expect(schema).toContain("create or replace function public.consume_api_rate_limit");
    expect(schema).toContain("create or replace function public.consume_api_subject_rate_limit");
    expect(schema).toContain("returns table ( limited boolean, limit_value integer, remaining integer");
    expect(schema).toContain("grant select, insert, update, delete on table");
    expect(schema).toContain("public.api_rate_limits,");
    expect(schema).toContain("public.api_rate_limit_subjects,");
    expect(schema).toContain("alter table public.api_rate_limits enable row level security");
    expect(schema).toContain("alter table public.api_rate_limit_subjects enable row level security");
    expect(schema).toContain('create policy "api rate limits service role all"');
    expect(schema).toContain('create policy "api rate limit subjects service role all"');
    expect(schema).not.toMatch(/grant [^;]*public\.api_rate_limits[^;]* to authenticated;/);
  });

  it("keeps audit logs service-role-only with an explicit RLS policy", () => {
    for (const sql of [schema, auditLogsServiceRolePolicyMigration]) {
      expect(sql).toContain("alter table public.audit_logs enable row level security");
      expect(sql).toContain("revoke all on public.audit_logs from anon, authenticated");
      expect(sql).toContain("grant select, insert, update, delete on table public.audit_logs to service_role");
      expect(sql).toContain('create policy "audit logs service role all" on public.audit_logs');
      expect(sql).toContain("for all to service_role");
    }
    expect(schema).not.toMatch(/grant [^;]*public\.audit_logs[^;]* to authenticated;/);
    expect(schema).not.toMatch(/grant [^;]*public\.audit_logs[^;]* to anon;/);
  });

  it("does not introduce new duplicate migration stems", () => {
    const duplicateStemAllowlist = new Map<string, number>([
      ["api_rate_limits", 2],
      ["audit_logs", 2],
      ["audit_logs_service_role_policy", 2],
      ["indexing_reliability_recovery", 2],
      ["rag_queries_retention", 2],
    ]);
    const stemCounts = new Map<string, number>();

    for (const fileName of readdirSync(migrationDirectoryUrl)) {
      const stem = parseMigrationStem(fileName);
      if (!stem) continue;
      stemCounts.set(stem, (stemCounts.get(stem) ?? 0) + 1);
    }

    const duplicateStems = new Map([...stemCounts.entries()].filter(([, count]) => count > 1));
    expect(duplicateStems).toEqual(duplicateStemAllowlist);
  });

  it("stores deep structured memory privately for source-backed answers", () => {
    expect(schema).toContain("create table if not exists public.document_sections");
    expect(schema).toContain("create table if not exists public.document_memory_cards");
    expect(schema).toContain("card_type text not null");
    expect(schema).toContain("source_chunk_ids uuid[] not null default '{}'");
    expect(schema).toContain("create index if not exists document_memory_cards_search_idx");
    expect(schema).toContain("create index if not exists document_memory_cards_embedding_hnsw_idx");
    expect(schema).toContain("create or replace function public.stamp_document_deep_memory_version");
    expect(schema).toContain("alter table public.document_sections enable row level security");
    expect(schema).toContain("alter table public.document_memory_cards enable row level security");
    expect(schema).toContain(
      "create index if not exists document_sections_owner_idx on public.document_sections(owner_id)",
    );
    expect(schema).toContain(
      "create index if not exists document_memory_cards_owner_idx on public.document_memory_cards(owner_id)",
    );
    expect(schema).toContain(
      "create index if not exists document_memory_cards_section_idx on public.document_memory_cards(section_id)",
    );
    expect(schema).toContain('create policy "document sections owner all" on public.document_sections');
    expect(schema).toContain('create policy "document memory cards owner all" on public.document_memory_cards');
    expect(schema).toContain('create policy "image caption cache owner all" on public.image_caption_cache');
  });

  it("tracks retryable storage cleanup and query-log purge performance", () => {
    expect(schema).toContain("create table if not exists public.storage_cleanup_jobs");
    expect(schema).toContain("create index if not exists storage_cleanup_jobs_owner_status_idx");
    expect(schema).toContain("create index if not exists rag_queries_source_chunk_ids_gin_idx");
    expect(schema).toContain('create policy "storage cleanup owner read"');
  });

  it("supports reviewing and promoting weak search misses", () => {
    expect(schema).toContain("review_status text not null default 'new'");
    expect(schema).toContain("check (review_status in ('new', 'fixed', 'not_in_corpus', 'ambiguous', 'ignored'))");
    expect(schema).toContain("expected_document_id uuid references public.documents(id) on delete set null");
    expect(schema).toContain("expected_chunk_id uuid references public.document_chunks(id) on delete set null");
    expect(schema).toContain("review_notes text");
    expect(schema).toContain("reviewed_at timestamptz");
    expect(schema).toContain("promoted_eval_case boolean not null default false");
    expect(schema).toContain("create index if not exists rag_query_misses_owner_review_status_created_idx");
  });

  it("supports owner-scoped table-backed RAG aliases", () => {
    expect(schema).toContain("create table if not exists public.rag_aliases");
    expect(schema).toContain("alias text not null");
    expect(schema).toContain("canonical text not null");
    expect(schema).toContain(
      "check (alias_type in ('medication', 'document_title', 'acronym', 'service', 'workflow', 'typo', 'clinical_term', 'custom'))",
    );
    expect(schema).toContain("weight real not null default 1.0");
    expect(schema).toContain("enabled boolean not null default true");
    expect(schema).toContain("create index if not exists rag_aliases_owner_enabled_idx");
    expect(schema).toContain("create index if not exists rag_aliases_type_enabled_idx");
    expect(schema).toContain("create index if not exists rag_aliases_alias_trgm_idx");
    expect(schema).toContain("grant select, insert, update, delete on table");
    expect(schema).toContain("public.rag_aliases,");
    expect(schema).toContain("alter table public.rag_aliases enable row level security");
    expect(schema).toContain('create policy "rag aliases owner read" on public.rag_aliases');
    expect(schema).toContain("owner_id is null or owner_id = (select auth.uid())");
    expect(schema).toContain("create trigger rag_aliases_updated_at");
  });

  it("returns table fact metadata for rich table source packing", () => {
    const functionBody = schema.slice(
      schema.indexOf("create or replace function public.match_document_table_facts_text"),
      schema.indexOf("create or replace function public.match_document_embedding_fields_hybrid"),
    );

    expect(functionBody).toContain("metadata jsonb");
    expect(functionBody).toContain("f.metadata");
  });

  it("filters hybrid retrieval by owner inside Postgres", () => {
    expect(schema).toContain("owner_filter uuid default null");
    expect(schema).toContain("and (owner_filter is null or d.owner_id = owner_filter)");
    expect(schema).toContain("create or replace function public.match_document_chunks_text");
    expect(schema).toContain("create or replace function public.match_document_chunks_hybrid");
    expect(schema).toContain("rrf_score double precision");
    expect(schema).toContain("create or replace function public.match_document_memory_cards_hybrid");
    expect(schema).toContain("create or replace function public.match_documents_for_query");
    expect(schema).toContain("c.search_tsv @@ query.tsq");
    expect(schema).toContain(
      "create index if not exists documents_search_idx on public.documents using gin(search_tsv)",
    );
    expect(schema).toContain("ts_rank_cd(d.title_search_tsv, query.tsq) * 3.0");
    expect(schema).toContain("hybrid_candidates as");
    expect(schema).toContain("vector_candidates as");
    expect(schema).toContain("text_candidates as");
    expect(schema).toContain("rrf_candidates as");
    expect(schema).toContain("candidate_ids as");
    const hybridFunction = schema.slice(
      schema.indexOf("create or replace function public.match_document_chunks_hybrid"),
      schema.indexOf("create or replace function public.match_document_memory_cards_hybrid"),
    );
    expect(hybridFunction).not.toContain("document_label_metadata");
    expect(hybridFunction).not.toContain("document_summary_text");
  });

  it("covers advisor-reported foreign key indexes for search support tables", () => {
    expect(schema).not.toContain("create index if not exists document_chunks_section_path_gin_idx");
    expect(schema).toContain(
      "create index if not exists document_embedding_fields_owner_id_idx on public.document_embedding_fields(owner_id)",
    );
    expect(schema).not.toContain("create index if not exists document_table_facts_owner_idx");
    expect(schema).toContain(
      "create index if not exists document_table_facts_source_image_idx on public.document_table_facts(source_image_id) where source_image_id is not null",
    );
    expect(schema).toContain("autovacuum_vacuum_scale_factor = 0.05");
    expect(schema).toContain("autovacuum_analyze_scale_factor = 0.02");
    expect(schema).toContain("create index if not exists documents_indexed_owner_title_idx");
    expect(schema).toContain("create index if not exists document_table_facts_owner_document_page_idx");
    expect(schema).toContain("create index if not exists document_embedding_fields_owner_chunk_idx");
    expect(schema).toContain("create index if not exists document_index_units_owner_chunk_type_idx");
    expect(schema).toContain("autovacuum_vacuum_scale_factor = 0.05");
    expect(schema).toContain("autovacuum_analyze_scale_factor = 0.02");
  });

  it("keeps phase 7 retrieval RPCs bounded, profileable, and service-role scoped", () => {
    for (const sql of [schema, phase7RetrievalPerformanceMigration]) {
      expect(sql).toContain("create or replace function public.match_document_lookup_chunks_text");
      expect(sql).toContain("c.document_id = any(document_filters)");
      expect(sql).toContain("c.search_tsv @@ query.tsq or d.title_search_tsv @@ query.tsq");
      expect(sql).toContain("limit least(greatest(match_count, 1), 80)");
      expect(sql).toContain("limit least(greatest(match_count * 2, 24), 96)");
      expect(sql).toContain("create or replace function public.explain_retrieval_rpc");
      expect(sql).toContain("explain (%s) select * from public.match_document_chunks_text($1, $2, $3, $4)");
      expect(sql).toContain("revoke execute on function public.explain_retrieval_rpc");
      expect(sql).toContain("grant execute on function public.explain_retrieval_rpc");
    }
    // The phase-7 migration captured the original hybrid candidate bounds and unit/field-level
    // owner filters. The live perf fixes (codified in 20260701140631_codify_live_retrieval_rpcs)
    // widened the candidate limits and moved the owner filter to document level; schema.sql now
    // mirrors that live shape, so these old forms live only in the historical migration.
    expect(phase7RetrievalPerformanceMigration).toContain("limit least(greatest(match_count * 2, 48), 128)");
    expect(phase7RetrievalPerformanceMigration).toContain("limit least(greatest(match_count * 2, 32), 96)");
    expect(phase7RetrievalPerformanceMigration).toContain("and (owner_filter is null or f.owner_id = owner_filter)");
    expect(phase7RetrievalPerformanceMigration).toContain("and (owner_filter is null or u.owner_id = owner_filter)");
    expect(phase7RetrievalPerformanceMigration).toContain(
      "drop function if exists public.match_document_chunks_text(text, integer, uuid[], uuid)",
    );
    expect(schema).toContain("limit greatest(match_count * 6, 48)"); // chunks hybrid
    expect(schema).toContain("limit greatest(match_count * 3, 48)"); // index units hybrid
    expect(schema).toContain("limit greatest(match_count * 3, 32)"); // embedding fields hybrid
    expect(schema).toContain("limit greatest(match_count * 6, 96)"); // memory cards hybrid v2
    expect(schema).toContain("match_document_lookup_chunks_text.signature");
    expect(schema).toContain("explain_retrieval_rpc.signature");
  });

  it("allows richer clinical embedding field types", () => {
    expect(schema).toContain("'chunk_high_yield'");
    expect(schema).toContain("'table_row'");
    expect(schema).toContain("'image_caption'");
    expect(schema).toContain("'clinical_action'");
    expect(schema).toContain("'threshold_fact'");
  });

  it("supports unified multi-level document index units", () => {
    expect(schema).toContain("create table if not exists public.document_index_units");
    expect(schema).toContain("'document_profile'");
    expect(schema).toContain("'askable_question'");
    expect(schema).toContain("'threshold'");
    expect(schema).toContain("'workflow_step'");
    expect(schema).toContain("'medication_monitoring'");
    expect(schema).toContain("'alias'");
    expect(schema).toContain("'vocabulary_term'");
    expect(schema).toContain("source_span jsonb");
    // The index_units HNSW index was dropped live (0 lifetime scans; the hybrid RPC is
    // text-candidate-gated) via the drop_legacy_vector_indexes migration; schema.sql
    // intentionally no longer creates it.
    expect(schema).not.toContain("create index if not exists document_index_units_embedding_hnsw_idx");
    expect(schema).toContain("create or replace function public.match_document_index_units_hybrid");
    expect(schema).toContain("delete from public.document_index_units where document_id = p_document_id;");
    expect(schema).toContain('create policy "document index units owner read"');
  });

  it("keeps index-unit hybrid retrieval on the live timeout-safe SQL shape", () => {
    for (const sql of [schema, documentIndexUnitsMigration]) {
      const functionBody = extractIndexUnitHybridFunction(sql);

      expect(functionBody).toContain("and (u.search_tsv @@ query.tsq or u.normalized_terms && query.terms)");
      expect(functionBody).toContain("order by hybrid_score desc, similarity desc, text_rank desc");
      expect(functionBody).not.toContain("1 - (u.embedding <=> query_embedding) >= min_similarity or");
      expect(functionBody).not.toContain("vector_ranked as");

      const rankedCte = functionBody.slice(0, functionBody.indexOf("from ranked"));
      expect(rankedCte).not.toContain("order by hybrid_score");
    }
    // schema.sql mirrors the live-codified ranked ordering (single sort key, wider candidate
    // bound); the original migration kept the similarity tie-breaker and tighter bound.
    expect(extractIndexUnitHybridFunction(schema)).toContain(
      "order by text_rank desc limit greatest(match_count * 3, 48)",
    );
    expect(extractIndexUnitHybridFunction(documentIndexUnitsMigration)).toContain(
      "order by text_rank desc, similarity desc",
    );
  });

  it("stores smart image metadata, document labels, and high-yield summaries", () => {
    expect(schema).toContain("image_type text not null default 'unclear'");
    expect(schema).toContain("searchable boolean not null default true");
    expect(schema).toContain("clinical_relevance_score real not null default 0");
    expect(schema).toContain("create table if not exists public.document_labels");
    expect(schema).toContain("create table if not exists public.document_summaries");
    expect(schema).toContain('create policy "labels owner manual insert"');
    expect(schema).toContain('create policy "summaries owner read"');
    expect(schema).toContain("create or replace function public.chunk_image_metadata");
    expect(schema).toContain("and i.searchable = true");
    expect(schema).toContain("and i.image_type <> 'logo_decorative'");
    expect(schema).toContain("'clinical_relevance_score', i.clinical_relevance_score");
    expect(schema).toContain("'sourceKind', i.source_kind");
    expect(schema).toContain("'tableLabel', nullif(i.metadata->>'table_label', '')");
    expect(schema).toContain("'tableTitle', nullif(i.metadata->>'table_title', '')");
    expect(schema).toContain("'tableRole', nullif(i.metadata->>'table_role', '')");
    expect(schema).toContain(
      "'tableTextSnippet', nullif(left(coalesce(i.metadata->>'table_text_snippet', i.metadata->>'table_text', ''), 500), '')",
    );
    expect(schema).toContain("create or replace function public.get_related_document_metadata");
  });

  it("does not fabricate a cosine similarity for text-only retrieval (RET-C2)", () => {
    for (const sql of [schema, lexicalScoreMigration]) {
      const body = extractTextChunkFunction(sql);
      // Old fabricated ceilings must be gone.
      expect(body).not.toContain("0.56 + (least(ranked.text_rank, 1) * 0.39)");
      expect(body).not.toContain("0.58 + (least(ranked.text_rank, 1) * 0.39)");
      // similarity is reserved for real cosine; text-only rows leave it at 0.
      expect(body).toContain("0::double precision as similarity");
      // lexical signal lives in its own column.
      expect(body).toContain("as lexical_score");
      // hybrid_score capped below the 0.64 moderate threshold.
      expect(body).toContain("least(0.5,");
    }
  });

  it("tokenizes per-document viewer search instead of matching the whole query (RET-H5)", () => {
    expect(perDocTokenSearchMigration).toContain("regexp_split_to_table");
    expect(perDocTokenSearchMigration).toContain("length(token) >= 3");
    expect(perDocTokenSearchMigration).toContain("exists (");
    expect(perDocTokenSearchMigration).toContain("like '%' || t.token || '%'");
    expect(perDocTokenSearchMigration).toContain(
      "grant execute on function public.search_document_chunks(uuid, text, integer, uuid) to service_role;",
    );
  });

  it("defines the clinical registry tables identically in migration and schema", () => {
    for (const sql of [schema, clinicalRegistryRecordsMigration]) {
      expect(sql).toContain("create table if not exists public.clinical_registry_records");
      expect(sql).toContain("kind text not null check (kind in ('service', 'form'))");
      expect(sql).toContain("owner_id uuid not null references auth.users(id) on delete cascade");
      expect(sql).toContain(
        "source_status text not null default 'unknown' check (source_status in ('current', 'review_due', 'outdated', 'unknown'))",
      );
      expect(sql).toContain(
        "validation_status text not null default 'unverified' check (validation_status in ('unverified', 'locally_reviewed', 'approved'))",
      );
      expect(sql).toContain("unique (owner_id, kind, slug)");
      expect(sql).toContain("create table if not exists public.clinical_registry_record_sources");
      expect(sql).toContain(
        "record_id uuid not null references public.clinical_registry_records(id) on delete cascade",
      );
      expect(sql).toContain("document_id uuid not null references public.documents(id) on delete cascade");
      expect(sql).toContain("unique (record_id, document_id)");
      expect(sql).toContain("create index if not exists clinical_registry_records_owner_kind_idx");
      expect(sql).toContain("create trigger clinical_registry_records_updated_at");
      expect(sql).toContain("alter table public.clinical_registry_records enable row level security");
      expect(sql).toContain("revoke all on public.clinical_registry_records from anon, authenticated");
      expect(sql).toContain(
        "grant select, insert, update, delete on table public.clinical_registry_records to service_role",
      );
      expect(sql).toContain('create policy "registry records service role all"');
      expect(sql).toContain('create policy "registry record sources service role all"');
    }
  });

  it("defines the medication records table identically in migration and schema", () => {
    for (const sql of [schema, medicationRecordsMigration]) {
      expect(sql).toContain("create table if not exists public.medication_records");
      expect(sql).toContain("owner_id uuid not null references auth.users(id) on delete cascade");
      expect(sql).toContain("stats jsonb not null default '[]'::jsonb");
      expect(sql).toContain("sections jsonb not null default '[]'::jsonb");
      expect(sql).toContain("quick jsonb not null default '[]'::jsonb");
      expect(sql).toContain("unique (owner_id, slug)");
      expect(sql).toContain("create index if not exists medication_records_owner_name_idx");
      expect(sql).toContain("create trigger medication_records_updated_at");
      expect(sql).toContain("alter table public.medication_records enable row level security");
      expect(sql).toContain("revoke all on public.medication_records from anon, authenticated");
      expect(sql).toContain("grant select, insert, update, delete on table public.medication_records to service_role");
      expect(sql).toContain('create policy "medication records service role all"');
    }
  });

  it("adds catalog_payload to clinical registry records", () => {
    expect(schema).toContain("catalog_payload jsonb not null default '{}'::jsonb");
    expect(registryCatalogPayloadMigration).toContain(
      "add column if not exists catalog_payload jsonb not null default '{}'::jsonb",
    );
  });
});

describe("RC9 — lexical text path must not fabricate a cosine similarity", () => {
  // Regression guard for RC9. The text-only fallback (match_document_chunks_text) has no vector
  // cosine; an earlier version fabricated a synthetic `similarity` (0.56 + text_rank*0.39) that was
  // read downstream as a real semantic score, letting a pure keyword hit masquerade as moderate/strong
  // (>=0.64) evidence. The canonical definition in schema.sql now leaves similarity at 0 and carries
  // the lexical signal in a hybrid_score capped below the 0.64 moderate gate (plus lexical_score).
  // The two other lexical text RPCs (match_document_lookup_chunks_text / _table_facts_text) return only
  // text_rank — no similarity/hybrid_score column to fabricate.
  it("match_document_chunks_text returns similarity 0, not a synthetic score", () => {
    expect(schema).toContain("0::double precision as similarity");
    // The text path's hybrid_score is capped by least(0.5, ...) — strictly below the 0.64 moderate
    // threshold — so a lexical-only row can order among its peers but never clears the moderate/strong
    // evidence gate when merged with vector results. (Coefficients may be tuned; the 0.5 ceiling and
    // text_rank basis are the invariant.)
    expect(schema).toMatch(
      /least\(0\.5, [0-9.]+ \+ \(least\(ranked\.text_rank, 1\) \* [0-9.]+\)\)::double precision as hybrid_score/,
    );
  });
});
