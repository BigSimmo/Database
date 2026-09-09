-- Validate the documents_metadata_object_check CHECK constraint (#S19JRT).
-- Added NOT VALID in 20260827100000_validate_documents_metadata_structural_constraint.sql,
-- which already confirmed via preflight scan that no row violates it.
-- VALIDATE CONSTRAINT takes only a SHARE UPDATE EXCLUSIVE lock (reads and
-- writes continue) and turns the guard into an enforced invariant for
-- existing rows too. Split into its own migration/transaction so the
-- earlier ACCESS EXCLUSIVE lock from ADD CONSTRAINT ... NOT VALID does not
-- remain held across this full-table scan.

set local search_path = public, extensions, pg_catalog;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.documents
  validate constraint documents_metadata_object_check;
