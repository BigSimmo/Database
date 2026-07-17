-- Bootstrap safe supabase_admin future-object defaults before migrations in
-- fresh local and preview databases. Existing hosted databases are not
-- changed by ordinary migration deployment and remain protected by the final
-- fail-closed catalog assertion.

alter default privileges for role supabase_admin
  revoke all privileges on tables from anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public
  revoke all privileges on tables from anon, authenticated, service_role;

alter default privileges for role supabase_admin
  revoke all privileges on sequences from anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public
  revoke all privileges on sequences from anon, authenticated, service_role;

alter default privileges for role supabase_admin
  revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public
  revoke execute on functions from public, anon, authenticated, service_role;

alter default privileges for role supabase_admin in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges for role supabase_admin in schema public
  grant usage, select on sequences to service_role;
alter default privileges for role supabase_admin in schema public
  grant execute on functions to service_role;
