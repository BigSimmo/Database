# Developer hub — ingestion panel

Date: 2026-08-25
Status: planned, not started.
Scope: **one** panel — `ingestion`. Phase 3's other panel, `database-drift`, is deliberately not built; see §2.

## 1. What this answers, and why it is worth building

There is no surface anywhere in the product that answers **"did my document actually index?"**

`/api/ingestion/jobs` has served that data since long before this plan. Nothing renders it. The owner uploads a
clinical document and then has no way to see whether it is queued, processing, finished, or stuck, short of
querying the database by hand.

The automatic recovery job (`.github/workflows/ingestion-autopilot.yml`, every 6 hours) repairs jobs that get
stuck. That is not the same fact. It does not tell anyone what is queued right now, what keeps failing, or
whether the upload from ten minutes ago is done.

So this panel passes the hub's own Ruling R1 — it renders a fact no green gate already guarantees.

## 2. Why `database-drift` is NOT built, recorded so nobody rebuilds it by accident

`.github/workflows/live-drift.yml` already **creates a GitHub issue** when it detects drift, updates that issue
on later runs, and comments on it (lines 135–188). It runs weekly, on demand, and whenever a schema change
reaches `main`. A drift panel would restate a fact an existing gate both guarantees and pushes to the owner.

That is precisely what Ruling R1 exists to prevent, and it is the same reasoning that removed orphan-route
reporting and broken-link listing from Phase 2. If drift alerts ever start being missed, the case reopens —
but the fix then is the alert, not a second place to look.

## 3. The decision this panel turns on: live, not snapshotted

Every Phase 2 panel reads a build-time JSON snapshot. **This one cannot.** A job that was stuck when the
snapshot was written may be finished by the time anyone looks, and a snapshot regenerated at build time would
be wrong within seconds. A panel that confidently displays stale job state is worse than no panel.

**Ruling I1 — the panel is a Client Component that fetches `/api/ingestion/jobs`.** Not a Server Component
querying Supabase directly. Three reasons, in order of weight:

1. **Polling is the point.** The question is "is it done _yet_", which needs re-asking. The endpoint already
   returns `pollAfterMs` (`ACTIVE_INDEXING_POLL_MS`) and `hasActiveJobs`, so the refresh cadence is a value the
   server hands us rather than a number this panel invents.
2. **The auth already works.** The endpoint calls `requireAuthenticatedUser(request, supabase, { administrator: true })`
   and scopes every row by `documents.owner_id`. A browser fetch carries the session cookie, so the panel
   inherits that scoping for free. A Server Component would have to re-derive it, and duplicated authorization
   is how authorization drifts.
3. **It adds no new data path.** The route exists and is in production. This is a page rendering an endpoint the
   app already serves.

Cost if wrong: the hub gains its first client bundle. That is a real cost — every Phase 2 page ships zero client
JavaScript — but it is small, confined to one route under `/mockups/development/**` which is excluded from the
production bundle budget, and the alternative buys nothing back.

## 4. The part that is actually hard: four states, not one

The endpoint can legitimately return nothing for four different reasons, and **a reader must be able to tell
them apart**. Collapsing them into one blank list is the exact `#338` failure the whole developer hub exists to
prevent, and it is the requirement most likely to be quietly skipped.

| Condition                                                                           | What the panel must say                                                                     |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Demo mode — no Supabase configured. Endpoint returns `{ demoMode: true, jobs: [] }` | That the app is not connected to a database, so job state is unknowable — **not** "no jobs" |
| Not signed in, or signed in without administrator rights → `401`/`403`              | That live job state needs an administrator sign-in, with a link to sign in                  |
| Connected, authorised, genuinely zero rows                                          | "No ingestion jobs" in words                                                                |
| The fetch itself failed (network, 500)                                              | That the panel could not reach the endpoint, and that this says nothing about the jobs      |

The second row is not hypothetical in development: `DeveloperAreaGate` is a **no-op** outside production
(`mockupsEnabled()`), while the endpoint enforces administrator auth in **every** environment. So locally the
page renders and the fetch 401s. That mismatch is the normal local experience and must read as an explanation,
never as an error or an empty list.

## 5. Status values are free text — do not switch on them exhaustively

`ingestion_jobs.status` is a plain `string` in `database.types.ts`, not an enum. The route knows only that
`["pending", "processing"]` are active (`ACTIVE_JOB_STATUSES`).

**Ruling I2 — any status the panel does not recognise is rendered under its own heading, verbatim, never
dropped.** Same rule, same reason, and the same shape as the `otherPages` bucket the routes page already uses
for an unrecognised `area`: `src/app/mockups/development/routes/page.tsx`. Copy that shape, including the
identity-keyed split and the note explaining that the rows are shown rather than discarded so the list still
adds up to the count above.

This must be tested with a **crafted fixture**, because live data cannot produce an unknown status on demand.
The sanctioned technique is a `vi.hoisted`/`vi.mock` override of only the data-fetching boundary, with every
assertion running against the real unmocked component — `tests/developer-routes-page.dom.test.tsx` is the
worked example. Mocking the component under test proves nothing.

## 6. Shape

**Created**

| Path                                                    | Responsibility                                                           |
| ------------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/app/mockups/development/ingestion/page.tsx`        | Server Component: `metadata`, `PanelPageShell`, renders the client panel |
| `src/components/developer-area/hub/ingestion-panel.tsx` | `"use client"` — fetch, poll, the four states, the unknown-status bucket |
| `tests/developer-ingestion-page.dom.test.tsx`           | The four states, the unknown-status bucket, the poll cadence             |

**Modified**

| Path                                                    | Change                                                                                  |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/lib/developer-area/hub-panels.ts`                  | `ingestion` flips `phase: 3` → `phase: 1` with `href: "/mockups/development/ingestion"` |
| `tests/developer-hub-panels.test.ts`                    | Assertions for the flip                                                                 |
| `docs/codebase-index.md`                                | Entries for the new page and component                                                  |
| `docs/site-map.md`, `data/repo-awareness-snapshot.json` | Regenerated — this task adds a route                                                    |

**Deliberately unchanged:** `src/app/api/ingestion/jobs/route.ts`. If the panel needs a field the endpoint does
not return, that is a separate change with its own review — do not widen an authenticated admin endpoint as a
side effect of building a page.

## 7. Constraints inherited from Phase 2, each one earned

- **The page stays a Server Component.** It renders the client panel; it must not itself carry `"use client"`,
  and must never import _data_ from a client module. Phase 1 shipped two of these past every gate.
- **`npm run build` is mandatory acceptance.** It is the only gate that sees a Server/Client boundary fault, and
  on Phase 2 it caught a page exporting a helper — invisible to typecheck, Vitest and lint. Read both signals:
  a failing build still prints `Compiled successfully`, which only means webpack finished.
- **A live render is mandatory acceptance.** These routes are Dynamic, so they are compiled but never rendered
  at build time. Only a real request catches a serialised handler — and this panel has handlers.
- **Regenerate and commit the snapshot** (Ruling S1). The route list changes.
- **Design tokens only**, no hex. **Tap targets `min-h-12`**, never `min-h-11`. **Every `<button>` wired.**
  **Internal navigation uses `<Link>`.** **`PanelPageShell` needs `freshnessLabel`** — it is required now.
- **Counts render as given.** If the endpoint returns `activeJobCount`, show that rather than recomputing a
  length that could disagree with it.

## 8. Freshness means something different here

Every other panel stamps "content as of <build time>". This one is live, so the honest stamp is **when the data
was last fetched**, updating as it polls. Do not reuse the build-time freshness value — it would be true of the
page and false of the numbers on it.

## 9. Acceptance

1. `npm run build` — exit 0, no `Failed to type check`, the new route present.
2. Live render of `/mockups/development/ingestion` — 200, zero `Event handlers cannot be passed`.
3. All four states exercised by tests, at least three of them by crafted fixture.
4. `npm run check:repo-awareness-snapshot` — in step, after regenerating.
5. `npm run verify:pr-local`, then `npx prettier --write` on changed files **and commit the result** — formatting
   is in no other gate and has reddened this work twice.

## 10. Known trap, from the Phase 2 acceptance run

The snapshot gate goes red on any PR that sits while `main` advances, because the route list and
`docs/branch-review-records/` are generator inputs that grow on nearly every merge. Expect to merge `main` and
regenerate once, late, before asking for review. This is logged as its own outstanding issue; if that issue is
fixed first, this trap disappears.
