-- Owner-requested removal of CME evidence, with a recorded reason.
-- A file uploaded by mistake (for example one still carrying a patient identifier) could not be
-- taken out of the private portfolio at all. Removal keeps a tombstone row — when, and the
-- owner's reason — and the API then deletes the stored object. It is allowed in a closed year
-- and on an archived entry, because the reason to remove a file is privacy, not bookkeeping.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.cme_evidence
  add column removed_at timestamptz,
  add column removal_reason text,
  add constraint cme_evidence_removal_recorded check (
    (removed_at is null and removal_reason is null)
    or (removed_at is not null and length(btrim(removal_reason)) between 3 and 500)
  );

-- A removed file must not stop the same file being attached again once it has been checked, so
-- uniqueness applies only to files still attached.
alter table public.cme_evidence drop constraint cme_evidence_entry_id_sha256_key;
create unique index cme_evidence_active_entry_sha256_key
  on public.cme_evidence(entry_id, sha256) where removed_at is null;

-- The server may record a removal on these three columns and nothing else.
grant update (removed_at, removal_reason, file_name) on public.cme_evidence to service_role;

-- The 20-file limit counts files still attached.
create or replace function public.cme_guard_evidence_insert() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_entry public.cme_entries%rowtype; v_closed timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text, 23092026));
  select * into v_entry from public.cme_entries where id=new.entry_id and owner_id=new.owner_id;
  if not found then raise exception 'cme_evidence_entry_not_found'; end if;
  select closed_at into v_closed from public.cme_years where id=v_entry.year_id and owner_id=new.owner_id for update;
  if not found or v_closed is not null or v_entry.archived_at is not null then
    raise exception 'cme_evidence_entry_not_writable';
  end if;
  if (select count(*) from public.cme_evidence
      where owner_id=new.owner_id and entry_id=new.entry_id and removed_at is null) >= 20 then
    raise exception 'cme_evidence_limit';
  end if;
  return new;
end $$;

-- Evidence counts on the log count files still attached.
create or replace function public.cme_evidence_counts(p_owner_id uuid, p_year integer) returns jsonb
language sql stable security invoker set search_path = public, pg_temp as $$
  select coalesce(jsonb_object_agg(entry_id, evidence_count), '{}'::jsonb)
  from (
    select e.id as entry_id, count(a.id) as evidence_count
    from public.cme_entries e join public.cme_years y on y.id=e.year_id and y.owner_id=p_owner_id
    left join public.cme_evidence a on a.entry_id=e.id and a.owner_id=p_owner_id and a.removed_at is null
    where e.owner_id=p_owner_id and y.year=p_year group by e.id
  ) counts
$$;

create function public.cme_remove_evidence(p_owner_id uuid, p_evidence_id uuid, p_reason text)
returns public.cme_evidence
language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_row public.cme_evidence%rowtype;
begin
  if p_reason is null or length(btrim(p_reason)) not between 3 and 500 then
    raise exception 'cme_evidence_removal_reason_invalid';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_owner_id::text, 23092026));
  update public.cme_evidence
     set removed_at = now(), removal_reason = btrim(p_reason), file_name = 'Removed file'
   where id = p_evidence_id and owner_id = p_owner_id and removed_at is null
  returning * into v_row;
  if not found then raise exception 'cme_evidence_not_found'; end if;
  return v_row;
end $$;
revoke execute on function public.cme_remove_evidence(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.cme_remove_evidence(uuid,uuid,text) to service_role;
