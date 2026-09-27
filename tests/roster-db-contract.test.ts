import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Static contract for the combined Roster database change. The behaviour itself is proven by
 * tests/sql/roster-behaviour.sql against a replay; this file pins the rules a later edit could
 * quietly break: tenancy, the one writer of invitations, the revoke cascade's WHEN clause, no
 * free-text reasons, retention, and the file order.
 */

const MIGRATIONS = "supabase/migrations";
const FILES = [
  "roster_shared_services_hardening",
  "on_call_service_items",
  "roster_mode",
  "admin_mode",
  "teaching_mode",
];

function migrationName(suffix: string): string {
  const name = readdirSync(MIGRATIONS).find((file) => file.endsWith(`_${suffix}.sql`));
  if (!name) throw new Error(`missing migration *_${suffix}.sql`);
  return name;
}

/** The migration's SQL with `--` comments removed, so a comment that names a rule never trips it. */
function migration(suffix: string): string {
  return readFileSync(`${MIGRATIONS}/${migrationName(suffix)}`, "utf8").replace(/--[^\n]*/g, "");
}

describe("file 1: shared team-system hardening", () => {
  const sql = migration("roster_shared_services_hardening");

  it("never replaces On Call's command or writes invitations", () => {
    expect(sql).not.toMatch(/function\s+public\.on_call_service_command/i);
    expect(sql).not.toMatch(/insert\s+into\s+public\.on_call_service_invitations/i);
    expect(sql).not.toMatch(/issued_via_mode/);
  });

  it("adds the platform-only flags, the bound email and the display name", () => {
    expect(sql).toContain("add column verified_at timestamptz");
    expect(sql).toContain("add column is_demo boolean not null default false");
    expect(sql).toContain("add column invited_email text");
    expect(sql).toContain("invited_email = lower(btrim(invited_email))");
    expect(sql).toContain("char_length(btrim(display_name)) between 1 and 80");
  });

  it("keeps the audit table and helpers service-role only", () => {
    expect(sql).toContain("alter table public.on_call_service_member_events enable row level security");
    expect(sql).toContain(
      "revoke all on function public.service_member_active(uuid, uuid) from public, anon, authenticated",
    );
    expect(sql).toContain("grant execute on function public.service_member_active(uuid, uuid) to service_role");
    expect(sql).not.toMatch(/to\s+(authenticated|anon)\s*;/);
  });
});

describe("file order", () => {
  it("runs shared hardening, On Call, Roster, Admin, Teaching, one after another", () => {
    const stamps = FILES.map((suffix) => migrationName(suffix).slice(0, 14));
    expect([...stamps].sort()).toEqual(stamps);
    expect(new Set(stamps).size).toBe(5);
  });

  it("has exactly one replacement of on_call_service_command among the five", () => {
    const replacing = FILES.filter((suffix) =>
      /function\s+public\.on_call_service_command\s*\(/i.test(migration(suffix)),
    );
    expect(replacing).toEqual(["on_call_service_items"]);
  });
});

describe("file 3: Roster", () => {
  const sql = migration("roster_mode");
  const tables = [...sql.matchAll(/create table public\.(\w+)/g)].map((match) => match[1]);
  const tenancyBlock = sql.slice(sql.indexOf("do $tenancy$"), sql.indexOf("$tenancy$;"));

  it("puts every new table behind service_role only", () => {
    expect(tables.length).toBeGreaterThanOrEqual(17);
    for (const table of tables) expect(tenancyBlock).toContain(`'${table}'`);
    expect(tenancyBlock).toContain("enable row level security");
    expect(tenancyBlock).toContain("revoke all on table public.%I from public, anon, authenticated");
    expect(sql).not.toMatch(/to\s+(authenticated|anon)\s*;/);
  });

  it("revokes Roster roles only on a real revoke, never on rejoin", () => {
    expect(sql).toMatch(
      /after update of revoked_at on public\.on_call_service_members\s+for each row when \(old\.revoked_at is null and new\.revoked_at is not null\)/,
    );
  });

  it("stores no free-text reasons and no sick or carer's leave", () => {
    for (const line of sql.split("\n").filter((text) => /^\s+(?!v_|p_)\w*reason\w*\s+text\b/.test(text))) {
      expect(line).toMatch(/check \(.* in \(/);
    }
    expect(sql).not.toMatch(/\b(sick|carer|personal_leave|notes?\s+text)\b/i);
  });

  it("never writes invitations or replaces On Call's command", () => {
    expect(sql).not.toMatch(/(insert\s+into|update)\s+public\.on_call_service_invitations/i);
    expect(sql).not.toMatch(/function\s+public\.on_call_service_command/i);
  });

  it("keeps every function security invoker with a pinned search path", () => {
    const heads = [...sql.matchAll(/create (?:or replace )?function public\.(\w+)[\s\S]*?as \$\$/g)].map(
      (match) => match[0],
    );
    expect(heads.length).toBeGreaterThanOrEqual(14);
    for (const head of heads) {
      expect(head).toContain("security invoker");
      expect(head).toContain("set search_path = public, pg_catalog, pg_temp");
    }
    expect(sql).not.toMatch(/security definer/i);
  });

  it("keeps the old import function for the live app, now imports-only", () => {
    const wrapper = sql.slice(sql.indexOf("create or replace function public.on_call_shifts_replace"));
    expect(wrapper).toContain("public.roster_own_shifts_replace(");
    const replace = sql.slice(sql.indexOf("create function public.roster_own_shifts_replace"));
    expect(replace).toMatch(/and source = 'import'\s+and workplace is not distinct from p_workplace/);
  });

  it("schedules the 12-month retention purge", () => {
    expect(sql).toContain("cron.schedule('roster-retention-purge', '20 3 * * *'");
    expect(sql).toContain("delete from public.roster_publications where published_at < now() - interval '12 months'");
    expect(sql).toContain("ends_at < now() - interval '90 days'");
  });
});
