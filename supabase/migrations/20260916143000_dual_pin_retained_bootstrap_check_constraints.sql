-- Dual-pin retained-bootstrap CHECK constraints and
-- read_site_content_public_records bootstrap predicates (#2820), widened to
-- the retained triple-pin set during merge with #2821 so this earlier version
-- cannot narrow away ddc94ecf if applied beside
-- 20260916160000_triple_pin_retained_bootstrap_release_ids.sql.
--
-- WHY. #2814 refreshed the epoch-zero population and re-keyed the content-addressed
-- release id from e4a1dd29-14f6-556c-8fb7-f4f947d8b846 to
-- 91ceaa8d-470c-5661-8ce6-980c2a1bb137 across schema.sql and the historical
-- bootstrap migration text. #2821 later re-keyed again onto
-- ddc94ecf-3527-5b4d-846b-af5724b428ca. An applied migration is not re-run, so
-- live may still carry e4a1dd29 and/or 91ceaa8d pins in:
--   - site_content_release_records_check1
--   - site_content_sync_state_transition_pointer_check
--   - read_site_content_public_records (from 20260916103000)
-- while a freshly replayed schema seeds ddc94ecf. See issue #2820 and
-- src/lib/site-content/site-content-health.ts (RETAINED_BOOTSTRAP_RELEASE_IDS).
--
-- THE CHANGE. Widen both CHECKs and the three bootstrap predicates inside
-- read_site_content_public_records to accept any of the three retained
-- bootstrap identities (union / triple-pin), matching the health probe.
-- Existing live rows with e4a1dd29 / 91ceaa8d continue to satisfy; a freshly
-- replayed schema that seeds ddc94ecf also satisfies. No data rewrite.
--
-- LOCKS. Both ALTER TABLE pairs take ACCESS EXCLUSIVE. Bounded local lock and
-- statement timeouts fail and roll back a busy deploy instead of waiting
-- forever (same pattern as 20260901120000_restrict_owner_delete_on_public_visibility_tables.sql).
--
-- HOW TO UNDO IT, precisely. Reverting this FILE does not undo anything: once
-- merged, the integration records version 20260916143000 as applied, so deleting
-- the file leaves the live CHECKs and function exactly as this migration left
-- them. Undoing it means a NEW forward migration that restores the prior
-- single-pin CHECK defs and the prior read_site_content_public_records body
-- (copy from 20260916103000), and updating supabase/schema.sql to match in the
-- same change.
--
-- NOT DONE HERE. This does not re-key live data onto ddc94ecf and does not edit
-- applied historical migrations.

set local search_path = public, pg_catalog;
set local lock_timeout = '10s';
set local statement_timeout = '120s';

alter table public.site_content_release_records
  drop constraint site_content_release_records_check1;

alter table public.site_content_release_records
  add constraint site_content_release_records_check1 check (
    (
      target_publication_id is null
      and (
        release_id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid
        or release_id = '91ceaa8d-470c-5661-8ce6-980c2a1bb137'::uuid
        or release_id = 'ddc94ecf-3527-5b4d-846b-af5724b428ca'::uuid
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
        or active_release_id = 'ddc94ecf-3527-5b4d-846b-af5724b428ca'::uuid
      )
      and served_change_epoch = 0
      and active_transition_receipt_id is null
    )
    or (initialized and active_transition_receipt_id is not null)
  );

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
          and (r.id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid or r.id = '91ceaa8d-470c-5661-8ce6-980c2a1bb137'::uuid or r.id = 'ddc94ecf-3527-5b4d-846b-af5724b428ca'::uuid)
          and r.target_change_epoch = 0
          and r.release_digest = public.site_content_bootstrap_digest(r.id))
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
      and (rr.release_id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid or rr.release_id = '91ceaa8d-470c-5661-8ce6-980c2a1bb137'::uuid or rr.release_id = 'ddc94ecf-3527-5b4d-846b-af5724b428ca'::uuid)
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
        when (s.active_release_id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid or s.active_release_id = '91ceaa8d-470c-5661-8ce6-980c2a1bb137'::uuid or s.active_release_id = 'ddc94ecf-3527-5b4d-846b-af5724b428ca'::uuid) then 'unavailable'
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
