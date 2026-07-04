set search_path = public, pg_catalog, pg_temp;

-- Curated differential catalogue backing the Differentials mode: structured records
-- (presentations, diagnosis options, comparison workflows) seeded from the reviewed
-- differentials export snapshot. Owner-scoped like every other app table; ownership
-- is enforced at the API layer via the service-role client.
create table if not exists public.differential_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('presentation', 'diagnosis')),
  slug text not null check (btrim(slug) <> ''),
  title text not null check (btrim(title) <> ''),
  status text not null check (status in ('emergent', 'urgent', 'routine')),
  subtitle text,
  clinical_hinge text,
  tags text[] not null default '{}',
  payload jsonb not null default '{}'::jsonb,
  source jsonb not null default '{}'::jsonb,
  source_status text not null default 'unknown'
    check (source_status in ('current', 'review_due', 'outdated', 'unknown')),
  validation_status text not null default 'unverified'
    check (validation_status in ('unverified', 'locally_reviewed', 'approved')),
  last_reviewed_at date,
  review_due_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, kind, slug)
);

create index if not exists differential_records_owner_kind_title_idx
  on public.differential_records(owner_id, kind, title);

drop trigger if exists differential_records_updated_at on public.differential_records;
create trigger differential_records_updated_at
  before update on public.differential_records
  for each row execute function public.set_updated_at();

alter table public.differential_records enable row level security;

revoke all on public.differential_records from anon, authenticated;

grant select, insert, update, delete on table public.differential_records to service_role;

drop policy if exists "differential records service role all" on public.differential_records;
create policy "differential records service role all" on public.differential_records
  for all to service_role using (true) with check (true);
