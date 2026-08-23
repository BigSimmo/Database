import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20260823091000_clinical_quality_feedback_triage.sql", "utf8");
const schema = readFileSync("supabase/schema.sql", "utf8");
const types = readFileSync("src/lib/supabase/database.types.ts", "utf8");
const route = readFileSync("src/app/api/clinical-quality/route.ts", "utf8");

describe("clinical quality triage storage", () => {
  it("is service-role-only with fail-closed RLS and no free-text workflow field", () => {
    expect(migration).toContain("enable row level security");
    expect(migration).toContain(
      "revoke all on table public.clinical_quality_feedback_triage from public, anon, authenticated",
    );
    expect(migration).toContain(
      "revoke all on table public.clinical_quality_feedback_triage_events from public, anon, authenticated",
    );
    expect(migration).toContain("grant select on table public.clinical_quality_feedback_triage to service_role");
    expect(migration).not.toMatch(/grant (?:insert|update|delete)[^;]*clinical_quality_feedback_triage/i);
    expect(migration).not.toMatch(/workflow_note/i);
    expect(migration).not.toMatch(/create policy/i);
  });

  it("records every mutation through an actor-attributed append-only event", () => {
    expect(migration).toContain("create table if not exists public.clinical_quality_feedback_triage_events");
    expect(migration).toContain("actor_user_id uuid not null references auth.users(id) on delete restrict");
    expect(migration).toContain("updated_by uuid not null references auth.users(id) on delete restrict");
    expect(migration).toContain("create or replace function public.record_clinical_quality_feedback_triage");
    expect(migration).toContain("security definer");
    expect(migration).toContain("insert into public.clinical_quality_feedback_triage_events");
    expect(migration).toContain("grant execute on function public.record_clinical_quality_feedback_triage");
    expect(route).toContain('.rpc("record_clinical_quality_feedback_triage"');
  });

  it("keeps migration, canonical schema, and generated declarations aligned", () => {
    expect(schema).toContain("create table if not exists public.clinical_quality_feedback_triage");
    expect(types).toContain("clinical_quality_feedback_triage: {");
    expect(types).toContain("clinical_quality_feedback_triage_events: {");
    expect(types).toContain("record_clinical_quality_feedback_triage: {");
    expect(migration).toContain("primary key (signal_type, signal_id)");
    expect(migration).toContain("'retrieval_failure', 'evaluation_failure'");
  });

  it("never selects query, answer, excerpt, or patient text", () => {
    const selects = [...route.matchAll(/\.select\("([^"]+)"\)/g)].map((match) => match[1]).join(",");
    expect(selects).not.toMatch(/\b(query|answer|excerpt|patient)\b/i);
  });
});
