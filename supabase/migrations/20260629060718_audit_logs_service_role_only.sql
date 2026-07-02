set search_path = public, pg_catalog, pg_temp;

-- audit_logs is written and read only via the service role (server-side). Remove the
-- authenticated read path so the table is not discoverable in the GraphQL schema and
-- the trail stays internal/tamper-resistant. RLS remains enabled with no policies, so
-- anon/authenticated get no access; the service role bypasses RLS.
drop policy if exists "audit_logs owner read" on public.audit_logs;
revoke select on public.audit_logs from authenticated;
