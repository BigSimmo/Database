-- Require durable operator evidence before an owned document can enter the public corpus.
-- Historical public rows are deliberately left untouched for separate operator investigation.

create table if not exists public.document_publication_approvals (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  expected_prior_owner_id uuid not null,
  approving_operator_id uuid not null,
  decision text not null check (decision in ('approved', 'keep_private', 'quarantine')),
  reason text not null check (char_length(trim(reason)) between 3 and 2000),
  evidence_references text[] not null check (cardinality(evidence_references) > 0),
  manifest_digest text not null check (manifest_digest ~ '^[0-9a-f]{64}$'),
  approved_at timestamptz not null default now(),
  unique (document_id, expected_prior_owner_id, decision, manifest_digest)
);

create index if not exists document_publication_approvals_document_idx
  on public.document_publication_approvals(document_id, approved_at desc);

alter table public.document_publication_approvals enable row level security;
revoke all on table public.document_publication_approvals from public, anon, authenticated;
grant select, insert on table public.document_publication_approvals to service_role;

drop policy if exists "document publication approvals service role" on public.document_publication_approvals;
create policy "document publication approvals service role"
  on public.document_publication_approvals for all to service_role using (true) with check (true);

create or replace function public.prevent_document_publication_approval_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'document_publication_approvals is append-only';
end;
$$;

revoke all on function public.prevent_document_publication_approval_mutation() from public, anon, authenticated;

drop trigger if exists document_publication_approvals_immutable on public.document_publication_approvals;
create trigger document_publication_approvals_immutable
before update or delete on public.document_publication_approvals
for each row execute function public.prevent_document_publication_approval_mutation();

create or replace function public.guard_document_publication_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_approval_id uuid;
  v_manifest_digest text;
begin
  if old.owner_id is not null and new.owner_id is null then
    begin
      v_approval_id := nullif(new.metadata->>'publication_approval_id', '')::uuid;
    exception when invalid_text_representation then
      raise exception 'public document transition has an invalid publication approval id';
    end;
    v_manifest_digest := lower(coalesce(new.metadata->>'publication_manifest_digest', ''));

    if v_approval_id is null or v_manifest_digest !~ '^[0-9a-f]{64}$' then
      raise exception 'public document transition requires publication approval evidence';
    end if;

    if not exists (
      select 1
      from public.document_publication_approvals approval
      where approval.id = v_approval_id
        and approval.document_id = old.id
        and approval.expected_prior_owner_id = old.owner_id
        and approval.decision = 'approved'
        and approval.manifest_digest = v_manifest_digest
    ) then
      raise exception 'public document transition approval does not match the document, prior owner, decision, and manifest';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_document_publication_transition() from public, anon, authenticated;

drop trigger if exists documents_require_publication_approval on public.documents;
create trigger documents_require_publication_approval
before update of owner_id on public.documents
for each row execute function public.guard_document_publication_transition();

create or replace function public.publish_approved_documents(
  p_documents jsonb,
  p_manifest_digest text,
  p_expected_count integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry jsonb;
  v_document public.documents%rowtype;
  v_document_id uuid;
  v_expected_owner_id uuid;
  v_approval_id uuid;
  v_manifest_digest text := lower(trim(coalesce(p_manifest_digest, '')));
  v_count integer;
  v_results jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_documents) is distinct from 'array' then
    raise exception 'publication documents must be a JSON array';
  end if;
  if v_manifest_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'publication manifest digest must be a lowercase SHA-256 value';
  end if;

  v_count := jsonb_array_length(p_documents);
  if p_expected_count is null or p_expected_count < 1 or p_expected_count <> v_count then
    raise exception 'publication expected count % does not match manifest count %', p_expected_count, v_count;
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_documents) entry
    group by entry->>'document_id'
    having count(*) > 1
  ) then
    raise exception 'publication manifest contains duplicate document ids';
  end if;

  for v_entry in select value from jsonb_array_elements(p_documents)
  loop
    begin
      v_document_id := nullif(v_entry->>'document_id', '')::uuid;
      v_expected_owner_id := nullif(v_entry->>'expected_owner_id', '')::uuid;
    exception when invalid_text_representation then
      raise exception 'publication manifest contains an invalid document or owner id';
    end;
    if v_document_id is null or v_expected_owner_id is null then
      raise exception 'publication manifest requires document_id and expected_owner_id';
    end if;

    select * into v_document
    from public.documents
    where id = v_document_id
    for update;
    if not found then
      raise exception 'publication document % was not found', v_document_id;
    end if;
    if v_document.owner_id is distinct from v_expected_owner_id then
      raise exception 'publication document % owner changed from the manifest expectation', v_document_id;
    end if;
    if v_document.status <> 'indexed' then
      raise exception 'publication document % is not indexed', v_document_id;
    end if;

    select approval.id into v_approval_id
    from public.document_publication_approvals approval
    where approval.document_id = v_document_id
      and approval.expected_prior_owner_id = v_expected_owner_id
      and approval.decision = 'approved'
      and approval.manifest_digest = v_manifest_digest
    order by approval.approved_at desc, approval.id desc
    limit 1;
    if v_approval_id is null then
      raise exception 'publication document % lacks matching approved evidence', v_document_id;
    end if;

    if exists (
      select 1 from public.document_labels where document_id = v_document_id and owner_id is distinct from v_expected_owner_id
      union all select 1 from public.document_summaries where document_id = v_document_id and owner_id is distinct from v_expected_owner_id
      union all select 1 from public.document_sections where document_id = v_document_id and owner_id is distinct from v_expected_owner_id
      union all select 1 from public.document_memory_cards where document_id = v_document_id and owner_id is distinct from v_expected_owner_id
      union all select 1 from public.document_table_facts where document_id = v_document_id and owner_id is distinct from v_expected_owner_id
      union all select 1 from public.document_embedding_fields where document_id = v_document_id and owner_id is distinct from v_expected_owner_id
      union all select 1 from public.document_index_quality where document_id = v_document_id and owner_id is distinct from v_expected_owner_id
      union all select 1 from public.document_index_units where document_id = v_document_id and owner_id is distinct from v_expected_owner_id
    ) then
      raise exception 'publication document % has mismatched artifact ownership', v_document_id;
    end if;

    update public.document_labels set owner_id = null, updated_at = now() where document_id = v_document_id;
    update public.document_summaries set owner_id = null, updated_at = now() where document_id = v_document_id;
    update public.document_sections set owner_id = null, updated_at = now() where document_id = v_document_id;
    update public.document_memory_cards set owner_id = null, updated_at = now() where document_id = v_document_id;
    update public.document_table_facts set owner_id = null where document_id = v_document_id;
    update public.document_embedding_fields set owner_id = null where document_id = v_document_id;
    update public.document_index_quality set owner_id = null, updated_at = now() where document_id = v_document_id;
    update public.document_index_units set owner_id = null, updated_at = now() where document_id = v_document_id;

    update public.documents
    set owner_id = null,
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'public_corpus', true,
          'publication_approval_id', v_approval_id,
          'publication_manifest_digest', v_manifest_digest,
          'published_at', now()
        ),
        updated_at = now()
    where id = v_document_id;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'document_id', v_document_id,
      'previous_owner_id', v_expected_owner_id,
      'approval_id', v_approval_id,
      'outcome', 'published'
    ));
  end loop;

  return jsonb_build_object(
    'manifest_digest', v_manifest_digest,
    'published_count', v_count,
    'documents', v_results
  );
end;
$$;

revoke all on function public.publish_approved_documents(jsonb, text, integer) from public, anon, authenticated;
grant execute on function public.publish_approved_documents(jsonb, text, integer) to service_role;
