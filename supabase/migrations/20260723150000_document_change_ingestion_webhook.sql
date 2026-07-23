create or replace function public.notify_document_change_ingestion_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault, pg_temp
as $$
declare
  v_secret   text;
  v_base_url text;
begin
  -- Fire only when the JSON boolean changes to true. Strings such as "true"
  -- are deliberately not actionable and malformed values never raise.
  if new.metadata->'reindex_requested' = 'true'::jsonb
     and new.metadata->'reindex_requested' is distinct from old.metadata->'reindex_requested'
  then
    -- Actionable.
  else
    return new;
  end if;

  -- Missing environment configuration must leave the document write intact.
  select decrypted_secret
    into v_secret
  from vault.decrypted_secrets
  where name = 'ingestion_webhook_secret'
  limit 1;

  if nullif(v_secret, '') is null then
    return new;
  end if;

  -- Required per environment. There is intentionally no production fallback:
  -- a local or staging replay must never post document metadata to production.
  v_base_url := nullif(current_setting('app.ingestion_webhook_base_url', true), '');
  if v_base_url is null then
    return new;
  end if;

  perform net.http_post(
    url := rtrim(v_base_url, '/') || '/api/webhooks/supabase/document-change',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    -- Send only the receiver's allowlisted fields. In particular, do not send
    -- file names, storage paths, content hashes, or the complete old/new rows.
    body := jsonb_build_object(
      'type', tg_op,
      'table', tg_table_name,
      'schema', tg_table_schema,
      'record', jsonb_build_object(
        'id', new.id,
        'owner_id', new.owner_id,
        'status', new.status,
        'metadata', jsonb_build_object(
          'reindex_requested', new.metadata -> 'reindex_requested'
        )
      )
    ),
    timeout_milliseconds := 5000
  );

  return new;
exception
  when others then
    -- Webhook configuration or delivery failure must never abort the write.
    raise warning 'notify_document_change_ingestion_webhook failed: %', sqlerrm;
    return new;
end;
$$;

revoke execute on function public.notify_document_change_ingestion_webhook()
  from public, anon, authenticated;

drop trigger if exists documents_ingestion_webhook on public.documents;
create trigger documents_ingestion_webhook
  after update of metadata on public.documents
  for each row execute function public.notify_document_change_ingestion_webhook();
