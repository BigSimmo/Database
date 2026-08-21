# Task 12 & 13 report — the server-side seam (database config + demo role switcher)

**Status:** DONE
**Commits:**

- `0cee63f97` — Task 12, database configuration that cannot resolve to the Clinical KB project
- `183be3b91` — Task 13, demo role switcher with no credentials
- `f5effccaa` — `npm run format`, committed separately per instructions

All three on `claude/suicide-contact-mockup-b5aaa0`, worktree `D:\Worktrees\Database\cc-2a-live`.

**Decisive evidence:**

- Task 12: `Test Files  1 passed (1)` / `Tests  4 passed (4)` — `tests/caring-contacts-server-config.test.ts`
- Task 13: `Test Files  1 passed (1)` / `Tests  4 passed (4)` — `tests/caring-contacts-session.test.ts`
- Full offline suite after both: `Test Files  693 passed | 2 skipped (695)` / `Tests  7687 passed | 29 skipped (7716)`

---

## Task 12 — database configuration

### What I implemented

- `src/lib/caring-contacts-server/config.ts` — `caringContactsDatabaseUrl()`, `caringContactsDataMode()`,
  `assertNotClinicalKbProject(url)`, `CaringContactsProjectSeparationError`. Reads exactly one
  environment variable, `CARING_CONTACTS_DATABASE_URL`. Blank/whitespace is treated as unset
  (matching the repo's `env.ts` scrub convention). `assertNotClinicalKbProject` refuses two distinct
  ways: the URL contains the pinned Clinical KB reference `sjrfecxgysukkwxsowpy`, or the URL is
  byte-identical to `process.env.SUPABASE_DB_URL` / `process.env.DATABASE_URL`. Every thrown message
  names the variable it refers to and never includes the URL or the value it was compared against.
- `src/lib/caring-contacts-server/pool.ts` — `createCaringContactsPool(url)`, a `pg` `Pool` adapted to
  the driver-free `SqlConnectionPool` shape `src/lib/caring-contacts/db/postgres-repository.ts` takes.
  I mirrored `poolAsSqlConnectionPool` in `tests/helpers/caring-contacts-postgres.ts` (same
  one-connection-per-`withConnection`-callback contract) rather than inventing a second adapter shape.
- `src/lib/caring-contacts-server/store.ts` — `caringContactsStore()`. Returns
  `createInMemoryRepository(systemClock())` when the URL is absent; otherwise calls
  `assertNotClinicalKbProject(url)` before building a pool and handing it to
  `createPostgresRepository`.

### TDD evidence

RED — `node scripts/run-vitest.mjs run tests/caring-contacts-server-config.test.ts --reporter=dot`
before any implementation existed:

```
Error: Cannot find package '@/lib/caring-contacts-server/config' imported from
D:/Worktrees/Database/cc-2a-live/tests/caring-contacts-server-config.test.ts
 Test Files  1 failed (1)
      Tests  no tests
```

Expected: the module didn't exist yet.

GREEN — same command after implementing all three files:

```
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

### Mutation evidence

I commented out the pinned-reference `if` (`if (false && url.includes(CLINICAL_KB_PROJECT_REF))`)
and reran the same test file. Two tests reddened, not one:

```
 FAIL  … > refuses the pinned Clinical KB project reference
AssertionError: expected function to throw an error, but it didn't

 FAIL  … > never puts a connection string into its error message
AssertionError: expected 'expected a refusal' to contain 'CARING_CONTACTS_DATABASE_URL'
 Tests  2 failed | 2 passed (4)
```

I confirmed before mutating that this line is what the second test's assertion actually reads —
the `.toThrow(CaringContactsProjectSeparationError)` assertion depends on this exact branch
executing, and the fourth test's `expect(...).toThrow` inside its own `try` depends on the same
branch to even reach a caught error, so its knock-on failure is real, not decorative (the test
throws its own "expected a refusal" `Error` when the refusal doesn't happen, and that's the
message the assertion then sees). Reverted the mutation; reran to confirm `4 passed (4)` again.

### `check:supabase-project`

Before my diff: `npm run check:supabase-project` exit code **1**. Reason (masked, names only,
never values): `Configured URL ref: not set or not recognised`, `Configured SUPABASE_PROJECT_REF:
not set`, `Configured SUPABASE_PROJECT_NAME: not set`. After my diff: exit code **1**, identical
reason. Unchanged, as expected — this worktree has no local Supabase env file and I did not add
one.

### `pg` dependency

**Ruling 42.** Moved `pg` from `devDependencies` to `dependencies` in `package.json` (same version
range, `^8.23.0`, unchanged — only the section it lives in moved). `@types/pg` stayed in
`devDependencies`, matching the repo's convention that `@types/*` packages are dev-only even for a
runtime dependency. Then ran `npm install --package-lock-only` (no `node_modules` mutation needed
— the version was already installed as a devDependency) to regenerate `package-lock.json`. The
resulting diff was exactly what I expected and nothing more: `pg` moved between the two
top-of-file dependency blocks, and 14 `"dev": true` flags were cleared — one on `pg` itself and 13
on its own transitive dependencies (`pg-cloudflare`, `pg-connection-string`, `pg-int8`, `pg-pool`,
`pg-protocol`, `pg-types`, `pgpass`, `postgres-array`, `postgres-bytea`, `postgres-date`,
`postgres-interval`, `split2`, `xtend`). No version numbers changed. I reviewed the full diff
before committing; it is pasted in full above in the tool transcript and is 46 lines, all either
the two `pg` list-membership lines or a removed `"dev": true,` line.

---

## Task 13 — demo role switcher

### What I implemented

- `src/lib/caring-contacts-server/session.ts` — `CARING_CONTACTS_ROLE_COOKIE`, `DEMO_ROLES`,
  `DEMO_TEAM_ID`, `demoActorForRole(role)`, `resolveDemoActor()`, plus one small addition beyond the
  documented interface: `isDemoRole(value): value is CaringContactRole`, exported so the route
  handler validates a POST body against the exact same list `resolveDemoActor` resolves against,
  rather than a second hard-coded copy that could silently drift from `DEMO_ROLES`.
  `resolveDemoActor()` reads the cookie via `await cookies()` and falls back to `"coordinator"` for
  anything unreadable — no cookie, an empty value, an unrecognised role name — without ever
  throwing. `demoActorForRole` derives the actor id as `demo-<role>` (e.g. `demo-auditor`) so the
  audit trail attributes the action to the acting role.
- `src/app/api/caring-contacts/session/route.ts` — `GET` resolves and returns the current role
  (`{ role, roles: DEMO_ROLES }`, no auth, no credential field anywhere); `POST` validates
  `{ role }` with a Zod schema built on `isDemoRole` and returns `400` (via this repo's existing
  `parseJsonBody`/`jsonError`/`PublicApiError` helpers) on anything not in `DEMO_ROLES`, otherwise
  sets the cookie (`httpOnly`, `sameSite: "lax"`, `path: "/"`) and returns the new role. This is the
  one place an unrecognised value IS rejected rather than defaulted — the brief's "fall back rather
  than fail" rule belongs to the cookie-read path in `session.ts`, not to a client sending a bad
  request to this endpoint.

### Next.js 16 documentation read

`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md` and
`node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`. The cookies doc
confirmed `cookies()` is async (`await cookies()`) as of `v15.0.0-RC`, matching the brief. Nothing
it said contradicted what I would otherwise have written; the one thing it made me double-check
was that `.set()` on the awaited cookie store is valid from inside a Route Handler (it is — the doc
explicitly calls out Route Handlers, alongside Server Functions, as the two places `.set`/`.delete`
are allowed, versus a read-only Server Component render). I also read the repo's own
`src/lib/supabase/server.ts` for the existing async-`cookies()` pattern this repo already uses
before writing my own, rather than working from memory of an older Next version.

### TDD evidence

RED — before `session.ts` existed:

```
Error: Cannot find package '@/lib/caring-contacts-server/session' imported from
D:/Worktrees/Database/cc-2a-live/tests/caring-contacts-session.test.ts
 Test Files  1 failed (1)
      Tests  no tests
```

GREEN — after implementing `session.ts`:

```
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

### Mutation evidence

I changed the cookie-read fallback in `resolveDemoActor` to throw on an unrecognised (but present)
cookie value instead of defaulting:

```ts
if (!isDemoRole(raw) && raw !== undefined) {
  throw new Error(`unreadable caring-contacts demo role cookie: ${raw}`);
}
const role = isDemoRole(raw) ? raw : DEFAULT_DEMO_ROLE;
```

Reran the test file — exactly the third test reddened, as the brief specified, and no others:

```
 FAIL  … demo role switcher > falls back to the coordinator on an unreadable cookie rather than failing
AssertionError: promise rejected "Error: unreadable caring-contacts demo ro…" instead of resolving
Caused by: Error: unreadable caring-contacts demo role cookie: administrator
 Tests  1 failed | 3 passed (4)
```

Confirmed before mutating that this line is the one the test's `.resolves.toMatchObject(...)`
assertion actually depends on — it's the only branch reachable when `mockCookies` carries the
unrecognised `"administrator"` value the test sets. Reverted; reran to confirm `4 passed (4)`
again.

---

## Full suite

`npm run test` after both tasks and the format pass:

```
 Test Files  693 passed | 2 skipped (695)
      Tests  7687 passed | 29 skipped (7716)
```

No failures. All stderr output in the run (malformed-JSON fallback logs, `check:function-grants`
negative-case output, eval rate-limit retry logs, etc.) comes from other tests' own deliberate
negative-path assertions, not from anything I touched. I did not chase down which two files were
skipped — Note for calibration in the brief already named `tests/codex-cloud-setup.test.ts` and
`tests/design-sync-contract.test.ts` as occasional intermittent timeouts on this machine; this run
did not report either as failed, so if they're the two skipped files that's unrelated to my change
either way, and re-running the whole suite a second time just to identify them would repeat
~5 minutes of coverage this run already established.

---

## `check:supabase-project` / provider boundary

Only ran the one local static check named in the brief (`check:supabase-project`), before and
after Task 12. No provider, network, or hosted-CI command was run at any point.

---

## Files changed (both tasks + format commit)

```
docs/codebase-index.md
docs/site-map.md                                (generated by the pre-commit hook)
package-lock.json
package.json
src/app/api/caring-contacts/session/route.ts
src/lib/caring-contacts-server/config.ts
src/lib/caring-contacts-server/pool.ts
src/lib/caring-contacts-server/session.ts
src/lib/caring-contacts-server/store.ts
tests/caring-contacts-server-config.test.ts
tests/caring-contacts-session.test.ts
```

`docs/codebase-index.md` needed a new `src/lib/caring-contacts-server/` subsection and a
`/api/caring-contacts/session` row in the API-routes table — the committed pre-commit hook's
`docs:check-index` gate refuses a commit that introduces an unindexed top-level module or route,
and it caught both additions on the first attempt for each task. `docs/site-map.md` is fully
generated (`npm run sitemap:update`, run automatically by the same hook) and needed one new line
for the API route.

---

## Self-review

- **Completeness against both briefs:** every interface named in both briefs' "Interfaces" blocks
  is present with the specified signature. Both Step 1 test files are used verbatim, not
  re-derived. Both Step 5 mutations match what each brief specified (the pinned-reference check for
  Task 12, the unknown-cookie fallback for Task 13).
- **Naming:** `pool.ts`'s `createCaringContactsPool(url)` and the *test helper*
  `tests/helpers/caring-contacts-postgres.ts`'s `createCaringContactsPool()` (no args, reads env
  itself) share a name but live in different modules with different call sites — this was already
  true of the brief's own naming choice, not something I introduced; I didn't rename either since
  the brief pins the production one's exact signature and the test helper predates this task.
- **YAGNI:** I added exactly one export beyond the documented interfaces —
  `isDemoRole` from `session.ts`. I considered leaving it un-exported and duplicating the role-list
  check as a literal Zod enum tuple in the route file instead, but that would have created two
  independent sources of truth for "what counts as a valid demo role" with no test pinning them
  together; exporting the one predicate both call sites already need seemed the smaller
  surface, not the larger one. No other speculative exports, no unused branches, no config knobs
  the briefs didn't ask for.
- **Do the tests verify real behaviour?** Yes — confirmed by the mutation step for both tasks,
  described above, and I checked each mutation against the exact assertion line it was supposed to
  break rather than trusting "the suite went red" alone.
- **Test output pristine?** Both new test files run cleanly with no console noise of their own. The
  full-suite stderr output listed above is pre-existing and unrelated to these files.
- **Domain isolation:** neither Task 12 nor Task 13 touched anything under
  `src/lib/caring-contacts/`. `src/lib/caring-contacts-server/` imports from `../caring-contacts`
  (types, `systemClock`, `createInMemoryRepository`, `createPostgresRepository`) and from `pg`,
  `next/headers`, `zod`, and this repo's own `@/lib/http` / `@/lib/validation/body` — never the
  reverse. `tests/caring-contacts-domain-isolation.test.ts` scans only `src/lib/caring-contacts/`,
  so it was unaffected, and I re-ran the full suite (which includes it) to confirm.

## Concerns

- `npm run docs:check-links` reports 26 pre-existing missing paths, all in `task-14-brief.md`
  through `task-19-brief.md` (files those future tasks will create — `src/app/caring-contacts/`,
  `src/components/caring-contacts/workspace/`, etc.). This is not caused by my change and I did not
  touch it; flagging it only because I ran the check while investigating whether my docs edit had
  broken anything, and it hadn't (no new missing paths appeared for `session.ts` or anything else I
  added — my codebase-index rows use bare filenames like `` `session.ts` `` inside backticks, not
  full `src/...` paths, so the checker's path-prefix rule doesn't apply to them). It is not part of
  the committed pre-commit hook and did not block either commit.
- `pool.ts` and the Postgres branch of `store.ts` have no unit-test coverage in this session — by
  design, per the brief, which only specifies a test for `config.ts`. They are exercised indirectly
  by the existing live-database contract suite (`tests/caring-contacts-postgres-repository.test.ts`,
  `db/postgres-repository.ts`) when `CARING_CONTACTS_DATABASE_URL` is set, which I did not attempt
  to run (it needs a real local Postgres and is outside this task's scope).
