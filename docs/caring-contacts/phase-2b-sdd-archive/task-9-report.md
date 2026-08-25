# Task 9 report — stage 4, review and activation

**Branch:** `claude/browser-test-gate-handoff-d5c1db`. Committed locally; nothing pushed, no PR.

**Commits:**

| SHA         | What                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------- |
| `12f8e0ad1` | **Not mine, and this is a finding.** Another session's docs commit swept in my first two files |
| `1cb79ad5d` | `plan-activation.ts` — the pure half — and its 16 cases                                        |
| `399904cd8` | The draft carries `activation` and `submission`, in the type, the empty draft and the parser   |
| `451231a49` | Stage 4 itself: the body, the write, the confirmation overlay, and `stages.ts` flipped         |
| `PENDING-1` | Test-harness corrections (one render tree; `fireEvent` for date inputs)                        |
| `PENDING-2` | Stage 4's fields in Task 7's draft fixture; branded ids in the new test                        |

---

## 0. A finding before anything else: another session is committing in this worktree

At 20:57 a commit titled `docs(caring-contacts): round 3 — the missing mutation, and what "proved"
means` landed on this branch. Its message describes only `phase-2b-build-record.md` and
`task-8-report.md` work — but its diff also contains **`src/lib/caring-contacts/schedule.ts` (+36)
and `tests/caring-contacts-schedule.test.ts` (+71)**, which are mine: the `firstContactDayBounds`
export and its three cases, written and green minutes earlier and not yet committed. That session
ran `git add -A` and swept my working tree into its commit.

Nothing was lost and nothing conflicts, so I have not tried to unpick it. But it is worth saying
plainly because of what it could have cost rather than what it did: that session is doing **mutation
testing**, which means `git checkout --` against files in this worktree. Had it reverted a mutation
while my uncommitted edits were in the same file, my work would have gone. I committed every piece
immediately from then on, including one deliberately untested intermediate commit, for exactly that
reason.

**Recommendation:** one worktree, one session. If two are unavoidable, the second should stage paths
explicitly rather than `git add -A`.

---

## 1. What was built, file by file

| File                                                                       | What changed                                                                                                       |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `src/components/caring-contacts/workspace/plan-wizard/plan-activation.ts`  | **New.** What stage 4 collects, what it derives, the body it sends, and the words for every refusal. Pure.         |
| `src/components/caring-contacts/workspace/plan-wizard/plan-wizard.tsx`     | `ReviewStage`, the `activate()` write, the minting, the created state, `DateField`, `RefusalStatement`.            |
| `src/components/caring-contacts/workspace/plan-wizard/plan-draft.ts`       | `activation` and `submission` added to `PlanDraft`, to `emptyPlanDraft` **and to `parseDraft`**.                   |
| `src/components/caring-contacts/workspace/plan-wizard/stages.ts`           | `review` flipped to `{ kind: "built" }`; the false coverage claim about `assertBuiltStageHasABody` corrected.      |
| `src/lib/caring-contacts/schedule.ts`                                      | `firstContactDayBounds` — the days a screen may offer, derived from the three constants the refusal is enforced by. |
| `package.json`                                                             | `test:cc-guards` gains `tests/caring-contacts-plan-activation.test.ts`.                                            |

Tests added: `tests/caring-contacts-plan-activation.test.ts` (16 cases).
Tests extended: `tests/caring-contacts-plan-wizard.dom.test.tsx`, `tests/caring-contacts-plan-draft.dom.test.tsx`,
`tests/caring-contacts-schedule.test.ts`.

---

## 2. The rulings, and how each was implemented

### Ruling [117] — the write, and the three orderings

`activate()` in `plan-wizard.tsx` is the whole of it, and it is deliberately linear so the ordering
can be read off the source rather than reasoned about:

1. **Confirm success → clear the draft → navigate.** `clearPlanDraft()` is called only after
   `answer.ok`, and `router.push` only after that. A test records the order from inside the `fetch`
   stub and from inside the `push` mock and asserts the exact sequence
   `["fetch-answered", "draft-still-held", "navigate-after-clear"]`. Both reversals would have passed
   a test that only checked the end state.
2. **On ANY failure the draft survives.** Nothing but the successful path touches the draft. Five
   failure shapes are covered by one case — a lost connection, a permission refusal, an existing
   plan, a schedule refusal, and an answer that is not JSON — and each asserts the patient's name is
   still readable out of storage and that nothing navigated.
3. **The refusal says which failure it was, in place.** `submissionRefusalWording` is a total map
   from refusal name to a three-part §4.4 statement, and its **default names the refusal verbatim**.
   A property test walks twenty named refusals plus one nobody has written and requires each to have
   a reason and a remedy, to avoid "something went wrong", and to say the draft survived.

**One thing the API surfaces that this screen cannot distinguish, stated rather than papered over.**
`writeHandler` answers a cross-team write with `not-found` on purpose, so a cross-team actor cannot
learn the record exists. The screen therefore cannot tell "another team's referral" from "nothing
there", and its `not-found` wording says exactly that rather than guessing.

### Ruling [120] — minted once, together, held in the draft

`mintPlanSubmissionIdentity()` returns both, and the draft holds them. There are two arrival points
at stage 4 and both go through that one function: `goTo("review")` mints in the same write that moves
the stage, and an effect covers a stored draft that already names `review` (a reload, or a draft
written before this build). Neither re-mints.

The retry property is tested directly: two confirmations, the first refused with `service-stopped`,
and the two request bodies must carry the same `planId` **and** the same `idempotencyKey`.

**The minted identifiers contain no digits at all, and that is not decoration.**
`ACCESS_OBJECT_ID_PATTERN` would accept a bare UUID, but `audit.ts` scans every field of an assembled
audit event against an Australian mobile-number pattern and **throws** on a match — and a random
hexadecimal string can produce an eleven-digit run. Rare rather than impossible is the worst kind:
the plan is created and the audit record for it cannot be built. So the UUID's hex is mapped to
sixteen letters, and the hazard is removed by construction. A test mints two hundred pairs and puts
each through `buildAccessAuditEvent` itself — the real guard, not a regex written in the test.

### Ruling [118] — the first-contact control, and its consequence

The domain half is used, never rebuilt. `firstContactDayBounds` (new, in `schedule.ts`) publishes
`usual`, `earliest` and `latest` derived from the same three offset constants `buildApprovedSchedule`
refuses against; the date input's `min`, `max` and default are read off it. Whether a value is
acceptable is never decided by the screen: `planSchedulePreview` builds the real schedule and reports
the domain's own named refusal, so `first-contact-invalid-date`, `first-contact-out-of-range`,
`first-contact-reason-required` and `first-contact-reason-too-long` all reach the clinician as four
distinguishable statements.

**The consequence is shown while the date is being chosen.** Moving the first contact to discharge +
7 suppresses Week 1, and the screen renders an `AutomatedState` naming Week 1, saying why, saying
what would change it, and stating that the plan will send nine messages rather than ten — in the same
panel as the control, before anything is confirmed. On the usual day nothing of the kind appears; a
test asserts both directions.

Whether to **ask** for a reason is decided by comparing the chosen day against the published `usual`
day — the same value `buildApprovedSchedule` compares against. That is the one place the screen makes
a decision adjacent to a domain rule, so it is pinned as a property: a test walks every day the
control can offer and requires the screen's answer to agree with what the domain does when no reason
is supplied.

### Ruling [119] — every count derived, and no false reassurance

**Counts.** `sendableContacts` in `hospital-events.ts` is the function the store itself uses when it
decides which planned entries to create as `scheduled` and which as `suppressed`, so the preview and
the plan cannot disagree. `total`, `stillToSend`, `willNotBeSent` and `closing` come from it and from
`PlannedContact.messageType`; nothing on the screen is a literal. The closing message is labelled as
its own kind, never as one more caring contact.

**The pin.** The ruling names `contactSendability()` and `summariseStoredContacts()`. The second one
cannot be called from this screen — see finding 3 — so it is used where it can be: a test creates a
plan in the in-memory store from the same input and requires `summariseStoredContacts` over the
contacts that store really built to agree with the preview, for both the usual day and discharge + 7.
That is the only assertion in the task that can fail honestly; every other count is compared against
a number written in the test.

**`Agreement confirmed: Yes` is not presented as a stored fact.** The phrase does not appear. What
the screen says instead is today's fact, in a `StatedReason`: the confirmations were made by you in
this sign-up, they are not facts read from a record, and they are **not recorded on the plan**.

The wording is deliberately about today rather than about a permanent property, on the coordinator's
mid-task note: the owner has decided these confirmations **will** be stored as an attestation, which
is a schema change and a later task. "Not recorded on the plan" is true now and becomes false in one
place when 9b lands. "Nothing in this domain records them" would have had to be hunted for.

### Ruling [121] — `dischargeAt` is collected here

A `type="date"` field labelled "Day the patient was discharged", **immediately beside** the
first-contact control in the same panel, under a heading that says why they are together. It starts
empty rather than defaulted to today: a discharge day the screen guessed is a clinical fact it
invented, and every date in the plan is counted from it.

The absence of a source is stated in place, in §4.4's shape, because an input for a value the
approved design shows arriving from a hospital record otherwise reads as an oversight.

`dischargeInstantFor` turns the chosen day into **midday AWST**. The hour is the screen's decision,
not the domain's: `buildApprovedSchedule` reads only the AWST calendar day, so the time changes
nothing about the schedule — but it changes what every other reader of the stored instant sees, and
midday is the one hour that lands on the chosen day under any conversion. UTC midnight for the same
day is 08:00 AWST, and anything the clinician might have meant before that lands on the day before.

### The one overlay wired

`final-activation`, through `WorkspaceOverlayTrigger`. When the plan cannot be created the commit is
`{ kind: "unavailable", reason }` and the reason names what is missing in the clinician's own terms,
so the overlay opens and states it rather than leaving a dead control behind it. Tests prove the
write does not fire on opening, that it does fire on the overlay's own decision control, and that an
unavailable commit's control is `aria-disabled` and inert.

---

## 3. Findings I am reporting rather than fixing

### Finding 1 — the write creates a plan in `draft`, and this screen is called "activation"

`createPlan` records `plan.state = "draft"`. Starting a plan is `activatePlan` — a **separate write,
on a separate route** (`/api/caring-contacts/plans/[planId]`), carrying its own `expectedVersion` and
needing its own idempotency key. Ruling [117] names one POST and Ruling [120] mints one key, so I
performed one write and did not invent a second.

The consequences, all three of which are yours to rule on:

- **The screen says what it does.** Its control reads "Create this plan", and a `StatedReason` above
  it says confirming creates the plan and its schedule, that the plan is created in draft and is not
  running, that starting it is a separate step this workspace does not have, and that nothing is ever
  sent from this prototype whatever state a plan is in.
- **The frozen overlay copy does not.** `final-activation`'s `decision` is **"Confirm and activate"**
  and its `title` is "Last check before the plan starts". Those are transcribed from
  `docs/caring-contacts/interaction-matrix.md` and I have not touched them. So the button inside the
  overlay says "activate" while the commit creates a draft plan. **I consider this the most important
  thing in this report.** It is the same class of overstatement as `Agreement confirmed: Yes`, one
  surface over, and I could not fix it without either editing frozen copy or performing a second
  write nobody has ruled on.
- **Two ways out, and I recommend the first.** Either (a) rule that stage 4 performs create **and**
  `activatePlan`, which is genuinely retry-safe — a replayed create returns the first attempt's own
  answer, so the pair can be retried end to end — and needs a second minted key plus a
  partial-success wording; or (b) amend the `final-activation` row to name creation. (a) matches the
  matrix, the stage's own name and `stages.ts`'s purpose line ("the control that starts it"); (b) is
  smaller but leaves the product with a plan nothing can start.

### Finding 2 — `stages.ts` claimed a proof that did not exist, since Task 7

The comment read: "`assertBuiltStageHasABody` in the wizard throws rather than rendering a stepper
over an empty column, and `tests/caring-contacts-plan-wizard.dom.test.tsx` proves it fires."
**Nothing did.** No test called it, and no render reached it.

This is the shape Task 8's round 2 named — a mechanism nobody has run, written down as coverage — and
it was sitting in the one guard protecting the exact mistake Tasks 8 and 9 could each have made:
flipping a table entry to `built` and not writing the body. It is also the shape that could not have
been caught by accident, because the guard is only reachable from a state the codebase never enters.

Fixed rather than only reported: the function is exported and called directly, in both directions
(throws on a missing body, returns the body when there is one), and the comment now says where the
proof is and why it had to move.

### Finding 3 — Ruling [119] names a function this screen cannot call

`summariseStoredContacts` takes `StoredContact` — a plan that already exists — and lives in
`repository.ts`, which names the service-state module in its own imports.
`tests/caring-contacts-explained-automation.dom.test.tsx` scans the wizard's whole client module
graph for that name, because the service-state record carries a free-text incident note that must
never cross this boundary. Importing it here would have made that guard red, and weakening the guard
to satisfy a ruling would be the wrong direction on both counts.

`contactSendability` is importable (it is in `model.ts`, already in the graph) but takes a
`ContactState`, which a planned contact does not have until the plan exists — so using it would have
meant the screen re-deriving the store's own planned-to-state mapping. `sendableContacts` **is** that
mapping's input in the store, so it is what the screen uses, and the store-agreement test is what
proves the two agree.

### Finding 4 — `UnbuiltStagePanel` and the unavailable forward control are now unreached

Every member of the stage union is built, so `planWizardStageImplementation` returns `not-built` for
nothing. `UnbuiltStagePanel`, `ForwardControl`'s unavailable branch and the `UnavailableDestination`
import in this file are all **unreached, not dead**: they are the extension point a fifth stage would
use, and Ruling 52 is what they implement. Stated at both sites rather than deleted, and named here
so a dead-code sweep meets an explanation rather than a reachability scan.

### Finding 5 — `MESSAGE_TYPE_LABELS` now exists twice

`PLANNED_MESSAGE_TYPE_LABELS` in `plan-activation.ts` holds the same three strings as
`MESSAGE_TYPE_LABELS` in `patient-overview.tsx`, and nothing keeps them in step. The overview's
cannot be imported (finding 3's reason). The right home is a module both can import — a small
wording module beside the domain, or the sealed domain itself. Not done here because it means moving
a constant out of a screen this task does not own.

### Finding 6 (carried) — the assurances still are not stored

Task 7's finding 1 and Task 8's finding 4. Now settled by the owner as Task 9b, per the coordinator's
note: the confirmations will be stored as an attestation. Stage 4's wording was written for that (see
Ruling [119] above) and the request body is assembled in one place (see §4) so 9b's fields are an
additive change.

---

## 4. What Task 9b and Task 11 inherit

**For Task 9b — the request-body seam.** `createPlanRequestBody` in `plan-activation.ts` is the
**only** place the POST body is assembled. It takes named parts (`submission`, `referralId`,
`patientId`, `pathwayVersionId`, `activation`, `sendingPreference`, `patientDetail`), returns the ten
keys `createPlanSchema` accepts or `null`, and `activate()` does nothing to it but stringify it.
Adding an `assurances` part is one parameter and one key there, plus the draft field it reads from —
no literal anywhere in the submit path, and no fixture holding a hand-written body.

Its test is likewise not a copy of the schema: the body is **POSTed to the real route handler** with
an in-memory store, so `.strict()`, every `min(1)` and the `auditableIdentifier` shape are enforced by
the thing that will enforce them in production. A field added to the schema and not to the body will
fail there rather than silently.

**For Task 11 — the seams stage 4 leaves.** No overlay but `final-activation` is wired.

| Overlay id             | What the mockup opens it for from this stage | Note                                                                                                            |
| ---------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `message-preview`      | The `MessagePreviewCard`                     | Patient-visible copy belongs to the sealed `message-copy`. Stage 4 renders none and says the wording comes from the pathway version. |
| `adjust-date-time`     | "Adjust schedule"                            | **Now built into the stage** as the first-contact control (Ruling [118]). This overlay and that control would be the same thing twice. |
| `activation-success`   | After a successful activation                | Stage 4 renders an in-flow created panel and navigates instead. If this overlay is wanted, it replaces that panel. |
| `save-draft`           | "Save draft"                                 | Task 8's recommendation stands: there is nothing to wire, the draft saves on every keystroke, and a control implying otherwise is worse than none. |
| `discard-changes`      | A discard confirmation                       | The wizard's real "Discard draft" control is unconfirmed. If this becomes a confirmation, it wraps that control.  |

---

## 5. Verification

### Test-first

**All four pieces, test-first, and each was run and seen red for its stated reason before the code
existed:**

- `firstContactDayBounds` — three cases written first: `TypeError: firstContactDayBounds is not a function`, then `Tests 26 passed (26)`.
- `plan-activation.ts` — sixteen cases written first: `Error: Cannot find package '@/components/…/plan-activation'`, then `Tests 16 passed (16)`.
- The draft's new fields — three cases written first, `3 failed | 16 passed (19)`, each failing on the parser accepting a draft it should have refused or on a field that did not exist.
- Stage 4 itself — the DOM cases written first: `22 failed | 32 passed (54)`, every one of the twenty-two unable to reach a stage that had no body.

### Mutation log — every attempt, itemised, no aggregate

_(filled in below after the fix round)_

### Gates

_(filled in below)_

### The browser gate

**No, I do not believe this touches `tests/ui-caring-contacts-workspace.spec.ts`, and I did not
change it.** The reason is unchanged from Tasks 7 and 8, and I checked it rather than inherited it:
that spec's isolated Playwright server seeds no referrals, so `/caring-contacts/plans/new` always
renders "No referral named" and no Playwright case can reach any stage of this wizard. Everything
Task 9 built is inside a stage.

That is a coverage gap rather than a clean bill of health, and stage 4 widens it in a way worth
naming: **two date inputs, a live schedule preview and a confirmation overlay have no browser
evidence at all.** The tap-target assertions here read the CLASS, not the rendered box, because jsdom
has no layout; `type="date"` renders a native picker whose real height and forced-colours behaviour
jsdom cannot show; and the overlay's `full-screen-stage` phone modality has never been seen with this
screen behind it. It cannot be closed until that server seeds a referral.

### Not run, and why

- `npm run verify:ui`, `verify:phone-chrome` — you run the browser gate, and see above for why it cannot reach this stage today.
- `npm run verify:cheap`, `verify:pr-local`, `verify:release` — not asked for; the last is provider-backed.
- Nothing provider-backed was run at all. No Supabase, no OpenAI, no GitHub, no CI.
