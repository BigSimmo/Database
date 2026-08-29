\set ON_ERROR_STOP on

do $$
declare
  v_state public.site_content_sync_state%rowtype;
  v_source_epoch bigint;
  v_health jsonb;
  v_collection integer;
  v_affected integer;
begin
  select * into strict v_state from public.site_content_sync_state where singleton;
  select source.target_change_epoch into strict v_source_epoch
  from public.site_content_release_receipts rollback
  join public.site_content_release_receipts activation
    on activation.receipt_id = rollback.receipt->>'activationReceiptId'
  join public.site_content_releases source on source.id = activation.release_id
  where rollback.receipt_id = v_state.active_transition_receipt_id;

  if not v_state.initialized
    or v_state.change_epoch <> 3
    or v_state.served_change_epoch <> 2
    or v_source_epoch <> 2
    or public.site_content_current_transition_kind(
      v_state.active_transition_receipt_id,v_state.active_release_id,
      v_state.active_release_digest,v_state.initialized,v_state.served_change_epoch
    ) <> 'rollback'
  then
    raise exception 'control_plane_highest_epoch_rollback_backfill_invalid';
  end if;

  v_health := public.read_site_content_health();
  if v_health->>'publicSiteChangeEpoch' <> '3'
    or v_health->>'pendingCount' <> '1'
    or v_health->>'pendingSetExact' <> 'true'
    or v_health->>'rollbackAvailable' <> 'false'
  then
    raise exception 'control_plane_later_publication_health_invalid';
  end if;

  select count(*) filter (where record is not null) into v_collection
  from public.read_site_content_public_records('service',null);
  select count(*) filter (where record is not null) into v_affected
  from public.read_site_content_public_records('service','backfill-pending');
  if v_collection <> 0 or v_affected <> 0 then
    raise exception 'control_plane_backfilled_pending_reader_not_fail_closed';
  end if;
end;
$$;

\echo 'PASS site-content transition backfill assertions'
