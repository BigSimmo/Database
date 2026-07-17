-- Audit logs are retained indefinitely for clinical governance. Historical writes
-- included user-controlled document names/titles and content hashes in metadata,
-- which could preserve patient identifiers after the source document was renamed
-- or deleted. Keep the immutable event/resource record but remove free text and
-- retain only operational facts needed for audit triage.

update public.audit_logs
set metadata = case action
  when 'document_upload' then jsonb_strip_nulls(jsonb_build_object(
    'fileType', case when jsonb_typeof(metadata -> 'fileType') = 'string' then metadata -> 'fileType' end,
    'fileSize', case when jsonb_typeof(metadata -> 'fileSize') = 'number' then metadata -> 'fileSize' end
  ))
  when 'document_delete' then jsonb_strip_nulls(jsonb_build_object(
    'storageRemoved', case when jsonb_typeof(metadata -> 'storageRemoved') = 'boolean' then metadata -> 'storageRemoved' end
  ))
  else '{}'::jsonb
end
where metadata <> '{}'::jsonb;

do $$
declare
  unsafe_metadata_count integer;
begin
  select count(*) into unsafe_metadata_count
  from public.audit_logs
  where metadata ?| array['fileName', 'contentHash', 'previousTitle', 'newTitle', 'title'];

  if unsafe_metadata_count > 0 then
    raise exception 'audit-log metadata minimization incomplete: % rows still contain user-controlled document text', unsafe_metadata_count;
  end if;
end $$;
