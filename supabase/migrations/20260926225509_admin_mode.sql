-- admin_mode.sql: Admin mode's file for Roster's combined DB PR (Admin thread, 2026-09-26, v2 against
-- /mnt/project-files/roster-mode/shared-db-contract.md v1). Placeholder name; Roster stamps it as file 3,
-- after roster_shared_services_hardening and roster_mode, before teaching_mode. Josh merges the PR himself.
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
