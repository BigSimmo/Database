-- Add a partial composite index to optimize cacheIndexingVersion scans
create index if not exists documents_owner_updated_at_indexed_idx
  on public.documents (owner_id, updated_at desc)
  where status = 'indexed';
