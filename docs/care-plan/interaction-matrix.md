# Care Plan — interaction matrix

Every control in the prototype: what triggers it, what it does, what state it changes,
and what the reader sees afterwards.

Two rules run through the whole table and are worth stating once rather than in every row.

1. **The reducer is the final guard.** `getPrototypeMutationBlockReason` re-checks
   capability, connectivity, permission, identity certainty and version conflict on every
   action, whatever the surface offered. A control that should never have been shown still
   cannot change a record.
2. **Unavailable for a stated reason keeps its tab stop.** A control that is unavailable
   because of a role, a scenario or missing data uses `aria-disabled="true"` with an inert
   handler and a reachable reason. Native `disabled` is reserved for transient inertness,
   because it removes the tab stop and takes the reason with it.

---

## Shell (every route)

| Control                        | Trigger       | Action                                 | State change   | Result                                                                                                              |
| ------------------------------ | ------------- | -------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------- |
| Rail destinations (5)          | click / Enter | `next/link` navigation                 | none           | Route changes; focus moves to the new page heading                                                                  |
| System states (rail tools)     | click         | navigation                             | none           | Specimen index                                                                                                      |
| Phone dock destinations (3)    | tap           | navigation                             | none           | As above; dock is hidden at ≥768px                                                                                  |
| `More`                         | tap           | opens the More sheet                   | local only     | Sheet with the three destinations the dock has no room for                                                          |
| More sheet close / `Escape`    | key / tap     | closes the sheet                       | local only     | Focus returns to the `More` trigger                                                                                 |
| `Search patients` (shell slot) | submit        | navigates to `/patients` with the term | local only     | Directory results; Home and Patients stand this slot down and own an in-flow search instead, so no page carries two |
| `Prototype role`               | change        | `set-active-user`                      | `activeUserId` | Which actions are offered changes; authenticates nobody                                                             |

## Home and Patients

| Control                                   | Trigger | Action                       | State change                    | Result                                                                                                      |
| ----------------------------------------- | ------- | ---------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `Search synthetic patients`               | type    | filters the directory        | local only                      | Matches on name, preferred name, alias, MRN, date of birth. Plan and presentation content is never searched |
| Directory entry                           | click   | `select-patient`             | selection, clears `lastOutcome` | Workspace beside the directory; focus moves to it                                                           |
| `Open the full record for <name>`         | click   | navigation                   | none                            | Patient overview                                                                                            |
| `Refer <name> for Identification Review`  | click   | opens the referral sheet     | local only                      | Sheet stating that referring creates no plan                                                                |
| Referral sheet → record                   | click   | `open-identification-review` | new review, audit event         | Referral appears in the worklist; **no plan is created and no eligibility applied**                         |
| `Open the Identification Review worklist` | click   | navigation                   | none                            | Reviews → Identification Review                                                                             |

There is no sort control anywhere in the directory. Ordering people by attendance exists
on exactly one screen, inside the Identification Review worklist.

## Patient sections (Overview, Management Plan, Personal Safety Plan, Patient Plan, ED Presentations, History)

| Control            | Trigger | Action     | State change | Result                                                                                                                                                      |
| ------------------ | ------- | ---------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Five section links | click   | navigation | none         | `aria-current="page"` marks the section the reader is on; on Home, Patients and the Patient Plan nothing is marked, because none of them is one of the five |

## Management Plan (read)

| Control                                                       | Trigger | Action                        | State change                                      | Result                                                                                                                                      |
| ------------------------------------------------------------- | ------- | ----------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `What would make this presentation different (N listed)`      | click   | same-page jump                | none                                              | Moves to the full fifth section, which is never replaced by the pinned line                                                                 |
| `Personal Safety Plan`                                        | click   | navigation                    | none                                              | The person's own plan                                                                                                                       |
| `Open the Patient Plan`                                       | click   | navigation                    | none                                              | The person's own copy. **Added in Task 11** — before it the Patient Plan had no inbound link from anywhere outside its own pages. Rendered when the person has a **Current** plan and when their plan has been **withdrawn**, from one shared row; not on a record that has never had a plan, where no patient copy can exist. The withdrawn branch is the one it matters most in — somebody may be holding a printed copy of the plan that has just been withdrawn — and fix round 1 added it after the first fix covered only the Current branch |
| `Email <team>` / `Call <team>` / `Call the after-hours line`  | click   | opens an external application | `record-contact-intent`, audit event              | An intent is recorded. Never delivery, readership, reply or contact completion                                                              |
| `Record that this plan has been shown to this person`         | click   | `record-plan-shared`          | `sharedWithPatientAt`, audit event                | Records that the plan was gone through with the person. Not a Patient Plan, and not their agreement to it                                   |
| `Record a formal review`                                      | click   | opens a sheet                 | local only                                        | Reason and next review date                                                                                                                 |
| Formal review → `Record this review`                          | click   | `record-formal-review`        | review date moves, audit event                    | **No new version, no plan content changed**                                                                                                 |
| `Draft a replacement version` / `Start a replacement version` | click   | navigation                    | none                                              | Draft form                                                                                                                                  |
| `Open the version awaiting approval`                          | click   | navigation                    | none                                              | Comparison surface                                                                                                                          |
| `Withdraw this plan`                                          | click   | opens a sheet                 | local only                                        | Sheet stating the person will have no Current Plan afterwards                                                                               |
| Withdrawal → `Withdraw this plan`                             | click   | `withdraw-management-version` | no Current version; withdrawal reason, date, name | **No earlier version is restored.** The withdrawn version stays readable, and the withdrawal line renders wherever the plan would have been |
| `Print this plan`                                             | click   | navigation                    | none                                              | Printed clinician summary                                                                                                                   |

## Management Plan (draft and approval)

| Control                        | Trigger | Action                       | State change                                          | Result                                                                                                                                            |
| ------------------------------ | ------- | ---------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Eleven content fields          | type    | local form state             | none until saved                                      | The Current Plan stays visible above the form throughout                                                                                          |
| `Save Draft`                   | submit  | `save-management-draft`      | draft version                                         | Draft recorded; the Current Plan is untouched                                                                                                     |
| `Submit for senior approval`   | click   | `submit-management-draft`    | state → Awaiting Approval, audit event                | Read-only until decided. Attributed to whoever submitted it, which is not always the author                                                       |
| Banned admission wording       | submit  | validation refusal           | none                                                  | Named error; the version is not saved                                                                                                             |
| `Approve version N`            | click   | confirmation dialog          | local only                                            | States the consequence before the decision, including the involvement marker where it applies                                                     |
| → `Approve and make Current`   | click   | `approve-management-version` | exactly one Current version; prior becomes Superseded | Senior clinicians only. Approving at `declined` or `patient_unavailable` participation also raises a Review Trigger and stamps a permanent marker |
| `Return version N for changes` | click   | opens a sheet                | local only                                            | Reason is required                                                                                                                                |
| → `Return for changes`         | click   | `return-management-draft`    | state → Draft, reason, audit event                    | Author sees what to change                                                                                                                        |

## ED Presentations

| Control                                              | Trigger | Action                     | State change                    | Result                                                                          |
| ---------------------------------------------------- | ------- | -------------------------- | ------------------------------- | ------------------------------------------------------------------------------- |
| Site / disposition filters                           | change  | filters the timeline       | local only                      | Filtered list, or a stated empty state                                          |
| `Open this ED Presentation`                          | click   | navigation                 | none                            | Episode detail                                                                  |
| `Record ED presentation`                             | click   | navigation                 | none                            | Recording form                                                                  |
| Seven required answers                               | submit  | `record-ed-presentation`   | new episode, audit event        | Optional detail never blocks the save and renders as `Not recorded` when empty  |
| `Suggest a plan review` + reason                     | submit  | also `open-review-trigger` | new Review Trigger              | **The plan itself is not changed**                                              |
| `The agreed approach could not be followed` + reason | submit  | deviation recorded         | on the episode                  | The community team can review it with the person                                |
| `Amend recorded outcome`                             | click   | opens the correction sheet | local only                      | Rendered in-tree (`portal={false}`) so its fields keep the prototype stylesheet |
| → `Record correction`                                | click   | `amend-ed-presentation`    | appended amendment, audit event | **Append-only.** The original value is preserved and both are shown             |
| → `Keep the record as it is` / `Escape`              | click   | closes                     | none                            | Focus returns to `Amend recorded outcome`                                       |

## Personal Safety Plan

| Control                                            | Trigger     | Action                     | State change                      | Result                                                                          |
| -------------------------------------------------- | ----------- | -------------------------- | --------------------------------- | ------------------------------------------------------------------------------- |
| `Start a new version with this person`             | click       | navigation                 | none                              | Authoring surface                                                               |
| `Start a new version`                              | click       | `create-safety-plan-draft` | draft version                     | Starts from words already agreed where a version exists                         |
| Seven section fields, supports, confirmation state | type/change | local form state           | none until saved                  | A person's own words; nothing is clipped or truncated anywhere                  |
| `Save draft`                                       | submit      | `save-safety-plan-draft`   | draft                             | Not the person's plan yet, and not shown as though it were                      |
| `Make current Personal Safety Plan`                | click       | confirmation dialog        | local only                        | Names the confirmation state it will be recorded under                          |
| → `Make it the current plan`                       | click       | `make-safety-plan-current` | Current version; prior superseded | **No Management Plan approval is involved** — the two documents are independent |
| `Print this plan`                                  | click       | navigation                 | none                              | The person's printed copy                                                       |

## Patient Plan

| Control                                                          | Trigger | Action                                | State change                         | Result                                                                                                                                                                      |
| ---------------------------------------------------------------- | ------- | ------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Create the patient copy`                                        | click   | `create-patient-plan-draft`           | draft, gaps flagged                  | A deterministic offline conversion of the Current version. Unavailable with a stated reason when there is no Current Plan                                                   |
| `Write a new copy with this person` / `Continue draft version N` | click   | navigation                            | none                                 | Authoring surface                                                                                                                                                           |
| Eight section fields                                             | type    | local form state                      | none until saved                     | Section 4 is always a gap: the agreed ED approach is never auto-converted                                                                                                   |
| Resource checkboxes                                              | change  | local form state                      | none until saved                     | Chooses what goes on the sheet                                                                                                                                              |
| `Save draft`                                                     | submit  | `save-patient-plan-draft`             | draft                                | Gaps remain visible                                                                                                                                                         |
| `Approve patient copy`                                           | click   | save + `approve-patient-plan-version` | Current patient copy, approver named | **Any clinical role may approve** — requiring a senior would make people wait days for their own copy. Unavailable, with the unfilled sections named, while any gap remains |
| `Print this copy`                                                | click   | navigation                            | none                                 | The person's printed copy, with gaps omitted rather than printed blank                                                                                                      |
| Newer Management Plan Version approved                           | —       | derived every render                  | none stored                          | `This copy needs updating.` The copy stays fully readable, is never regenerated, hidden, or withdrawn, and raises a Review Trigger                                          |

## Reviews

| Control                                                | Trigger | Action                        | State change                   | Result                                                                                                          |
| ------------------------------------------------------ | ------- | ----------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Four worklist tabs                                     | click   | switches queue                | local only                     | Awaiting Approval, Review Suggested, Contact Verification, Identification Review, each with a count             |
| `Compare and decide on <name>'s version N`             | click   | navigation                    | none                           | Comparison surface                                                                                              |
| `Record what was decided for <name>`                   | click   | opens a sheet                 | local only                     | States that a trigger never changes a plan by itself                                                            |
| → `Record the decision`                                | click   | `resolve-review-trigger`      | trigger closed, audit event    | Leaves the queue; **no plan content changes**                                                                   |
| `Record that <team> details were checked`              | click   | `verify-cmht-contact`         | verification date, audit event | Records that somebody looked at the displayed details on a stated date. **Never that the service is available** |
| `Sort this worklist`                                   | change  | reorders                      | local only                     | The one place ordering by attendance exists, with the eligibility statement on the same screen                  |
| `Record the Identification Review decision for <name>` | click   | opens a sheet                 | local only                     | Decision plus a short reason                                                                                    |
| → decision                                             | click   | `close-identification-review` | review closed, audit event     | Leaves the queue, stays in the person's history, **creates no plan on any decision**                            |

## Governance, Team, System states

| Control              | Trigger | Action     | State change                     | Result                                                                                                       |
| -------------------- | ------- | ---------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Governance           | —       | read-only  | none                             | No controls at all: the page exists to be read, including its disclosure that one screen ranks by attendance |
| `Open <name>` (Team) | click   | navigation | none                             | Patient overview                                                                                             |
| `Open <specimen>`    | click   | navigation | `apply-scenario` via the address | The named degraded state, reconstructed deterministically                                                    |

## Degraded specimens

Each specimen degrades the reducer, not only the rendering, so the refusals below are the
ones a reader actually meets.

| Specimen                 | What the reader is told                                                                                                                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `offline`                | `This device is offline, so nothing was changed. What is shown is the last synthetic state held in memory.` Printing is exempt                                                   |
| `permission-unavailable` | `Permission for this action could not be confirmed, so nothing was changed.`                                                                                                     |
| `identity-uncertain`     | Plan content is withheld outright and the reader is sent back to search. **Nothing is offered for printing**, because paper carrying a nearby person's plan cannot be taken back |
| `version-conflict`       | `A newer version of this record exists … Compare the two versions before deciding.`                                                                                              |
| `no-current-plan`        | Stated directly; any draft stays visibly separate                                                                                                                                |
| `overdue-plan`           | Persistent caution and a review action; the Current Plan stays fully readable                                                                                                    |
| `withdrawn-plan`         | Withdrawal date, clinician and reason. Never renders identically to a person who never had a plan                                                                                |
| `unverified-contact`     | Details stay visible with a warning, the last-verified date, and a verification task                                                                                             |
| `launch-failure`         | The displayed contact details are retained and the failure to open the external application is explained                                                                         |
| `print-failure`          | The plan stays visible with a retry through the browser print action                                                                                                             |
| `empty`                  | Stated empty state, never a blank screen                                                                                                                                         |
