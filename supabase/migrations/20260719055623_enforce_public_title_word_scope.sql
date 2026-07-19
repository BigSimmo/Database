-- Remove historical private/non-indexed title vocabulary and make the public
-- scope an enforced database invariant.
--
-- 20260714180000 populated document_title_words from every indexed document.
-- 20260717171000 made future document-trigger writes public-only, but its
-- ON CONFLICT backfill did not remove the already-present private rows. The
-- SECURITY DEFINER corrector reads this table directly, so those rows remained
-- observable through query correction.

set lock_timeout = '5s';
set statement_timeout = '60s';

alter table public.document_title_words enable row level security;
revoke all on table public.document_title_words from public, anon, authenticated;
grant select, insert, update, delete on table public.document_title_words to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.document_title_words'::pg_catalog.regclass
      and conname = 'document_title_words_word_length'
  ) then
    alter table public.document_title_words
      add constraint document_title_words_word_length
      check (pg_catalog.length(word) between 4 and 40) not valid;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.document_title_words'::pg_catalog.regclass
      and conname = 'document_title_words_lowercase'
  ) then
    alter table public.document_title_words
      add constraint document_title_words_lowercase
      check (word = pg_catalog.lower(word)) not valid;
  end if;
end;
$$;
create or replace function public.enforce_document_title_word_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1
  from public.documents d
  where d.id = new.document_id
    and d.owner_id is null
    and d.status = 'indexed'
    and pg_catalog.length(new.word) between 4 and 40
    and new.word = any (
      pg_catalog.regexp_split_to_array(pg_catalog.lower(d.title), '[^a-z]+')
    )
  for share;

  if not found then
    raise exception 'document_title_words rows require a current indexed public document title'
      using errcode = '23514';
  end if;

  return new;
end;
$$;
revoke execute on function public.enforce_document_title_word_scope()
  from public, anon, authenticated, service_role;

drop trigger if exists document_title_words_enforce_public_scope
  on public.document_title_words;
create trigger document_title_words_enforce_public_scope
  before insert or update on public.document_title_words
  for each row execute function public.enforce_document_title_word_scope();

-- Purge every legacy row that is no longer an exact word from a current,
-- indexed, null-owner document title. This removes private/non-indexed rows as
-- well as any stale word left by historical trigger behavior.
delete from public.document_title_words dtw
where not exists (
  select 1
  from public.documents d
  where d.id = dtw.document_id
    and d.owner_id is null
    and d.status = 'indexed'
    and pg_catalog.length(dtw.word) between 4 and 40
    and dtw.word = any (
      pg_catalog.regexp_split_to_array(pg_catalog.lower(d.title), '[^a-z]+')
    )
);

-- Repair any missing public vocabulary rows after cleanup. The scope trigger
-- above validates each inserted row before it can become visible.
insert into public.document_title_words (word, document_id)
select distinct pg_catalog.lower(title_word), d.id
from public.documents d
cross join lateral pg_catalog.unnest(
  pg_catalog.regexp_split_to_array(pg_catalog.lower(d.title), '[^a-z]+')
) as title_word
where d.owner_id is null
  and d.status = 'indexed'
  and pg_catalog.length(title_word) between 4 and 40
on conflict do nothing;

alter table public.document_title_words
  validate constraint document_title_words_word_length;
alter table public.document_title_words
  validate constraint document_title_words_lowercase;

do $$
begin
  if exists (
    select 1
    from public.document_title_words dtw
    where not exists (
      select 1
      from public.documents d
      where d.id = dtw.document_id
        and d.owner_id is null
        and d.status = 'indexed'
        and pg_catalog.length(dtw.word) between 4 and 40
        and dtw.word = any (
          pg_catalog.regexp_split_to_array(pg_catalog.lower(d.title), '[^a-z]+')
        )
    )
  ) then
    raise exception 'document_title_words contains rows outside the indexed public title corpus'
      using errcode = '23514';
  end if;
end;
$$;

-- Preserve the trigger-function and corrector privilege posture established by
-- the earlier hardening migrations.
revoke execute on function public.sync_document_title_words()
  from public, anon, authenticated, service_role;
revoke execute on function public.correct_clinical_query_terms(text, real)
  from public, anon, authenticated;
grant execute on function public.correct_clinical_query_terms(text, real)
  to service_role;

-- The immediately preceding repair establishes this fail-closed default-ACL
-- invariant. This migration creates a function, so reassert it before commit.
do $$
declare
  v_status jsonb;
begin
  v_status := public.default_privileges_status('postgres', 'public');
  if not coalesce((v_status->>'safe')::boolean, false) then
    raise exception using
      errcode = '42501',
      message = 'Unsafe postgres default privileges in schema public; title-word privacy migration blocked.',
      detail = v_status::text,
<<<<<<<< HEAD:supabase/migrations/20260719053533_enforce_public_title_word_scope.sql
      hint = 'Reapply migration 20260719053532_repair_postgres_default_privileges, then retry.';
========
      hint = 'Reapply migration 20260719055609_repair_postgres_default_privileges, then retry.';
>>>>>>>> origin/main:supabase/migrations/20260719055623_enforce_public_title_word_scope.sql
  end if;
end;
$$;
