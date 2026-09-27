import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Static contract for the combined Roster database change. The behaviour itself is proven by
 * tests/sql/roster-behaviour.sql against a replay; this file pins the rules a later edit could
 * quietly break: tenancy, the one writer of invitations, the revoke cascade's WHEN clause, no
 * free-text reasons, retention, and the file order.
 */

const MIGRATIONS = "supabase/migrations";

describe("Roster draft versioning", () => {
  it("requires a draft version and a matching after-image in the canonical command", () => {
    const schema = readFileSync("supabase/schema.sql", "utf8");
    const command = schema.slice(schema.lastIndexOf("function public.roster_command("));
    expect(command).toContain("v_draft.version <> (p_payload ->> 'expectedVersion')::bigint");
    expect(command).toContain("v_current is distinct from v_row -> 'after'");
  });
  it("ships a forward migration with guarded undo and no client grants", () => {
    const sql = migration("roster_draft_versioning");
    expect(sql).toContain("add column version bigint not null default 1");
    expect(sql).toContain("v_draft.version <> (p_payload ->> 'expectedVersion')::bigint");
    expect(sql).toContain("version = version + 1");
    expect(sql).toContain("v_current is distinct from v_row -> 'after'");
    expect(sql).toContain("c.draft_id = v_draft.id");
    expect(sql).toContain("'canUndo'");
    expect(sql).not.toMatch(/to\s+(authenticated|anon)\s*;/);
    expect(sql).not.toMatch(/security definer/i);
    expect(readFileSync("supabase/schema.sql", "utf8")).toContain(
      readFileSync(`${MIGRATIONS}/${migrationName("roster_draft_versioning")}`, "utf8").trim(),
    );
  });
});
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

// Release 2 is a forward migration; the original shared command and its grants stay intact.
describe("Roster Release 2 follow-up", () => {
  const sql = migration("roster_release_two");
  it("preserves the read signature and keeps writes service-role only", () => {
    expect(sql).toContain(
      "create or replace function public.roster_read(p_actor_id uuid, p_service_id uuid, p_what text, p_payload jsonb default '{}')",
    );
    expect(sql).not.toMatch(/create (?:or replace )?function public\.roster_command/);
    expect(sql).not.toMatch(/security definer/i);
    for (const signature of [
      "roster_set_cutoff(uuid, uuid, date)",
      "roster_publish_preview(uuid, uuid, date, date)",
      "roster_publish(uuid, uuid, text, jsonb)",
      "roster_lock_manager(uuid, uuid)",
      "roster_publish_fingerprint(uuid, date, date)",
      "roster_publication_replacement(uuid, uuid, uuid, date, date)",
    ]) {
      expect(sql).toContain(`revoke all on function public.${signature} from public, anon, authenticated`);
      expect(sql).toContain(`grant execute on function public.${signature} to service_role`);
    }
  });
  it("checks freshness under the same team lock before any metadata write", () => {
    const lock = sql.slice(
      sql.indexOf("create function public.roster_lock_manager"),
      sql.indexOf("create function public.roster_set_cutoff"),
    );
    expect(lock.indexOf("for share")).toBeLessThan(lock.indexOf("pg_advisory_xact_lock"));
    expect(lock).toContain("pg_advisory_xact_lock(hashtextextended(p_service_id::text, 74817))");
    const publish = sql.slice(sql.indexOf("create function public.roster_publish("));
    expect(publish.indexOf("roster_lock_manager")).toBeLessThan(publish.indexOf("p_expected_token is null"));
    expect(publish.indexOf("p_expected_token is null")).toBeLessThan(publish.indexOf("'role.set'"));
    expect(publish.indexOf("'role.set'")).toBeLessThan(publish.indexOf("'codes.set'"));
    expect(publish).toContain("'changedUserIds', v_changed");
    expect(publish).toContain("except all");
    expect(publish).not.toMatch(/exception when others then\s+return/i);
  });
  it("includes assignments, approvals, metadata and exact dates in the comparison token", () => {
    const token = sql.slice(
      sql.indexOf("create function public.roster_publish_fingerprint"),
      sql.indexOf("create function public.roster_lock_manager"),
    );
    for (const table of [
      "roster_assignments",
      "roster_swaps",
      "roster_open_shifts",
      "on_call_service_members",
      "roster_member_roles",
      "roster_shift_codes",
      "roster_team_settings",
      "on_call_service_sites",
      "roster_publications",
    ]) {
      expect(token).toContain(`public.${table}`);
    }
    expect(token).toContain("'from', p_from, 'to', p_to");
  });
  it("restricts named leave and changes to managers and personal history to the actor", () => {
    for (const read of ["changes", "team_leave"]) {
      const branch = sql.slice(sql.indexOf(`elsif p_what = '${read}' then`)).split("\n  elsif p_what")[0];
      expect(branch).toContain("if not v_is_manager then raise exception 'roster_role_denied'");
    }
    const mine = sql.slice(
      sql.indexOf("elsif p_what = 'my_changes' then"),
      sql.indexOf("elsif p_what = 'team_leave' then"),
    );
    expect(mine.match(/a\.user_id = p_actor_id/g)).toHaveLength(2);
    expect(sql).toContain("p_cutoff > v_today + 180");
  });

  it("keeps publication lineage service-role-only and retires only explicit source overrides", () => {
    expect(sql).toContain("alter table public.roster_publication_protections enable row level security");
    expect(sql).toContain("revoke all on table public.roster_publication_protections from public, anon, authenticated");
    expect(sql).toContain("references public.roster_swaps(id) on delete cascade");
    expect(sql).toContain("references public.roster_open_shifts(id) on delete cascade");
    expect(sql).toContain("coalesce(p.give_assignment_id, w.give_assignment_id)");
    expect(sql).toContain("p.overridden_at is null");
    expect(sql).toContain("coalesce(cardinality(v_ids), 0) <> 1");
    expect(sql).toContain("'overridesRecorded', v_overrides");
  });

  it("posts real vacant shifts atomically and reuses unchanged gaps without losing multiplicity", () => {
    const publish = sql.slice(sql.indexOf("create function public.roster_publish("));
    expect(publish).toContain("jsonb_array_length(v_open_rows) > 1000");
    expect(publish).toContain(
      "jsonb_array_length(v_publication -> 'assignments') + jsonb_array_length(v_open_rows) > 5000",
    );
    expect(publish).toContain("not (o.id = any(v_open_ids))");
    expect(publish).toContain("o.status in ('claimed', 'reported')");
    expect(publish).toContain("'open.post', v_row");
    expect(publish).toContain("'openShiftIds', to_jsonb(v_open_ids)");
    expect(publish).not.toMatch(/exception when others then\s+return/i);
  });
  it("remembers off codes without changing assignment kinds or allowing working hours", () => {
    expect(sql).toContain("drop constraint roster_shift_codes_kind_check");
    expect(sql).toContain("kind <> 'off' or (starts is null and ends is null)");
    const codes = sql.slice(
      sql.indexOf("for v_row in select value from jsonb_array_elements(p_payload -> 'codes')"),
      sql.indexOf("for v_row in select value from jsonb_array_elements(v_publication -> 'assignments')"),
    );
    expect(codes).toContain("'other', 'off'");
    expect(codes).toContain("v_row ->> 'starts' is not null or v_row ->> 'ends' is not null");
    expect(sql).not.toMatch(/alter table public\.roster_assignments/);
  });

  it("does not infer another vacancy from changed metadata or bypass a pending claim", () => {
    const pending = sql.slice(
      sql.indexOf("o.status in ('claimed', 'reported')"),
      sql.indexOf(
        "then raise exception 'roster_conflict'; end if;",
        sql.indexOf("o.status in ('claimed', 'reported')"),
      ),
    );
    expect(pending).not.toContain("min_grade");
    expect(pending).not.toContain("urgent");
    expect(sql).toContain("o.min_grade is distinct from v_row ->> 'minGrade'");
    expect(sql).toContain("or o.urgent <> coalesce((v_row ->> 'urgent')::boolean, false)");
  });
});
