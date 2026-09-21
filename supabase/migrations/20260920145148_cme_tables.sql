set search_path = public, pg_catalog, pg_temp;

-- CME: an owner's continuing-education record.
--
-- Single-owner, single-layer tenancy, the same design as `on_call_entries`:
-- RLS on, no grant at all to anon/authenticated, service_role only, and the
-- real owner predicate is `.eq("owner_id", …)` in application code where
-- `npm run check:owner-scope` can prove it.
--
-- `cme_requirements.spec` is jsonb rather than columns because the four
-- requirement shapes are not a fixed set: a trainee's weekly supervision
-- cadence and a count scoped to a rotation are already known to be coming, and
-- a shape change must not be a migration against the live clinical database.

create table if not exists public.cme_years (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  year smallint not null,
  total_hours numeric(6, 2) not null,
  -- Provenance travels with the targets and renders on every screen showing one.
  confirmed_on date not null,
  confirmed_source text not null,
  closed_at timestamptz,
  shortfall_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, year)
);

create table if not exists public.cme_requirements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  year_id uuid not null references public.cme_years (id) on delete cascade,
  label text not null,
  source text not null check (source in ('national', 'college')),
  spec jsonb not null,
  completed_on date,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.cme_routines (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  cadence text not null check (cadence in ('weekly', 'monthly', 'quarterly')),
  usual_hours numeric(5, 2) not null,
  usual_allocations jsonb not null default '[]'::jsonb,
  next_due date,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.cme_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  year_id uuid not null references public.cme_years (id) on delete cascade,
  -- A Perth calendar date, decided by the application. Never derived from a
  -- timestamp in the database, which would be UTC and would move an entry
  -- logged after 16:00 UTC on 31 December into the wrong year.
  activity_date date not null,
  title text not null,
  reflection text not null default '',
  cost_cents integer check (cost_cents is null or cost_cents >= 0),
  transcribed_at timestamptz,
  routine_id uuid references public.cme_routines (id) on delete set null,
  document_id uuid references public.documents (id) on delete set null,
  buckets text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cme_allocations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  entry_id uuid not null references public.cme_entries (id) on delete cascade,
  category text not null check (category in ('educational', 'reviewing', 'measuring')),
  hours numeric(5, 2) not null check (hours > 0),
  unique (entry_id, category)
);

create index if not exists cme_entries_owner_year_date_idx
  on public.cme_entries (owner_id, year_id, activity_date desc);
create index if not exists cme_allocations_entry_idx
  on public.cme_allocations (entry_id);
create index if not exists cme_requirements_year_idx
  on public.cme_requirements (year_id, sort_order);

-- `cme_years` and `cme_entries` carry `updated_at`; keep it current the same
-- way every other mutable table in this schema does, rather than trusting
-- every future write path to set it by hand (on_call_entries, medication_records
-- and documents all follow this same before-update trigger pattern).
drop trigger if exists cme_years_updated_at on public.cme_years;
create trigger cme_years_updated_at
  before update on public.cme_years
  for each row execute function public.set_updated_at();

drop trigger if exists cme_entries_updated_at on public.cme_entries;
create trigger cme_entries_updated_at
  before update on public.cme_entries
  for each row execute function public.set_updated_at();

do $$
declare
  t text;
begin
  foreach t in array array['cme_years', 'cme_requirements', 'cme_routines', 'cme_entries', 'cme_allocations']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to service_role', t);
    execute format('drop policy if exists "%s service role all" on public.%I', t, t);
    execute format(
      'create policy "%s service role all" on public.%I for all to service_role using (true) with check (true)',
      t, t
    );
  end loop;
end
$$;
