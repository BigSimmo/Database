-- migration_history_versions(): a service-role-only read of the applied
-- migration version list, for `npm run check:migration-history`.
--
-- WHY: the live-drift workflow's "Align migration history for Supabase Preview"
-- step (scripts/check-migration-history-alignment.ts, added by Phase 0 in
-- PR #1939) reads supabase_migrations.schema_migrations directly through
-- PostgREST with `Accept-Profile: supabase_migrations`. This project has never
-- exposed that schema to the Data API, so the read can only ever fail:
--
--   status 406 {"code":"PGRST106", ... "message":"Invalid schema: supabase_migrations"}
--
-- The step had never actually run before 2026-08-19: on every earlier run the
-- drift comparison failed first and this step was skipped. Phase 6.2 closed the
-- last drift finding, the comparison went green for the first time since
-- 2026-07-26 (run 32251326536), and this latent defect surfaced as the sole
-- reason the job still concludes `failure` — which keeps pinned issue #1963
-- open and makes a green database look red. Evidence:
-- docs/audit/live-drift-forensics-2026-08.md, Phase 6.2 step 6.
--
-- WHY THIS SHAPE, and not the two alternatives:
-- * Exposing `supabase_migrations` to PostgREST would widen the public Data API
--   surface of a clinical project for one weekly CI read, and lives in dashboard
--   configuration rather than in git.
-- * Routing the read through the management API would put an account-scoped
--   Supabase access token into CI secrets — far broader authority than the read
--   requires.
--   A security-definer function granted to service_role alone is least
--   privilege, is already the established pattern here
--   (public.schema_drift_snapshot(), 20260706200000 / 20260818090000), and uses
--   the transport CI already holds a key for.
--
-- Read-only: one select over the CLI history table. Returns every applied
-- version, unlike schema_drift_snapshot()'s `migration_history`, which returns
-- only the rows recorded WITHOUT executed statements. The two are complementary
-- and neither replaces the other.
--
-- Read via dynamic SQL because search_path is pinned to '' and the schema does
-- not exist in the drift-manifest replay container (`npm run drift:manifest`) —
-- same pattern as the storage.buckets and history blocks of 20260818090000.
-- There the absence is reported honestly as `no_history_table` rather than as an
-- empty-but-fine result.

create or replace function public.migration_history_versions()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  versions jsonb := '[]'::jsonb;
  probe text := 'no_history_table';
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    execute 'select coalesce(jsonb_agg(jsonb_build_object('
      || '''version'', m.version, ''name'', m.name'
      || ') order by m.version), ''[]''::jsonb) '
      || 'from supabase_migrations.schema_migrations m'
      into versions;
    probe := 'ok';
  end if;

  return jsonb_build_object(
    'probe', probe,
    'versions', versions
  );
end;
$$;

revoke execute on function public.migration_history_versions() from public, anon, authenticated;
grant execute on function public.migration_history_versions() to service_role;
