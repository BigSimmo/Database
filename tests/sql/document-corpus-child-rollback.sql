-- Execute with psql ON_ERROR_STOP against an empty disposable schema replay.
-- Pre-existing and newly generated ownerless artifacts are not owned by the activation.
\set ON_ERROR_STOP on
begin;
set local statement_timeout = '60s';
create function pg_temp.assert_true(ok boolean, message text) returns void
language plpgsql as $$ begin
  if ok is distinct from true then raise exception '%', message; end if;
end $$;
select pg_temp.assert_true(not exists (select 1 from public.documents), 'requires an empty disposable database');
insert into auth.users(id) values
  ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
insert into public.documents(id, owner_id, title, file_name, file_type, storage_path, status)
select id, id, 'Synthetic rollback', 'fixture.txt', 'text/plain', 'synthetic/' || id, 'indexed' from auth.users;
insert into public.document_labels(document_id, owner_id, label, label_type) values
  ('11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'owned', 'custom'),
  ('11111111-1111-4111-8111-111111111111', null, 'pre-existing', 'custom'),
  ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'mismatch', 'custom');
insert into public.document_summaries(document_id, owner_id, summary) values
  ('11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'owned'),
  ('22222222-2222-4222-8222-222222222222', null, 'pre-existing');
insert into public.document_table_facts(document_id, owner_id, row_label) values
  ('11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'owned'),
  ('11111111-1111-4111-8111-111111111111', null, 'pre-existing');
set local role service_role;
select public.set_document_corpus_access_mode('public');
reset role;
select pg_temp.assert_true((select owner_id = '22222222-2222-4222-8222-222222222222'::uuid
  from public.document_labels where label = 'mismatch'), 'publication must preserve mismatched ownership');
-- A replaced summary has a new identity; rollback must not claim it for the old owner.
delete from public.document_summaries where summary = 'owned';
insert into public.document_summaries(document_id, owner_id, summary)
values ('11111111-1111-4111-8111-111111111111', null, 'replacement');
insert into public.document_labels(document_id, owner_id, label, label_type) values
  ('11111111-1111-4111-8111-111111111111', null, 'new-ownerless', 'custom'),
  ('11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'later-owned', 'custom');
insert into public.document_table_facts(document_id, owner_id, row_label)
values ('11111111-1111-4111-8111-111111111111', null, 'new-ownerless');
set local role service_role;
select public.set_document_corpus_access_mode('public');
select public.set_document_corpus_access_mode('private');
reset role;
select pg_temp.assert_true(not exists (
  select 1 from public.document_labels where label in ('pre-existing', 'new-ownerless') and owner_id is not null
  union all select 1 from public.document_summaries where owner_id is not null
  union all select 1 from public.document_table_facts where row_label in ('pre-existing', 'new-ownerless') and owner_id is not null
), 'rollback reassigned a pre-existing, replaced, or newly generated ownerless child');
select pg_temp.assert_true((select count(*) = 2 from public.document_labels
  where label in ('owned', 'later-owned') and owner_id = document_id), 'both publication calls must retain their changed identities');
select pg_temp.assert_true((select owner_id = document_id from public.document_table_facts where row_label = 'owned'),
  'the actual published table fact must be restored');
select pg_temp.assert_true((select owner_id = '22222222-2222-4222-8222-222222222222'::uuid
  from public.document_labels where label = 'mismatch'), 'rollback must preserve mismatched ownership');
rollback;
\echo CORPUS_CHILD_ROLLBACK_PASS: original ownerless, new ownerless, replaced identities, repeated activation, mismatch
