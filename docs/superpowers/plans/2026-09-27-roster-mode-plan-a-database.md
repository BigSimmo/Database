# Roster combined database change: Implementation Plan (Plan A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One database pull request that Josh merges himself, carrying the shared team-system hardening, On Call's service items, Roster's own-shift fix and team tables, Admin's owner tables and Teaching's tables, replayed from scratch before it opens.

**Architecture:** Five migration files in a fixed order (shared hardening → On Call → Roster → Admin → Teaching), each stamped by the Roster thread at assembly one minute apart. Every new table is RLS-on, service_role only, with no browser grants; team tables are reached only through `roster_read` / `roster_command`, which check membership and role in SQL. Every file's source is listed under "Where each file comes from"; nothing is read from outside the repository.

**Tech Stack:** Supabase Postgres 17 (pgvector, pg_cron), plpgsql, Vitest static contract tests, CI "Migration replay" job, `npm run drift:manifest` (Docker).

**Spec:** design v8 (approved by Josh 26 Sep 2026 18:44Z), summarised in `docs/superpowers/plans/2026-09-27-roster-mode-screens.png` and `docs/superpowers/plans/2026-09-27-roster-mode-overview.md`; the database contract v6 is `docs/superpowers/plans/2026-09-27-roster-mode-db-agreement.md`.

**Efficiency:** Roster's SQL was written and replayed on Postgres 16 with 14 behaviour checks before this plan. This plan gives it in full, or as an exact spec for the two largest functions, so tasks write it down rather than design it. Local work is the offline gates plus one containerised replay; CI's Migration replay is the third run. One push, one draft PR, one review of the final diff.

## Global Constraints

- MERGING TO `main` APPLIES EVERY MIGRATION TO THE LIVE CLINICAL DATABASE WITHIN SECONDS. Josh merges this PR himself, inside his window. Never merge it, never arm auto-merge on it, never write "awaiting deploy", "applied later" or any deferred-deploy wording in its title or body.
- Migration names: `supabase/migrations/YYYYMMDDHHMMSS_<name>.sql`, UTC, dated after the newest file on `main` and no more than 2 days in the future. Stamp all five at assembly time, one minute apart, in the order above.
- A migration already on `main` is never edited. Every change ships as a new file.
- Every file starts with `set local lock_timeout = '5s'; set local statement_timeout = '30s';`. No `create index concurrently` (each file runs in one transaction).
- Every function: `security invoker`, `set search_path = public, pg_catalog, pg_temp`, execute revoked from `public, anon, authenticated`, granted to `service_role` only.
- Every table: RLS on, `revoke all ... from public, anon, authenticated`, `grant select, insert, update, delete ... to service_role`. Never a grant to `authenticated` or `anon`.
- No patient data. No leave reasons, no free-text notes, no sick or carer's leave kinds. Fixed-list "reason" columns only.
- Only `on_call_service_command` (On Call's file 2) writes `on_call_service_invitations`. No other file replaces that function.
- Advisory lock second keys: Roster 74817, Teaching 74818, Admin 74819. Each guards only its own mode's tables.
- Retention: team roster data 12 months; printed names of people not on the app cleared 90 days after the shift ends.
- Provider boundary: no Supabase, OpenAI or Railway calls. The live-database checks after merge (`live-drift` workflow) are GitHub's, not this thread's.
- The repository is public: synthetic names only ("Example Hospital", made-up people).

## Where each file comes from

Everything this plan needs is in the repository. No step reads a folder outside it.

| File                                                                   | Owner             | What this plan gives                                                                                                | Finished copy (PR #3117, branch `claude/project-thread-yrumov`)           |
| ---------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1. `supabase/migrations/<stamp1>_roster_shared_services_hardening.sql` | Roster            | The full SQL (Task 1 Step 3)                                                                                        | `supabase/migrations/20260926225209_roster_shared_services_hardening.sql` |
| 2. `supabase/migrations/<stamp2>_on_call_service_items.sql`            | On Call's thread  | What Roster's files need from it (Task 2 Step 1)                                                                    | `supabase/migrations/20260926225309_on_call_service_items.sql`            |
| 3. `supabase/migrations/<stamp3>_roster_mode.sql`                      | Roster            | The full SQL for every table, trigger and helper, and a spec for `roster_read` and `roster_command` (Task 3 Step 2) | `supabase/migrations/20260926225409_roster_mode.sql`                      |
| 4. `supabase/migrations/<stamp4>_admin_mode.sql`                       | Admin's thread    | The full SQL (Task 4 Step 1)                                                                                        | `supabase/migrations/20260926225509_admin_mode.sql`                       |
| 5. `supabase/migrations/<stamp5>_teaching_mode.sql`                    | Teaching's thread | What Roster's files need from it (Task 4 Step 1)                                                                    | `supabase/migrations/20260926225609_teaching_mode.sql`                    |
| `tests/sql/roster-behaviour.sql`                                       | Roster            | The 14 checks it must make (Task 3 Step 2)                                                                          | same path                                                                 |
| `src/lib/supabase/database.types.ts` additions                         | Roster            | What to add (Task 5 Step 4)                                                                                         | same path                                                                 |

To read a finished copy, run `git fetch origin claude/project-thread-yrumov`, then `git show origin/claude/project-thread-yrumov:<path>`. Those copies are the files that were replayed together with the behaviour script. If a finished copy and this plan disagree, stop and ask the Roster thread rather than choosing between them. If the branch no longer exists because #3117 has merged, the five files are on `main` and this plan is done.

**Future migrations.** Every `supabase/migrations/` file named in this plan is a future migration. Each is created only on the Plan A branch (Task 0 Step 2) and ships only in the database PR that Josh merges himself. The docs PR that carries this plan creates no migration.

## Review Focus

1. **Two managers acting at once.** Two approvals, or a publish and an approval, on the same team in the same second must serialise: the second sees the first's result, never a half-applied swap. (Pinned by the advisory lock plus the "request exists" and "taken" checks in Task 3's behaviour script.)
2. **Someone leaves while a request is pending.** Revoking a member (by On Call's admin or a Roster manager) must cancel their live swaps and release their claims in the same transaction, and a later rejoin must not restore the manager role. (Task 3, checks 11 and 13.)
3. **Night shifts that cross midnight in Perth.** Publishing, clash checks and the "which shifts does this period replace" rule must work on Perth dates (UTC+8), not UTC dates. (Task 3, checks 4, 7 and 10 use a 21:30–08:00 night.)
4. **Account deletion.** Deleting a doctor's account must never be blocked by a foreign key in any new table (`on delete cascade` or `set null` everywhere). (Task 3, new check 14.)
5. **An old app talking to the new database.** For the minutes between this merge and the next app deploy, the live app still calls `on_call_shifts_replace` with 9 arguments; it must keep working. (Task 3, check 1.)

---

### Task 0: Preconditions and the branch

**Files:** none changed.

- [ ] **Step 1: Confirm the inputs are in the repository and final**

Files 1, 3 and 4 and the behaviour script can always be written from this plan. Files 2 and 5 belong to On Call and Teaching, so check that their final versions are in the repository:

```bash
git fetch origin main claude/project-thread-yrumov
R=origin/claude/project-thread-yrumov
git ls-tree -r --name-only "$R" -- supabase/migrations tests \
  | grep -E '_(roster_shared_services_hardening|on_call_service_items|roster_mode|admin_mode|teaching_mode)\.sql$|roster-behaviour\.sql$|teaching-migration-contract\.test\.ts$'
git show "$R":supabase/migrations/20260926225309_on_call_service_items.sql | grep -c "issuedViaMode"
```

Expected: the five migrations, `tests/sql/roster-behaviour.sql` and `tests/teaching-migration-contract.test.ts` are listed, and the count is at least 1, meaning On Call's file has an `issuedViaMode` branch in `invitation.create` (the contract v6 ask). If On Call's file or Teaching's file is missing, or On Call's file has no `issuedViaMode` branch, stop and ask the coordinator; do not write either file yourself. Teaching's file rides in this PR only if the Teaching thread has confirmed Josh approved its build plan (Teaching's hold, 19:15Z); otherwise ship files 1-4, drop Task 4's Teaching half and the `teaching_*` projections, and say in the PR body that Teaching's file follows in its own database PR.

- [ ] **Step 2: Fresh branch from latest main**

```bash
git fetch origin main
git checkout -B claude/project-thread-lm3749 origin/main
npm ci --include=dev
ls supabase/migrations | tail -3
```

Expected: the newest migration is printed; every new stamp must be later than it.

- [ ] **Step 3: Choose the five stamps**

```bash
node -e 'const t=new Date();const s=[];for(let i=0;i<5;i++){const d=new Date(t.getTime()+i*60000);s.push(d.toISOString().replace(/[-:T]/g,"").slice(0,14))}console.log(s.join("\n"))'
```

Expected: five 14-digit UTC stamps. Use them in this order: 1 `roster_shared_services_hardening`, 2 `on_call_service_items`, 3 `roster_mode`, 4 `admin_mode`, 5 `teaching_mode`.

---

### Task 1: Shared team-system hardening (file 1)

**Files:**

- Create: `supabase/migrations/<stamp1>_roster_shared_services_hardening.sql`
- Create: `tests/roster-db-contract.test.ts`

**Interfaces:**

- Produces: columns `on_call_services.verified_at/verified_by/is_demo`, `on_call_service_invitations.invited_email`, `on_call_service_members.display_name`; table `on_call_service_member_events`; functions `service_member_active(uuid, uuid) → boolean`, `on_call_service_set_verified(p_service_id uuid, p_actor_id uuid, p_verified boolean, p_is_demo boolean) → jsonb`.

- [ ] **Step 1: Write the failing contract test**

Create `tests/roster-db-contract.test.ts`:

```ts
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Static contract for the combined Roster database change. The behaviour itself is proven by
 * tests/sql/roster-behaviour.sql against a replay; this file pins the rules a later edit could
 * quietly break: tenancy, the one writer of invitations, the revoke cascade's WHEN clause, no
 * free-text reasons, retention, and the file order.
 */

const MIGRATIONS = "supabase/migrations";

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
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/roster-db-contract.test.ts`
Expected: FAIL with `missing migration *_roster_shared_services_hardening.sql`.

- [ ] **Step 3: Add the migration**

**Future migration step** (Plan A branch only; see "Where each file comes from"). Create `supabase/migrations/<stamp1>_roster_shared_services_hardening.sql` with exactly this content. It is the replayed file; the finished copy differs only in its first comment line.

```sql
-- Shared team system hardening: file 1 of the combined Roster DB PR (docs/superpowers/plans/2026-09-27-roster-mode-db-agreement.md, v6).
--
-- MERGING THIS PR APPLIES IT TO THE LIVE CLINICAL DATABASE WITHIN SECONDS. Josh merges it himself.
--
-- What this file does, and nothing else:
--   1. on_call_services gains verified_at / verified_by / is_demo. Only a platform path sets them
--      (on_call_service_set_verified below, service_role only). The command RPC never does.
--   2. on_call_service_invitations gains invited_email, stored lower-case and trimmed.
--   3. on_call_service_members gains display_name, shared by every mode.
--   4. on_call_service_member_events: one audit row per join, revoke, rejoin and role change.
--   5. service_member_active(): the one permission helper every mode's command RPC calls first.
-- It never touches on_call_service_command: On Call's file (position 2) is its only replacement,
-- and it adds issued_via_mode. Nothing here reads auth.users.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- 1. Verified and demo flags. Health-service features switch on only when
--    verified_at is not null or is_demo.
alter table public.on_call_services
  add column verified_at timestamptz,
  add column verified_by uuid references auth.users (id) on delete set null,
  add column is_demo boolean not null default false;

-- 2. Invitations are tied to the invited email. Rows made before this file stay null and
--    expire within 7 days anyway; On Call's command requires the email on every new invite.
alter table public.on_call_service_invitations
  add column invited_email text,
  add constraint on_call_service_invitations_invited_email_normalised check (
    invited_email is null
    or (invited_email = lower(btrim(invited_email)) and char_length(invited_email) between 3 and 320)
  );

-- 3. The name colleagues see, set by the member or a service admin.
alter table public.on_call_service_members
  add column display_name text,
  add constraint on_call_service_members_display_name_length check (
    display_name is null or char_length(btrim(display_name)) between 1 and 80
  );

-- 4. Membership audit. Ids set null on account deletion so "delete my data" still works.
--    Rows older than 12 months are purged by roster_retention_purge() (file 3).
create table public.on_call_service_member_events (
  id bigint generated always as identity primary key,
  service_id uuid not null references public.on_call_services (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  event text not null check (event in ('joined', 'revoked', 'rejoined', 'role_changed')),
  mode text check (mode is null or mode in ('roster', 'teaching', 'admin')),
  actor_id uuid references auth.users (id) on delete set null,
  at timestamptz not null default now()
);
create index on_call_service_member_events_service_at_idx on public.on_call_service_member_events (service_id, at desc);
create index on_call_service_member_events_user_idx on public.on_call_service_member_events (user_id) where user_id is not null;
create index on_call_service_member_events_at_idx on public.on_call_service_member_events (at);

alter table public.on_call_service_member_events enable row level security;
revoke all on table public.on_call_service_member_events from public, anon, authenticated;
grant select, insert, update, delete on table public.on_call_service_member_events to service_role;

-- 5. The shared permission helper. Each mode's command RPC calls it first, then checks its
--    own role table with revoked_at is null.
create function public.service_member_active(p_service_id uuid, p_user_id uuid)
returns boolean
language sql stable security invoker
set search_path = public, pg_catalog, pg_temp as $$
  select exists (
    select 1 from public.on_call_service_members
    where service_id = p_service_id and user_id = p_user_id and revoked_at is null
  )
$$;
revoke all on function public.service_member_active(uuid, uuid) from public, anon, authenticated;
grant execute on function public.service_member_active(uuid, uuid) to service_role;

-- The platform path for the verified and demo flags: Josh's owner panel button, service_role only.
-- Takes the service row lock so it orders with every command that reads the flags.
create function public.on_call_service_set_verified(
  p_service_id uuid,
  p_actor_id uuid,
  p_verified boolean,
  p_is_demo boolean
) returns jsonb
language plpgsql security invoker
set search_path = public, pg_catalog, pg_temp as $$
declare v_service public.on_call_services%rowtype;
begin
  if p_service_id is null or p_actor_id is null or p_verified is null or p_is_demo is null then
    raise exception 'service_invalid_request';
  end if;
  select * into v_service from public.on_call_services where id = p_service_id for update;
  if not found then raise exception 'service_not_found'; end if;
  update public.on_call_services
     set verified_at = case when p_verified then coalesce(v_service.verified_at, now()) else null end,
         verified_by = case when p_verified then coalesce(v_service.verified_by, p_actor_id) else null end,
         is_demo = p_is_demo
   where id = p_service_id
  returning * into v_service;
  return jsonb_build_object('serviceId', v_service.id, 'verifiedAt', v_service.verified_at, 'isDemo', v_service.is_demo);
end $$;
revoke all on function public.on_call_service_set_verified(uuid, uuid, boolean, boolean) from public, anon, authenticated;
grant execute on function public.on_call_service_set_verified(uuid, uuid, boolean, boolean) to service_role;
```

The content is final (replayed on 26 Sep 2026); do not edit it here. Any change goes back through the Roster thread so the contract test, the behaviour script and the replay stay true.

- [ ] **Step 4: Run the test again**

Run: `npx vitest run tests/roster-db-contract.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/<stamp1>_roster_shared_services_hardening.sql tests/roster-db-contract.test.ts
git commit -m "db: shared team-system hardening for Roster, On Call, Admin and Teaching (file 1)"
```

---

### Task 2: On Call's service items (file 2)

**Files:**

- Create: `supabase/migrations/<stamp2>_on_call_service_items.sql`
- Test: the test changes On Call made with its file, on PR #3117's branch (`git diff origin/main...origin/claude/project-thread-yrumov --stat -- tests/on-call-*` lists them; for example `tests/on-call-service-api.test.ts` and `tests/on-call-service-contract.test.ts`). On Call owns them: take them, run them, do not rewrite them.

**Interfaces:**

- Consumes: everything from Task 1.
- Produces: the only replacement of `on_call_service_command`, with `issued_via_mode`, email binding, audit rows, caps 5,000 members / 1,000 open invitations, `member.display_name`, `FOR SHARE` reads.

- [ ] **Step 1: Take On Call's final file exactly**

**Future migration step** (Plan A branch only). On Call owns this file. Take its final version from the repository and give it the second stamp:

```bash
git show origin/claude/project-thread-yrumov:supabase/migrations/20260926225309_on_call_service_items.sql \
  > supabase/migrations/<stamp2>_on_call_service_items.sql
grep -c "DRAFT ONLY" supabase/migrations/<stamp2>_on_call_service_items.sql
```

Expected: `0`. If the draft banner is still there, or the coordinator has named a newer version from On Call, On Call has not released this one: stop and ask the coordinator. Never edit this file here.

Check that it provides everything Roster's files and the agreement rely on (`grep -n` each name in the file):

- It is the only `create or replace function public.on_call_service_command` in the five files, and it relies only on file 1 (`service_member_active`, `invited_email`, `display_name`, `on_call_service_member_events`).
- It adds `on_call_service_invitations.issued_via_mode`: null for On Call and service admins, otherwise `'roster'` or `'teaching'`. An invite issued through a mode is forced to `role = 'member'`.
- `invitation.create` accepts `issuedViaMode: 'roster' | 'teaching'` and checks `roster_can_invite` or `teaching_can_invite` for the actor instead of the On Call role.
- Join compares `p_payload->>'actorEmail'` with `invited_email` (a mismatch raises `service_invite_email_mismatch`). It then re-checks the issuer: a null mode uses the On Call role check; otherwise a plpgsql `case` calls `roster_can_invite` or `teaching_can_invite` at run time (they are created by files 3 and 5), and an unknown mode fails closed.
- It enforces the caps of 5,000 active members and 1,000 open invitations per service.
- It adds `member.display_name`: only the member or a service admin, trimmed to 1-80 characters, or null.
- Read-only actions take `FOR SHARE` on the service row; actions that change anything keep `FOR UPDATE`.

Everything else in the file is On Call's own scope. This plan neither describes it nor changes it.

- [ ] **Step 2: Add the file-order test**

Append to `tests/roster-db-contract.test.ts`:

```ts
describe("file order", () => {
  it("runs shared hardening, On Call, Roster, Admin, Teaching, one after another", () => {
    const stamps = [
      "roster_shared_services_hardening",
      "on_call_service_items",
      "roster_mode",
      "admin_mode",
      "teaching_mode",
    ].map((suffix) => migrationName(suffix).slice(0, 14));
    expect([...stamps].sort()).toEqual(stamps);
    expect(new Set(stamps).size).toBe(5);
  });

  it("has exactly one replacement of on_call_service_command among the five", () => {
    const replacing = [
      "roster_shared_services_hardening",
      "on_call_service_items",
      "roster_mode",
      "admin_mode",
      "teaching_mode",
    ].filter((suffix) => /function\s+public\.on_call_service_command\s*\(/i.test(migration(suffix)));
    expect(replacing).toEqual(["on_call_service_items"]);
  });
});
```

- [ ] **Step 3: Run it (it fails until Tasks 3 and 4 add their files)**

Run: `npx vitest run tests/roster-db-contract.test.ts -t "file order"`
Expected: FAIL with `missing migration *_roster_mode.sql`. It turns green at the end of Task 4.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/<stamp2>_on_call_service_items.sql tests/roster-db-contract.test.ts
git add <On Call's test files from the Test line above>
git commit -m "db: On Call service items, the one replacement of on_call_service_command (file 2)"
```

---

### Task 3: Roster's own shifts and team tables (file 3)

**Files:**

- Create: `supabase/migrations/<stamp3>_roster_mode.sql`
- Create: `tests/sql/roster-behaviour.sql`
- Modify: `tests/roster-db-contract.test.ts`

**Interfaces:**

- Consumes: Task 1's columns and helpers; Task 2's `on_call_service_command` (the behaviour script calls its `member.revoke`).
- Produces (used by Plan B and later plans):
  - `on_call_shifts` columns `source 'import'|'manual'`, `kind 'day'|'evening'|'night'|'on_call'|'leave'|'other'`, `workplace text ≤80`, `series_id uuid`.
  - `on_call_shift_imports` formats `ics|csv|xlsx|pdf|link`, columns `workplace`, `file_name`.
  - `roster_own_shifts_replace(p_owner_id uuid, p_window_start date, p_window_end date, p_format text, p_workplace text, p_file_name text, p_shifts jsonb, p_changes jsonb, p_added int, p_changed int, p_removed int) → uuid` (import id). `p_shifts` items: `{startsAt, endsAt, title, location, sourceUid, kind}`.
  - Owner tables `roster_calendar_links`, `web_push_subscriptions`, `roster_leave`.
  - `roster_read(p_actor_id uuid, p_service_id uuid, p_what text, p_payload jsonb) → jsonb` with `p_what` in `teams | overview | assignments | requests | unavailability | leave_overlap | manage | people | publications | maker | draft`.
  - `roster_command(p_actor_id uuid, p_service_id uuid, p_action text, p_payload jsonb) → jsonb` with actions `seen.mark, role.set, member.remove, settings.set, unavailability.set, publish, swap.create, swap.accept, swap.approve, swap.decline, swap.cancel, swap.undo, open.post, open.report, open.claim, open.approve, open.decline, open.cancel, open.release, codes.set, needs.set, draft.open, draft.change, draft.undo, agreement.record`.
  - Error codes raised (mapped to HTTP in later plans): `roster_auth_required, roster_invalid_request, roster_access_denied, roster_team_not_verified, roster_role_denied, roster_not_found, roster_request_exists, roster_swap_not_eligible, roster_open_shift_taken, roster_conflict, roster_limit`.
  - `roster_set_manager(p_service_id uuid, p_user_id uuid, p_actor_id uuid, p_manager boolean) → jsonb` (platform only), `roster_can_invite(uuid, uuid) → boolean`, `roster_retention_purge() → jsonb` scheduled nightly at 03:20 UTC as `roster-retention-purge`.

- [ ] **Step 1: Extend the contract test (fails first)**

Append to `tests/roster-db-contract.test.ts`:

```ts
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
    const heads = [...sql.matchAll(/create (?:or replace )?function public\.(\w+)[\s\S]*?as \$\$/g)].map((m) => m[0]);
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
```

Run: `npx vitest run tests/roster-db-contract.test.ts -t "file 3"`
Expected: FAIL with `missing migration *_roster_mode.sql`.

- [ ] **Step 2: Write the migration and the behaviour script**

**Future migration step** (Plan A branch only). Create `supabase/migrations/<stamp3>_roster_mode.sql` in three pieces, in this order.

**Header, parts A to D, the tenancy block and the small functions of part E: exactly this SQL.** The finished copy differs only in its first comment line.

```sql
-- Roster mode: file 3 of the combined Roster DB PR (docs/superpowers/plans/2026-09-27-roster-mode-db-agreement.md, v6).
--
-- MERGING THIS PR APPLIES IT TO THE LIVE CLINICAL DATABASE WITHIN SECONDS. Josh merges it himself.
--
-- Relies on file 1 (roster_shared_services_hardening) and file 2 (on_call_service_items).
-- It never replaces on_call_service_command and never writes on_call_service_invitations.
--
-- Tenancy, the same as every service table: RLS on, no policies, no grant to anon or
-- authenticated, service_role only. Owner tables (own shifts, calendar links, leave, push
-- subscriptions) are read and written by owner_id from the validated session. Team tables are
-- read and written ONLY through roster_read() and roster_command(), which check the actor's
-- active membership (service_member_active) and Roster role in SQL on every call.
--
-- Roster data holds staff names and shift times, never patient data. There are no leave
-- reasons, no free-text notes and no sick or carer's leave kinds anywhere in this file.
--
-- Parts:
--   A. Own shifts: import fix (hand-added shifts survive), kinds, workplaces, more formats.
--   B. Calendar links (a doctor's live roster link) and phone-alert subscriptions.
--   C. Team: Roster roles, team settings, publications, the live roster, swaps, open shifts,
--      dates people can't work, planned leave, seen receipts.
--   D. Roster maker (Release 3): shift codes, staffing needs, drafts, the change log with undo,
--      and change agreements.
--   E. Functions: roster_can_invite, the revoke cascade, the own-shift replace, roster_read,
--      roster_command, the platform manager switch, and the 12-month retention purge.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- =============================================================================================
-- A. Own shifts
-- =============================================================================================

-- source: 'import' rows are replaced by the next import of the same workplace; 'manual' rows
-- (added by hand in Roster) are never touched by an import. Existing rows are all imports.
alter table public.on_call_shifts
  add column source text not null default 'import',
  add column kind text,
  add column workplace text,
  add column series_id uuid,
  add constraint on_call_shifts_source check (source in ('import', 'manual')),
  add constraint on_call_shifts_kind check (kind is null or kind in ('day', 'evening', 'night', 'on_call', 'leave', 'other')),
  add constraint on_call_shifts_workplace check (workplace is null or (btrim(workplace) <> '' and char_length(workplace) <= 80)),
  add constraint on_call_shifts_series_manual check (series_id is null or source = 'manual');

create index on_call_shifts_owner_series_idx on public.on_call_shifts (owner_id, series_id) where series_id is not null;

alter table public.on_call_shift_imports
  drop constraint on_call_shift_imports_format_check,
  add constraint on_call_shift_imports_format_check check (format in ('ics', 'csv', 'xlsx', 'pdf', 'link')),
  add column workplace text,
  add column file_name text,
  add constraint on_call_shift_imports_workplace check (workplace is null or (btrim(workplace) <> '' and char_length(workplace) <= 80)),
  add constraint on_call_shift_imports_file_name check (file_name is null or (btrim(file_name) <> '' and char_length(file_name) <= 120));

-- The original function keeps its signature (the live app calls it until Release 1 ships) but
-- now removes imported shifts only, so a hand-added shift is never deleted by an import.
create or replace function public.on_call_shifts_replace(
  p_owner_id uuid,
  p_window_start date,
  p_window_end date,
  p_format text,
  p_shifts jsonb,
  p_changes jsonb,
  p_added integer,
  p_changed integer,
  p_removed integer
) returns uuid
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
begin
  return public.roster_own_shifts_replace(
    p_owner_id, p_window_start, p_window_end, p_format, null, null,
    p_shifts, p_changes, p_added, p_changed, p_removed
  );
end $$;

-- =============================================================================================
-- B. Calendar links and phone-alert subscriptions (owner tables)
-- =============================================================================================

-- A doctor's live roster link (an .ics address from their rostering system). The address is a
-- secret: it is returned only to its owner, never logged, and fetched only over https by the
-- app's guarded fetcher. At most 3 per owner (one per workplace).
create table public.roster_calendar_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  url text not null check (url ~ '^https://' and char_length(url) <= 2000),
  workplace text check (workplace is null or (btrim(workplace) <> '' and char_length(workplace) <= 80)),
  last_fetched_at timestamptz,
  last_error text check (last_error is null or last_error in ('unreachable', 'not_calendar', 'too_large', 'too_many_shifts', 'blocked_address')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roster_calendar_links_one_per_workplace unique nulls not distinct (owner_id, workplace)
);
create index roster_calendar_links_owner_idx on public.roster_calendar_links (owner_id);
create trigger roster_calendar_links_updated_at before update on public.roster_calendar_links
  for each row execute function public.set_updated_at();

create function public.roster_calendar_links_cap() returns trigger
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text, 74817));
  if (select count(*) from public.roster_calendar_links where owner_id = new.owner_id) >= 3 then
    raise exception 'roster_limit';
  end if;
  return new;
end $$;
create trigger roster_calendar_links_cap before insert on public.roster_calendar_links
  for each row execute function public.roster_calendar_links_cap();

-- Web push endpoints for phone alerts (Release 2). One row per phone or browser. The lock
-- screen text is always generic; nothing about a shift is stored here.
create table public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 1 and 200),
  auth text not null check (char_length(auth) between 1 and 100),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index web_push_subscriptions_owner_idx on public.web_push_subscriptions (owner_id);

create function public.web_push_subscriptions_cap() returns trigger
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text, 74817));
  if (select count(*) from public.web_push_subscriptions where owner_id = new.owner_id) >= 10 then
    raise exception 'roster_limit';
  end if;
  return new;
end $$;
create trigger web_push_subscriptions_cap before insert on public.web_push_subscriptions
  for each row execute function public.web_push_subscriptions_cap();

-- =============================================================================================
-- C. Team tables
-- =============================================================================================

-- Roster role per member. role 'member' carries grade and the name the roster file prints;
-- 'manager' is granted only by the platform (Josh's confirm button), never by a manager.
create table public.roster_member_roles (
  service_id uuid not null,
  user_id uuid not null,
  role text not null default 'member' check (role in ('member', 'manager')),
  grade text check (grade is null or grade in ('intern', 'resident', 'registrar', 'fellow', 'consultant', 'other')),
  roster_name text check (roster_name is null or (btrim(roster_name) <> '' and char_length(roster_name) <= 80)),
  rotation_ends_on date,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (service_id, user_id),
  foreign key (service_id, user_id) references public.on_call_service_members (service_id, user_id) on delete cascade
);
create unique index roster_member_roles_roster_name_idx on public.roster_member_roles (service_id, lower(roster_name))
  where revoked_at is null and roster_name is not null;

-- One row per team. Swap approval default follows Josh's round-6 answer: clean same-grade
-- swaps approve themselves and the manager is told. Rules are the team's own, never "the law".
create table public.roster_team_settings (
  service_id uuid primary key references public.on_call_services (id) on delete cascade,
  swap_approval text not null default 'auto_same_grade' check (swap_approval in ('manager', 'auto_same_grade')),
  rules jsonb not null default '{}'::jsonb check (
    jsonb_typeof(rules) = 'object'
    and (rules - array['minBreakHours', 'maxNightsInRow', 'maxDaysInRow', 'maxHours7d', 'maxHours14d']) = '{}'::jsonb
  ),
  rules_source text check (rules_source is null or (btrim(rules_source) <> '' and char_length(rules_source) <= 200)),
  pay_fortnight_anchor date,
  ai_helper_consented_at timestamptz,
  ai_helper_consented_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger roster_team_settings_updated_at before update on public.roster_team_settings
  for each row execute function public.set_updated_at();

-- A published roster version. 'full' replaces every live shift in its dates; 'single_change'
-- replaces only the shifts it names (an urgent fix without re-publishing everything).
create table public.roster_publications (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.on_call_services (id) on delete cascade,
  version integer not null check (version > 0),
  kind text not null default 'full' check (kind in ('full', 'single_change')),
  period_start date not null,
  period_end date not null,
  source_name text check (source_name is null or (btrim(source_name) <> '' and char_length(source_name) <= 120)),
  published_by uuid references auth.users (id) on delete set null,
  published_at timestamptz not null default now(),
  unique (service_id, version),
  constraint roster_publications_period check (period_end >= period_start and period_end - period_start <= 186)
);
create index roster_publications_service_idx on public.roster_publications (service_id, published_at desc);

-- The live roster: every shift row still in force has superseded_at null. A person not on the
-- app is an ordinary row with user_id null and the printed name; that name is cleared 90 days
-- after the shift ends.
create table public.roster_assignments (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.on_call_services (id) on delete cascade,
  publication_id uuid not null references public.roster_publications (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  roster_name text check (roster_name is null or (btrim(roster_name) <> '' and char_length(roster_name) <= 80)),
  site_id uuid,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  shift_code text not null check (char_length(btrim(shift_code)) between 1 and 12),
  kind text not null check (kind in ('day', 'evening', 'night', 'on_call', 'leave', 'other')),
  grade text check (grade is null or grade in ('intern', 'resident', 'registrar', 'fellow', 'consultant', 'other')),
  superseded_at timestamptz,
  foreign key (site_id, service_id) references public.on_call_service_sites (id, service_id) on delete set null (site_id),
  constraint roster_assignments_ends_after_start check (ends_at > starts_at),
  constraint roster_assignments_max_length check (ends_at - starts_at <= interval '36 hours')
);
create index roster_assignments_live_service_idx on public.roster_assignments (service_id, starts_at) where superseded_at is null;
create index roster_assignments_live_user_idx on public.roster_assignments (user_id, starts_at) where superseded_at is null and user_id is not null;
create index roster_assignments_publication_idx on public.roster_assignments (publication_id);

-- A swap between two members. take_assignment_id null means a one-way give to a named colleague.
create table public.roster_swaps (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.on_call_services (id) on delete cascade,
  requester_id uuid not null references auth.users (id) on delete cascade,
  counterparty_id uuid not null references auth.users (id) on delete cascade,
  give_assignment_id uuid not null references public.roster_assignments (id) on delete cascade,
  take_assignment_id uuid references public.roster_assignments (id) on delete cascade,
  status text not null default 'requested' check (status in ('requested', 'accepted', 'approved', 'declined', 'cancelled', 'expired', 'undone')),
  needs_manager_because text check (needs_manager_because is null or needs_manager_because in ('team_setting', 'within_7_days', 'different_grade', 'team_rule')),
  auto_approved boolean not null default false,
  cancel_reason text check (cancel_reason is null or cancel_reason in ('withdrawn', 'roster_changed', 'member_left', 'no_longer_fits')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null,
  constraint roster_swaps_two_people check (requester_id <> counterparty_id),
  constraint roster_swaps_two_shifts check (take_assignment_id is null or take_assignment_id <> give_assignment_id)
);
create unique index roster_swaps_live_give_idx on public.roster_swaps (give_assignment_id) where status in ('requested', 'accepted');
create unique index roster_swaps_live_take_idx on public.roster_swaps (take_assignment_id) where status in ('requested', 'accepted') and take_assignment_id is not null;
create index roster_swaps_service_idx on public.roster_swaps (service_id, status);
create index roster_swaps_requester_idx on public.roster_swaps (requester_id);
create index roster_swaps_counterparty_idx on public.roster_swaps (counterparty_id);

-- An open shift: a shift given away, a gap a manager posts, or "I can't make my shift"
-- (status 'reported' until the manager releases it). First eligible member to claim gets it.
create table public.roster_open_shifts (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.on_call_services (id) on delete cascade,
  assignment_id uuid references public.roster_assignments (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  shift_code text not null check (char_length(btrim(shift_code)) between 1 and 12),
  kind text not null check (kind in ('day', 'evening', 'night', 'on_call', 'other')),
  site_id uuid,
  min_grade text check (min_grade is null or min_grade in ('intern', 'resident', 'registrar', 'fellow', 'consultant')),
  urgent boolean not null default false,
  status text not null default 'open' check (status in ('reported', 'open', 'claimed', 'approved', 'cancelled', 'expired')),
  posted_by uuid references auth.users (id) on delete set null,
  claimed_by uuid references auth.users (id) on delete set null,
  claimed_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (site_id, service_id) references public.on_call_service_sites (id, service_id) on delete set null (site_id),
  constraint roster_open_shifts_ends_after_start check (ends_at > starts_at),
  constraint roster_open_shifts_max_length check (ends_at - starts_at <= interval '36 hours')
);
create unique index roster_open_shifts_live_assignment_idx on public.roster_open_shifts (assignment_id)
  where status in ('reported', 'open', 'claimed') and assignment_id is not null;
create index roster_open_shifts_service_idx on public.roster_open_shifts (service_id, status, starts_at);

-- "Dates I can't work" for the next roster. No reason is ever stored.
create table public.roster_unavailability (
  service_id uuid not null,
  user_id uuid not null,
  on_date date not null,
  kind text not null check (kind in ('cant', 'prefer_off')),
  created_at timestamptz not null default now(),
  primary key (service_id, user_id, on_date),
  foreign key (service_id, user_id) references public.on_call_service_members (service_id, user_id) on delete cascade
);

-- The one planned-leave record (Admin reads it; leave is approved in the HR system).
-- Owner table: a doctor on their own can plan leave too. No reason, no sick or carer's kinds.
create table public.roster_leave (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  service_id uuid references public.on_call_services (id) on delete set null,
  kind text not null check (kind in ('annual', 'pd_leave')),
  starts_on date not null,
  ends_on date not null,
  status text not null default 'planned' check (status in ('planned', 'applied', 'approved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roster_leave_dates check (ends_on >= starts_on and ends_on - starts_on <= 366)
);
create index roster_leave_owner_idx on public.roster_leave (owner_id, starts_on);
create index roster_leave_service_idx on public.roster_leave (service_id, starts_on) where service_id is not null;
create trigger roster_leave_updated_at before update on public.roster_leave
  for each row execute function public.set_updated_at();

-- Seen receipts (Josh, 18:44Z): written once when a doctor first opens a published roster,
-- readable only by that team's roster managers, deleted with the publication at 12 months.
create table public.roster_publication_seen (
  publication_id uuid not null references public.roster_publications (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (publication_id, user_id)
);

-- =============================================================================================
-- D. Roster maker (Release 3)
-- =============================================================================================

create table public.roster_shift_codes (
  service_id uuid not null references public.on_call_services (id) on delete cascade,
  code text not null check (char_length(btrim(code)) between 1 and 12),
  kind text not null check (kind in ('day', 'evening', 'night', 'on_call', 'leave', 'other')),
  starts time,
  ends time,
  label text check (label is null or (btrim(label) <> '' and char_length(label) <= 40)),
  primary key (service_id, code),
  constraint roster_shift_codes_times check ((starts is null) = (ends is null))
);

create table public.roster_staffing_needs (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.on_call_services (id) on delete cascade,
  weekday smallint check (weekday is null or weekday between 1 and 7),
  on_date date,
  kind text not null check (kind in ('day', 'evening', 'night', 'on_call', 'other')),
  grade text check (grade is null or grade in ('intern', 'resident', 'registrar', 'fellow', 'consultant')),
  site_id uuid,
  needed smallint not null check (needed between 0 and 200),
  foreign key (site_id, service_id) references public.on_call_service_sites (id, service_id) on delete cascade,
  constraint roster_staffing_needs_day check ((weekday is null) <> (on_date is null))
);
create index roster_staffing_needs_service_idx on public.roster_staffing_needs (service_id);

-- One draft per team and period, sitting beside the published roster.
create table public.roster_drafts (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.on_call_services (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  based_on_publication_id uuid references public.roster_publications (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_id, period_start, period_end),
  constraint roster_drafts_period check (period_end >= period_start and period_end - period_start <= 186)
);
create trigger roster_drafts_updated_at before update on public.roster_drafts
  for each row execute function public.set_updated_at();

create table public.roster_draft_assignments (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.roster_drafts (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  roster_name text check (roster_name is null or (btrim(roster_name) <> '' and char_length(roster_name) <= 80)),
  site_id uuid,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  shift_code text not null check (char_length(btrim(shift_code)) between 1 and 12),
  kind text not null check (kind in ('day', 'evening', 'night', 'on_call', 'leave', 'other')),
  grade text check (grade is null or grade in ('intern', 'resident', 'registrar', 'fellow', 'consultant', 'other')),
  constraint roster_draft_assignments_ends_after_start check (ends_at > starts_at),
  constraint roster_draft_assignments_max_length check (ends_at - starts_at <= interval '36 hours')
);
create index roster_draft_assignments_draft_idx on public.roster_draft_assignments (draft_id, starts_at);

-- Every change to a draft or the live roster, saved with its undo in the same statement.
-- Typed text is never stored: only the resulting change is.
create table public.roster_changes (
  id bigint generated always as identity primary key,
  service_id uuid not null references public.on_call_services (id) on delete cascade,
  draft_id uuid references public.roster_drafts (id) on delete cascade,
  target text not null check (target in ('draft', 'live')),
  source text not null check (source in ('typed', 'grid', 'upload', 'swap', 'open_shift', 'publish')),
  change jsonb not null check (jsonb_typeof(change) = 'object'),
  undo jsonb check (undo is null or jsonb_typeof(undo) = 'object'),
  actor_id uuid references auth.users (id) on delete set null,
  at timestamptz not null default now(),
  undone_at timestamptz,
  undone_by uuid references auth.users (id) on delete set null,
  agreement_required boolean not null default false,
  constraint roster_changes_draft_target check ((target = 'draft') = (draft_id is not null))
);
create index roster_changes_service_at_idx on public.roster_changes (service_id, at desc);
create index roster_changes_draft_idx on public.roster_changes (draft_id) where draft_id is not null;

-- A doctor's agreement to a change made after publishing (the award expects it; payroll needs it).
create table public.roster_change_agreements (
  change_id bigint not null references public.roster_changes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  agreed_at timestamptz not null default now(),
  primary key (change_id, user_id)
);

-- Tenancy for every table in this file.
do $tenancy$
declare t text;
begin
  foreach t in array array[
    'roster_calendar_links', 'web_push_subscriptions', 'roster_member_roles', 'roster_team_settings',
    'roster_publications', 'roster_assignments', 'roster_swaps', 'roster_open_shifts',
    'roster_unavailability', 'roster_leave', 'roster_publication_seen', 'roster_shift_codes',
    'roster_staffing_needs', 'roster_drafts', 'roster_draft_assignments', 'roster_changes',
    'roster_change_agreements'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to service_role', t);
  end loop;
end
$tenancy$;

-- =============================================================================================
-- E. Functions
-- =============================================================================================

-- A manager may invite, as member only (On Call's command enforces the member role and calls
-- this at join, through its run-time case statement).
create function public.roster_can_invite(p_service_id uuid, p_user_id uuid) returns boolean
language plpgsql stable security invoker set search_path = public, pg_catalog, pg_temp as $$
begin
  return public.service_member_active(p_service_id, p_user_id)
    and exists (
      select 1 from public.roster_member_roles
      where service_id = p_service_id and user_id = p_user_id and role = 'manager' and revoked_at is null
    );
end $$;

-- Revoke cascade (contract §10). The WHEN clause is required: a rejoin clears revoked_at and
-- must not re-revoke anything. Roles are not restored on rejoin; they are granted again.
create function public.roster_on_membership_revoked() returns trigger
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
begin
  update public.roster_member_roles set revoked_at = now()
   where service_id = new.service_id and user_id = new.user_id and revoked_at is null;
  if found then
    insert into public.on_call_service_member_events (service_id, user_id, event, mode, actor_id)
    values (new.service_id, new.user_id, 'revoked', 'roster', null);
  end if;
  update public.roster_swaps
     set status = 'cancelled', cancel_reason = 'member_left', decided_at = now()
   where service_id = new.service_id and status in ('requested', 'accepted')
     and (requester_id = new.user_id or counterparty_id = new.user_id);
  update public.roster_open_shifts
     set status = 'open', claimed_by = null, claimed_at = null
   where service_id = new.service_id and status = 'claimed' and claimed_by = new.user_id;
  delete from public.roster_unavailability where service_id = new.service_id and user_id = new.user_id;
  return null;
end $$;
create trigger roster_on_membership_revoked
  after update of revoked_at on public.on_call_service_members
  for each row when (old.revoked_at is null and new.revoked_at is not null)
  execute function public.roster_on_membership_revoked();

-- Own-shift import. Replaces only imported shifts of the same workplace inside the window
-- (Perth dates), records the import, keeps the 10 newest imports, all in one transaction.
create function public.roster_own_shifts_replace(
  p_owner_id uuid,
  p_window_start date,
  p_window_end date,
  p_format text,
  p_workplace text,
  p_file_name text,
  p_shifts jsonb,
  p_changes jsonb,
  p_added integer,
  p_changed integer,
  p_removed integer
) returns uuid
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
declare v_import uuid;
begin
  if p_owner_id is null or p_window_start is null or p_window_end is null
    or p_window_end < p_window_start or p_window_end - p_window_start > 400
    or p_shifts is null or jsonb_typeof(p_shifts) <> 'array' or jsonb_array_length(p_shifts) > 1000
    or p_changes is null or jsonb_typeof(p_changes) <> 'array' then
    raise exception 'on_call_shifts_invalid_request';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_owner_id::text, 74817));

  delete from public.on_call_shifts
  where owner_id = p_owner_id
    and source = 'import'
    and workplace is not distinct from p_workplace
    and (starts_at at time zone 'Australia/Perth')::date between p_window_start and p_window_end;

  insert into public.on_call_shifts (owner_id, starts_at, ends_at, title, location, source_uid, source, kind, workplace)
  select p_owner_id,
         (shift ->> 'startsAt')::timestamptz,
         (shift ->> 'endsAt')::timestamptz,
         shift ->> 'title',
         nullif(shift ->> 'location', ''),
         nullif(shift ->> 'sourceUid', ''),
         'import',
         nullif(shift ->> 'kind', ''),
         p_workplace
  from jsonb_array_elements(p_shifts) as shift;

  if (select count(*) from public.on_call_shifts where owner_id = p_owner_id) > 2000 then
    raise exception 'on_call_shifts_limit';
  end if;

  insert into public.on_call_shift_imports
    (owner_id, format, window_start, window_end, added, changed, removed, changes, workplace, file_name)
  values
    (p_owner_id, p_format, p_window_start, p_window_end, p_added, p_changed, p_removed, p_changes, p_workplace, p_file_name)
  returning id into v_import;

  delete from public.on_call_shift_imports
  where owner_id = p_owner_id
    and id not in (
      select id from public.on_call_shift_imports
      where owner_id = p_owner_id
      order by imported_at desc, id desc
      limit 10
    );

  return v_import;
end $$;

-- Grade order for swap and open-shift eligibility: a more senior doctor may take a junior's
-- shift, never the other way round. 'other' and unknown grades are left out of matching.
create function public.roster_grade_rank(p_grade text) returns integer
language sql immutable security invoker set search_path = public, pg_catalog, pg_temp as $$
  select case p_grade
    when 'intern' then 1 when 'resident' then 2 when 'registrar' then 3
    when 'fellow' then 4 when 'consultant' then 5 else null end
$$;

-- Would putting p_user_id on [p_starts, p_ends) clash with their other live shifts in this
-- team, or leave a break shorter than the team's rule? Team roster only: a colleague's other
-- job or personal shifts are never read. Returns null, 'clash' or 'short_break'.
create function public.roster_placement_problem(
  p_service_id uuid,
  p_user_id uuid,
  p_starts timestamptz,
  p_ends timestamptz,
  p_exclude uuid[],
  p_min_break_hours numeric
) returns text
language plpgsql stable security invoker set search_path = public, pg_catalog, pg_temp as $$
begin
  if exists (
    select 1 from public.roster_assignments a
    where a.service_id = p_service_id and a.user_id = p_user_id and a.superseded_at is null
      and a.kind <> 'leave' and not (a.id = any (coalesce(array_remove(p_exclude, null), '{}')))
      and a.starts_at < p_ends and a.ends_at > p_starts
  ) or exists (
    select 1 from public.roster_assignments a
    where a.service_id = p_service_id and a.user_id = p_user_id and a.superseded_at is null
      and a.kind = 'leave' and a.starts_at < p_ends and a.ends_at > p_starts
  ) then
    return 'clash';
  end if;
  if p_min_break_hours is not null and exists (
    select 1 from public.roster_assignments a
    where a.service_id = p_service_id and a.user_id = p_user_id and a.superseded_at is null
      and a.kind not in ('leave', 'on_call') and not (a.id = any (coalesce(array_remove(p_exclude, null), '{}')))
      and (
        (a.ends_at <= p_starts and p_starts - a.ends_at < make_interval(secs => p_min_break_hours * 3600))
        or (a.starts_at >= p_ends and a.starts_at - p_ends < make_interval(secs => p_min_break_hours * 3600))
      )
  ) then
    return 'short_break';
  end if;
  return null;
end $$;

-- The name colleagues see: the member's own display name, else the printed roster name.
create function public.roster_person_name(p_service_id uuid, p_user_id uuid, p_roster_name text) returns text
language sql stable security invoker set search_path = public, pg_catalog, pg_temp as $$
  select coalesce(
    (select m.display_name from public.on_call_service_members m
      where m.service_id = p_service_id and m.user_id = p_user_id),
    (select r.roster_name from public.roster_member_roles r
      where r.service_id = p_service_id and r.user_id = p_user_id and r.revoked_at is null),
    p_roster_name
  )
$$;

-- One assignment as members see it. No other personal field is ever returned.
create function public.roster_assignment_json(a public.roster_assignments) returns jsonb
language sql stable security invoker set search_path = public, pg_catalog, pg_temp as $$
  select jsonb_build_object(
    'id', a.id, 'userId', a.user_id,
    'name', public.roster_person_name(a.service_id, a.user_id, a.roster_name),
    'grade', coalesce(a.grade, (select r.grade from public.roster_member_roles r
                                where r.service_id = a.service_id and r.user_id = a.user_id and r.revoked_at is null)),
    'siteId', a.site_id,
    'siteName', (select s.name from public.on_call_service_sites s where s.id = a.site_id),
    'startsAt', a.starts_at, 'endsAt', a.ends_at, 'shiftCode', a.shift_code, 'kind', a.kind
  )
$$;
```

**Part E, the two team functions: write `roster_read` and `roster_command` to this spec.** They go straight after `roster_assignment_json` above, and before `roster_set_manager` below. They are the largest part of the file (about 840 lines), so the plan gives their contract, not their text. If the finished copy is available (see "Where each file comes from"), take its two function bodies unchanged instead: they are the ones the behaviour script was replayed against.

Both functions:

- Are `language plpgsql security invoker set search_path = public, pg_catalog, pg_temp`. `roster_read` is also `stable`. Execute is granted to `service_role` only, by the grants block below.
- Take the actor from the validated session (`p_actor_id`); they never read `auth.users`.
- Raise only these error codes, as the exception message: `roster_auth_required`, `roster_invalid_request`, `roster_access_denied`, `roster_team_not_verified`, `roster_role_denied`, `roster_not_found`, `roster_request_exists`, `roster_swap_not_eligible`, `roster_open_shift_taken`, `roster_conflict`, `roster_limit`.
- Check in this order: a null actor raises `roster_auth_required`; a payload that is not a JSON object raises `roster_invalid_request`; a missing service, or an actor who is not an active member (`service_member_active`), raises `roster_access_denied`; a service with `verified_at is null and not is_demo` raises `roster_team_not_verified`. A manager is an actor with an active `roster_member_roles` row whose `role = 'manager'`. Manager-only reads and actions raise `roster_role_denied` for anyone else.
- Treat Perth dates as `(ts at time zone 'Australia/Perth')::date`.
- Treat an unknown `p_what` or `p_action` as `roster_invalid_request`.

`roster_read(p_actor_id uuid, p_service_id uuid, p_what text, p_payload jsonb default '{}') returns jsonb`:

| `p_what`         | Who           | Returns                                                                                                                                                                                                                                                                                                          |
| ---------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `teams`          | Any signed-in | Answered before any service check: `{teams: [{serviceId, name, enabled, role, grade}]}` for every service where the actor is an active member, ordered by name. `enabled` is `verified_at is not null or is_demo`; `role` defaults to `member`.                                                                  |
| `overview`       | Member        | `{service: {id, name}, me: {role, grade, rotationEndsOn}, latestPublication: {id, version, publishedAt, periodStart, periodEnd} or null, seenLatest, settings: {swapApproval, rules, rulesSource, payFortnightAnchor}, sites: [{id, name}]}`. Settings default to `auto_same_grade`, `{}`, null, null.           |
| `assignments`    | Member        | `{assignments: [...]}`: live rows (`superseded_at is null`) whose Perth start date is between `from` and `to`, each as `roster_assignment_json`, ordered by start.                                                                                                                                               |
| `requests`       | Member        | `{swaps, openShifts}`: the actor's own swaps (as requester or counterparty) from the last 60 days, with `give` and `take` as assignment JSON; and open shifts that end in the future and that the actor posted or claimed, or that are `open` with no minimum grade or a minimum the actor's grade meets.        |
| `unavailability` | Member        | `{unavailability: [{userId, date, kind}]}` between `from` and `to`: a manager sees everyone's, a member only their own.                                                                                                                                                                                          |
| `leave_overlap`  | Member        | `{alreadyOff: n}`: how many other active members have planned leave overlapping `from` to `to`. A count only, never who.                                                                                                                                                                                         |
| `manage`         | Manager       | `{swaps, openShifts, seen}`: swaps waiting for the manager (`accepted`) or auto-approved in the last 14 days; open shifts that are `reported`, `open` or `claimed` and end in the future; for the latest publication, `{publicationId, version, seen, members, notSeen: [userId]}` counting active members only. |
| `people`         | Manager       | `{people: [{userId, displayName, joinedAt, serviceRole, role, grade, rosterName, rotationEndsOn}]}` for active members.                                                                                                                                                                                          |
| `publications`   | Manager       | `{publications: [{id, version, kind, periodStart, periodEnd, sourceName, publishedAt}]}`, the newest 50.                                                                                                                                                                                                         |
| `maker`          | Manager       | `{codes, needs, drafts}` for the team.                                                                                                                                                                                                                                                                           |
| `draft`          | Manager       | For `draftId` (it must belong to the team, else `roster_not_found`): `{assignments, changes}`, where each assignment's name comes from `roster_person_name` and changes are the newest 100.                                                                                                                      |

`assignments`, `unavailability` and `leave_overlap` need `from` and `to` dates in the payload, with `to >= from` and at most 62 days apart; otherwise they raise `roster_invalid_request`.

`roster_command(p_actor_id uuid, p_service_id uuid, p_action text, p_payload jsonb default '{}') returns jsonb`:

- `member.remove` takes the service row `FOR UPDATE`, because it changes membership; every other action takes it `FOR SHARE`. A lock is never upgraded mid-call.
- `seen.mark` is a check-in. It runs before the advisory lock, so it never waits on other writes: the publication must belong to the team (else `roster_not_found`), and the actor's receipt is inserted once (a repeat does nothing). Every other action first takes `pg_advisory_xact_lock(hashtextextended(p_service_id::text, 74817))`.

| Action                    | Who                                                                                                                                                                      | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `role.set`                | Manager                                                                                                                                                                  | Sets `grade` (one of the six grades, or null), `rosterName` and `rotationEndsOn` for an active member (else `roster_not_found`); only keys present in the payload change. It never names a manager: a new row is `member`, an active row keeps its role, and a revoked row comes back as `member`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `member.remove`           | Manager                                                                                                                                                                  | Revokes an ordinary service member (`role = 'member'`, never an editor or admin; never the actor, which raises `roster_invalid_request`): sets `revoked_at = now()` and `clinical_reviewer = false`, writes a `revoked` audit row, and so fires every mode's revoke cascade. No such member raises `roster_not_found`.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `settings.set`            | Manager                                                                                                                                                                  | Upserts `roster_team_settings`: `swapApproval` (default `auto_same_grade`), `rules` (the table check allows only its five keys), `rulesSource` and `payFortnightAnchor`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `unavailability.set`      | Member, for themselves                                                                                                                                                   | `{set: [{date, kind}], clear: [date]}`: clears the listed dates, then sets future Perth dates only; more than 120 dates for one person raises `roster_limit`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `publish`                 | Manager                                                                                                                                                                  | `{kind: 'full' or 'single_change', periodStart, periodEnd, sourceName?, replaceAssignmentIds?, assignments (at most 5,000), draftId?}`, all or nothing. Each row names an active member or a printed `rosterName` and starts inside the period, else `roster_invalid_request`. The version is the team's previous version plus one. A full publish supersedes every live row starting in the period; a single change supersedes exactly `replaceAssignmentIds` (a count mismatch raises `roster_conflict`). It then inserts the rows, cancels pending swaps (`roster_changed`) and open shifts on superseded rows, logs a `publish` change, records the manager's own seen receipt, deletes the draft if given, and returns `{publicationId, version}` plus the cancelled swaps. |
| `swap.create`             | Member                                                                                                                                                                   | Gives the actor's own future, non-leave live row (`giveAssignmentId`) to another active member (`counterpartyId`), optionally taking one of theirs (`takeAssignmentId`); anything else raises `roster_not_found`. A live request or open shift already on either row raises `roster_request_exists`. The request expires at the earlier of the two starts and seven days from now. It must pass the eligibility check below, else `roster_swap_not_eligible`.                                                                                                                                                                                                                                                                                                                    |
| `swap.accept`             | The counterparty, on a `requested` swap                                                                                                                                  | Rechecks eligibility (below). If the swap needs the manager, it becomes `accepted` with `needs_manager_because`, taking the first that applies: `team_setting` (the team chose `manager`), `within_7_days`, `different_grade`, `team_rule` (the team's minimum break). Otherwise it is applied at once and marked `auto_approved`.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `swap.approve`            | A manager who is not part of the swap, on an `accepted` swap                                                                                                             | Rechecks eligibility, then applies it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `swap.decline`            | The counterparty on `requested`, or a manager not part of it on `accepted`                                                                                               | Sets `declined`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `swap.cancel`             | The requester, while `requested` or `accepted`                                                                                                                           | Sets `cancelled` with `withdrawn`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `swap.undo`               | Either doctor, within 10 minutes of an auto-approval                                                                                                                     | Puts both rows back, sets `undone` and marks the change undone. If anything moved since, it raises `roster_conflict`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `open.post`               | A member for their own live row that has not ended; a manager for any such row, or for a gap (`startsAt`, `endsAt`, `shiftCode`, `kind`, `siteId`, `minGrade`, `urgent`) | Creates an `open` shift. The minimum grade comes from the row (never `other`); only a manager can mark it urgent; a gap that starts in the past raises `roster_invalid_request`. A live swap on the row raises `roster_request_exists`, and more than 1,000 live open shifts per team raises `roster_limit`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `open.report`             | A member, for their own live row ("I can't make my shift"); a manager for any                                                                                            | Creates a `reported`, urgent open shift that waits for the manager.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `open.release`            | Manager, on `reported`                                                                                                                                                   | Sets `open` (urgent unless the payload says otherwise).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `open.cancel`             | The poster or a manager, while `reported`, `open` or `claimed`                                                                                                           | Sets `cancelled`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `open.claim`              | A member other than the poster, on an `open`, future shift                                                                                                               | A shift that is no longer `open` raises `roster_open_shift_taken`. The taker's grade must meet the minimum and the shift must fit their roster (`roster_placement_problem` is null), else `roster_swap_not_eligible`. It needs the manager (and becomes `claimed`) when the team chose `manager`, it starts within 7 days, there is no minimum grade or the grades differ, or it breaks the team's minimum break; otherwise it is applied at once.                                                                                                                                                                                                                                                                                                                               |
| `open.approve`            | A manager who is not the claimer, on `claimed`                                                                                                                           | Rechecks the claim, then applies it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `open.decline`            | A manager who is not the claimer, on `claimed`                                                                                                                           | Returns it to `open` and clears the claim.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `codes.set` / `needs.set` | Manager                                                                                                                                                                  | Replaces all of the team's shift codes (at most 100) or staffing needs (at most 2,000); more raises `roster_limit`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `draft.open`              | Manager                                                                                                                                                                  | Returns the draft for the period if one exists (`created: false`); otherwise creates one (at most 12 per team) copied from the live roster (`created: true`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `draft.change`            | Manager                                                                                                                                                                  | `{draftId, source, ops}`: at most 500 ops of `add`, `remove` or `update`, one `roster_changes` row per op with its undo, all in one transaction. A missing row raises `roster_conflict`; more than 5,000 rows in the draft raises `roster_limit`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `draft.undo`              | Manager                                                                                                                                                                  | Reverses one change of the draft that is not already undone (else `roster_not_found`) and marks it undone.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `agreement.record`        | Member                                                                                                                                                                   | Records the actor's agreement to a change of this team that needs agreement and is not undone (else `roster_not_found`); a repeat does nothing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

Eligibility, checked at `swap.create`, `swap.accept` and `swap.approve`: the rows are still live and still held by the same two people (else `roster_changed`); the taker's grade rank (`roster_grade_rank`) is at least the giver's, both ways for a two-way swap, and a missing or `other` grade never matches (else `no_longer_fits`); and neither person ends up with a clash (`roster_placement_problem` returns `clash`, else `no_longer_fits`). At `swap.create` a failure raises `roster_swap_not_eligible`. Later it cancels the swap with that reason and returns `{status: 'cancelled', cancelReason}`. An expired swap becomes `expired` instead.

Applying a swap moves both rows in one step, sets `roster_name` to null on them, writes a `roster_changes` row (source `swap`) holding the undo, and cancels any other pending swap on those rows with `roster_changed`. Applying a claim moves the row to the taker (a claimed gap becomes a new row on the latest publication; none raises `roster_conflict`), sets the open shift to `approved`, and writes a `roster_changes` row (source `open_shift`) holding the undo.

**The platform manager switch, retention, grants and the nightly job: exactly this SQL, at the end of the file.**

```sql
-- The platform path that names or removes a roster manager (Josh's confirm button, from the
-- owner panel). Managers are never self-appointed.
create function public.roster_set_manager(p_service_id uuid, p_user_id uuid, p_actor_id uuid, p_manager boolean)
returns jsonb
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
begin
  if p_service_id is null or p_user_id is null or p_actor_id is null or p_manager is null then
    raise exception 'roster_invalid_request';
  end if;
  perform 1 from public.on_call_services where id = p_service_id for share;
  if not found or not public.service_member_active(p_service_id, p_user_id) then raise exception 'roster_not_found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_service_id::text, 74817));
  insert into public.roster_member_roles (service_id, user_id, role, granted_by)
  values (p_service_id, p_user_id, case when p_manager then 'manager' else 'member' end, p_actor_id)
  on conflict (service_id, user_id) do update set
    role = excluded.role, granted_by = excluded.granted_by, granted_at = now(), revoked_at = null;
  insert into public.on_call_service_member_events (service_id, user_id, event, mode, actor_id)
  values (p_service_id, p_user_id, 'role_changed', 'roster', p_actor_id);
  return jsonb_build_object('ok', true);
end $$;

-- 12-month retention (Josh). Runs nightly from pg_cron. Printed names of people not on the app
-- are cleared 90 days after the shift ends.
create function public.roster_retention_purge() returns jsonb
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
declare v_publications integer; v_events integer; v_names integer;
begin
  delete from public.roster_publications where published_at < now() - interval '12 months';
  get diagnostics v_publications = row_count;
  delete from public.roster_swaps where created_at < now() - interval '12 months';
  delete from public.roster_open_shifts where created_at < now() - interval '12 months';
  delete from public.roster_changes where at < now() - interval '12 months';
  delete from public.roster_drafts where updated_at < now() - interval '12 months';
  delete from public.roster_unavailability where on_date < (now() at time zone 'Australia/Perth')::date - 30;
  delete from public.roster_leave where ends_on < (now() at time zone 'Australia/Perth')::date - 365;
  delete from public.on_call_service_member_events where at < now() - interval '12 months';
  get diagnostics v_events = row_count;
  update public.roster_assignments set roster_name = null
   where user_id is null and roster_name is not null and ends_at < now() - interval '90 days';
  get diagnostics v_names = row_count;
  return jsonb_build_object('publications', v_publications, 'memberEvents', v_events, 'namesCleared', v_names);
end $$;

do $grants$
declare f text;
begin
  foreach f in array array[
    'public.roster_can_invite(uuid, uuid)',
    'public.roster_own_shifts_replace(uuid, date, date, text, text, text, jsonb, jsonb, integer, integer, integer)',
    'public.roster_grade_rank(text)',
    'public.roster_placement_problem(uuid, uuid, timestamptz, timestamptz, uuid[], numeric)',
    'public.roster_person_name(uuid, uuid, text)',
    'public.roster_assignment_json(public.roster_assignments)',
    'public.roster_read(uuid, uuid, text, jsonb)',
    'public.roster_command(uuid, uuid, text, jsonb)',
    'public.roster_set_manager(uuid, uuid, uuid, boolean)',
    'public.roster_retention_purge()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
  foreach f in array array[
    'public.roster_on_membership_revoked()',
    'public.roster_calendar_links_cap()',
    'public.web_push_subscriptions_cap()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end
$grants$;

-- Nightly retention job. pg_cron is already enabled (20260901033250).
do $roster_retention$
declare job record;
begin
  if to_regprocedure('public.roster_retention_purge()') is null then
    raise exception 'Missing public.roster_retention_purge()';
  end if;
  for job in select jobid from cron.job where jobname = 'roster-retention-purge' loop
    perform cron.unschedule(job.jobid);
  end loop;
  perform cron.schedule('roster-retention-purge', '20 3 * * *', $job$select public.roster_retention_purge();$job$);
end
$roster_retention$;
```

Then create `tests/sql/roster-behaviour.sql` with exactly this content. It runs in one transaction against a disposable replay (Step 3 of Task 5), never against a live database. Every block raises on a wrong answer, so a clean run prints only its last line. All names and emails are invented.

```sql
-- Behaviour checks for the combined Roster DB PR, run against a disposable replay of files 1-5.
-- Every block raises on a wrong answer, so a clean run prints only the final line.
-- Run: psql -v ON_ERROR_STOP=1 -1 -f tests/sql/roster-behaviour.sql   (never against a live database)
create temp table ids (k text primary key, v uuid) on commit drop;
grant all on ids to service_role;

do $setup$
declare s uuid; site uuid;
begin
  insert into ids values
    ('mgr', gen_random_uuid()), ('lee', gen_random_uuid()), ('mei', gen_random_uuid()),
    ('alex', gen_random_uuid()), ('ivy', gen_random_uuid()), ('out', gen_random_uuid()), ('adm', gen_random_uuid());
  insert into auth.users (id, email) select v, k || '@example.org' from ids;
  insert into public.on_call_services (name, created_by) values ('General Medicine', (select v from ids where k = 'adm')) returning id into s;
  insert into public.on_call_service_sites (service_id, name) values (s, 'Example Hospital') returning id into site;
  insert into ids values ('svc', s), ('site', site);
  insert into public.on_call_service_members (service_id, user_id, role)
  select s, v, case when k = 'adm' then 'admin' else 'member' end from ids where k in ('mgr', 'lee', 'mei', 'alex', 'ivy', 'adm');
end
$setup$;

create function pg_temp.id(p text) returns uuid language sql as $$ select v from ids where k = p $$;
create function pg_temp.expect_error(p_sql text, p_code text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'expected % but the call succeeded: %', p_code, p_sql;
exception when others then
  if sqlerrm <> p_code then raise exception 'expected %, got %: %', p_code, sqlerrm, p_sql; end if;
end $$;
create function pg_temp.cmd(p_actor text, p_action text, p_payload jsonb) returns jsonb language sql as $$
  select public.roster_command(pg_temp.id(p_actor), pg_temp.id('svc'), p_action, p_payload)
$$;
-- The Supabase image revokes execute from public by default, so grant the helpers explicitly.
grant execute on function pg_temp.id(text), pg_temp.expect_error(text, text), pg_temp.cmd(text, text, jsonb)
  to service_role;
-- Everything below runs as the app does: as service_role, through the functions.
set local role service_role;

-- 1. Own shifts: an import never deletes a hand-added shift, and workplaces stay separate.
do $own$
declare me uuid := pg_temp.id('lee');
begin
  insert into public.on_call_shifts (owner_id, starts_at, ends_at, title, source, kind)
  values (me, '2026-10-14 06:00+00', '2026-10-14 14:30+00', 'My own', 'manual', 'day');
  perform public.roster_own_shifts_replace(me, '2026-10-12', '2026-10-18', 'xlsx', null, 'Oct.xlsx',
    '[{"startsAt":"2026-10-13T00:00:00Z","endsAt":"2026-10-13T08:30:00Z","title":"Day","location":null,"sourceUid":null,"kind":"day"}]',
    '[]', 1, 0, 0);
  perform public.roster_own_shifts_replace(me, '2026-10-12', '2026-10-18', 'ics', 'Example Clinic', null,
    '[{"startsAt":"2026-10-15T00:00:00Z","endsAt":"2026-10-15T04:00:00Z","title":"Clinic","location":null,"sourceUid":"u1","kind":"other"}]',
    '[]', 1, 0, 0);
  perform public.roster_own_shifts_replace(me, '2026-10-12', '2026-10-18', 'xlsx', null, 'Oct v2.xlsx', '[]', '[]', 0, 0, 1);
  if (select count(*) from public.on_call_shifts where owner_id = me) <> 2 then
    raise exception 'own shifts: expected the manual and the clinic shift to survive';
  end if;
  -- The original function still works for the live app until Release 1 ships.
  perform public.on_call_shifts_replace(me, '2026-10-20', '2026-10-20', 'csv',
    '[{"startsAt":"2026-10-20T00:00:00Z","endsAt":"2026-10-20T08:00:00Z","title":"Day","location":null,"sourceUid":null}]',
    '[]', 1, 0, 0);
  if (select count(*) from public.on_call_shifts where owner_id = me) <> 3 then raise exception 'old function broke'; end if;
end
$own$;

-- 2. Team features stay off until the platform verifies the team.
select pg_temp.expect_error($$select pg_temp.cmd('lee', 'seen.mark', '{}')$$, 'roster_team_not_verified');
select public.on_call_service_set_verified(pg_temp.id('svc'), pg_temp.id('adm'), true, false);
select pg_temp.expect_error($$select pg_temp.cmd('out', 'seen.mark', '{}')$$, 'roster_access_denied');

-- 3. Managers are named by the platform, never by themselves.
select pg_temp.expect_error($$select pg_temp.cmd('mgr', 'role.set', '{"userId":"00000000-0000-0000-0000-000000000000"}')$$, 'roster_role_denied');
select public.roster_set_manager(pg_temp.id('svc'), pg_temp.id('mgr'), pg_temp.id('adm'), true);
select pg_temp.cmd('mgr', 'role.set', jsonb_build_object('userId', pg_temp.id('lee'), 'grade', 'resident', 'rosterName', 'L Lee'));
select pg_temp.cmd('mgr', 'role.set', jsonb_build_object('userId', pg_temp.id('mei'), 'grade', 'resident'));
select pg_temp.cmd('mgr', 'role.set', jsonb_build_object('userId', pg_temp.id('alex'), 'grade', 'registrar'));
select pg_temp.cmd('mgr', 'role.set', jsonb_build_object('userId', pg_temp.id('ivy'), 'grade', 'intern'));
select pg_temp.cmd('mgr', 'role.set', jsonb_build_object('userId', pg_temp.id('mgr'), 'grade', 'consultant'));
do $$ begin
  if not public.roster_can_invite(pg_temp.id('svc'), pg_temp.id('mgr')) then raise exception 'manager should invite'; end if;
  if public.roster_can_invite(pg_temp.id('svc'), pg_temp.id('lee')) then raise exception 'member must not invite'; end if;
end $$;

-- 4. Publish: members cannot, managers can; all or nothing.
select pg_temp.expect_error($$select pg_temp.cmd('lee', 'publish', '{"periodStart":"2026-11-02","periodEnd":"2026-11-15","assignments":[]}')$$, 'roster_role_denied');
select pg_temp.expect_error($$select pg_temp.cmd('mgr', 'publish', jsonb_build_object('periodStart','2026-11-02','periodEnd','2026-11-15',
  'assignments', jsonb_build_array(jsonb_build_object('userId', pg_temp.id('out'), 'startsAt','2026-11-03T00:00:00Z','endsAt','2026-11-03T08:30:00Z','shiftCode','D','kind','day'))))$$,
  'roster_invalid_request');

create temp table plan_rows on commit drop as
select * from (values
  ('lee',  '2026-11-07T00:00:00Z', '2026-11-08T00:00:00Z', 'C', 'on_call'),
  ('mei',  '2026-11-14T00:00:00Z', '2026-11-15T00:00:00Z', 'C', 'on_call'),
  ('lee',  '2026-11-10T13:30:00Z', '2026-11-11T00:00:00Z', 'N', 'night'),
  ('alex', '2026-11-10T00:00:00Z', '2026-11-10T08:30:00Z', 'D', 'day'),
  ('ivy',  '2026-11-12T00:00:00Z', '2026-11-12T08:30:00Z', 'D', 'day')
) as t (who, starts_at, ends_at, code, kind);
grant all on plan_rows to service_role;

do $publish$
declare r jsonb;
begin
  r := pg_temp.cmd('mgr', 'publish', jsonb_build_object('periodStart', '2026-11-02', 'periodEnd', '2026-11-15', 'sourceName', 'Nov.xlsx',
    'assignments', (select jsonb_agg(jsonb_build_object('userId', pg_temp.id(who), 'startsAt', starts_at, 'endsAt', ends_at,
                    'shiftCode', code, 'kind', kind, 'siteId', pg_temp.id('site'))) from plan_rows)
    || jsonb_build_array(jsonb_build_object('rosterName', 'Locum 1', 'startsAt', '2026-11-11T00:00:00Z', 'endsAt', '2026-11-11T08:30:00Z', 'shiftCode', 'D', 'kind', 'day'))));
  if (r ->> 'version')::int <> 1 then raise exception 'publish: expected version 1, got %', r; end if;
  if jsonb_array_length(public.roster_read(pg_temp.id('lee'), pg_temp.id('svc'), 'assignments',
       '{"from":"2026-11-02","to":"2026-11-15"}') -> 'assignments') <> 6 then
    raise exception 'publish: expected 6 live rows';
  end if;
end
$publish$;

-- 5. A clean same-grade swap more than 7 days away approves itself, and can be undone for 10 minutes.
do $swap$
declare give uuid; take uuid; r jsonb; sid uuid;
begin
  select id into give from public.roster_assignments where user_id = pg_temp.id('lee') and shift_code = 'C';
  select id into take from public.roster_assignments where user_id = pg_temp.id('mei') and shift_code = 'C';
  r := pg_temp.cmd('lee', 'swap.create', jsonb_build_object('giveAssignmentId', give, 'takeAssignmentId', take, 'counterpartyId', pg_temp.id('mei')));
  sid := (r ->> 'swapId')::uuid;
  perform pg_temp.expect_error(format($f$select pg_temp.cmd('lee', 'swap.create', %L)$f$,
    jsonb_build_object('giveAssignmentId', give, 'counterpartyId', pg_temp.id('alex'))), 'roster_request_exists');
  r := pg_temp.cmd('mei', 'swap.accept', jsonb_build_object('swapId', sid));
  if r ->> 'status' <> 'approved' or not (r ->> 'autoApproved')::boolean then raise exception 'swap: expected auto approval, got %', r; end if;
  if (select user_id from public.roster_assignments where id = give) <> pg_temp.id('mei') then raise exception 'swap: give not moved'; end if;
  if (select user_id from public.roster_assignments where id = take) <> pg_temp.id('lee') then raise exception 'swap: take not moved'; end if;
  r := pg_temp.cmd('lee', 'swap.undo', jsonb_build_object('swapId', sid));
  if (select user_id from public.roster_assignments where id = give) <> pg_temp.id('lee') then raise exception 'undo failed'; end if;
end
$swap$;

-- 6. Grade: an intern may not take a resident's shift; a registrar may.
do $grade$
declare night uuid;
begin
  select id into night from public.roster_assignments where user_id = pg_temp.id('lee') and shift_code = 'N';
  perform pg_temp.expect_error(format($f$select pg_temp.cmd('lee', 'swap.create', %L)$f$,
    jsonb_build_object('giveAssignmentId', night, 'counterpartyId', pg_temp.id('ivy'))), 'roster_swap_not_eligible');
end
$grade$;

-- 7. A clash is refused: Alex's day shift overlaps nothing, but giving Lee's night to Alex while
--    Alex already works 00:00-08:30 on the 10th Perth time must be checked by time, not by date.
do $clash$
declare night uuid; r jsonb;
begin
  select id into night from public.roster_assignments where user_id = pg_temp.id('lee') and shift_code = 'N';
  insert into public.roster_assignments (service_id, publication_id, user_id, starts_at, ends_at, shift_code, kind)
  select pg_temp.id('svc'), publication_id, pg_temp.id('alex'), '2026-11-10T14:00:00Z', '2026-11-10T20:00:00Z', 'E', 'evening'
  from public.roster_assignments where id = night;
  perform pg_temp.expect_error(format($f$select pg_temp.cmd('lee', 'swap.create', %L)$f$,
    jsonb_build_object('giveAssignmentId', night, 'counterpartyId', pg_temp.id('alex'))), 'roster_swap_not_eligible');
end
$clash$;

-- 8. Open shifts: first eligible member to claim gets it; the second is told it's taken.
do $open$
declare day uuid; r jsonb; oid uuid;
begin
  select id into day from public.roster_assignments where user_id = pg_temp.id('ivy') and shift_code = 'D';
  r := pg_temp.cmd('ivy', 'open.post', jsonb_build_object('assignmentId', day));
  oid := (r ->> 'openShiftId')::uuid;
  r := pg_temp.cmd('lee', 'open.claim', jsonb_build_object('openShiftId', oid));
  if r ->> 'status' not in ('approved', 'claimed') then raise exception 'open: claim failed %', r; end if;
  perform pg_temp.expect_error(format($f$select pg_temp.cmd('mei', 'open.claim', %L)$f$, jsonb_build_object('openShiftId', oid)),
    case when r ->> 'status' = 'approved' then 'roster_open_shift_taken' else 'roster_open_shift_taken' end);
end
$open$;

-- 9. Seen receipts: members write their own; only managers read the count.
do $seen$
declare pub uuid; r jsonb;
begin
  select id into pub from public.roster_publications where service_id = pg_temp.id('svc');
  perform pg_temp.cmd('lee', 'seen.mark', jsonb_build_object('publicationId', pub));
  perform pg_temp.cmd('lee', 'seen.mark', jsonb_build_object('publicationId', pub));
  perform pg_temp.expect_error($$select public.roster_read(pg_temp.id('lee'), pg_temp.id('svc'), 'manage', '{}')$$, 'roster_role_denied');
  r := public.roster_read(pg_temp.id('mgr'), pg_temp.id('svc'), 'manage', '{}');
  if (r #>> '{seen,seen}')::int <> 2 or (r #>> '{seen,members}')::int <> 6 then raise exception 'seen: got %', r -> 'seen'; end if;
end
$seen$;

-- 10. A new full publish replaces the period and cancels pending requests on replaced shifts.
do $republish$
declare give uuid; r jsonb;
begin
  select id into give from public.roster_assignments where user_id = pg_temp.id('alex') and shift_code = 'D' and superseded_at is null;
  perform pg_temp.cmd('alex', 'swap.create', jsonb_build_object('giveAssignmentId', give, 'counterpartyId', pg_temp.id('mgr')));
  r := pg_temp.cmd('mgr', 'publish', jsonb_build_object('periodStart', '2026-11-02', 'periodEnd', '2026-11-15',
    'assignments', jsonb_build_array(jsonb_build_object('userId', pg_temp.id('lee'), 'startsAt', '2026-11-03T00:00:00Z',
      'endsAt', '2026-11-03T08:30:00Z', 'shiftCode', 'D', 'kind', 'day'))));
  if jsonb_array_length(r -> 'swapsCancelled') <> 1 then raise exception 'republish: expected one cancelled swap, got %', r; end if;
  if (select count(*) from public.roster_assignments where service_id = pg_temp.id('svc') and superseded_at is null) <> 1 then
    raise exception 'republish: old rows still live';
  end if;
end
$republish$;

-- 11. Revoke cascade: leaving the team revokes the Roster role; rejoining restores nothing.
do $revoke$
begin
  perform public.on_call_service_command(pg_temp.id('adm'), pg_temp.id('svc'), 'member.revoke', jsonb_build_object('memberId', pg_temp.id('mei')));
  if exists (select 1 from public.roster_member_roles where user_id = pg_temp.id('mei') and revoked_at is null) then
    raise exception 'revoke: roster role still active';
  end if;
  update public.on_call_service_members set revoked_at = null, joined_at = now()
   where service_id = pg_temp.id('svc') and user_id = pg_temp.id('mei');
  if exists (select 1 from public.roster_member_roles where user_id = pg_temp.id('mei') and revoked_at is null) then
    raise exception 'rejoin: role restored';
  end if;
  -- Granted again after rejoining, the role must survive any later write that leaves revoked_at null
  -- (On Call's rejoin path is an upsert that sets revoked_at = null): the trigger's WHEN clause.
  perform pg_temp.cmd('mgr', 'role.set', jsonb_build_object('userId', pg_temp.id('mei'), 'grade', 'resident'));
  update public.on_call_service_members set revoked_at = null where service_id = pg_temp.id('svc') and user_id = pg_temp.id('mei');
  if not exists (select 1 from public.roster_member_roles where user_id = pg_temp.id('mei') and revoked_at is null) then
    raise exception 'rejoin: a later membership write revoked the new role';
  end if;
  if (select count(*) from public.on_call_service_member_events where user_id = pg_temp.id('mei') and mode = 'roster') <> 1 then
    raise exception 'revoke: expected one roster audit row';
  end if;
end
$revoke$;

-- 12. Roster maker: every draft change is saved with its undo, and undo puts it back.
do $maker$
declare d uuid; r jsonb; c bigint; row_id uuid;
begin
  r := pg_temp.cmd('mgr', 'draft.open', '{"periodStart":"2026-11-02","periodEnd":"2026-11-15"}');
  d := (r ->> 'draftId')::uuid;
  if (select count(*) from public.roster_draft_assignments where draft_id = d) <> 1 then raise exception 'draft: not copied'; end if;
  select id into row_id from public.roster_draft_assignments where draft_id = d;
  r := pg_temp.cmd('mgr', 'draft.change', jsonb_build_object('draftId', d, 'source', 'typed', 'ops', jsonb_build_array(
    jsonb_build_object('op', 'update', 'id', row_id, 'row', jsonb_build_object('shiftCode', 'E', 'kind', 'evening')),
    jsonb_build_object('op', 'add', 'row', jsonb_build_object('rosterName', 'Locum 2', 'startsAt', '2026-11-04T00:00:00Z',
      'endsAt', '2026-11-04T08:30:00Z', 'shiftCode', 'D', 'kind', 'day')))));
  c := (r ->> 'lastChangeId')::bigint;
  perform pg_temp.cmd('mgr', 'draft.undo', jsonb_build_object('changeId', c));
  perform pg_temp.cmd('mgr', 'draft.undo', jsonb_build_object('changeId', c - 1));
  if (select shift_code from public.roster_draft_assignments where id = row_id) <> 'D'
     or (select count(*) from public.roster_draft_assignments where draft_id = d) <> 1 then
    raise exception 'draft undo failed';
  end if;
end
$maker$;

-- 13. Retention runs, and a manager's member.remove fires the same cascade.
select public.roster_retention_purge();
select pg_temp.cmd('mgr', 'member.remove', jsonb_build_object('userId', pg_temp.id('ivy')));
select pg_temp.expect_error($$select pg_temp.cmd('ivy', 'seen.mark', '{}')$$, 'roster_access_denied');
select pg_temp.expect_error($$select pg_temp.cmd('mgr', 'member.remove', jsonb_build_object('userId', pg_temp.id('adm')))$$, 'roster_not_found');

-- 14. Deleting a doctor's account is never blocked by a Roster table.
reset role;
do $delete_account$
declare lee uuid := pg_temp.id('lee');
begin
  delete from auth.users where id = lee;
  if exists (select 1 from public.on_call_shifts where owner_id = lee) then raise exception 'delete: own shifts kept'; end if;
  if exists (select 1 from public.roster_publication_seen where user_id = lee) then raise exception 'delete: seen kept'; end if;
  if exists (select 1 from public.roster_assignments where user_id = lee) then raise exception 'delete: assignment still names them'; end if;
end
$delete_account$;
set local role service_role;

select 'roster behaviour: all checks passed' as result;
```

- [ ] **Step 3: Confirm the account-deletion check (Review Focus 4) is in the script**

Run: `grep -n "14. Deleting a doctor's account" tests/sql/roster-behaviour.sql`
Expected: one line. (This check found a real defect during planning: a draft row that required a person blocked account deletion. The constraint was removed from file 3 on 26 Sep 2026.)

- [ ] **Step 4: Run the contract test**

Run: `npx vitest run tests/roster-db-contract.test.ts -t "file 3"`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/<stamp3>_roster_mode.sql tests/sql/roster-behaviour.sql tests/roster-db-contract.test.ts
git commit -m "db: Roster own-shift fix, team roster, swaps, open shifts and roster maker tables (file 3)"
```

---

### Task 4: Admin's and Teaching's files (files 4 and 5)

**Files:**

- Create: `supabase/migrations/<stamp4>_admin_mode.sql`
- Create: `supabase/migrations/<stamp5>_teaching_mode.sql`
- Create: `tests/teaching-migration-contract.test.ts` (Teaching's, taken with its file)

**Interfaces:**

- Consumes: Tasks 1–3. Teaching's `teaching_can_invite` is called by On Call's join at run time.
- Produces: `extra_time_records` (upsert key `(owner_id, kind, started_at)`; Roster writes only `kind, started_at, ended_at`, never `claim_*`), `admin_leave_balances`, `admin_settings`, and every `teaching_*` table.

- [ ] **Step 1: Add Admin's file, then take Teaching's**

**Future migration step** (Plan A branch only). Create `supabase/migrations/<stamp4>_admin_mode.sql` with exactly this content. It is Admin's replayed file; the finished copy differs only in its first three comment lines.

```sql
-- admin_mode.sql: Admin mode's file for Roster's combined DB PR (Admin thread, 2026-09-26, v2, against the
-- shared contract in docs/superpowers/plans/2026-09-27-roster-mode-db-agreement.md). Roster stamps it as file 4,
-- after roster_mode and before teaching_mode. Josh merges the PR himself.
--
-- Tenancy is the same as on_call_shifts (20260926051500):
--   * RLS is on, with no grant to anon or authenticated; only service_role can reach these tables.
--   * Every API query filters by owner_id.
-- Nothing here is shared with a service, and the service sees nothing (Josh, 2026-09-26).
-- The only free text is source_note on balances (80 characters). The API rejects identifier-like text in it
-- (reusing the existing identifier pattern); claim_reference has a fixed pattern.
--
-- v2 change: admin_member_roles is dropped from this PR. Josh is the only editor at launch (as service
-- admin), Admin publishes through the existing on_call_service_command, and nothing would read the table
-- yet. When a second editor is needed, Admin adds its role table in the contract's shape (granted_by,
-- granted_at, revoked_at, audit rows with mode = 'admin', service_member_active() check, advisory lock
-- key 74819) together with the RPC change that reads it. Admin takes no advisory lock in this file: every
-- row is owner-only and nothing is written per service.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- 1. The shared extra-time record. Roster writes the times; Admin writes the claim fields.
--    There is deliberately no foreign key to on_call_shifts: a roster re-import replaces
--    shift rows, and that must never delete or orphan a claim. The link is by time only.
create table public.extra_time_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('stayed_late', 'called_in')),
  started_at timestamptz not null,
  -- Empty while a recall is still under way (a one-tap "Called in" at 02:10); filled in when it ends.
  ended_at timestamptz,
  -- Fixed choices only, with no free-text reason, so nothing clinical can be typed here.
  reason text check (reason is null or reason in ('handover', 'ward_work', 'admissions', 'emergency', 'teaching', 'admin', 'other')),
  claim_status text not null default 'draft' check (claim_status in ('draft', 'sent', 'paid', 'queried')),
  claim_reference text check (claim_reference is null or claim_reference ~ '^[A-Za-z0-9/_-]{1,40}$'),
  claim_sent_on date,
  claim_paid_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint extra_time_records_ends_after_start check (ended_at is null or ended_at > started_at),
  constraint extra_time_records_max_length check (ended_at is null or ended_at - started_at <= interval '24 hours'),
  -- Roster and Admin can both offer to log the same late finish; this stops a duplicate.
  constraint extra_time_records_one_per_start unique (owner_id, kind, started_at),
  -- Claim dates follow the claim status.
  constraint extra_time_records_sent_date_matches_status check (claim_sent_on is null or claim_status in ('sent', 'paid', 'queried')),
  constraint extra_time_records_paid_date_matches_status check (claim_paid_on is null or claim_status = 'paid'),
  -- A claim cannot be sent before the time it claims for has ended.
  constraint extra_time_records_ended_before_claim check (claim_status = 'draft' or ended_at is not null),
  constraint extra_time_records_paid_after_sent check (claim_paid_on is null or claim_sent_on is null or claim_paid_on >= claim_sent_on)
);
create index extra_time_records_owner_started_idx on public.extra_time_records (owner_id, started_at desc);
create trigger extra_time_records_updated_at before update on public.extra_time_records
  for each row execute function public.set_updated_at();
alter table public.extra_time_records enable row level security;
revoke all on table public.extra_time_records from public, anon, authenticated;
grant select, insert, update, delete on table public.extra_time_records to service_role;
create policy "extra time records service role all" on public.extra_time_records
  for all to service_role using (true) with check (true);

-- 2. Leave balances. These are figures the doctor types in, as of a date they choose.
--    There is no accrual and no entitlement maths. Planned leave dates live in Roster's own
--    planned-leave record, and Admin only reads that. There are no sick or personal leave kinds.
create table public.admin_leave_balances (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('annual', 'professional_development_leave', 'development_allowance')),
  amount numeric(8, 2) not null check (amount >= 0 and amount <= 100000),
  unit text not null check (unit in ('days', 'hours', 'dollars')),
  as_of date not null,
  source_note text check (source_note is null or (btrim(source_note) <> '' and char_length(source_note) <= 80)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_leave_balances_unit_matches_kind check (
    (kind = 'development_allowance' and unit = 'dollars') or (kind <> 'development_allowance' and unit in ('days', 'hours'))
  ),
  constraint admin_leave_balances_one_per_kind unique (owner_id, kind)
);
create trigger admin_leave_balances_updated_at before update on public.admin_leave_balances
  for each row execute function public.set_updated_at();
alter table public.admin_leave_balances enable row level security;
revoke all on table public.admin_leave_balances from public, anon, authenticated;
grant select, insert, update, delete on table public.admin_leave_balances to service_role;
create policy "admin leave balances service role all" on public.admin_leave_balances
  for all to service_role using (true) with check (true);

-- 3. Per-doctor Admin settings: one row per doctor.
--    level is used only to choose which guides show; nothing is calculated from it.
--    after_shift_asked_until stores only the end time of the last shift already asked about,
--    so the after-shift question is never asked twice. It holds no shift content.
create table public.admin_settings (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  level text check (level is null or level in ('intern', 'resident', 'registrar', 'fellow', 'consultant', 'other')),
  pay_fortnight_start date,
  after_shift_prompt boolean not null default true,
  after_shift_asked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger admin_settings_updated_at before update on public.admin_settings
  for each row execute function public.set_updated_at();
alter table public.admin_settings enable row level security;
revoke all on table public.admin_settings from public, anon, authenticated;
grant select, insert, update, delete on table public.admin_settings to service_role;
create policy "admin settings service role all" on public.admin_settings
  for all to service_role using (true) with check (true);
```

Teaching owns file 5. Take its final version from the repository, with the contract test that comes with it:

```bash
R=origin/claude/project-thread-yrumov
git show "$R":supabase/migrations/20260926225609_teaching_mode.sql > supabase/migrations/<stamp5>_teaching_mode.sql
git show "$R":tests/teaching-migration-contract.test.ts > tests/teaching-migration-contract.test.ts
```

If the coordinator has named a newer version from Teaching, use that one. Do not edit either file. Check that file 5 provides what the other files rely on (`grep -n` each name):

- `teaching_member_roles` in the agreement's per-mode shape, with `role in ('doctor','organiser','admin')`.
- `teaching_can_invite(p_service_id uuid, p_user_id uuid) returns boolean`: plpgsql, security invoker, execute for `service_role` only, true for an active organiser or admin. On Call's join calls it at run time.
- A revoke-cascade trigger `after update of revoked_at on public.on_call_service_members ... when (old.revoked_at is null and new.revoked_at is not null)`, which revokes the member's Teaching role and writes one audit row with `mode = 'teaching'`.
- Teaching's writes take advisory lock key 74818, and only for Teaching's own tables.
- Every table is service_role only, and it never replaces `on_call_service_command`.

- [ ] **Step 2: Run the whole contract test**

Run: `npx vitest run tests/roster-db-contract.test.ts tests/teaching-migration-contract.test.ts`
Expected: PASS (all describe blocks, including "file order"). If Teaching's file was held back (Task 0 Step 1), there is no Teaching test or `teaching_mode` file; the "file order" test then needs `teaching_mode` removed from its two lists, and says so in the PR body.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/<stamp4>_admin_mode.sql supabase/migrations/<stamp5>_teaching_mode.sql tests/teaching-migration-contract.test.ts
git commit -m "db: Admin owner tables and Teaching tables (files 4 and 5)"
```

---

### Task 5: Replay from scratch, schema mirror, types, seal and manifest

**Files:**

- Modify: `supabase/schema.sql` (append five `-- Projection:` blocks)
- Modify: `src/lib/supabase/database.types.ts`
- Modify: `supabase/applied-migration-hashes.json` (via `npm run migrations:seal`)
- Modify: `supabase/drift-manifest.json` (via `npm run drift:manifest`)

**Interfaces:**

- Produces: the TypeScript names later plans call: `Database["public"]["Functions"]["roster_read" | "roster_command" | "roster_own_shifts_replace" | "roster_set_manager" | "on_call_service_set_verified"]` and every new table type.

- [ ] **Step 0: Bring in main and re-date if needed**

Josh merges this PR in his own window, and other threads keep landing migrations, so the five stamps can fall behind main (pr-policy then blocks the PR as out of order). Do this first, and again right before asking Josh to merge:

```bash
git fetch origin main && git merge --no-edit origin/main
newest_main=$(git ls-tree --name-only origin/main supabase/migrations/ | sed 's#.*/##' | cut -c1-14 | sort | tail -1)
ours=$(git diff --name-only --diff-filter=A origin/main -- supabase/migrations/ | sed 's#.*/##' | cut -c1-14 | sort | head -1)
[ "$ours" \> "$newest_main" ] && echo "stamps still newest" || echo "RE-DATE: rename the five files one minute apart after $newest_main, then redo Steps 1-5"
```

Re-dating means `git mv` of the five files (same suffixes, new stamps no more than 2 days ahead), then Steps 1-5 again (projection headers, types unchanged, seal, manifest). The contract tests find files by suffix, so they need no change.

- [ ] **Step 1: Append the schema projection blocks**

For each of the five files, in order, append to `supabase/schema.sql`:

```bash
git checkout origin/main -- supabase/schema.sql   # drop any earlier projection blocks, so a rerun after re-dating replaces rather than duplicates them
for f in roster_shared_services_hardening on_call_service_items roster_mode admin_mode teaching_mode; do
  file=$(ls supabase/migrations/*_"$f".sql)
  { printf '\n-- Projection: %s\n' "$(basename "$file")"; grep -v "^set local " "$file"; } >> supabase/schema.sql
done
```

Expected: `tail -5 supabase/schema.sql` shows the end of Teaching's file.

- [ ] **Step 2: Start Docker and rebuild the drift manifest**

```bash
nohup dockerd > /tmp/dockerd.log 2>&1 &
until docker info >/dev/null 2>&1; do sleep 1; done
grep -o "supabase/postgres:[0-9.]*" scripts/*drift* | head -1   # the pinned image
docker pull supabase/postgres:17.6.1.127@sha256:be60aee15997daca475b710b734bc6bfe52cd544dcd7e9fd2ff58210b6747d83
npm run drift:manifest
```

Expected: the script loads `supabase/schema.sql` (with the projections from Step 1) on the digest-pinned image and rewrites `supabase/drift-manifest.json`. The migration-chain replay is Step 3 here and CI's Migration replay job. Any SQL error is a real defect: fix it in the migration file on this branch, tell the thread that owns that file, and re-run from Step 1.

- [ ] **Step 3: Run the behaviour script against the same replay**

The drift script leaves no database running, so replay once more into a named container and run the script:

```bash
docker run -d --name roster-replay -e POSTGRES_PASSWORD=postgres -p 55433:5432 supabase/postgres:17.6.1.127@sha256:be60aee15997daca475b710b734bc6bfe52cd544dcd7e9fd2ff58210b6747d83
until docker exec roster-replay pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
docker exec -i roster-replay psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/roles.sql
for file in supabase/migrations/*.sql; do docker exec -i roster-replay psql -U postgres -v ON_ERROR_STOP=1 -q -1 < "$file" || { echo "FAILED: $file"; break; }; done
docker exec -i roster-replay psql -U postgres -v ON_ERROR_STOP=1 -1 < tests/sql/roster-behaviour.sql
docker rm -f roster-replay
```

Expected: last line `roster behaviour: all checks passed`. If the pinned image needs Supabase's own start-up, use `npx supabase start` + `supabase migration up --local` instead (the CI job's route), then run the same `psql` line against it.

- [ ] **Step 4: Add the TypeScript types**

In `src/lib/supabase/database.types.ts`, under `public.Tables`, update the `on_call_services`, `on_call_service_invitations`, `on_call_service_members`, `on_call_shifts` and `on_call_shift_imports` entries, and add one entry per new table from files 1, 3 and 4. Follow the file's existing pattern. `Row` lists every column, with `| null` for nullable ones. `Insert` makes a column optional when it has a default or is nullable. `Update` makes every column optional. `Relationships` lists the foreign keys. Entries stay in alphabetical order. The column names, types, nullability and defaults are the `create table` and `alter table` statements in Task 1 Step 3, Task 3 Step 2 and Task 4 Step 1 (`uuid`, `text`, `date`, `time` and `timestamptz` are `string`; `integer`, `smallint`, `bigint` and `numeric` are `number`; `jsonb` is `Json`). On Call's `issued_via_mode` column is `string | null`. Teaching's thread supplies its own table entries with file 5. The finished copy of the whole file is `src/lib/supabase/database.types.ts` on PR #3117's branch. Then add under `public.Functions`, next to `on_call_shifts_replace`:

```ts
      roster_own_shifts_replace: {
        Args: {
          p_owner_id: string;
          p_window_start: string;
          p_window_end: string;
          p_format: string;
          p_workplace: string | null;
          p_file_name: string | null;
          p_shifts: Json;
          p_changes: Json;
          p_added: number;
          p_changed: number;
          p_removed: number;
        };
        Returns: string;
      };
      roster_read: {
        Args: { p_actor_id: string; p_service_id: string | null; p_what: string; p_payload?: Json };
        Returns: Json;
      };
      roster_command: {
        Args: { p_actor_id: string; p_service_id: string; p_action: string; p_payload?: Json };
        Returns: Json;
      };
      roster_set_manager: {
        Args: { p_service_id: string; p_user_id: string; p_actor_id: string; p_manager: boolean };
        Returns: Json;
      };
      on_call_service_set_verified: {
        Args: { p_service_id: string; p_actor_id: string; p_verified: boolean; p_is_demo: boolean };
        Returns: Json;
      };
      service_member_active: { Args: { p_service_id: string; p_user_id: string }; Returns: boolean };
      roster_can_invite: { Args: { p_service_id: string; p_user_id: string }; Returns: boolean };
```

Add Teaching's and On Call's function types exactly as their threads supply them (the finished copy of `src/lib/supabase/database.types.ts` on PR #3117's branch has them).

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 5: Seal, then run the offline database gates**

```bash
git log -1 --format=%h origin/main   # main was merged in Step 0; if main moved since, merge again and redo Step 0 first (the seal must only add our five lines)
npm run migrations:seal
npm run check:migration-immutability
npm run check:migration-role
npm run check:function-grants
npm run check:owner-scope
npm run check:drift-manifest-freshness
npx vitest run tests/supabase-schema.test.ts tests/drift-detection.test.ts tests/function-grants.test.ts tests/migration-history-guards.test.ts tests/on-call-service-contract.test.ts tests/roster-db-contract.test.ts
```

Expected: every command exits 0; the vitest summary shows no failures. Paste the last line of each into the PR body's "Checks run here" list.

- [ ] **Step 6: Format and commit**

```bash
npm run format
git add supabase/schema.sql src/lib/supabase/database.types.ts supabase/applied-migration-hashes.json supabase/drift-manifest.json
git status --short   # nothing else should be modified
git commit -m "db: schema mirror, types, seal and drift manifest for the combined Roster change"
```

---

### Task 6: Privacy inventory and docs

**Files:**

- Modify: `docs/privacy-impact-assessment.md` (§2 data inventory, lines ~84–97)
- Modify: `docs/codebase-index.md` (Supabase section, ~lines 348–358)

- [ ] **Step 1: Add the inventory rows**

Add one row per data set to the §2 table, in its existing column order, with this content:

| Data                                                         | What it holds                                                         | Who can see it                                     | Kept for                                                                |
| ------------------------------------------------------------ | --------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------- |
| Own shifts (`on_call_shifts`, `on_call_shift_imports`)       | A doctor's own shift times, title, place, workplace, import file name | The doctor only                                    | Until they delete it                                                    |
| Calendar links (`roster_calendar_links`)                     | The address of the doctor's own roster calendar (a secret)            | The doctor only                                    | Until they delete it                                                    |
| Team roster (`roster_publications`, `roster_assignments`)    | Staff names and shift times for a team                                | Members of that team                               | 12 months; printed names of people not on the app cleared after 90 days |
| Swaps and open shifts (`roster_swaps`, `roster_open_shifts`) | Who asked whom, for which shift, and where it is up to                | The two doctors and the team's managers            | 12 months                                                               |
| Seen receipts (`roster_publication_seen`)                    | When a doctor first opened a published roster                         | The team's roster managers only                    | Deleted with the roster, 12 months                                      |
| Dates people can't work (`roster_unavailability`)            | Dates only, with no reason                                            | The doctor and the team's managers                 | 30 days after the date                                                  |
| Planned leave (`roster_leave`)                               | Leave dates and type (annual or professional development), no reason  | The doctor; Admin mode; the team sees a count only | 12 months after it ends                                                 |
| Phone alert subscriptions (`web_push_subscriptions`)         | A browser's push address and keys; no shift content                   | The doctor only                                    | Until they turn alerts off                                              |
| Membership audit (`on_call_service_member_events`)           | Joins, removals and role changes                                      | Platform only                                      | 12 months                                                               |
| Extra time, leave balances, Admin settings (Admin's tables)  | As Admin's plan describes                                             | The doctor only                                    | As Admin's plan describes                                               |

Add one line under PIA risks: "Roster, Admin and Teaching tables hold staff personal information (not patient data). The app servers run in Singapore and the database in Sydney; a health service may require Australian hosting, which is checked with them before real staff data goes in. P1 #F9HZEG (two-user isolation proof) must close first."

- [ ] **Step 2: Add the codebase-index lines**

Under the Supabase section, add:

```markdown
- Roster (combined DB change, 5 files): team tables are reached only through `roster_read` / `roster_command` (membership and Roster role checked in SQL; advisory lock 74817 per team). Own shifts: `roster_own_shifts_replace` replaces imported shifts of one workplace only; hand-added shifts are never touched. Retention: `roster_retention_purge()` nightly via pg_cron.
```

- [ ] **Step 3: Check and commit**

```bash
npm run format
npx vitest run tests/privacy-readiness-contract.test.ts
git add docs/privacy-impact-assessment.md docs/codebase-index.md
git commit -m "docs: privacy inventory and codebase index for the combined Roster database change"
```

---

### Task 7: Open the draft PR (Josh merges it)

**Files:** none.

- [ ] **Step 1: Push**

```bash
git push -u origin claude/project-thread-lm3749
```

The pre-push hook runs format, drift and static guards; fix what it reports, never bypass it.

- [ ] **Step 2: Open a draft PR with the GitHub MCP tool**

Title: `Database: shared team hardening, On Call items, Roster, Admin and Teaching tables`

Body (use the repository template's headings if one exists; this content fills them):

```markdown
Before: any signed-in person can create a team and make themselves its admin, invite links work for whoever holds them, and importing a roster file deletes shifts a doctor added by hand. Roster, Admin and Teaching have no tables.

After: health-service features only switch on for teams the platform has verified; invites are tied to the invited email; imports replace only imported shifts of the same workplace; Roster's team roster, swaps, open shifts, seen receipts and roster maker, Admin's owner tables and Teaching's tables exist, all service-role only.

This change applies to the live clinical database the moment it merges. Merge only inside Josh's approved window; Josh merges it himself.

How: five migrations in a fixed order (shared hardening, On Call, Roster, Admin, Teaching). Team tables are reached only through `roster_read`/`roster_command`, which check membership and role in SQL and serialise each team's writes. Replayed from scratch with the pinned Supabase image; `tests/sql/roster-behaviour.sql` passed on that replay.

Checks run here: <paste the decisive line of each command from Task 5 Step 5 and Task 5 Step 3>.
Left to CI: Migration replay, chain-mirror parity, the full unit suite.
After merge (GitHub's post-merge `live-drift` workflow): `check:drift` and `check:migration-history` must both be green.
```

- [ ] **Step 3: Subscribe to the PR and tell Josh**

Call `subscribe_pr_activity` for the PR. Drive CI to green per the repository rules. When green, reply once in the Roster thread: the PR link, "CI is green", and "this one changes the live database the moment you merge it; merge it yourself when you're ready". Never merge it and never arm auto-merge.
