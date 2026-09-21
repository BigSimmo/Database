// tests/cme-schema.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync("supabase/schema.sql", "utf8");

describe("the CME tables", () => {
  for (const table of ["cme_years", "cme_requirements", "cme_routines", "cme_entries", "cme_allocations"]) {
    it(`${table} is owner-scoped, RLS-on and unreachable without the service role`, () => {
      expect(schema).toMatch(new RegExp(`create table[^;]*public\\.${table}[^;]*owner_id uuid not null`, "s"));
      expect(schema).toMatch(new RegExp(`alter table public\\.${table} enable row level security`));
      expect(schema).toMatch(new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`));
    });
  }

  it("stores the activity date as a date, not a timestamp", () => {
    // A timestamptz would be read back in UTC and would move an entry logged on
    // the evening of 31 December in Perth into the following year.
    expect(schema).toMatch(/create table[^;]*public\.cme_entries[^;]*activity_date date not null/s);
    expect(schema).not.toMatch(/create table[^;]*public\.cme_entries[^;]*activity_date timestamp/s);
  });

  it("lets one entry allocate to several categories but never twice to one", () => {
    expect(schema).toMatch(/create table[^;]*public\.cme_allocations[^;]*unique \(entry_id, category\)/s);
  });
});
