## Summary

- Finish audit remediation after syncing with `main`: fail-closed clinical-notes trust gating (clear free-text answer when not source-backed), SettingsStateProvider extraction under the ClinicalDashboard maintainability budget, z-index ladder lint rule, shared UI primitives, and phone-chrome breakpoint restoration.

## Verification

- [x] `npm run verify:cheap` — passed after merge + trust-gate / phone-chrome / budget fixes
- [x] Focused Vitest: visual-evidence trust gating, privacy UI, private-access routes, account-access model, clinical-dashboard merge artifacts, dashboard-scroll-padding
- UI verification not run: Chromium UI gate deferred; phone-chrome/unit contracts covered offline; `verify:ui` still recommended before merge confidence
- Verification not run: `npm run verify:pr-local` not yet completed in this sweep (unit suite already green via verify:cheap)

## Risk and rollout

- Risk: medium — clinical-notes trust gating is intentionally stricter for non-source-backed answers; SettingsStateProvider changes dashboard chrome state ownership
- Rollback: revert this PR branch
- Provider or production effects: None

## Clinical Governance Preflight

- [x] Source-backed claims still require linked source verification before clinical use
- [x] No patient-identifiable document workflow was introduced or expanded without explicit governance approval
- [x] Supabase target remains `Clinical KB Database` (`sjrfecxgysukkwxsowpy`)
- [x] Service-role keys and private document access remain server-only
- [x] Demo/synthetic content remains clearly separated from real clinical sources
- [x] Source metadata, review status, and outdated/unknown-source behavior remain conservative
- [x] Deployment classification/TGA SaMD impact was checked when clinical decision-support behavior changed

## Notes

- Merged `origin/main` and resolved conflicts; restored upload publisher null-minting (undefined `canonicalAuthority` merge hazard)
- Bugbot/proactive review: no `cursor[bot]` threads; fixed phone-chrome `@max-@sm` regression and privacy notice z-index stacking
