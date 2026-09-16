-- ============================================================================
-- Operator EXPLAIN diagnostic: read_site_content_public_records() latency
-- Search-path catalogue read · queued follow-up to the 2026-09-11..14 incident
-- ============================================================================
--
-- PURPOSE:
-- Establish what a catalogue-backed search actually costs at the database, and
-- whether that cost is what users are feeling as slow search.
--
-- This is the SEARCH-PATH sibling of scripts/operator-explain-site-content-health.sql.
-- That script profiles read_site_content_health(), the control-plane audit that
-- cost ~7 s and stalled 24 deployments. This one profiles
-- read_site_content_public_records(), which is a different function on the same
-- tables and has never been measured. Do not read one as evidence for the other:
-- the health audit walks site_content_sync_events, and this function never
-- touches that table at all, so the leading hypothesis there does not transfer.
--
-- WHY IT MATTERS ON THE REQUEST PATH:
-- src/lib/universal-search.ts calls readCanonicalSiteContentRecords() once per
-- registry domain per search, with no cache between searches, so one federated
-- search issues this RPC three times (medications, services, forms). Multiply
-- whatever Step 1 reports by three for a federated search, and note that each is
-- a separate PostgREST round trip on top of the planning and execution time here.
--
-- EXECUTION:
-- Read-only. Run in an approved operator window against the target database
-- (Supabase SQL Editor or psql). Nothing here writes, locks or creates anything.
-- Run the whole script twice and use the SECOND pass: the first pays for cold
-- caches and a cold PostgREST/plan cache, which is a different question from
-- steady-state cost.
--
-- EVERY PROFILING STATEMENT IS BOUNDED. `explain (analyze, ...)` executes the
-- query it measures, and the query measured here is on the live request path.
-- Each step runs inside its own transaction with `set local statement_timeout`,
-- following the `set local` convention the guard migrations use (AGENTS.md
-- § Supabase project safety). A timeout is a RESULT, not a failure: it means a
-- request-path read has outgrown any reasonable budget, which is the finding.
-- `set local` reverts at commit, so nothing about the session or the database is
-- changed by running this.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Step 0: PRODUCTION TRUTH, BEFORE ANY HYPOTHESIS
--
-- If pg_stat_statements is available this is the decisive measurement and costs
-- nothing to take: real call counts and real mean latency for this exact
-- function, as production has actually been running it. Take it FIRST, because
-- every step below is an attempt to explain whatever number this returns.
--
-- Read `mean_exec_time` against the observed "search feels slow" complaint, and
-- read `calls` against the number of searches: a ratio near 3:1 confirms the
-- per-domain fan-out described above and makes caching the fix regardless of
-- what any plan says.
-- ----------------------------------------------------------------------------
select
  s.calls,
  round(s.mean_exec_time::numeric, 1)  as mean_ms,
  round(s.max_exec_time::numeric, 1)   as max_ms,
  round(s.total_exec_time::numeric / 1000, 1) as total_seconds,
  left(s.query, 120) as query
from pg_stat_statements s
where s.query ilike '%read_site_content_public_records%'
   or s.query ilike '%site_content_release_records%'
order by s.total_exec_time desc
limit 20;
-- If this errors with "relation pg_stat_statements does not exist", the
-- extension is not enabled. Skip this step; do NOT enable it here.

-- ----------------------------------------------------------------------------
-- Step 1: Total cost of one call, per kind
--
-- This is the headline number: what one registry domain of one search pays.
-- The function is `language sql` and too large to inline, so EXPLAIN reports one
-- Result node and a total time. That total is the point of this step; the plan
-- inside is invisible from here and Steps 3 and 4 lift the suspects out.
--
-- Run all three. If they are all similar despite the kinds having very different
-- record counts, the cost does not depend on what was asked for, which is itself
-- the finding and points straight at Step 3.
-- ----------------------------------------------------------------------------
begin;
set local statement_timeout = '30s';
explain (analyze, buffers) select * from public.read_site_content_public_records('form', null);
commit;

begin;
set local statement_timeout = '30s';
explain (analyze, buffers) select * from public.read_site_content_public_records('service', null);
commit;

begin;
set local statement_timeout = '30s';
explain (analyze, buffers) select * from public.read_site_content_public_records('medication', null);
commit;

-- A single-slug read is what a detail page does. If this is not dramatically
-- cheaper than the list reads above, the slug filter is not being pushed down
-- either, and both paths share one defect.
begin;
set local statement_timeout = '30s';
explain (analyze, buffers)
select * from public.read_site_content_public_records(
  'form',
  (select slug from public.site_content_public_records where kind = 'form' limit 1)
);
commit;

-- ----------------------------------------------------------------------------
-- Step 2: What the read is proportional to
--
-- The cost is data-proportional, so these counts are the forecast. Note
-- especially the split by kind: the hypothesis in Step 3 says a search for one
-- kind pays for all of them.
-- ----------------------------------------------------------------------------
select
  c.relname                                     as table_name,
  c.reltuples::bigint                           as estimated_rows,
  pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
  pg_size_pretty(pg_indexes_size(c.oid))        as index_size,
  s.seq_scan,
  s.seq_tup_read,
  s.idx_scan
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_stat_user_tables s on s.relid = c.oid
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'site_content_release_records',
    'site_content_public_records',
    'site_content_publications',
    'site_content_releases',
    'site_content_sync_state'
  )
order by pg_total_relation_size(c.oid) desc;

-- How many records the active release carries, and how they split by kind.
-- `requested` keeps one of these groups. Step 3 asks whether the engine had to
-- build all of them to find it.
begin;
set local statement_timeout = '30s';
select
  case
    when rr.logical_id like 'services:%' then 'service'
    when rr.logical_id like 'forms:%' then 'form'
    when rr.logical_id like 'medications:%' then 'medication'
    when rr.logical_id like 'differentials:diagnosis:%' then 'differential'
    when rr.logical_id like 'differentials:presentation:%' then 'presentation'
    else 'other'
  end as kind,
  count(*) as records,
  pg_size_pretty(sum(pg_column_size(rr.record) + pg_column_size(rr.render_payload))::bigint) as payload_bytes
from public.site_content_release_records rr
join public.site_content_sync_state s on s.singleton and rr.release_id = s.active_release_id
where rr.public_visible and not rr.tombstone
group by 1
order by records desc;
commit;

-- ----------------------------------------------------------------------------
-- Step 3: LEADING HYPOTHESIS — the kind filter cannot be pushed down
--
-- Inside the function, `classified` computes the kind it will later filter on:
--
--     coalesce(p.kind, case when rr.logical_id like 'services:%' then 'service' ... end)
--     from transition s
--     join      public.site_content_release_records rr on rr.release_id = s.active_release_id
--     left join public.site_content_publications   p  on p.id = rr.target_publication_id
--                                                    and p.logical_id = rr.logical_id
--
-- and only the NEXT CTE applies `where c.kind = p_kind`.
--
-- Because `kind` is a coalesce over a column from the NULL-able side of a LEFT
-- JOIN, the planner cannot push that predicate beneath the join: it has to
-- perform the join for every public-visible record in the active release, across
-- all five kinds, compute `kind` for each, and only then discard the four kinds
-- nobody asked for. There is also no index on the computed kind, because it is
-- computed.
--
-- If that is right, every forms search pays for the medications, services,
-- differentials and presentations catalogues as well, and the fix is either a
-- stored kind column that the filter can reach, or a cache in front of the
-- function that stops paying it per domain per search.
--
-- CONFIRM OR KILL IT: compare the row counts in the two plans below. If (a)
-- reports actual rows for the whole release where (b) reports only the forms
-- subset, and their times differ accordingly, the hypothesis holds.
-- ----------------------------------------------------------------------------

-- (a) What the function is forced to build: the join over the whole release.
begin;
set local statement_timeout = '30s';
explain (analyze, buffers)
select count(*)
from public.site_content_sync_state s
join public.site_content_release_records rr on rr.release_id = s.active_release_id
left join public.site_content_publications p
       on p.id = rr.target_publication_id and p.logical_id = rr.logical_id
where s.singleton and rr.public_visible and not rr.tombstone;
commit;

-- (b) What it would cost if the kind filter could reach the scan.
begin;
set local statement_timeout = '30s';
explain (analyze, buffers)
select count(*)
from public.site_content_sync_state s
join public.site_content_release_records rr on rr.release_id = s.active_release_id
where s.singleton and rr.public_visible and not rr.tombstone
  and rr.logical_id like 'forms:%';
commit;

-- ----------------------------------------------------------------------------
-- Step 4: SECOND SUSPECT — `outstanding` has no index to use
--
-- `outstanding` selects from site_content_public_records where
-- `head_change_epoch > s.served_change_epoch`. That table's only indexes are its
-- primary key on logical_id and the unique (kind, slug); nothing covers
-- head_change_epoch, so this should be a sequential scan of the whole catalogue.
--
-- In the steady state it returns zero rows, which makes it cheap in absolute
-- terms and easy to overlook. It earns a look anyway because the CTE is
-- referenced twice, so PostgreSQL materialises it, and `safe_requested` then
-- runs a correlated `not exists` against it per surviving row.
--
-- Expect this to be small. If it is not, it is because the catalogue has grown
-- or because publications are genuinely outstanding, and the second of those is
-- a content-governance finding rather than a performance one: it means searches
-- are being served the conservative fallback.
-- ----------------------------------------------------------------------------
begin;
set local statement_timeout = '30s';
explain (analyze, buffers)
select count(*)
from public.site_content_public_records h
cross join public.site_content_sync_state s
where s.singleton and h.head_change_epoch > s.served_change_epoch;
commit;

-- Is the catalogue currently serving canonical records at all, or falling back?
-- `state` here is what the application reads to decide. 'updating' or
-- 'unavailable' means search results are already degraded, which is a different
-- problem from a slow one and must not be mistaken for it.
begin;
set local statement_timeout = '30s';
select
  s.initialized,
  s.change_epoch,
  s.served_change_epoch,
  (s.change_epoch = s.served_change_epoch) as fully_served,
  (select count(*) from public.site_content_public_records h
    where h.head_change_epoch > s.served_change_epoch) as outstanding_records
from public.site_content_sync_state s
where s.singleton;
commit;

-- ============================================================================
-- READING THE RESULT
--
-- Step 0 decides what the rest is worth. If mean_exec_time is a few
-- milliseconds, this function is NOT the cause of slow search and the
-- investigation belongs on the documents/retrieval path instead — see the
-- queued EXPLAIN baseline for document_index_units (#8VAY97), which is the other
-- unmeasured read on the search path.
--
-- If it is tens or hundreds of milliseconds, multiply by three for a federated
-- search and by the round-trip count, and the caching change is justified on its
-- own: it removes the repetition regardless of which step explains the cost.
--
-- If Step 3 confirms the push-down failure, the durable fix is a stored, indexed
-- kind column on site_content_release_records so the filter can reach the scan.
-- That is a schema change, and it ships under AGENTS.md § Supabase project
-- safety: merging a migration reaches the live clinical database within seconds,
-- and CREATE INDEX CONCURRENTLY cannot run in that transaction, so index work
-- stays operator-prebuild plus a validate-only guard migration.
--
-- Either way, record the numbers in docs/deployment-architecture.md beside the
-- existing health-audit measurements, and pin the resulting budget in a test.
-- ============================================================================
