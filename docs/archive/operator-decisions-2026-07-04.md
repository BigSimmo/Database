# Operator decisions — 2026-07-04

Historical snapshot of manual follow-ups deferred during documentation and verification gate recovery work. **No live actions were taken from this checklist.**

## Publishable key rotation

**Context:** `docs/multi-user-auth-setup.md` previously contained a live Supabase publishable (anon) key. The doc was scrubbed in commit `31543a926`, but the key may still exist in Git history.

**Decision:** Document only — rotate in Supabase when convenient; do not block doc/CI recovery on rotation.

**Operator steps (when approved):**

1. Supabase Dashboard → Project `Clinical KB Database` (`sjrfecxgysukkwxsowpy`) → Settings → API.
2. Rotate the **anon/public** key.
3. Update deployment secrets and local `.env.local` for all environments that use the old key.
4. Run `npm run check:supabase-project` after env updates.
5. Optionally audit Git history exposure; consider `git filter-repo` only if policy requires history rewrite.

## Pending live migrations

**Context:** Local `supabase/migrations/` includes July 2026 changes not yet verified as applied on the linked project. See [`docs/supabase-migration-reconciliation.md`](../supabase-migration-reconciliation.md).

**Decision:** Document only — no `supabase db push`, dashboard SQL, or `migration repair` from automation.

**Pre-apply checklist (when approved):**

```bash
npx supabase migration list --linked
npm run supabase:recovery-status
npx supabase db advisors --linked
```

**Notable pending migration (verify before apply):**

- `20260703030000_reconcile_storage_cleanup_jobs_indexes` — reconcile storage cleanup job indexes; confirm live index state and maintenance window before applying.

**After apply:**

- Re-run the verification queries in `docs/supabase-migration-reconciliation.md`.
- Update the "Current Status" section with applied versions and evidence.

## Verification gate notes

- `tsconfig.json` excludes `.next/dev/types` — dev server artifacts must not be typechecked.
- Run `npm run sitemap:update` immediately before `npm run verify:cheap` when routes change.
- Clear stale `.eslintcache` if lint reports ENOENT on removed temp scripts.
