revoke all privileges on table public.rag_response_cache from anon, authenticated;
grant all on table public.rag_response_cache to service_role;

drop policy if exists "rag response cache service role all" on public.rag_response_cache;
create policy "rag response cache service role all" on public.rag_response_cache
  for all to service_role
  using (true)
  with check (true);

revoke execute on function public.search_schema_health() from public, anon, authenticated;
grant execute on function public.search_schema_health() to service_role;
