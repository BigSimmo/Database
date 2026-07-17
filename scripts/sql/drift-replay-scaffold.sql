-- Minimal storage-schema scaffold so supabase/schema.sql can replay on a bare
-- supabase/postgres Docker image (used by `npm run drift:manifest` and the
-- disaster-recovery rehearsal in docs/disaster-recovery-runbook.md).
--
-- The hosted platform provisions storage.buckets / storage.objects /
-- storage.foldername() through the Storage service's own migrations; the bare
-- image ships the empty `storage` schema only. schema.sql needs the buckets
-- table (bucket inserts), the objects table (owner-read policies), and
-- foldername() (referenced by those policy predicates). Column shapes below
-- mirror the hosted service closely enough for DDL replay; they are NOT a
-- substitute for the real Storage service.
--
-- Idempotent; safe to re-run. Never run against the live project (it already
-- has the real storage schema, and every statement here is create-if-missing,
-- but there is no reason for it to touch live).
--
-- Run as `supabase_admin` (the image's superuser): the bare image ships the
-- `storage` schema owned by supabase_admin, and `postgres` cannot create in
-- it. Ownership of the scaffold tables is handed to `postgres` afterwards so
-- schema.sql (applied as `postgres`, matching how live is administered) can
-- insert bucket rows and create the storage.objects policies.

create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null unique,
  owner uuid,
  public boolean default false,
  avif_autodetection boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  owner_id text,
  version text,
  metadata jsonb,
  path_tokens text[] generated always as (string_to_array(name, '/')) stored,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_accessed_at timestamptz default now()
);

alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;

create or replace function storage.foldername(name text)
returns text[]
language plpgsql
immutable
as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1 : array_length(_parts, 1) - 1];
end;
$$;

alter table storage.buckets owner to postgres;
alter table storage.objects owner to postgres;
alter function storage.foldername(text) owner to postgres;

grant usage on schema storage to postgres, anon, authenticated, service_role;
grant create on schema storage to postgres;

-- The production migration intentionally fails closed when supabase_admin's
-- future-object defaults are unsafe and the migration role cannot repair
-- them. Seed the expected platform postcondition while this scaffold is
-- already running as supabase_admin so scratch replay validates the assertion
-- instead of bypassing it.
alter default privileges
  revoke all privileges on tables from anon, authenticated, service_role;
alter default privileges in schema public
  revoke all privileges on tables from anon, authenticated, service_role;
alter default privileges
  revoke all privileges on sequences from anon, authenticated, service_role;
alter default privileges in schema public
  revoke all privileges on sequences from anon, authenticated, service_role;
alter default privileges
  revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to service_role;
alter default privileges in schema public
  grant execute on functions to service_role;
