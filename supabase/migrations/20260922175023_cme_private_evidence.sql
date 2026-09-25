-- Private portfolio evidence is separate from clinical ingestion and service handbooks.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table public.cme_evidence (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  entry_id uuid not null,
  file_name text not null check (length(file_name) between 1 and 180),
  content_type text not null check (content_type in ('application/pdf','image/jpeg','image/png')),
  byte_size integer not null check (byte_size between 1 and 10485760),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  storage_path text not null unique,
  kind text not null check (kind in ('certificate','receipt','assessment','other')),
  redaction_confirmed boolean not null check (redaction_confirmed),
  preview_confirmed boolean not null check (preview_confirmed),
  uploaded_at timestamptz not null default now(),
  unique (entry_id, sha256),
  foreign key (entry_id, owner_id) references public.cme_entries(id, owner_id) on delete restrict,
  check (storage_path = owner_id::text || '/' || entry_id::text || '/' || id::text)
);
create index cme_evidence_owner_entry_idx on public.cme_evidence(owner_id, entry_id);
alter table public.cme_evidence enable row level security;
revoke all on public.cme_evidence from public, anon, authenticated;
grant select, insert on public.cme_evidence to service_role;

create function public.cme_guard_evidence_insert() returns trigger
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
  if (select count(*) from public.cme_evidence where owner_id=new.owner_id and entry_id=new.entry_id) >= 20 then
    raise exception 'cme_evidence_limit';
  end if;
  return new;
end $$;
revoke execute on function public.cme_guard_evidence_insert() from public, anon, authenticated;
grant execute on function public.cme_guard_evidence_insert() to service_role;
create trigger cme_evidence_insert_guard before insert on public.cme_evidence
  for each row execute function public.cme_guard_evidence_insert();

create function public.cme_evidence_counts(p_owner_id uuid, p_year integer) returns jsonb
language sql stable security invoker set search_path = public, pg_temp as $$
  select coalesce(jsonb_object_agg(entry_id, evidence_count), '{}'::jsonb)
  from (
    select e.id as entry_id, count(a.id) as evidence_count
    from public.cme_entries e join public.cme_years y on y.id=e.year_id and y.owner_id=p_owner_id
    left join public.cme_evidence a on a.entry_id=e.id and a.owner_id=p_owner_id
    where e.owner_id=p_owner_id and y.year=p_year group by e.id
  ) counts
$$;
revoke execute on function public.cme_evidence_counts(uuid,integer) from public, anon, authenticated;
grant execute on function public.cme_evidence_counts(uuid,integer) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('cme-private-evidence','cme-private-evidence',false,10485760,array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;
-- Even an unrelated permissive storage policy must not expose portfolio objects.
create policy cme_evidence_no_direct_access on storage.objects as restrictive
  for all to anon, authenticated
  using (bucket_id <> 'cme-private-evidence') with check (bucket_id <> 'cme-private-evidence');
