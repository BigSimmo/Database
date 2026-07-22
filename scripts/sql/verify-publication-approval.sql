begin;

insert into auth.users (id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'publication-owner@example.invalid', '', now(), now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'publication-operator@example.invalid', '', now(), now())
on conflict (id) do nothing;

insert into public.documents (id, owner_id, title, file_name, file_type, storage_path, status)
values
  ('10000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Approved fixture', 'approved.pdf', 'application/pdf', 'fixtures/approved.pdf', 'indexed'),
  ('10000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Private fixture', 'private.pdf', 'application/pdf', 'fixtures/private.pdf', 'indexed'),
  ('10000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Quarantine fixture', 'quarantine.pdf', 'application/pdf', 'fixtures/quarantine.pdf', 'indexed'),
  ('10000000-0000-4000-8000-000000000004', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Unapproved fixture', 'unapproved.pdf', 'application/pdf', 'fixtures/unapproved.pdf', 'indexed'),
  ('10000000-0000-4000-8000-000000000006', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Post-review mutation fixture', 'changed.pdf', 'application/pdf', 'fixtures/changed.pdf', 'indexed');

insert into public.document_labels (document_id, owner_id, label, label_type, source)
values ('10000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'publication fixture', 'custom', 'manual');

insert into public.document_publication_approvals (
  document_id, expected_prior_owner_id, approving_operator_id, decision, reason, evidence_references,
  manifest_digest, reviewed_state_digest
)
values
  ('10000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'approved', 'Approved publication fixture.', array['fixture:approved'], repeat('a', 64), public.document_publication_state_digest('10000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')),
  ('10000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'keep_private', 'Private publication fixture.', array['fixture:private'], repeat('a', 64), public.document_publication_state_digest('10000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')),
  ('10000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'quarantine', 'Quarantine publication fixture.', array['fixture:quarantine'], repeat('a', 64), public.document_publication_state_digest('10000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')),
  ('10000000-0000-4000-8000-000000000006', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'approved', 'Mutation protection fixture.', array['fixture:changed'], repeat('b', 64), public.document_publication_state_digest('10000000-0000-4000-8000-000000000006', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'));

select public.publish_approved_documents(
  jsonb_build_array(jsonb_build_object(
    'document_id', '10000000-0000-4000-8000-000000000001',
    'expected_owner_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'expected_state_digest', public.document_publication_state_digest('10000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  )),
  repeat('a', 64),
  1
);

do $$
begin
  if not exists (
    select 1 from public.documents
    where id = '10000000-0000-4000-8000-000000000001'
      and owner_id is null
      and metadata->>'publication_manifest_digest' = repeat('a', 64)
  ) then raise exception 'approved publication fixture was not published'; end if;
  if not exists (
    select 1 from public.document_labels
    where document_id = '10000000-0000-4000-8000-000000000001' and owner_id is null
  ) then raise exception 'approved publication artifact owner was not updated'; end if;
  if exists (
    select 1 from public.documents
    where id in ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003')
      and owner_id is null
  ) then raise exception 'private or quarantine publication fixture was published'; end if;

  update public.documents
  set title = 'Changed after approval'
  where id = '10000000-0000-4000-8000-000000000006';
  begin
    perform public.publish_approved_documents(
      jsonb_build_array(jsonb_build_object(
        'document_id', '10000000-0000-4000-8000-000000000006',
        'expected_owner_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'expected_state_digest', (
          select reviewed_state_digest from public.document_publication_approvals
          where document_id = '10000000-0000-4000-8000-000000000006'
        )
      )),
      repeat('b', 64),
      1
    );
    raise exception 'post-review document mutation unexpectedly published';
  exception when others then
    if sqlerrm = 'post-review document mutation unexpectedly published' then raise; end if;
    if sqlerrm not like 'publication document % changed after review' then raise; end if;
  end;

  begin
    update public.documents
    set owner_id = null, metadata = metadata || jsonb_build_object('public_corpus', true)
    where id = '10000000-0000-4000-8000-000000000004';
    raise exception 'unapproved publication fixture unexpectedly published';
  exception when others then
    if sqlerrm = 'unapproved publication fixture unexpectedly published' then raise; end if;
  end;

  begin
    insert into public.documents (id, owner_id, title, file_name, file_type, storage_path, status)
    values (
      '10000000-0000-4000-8000-000000000005',
      null,
      'Direct public insert fixture',
      'direct-public.pdf',
      'application/pdf',
      'fixtures/direct-public.pdf',
      'indexed'
    );
    raise exception 'direct public document insert unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'direct public document insert unexpectedly succeeded' then raise; end if;
    if sqlstate <> 'P0001'
      or sqlerrm <> 'public documents must be created as owned rows before approved publication' then
      raise;
    end if;
  end;

  begin
    insert into public.document_publication_approvals (
      document_id, expected_prior_owner_id, approving_operator_id, decision, reason, evidence_references,
      manifest_digest, reviewed_state_digest
    ) values (
      '10000000-0000-4000-8000-000000000001',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'quarantine',
      'Contradictory decision fixture.',
      array['fixture:contradictory'],
      repeat('a', 64),
      repeat('c', 64)
    );
    raise exception 'contradictory publication approval unexpectedly succeeded';
  exception when unique_violation then
    null;
  end;

  begin
    update public.document_publication_approvals set reason = 'mutated'
    where document_id = '10000000-0000-4000-8000-000000000001';
    raise exception 'publication approval ledger unexpectedly allowed mutation';
  exception when others then
    if sqlerrm = 'publication approval ledger unexpectedly allowed mutation' then raise; end if;
  end;
end $$;

rollback;
