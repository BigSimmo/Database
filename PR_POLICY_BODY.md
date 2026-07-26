## Summary

- Implements audit remediation for provenance and safety: locality metadata verification tooling, centralized source-governance codes/UI tokens, expanded threshold disagreement handling, and citation/source-open telemetry.
- Keeps live Supabase locality auditing explicit via `check:locality-metadata` and out of the unconditional offline `verify:pr-local` base script.
- Follow-up babysit fixes preserve threshold comparator direction and inclusivity, harden false-positive source-governance threshold extraction, and stabilize PR-scoped UI assertions.

RAG impact: no retrieval behaviour change — provenance/governance UI tokens, citation telemetry, and locality audit only; ranking/imputation formulas untouched

## Verification

- [x] `npm run test -- tests/evidence.test.ts` — PASS (26/26) after threshold false-positive hardening.
- [x] Focused Vitest evidence/source metadata — PASS (67/67) after inclusivity/source telemetry fixes.
- [x] `npm run typecheck` — PASS.
- [x] `npm run format:check` — PASS.
- [x] `npm run lint` — PASS.
- [x] `npm run build` — PASS.
- [x] `npm run check:rag:fixtures` — PASS.
- [x] `npm run check:branch-review-ledger` — PASS after the append-only ledger clarification.
- [x] Focused Production UI reruns for `tests/ui-tools.spec.ts` — PASS for the PR-scoped strict-locator failures.
- [x] Hosted CI on head `a4c5f286`: Static PR, Safety and config, Unit coverage, Build, app image, Production UI, Migration replay, SAST, and secret scans passed.
- [ ] `npm run verify:pr-local` — not rerun after the latest docs-only ledger clarification; narrower checks above cover the touched file.
- [ ] `npm run verify:ui` — not rerun as the full local gate; focused production UI reruns and hosted Production UI passed.
- UI verification not run: full local `npm run verify:ui` was not rerun after the docs-only ledger clarification; focused production UI reruns and hosted Production UI passed.
- [ ] `npm run verify:release` — not run; release gate is out of scope for PR babysitting and includes provider-backed checks.
- [ ] `npm run eval:retrieval:quality` — not run; no retrieval/ranking behaviour change is intended and live provider-backed eval was not authorized.
- [ ] `npm run check:production-readiness` — attempted earlier and blocked by missing local Supabase/OpenAI env secrets; no live provider-backed rerun performed.

## Risk and rollout

- Risk: clinical/source-governance metadata changes can affect warnings and telemetry presentation; comparator parsing changes are covered by focused regressions and do not alter RAG ranking/imputation formulas.
- Rollback: revert the PR commits; the live locality audit remains an explicit script and is not part of offline PR-local verification.
- Provider or production effects: No OpenAI calls, live Supabase mutations, provider-backed evals, deployments, or production data changes were performed.

## Clinical Governance Preflight

- [x] Source-backed claims still require linked source verification before clinical use
- [x] No patient-identifiable document workflow was introduced or expanded without explicit governance approval
- [x] Supabase target remains `Clinical KB Database` (`sjrfecxgysukkwxsowpy`)
- [x] Service-role keys and private document access remain server-only
- [x] Demo/synthetic content remains clearly separated from real clinical sources
- [x] Source metadata, review status, and outdated/unknown-source behavior remain conservative
- [x] Deployment classification/TGA SaMD impact was checked when clinical decision-support behavior changed

## Notes

- Remaining merge blockers at the time this body was prepared: direct review-thread reply/resolution was unavailable in this Cursor run, and the prior hosted worker-image failure was a Docker Hub/BuildKit timeout rather than a code failure.
