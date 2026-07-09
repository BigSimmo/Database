---
title: Optimize RLS Policies for Performance
impact: HIGH
impactDescription: 5-10x faster RLS queries with proper patterns
tags: rls, performance, security, optimization
---

## Optimize RLS Policies for Performance

Poorly written RLS policies can cause severe performance issues. Use subqueries and indexes strategically.

**Incorrect (function called for every row):**

```sql
create policy orders_policy on orders
  using (auth.uid() = user_id);  -- auth.uid() called per row!

-- With 1M rows, auth.uid() is called 1M times
```

**Correct (wrap functions in SELECT):**

```sql
create policy orders_policy on orders
  using ((select auth.uid()) = user_id);  -- Called once, cached

-- 100x+ faster on large tables
```

Use security definer functions for complex checks:

`SECURITY DEFINER` functions run with the creator's privileges and bypass RLS on any tables they touch — which is what makes them useful for internal lookups, but also what makes them dangerous if misused. Always include an explicit `auth.uid()` check inside the function body, keep them in a non-exposed schema, and keep `EXECUTE` available only to roles that need to evaluate policies using the helper.

```sql
-- Create helper function in a private schema
create or replace function private.is_team_member(team_id bigint)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members
    -- always check the calling user's identity inside the function
    where team_id = $1 and user_id = (select auth.uid())
  );
$$;

-- Keep EXECUTE for roles that must evaluate team_orders_policy.
-- Revoke only from roles that will never use that policy path.
revoke execute on function private.is_team_member(bigint) from PUBLIC, anon, service_role;
grant execute on function private.is_team_member(bigint) to authenticated;

-- Use in policy (indexed lookup, not per-row check)
create policy team_orders_policy on orders
  using ((select private.is_team_member(team_id)));
```

Always add indexes on columns used in RLS policies:

```sql
create index orders_user_id_idx on orders (user_id);
```

Reference: [RLS Performance](https://supabase.com/docs/guides/database/postgres/row-level-security#rls-performance-recommendations)
