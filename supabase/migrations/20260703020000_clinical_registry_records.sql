set search_path = public, pg_catalog, pg_temp;

-- Curated clinical registry backing the Services and Forms modes: structured
-- records (contacts, eligibility, referral pathways, criteria) for real WA
-- entities, seeded from reviewed fixtures and linkable to verifying source
-- documents in the indexed corpus. Owner-scoped like every other app table;
-- ownership is enforced at the API layer via the service-role client.
create table if not exists public.clinical_registry_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('service', 'form')),
  slug text not null check (btrim(slug) <> ''),
  title text not null check (btrim(title) <> ''),
  subtitle text,
  route text,
  eligibility text,
  cost text,
  referral text,
  location text,
  best_use text,
  catalogue_label text,
  navigator_query text,
  tags text[] not null default '{}',
  catchments text[] not null default '{}',
  status_chips jsonb not null default '[]'::jsonb,
  primary_contact jsonb,
  contacts jsonb not null default '[]'::jsonb,
  summary_cards jsonb not null default '[]'::jsonb,
  referral_info jsonb not null default '[]'::jsonb,
  criteria jsonb not null default '[]'::jsonb,
  verification jsonb not null default '{}'::jsonb,
  source jsonb not null default '{}'::jsonb,
  -- Governance columns mirror the search-scope enums so registry records carry
  -- the same conservative source metadata as documents (missing -> unknown).
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

-- Source-document linkage: which indexed corpus documents verify a registry
-- record. FK integrity keeps links honest when documents are deleted.
create table if not exists public.clinical_registry_record_sources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  record_id uuid not null references public.clinical_registry_records(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  unique (record_id, document_id)
);

create index if not exists clinical_registry_records_owner_kind_idx
  on public.clinical_registry_records(owner_id, kind, title);
create index if not exists clinical_registry_record_sources_record_idx
  on public.clinical_registry_record_sources(record_id);
create index if not exists clinical_registry_record_sources_document_idx
  on public.clinical_registry_record_sources(document_id);

drop trigger if exists clinical_registry_records_updated_at on public.clinical_registry_records;
create trigger clinical_registry_records_updated_at
  before update on public.clinical_registry_records
  for each row execute function public.set_updated_at();

-- Service-role only: reads and writes go through the API layer, which enforces
-- owner scoping on every query (application-layer model, same as documents).
alter table public.clinical_registry_records enable row level security;
alter table public.clinical_registry_record_sources enable row level security;

revoke all on public.clinical_registry_records from anon, authenticated;
revoke all on public.clinical_registry_record_sources from anon, authenticated;

grant select, insert, update, delete on table public.clinical_registry_records to service_role;
grant select, insert, update, delete on table public.clinical_registry_record_sources to service_role;

drop policy if exists "registry records service role all" on public.clinical_registry_records;
create policy "registry records service role all" on public.clinical_registry_records
  for all to service_role using (true) with check (true);

drop policy if exists "registry record sources service role all" on public.clinical_registry_record_sources;
create policy "registry record sources service role all" on public.clinical_registry_record_sources
  for all to service_role using (true) with check (true);
