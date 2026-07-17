# Testing and verification

## Safe local execution

Heavy commands (`lint`, `typecheck`, `build`, Vitest, Playwright, `verify:cheap`, and `verify:pr-local`) share one lock derived from Git's common directory. The lock therefore covers every worktree for this repository. Nested commands reuse their parent's token; an unrelated command fails immediately and prints the current owner. A lock with an owner is reclaimed only when its recorded process is demonstrably dead; an ownerless initialization lock is reclaimed only after its initialization grace period.

Run one heavy Database command at a time. Do not install packages while a repository test, build, lint, typecheck, or server command is active. Avoid short-interval polling, and do not repeat an unchanged broad gate after it has already passed.

Ordinary Vitest and Playwright runs remove OpenAI, Supabase, database, and E2E credentials and force demo/offline mode. Provider tests use the `*.live.test.ts` suffix, are excluded from default discovery, and can only be started explicitly with `ALLOW_PROVIDER_TESTS=true npm run test:live`.

## Commands

| Command                                   | Purpose                                                                                                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:focused -- --files <paths>` | Local iteration using Vitest related-file selection. It fails closed for deleted files, test infrastructure, configuration, or an empty/unsafe mapping. |
| `npm run test`                            | Complete offline unit suite.                                                                                                                            |
| `npm run test:live`                       | Explicit provider suite; requires `ALLOW_PROVIDER_TESTS=true`.                                                                                          |
| `npm run test:e2e:pr`                     | Required production Chromium journeys, excluding mockups and quarantined tests.                                                                         |
| `npm run test:e2e:advisory`               | Quarantined and mockup journeys in one advisory invocation.                                                                                             |
| `npm run verify:cheap`                    | Broad offline local gate: runtime/config checks, lint, typecheck, and the full unit suite.                                                              |
| `npm run verify:pr-local`                 | PR-like local gate. Formatting is checked on the changed set, the full unit suite runs once, and RAG scope adds fixture/manifest validation.            |
| `npm run verify:ui`                       | Complete required production Chromium gate.                                                                                                             |

Set `FAST_CHECK_SEED` to reproduce a property-test run. Local and ordinary CI runs default to `424242`; scheduled CI may derive a bounded seed from the run ID.

## Playwright ownership

The repository runner exclusively builds and serves each Playwright production app. It selects a safe port, verifies `/api/local-project-id`, uses an isolated `.next-playwright/<run-id>` build directory, replaces provider configuration with inert loopback values, and removes its server and output on success, failure, or signal. Playwright configuration never starts a server. The production boot guard permits this demo profile only when the output is isolated, provider mode is offline, credentials are absent, and the Supabase URL is the inert `127.0.0.1:1` target.

Blocking tests run with zero retries. CI publishes list, JUnit, and JSON reports. Failed-test classification parses JUnit test cases and uses exact spec/title matches; a job name is never enough to classify a failure as a known flake.

## Flake policy

`tests/flake-ledger.json` may be empty. Each entry must match the exact spec and title, and the test title must include `@quarantine` but not `@critical`. Entries require an owner, reproduction command, local tracking reference, first/last-seen dates, and an expiry no more than 30 days away. Reproduce a candidate three times on the same SHA before adding or retaining it: fix fail/pass races, treat repeatable failures as regressions, and remove entries that no longer reproduce.

## CI topology

PR CI keeps static checks separate from one required full unit run with coverage. UI scope uses one required production Chromium invocation for non-quarantined critical and regression journeys, plus one advisory invocation for quarantined and mockup journeys. Build, migration, security, and release behavior remain independently scoped and unchanged.
