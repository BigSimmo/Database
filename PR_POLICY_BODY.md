## Summary

- Record the four already-completed production RAG/search index repairs in repository migration history without rebuilding them inside a transaction.
- Make the forward migration fail fast when any required index is absent, invalid (`indisvalid`/`indisready`), or non-canonical versus the pinned definition; a drifted hosted target must prebuild missing indexes with `CREATE INDEX CONCURRENTLY` outside the migration transaction, validate them, and only then mark the version applied.
- Keep fresh replays deterministic through the earlier canonical reconciliation migration and `schema.sql`.
- Pin normalized full index definitions across the canonical migration, `schema.sql`, and `drift-manifest.json`, while separately pinning the mark-applied guard.

RAG impact: no retrieval behaviour change — full definitions are pinned but unchanged; the guard validates presence, validity, and canonical match only.

## Verification

- [x] Secret Scan / SAST at prior heads
- [x] Prior CI run 8043 passed at `f932897760ff667ddecd5d5db405303761a1b82a`
- [x] `npm run check:rag:fixtures` — 36 golden cases, 23 suites
- [x] `npm run check:migration-role`
- [x] `npm run test -- tests/supabase-schema.test.ts` — 74/74 after validation + normalizer fix
- [x] Prior live `search_schema_health()` — `ok: true`, `missing: []` (pre-fix evidence)
- [x] Prior live index validation — all four indexes `indisvalid=true` and `indisready=true` (pre-fix evidence)
- [ ] Fresh GitHub CI at exact current head after the validation repair push
- Verification not run: `npm run eval:retrieval:quality` — not required because no retrieval/ranking SQL, comparator, or index definition changes
- UI verification not run: no UI, routing, styling, or browser behavior changes

## Risk and rollout

- Risk: medium; clinical-risk path via supabase migration history, but the migration creates no indexes and only validates already-built objects.
- Rollback: leave this version unapplied, or ship a separately approved forward migration/operator procedure; do not drop or rebuild live indexes as rollback for this history marker.
- Provider or production effects: merging alone performs no provider calls and no database writes. A later migration apply only validates object presence/validity/definition on a target where this version is not already recorded.

## Clinical Governance Preflight

- [x] Source-backed claims still require linked source verification before clinical use
- [x] No patient-identifiable document workflow was introduced or expanded without explicit governance approval
- [x] Supabase target remains `Clinical KB Database` (`sjrfecxgysukkwxsowpy`)
- [x] Service-role keys and private document access remain server-only
- [x] Demo/synthetic content remains clearly separated from real clinical sources
- [x] Source metadata, review status, and outdated/unknown-source behavior remain conservative
- [x] Deployment classification/TGA SaMD impact was checked when clinical decision-support behavior changed

## Merge gate

Do not merge until fresh exact-head CI passes and migration-safety review threads are verified against the current head.
