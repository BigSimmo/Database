# SaMD classification — patient-info medication considerations

**Status:** OPEN — awaiting human/regulatory decision. This note tracks the
consideration; it does **not** assert a classification.

## Context

PR #620 added a patient-info → medication considerations feature (merged to
`main`):

- A patient-profile panel (age, renal function, hepatic severity, QTc,
  pregnancy/lactation, allergy classes) on the medication detail page
  (`/medications/[slug]`) and the prescribing search workspace.
- A pure evaluation engine (`src/lib/medication-patient-alerts.ts`) that matches
  the entered profile against the source-backed patient-match metadata already
  in `data/medications-snapshot.json` and surfaces tone-coded considerations.

This is the app's first **patient-specific decision-support surface**: output is
tailored to individual patient parameters rather than presenting the same
reference content to everyone.

## Why this needs a classification decision

Software that provides patient-specific treatment/prescribing recommendations
can fall within the definition of Software as a Medical Device (SaMD) under the
Australian TGA framework (and equivalent frameworks elsewhere). Whether this
feature does depends on intended-use and claims — a regulatory/clinical
determination, not an engineering one.

Mitigations already in the shipped feature (relevant to any assessment, not a
substitute for it):

- Every consideration renders the source-backed `note` and a persistent
  "Decision support, not medical advice" disclaimer.
- The profile is anonymous physiology only (no PHI), session-scoped, cleared on
  tab close.
- Missing inputs surface as "unassessed" rather than as an all-clear — the tool
  never implies a contraindication was ruled out on absent data.

## Open questions for the reviewer

1. Does the intended use / product claim bring this within SaMD scope for the
   TGA (and any other target jurisdiction)?
2. If in scope, what classification and obligations apply, and do the current
   disclaimers/UX need to change?
3. Should there be an explicit intended-use statement surfaced in-product?

## Owner / next step

- **Owner:** to be assigned by the repository maintainer (a named clinical +
  regulatory reviewer must be recorded here — "requires a reviewer" is not an
  accountable assignment).
- **Target review-by date:** to be set at triage; suggested within 30 days of
  this note so the OPEN status cannot persist indefinitely.
- **Tracking:** open/link a GitHub issue (label `governance`) for the
  determination and reference it here, along with any external assessment.

Update this file with the owner, date, tracking reference, and the final
determination once made; do not mark the feature "classified" until that
decision is recorded here. Human clinical and regulatory review remains
required, and the feature stays OPEN until the decision is documented.
