-- Create the storage buckets in the migration chain (schema-drift fix).
--
-- The clinical-documents and clinical-images buckets were declared only in
-- supabase/schema.sql. The migration chain created the storage.objects RLS
-- policies that reference them (20260527000000_bulk_ingestion.sql) but never the
-- buckets themselves, so a database built purely by replaying migrations had RLS
-- policies for buckets that did not exist and uploads failed until the buckets
-- were created out-of-band. This migration mirrors schema.sql so a
-- migrated-from-scratch database (and the CI `supabase db reset` replay) has the
-- buckets. Idempotent: an existing database that already has them re-affirms
-- public = false plus name, file_size_limit, and allowed_mime_types from this
-- migration (schema.sql only forces public = false on conflict).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'clinical-documents',
  'clinical-documents',
  false,
  157286400,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]
)
on conflict (id) do update set
  public = false,
  name = excluded.name,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'clinical-images',
  'clinical-images',
  false,
  52428800,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = false,
  name = excluded.name,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
