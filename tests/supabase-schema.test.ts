import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8").replace(/\s+/g, " ");

describe("Supabase schema Data API grants", () => {
  it("explicitly grants service-role access for upload and ingestion tables", () => {
    expect(schema).toMatch(
      /grant select, insert, update, delete on table .*public\.documents, .*public\.document_pages, .*public\.document_images, .*public\.document_chunks, .*public\.ingestion_jobs, .*public\.rag_queries to service_role;/,
    );
    expect(schema).toContain("grant execute on all functions in schema public to service_role;");
  });

  it("keeps authenticated direct access aligned with RLS policies", () => {
    expect(schema).toContain("grant select, insert, update, delete on table public.documents to authenticated;");
    expect(schema).toMatch(
      /grant select on table .*public\.document_pages, .*public\.document_images, .*public\.document_chunks, .*public\.ingestion_jobs to authenticated;/,
    );
    expect(schema).toContain("grant select, insert on table public.rag_queries to authenticated;");
    expect(schema).not.toMatch(/\bto anon\b/);
  });
});
