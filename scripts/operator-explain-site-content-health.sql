-- ============================================================================
-- Operator EXPLAIN diagnostic: read_site_content_health() latency baseline
-- Deployment incident 2026-09-11..14 · queued follow-up 2a8e6e9d
-- ============================================================================
--
-- PURPOSE:
-- Establish where the ~7 second cost of the site-content control-plane audit is
-- spent, so it can be reduced rather than only bounded. Nine deep probes against
-- the live warm container on 2026-09-14 ran 7.18 s to 7.86 s. The request path
-- now bounds that read at 10 s, which is roughly 27% headroom over a cost that
-- grows with the corpus, so this is a measurement with an expiry date.
--
-- EXECUTION:
-- Read-only. Run in an approved operator window against the target database
-- (Supabase SQL Editor or psql). Nothing here writes, locks or creates anything.
-- Run twice and use the SECOND result: the first pays for cold caches and a cold
-- PostgREST/plan cache, which is a different question from steady-state cost.
--
-- EVERY PROFILING STATEMENT IS BOUNDED. `explain (analyze, ...)` executes the query
-- it is measuring, and the query being measured here is the known-expensive one: it
-- costs ~7 s today against a table that only grows, and the suspected defect is a
-- sequential scan whose cost is proportional to that growth. An unbounded diagnostic
-- against the live clinical database can therefore consume production resources for
-- as long as the plan takes, competing with application traffic and with maintenance.
-- Each step below runs inside its own transaction with `set local statement_timeout`,
-- following the same `set local` convention the guard migrations use (AGENTS.md
-- § Supabase project safety). A timeout is a RESULT, not a failure: it means the audit
-- has already outgrown the bound the request path gives it, which is the finding.
-- `set local` reverts at commit, so nothing about the session or the database is
-- changed by running this.
--
-- WHAT THIS CAN AND CANNOT SHOW:
-- read_site_content_health() is `language sql` but far too large to be inlined,
-- so EXPLAIN on a call to it reports one Result node and a total time. That total
-- is the headline number and Step 1 is worth running for it alone, but the plan
-- inside is invisible from there. Steps 3 and 4 therefore lift the two suspect
-- sub-queries out and plan them directly.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Step 1: Total cost, wrapper versus base
--
-- PR #2785 renamed the original function to site_content_health_operational_base()
-- and wrapped it in a new read_site_content_health() that evaluates the base once
-- as a materialized CTE. It bought hours, not a fix, because the work all still
-- happens inside the base. If these two times are close, the wrapper is not the
-- problem and the base is the whole cost.
-- ----------------------------------------------------------------------------
begin;
set local statement_timeout = '60s';
explain (analyze, buffers) select public.read_site_content_health();
commit;

begin;
set local statement_timeout = '60s';
explain (analyze, buffers) select public.site_content_health_operational_base();
commit;

-- ----------------------------------------------------------------------------
-- Step 2: What the audit is proportional to
--
-- The cost is data-proportional, so the row counts are the forecast. Whichever
-- table here is largest and still growing is the one that will close the 10 s
-- margin next.
-- ----------------------------------------------------------------------------
select
  c.relname                                            as table_name,
  c.reltuples::bigint                                  as estimated_rows,
  pg_size_pretty(pg_total_relation_size(c.oid))        as total_size,
  pg_size_pretty(pg_indexes_size(c.oid))               as index_size,
  s.seq_scan,
  s.seq_tup_read,
  s.idx_scan
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_stat_user_tables s on s.relid = c.oid
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname like 'site\_content\_%'
order by pg_total_relation_size(c.oid) desc;

-- Index inventory and whether anything actually uses each index.
select
  i.relname          as index_name,
  t.relname          as table_name,
  s.idx_scan,
  pg_size_pretty(pg_relation_size(i.oid)) as index_size,
  pg_get_indexdef(i.oid)                  as definition
from pg_class i
join pg_index x on x.indexrelid = i.oid
join pg_class t on t.oid = x.indrelid
join pg_namespace n on n.oid = t.relnamespace
left join pg_stat_user_indexes s on s.indexrelid = i.oid
where n.nspname = 'public' and t.relname like 'site\_content\_%'
order by t.relname, i.relname;

-- ----------------------------------------------------------------------------
-- Step 3: LEADING HYPOTHESIS — `live_events` has no index it can use
--
-- `live_events` filters the whole event table by state:
--     where e.state in ('pending','retry_pending','processing','ready')
--
-- site_content_sync_events carries exactly three indexes, and none of them serves
-- that predicate:
--   * ..._claim_idx    (state, next_attempt_at, event_sequence)
--                      WHERE state in ('pending','retry_pending')  -- partial, 2 of the 4
--   * ..._reclaim_idx  (lease_expires_at, event_sequence)
--                      WHERE state = 'processing'                  -- partial, 1 of the 4
--   * ..._target_idx   (target_change_epoch, logical_id, state)    -- state is 3rd, cannot drive
--
-- Nothing covers state = 'ready', and Postgres cannot stitch two partial indexes
-- and a non-leading column into one scan, so this predicate should fall back to a
-- sequential scan of the entire table. That table is an append-only event log:
-- rows settle into 'completed' and 'superseded' and are never removed, so the four
-- live states are a shrinking fraction of a growing table. That is a cost that
-- rises with content and never comes back down, which matches the observed
-- behaviour exactly — PR #2785 bought hours before the margin closed again.
--
-- CONFIRM OR KILL IT: if the plan below is a Seq Scan and `rows removed by filter`
-- dwarfs `actual rows`, this is it, and the fix is a partial index matching the
-- predicate. If it is already an index scan, discard this hypothesis and go to
-- Step 4.
-- ----------------------------------------------------------------------------
begin;
set local statement_timeout = '30s';
explain (analyze, buffers)
select count(*) from public.site_content_sync_events e
where e.state in ('pending','retry_pending','processing','ready');
commit;

-- How lopsided the table is. A large total against a small live count is the
-- partial index's whole justification.
begin;
set local statement_timeout = '30s';
select state, count(*) from public.site_content_sync_events group by state order by count(*) desc;
commit;

-- ----------------------------------------------------------------------------
-- Step 4: SECOND SUSPECT — the recursive chain walk
--
-- `chains` walks site_content_sync_events through superseded_by_event_sequence,
-- carrying an array `path` and re-checking `not e.event_sequence = any(c.path)` at
-- every step. That containment test is linear in path length, cannot use an index,
-- and is re-evaluated per row per iteration.
--
-- The join itself should be fine — event_sequence is the primary key — so this is
-- the second suspect rather than the first. It becomes the first if chains are
-- long: watch the Recursive Union's actual rows and number of iterations, and the
-- time on the WorkTable Scan.
-- ----------------------------------------------------------------------------
begin;
set local statement_timeout = '60s';
explain (analyze, buffers)
with recursive
  sync_state as (select s.* from public.site_content_sync_state s where s.singleton),
  outstanding_heads as (
    select h.* from public.site_content_public_records h cross join sync_state s
    where h.head_change_epoch > s.served_change_epoch
  ),
  chains as (
    select h.logical_id head_logical_id, h.pending_event_sequence origin_sequence,
      e.event_sequence, e.logical_id event_logical_id, e.target_publication_id,
      e.target_change_epoch, e.state, e.superseded_by_event_sequence, array[e.event_sequence] path
    from outstanding_heads h
    left join public.site_content_sync_events e on e.event_sequence = h.pending_event_sequence
    union all
    select c.head_logical_id, c.origin_sequence, e.event_sequence, e.logical_id,
      e.target_publication_id, e.target_change_epoch, e.state,
      e.superseded_by_event_sequence, c.path || e.event_sequence
    from chains c
    join public.site_content_sync_events e on e.event_sequence = c.superseded_by_event_sequence
    where c.event_sequence is not null and e.event_sequence > c.event_sequence
      and not e.event_sequence = any(c.path)
  ),
  terminals as (
    select distinct on (head_logical_id) * from chains order by head_logical_id, cardinality(path) desc
  )
select count(*) from terminals;
commit;

-- ============================================================================
-- READING THE RESULT
--
-- Compare Step 1's total against the sum of Steps 3 and 4. If those two account
-- for most of it, the fix is an index or a restructure of the chain walk and the
-- remaining CTEs are noise. If they do not, the cost is spread across the digest
-- and record-count comparisons instead, and the answer is a narrower audit rather
-- than a faster one — splitting the cheap liveness facts from the expensive
-- whole-corpus reconciliation, and running the latter on a schedule rather than
-- per request.
--
-- Either way, record the numbers in docs/deployment-architecture.md § Readiness
-- beside the existing measurements, and pin the resulting budget in a test.
-- Any index that follows ships as a migration under the rules in AGENTS.md
-- § Supabase project safety: merging one reaches the live clinical database
-- within seconds, and CREATE INDEX CONCURRENTLY cannot run in that transaction,
-- so index work stays operator-prebuild plus a validate-only guard migration.
-- ============================================================================
