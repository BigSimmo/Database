set search_path = public, pg_catalog, pg_temp;

-- Curated medication catalogue backing the Prescribing mode: structured drug
-- guide entries seeded from the reviewed Medications export. Owner-scoped like
-- every other app table; reads and writes go through the API layer.
create table if not exists public.medication_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null check (btrim(slug) <> ''),
  name text not null check (btrim(name) <> ''),
  class text not null default '',
  subclass text not null default '',
  category text not null default '',
  accent text not null default '#0f766e',
  tag text not null default '',
  schedule text not null default '',
  stats jsonb not null default '[]'::jsonb,
  sections jsonb not null default '[]'::jsonb,
  quick jsonb not null default '[]'::jsonb,
  source_status text not null default 'unknown'
    check (source_status in ('current', 'review_due', 'outdated', 'unknown')),
  validation_status text not null default 'unverified'
    check (validation_status in ('unverified', 'locally_reviewed', 'approved')),
  last_reviewed_at date,
  review_due_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug)
);

create index if not exists medication_records_owner_name_idx
  on public.medication_records(owner_id, name);
create index if not exists medication_records_owner_category_idx
  on public.medication_records(owner_id, category);
create index if not exists medication_records_owner_schedule_idx
  on public.medication_records(owner_id, schedule);

drop trigger if exists medication_records_updated_at on public.medication_records;
create trigger medication_records_updated_at
  before update on public.medication_records
  for each row execute function public.set_updated_at();

alter table public.medication_records enable row level security;

revoke all on public.medication_records from anon, authenticated;

grant select, insert, update, delete on table public.medication_records to service_role;

drop policy if exists "medication records service role all" on public.medication_records;
create policy "medication records service role all" on public.medication_records
  for all to service_role using (true) with check (true);
