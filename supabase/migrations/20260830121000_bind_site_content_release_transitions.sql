-- Forward-only transition-pointer, rollback epoch, public-reader, and health correction.

begin;

select pg_catalog.pg_advisory_xact_lock(93206431);

alter table public.site_content_sync_state
  add column active_transition_receipt_id text,
  add constraint site_content_sync_state_transition_receipt_fkey
    foreign key (active_transition_receipt_id)
    references public.site_content_release_receipts(receipt_id)
    on update no action on delete no action;

create function public.site_content_receipt_bytes_valid(
  p_receipt_id text,
  p_kind text,
  p_release_id uuid,
  p_recovery_digest text,
  p_receipt jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_expected text;
  v_fields jsonb;
  v_timestamp timestamptz;
begin
  if p_receipt is null
    or jsonb_typeof(p_receipt) is distinct from 'object'
    or p_receipt->>'operation' is distinct from 'site_release'
    or p_receipt->>'projectRef' is null
    or p_receipt->>'projectRef' !~ '^[a-z0-9][a-z0-9_-]{2,63}$'
    or p_receipt_id is null
    or p_receipt_id !~ '^sha256:[0-9a-f]{64}$'
    or p_receipt->>'receiptId' is distinct from p_receipt_id
  then
    return false;
  end if;

  if p_kind = 'activation' then
    if p_receipt - array['version','receiptId','promotionId','projectRef','operation','recoveryReadinessDigest','activatedAt','resource'] is distinct from '{}'::jsonb
      or (select count(*) from jsonb_object_keys(p_receipt)) <> 8
      or p_receipt->>'version' is distinct from 'activation-receipt-v1'
      or p_receipt->>'promotionId' is null
      or p_receipt->>'promotionId' not like 'site-release:%'
      or p_receipt->>'recoveryReadinessDigest' is distinct from p_recovery_digest
      or p_receipt->>'activatedAt' is null
      or p_receipt->>'activatedAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
      or jsonb_typeof(p_receipt->'resource') is distinct from 'object'
    then
      return false;
    end if;
    if p_receipt#>>'{resource,kind}' is distinct from 'site_release'
      or p_receipt#>>'{resource,siteReleaseId}' is distinct from p_release_id::text
      or (p_receipt->'resource') - array['kind','siteReleaseId','siteReleaseDigest','previousSiteReleaseId','previousSiteReleaseDigest'] is distinct from '{}'::jsonb
      or (select count(*) from jsonb_object_keys(p_receipt->'resource')) <> 5
    then
      return false;
    end if;
    begin
      v_timestamp := (p_receipt->>'activatedAt')::timestamptz;
    exception when others then
      return false;
    end;
    if v_timestamp > pg_catalog.clock_timestamp() then
      return false;
    end if;
    v_fields := p_receipt - 'receiptId';
    v_expected := 'sha256:' || encode(extensions.digest(convert_to(
      'activation-receipt-identity-v1' || E'\n' || public.site_content_canonical_json(v_fields),
      'UTF8'), 'sha256'), 'hex');
  elsif p_kind = 'rollback' then
    if p_receipt - array['version','receiptId','activationReceiptId','promotionId','projectRef','operation','rolledBackAt','method','requiresReconstruction','outcome','target'] is distinct from '{}'::jsonb
      or (select count(*) from jsonb_object_keys(p_receipt)) <> 11
      or p_receipt->>'version' is distinct from 'rollback-receipt-v1'
      or p_receipt->>'activationReceiptId' is null
      or p_receipt->>'activationReceiptId' !~ '^sha256:[0-9a-f]{64}$'
      or p_receipt->>'promotionId' is null
      or p_receipt->>'promotionId' not like 'site-release:%'
      or p_receipt->>'rolledBackAt' is null
      or p_receipt->>'rolledBackAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
      or p_receipt->>'method' is distinct from 'retained_previous'
      or p_receipt->>'requiresReconstruction' is distinct from 'false'
      or p_receipt->>'outcome' is distinct from 'succeeded'
      or jsonb_typeof(p_receipt->'target') is distinct from 'object'
    then
      return false;
    end if;
    if p_receipt#>>'{target,kind}' is distinct from 'site_release'
      or p_receipt#>>'{target,siteReleaseId}' is distinct from p_release_id::text
      or (p_receipt->'target') - array['kind','siteReleaseId','siteReleaseDigest'] is distinct from '{}'::jsonb
      or (select count(*) from jsonb_object_keys(p_receipt->'target')) <> 3
    then
      return false;
    end if;
    begin
      v_timestamp := (p_receipt->>'rolledBackAt')::timestamptz;
    exception when others then
      return false;
    end;
    if v_timestamp > pg_catalog.clock_timestamp() then
      return false;
    end if;
    v_fields := p_receipt - 'receiptId';
    v_expected := 'sha256:' || encode(extensions.digest(convert_to(
      'rollback-receipt-identity-v1' || E'\n' || public.site_content_canonical_json(v_fields),
      'UTF8'), 'sha256'), 'hex');
  else
    return false;
  end if;

  return p_receipt_id is not distinct from v_expected;
end;
$$;

create function public.site_content_retained_bootstrap_valid(
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
    select r.id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid
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

create function public.site_content_initial_adoption_closure_valid(p_change_epoch bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    p_change_epoch > 0
    and (select count(*) from public.site_content_publications) = p_change_epoch
    and (select count(*) from public.site_content_public_records) = p_change_epoch
    and (select count(*) from public.site_content_sync_events) = p_change_epoch
    and (select count(distinct e.target_change_epoch) from public.site_content_sync_events e) = p_change_epoch
    and (select min(e.target_change_epoch) from public.site_content_sync_events e) = 1
    and (select max(e.target_change_epoch) from public.site_content_sync_events e) = p_change_epoch
    and not exists (
      select 1 from public.site_content_public_records h
      left join public.site_content_publications p
        on p.id = h.current_publication_id and p.logical_id = h.logical_id
      left join public.site_content_sync_events e on e.event_sequence = h.pending_event_sequence
      where p.id is null or e.event_sequence is null
        or e.logical_id is distinct from h.logical_id
        or e.target_publication_id is distinct from h.current_publication_id
        or e.target_change_epoch is distinct from h.head_change_epoch
        or (e.target_change_epoch = p_change_epoch and (
          e.state not in ('pending','retry_pending','processing','ready')
          or e.superseded_by_event_sequence is not null))
        or (e.target_change_epoch < p_change_epoch and (
          e.state <> 'superseded'
          or e.superseded_by_event_sequence is null
          or not exists (
            select 1 from public.site_content_sync_events successor
            where successor.event_sequence = e.superseded_by_event_sequence
              and successor.target_change_epoch > e.target_change_epoch
              and successor.target_change_epoch <= p_change_epoch))))
    and not exists (
      select 1 from public.site_content_sync_events e
      left join public.site_content_public_records h on h.pending_event_sequence = e.event_sequence
      left join public.site_content_publications p
        on p.id = e.target_publication_id and p.logical_id = e.logical_id
      where h.logical_id is null or p.id is null
        or h.logical_id is distinct from e.logical_id
        or h.current_publication_id is distinct from e.target_publication_id
        or h.head_change_epoch is distinct from e.target_change_epoch)
    and not exists (
      select 1 from public.site_content_publications p
      left join public.site_content_public_records h
        on h.current_publication_id = p.id and h.logical_id = p.logical_id
      where h.logical_id is null)
    and not exists (
      select 1 from public.site_content_sync_event_plans ep
      left join public.site_content_sync_events e on e.event_sequence = ep.event_sequence
      where e.event_sequence is null
        or ep.target_change_epoch is distinct from e.target_change_epoch
        or ep.plan->>'targetChangeEpoch' is distinct from e.target_change_epoch::text
        or ep.plan->>'planDigest' is distinct from ep.plan_digest
        or ep.plan_digest is distinct from public.site_content_json_sha256(ep.plan - 'planDigest')),
    false);
$$;

create function public.site_content_current_transition_kind(
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
      and p_active_release_id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid
      and p_served_change_epoch = 0
      and public.site_content_retained_bootstrap_valid(p_active_release_id, p_active_release_digest)
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

create function public.site_content_current_transition_source_release_id(p_receipt_id text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select ar.release_id
  from public.site_content_release_receipts tr
  join public.site_content_release_receipts ar on ar.receipt_id = tr.receipt->>'activationReceiptId'
  where tr.receipt_id = p_receipt_id and tr.receipt_kind = 'rollback' and ar.receipt_kind = 'activation';
$$;

do $$
declare
  v_state public.site_content_sync_state%rowtype;
  v_active public.site_content_releases%rowtype;
  v_activation_id text;
  v_activation_count integer;
  v_rollback_id text;
  v_rollback_source_epoch bigint;
  v_rollback_count integer;
  v_publication_count bigint;
  v_head_count bigint;
  v_event_count bigint;
  v_distinct_epoch_count bigint;
  v_classification_count integer := 0;
begin
  select * into strict v_state from public.site_content_sync_state where singleton for update;
  select * into strict v_active from public.site_content_releases where id = v_state.active_release_id for update;

  if v_active.release_digest is distinct from v_state.active_release_digest
    or v_active.state is distinct from 'active'
    or (select count(*) from public.site_content_releases where state = 'active') <> 1
  then
    raise exception using errcode = '55000', message = 'site_content_transition_backfill_unprovable';
  end if;

  if exists (
    select 1 from public.site_content_release_receipts rr
    join public.site_content_releases r on r.id = rr.release_id
    where public.site_content_receipt_bytes_valid(
      rr.receipt_id, rr.receipt_kind, rr.release_id, rr.recovery_readiness_digest, rr.receipt) is not true
      or (rr.receipt_kind = 'activation'
        and rr.receipt#>>'{resource,siteReleaseDigest}' is distinct from r.release_digest)
      or (rr.receipt_kind = 'rollback'
        and rr.receipt#>>'{target,siteReleaseDigest}' is distinct from r.release_digest)
      or (rr.receipt_kind = 'activation' and not exists (
        select 1
        from public.site_content_releases previous
        where previous.id = r.previous_release_id
          and rr.receipt#>>'{resource,previousSiteReleaseId}' = previous.id::text
          and rr.receipt#>>'{resource,previousSiteReleaseDigest}' = previous.release_digest))
      or (rr.receipt_kind = 'rollback' and not exists (
        select 1
        from public.site_content_release_receipts ar
        join public.site_content_releases source on source.id = ar.release_id
        where ar.receipt_id = rr.receipt->>'activationReceiptId'
          and ar.receipt_kind = 'activation'
          and source.previous_release_id = r.id
          and source.state = 'rolled_back'
          and public.site_content_receipt_bytes_valid(
            ar.receipt_id, 'activation', ar.release_id, ar.recovery_readiness_digest, ar.receipt) is true
          and ar.receipt#>>'{resource,siteReleaseDigest}' = source.release_digest
          and ar.receipt#>>'{resource,previousSiteReleaseId}' = r.id::text
          and ar.receipt#>>'{resource,previousSiteReleaseDigest}' = r.release_digest
          and rr.receipt->>'promotionId' = ar.receipt->>'promotionId'
          and rr.receipt->>'projectRef' = ar.receipt->>'projectRef'
          and rr.receipt->>'rolledBackAt' >= ar.receipt->>'activatedAt'))
  ) then
    raise exception using errcode = '55000', message = 'site_content_transition_backfill_unprovable';
  end if;

  if not v_state.initialized
    and v_active.id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid
    and v_active.state = 'active'
    and public.site_content_retained_bootstrap_valid(v_active.id, v_state.active_release_digest)
    and v_state.change_epoch = 0 and v_state.served_change_epoch = 0
    and not exists (select 1 from public.site_content_publications)
    and not exists (select 1 from public.site_content_public_records)
    and not exists (select 1 from public.site_content_sync_events)
    and not exists (select 1 from public.site_content_release_receipts)
    and not exists (select 1 from public.site_content_releases r where r.id <> v_active.id)
  then
    v_classification_count := v_classification_count + 1;
  end if;

  if not v_state.initialized
    and v_active.id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid
    and v_active.state = 'active'
    and public.site_content_retained_bootstrap_valid(v_active.id, v_state.active_release_digest)
    and v_state.served_change_epoch = 0 and v_state.change_epoch > 0
    and not exists (select 1 from public.site_content_release_receipts)
  then
    if public.site_content_initial_adoption_closure_valid(v_state.change_epoch)
      and not exists (
        select 1 from public.site_content_publications p
        left join public.site_content_reconciliation_plans rp on rp.plan_digest = p.reconciliation_plan_digest
        where rp.plan_digest is null or rp.reviewed_by is null
          or rp.reviewed_at <> rp.administrator_authorized_at
          or rp.administrator_authorization_version <> 'site-content-admin-authorization-v1'
          or not exists (select 1 from auth.users u where u.id = rp.reviewed_by)
      )
    then
      v_classification_count := v_classification_count + 1;
    end if;
  end if;

  select min(tr.receipt_id), count(*) into v_activation_id, v_activation_count
  from public.site_content_release_receipts tr
  left join public.site_content_releases previous on previous.id = v_active.previous_release_id
  where v_state.initialized and v_active.id <> 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid
    and v_active.state = 'active' and tr.release_id = v_active.id and tr.receipt_kind = 'activation'
    and v_state.served_change_epoch = v_active.target_change_epoch
    and v_active.target_change_epoch <= v_state.change_epoch
    and public.site_content_receipt_bytes_valid(
      tr.receipt_id, 'activation', tr.release_id, tr.recovery_readiness_digest, tr.receipt)
    and tr.receipt#>>'{resource,siteReleaseDigest}' = v_active.release_digest
    and tr.receipt#>>'{resource,previousSiteReleaseId}' = coalesce(v_active.previous_release_id::text, '')
    and tr.receipt#>>'{resource,previousSiteReleaseDigest}' = coalesce(previous.release_digest, '')
    and not exists (
      select 1 from public.site_content_release_receipts rb
      join public.site_content_release_receipts ar on ar.receipt_id = rb.receipt->>'activationReceiptId'
      join public.site_content_releases source on source.id = ar.release_id
      where rb.receipt_kind = 'rollback' and rb.release_id = v_active.id
        and source.previous_release_id = v_active.id and source.state = 'rolled_back'
        and public.site_content_receipt_bytes_valid(
          rb.receipt_id, 'rollback', rb.release_id, rb.recovery_readiness_digest, rb.receipt)
        and source.target_change_epoch <= v_state.change_epoch
    );
  if v_activation_count = 1 then
    if exists (
      select 1 from public.site_content_public_records h
      left join public.site_content_release_records rr
        on rr.release_id = v_active.id and rr.logical_id = h.logical_id
      where h.head_change_epoch <= v_state.served_change_epoch and (
        rr.logical_id is null or rr.target_publication_id <> h.current_publication_id
        or rr.tombstone <> h.retired)
    ) or exists (
      select 1 from public.site_content_public_records h
      left join public.site_content_sync_events e on e.event_sequence = h.pending_event_sequence
      where h.head_change_epoch > v_state.served_change_epoch and (
        e.event_sequence is null or e.logical_id <> h.logical_id
        or e.target_publication_id <> h.current_publication_id
        or e.target_change_epoch <> h.head_change_epoch
        or e.state not in ('pending','retry_pending','processing','ready'))
    ) then
      raise exception using errcode = '55000', message = 'site_content_transition_backfill_unprovable';
    end if;
    v_classification_count := v_classification_count + 1;
  end if;

  with candidates as (
    select rb.receipt_id, source.target_change_epoch,
      rank() over (order by source.target_change_epoch desc) as epoch_rank
    from public.site_content_release_receipts rb
    join public.site_content_release_receipts ar on ar.receipt_id = rb.receipt->>'activationReceiptId'
    join public.site_content_releases source on source.id = ar.release_id
    where rb.receipt_kind = 'rollback' and rb.release_id = v_active.id
      and v_active.state = 'active' and source.state = 'rolled_back'
      and source.previous_release_id = v_active.id
      and v_state.initialized = (v_active.target_change_epoch > 0)
      and v_state.served_change_epoch = v_active.target_change_epoch
      and source.target_change_epoch <= v_state.change_epoch
      and ar.receipt_kind = 'activation'
      and public.site_content_receipt_bytes_valid(
        rb.receipt_id, 'rollback', rb.release_id, rb.recovery_readiness_digest, rb.receipt)
      and public.site_content_receipt_bytes_valid(
        ar.receipt_id, 'activation', ar.release_id, ar.recovery_readiness_digest, ar.receipt)
      and rb.receipt#>>'{target,siteReleaseDigest}' = v_active.release_digest
      and ar.receipt#>>'{resource,siteReleaseDigest}' = source.release_digest
      and ar.receipt#>>'{resource,previousSiteReleaseId}' = v_active.id::text
      and ar.receipt#>>'{resource,previousSiteReleaseDigest}' = v_active.release_digest
      and rb.receipt->>'promotionId' = ar.receipt->>'promotionId'
      and rb.receipt->>'projectRef' = ar.receipt->>'projectRef'
      and rb.receipt->>'rolledBackAt' >= ar.receipt->>'activatedAt'
  ), selected as (
    select * from candidates where epoch_rank = 1
  )
  select min(receipt_id), min(target_change_epoch), count(*)
    into v_rollback_id, v_rollback_source_epoch, v_rollback_count from selected;
  if v_rollback_count = 1 then
    if exists (
      select 1 from public.site_content_public_records h
      left join public.site_content_release_records rr
        on rr.release_id = public.site_content_current_transition_source_release_id(v_rollback_id)
        and rr.logical_id = h.logical_id
      where h.head_change_epoch <= v_rollback_source_epoch and (
        rr.logical_id is null or rr.target_publication_id <> h.current_publication_id
        or rr.tombstone <> h.retired)
    ) or exists (
      select 1 from public.site_content_public_records h
      left join public.site_content_sync_events e on e.event_sequence = h.pending_event_sequence
      where h.head_change_epoch > v_rollback_source_epoch and (
        e.event_sequence is null or e.logical_id <> h.logical_id
        or e.target_publication_id <> h.current_publication_id
        or e.target_change_epoch <> h.head_change_epoch
        or e.state not in ('pending','retry_pending','processing','ready'))
    ) or exists (
      select 1 from public.site_content_sync_events e
      where e.state in ('pending','retry_pending','processing','ready') and not exists (
        select 1 from public.site_content_public_records h
        where h.pending_event_sequence = e.event_sequence and h.head_change_epoch > v_rollback_source_epoch)
    ) then
      raise exception using errcode = '55000', message = 'site_content_transition_backfill_unprovable';
    end if;
    v_classification_count := v_classification_count + 1;
  end if;

  if v_classification_count <> 1 then
    raise exception using errcode = '55000', message = 'site_content_transition_backfill_unprovable';
  end if;
  if v_rollback_count = 1 then
    update public.site_content_sync_state
      set active_transition_receipt_id = v_rollback_id,
          initialized = true,
          served_change_epoch = v_rollback_source_epoch,
          updated_at = pg_catalog.clock_timestamp()
      where singleton;
  elsif v_activation_count = 1 then
    update public.site_content_sync_state
      set active_transition_receipt_id = v_activation_id,
          updated_at = pg_catalog.clock_timestamp()
      where singleton;
  end if;
end;
$$;

alter table public.site_content_sync_state
  add constraint site_content_sync_state_transition_pointer_check check (
    (not initialized
      and active_release_id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid
      and served_change_epoch = 0
      and active_transition_receipt_id is null)
    or (initialized and active_transition_receipt_id is not null)
  );

create function public.guard_site_content_sync_state_transition_pointer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.active_release_id, new.active_release_digest, new.initialized, new.served_change_epoch)
       is distinct from
       (old.active_release_id, old.active_release_digest, old.initialized, old.served_change_epoch)
    and new.active_transition_receipt_id is not distinct from old.active_transition_receipt_id
  then
    raise exception using errcode = '55000', message = 'site_content_transition_pointer_update_required';
  end if;
  return new;
end;
$$;

create trigger site_content_sync_state_transition_pointer_guard
before update on public.site_content_sync_state
for each row execute function public.guard_site_content_sync_state_transition_pointer();

revoke all on function public.site_content_receipt_bytes_valid(text, text, uuid, text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.site_content_retained_bootstrap_valid(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.site_content_initial_adoption_closure_valid(bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.site_content_current_transition_kind(text, uuid, text, boolean, bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.site_content_current_transition_source_release_id(text)
  from public, anon, authenticated, service_role;
revoke all on function public.guard_site_content_sync_state_transition_pointer()
  from public, anon, authenticated, service_role;
alter function public.site_content_receipt_bytes_valid(text, text, uuid, text, jsonb) owner to postgres;
alter function public.site_content_retained_bootstrap_valid(uuid, text) owner to postgres;
alter function public.site_content_initial_adoption_closure_valid(bigint) owner to postgres;
alter function public.site_content_current_transition_kind(text, uuid, text, boolean, bigint) owner to postgres;
alter function public.site_content_current_transition_source_release_id(text) owner to postgres;
alter function public.guard_site_content_sync_state_transition_pointer() owner to postgres;

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
          and r.id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid
          and r.target_change_epoch = 0
          and r.release_digest = public.site_content_bootstrap_digest(r.id))
      ), false) valid
    from state s left join active_release r on true
  ), outstanding as (
    select h.* from public.site_content_public_records h cross join transition s
    where h.head_change_epoch > s.served_change_epoch
  ), classified as (
    select rr.logical_id, rr.record, rr.render_payload,
      coalesce(p.kind, case
        when rr.logical_id like 'services:%' then 'service'
        when rr.logical_id like 'forms:%' then 'form'
        when rr.logical_id like 'medications:%' then 'medication'
        when rr.logical_id like 'differentials:diagnosis:%' then 'differential'
        when rr.logical_id like 'differentials:presentation:%' then 'presentation'
      end) as kind,
      coalesce(p.slug, case
        when rr.logical_id like 'services:%' then substr(rr.logical_id, length('services:') + 1)
        when rr.logical_id like 'forms:%' then substr(rr.logical_id, length('forms:') + 1)
        when rr.logical_id like 'medications:%' then substr(rr.logical_id, length('medications:') + 1)
        when rr.logical_id like 'differentials:diagnosis:%' then
          substr(rr.logical_id, length('differentials:diagnosis:') + 1)
        when rr.logical_id like 'differentials:presentation:%' then
          substr(rr.logical_id, length('differentials:presentation:') + 1)
      end) as slug
    from transition s
    join public.site_content_release_records rr on rr.release_id = s.active_release_id
    left join public.site_content_publications p on p.id = rr.target_publication_id and p.logical_id = rr.logical_id
    where rr.public_visible and not rr.tombstone
      and (rr.target_publication_id is not null or
        (rr.release_id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid and rr.target_publication_id is null))
  ), requested as (
    select c.logical_id, c.record, c.render_payload
    from classified c
    where c.kind = p_kind and (p_slug is null or c.slug = p_slug)
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
        when s.active_release_id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid then 'unavailable'
        when exists (select 1 from outstanding) then 'updating'
        else 'current'
      end
    ) as snapshot
  from transition s
  left join active_release rel on true
  left join safe_requested r on true;
$$;

create or replace function public.activate_site_content_release(
  p_release_id uuid,
  p_expected_release_digest text,
  p_expected_change_epoch bigint,
  p_recovery_digest text,
  p_activation_receipt jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.site_content_sync_state%rowtype;
  v_release public.site_content_releases%rowtype;
  v_receipt_id text;
  v_transition_kind text;
begin
  perform pg_catalog.pg_advisory_xact_lock(93206431);
  select * into strict v_state from public.site_content_sync_state where singleton for update;
  perform 1 from public.site_content_releases r
    where r.id in (p_release_id, v_state.active_release_id)
    order by r.id for update;
  select * into v_release from public.site_content_releases where id = p_release_id;
  v_transition_kind := public.site_content_current_transition_kind(
    v_state.active_transition_receipt_id, v_state.active_release_id,
    v_state.active_release_digest, v_state.initialized, v_state.served_change_epoch);
  if (v_state.initialized and v_transition_kind not in ('activation','rollback'))
    or (not v_state.initialized and (
      v_transition_kind <> 'bootstrap'
      or v_state.active_transition_receipt_id is not null
      or v_state.served_change_epoch <> 0
      or v_state.active_release_id <> 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid))
  then return false; end if;
  if not found or v_release.state <> 'candidate'
    or v_release.release_digest is distinct from p_expected_release_digest
    or v_release.target_change_epoch is distinct from p_expected_change_epoch
    or v_state.change_epoch is distinct from p_expected_change_epoch
    or v_release.previous_release_id is distinct from v_state.active_release_id
    or not v_release.must_pass_checks
    or not public.site_content_provider_free_checks_pass(p_release_id)
    or public.site_content_dynamic_state_digest(p_release_id) is distinct from v_release.dynamic_state_digest
    or public.site_content_release_digest(p_release_id) is distinct from v_release.release_digest
    or p_activation_receipt#>>'{resource,siteReleaseDigest}' is distinct from v_release.release_digest
    or p_activation_receipt#>>'{resource,previousSiteReleaseId}' is distinct from coalesce(v_release.previous_release_id::text, '')
    or p_activation_receipt#>>'{resource,previousSiteReleaseDigest}' is distinct from coalesce(v_state.active_release_digest, '')
    then return false; end if;
  perform 1 from public.site_content_public_records h order by h.logical_id for update;
  perform 1 from public.site_content_sync_events e order by e.event_sequence for update;
  perform 1 from public.site_content_release_records rr
    where rr.release_id = p_release_id order by rr.logical_id for update;
  if (select count(*) from public.site_content_release_records rr where rr.release_id = p_release_id) <> v_release.expected_record_count
    or (select count(*) from public.site_content_release_records rr where rr.release_id = p_release_id and rr.tombstone) <> v_release.expected_tombstone_count
    or (select jsonb_array_length(ep.plan->'added') from public.site_content_sync_event_plans ep where ep.plan_digest = v_release.plan_digest limit 1) <> v_release.expected_added_count
    or (select jsonb_array_length(ep.plan->'changed') from public.site_content_sync_event_plans ep where ep.plan_digest = v_release.plan_digest limit 1) <> v_release.expected_changed_count
    or (select jsonb_array_length(ep.plan->'unchanged') from public.site_content_sync_event_plans ep where ep.plan_digest = v_release.plan_digest limit 1) <> v_release.expected_unchanged_count
    or exists (select 1 from public.site_content_release_records rr where rr.release_id = p_release_id and not rr.tombstone and
      (rr.embedding is null or extensions.vector_dims(rr.embedding) <> rr.embedding_dimensions
        or rr.embedding_value_digest is distinct from encode(extensions.digest(convert_to(rr.embedding::text, 'UTF8'), 'sha256'), 'hex')
        or not rr.public_visible))
    or exists (select 1 from public.site_content_sync_events e where e.target_change_epoch = p_expected_change_epoch and e.state <> 'ready')
    or exists (
      select 1 from public.site_content_public_records h
      left join public.site_content_release_records rr on rr.release_id = p_release_id and rr.logical_id = h.logical_id
      where rr.logical_id is null or rr.target_publication_id is distinct from h.current_publication_id
        or rr.tombstone is distinct from h.retired
        or rr.governance_fingerprint = '' or rr.lineage_fingerprint = ''
    ) or exists (
      select 1 from public.site_content_release_records rr
      where rr.release_id = p_release_id and rr.target_publication_id is not null and not rr.tombstone
        and not exists (select 1 from public.site_content_public_records h
          where h.logical_id = rr.logical_id and h.current_publication_id = rr.target_publication_id)
    ) then return false; end if;
  if not v_state.initialized and (
    not public.site_content_initial_adoption_closure_valid(v_state.change_epoch)
    or v_release.reconciliation_plan_digest is null
    or not exists (
      select 1 from public.site_content_reconciliation_plans rp
      where rp.plan_digest = v_release.reconciliation_plan_digest
        and rp.reviewed_by is not null
        and exists (select 1 from auth.users u where u.id = rp.reviewed_by)
        and rp.reviewed_at = rp.administrator_authorized_at
        and rp.administrator_authorization_version = 'site-content-admin-authorization-v1'
        and public.site_content_reconciliation_sources_match(rp.plan_digest)
        and (select count(*) from jsonb_array_elements(rp.dispositions) item where item->>'disposition' = 'adopt') =
          (select count(*) from public.site_content_public_records)
        and not exists (
          select 1 from jsonb_array_elements(rp.dispositions) item
          where item->>'disposition' = 'adopt' and not exists (
            select 1 from public.site_content_public_records h
            join public.site_content_publications p on p.id = h.current_publication_id
            join public.site_content_release_records rr on rr.release_id = p_release_id and rr.logical_id = h.logical_id
            where h.logical_id = item->>'logicalId'
              and p.reconciliation_plan_digest = rp.plan_digest
              and p.source_row_id::text = item->>'sourceRowId'
              and p.source_version = item->>'sourceVersion'
              and p.record->>'contentHash' = item->>'contentHash'
              and p.record->>'publicationVersion' = item->>'publicationVersion'
              and item->>'trustedPublicRecordId' = h.logical_id
              and item->>'trustedRoute' = p.record->>'route'
              and item->>'trustedGovernanceHash' = public.site_content_record_governance_hash(p.record)
              and rr.target_publication_id = p.id
              and exists (
                select 1 from (
                  select 'service'::text source_kind, id,
                    to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') source_version
                    from public.clinical_registry_records where kind = 'service'
                  union all select 'form', id,
                    to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
                    from public.clinical_registry_records where kind = 'form'
                  union all select 'medication', id,
                    to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
                    from public.medication_records
                  union all select case kind when 'presentation' then 'presentation' else 'differential' end, id,
                    to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
                    from public.differential_records
                ) live
                where live.source_kind = item->>'sourceKind'
                  and live.id::text = item->>'sourceRowId'
                  and live.source_version = item->>'sourceVersion'
              )
          )
        )
    )
  ) then return false; end if;
  v_receipt_id := public.guard_site_content_receipt_shape(p_activation_receipt, 'activation', p_release_id, p_recovery_digest);
  if public.site_content_receipt_bytes_valid(
    v_receipt_id, 'activation', p_release_id, p_recovery_digest, p_activation_receipt
  ) is not true then
    return false;
  end if;
  insert into public.site_content_release_receipts(receipt_id, release_id, receipt_kind, recovery_readiness_digest, receipt)
  values (v_receipt_id, p_release_id, 'activation', p_recovery_digest, p_activation_receipt);
  if v_state.active_release_id is not null then
    update public.site_content_releases set state = 'superseded' where id = v_state.active_release_id;
  end if;
  update public.site_content_releases set state = 'active', activated_at = pg_catalog.clock_timestamp() where id = p_release_id;
  update public.site_content_sync_state set active_release_id = p_release_id,
    active_release_digest = p_expected_release_digest, initialized = true,
    served_change_epoch = p_expected_change_epoch,
    active_transition_receipt_id = v_receipt_id,
    updated_at = pg_catalog.clock_timestamp() where singleton;
  update public.site_content_sync_events e set state = 'completed', updated_at = pg_catalog.clock_timestamp()
  where e.target_change_epoch = p_expected_change_epoch and e.state = 'ready'
    and exists (
      select 1 from public.site_content_release_records rr
      where rr.release_id = p_release_id and rr.logical_id = e.logical_id
        and rr.target_publication_id = e.target_publication_id
    );
  update public.site_content_public_records h set pending_event_sequence = null,
    updated_at = pg_catalog.clock_timestamp()
  where exists (
    select 1 from public.site_content_release_records rr
    where rr.release_id = p_release_id and rr.logical_id = h.logical_id
      and rr.target_publication_id = h.current_publication_id
  );
  return true;
end;
$$;

create or replace function public.rollback_site_content_release(
  p_expected_active_release_id uuid,
  p_target_release_id uuid,
  p_recovery_digest text,
  p_rollback_receipt jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.site_content_sync_state%rowtype;
  v_active public.site_content_releases%rowtype;
  v_target public.site_content_releases%rowtype;
  v_activation public.site_content_release_receipts%rowtype;
  v_receipt_id text;
begin
  perform pg_catalog.pg_advisory_xact_lock(93206431);
  select * into strict v_state from public.site_content_sync_state where singleton for update;
  if v_state.active_release_id is distinct from p_expected_active_release_id
    or public.site_content_current_transition_kind(
      v_state.active_transition_receipt_id, v_state.active_release_id,
      v_state.active_release_digest, v_state.initialized, v_state.served_change_epoch) <> 'activation'
  then return false; end if;
  perform 1 from public.site_content_releases r
    where r.id in (p_expected_active_release_id, p_target_release_id)
    order by r.id for update;
  select * into strict v_active from public.site_content_releases where id = p_expected_active_release_id;
  select * into strict v_target from public.site_content_releases where id = p_target_release_id;
  perform 1 from public.site_content_public_records h order by h.logical_id for update;
  perform 1 from public.site_content_sync_events e order by e.event_sequence for update;
  perform 1 from public.site_content_release_records rr
    where rr.release_id in (p_expected_active_release_id, p_target_release_id)
    order by rr.logical_id for update;
  perform 1 from public.site_content_releases r where r.state = 'candidate' order by r.id for update;
  if v_active.state <> 'active'
    or v_active.previous_release_id is distinct from p_target_release_id
    or v_target.state <> 'superseded'
    or v_state.change_epoch is distinct from v_state.served_change_epoch
    or v_active.target_change_epoch is distinct from v_state.change_epoch
    or exists (select 1 from public.site_content_releases r where r.state = 'candidate')
    or exists (select 1 from public.site_content_public_records h
      where h.head_change_epoch > v_state.served_change_epoch or h.pending_event_sequence is not null)
    or exists (select 1 from public.site_content_sync_events e
      where e.state in ('pending','retry_pending','processing','ready'))
  then return false; end if;
  select * into v_activation from public.site_content_release_receipts
  where receipt_id = v_state.active_transition_receipt_id
    and release_id = p_expected_active_release_id and receipt_kind = 'activation';
  if not found
    or public.site_content_receipt_bytes_valid(
      v_activation.receipt_id, 'activation', v_activation.release_id,
      v_activation.recovery_readiness_digest, v_activation.receipt) is not true
    or p_rollback_receipt->>'activationReceiptId' is distinct from v_activation.receipt_id
    or p_rollback_receipt->>'promotionId' is distinct from v_activation.receipt->>'promotionId'
    or p_rollback_receipt->>'projectRef' is distinct from v_activation.receipt->>'projectRef'
    or p_rollback_receipt->>'operation' is distinct from 'site_release'
    or (p_rollback_receipt->>'rolledBackAt')::timestamptz <
      (v_activation.receipt->>'activatedAt')::timestamptz
    or p_rollback_receipt#>>'{target,siteReleaseId}' is distinct from p_target_release_id::text
    or p_rollback_receipt#>>'{target,siteReleaseDigest}' is distinct from v_target.release_digest then return false; end if;
  if v_target.target_change_epoch = 0 and (
    v_target.id is distinct from 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'
    or v_target.registry_version is distinct from 'site-content-bootstrap-public-release-v1'
    or v_target.generation_id is distinct from 'bootstrap-v1'
    or v_target.id is distinct from public.site_content_release_id(v_target.release_digest, 0, 'bootstrap-v1')
    or v_target.expected_record_count < 1
    or v_target.expected_record_count <> (
      select count(*) from public.site_content_release_records rr where rr.release_id = v_target.id)
    or v_target.release_digest is distinct from public.site_content_bootstrap_digest(v_target.id)
    or exists (
      select 1 from public.site_content_release_records rr
      where rr.release_id = v_target.id and (
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
  ) then return false;
  elsif v_target.target_change_epoch = 0 then
    null;
  elsif v_target.id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846' then
    return false;
  end if;
  v_receipt_id := public.guard_site_content_receipt_shape(
    p_rollback_receipt, 'rollback', p_target_release_id, p_recovery_digest);
  if public.site_content_receipt_bytes_valid(
    v_receipt_id, 'rollback', p_target_release_id, p_recovery_digest, p_rollback_receipt
  ) is not true then
    return false;
  end if;
  insert into public.site_content_release_receipts(receipt_id, release_id, receipt_kind, recovery_readiness_digest, receipt)
  values (v_receipt_id, p_target_release_id, 'rollback', p_recovery_digest, p_rollback_receipt);
  update public.site_content_releases set state = 'rolled_back' where id = p_expected_active_release_id;
  update public.site_content_releases set state = 'active' where id = p_target_release_id;
  update public.site_content_sync_state set active_release_id = p_target_release_id,
    active_release_digest = v_target.release_digest,
    initialized = true,
    served_change_epoch = v_state.change_epoch,
    active_transition_receipt_id = v_receipt_id,
    updated_at = pg_catalog.clock_timestamp()
  where singleton and active_release_id = p_expected_active_release_id;
  return found;
end;
$$;

-- Retain the accepted operational queue/invocation aggregate as a private base;
-- the public service-role RPC below overlays transition-aware release integrity.
alter function public.read_site_content_health() rename to site_content_health_operational_base;
revoke all on function public.site_content_health_operational_base()
  from public, anon, authenticated, service_role;

create function public.read_site_content_health()
returns jsonb
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
    where r.state = 'active' and r.release_digest = s.active_release_digest
  ), transition_receipt as (
    select rr.* from public.site_content_release_receipts rr
    join state s on s.active_transition_receipt_id = rr.receipt_id
  ), transition as (
    select s.*,
      case when s.transition_kind = 'rollback'
        then public.site_content_current_transition_source_release_id(s.active_transition_receipt_id)
        else s.active_release_id end head_release_id,
      s.transition_kind in ('activation','rollback')
        or (s.transition_kind = 'bootstrap' and not s.initialized and s.change_epoch = 0 and s.served_change_epoch = 0)
        as valid
    from state s
  ), active_records as (
    select rr.* from public.site_content_release_records rr join active_release r on r.id = rr.release_id
  ), head_records as (
    select rr.* from public.site_content_release_records rr join transition s on s.head_release_id = rr.release_id
  ), outstanding_heads as (
    select h.* from public.site_content_public_records h cross join transition s
    where h.head_change_epoch > s.served_change_epoch
  ), base as (
    select public.site_content_health_operational_base() payload
  ), integrity as (
    select
      s.valid
      and coalesce(r.expected_record_count = (select count(*) from active_records), false)
      and coalesce(r.expected_tombstone_count = (select count(*) from active_records where tombstone), false)
      and not exists (select 1 from active_records where record is null or render_payload is null)
      and not exists (
        select 1 from active_records rr
        left join public.site_content_publications p on p.id = rr.target_publication_id
        where rr.target_publication_id is not null and (
          p.id is null or p.logical_id <> rr.logical_id
          or p.record is distinct from rr.record or p.render_payload is distinct from rr.render_payload
          or p.retired is distinct from rr.tombstone))
      and not exists (
        select 1 from public.site_content_public_records h
        left join head_records rr on rr.target_publication_id = h.current_publication_id
          and rr.logical_id = h.logical_id
        where h.head_change_epoch <= s.served_change_epoch
          and (rr.logical_id is null or h.retired is distinct from rr.tombstone))
      and not exists (
        select 1 from head_records rr
        left join public.site_content_public_records h on h.logical_id = rr.logical_id
        where rr.target_publication_id is not null and (
          h.logical_id is null or (h.head_change_epoch <= s.served_change_epoch and (
            h.current_publication_id is distinct from rr.target_publication_id
            or h.retired is distinct from rr.tombstone))))
      as population_complete,
      s.valid and coalesce(r.release_digest = public.site_content_release_digest(r.id)
        and s.active_release_digest = r.release_digest
        and public.site_content_provider_free_checks_pass(r.id), false) release_digest_valid,
      s.valid and coalesce(r.dynamic_state_digest = public.site_content_dynamic_state_digest(r.id), false)
        dynamic_digest_valid,
      s.valid and not exists (
        select 1 from active_records rr
        left join public.site_content_publications p on p.id = rr.target_publication_id
        where rr.target_publication_id is not null and (
          p.id is null or p.published_by is null
          or not exists (select 1 from auth.users u where u.id = p.published_by)
          or p.administrator_authorized_at > p.created_at
          or p.administrator_authorization_version <> 'site-content-admin-authorization-v1'))
      and (r.reconciliation_plan_digest is null or exists (
        select 1 from public.site_content_reconciliation_plans rp
        where rp.plan_digest = r.reconciliation_plan_digest
          and rp.reviewed_by is not null
          and exists (select 1 from auth.users u where u.id = rp.reviewed_by)
          and rp.reviewed_at = rp.administrator_authorized_at
          and rp.administrator_authorization_version = 'site-content-admin-authorization-v1'))
        administrator_attestation_valid,
      s.valid and not exists (
        select 1 from active_records rr where not rr.tombstone and rr.public_visible and (
          rr.record->>'sourceStatus' is null or rr.record->>'sourceStatus' not in ('current','review_due')
          or rr.record->>'validationStatus' is null
          or rr.record->>'validationStatus' not in ('locally_reviewed','approved')))
        governance_valid
    from transition s left join active_release r on true
  ), projected as (
    select b.payload || jsonb_build_object(
      'activePublicSiteRelease', case when not s.valid or r.id is null then null else jsonb_build_object(
        'version','clinical-kb-site-release-v1',
        'releaseId',r.id::text,
        'registryVersion',r.registry_version,
        'staticManifestDigest',r.static_manifest_digest,
        'dynamicStateDigest',r.dynamic_state_digest,
        'releaseDigest',r.release_digest,
        'state',r.state,
        'activatedAt',case
          when s.transition_kind = 'rollback' then tr.created_at
          when s.transition_kind = 'bootstrap' then coalesce(r.activated_at, r.created_at)
          else r.activated_at
        end
      ) end,
      'publicSiteChangeEpoch',s.change_epoch::text,
      'populationComplete',i.population_complete,
      'releaseDigestValid',i.release_digest_valid,
      'dynamicDigestValid',i.dynamic_digest_valid,
      'administratorAttestationValid',i.administrator_attestation_valid,
      'governanceValid',i.governance_valid,
      'pendingSetExact',s.valid and coalesce((b.payload->>'pendingSetExact')::boolean, false),
      'outstandingHeadCountAgrees',s.valid and coalesce((b.payload->>'outstandingHeadCountAgrees')::boolean, false),
      'timeIntegrityValid',s.valid and coalesce((b.payload->>'timeIntegrityValid')::boolean, false),
      'lastActivation',case when s.transition_kind = 'rollback' then tr.created_at else r.activated_at end,
      'rollbackAvailable',s.transition_kind = 'activation'
        and coalesce((b.payload->>'rollbackAvailable')::boolean, false)
        and not exists (select 1 from public.site_content_releases candidate where candidate.state = 'candidate')
        and not exists (select 1 from outstanding_heads)
        and not exists (select 1 from public.site_content_public_records h where h.pending_event_sequence is not null)
        and not exists (select 1 from public.site_content_sync_events e
          where e.state in ('pending','retry_pending','processing','ready'))
    ) result
    from base b cross join transition s left join active_release r on true
    left join transition_receipt tr on true cross join integrity i
  )
  select result from projected;
$$;

revoke all on function public.read_site_content_public_records(text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.read_site_content_public_records(text, text) to anon, authenticated, service_role;
revoke all on function public.activate_site_content_release(uuid, text, bigint, text, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.activate_site_content_release(uuid, text, bigint, text, jsonb) to service_role;
revoke all on function public.rollback_site_content_release(uuid, uuid, text, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.rollback_site_content_release(uuid, uuid, text, jsonb) to service_role;
revoke all on function public.read_site_content_health()
  from public, anon, authenticated, service_role;
grant execute on function public.read_site_content_health() to service_role;
alter function public.site_content_health_operational_base() owner to postgres;
alter function public.read_site_content_public_records(text, text) owner to postgres;
alter function public.activate_site_content_release(uuid, text, bigint, text, jsonb) owner to postgres;
alter function public.rollback_site_content_release(uuid, uuid, text, jsonb) owner to postgres;
alter function public.read_site_content_health() owner to postgres;

commit;
