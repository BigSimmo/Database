# `/api/jobs` — intentional ops/admin surface

**Decision (2026-07-24):** Keep `GET /api/jobs`. It is a deliberate server/ops surface, not an abandoned client API and not a product UI dependency.

## Evidence

- Route: `src/app/api/jobs/route.ts`.
- Auth: live mode requires an authenticated **administrator** via `requireAuthenticatedUser(..., { administrator: true })`, then scopes rows with `documents.owner_id = user.id`.
- Demo mode returns paginated `demoJobs` only when `isDemoMode()` is true; a partially configured production path fails closed (no unauthenticated demo bleed — S11/H6).
- Product UI polls **`/api/ingestion/jobs`**, not `/api/jobs` (`ClinicalDashboard.tsx`).
- Repo search finds **no client `fetch("/api/jobs")`**. Callers are tests (`tests/api-route-coverage.test.ts`, `tests/api-validation-contract.test.ts`, `tests/public-access-deep.test.ts`) plus ops/docs inventory.

## Why keep it

- Distinct from the ingestion collection used by the dashboard (`/api/ingestion/jobs`).
- Covered by tenancy and API validation contracts; removing it would churn CI/docs without a product win.
- Useful for manual/admin job inspection with administrator credentials.

## Contract for future work

- Do **not** wire a client product surface to `/api/jobs` without an explicit product decision.
- Prefer `/api/ingestion/jobs` for in-app indexing status.
- If this route is ever deleted, update `docs/site-map.md` (via `scripts/generate-site-map.ts`), `docs/codebase-index.md`, `docs/wiring-conventions.md`, tenancy review references, and the API contract tests in the same change.
