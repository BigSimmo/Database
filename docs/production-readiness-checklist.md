# Clinical KB Production Readiness Checklist (Executable Today)

This is the runbook to make the app publishable in one focused pass.

- Branch: `codex/premium-redesign` (do not touch `.env` / secrets directly).
- Runtime target: Next.js 16.2.7, Node 22.x, npm >= 10.
- Supabase target: `sjrfecxgysukkwxsowpy` (`Clinical KB Database`).

## Immediate completion targets

- [x] Security headers are enforced at the framework layer (`next.config.ts`).
  - `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
    `Cross-Origin-*`, `Permissions-Policy`, and `Origin-Agent-Cluster`.
- [x] Server-side headers exposure is reduced (`X-Powered-By` disabled).
- [x] Added one-command production preflight:
  - `npm run check:production-readiness`
  - runs env validation, Supabase target checks, lockfile/env-file presence checks, and placeholder checks.
- [x] Added README-visible command for readiness preflight.
- [x] Added CI-safe production preflight:
  - `npm run check:production-readiness:ci`
  - used in CI and non-blocking on local-only secret absence.
- [x] Added strict runtime release gate:
  - `npm run check:runtime`
  - enforces Node 22.x before `npm run verify:release`.

## Remaining high-priority publish items (same day)

- [ ] Run the readiness preflight with fully populated `.env.local`.
- [ ] Run `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.
- [ ] Run browser smoke verification for auth + search + answer formatting after final changes.
- [ ] Confirm no production-only WIP flags (e.g., local no-auth modes) are enabled in deployment
      environment variables.
- [ ] Add deployment/runbook checks for observability, alerts, and rollback.

## Execution flow for a publish candidate

1. `npm run ensure` (capture the published local URL if browser checks are needed).
2. `npm run check:runtime`.
3. `npm run check:production-readiness`.
4. `npm run check:supabase-project`.
5. `npm run lint`.
6. `npm run typecheck`.
7. `npm run test`.
8. `npm run build`.
9. `npm run check:production-readiness:ci` (CI context only).
10. Frontend browser smoke:

- auth flow
- protected endpoint behavior
- search + answer render path
- mobile viewport

11. Staging deployment smoke + rollback rehearsal.

## Command outputs to record

- `scripts/production-readiness.ts` result: PASS / WARN / FAIL.
- `scripts/check-runtime.ts` result: PASS / FAIL.
- `npm run lint` output.
- `npm run typecheck` output.
- `npm run test` output.
- `npm run build` output.
- Any blocking warnings from readiness preflight should be cleared before publishing.
