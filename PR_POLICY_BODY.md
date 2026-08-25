## Summary

- refine shared segmented controls and switches with compact, symmetric inset geometry
- add the reusable `ChoiceChip` primitive and migrate patient-profile, result-filter, and Therapy Compass selection surfaces
- register the new primitive in design-sync, adoption documentation, previews, and focused contracts

## Verification

- [ ] `npm run verify:pr-local` — not run for this bare PR publication request
- [x] `npm run verify:ui` — 561/561 Chromium production journeys passed
- [ ] `npm run verify:release` — not run; release confidence was not requested
- `npm run typecheck` — passed
- focused DOM/component coverage — passed
- `npm run check:design-system-contract` — passed, including adoption and design-sync checks
- `git diff --check` — passed

## Risk and rollout

- Risk: Low-to-moderate shared UI presentation risk; behavior and clinical logic are unchanged.
- Rollback: Revert commit `6477ff1b0`.
- Provider or production effects: None.
- RAG impact: no retrieval behaviour change — presentation-only selection controls; no RAG ranking/retrieval/answer-pipeline surfaces touched.

## Clinical Governance Preflight

- [x] Source-backed claims still require linked source verification before clinical use
- [x] No patient-identifiable document workflow was introduced or expanded without explicit governance approval
- [x] Supabase target remains `Clinical KB Database` (`sjrfecxgysukkwxsowpy`)
- [x] Service-role keys and private document access remain server-only
- [x] Demo/synthetic content remains clearly separated from real clinical sources
- [x] Source metadata, review status, and outdated/unknown-source behavior remain conservative
- [x] Deployment classification/TGA SaMD impact was checked when clinical decision-support behavior changed

Rationale: each item remains unchanged because this is UI presentation/selection-control work only (`ChoiceChip`, segmented controls, switches). It does not alter ingestion, retrieval, ranking, answer generation, document access, privacy controls, source metadata behavior, or deployment/SaMD classification.

## Notes

- The final push guard did not repeat static checks because another worktree held the heavyweight run coordinator (`DATABASE_HEAVY_RUN_ADMISSION_BUSY`). CI remains authoritative; no guard was bypassed.

<!-- CURSOR_SUMMARY -->

---

> [!NOTE]
> **Low Risk**
> Presentation and shared UI primitives only; selection semantics stay the same and tests/contracts were extended, with no auth, data, or clinical pipeline changes.
>
> **Overview**
> Introduces **`ChoiceChip`** as a registered design-system control for compact **many-of-many** selection (`pressed` / `onPressedChange`, `aria-pressed`, optional `aria-disabled` with explanation, 48px tap floor, soft accent when selected). Patient profile allergies, result-filter facets, and Therapy Compass constraint/section toggles now use it instead of one-off styled buttons.
>
> **`SegmentedControl`** and **`ToggleSwitch`** get matching **inset, rounded-lg** selection geometry (soft accent inset vs full saturated capsule; switch track border/inset shadow and square-ish focus hit target). Patient profile switches hepatic impairment to **`layout="equal"`** and tightens the pregnancy/breastfeeding/clear row for narrow widths.
>
> Design-sync exports, previews, adoption manifests/docs, and DOM/filter contracts are updated for the 55th public component; clinical logic and filter behavior are unchanged aside from shared markup/styling.
>
> <sup>Reviewed by [Cursor Bugbot](https://cursor.com/bugbot) for commit 6477ff1b0d6e8d474e5f3ac8bd55b7d2ec2e5d7e. Configure [here](https://www.cursor.com/dashboard/bugbot).</sup>

<!-- /CURSOR_SUMMARY -->

<!-- This is an auto-generated comment: release notes by coderabbit.ai -->

## Summary by CodeRabbit

- **New Features**
  - Added reusable choice chips with pressed, unavailable, compact, icon, and accessibility states.
  - Added choice-chip controls for allergy selection, result filters, recommendation constraints, and therapy sections.
- **UI Improvements**
  - Updated segmented controls with compact rails and clearer selected-state styling.
  - Refined toggle switch borders, shadows, sizing, and rounded corners.
  - Improved responsive patient-profile layouts with equal-width segments and better mobile positioning.
- **Accessibility**
  - Improved focus, keyboard behavior, pressed-state announcements, and unavailable-option handling for choice chips.

<!-- end of auto-generated comment: release notes by coderabbit.ai -->
