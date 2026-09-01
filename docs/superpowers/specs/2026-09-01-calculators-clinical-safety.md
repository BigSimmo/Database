# Calculators clinical safety and evidence-governance specification

**Date:** 1 September 2026  
**Repository:** `BigSimmo/Database`  
**Base commit:** `d3074946a917cac378de64284c67cbc1d4dc58fa`  
**Status:** Binding implementation specification

## Product outcome

Calculators is a clinician-facing psychiatry measurement workspace. It may calculate and explain validated instrument results, but it must not turn a score into a diagnosis, treatment order, admission/discharge decision, or predictive suicide-risk category.

The presentation order is:

1. purpose and intended population
2. completion state
3. score
4. validated interpretation
5. immediate safety flags
6. limitations
7. separately sourced clinical considerations
8. evidence, rights and review metadata

## Binding safety invariants

1. **Incomplete is not negative.** A final band, copyable result, or clinical consideration must not render until the instrument-specific completion rule is satisfied.
2. Safety-critical item flags may appear before completion.
3. Undefined, skipped, explicit No and numeric zero are distinct states.
4. Psychometric interpretation and clinical management are separate data objects with separate sources.
5. Scores must not independently determine diagnosis, medication, ECT, admission, discharge, referral, or suicide-risk strata.
6. Every material interpretation, warning and clinical consideration has claim-level source IDs.
7. Every active instrument records exact version, administration method, population, timeframe, rights status, jurisdiction, review dates, reviewer and release status.
8. Modified wording or anchors cannot be presented under a validated instrument name unless the adaptation is authorised and validated.
9. Australian and Western Australian authorities take precedence where directly applicable.
10. Privacy wording must describe verified interface behaviour, not claim that no storage exists across the whole application.
11. Active questionnaire scoring must not be assumed to meet the TGA numerical-calculator exclusion. Intended-purpose/CDSS governance remains explicit.
12. Rights-, version- or evidence-blocked instruments fail closed and are absent from the active catalogue.

## Current tool dispositions

| Tool | Disposition |
|---|---|
| PHQ-9 | Retain after safer interpretation and completion gating |
| GAD-7 | Retain after safer interpretation and completion gating |
| K10 | Retain with Australian distress wording |
| CAGE | Retain but de-emphasise and describe as a lifetime/problem-drinking screen |
| AUDIT-C | Retain with Australian standard-drink context and threshold qualification |
| MDQ | Quarantine until completion semantics and digital-use rights are approved |
| SAD PERSONS | Remove from active clinical decision support |
| Y-BOCS | Quarantine; current generic anchors are not a valid Y-BOCS implementation |

## Completion policy

All active instruments require an explicit response to every scored item before final interpretation. MDQ additionally requires explicit responses to all 13 symptom items, the same-period question and the impairment question. No unanswered checkbox is an implicit No.

## Safety flags

PHQ-9 item 9 endorsement immediately displays a direct safety-assessment prompt even if other PHQ-9 items remain unanswered. It does not generate a predictive risk tier.

## Clinical considerations

Clinical considerations are not called “score-linked actions.” They:

- render only for a completed result
- are conditional, contextual and separately sourced
- do not contain score-only prescribing, ECT, admission/discharge or referral directives
- state that diagnosis, impairment, comorbidity, history, patient preference, prior treatment and safety assessment determine management

## Evidence and rights model

Each active calculator must include:

- `instrumentVersion`
- `administrationMethod`
- `intendedPopulation`
- `timeframe`
- `completionPolicy`
- `interpretationPolicy`
- `sourceIds`
- `claimIds`
- `rights`
- `jurisdiction`
- `lastReviewed`
- `nextReview`
- `reviewer`
- `confidence`
- `riskLevel`
- `instrumentStatus`
- `evidenceStatus`
- `releaseStatus`
- `limitations`
- `unresolvedIssues`

The evidence registry must resolve every referenced source and claim. A source records issuer, type, date/version, jurisdiction, URL, status, claims supported and limitations.

## Candidate tool roadmap

The catalogue records, but does not yet expose as functional calculators:

- 4AT
- CIWA-Ar
- COWS
- BFCSI/BFCRS
- EPDS

Each remains blocked until exact version, permissions, completion rules, limitations, Australian/WA workflow and tests are approved.

## User-facing copy

Home:

> Psychiatry assessment and monitoring tools with scoring guidance, limitations, safety prompts, and source-linked clinical considerations.

Privacy:

> Calculator answers remain in this browser session and are not intentionally submitted by this calculator interface. Application telemetry and clinical-record documentation are governed separately.

## Definition of done

- SAD PERSONS, Y-BOCS and rights-blocked MDQ are absent from the active live catalogue.
- Partial instruments do not expose final bands, copyable results or clinical considerations.
- PHQ-9 item 9 still alerts immediately.
- All active calculators have complete evidence and rights metadata.
- Unsafe score-only management language is removed.
- Australian K10, CAGE and AUDIT-C wording is corrected.
- Clinical-content tests enforce the invariants.
- Focused tests, typecheck, format and the repository’s selected PR-local/clinical gates pass.
- No provider-backed or production mutation is used.
