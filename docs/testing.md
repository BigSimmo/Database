# Testing and verification

## Safe local execution

Heavy commands (`lint`, `typecheck`, `build`, Vitest, Playwright, `verify:cheap`, and `verify:pr-local`) share one lock derived from Git's common directory. The lock therefore covers every worktree for this repository. Nested commands reuse their parent's token; an unrelated command fails immediately and prints the current owner. A lock with an owner is reclaimed only when its recorded process is demonstrably dead; an ownerless initialization lock is reclaimed only after its initialization grace period.

Run one heavy Database command at a time. Do not install packages while a repository test, build, lint, typecheck, or server command is active. Avoid short-interval polling, and do not repeat an unchanged broad gate after it has already passed.

Ordinary Vitest and Playwright runs remove OpenAI, Supabase, database, and E2E credentials and force demo/offline mode. Provider tests use the `*.live.test.ts` suffix, are excluded from default discovery, and can only be started explicitly with `ALLOW_PROVIDER_TESTS=true npm run test:live`.

**Provider-backed boundary:** `test:live`, `eval:quality`, `eval:retrieval:quality`, `verify:release`, `check:supabase-project`, and other OpenAI/Supabase/hosted workflows need **explicit user approval** before agents run them (see root `AGENTS.md`). Prefer offline gates (`verify:cheap`, `verify:pr-local`, `eval:rag:offline`) unless that approval is in the task.

## Commands

| Command                                   | Purpose                                                                                                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:focused -- --files <paths>` | Local iteration using Vitest related-file selection. It fails closed for deleted files, test infrastructure, configuration, or an empty/unsafe mapping. |
| `npm run test`                            | Complete offline unit suite.                                                                                                                            |
| `npm run test:live`                       | Explicit provider suite; requires `ALLOW_PROVIDER_TESTS=true`.                                                                                          |
| `npm run test:e2e:pr`                     | Required production Chromium journeys and visual-artifact smoke, excluding mockups and quarantined tests.                                               |
| `npm run test:e2e:advisory`               | Quarantined and mockup journeys in one advisory invocation.                                                                                             |
| `npm run verify:cheap`                    | Broad offline local gate: runtime/config checks, lint, typecheck, and the full unit suite.                                                              |
| `npm run verify:pr-local`                 | PR-like local gate. Formatting is checked on the changed set, the full unit suite runs once, and RAG scope adds fixture/manifest validation.            |
| `npm run verify:ui`                       | Complete required production Chromium gate.                                                                                                             |

Set `FAST_CHECK_SEED` to reproduce a property-test run. Local and ordinary CI runs default to `424242`; scheduled CI may derive a bounded seed from the run ID.

## Component tests (jsdom)

Two Vitest projects run under one `npm run test` (see `vitest.config.mts`):

- **node** (`tests/**/*.test.ts`) — pure logic, route handlers, and SSR-string assertions.
- **jsdom** (`tests/**/*.dom.test.tsx`) — interactive component tests via `@testing-library/react`. The `.dom.test.tsx` suffix is required; a `.test.ts` file is collected by the node project and has no DOM.

Author component tests to assert **user-visible behaviour**, not markup snapshots:

- Query by role and accessible name (`getByRole("button", { name: … })`) so a missing or wrong `aria-label` fails the test; drive interactions with `@testing-library/user-event`.
- Cover the state matrix the change touches — loading / empty / error / disabled — plus keyboard operability and focus where relevant.
- The shared setup (`tests/setup/jsdom.setup.ts`) registers jest-dom matchers, auto-unmounts between tests, and polyfills `matchMedia` (override per test with the exported `installMatchMediaStub`) and `Element.scrollIntoView`.
- Mock hooks/modules with `vi.mock`; when the factory needs a spy, create it with `vi.hoisted` so it exists when the hoisted mock runs.

Reference examples: `tests/icon-button.dom.test.tsx` (accessible-name contract), `tests/sheet.dom.test.tsx` (stacked-overlay keyboard + scroll-lock), `tests/scroll-behavior.dom.test.tsx` (reduced-motion), `tests/registry-retry.dom.test.tsx` (`vi.hoisted` hook mock + error recovery).

## Playwright ownership

The repository runner exclusively builds and serves each Playwright production app. It selects a safe port, verifies `/api/local-project-id`, uses an isolated `.next-playwright/<run-id>` build directory, replaces provider configuration with inert loopback values, and removes its server and output on success, failure, or signal. Playwright configuration never starts a server. The production boot guard permits this demo profile only when the output is isolated, provider mode is offline, credentials are absent, and the Supabase URL is the inert `127.0.0.1:1` target.

Blocking tests run with zero retries. CI publishes list, JUnit, and JSON reports. Failed-test classification parses JUnit test cases and uses exact spec/title matches; a job name is never enough to classify a failure as a known flake.

## Flake policy

`tests/flake-ledger.json` may be empty. Each entry must match the exact spec and title, and the test title must include `@quarantine` but not `@critical`. Entries require an owner, reproduction command, local tracking reference, first/last-seen dates, and an expiry no more than 30 days away. Reproduce a candidate three times on the same SHA before adding or retaining it: fix fail/pass races, treat repeatable failures as regressions, and remove entries that no longer reproduce.

## CI topology

PR CI keeps static checks separate from one required full unit run with coverage. UI scope uses one required production Chromium invocation for non-quarantined critical, regression, and dashboard/document visual-artifact journeys, plus one advisory invocation for quarantined and mockup journeys. Build, migration, security, and release behavior remain independently scoped and unchanged.

## Contribution checklist (UI changes)

Before opening a UI PR, confirm:

- **Reuse first.** Check `src/components/ui-primitives.tsx` (class recipes plus `IconButton`, `AsyncButton`, `InlineNotice`, `EmptyState`, `LoadingPanel`, `ToggleSwitch`) and `src/components/ui/sheet.tsx` (the only overlay primitive) before hand-rolling. Icon-only buttons use `IconButton` (its `label` is a required prop).
- **Tokens only.** No raw hex or Tailwind palette classes, no literal shadows, no `text-[Npx]` — see [`docs/design-system.md`](./design-system.md) §1–§5. `check:design-system-contract`, `check:type-scale`, and `check:icon-scale` enforce this.
- **States.** Handle loading / empty / error / disabled where they apply; async surfaces expose a retry, not a dead end.
- **Accessibility** ([design-system §7](./design-system.md)): keyboard operable, visible focus, accessible names on icon controls, live regions for async status, and reduced motion honoured — scripted `scrollTo`/`scrollIntoView` go through `resolveScrollBehavior` (`src/lib/scroll-behavior.ts`), never a hard-coded `behavior: "smooth"`.
- **Tests.** Add a `.dom.test.tsx` for changed component behaviour (see "Component tests" above) and update the E2E journeys for changed flows.
- **Verify** ([design-system §9](./design-system.md)): run `npm run verify:cheap`, then `npm run verify:pr-local` before handoff; run `npm run ensure` before browser work and `npm run verify:ui` for UI/routing/styling changes, plus a manual dark-mode + forced-colors spot check on touched surfaces.
- Architecture and state-ownership conventions: [`docs/frontend-architecture.md`](./frontend-architecture.md).
