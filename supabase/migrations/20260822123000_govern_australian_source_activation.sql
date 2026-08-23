-- Bind Australian public-source activation to the exact policy, document
-- state, and committed index generation reviewed by the operator. The new
-- approval fields are nullable so historical approvals remain readable, but
-- the insert/transition guards make those historical rows unusable for a new
-- Australian activation.

alter table public.document_publication_approvals
  add column if not exists source_catalogue_key text,
  add column if not exists source_policy_version text,
  add column if not exists reviewed_index_generation_id uuid;

alter table public.document_publication_approvals
  drop constraint if exists document_publication_approvals_source_catalogue_key_format;
alter table public.document_publication_approvals
  add constraint document_publication_approvals_source_catalogue_key_format
  check (
    source_catalogue_key is null
    or char_length(trim(source_catalogue_key)) between 1 and 100
  );

alter table public.document_publication_approvals
  drop constraint if exists document_publication_approvals_source_policy_version;
alter table public.document_publication_approvals
  add constraint document_publication_approvals_source_policy_version
  check (
    source_policy_version is null
    or source_policy_version = 'australian-source-policy-v1'
  );

alter table public.document_publication_approvals
  drop constraint if exists document_publication_approvals_v2_fields_coherent;
alter table public.document_publication_approvals
  add constraint document_publication_approvals_v2_fields_coherent
  check (
    (source_catalogue_key is null and source_policy_version is null and reviewed_index_generation_id is null)
    or
    (source_catalogue_key is not null and source_policy_version is not null and reviewed_index_generation_id is not null)
  );

create or replace function public.require_document_publication_approval_state_digest()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_document public.documents%rowtype;
begin
  if new.reviewed_state_digest is null then
    raise exception 'publication approval requires a reviewed content/state digest';
  end if;

  select * into v_document
  from public.documents
  where id = new.document_id;

  if found and v_document.metadata->>'corpus_scope' = 'australian_public' then
    if v_document.status <> 'indexed'
      or v_document.metadata->>'source_kind' is distinct from 'document'
      or nullif(trim(v_document.metadata->>'publisher'), '') is null
      or nullif(trim(v_document.metadata->>'publisher_code'), '') is null
      or nullif(trim(v_document.metadata->>'jurisdiction'), '') is null
      or nullif(trim(v_document.metadata->>'source_role'), '') is null then
      raise exception 'Australian public approval requires exact document identity metadata';
    end if;
    if new.source_catalogue_key is null
      or new.source_policy_version is null
      or new.reviewed_index_generation_id is null then
      raise exception 'Australian public approval requires manifest v2 policy and generation evidence';
    end if;
    if new.source_policy_version <> 'australian-source-policy-v1'
      or v_document.metadata->>'source_catalogue_key' is distinct from new.source_catalogue_key
      or v_document.metadata->>'source_policy_version' is distinct from new.source_policy_version
      or v_document.index_generation_id is distinct from new.reviewed_index_generation_id
      or v_document.metadata->>'content_mode' is distinct from 'indexed_content'
      or v_document.metadata->>'licence_policy' is distinct from 'public_index_permitted'
      or v_document.metadata->>'document_status' is distinct from 'current'
      or v_document.metadata->>'change_state' in ('withdrawn', 'superseded')
      or coalesce(v_document.metadata->>'change_state', '') not in ('changed', 'unchanged') then
      raise exception 'Australian public approval does not match document policy and committed generation';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.require_document_publication_approval_state_digest() from public, anon, authenticated;

drop trigger if exists document_publication_approvals_require_state_digest on public.document_publication_approvals;
create trigger document_publication_approvals_require_state_digest
before insert on public.document_publication_approvals
for each row execute function public.require_document_publication_approval_state_digest();

-- Reassert append-only and writer boundaries in the migration that widens the
-- approval row. Existing data remains selectable by service_role only.
alter table public.document_publication_approvals enable row level security;
revoke all on table public.document_publication_approvals from public, anon, authenticated;
grant select, insert on table public.document_publication_approvals to service_role;

drop policy if exists "document publication approvals service role" on public.document_publication_approvals;
create policy "document publication approvals service role"
  on public.document_publication_approvals for all to service_role using (true) with check (true);

drop trigger if exists document_publication_approvals_immutable on public.document_publication_approvals;
create trigger document_publication_approvals_immutable
before update or delete on public.document_publication_approvals
for each row execute function public.prevent_document_publication_approval_mutation();

create or replace function public.guard_australian_source_activation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_approval public.document_publication_approvals%rowtype;
  v_approval_id uuid;
  v_owned_public_activation boolean;
  v_public_relabel_activation boolean;
  v_same_scope_public_update boolean;
  v_v2_receipt_keys text[] := array['publication_manifest_version', 'publication_source_policy_version', 'publication_reviewed_index_generation_id'];
begin
  v_owned_public_activation := old.owner_id is not null
    and new.owner_id is null
    and (
      old.metadata->>'corpus_scope' = 'australian_public'
      or new.metadata->>'corpus_scope' = 'australian_public'
    );
  v_public_relabel_activation := old.owner_id is null
    and new.owner_id is null
    and old.metadata->>'corpus_scope' is distinct from 'australian_public'
    and new.metadata->>'corpus_scope' = 'australian_public';
  v_same_scope_public_update := old.owner_id is null
    and new.owner_id is null
    and old.metadata->>'corpus_scope' = 'australian_public'
    and new.metadata->>'corpus_scope' = 'australian_public';

  if v_same_scope_public_update then
    -- The activation RPC follows the ownership transition with one receipt
    -- enrichment update. Only these three v2 keys may differ: the five
    -- generic publication receipts and all reviewed state stay immutable.
    if new.index_generation_id is distinct from old.index_generation_id
      or (
        to_jsonb(new) - array['metadata', 'updated_at', 'search_tsv', 'title_search_tsv']
      ) is distinct from (
        to_jsonb(old) - array['metadata', 'updated_at', 'search_tsv', 'title_search_tsv']
      )
      or (new.metadata - v_v2_receipt_keys) is distinct from (old.metadata - v_v2_receipt_keys) then
      raise exception 'Australian public governed state changed; unpublish and reapprove';
    end if;
    if new.metadata->'publication_manifest_version' is distinct from '2'::jsonb
      or new.metadata->>'publication_source_policy_version' is distinct from new.metadata->>'source_policy_version'
      or new.metadata->>'publication_reviewed_index_generation_id' is distinct from new.index_generation_id::text then
      raise exception 'Australian public v2 receipt enrichment is invalid';
    end if;

    begin
      v_approval_id := nullif(new.metadata->>'publication_approval_id', '')::uuid;
    exception when invalid_text_representation then
      raise exception 'Australian public v2 receipt enrichment has an invalid approval id';
    end;
    select * into v_approval
    from public.document_publication_approvals
    where id = v_approval_id;
    if not found
      or v_approval.decision is distinct from 'approved'
      or v_approval.document_id is distinct from new.id
      or v_approval.manifest_digest is distinct from new.metadata->>'publication_manifest_digest'
      or v_approval.reviewed_state_digest is distinct from new.metadata->>'publication_reviewed_state_digest'
      or v_approval.source_catalogue_key is distinct from new.metadata->>'source_catalogue_key'
      or v_approval.source_policy_version is distinct from new.metadata->>'source_policy_version'
      or v_approval.reviewed_index_generation_id is distinct from new.index_generation_id then
      raise exception 'Australian public v2 receipt enrichment requires matching approved evidence';
    end if;
    return new;
  end if;

  if v_owned_public_activation or v_public_relabel_activation then
    -- This is an AFTER trigger so generated columns, especially the committed
    -- index generation, hold their final NEW values. Publication may change
    -- ownership, updated_at, and the five established publication receipt
    -- keys only; every reviewed document field remains byte-for-byte equal.
    if new.index_generation_id is distinct from old.index_generation_id
      or (
        to_jsonb(new) - array['owner_id', 'metadata', 'updated_at', 'search_tsv', 'title_search_tsv']
      ) is distinct from (
        to_jsonb(old) - array['owner_id', 'metadata', 'updated_at', 'search_tsv', 'title_search_tsv']
      )
      or (
        new.metadata - array[
          'public_corpus',
          'publication_approval_id',
          'publication_manifest_digest',
          'publication_reviewed_state_digest',
          'published_at'
        ]
      ) is distinct from (
        old.metadata - array[
          'public_corpus',
          'publication_approval_id',
          'publication_manifest_digest',
          'publication_reviewed_state_digest',
          'published_at'
        ]
      ) then
      raise exception 'Australian public activation changed document state after review';
    end if;
    if new.metadata->'public_corpus' is distinct from 'true'::jsonb then
      raise exception 'Australian public activation requires the public-corpus receipt';
    end if;
    if new.metadata->>'content_mode' = 'link_only' then
      raise exception 'Australian public transition rejects link-only content';
    end if;
    if new.metadata->>'source_kind' is distinct from 'document'
      or nullif(trim(new.metadata->>'publisher'), '') is null
      or nullif(trim(new.metadata->>'publisher_code'), '') is null
      or nullif(trim(new.metadata->>'jurisdiction'), '') is null
      or nullif(trim(new.metadata->>'source_role'), '') is null
      or new.metadata->>'content_mode' is distinct from 'indexed_content'
      or new.metadata->>'licence_policy' is distinct from 'public_index_permitted'
      or new.metadata->>'document_status' is distinct from 'current'
      or new.metadata->>'change_state' in ('withdrawn', 'superseded')
      or coalesce(new.metadata->>'change_state', '') not in ('changed', 'unchanged') then
      raise exception 'Australian public transition requires exact document identity and active, current, index-permitted content';
    end if;

    begin
      v_approval_id := nullif(new.metadata->>'publication_approval_id', '')::uuid;
    exception when invalid_text_representation then
      raise exception 'Australian public transition has an invalid approval id';
    end;
    if v_approval_id is null then
      raise exception 'Australian public transition requires manifest v2 evidence';
    end if;

    select * into v_approval
    from public.document_publication_approvals
    where id = v_approval_id;
    if not found
      or v_approval.decision is distinct from 'approved'
      or v_approval.source_catalogue_key is null
      or v_approval.source_policy_version is distinct from 'australian-source-policy-v1'
      or v_approval.reviewed_index_generation_id is null
      or v_approval.document_id is distinct from old.id
      or v_approval.expected_prior_owner_id is distinct from old.owner_id
      or v_approval.source_catalogue_key is distinct from new.metadata->>'source_catalogue_key'
      or v_approval.source_policy_version is distinct from new.metadata->>'source_policy_version'
      or v_approval.reviewed_index_generation_id is distinct from new.index_generation_id then
      raise exception 'Australian public transition requires manifest v2 evidence';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_australian_source_activation() from public, anon, authenticated;

drop trigger if exists documents_require_australian_source_activation on public.documents;
create trigger documents_require_australian_source_activation
after update on public.documents
for each row execute function public.guard_australian_source_activation();

-- publish_approved_documents remains the compatibility publication primitive.
-- The trigger above extends that path and fail-closes any v1 attempt against an
-- Australian document before owner_id can become null.

create or replace function public.activate_approved_public_documents(
  p_manifest jsonb,
  p_expected_state_digest text,
  p_expected_generation_ids uuid[]
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
  v_expected_index_generation_id uuid;
  v_expected_document_state_digest text;
  v_current_document_state_digest text;
  v_computed_state_digest text;
  v_source_catalogue_key text;
  v_source_policy_version text;
  v_decision text;
  v_approval public.document_publication_approvals%rowtype;
  v_manifest_digest text;
  v_approved_count integer := 0;
  v_document_count integer;
  v_publish_documents jsonb := '[]'::jsonb;
  v_activation_receipts jsonb := '[]'::jsonb;
  v_publish_result jsonb;
  v_evidence_references text[];
begin
  if jsonb_typeof(p_manifest) is distinct from 'object'
    or jsonb_typeof(p_manifest->'version') is distinct from 'number'
    or p_manifest->>'version' <> '2'
    or jsonb_typeof(p_manifest->'sourcePolicyVersion') is distinct from 'string'
    or p_manifest->>'sourcePolicyVersion' <> 'australian-source-policy-v1'
    or jsonb_typeof(p_manifest->'documents') is distinct from 'array'
    or jsonb_typeof(p_manifest->'evidenceReferences') is distinct from 'array' then
    raise exception 'Australian activation requires an exact manifest v2 object';
  end if;
  if char_length(trim(coalesce(p_manifest->>'reason', ''))) not between 3 and 2000 then
    raise exception 'Australian activation reason is missing or outside bounds';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_manifest->'evidenceReferences') evidence
    where jsonb_typeof(evidence) is distinct from 'string'
  ) then
    raise exception 'Australian activation evidence references must be strings';
  end if;
  begin
    perform nullif(p_manifest->>'approvingOperatorId', '')::uuid;
  exception when invalid_text_representation then
    raise exception 'Australian activation approving operator id is invalid';
  end;
  if nullif(p_manifest->>'approvingOperatorId', '') is null then
    raise exception 'Australian activation approving operator id is required';
  end if;

  select array_agg(value order by ordinality)
  into v_evidence_references
  from jsonb_array_elements_text(p_manifest->'evidenceReferences') with ordinality evidence(value, ordinality);
  if cardinality(v_evidence_references) not between 1 and 50
    or exists (
      select 1 from unnest(v_evidence_references) evidence
      where char_length(trim(evidence)) not between 1 and 500
    ) then
    raise exception 'Australian activation evidence references are missing or outside bounds';
  end if;

  v_document_count := jsonb_array_length(p_manifest->'documents');
  if v_document_count not between 1 and 500 then
    raise exception 'Australian activation document count is outside bounds';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_manifest->'documents') document
    group by document->>'documentId'
    having count(*) > 1
  ) then
    raise exception 'Australian activation manifest contains duplicate document ids';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_manifest->'documents') document
    where jsonb_typeof(document->'decision') is distinct from 'string'
      or document->>'decision' is null
      or document->>'decision' not in ('approved', 'keep_private', 'quarantine')
  ) then
    raise exception 'Australian activation manifest contains an invalid decision';
  end if;
  if p_expected_generation_ids is null
    or cardinality(p_expected_generation_ids) <> v_document_count then
    raise exception 'Australian activation expected generation ids do not match manifest cardinality';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_manifest->'documents') document
    where jsonb_typeof(document->'expectedIndexGenerationId') is distinct from 'string'
      or (document->>'expectedIndexGenerationId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) then
    raise exception 'Australian activation manifest contains an invalid generation id';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_manifest->'documents') document
    where jsonb_typeof(document->'expectedStateDigest') is distinct from 'string'
      or (document->>'expectedStateDigest') !~ '^[0-9a-f]{64}$'
  ) then
    raise exception 'Australian activation manifest contains an invalid state digest';
  end if;
  if (
    select array_agg(generation_id order by generation_id)
    from unnest(p_expected_generation_ids) generation_id
  ) is distinct from (
    select array_agg(
      (document->>'expectedIndexGenerationId')::uuid
      order by (document->>'expectedIndexGenerationId')::uuid
    )
    from jsonb_array_elements(p_manifest->'documents') document
  ) then
    raise exception 'Australian activation generation confirmation does not exactly match manifest';
  end if;
  if trim(coalesce(p_expected_state_digest, '')) !~ '^[0-9a-f]{64}$' then
    raise exception 'Australian activation expected state digest must be lowercase SHA-256';
  end if;

  select encode(
    extensions.digest(
      convert_to(
        string_agg(
          document->>'documentId' || ':' || document->>'expectedStateDigest',
          E'\n' order by document->>'documentId'
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )
  into v_computed_state_digest
  from jsonb_array_elements(p_manifest->'documents') document;
  if v_computed_state_digest is distinct from p_expected_state_digest then
    raise exception 'Australian activation reviewed-state set digest changed';
  end if;

  -- Stable lock order prevents overlapping batches with reversed manifest rows
  -- from acquiring document locks in opposite orders.
  for v_entry in
    select value
    from jsonb_array_elements(p_manifest->'documents')
    order by value->>'documentId'
  loop
    begin
      v_document_id := nullif(v_entry->>'documentId', '')::uuid;
      v_expected_owner_id := nullif(v_entry->>'expectedOwnerId', '')::uuid;
      v_expected_index_generation_id := nullif(v_entry->>'expectedIndexGenerationId', '')::uuid;
    exception when invalid_text_representation then
      raise exception 'Australian activation manifest contains an invalid document, owner, or generation id';
    end;
    v_expected_document_state_digest := coalesce(v_entry->>'expectedStateDigest', '');
    v_source_catalogue_key := trim(coalesce(v_entry->>'sourceCatalogueKey', ''));
    v_source_policy_version := p_manifest->>'sourcePolicyVersion';
    v_decision := v_entry->>'decision';

    if v_document_id is null or v_expected_owner_id is null or v_expected_index_generation_id is null then
      raise exception 'Australian activation manifest requires document, owner, and generation ids';
    end if;
    if jsonb_typeof(v_entry->'decision') is distinct from 'string'
      or v_decision is null
      or v_expected_document_state_digest !~ '^[0-9a-f]{64}$'
      or char_length(v_source_catalogue_key) not between 1 and 100
      or v_decision not in ('approved', 'keep_private', 'quarantine') then
      raise exception 'Australian activation manifest document fields are invalid';
    end if;
    if v_decision <> 'approved' then
      continue;
    end if;

    select * into v_document
    from public.documents
    where id = v_document_id
    for update;
    if not found then
      raise exception 'Australian activation document % was not found', v_document_id;
    end if;
    if v_document.owner_id is distinct from v_expected_owner_id
      or v_document.status <> 'indexed'
      or v_document.index_generation_id is distinct from v_expected_index_generation_id then
      raise exception 'Australian activation document % owner, index state, or committed generation changed', v_document_id;
    end if;
    if v_document.metadata->>'corpus_scope' is distinct from 'australian_public'
      or v_document.metadata->>'source_kind' is distinct from 'document'
      or nullif(trim(v_document.metadata->>'publisher'), '') is null
      or nullif(trim(v_document.metadata->>'publisher_code'), '') is null
      or nullif(trim(v_document.metadata->>'jurisdiction'), '') is null
      or nullif(trim(v_document.metadata->>'source_role'), '') is null
      or v_document.metadata->>'source_catalogue_key' is distinct from v_source_catalogue_key
      or v_document.metadata->>'source_policy_version' is distinct from v_source_policy_version
      or v_document.metadata->>'content_mode' is distinct from 'indexed_content'
      or v_document.metadata->>'licence_policy' is distinct from 'public_index_permitted'
      or v_document.metadata->>'document_status' is distinct from 'current'
      or v_document.metadata->>'change_state' in ('withdrawn', 'superseded')
      or coalesce(v_document.metadata->>'change_state', '') not in ('changed', 'unchanged') then
      raise exception 'Australian activation document % fails source identity, policy, or lifecycle gates', v_document_id;
    end if;

    perform 1 from public.document_pages where document_id = v_document_id for update;
    perform 1 from public.document_images where document_id = v_document_id for update;
    perform 1 from public.document_labels where document_id = v_document_id for update;
    perform 1 from public.document_summaries where document_id = v_document_id for update;
    perform 1 from public.document_sections where document_id = v_document_id for update;
    perform 1 from public.document_memory_cards where document_id = v_document_id for update;
    perform 1 from public.document_chunks where document_id = v_document_id for update;
    perform 1 from public.document_table_facts where document_id = v_document_id for update;
    perform 1 from public.document_embedding_fields where document_id = v_document_id for update;
    perform 1 from public.document_index_quality where document_id = v_document_id for update;
    perform 1 from public.document_index_units where document_id = v_document_id for update;

    begin
      perform 1 from public.ingestion_jobs where document_id = v_document_id for update nowait;
      perform 1 from public.indexing_v3_agent_jobs where document_id = v_document_id for update nowait;
    exception when lock_not_available then
      raise exception 'Australian activation document % has active ingestion work', v_document_id;
    end;
    if exists (
      select 1 from public.ingestion_jobs
      where document_id = v_document_id and status in ('pending', 'processing')
    ) or exists (
      select 1 from public.indexing_v3_agent_jobs
      where document_id = v_document_id
        and status not in ('completed', 'needs_enrichment_artifacts')
        and enrichment_status in ('pending', 'failed', 'processing')
        and attempt_count < max_attempts
    ) then
      raise exception 'Australian activation document % has active ingestion work', v_document_id;
    end if;

    v_current_document_state_digest := public.document_publication_state_digest(
      v_document_id,
      v_expected_owner_id
    );
    if v_current_document_state_digest is distinct from v_expected_document_state_digest then
      raise exception 'Australian activation document % changed after review', v_document_id;
    end if;

    select * into v_approval
    from public.document_publication_approvals approval
    where approval.document_id = v_document_id
      and approval.expected_prior_owner_id = v_expected_owner_id
      and approval.approving_operator_id = (p_manifest->>'approvingOperatorId')::uuid
      and approval.decision = 'approved'
      and approval.reason = trim(p_manifest->>'reason')
      and approval.evidence_references = v_evidence_references
      and approval.reviewed_state_digest = v_expected_document_state_digest
      and approval.reviewed_index_generation_id = v_expected_index_generation_id
      and approval.source_catalogue_key = v_source_catalogue_key
      and approval.source_policy_version = v_source_policy_version
    order by approval.approved_at desc, approval.id desc
    limit 1;
    if not found then
      raise exception 'Australian activation document % lacks matching approved v2 evidence', v_document_id;
    end if;
    if v_manifest_digest is null then
      v_manifest_digest := v_approval.manifest_digest;
    elsif v_manifest_digest is distinct from v_approval.manifest_digest then
      raise exception 'Australian activation approvals do not share one manifest digest';
    end if;

    v_publish_documents := v_publish_documents || jsonb_build_array(jsonb_build_object(
      'document_id', v_document_id,
      'expected_owner_id', v_expected_owner_id,
      'expected_state_digest', v_expected_document_state_digest
    ));
    v_activation_receipts := v_activation_receipts || jsonb_build_array(jsonb_build_object(
      'document_id', v_document_id,
      'approval_id', v_approval.id,
      'source_catalogue_key', v_source_catalogue_key,
      'source_policy_version', v_source_policy_version,
      'reviewed_state_digest', v_expected_document_state_digest,
      'index_generation_id', v_expected_index_generation_id,
      'outcome', 'validated_for_activation'
    ));
    v_approved_count := v_approved_count + 1;
  end loop;

  if v_approved_count = 0 then
    return jsonb_build_object(
      'source_policy_version', p_manifest->>'sourcePolicyVersion',
      'expected_state_digest', p_expected_state_digest,
      'expected_generation_ids', to_jsonb(p_expected_generation_ids),
      'published_count', 0,
      'documents', '[]'::jsonb
    );
  end if;

  v_publish_result := public.publish_approved_documents(
    v_publish_documents,
    v_manifest_digest,
    v_approved_count
  );

  update public.documents document
  set metadata = coalesce(document.metadata, '{}'::jsonb) || jsonb_build_object(
        'publication_manifest_version', 2,
        'publication_source_policy_version', p_manifest->>'sourcePolicyVersion',
        'publication_reviewed_index_generation_id', receipt.value->>'index_generation_id'
      ),
      updated_at = now()
  from jsonb_array_elements(v_activation_receipts) receipt(value)
  where document.id = (receipt.value->>'document_id')::uuid;

  return v_publish_result || jsonb_build_object(
    'source_policy_version', p_manifest->>'sourcePolicyVersion',
    'expected_state_digest', p_expected_state_digest,
    'expected_generation_ids', to_jsonb(p_expected_generation_ids),
    'activation_receipts', v_activation_receipts
  );
end;
$$;

revoke all on function public.activate_approved_public_documents(jsonb, text, uuid[]) from public, anon, authenticated;
grant execute on function public.activate_approved_public_documents(jsonb, text, uuid[]) to service_role;
