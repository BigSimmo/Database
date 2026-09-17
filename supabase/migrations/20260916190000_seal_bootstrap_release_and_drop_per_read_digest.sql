-- Take the per-read bootstrap-digest recomputation and the per-read 843-row structural sweep off
-- the public registry read path, and replace the property they were proving with a structural seal
-- plus one cryptographic verification performed here, in this transaction.
--
-- WHY. read_site_content_public_records is the single read path behind all seven public registry
-- GET routes, universal search and the differential page loader. In the live epoch-zero state it
-- walked the entire 843-row bootstrap population THREE times per call:
--   1. public.site_content_bootstrap_digest(r.id) in its own `transition` CTE (20260916103000,
--      re-stated by 20260916160000);
--   2. the same digest again, indirectly, through site_content_current_transition_kind ->
--      site_content_retained_bootstrap_valid (20260830121000);
--   3. that same function's per-row structural NOT EXISTS, which detoasts and compares the full
--      `record` jsonb of every row (rr.record->>'body' is distinct from rr.normalized_text).
-- Each digest evaluation canonicalises 9,522,923 bytes / 164,820 JSON nodes (55,103 of them
-- containers) through the RECURSIVE plpgsql public.site_content_canonical_json: roughly 165k
-- plpgsql invocations and 55k SPI-planned aggregate subqueries, per evaluation. Measured from the
-- public internet on 2026-09-16: about 4.2 s for every registry request, including an 8 KB
-- single-record detail response. The cost is per call and independent of p_kind, p_slug and result
-- size, which is exactly why pushing the kind filter down into the join (20260916103000) did not
-- move it. psychiatry.tools is visibly broken by it.
--
-- WHAT THOSE CHECKS WERE PROVING, and why they are redundant per read. The bootstrap population was
-- verified against its digest transactionally at apply time (the
-- site_content_bootstrap_population_mismatch block in 20260824122000, applied live 2026-09-11);
-- the release id is a hard-coded constant in the reader; the stored release_digest is bound to that
-- id by public.site_content_release_id, a four-key hash that costs microseconds; and the rows have
-- been immutable against UPDATE and DELETE since day one via
-- site_content_release_records_immutable. The only genuine gap was INSERT -- nothing prevented a
-- row being ADDED to a bootstrap release, and TRUNCATE is a statement-level event the row trigger
-- never sees. The digest merely DETECTED those, after the fact, 9.5 MB at a time, once per page
-- view. This migration closes both holes structurally and re-derives the digest once, here, so it
-- ABORTS rather than blessing a population that has already drifted.
--
-- THE CHANGE. (Described by object. The numbered steps in the SQL below are in EXECUTION
-- order, which differs: verify, seal, index, cheap predicate, widen the expensive predicate,
-- repoint the transition classifier, rewrite the reader.)
--   1. Verify first. A do-block re-derives site_content_bootstrap_digest for the active epoch-zero
--      release, compares it to the stored release_digest, re-checks the id <-> digest binding, the
--      row count, and the FULL per-row structural sweep. Any mismatch raises and the whole
--      transaction rolls back; nothing below is installed.
--   2. Seal. public.guard_site_content_sealed_bootstrap() plus two triggers on
--      site_content_release_records: one BEFORE INSERT restricted to the three retained bootstrap
--      release ids, one BEFORE TRUNCATE for the whole table. Both are `enable always`, so unlike
--      the existing row trigger they still fire under session_replication_role = replica.
--   3. Cheap predicate. public.site_content_retained_bootstrap_sealed(uuid, text) is
--      site_content_retained_bootstrap_valid with every predicate that touches
--      site_content_release_records removed -- the aggregate digest equality, the per-row
--      structural sweep, and the `expected_record_count = count(*)` comparison -- and nothing
--      added. What remains reads one row of site_content_releases by primary key and hashes a
--      four-key object. NOTHING on the read path scans the population any more, at any size.
--      The row count goes for the same reason the digest goes, not as an afterthought: after the
--      seal in (2) the count of a sealed bootstrap release is as immutable as its digest, so
--      re-counting per read re-proves what the triggers enforce. It is also the WRONG direction
--      of proof -- site_content_releases carries no immutability trigger, so expected_record_count
--      is the mutable side and the sealed rows are the trustworthy side. The count is verified
--      once in step 1 below, again on every replay by 20260824122000's own `<> 843` self-check,
--      and continues to live in read_site_content_health(). Enforced by
--      scripts/check-read-path-cost.mjs (rule R3), which flagged this expression before merge.
--   4. Fail-closed hole closed (worry 1 of the design note, and it is a real outage shape).
--      20260916143000 / 20260916160000 widened the two CHECK constraints and the reader's own
--      predicates to the three retained bootstrap identities, but left
--      site_content_retained_bootstrap_valid and site_content_current_transition_kind pinned to
--      e4a1dd29 alone. A database seeded with 91ceaa8d or ddc94ecf therefore got
--      transition_kind = null, transition.valid = false, and EVERY public catalogue read silently
--      returned nothing -- the same seven-day-outage shape 20260916160000 was written to prevent,
--      reachable through a different door. Both functions now accept all three retained ids,
--      matching RETAINED_BOOTSTRAP_RELEASE_IDS in src/lib/site-content/site-content-health.ts.
--   5. Prefix index. site_content_release_records_public_prefix_idx adds text_pattern_ops to the
--      (release_id, logical_id) partial index so the bootstrap branch's
--      `logical_id like k.prefix || '%'` can use a real index range; the default-collation index
--      cannot serve a prefix range. A plain CREATE INDEX -- this migration runs in one transaction,
--      so CONCURRENTLY is not available and is not needed for 843 rows. This table is not in the
--      six-table retrieval index ratchet (supabase/search-health-unmonitored-indexes.json), so no
--      JSON entry is required.
--
-- WHERE THE CRYPTOGRAPHIC CHECK CONTINUES TO LIVE. read_site_content_health() still recomputes
-- site_content_bootstrap_digest in its `bootstrap` and `rollback` CTEs and still runs a per-row
-- structural sweep far more thorough than the reader's, feeding bootstrapIntegrityState /
-- bootstrap_invalid in src/lib/site-content/site-content-health.ts. activate_site_content_release
-- and rollback_site_content_release keep their own recomputation.
-- site_content_retained_bootstrap_valid keeps BOTH the digest equality and the structural sweep --
-- only its release-id pin is widened -- so every mutation and backfill path is unchanged in cost
-- and in strength.
--
-- LOCKS. The two CREATE TRIGGER statements and their ALTER TABLE ... ENABLE ALWAYS take ACCESS
-- EXCLUSIVE on site_content_release_records; CREATE INDEX takes SHARE. Bounded local lock and
-- statement timeouts fail and roll back a busy deploy instead of waiting forever (same pattern as
-- 20260901120000_restrict_owner_delete_on_public_visibility_tables.sql). statement_timeout is set
-- generously at 300s because step 1 deliberately performs the very 9.5 MB canonicalisation this
-- migration is removing from the read path, and CI replay hardware is slower than live.
--
-- HOW TO UNDO IT, precisely. Reverting this FILE does not undo anything: once merged, the
-- integration records version 20260916190000 as applied, so deleting the file leaves the live
-- triggers, index and function bodies exactly as this migration left them. Undoing it means a NEW
-- forward migration that (a) `drop trigger site_content_release_records_bootstrap_sealed on
-- public.site_content_release_records` and `drop trigger site_content_release_records_no_truncate on
-- public.site_content_release_records`; (b) `drop function public.guard_site_content_sealed_bootstrap()`
-- and `drop function public.site_content_retained_bootstrap_sealed(uuid, text)` -- in that order,
-- triggers first, because the guard function is still referenced by them; (c) `drop index
-- public.site_content_release_records_public_prefix_idx`; (d) restores the prior bodies of
-- public.site_content_current_transition_kind (copy from supabase/schema.sql as of 20260830121000:
-- the bootstrap arm calling site_content_retained_bootstrap_valid with the single e4a1dd29 pin) and
-- public.read_site_content_public_records (copy verbatim from
-- 20260916160000_triple_pin_retained_bootstrap_release_ids.sql lines 84-187), restating the same
-- revoke/grant/owner lines both carry below; and (e) updates supabase/schema.sql to match in the
-- same change. Undoing (4) is NOT recommended: re-narrowing the retained-id pins re-opens the
-- silent-empty-catalogue hole.
--
-- NOT DONE HERE. No re-key of the bootstrap identity and no edit to any applied migration -- this
-- file only NAMES the three retained ids that 20260916143000 / 20260916160000 already pinned. No
-- change to RLS, force row level security, owner scoping, table grants or default ACLs; every
-- replaced function keeps security definer, `set search_path = ''`, `owner to postgres` and its
-- exact prior grants, restated below because create or replace on a security-definer function
-- reachable by anon makes the grants the security boundary. site_content_canonical_json is
-- untouched: it defines every fingerprint in the control plane and is pinned by
-- tests/site-content-p03-baseline.test.ts. The existing site_content_release_records_immutable
-- trigger is NOT promoted to `enable always` here -- that is a separate one-line strengthening that
-- wants the Docker control-plane gate run first. read_site_content_health()'s duplicated digest
-- evaluations are left alone: it is deliberately off the request path
-- (src/lib/health-response.ts), and this change stays as small as it can be.

set local search_path = public, pg_catalog;
set local lock_timeout = '10s';
set local statement_timeout = '300s';

-- 1. VERIFY FIRST. The cryptographic re-derivation and the full structural sweep run here, once,
--    before anything below changes behaviour. If the live population has drifted since 2026-09-11
--    this raises, the transaction rolls back, and the database is left exactly as it was. A
--    failure here is a live-integrity incident, not a migration bug.
do $$
declare
  v_release_id uuid;
  v_release_digest text;
  v_expected_record_count integer;
  v_active_release_digest text;
begin
  select r.id, r.release_digest, r.expected_record_count, s.active_release_digest
    into v_release_id, v_release_digest, v_expected_record_count, v_active_release_digest
  from public.site_content_sync_state s
  join public.site_content_releases r on r.id = s.active_release_id
  where s.singleton
    and r.target_change_epoch = 0
    and r.generation_id = 'bootstrap-v1'
    and (r.id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid
      or r.id = '91ceaa8d-470c-5661-8ce6-980c2a1bb137'::uuid
      or r.id = 'ddc94ecf-3527-5b4d-846b-af5724b428ca'::uuid);

  -- An initialized database past epoch zero has no active bootstrap release. That is a valid
  -- state: there is nothing to verify, and the seal installed below still applies to it.
  if v_release_id is null then
    return;
  end if;

  if v_release_digest is distinct from public.site_content_bootstrap_digest(v_release_id)
    or v_release_digest is distinct from v_active_release_digest
    or v_release_id is distinct from public.site_content_release_id(v_release_digest, 0, 'bootstrap-v1')
    or coalesce(v_expected_record_count, 0) <= 0
    or v_expected_record_count is distinct from (
      select count(*)::integer from public.site_content_release_records rr
      where rr.release_id = v_release_id)
    or exists (
      select 1 from public.site_content_release_records rr
      where rr.release_id = v_release_id and (
        rr.target_publication_id is not null
        or rr.record is null or jsonb_typeof(rr.record) <> 'object'
        or rr.render_payload is null or jsonb_typeof(rr.render_payload) <> 'object'
        or rr.record->>'logicalId' is distinct from rr.logical_id
        or rr.record->>'body' is distinct from rr.normalized_text
        or rr.record->>'contentHash' is distinct from rr.content_hash
        or rr.record->>'publicationVersion' is distinct from rr.publication_fingerprint
        or rr.embedding_model is distinct from 'bootstrap-no-embedding'
        or rr.embedding_dimensions <> 1536
        or rr.embedding_fingerprint is distinct from 'bootstrap-no-embedding-1536-v1'
        or rr.embedding_value_digest is not null or rr.embedding is not null
        or rr.tombstone or not rr.public_visible))
  then
    raise exception using errcode = '23514',
      message = 'site_content_bootstrap_population_mismatch_at_seal';
  end if;
end;
$$;

-- 2. SEAL. Closes the two write vectors the per-read digest could only detect after the fact.
create or replace function public.guard_site_content_sealed_bootstrap()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '55000', message = 'site_content_sealed_bootstrap_release';
end;
$$;

create trigger site_content_release_records_bootstrap_sealed
before insert on public.site_content_release_records
for each row
when (new.release_id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid
  or new.release_id = '91ceaa8d-470c-5661-8ce6-980c2a1bb137'::uuid
  or new.release_id = 'ddc94ecf-3527-5b4d-846b-af5724b428ca'::uuid)
execute function public.guard_site_content_sealed_bootstrap();

alter table public.site_content_release_records
  enable always trigger site_content_release_records_bootstrap_sealed;

create trigger site_content_release_records_no_truncate
before truncate on public.site_content_release_records
for each statement execute function public.guard_site_content_sealed_bootstrap();

alter table public.site_content_release_records
  enable always trigger site_content_release_records_no_truncate;

-- 3. The prefix-capable index for the bootstrap branch's logical_id range scan.
create index site_content_release_records_public_prefix_idx
  on public.site_content_release_records(release_id, logical_id text_pattern_ops)
  where public_visible and not tombstone;

-- 4. The cheap retained-bootstrap predicate. This is
--    public.site_content_retained_bootstrap_valid(uuid, text) with all THREE of its
--    population-scanning predicates removed -- the aggregate
--    `r.release_digest = public.site_content_bootstrap_digest(r.id)`, the per-row structural NOT
--    EXISTS, and `r.expected_record_count = (select count(*) ...)` -- and nothing whatsoever
--    added. All three are now guaranteed structurally: the population was verified in step 1 of
--    this transaction and the rows are immutable against UPDATE/DELETE and, from step 2, sealed
--    against INSERT and TRUNCATE. What is left touches site_content_releases only, by primary key.
--    `r.expected_record_count > 0` is kept because it is a single column read that costs nothing
--    and keeps the predicate fail-closed against a zeroed release row; it is no longer offered as
--    proof of anything about the rows themselves. No `r.state` or `expected_tombstone_count`
--    predicate is introduced, because adding one would change behaviour for databases whose
--    fixtures supersede the bootstrap release, and the reader already applies
--    `r.state = 'active'` itself.
create or replace function public.site_content_retained_bootstrap_sealed(
  p_release_id uuid,
  p_release_digest text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select (r.id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid
        or r.id = '91ceaa8d-470c-5661-8ce6-980c2a1bb137'::uuid
        or r.id = 'ddc94ecf-3527-5b4d-846b-af5724b428ca'::uuid)
      and r.target_change_epoch = 0
      and r.previous_release_id is null
      and r.registry_version = 'site-content-bootstrap-public-release-v1'
      and r.generation_id = 'bootstrap-v1'
      and r.release_digest = p_release_digest
      and r.id = public.site_content_release_id(r.release_digest, 0, 'bootstrap-v1')
      and r.expected_record_count > 0
    from public.site_content_releases r
    where r.id = p_release_id
  ), false);
$$;

revoke all on function public.site_content_retained_bootstrap_sealed(uuid, text)
  from public, anon, authenticated, service_role;
alter function public.site_content_retained_bootstrap_sealed(uuid, text) owner to postgres;

-- 5. Widen the expensive predicate's release-id pin to the retained set. Body otherwise byte
--    identical to supabase/schema.sql: the digest equality and the structural sweep both stay,
--    because this function is off the read path (after step 6 it is reached only by the historical
--    transition backfill in 20260830121000). Only the single-id pin becomes the three-id pin, so a
--    database seeded with 91ceaa8d or ddc94ecf stops failing closed for the wrong reason.
create or replace function public.site_content_retained_bootstrap_valid(
  p_release_id uuid,
  p_release_digest text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select (r.id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid
        or r.id = '91ceaa8d-470c-5661-8ce6-980c2a1bb137'::uuid
        or r.id = 'ddc94ecf-3527-5b4d-846b-af5724b428ca'::uuid)
      and r.target_change_epoch = 0
      and r.previous_release_id is null
      and r.registry_version = 'site-content-bootstrap-public-release-v1'
      and r.generation_id = 'bootstrap-v1'
      and r.release_digest = p_release_digest
      and r.id = public.site_content_release_id(r.release_digest, 0, 'bootstrap-v1')
      and r.expected_record_count > 0
      and r.expected_record_count = (
        select count(*) from public.site_content_release_records rr where rr.release_id = r.id)
      and r.release_digest = public.site_content_bootstrap_digest(r.id)
      and not exists (
        select 1 from public.site_content_release_records rr
        where rr.release_id = r.id and (
          rr.target_publication_id is not null
          or rr.record is null or jsonb_typeof(rr.record) <> 'object'
          or rr.render_payload is null or jsonb_typeof(rr.render_payload) <> 'object'
          or rr.record->>'logicalId' is distinct from rr.logical_id
          or rr.record->>'body' is distinct from rr.normalized_text
          or rr.record->>'contentHash' is distinct from rr.content_hash
          or rr.record->>'publicationVersion' is distinct from rr.publication_fingerprint
          or rr.embedding_model is distinct from 'bootstrap-no-embedding'
          or rr.embedding_dimensions <> 1536
          or rr.embedding_fingerprint is distinct from 'bootstrap-no-embedding-1536-v1'
          or rr.embedding_value_digest is not null or rr.embedding is not null
          or rr.tombstone or not rr.public_visible))
    from public.site_content_releases r
    where r.id = p_release_id
  ), false);
$$;

revoke all on function public.site_content_retained_bootstrap_valid(uuid, text)
  from public, anon, authenticated, service_role;
alter function public.site_content_retained_bootstrap_valid(uuid, text) owner to postgres;

-- 6. Point the transition classifier at the cheap predicate, and widen its own id pin to the
--    retained set. Every other arm of the case is byte identical to supabase/schema.sql.
create or replace function public.site_content_current_transition_kind(
  p_receipt_id text,
  p_active_release_id uuid,
  p_active_release_digest text,
  p_initialized boolean,
  p_served_change_epoch bigint
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not p_initialized and p_receipt_id is null
      and (p_active_release_id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid
        or p_active_release_id = '91ceaa8d-470c-5661-8ce6-980c2a1bb137'::uuid
        or p_active_release_id = 'ddc94ecf-3527-5b4d-846b-af5724b428ca'::uuid)
      and p_served_change_epoch = 0
      and public.site_content_retained_bootstrap_sealed(p_active_release_id, p_active_release_digest)
      then 'bootstrap'
    when p_initialized and exists (
      select 1
      from public.site_content_release_receipts tr
      join public.site_content_releases active on active.id = p_active_release_id
      left join public.site_content_releases previous on previous.id = active.previous_release_id
      where tr.receipt_id = p_receipt_id
        and tr.receipt_kind = 'activation'
        and tr.release_id = active.id
        and active.state = 'active'
        and active.release_digest = p_active_release_digest
        and active.target_change_epoch = p_served_change_epoch
        and public.site_content_receipt_bytes_valid(
          tr.receipt_id, 'activation', tr.release_id, tr.recovery_readiness_digest, tr.receipt)
        and tr.receipt#>>'{resource,siteReleaseDigest}' = active.release_digest
        and tr.receipt#>>'{resource,previousSiteReleaseId}' = coalesce(active.previous_release_id::text, '')
        and tr.receipt#>>'{resource,previousSiteReleaseDigest}' = coalesce(previous.release_digest, '')
    ) then 'activation'
    when p_initialized and exists (
      select 1
      from public.site_content_release_receipts tr
      join public.site_content_releases target on target.id = p_active_release_id
      join public.site_content_release_receipts ar on ar.receipt_id = tr.receipt->>'activationReceiptId'
      join public.site_content_releases source on source.id = ar.release_id
      where tr.receipt_id = p_receipt_id
        and tr.receipt_kind = 'rollback'
        and tr.release_id = target.id
        and target.state = 'active'
        and target.release_digest = p_active_release_digest
        and source.state = 'rolled_back'
        and source.target_change_epoch = p_served_change_epoch
        and source.previous_release_id = target.id
        and ar.receipt_kind = 'activation'
        and public.site_content_receipt_bytes_valid(
          tr.receipt_id, 'rollback', tr.release_id, tr.recovery_readiness_digest, tr.receipt)
        and public.site_content_receipt_bytes_valid(
          ar.receipt_id, 'activation', ar.release_id, ar.recovery_readiness_digest, ar.receipt)
        and tr.receipt#>>'{target,siteReleaseDigest}' = target.release_digest
        and ar.receipt#>>'{resource,siteReleaseDigest}' = source.release_digest
        and ar.receipt#>>'{resource,previousSiteReleaseId}' = target.id::text
        and ar.receipt#>>'{resource,previousSiteReleaseDigest}' = target.release_digest
        and tr.receipt->>'promotionId' = ar.receipt->>'promotionId'
        and tr.receipt->>'projectRef' = ar.receipt->>'projectRef'
        and tr.receipt->>'rolledBackAt' >= ar.receipt->>'activatedAt'
    ) then 'rollback'
    else 'invalid'
  end;
$$;

revoke all on function public.site_content_current_transition_kind(text, uuid, text, boolean, bigint)
  from public, anon, authenticated, service_role;
alter function public.site_content_current_transition_kind(text, uuid, text, boolean, bigint)
  owner to postgres;

-- 7. Remove the last per-read recomputation from the reader itself. Body otherwise byte identical
--    to 20260916160000_triple_pin_retained_bootstrap_release_ids.sql lines 84-187; only the single
--    line `and r.release_digest = public.site_content_bootstrap_digest(r.id))` is replaced.
create or replace function public.read_site_content_public_records(
  p_kind text,
  p_slug text default null
)
returns table (initialized boolean, record jsonb, render_payload jsonb, snapshot jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  with state as (
    select s.*, public.site_content_current_transition_kind(
      s.active_transition_receipt_id, s.active_release_id, s.active_release_digest, s.initialized,
      s.served_change_epoch
    ) transition_kind
    from public.site_content_sync_state s where s.singleton
  ), active_release as (
    select r.* from public.site_content_releases r join state s on s.active_release_id = r.id
  ), transition as (
    select s.*,
      coalesce(r.state = 'active' and r.release_digest = s.active_release_digest and (
        s.transition_kind in ('activation','rollback')
        or (s.transition_kind = 'bootstrap'
          and (r.id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid
            or r.id = '91ceaa8d-470c-5661-8ce6-980c2a1bb137'::uuid
            or r.id = 'ddc94ecf-3527-5b4d-846b-af5724b428ca'::uuid)
          and r.target_change_epoch = 0
          -- Was: r.release_digest = public.site_content_bootstrap_digest(r.id).
          -- The digest is bound to the pinned id by site_content_release_id (a four-key hash), the
          -- rows are immutable against UPDATE/DELETE (site_content_release_records_immutable) and,
          -- from this migration, sealed against INSERT and TRUNCATE
          -- (site_content_release_records_bootstrap_sealed / _no_truncate, both `enable always`).
          -- The cryptographic re-derivation, the per-row structural sweep and the row count now
          -- run only in read_site_content_health(), plus once in this migration's own
          -- verification block. What is left below reads one already-joined release row: no part
          -- of this function scans site_content_release_records to decide whether the release is
          -- valid.
          and r.id = public.site_content_release_id(r.release_digest, 0, 'bootstrap-v1'))
      ), false) valid
    from state s left join active_release r on true
  ), outstanding as (
    select h.* from public.site_content_public_records h cross join transition s
    where h.head_change_epoch > s.served_change_epoch
  ), kind_prefix as (
    -- The logical-id prefix that identifies p_kind, as a value the planner can push into the
    -- scan. Unrecognised kinds give null, which the branch below rejects — matching the old
    -- `case` returning null and failing `c.kind = p_kind`.
    select case p_kind
      when 'service' then 'services:'
      when 'form' then 'forms:'
      when 'medication' then 'medications:'
      when 'differential' then 'differentials:diagnosis:'
      when 'presentation' then 'differentials:presentation:'
    end as prefix
  ), requested as (
    -- Published records. The foreign key on (target_publication_id, logical_id) guarantees the
    -- publication row exists whenever target_publication_id is not null, and publications.kind is
    -- NOT NULL, so this inner join returns exactly the rows the old left join did and p.kind is
    -- exactly what the old coalesce resolved to.
    select rr.logical_id, rr.record, rr.render_payload
    from transition s
    join public.site_content_release_records rr on rr.release_id = s.active_release_id
    join public.site_content_publications p on p.id = rr.target_publication_id and p.logical_id = rr.logical_id
    where rr.public_visible and not rr.tombstone
      and rr.target_publication_id is not null
      and p.kind = p_kind
      and (p_slug is null or p.slug = p_slug)
    union all
    -- Bootstrap release only. The old WHERE admitted a null target_publication_id solely for this
    -- release, and no publication row exists for it, so kind and slug came from the logical id.
    -- Equality on the whole logical id is the same test as equality on the derived slug once the
    -- prefix is known, and it carries no LIKE metacharacters from p_slug.
    select rr.logical_id, rr.record, rr.render_payload
    from transition s
    cross join kind_prefix k
    join public.site_content_release_records rr on rr.release_id = s.active_release_id
    where rr.public_visible and not rr.tombstone
      and rr.target_publication_id is null
      and (rr.release_id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid
        or rr.release_id = '91ceaa8d-470c-5661-8ce6-980c2a1bb137'::uuid
        or rr.release_id = 'ddc94ecf-3527-5b4d-846b-af5724b428ca'::uuid)
      and k.prefix is not null
      and rr.logical_id like k.prefix || '%'
      and (p_slug is null or rr.logical_id = k.prefix || p_slug)
  ), safe_requested as (
    select r.*
    from requested r cross join transition s
    where s.valid
      and (p_slug is not null or not exists (select 1 from outstanding))
      and not exists (select 1 from outstanding h where h.logical_id = r.logical_id)
  )
  select s.initialized,
    r.record,
    r.render_payload,
    jsonb_build_object(
      'releaseId', case when s.valid then s.active_release_id else null end,
      'staticManifestDigest', case when s.valid then rel.static_manifest_digest else null end,
      'dynamicStateDigest', case when s.valid then rel.dynamic_state_digest else null end,
      'releaseDigest', case when s.valid then s.active_release_digest else null end,
      'changeEpoch', s.change_epoch::text,
      'state', case
        when not s.valid then 'unavailable'
        when not s.initialized then 'unavailable'
        when (s.active_release_id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid
          or s.active_release_id = '91ceaa8d-470c-5661-8ce6-980c2a1bb137'::uuid
          or s.active_release_id = 'ddc94ecf-3527-5b4d-846b-af5724b428ca'::uuid) then 'unavailable'
        when exists (select 1 from outstanding) then 'updating'
        else 'current'
      end
    ) as snapshot
  from transition s
  left join active_release rel on true
  left join safe_requested r on true;
$$;

-- Restated rather than assumed. create or replace preserves ownership and privileges, but this
-- function is security definer and reachable by anon, so the grants are the security boundary and
-- belong in the same migration that rewrites the body.
revoke all on function public.read_site_content_public_records(text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.read_site_content_public_records(text, text) to anon, authenticated, service_role;
alter function public.read_site_content_public_records(text, text) owner to postgres;
