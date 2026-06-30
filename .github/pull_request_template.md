## Summary

-

## Verification

- [ ] `npm run verify:cheap`
- [ ] `npm run verify:ui` when UI, routing, styling, browser behavior, reduced-motion, or forced-colors behavior changed
- [ ] `npm run verify:release` before release or handoff confidence claims
- [ ] `npm run format:check`
- [ ] `npm run check:production-readiness` when clinical workflow, privacy, environment, Supabase, source governance, or deployment behavior changed
- [ ] `npm run check:deployment-readiness` when deployment startup, hosting, or rollout behavior changed

## Clinical Governance Preflight

Complete this section when the change touches ingestion, answer generation, search/ranking, source rendering, document access, privacy, production env, or clinical output.

- [ ] Source-backed claims still require linked source verification before clinical use
- [ ] No patient-identifiable document workflow was introduced or expanded without explicit governance approval
- [ ] Supabase target remains `Clinical KB Database` (`sjrfecxgysukkwxsowpy`)
- [ ] Service-role keys and private document access remain server-only
- [ ] Demo/synthetic content remains clearly separated from real clinical sources
- [ ] Source metadata, review status, and outdated/unknown-source behavior remain conservative
- [ ] Deployment classification/TGA SaMD impact was checked when clinical decision-support behavior changed

## Notes

-
