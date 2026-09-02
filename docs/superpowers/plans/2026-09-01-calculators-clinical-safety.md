# Calculators clinical safety and governance implementation plan

> Execute test-first on `codex/calculators-clinical-safety-governance`. Do not merge, deploy or run live-provider checks.

## Task 1 — Pin the clinical contract

**Files**

- Add `docs/superpowers/specs/2026-09-01-calculators-clinical-safety.md`
- Add `docs/superpowers/plans/2026-09-01-calculators-clinical-safety.md`

Record the product boundary, current tool dispositions, completion rules, evidence/rights schema and definition of done.

## Task 2 — Add failing safety regression tests

**Files**

- Add `tests/calculators-clinical-safety.test.tsx`
- Update `tests/calculators-mode.dom.test.tsx`
- Update shared-home copy tests as required

Tests must prove:

- active catalogue excludes `sadpersons`, `ybocs`, and rights-blocked `mdq`
- partial PHQ-9/GAD-7 have no final band or actions
- PHQ-9 item 9 alert survives incomplete status
- MDQ impairment-only is incomplete and never negative
- explicit complete MDQ negatives remain negative in the quarantined fixture
- every active calculator has evidence, version, rights and review metadata
- every claim/source reference resolves
- score-band text contains no deterministic treatment/disposition language
- copy-result is disabled until completion
- safe home and privacy copy render

Observe hosted CI fail against current implementation before production edits.

## Task 3 — Introduce the evidence-governed fixture model

**Files**

- Replace `src/components/calculators/calculator-fixtures.ts`
- Add `src/components/calculators/calculator-evidence.ts`
- Add `data/calculators/evidence.json`

Implement:

- active, quarantined and planned registries
- exact completion policies
- structured source/claim/rights/review metadata
- corrected Australian clinical copy
- active set limited to PHQ-9, GAD-7, K10, CAGE and AUDIT-C

## Task 4 — Correct scoring and incomplete states

**Files**

- Update `src/components/calculators/calculator-ui.tsx`

Implement:

- instrument-specific completion
- no band/guidance before completion
- MDQ explicit-answer requirement
- immediate safety flags
- disabled copied result until completion
- explicit incomplete result vocabulary
- progress labels that distinguish answered from endorsed

## Task 5 — Separate interpretation from management

**Files**

- Replace `src/components/calculators/calculator-pathways.ts`
- Update `src/components/calculators/search-detail.tsx`
- Update `src/components/calculators/calculator-sheet.tsx`

Implement:

- `Clinical consideration` records with claim/source IDs
- no deterministic prescribing/ECT/admission/discharge/referral actions
- no considerations until completion
- evidence metadata at point of use
- “Clinical considerations” rather than “Score-linked actions”

## Task 6 — Correct live search/home/privacy copy

**Files**

- Update `src/components/calculators/search-page.tsx`
- Update `src/lib/ui-copy.ts`
- Update affected tests

Use safer home, privacy and about-copy. Planned tools are described as governance-gated rather than “coming next.”

## Task 7 — Add executable content contract

**Files**

- Add `tests/calculator-content-contract.test.ts`
- Add `scripts/check-calculator-content.mjs`
- Add package script if repository conventions permit

Fail on:

- unresolved claim/source IDs
- active unknown/blocked rights status
- unsafe active IDs
- forbidden deterministic management language
- expired review metadata
- missing Australian alcohol definition
- modified/unverified instruments exposed as validated

## Task 8 — Verify and hand off

Run:

1. focused calculator safety/content tests
2. formatting
3. typecheck if the type contract changed
4. clinical proof workflow for affected files
5. `verify:pr-local` selected by changed paths

Use hosted CI where local execution is unavailable. Record exact checks and limitations in the PR. Do not merge.
