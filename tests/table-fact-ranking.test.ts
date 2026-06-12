import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("table fact SQL ranking", () => {
  it("includes threshold and action fields in table fact text ranking", () => {
    const schema = readFileSync(join(process.cwd(), "supabase", "schema.sql"), "utf8");
    const functionBody = schema.slice(
      schema.indexOf("create or replace function public.match_document_table_facts_text"),
      schema.indexOf("create or replace function public.match_document_embedding_fields_hybrid"),
    );

    expect(functionBody).toContain("coalesce(f.threshold_value, '') || ' ' ||");
    expect(functionBody).toContain("coalesce(f.action, '')");
    expect(functionBody).toContain(
      "regexp_split_to_array(lower(f.threshold_value), '[^a-z0-9]+') && query.terms then 0.12",
    );
    expect(functionBody).toContain("regexp_split_to_array(lower(f.action), '[^a-z0-9]+') && query.terms then 0.1");
    expect(functionBody).toContain("metadata jsonb");
    expect(functionBody).toContain("f.metadata");
  });
});
