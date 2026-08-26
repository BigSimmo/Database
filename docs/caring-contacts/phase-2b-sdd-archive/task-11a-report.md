# Task 11a report — Group 1's wizard, inspection and outcome overlays

**Worktree:** `D:\Worktrees\Database\cc-plan-detail` · **Branch:** `claude/caring-contacts-plan-detail`
**Not pushed. No pull request. No subagents dispatched.** `pause`, `withdrawal` and `reassignment` untouched.

---

## READ THIS FIRST — the brief and the tree disagree about `pathway-preview`

**The brief lists `pathway-preview` as one of the three NON-mutating rows and tells me to wire it with
Task 10's `ExitOnlyOverlayTrigger`. The frozen contract says the opposite, in both of its copies.**

| Source                                                                       | `pathway-preview`                              |
| ---------------------------------------------------------------------------- | ---------------------------------------------- |
| `docs/caring-contacts/interaction-matrix.md`, the frozen table                | Mutation: **Yes**                              |
| `overlays/definitions.ts` line 104, checked row for row against the matrix    | `mutatesState: **true**`                       |
| The same row's `decision`                                                     | **"Use this pathway"**                         |

`exitOnlyOverlayCommit` **throws** for any row marked `mutatesState: true`. So the instruction as
written does not merely mis-classify the row — it produces a **render-time throw** on stage 2 of the
activation wizard, reaching `error.tsx`, for every coordinator who opens the pathway chooser.

**What I did, and why I did not stop and ask.** The brief itself names the matrix as "the frozen
contract", and the standing discipline says the types win where a specification and the tree
disagree. The row is not mis-classified in the tree: its decision **selects a pathway version**, so a
preview with a confirm control is exactly what it is. I therefore wired it as the frozen contract
says — a real `{ kind: "record" }` commit that chooses that version — and left the other two
non-mutating rows (`message-preview`, `activation-success`) on `ExitOnlyOverlayTrigger` as directed.
That is the conservative direction: treating a mutating row as an exit is the Ruling [87] defect,
whereas giving a genuinely mutating row a real commit is what Ruling [87] asks for.

**It is still your call to confirm.** If the owner's intent is that stage 2 offers an inspection-only
preview and the choice stays with the radio buttons, then the **matrix row** needs changing, not this
screen — and that is a change to a frozen contract Tasks 18 and 19 build against.

---

## The three the brief pre-decided, and how each landed

1. **`ExitOnlyOverlayTrigger` for the non-mutating rows** — done for `message-preview` and
   `activation-success`. Not `pathway-preview`, for the reason above.
2. **The overlay id union was NOT narrowed.** `definitions.ts` is untouched by this task. Nothing
   here conflicts with Task 14.
3. **`message-preview` reads the wording and renders what it gets.** No greeting is assembled, no
   name is interpolated, and the string is never split. See "What the preview can and cannot promise".

---

## What was built, and where

| File                                                                        | Change                                                                                                                                                                          |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/caring-contacts/workspace/plan-wizard/overlay-guards.ts`    | **New, pure.** The commit-time predicate: the two conditions, their plain-words refusals, and which row depends on which.                                                        |
| `src/components/caring-contacts/workspace/plan-wizard/plan-wizard.tsx`      | Seven rows wired; the two-moment guard; the in-place refusal statement; the message specimen panel; `Discard draft` moved behind its confirmation; `Leave this for now` added.   |
| `src/components/caring-contacts/workspace/plan-wizard/plan-draft.ts`        | `PlanDraftDecisions` — the two confirmations `verify-identity` and `communication-preference` record, held in the tab and written onto no plan — plus its tolerant parser branch. |
| `src/components/caring-contacts/workspace/patient-overview.tsx`             | `activation-success`, offered beside the confirmations card while the plan is running.                                                                                          |
| `src/app/caring-contacts/plans/new/page.tsx`                                | Resolves `EXACT_PATIENT_VISIBLE_MESSAGE` on the server and hands it to the wizard as a plain string.                                                                             |
| `tests/caring-contacts-plan-wizard.dom.test.tsx`                            | The new decision-overlay block, plus the discard case moved onto the confirmation.                                                                                              |
| `tests/caring-contacts-patient-overview.dom.test.tsx`                       | The `activation-success` block, plus two counts narrowed from "every trigger" to "this row's triggers".                                                                          |
| `tests/caring-contacts-new-plan-page.dom.test.tsx`                          | The page passes the sealed domain's own wording, not a copy of it.                                                                                                              |

### Where each of the eight is reached from

| Row                        | Where                                     | Commit                                                          |
| -------------------------- | ----------------------------------------- | --------------------------------------------------------------- |
| `verify-identity`          | Stage 1, beside the referral facts        | Records `decisions.identityChecked`                             |
| `change-patient`           | Stage 1, beside it                        | Removes the draft, **then** navigates to this team's plans      |
| `pathway-preview`          | Stage 2, one per approved version row     | Chooses that version                                            |
| `message-preview`          | Stage 3, beside the wording panel         | Exit — the host's own close                                     |
| `communication-preference` | Stage 3, under the sending-time fieldset  | Records `decisions.preferenceGivenOnStaffedLine`                |
| `save-draft`               | The draft notice, on every stage          | Leaves the screen with the sign-up still on this computer       |
| `discard-changes`          | The draft notice, on every stage          | Removes the draft                                               |
| `activation-success`       | Patient overview, on a **running** plan   | Exit — the host's own close                                     |

---

## The commit-time recheck, and the two moments it is asked at

`openWorkspaceOverlayWithCommit` stages the commit **when the trigger is activated**. A commit
closure that captured that render's `draft` would write it back over whatever the tab holds when the
decision is finally confirmed — and the worst instance of that is not stale data, it is a draft
holding a patient's name and mobile number being **recreated in this tab's storage after something
deliberately removed it**.

`overlay-guards.ts` is a pure predicate over **two** states — what was true when the surface was
raised, and what is true as it is confirmed — and the wizard asks it twice:

- **at render**, with the same value twice (the honest answer: nothing has changed yet). A condition
  already unmet makes the commit `{ kind: "unavailable", reason }`, which `commitRefusalFor` scopes
  `every-row`, so the **host** renders the named reason and keeps its decision control focusable with
  `aria-disabled`. That is the frozen matrix's guard-rejection shape, implemented by the host rather
  than re-derived on a screen.
- **inside the commit**, against the render-time values and values read at that instant. A refusal
  there calls nothing, so nothing is mutated.

### The structural limit: the host closes unconditionally

`WorkspaceOverlays.recordDecision` calls the commit and then calls `closeWorkspaceOverlay()`
**unconditionally**. So an overlay **cannot** stay open to report a refusal its own commit
discovered. The matrix's "retain the surface" clause is therefore served by the **open-time** branch
only; a commit-time refusal is stated in place on the screen, in the three-part `StatedReason` shape
this workspace uses everywhere, naming the decision from the frozen table and saying that nothing was
changed. That follows Task 9's own precedent for `final-activation` (`state.status === "refused"`
renders on the screen, not in the overlay). **Reported rather than worked around** — closing it
properly means a change to the shared host, which is a coordinator's decision.

### Three of the matrix's four rechecks have no honest application here, and I did not fake them

The matrix says mutating actions recheck **connectivity, permission, authentication and version
state**. Writing a check that cannot fail would be worse than not having one — the brief's own rule.

- **Connectivity.** Every decision in this task writes to this tab's storage or navigates inside this
  application. **None touches the network.** Refusing one for want of a connection would be a false
  statement to a clinician. The one wizard decision that *is* network-bound is `final-activation`,
  which is Task 9's, and `post()` already turns a failed `fetch` into
  `TRANSPORT_REFUSALS.didNotReach` while keeping the draft.
- **Authentication.** `requiresFreshAuthentication` is `true` on exactly **two** rows of the frozen
  table — `withdrawal` and `reassignment` — and both are Task 11b's. Where it is true, `OverlayHost`
  owns the checkpoint and commits only on the second activation.
- **Permission.** `plans/new/page.tsx` asks `canPerformCaringContactAction(actor, "claimPlan", …)`
  **before it renders the wizard at all** and returns `PlanStartStateNotice` instead when the answer
  is no. Inside the component the answer is a constant, and there is no client-observable way for it
  to change while an overlay sits open. A recheck there is a check that cannot fail.

**"Version state" is the one that does apply, and it is what `sign-up-still-here` is.** The version
of the record these decisions write to is the draft itself, and it genuinely changes underneath an
open overlay: `clearPlanDraft()` runs from `discard-changes`, from `change-patient`, from a
successful activation, and from `readPlanDraft` when the stored draft belongs to another referral.

### Why the condition is a comparison and not "a draft exists"

My first version declared `a-draft-exists` and it was **wrong in a way the tests would not have
caught**: on a screen nobody has typed into yet there is **no stored draft at all**, so every
mutating row would have opened `aria-disabled` on a perfectly ordinary first render. The condition
had to be narrower — *it was there when the surface was raised and has since gone* — which is also
the only shape that can catch a confirmation pressed long after opening. I caught this by asking what
`stored` is on the first render, before running anything.

---

## What the preview can and cannot promise — a real gap, reported not filled

`EXACT_PATIENT_VISIBLE_MESSAGE` **carries a name of its own and has no slot for the one the clinician
typed at stage 3**. The brief said the owner has decided it gains a first-name slot and that Task P
is doing that on the trunk. It has not landed on this branch.

So the screen does the only honest thing available to it: it renders the governed wording **exactly
as it arrives** and says, in place, that it is a **specimen** carrying its own example name rather
than this patient's. **Nothing here assembles a greeting, interpolates a name, splits the string, or
writes a word of patient-visible copy.** When the slot lands, this call site will fail to compile
rather than silently keep rendering the old shape — which is the outcome I wanted from it.

**FINDING — the frozen `message-preview` summary promises more than the shared host can carry.**
Its summary reads "The wording is shown exactly as it would arrive, with every detail already filled
in." `OverlayHost` renders each row's frozen `summary` and **takes no children**, so the drawer
itself contains no wording at all — the same limit Task 10 recorded for `delivery-detail`. I put the
wording on the screen beside the trigger (Task 10's precedent: the per-row fact stays on the row) and
made the control's visible words promise only what the drawer holds. But the frozen sentence is still
a claim about a surface that cannot satisfy it, and that is the owner's to resolve: either the host
gains a content slot, or that row's summary changes.

**Second half of the same finding: the specimen cannot be this patient's message even after Task P.**
The wizard is a Client Component; the wording arrives as a **plain string prop the server resolved**,
which is what keeps `message-copy.ts` and its GSM-7 machinery out of this route's client chunk (the
established pattern for `sendingPreferenceOptions` and `fictionalPatientMobileNumbers`). If the slot
arrives as a **function**, the prop's type has to change and the page becomes the place that fills
the name in — which is also where the name would have to be, since a Server Component cannot pass a
function across the boundary. Worth deciding deliberately rather than discovering at merge.

---

## `save-draft` and `discard-changes` — the storage distinction

**`discard-changes` now sits in front of the control that used to discard on one click.** That
control removed a patient's name and mobile number, and everything else typed, with nothing in
between. Its frozen summary — "Only the edits made in this session go" — is the sentence a
coordinator most needs before pressing it.

**Which of the two it discards is said, not left to be inferred.** Beside the control:
_"Discarding removes this sign-up from this computer. It changes no plan and no record: nothing has
been written onto a plan yet, because the plan is created at the last stage."_ That is the true
statement in this wizard specifically — the plan does not exist until stage 4 — so there is no
ambiguity to leave.

**`save-draft` records nothing new, and confirming it does not pretend to.** Every keystroke already
goes through `writePlanDraft`, so writing again on confirm would be a gesture rather than an action —
and a commit whose whole body is a redundant write is the silent no-op in a costume. What the row
actually decides, per its own summary ("The draft is kept as it stands"), is to **leave the screen
with the sign-up still on this computer**. That is the pair `discard-changes` needs: two ways to walk
away from a half-finished sign-up, differing in exactly one thing — whether a patient's details are
left on the machine — and offering only the destructive one is how a coordinator ends up with no exit
that does not throw their work away.

Its second guard is the one that earns it: `draft-survives-leaving-this-screen`. `plan-draft.ts`
falls back to an **in-memory** draft when `sessionStorage` refuses a write, which is what Safari
private browsing does, and that fallback lasts as long as the **page**, not the tab. Leaving then
loses everything, so the decision refuses and says so.

---

## The two confirmations that have nowhere to go, and why they are in the draft

`verify-identity` and `communication-preference` each record a fact the sealed domain has **no field
for**: `createPlanSchema` carries `assurances` (the two stage-1 ticks Task 9b gave a field to) and
nothing else of this kind.

They are held in the draft — this computer, this tab — and the screens that record them **say exactly
that**: _"kept on this computer for this tab, with the rest of this sign-up, and is written onto no
plan — this system has no field for it."_ Name the destination, not the act.

**That is Task 7's precedent applied, not a location invented.** Task 7 found there was no field for
the stage-1 confirmations, reported it rather than inventing one, and the owner later added one. The
draft is the wizard's own state, so holding them there is honest; adding a column to a sealed schema
on a screen's say-so would not be.

**FINDING for the owner:** if either of these should outlive the sign-up, it needs a domain field and
an attestation, exactly as `assurances` got one. Today they die with the tab.

**`communication-preference`'s meaning, stated because it is not obvious.** It records **where the
sending-time choice came from**, which is a different fact from the choice. The frozen summary is
"Record only a preference the patient gave through the staffed programme phone", and the reason that
qualifier is the whole row is that **this workspace receives nothing**: the number is one-way, no one
reads replies, and no screen shows anything a patient said. So a preference the patient asked for
reached this service by the staffed phone or it did not reach it at all — and if it did not, the
choice is the coordinator's on their behalf, which is a legitimate and different thing to record.
The screen says so and assumes neither.

---

## The parser change, and why it is tolerant where its neighbours refuse

`parseDecisions` accepts an **absent** key and reads it as "neither was recorded"; a present key that
is not two booleans refuses the whole draft.

That is the opposite treatment from `parseActivation` and `parsePatientDetail`, and the difference is
stated at the site. Absence there is **ambiguous** — a missing `patientName` could be a clinician who
typed nothing or a draft older than the stage — and guessing silently defaults half a clinician's
answers. Absence here is not ambiguous: neither decision has a default a clinician could have meant,
and the only reading is "these had not been offered when this draft was written". Reading it as
`false` under-claims in the one direction that is safe (it can never say a check happened that did
not), where refusing would throw away the patient's name and mobile number **to remove two
confirmations the clinician was never shown**.

---

## An instruction of yours that would have produced decoration, and what I did instead

You asked for the commit-time recheck to cover connectivity, permission and authentication. On these
seven rows, **all three are constants** for the reasons set out above — none of them can change while
an overlay is open on this screen. Three assertions about them would have been three assertions that
can never go red, and the brief's own rule says to say so and write the thing that can fail instead.
So the guard has exactly two conditions, both of which change under a real sequence a test performs,
and both of which have a red case and a positive control.

**A second instance, smaller.** The obvious test of "the screen renders the sealed wording" is to
assert the rendered text equals `EXACT_PATIENT_VISIBLE_MESSAGE`. With the test supplying that same
constant as the prop, **it compares the prop with itself and cannot fail whatever the screen does**.
It is split into three that can: the wizard renders a **stand-in** the domain does not contain; the
wizard's source does not mention `message-copy` **or** contain the wording; and the **page test**
asserts the page passes the module's own export, which is the assertion a hardcoding page would fail.

---

## Verification

**Every summary line below is pasted. None is reported from an exit code.**

### `npm run test:cc-guards` — the full set on the final tree

<!-- GATE:CC-GUARDS -->

### Per-suite runs during development

Recorded so a per-suite red is never read as a full-set red.

<!-- GATE:PER-SUITE -->

### Typecheck

`npx tsc -p tsconfig.json --noEmit` — no diagnostics emitted, exit 0. Run twice: once before the
tests were written and once on the final tree.

### Lint, uncached

`node_modules/.cache/eslint` removed first, then `npx eslint --format json` over the eight changed
files. The JSON names the files it examined, so this is not an exit code standing in for a run:

```
exit=0
files examined: 8
page.tsx                                        errors 0 warnings 0 []
patient-overview.tsx                            errors 0 warnings 0 []
plan-wizard/overlay-guards.ts                   errors 0 warnings 0 []
plan-wizard/plan-draft.ts                       errors 0 warnings 0 []
plan-wizard/plan-wizard.tsx                     errors 0 warnings 0 []
caring-contacts-new-plan-page.dom.test.tsx      errors 0 warnings 0 []
caring-contacts-patient-overview.dom.test.tsx   errors 0 warnings 0 []
caring-contacts-plan-wizard.dom.test.tsx        errors 0 warnings 0 []
```

### `prettier --check`

<!-- GATE:PRETTIER -->

### Not run, and why

- `npm run test` — the controller's, at merge points. Other worktrees are live and the exclusive
  heavy lease is the resource the standing discipline protects.
- `npm run verify:ui` / `tests/ui-caring-contacts-workspace.spec.ts` — see the section below.
- Anything provider-backed — not approached.

---

## `tests/ui-caring-contacts-workspace.spec.ts` — what I think it needs

**My assessment: it needs one change, and the rest is unreachable. I did not run it.**

That spec's isolated Playwright server **seeds no referrals and no plans** — its own module note says
so. So `/caring-contacts/plans/new` always renders `PlanStartStateNotice`, and every one of the seven
wizard rows is behind a screen no case in that spec can reach. `activation-success` is behind
`EpisodeOverview`, which the zero-plan patient-overview path never reaches either.

**The one thing that is reachable, and is the change I would make.** That spec asserts **single
occupancy of the overlay content node** throughout. Task 10 introduced the workspace's first
production `delivery-detail` trigger on an unreachable branch; this task introduces eight more,
seven of them on an unreachable route. Nothing changes today. But if a referral or a plan is **ever
seeded into that server**, that spec becomes the surface where these rows are finally provable in a
browser — and it is where the two things this branch can only assert in jsdom would become real:

1. **The commit-time refusal in a real browser.** jsdom has no layout and no real history timing; the
   token/history interaction between staging a commit and confirming it is exercised for real only
   there.
2. **320px and forced colors on the new controls.** I assert the classes (`min-h-tap`,
   `forced-colors:`) because jsdom has no layout. A pixel measurement of the stage-3 wording panel
   and the two-control draft-notice row at 320px is browser work, and it is the place a wrapped or
   overflowing control would actually show.

If you want a cheap version now: seeding one accepted referral into that server makes the whole
wizard reachable and would let that spec prove all seven rows against the same frozen table this
branch reads.

---

## Open questions and limits I could not close

1. **`pathway-preview`'s classification** — the top of this report. Yours to confirm.
2. **The host closes unconditionally**, so a commit-time refusal cannot retain the overlay surface.
   Reported above; the fix is a change to `workspace-overlays.tsx` that Tasks 18 and 19 build
   against.
3. **`message-preview`'s frozen summary promises content the host structurally cannot carry.**
   Reported above.
4. **The two wizard-local confirmations die with the tab.** No domain field exists. Reported above.
5. **No sixth hospital-record value was found.** The five the standing discipline names are the only
   ones these screens wanted and did not have. `verify-identity` looked like a sixth — the design
   implies comparing against a source record — but it is the FIRST one (stage 1's identity) wearing a
   different hat, and the screen says plainly that the comparison is one a person makes because this
   system holds no record to compare against.

---

## Mutation ledger

<!-- MUTATIONS -->
