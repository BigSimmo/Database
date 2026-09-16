-- Let the kind filter reach the scan in read_site_content_public_records.
--
-- WHY. Registry search (Forms, Medications, Services) reads this function once per domain per
-- search. Between 2026-09-09 and 2026-09-16 every one of those reads outran the 2500 ms budget
-- universal-search gives a domain, so all three came back as errored empty groups and catalogue
-- search returned nothing on the live site for seven days
-- (docs/audit/2026-09-16-registry-search-outage.md).
--
-- THE MECHANISM. `classified` computed kind as `coalesce(p.kind, case ...)` over a column from the
-- NULLABLE side of a left join to site_content_publications, and only the next CTE filtered on it.
-- A predicate over the nullable side cannot be pushed beneath the join, so every call built the
-- entire active release across all five kinds and then discarded four of them. Asking for one form
-- cost the whole catalogue.
--
-- THE CHANGE. Split the classification into the two cases the table constraints already guarantee
-- are the only ones, so the filter sits where it can be pushed down:
--
--   1. target_publication_id is not null. The foreign key (target_publication_id, logical_id) ->
--      site_content_publications (id, logical_id) guarantees the publication row exists, and
--      publications.kind is NOT NULL, so the left join was always a match and the coalesce always
--      resolved to p.kind. Written as an inner join, `p.kind = p_kind` is a predicate on the inner
--      relation and reaches the scan.
--   2. target_publication_id is null. The old WHERE admitted this only for the bootstrap release,
--      where no publication row exists, so kind and slug came from the logical-id prefix. That
--      derivation is a prefix map, so it is expressed as a prefix test rather than a case.
--
-- EQUIVALENCE. Proven two ways before this was written. From the constraints above, and by
-- executing both definitions side by side on Postgres 16 across 224 (scenario, kind, slug)
-- combinations — the four release/transition states, every valid kind plus an invalid one plus
-- null, and slugs including LIKE metacharacters, an apostrophe, an empty slug, a missing slug, a
-- publication whose kind deliberately disagrees with its logical-id prefix, tombstoned and hidden
-- records, and a bootstrap logical id matching no prefix. Row for row identical in every case.
--
-- NOT MEASURED. The reasoning above is read from the SQL and the constraints, not from a plan.
-- scripts/operator-explain-site-content-public-records.sql is the read-only EXPLAIN that confirms
-- it on real data and has not been run. Nothing here builds an index or rewrites a table: it is a
-- single transactional function replacement.
--
-- HOW TO UNDO IT, precisely. Reverting this FILE does not undo anything: once merged, the
-- integration records version 20260916103000 as applied, so deleting the file leaves the live
-- function exactly as this migration left it and re-adding 20260830121000 will not re-run. Undoing
-- it means a NEW forward migration carrying the previous definition verbatim — copy the function
-- body from 20260830121000_bind_site_content_release_transitions.sql — and updating
-- supabase/schema.sql to match in the same change.

set local search_path = public, pg_catalog;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

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
      and rr.release_id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid
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
        when s.active_release_id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid then 'unavailable'
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
