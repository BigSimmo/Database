-- Bind every new publication decision to the exact document and committed
-- artifact state that the operator reviewed. Historical approvals remain
-- readable but cannot be used for a new publication because they have no
-- reviewed_state_digest.

alter table public.document_publication_approvals
  add column if not exists reviewed_state_digest text;

alter table public.document_publication_approvals
  drop constraint if exists document_publication_approvals_reviewed_state_digest_format;
alter table public.document_publication_approvals
  add constraint document_publication_approvals_reviewed_state_digest_format
  check (reviewed_state_digest is null or reviewed_state_digest ~ '^[0-9a-f]{64}$');

create or replace function public.document_publication_state_digest(
  p_document_id uuid,
  p_expected_owner_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'document', to_jsonb(d) - array['owner_id', 'created_at', 'updated_at', 'search_tsv', 'title_search_tsv'],
          'pages', coalesce((
            select jsonb_agg(to_jsonb(p) - array['created_at', 'updated_at'] order by p.page_number, p.id)
            from public.document_pages p where p.document_id = d.id
          ), '[]'::jsonb),
          'images', coalesce((
            select jsonb_agg(to_jsonb(i) - array['created_at', 'updated_at'] order by i.page_number nulls last, i.id)
            from public.document_images i
            where i.document_id = d.id
              and (
                nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '') is null
                or public.is_committed_artifact_generation(i.metadata, d.metadata)
              )
          ), '[]'::jsonb),
          'labels', coalesce((
            select jsonb_agg(to_jsonb(l) - array['owner_id', 'created_at', 'updated_at'] order by l.id)
            from public.document_labels l where l.document_id = d.id
          ), '[]'::jsonb),
          'summaries', coalesce((
            select jsonb_agg(to_jsonb(s) - array['owner_id', 'created_at', 'updated_at'] order by s.id)
            from public.document_summaries s where s.document_id = d.id
          ), '[]'::jsonb),
          'sections', coalesce((
            select jsonb_agg(to_jsonb(s) - array['owner_id', 'created_at', 'updated_at'] order by s.section_index, s.id)
            from public.document_sections s
            where s.document_id = d.id
              and public.is_committed_artifact_generation(s.metadata, d.metadata)
          ), '[]'::jsonb),
          'memory_cards', coalesce((
            select jsonb_agg(
              to_jsonb(m) - array['owner_id', 'embedding', 'search_tsv', 'created_at', 'updated_at']
              order by m.id
            )
            from public.document_memory_cards m
            where m.document_id = d.id
              and (
                nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '') is null
                or public.is_committed_artifact_generation(m.metadata, d.metadata)
              )
          ), '[]'::jsonb),
          'chunks', coalesce((
            select jsonb_agg(to_jsonb(c) - array['embedding', 'search_tsv', 'created_at'] order by c.chunk_index, c.id)
            from public.document_chunks c
            where c.document_id = d.id
              and (
                public.is_committed_document_generation(c.index_generation_id, d.index_generation_id)
                or nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '') is null
                or public.is_committed_artifact_generation(c.metadata, d.metadata)
              )
          ), '[]'::jsonb),
          'table_facts', coalesce((
            select jsonb_agg(to_jsonb(f) - array['owner_id', 'search_tsv', 'created_at'] order by f.id)
            from public.document_table_facts f
            where f.document_id = d.id
              and (
                nullif(coalesce(d.metadata, '{}'::jsonb)->>'index_generation_id', '') is null
                or public.is_committed_artifact_generation(f.metadata, d.metadata)
              )
          ), '[]'::jsonb),
          'embedding_fields', coalesce((
            select jsonb_agg(
              to_jsonb(f) - array['owner_id', 'embedding', 'search_tsv', 'created_at']
              order by f.id
            )
            from public.document_embedding_fields f
            where f.document_id = d.id
              and public.is_committed_artifact_generation(f.metadata, d.metadata)
          ), '[]'::jsonb),
          'index_quality', coalesce((
            select to_jsonb(q) - array['owner_id', 'updated_at']
            from public.document_index_quality q where q.document_id = d.id
          ), '{}'::jsonb),
          'index_units', coalesce((
            select jsonb_agg(
              to_jsonb(u) - array['owner_id', 'embedding', 'search_tsv', 'created_at', 'updated_at']
              order by u.id
            )
            from public.document_index_units u
            where u.document_id = d.id
              and public.is_committed_artifact_generation(u.metadata, d.metadata)
          ), '[]'::jsonb)
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )
  from public.documents d
  where d.id = p_document_id
    and d.owner_id = p_expected_owner_id;
$$;

revoke all on function public.document_publication_state_digest(uuid, uuid) from public, anon, authenticated;
grant execute on function public.document_publication_state_digest(uuid, uuid) to service_role;

create or replace function public.require_document_publication_approval_state_digest()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.reviewed_state_digest is null then
    raise exception 'publication approval requires a reviewed content/state digest';
  end if;
  return new;
end;
$$;

revoke all on function public.require_document_publication_approval_state_digest() from public, anon, authenticated;

drop trigger if exists document_publication_approvals_require_state_digest on public.document_publication_approvals;
create trigger document_publication_approvals_require_state_digest
before insert on public.document_publication_approvals
for each row execute function public.require_document_publication_approval_state_digest();

create or replace function public.guard_document_publication_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_approval_id uuid;
  v_manifest_digest text;
  v_reviewed_state_digest text;
  v_current_state_digest text;
begin
  if tg_op = 'INSERT' then
    if new.owner_id is null then
      raise exception 'public documents must be created as owned rows before approved publication';
    end if;
    return new;
  end if;

  if old.owner_id is not null and new.owner_id is null then
    begin
      v_approval_id := nullif(new.metadata->>'publication_approval_id', '')::uuid;
    exception when invalid_text_representation then
      raise exception 'public document transition has an invalid publication approval id';
    end;
    v_manifest_digest := lower(coalesce(new.metadata->>'publication_manifest_digest', ''));
    v_reviewed_state_digest := lower(coalesce(new.metadata->>'publication_reviewed_state_digest', ''));

    if v_approval_id is null
      or v_manifest_digest !~ '^[0-9a-f]{64}$'
      or v_reviewed_state_digest !~ '^[0-9a-f]{64}$' then
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
        and approval.reviewed_state_digest = v_reviewed_state_digest
    ) then
      raise exception 'public document transition approval does not match the reviewed document state';
    end if;

    perform 1 from public.document_pages where document_id = old.id for update;
    perform 1 from public.document_images where document_id = old.id for update;
    perform 1 from public.document_labels where document_id = old.id for update;
    perform 1 from public.document_summaries where document_id = old.id for update;
    perform 1 from public.document_sections where document_id = old.id for update;
    perform 1 from public.document_memory_cards where document_id = old.id for update;
    perform 1 from public.document_chunks where document_id = old.id for update;
    perform 1 from public.document_table_facts where document_id = old.id for update;
    perform 1 from public.document_embedding_fields where document_id = old.id for update;
    perform 1 from public.document_index_quality where document_id = old.id for update;
    perform 1 from public.document_index_units where document_id = old.id for update;

    begin
      perform 1 from public.ingestion_jobs where document_id = old.id for update nowait;
      perform 1 from public.indexing_v3_agent_jobs where document_id = old.id for update nowait;
    exception when lock_not_available then
      raise exception 'public document transition has active ingestion work';
    end;
    if exists (
      select 1 from public.ingestion_jobs
      where document_id = old.id and status in ('pending', 'processing')
    ) or exists (
      select 1 from public.indexing_v3_agent_jobs
      where document_id = old.id
        and status not in ('completed', 'needs_enrichment_artifacts')
        and enrichment_status in ('pending', 'failed', 'processing')
        and attempt_count < max_attempts
    ) then
      raise exception 'public document transition has active ingestion work';
    end if;

    v_current_state_digest := public.document_publication_state_digest(old.id, old.owner_id);
    if v_current_state_digest is distinct from v_reviewed_state_digest then
      raise exception 'public document transition content changed after review';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_document_publication_transition() from public, anon, authenticated;

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
  v_expected_state_digest text;
  v_current_state_digest text;
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
    v_expected_state_digest := lower(coalesce(v_entry->>'expected_state_digest', ''));
    if v_document_id is null or v_expected_owner_id is null then
      raise exception 'publication manifest requires document_id and expected_owner_id';
    end if;
    if v_expected_state_digest !~ '^[0-9a-f]{64}$' then
      raise exception 'publication manifest requires expected_state_digest';
    end if;

    -- This row lock serializes title/metadata/status updates, committed index
    -- generation swaps, and new child rows (their foreign-key checks take a
    -- conflicting key-share lock). Existing child rows are locked below before
    -- the state digest is recomputed.
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
      raise exception 'publication document % has active ingestion work', v_document_id;
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
      raise exception 'publication document % has active ingestion work', v_document_id;
    end if;

    select approval.id into v_approval_id
    from public.document_publication_approvals approval
    where approval.document_id = v_document_id
      and approval.expected_prior_owner_id = v_expected_owner_id
      and approval.decision = 'approved'
      and approval.manifest_digest = v_manifest_digest
      and approval.reviewed_state_digest = v_expected_state_digest
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

    v_current_state_digest := public.document_publication_state_digest(v_document_id, v_expected_owner_id);
    if v_current_state_digest is distinct from v_expected_state_digest then
      raise exception 'publication document % changed after review', v_document_id;
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
          'publication_reviewed_state_digest', v_expected_state_digest,
          'published_at', now()
        ),
        updated_at = now()
    where id = v_document_id;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'document_id', v_document_id,
      'previous_owner_id', v_expected_owner_id,
      'approval_id', v_approval_id,
      'reviewed_state_digest', v_expected_state_digest,
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
