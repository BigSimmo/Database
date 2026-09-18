-- Evaluate the retained-bootstrap digest once per health read instead of twice.
--
-- WHAT WAS WRONG. `public.site_content_health_operational_base()` decides whether the retained
-- epoch-zero release is still intact by comparing TWO stored columns to the SAME freshly computed
-- digest:
--
--     and r.release_digest       = public.site_content_bootstrap_digest(r.id)
--     and r.dynamic_state_digest = public.site_content_bootstrap_digest(r.id)
--
-- `site_content_bootstrap_digest` canonicalises every `record` and `render_payload` in the release
-- -- the full 9.5 MB body of all 843 rows -- through `site_content_canonical_json`, a recursive
-- PL/pgSQL function that is invoked once per JSON node. Measured in the pinned bare image on
-- 2026-09-18 with `track_functions = 'all'`:
--
--     one site_content_bootstrap_digest()      164,820 site_content_canonical_json invocations
--     one site_content_release_digest()         10,969
--     one site_content_dynamic_state_digest()        3
--     ONE read_site_content_health()           351,594
--
-- 2 x 164,820 = 329,640 of those 351,594 invocations -- 94% of the recursive work in a health read
-- -- come from evaluating the same digest of the same release twice in the same expression. The
-- rollback CTE carries the identical pair against the previous release, which does not execute
-- today only because the retained bootstrap has no predecessor.
--
-- WHY THIS COSTS SOMETHING REAL. `read_site_content_health()` is the deployment health probe.
-- Ledger `#458SAC` records it at roughly seven seconds and stalling 24 production deploys.
--
-- WHAT THIS CHANGES, AND WHY IT IS THE SAME TEST. `A = D and B = D` is replaced by
-- `B = A and A = D`. For a non-null D the two are the same proposition, and the surrounding CASE
-- acts only on TRUE, so a null or false result takes the same branch either way. The digest is now
-- computed once, and when the two stored columns already disagree it is not computed at all --
-- which is strictly less work for a strictly identical answer.
--
-- The verification block below is not decoration: it captures the integrity verdict this function
-- produces on the LIVE population before the replacement, recomputes it after, and aborts the whole
-- transaction if any field moved. An equivalence argued on paper is not an equivalence measured on
-- the rows this database actually holds.
--
-- Risk: low. One function body, no schema change, no data change, no grant change. The public
-- wrapper `read_site_content_health()` is untouched.
-- Rollback: re-apply the previous body from
-- supabase/migrations/20260824123000_add_site_content_health_probe.sql under the
-- site_content_health_operational_base name.

begin;

set local statement_timeout = '120s';
set local lock_timeout = '10s';

-- The verdict this function returns on the live population, BEFORE the replacement.
create temporary table site_content_health_fold_evidence on commit drop as
select public.site_content_health_operational_base() as before_payload;

create or replace function public.site_content_health_operational_base()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with recursive
  db_clock as (select statement_timestamp() as now),
  sync_state as (select s.* from public.site_content_sync_state s where s.singleton),
  active_release as (
    select r.* from public.site_content_releases r join sync_state s on s.active_release_id = r.id
    where r.state = 'active'
  ),
  active_records as (select rr.* from public.site_content_release_records rr join active_release r on r.id = rr.release_id),
  outstanding_heads as (
    select h.* from public.site_content_public_records h cross join sync_state s
    where h.head_change_epoch > s.served_change_epoch
  ),
  chains as (
    select h.logical_id head_logical_id, h.pending_event_sequence origin_sequence,
      e.event_sequence, e.logical_id event_logical_id, e.target_publication_id,
      e.target_change_epoch, e.state, e.superseded_by_event_sequence, array[e.event_sequence] path
    from outstanding_heads h left join public.site_content_sync_events e on e.event_sequence = h.pending_event_sequence
    union all
    select c.head_logical_id, c.origin_sequence, e.event_sequence, e.logical_id,
      e.target_publication_id, e.target_change_epoch, e.state,
      e.superseded_by_event_sequence, c.path || e.event_sequence
    from chains c join public.site_content_sync_events e on e.event_sequence = c.superseded_by_event_sequence
    where c.event_sequence is not null and e.event_sequence > c.event_sequence
      and not e.event_sequence = any(c.path)
  ),
  terminals as (
    select distinct on (head_logical_id) * from chains order by head_logical_id, cardinality(path) desc
  ),
  terminal_current_events as (
    select distinct e.event_sequence, e.state, e.lease_expires_at
    from terminals t
    join public.site_content_sync_events e on e.event_sequence = t.event_sequence
  ),
  live_events as (
    select e.* from public.site_content_sync_events e where e.state in ('pending','retry_pending','processing','ready')
  ),
  queue as (
    select count(*) filter (where state = 'pending')::bigint pending_count,
      count(*) filter (where state = 'retry_pending')::bigint retry_pending_count,
      count(*) filter (where state = 'processing')::bigint processing_count,
      count(*) filter (where state = 'ready')::bigint ready_count,
      count(*) filter (where state = 'quarantined')::bigint quarantined_count,
      count(*) filter (where state = 'processing'
        and (lease_expires_at is null or lease_expires_at <= db_clock.now))::bigint expired_lease_count
    from terminal_current_events cross join db_clock
  ),
  invocation_latest as (
    select i.* from public.site_content_sync_worker_invocations i
    order by i.started_at desc, i.invocation_id desc limit 1
  ),
  invocation_summary as (
    select exists(select 1 from public.site_content_sync_worker_invocations) synchronizer_seen,
      (select started_at from invocation_latest) last_invocation_at,
      (select max(terminal_at) from public.site_content_sync_worker_invocations
        where terminal_phase = 'succeeded' and outcome_code in ('idle','ready')) last_successful_invocation_at,
      coalesce((select terminal_phase = 'succeeded' and outcome_code in ('idle','ready') from invocation_latest), false)
        latest_invocation_succeeded
  ),
  bootstrap as (
    select case
      when not s.initialized and r.id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid
        and r.target_change_epoch = 0 and s.change_epoch = 0 and s.served_change_epoch = 0
        and r.registry_version = 'site-content-bootstrap-public-release-v1' and r.generation_id = 'bootstrap-v1'
        and r.previous_release_id is null and r.static_manifest_digest = repeat('0', 64)
        and r.id = public.site_content_release_id(r.release_digest, 0, 'bootstrap-v1')
        and r.state = 'active' and s.active_release_digest = r.release_digest
        and r.expected_record_count = 843 and r.expected_tombstone_count = 0
        and (select count(*) from active_records) = 843
        and r.dynamic_state_digest = r.release_digest
        and r.release_digest = public.site_content_bootstrap_digest(r.id)
        and not exists (select 1 from active_records rr where rr.target_publication_id is not null
          or rr.record is null or rr.render_payload is null or rr.record->>'logicalId' is distinct from rr.logical_id
          or rr.record->>'body' is distinct from rr.normalized_text
          or rr.record->>'contentHash' is distinct from rr.content_hash
          or rr.record->>'publicationVersion' is distinct from rr.publication_fingerprint
          or rr.embedding_model is distinct from 'bootstrap-no-embedding'
          or rr.embedding_dimensions <> 1536
          or rr.embedding_fingerprint is distinct from 'bootstrap-no-embedding-1536-v1'
          or rr.embedding is not null or rr.embedding_value_digest is not null or rr.tombstone or not rr.public_visible)
        and not exists (select 1 from outstanding_heads)
        and not exists (select 1 from live_events)
        and (select quarantined_count = 0 and expired_lease_count = 0 from queue)
        then 'valid_retained'
      when not s.initialized or r.id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid or r.target_change_epoch = 0
        then 'invalid'
      else 'not_applicable'
    end state
    from sync_state s left join active_release r on true
  ),
  integrity as (
    select coalesce(r.target_change_epoch = s.served_change_epoch, false)
        and coalesce(r.expected_record_count = (select count(*) from active_records), false)
        and coalesce(r.expected_tombstone_count = (select count(*) from active_records where tombstone), false)
        and not exists (select 1 from active_records where record is null or render_payload is null)
        and not exists (select 1 from active_records rr
          left join public.site_content_publications p on p.id = rr.target_publication_id
          where s.initialized and (rr.target_publication_id is null or p.id is null
            or p.logical_id is distinct from rr.logical_id or p.record is distinct from rr.record
            or p.render_payload is distinct from rr.render_payload or p.retired is distinct from rr.tombstone))
        and not exists (select 1 from public.site_content_public_records h
          left join active_records rr on rr.target_publication_id = h.current_publication_id
          where h.head_change_epoch <= s.served_change_epoch
            and (rr.logical_id is null or h.retired is distinct from rr.tombstone))
        -- A newer outstanding head may legitimately name a later publication,
        -- but every served active record must remain tracked by logical identity.
        and not exists (select 1 from active_records rr
          left join public.site_content_public_records h on h.logical_id = rr.logical_id
          where s.initialized and rr.target_publication_id is not null and (
            h.logical_id is null
            or (h.head_change_epoch <= s.served_change_epoch and (
              h.current_publication_id is distinct from rr.target_publication_id
              or h.retired is distinct from rr.tombstone))))
        and not exists (select 1 from outstanding_heads h
          left join public.site_content_publications p on p.id = h.current_publication_id
          where p.id is null or p.logical_id is distinct from h.logical_id or p.retired is distinct from h.retired)
        as population_complete,
      coalesce(r.release_digest = public.site_content_release_digest(r.id)
        and s.active_release_digest = r.release_digest
        and public.site_content_provider_free_checks_pass(r.id), false) release_digest_valid,
      coalesce(r.dynamic_state_digest = public.site_content_dynamic_state_digest(r.id), false) dynamic_digest_valid,
      not exists (select 1 from active_records rr left join public.site_content_publications p on p.id = rr.target_publication_id
        where rr.target_publication_id is not null and (p.id is null or p.published_by is null
          or not exists (select 1 from auth.users u where u.id = p.published_by)
          or p.administrator_authorized_at > p.created_at
          or p.administrator_authorization_version <> 'site-content-admin-authorization-v1')) administrator_attestation_valid,
      not exists (select 1 from active_records rr where not rr.tombstone and rr.public_visible and (
        rr.record->>'sourceStatus' is null or rr.record->>'sourceStatus' not in ('current','review_due')
        or rr.record->>'validationStatus' is null
        or rr.record->>'validationStatus' not in ('locally_reviewed','approved'))) governance_valid,
      not exists (select 1 from public.site_content_public_records h cross join sync_state st
        where h.head_change_epoch <= st.served_change_epoch and h.pending_event_sequence is not null)
      and not exists (select 1 from outstanding_heads h
        left join public.site_content_sync_events origin on origin.event_sequence = h.pending_event_sequence
        left join terminals t on t.head_logical_id = h.logical_id
        where h.pending_event_sequence is null or origin.event_sequence is null
          or origin.logical_id is distinct from h.logical_id
          or origin.target_publication_id is distinct from h.current_publication_id
          or origin.target_change_epoch is distinct from h.head_change_epoch
          or t.event_sequence is null or t.state not in ('pending','retry_pending','processing','ready')
          or t.superseded_by_event_sequence is not null
          or t.target_change_epoch is distinct from (select max(target_change_epoch) from live_events))
      and not exists (select 1 from live_events e where not exists (
        select 1 from terminals t where t.event_sequence = e.event_sequence)) pending_set_exact,
      (select count(*) from outstanding_heads) = (select count(*) from terminals) outstanding_count_agrees
    from sync_state s left join active_release r on true
  ),
  oldest as (
    select case when count(*) = 0 then null
      else floor(extract(epoch from (max(db_clock.now) - min(e.created_at))) * 1000)::bigint end age_ms
    from outstanding_heads h left join public.site_content_sync_events e on e.event_sequence = h.pending_event_sequence
    cross join db_clock
  ),
  rollback as (
    select coalesce(r.previous_release_id is not null and p.state = 'superseded'
      and receipt.receipt#>>'{resource,kind}' = 'site_release'
      and receipt.receipt#>>'{resource,siteReleaseId}' = r.id::text
      and receipt.receipt#>>'{resource,siteReleaseDigest}' = r.release_digest
      and receipt.receipt#>>'{resource,previousSiteReleaseId}' = p.id::text
      and receipt.receipt#>>'{resource,previousSiteReleaseDigest}' = p.release_digest
      and (
        (p.target_change_epoch <> 0 and p.id <> 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid)
        or (p.target_change_epoch = 0
          and p.id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid
          and p.registry_version = 'site-content-bootstrap-public-release-v1'
          and p.generation_id = 'bootstrap-v1' and p.previous_release_id is null
          and p.static_manifest_digest = repeat('0', 64)
          and p.id = public.site_content_release_id(p.release_digest, 0, 'bootstrap-v1')
          and p.expected_record_count = 843 and p.expected_tombstone_count = 0
          and (select count(*) from public.site_content_release_records rr where rr.release_id = p.id) = 843
          and p.dynamic_state_digest = p.release_digest
          and p.release_digest = public.site_content_bootstrap_digest(p.id)
          and not exists (select 1 from public.site_content_release_records rr
            where rr.release_id = p.id and (rr.target_publication_id is not null
              or rr.record is null or rr.render_payload is null
              or rr.record->>'logicalId' is distinct from rr.logical_id
              or rr.record->>'body' is distinct from rr.normalized_text
              or rr.record->>'contentHash' is distinct from rr.content_hash
              or rr.record->>'publicationVersion' is distinct from rr.publication_fingerprint
              or rr.embedding_model is distinct from 'bootstrap-no-embedding'
              or rr.embedding_dimensions <> 1536
              or rr.embedding_fingerprint is distinct from 'bootstrap-no-embedding-1536-v1'
              or rr.embedding is not null or rr.embedding_value_digest is not null
              or rr.tombstone or not rr.public_visible)))
      ), false) available
    from sync_state s left join active_release r on true
    left join public.site_content_releases p on p.id = r.previous_release_id
    left join lateral (select rr.* from public.site_content_release_receipts rr
      where rr.release_id = r.id and rr.receipt_kind = 'activation' order by rr.created_at desc limit 1) receipt on true
  ),
  activation_evidence as (
    select case
        when not s.initialized and b.state = 'valid_retained' then coalesce(r.activated_at, r.created_at)
        else r.activated_at
      end projected_at,
      case
        when not s.initialized and b.state = 'valid_retained' then true
        when s.initialized and r.activated_at is not null and r.activated_at <= db_clock.now then true
        else false
      end valid
    from sync_state s left join active_release r on true cross join bootstrap b cross join db_clock
  )
  select jsonb_build_object(
    'initialized', s.initialized, 'bootstrapIntegrityState', b.state,
    'activePublicSiteRelease', case when r.id is null or not a.valid then null else jsonb_build_object(
      'version','clinical-kb-site-release-v1','releaseId',r.id::text,'registryVersion',r.registry_version,
      'staticManifestDigest',r.static_manifest_digest,'dynamicStateDigest',r.dynamic_state_digest,
      'releaseDigest',r.release_digest,'state',r.state,'activatedAt',a.projected_at) end,
    'publicSiteChangeEpoch', s.served_change_epoch::text,
    'outstandingHeadCount', (select count(*) from outstanding_heads),
    'populationComplete',i.population_complete,'releaseDigestValid',i.release_digest_valid,
    'dynamicDigestValid',i.dynamic_digest_valid,'administratorAttestationValid',i.administrator_attestation_valid,
    'governanceValid',i.governance_valid,'pendingSetExact',i.pending_set_exact,
    'outstandingHeadCountAgrees',i.outstanding_count_agrees,
    'pendingCount',q.pending_count,'retryPendingCount',q.retry_pending_count,
    'processingCount',q.processing_count,'readyCount',q.ready_count,'quarantinedCount',q.quarantined_count,
    'oldestOutstandingOriginAgeMs',o.age_ms,
    'countOverflow',greatest(q.pending_count,q.retry_pending_count,q.processing_count,q.ready_count,
      q.quarantined_count,(select count(*) from outstanding_heads)) > 1000000,
    'timeIntegrityValid',(o.age_ms is null or o.age_ms >= 0) and a.valid,
    'expiredProcessingLeaseCount',q.expired_lease_count,'synchronizerSeen',inv.synchronizer_seen,
    'lastInvocationAt',inv.last_invocation_at,'lastSuccessfulInvocationAt',inv.last_successful_invocation_at,
    'latestInvocationSucceeded',inv.latest_invocation_succeeded,'lastActivation',r.activated_at,
    'rollbackAvailable',rb.available)
  from sync_state s left join active_release r on true cross join bootstrap b cross join integrity i
  cross join queue q cross join oldest o cross join invocation_summary inv cross join rollback rb
  cross join activation_evidence a;
$$;

-- Owner and grants are preserved by `create or replace`; re-asserted so a reader of this file
-- never has to infer them. The base stays private: it is reached only through the public wrapper.
revoke all on function public.site_content_health_operational_base()
  from public, anon, authenticated, service_role;
alter function public.site_content_health_operational_base() owner to postgres;

-- Compare the integrity verdict before and after. Only the deterministic fields are compared:
-- the clock-derived ones (lastInvocationAt, oldestOutstandingOriginAgeMs) legitimately differ
-- between two statements in the same transaction and would make this guard fire on correct work.
do $verify$
declare
  v_fields text[] := array[
    'bootstrapIntegrityState','populationComplete','releaseDigestValid','dynamicDigestValid',
    'administratorAttestationValid','governanceValid','pendingSetExact','outstandingHeadCountAgrees',
    'rollbackAvailable','initialized','publicSiteChangeEpoch','outstandingHeadCount'
  ];
  v_before jsonb;
  v_after jsonb;
begin
  select (select jsonb_object_agg(f, e.before_payload -> f) from unnest(v_fields) f)
    into v_before from site_content_health_fold_evidence e;
  select (select jsonb_object_agg(f, p -> f) from unnest(v_fields) f)
    into v_after from (select public.site_content_health_operational_base() p) s;

  if v_before is null or v_after is null then
    raise exception 'site_content_health_fold_evidence_missing';
  end if;
  if v_before is distinct from v_after then
    raise exception 'site_content_health_fold_changed_verdict: before=% after=%', v_before, v_after;
  end if;
end;
$verify$;

commit;
