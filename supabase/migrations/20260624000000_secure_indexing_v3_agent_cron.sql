create or replace function public.invoke_indexing_v3_agent(p_limit integer default 3)
returns bigint
language plpgsql
security definer
set search_path = public, extensions, vault, pg_temp
as $$
declare
  v_request_id bigint;
  v_secret text;
begin
  select decrypted_secret
    into v_secret
  from vault.decrypted_secrets
  where name = 'indexing_v3_agent_secret'
  limit 1;

  if nullif(v_secret, '') is null then
    raise exception 'indexing_v3_agent_secret is missing from Supabase Vault';
  end if;

  select net.http_post(
    url := 'https://sjrfecxgysukkwxsowpy.supabase.co/functions/v1/indexing-v3-agent?limit=' || greatest(1, least(coalesce(p_limit, 3), 10))::text,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-indexing-agent-secret', v_secret
    ),
    body := jsonb_build_object('source', 'pg_cron', 'worker', 'v3-indexing-worker', 'ts', now()),
    timeout_milliseconds := 60000
  ) into v_request_id;

  return v_request_id;
end;
$$;
