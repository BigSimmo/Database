# Shared team system: database contract for the combined DB PR

**Owner.** The Roster thread owns this file. Other threads should read it but not edit it; send changes to the coordinator.

- Version 6: 2026-09-26 19:10Z. Written and replayed locally with the real file 1 and file 3 (see build-plan/). Roster-only changes: `roster_member_roles.role` is `member|manager` (every member can carry a grade and roster name, not only managers), plus `roster_name` and `rotation_ends_on`; managers are named only by the platform function `roster_set_manager`; a manager may remove an ordinary member (`member.remove` in `roster_command`, which revokes the shared membership under the service row `FOR UPDATE`, never an editor or admin); `on_call_service_set_verified` is the platform path for §1–2. **One ask of On Call's file 2:** `invitation.create` must accept `issuedViaMode: 'roster'|'teaching'`, check `roster_can_invite`/`teaching_can_invite` for the actor instead of the On Call role, force `role = 'member'`, and store `issued_via_mode`. Without it a roster manager cannot invite anyone.
- Version 5: 2026-09-26 18:45Z. Revoke cascades to per-mode role rows through a trigger in each mode's own file; every invitation write goes through On Call's command under the service-row lock; lock key 74817 is Roster-only.
- Version 4: 2026-09-26 16:58Z. The migration order was corrected; `issued_via_mode` belongs to On Call's file only.
- Written against `origin/main` 65f684ad5, reading `supabase/schema.sql`, where the service tables start at about line 18697.
- This is a plan only. Nothing here exists yet. Josh merges the one combined DB PR himself.

## What exists today (verified on main)

- `on_call_services(id, name, created_by, created_at)`.
- `on_call_service_members(service_id, user_id, role member|editor|admin, clinical_reviewer, joined_at, revoked_at)`.
  - The primary key is `(service_id, user_id)`.
  - Rejoining reuses the same row, so revoke history is lost today.
- `on_call_service_invitations(id, service_id, token_hash, role, issued_by, expires_at ≤ 7 days, revoked_at, used_at, used_by)`.
- `on_call_service_command(p_actor_id, p_service_id, p_action, p_payload jsonb)`.
  - It is a security invoker, callable by service_role only.
  - It deliberately never reads `auth.users`.
  - Anyone signed in can `create` a service, up to 50 memberships each.

## Changes to shared tables (Roster's migration file, first in the PR)

Teaching's assumed names are confirmed, with the corrections marked **Changed**.

1. **Verified flag.** Confirmed as `on_call_services.verified_at timestamptz null`, where null means not verified.
   - Add `verified_by uuid null references auth.users(id) on delete set null`.
   - It can be set only by a platform path: service_role SQL or Josh's admin button. The command RPC never sets it.
2. **Demo flag.** Confirmed as `on_call_services.is_demo boolean not null default false`. It is platform-only, like the verified flag.
   - Health-service features switch on only when `verified_at is not null or is_demo`.
3. **Invite email binding.** Confirmed as `on_call_service_invitations.invited_email text null`, with `check (invited_email = lower(btrim(invited_email)))`.
   - **Changed: how the email is compared.** The RPC cannot read `auth.users`. The API route passes the signed-in user's verified email as `p_payload->>'actorEmail'`. The RPC compares `lower(btrim(...))` to `invited_email`, and a mismatch raises `service_invite_email_mismatch`.
   - The `invite` action requires `invited_email`. Rows made before this change stay nullable and expire within 7 days anyway.
4. **Audit table.** Confirmed, with **changes**: `on_call_service_member_events`.
   - Columns:
     - `id bigint generated always as identity primary key`;
     - `service_id uuid not null references on_call_services(id) on delete cascade`;
     - `user_id uuid null references auth.users(id) on delete set null`;
     - `event text not null check (event in ('joined','revoked','rejoined','role_changed'))`;
     - `mode text null`, which is null for the shared membership, or the mode name (for example `'teaching'`) for a per-mode role change;
     - `actor_id uuid null references auth.users(id) on delete set null`;
     - `at timestamptz not null default now()`.
   - **Why these changes.** User and actor ids set null on delete, so "delete my data" still works. Rows older than 12 months are purged by the existing purge mechanism.
   - The RPC writes one row on each join, revoke, rejoin and role change.
5. **Display name.** **New:** `on_call_service_members.display_name text null check (display_name is null or length(btrim(display_name)) between 1 and 80)`.
   - It is shared by every mode.
   - Only the member themselves, or a service admin, can set it.
6. **Caps.** 5,000 active members and 1,000 open invitations per service, enforced in the command RPC.
7. **Locking.**
   - Reads and check-ins use `FOR SHARE` on the service row.
   - Roster writes take a per-service advisory lock: `pg_advisory_xact_lock(hashtextextended(service_id::text, 74817))`.
   - Other modes pick their own second key: Teaching 74818 and Admin 74819. Each key guards only that mode's own tables.
   - **Invitations have one writer (v5).** Every insert or update on `on_call_service_invitations` goes through `on_call_service_command` (with `issued_via_mode` set), which takes `FOR UPDATE` on the service row before the 1,000-open-invite and 5,000-member cap checks. No mode writes that table directly, and 74817 is not the cap lock.
8. **Revoke cascades (v5).** When a shared membership is revoked (`revoked_at` goes from null to a time), every active per-mode role row for that user and service is revoked in the same transaction.

- Each mode's own file adds an `AFTER UPDATE OF revoked_at ON on_call_service_members FOR EACH ROW WHEN (OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL)` trigger (the WHEN clause is required: rejoin is an `INSERT ... ON CONFLICT DO UPDATE` that clears `revoked_at` and would otherwise re-revoke mode roles; On Call, 18:32Z) that sets `revoked_at = now()` on its own `<mode>_member_roles` rows where `revoked_at is null`, and writes one audit row with `mode = '<mode>'`. This keeps On Call's file free of references to tables created later.
- Rejoining reuses the member row: `revoked_at` is cleared and `joined_at` is reset to the rejoin time. Per-mode roles are not restored; they must be granted again.

8. **Who can invite.**
   - A mode manager or editor can invite as `member` only.
   - Only a service `admin` can invite as `editor` or `admin`.
9. **Service creation stays open.** Anyone can still create an unverified service, and nothing health-service-only works in it.

## Per-mode role tables (the shared pattern)

Each mode creates its own table **in its own migration file** inside the combined PR. So yes, Teaching creates `teaching_member_roles` in its own file.

```sql
create table public.<mode>_member_roles (
  service_id uuid not null,
  user_id    uuid not null,
  role       text not null check (role in (...mode's own roles...)),
  granted_by uuid null references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz null,
  primary key (service_id, user_id),
  foreign key (service_id, user_id)
    references public.on_call_service_members(service_id, user_id) on delete cascade
);
```

- **Teaching.** Confirmed: `teaching_member_roles(service_id, user_id, role, granted_by, granted_at)`, plus `revoked_at`, which every mode needs.
- **Roster.** `roster_member_roles` (v6):
  - `role in ('member','manager')`, default `member`; `roster_name` (the name the roster file prints, unique per team while active) and `rotation_ends_on`;
  - `grade text null check (grade in ('intern','resident','registrar','fellow','consultant','other'))`.
  - Grade `other` is left out of swap matching.
- **Admin.** No role table in this PR. Admin publishes through the existing `on_call_service_command`, and will add `admin_member_roles` later in exactly this shape, together with its RPC change. Advisory lock key 74819 stays reserved.
- RLS is on and there are no policies; only service_role can reach it, as for the existing tables.
- Each mode writes an audit row with `mode = '<mode>'` when a role is granted or revoked.

## Shared permission helper (new, in Roster's file)

```sql
create function public.service_member_active(p_service_id uuid, p_user_id uuid)
returns boolean language sql stable security invoker
set search_path = public, pg_catalog, pg_temp as $$
  select exists (select 1 from public.on_call_service_members
                 where service_id = p_service_id and user_id = p_user_id and revoked_at is null)
$$;
-- revoke from public, anon, authenticated; grant execute to service_role.
```

- Each mode's own command RPC checks `service_member_active(...)` first.
- It then checks its own role table, requiring `revoked_at is null`.
- There is no generic mode-role helper, which keeps each mode's rules in its own file.

## Migration order and timestamps

- The PR rule blocks any migration dated more than 2 days after the current UTC time. So no exact timestamps are reserved now.
- Each thread names its file with a placeholder, for example `teaching_mode.sql`.
- Roster stamps every file at the current UTC time when it assembles the PR, one minute apart, in this order:
  1. `roster_shared_services_hardening`: the shared table changes (§1 to §5) and the `service_member_active` helper. It never touches `on_call_service_command`, and it does **not** add `issued_via_mode`, because On Call's file owns that column.
  2. `on_call_service_items`: On Call's file and the only replacement of `on_call_service_command`. It adds `issued_via_mode`, the join-time mode check, `member.display_name` and `FOR SHARE` reads, plus its playbook and cover sections, `published_at` and `entry.confirm`. The team link is parked separately as `deferred-team-link.sql`.
  3. `roster_mode`: the own-shift fix, the roster tables, `roster_member_roles` and `roster_can_invite`.
  4. `admin_mode`: `/mnt/project-files/admin-mode/admin_mode.sql`, with `extra_time_records`, `admin_leave_balances` and `admin_settings`. These are owner-only and do not depend on the shared tables.
  5. `teaching_mode`, which adds `teaching_can_invite`.
- Every file after the first may rely on everything above it.
- Send your file to the coordinator as plain SQL, and say which of the names above it uses.

## Notes for Roster's own writes into other modes' tables

- **Extra time, following Admin's review at 16:41Z.** Roster writes to `extra_time_records` by upserting on the unique key `(owner_id, kind, started_at)`. This means a late finish logged in Roster and the same one logged in Admin never create two rows.
  - `ended_at` may be empty while a recall is still under way.
  - Roster never sets `claim_*` fields. Those belong to Admin.
  - `source_note` is limited to 80 characters and passes Admin's patient-identifier check.
- **Draft roster tables for Release 3.** These are in Roster's own file: a draft that sits beside each publication, a change log that stores each change's undo in the same database step, staffing needs, and team shift codes. They are planned in the build plan, not in this contract.

## Rulings on On Call's draft (16:55Z)

1. **Only one file replaces `on_call_service_command`, and it is On Call's.**
   - Roster's file #1 does not touch the function. It adds only the columns, the audit table, the helper and the checks.
   - On Call's file carries every command-level rule in this contract: email binding, audit rows, caps, invite rights, display name and locking.
   - On Call's file therefore moves to **position 2**, straight after file #1. The new order is:
     1. `roster_shared_services_hardening`
     2. `on_call_service_items`
     3. `roster_mode`
     4. `admin_mode`
     5. `teaching_mode`
   - No later file may replace `on_call_service_command`. A mode that needs new actions adds its own command function.
2. **Invites from mode managers.**
   - On Call's file (position 2) adds `on_call_service_invitations.issued_via_mode text null`, which is null for On Call and service admins, or `'roster'` or `'teaching'`. Invites issued through a mode are forced to `role = 'member'`.
   - Each mode's own file defines `public.<mode>_can_invite(p_service_id uuid, p_user_id uuid) returns boolean`, written in plpgsql, security invoker, execute for service_role only. It is true when the user is an active member and holds an active manager or editor row in that mode's role table.
   - At join, On Call's function checks what it always does: token hash, expiry, revoked or used status, and the email match. It then re-checks the issuer as follows:
     - If `issued_via_mode` is null, it uses today's On Call role check.
     - Otherwise it calls the matching `<mode>_can_invite` through a `case` statement in plpgsql. The `case` is resolved at run time, so it works even though those functions are created by later files in the same PR.
     - An unknown mode fails closed.
3. **Display name.** On Call's function adds the action `member.display_name`. Only the member themselves, or a service admin, can use it. The value is trimmed to 1–80 characters, or null to clear it.
4. **Locking.**
   - Read-only actions (`list`, reads and check-ins) take `FOR SHARE` on the service row.
   - Actions that change membership, invitations or content keep `FOR UPDATE`.
5. **Cover sections and the roster.** Cover is handbook content, `{grade, team?, window}`, using the grade values in `roster_member_roles.grade`. It does not join to roster rows.
   - **Seen receipts (Josh's card, 18:44Z).** Roster's file #3 adds `roster_publication_seen(publication_id, user_id, seen_at, primary key (publication_id, user_id))`. It is written once when a doctor first opens a published roster, readable only by that team's roster managers, and deleted with its publication under the 12-month retention. It must be added to the privacy assessment.
   - Roster's shift table is `roster_assignments(service_id, publication_id, user_id null, roster_name, site_id null, starts_at, ends_at, shift_code)`, in file #3, for anyone who later wants to align with it.
6. **Team link (C) is deferred.** A link that works for everyone at one email domain weakens email-bound invites, and the pilot doesn't need it. Keep it in a separate file for a later PR.
7. **Replay.** Once Roster's real file #1 exists, the whole chain (files 1 to 5) is replayed from scratch, using CI's migration replay locally, before the PR opens.
