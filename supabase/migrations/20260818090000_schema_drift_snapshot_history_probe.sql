-- schema_drift_snapshot() v2: add the migration-history integrity probe.
--
-- Supersedes 20260706200000_schema_drift_snapshot.sql (same inventory, two new
-- keys). Plan of record: docs/database-remediation-plan.md phase 6.1; evidence
-- docs/audit/live-drift-forensics-2026-08.md sections 1.1 and 1.3.
--
-- WHY: supabase_migrations.schema_migrations rows whose `statements` column is
-- NULL or empty are the fingerprint of a history repair / mark-applied version —
-- a version recorded as applied whose DDL was never executed by the CLI (the
-- 2026-07-01..02 cluster and the 2026-07-12 batch in section 1.1). Until now the
-- drift check deliberately ignored history and compared object state only, so a
-- history repair without a validating guard migration was invisible until its
-- objects went missing. This probe returns those versions so `npm run check:drift`
-- can report every one that is not covered by a reviewed, guard-backed allowlist
-- entry (supabase/drift-allowlist.json, category `migration_history`). Section
-- 1.3 also shows migrations that DID record executed DDL yet whose indexes are
-- absent, so this probe is a second signal beside the object inventory, never a
-- replacement for it.
--
-- What changed vs v1:
-- * `snapshot_version` 1 -> 2.
-- * `migration_history`: jsonb array of {version, name, signal} for every row of
--   supabase_migrations.schema_migrations where statements IS NULL ('null') or
--   cardinality(statements) = 0 ('empty'), ordered by version.
-- * `migration_history_probe`: 'ok' | 'no_history_table' | 'no_statements_column'.
--   The drift-manifest replay container (`npm run drift:manifest`) has no
--   supabase_migrations schema, so the manifest records 'no_history_table' and an
--   empty array; check:drift never compares this category manifest-vs-live — it
--   compares live-vs-allowlist. Very old CLI history tables lack `statements`
--   (reported honestly as 'no_statements_column' rather than as "clean").
-- * Read via dynamic SQL because search_path is pinned to '' and the schema may
--   not exist on replay (same pattern as the storage.buckets block).
--
-- Read-only, security definer, service_role execute only, exactly like v1.
-- Deployment of this migration to the live project is a separately approved
-- window; until it is applied, check:drift reports the function `def_hash`
-- mismatch for schema_drift_snapshot itself and prints an info line that the
-- probe is not yet available on live.

create or replace function public.schema_drift_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  snapshot jsonb;
  buckets jsonb := '[]'::jsonb;
  history jsonb := '[]'::jsonb;
  history_probe text := 'no_history_table';
begin
  select jsonb_build_object(
    'snapshot_version', 2,
    'captured_at', now(),
    'extensions', coalesce((
      select jsonb_agg(jsonb_build_object('name', e.extname, 'schema', n.nspname) order by e.extname)
      from pg_extension e
      join pg_namespace n on n.oid = e.extnamespace
      where e.extname <> 'plpgsql'
    ), '[]'::jsonb),
    'tables', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', c.relname,
        'rls_enabled', c.relrowsecurity,
        'rls_forced', c.relforcerowsecurity,
        'reloptions', (select array_agg(o.opt order by o.opt) from unnest(c.reloptions) o(opt)),
        'acl', (select array_agg(a.item::text order by a.item::text) from unnest(coalesce(c.relacl, acldefault('r', c.relowner))) a(item)),
        'columns', (
          select jsonb_agg(jsonb_build_object(
            'name', att.attname,
            'type', format_type(att.atttypid, att.atttypmod),
            'not_null', att.attnotnull,
            'identity', att.attidentity,
            'generated', att.attgenerated,
            'default', pg_get_expr(ad.adbin, ad.adrelid)
          ) order by att.attname)
          from pg_attribute att
          left join pg_attrdef ad on ad.adrelid = att.attrelid and ad.adnum = att.attnum
          where att.attrelid = c.oid and att.attnum > 0 and not att.attisdropped
        )
      ) order by c.relname)
      from pg_class c
      where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
    ), '[]'::jsonb),
    'views', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', c.relname,
        'def_hash', md5(regexp_replace(pg_get_viewdef(c.oid), '\s+', '', 'g'))
      ) order by c.relname)
      from pg_class c
      where c.relnamespace = 'public'::regnamespace and c.relkind in ('v', 'm')
    ), '[]'::jsonb),
    'functions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'signature', p.oid::regprocedure::text,
        'def_hash', md5(regexp_replace(regexp_replace(regexp_replace(pg_get_functiondef(p.oid), '/\*.*?\*/', '', 'gs'), '--[^\n]*', '', 'g'), '\s+', '', 'g')),
        'acl', (select array_agg(a.item::text order by a.item::text) from unnest(coalesce(p.proacl, acldefault('f', p.proowner))) a(item))
      ) order by p.oid::regprocedure::text)
      from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and p.prokind = 'f'
        and not exists (
          select 1 from pg_depend dep
          where dep.classid = 'pg_proc'::regclass and dep.objid = p.oid and dep.deptype = 'e'
        )
    ), '[]'::jsonb),
    'indexes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', ci.relname,
        'table', ct.relname,
        'def', pg_get_indexdef(ci.oid),
        'def_hash', md5(regexp_replace(pg_get_indexdef(ci.oid), '\s+', '', 'g'))
      ) order by ci.relname)
      from pg_index i
      join pg_class ci on ci.oid = i.indexrelid
      join pg_class ct on ct.oid = i.indrelid
      where ct.relnamespace = 'public'::regnamespace
        and ci.relnamespace = 'public'::regnamespace
    ), '[]'::jsonb),
    'policies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'schema', pol.schemaname,
        'table', pol.tablename,
        'name', pol.policyname,
        'permissive', pol.permissive,
        'roles', (select array_agg(r.role::text order by r.role::text) from unnest(pol.roles) r(role)),
        'cmd', pol.cmd,
        'qual', pol.qual,
        'with_check', pol.with_check
      ) order by pol.schemaname, pol.tablename, pol.policyname)
      from pg_policies pol
      where pol.schemaname in ('public', 'storage')
    ), '[]'::jsonb),
    'constraints', coalesce((
      select jsonb_agg(jsonb_build_object(
        'table', ct.relname,
        'name', con.conname,
        'def', pg_get_constraintdef(con.oid)
      ) order by ct.relname, con.conname)
      from pg_constraint con
      join pg_class ct on ct.oid = con.conrelid
      where con.connamespace = 'public'::regnamespace and ct.relkind = 'r'
    ), '[]'::jsonb),
    'triggers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'table', ct.relname,
        'name', t.tgname,
        'def', pg_get_triggerdef(t.oid)
      ) order by ct.relname, t.tgname)
      from pg_trigger t
      join pg_class ct on ct.oid = t.tgrelid
      where ct.relnamespace = 'public'::regnamespace and not t.tgisinternal
    ), '[]'::jsonb)
  ) into snapshot;

  if to_regclass('storage.buckets') is not null then
    execute 'select coalesce(jsonb_agg(jsonb_build_object('
      || '''id'', b.id, ''public'', b.public, ''file_size_limit'', b.file_size_limit, '
      || '''allowed_mime_types'', b.allowed_mime_types) order by b.id), ''[]''::jsonb) '
      || 'from storage.buckets b'
      into buckets;
  end if;

  -- Migration-history integrity probe. A version recorded without executed
  -- statements is the fingerprint of a history repair / mark-applied row and
  -- must be covered by a fail-fast guard migration + a reviewed allowlist entry
  -- (docs/database-drift-detection.md, "Guard-migration contract").
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    if exists (
      select 1
      from pg_attribute att
      where att.attrelid = 'supabase_migrations.schema_migrations'::regclass
        and att.attname = 'statements'
        and att.attnum > 0
        and not att.attisdropped
    ) then
      execute 'select coalesce(jsonb_agg(jsonb_build_object('
        || '''version'', m.version, ''name'', m.name, '
        || '''signal'', case when m.statements is null then ''null'' else ''empty'' end'
        || ') order by m.version), ''[]''::jsonb) '
        || 'from supabase_migrations.schema_migrations m '
        || 'where m.statements is null or cardinality(m.statements) = 0'
        into history;
      history_probe := 'ok';
    else
      history_probe := 'no_statements_column';
    end if;
  end if;

  return snapshot || jsonb_build_object(
    'storage_buckets', buckets,
    'migration_history', history,
    'migration_history_probe', history_probe
  );
end;
$$;

revoke execute on function public.schema_drift_snapshot() from public, anon, authenticated;
grant execute on function public.schema_drift_snapshot() to service_role;
