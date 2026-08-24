# Clinical trust product direction

**Decision date:** 2026-08-23  
**Decision:** invest in trustworthy content, review workflows, saved canonical work, and measurable quality before adding standalone clinical modes.

## Why this is the current direction

The repository already contains a broad clinical surface. The highest-value gap is not another entry point; it is the operating loop that tells clinicians and reviewers whether content is current, supported, reviewed, used, and improving. New modes would increase the review and maintenance surface before that loop is visible and accountable.

## Product priorities

1. **Trustworthy content:** every clinical area can distinguish implemented content, source support, currency, and qualified human review. Unknown is visible rather than counted as approved.
2. **Review workflows:** authorised reviewers can triage source changes, answer-quality signals, and overdue content with an owner, status, resolution, and retest reference.
3. **Saved clinical work:** favourites store stable catalogue references and controlled workflow organisation, not generated answers, excerpts, searches, or patient information.
4. **Quality feedback loops:** unsupported claims, retrieval/index failures, source conflicts, and evaluation failures are brought together without persisting raw patient query or answer text.
5. **Operational closure:** privacy, hazards, alerts, and recovery ownership are machine-checkable and clearly separated from external legal/provider approval.

## Guardrails

- Extend existing content owners, review events, administrator gates, and navigation.
- Do not create a parallel sidebar, search system, dashboard taxonomy, or review status vocabulary.
- Do not auto-promote, auto-demote, or rewrite clinical content from telemetry.
- Do not use one aggregate score to imply clinical approval.
- Do not persist patient text in favourites, feedback triage, source-impact summaries, or alert payloads.
- Keep offline/local evidence distinct from hosted data, provider delivery, deployment, and clinical/legal acceptance.

## Conditions before adding another standalone mode

A proposed mode should not proceed until:

- its source owner, review cadence, expiry rule, and accountable clinical role are defined;
- the content-maturity view can report its reviewed, pending, overdue, and unknown states;
- source-change impact can identify its affected records and usage;
- its quality failures flow into the shared triage queue;
- its stable records can participate in the shared favourites contract where appropriate;
- privacy and hazard assessments cover its inputs, outputs, retention, export, and intended use; and
- the proposal shows why the need cannot be met by an existing mode or shared workflow.

## Success measures

- decreasing overdue/unverified content by product area;
- decreasing unresolved high-impact source changes;
- feedback items assigned and resolved with retest evidence;
- unsupported/retrieval failure trends visible without raw clinical text;
- favourite remove/move/order actions succeeding across sessions; and
- alert breaches reaching an owned runbook, with provider delivery tested separately.

This decision is product architecture, not an operational task-ledger entry. Revisit it when the conditions above are demonstrably met, not on a fixed feature-count schedule.
