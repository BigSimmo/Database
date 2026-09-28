# PR #3126 local merge handover (2026-09-28)

PR #3126 (`claude/roster-r2-dnhv02`, "feat(roster): complete team workflows and guarded publication")
cannot be unblocked from a cloud session. Two of its steps need a local Docker daemon, and the cloud
permission policy refuses both workarounds: starting Docker, and hand-editing
`supabase/drift-manifest.json`. PR #3147 (`claude/repository-review-bugs-52tq9q`) is blocked the same
way and is covered at the end.

## Where #3126 stands

- Head is `7f60136ff`. Auto-merge is off. All 8 review threads are resolved.
- It conflicts with `main` in about 15 files, including `supabase/drift-manifest.json`,
  `supabase/applied-migration-hashes.json`, `supabase/schema.sql`,
  `data/repo-awareness-snapshot.json`, `docs/codebase-index.md` and the design-system adoption files.
- Its migration `supabase/migrations/20260927010000_roster_release_two.sql` is older than the newest
  migration on `main` (`20260927195000_cme_atomic_goal_carry.sql` at the time of writing), so
  `PR policy` rejects it as out of order.
- The only other red job feeding `PR required` was `Production UI (2)`. Its failing test was not
  identified. Check whether it is the time-of-day On Call test described below before debugging it.
- One owner decision is tracked separately in issue #3163 (what "Delete my data" should remove).

## Agreed migration order

The three open database PRs are meant to merge oldest first, so their migrations must sort that way:

| PR    | Migration                                                                 | New timestamp                              |
| ----- | ------------------------------------------------------------------------- | ------------------------------------------ |
| #3126 | `roster_release_two`                                                      | `20260928090000`                           |
| #3156 | `on_call_named_cover`                                                     | `20260928091000`                           |
| #3158 | its own three migrations (it also carries a copy of `roster_release_two`) | `20260928092000`, `...092100`, `...092200` |

If `main` has gained a migration newer than `20260928090000` by the time you do this, choose a
timestamp newer than main's newest instead, and move #3156 and #3158 to later timestamps to match.
#3158 must end up carrying `roster_release_two` under exactly the same filename as #3126.

## Steps for #3126 (local machine, Docker running)

1. Start Docker Desktop and confirm `docker info` succeeds.
2. `git fetch origin && git switch claude/roster-r2-dnhv02 && git pull --ff-only`
3. `npm ci --include=dev`
4. `git merge origin/main` and resolve the conflicts:
   - Generated files (`data/repo-awareness-snapshot.json`, `docs/design-system/*`, `docs/site-map.md`):
     take either side, then regenerate them with the repo's own commands in step 7. Never hand-merge them.
   - `supabase/schema.sql`: keep main's sections and this PR's roster sections.
   - `supabase/applied-migration-hashes.json` and `supabase/drift-manifest.json`: take main's version.
     Steps 5 to 7 regenerate them.
5. Rename the migration without changing its SQL:
   `git mv supabase/migrations/20260927010000_roster_release_two.sql supabase/migrations/20260928090000_roster_release_two.sql`
   Then update every reference to the old name (`git grep 20260927010000`).
6. `npm run migrations:seal`
7. `npm run drift:manifest`, then the other generators the merge touched (`npm run sitemap:update`,
   and the repo-awareness and design-system adoption generators if their checks complain).
8. Check: `npm run check:migration-role`, `npm run lint`, `npm run typecheck`, `npm run format`, then
   `npm run test:focused -- --files <changed paths>`.
9. Commit (never `git add -A`) and `git push`. Do not merge the PR, and do not turn on auto-merge.
   Merging a migration to `main` changes the live clinical database within seconds.

## Steps for #3147

1. `git switch claude/repository-review-bugs-52tq9q && git pull --ff-only && git merge origin/main`
2. Only `supabase/applied-migration-hashes.json` and `supabase/drift-manifest.json` conflict. Take
   main's versions, then run `npm run migrations:seal` and `npm run drift:manifest`.
3. The PR's migration `20260927201500` already sorts after main's newest, so it needs no rename.
4. `tests/rag-site-content-freshness.test.ts` (around line 690) has a pinned cache-key hash that moved
   because the PR bumps the index version to `rag-deep-memory-v2`. Updating that pinned value changes
   no ranking, but it is a RAG-protected test, so it needs the owner's explicit approval first.
5. The reindex and live eval-canary thread stays open for the owner. The canary is provider-backed and
   needs approval.

## Time-of-day test failure on main (affects most PRs)

`tests/ui-on-call-now.spec.ts` "opens the shift lists sheet with the shift pick" fails whenever
Production UI shard 1 runs between 08:00 and 17:00 Perth time (00:00 to 09:00 UTC). #3145 added a
demo roster shift for those hours every day, and while it is running the Now sheet shows the roster
instead of the Day/Evening/Night pick. Main's own push CI skips Production UI, so main never shows
the failure. The fix is to pin that test's clock or clear the demo shift in the test. Until then, a
re-run after 17:00 Perth passes.
