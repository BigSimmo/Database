import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ON_CALL_SECTIONS } from "@/lib/on-call/entry-model";

const migration = readFileSync("supabase/migrations/20260904120000_on_call_entries.sql", "utf8");

describe("on_call_entries migration", () => {
  it("declares owner_id not null, because this table has no public state", () => {
    expect(migration).toContain("owner_id uuid not null references auth.users(id) on delete cascade");
  });

  it("checks section against exactly the sections the model defines", () => {
    for (const section of ON_CALL_SECTIONS) expect(migration).toContain(`'${section}'`);
  });

  it("enables row level security and revokes the table from anon and authenticated", () => {
    expect(migration).toContain("alter table public.on_call_entries enable row level security");
    expect(migration).toContain("revoke all on public.on_call_entries from anon, authenticated");
  });

  it("grants only service_role, matching the application-layer ownership model", () => {
    expect(migration).toContain("grant select, insert, update, delete on table public.on_call_entries to service_role");
  });

  it("stores no derived staleness column — freshness is computed at read time", () => {
    expect(migration).not.toContain("review_due_at");
    expect(migration).not.toContain("is_stale");
  });
});
