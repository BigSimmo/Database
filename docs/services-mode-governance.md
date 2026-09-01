# Services Mode Governance

## Operational rule

A Services record is not “current” merely because its prose is plausible or its confidence is high. A current record requires durable authoritative evidence, a recorded verification date and a future review date. Local clinical approval is tracked separately.

## Lifecycle

- `active`: currently usable, subject to eligibility and capacity
- `planned`: announced but not currently referable
- `temporarily_unavailable`: active program currently unavailable
- `closed`: do not refer
- `superseded`: use replacement pathway
- `unknown`: legacy or otherwise not re-verified

## Review schedule

- urgent contacts/hours and crisis availability: every 3 months
- common referral eligibility/routes: every 6 months
- specialist descriptive content: every 12 months
- planned services: monthly until opened, deferred or cancelled

## Release gates

An active immediate pathway must have:

- a stable ID
- an operational contact
- stated hours
- at least one authoritative source URL
- source access date
- `lastVerified` and `nextReviewAt`
- no contradictory non-crisis exclusion

A planned, closed, superseded or temporarily unavailable record must carry an explicit warning and cannot outrank an active suitable service.

## Clinical routing contract

The application should first determine whether the query implies emergency danger, child/youth crisis, regional crisis, Aboriginal crisis, suicide crisis, urgent AOD need, after-hours homelessness, family/domestic violence or recent sexual assault. Deterministic routing is then applied before general text ranking.

The model must not infer unknown:

- vacancies
- acceptance of a referral
- catchment exceptions
- eligibility
- hours
- cost
- transport or accommodation availability

## Editorial workflow

1. Verify the primary operational source.
2. Record source issuer/class/date/access date.
3. Update structured facts, not only search prose.
4. Record explicit exclusions and “not for” statements.
5. Set risk-based next review.
6. Obtain local clinical/cultural review where required.
7. Telephone-confirm critical services when the website is ambiguous or operational reliability is essential.
8. Quarantine unresolved content rather than smoothing uncertainty into a confident statement.
