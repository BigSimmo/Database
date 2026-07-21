# Page and button wiring conventions

How interactive controls and routes are wired in this app, and the gates that keep them wired.
The root `AGENTS.md` (`page-and-button-wiring` block) is the short rule; this is the detail.

A repo-wide audit (2026-07-21) found the app is well-wired — the conventions below are ones the
codebase already holds to. The point of writing them down, plus the two gates, is to keep new work
from regressing: a control that advertises an action must perform one, and a page that ships must be
reachable.

## Button wiring

Every interactive `<button>` must resolve to a behaviour:

- **Action** — `<button type="button" onClick={handler}>`. `type="button"` is used for every
  non-submit button, so it does nothing on its own; it **must** carry an `onClick` (or another
  handler).
- **Form submit** — `<button type="submit">` inside a `<form onSubmit={handler}>`, where the handler
  calls `event.preventDefault()`.
- **Navigation** — wrap it in a Next `<Link>`, or call `router.push(...)` from an `onClick`. Do not
  navigate by other side channels.
- **Busy / async** — route through the shared busy-state contract in `src/components/ui-primitives.tsx`
  (spinner + `disabled` + live-region announcement), not an ad-hoc disabled flag.

For a feature that is **not yet built**, use the explicit disabled-placeholder pattern — never a fake
or empty handler. The reference markup is `favourites-hub.tsx`:

```tsx
<button
  type="button"
  aria-disabled="true"
  aria-describedby="thing-unavailable"
  className="… cursor-not-allowed opacity-60 …"
  title="Thing — coming soon"
>
  <Icon aria-hidden="true" />
</button>
<span id="thing-unavailable" className="sr-only">
  Thing is coming soon.
</span>
```

**Read-only indicators are not controls.** The shared `ToggleSwitch` (`ui-primitives.tsx`) renders an
operable `role="switch"` only when an `onToggle` is passed; without it, it is a presentational
indicator by design — a "switch" with no handler is intentional, not a dead control.

**Never** ship a styled, `aria-label`led `<button type="button">` with no handler and no disabled
state. That was the "Language and region" globe defect (`master-search-header.tsx`, fixed 2026-07-20)
and is exactly what the ESLint gate below now catches.

## Navigation and route wiring

- **Internal navigation** uses `<Link>`, `router.push` / `router.replace`, or a server `redirect()` —
  **never** a raw `<a href="/…">` to an internal route (raw anchors bypass client routing/prefetch).
- **Build hrefs from the canonical sources**, not hardcoded strings scattered across components:
  - `src/lib/app-modes.ts` (`appModeHomeHref`) — the per-mode home URL.
  - `src/lib/tools-catalog.ts` — Tools launcher tile targets.
  - `src/lib/universal-search.ts` — universal-search result hrefs.
- **Self-contained route families** may own a local builder — e.g. Therapy Compass derives every screen
  URL from `screenHref(screen)` in `src/components/therapy-compass/bindings.tsx`. Keep new destinations
  in that builder so state stays a real URL.

## Adding a new route (checklist)

1. Create the `page.tsx`.
2. **Link it from real navigation** — sidebar, a launcher tile, a mode home, search, or a `redirect()`.
   A production page with no inbound link is an **orphan** (reachable only by typing the URL).
3. Run `npm run sitemap:update` to regenerate `docs/site-map.md`.
4. Document the route in `docs/codebase-index.md` (the product-pages table).
5. The reachability gate then enforces step 2 automatically (see below).

## Mockups are exempt

Design-scratch mockups — `src/app/mockups/**` (404 in production), the `*-mockups/` component
directories, and `*-mockups.tsx` singletons — have intentionally inert buttons and are not required to
be linked. Production code may not import them (`no-restricted-imports` in `eslint.config.mjs`), and
both wiring gates skip them.

## The gates

| Gate                                       | Catches                                                   | Runs in                             |
| ------------------------------------------ | --------------------------------------------------------- | ----------------------------------- |
| `eslint-rules/require-button-wiring.mjs`   | `<button type="button">` with no handler / disabled state | `npm run lint` → `verify:cheap`, CI |
| `tests/route-reachability.test.ts`         | static production page routes with no inbound nav link    | `npm run test` → `verify:cheap`, CI |
| `tests/site-map.test.ts` / `sitemap:check` | routes / nav hrefs missing from `docs/site-map.md`        | `npm run test`, `verify:cheap`, CI  |
| `npm run check:knip`                       | dead exports / orphan modules (e.g. unused href builders) | `verify:cheap`, CI                  |

Intentional exceptions are documented, not silenced:

- An orphan route that is deliberately unlinked (a redirect target, a legacy-compat page, or a decision
  still pending) goes in the `REACHABILITY_ALLOWLIST` in `tests/route-reachability.test.ts` **with a
  reason**, and — if it is a decision to revisit — a row in `docs/outstanding-issues.md`.
- Do not silence `require-button-wiring` with a blanket disable — wire the control, or make it an
  explicit disabled placeholder.

## Known wiring debts

Tracked in `docs/outstanding-issues.md` (`/issues`): the `/tools` vs `/?mode=tools` duplicate Tools
entry point, the unused `document-flow-routes.ts` href builders, the server-only `/api/jobs` endpoint,
and the un-built "coming soon" placeholders across forms/favourites.
