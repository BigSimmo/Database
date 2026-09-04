-- Validate documents_ownerless_requires_publication_marker (#ZBAC9D).
-- Added NOT VALID in 20260902110500_ownerless_documents_require_publication_marker.sql,
-- which already confirmed by preflight scan that no row violates it. VALIDATE CONSTRAINT
-- takes only a SHARE UPDATE EXCLUSIVE lock (reads and writes continue) and turns the
-- guard into an enforced invariant for existing rows too. Split into its own
-- migration/transaction so the earlier ACCESS EXCLUSIVE lock from ADD CONSTRAINT ...
-- NOT VALID is not held across this full-table scan. Mirrors 20260827100500.

set local search_path = public, extensions, pg_catalog;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.documents
  validate constraint documents_ownerless_requires_publication_marker;
