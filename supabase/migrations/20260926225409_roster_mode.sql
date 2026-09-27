-- Roster mode: file 3 of the combined Roster DB PR (shared-db-contract.md v6).
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

-- Everything a team page reads, checked in SQL against the actor's membership and role.
create function public.roster_read(p_actor_id uuid, p_service_id uuid, p_what text, p_payload jsonb default '{}')
returns jsonb
language plpgsql stable security invoker set search_path = public, pg_catalog, pg_temp as $$
declare
  v_service public.on_call_services;
  v_role public.roster_member_roles;
  v_is_manager boolean;
  v_from date;
  v_to date;
  v_latest public.roster_publications;
  v_result jsonb;
begin
  if p_actor_id is null then raise exception 'roster_auth_required'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'roster_invalid_request'; end if;

  if p_what = 'teams' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'serviceId', s.id, 'name', s.name,
      'enabled', (s.verified_at is not null or s.is_demo),
      'role', coalesce(r.role, 'member'), 'grade', r.grade
    ) order by s.name), '[]') into v_result
    from public.on_call_services s
    join public.on_call_service_members m on m.service_id = s.id and m.user_id = p_actor_id and m.revoked_at is null
    left join public.roster_member_roles r on r.service_id = s.id and r.user_id = p_actor_id and r.revoked_at is null;
    return jsonb_build_object('teams', v_result);
  end if;

  select * into v_service from public.on_call_services where id = p_service_id;
  if not found or not public.service_member_active(p_service_id, p_actor_id) then
    raise exception 'roster_access_denied';
  end if;
  if v_service.verified_at is null and not v_service.is_demo then raise exception 'roster_team_not_verified'; end if;
  select * into v_role from public.roster_member_roles
   where service_id = p_service_id and user_id = p_actor_id and revoked_at is null;
  v_is_manager := found and v_role.role = 'manager';
  select * into v_latest from public.roster_publications
   where service_id = p_service_id order by version desc limit 1;

  if p_what in ('assignments', 'unavailability', 'leave_overlap', 'changes') then
    begin
      v_from := (p_payload ->> 'from')::date;
      v_to := (p_payload ->> 'to')::date;
    exception when others then raise exception 'roster_invalid_request';
    end;
    if v_from is null or v_to is null or v_to < v_from or v_to - v_from > 62 then
      raise exception 'roster_invalid_request';
    end if;
  end if;

  if p_what = 'overview' then
    return jsonb_build_object(
      'service', jsonb_build_object('id', v_service.id, 'name', v_service.name),
      'me', jsonb_build_object('role', coalesce(v_role.role, 'member'), 'grade', v_role.grade,
                               'rotationEndsOn', v_role.rotation_ends_on),
      'latestPublication', case when v_latest.id is null then null else jsonb_build_object(
        'id', v_latest.id, 'version', v_latest.version, 'publishedAt', v_latest.published_at,
        'periodStart', v_latest.period_start, 'periodEnd', v_latest.period_end) end,
      'seenLatest', v_latest.id is not null and exists (
        select 1 from public.roster_publication_seen where publication_id = v_latest.id and user_id = p_actor_id),
      'settings', coalesce((select jsonb_build_object('swapApproval', t.swap_approval, 'rules', t.rules,
        'rulesSource', t.rules_source, 'payFortnightAnchor', t.pay_fortnight_anchor)
        from public.roster_team_settings t where t.service_id = p_service_id),
        jsonb_build_object('swapApproval', 'auto_same_grade', 'rules', '{}'::jsonb, 'rulesSource', null, 'payFortnightAnchor', null)),
      'sites', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name) order by s.name), '[]')
                from public.on_call_service_sites s where s.service_id = p_service_id)
    );

  elsif p_what = 'assignments' then
    select coalesce(jsonb_agg(public.roster_assignment_json(a) order by a.starts_at, a.id), '[]') into v_result
    from public.roster_assignments a
    where a.service_id = p_service_id and a.superseded_at is null
      and (a.starts_at at time zone 'Australia/Perth')::date between v_from and v_to;
    return jsonb_build_object('assignments', v_result);

  elsif p_what = 'requests' then
    return jsonb_build_object(
      'swaps', (select coalesce(jsonb_agg(jsonb_build_object(
          'id', w.id, 'status', w.status, 'autoApproved', w.auto_approved,
          'needsManagerBecause', w.needs_manager_because, 'cancelReason', w.cancel_reason,
          'requesterId', w.requester_id, 'counterpartyId', w.counterparty_id,
          'give', (select public.roster_assignment_json(a) from public.roster_assignments a where a.id = w.give_assignment_id),
          'take', (select public.roster_assignment_json(a) from public.roster_assignments a where a.id = w.take_assignment_id),
          'expiresAt', w.expires_at, 'createdAt', w.created_at, 'decidedAt', w.decided_at
        ) order by w.created_at desc), '[]')
        from public.roster_swaps w
        where w.service_id = p_service_id and (w.requester_id = p_actor_id or w.counterparty_id = p_actor_id)
          and w.created_at > now() - interval '60 days'),
      'openShifts', (select coalesce(jsonb_agg(jsonb_build_object(
          'id', o.id, 'status', o.status, 'urgent', o.urgent, 'startsAt', o.starts_at, 'endsAt', o.ends_at,
          'shiftCode', o.shift_code, 'kind', o.kind, 'minGrade', o.min_grade, 'siteId', o.site_id,
          'mine', o.posted_by = p_actor_id, 'claimedByMe', o.claimed_by = p_actor_id
        ) order by o.starts_at), '[]')
        from public.roster_open_shifts o
        where o.service_id = p_service_id and o.ends_at > now()
          and (o.posted_by = p_actor_id or o.claimed_by = p_actor_id
               or (o.status = 'open' and (o.min_grade is null
                   or public.roster_grade_rank(v_role.grade) >= public.roster_grade_rank(o.min_grade)))))
    );

  elsif p_what = 'unavailability' then
    select coalesce(jsonb_agg(jsonb_build_object('userId', u.user_id, 'date', u.on_date, 'kind', u.kind)
           order by u.on_date, u.user_id), '[]') into v_result
    from public.roster_unavailability u
    where u.service_id = p_service_id and u.on_date between v_from and v_to
      and (v_is_manager or u.user_id = p_actor_id);
    return jsonb_build_object('unavailability', v_result);

  elsif p_what = 'leave_overlap' then
    -- A number only, never names.
    return jsonb_build_object('alreadyOff', (
      select count(distinct l.owner_id) from public.roster_leave l
      where l.service_id = p_service_id and l.owner_id <> p_actor_id
        and public.service_member_active(p_service_id, l.owner_id)
        and l.starts_on <= v_to and l.ends_on >= v_from));

  elsif p_what = 'manage' then
    if not v_is_manager then raise exception 'roster_role_denied'; end if;
    return jsonb_build_object(
      'swaps', (select coalesce(jsonb_agg(jsonb_build_object(
          'id', w.id, 'status', w.status, 'autoApproved', w.auto_approved,
          'needsManagerBecause', w.needs_manager_because,
          'requesterId', w.requester_id, 'counterpartyId', w.counterparty_id,
          'give', (select public.roster_assignment_json(a) from public.roster_assignments a where a.id = w.give_assignment_id),
          'take', (select public.roster_assignment_json(a) from public.roster_assignments a where a.id = w.take_assignment_id),
          'decidedAt', w.decided_at
        ) order by w.created_at), '[]')
        from public.roster_swaps w
        where w.service_id = p_service_id
          and (w.status = 'accepted' or (w.auto_approved and w.decided_at > now() - interval '14 days'))),
      'openShifts', (select coalesce(jsonb_agg(jsonb_build_object(
          'id', o.id, 'status', o.status, 'urgent', o.urgent, 'startsAt', o.starts_at, 'endsAt', o.ends_at,
          'shiftCode', o.shift_code, 'kind', o.kind, 'minGrade', o.min_grade, 'siteId', o.site_id,
          'postedBy', o.posted_by, 'claimedBy', o.claimed_by, 'claimedAt', o.claimed_at
        ) order by o.starts_at), '[]')
        from public.roster_open_shifts o
        where o.service_id = p_service_id and o.status in ('reported', 'open', 'claimed') and o.ends_at > now()),
      'seen', case when v_latest.id is null then null else jsonb_build_object(
          'publicationId', v_latest.id, 'version', v_latest.version,
          'seen', (select count(*) from public.roster_publication_seen x
                   where x.publication_id = v_latest.id and public.service_member_active(p_service_id, x.user_id)),
          'members', (select count(*) from public.on_call_service_members m
                      where m.service_id = p_service_id and m.revoked_at is null),
          'notSeen', (select coalesce(jsonb_agg(m.user_id), '[]') from public.on_call_service_members m
                      where m.service_id = p_service_id and m.revoked_at is null
                        and not exists (select 1 from public.roster_publication_seen x
                                        where x.publication_id = v_latest.id and x.user_id = m.user_id))) end
    );

  elsif p_what = 'people' then
    if not v_is_manager then raise exception 'roster_role_denied'; end if;
    select coalesce(jsonb_agg(jsonb_build_object(
      'userId', m.user_id, 'displayName', m.display_name, 'joinedAt', m.joined_at, 'serviceRole', m.role,
      'role', coalesce(r.role, 'member'), 'grade', r.grade, 'rosterName', r.roster_name,
      'rotationEndsOn', r.rotation_ends_on
    ) order by coalesce(m.display_name, r.roster_name), m.joined_at), '[]') into v_result
    from public.on_call_service_members m
    left join public.roster_member_roles r on r.service_id = m.service_id and r.user_id = m.user_id and r.revoked_at is null
    where m.service_id = p_service_id and m.revoked_at is null;
    return jsonb_build_object('people', v_result);

  elsif p_what = 'publications' then
    if not v_is_manager then raise exception 'roster_role_denied'; end if;
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'version', p.version, 'kind', p.kind, 'periodStart', p.period_start, 'periodEnd', p.period_end,
      'sourceName', p.source_name, 'publishedAt', p.published_at
    ) order by p.version desc), '[]') into v_result
    from (select * from public.roster_publications where service_id = p_service_id order by version desc limit 50) p;
    return jsonb_build_object('publications', v_result);

  elsif p_what = 'maker' then
    if not v_is_manager then raise exception 'roster_role_denied'; end if;
    return jsonb_build_object(
      'codes', (select coalesce(jsonb_agg(jsonb_build_object('code', c.code, 'kind', c.kind, 'starts', c.starts,
                'ends', c.ends, 'label', c.label) order by c.code), '[]')
                from public.roster_shift_codes c where c.service_id = p_service_id),
      'needs', (select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'weekday', n.weekday, 'date', n.on_date,
                'kind', n.kind, 'grade', n.grade, 'siteId', n.site_id, 'needed', n.needed)), '[]')
                from public.roster_staffing_needs n where n.service_id = p_service_id),
      'drafts', (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'periodStart', d.period_start,
                'periodEnd', d.period_end, 'basedOnPublicationId', d.based_on_publication_id, 'updatedAt', d.updated_at)
                order by d.period_start), '[]')
                from public.roster_drafts d where d.service_id = p_service_id)
    );

  elsif p_what = 'draft' then
    if not v_is_manager then raise exception 'roster_role_denied'; end if;
    if not exists (select 1 from public.roster_drafts d
                   where d.id = (p_payload ->> 'draftId')::uuid and d.service_id = p_service_id) then
      raise exception 'roster_not_found';
    end if;
    return jsonb_build_object(
      'assignments', (select coalesce(jsonb_agg(jsonb_build_object(
          'id', a.id, 'userId', a.user_id, 'name', public.roster_person_name(p_service_id, a.user_id, a.roster_name),
          'siteId', a.site_id, 'startsAt', a.starts_at, 'endsAt', a.ends_at, 'shiftCode', a.shift_code,
          'kind', a.kind, 'grade', a.grade) order by a.starts_at, a.id), '[]')
        from public.roster_draft_assignments a where a.draft_id = (p_payload ->> 'draftId')::uuid),
      'changes', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'source', c.source, 'change', c.change,
          'at', c.at, 'actorId', c.actor_id, 'undoneAt', c.undone_at) order by c.id desc), '[]')
        from (select * from public.roster_changes where draft_id = (p_payload ->> 'draftId')::uuid
              order by id desc limit 100) c)
    );
  end if;

  raise exception 'roster_invalid_request';
end $$;

-- Every team write. Lock order, the same for every mode: the service row FOR SHARE, then this
-- mode's per-service advisory lock (74817), then target rows FOR UPDATE.
create function public.roster_command(p_actor_id uuid, p_service_id uuid, p_action text, p_payload jsonb default '{}')
returns jsonb
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
declare
  v_service public.on_call_services;
  v_role public.roster_member_roles;
  v_is_manager boolean;
  v_settings public.roster_team_settings;
  v_min_break numeric;
  v_pub public.roster_publications;
  v_swap public.roster_swaps;
  v_open public.roster_open_shifts;
  v_give public.roster_assignments;
  v_take public.roster_assignments;
  v_draft public.roster_drafts;
  v_row jsonb;
  v_id uuid;
  v_change_id bigint;
  v_count integer;
  v_ids uuid[];
  v_problem text;
  v_reason text;
  v_giver_rank integer;
  v_taker_rank integer;
  v_result jsonb;
  v_from date;
  v_to date;
begin
  if p_actor_id is null then raise exception 'roster_auth_required'; end if;
  if p_service_id is null or p_action is null then raise exception 'roster_invalid_request'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'roster_invalid_request'; end if;

  -- Removing a member changes membership, so it takes the service row FOR UPDATE, as On Call
  -- does; every other action takes it FOR SHARE. Never upgrade a lock mid-call.
  if p_action = 'member.remove' then
    select * into v_service from public.on_call_services where id = p_service_id for update;
  else
    select * into v_service from public.on_call_services where id = p_service_id for share;
  end if;
  if not found or not public.service_member_active(p_service_id, p_actor_id) then
    raise exception 'roster_access_denied';
  end if;
  if v_service.verified_at is null and not v_service.is_demo then raise exception 'roster_team_not_verified'; end if;

  -- Seen receipts are a check-in: the share lock is enough, and they never wait on other writes.
  if p_action = 'seen.mark' then
    select * into v_pub from public.roster_publications
     where service_id = p_service_id and id = (p_payload ->> 'publicationId')::uuid;
    if not found then raise exception 'roster_not_found'; end if;
    insert into public.roster_publication_seen (publication_id, user_id) values (v_pub.id, p_actor_id)
      on conflict do nothing;
    return jsonb_build_object('ok', true);
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_service_id::text, 74817));

  select * into v_role from public.roster_member_roles
   where service_id = p_service_id and user_id = p_actor_id and revoked_at is null;
  v_is_manager := found and v_role.role = 'manager';
  select * into v_settings from public.roster_team_settings where service_id = p_service_id;
  v_min_break := nullif(v_settings.rules ->> 'minBreakHours', '')::numeric;

  -- ---------------------------------------------------------------- people and settings
  if p_action = 'role.set' then
    if not v_is_manager then raise exception 'roster_role_denied'; end if;
    v_id := (p_payload ->> 'userId')::uuid;
    if v_id is null or not public.service_member_active(p_service_id, v_id) then raise exception 'roster_not_found'; end if;
    if p_payload ? 'grade' and p_payload ->> 'grade' is not null
       and p_payload ->> 'grade' not in ('intern', 'resident', 'registrar', 'fellow', 'consultant', 'other') then
      raise exception 'roster_invalid_request';
    end if;
    insert into public.roster_member_roles (service_id, user_id, role, grade, roster_name, rotation_ends_on, granted_by)
    values (p_service_id, v_id, 'member', p_payload ->> 'grade', nullif(btrim(p_payload ->> 'rosterName'), ''),
            (p_payload ->> 'rotationEndsOn')::date, p_actor_id)
    on conflict (service_id, user_id) do update set
      grade = case when p_payload ? 'grade' then excluded.grade else public.roster_member_roles.grade end,
      roster_name = case when p_payload ? 'rosterName' then excluded.roster_name else public.roster_member_roles.roster_name end,
      rotation_ends_on = case when p_payload ? 'rotationEndsOn' then excluded.rotation_ends_on else public.roster_member_roles.rotation_ends_on end,
      role = case when public.roster_member_roles.revoked_at is null then public.roster_member_roles.role else 'member' end,
      revoked_at = null;
    return jsonb_build_object('ok', true);

  elsif p_action = 'member.remove' then
    -- Someone who leaves the team. Only ordinary service members; editors and admins are
    -- removed in On Call by a service admin. Revoking fires every mode's cascade trigger.
    if not v_is_manager then raise exception 'roster_role_denied'; end if;
    v_id := (p_payload ->> 'userId')::uuid;
    if v_id is null or v_id = p_actor_id then raise exception 'roster_invalid_request'; end if;
    update public.on_call_service_members set revoked_at = now(), clinical_reviewer = false
     where service_id = p_service_id and user_id = v_id and revoked_at is null and role = 'member';
    if not found then raise exception 'roster_not_found'; end if;
    insert into public.on_call_service_member_events (service_id, user_id, event, mode, actor_id)
    values (p_service_id, v_id, 'revoked', null, p_actor_id);
    return jsonb_build_object('ok', true);

  elsif p_action = 'settings.set' then
    if not v_is_manager then raise exception 'roster_role_denied'; end if;
    insert into public.roster_team_settings (service_id, swap_approval, rules, rules_source, pay_fortnight_anchor, updated_by)
    values (p_service_id,
            coalesce(p_payload ->> 'swapApproval', 'auto_same_grade'),
            coalesce(p_payload -> 'rules', '{}'::jsonb),
            nullif(btrim(p_payload ->> 'rulesSource'), ''),
            (p_payload ->> 'payFortnightAnchor')::date,
            p_actor_id)
    on conflict (service_id) do update set
      swap_approval = excluded.swap_approval, rules = excluded.rules, rules_source = excluded.rules_source,
      pay_fortnight_anchor = excluded.pay_fortnight_anchor, updated_by = excluded.updated_by;
    return jsonb_build_object('ok', true);

  elsif p_action = 'unavailability.set' then
    -- payload {set: [{date, kind}], clear: [date]} for the actor only, future dates only.
    delete from public.roster_unavailability
     where service_id = p_service_id and user_id = p_actor_id
       and on_date in (select (value #>> '{}')::date from jsonb_array_elements(coalesce(p_payload -> 'clear', '[]')));
    insert into public.roster_unavailability (service_id, user_id, on_date, kind)
    select p_service_id, p_actor_id, (value ->> 'date')::date, value ->> 'kind'
    from jsonb_array_elements(coalesce(p_payload -> 'set', '[]'))
    where (value ->> 'date')::date > (now() at time zone 'Australia/Perth')::date
    on conflict (service_id, user_id, on_date) do update set kind = excluded.kind;
    if (select count(*) from public.roster_unavailability where service_id = p_service_id and user_id = p_actor_id) > 120 then
      raise exception 'roster_limit';
    end if;
    return jsonb_build_object('ok', true);

  -- ---------------------------------------------------------------- publishing
  elsif p_action = 'publish' then
    -- payload {kind, periodStart, periodEnd, sourceName?, replaceAssignmentIds?[], assignments[], draftId?}
    -- The app has already settled rows it couldn't match and approved swaps the file would undo;
    -- this step is all or nothing.
    if not v_is_manager then raise exception 'roster_role_denied'; end if;
    v_from := (p_payload ->> 'periodStart')::date;
    v_to := (p_payload ->> 'periodEnd')::date;
    if v_from is null or v_to is null or jsonb_typeof(p_payload -> 'assignments') is distinct from 'array'
       or jsonb_array_length(p_payload -> 'assignments') > 5000
       or coalesce(p_payload ->> 'kind', 'full') not in ('full', 'single_change') then
      raise exception 'roster_invalid_request';
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_payload -> 'assignments') x
      where (x ->> 'userId') is not null
        and not public.service_member_active(p_service_id, (x ->> 'userId')::uuid)
    ) or exists (
      select 1 from jsonb_array_elements(p_payload -> 'assignments') x
      where (x ->> 'userId') is null and nullif(btrim(x ->> 'rosterName'), '') is null
    ) or exists (
      select 1 from jsonb_array_elements(p_payload -> 'assignments') x
      where ((x ->> 'startsAt')::timestamptz at time zone 'Australia/Perth')::date not between v_from and v_to
    ) then
      raise exception 'roster_invalid_request';
    end if;

    insert into public.roster_publications (service_id, version, kind, period_start, period_end, source_name, published_by)
    values (p_service_id,
            coalesce((select max(version) from public.roster_publications where service_id = p_service_id), 0) + 1,
            coalesce(p_payload ->> 'kind', 'full'), v_from, v_to, nullif(btrim(p_payload ->> 'sourceName'), ''), p_actor_id)
    returning * into v_pub;

    if v_pub.kind = 'full' then
      with replaced as (
        update public.roster_assignments set superseded_at = now()
         where service_id = p_service_id and superseded_at is null
           and (starts_at at time zone 'Australia/Perth')::date between v_from and v_to
        returning id
      )
      select coalesce(array_agg(id), '{}') into v_ids from replaced;
    else
      select coalesce(array_agg((value #>> '{}')::uuid), '{}') into v_ids
        from jsonb_array_elements(coalesce(p_payload -> 'replaceAssignmentIds', '[]'));
      update public.roster_assignments set superseded_at = now()
       where service_id = p_service_id and superseded_at is null and id = any (v_ids);
      get diagnostics v_count = row_count;
      if v_count <> coalesce(array_length(v_ids, 1), 0) then raise exception 'roster_conflict'; end if;
    end if;

    insert into public.roster_assignments (service_id, publication_id, user_id, roster_name, site_id, starts_at, ends_at, shift_code, kind, grade)
    select p_service_id, v_pub.id, (x ->> 'userId')::uuid, nullif(btrim(x ->> 'rosterName'), ''), (x ->> 'siteId')::uuid,
           (x ->> 'startsAt')::timestamptz, (x ->> 'endsAt')::timestamptz, btrim(x ->> 'shiftCode'), x ->> 'kind', x ->> 'grade'
    from jsonb_array_elements(p_payload -> 'assignments') x;

    -- Pending requests on replaced shifts cancel themselves and say why.
    with cancelled as (
      update public.roster_swaps set status = 'cancelled', cancel_reason = 'roster_changed', decided_at = now()
       where service_id = p_service_id and status in ('requested', 'accepted')
         and (give_assignment_id = any (v_ids) or take_assignment_id = any (v_ids))
      returning id, requester_id, counterparty_id
    )
    select jsonb_build_object('swapsCancelled', coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'requesterId', requester_id, 'counterpartyId', counterparty_id)), '[]')) into v_result from cancelled;
    update public.roster_open_shifts set status = 'cancelled', decided_at = now()
     where service_id = p_service_id and status in ('reported', 'open', 'claimed') and assignment_id = any (v_ids);

    insert into public.roster_changes (service_id, target, source, change, actor_id)
    values (p_service_id, 'live', 'publish',
            jsonb_build_object('kind', 'publish', 'publicationId', v_pub.id, 'version', v_pub.version,
                               'replaced', coalesce(array_length(v_ids, 1), 0),
                               'rows', jsonb_array_length(p_payload -> 'assignments')),
            p_actor_id);
    -- The manager has seen their own roster.
    insert into public.roster_publication_seen (publication_id, user_id) values (v_pub.id, p_actor_id);
    if p_payload ? 'draftId' then
      delete from public.roster_drafts where id = (p_payload ->> 'draftId')::uuid and service_id = p_service_id;
    end if;
    return v_result || jsonb_build_object('publicationId', v_pub.id, 'version', v_pub.version);

  -- ---------------------------------------------------------------- swaps
  elsif p_action in ('swap.create', 'swap.accept', 'swap.approve') then
    if p_action = 'swap.create' then
      select * into v_give from public.roster_assignments
       where id = (p_payload ->> 'giveAssignmentId')::uuid and service_id = p_service_id and superseded_at is null for update;
      if not found or v_give.user_id is distinct from p_actor_id or v_give.starts_at <= now() or v_give.kind = 'leave' then
        raise exception 'roster_not_found';
      end if;
      v_id := (p_payload ->> 'counterpartyId')::uuid;
      if v_id is null or v_id = p_actor_id or not public.service_member_active(p_service_id, v_id) then
        raise exception 'roster_not_found';
      end if;
      if p_payload ->> 'takeAssignmentId' is not null then
        select * into v_take from public.roster_assignments
         where id = (p_payload ->> 'takeAssignmentId')::uuid and service_id = p_service_id and superseded_at is null for update;
        if not found or v_take.user_id is distinct from v_id or v_take.starts_at <= now() or v_take.kind = 'leave' then
          raise exception 'roster_not_found';
        end if;
      end if;
      if exists (select 1 from public.roster_swaps w where w.status in ('requested', 'accepted')
                 and (w.give_assignment_id in (v_give.id, v_take.id) or w.take_assignment_id in (v_give.id, v_take.id)))
         or exists (select 1 from public.roster_open_shifts o where o.status in ('reported', 'open', 'claimed')
                 and o.assignment_id in (v_give.id, v_take.id)) then
        raise exception 'roster_request_exists';
      end if;
      insert into public.roster_swaps (service_id, requester_id, counterparty_id, give_assignment_id, take_assignment_id, expires_at)
      values (p_service_id, p_actor_id, v_id, v_give.id, v_take.id,
              least(v_give.starts_at, coalesce(v_take.starts_at, v_give.starts_at), now() + interval '7 days'))
      returning * into v_swap;
    else
      select * into v_swap from public.roster_swaps
       where id = (p_payload ->> 'swapId')::uuid and service_id = p_service_id for update;
      if not found then raise exception 'roster_not_found'; end if;
      if p_action = 'swap.accept' and (v_swap.counterparty_id <> p_actor_id or v_swap.status <> 'requested') then
        raise exception 'roster_not_found';
      end if;
      if p_action = 'swap.approve' and (not v_is_manager or v_swap.status <> 'accepted') then
        raise exception 'roster_role_denied';
      end if;
      -- A manager never approves a swap they are part of.
      if p_action = 'swap.approve' and p_actor_id in (v_swap.requester_id, v_swap.counterparty_id) then
        raise exception 'roster_role_denied';
      end if;
      if v_swap.expires_at <= now() then
        update public.roster_swaps set status = 'expired', decided_at = now() where id = v_swap.id;
        return jsonb_build_object('swapId', v_swap.id, 'status', 'expired');
      end if;
      select * into v_give from public.roster_assignments where id = v_swap.give_assignment_id for update;
      select * into v_take from public.roster_assignments where id = v_swap.take_assignment_id for update;
    end if;

    -- Recheck at every step: still live, still theirs, still eligible, still fits.
    v_reason := null;
    if v_give.superseded_at is not null or v_give.user_id is distinct from v_swap.requester_id
       or (v_swap.take_assignment_id is not null
           and (v_take.superseded_at is not null or v_take.user_id is distinct from v_swap.counterparty_id)) then
      v_reason := 'roster_changed';
    else
      v_giver_rank := public.roster_grade_rank(coalesce(v_give.grade,
        (select grade from public.roster_member_roles where service_id = p_service_id and user_id = v_swap.requester_id and revoked_at is null)));
      v_taker_rank := public.roster_grade_rank(
        (select grade from public.roster_member_roles where service_id = p_service_id and user_id = v_swap.counterparty_id and revoked_at is null));
      if v_giver_rank is null or v_taker_rank is null or v_taker_rank < v_giver_rank then
        v_reason := 'no_longer_fits';
      elsif v_swap.take_assignment_id is not null and (
          public.roster_grade_rank(coalesce(v_take.grade,
            (select grade from public.roster_member_roles where service_id = p_service_id and user_id = v_swap.counterparty_id and revoked_at is null)))
          > public.roster_grade_rank(
            (select grade from public.roster_member_roles where service_id = p_service_id and user_id = v_swap.requester_id and revoked_at is null))
          or public.roster_grade_rank(
            (select grade from public.roster_member_roles where service_id = p_service_id and user_id = v_swap.requester_id and revoked_at is null)) is null) then
        v_reason := 'no_longer_fits';
      elsif public.roster_placement_problem(p_service_id, v_swap.counterparty_id, v_give.starts_at, v_give.ends_at,
              array[v_take.id], null) = 'clash'
         or (v_swap.take_assignment_id is not null and public.roster_placement_problem(p_service_id, v_swap.requester_id,
              v_take.starts_at, v_take.ends_at, array[v_give.id], null) = 'clash') then
        v_reason := 'no_longer_fits';
      end if;
    end if;
    if v_reason is not null then
      if p_action = 'swap.create' then raise exception 'roster_swap_not_eligible'; end if;
      update public.roster_swaps set status = 'cancelled', cancel_reason = v_reason, decided_at = now() where id = v_swap.id;
      return jsonb_build_object('swapId', v_swap.id, 'status', 'cancelled', 'cancelReason', v_reason);
    end if;
    if p_action = 'swap.create' then
      return jsonb_build_object('swapId', v_swap.id, 'status', 'requested');
    end if;

    if p_action = 'swap.accept' then
      -- Does it need the manager? Team setting, then within 7 days, then grade, then team rule.
      v_reason := case
        when coalesce(v_settings.swap_approval, 'auto_same_grade') = 'manager' then 'team_setting'
        when least(v_give.starts_at, coalesce(v_take.starts_at, v_give.starts_at)) < now() + interval '7 days' then 'within_7_days'
        when v_taker_rank <> v_giver_rank then 'different_grade'
        when public.roster_placement_problem(p_service_id, v_swap.counterparty_id, v_give.starts_at, v_give.ends_at, array[v_take.id], v_min_break) is not null
          or (v_swap.take_assignment_id is not null and public.roster_placement_problem(p_service_id, v_swap.requester_id,
                v_take.starts_at, v_take.ends_at, array[v_give.id], v_min_break) is not null) then 'team_rule'
        else null end;
      if v_reason is not null then
        update public.roster_swaps set status = 'accepted', accepted_at = now(), needs_manager_because = v_reason
         where id = v_swap.id;
        return jsonb_build_object('swapId', v_swap.id, 'status', 'accepted', 'needsManagerBecause', v_reason);
      end if;
    end if;

    -- Apply: both shifts change hands together, with the undo saved in the same step.
    update public.roster_assignments set user_id = v_swap.counterparty_id, roster_name = null where id = v_give.id;
    if v_swap.take_assignment_id is not null then
      update public.roster_assignments set user_id = v_swap.requester_id, roster_name = null where id = v_take.id;
    end if;
    update public.roster_swaps
       set status = 'approved', auto_approved = (p_action = 'swap.accept'),
           accepted_at = coalesce(accepted_at, now()), decided_at = now(),
           decided_by = case when p_action = 'swap.approve' then p_actor_id else null end
     where id = v_swap.id;
    insert into public.roster_changes (service_id, target, source, change, undo, actor_id)
    values (p_service_id, 'live', 'swap',
            jsonb_build_object('kind', 'swap', 'swapId', v_swap.id),
            jsonb_build_object('assignments', jsonb_build_array(
              jsonb_build_object('id', v_give.id, 'userId', v_give.user_id, 'rosterName', v_give.roster_name))
              || case when v_take.id is null then '[]'::jsonb else jsonb_build_array(
              jsonb_build_object('id', v_take.id, 'userId', v_take.user_id, 'rosterName', v_take.roster_name)) end),
            p_actor_id);
    -- Any other request that relied on these shifts no longer fits.
    update public.roster_swaps set status = 'cancelled', cancel_reason = 'roster_changed', decided_at = now()
     where service_id = p_service_id and id <> v_swap.id and status in ('requested', 'accepted')
       and (give_assignment_id in (v_give.id, v_take.id) or take_assignment_id in (v_give.id, v_take.id));
    return jsonb_build_object('swapId', v_swap.id, 'status', 'approved', 'autoApproved', p_action = 'swap.accept');

  elsif p_action in ('swap.decline', 'swap.cancel', 'swap.undo') then
    select * into v_swap from public.roster_swaps
     where id = (p_payload ->> 'swapId')::uuid and service_id = p_service_id for update;
    if not found then raise exception 'roster_not_found'; end if;
    if p_action = 'swap.decline' then
      if not ((v_swap.status = 'requested' and v_swap.counterparty_id = p_actor_id)
              or (v_swap.status = 'accepted' and v_is_manager and p_actor_id not in (v_swap.requester_id, v_swap.counterparty_id))) then
        raise exception 'roster_role_denied';
      end if;
      update public.roster_swaps set status = 'declined', decided_at = now(),
             decided_by = case when v_swap.status = 'accepted' then p_actor_id else null end
       where id = v_swap.id;
      return jsonb_build_object('swapId', v_swap.id, 'status', 'declined');
    elsif p_action = 'swap.cancel' then
      if v_swap.requester_id <> p_actor_id or v_swap.status not in ('requested', 'accepted') then
        raise exception 'roster_role_denied';
      end if;
      update public.roster_swaps set status = 'cancelled', cancel_reason = 'withdrawn', decided_at = now() where id = v_swap.id;
      return jsonb_build_object('swapId', v_swap.id, 'status', 'cancelled');
    else
      -- "Undo for 10 min" after a swap approved itself, by either doctor, if nothing moved since.
      if not v_swap.auto_approved or v_swap.status <> 'approved' or v_swap.decided_at < now() - interval '10 minutes'
         or p_actor_id not in (v_swap.requester_id, v_swap.counterparty_id) then
        raise exception 'roster_role_denied';
      end if;
      select * into v_give from public.roster_assignments where id = v_swap.give_assignment_id for update;
      select * into v_take from public.roster_assignments where id = v_swap.take_assignment_id for update;
      if v_give.superseded_at is not null or v_give.user_id is distinct from v_swap.counterparty_id
         or (v_take.id is not null and (v_take.superseded_at is not null or v_take.user_id is distinct from v_swap.requester_id)) then
        raise exception 'roster_conflict';
      end if;
      update public.roster_assignments set user_id = v_swap.requester_id where id = v_give.id;
      if v_take.id is not null then
        update public.roster_assignments set user_id = v_swap.counterparty_id where id = v_take.id;
      end if;
      update public.roster_swaps set status = 'undone', decided_at = now() where id = v_swap.id;
      update public.roster_changes set undone_at = now(), undone_by = p_actor_id
       where service_id = p_service_id and source = 'swap' and change ->> 'swapId' = v_swap.id::text and undone_at is null;
      return jsonb_build_object('swapId', v_swap.id, 'status', 'undone');
    end if;

  -- ---------------------------------------------------------------- open shifts
  elsif p_action in ('open.post', 'open.report') then
    -- open.post: a member gives away their own shift, or a manager posts any live shift or a gap.
    -- open.report: "I can't make my shift": waits as 'reported' for the manager to release it.
    if p_payload ->> 'assignmentId' is not null then
      select * into v_give from public.roster_assignments
       where id = (p_payload ->> 'assignmentId')::uuid and service_id = p_service_id and superseded_at is null for update;
      if not found or v_give.ends_at <= now() or v_give.kind = 'leave'
         or (not v_is_manager and v_give.user_id is distinct from p_actor_id) then
        raise exception 'roster_not_found';
      end if;
      if exists (select 1 from public.roster_swaps w where w.status in ('requested', 'accepted')
                 and (w.give_assignment_id = v_give.id or w.take_assignment_id = v_give.id)) then
        raise exception 'roster_request_exists';
      end if;
      insert into public.roster_open_shifts (service_id, assignment_id, starts_at, ends_at, shift_code, kind, site_id,
                                             min_grade, urgent, status, posted_by)
      values (p_service_id, v_give.id, v_give.starts_at, v_give.ends_at, v_give.shift_code, v_give.kind, v_give.site_id,
              coalesce(nullif(v_give.grade, 'other'),
                       nullif((select grade from public.roster_member_roles where service_id = p_service_id
                               and user_id = v_give.user_id and revoked_at is null), 'other')),
              case when p_action = 'open.report' then true else coalesce((p_payload ->> 'urgent')::boolean, false) and v_is_manager end,
              case when p_action = 'open.report' then 'reported' else 'open' end, p_actor_id)
      returning * into v_open;
    else
      if p_action = 'open.report' or not v_is_manager then raise exception 'roster_role_denied'; end if;
      insert into public.roster_open_shifts (service_id, starts_at, ends_at, shift_code, kind, site_id, min_grade, urgent, posted_by)
      values (p_service_id, (p_payload ->> 'startsAt')::timestamptz, (p_payload ->> 'endsAt')::timestamptz,
              btrim(p_payload ->> 'shiftCode'), p_payload ->> 'kind', (p_payload ->> 'siteId')::uuid,
              p_payload ->> 'minGrade', coalesce((p_payload ->> 'urgent')::boolean, false), p_actor_id)
      returning * into v_open;
      if v_open.starts_at <= now() then raise exception 'roster_invalid_request'; end if;
    end if;
    if (select count(*) from public.roster_open_shifts where service_id = p_service_id and status in ('reported', 'open', 'claimed')) > 1000 then
      raise exception 'roster_limit';
    end if;
    return jsonb_build_object('openShiftId', v_open.id, 'status', v_open.status);

  elsif p_action in ('open.claim', 'open.approve', 'open.decline', 'open.cancel', 'open.release') then
    select * into v_open from public.roster_open_shifts
     where id = (p_payload ->> 'openShiftId')::uuid and service_id = p_service_id for update;
    if not found then raise exception 'roster_not_found'; end if;

    if p_action = 'open.release' then
      if not v_is_manager or v_open.status <> 'reported' then raise exception 'roster_role_denied'; end if;
      update public.roster_open_shifts set status = 'open', urgent = coalesce((p_payload ->> 'urgent')::boolean, true)
       where id = v_open.id;
      return jsonb_build_object('openShiftId', v_open.id, 'status', 'open');
    elsif p_action = 'open.cancel' then
      if v_open.status not in ('reported', 'open', 'claimed') or not (v_is_manager or v_open.posted_by = p_actor_id) then
        raise exception 'roster_role_denied';
      end if;
      update public.roster_open_shifts set status = 'cancelled', decided_at = now(), decided_by = p_actor_id where id = v_open.id;
      return jsonb_build_object('openShiftId', v_open.id, 'status', 'cancelled');
    elsif p_action = 'open.decline' then
      if not v_is_manager or v_open.status <> 'claimed' or v_open.claimed_by = p_actor_id then raise exception 'roster_role_denied'; end if;
      update public.roster_open_shifts set status = 'open', claimed_by = null, claimed_at = null where id = v_open.id;
      return jsonb_build_object('openShiftId', v_open.id, 'status', 'open');
    end if;

    if p_action = 'open.claim' then
      if v_open.status <> 'open' then raise exception 'roster_open_shift_taken'; end if;
      if v_open.starts_at <= now() or v_open.posted_by = p_actor_id then raise exception 'roster_not_found'; end if;
      v_id := p_actor_id;
    else
      if not v_is_manager or v_open.status <> 'claimed' or v_open.claimed_by = p_actor_id then raise exception 'roster_role_denied'; end if;
      v_id := v_open.claimed_by;
    end if;
    v_taker_rank := public.roster_grade_rank(
      (select grade from public.roster_member_roles where service_id = p_service_id and user_id = v_id and revoked_at is null));
    if v_taker_rank is null or (v_open.min_grade is not null and v_taker_rank < public.roster_grade_rank(v_open.min_grade))
       or public.roster_placement_problem(p_service_id, v_id, v_open.starts_at, v_open.ends_at,
            array[v_open.assignment_id], null) is not null then
      raise exception 'roster_swap_not_eligible';
    end if;
    if p_action = 'open.claim' and (
         coalesce(v_settings.swap_approval, 'auto_same_grade') = 'manager'
         or v_open.starts_at < now() + interval '7 days'
         or v_open.min_grade is null or v_taker_rank <> public.roster_grade_rank(v_open.min_grade)
         or public.roster_placement_problem(p_service_id, v_id, v_open.starts_at, v_open.ends_at,
              array[v_open.assignment_id], v_min_break) is not null) then
      update public.roster_open_shifts set status = 'claimed', claimed_by = v_id, claimed_at = now() where id = v_open.id;
      return jsonb_build_object('openShiftId', v_open.id, 'status', 'claimed');
    end if;

    -- Apply: the shift moves to the taker (or a gap becomes their shift), with its undo.
    if v_open.assignment_id is not null then
      select * into v_give from public.roster_assignments where id = v_open.assignment_id for update;
      if v_give.superseded_at is not null then raise exception 'roster_conflict'; end if;
      update public.roster_assignments set user_id = v_id, roster_name = null where id = v_give.id;
      v_row := jsonb_build_object('id', v_give.id, 'userId', v_give.user_id, 'rosterName', v_give.roster_name);
    else
      select * into v_pub from public.roster_publications where service_id = p_service_id order by version desc limit 1;
      if not found then raise exception 'roster_conflict'; end if;
      insert into public.roster_assignments (service_id, publication_id, user_id, site_id, starts_at, ends_at, shift_code, kind, grade)
      values (p_service_id, v_pub.id, v_id, v_open.site_id, v_open.starts_at, v_open.ends_at, v_open.shift_code, v_open.kind, v_open.min_grade)
      returning * into v_give;
      v_row := jsonb_build_object('id', v_give.id, 'delete', true);
    end if;
    update public.roster_open_shifts
       set status = 'approved', claimed_by = v_id, claimed_at = coalesce(claimed_at, now()), decided_at = now(),
           decided_by = case when p_action = 'open.approve' then p_actor_id else null end
     where id = v_open.id;
    insert into public.roster_changes (service_id, target, source, change, undo, actor_id)
    values (p_service_id, 'live', 'open_shift', jsonb_build_object('kind', 'open_shift', 'openShiftId', v_open.id),
            jsonb_build_object('assignments', jsonb_build_array(v_row)), p_actor_id);
    return jsonb_build_object('openShiftId', v_open.id, 'status', 'approved', 'assignmentId', v_give.id);

  -- ---------------------------------------------------------------- roster maker (Release 3)
  elsif p_action = 'codes.set' then
    if not v_is_manager then raise exception 'roster_role_denied'; end if;
    delete from public.roster_shift_codes where service_id = p_service_id;
    insert into public.roster_shift_codes (service_id, code, kind, starts, ends, label)
    select p_service_id, btrim(x ->> 'code'), x ->> 'kind', (x ->> 'starts')::time, (x ->> 'ends')::time, nullif(btrim(x ->> 'label'), '')
    from jsonb_array_elements(coalesce(p_payload -> 'codes', '[]')) x;
    if (select count(*) from public.roster_shift_codes where service_id = p_service_id) > 100 then raise exception 'roster_limit'; end if;
    return jsonb_build_object('ok', true);

  elsif p_action = 'needs.set' then
    if not v_is_manager then raise exception 'roster_role_denied'; end if;
    delete from public.roster_staffing_needs where service_id = p_service_id;
    insert into public.roster_staffing_needs (service_id, weekday, on_date, kind, grade, site_id, needed)
    select p_service_id, (x ->> 'weekday')::smallint, (x ->> 'date')::date, x ->> 'kind', x ->> 'grade',
           (x ->> 'siteId')::uuid, (x ->> 'needed')::smallint
    from jsonb_array_elements(coalesce(p_payload -> 'needs', '[]')) x;
    if (select count(*) from public.roster_staffing_needs where service_id = p_service_id) > 2000 then raise exception 'roster_limit'; end if;
    return jsonb_build_object('ok', true);

  elsif p_action = 'draft.open' then
    -- Start (or return) the draft for a period, copied from the live roster.
    if not v_is_manager then raise exception 'roster_role_denied'; end if;
    v_from := (p_payload ->> 'periodStart')::date;
    v_to := (p_payload ->> 'periodEnd')::date;
    select * into v_draft from public.roster_drafts
     where service_id = p_service_id and period_start = v_from and period_end = v_to;
    if found then return jsonb_build_object('draftId', v_draft.id, 'created', false); end if;
    if (select count(*) from public.roster_drafts where service_id = p_service_id) >= 12 then raise exception 'roster_limit'; end if;
    insert into public.roster_drafts (service_id, period_start, period_end, based_on_publication_id, created_by)
    values (p_service_id, v_from, v_to,
            (select id from public.roster_publications where service_id = p_service_id order by version desc limit 1), p_actor_id)
    returning * into v_draft;
    insert into public.roster_draft_assignments (draft_id, user_id, roster_name, site_id, starts_at, ends_at, shift_code, kind, grade)
    select v_draft.id, a.user_id,
           case when a.user_id is null then coalesce(a.roster_name, 'Unnamed') else a.roster_name end,
           a.site_id, a.starts_at, a.ends_at, a.shift_code, a.kind, a.grade
    from public.roster_assignments a
    where a.service_id = p_service_id and a.superseded_at is null
      and (a.starts_at at time zone 'Australia/Perth')::date between v_from and v_to;
    return jsonb_build_object('draftId', v_draft.id, 'created', true);

  elsif p_action = 'draft.change' then
    -- payload {draftId, source, ops: [{op:'add', row{...}} | {op:'remove', id} | {op:'update', id, row{...}}]}
    -- One roster_changes row per op, each with its undo, in this one transaction.
    if not v_is_manager then raise exception 'roster_role_denied'; end if;
    select * into v_draft from public.roster_drafts
     where id = (p_payload ->> 'draftId')::uuid and service_id = p_service_id for update;
    if not found then raise exception 'roster_not_found'; end if;
    if coalesce(p_payload ->> 'source', '') not in ('typed', 'grid', 'upload')
       or jsonb_typeof(p_payload -> 'ops') is distinct from 'array' or jsonb_array_length(p_payload -> 'ops') > 500 then
      raise exception 'roster_invalid_request';
    end if;
    for v_row in select value from jsonb_array_elements(p_payload -> 'ops') loop
      if v_row ->> 'op' = 'add' then
        if (v_row #>> '{row,userId}') is not null
           and not public.service_member_active(p_service_id, (v_row #>> '{row,userId}')::uuid) then
          raise exception 'roster_invalid_request';
        end if;
        insert into public.roster_draft_assignments (draft_id, user_id, roster_name, site_id, starts_at, ends_at, shift_code, kind, grade)
        values (v_draft.id, (v_row #>> '{row,userId}')::uuid, nullif(btrim(v_row #>> '{row,rosterName}'), ''),
                (v_row #>> '{row,siteId}')::uuid, (v_row #>> '{row,startsAt}')::timestamptz, (v_row #>> '{row,endsAt}')::timestamptz,
                btrim(v_row #>> '{row,shiftCode}'), v_row #>> '{row,kind}', v_row #>> '{row,grade}')
        returning id into v_id;
        insert into public.roster_changes (service_id, draft_id, target, source, change, undo, actor_id)
        values (p_service_id, v_draft.id, 'draft', p_payload ->> 'source', v_row || jsonb_build_object('id', v_id),
                jsonb_build_object('op', 'remove', 'id', v_id), p_actor_id)
        returning id into v_change_id;
      elsif v_row ->> 'op' in ('remove', 'update') then
        select to_jsonb(d) - 'draft_id' into v_result from public.roster_draft_assignments d
         where d.id = (v_row ->> 'id')::uuid and d.draft_id = v_draft.id for update;
        if v_result is null then raise exception 'roster_conflict'; end if;
        if v_row ->> 'op' = 'remove' then
          delete from public.roster_draft_assignments where id = (v_row ->> 'id')::uuid;
          insert into public.roster_changes (service_id, draft_id, target, source, change, undo, actor_id)
          values (p_service_id, v_draft.id, 'draft', p_payload ->> 'source', v_row,
                  jsonb_build_object('op', 'add', 'row', v_result), p_actor_id)
          returning id into v_change_id;
        else
          if (v_row #>> '{row,userId}') is not null
             and not public.service_member_active(p_service_id, (v_row #>> '{row,userId}')::uuid) then
            raise exception 'roster_invalid_request';
          end if;
          update public.roster_draft_assignments set
            user_id = case when v_row -> 'row' ? 'userId' then (v_row #>> '{row,userId}')::uuid else user_id end,
            roster_name = case when v_row -> 'row' ? 'rosterName' then nullif(btrim(v_row #>> '{row,rosterName}'), '') else roster_name end,
            site_id = case when v_row -> 'row' ? 'siteId' then (v_row #>> '{row,siteId}')::uuid else site_id end,
            starts_at = coalesce((v_row #>> '{row,startsAt}')::timestamptz, starts_at),
            ends_at = coalesce((v_row #>> '{row,endsAt}')::timestamptz, ends_at),
            shift_code = coalesce(btrim(v_row #>> '{row,shiftCode}'), shift_code),
            kind = coalesce(v_row #>> '{row,kind}', kind),
            grade = case when v_row -> 'row' ? 'grade' then v_row #>> '{row,grade}' else grade end
          where id = (v_row ->> 'id')::uuid;
          insert into public.roster_changes (service_id, draft_id, target, source, change, undo, actor_id)
          values (p_service_id, v_draft.id, 'draft', p_payload ->> 'source', v_row,
                  jsonb_build_object('op', 'update', 'id', v_row ->> 'id', 'row', v_result - 'id'), p_actor_id)
          returning id into v_change_id;
        end if;
      else
        raise exception 'roster_invalid_request';
      end if;
    end loop;
    if (select count(*) from public.roster_draft_assignments where draft_id = v_draft.id) > 5000 then raise exception 'roster_limit'; end if;
    update public.roster_drafts set updated_at = now() where id = v_draft.id;
    return jsonb_build_object('ok', true, 'lastChangeId', v_change_id);

  elsif p_action = 'draft.undo' then
    if not v_is_manager then raise exception 'roster_role_denied'; end if;
    select to_jsonb(x) into v_row from public.roster_changes x
     where x.id = (p_payload ->> 'changeId')::bigint and x.service_id = p_service_id
       and x.target = 'draft' and x.undone_at is null for update;
    if v_row is null then raise exception 'roster_not_found'; end if;
    if v_row #>> '{undo,op}' = 'remove' then
      delete from public.roster_draft_assignments where id = (v_row #>> '{undo,id}')::uuid
        and draft_id = (v_row ->> 'draft_id')::uuid;
      if not found then raise exception 'roster_conflict'; end if;
    elsif v_row #>> '{undo,op}' = 'add' then
      insert into public.roster_draft_assignments (id, draft_id, user_id, roster_name, site_id, starts_at, ends_at, shift_code, kind, grade)
      values ((v_row #>> '{undo,row,id}')::uuid, (v_row ->> 'draft_id')::uuid, (v_row #>> '{undo,row,user_id}')::uuid,
              v_row #>> '{undo,row,roster_name}', (v_row #>> '{undo,row,site_id}')::uuid,
              (v_row #>> '{undo,row,starts_at}')::timestamptz, (v_row #>> '{undo,row,ends_at}')::timestamptz,
              v_row #>> '{undo,row,shift_code}', v_row #>> '{undo,row,kind}', v_row #>> '{undo,row,grade}');
    else
      update public.roster_draft_assignments set
        user_id = (v_row #>> '{undo,row,user_id}')::uuid, roster_name = v_row #>> '{undo,row,roster_name}',
        site_id = (v_row #>> '{undo,row,site_id}')::uuid, starts_at = (v_row #>> '{undo,row,starts_at}')::timestamptz,
        ends_at = (v_row #>> '{undo,row,ends_at}')::timestamptz, shift_code = v_row #>> '{undo,row,shift_code}',
        kind = v_row #>> '{undo,row,kind}', grade = v_row #>> '{undo,row,grade}'
      where id = (v_row #>> '{undo,id}')::uuid and draft_id = (v_row ->> 'draft_id')::uuid;
      if not found then raise exception 'roster_conflict'; end if;
    end if;
    update public.roster_changes set undone_at = now(), undone_by = p_actor_id where id = (v_row ->> 'id')::bigint;
    return jsonb_build_object('ok', true);

  elsif p_action = 'agreement.record' then
    if not exists (select 1 from public.roster_changes c where c.id = (p_payload ->> 'changeId')::bigint
                   and c.service_id = p_service_id and c.agreement_required and c.undone_at is null) then
      raise exception 'roster_not_found';
    end if;
    insert into public.roster_change_agreements (change_id, user_id) values ((p_payload ->> 'changeId')::bigint, p_actor_id)
      on conflict do nothing;
    return jsonb_build_object('ok', true);
  end if;

  raise exception 'roster_invalid_request';
end $$;

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
