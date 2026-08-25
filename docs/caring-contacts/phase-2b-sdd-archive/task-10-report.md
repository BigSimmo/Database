# Task 10 report — plan and contact detail

**Worktree:** `D:\Worktrees\Database\cc-plan-detail` · **Branch:** `claude/caring-contacts-plan-detail`
**Not pushed. No pull request. No subagents dispatched.**

---

## What was built, and where

Nothing new was routed. Everything below is the **patient overview deepened**, plus one new
overlay-trigger module and one wording map in the sealed domain.

| File | Change |
| --- | --- |
| `src/components/caring-contacts/workspace/patient-overview.tsx` | The plan detail itself: the attestation card, the plan-not-running note, the delivery-detail control on each row that has a transport report, and the removal of the `UnavailableDestination` that used to point at "the plan detail". |
| `src/components/caring-contacts/workspace/overlays/exit-only-overlay-trigger.tsx` | **New.** The trigger for the overlays the frozen table marks `mutatesState: false`, whose decision control is an exit rather than a confirmation, and the module where the Ruling [87] tension is resolved. |
| `src/lib/caring-contacts/assurances.ts` | `PLAN_ASSURANCE_WORDING` + `planAssuranceWording()` — the plain words each attestation is read back in, beside the closed vocabulary they name. |
| `tests/caring-contacts-patient-overview.dom.test.tsx` | New cases across four blocks, listed under Verification. |
| `tests/caring-contacts-explained-automation.dom.test.tsx` | One allowlist entry, with its three conditions stated. |

---

## Ruling [128] — no new page route, and the design does not disagree

Plan detail is `/caring-contacts/patients/[patientId]?plan=<planId>`, built by `patientPlanRoute()`.
Contact detail is the `delivery-detail` overlay. No route was added, and none was needed.

**I looked for the disagreement the brief warned about and did not find one.** The approved design's
plan-detail screen is `src/components/caring-contacts/mockups/product-pages.tsx`
(`caring-contact-screen-plan-detail`), and it is design scratch under a `/mockups` route that 404s in
production — not a claim that production carries a `/caring-contacts/plans/[planId]` route.
`CARING_CONTACTS_ROUTES` has no key for one; `planRoute()` and `contactRoute()` exist in
`src/lib/caring-contacts-routes.ts` as declared-but-unbuilt shapes and are still unbuilt after this
task. So there is nothing to record as a difference beyond that: **the mockup names a screen, and the
screen is this one.**

### Ruling [46] — no new `AccessedObjectType` member, decided deliberately

**Concluded: no new member is owed, and none was added.** The deepening reads nothing new. The
attestations arrive on `PlanRecord` from the `{ search, plan, "all" }` read the page already makes;
the first-contact reason arrives on `Episode` from the `{ view, episode, <planId> }` read the page
already makes for this plan. Adding a member would put a second name on the access trail for a read
that did not happen — and because the trail filters on `objectType` with no `objectId` filter, that
second name would be visible by eye and unaskable, which is Task 5b's defect pointed the other way.
The `z.enum` in `src/app/api/caring-contacts/access-trail/route.ts` is therefore untouched, and Task
12's pin has nothing to keep in sync for this change.

---

## The two stored fields that move in opposite directions

Both are now rendered by one screen, and a cleared plan shows both at once.

**The first-contact reason (Ruling [105]) is cleared.** `FirstContactReason` already distinguished
its four cases before this task — reason held, role may not read the episode, retention clearance,
plan older than the field. I did not change it. What this task adds is the **other half beside it**,
so a reader who sees the reason gone and the attestation present is told why the two differ rather
than left to guess that one was missed.

**The attestation (Ruling [122]) is preserved,** and the card says so in place: "A retention clearance
leaves these on the plan while it removes the patient's detail … Each line above holds no patient
detail, only which check was made and when, so removing it would destroy the evidence that the check
happened while keeping the plan it belongs to."

**Not a consent record.** The card says a coordinator confirmed *that the patient had agreed*, never
that the patient agreed; it says the agreement is held in the patient's hospital record and not in
this system; and a test asserts the card contains no occurrence of "consent" at all. **Name the
destination, not the act:** every mention is "recorded on the plan", and the assertion that pins it
reads the attestation **list**, not the paragraph above it, so it cannot be satisfied by prose
elsewhere on the card.

**A plan with no attestation states itself.** "This plan holds no record of those confirmations. It
was created before this plan began recording them, and nothing was written into the older plans
afterwards — a placeholder here would be a clinical record nobody made. Nobody failed to confirm
anything." It also says explicitly that a retention clearance is **not** what emptied it, because
that is the wrong conclusion nearest to hand on this screen.

---

## The defect I wrote the first test for: a plan that is not running

The brief's "stopped plan" case has two halves, and only one was already closed.

**Already closed, and left alone.** `withdrawPlan` and `recordHospitalStatusEvent` run every unsent
contact through `{ type: "cancel" }`, so a withdrawn or death-stopped plan is ten cancelled contacts;
`contactSendability` classifies them `willNotBeSent`, the summary says "none of them will be sent",
and `notSentExplanation` gives each row its own reason.

**Open, and the one this screen would have reintroduced.** `pausePlan` is a plain lifecycle
transition: it moves the plan and touches no contact. So a **paused** plan's messages are still
`scheduled`, `contactSendability` correctly says `stillToSend`, and the summary sentence reads
"10 entries, and every one of them is still to be sent." That is true about the record and reads as a
promise about the future. A **draft** plan is the same shape.

`planNotRunningNote` states the second fact beside the first: "The messages below are dated and still
to be sent, and this plan is paused. A paused plan is not running, so a date below is not a message
on its way." Draft gets its own wording, and the two are asserted not to collapse into one.

**Deliberately NOT fixed by re-deriving sendability on the screen.** The classification is correct and
belongs to `src/lib/caring-contacts/model.ts`; what was missing is `plan.state`, and stating it is the
screen's job. The note claims nothing about what a dispatcher would do — see open question 1.

**The terminal branch is guarded and defensive.** It fires only when `stillToSend > 0`, which an ended
plan never has, and it says the two records disagree rather than inventing a cause. That guard is
proved by its own test (an ended plan gets no plan-level note) rather than assumed — it would
otherwise have been an unproven check, which the standing discipline calls a hypothesis.

---

## The delivery-detail overlay, and the commit tension resolved honestly

**Where it is offered.** On each schedule row where `contactSendability(state) === "alreadySent"` —
the domain's own classification, asked rather than copied. A scheduled, suppressed, cancelled or
missed message has no transport report, so no control promises one.

**What the drawer can and cannot say — a real limit, reported rather than worked around.**
`OverlayHost` renders each row's frozen `summary` and **takes no children**. There is no slot for
per-row content, so the overlay cannot name the contact it was opened from. The per-contact fact
therefore stays on the row itself, where `CONTACT_STATE_LABELS` already labels every provider state as
a transport receipt, and the trigger names the row so ten of them are not ambiguous.

**The tension, and how it was resolved.** `delivery-detail` is `mutatesState: false` and its decision
is "Close this detail". Two obvious answers are both wrong:

- `{ kind: "unavailable", reason }` carries scope `every-row`, so the host would `aria-disabled` the
  exit and print a refusal beside it — **the exact defect Ruling [90] fixed**, reintroduced from the
  caller's side instead of the host's.
- `{ kind: "record", record: () => {} }` written inline is the silent no-op Ruling [87] exists to
  prevent.

**The answer is neither: for an exit row, the host's own close IS the whole action.**
`WorkspaceOverlays.recordDecision` calls the commit and then calls `closeWorkspaceOverlay()`
unconditionally, so "Close this detail" is performed in full and there is genuinely nothing left for
the commit to do. That is a property of the **row**, so it is asserted against the row rather than by
a comment: `exitOnlyOverlayCommit` **throws** for any row the frozen table marks `mutatesState: true`,
and for an unknown id. That guard is what stops the module becoming the workspace's universal escape
hatch from Ruling [87], and it is under test in both directions.

**Why it is a component rather than an exported value.** A Server Component cannot pass a function
across the client boundary at all, and `record` is a function position. Constructing the commit inside
the client boundary is what lets every screen above it stay a Server Component and pass plain data (an
overlay id, a class name, children). That is also why it needed an entry in
`ALLOWED_CLIENT_COMPONENTS`, added on the three conditions Ruling [59] states.

### FINDING: `WorkspaceOverlayCommit` has no member for a non-mutating row

**I did not weaken the type, and I am reporting it rather than fixing it.** The union expresses
"records something" and "is not built yet" and has no member meaning *"this row's decision is an exit,
and the host's own close is the action."* Every screen wiring a non-mutating row must
therefore reach for a construct like `exitOnlyOverlayCommit` or write a bare no-op — and Tasks 11 and
14 are about to wire `activation-success` and `permission-unavailable`, which are exactly those rows.
Adding a member is a change to Task 3's pinned contract and to the totality of `commitRefusalFor`, so
it is the owner's call, not a screen's.

**And the choice between the two is unproven offline** — mutation M25 demonstrates it. Swapping the
exit commit for `{ kind: "unavailable" }` leaves every offline gate green, because the difference is
only visible once the overlay is **open**, which is Playwright's ground.

---

## Seams left for other tasks, named

- `resolve-failed-delivery` — **Task 14.** Not wired. See open question 3 about attempt records.
- `pause`, `withdrawal`, `reassignment`, `activation-success` — **Task 11.** Not wired. The paused note
  says in plain words that there is no control for resuming on this screen yet, rather than offering a
  dead one.
- `message-preview` — not wired here. The frozen `EXACT_PATIENT_VISIBLE_MESSAGE` specimen is not
  rendered on this screen at all: **no patient-visible copy was drafted, quoted, or interpolated.**
- Task 12's schedule read — not used, not waited for, not reimplemented.

---

## Open questions and limits I could not close

1. **A paused plan is still offered as sendable by the domain.** `listSendableContacts` filters on
   `contact.state === "scheduled"` and consults `plan.state` nowhere, so a paused plan's contacts are
   still in the sendable list. I did **not** change that — it is a domain question, not a screen one —
   and I deliberately wrote the note to say what the two records hold rather than to claim what a
   dispatcher would do. **Worth your eye:** if pausing is meant to stop sending, the rule for that does
   not currently live anywhere.
2. **The attestation's actor is recorded on the plan and is not shown.** Actor ids in this workspace
   are `demo-<role>`, so printing one would put a raw role identifier in front of a clinician. Role
   wording lives in the sealed domain (`CARING_CONTACT_ROLE_WORDING`) and resolves from a **role**;
   nothing maps an actor id to one, and parsing the id's shape on a screen would be re-deriving a rule
   the session module owns. The card says the account is recorded and is not shown, and why. Naming the
   person needs a directory this prototype has not got.
3. **The domain holds no per-attempt record.** `Contact` is `{ id, planId, state, version }` — no
   attempt timestamps and no attempt count. So "what already happened" is the transport receipt state
   and nothing more, and the `resolve-failed-delivery` row's "all three attempts in the original window"
   has no data behind it today. Flagged for Task 14 rather than invented here.
4. **No sixth hospital-record value was found.** The five the standing discipline names are the only
   ones this screen wanted and did not have.

---

## Does this touch `tests/ui-caring-contacts-workspace.spec.ts`?

**My assessment: no, and I did not run it.**

That spec's `caring-contacts patient overview` block runs against the isolated Playwright server, whose
in-memory store **seeds no plans** — its own module note says so in as many words. Every one of its
patient-overview tests therefore exercises the **zero-plan** path and asserts on the
`No plan for this patient` empty state. None can reach `EpisodeOverview`, so none can reach the
attestation card, the not-running note, the schedule rows, or the trigger. The `UnavailableDestination`
I removed is likewise unreachable there, and nothing in the spec names it.

**The one thing worth your judgement:** that spec asserts single occupancy of the overlay content node
throughout, and this change introduces the workspace's first production `delivery-detail` trigger. It
sits on an unreachable branch of that server, so it cannot affect the assertion today — but if a plan
is ever seeded into the Playwright store, that spec becomes the surface where the exit-commit choice
(the finding above, mutation M25) would finally be provable.

---

## Verification

Gates run in this worktree. **Every summary line is pasted; none is reported from an exit code.**

### `npm run test:cc-guards` (with `GATE_RECEIPTS=refresh`, so no cached receipt could stand in)

```
 Test Files  18 passed (18)
      Tests  407 passed (407)
   Duration  82.33s
```

An earlier run at 406 tests went **red** on one file before the client-component allowlist entry was
added, which is itself evidence the gate examines this change:

```
 FAIL  |jsdom| tests/caring-contacts-explained-automation.dom.test.tsx > the service-state path stays on the server
 Test Files  1 failed | 17 passed (18)
      Tests  1 failed | 405 passed (406)
```

### Typecheck

`npx tsc -p tsconfig.json --noEmit` — no diagnostics emitted, exit 0.

### Lint, uncached

`node_modules/.cache/eslint` removed first, then `npx eslint --format json` over the five changed
files. The JSON names the files it examined, so this is not an exit code standing in for a run:

```
exit=0
files examined: 5
overlays\exit-only-overlay-trigger.tsx      errors 0 warnings 0 []
workspace\patient-overview.tsx              errors 0 warnings 0 []
lib\caring-contacts\assurances.ts           errors 0 warnings 0 []
tests\caring-contacts-explained-automation.dom.test.tsx  errors 0 warnings 0 []
tests\caring-contacts-patient-overview.dom.test.tsx      errors 0 warnings 0 []
```

### Not run, and why

- `npm run test` — the controller's, at merge points. Three worktrees are live and the exclusive
  heavy lease is the resource the standing discipline protects.
- `npm run verify:ui` / `tests/ui-caring-contacts-workspace.spec.ts` — see the section above; the
  changed branches are unreachable in that server.
- Anything provider-backed — not approached.

### One test-shape correction I made to my own work

My first version of the attestation read-back asserted the rendered text against
`planAssuranceWording(...)`'s **own return value**. That is precisely the shape Task 9b's mutation
falsified: emptying the map moves both sides together and the assertion agrees with itself. It was
rewritten to hold the rendered text to **literal expected content**, with the map pinned to the same
literals separately, before any mutation was run. Mutation **M10** is the one that proves the
correction: changing the domain's wording now goes red where it would previously have stayed green.

---

## Mutation ledger

Rules the driver enforced, each from the standing discipline: `git diff --quiet` asserted clean on
**both** sides of every mutation; presence checked **in process** by reading the file, never through a
shell (`grep -c` silently returns 0 here for a mutation demonstrably present); the gate was
`npm run test:cc-guards` and nothing wider, with `GATE_RECEIPTS=refresh`; every attempt itemised,
greens included; **no aggregate total**.

| # | The claim the mutation attacks | Expected | Got | Gate result (`Tests`) |
| --- | --- | --- | --- | --- |
| M1 | the paused note names the PAUSED state as the cause | red | **RED**, as predicted | 1 failed / 406 passed (407) |
| M2 | the paused note says a date is not a message on its way | red | **RED**, as predicted | 1 failed / 406 passed (407) |
| M3 | the paused note says what would change it | red | **RED**, as predicted | 1 failed / 406 passed (407) |
| M4 | the paused note is LABELLED Paused, so it is findable by the state it is about | red | **RED**, as predicted | 1 failed / 406 passed (407) |
| M5 | the draft note names NOT STARTED as the cause | red | **RED**, as predicted | 1 failed / 406 passed (407) |
| M6 | draft and paused are different facts and do not collapse into one label | red | **RED**, as predicted | 1 failed / 406 passed (407) |
| M7 | the draft note says a date is not a message on its way | red | **RED**, as predicted | 1 failed / 406 passed (407) |
| M8 | a RUNNING plan gets no such note, so the note means something when it appears | red | **RED**, as predicted | 1 failed / 406 passed (407) |
| M9 | an ENDED plan, which explains itself row by row, gets no plan-level note | red | **RED**, as predicted | 1 failed / 406 passed (407) |
| M10 | THE SELF-COMPARISON TRAP IS CLOSED: the read-back is held to expected content | red | **RED**, as predicted | 2 failed / 405 passed (407) |
| M11 | each attestation row NAMES THE DESTINATION rather than only the act | red | **RED**, as predicted | 1 failed / 406 passed (407) |
| M12 | no wording on this card says the patient consented | red | **RED**, as predicted | 1 failed / 406 passed (407) |
| M13 | the card says WHERE the agreement lives | red | **RED**, as predicted | 1 failed / 406 passed (407) |
| M14 | the attestation's own instant is read back, not a constant | red | **RED**, as predicted | 1 failed / 406 passed (407) |
| M15 | the empty case states itself as a fact | red | **RED**, as predicted | 1 failed / 406 passed (407) |
| M16 | the empty case says WHICH absence it is -- an older plan, not a missed confirmation | red | **RED**, as predicted | 1 failed / 406 passed (407) |
| M17 | a plan WITH attestations renders them rather than the empty copy | red | **RED**, as predicted | 2 failed / 405 passed (407) |
| M18 | the card says WHY retention keeps the attestation while it clears the reason | red | **RED**, as predicted | 1 failed / 406 passed (407) |
| M19 | the delivery drawer is offered where a message LEFT, not where it did not | red | **RED**, as predicted | 2 failed / 405 passed (407) |
| M20 | the control raises the delivery-detail row and no other | red | **RED**, as predicted | 1 failed / 406 passed (407) |
| M21 | the control names the row, so ten of them are not ambiguous | red | **RED**, as predicted | 1 failed / 406 passed (407) |
| M22 | the exit-only commit REFUSES a row that records something (not a universal no-op) | red | **RED**, as predicted | 1 failed / 406 passed (407) |
| M23 | an unknown overlay id is refused by name rather than by a TypeError | red | **RED**, as predicted | 1 failed / 406 passed (407) |
| M24 | OVER-SENSITIVITY CONTROL: no assertion reads the trigger's responsive width | green | **GREEN**, as predicted | 407 passed (407) |
| M25 | FINDING: the CHOICE of a record commit over an unavailable one is unproven offline | green | **GREEN**, as predicted | 407 passed (407) |

Predicted message against observed, row by row:

- **M1** — predicted: *element does not contain "this plan is paused"*
  - failing test: `says a PAUSED plan is not running, and that a date below is not a message on its way`
  - observed: Error: expect(element).toHaveTextContent() Expected element to have text content:   this plan is paused Received:
- **M2** — predicted: *element does not contain "a date below is not a message on its way"*
  - failing test: `says a PAUSED plan is not running, and that a date below is not a message on its way`
  - observed: Error: expect(element).toHaveTextContent() Expected element to have text content:   a date below is not a message on its way Received:
- **M3** — predicted: *element does not match /Resuming the plan/i*
  - failing test: `says a PAUSED plan is not running, and that a date below is not a message on its way`
  - observed: Error: expect(element).toHaveTextContent() Expected element to have text content:   /Resuming the plan/i Received:
- **M4** — predicted: *unable to find an accessible element with the role "group" and name "Paused"*
  - failing test: `says a PAUSED plan is not running, and that a date below is not a message on its way`
  - observed: TestingLibraryElementError: Unable to find an accessible element with the role "group" and name "Paused" Here are the accessible roles: region: Name "Rowan Sample":
- **M5** — predicted: *element does not contain "this plan has not been started"*
  - failing test: `says a DRAFT plan has not been started, in different words from the paused one`
  - observed: Error: expect(element).toHaveTextContent() Expected element to have text content:   this plan has not been started Received:
- **M6** — predicted: *unable to find an accessible element with the role "group" and name "Draft"*
  - failing test: `says a DRAFT plan has not been started, in different words from the paused one`
  - observed: TestingLibraryElementError: Unable to find an accessible element with the role "group" and name "Draft" Here are the accessible roles: region: Name "Rowan Sample":
- **M7** — predicted: *element does not contain "a date below is not a message on its way"*
  - failing test: `says a DRAFT plan has not been started, in different words from the paused one`
  - observed: Error: expect(element).toHaveTextContent() Expected element to have text content:   a date below is not a message on its way Received:
- **M8** — predicted: *expected null not to be in the document (queryByRole group "Paused")*
  - failing test: `adds no such note to a running plan, so the note means something when it appears`
  - observed: Error: expect(element).not.toBeInTheDocument() expected document not to contain element, found <div aria-label="Paused" class="flex min-w-0 flex-col gap-1 rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2 forced-colors:border-[CanvasText]"
- **M9** — predicted: *expected element not to be in the document (queryByRole group "Withdrawn")*
  - failing test: `adds no plan-level note to an ENDED plan, which already explains itself row by row`
  - observed: Error: expect(element).not.toBeInTheDocument() expected document not to contain element, found <div aria-label="Withdrawn" class="flex min-w-0 flex-col gap-1 rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2 forced-colors:border-[CanvasText]"
- **M10** — predicted: *element does not contain "A coordinator confirmed that the patient had agreed to receive caring contacts"*
  - failing test: `reads both attestations back in plain words, and never says the patient consented`
  - observed: Error: expect(element).toHaveTextContent() Expected element to have text content:   A coordinator confirmed that the patient had agreed to receive caring contacts Received:
- **M11** — predicted: *element does not match /recorded on the plan on/i*
  - failing test: `reads both attestations back in plain words, and never says the patient consented`
  - observed: Error: expect(element).toHaveTextContent() Expected element to have text content:   /recorded on the plan on/i Received:
- **M12** — predicted: *expected element not to match /consent/i*
  - failing test: `reads both attestations back in plain words, and never says the patient consented`
  - observed: Error: expect(element).not.toHaveTextContent() Expected element not to have text content:   /consent/i Received:
- **M13** — predicted: *element does not match /hospital record/i*
  - failing test: `reads both attestations back in plain words, and never says the patient consented`
  - observed: Error: expect(element).toHaveTextContent() Expected element to have text content:   /hospital record/i Received:
- **M14** — predicted: *element does not contain "2026-03-02 (AWST)"*
  - failing test: `reads both attestations back in plain words, and never says the patient consented`
  - observed: Error: expect(element).toHaveTextContent() Expected element to have text content:   2026-03-02 (AWST) Received:
- **M15** — predicted: *element does not match /holds no record of those confirmations/i*
  - failing test: `says a plan created before the attestation existed holds none, rather than rendering a blank`
  - observed: Error: expect(element).toHaveTextContent() Expected element to have text content:   /holds no record of those confirmations/i Received:
- **M16** — predicted: *element does not match /before this plan began recording them/i*
  - failing test: `says a plan created before the attestation existed holds none, rather than rendering a blank`
  - observed: Error: expect(element).toHaveTextContent() Expected element to have text content:   /before this plan began recording them/i Received:
- **M17** — predicted: *element does not contain "A coordinator confirmed that the patient had agreed to receive caring contacts"*
  - failing test: `reads both attestations back in plain words, and never says the patient consented`
  - observed: Error: expect(element).toHaveTextContent() Expected element to have text content:   A coordinator confirmed that the patient had agreed to receive caring contacts Received:
- **M18** — predicted: *element does not match /no patient detail/i*
  - failing test: `keeps the attestation on a cleared plan while the first-contact reason has gone`
  - observed: Error: expect(element).toHaveTextContent() Expected element to have text content:   /no patient detail/i Received:
- **M19** — predicted: *accessible name "What the phone network reported — Month 1" does not match /Day 1/*
  - failing test: `offers it on a message that went out, naming the row it was opened from`
  - observed: Error: expect(element).toHaveAccessibleName() Expected element to have accessible name:   /Day 1/ Received:
- **M20** — predicted: *expected data-overlay-trigger "message-preview" to equal "delivery-detail"*
  - failing test: `offers it on a message that went out, naming the row it was opened from`
  - observed: Error: expect(element).toHaveAttribute("data-overlay-trigger", "delivery-detail") // element.getAttribute("data-overlay-trigger") === "delivery-detail" Expected the element to have attribute:   data-overlay-trigger="delivery-detail" Received:
- **M21** — predicted: *accessible name "What the phone network reported" does not match /Day 1/*
  - failing test: `offers it on a message that went out, naming the row it was opened from`
  - observed: Error: expect(element).toHaveAccessibleName() Expected element to have accessible name:   /Day 1/ Received:
- **M22** — predicted: *expected function to throw an error matching /records a decision/i, but it did not throw*
  - failing test: `refuses to be the workspace's escape hatch from Ruling 87 on a row that records something`
  - observed: AssertionError: expected [Function] to throw an error - Expected: null + Received:
- **M23** — predicted: *thrown error message does not match /No overlay is defined/i (a null property read instead)*
  - failing test: `refuses to be the workspace's escape hatch from Ruling 87 on a row that records something`
  - observed: AssertionError: expected [Function] to throw error matching /No overlay is defined/i but got 'Cannot read properties of null (readi…' - Expected: /No overlay is defined/i + Received:
- **M24** — predicted: *green -- geometry is not asserted offline, and should not be*
  - observed: no failure, and none expected. 407 passed (407).
- **M25** — predicted: *green -- the difference is visible only once the overlay is open, which is Playwright's ground*
  - observed: no failure, and none expected. 407 passed (407).

---

## Three process incidents during verification, none of them absorbed

**1. The scratchpad is shared, and my first driver sat at a colliding path.** The session scratchpad
holds helpers from every task in this programme (`mutate.py`, `mutate2.py`, `mutate-b2-*.mjs` and so
on). My first driver was written as a generic `mutate.mjs` writing a generic `ledger.md` — exactly the
collision the coordinator warned about. **Every row above was re-run** from a namespaced driver
(`scratchpad/cc-plan-detail/mutate-cc-plan-detail.mjs` → `ledger-cc-plan-detail.md`), and the generic
copies were deleted. The driver now also **reads the vitest `RUN` header out of each captured run and
records whether it names this worktree**; every row above carries
`attributed to THIS worktree (cc-plan-detail): true`, and a row that did not would abort the pass
rather than be reported. A result that cannot name itself is not evidence.

**2. A stale driver process dirtied the tree, and the guard caught it rather than absorbing it.**
After the first driver was stopped, a surviving node process left a mutation applied. The next pass
refused at its first row with `ABORTED | worktree dirty BEFORE applying`, which is exactly what the
`git diff --quiet`-on-both-sides rule exists for. The tree was restored and verified clean before the
namespaced run began, and it is clean now.

**3. Three rows were blocked by a lock refusal, and a refusal is neither a pass nor a failure.**
M20, M22 and M25 first came back with **no summary line**: `Database focused-test capacity is full`,
owned by other worktrees (`cc-schedule`, and the parent worktree). They were **retried, never forced**,
and all three landed. Their intermediate refusals stay itemised in the ledger file rather than tidied
away.

---

## What the ledger does NOT prove, stated rather than implied

- **M25 is a real gap, not a formality.** Swapping the exit commit for `{ kind: "unavailable" }` left
  the whole gate green. Nothing offline distinguishes the two, because the difference appears only
  inside an **open** overlay. If the owner wants that pinned, it needs a browser test that opens the
  drawer and asserts its action control is not `aria-disabled`.
- **M24 is an over-sensitivity control** and its green is the correct answer: no assertion reads the
  trigger's responsive width, and none should.
- **The schedule summary sentence itself** is asserted in my paused-plan case but was **not** mutated
  by me — `scheduleSummarySentence` is an earlier task's, proved by the Ruling [98] and ended-plan
  blocks above mine. I am relying on those rather than claiming my own coverage of it.
- **M10, M17 and M19 each turned two tests red**, not one. Reported rather than smoothed: each attacks
  a claim that two of my cases depend on.
