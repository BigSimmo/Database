## Summary

- Integrates the reviewed 55-row P2/P3 remediation programme on top of current main while preserving its commit history and evidence trail.
- Queues 20 active `done` requests and two active open updates: `#SBKXZ7` and `#6GW95D`. Immutable cancellation chains remain auditable; the batch simulation has no active conflicts.
- Ships the associated reliability work across report-only worktree tooling, dead-code and migration diagnostics, Therapy review governance, Docling v2 hard-table fixtures, PreCompact capture correction, and focused UI ownership contracts.
- Preserves both main-side Clinical Operations / Therapy Recommend changes and this branch changes in the four overlap owners.
- Outstanding-issues snapshot was regenerated for CI; canonical ledger reconciliation still belongs to the dedicated process after merge.

## Verification

- [x] Hosted `PR required` on `b4be0513` passed Static PR checks, Safety, Unit coverage, Build, Production UI, Lighthouse, and container build before the later main sync.
- [x] `npm run format`
- [x] `npm run docs:check-inventory`
- [x] `node scripts/ledger-inbox.mjs check`
- [x] `git diff --check origin/main...HEAD`
- [ ] UI verification not run: focused UI ownership tests plus hosted Production UI CI
- [ ] Verification not run: `npm run verify:release` is a release/handoff gate, not this PR publication
- RAG impact: no retrieval behaviour change — documentation and governance-plan parity only; retrieval RPCs, ranking code, golden fixtures, and answer generation are unchanged.

## Risk and rollout

- Risk: Medium. This is a broad integration of already reviewed local remediations. Therapy clinical review remains explicitly incomplete at 205 `needs_review`, 0 reviewed.
- Rollback: Revert this PR or its coherent task commits. There are no database migrations, deployments, provider writes, or production mutations.
- Provider or production effects: None.
- RAG impact: no retrieval behaviour change — documentation and governance-plan parity only.

## Clinical Governance Preflight

- [x] Source-backed claims still require linked source verification before clinical use
- [x] No patient-identifiable document workflow was introduced or expanded without explicit governance approval
- [x] Supabase target remains `Clinical KB Database` (`sjrfecxgysukkwxsowpy`)
- [x] Service-role keys and private document access remain server-only
- [x] Demo/synthetic content remains clearly separated from real clinical sources
- [x] Source metadata, review status, and outdated/unknown-source behavior remain conservative
- [x] Deployment classification/TGA SaMD impact was checked when clinical decision-support behavior changed

## Notes

- Current with `origin/main` `576ac7b513984fe826ddd51d3880e89d53144469`; no rebase or squash.
- `PR_POLICY_BODY.md` is a transient CI sync template so the hosted PR description can carry the canonical preflight; it is not product content.
