set search_path = public, pg_catalog, pg_temp;

-- Preserve the full services catalog export alongside mapped registry columns so
-- clinically important fields (verification flags, aliases, search text, structured
-- tags) are not lost when seeding from the WA psychiatric services snapshot.
alter table public.clinical_registry_records
  add column if not exists catalog_payload jsonb not null default '{}'::jsonb;
