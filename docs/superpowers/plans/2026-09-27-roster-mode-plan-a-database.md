# Roster combined database change: Implementation Plan (Plan A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One database pull request that Josh merges himself, carrying the shared team-system hardening, On Call's service items, Roster's own-shift fix and team tables, Admin's owner tables and Teaching's tables, replayed from scratch before it opens.

**Architecture:** Five migration files in a fixed order (shared hardening → On Call → Roster → Admin → Teaching), each stamped by the Roster thread at assembly one minute apart. Every new table is RLS-on, service_role only, with no browser grants; team tables are reached only through `roster_read` / `roster_command`, which check membership and role in SQL. Roster's SQL is already written and replayed locally: `/mnt/project-files/roster-mode/build-plan/sql/`.

**Tech Stack:** Supabase Postgres 17 (pgvector, pg_cron), plpgsql, Vitest static contract tests, CI "Migration replay" job, `npm run drift:manifest` (Docker).

**Spec:** `/mnt/project-files/roster-mode/plan-v8.html` (design, approved by Josh 26 Sep 2026 18:44Z) and `/mnt/project-files/roster-mode/shared-db-contract.md` v6.

**Efficiency:** the SQL for Roster's files is written and already replayed on Postgres 16 with 14 behaviour checks (`sql/`), so tasks copy it rather than write it. Local work is the offline gates plus one containerised replay; CI's Migration replay is the third run. One push, one draft PR, one review of the final diff.

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

## Review Focus

1. **Two managers acting at once.** Two approvals, or a publish and an approval, on the same team in the same second must serialise: the second sees the first's result, never a half-applied swap. (Pinned by the advisory lock plus the "request exists" and "taken" checks in Task 3's behaviour script.)
2. **Someone leaves while a request is pending.** Revoking a member (by On Call's admin or a Roster manager) must cancel their live swaps and release their claims in the same transaction, and a later rejoin must not restore the manager role. (Task 3, checks 11 and 13.)
3. **Night shifts that cross midnight in Perth.** Publishing, clash checks and the "which shifts does this period replace" rule must work on Perth dates (UTC+8), not UTC dates. (Task 3, checks 4, 7 and 10 use a 21:30–08:00 night.)
4. **Account deletion.** Deleting a doctor's account must never be blocked by a foreign key in any new table (`on delete cascade` or `set null` everywhere). (Task 3, new check 14.)
5. **An old app talking to the new database.** For the minutes between this merge and the next app deploy, the live app still calls `on_call_shifts_replace` with 9 arguments; it must keep working. (Task 3, check 1.)

---

### Task 0: Preconditions and the branch

**Files:** none changed.

- [ ] **Step 1: Confirm the inputs exist and are final**

Run:

```bash
ls -l /mnt/project-files/roster-mode/build-plan/sql/01-roster_shared_services_hardening.sql \
      /mnt/project-files/roster-mode/build-plan/sql/03-roster_mode.sql \
      /mnt/project-files/roster-mode/build-plan/sql/roster-behaviour.sql \
      /mnt/project-files/on-call-mode/db-draft/on-call-db-items.PLACEHOLDER_TIMESTAMP.sql \
      /mnt/project-files/admin-mode/admin_mode.sql
ls /mnt/project-files/teaching-mode/*.sql
grep -n "issuedViaMode" /mnt/project-files/on-call-mode/db-draft/on-call-db-items.PLACEHOLDER_TIMESTAMP.sql
```

Expected: every file lists; Teaching's file exists; On Call's file contains an `issuedViaMode` branch in `invitation.create` (contract v6 ask). If On Call's branch or Teaching's file is missing, stop and ask the coordinator; do not write either yourself. Teaching's file rides in this PR only if the Teaching thread has confirmed Josh approved its build plan (Teaching's hold, 19:15Z); otherwise ship files 1-4, drop Task 4's Teaching half and the `teaching_*` projections, and say in the PR body that Teaching's file follows in its own database PR.

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

```bash
cp /mnt/project-files/roster-mode/build-plan/sql/01-roster_shared_services_hardening.sql \
   supabase/migrations/<stamp1>_roster_shared_services_hardening.sql
```

The file's content is final (replayed on 26 Sep 2026); do not edit it here. Any change goes back through the Roster thread so the contract and the replay stay true.

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
- Test: whatever tests On Call's thread supplies with its file (they own them; run them, do not rewrite them).

**Interfaces:**

- Consumes: everything from Task 1.
- Produces: the only replacement of `on_call_service_command`, with `issued_via_mode`, email binding, audit rows, caps 5,000 members / 1,000 open invitations, `member.display_name`, `FOR SHARE` reads.

- [ ] **Step 1: Copy On Call's final file exactly**

```bash
cp /mnt/project-files/on-call-mode/db-draft/on-call-db-items.PLACEHOLDER_TIMESTAMP.sql \
   supabase/migrations/<stamp2>_on_call_service_items.sql
grep -c "DRAFT ONLY" supabase/migrations/<stamp2>_on_call_service_items.sql
```

Expected: `0`. If the draft banner is still there, On Call has not released the file: stop and ask the coordinator.

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

- [ ] **Step 2: Add the migration and the behaviour script**

```bash
cp /mnt/project-files/roster-mode/build-plan/sql/03-roster_mode.sql supabase/migrations/<stamp3>_roster_mode.sql
cp /mnt/project-files/roster-mode/build-plan/sql/roster-behaviour.sql tests/sql/roster-behaviour.sql
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

**Interfaces:**

- Consumes: Tasks 1–3. Teaching's `teaching_can_invite` is called by On Call's join at run time.
- Produces: `extra_time_records` (upsert key `(owner_id, kind, started_at)`; Roster writes only `kind, started_at, ended_at`, never `claim_*`), `admin_leave_balances`, `admin_settings`, and every `teaching_*` table.

- [ ] **Step 1: Copy both files exactly**

```bash
cp /mnt/project-files/admin-mode/admin_mode.sql supabase/migrations/<stamp4>_admin_mode.sql
cp /mnt/project-files/teaching-mode/teaching_mode.sql supabase/migrations/<stamp5>_teaching_mode.sql
```

If Teaching's file has a different name in its folder, use the one the coordinator named; do not edit its content.

- [ ] **Step 2: Run the whole contract test**

Run: `npx vitest run tests/roster-db-contract.test.ts`
Expected: PASS (all describe blocks, including "file order").

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/<stamp4>_admin_mode.sql supabase/migrations/<stamp5>_teaching_mode.sql
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

Expected: the script loads `supabase/schema.sql` (with the projections from Step 1) on the digest-pinned image and rewrites `supabase/drift-manifest.json`. The migration-chain replay is Step 3 here and CI's Migration replay job. Any SQL error is a real defect: fix it in the Roster thread's source file, re-copy, and re-run from Step 1.

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

Paste each block from `/mnt/project-files/roster-mode/build-plan/sql/database-types-additions.ts` into `src/lib/supabase/database.types.ts` under `public.Tables`, replacing the existing `on_call_services`, `on_call_service_invitations`, `on_call_service_members`, `on_call_shifts` and `on_call_shift_imports` entries. Then add under `public.Functions`, next to `on_call_shifts_replace`:

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

Add Teaching's and On Call's function types exactly as their threads supply them.

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
