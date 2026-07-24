# Clinical KB Production Readiness Checklist (Executable Today)

**Status: reusable release-candidate checklist, not an outstanding-task ledger.** Live/provider-gated
action detail is indexed in [`operator-backlog.md`](operator-backlog.md); canonical task status is
tracked only in [`outstanding-issues.md`](outstanding-issues.md).
Unchecked boxes below are rerun per release candidate; they do not imply abandoned repository work.

This is the runbook to make the app publishable in one focused pass.

Last reviewed: 2026-07-10. Applies to any feature branch or release candidate.

- Runtime target: Next.js 16.2.11, Node 24.x, npm 11.x.
- Supabase target: `sjrfecxgysukkwxsowpy` (`Clinical KB Database`).

## Immediate completion targets

- [x] Security headers are enforced at the framework layer (`next.config.ts`).
  - `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
    `Cross-Origin-*`, `Permissions-Policy`, and `Origin-Agent-Cluster`.
- [x] Server-side headers exposure is reduced (`X-Powered-By` disabled).
- [x] Added one-command production preflight:
  - `npm run check:production-readiness`
  - runs env validation, Supabase target checks, lockfile/env-file presence checks, and placeholder checks.
- [x] Added deployment startup readiness gate:
  - `npm run check:deployment-readiness`
  - verifies `next start` boot behavior and local project identity guard on a managed local port.
- [x] Added README-visible command for readiness preflight.
- [x] Added CI-safe production preflight:
  - `npm run check:production-readiness:ci`
  - used in CI and non-blocking on local-only secret absence.
- [x] Added strict runtime release gate:
  - `npm run check:runtime`
  - enforces Node 24.x and npm 11.x before broad local and release verification.

## Remaining high-priority publish items (same day)

- [ ] Run the readiness preflight with fully populated `.env.local`.
- [ ] Run `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.
- [ ] Run `npm run eval:quality -- --fail-on-threshold` for strict clinical search/answer/source-governance confidence, or `npm run eval:quality:release` only when the active release metadata debt file is accepted.
- [ ] Run browser smoke verification for auth + search + answer formatting after final changes.
- [ ] Confirm no production-only WIP flags (e.g., local no-auth modes) are enabled in deployment
      environment variables.
- [ ] Add deployment/runbook checks for observability, alerts, and rollback.

## Execution flow for a publish candidate

1. `npm run ensure` (capture the published local URL if browser checks are needed).
2. `npm run check:runtime`.
3. `npm run check:production-readiness`.
4. `npm run check:supabase-project`.
5. `npm run check:document-label-coverage`.
6. `npm run lint`.
7. `npm run typecheck`.
8. `npm run test`.
9. `npm run build`.
10. `npm run eval:quality -- --fail-on-threshold` after cheaper local gates pass, or `npm run eval:quality:release` when the active release metadata debt file is intentionally accepted.
11. `npm run check:deployment-readiness`.
12. `npm run check:production-readiness:ci` (CI context only).
13. Frontend browser smoke:

- auth flow
- protected endpoint behavior
- search + answer render path
- mobile viewport

14. Staging deployment smoke + rollback rehearsal.

## Command outputs to record

- `scripts/production-readiness.ts` result: PASS / WARN / FAIL.
- `scripts/check-runtime.ts` result: PASS / FAIL.
- `scripts/check-document-label-coverage.ts` result: PASS / FAIL and missing-label counts.
- `npm run lint` output.
- `npm run typecheck` output.
- `npm run test` output.
- `npm run build` output.
- `npm run eval:quality -- --fail-on-threshold` or `npm run eval:quality:release` output, including source-governance warning baseline if warnings remain.
- Active source metadata debt file path and expiry, if `eval:quality:release` was used.
- Any blocking warnings from readiness preflight should be cleared before publishing.
