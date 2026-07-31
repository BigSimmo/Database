-- Make the title-word table's backend-only access explicit for the RLS advisor.
-- Browser roles remain denied by both table ACLs and the absence of a policy
-- addressed to them. The service role is the only direct table principal.

set lock_timeout = '5s';
set statement_timeout = '30s';

alter table public.document_title_words enable row level security;
revoke all on table public.document_title_words from public, anon, authenticated;
grant select, insert, update, delete on table public.document_title_words to service_role;

drop policy if exists "document title words service role all"
  on public.document_title_words;
create policy "document title words service role all"
  on public.document_title_words
  for all
  to service_role
  using (true)
  with check (true);
