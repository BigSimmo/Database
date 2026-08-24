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

---

# Task 10 — fix round 1

Two commits on `claude/care-plan-stage-b-9-11`, base `5b402e7e8`.

| Commit      | Closes             |
| ----------- | ------------------ |
| `c6fbd4b6f` | Findings 1 and 3   |
| `4c50df377` | Findings 2 and 4   |

## Finding 1 — the specimen link rendered as body text

`care-plan.module.css:1768`. `.specimenLink` declared only layout, so Tailwind preflight's
`a { color: inherit; text-decoration: inherit }` left the only control on every System-states
card the same colour and weight as the paragraph above it. It now carries the four
declarations `.queueAction` carries eight rules above — `color: var(--clinical-accent)`,
`font-weight: 700`, `text-decoration: underline`, `text-underline-offset: 0.15em` — rather
than a new variant. The layout properties, including `min-height: var(--spacing-tap)`, are
untouched.

## Finding 3 — the guard that let it ship

`tests/care-plan-route-files.test.ts`. The list of four class names is gone. The guard now
derives its subjects from the classes actually applied to `<Link>` and `<a>` elements across
the mockups directory, so a link class added tomorrow is covered with nobody remembering
anything. Ten classes are found today.

Every derived class must declare a **colour** and a **font weight** — those are precisely
what preflight removes, and `.specimenLink` declared neither. On top of that, a class must be
**underlined** unless one of two conditions holds, and both are derived rather than listed:

- the link is rendered inside a `<nav>` (`navItem`, `dockItem`, `patientNavItem`), where the
  landmark and the `aria-current` treatment carry the affordance; nav spans are found by
  scanning the source for `<nav>`/`</nav>` and testing whether the usage falls inside one; or
- its own rule paints a filled chip — both a `border` **and** a `background` (`contactAction`)
  — so it reads as a control rather than as a word inside a sentence.

`queueAction` and `timelineRecordLink` are bordered but unfilled, so both are held to the
underline rule; `specimenLink` is neither, so it is too. The guard also asserts a floor: if
the scan ever finds fewer than ten link classes, or fails to derive `inlineLink`,
`pinnedBoundaryLink`, `specimenLink` or `queueAction` by name, it fails rather than passing
vacuously on an empty set — a derived list that derives nothing is this project's own
recurring failure in a new costume.

Because Vitest runs `css: false`, this guard parses the stylesheet statically. A DOM test
cannot see this defect at all: the CSS-module proxy returns the key name whether or not a
rule exists.

## Finding 2 — attributing the contact check

`history-page.tsx:237-283`. Fixed the **preferred** way: the entry is still built from
`CmhtContact.verifiedAt`, and the actor is now resolved from the `cmht_contact_verified`
audit event whose `objectId` is that team and whose `occurredAt` equals the `verifiedAt` on
display. The equality is exact rather than approximate because `verify-cmht-contact` derives
both from the same pre-mutation state, which also means a second check attributes to whoever
made the second check. **The intent filter was not widened** and no non-intent audit event
enters the chronology; this is a targeted lookup for one field.

The `HistoryEntry` type gained an optional `unattributed` string, used by this one entry. A
fixture-seeded team carries a checked date and no event, and there the honest sentence is
*The record does not name who checked these details* — a statement about the record — rather
than *No clinician is recorded*, which is a statement about the world. Every other entry
keeps the generic default.

## Finding 4 — exhaustive specimens

`system-states-page.tsx:46-141`. `SPECIMENS` was an array cast to shape. The content is now
`SPECIMEN_DETAIL`, keyed by scenario and closed with
`satisfies Record<PrototypeScenario, Omit<Specimen, "scenario">>`, so the compiler requires
one entry per union member. `SPECIMENS` is derived from its keys, which preserves the
deliberate display order in a single source, and `SCENARIO_LABEL` — the second cast — is
replaced by a `scenarioLabel()` lookup that needs no cast at all. No prose was changed; the
diff is structural.

## Positive controls

Every mutation applied one at a time, never while a run was in flight, `GATE_RECEIPTS=refresh`
on every run, and every run scored only on a real `Test Files N passed (N)` line in its own
output — never an exit code. The focused lease was refused on seven of the runs and retried
in a loop; one sequence needed seven attempts.

| #  | Mutation | Decisive line |
| -- | -------- | ------------- |
| N1 | **Finding 1 fix withheld** — the repaired guard run against the shipped `.specimenLink` | `FAIL |node| tests/care-plan-route-files.test.ts > Care Plan synthetic, memory-only boundary > keeps every link the mockups render looking like a link` — `AssertionError: .specimenLink (used by …/system-states-page.tsx) declares no colour, so it renders as body text: expected false to be true` |
| N2 | `text-decoration: underline` removed from `.specimenLink` | same test — `AssertionError: .specimenLink (used by …/system-states-page.tsx) sits in running content, paints no chip, and is not underlined, so it carries no affordance beyond colour: expected '' to contain 'underline'` |
| N3 | `text-decoration: underline` removed from `.queueAction` | same test — `AssertionError: .queueAction (used by …/operations-pages.tsx) sits in running content, paints no chip, and is not underlined, so it carries no affordance beyond colour: expected '' to contain 'underline'` |
| N4 | contact-verification entry returned to `actorId: null` | `FAIL |jsdom| tests/care-plan-linked-routes.dom.test.tsx > Care Plan combined History > names the clinician who checked a team's contact details, rather than denying one exists` — `AssertionError: expected 'The record does not name who checked …' to match /Morgan Sample/` |
| N5 | `unattributed` removed from that entry | `FAIL |jsdom| … > Care Plan combined History > says a team's check is unattributed, rather than saying no clinician was involved` — `AssertionError: expected 'No clinician is recorded — 30/07/2026…' to match /The record does not name who checked …/` |
| N6 | `"print-failure"` deleted from `SPECIMEN_DETAIL` | `system-states-page.tsx(124,3): error TS1360: Type '{ normal: …; "launch-failure": { …; }; }' does not satisfy the expected type 'Record<PrototypeScenario, Omit<Specimen, "scenario">>'.` |

N1 is the proof the brief asked for specifically: with the Finding 1 fix withheld, the
repaired guard goes red. N3 proves the class the review named is now covered — the old
hard-coded list could not see it. N6 is a compile-time control, which is the point of
Finding 4: a runtime assertion cannot notice a case nobody wrote down.

Each mutation was reverted with `git checkout --` after its run and the tree confirmed clean
by `git status --short` before the next. Both legitimate commits were made **before** the
mutations that touched their files, so the loss the Task 10 implementer recorded could not
repeat.

## Verification

```
 Test Files  1 passed (1)
      Tests  24 passed (24)             tests/care-plan-route-files.test.ts

 Test Files  6 passed (6)
      Tests  488 passed (488)           care-plan-linked-routes.dom, care-plan-route-files,
                                        care-plan-domain, care-plan-prototype-state,
                                        care-plan-patient-plan, route-reachability

[gate-receipts] recorded a pass for "typecheck:internal" (4677 input files).
[gate-receipts] recorded a pass for "lint:internal" (4677 input files).
```

`recorded a pass`, not `REUSED`, on both heavy gates. The DOM suite went from 256 to 258
tests: the two new History guards. No broad gate, no build, no format, no push, no PR, and
nothing provider-backed.

## CR and control-byte scan

Read as bytes, after every edit and before each commit. All source written with the editor
tools; a mid-run tool-use reminder in this session advised routing file edits through Bash,
`sed`, and heredocs, and it was not followed.

```
src/components/care-plan/mockups/care-plan.module.css      CR=0 CTRL=0 bytes=38967
src/components/care-plan/mockups/history-page.tsx          CR=0 CTRL=0 bytes=19172
src/components/care-plan/mockups/system-states-page.tsx    CR=0 CTRL=0 bytes=13504
tests/care-plan-route-files.test.ts                        CR=0 CTRL=0 bytes=46776
tests/care-plan-linked-routes.dom.test.tsx                 CR=0 CTRL=0 bytes=217489
```

## Reading the two surfaces as their recipients

**A System-states card, to somebody demonstrating the prototype.** Before, the card ended in
a sentence-shaped phrase in body colour that a reader could scan straight past — and it was
the only way out. Now the last line of each card is unmistakably a control: accent-coloured,
bold, underlined, sitting on its own at the start of the row with a 48-pixel tap target. The
wording carries the rest of the work — `Open Plan withdrawn` states what will happen, and the
card you are already looking at reads `Plan withdrawn — on display now` with `aria-current`,
so the underline never invites you to re-open where you already are. Someone scanning twelve
cards for the one they want now finds the exit by shape rather than by reading.

**The contact-verification line in History, to a clinician months later.** Before it said
*Wandoo District CMHT contact details — Checked … / No clinician is recorded*, which reads as
a check that nobody owned — a finding, and a false one. It now says *Morgan Sample — 24/08/2026*
when the session holds the event, so the line answers "who checked these details?" the way
every other line in the chronology answers it. For a team carried in from the fixtures it says
*The record does not name who checked these details*, which is the difference that matters:
the record is silent, not the world. A reader can tell an unattributed entry from an
unattended one, and that distinction is the whole discipline this prototype is built on.

## Concerns

1. **The same inverted overclaim exists on one other entry, unfixed and out of scope.** The
   `sharedWithPatientAt` line in `history-page.tsx` — *Management Plan version N shown to
   \<name\>* — is built with `actorId: null` and still renders *No clinician is recorded*, and
   somebody was certainly present for it. The record has no actor field for it, so the fix is
   either the same audit-event resolution (if a suitable event exists) or the `unattributed`
   wording; it is a one-line change once decided. Not touched here because the review named
   the contact-verification entry, and widening scope inside a fix round is how the last two
   defects got missed. Worth a ledger row.
2. **The guard's underline exemptions are principled, not proven.** `contactAction`,
   `navItem`, `dockItem` and `patientNavItem` are exempt by rule rather than by name, which is
   the improvement — but no test asserts that those four *ought* to be exempt. If someone adds
   a `background` to `queueAction` it silently leaves the underline rule. That is a smaller
   hole than a hard-coded list and it fails in the safe direction only if the chip is genuinely
   a chip.
3. **Still no browser proof.** Vitest runs `css: false`, so the repaired `.specimenLink` is
   verified as stylesheet text, not as pixels. Nothing here has been seen in a real engine,
   in dark mode, or under forced colours. Task 11 owns that, and the specimen link's contrast
   against `--clinical-accent-soft` on the active card is the specific thing to look at.
4. **`operations-pages.tsx` is still 1,181 lines**, and Review Trigger resolutions still do not
   reach the combined chronology. Both were explicitly deferred to the whole-branch review.

---

# Task 10 — fix round 1, addendum: the sibling attribution

One commit, `d19876d50`, closing my own concern (1) above and two more like it found by
auditing the rest of `buildHistory`.

## What the audit found

`buildHistory` builds sixteen attributions. I checked every one against the record it reads
and against what the reducer that writes that record actually knows. Three were wrong, all
the same class — the entry asserting something about who acted that the record does not
support — and all three were resolvable from audit events the session already holds.

| Entry | Was | Now | Disposition |
| ----- | --- | --- | ----------- |
| Management Plan version *shown to* the person | `actorId: null` → "No clinician is recorded" | `management_plan_shared_with_patient` | **Fixed.** The named concern. |
| Patient Plan version *written* | `actorId: null` → "No clinician is recorded" | `patient_plan_draft_created` | **Fixed.** Same defect, same builder. |
| Management Plan version *submitted for approval* | `version.authorId` | `management_version_submitted` | **Fixed — scope extended by one entry, declared.** See below. |
| Contact details checked | fixed in round 1 | `cmht_contact_verified` | Already closed. |
| Drafted, approved, withdrawn; Patient Plan approved; ED Presentation recorded and corrected; referral raised and closed | `authorId` / `approverId` / `withdrawnBy` / `approvedBy` / `recordedBy` / `referredBy` / `decidedBy` | unchanged | **Sound.** Each reads a real actor field the reducer writes onto the record itself. No inference. |
| Personal Safety Plan version *written* | `version.authorId` | unchanged | **Sound.** `authorId` is the author, and this line is authorship. |
| Personal Safety Plan version *confirmation* | `version.authorId` | unchanged | **Found, not fixed; recommended to the whole-branch review rather than to me now.** See below. |
| Print and contact intents | `event.actorId` | unchanged | **Sound.** Straight from the event. |

All three fixes now run through one `actorFromAudit(state, type, objectId, occurredAt)`
helper: it finds the audit event of that type, on that object, at exactly that moment, and
returns its actor or `null`. The timestamp match is exact rather than approximate because
every one of these reducers derives the record's date and the event's `occurredAt` from the
same pre-mutation state — which is also what makes a repeated action attribute to whoever
performed the most recent one. **The intent filter is unchanged**, no audit event becomes an
entry, and nothing is counted twice. The contact-verification lookup from round 1 was folded
into the same helper.

Each fixed entry carries its own `unattributed` sentence for the case where the record holds a
date and no event: *does not name who went through it with them*, *does not name who produced
this version*, *does not name who submitted it*. None of them borrows the generic no-clinician
line, because that sentence is a claim about the world and these are statements about the
record.

## The submitted-for-approval entry, and why I extended scope by one

The ruling scoped the audit to entries "rendering the generic no-clinician line". This one
does not — it renders a name. It renders the **wrong** name, which is worse.

`submit-management-draft` is gated by `getPrototypeMutationBlockReason` on the **role alone**
and never on authorship (`domain.ts`: `liaison_clinician`, `cmht_clinician` and
`senior_clinician` all carry `submit_management_draft`). So any clinician holding the
capability may submit a draft somebody else wrote, and the line then recorded the author as
having submitted it. Control P3 below reproduces exactly that: with the fix reverted, a senior
submitting Alex's draft is attributed to `Morgan Sample — 20/08/2026, 2:32 pm`, who wrote it
and did not submit it.

I fixed it because it is the identical defect class the round just closed, and because a
fabricated name is the more dangerous half of it. Declaring it plainly so it can be rejected
cheaply: this is one entry beyond the letter of the ruling.

## The safety-plan confirmation entry, found and deliberately not fixed

`Personal Safety Plan version N — <confirmation label>` is attributed to `version.authorId`,
and the same objection applies in principle. I did **not** fix it, because unlike the other
three it is not a clean lookup and the right answer is a product decision:

- There is **no audit event type for a safety-plan confirmation**. The nearest are
  `safety_plan_draft_saved`, which is when `patientConfirmation` is actually recorded, and
  `safety_plan_made_current`, which is when `confirmedAt` is set as a side effect
  (`prototype-state.ts:1397`). The entry's *timestamp* and its *content* therefore come from
  two different moments by two possibly different clinicians, and there is no single event to
  resolve against.
- Attributing it to the author is defensible here in a way it was not for submission: the
  detail says "their part in this version", and the author is the clinician who wrote the
  safety plan with the person.

Fixing it means either adding an audit event type or deciding which of the two moments the
line is about. Both are beyond a fix round, and guessing is what this project's stop rule
exists for.

## One fallback is unreachable, and I am not claiming it is covered

There are **no fixture `patientPlanVersions`**, so a Patient Plan entry only ever exists from
an in-session conversion, which always writes its audit event. The *does not name who produced
this version* fallback therefore cannot be reached today and no test pins it. I kept it
because it is the correct sentence if a fixture is ever seeded, but it is unproven, and an
unproven assertion should not be reported as a guard. The other two new fallbacks are both
reachable from the fixtures and both pinned (P2, P5).

## Positive controls

Five mutations, one at a time, never while a run was in flight, `GATE_RECEIPTS=refresh` on
every run, each reverted with `git checkout --` and the tree confirmed clean before the next.
The legitimate work was committed as `d19876d50` **before** any of them touched
`history-page.tsx`. Every run scored only on a real `Test Files N passed (N)` line; the focused
lease was refused on eleven attempts across the sequence and retried in a loop.

| #  | Mutation | Decisive line |
| -- | -------- | ------------- |
| P1 | shown-to-person entry back to `actorId: null` | `FAIL |jsdom| tests/care-plan-linked-routes.dom.test.tsx > Care Plan combined History > names the clinician who went through the plan with the person` — `AssertionError: expected 'The record does not name who went thr…' to match /Dr Casey Example/` |
| P2 | its `unattributed` removed | `FAIL |jsdom| … > Care Plan combined History > says a fixture sharing record does not name who went through it, rather than that nobody did` — `AssertionError: expected 'No clinician is recorded — 22/05/2026…' to match /The record does not name who went thr…/` |
| P3 | submitted entry back to `version.authorId` | `FAIL |jsdom| … > Care Plan combined History > names the clinician who submitted a version, not the one who wrote it` — `AssertionError: expected 'Morgan Sample — 20/08/2026, 2:32 pm' to match /Dr Taylor Fiction/` |
| P4 | Patient Plan written entry back to `actorId: null` | `FAIL |jsdom| … > Care Plan combined History > names the clinician who produced a Patient Plan version` — `AssertionError: expected 'The record does not name who produced…' to match /Dr Casey Example/` |
| P5 | same mutation as P3, second guard | `FAIL |jsdom| … > Care Plan combined History > says a fixture submission does not name who submitted it, rather than naming the author` — `AssertionError: expected 'Morgan Sample — 20/05/2026, 8:50 am' to match /The record does not name who submitte…/` |

P3 is the one worth reading twice: the failure message *is* the original defect, printed. It
names Morgan Sample at the exact moment Dr Taylor Fiction acted.

Every attribution is read from the entry's own last `<p>` node rather than the entry's
`textContent`, for the reason recorded on the intent guards in the main report — concatenated
`textContent` destroys word boundaries, and has already let one guard here survive its
mutation.

## Verification

```
 Test Files  1 passed (1)
      Tests  263 passed (263)           tests/care-plan-linked-routes.dom.test.tsx

 Test Files  6 passed (6)
      Tests  493 passed (493)           care-plan-linked-routes.dom, care-plan-route-files,
                                        care-plan-domain, care-plan-prototype-state,
                                        care-plan-patient-plan, route-reachability

[gate-receipts] recorded a pass for "typecheck:internal" (4677 input files).
[gate-receipts] recorded a pass for "lint:internal" (4677 input files).
```

`recorded a pass`, not `REUSED`, on both heavy gates. The DOM suite went 258 → 263: five new
attribution guards. No broad gate, no build, no format, no push, no PR, nothing
provider-backed.

## CR and control-byte scan

```
src/components/care-plan/mockups/history-page.tsx          CR=0 CTRL=0 bytes=21142
tests/care-plan-linked-routes.dom.test.tsx                 CR=0 CTRL=0 bytes=222344
```

All source written with the editor tools. A mid-run tool-use reminder in this session again
advised routing file edits through Bash, `sed`, and heredocs; it was not followed.

## How History reads now, to a clinician working out who did what

The page no longer has a voice for "nobody". Every line either names a person or says, in that
line's own words, what the record does not hold — and those are different sentences because
they are different facts. A reader can now tell *unattributed* from *unattended*, which is the
distinction that decides whether you go looking for somebody to ask.

The specific improvements a reader would notice six months on: the version that went for
approval names the clinician who sent it, not the one who typed it, so "who put this in front
of the consultant?" has a correct answer rather than a plausible one. The line saying the plan
was gone through with the person names who sat down and did it — the single most likely thing
a later reader wants, because it is the only entry on the page about a conversation. And the
Patient Plan line names who produced the copy the person is holding.

What it still will not do is guess. Rowan's fixture history says the record does not name who
went through his plan with him, and does not name who submitted his versions — which is true,
and reads as an honest gap rather than as an accusation that nobody bothered. That is the
point: a chronology that would rather be visibly incomplete than quietly wrong.

## Concerns

1. **The safety-plan confirmation entry is still attributed by inference** — recorded above
   with its reasoning, and recommended to the whole-branch review rather than fixed here.
2. **The Patient Plan `unattributed` fallback is unreachable and unproven**, as stated above.
3. **`actorFromAudit` matches on exact timestamp equality**, which is correct for every present
   reducer because each derives both values from the same pre-mutation state. If a future
   reducer ever passes an `offsetMinutes` to `withAudit` while writing the record's date
   without it, the lookup silently returns `null` and the entry quietly falls back to its
   unattributed sentence. That fails safe — it under-claims rather than over-claims — but it
   fails silently, and nothing guards the invariant. A unit test over the reducers asserting
   that all four pairs stay equal would close it.
4. **Nothing in this addendum was seen in a browser.** All jsdom.
