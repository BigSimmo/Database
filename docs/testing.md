# Testing and verification

## Safe local execution

Repository verification uses a local run coordinator derived from Git's common directory, so admission covers every worktree for this repository. It permits at most two shared leases from different worktrees for fail-closed focused Vitest selections and read-only typechecking. Full Vitest, coverage, lint, build, Playwright, and live-provider tests retain exclusive admission. Unknown Vitest selections fail closed to exclusive mode, and shared Vitest runs are capped at two workers each.

Composite gates do not hold an umbrella lease: `verify:cheap` and `verify:pr-local` let each lint, typecheck, unit, build, or browser stage acquire the appropriate lease. This lets focused work proceed during lightweight stages without allowing it to overlap an exclusive stage. Waiting admission is queue-ordered, so later focused runs cannot jump ahead of a queued exclusive command. Exclusive stages wait up to 15 minutes for long browser or build owners; shared focused work retains a 30-second admission timeout so an interactive check reports contention promptly.

Nested commands reuse their parent's token. Shared typechecks override the repository's `node_modules/.cache` incremental path with worktree-specific temporary `.tsbuildinfo` state, so junctioned dependency directories are not written concurrently. The coordinator retains the legacy lock path and a live sentinel owner so older worktrees safely wait instead of bypassing newer shared leases. Dead owners and abandoned queue entries are reclaimed; live owners heartbeat and command text is redacted before persistence or contention output. Do not bypass or delete coordinator state manually.

Vitest's Vite transform cache is outside the commonly-junctioned `node_modules` tree and keyed by worktree. Two focused runs from the same worktree are not admitted concurrently. Do not install packages while a repository test, build, lint, typecheck, or server command is active. Avoid short-interval polling, and do not repeat an unchanged broad gate after it has already passed.

Ordinary Vitest and Playwright runs remove OpenAI, Supabase, database, and E2E credentials and force demo/offline mode. Provider tests use the `*.live.test.ts` suffix, are excluded from default discovery, and can only be started explicitly with `ALLOW_PROVIDER_TESTS=true npm run test:live`.

**Provider-backed boundary:** `test:live`, `eval:quality`, `eval:retrieval:quality`, `verify:release`, `check:supabase-project`, and other OpenAI/Supabase/hosted workflows need **explicit user approval** before agents run them (see root `AGENTS.md`). Prefer offline gates (`verify:cheap`, `verify:pr-local`, `eval:rag:offline`) unless that approval is in the task.

Codex Cloud agents remain provider-free. Run authenticated Supabase tests through the
manual `.github/workflows/authenticated-live-tests.yml` workflow, which requires the
explicit `run-authenticated-live-tests` dispatch confirmation, records the run against the
`Database / production` environment, and injects GitHub secrets only into the identity
guard and live-test steps. It never runs on a push, pull request, or schedule.

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
| `npm run verify:phone-chrome`             | Smart phone-chrome gate: lock parity, affected contracts, browser/PWA owners and exact journeys, then full UI only for shared foundations.              |
| `npm run verify:ui`                       | Complete required production Chromium gate.                                                                                                             |
| `npm run test:e2e:style-contract`         | Focused rendered-effect assertions for the unlayered classes in `globals.css` (also runs inside `test:e2e:pr`).                                         |
| `npm run test:e2e:visual`                 | Pixel baselines. Advisory in CI; a platform with no committed baseline fails by design.                                                                 |
| `npm run test:e2e:visual:update`          | Rewrite the pixel baselines for the current platform. Review every changed PNG before committing.                                                       |
| `npm run verify:lighthouse`               | Build, serve, and measure the budgeted routes with Lighthouse, then grade against the committed baseline. `-- --dry-run` prints the plan.               |
| `npm run check:lighthouse-budget`         | Grade Lighthouse JSON that already exists. `-- --update` refreshes the baseline in `lighthouse-budget.json`.                                            |

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

The repository runner exclusively builds and serves each Playwright production app. It selects a safe port, verifies `/api/local-project-id`, uses an isolated `.next-playwright/<run-id>` build directory, replaces provider configuration with inert loopback values, and removes its server and output on success, failure, or signal. Playwright configuration never starts a server. The production boot guard permits this demo profile only when the output is isolated, provider mode is offline, credentials are absent, and the Supabase URL is the inert `127.0.0.1:1` target. Before acquiring the heavy lock or building, the runner preflights the Chromium (or requested Firefox/WebKit) executable — including the default `chrome-headless-shell` binary and any `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` override — and exits non-zero immediately when it is missing, so a launch-infra failure cannot be mistaken for product-test failures after a multi-minute build.

When capturing Playwright or `verify:phone-chrome` output through a shell pipe (`cmd 2>&1 | tee …`), enable `set -o pipefail` (or avoid the pipe). Without it, bash reports the pipeline exit from `tee` (`0`) while the log still ends in `N failed` — a measurement artifact that previously looked like a green-when-broken gate (outstanding-issues #120). The Node runners themselves already propagate Playwright’s exit status.

Blocking tests run with zero retries. CI publishes list, JUnit, and JSON reports. Failed-test classification parses JUnit test cases and uses exact spec/title matches; a job name is never enough to classify a failure as a known flake.

Phone-chrome work uses `npm run verify:phone-chrome`. Inspect its classification with `-- --dry-run` or provide an explicit changed set with `-- --files pathA,pathB`. The default `--full=auto` escalates shared shell/header/footer, scroll-coordinator, reserve, or global-style changes to `verify:ui` only after focused ownership and journey checks pass. Page-local owners and test-helper changes remain focused; use `--full=always` for deliberate extra confidence or `--full=never` only when the dry run records why the recommended broad gate is unavailable. Physical Safari and cold-launch PWA paint still follow [phone-chrome-physical-acceptance.md](phone-chrome-physical-acceptance.md).

## Visual regression and style contracts

Appearance is verified at two levels, because they fail differently.

**Style contracts (`tests/ui-style-contract.spec.ts`) — required, deterministic.** Class rules in
`globals.css` that sit outside `@layer` are there to beat a Tailwind utility. If one is moved into a
layer it goes inert: still in the DOM, still in the class list, painting nothing. That is ledger
#094 — PR #1316 shipped the search band's accent rail inert, and the test guarding it asserted
`toHaveClass("search-band")`, i.e. the cause rather than the effect. jsdom cannot catch this (it does
not implement cascade layers) and `check:design-system-contract` cannot either (it reads source
text), so the assertions run in a real browser and read computed style. Where a rule has an
attribute-scoped variant, the contract also proves the variant wins the cascade.

`tests/style-contract-registry.test.ts` keeps the inventory closed: every unlayered visual class must
appear in `STYLE_EFFECT_CONTRACTS` or carry a reasoned exemption in
`tests/helpers/style-contracts.ts`. A newly-added unlayered class fails that test until someone
chooses which it is — the missing piece before, when the one existing rail assertion was a one-off.
Prefer deleting an exemption by adding a contract.

The parser walks back over comma-continued selector lines, so a selector list split across lines inventories every class in it, not just the one on the line that opens the block. Closing that hole immediately surfaced three previously-unpoliced classes — `dashboard-composer-edge`, `edge-glass-header` and `medication-also-matches` — which is the gate doing its job.

**Pixel baselines (`tests/ui-visual-baseline.spec.ts`) — advisory.** Run by
`playwright.visual.config.ts`, which also still runs the older attach-only
`ui-visual-artifacts.spec.ts`. Three constraints are deliberate: never `fullPage` (under CI load
Next.js leaves a hidden duplicate page root in the stream — ledger #093 — so a whole-page capture can
contain the layout twice; every target is clipped to a locator), demo mode only (the Playwright
runner forces `NEXT_PUBLIC_DEMO_MODE` and offline providers, so content is stable between runs), and
motion off with carets hidden.

Baselines are committed per platform (`tests/__screenshots__/{platform}/`). **Adopt them from the CI
job's artifact, not from a developer machine** — font hinting and antialiasing differ, and a
laptop-generated baseline makes every CI run red. A platform with no baseline fails loudly rather
than passing silently. The CI job is `continue-on-error` until the baselines have held across a few
runs; promote it by adding it to `pr-required` and dropping that flag together.

## Performance budget

`npm run verify:lighthouse` builds and serves an isolated production app in demo mode, measures the
routes in `lighthouse-budget.json` on mobile and desktop, and grades the result. It is a **relative**
gate: absolute web-vitals thresholds are meaningless against a localhost server with no network
latency, so each route is compared to a committed known-good baseline with a per-metric tolerance,
following the same shape as `check:bundle-budget`.

- No baseline recorded → warn, exit 0. Within tolerance → pass. Over tolerance → fail when
  `enforce` is true, warn otherwise.
- Incomplete evidence — a route that produced no report, a report with no LCP/CLS, or a report that
  measured a different page after a redirect — **always fails**, regardless of `enforce`. An ungraded
  route counted as a pass is the failure mode `summarise-web-vitals.mjs` documents at length.
- CLS is graded on absolute movement; LCP and TBT need to clear both a percentage and an absolute
  floor, so 12 ms → 16 ms is not reported as a 33% regression.

Refresh the baseline deliberately after a known-good run: `npm run check:lighthouse-budget -- --update`.

This is distinct from `.github/workflows/live-web-vitals.yml`, which measures the deployed origin for
ledger #017 and is dispatch-only — by the time it runs, `main` has already auto-deployed. Both pin
the same Lighthouse version, and `tests/check-lighthouse-budget.test.ts` fails if they drift apart.
Neither uses secrets or providers.

## Flake policy

`tests/flake-ledger.json` may be empty. Each entry must match the exact spec and title, and the test title must include `@quarantine` but not `@critical`. Entries require an owner, reproduction command, local tracking reference, first/last-seen dates, and an expiry no more than 30 days away. Reproduce a candidate three times on the same SHA before adding or retaining it: fix fail/pass races, treat repeatable failures as regressions, and remove entries that no longer reproduce.

## CI topology

PR CI keeps static checks separate from one required full unit run with coverage. UI scope runs a fail-fast `@critical` Chromium job on pull requests, then one required full production Chromium invocation (`test:e2e:pr`) for non-quarantined journeys, plus one advisory invocation for quarantined and mockup journeys. `src/app/api/**` does not set `ui_changed` or `db_changed` — API handlers stay on unit/coverage (and offline RAG when retrieval-scoped). The `PR required` aggregate keeps `if: always()` and distinguishes `cancelled` from `failure` in its messages (stays red; a skipped required check would count as passing). Secret Scan pins Gitleaks to the workflow event base/head SHAs and the checked-out commit, and verifies the linux_x64 release tarball against a pinned SHA-256 before install. The weekly `release-browser-matrix` depends on static/build/UI success, not on the full aggregate, so a blocking scheduled dependency audit cannot skip Firefox/WebKit. Container scope calls the reusable Docker workflow and requires both app and worker image builds through the `pr-required` aggregate. Build, migration, safety/RAG, and release behavior remain independently scoped.

Two further jobs are advisory (`continue-on-error`, deliberately outside `pr-required`): `visual-baseline` on UI scope and `lighthouse-budget` on UI-or-build scope. Both upload their evidence on every run, pass or fail, because the artifact is the whole point on a first run — the baselines to adopt and the reports to grade. Promote either to required by adding it to `pr-required` and removing `continue-on-error` in the same edit.

## Contribution checklist (UI changes)

Before opening a UI PR, confirm:

- **Reuse first.** Check `src/components/ui-primitives.tsx` (class recipes plus `IconButton`, `AsyncButton`, `InlineNotice`, `EmptyState`, `LoadingPanel`, `ToggleSwitch`) and `src/components/ui/sheet.tsx` (the only overlay primitive) before hand-rolling. Icon-only buttons use `IconButton` (its `label` is a required prop).
- **Tokens only.** No raw hex or Tailwind palette classes, no literal shadows, no `text-[Npx]` — see [`docs/design-system.md`](./design-system.md) §1–§5. `check:design-system-contract`, `check:type-scale`, and `check:icon-scale` enforce this.
- **States.** Handle loading / empty / error / disabled where they apply; async surfaces expose a retry, not a dead end.
- **Accessibility** ([design-system §7](./design-system.md)): keyboard operable, visible focus, accessible names on icon controls, live regions for async status, and reduced motion honoured — scripted `scrollTo`/`scrollIntoView` go through `resolveScrollBehavior` (`src/lib/scroll-behavior.ts`), never a hard-coded `behavior: "smooth"`.
- **Tests.** Add a `.dom.test.tsx` for changed component behaviour (see "Component tests" above) and update the E2E journeys for changed flows.
- **Unlayered CSS.** If the change adds a class rule outside `@layer` that sets a border, background, colour, shadow or outline, `tests/style-contract-registry.test.ts` will fail until it is registered. Add a rendered-effect contract rather than an exemption where the rule matters visually — see "Visual regression and style contracts".
- **Verify** ([design-system §9](./design-system.md)): run `npm run verify:cheap`, then `npm run verify:pr-local` before handoff; run `npm run ensure` before browser work and `npm run verify:ui` for UI/routing/styling changes, plus a manual dark-mode + forced-colors spot check on touched surfaces.
- Architecture and state-ownership conventions: [`docs/frontend-architecture.md`](./frontend-architecture.md).
