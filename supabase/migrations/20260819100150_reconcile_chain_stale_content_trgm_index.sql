-- Chain-stale repair: make the migration chain produce the CANONICAL
-- document_chunks_content_trgm_idx, the one schema.sql, the drift manifest and
-- production already carry.
--
-- Plan of record: docs/database-remediation-plan.md section 4.4; evidence:
-- docs/audit/live-drift-forensics-2026-08.md section 3.3(d) and section
-- "Phase 4 completion". Ledger anchor #316.
--
-- THE DEFECT. Three renderings of this index exist in the repository, and the
-- chain picks the wrong one because the first creator wins:
--
--   20260606000000:11  lower(coalesce(section_heading,'') || ' ' || content)
--                      <- created FIRST, and this is what a replay ends up with
--   20260622000000:13  lower(coalesce(section_heading,'') || ' ' || coalesce(content,''))
--   20260705180000:11  identical to 20260622000000 = schema.sql:743 = CANONICAL
--
-- Both later creators use CREATE INDEX IF NOT EXISTS, so they are no-ops once
-- 20260606000000 has run, and no migration anywhere drops the index. Any
-- database built from migrations alone therefore gets the 2026-06-06 form,
-- while schema.sql, supabase/drift-manifest.json and production carry the
-- coalesce(content,'') form. The difference is not cosmetic: the 2026-06-06
-- expression is NULL for every row with a NULL content, so those chunks are
-- absent from the trigram index entirely.
--
-- This was recorded as a staging-only residual in forensics 3.3(d) and repaired
-- there by hand. It is not staging-only: it is every environment built from the
-- chain -- `supabase db reset`, a disaster-recovery replay, and the Supabase
-- preview branch, where 20260819100200's guard caught it (PR #2151).
--
-- WHY A CONDITIONAL REPAIR RATHER THAN AN UNCONDITIONAL REBUILD. Production and
-- staging already hold the canonical form, so an unconditional DROP + CREATE
-- would rebuild a 68 MB GIN index over 70k rows inside the migration
-- transaction and block writes on the retrieval path for its duration -- the
-- exact thing this programme forbids. So:
--
--   * already canonical            -> no-op (production, staging today)
--   * wrong form, table EMPTY      -> drop and recreate (preview, db reset, DR
--                                     replay: instant, nothing to block)
--   * wrong form, table POPULATED  -> raise, and tell the operator to rebuild
--                                     concurrently out of band first, per the
--                                     20260804110240 pattern
--
-- The last branch is deliberate: this migration will never perform a
-- write-blocking index build on a populated hosted database. It fails loudly
-- and hands the work to an approved window instead.
--
-- Ordered at 100150 -- after the Batch B guard (100100) and before the trigram
-- guard (100200) -- so a fresh replay is canonical by the time 20260819100200
-- validates it.

set local search_path = public, extensions, pg_catalog;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $migration$
declare
  canonical_def constant text :=
    'create index document_chunks_content_trgm_idx on public.document_chunks using gin (lower(((coalesce(section_heading, ''''::text) || '' ''::text) || coalesce(content, ''''::text))) extensions.gin_trgm_ops)';
  index_oid regclass;
  actual_def text;
  actual_normalized text;
  expected_normalized text;
  row_estimate bigint;
begin
  -- Keep in lockstep with normalizeIndexDefinition in tests/supabase-schema.test.ts.
  expected_normalized := lower(canonical_def);
  expected_normalized := replace(expected_normalized, 'create index if not exists', 'create index');
  expected_normalized := regexp_replace(expected_normalized, ' extensions\.', ' ', 'g');
  expected_normalized := regexp_replace(expected_normalized, ' using btree', '', 'g');
  expected_normalized := regexp_replace(expected_normalized, 'where \(([^()]*)\)$', 'where \1');
  expected_normalized := replace(expected_normalized, ';', '');
  expected_normalized := regexp_replace(expected_normalized, '[[:space:]]+', ' ', 'g');
  expected_normalized := regexp_replace(expected_normalized, ' on ([^ ()]+) \(', ' on \1(', 'g');
  expected_normalized := btrim(expected_normalized);

  index_oid := to_regclass('public.document_chunks_content_trgm_idx');

  if index_oid is not null then
    select pg_get_indexdef(i.indexrelid)
      into actual_def
    from pg_index as i
    where i.indexrelid = index_oid;

    actual_normalized := lower(actual_def);
    actual_normalized := replace(actual_normalized, 'create index if not exists', 'create index');
    actual_normalized := regexp_replace(actual_normalized, ' extensions\.', ' ', 'g');
    actual_normalized := regexp_replace(actual_normalized, ' using btree', '', 'g');
    actual_normalized := regexp_replace(actual_normalized, 'where \(([^()]*)\)$', 'where \1');
    actual_normalized := replace(actual_normalized, ';', '');
    actual_normalized := regexp_replace(actual_normalized, '[[:space:]]+', ' ', 'g');
    actual_normalized := regexp_replace(actual_normalized, ' on ([^ ()]+) \(', ' on \1(', 'g');
    actual_normalized := btrim(actual_normalized);

    if actual_normalized = expected_normalized then
      -- Production and staging land here: nothing to do, no lock taken.
      return;
    end if;
  end if;

  -- Wrong form (or absent). Only rebuild in-transaction when there is nothing
  -- to block; a populated table must be repaired concurrently out of band.
  select coalesce(c.reltuples, 0)::bigint
    into row_estimate
  from pg_class as c
  where c.oid = to_regclass('public.document_chunks');

  if coalesce(row_estimate, 0) > 0 or exists (select 1 from public.document_chunks limit 1) then
    raise exception
      'document_chunks_content_trgm_idx is not in canonical form on a populated database (found: %). Rebuild it out of band with DROP INDEX CONCURRENTLY + CREATE INDEX CONCURRENTLY using the 20260705180000 definition, validate indisvalid/indisready, then apply this version. This migration will not run a write-blocking index build on a populated table.',
      coalesce(actual_def, '(absent)');
  end if;

  drop index if exists public.document_chunks_content_trgm_idx;
  create index document_chunks_content_trgm_idx
    on public.document_chunks
    using gin (lower(coalesce(section_heading, '') || ' ' || coalesce(content, '')) gin_trgm_ops);
end
$migration$;
