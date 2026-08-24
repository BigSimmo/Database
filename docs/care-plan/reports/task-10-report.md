# Task 10 — Reviews, Team, Governance, History, and System states

Branch `claude/care-plan-stage-b-9-11`, worktree `D:\Worktrees\Database\care-plan-impl`.
Base at dispatch `996cbc407`.

Task 10 was the last product task. Five routes still fell through to `RoutePurposeSurface`
— Reviews, Team, Governance, History, System states — and all five are now real surfaces.
That fallback, the `purpose` line on every route definition, and the three stylesheet rules
that dressed it are gone, which is the completion signal the dispatch named.

---

## What was built, surface by surface

### Reviews — `operations-pages.tsx`, `ReviewsSurface`

Four queues in a `Tabs` strip, named exactly `Awaiting Approval`, `Review Suggested`,
`Contact Verification`, and `Identification Review`, each carrying its count. Every entry is
a heading naming who or what it is about, a `<dl>` of the facts a reader needs before
deciding, and its routes. Ordering is `getReviewQueues`' existing oldest-actionable-first;
nothing is ranked by severity, score, or priority, and no entry carries any of those words.

- **Awaiting Approval** — patient and version number, revision reason, who submitted it and
  when, plan owner, the next action in words, and links to the review surface and the person.
  Carries `ParticipationMarker`, so a version written without the person's involvement is
  marked in the queue as well as on the plan.
- **Review Suggested** — the trigger's source in words, its reason, when it was raised, the
  plan owner, and a Sheet that records what the team decided. Dispatches the existing
  `resolve-review-trigger`.
- **Contact Verification** — the team, its catchment, mailbox, duty number, hours, and the
  date it was last checked. The action dispatches the existing `verify-cmht-contact`, and
  the panel states that checking details is not a guarantee the service is available.
- **Identification Review** — the referral reason, who referred and when, the person's
  objective Presentation Activity over the named window, and a Sheet recording exactly one
  of `Proceed to a plan`, `Not needed at this stage`, `Revisit later` plus a required reason.
  Dispatches the existing `close-identification-review`.

**Sort by presentation count exists here and nowhere else**, as the specification requires,
offered as `Oldest referral first` / `Most ED Presentations in the last 12 months first`,
with the statement that counts do not determine eligibility on the same screen. A test
asserts the control is absent from the other three queues.

**Closing on `Proceed to a plan` creates nothing.** A panel then offers a link to start a
draft and says in words that no plan and no version were created; the reader chooses.

**Role gating is shown, not hidden.** The default synthetic user is an ED clinician, who
holds none of `manage_worklists`, `verify_cmht_contact`, or `close_identification_review`.
Rather than hiding three queues' actions, the surface renders one `role="alert"` reason per
queue — the reducer's own sentence, from `getPrototypeMutationBlockReason` — and every
action in that queue points at it via `aria-describedby`. This follows the precedent
`management-plan-review.tsx` set: nobody arrives at a worklist by accident, and a reader who
finds an empty space learns nothing about who may act.

### Manual referral — `IdentificationReferralAction`

Offered on the patient workspace, which is what Home, Patients, and a patient's Overview all
render. Button `Refer <full name> for Identification Review`; Sheet titled
`Refer for Identification Review`; required field `Reason for multidisciplinary review`;
confirm `Add to Identification Review` — the brief's literal strings. It dispatches the
existing `create-identification-review`, creates no plan, decides no eligibility, and changes
nothing about Presentation Activity. When a referral is already open the control is
`aria-disabled` with the reason stated and an inert handler.

It sits **last** on the workspace, below the team contact block. Reading comes first, and a
referral is the least urgent thing on a page whose reason for existing is the first-minute
guidance above it.

`PatientWorkspace` stays a pure function of its props: the referral arrives as an
`identificationReferral` node from `ClinicalSnapshotSurface`, because the workspace is
rendered without a provider in `care-plan-linked-routes.dom.test.tsx` and a
context-consuming child would have thrown there.

### Team — `TeamSurface`

Every CMHT with catchment, shared mailbox, duty telephone, operating hours and timezone,
care coordinator, the after-hours pathway, verification state and date, and how many people
in that catchment have a Current Plan, with a link to each. Then plan owners: responsibility,
post, Current Plans owned, and versions in progress.

### Governance — `GovernanceSurface`

The Identification Policy panel states exactly the four required facts —
`Pending local governance`, `No approved threshold count`, `No approved threshold lookback`,
`Manual referral enabled` — followed by the fixture's explanation and the statement that
nothing here proposes, defaults to, or compares against a number. Then illustrated role
responsibilities with the interaction-modelling caveat, eight lifecycle rules, six statements
of what the audit record can and cannot say, six privacy/print/contact rules, and the
production-readiness boundary.

One paragraph was added after the recipient reading and is described under **Ruling 56**
below.

### History — `history-page.tsx`, `HistorySurface`

One chronological semantic list per person, newest first, with a `Show` filter over seven
kinds. Two rules govern every line.

**Nothing is counted twice.** Record-derived events are read from the records' own
timestamps — the only account that survives a reload — and the session's audit stream
contributes **only** the five kinds of action that leave no record behind them: the three
print intents and the two contact intents. Approving a version therefore appears once, not
once from the version and once from its audit event.

**It describes only evidence the application has.** An email link is "asked to open"; a print
view is "the print view was opened". The detail line is the reducer's own `evidence` string,
which already carries the disclaimers.

One deliberate omission: `SYN-MGMT-VERSION-006` is a first draft that carries a
`submittedAt` it never used, so the "submitted for approval" line is emitted only for a
version whose state shows it actually left the author's hands. A version returned to Draft
loses that line rather than gaining a claim the record cannot support. Recorded here because
it is a silent narrowing, not a visible one.

### System states — `system-states-page.tsx`, `SystemStatesSurface`

All twelve `PrototypeScenario` values as cards, each with what happened, what it means, and
what is available. The active specimen is called out in the repository's three-part error
shape, and the mutation funnel's own refusal is displayed, probed with `record-contact-intent`
— an action every synthetic responsibility carries, so what is reported is the specimen's
effect rather than the signed-in role's. Print is probed separately and reported separately,
because print intents are connectivity-exempt and a blanket "everything is unavailable" would
be untrue in exactly that case.

Every specimen control is a **`Link`**, per Ruling 53. The shell's existing guarded effect
does the dispatching; a control that dispatched as well would apply the scenario twice, and
`apply-scenario` rebuilds the fixtures. `normal` carries no query at all.

---

## Deviations from the brief, and why

1. **The worked example's patient is a refusal case in the fixtures — Ruling 55.** The
   brief's example refers `Jordan Test` at `?scenario=no-current-plan` and expects success.
   But `syntheticIdentificationReviews` already holds `SYN-IDENT-REVIEW-001`, an **open**
   referral for `SYN-PATIENT-003`, so the reviewed Task 2 reducer refuses a second one. I
   kept every literal string from the example — button, dialog title, field label, confirm
   button, and both negative assertions — and split it into two tests: the success path on
   `Alex Fiction` (whose earlier referral was closed `revisit_later`, so a fresh one is
   legitimately permitted), and the refusal path on the brief's exact route and scenario
   pair. Neither the fixture nor the reducer was bent to fit the example.

2. **`getByRole("status")` / `/review added/i` replaced with the reducer's real message.**
   The reducer says `<name> was referred for Identification Review. No plan was created, and
   being referred decides nothing.` The example's paraphrase would have required either a
   second success path or a weaker assertion. The reducer's wording is reviewed and accurate.

3. **The brief's "empty state" test became a filtered empty state.** `scenario=empty` only
   clears the selected patient; `createInitialPrototypeState` loads the same fixtures for
   every scenario, so no patient has an empty history. Filtering Rowan's History to
   `Patient Plan` — which he has none of — is a real empty state rather than a contrived one,
   and it exercises the branch that must say *nothing of this kind* rather than *nothing
   happened*.

4. **Team offers no email or telephone control.** `record-contact-intent` requires a
   `patientId`, and Team has no person open. A control here would record an action attributed
   to nobody, which would make the audit trail claim something it does not know. The page
   says so and routes to the person's record, where the attributed controls live. I did not
   add a new action for this — Ruling 52 says to add one only if a queue genuinely needs it,
   and this one does not.

5. **The `purpose` field was removed along with the surface.** With `RoutePurposeSurface`
   gone it had no consumer, and the approved route table lives in the specification. This is
   a private field in one module, not an exported symbol, so `check:dead-code-candidate` does
   not apply.

6. **Blocked controls use the in-branch `role="alert"` + `aria-describedby` pattern**, not
   `title="… — coming soon"` + `sr-only`. The `coming soon` shape is for a feature that does
   not exist; these controls are unavailable because of who is signed in or what the record
   already holds. This matches `management-plan-review.tsx` and keeps the existing
   `queryByTitle(/coming soon/i)` guard meaningful. The ledger already records that the two
   patterns should be reconciled branch-wide.

7. **A Governance paragraph the brief did not ask for — Ruling 56.** See the recipient
   reading below. The page whose reader is asking *does this tool label people?* never
   mentioned that one screen orders a list by attendance. It does now.

---

## Positive controls

Every mutation was applied one at a time, never while a run was in flight, with
`GATE_RECEIPTS=refresh` on every run, and every run scored only on a real
`Test Files N passed (N)` line in that run's own output. No exit code was scored in either
direction, because both refusal shapes exit 0 — the lease refusal
(`DATABASE_HEAVY_RUN_ADMISSION_BUSY` / `capacity is full`) and the `REUSED` receipt replay,
which bites hardest immediately after a revert when the content hash returns to a recorded
pass. One run needed five lease attempts; the rest acquired first time.

**24 mutations applied, 24 killed, 1 initial survivor found and repaired.**

| #   | Mutation | Test | Result |
| --- | -------- | ---- | ------ |
| M1  | `QueueEntry` heading renders `— Severity: high` | `FAIL … > Care Plan Reviews worklists > carries no severity ranking, score, or stigmatising label on any queue entry` | killed |
| M2  | Contact-verification action uses native `disabled` instead of `aria-disabled` | `FAIL … > Care Plan Reviews worklists > states why a queue action is unavailable to the signed-in clinician instead of hiding it` | killed |
| M3  | Count sort hoisted above the tab panel so it renders on every queue | `FAIL … > Care Plan Identification Review workflow > offers the count sort on no other queue` | killed |
| M4  | `COUNTS_DECIDE_NOTHING` dropped from the sort block | `FAIL … > Care Plan Identification Review workflow > offers the count sort only here, with the statement that counts decide nothing beside it` | killed |
| M5  | `getReviewQueues` reverses the Review Suggested order | `FAIL … > Care Plan Reviews worklists > orders every queue oldest-actionable-first rather than by severity` | killed |
| M6  | Blank-resolution guard removed from `recordResolution` | `FAIL … > Care Plan Reviews worklists > refuses to resolve a Review Trigger with no account of what was decided` | killed |
| M7  | Blank-reason guard removed from `closeIdentificationReview` | `FAIL … > Care Plan Identification Review workflow > refuses to close an Identification Review with no reason` | killed |
| M8  | Closing on `proceed_to_plan` dispatches `create-management-draft` | `FAIL … > Care Plan Identification Review workflow > closes a referral with one recorded decision and a reason, and creates no plan` | killed |
| M9  | Already-open referral check dropped from `blockedReason` | `FAIL … > Care Plan Identification Review workflow > says plainly when a referral is already open rather than adding a second` | killed |
| M10 | Email intent heading becomes `An email was sent to the team and received` | `FAIL … > Care Plan combined History > labels a contact action as a request to open an application, never as a message anyone received` | killed |
| M11 | Print intent heading becomes `The Management Plan was printed` | **survived** — see below | survived, guard repaired, then killed |
| M12 | Email intent heading becomes `An email reached the team` (re-proof under the repaired guard) | `FAIL … > Care Plan combined History > labels a contact action as a request to open an application, never as a message anyone received` | killed |
| M13 | Closed-review detail drops `decisionReason` and the attributed author | `FAIL … > Care Plan combined History > keeps a closed Identification Review decision, reason, author, and time in the person's History` | killed |
| M14 | Filter note drops "Nothing has been removed from the record" | `FAIL … > Care Plan combined History > narrows the chronology by kind without hiding that the rest is still on the record` | killed |
| M15 | Filtered empty-state title collapses into the all-groups one | `FAIL … > Care Plan combined History > says plainly when nothing of the chosen kind was recorded, rather than showing an empty page` | killed |
| M16 | `specimenHref` gives `normal` a `?scenario=normal` query | `FAIL … > Care Plan System states > offers every specimen as an address, and clears the query for the ordinary world` | killed |
| M17 | Specimen `Link` replaced with a `button` dispatching `apply-scenario` | `FAIL … > Care Plan System states > changes specimen by navigating rather than by acting on the state in place` | killed |
| M18 | Funnel probed with the connectivity-exempt print intent | `FAIL … > Care Plan System states > degrades the prototype itself from the address, not only its rendering` | killed |
| M19 | Refusal paragraph rendered unconditionally | `FAIL … > Care Plan System states > refuses nothing in the ordinary world` | killed |
| M20 | Identity-uncertain branch removed from `HistorySurface` | `FAIL … > Care Plan combined History > shows no chronology at all when the record is not confirmed as the right person` | killed |
| M21 | Governance attendance disclosure reduced to "This application never ranks anybody." | `FAIL … > Care Plan Governance > discloses the one screen that orders a list by attendance rather than leaving it to be found` | killed |
| M22 | Threshold count becomes `Not approved. A threshold of 4 presentations is under discussion.` | `FAIL … > Care Plan Governance > states the four approved Identification Policy facts and offers no control that could become a number` | killed |
| M23 | System states renders "built in a later stage of the prototype" | `FAIL … > Care Plan route shell > gives every route real content rather than a statement of what it will hold` | killed |
| M24 | `What you can do` row removed from the active specimen | `FAIL … > Care Plan System states > says what happened, what it means, and what is available for the specimen on display` | killed |

### M11 — the survivor, and what it actually showed

The mutation changed the print-intent heading to `The Management Plan was printed`. The guard
read the whole entry's `textContent` and asserted it did not match
`/\b(printed successfully|was printed|reached the printer|copy given)\b/i`. It passed anyway.

Instrumenting the entry showed why:

```
Print and contact actionsThe Management Plan was printedThe browser print view was opened for
Management Plan version 2. This records the request only, and is not evidence that anything
reached a printer.Dr Casey Example — 20/08/2026, 2:31 pm
```

`textContent` concatenates adjacent elements with no separator, so the heading's final word
ran straight into the next element: `was printedThe`. `d` and `T` are both word characters,
so there is no `\b` between them and `\bwas printed\b` could not match. The guard was not too
loose — it was **structurally unable to observe the failure**, which is systemic lesson 5 in
the ledger wearing a new costume.

The fix was a different *kind* of assertion, not a tighter one: both intent guards now read
the entry's own `<h3>` heading node, which is the element that makes the claim, and assert
positively (`/asked to open/i`, `/print view was opened/i`) as well as negatively. M11 then
failed on the positive assertion, and M12 re-proved the email guard under the new shape.

**What would make each Governance guard red in production.** The four-facts test goes red if
any of the four literal strings changes or a candidate number appears anywhere on the page.
The control sweep goes red the moment anyone adds a `spinbutton`, `slider`, `textbox`, or
`combobox` to that surface — which is exactly what a threshold configuration control would
be, and it catches one that ships with no number in it yet. The disclosure test goes red if
the attendance-ordering paragraph is removed or softened past naming the worklist, saying it
is offered nowhere else, and denying it is a ranking.

---

## Verification

Final tree, all runs scored on a real summary line:

```
 Test Files  1 passed (1)
      Tests  256 passed (256)          tests/care-plan-linked-routes.dom.test.tsx

 Test Files  6 passed (6)
      Tests  245 passed (245)          care-plan-domain, care-plan-prototype-state,
                                       care-plan-route-files, care-plan-patient-plan,
                                       proxy, route-reachability

[gate-receipts] recorded a pass for "typecheck:internal" (4677 input files).
[gate-receipts] recorded a pass for "lint:internal" (4677 input files).
```

Both heavy gates ran fresh — `recorded a pass`, not `REUSED`. No broad gate, no build, no
push, no PR, and nothing provider-backed was run.

---

## Reading each surface as its recipient

**Reviews, as a clinician working a queue at the end of a shift.** It reads as a list of
things to do. Each entry says who, why, since when, who owns it, and what to do next, and
every action is one tap from the reason for it. The empty states are the ones I would want
at 9pm: "No version is waiting for a decision" rather than a blank panel. The one thing I
changed after reading it was the blocked-reason placement — one statement per queue rather
than one per row, because five identical alerts down a worklist is noise a tired reader
learns to skip.

What it does **not** say anywhere: how unwell anybody is, how urgent they are relative to
each other, or how often they have attended — except on the one queue where attendance is
the stated purpose, and there it sits beside the sentence saying it decides nothing.

**Identification Review, as the person being discussed.** This is the surface with the most
potential to be humiliating, and reading it that way is where the closure Sheet's copy came
from. The heading is the person's name and nothing else — no marker, no count, no state. The
reason for the referral is a clinician's sentence about coordination, not a tally. The
decision options are all neutral: `Not needed at this stage`, not "rejected". The reason
field's hint says a later reader sees this and nothing else, which is the honest description
of what a person would eventually read about themselves.

**Team, as a clinician who needs the community team now.** Everything needed to ring them is
on screen: number, hours, timezone, coordinator, after-hours route. The verification mark is
worded rather than coloured, so an unchecked team reads as unchecked in greyscale. The one
frustration is deliberate and stated: you cannot ring from here, because a contact action is
recorded against the person it was made for.

**History, as a clinician reconstructing what happened.** Newest first, each line saying what
kind of thing it was, what happened, who did it, and when. The lines I checked hardest were
the intents, because they are the easiest place in this product to overclaim — and they say
"asked to open" and "was opened", never "sent" or "printed". A closed Identification Review
shows the decision, the reason, the author, and the time, which is the specification's
acceptance criterion and also what a person reading their own record deserves to find.

**Governance, as somebody asking whether this tool labels people.** This reading changed the
product. The page answered the question well — status pending, no threshold, no lookback, no
control that could become one, counts decide nothing — but it never mentioned that one screen
will order a list by how often somebody has attended. A reader who learned that afterwards
would be entitled to re-read the whole page as managed. It now names the Identification
Review worklist, says it is offered nowhere else, and says ordering a worklist is not a
ranking of people. That paragraph is pinned by a test and by M21.

**System states, as somebody demonstrating the prototype.** Each card says what happened,
what it means, and what you can do, and the active one repeats it in the three-part shape
every other error in this application uses. The thing I most wanted stated is stated: opening
a specimen rebuilds the world and discards anything written in the session. That is the
sentence that stops somebody losing a draft mid-demonstration.

---

## CR and control-byte scan

Every file touched, read as bytes. `grep -c $'\r'` proved useless here — in Git Bash it
reported a count equal to the line count for files containing no CR at all — so the scan is a
byte count, and it is worth recording that the obvious shell check is itself a check that
cannot fail.

```
src/components/care-plan/mockups/operations-pages.tsx      CR=0 CTRL=0 bytes=50915
src/components/care-plan/mockups/history-page.tsx          CR=0 CTRL=0 bytes=17377
src/components/care-plan/mockups/system-states-page.tsx    CR=0 CTRL=0 bytes=13111
src/components/care-plan/mockups/routable-suite.tsx        CR=0 CTRL=0 bytes=15810
src/components/care-plan/mockups/patient-workspace.tsx     CR=0 CTRL=0 bytes=10691
src/components/care-plan/mockups/clinical-snapshot-page.tsx CR=0 CTRL=0 bytes=6663
src/components/care-plan/mockups/care-plan.module.css      CR=0 CTRL=0 bytes=38851
tests/care-plan-linked-routes.dom.test.tsx                 CR=0 CTRL=0 bytes=214800
```

`git ls-files --eol` reports `i/lf w/lf` for every new file. All source was written with the
editor tools; no Python, `sed`, or shell heredoc touched a source file, including when
mid-run tool-use reminders twice suggested exactly that.

---

## Concerns

1. **`operations-pages.tsx` is 1,181 lines carrying three independent surfaces plus the
   referral action.** Reviews alone is four queue components, two Sheets, and the shared
   vocabulary. Task 7 was charged with the same shape at 648 lines and the ledger recorded it
   rather than splitting. This is the largest single file the branch has added and it is the
   obvious candidate for the whole-branch review to split — `reviews-page.tsx`,
   `team-page.tsx`, `governance-page.tsx`, `identification-referral.tsx` are clean seams.

2. **A revert during the mutation loop silently discarded an uncommitted product change.**
   `git checkout -- operations-pages.tsx` after M21 and M22 took the file back to `HEAD`,
   which did not yet contain the Governance disclosure. I caught it from `git status` before
   the final run and restored it, and the final suite proves it is present. The safe habit is
   to commit a legitimate change before mutating the same file, and I did not. Nothing was
   lost; recorded because the near-miss is the finding.

3. **Queue ordering is proven from fixtures for three queues, not four.** Only one version is
   ever `awaiting_approval`, so its sort is asserted on a single element — the Task 1 deferred
   minor, still open, and still not something Task 10 should fix by bending a fixture. The
   clean close is a unit test on `getReviewQueues` with a constructed two-element set.

4. **`History` shows one contact-verification line per patient, derived from the team's
   `verifiedAt`.** Because `CmhtContact.verifiedAt` is non-nullable (Task 1 deferred minor),
   a team that has never been checked still produces a dated line; the wording says "Not
   confirmed since <date>" rather than "checked", which is the best the domain currently
   allows. If that field ever becomes nullable, this line should be revisited.

5. **No browser, responsive, or accessibility proof.** Everything here is jsdom and static
   analysis. Vitest runs `css: false`, so the new `queueAction` / `specimenLink` tap-target
   rules and the `specimenList` two-column breakpoint are unverified in a real engine. Task 11
   owns this, and the four-tab Tabs strip at 320px is the specific thing I would look at first.

6. **The `Select` controlled/uncontrolled React warning (Ruling 50) still fires**, and Reviews
   and History each add another `Select`. The suite's output is still not pristine, and that
   noise could mask a real warning.
