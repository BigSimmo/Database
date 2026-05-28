import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8").replace(/\s+/g, " ");

describe("Supabase schema Data API grants", () => {
  it("explicitly grants service-role access for upload and ingestion tables", () => {
    expect(schema).toContain("public.import_batches,");
    expect(schema).toContain("public.document_labels,");
    expect(schema).toContain("public.document_summaries,");
    expect(schema).toContain("public.storage_cleanup_jobs");
    expect(schema).toMatch(/grant select, insert, update, delete on table .*public\.documents, .*public\.document_pages, .*public\.document_images, .*public\.image_caption_cache, .*public\.document_labels, .*public\.document_summaries, .*public\.document_chunks, .*public\.ingestion_jobs, .*public\.rag_queries, .*public\.storage_cleanup_jobs to service_role;/);
    expect(schema).toContain("grant execute on all functions in schema public to service_role;");
  });

  it("keeps browser Data API grants read-only except manual labels", () => {
    expect(schema).toContain("revoke all privileges on all tables in schema public from anon, authenticated;");
    expect(schema).toContain("revoke execute on all functions in schema public from public, anon, authenticated;");
    expect(schema).toMatch(/grant select on table .*public\.documents, .*public\.document_pages, .*public\.document_images, .*public\.document_labels, .*public\.document_summaries, .*public\.document_chunks, .*public\.ingestion_jobs, .*public\.rag_queries, .*public\.storage_cleanup_jobs to authenticated;/);
    expect(schema).not.toContain("grant select, insert, update, delete on table public.documents to authenticated;");
    expect(schema).not.toContain("grant select, insert on table public.rag_queries to authenticated;");
    expect(schema).not.toMatch(/grant .* on table .* to anon;/);
  });

  it("supports bulk import queue claiming and reindex resets", () => {
    expect(schema).toContain("create table if not exists public.import_batches");
    expect(schema).toContain("content_hash text");
    expect(schema).toContain(
      "create unique index if not exists documents_owner_content_hash_unique_idx on public.documents(owner_id, content_hash) where content_hash is not null;",
    );
    expect(schema).toContain("create or replace function public.claim_ingestion_jobs");
    expect(schema).toContain("for update of j skip locked");
    expect(schema).toContain("create or replace function public.reset_document_index");
  });

  it("tracks retryable storage cleanup and query-log purge performance", () => {
    expect(schema).toContain("create table if not exists public.storage_cleanup_jobs");
    expect(schema).toContain("create index if not exists storage_cleanup_jobs_owner_status_idx");
    expect(schema).toContain("create index if not exists rag_queries_source_chunk_ids_gin_idx");
    expect(schema).toContain("create policy \"storage cleanup owner read\"");
  });

  it("filters hybrid retrieval by owner inside Postgres", () => {
    expect(schema).toContain("owner_filter uuid default null");
    expect(schema).toContain("and (owner_filter is null or d.owner_id = owner_filter)");
    expect(schema).toContain("create or replace function public.match_document_chunks_text");
    expect(schema).toContain("c.search_tsv @@ query.tsq");
    expect(schema).toContain("create index if not exists documents_search_idx on public.documents using gin(search_tsv)");
    expect(schema).toContain("ts_rank_cd(d.title_search_tsv, query.tsq) * 3.0");
  });

  it("stores smart image metadata, document labels, and high-yield summaries", () => {
    expect(schema).toContain("image_type text not null default 'unclear'");
    expect(schema).toContain("searchable boolean not null default true");
    expect(schema).toContain("clinical_relevance_score real not null default 0");
    expect(schema).toContain("create table if not exists public.document_labels");
    expect(schema).toContain("create table if not exists public.document_summaries");
    expect(schema).toContain("create policy \"labels owner manual insert\"");
    expect(schema).toContain("create policy \"summaries owner read\"");
    expect(schema).toContain("create or replace function public.chunk_image_metadata");
    expect(schema).toContain("and i.searchable = true");
    expect(schema).toContain("and i.image_type <> 'logo_decorative'");
    expect(schema).toContain("'clinical_relevance_score', i.clinical_relevance_score");
    expect(schema).toContain("create or replace function public.get_related_document_metadata");
  });
});
