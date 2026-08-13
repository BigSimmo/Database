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

### Scope widened: drug–drug interaction alerting

A later change extended the same profile with the patient's **current medication
list** and added interaction alerting against it:

- `PatientProfile.medications` (catalogue slugs, same session-scoped store).
- A generated, reviewable index (`data/medication-interaction-index.json`, built
  by `scripts/build-medication-interaction-index.ts` from a curated lexicon)
  resolving the catalogue's prose `Key Interactions` rows to catalogue targets.
- `src/lib/medication-interactions.ts`, which matches those rows against the
  entered list and returns severity-toned findings.
- Red/amber/green/grey verdict edges on prescribing result rows, and a matched
  -interactions block on the medication detail page.

This is a **material widening** of the question this note is open on. Interaction
checking is a canonical clinical-decision-support function, and unlike the
physiology considerations it produces an alert about a specific _combination_ the
clinician has entered. The reviewer's questions below should be answered for this
surface too, not only for the original considerations feature.

Mitigations specific to the interaction surface:

- Green never means "safe". It means "no interaction found among the medications
  you entered", and is unreachable whenever any interaction row on that
  medication could not be machine-resolved — those degrade to a neutral
  "N rows need manual review" state instead (`composeMedicationVerdict`).
- Every alert renders the **verbatim** catalogue row text; the tool never
  paraphrases a clinical statement.
- The medication picker accepts catalogue drugs only, so a clinician cannot type
  a drug the tool has no data for and read the resulting silence as an all-clear.
- Colour is never the only channel: each verdict also carries an icon and a text
  label.

Residual risk the reviewer should weigh: the lexicon is hand-curated, so a missed
term is a false negative. It is fail-safe by construction (unresolved → grey, not
green) but the resolution rate is not 100% — currently 400 of 523 rows resolve,
and `tests/medication-interaction-lexicon-coverage.test.ts` ratchets that figure
so it cannot silently regress.

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
