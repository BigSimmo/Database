-- Run with psql ON_ERROR_STOP against a disposable database replayed from schema.sql.
-- Synthetic fixtures and every mutation roll back, including on connection failure.
\set ON_ERROR_STOP on
begin;
set local statement_timeout = '120s';

create function pg_temp.assert_true(ok boolean, message text) returns void
language plpgsql as $$ begin
  if ok is distinct from true then raise exception '%', message; end if;
end $$;
grant execute on function pg_temp.assert_true(boolean, text) to service_role;
select pg_temp.assert_true(not exists (select 1 from public.documents), 'requires an empty disposable database');

insert into auth.users(id) values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');
insert into public.documents(id, owner_id, title, file_name, file_type, storage_path, status)
select id, id, 'Synthetic corpus test', 'fixture.txt', 'text/plain', 'synthetic/' || id, 'indexed'
from auth.users where id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222');
insert into public.document_labels(document_id, owner_id, label, label_type)
select id, owner_id, 'fixture', 'custom' from public.documents;
insert into public.document_summaries(document_id, owner_id, summary)
select id, owner_id, 'Synthetic summary' from public.documents;
insert into public.document_table_facts(document_id, owner_id, row_label)
select id, owner_id, 'Synthetic table fact' from public.documents;
insert into public.document_sections(document_id, owner_id, section_index, heading)
select id, owner_id, 0, 'Synthetic section' from public.documents;

set local role service_role;
select public.set_document_corpus_access_mode('public');
select pg_temp.assert_true(not exists (
  select 1 from public.documents where owner_id is not null
  union all select 1 from public.document_labels where owner_id is not null
  union all select 1 from public.document_summaries where owner_id is not null
  union all select 1 from public.document_table_facts where owner_id is not null
), 'publication must align parents and retrieval-scoped children');
select pg_temp.assert_true((select count(*) = 2 from public.document_sections where owner_id is not null),
  'parent-scoped children must retain their owners');
select public.set_document_corpus_access_mode('private');
select pg_temp.assert_true(not exists (
  select 1 from public.documents where owner_id is distinct from id
  union all select 1 from public.document_labels where owner_id is distinct from document_id
  union all select 1 from public.document_summaries where owner_id is distinct from document_id
  union all select 1 from public.document_table_facts where owner_id is distinct from document_id
), 'private mode must restore surviving parent and child owners');
reset role;

-- Exercise the real 200000-row ceiling; do not substitute a smaller function constant.
insert into public.document_labels(document_id, owner_id, label, label_type)
select '22222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222',
  'ceiling-' || n, 'custom' from generate_series(1, 200001) n;
set local role service_role;
do $$ begin
  begin
    perform public.set_document_corpus_access_mode('public');
    raise exception 'public flip above row ceiling unexpectedly succeeded';
  exception when program_limit_exceeded then null;
  end;
end $$;
select pg_temp.assert_true((select mode = 'private' from public.document_corpus_access_state where singleton),
  'refused publication must preserve private state');
select pg_temp.assert_true(not exists (select 1 from public.documents where owner_id is null),
  'refused publication must roll back parent ownership');
reset role;
delete from public.document_labels where label like 'ceiling-%';

set local role service_role;
select public.set_document_corpus_access_mode('public');
reset role;
insert into public.document_labels(document_id, owner_id, label, label_type)
select '22222222-2222-4222-8222-222222222222', null, 'ceiling-' || n, 'custom'
from generate_series(1, 200001) n;
set local role service_role;
do $$ begin
  begin
    perform public.set_document_corpus_access_mode('private');
    raise exception 'private flip above row ceiling unexpectedly succeeded';
  exception when program_limit_exceeded then null;
  end;
end $$;
select pg_temp.assert_true((select mode = 'public' from public.document_corpus_access_state where singleton),
  'refused restoration must preserve public state');
reset role;
delete from public.document_labels where label like 'ceiling-%';

delete from auth.users where id = '11111111-1111-4111-8111-111111111111';
set local role service_role;
select public.set_document_corpus_access_mode('private');
select pg_temp.assert_true((select owner_id is null and status = 'failed'
  and not (metadata ? 'public_corpus') from public.documents
  where id = '11111111-1111-4111-8111-111111111111'), 'deleted owner must be quarantined');
select pg_temp.assert_true((select owner_id = id from public.documents
  where id = '22222222-2222-4222-8222-222222222222'), 'surviving owner must still restore');
select pg_temp.assert_true(not exists (
  select 1 from public.document_labels where document_id = '11111111-1111-4111-8111-111111111111' and owner_id is not null
), 'deleted child owner must not be resurrected');
rollback;
\echo CORPUS_ACCESS_SQL_PASS: publication, restoration, both row ceilings, deleted-owner quarantine
