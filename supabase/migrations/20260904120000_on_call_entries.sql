set search_path = public, pg_catalog, pg_temp;

-- The On Call mode's operational entries: orientation shelves, role-based
-- contacts, referral pathways, teaching sessions, escalation playbook cards and
-- site logistics. One table, discriminated by `section`, with the per-section
-- fields in `details` and validated in the API layer by a Zod schema per
-- section (src/lib/on-call/entry-model.ts).
--
-- `owner_id` is NOT NULL on purpose. Unlike `documents`, a null owner carries no
-- visibility meaning here: this table has no public state and must never gain
-- one, because its rows are a hospital's internal contact and orientation
-- information. Ownership is enforced at the API layer via the service-role
-- client, the same application-layer model as clinical_registry_records.
create table if not exists public.on_call_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  section text not null check (
    section in ('contacts', 'playbook', 'referrals', 'orientation', 'education', 'logistics')
  ),
  slug text not null check (btrim(slug) <> ''),
  title text not null check (btrim(title) <> ''),
  subtitle text,
  body text,
  details jsonb not null default '{}'::jsonb,
  linked_document_ids uuid[] not null default '{}',
  tags text[] not null default '{}',
  -- A personal direct number. Excluded from the printable card and from any
  -- export; see src/lib/on-call/card-selection.ts.
  is_personal boolean not null default false,
  include_on_card boolean not null default false,
  sort_order integer not null default 0,
  -- When the owner last confirmed this entry is still correct. NULL means never.
  -- There is deliberately no stored due date or stale flag: freshness is derived
  -- at read time, so the twelve-month interval can change without a backfill.
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, section, slug)
);

create index if not exists on_call_entries_owner_section_idx
  on public.on_call_entries(owner_id, section, sort_order, title);

drop trigger if exists on_call_entries_updated_at on public.on_call_entries;
create trigger on_call_entries_updated_at
  before update on public.on_call_entries
  for each row execute function public.set_updated_at();

alter table public.on_call_entries enable row level security;

revoke all on public.on_call_entries from anon, authenticated;

grant select, insert, update, delete on table public.on_call_entries to service_role;

drop policy if exists "on call entries service role all" on public.on_call_entries;
create policy "on call entries service role all" on public.on_call_entries
  for all to service_role using (true) with check (true);
