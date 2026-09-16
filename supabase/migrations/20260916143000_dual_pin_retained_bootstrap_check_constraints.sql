-- Dual-pin the two retained-bootstrap CHECK constraints (#2820).
--
-- WHY. #2814 refreshed the epoch-zero population and re-keyed the content-addressed
-- release id from e4a1dd29-14f6-556c-8fb7-f4f947d8b846 to
-- 91ceaa8d-470c-5661-8ce6-980c2a1bb137 across schema.sql and the historical
-- bootstrap migration text. An applied migration is not re-run, so live still
-- carries the e4a1dd29 pins in:
--   - site_content_release_records_check1
--   - site_content_sync_state_transition_pointer_check
-- while the drift manifest (replayed from schema.sql) pinned only 91ceaa8d.
-- live-drift.yml therefore reported UNEXPECTED DRIFT (2) with migration history
-- otherwise aligned (246=246). See issue #2820 and
-- src/lib/site-content/site-content-health.ts (RETAINED_BOOTSTRAP_RELEASE_IDS).
--
-- THE CHANGE. Widen both CHECKs to accept either retained bootstrap identity,
-- matching the health probe's dual recognition. Existing live rows with
-- e4a1dd29 continue to satisfy the constraint; a freshly replayed schema that
-- seeds 91ceaa8d also satisfies it. No data rewrite.
--
-- NOT DONE HERE. This does not re-key live data onto 91ceaa8d, does not edit
-- applied historical migrations, and does not touch function bodies that still
-- mention one id or the other for bootstrap-path predicates.

alter table public.site_content_release_records
  drop constraint site_content_release_records_check1;

alter table public.site_content_release_records
  add constraint site_content_release_records_check1 check (
    (
      target_publication_id is null
      and (
        release_id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid
        or release_id = '91ceaa8d-470c-5661-8ce6-980c2a1bb137'::uuid
      )
      and jsonb_typeof(record) = 'object'
      and jsonb_typeof(render_payload) = 'object'
    )
    or (
      target_publication_id is not null
      and jsonb_typeof(record) = 'object'
      and jsonb_typeof(render_payload) = 'object'
    )
  );

alter table public.site_content_sync_state
  drop constraint site_content_sync_state_transition_pointer_check;

alter table public.site_content_sync_state
  add constraint site_content_sync_state_transition_pointer_check check (
    (
      not initialized
      and (
        active_release_id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid
        or active_release_id = '91ceaa8d-470c-5661-8ce6-980c2a1bb137'::uuid
      )
      and served_change_epoch = 0
      and active_transition_receipt_id is null
    )
    or (initialized and active_transition_receipt_id is not null)
  );
