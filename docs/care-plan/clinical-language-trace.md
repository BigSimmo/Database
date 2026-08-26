# Care Plan — clinical language trace

Every consequential label the prototype shows a reader, traced to the glossary term or
specification sentence it comes from, and the banned construction it exists to avoid.

**Binding sources.** `docs/care-plan-context.md` (glossary — preferred terms required,
`_Avoid_` terms banned in code, copy, comments and tests) and
`docs/superpowers/specs/2026-08-20-care-plan-design.md`.

The `_Avoid_` lists are **concept-scoped**, not a blanket lexical ban: "copy" is banned as
a name for a Management Plan Version and is the correct word for the patient-facing
edition; "document" is banned for a version and correct for a printed sheet.

---

## People and services

| Shown to a reader                                               | Glossary term         | Avoided                                                             |
| --------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------- |
| `Presentation activity — N recorded in the 12 months to <date>` | Presentation Activity | frequent flyer, high utiliser, frequent-presenter score, risk score |
| `Community mental health team`, `North River CMHT`              | CMHT                  | clinic, case-management inbox                                       |
| `Care coordinator`                                              | Care Coordinator      | plan owner, approver                                                |
| `Family, friends, and supports I can contact`                   | Support Person        | next of kin                                                         |

The directory and every patient workspace carry the sentence
`Counts describe what happened. They do not determine eligibility for a Management Plan.`
next to any count. That sentence is what keeps a number an observation rather than a
verdict, and it is the reason no screen outside the Identification Review worklist offers
to order people by attendance.

## Presentation activity

| Shown to a reader                                                 | Glossary term          | Avoided                                 |
| ----------------------------------------------------------------- | ---------------------- | --------------------------------------- |
| `ED Presentation`, `Record ED presentation`                       | ED Presentation        | visit, attendance, encounter            |
| `Presenting indication`                                           | Presenting Indication  | chief complaint, diagnosis              |
| `Assessment outcome`, `Disposition`                               | Presentation Outcome   | plan outcome, treatment success         |
| `Corrections`, `Correct this ED Presentation`                     | Presentation Amendment | edit, overwrite                         |
| `Was the Current Plan available / used?`, `Was the plan helpful?` | Plan-use Feedback      | compliance score, effectiveness verdict |

A correction never rewrites the episode. Each changed answer is appended beside the
original, attributed and dated, under one stated reason, and the detail view shows both.

## Identification

| Shown to a reader                                                                                             | Glossary term         | Avoided                                      |
| ------------------------------------------------------------------------------------------------------------- | --------------------- | -------------------------------------------- |
| `Identification Review`, `Refer <name> for Identification Review`                                             | Identification Review | frequent-presenter flag, automatic enrolment |
| `No eligibility rule exists in this prototype. An authorised clinician refers a person with a stated reason.` | Manual Referral       | override                                     |
| `Identification Policy — pending governance`                                                                  | Identification Policy | algorithm, clinical rule                     |

The referral sheet says `Referring somebody creates no plan, applies no eligibility, and
changes nothing about their recorded Presentation Activity` before the reader confirms,
not after.

## Management planning

| Shown to a reader                                                    | Glossary term     | Avoided                    |
| -------------------------------------------------------------------- | ----------------- | -------------------------- |
| `Current Plan`, `Current version N`                                  | Current Plan      | latest plan, active draft  |
| `Version in progress`, `Draft version N`                             | Draft             | working Current Plan       |
| `Awaiting Approval`                                                  | Awaiting Approval | current, approved          |
| `Superseded`                                                         | Superseded Plan   | expired plan               |
| `Plan withdrawn on <date> by <name> — <reason>`                      | Withdrawn Plan    | deleted plan               |
| `Within review` / `Due soon` / `Overdue` / `Review currency unknown` | Review State      | version state, expiry      |
| `Plan owner`                                                         | Plan Owner        | care coordinator, approver |
| `Approved by`                                                        | Approver          | author, owner              |
| `Review Suggested`, `Record what was decided`                        | Review Trigger    | alert, automatic update    |

Two wordings are load-bearing beyond their glossary term:

- **`Review currency unknown`** rather than a reassuring default. A Current version with
  no recorded review date must not resolve to the most comfortable state on a clinical
  currency indicator.
- **`A trigger never changes a plan by itself.`** on every Review Trigger entry. The
  glossary bans "automatic update"; this says the same thing to the reader who will act.

## Admission wording

The specification forbids a prohibitive admission construction anywhere — fixture,
interface string or example. `BANNED_ADMISSION_CONSTRUCTIONS` pins the list, form
validation rejects it at entry, and a fixture scan covers the content already written.
The agreed-approach section instead says what the plan is and is not:

> `Admission remains available whenever the treating team judges it necessary. This plan
records the approach that has usually helped; it does not set a ceiling on care and does
not bind the clinician in front of <name>.`

## The pinned safety boundary

> **`Do not rely on this plan if today is different — assess afresh.`** Then read the full
> section. → `What would make this presentation different (N listed)`

Deliberately "do not rely on", not "does not apply". The plan still supports continuity
when something is different today; what it stops being is a basis for a decision.
Overstating the boundary would make the line easy to dismiss, and it prints.

## Personal safety planning

| Shown to a reader                                                                      | Glossary term               | Avoided                                       |
| -------------------------------------------------------------------------------------- | --------------------------- | --------------------------------------------- |
| `Personal Safety Plan`, `My Personal Safety Plan`                                      | Personal Safety Plan        | Management Plan section, risk-management plan |
| `Confirmed with this person` / `Discussed, not confirmed` / `Declined` / `Unavailable` | Patient Confirmation        | clinical approval, compliance                 |
| `My warning signs`, `My reasons for living`, `Things I can do myself`                  | patient-voice section names | clinical section headings                     |

The person's own headings are written in the first person because the sheet is theirs. A
section the person has not filled is **omitted from their printed copy**, never printed as
a heading with `Not recorded` under it — that exact defect shipped once on this project
and is the reason the rule is written down.

## Communication and evidence

| Shown to a reader                                                                                                                              | Glossary term        | Avoided                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | -------------------------------- |
| `Email <team>`, `Call <team>`                                                                                                                  | Contact Action       | contact completed, message sent  |
| `These controls open an application on this device. This prototype transmits nothing and holds no evidence of delivery, readership, or reply.` | Contact Action       | sent, delivered, read, replied   |
| `Contact details verified — Last verified on <date>`                                                                                           | Contact Verification | service availability guarantee   |
| `Checking the details is not a guarantee that the service is available.`                                                                       | Contact Verification | available, reachable             |
| `History` / `What has happened`                                                                                                                | Audit Event          | activity feed, communication log |

The audit vocabulary is the strictest in the product, because an audit record's whole
purpose is to say only what the application actually knows. `The print view was opened`
rather than "printed"; `email intent opened` rather than "emailed". A confident wrong
attribution on a record about who did what is worse than a missing one — the Task 10 fix
round found and corrected exactly that on `Submitted for approval`.

## Patient Plan

| Shown to a reader                                                                                                                                 | Source                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `Why we wrote this together` … `Things that might help` (eight headings)                                                                          | Specification §Patient Plan        |
| `A clinician needs to write this` / `Partly converted — the rest needs writing`                                                                   | Specification: gaps, never guesses |
| `This copy needs updating.`                                                                                                                       | Specification §Currency            |
| `It is produced by a fixed offline conversion that runs on this device. No language model, and no service of any kind, is involved at any point.` | Specification §How it is produced  |

"Copy" is the correct word here and is not the banned use: the glossary bans it as a name
for a Management Plan Version, and this is the patient-facing edition the specification
itself calls a copy.
