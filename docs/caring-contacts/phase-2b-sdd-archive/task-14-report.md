# Task 14 — contact and delivery exception, and this group's overlays

Group 2's write surface: moving one caring contact within the day it is already scheduled for, the
warning that stands in the way of a time this service may not send at, and what the Schedule screen
says — and refuses to say — about a delivery the provider did not complete.

## Commits

| SHA          | What                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------- |
| `7c3dacb17`  | Ruling [130]: the frozen overlay table carries its own ids, and the trigger takes the union.  |
| `1f0dea068`  | `ScheduleEntry.contactVersion`, and the route that moves one contact within its day.          |
| `be4b6a791`  | The three overlays wired onto the Schedule screen.                                            |
| `ee57d649f`  | The two new suites: the DOM control and the HTTP boundary.                                    |
| `b74500d02`  | Three screen cases for the delivery exceptions, and the version pinned in the view suite.     |
| _(in this round's log)_ | The word-ban fix, the wait-for-any-outcome restructure, and this report.            |

Every SHA above was re-checked with `git cat-file -e <sha>^{commit}` after the last commit of this
task; the branch log is the authority for the rows this table cannot name before they exist.

## The finding that shapes the whole task, and it is not the one the brief predicted

**The brief says Task 10 established that no per-attempt record exists in the domain. That is not
what the tree holds, and the difference matters.**

`repository.ts` declares `DispatchRecord`, keyed by `(contactId, attempt)`, with `startedAt`,
`expectedStatus`, `reportedStatus`, and a `discrepancyResolution` that `resolveDispatchDiscrepancy`
writes. `POST /api/caring-contacts/dispatches` already exposes that write. So a per-attempt record
does exist, and so does the decision surface `resolve-failed-delivery` is named for.

What does **not** exist is the thing the frozen row's copy describes. Three separate facts, each
checked in the tree rather than inferred:

1. **Nothing dispatches a contact twice.** `startContactDispatch` is the only writer that opens a
   dispatch record, and it runs `applyContactTransition`'s `startProcessing`, which accepts a
   `scheduled` contact and nothing else. A contact carrying a provider outcome is not `scheduled`,
   and no method anywhere in the contract returns one to that state. `DispatchRecord`'s own comment
   says it: "there is no method anywhere in this contract that re-dispatches a contact whose status
   is uncertain." So the attempt number exists in the shape and is always the first one.
2. **The schedule read publishes neither the contact's dispatch record nor its attempt number.** It
   is built from `listPlans`, deliberately — Ruling 124 — and `PlanRecord` carries no dispatch.
3. **The only read that returns dispatch records is keyed by a window over `startedAt`** — the
   instant a SEND BEGAN — which is a different instant from the one a schedule groups by
   (`planned.sendAt`). In a running service the two usually fall on the same day; nothing in this
   domain guarantees it, and `listDispatches` offers no by-contact filter.

**This is the fifth instance of the recorded pattern, and it is a sharper one than "the field does
not exist": the field exists and is unreachable from this surface.** The approved design is a
coherent picture of a later, integrated product; the types are a specification of what is built.

### What I did about it, and what I did not

`resolve-failed-delivery` is wired with `{ kind: "unavailable", reason }` rather than to a write, and
the reason is where the row's own copy gets corrected. I did not add a by-contact dispatch read: that
is a repository contract change with its own review, exactly as the brief says, and joining a day's
contacts to a day's dispatches by date would be relying on a coincidence the domain does not
guarantee — a resolution recorded against the wrong attempt is not an acceptable way to be wrong on
this panel.

**The correction is placed inside the overlay, not beside it.** The host renders the row's frozen
summary, which opens "All three attempts in the original window are finished" — transcribed from
`docs/caring-contacts/interaction-matrix.md`, checked against it row for row, and not mine to edit.
A clinician who opens that overlay must not be left with the sentence, and the `unavailable` reason
is the only text this screen puts on the same surface. So it begins by correcting it:

> Nothing can be recorded here, and one thing this overlay says needs correcting first: this service
> does not keep a history of sending attempts. It records the outcome of a single attempt for a
> contact and has no way to send another, so there is no set of attempts to close off. …

The panel says the same thing once, above the rows, so a coordinator who never opens the overlay
still reads it. **No sentence this screen renders counts attempts**, and a case asserts that against
the screen's own text — scoped to the screen rather than to the document, because the overlay's
frozen wording is on the document and is not this screen's claim.

### What is rendered instead

Four of the five named-exception states are provider outcomes, and until now the screen said nothing
about any of them: `notSendingExplanation` covers only the states `contactSendability` answers
`willNotBeSent` for, and those four are `alreadySent`. Each now states, in place, what the record
holds and what follows — the transport receipt, and that nothing is sent again — through the same
`AutomatedState` region every other automated state on this screen uses. `missed` is deliberately
left to `notSendingExplanation`, which already states it; two statements on one row would be the same
fact told twice in different words.

## Ruling [130], done first

`WORKSPACE_OVERLAY_DEFINITIONS` was annotated `readonly WorkspaceOverlayDefinition[]`. `id` is
declared `string` on that type — it has to be; the type describes the shape of a row, not the
twenty-four rows — so the annotation erased every literal, and a trigger's `overlayId` could only
ever be a `string`.

`as const` before the `satisfies` is what preserves them (`satisfies` alone cannot: it checks against
a type whose `id` is already `string`, so there is no narrower expected type to keep). From the rows:

- `WorkspaceOverlayId` — the twenty-four ids;
- `MutatingOverlayId` / `NonMutatingOverlayId` — `Extract` over the row union on the literal
  `mutatesState`, which is available at type level only because the rows are `as const`;
- `MUTATING_OVERLAY_IDS` is now typed as the first of those rather than `readonly string[]`, so the
  value and the type cannot disagree about which rows they describe.

`WorkspaceOverlayTrigger.overlayId` takes the union. **The runtime throw stays** — a cast, an `any`,
or a value that entered the program untyped all reach the component past the type, and an overlay
that opens nothing must fail loudly however it was asked for. Its test splits in two accordingly: a
`@ts-expect-error` case that fails the typecheck if the compile error ever stops being raised, and a
render case that defeats the type deliberately with a cast, because that is the only remaining way in.

`contact-time-adjustment.tsx` uses the derived type for work rather than decoration:
`[ADJUST_DATE_TIME, OUTSIDE_WINDOW_WARNING] as const satisfies readonly MutatingOverlayId[]`. Both
rows are `mutatesState: true`, and the whole shape of that file — a commit-time recheck, a guard that
must not write, a refusal that survives into the next opening — is the shape a mutating row needs. If
either row were ever re-frozen as non-mutating its controls would become exits, and that annotation
makes the wrong wiring a compile error rather than a reading somebody has to make.

## The commit-time recheck, and the one of the four that does not exist

The matrix requires a mutation-bearing action to recheck connectivity, permission, authentication and
version state **at commit time**. A coordinator can raise a confirmation and sit on it, so the checks
run after the confirm and immediately before the request.

- **Connectivity** — `navigator.onLine`, read at the commit. Nothing is requested when it is false;
  an offline commit must not depend on a fetch failing.
- **Permission** — the acting role is read again from `/api/caring-contacts/session` and the
  capability rechecked through the sealed domain's own `canPerformCaringContactAction`. The
  membership test on the role string is `Object.hasOwn` against `CARING_CONTACT_ROLE_WORDING`, not a
  list written in the component and not `!== undefined`, which an inherited `constructor` would pass.
- **Version** — the version the screen rendered from travels as `expectedContactVersion`, and the
  store refuses `stale-version`. That check is the store's, which is the only place it can be made
  truthfully.
- **Authentication — there is none to recheck, and I did not perform one.** This prototype has no
  credential and no session that can expire; `session.ts` says of itself that it is deliberately not
  a login and that its cookie holds only a role name. The nearest true fact is the acting role, which
  the permission recheck already re-reads. A fourth check here would have been theatre, and it is
  recorded as a disagreement with the matrix rather than faked.

`ScheduleEntry` gained `contactVersion` so the third of those is possible at all. It is a counter the
domain increments on every write to the contact; it names nobody, and the entry beside it already
carries the contact id, the plan id and the synthetic patient id.

## `outside-window-warning`, and the third overclaim that did not happen

Two different rules govern the two things this screen says about time, and conflating them is exactly
what the two earlier corrections were about:

- `sendingPreferenceAt` answers which of the three approved send times an instant is — `null` for
  anything that is not exactly one of them at minute zero. That is what the "Not at an approved send
  time" group means, and it says nothing about any range.
- `isWithinApprovedSendWindow` tests the HOUR against `APPROVED_SEND_WINDOW`, whose latest hour is
  **exclusive**. That is the rule `moveContactWithinDay` refuses against, and it is the rule that
  decides which overlay this control raises.

So the helper text is derived from those two constants rather than written out, and it says "from
9:00 am up to but not including 6:00 pm AWST". "Between 9 and 6" would have been the third instance
of the same error class, and a case asserts both halves: that the exact phrase is present, and that
the closed-range form is not.

The row's decision is "Keep the approved time", and keeping a time is not a write — so it is wired as
the contract's **No change** outcome: the field returns to the time the contact is already scheduled
for, and the statement says that no message was sent, no number was contacted and nothing outside the
browser happened. **The matrix marks that row `mutatesState: true` and its own decision records
nothing**; that disagreement is stated in the code rather than resolved quietly. Returning the field
is also the recovery — the scenario clears because the recovery action succeeded, not because the
overlay was dismissed.

## What was built

| File                                                                     | What it is                                                                       |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `src/components/caring-contacts/workspace/contact-time-adjustment.tsx`   | NEW. The client control: the time field, the two triggers, the commit-time checks. |
| `src/app/api/caring-contacts/plans/[planId]/contacts/[contactId]/route.ts` | NEW. `POST` — the within-day move, and only that.                                |
| `src/components/caring-contacts/workspace/overlays/definitions.ts`       | EDIT. Ruling [130]: literal ids and the three derived types.                      |
| `src/components/caring-contacts/workspace/overlays/overlay-trigger.tsx`  | EDIT. `overlayId` takes the union; the throw stays as belt-and-braces.            |
| `src/components/caring-contacts/workspace/schedule-screen.tsx`           | EDIT. The acting context, the delivery-exception statements, the two new controls. |
| `src/app/caring-contacts/schedule/page.tsx`                              | EDIT. Asks the domain for `moveContactWithinDay` and passes the acting context.   |
| `src/lib/caring-contacts/schedule-view.ts`                               | EDIT. `ScheduleEntry.contactVersion`.                                             |
| `tests/caring-contacts-contact-time-adjustment.dom.test.tsx`             | NEW. The control, against the real store.                                         |
| `tests/caring-contacts-contact-route.test.ts`                            | NEW. The HTTP boundary.                                                           |
| `tests/caring-contacts-schedule-screen.dom.test.tsx`                     | EDIT. Three delivery-exception cases, and the acting context in the render helper. |
| `tests/caring-contacts-schedule-view.test.ts`                            | EDIT. The published contact version.                                              |
| `tests/caring-contacts-overlay-trigger.dom.test.tsx`                     | EDIT. The compile-time and run-time halves of the id guard.                       |
| `tests/caring-contacts-explained-automation.dom.test.tsx`                | EDIT. The new client boundary added to the allowlist, with its three conditions.  |
| `package.json`                                                           | EDIT. Four suites added to `test:cc-guards`.                                      |
| `docs/site-map.md`                                                       | Regenerated.                                                                      |

## Two things about the route worth knowing

**The date change is not offered.** `rescheduleContact` accepts either change, but `changeContactDate`
requires a non-blank reason and a recorded team-lead approver, and an approval nobody gave must never
be defaulted in. The schema is a discriminated union of one member so that a second kind of
reschedule is a new member with its own required fields rather than an optional field bolted on.

**`RescheduleContactInput.change.contact` is dead input, and that is a finding.** Both stores discard
the caller's `PlannedContact` and re-read the one they hold — deliberately, so a caller cannot smuggle
a different calendar day past the two rules. The field is therefore something every caller must supply
and no implementation reads. The route reads the real contact rather than fabricating a placeholder,
because a placeholder would put a value in the request that says something untrue; that lookup is not
recorded on the access trail, on `handler.ts`'s own stated rule that a read is recordable where it
CROSSES A BOUNDARY, and nothing from this one is released to the caller. Narrowing the field touches
both stores and the shared contract suite, so it is reported rather than done here.

## Verification

### Gates

_(filled in below, after the final tree)_

### The browser gate — what I think it needs, which I did not run

`tests/ui-caring-contacts-workspace.spec.ts` is **untouched by this task**, and I believe it needs no
new block. Task 13's `SCHEDULE_SCREEN` entry and its seven tests already satisfy
`tests/caring-contacts-workspace-screens.test.ts`; no route was added here.

The honest reason there is nothing to add is the same one Task 13 gave for its own block: **the
isolated Playwright server seeds no plans**, so every day of the strip is empty, no contact row
renders, and neither of this task's controls exists on the page for a browser to reach. A block
asserting their absence would pass for the wrong reason.

What that leaves unproved in a real browser, stated rather than glossed:

- the time field and the two triggers at 320px, where the row is already the tightest content on the
  screen and the field, the trigger and the recovery control share one wrapping row;
- forced colours on the refusal paragraph the overlay renders — the DOM suite asserts the
  `aria-disabled`/`aria-describedby` pairing, which is what carries the reason when the accent colour
  is dropped, but not that the surface survives;
- the overlay's own return of focus to the trigger that opened it, which the shared host owns and
  Task 19 proves across all twenty-four rows.

If the owner wants browser evidence for this control, the cheapest route is seeding one active plan
in the isolated server rather than writing assertions around its absence.

### The mutation ledger

_(filled in below)_

## Seams left

1. **A by-contact dispatch read.** The one change that would let `resolve-failed-delivery` record
   anything from this screen. It is a repository contract change: `listDispatches` is keyed by a
   window over `startedAt`, and a schedule cannot honestly join on that.
2. **`RescheduleContactInput.change.contact` is dead input** on the repository contract. Narrowing it
   removes a required field no implementation reads.
3. **`lettersFromRandomIdentifier` now exists twice** — in `plan-activation.ts` and in
   `contact-time-adjustment.tsx`. The right home is a module both can import; importing the wizard's
   would widen this boundary's client module graph for eight lines.
4. **The date change has no screen.** `changeContactDate` needs a reason and a team-lead approver, and
   nothing in this workspace collects either.
5. **`resolve-failed-delivery`'s frozen summary is wrong about this system.** The correction is in the
   refusal on the same surface, which is the strongest fix available without editing the frozen
   record. Changing the row itself is a matrix change.

## Concerns

1. **The brief's premise about the per-attempt record does not match the tree**, and the difference
   changed what I built. See the first section. If Task 10's report says a per-attempt record does not
   exist in the domain, that report is wrong about `DispatchRecord`; what is true is that nothing ever
   opens a second attempt and that a schedule cannot reach the record at all.
2. **`resolve-failed-delivery` records nothing**, so the "delivery exception" half of this task is a
   statement and a correction rather than a decision surface. I believe that is the honest outcome,
   but it is a smaller deliverable than the brief anticipated and the owner may disagree.
3. **`schedule-view.ts` is Task 12's module and I added a field to it.** `contactVersion` is the
   smallest thing that makes an optimistic-concurrency check possible from a screen, and the
   alternative — refetching the plan at commit time — reintroduces the race it is meant to close. It
   is one line to revert if the controller would rather it were not there.
4. **The DOM suite mirrors the route rather than executing it.** `route.ts` imports `server-only` and
   `next/headers`, so it cannot run in jsdom. The mirror performs the same two steps in the same
   order with the same sealed-domain function, and the real handler has its own suite — but a
   divergence between the two would be invisible to both.
5. **`package.json`'s `test:cc-guards` gained four entries** (the two new suites plus the overlay
   trigger and host suites, which this task's type change can move). That is the line every other
   implementer is most likely to have touched. `definitions.ts` and `overlay-trigger.tsx` are the
   other shared files, and the brief already expects a conflict in the first.
6. **The move control is offered on a contact whose plan is holding it.** `rescheduleContact` does not
   gate on plan state, so setting the time a paused plan's contact would send at if it resumed is
   something the domain allows; the day already states above the windows that the plan is holding it.
   It is a product judgement, not a rule I found written down.
