# Ward Flow Phase 3 — whole-branch review

**Reviewer:** independent whole-branch pass at `916816089`, branch `codex/ward-management-design`.
**Scope:** the 47-commit diff `cf751504f..916816089`, the design spec (19 sections), the plan
(12 tasks), the ledger's rulings, and the per-task reports.
**Method:** read the diff and the spec first, then targeted live probes against the running dev
server at `http://localhost:3718` (headless Chromium driving the real app, clicking real controls),
plus `tsx` probes over the real fixture. No file was modified; scratch scripts lived in the
gitignored `artifacts/` and were deleted. `git status --porcelain` clean before and after.

**Counts: 2 Critical, 6 Important, 5 Minor.**

---

## Critical

### C1 — Unit state is live in the reducer, but every capacity figure a decision is made on is read from the frozen fixture

**In this phase's diff.** Root cause specified in `docs/ward-flow-phase-3-workspace/task-8-brief.md:12,66`.

Spec §4 is explicit that this is the single correction that most changes the phase: _"Units are in
the state… a ward could accept a patient, hold a bed and receive them while its free-bed count never
moved… frozen capacity makes the primary screen less true the more it is used."_ Spec §7 repeats it:
_"It reads live state. Every figure moves when another role acts, including bed counts."_

The reducer does hold units in state (`ward-flow-reducer.ts:26,39`) and mutates them correctly.
But three of the surfaces that read unit capacity never touch that state:

- `src/components/ward-management/ward/ward-screen.tsx:71-72` — destructures only
  `{ movements, now, dispatch }` from `useWardFlow()` and then `const unit = unitById(unitId)`,
  i.e. `ward-sites.ts`'s frozen module constant. Every figure on the ward's own screen — the bed
  grid, the "Currently confirmed N at HH:MM" line (`:201`), the initial value of the capacity input
  (`:78`) and `holdBlockedReason`'s `unit.allocatable.value <= 0` check (`:49`) — comes from it.
- `src/components/ward-management/ward-derivations.ts:269` — `eligibleCandidates()` builds its
  candidate list from `allUnits()`, so **every eligibility verdict on the coordinator's shortlist
  and flow diagram is computed against frozen capacity**. `ward-eligibility.ts` reads
  `unit.allocatable.value`, `unit.allocatable.confirmedAt` and `unit.sexMix` — all three are
  reducer-mutated fields.
- `ward-management-network.tsx:225` and `ward-management-modes.tsx:165` — frozen unit detail panels
  (lower consequence: no control attached).

`officer-screen.tsx:56-58` gets this right and its comment names the exact failure mode
("never `unitById` from `ward-sites.ts`, which reads the frozen fixture"). `live-tracker.tsx` and
`CapacityView` also use live units. So the application now holds two different truths about the
same ward at the same instant.

**Proof 1 — the ward's own screen ignores the ward's own action.** On
`/ward-management/ward/bty-adult-secure`, typing `0` into "Confirm allocatable beds" and clicking
"Confirm capacity":

```
--- seed
  beds: Ready 2 | Held 0 | Blocked 1 | Occupied 14 | Potential 1
  Currently confirmed 2 at 10:28.
--- after CONFIRM_CAPACITY = 0
  beds: Ready 2 | Held 0 | Blocked 1 | Occupied 14 | Potential 1
  Currently confirmed 2 at 10:28.
```

The reducer accepted the event (no rejection is filed for a valid unit id and the `ward` role).
Nothing on the screen that raised it moves. Reproduced identically on `fre-adult-open`.

**Proof 2 — a control advertises an action the reducer refuses.** Same session, on
`/ward-management/ward/rph-adult-secure` (fixture `allocatable = 1`), after confirming `0`:

```
hold button ward-hold-WF-003: aria-disabled = null, title = null    <- fully live
card text after clicking Hold: "WF-003 / Accepted, awaiting bed / Hold a bed"   <- nothing happened
```

Then clicking through the rail to the coordinator (no `goto`, provider intact) and opening the
exceptions drawer:

```
Refused actions
HOLD_BED
no allocatable bed remains at RPH Adult Secure (bed_held_for_earlier_referral)
10:42
```

This is the phase's own headline defect recurring in a new disguise: the ward reports nothing while
the reducer has refused. `holdBlockedReason` was written specifically to prevent this
(`ward-screen.tsx:43-45`: _"named so the Hold button can never advertise an action the reducer would
refuse"_) and fails because it reads the wrong `unit`.

**Proof 3 — the coordinator's primary decision surface contradicts the ward.** Same session, after
RPH Adult Secure confirmed `0`, selecting WF-012 on the coordinator queue:

```
RPH Adult Secure / Ready 1 · Held 1 · Blocked 0 · Occupied 18 / Eligible now
  Allocatable bed      Met   1 allocatable
  Capacity freshness   Met   Confirmed 20 min ago
```

The ward said "no beds" seconds earlier. The explainable shortlist — the screen the spec calls
"where the placement decision is actually made" — says one bed is allocatable, that the ward
confirmed it 20 minutes ago, and that the destination is "Eligible now". A coordinator would refer a
patient there. `REFER_TO_UNITS` carries no capacity precondition, so the referral succeeds; the
refusal only surfaces later, at the ward's Hold.

**Fix shape:** thread the provider's `units` into `WardScreen` and give `eligibleCandidates` and
`unitCapacity`'s callers an injected unit list, the same way `queueOrder` / `edPressure` /
`buildActionInbox` already take injected movements (spec §1 names that as the Phase 2 decision that
pays off here). Then extend the single-source guard (see I1) so it cannot regress.

---

### C2 — WF-012 holds a live referral the receiving ward can never see or answer

**Fixture data is pre-existing on `cf751504f`; the harm and the missed invariant are in this diff.**

`src/components/ward-management/ward-movements.ts:347-349`:

```ts
stage: "placement_requested",
referredUnitIds: ["gry-adult-secure"],
```

`RAISE_REFERRAL` is the only reducer branch that produces `placement_requested`, and it writes
`referredUnitIds: []` (`ward-flow-reducer.ts:126-142`). No branch ever returns a movement to that
stage. So this combination is unreachable — and it is unreachable in a way three Phase 3 surfaces
now disagree about:

- Coordinator shortlist for WF-012: **"Parallel referral: Graylands Adult Secure"**
- ED screen `/ward-management/ed/rgh-ed`, WF-012's card: **"Referred to 1 unit"**
- `/ward-management/ward/gry-adult-secure`: no incoming card, and **the string "WF-012" does not
  appear anywhere on the page** — `ward-screen.tsx:104-107` filters `incoming` on
  `stage === "destination_review"`.

Failure scenario: a coordinator sees WF-012 out at Graylands and waits for an answer. Graylands has
no card to accept or decline. Nothing in the system will ever resolve it, and no refusal is recorded
because nobody can raise an event to be refused. Spec §16 names this precisely — _"Four screens
describing one patient… every defect this project has found is a surface stating something the data
does not support."_

**Why the R63 invariant did not catch it.** The R63/R64 table in
`tests/ward-flow-contracts.test.ts:196-200` is genuinely exhaustive — its `RAISE_REFERRAL` row
records the write as `referredUnitIds: []`, `declines: []`, `withdrawnReferrals: []`. But no test
asserts any of those three implications. The invariant block asserts `handover_ready ⇒ transport`,
`{post-acceptance stages} ⇒ acceptedUnitId`, `bed_held ⇒ bedHeldUntil`, `moving ⇒ collectedAt`,
`arrived + transport ⇒ arrivedAt`, stamp ordering, and `pre-acceptance ⇒ no acceptedUnitId`. The
table was derived correctly and then only partly discharged. This is the third instance of the class
and the brief predicted it.

I enumerated the reducer's eight stage-producing branches independently and measured the fixture
against every implication. Two violations exist, both from the un-asserted `RAISE_REFERRAL` row:
WF-012 here, and WF-018 (see I6). Everything else — transport before handover, `bedHeldUntil` before
`bed_held`, `arrived` without `closure`, cap overruns, declined-unit-still-referred, accepted-unit-
also-declined, 1A-with-examination, 3B-without, 1A-without-`dueAt`, 3B-with-`dueAt`, non-voluntary
without a form — measured clean.

---

## Important

### I1 — The "one source of truth" guard covers only half the frozen fixture

**In this phase's diff.** `tests/ward-flow-single-source.test.ts:349-356`.

The test is named `has no component reading the frozen fixture directly` inside a describe block
named `one source of truth`, and its `ALLOWED` comment says _"Everything else must read the
provider, or two surfaces will disagree."_ Its actual predicate is:

```ts
.filter(({ source }) => /from "[^"]*ward-movements"/.test(source))
```

It matches one module. `ward-sites.ts` — which exports `allUnits()`, `unitById()` and the entire
frozen unit fixture, i.e. the half of the state that spec §4 calls "the correction that most changes
the phase" — is not covered, is not in `ALLOWED`, and is imported freely by eight ward-management
components. This is the guard that would have caught C1, under a name that says it did.

What one change to the product would make it fail? Only re-adding a `ward-movements` import. A
component switching from live `units` back to `allUnits()` — the exact regression it exists to
prevent — passes silently. Widening the pattern to `ward-(movements|sites)` with an explicit
allow-list for identity-only lookups (`edById`, `siteByCode`, `NOW_ANCHOR`) makes the name true.

### I2 — Spec §11 escalation was never wired to a control, and the plan records it as delivered

**In this phase's diff.**

`RECORD_ESCALATION` exists in the events union, the `EVENT_ROLE` table and the reducer, and is
covered by a unit test. `grep -rn "RECORD_ESCALATION" src/` returns **only** `ward-flow-events.ts`
and `ward-flow-reducer.ts`. No surface anywhere dispatches it.

Spec §11 is not an optional flourish: it was _moved into Phase 3 from Phase 4_ and given its own
section, on the reasoning that _"a phase that only proves the loop which succeeds has not proved the
loop."_ The plan's own spec-coverage line
(`docs/superpowers/plans/2026-08-19-ward-flow-phase-3-role-screens.md:1544`) states: _"§11 escalation
→ Task 5's `RECORD_ESCALATION` dispatch and the shortlist's existing no-eligible-destination
state."_ That dispatch does not exist. A reader auditing spec coverage from the plan would conclude
§11 shipped.

### I3 — The jump-forward clock control and scenario reset were never built

**In this phase's diff.**

Spec §2 decision 5 ("Does the clock move? **Yes**, with a jump-forward control") and §5 ("+15 min,
+1 hour… so a held bed can be watched expiring in seconds rather than in an hour") are settled
product decisions. `ADVANCE_CLOCK` and `RESET_SCENARIO` are implemented and tested in the reducer,
and dispatched **only from test harness buttons**. Several comments refer to "Task 12's demo
controls" (`ward-flow-clock-consistency.dom.test.tsx:21,38`, and the ledger's F10 ruling) as though
they exist.

Consequence for the person this is being handed to: `bedHeldUntil` is `now + 60`, so a bed hold
cannot be watched expiring at all, and the one thing spec §5 says the control is for cannot be
demonstrated.

### I4 — A refusal changes nothing visible on any screen by default

**In this phase's diff.** `coordinator-screen.tsx:65`, `exception-drawer.tsx:47-51`.

Spec §7.4: _"It owns the refusals surface. Every transition the reducer refuses appears here, in the
exceptions drawer, **persistently** — not in a toast that vanishes."_

The drawer is `useState(false)` — closed on load — and its collapsed trigger renders
`{items.length}`, the action-inbox count only. Refusals are not counted there and appear nowhere
else. In Proof 2 above, the `HOLD_BED` refusal was invisible until I explicitly clicked "Exceptions"
open; the badge did not move. A closed drawer whose badge excludes refusals is functionally the
toast the spec forbids: the record persists, but nothing ever tells anyone to look for it.

Smallest honest fix: include `rejections.length` in the collapsed badge (or add a second badge), so
the count moves the moment something is refused.

### I5 — Every referral the ED raises is born unable to have its examination recorded

**In this phase's diff.** `ward-flow-reducer.ts:126-142` vs `:145-152`.

`RAISE_REFERRAL` creates the movement with no `legalForm`, whatever `legalStatus` the draft carries.
`RECORD_EXAMINATION` refuses unless `legalForm?.code === "1A"`. The ED's two spec-§6 actions
therefore cannot be used in sequence on a patient that ED raised itself.

Measured live on `/ward-management/ed/peel-ed`, raising a referral with legal status "Referred for
psychiatric examination":

```
WF-901 · Adult · Open · Female · Referred for psychiatric examination
… Placement requested
Form — No legal form recorded for this movement.
[Record examination]  aria-disabled=true
  title: "WF-901 cannot have an examination recorded while its form is none, not 1A."
```

One card asserts the patient _has been referred for psychiatric examination_ and, three lines later,
that no legal form is recorded and the examination can never be recorded. Spec §3 defines Form 1A as
exactly "the person has been referred and not yet examined" — the status and the missing form are
the same fact, disagreeing. All 48 fixture movements honour "non-voluntary ⇒ carries a `legalForm`"
(measured); the only runtime creator of movements breaks it.

This also undercuts ruling R67 ("a patient is reviewed before a bed is sought"), which the
end-to-end journey makes its first step: a freshly raised patient can never be reviewed.

The control is correctly disabled with a stated reason, which is why this is Important and not
Critical. The fix is small: derive the 1A in `RAISE_REFERRAL` from a non-voluntary `legalStatus`, or
drop the detained statuses from the draft form.

### I6 — WF-018 tells a ward its referral was withdrawn, for a referral that never existed

**In this phase's diff** (the `withdrawnReferrals` entry was added by the Task 1 fixture commit).

`ward-movements.ts:492-503` — WF-018 is at `placement_requested`, `referredUnitIds: []`,
`declines: []`, no `acceptedUnitId`, and carries:

```ts
withdrawnReferrals: [
  {
    unitId: "scgh-older-adult",
    at: NOW_ANCHOR - 10,
    reason: "Referral withdrawn — the unit filled the bed from an earlier request",
  },
];
```

`ACCEPT_IN_PRINCIPLE` is the only branch that writes `withdrawnReferrals`, and it does so while
moving the movement to `accepted_awaiting_bed`. So this state is unreachable, and the field is being
used for something it is not: `ward-model.ts` defines it as _"Referrals ended because another unit
accepted"_, while this entry describes a unit-side refusal — which is what `declines` and the
`bed_held_for_earlier_referral` reason exist for.

Rendered live on `/ward-management/ward/scgh-older-adult`:

```
Withdrawn from SCGH Older Adult
WF-018 — Referral withdrawn — the unit filled the bed from an earlier request — 10:32
```

The ward is told a referral it never received has been withdrawn. Same missed invariant as C2.

---

## Minor

### M1 — No dark, forced-colours or print coverage for any of the four new screens

Spec §14 requires _"One browser journey per role screen, plus phone, dark, forced-colours and
print."_ `tests/ui-ward-roles.spec.ts` is the only spec touching `/ward-management/ward/*`,
`/ward-management/ed/*` and `/transport/officer`. It sets a 390×844 viewport for the officer and
tracker only; the ward and ED screens are exercised at 1440 only, and no test in the repo calls
`emulateMedia` or a dark / forced-colors variant for any of them.

### M2 — The "Bed need confirmed" gap is documented where no user reads it

The factor itself is correct against the constraint: `ward-priority.ts:80-84` labels it
"Bed need confirmed" with an operational detail, never severity / acuity / risk, and `queueOrder`
still sorts urgency-first so it only reorders within a tier. But the KNOWN GAP — 21 of 41 open
movements are voluntary, never receive a Mental Health Act examination, and can therefore never earn
the factor — lives only in a source comment, while the factor is rendered to the coordinator
(`shortlist-panel.tsx:528-529`: `**Bed need confirmed** +25 — Examination outcome: inpatient
order`). The visible effect is that detained patients systematically outrank voluntary ones inside a
tier for a reason that is an artefact of what the model can record. One sentence in the score's
expandable panel would close it. I accept R66's weight; this is disclosure, not arithmetic.

### M3 — The journey's three-referral assertion passes on one referral

`tests/ui-ward-roles.spec.ts:390` —
`await expect(shortlist).toContainText(/Parallel referral|referred to 3/i)` under a comment reading
"Three live referrals". One badge satisfies it. `toHaveCount(3)` on the badge locator would make the
assertion match its stated claim.

### M4 — `CONFIRM_CAPACITY` is role-gated but not unit-gated

Spec §6 says the ward "Writes to its own unit only." The reducer checks only `role === "ward"` and
then writes whatever `unitId` the event carries (`ward-flow-reducer.ts:361-369`); only the UI
constrains it. Spec §6 also says the role column must be _"enforced by the reducer, not merely
documented"_. The event carries no ward identity, so this cannot be enforced today — worth recording
as a known simplification under §12 rather than left implicit.

### M5 — Comment attributes the referral-clearing to the wrong reducer branch

`ward-role-switcher.tsx:73-75` says "REFER_TO_UNITS's own reducer case empties `referredUnitIds` the
moment one unit accepts". `ACCEPT_IN_PRINCIPLE` does that. The code is right; the comment would
mislead the next reader of exactly the branch that matters.

---

## Things I looked for specifically and did not find

Stated so the absence is evidence rather than silence.

- **The access-target quarantine (brief item 1) is clean, checked by reading, not by trusting the
  guards.** `ED_ACCESS_TARGET_MINUTES` is referenced in exactly two source files. In `ed-screen.tsx`
  it reaches only `accessTargetLine(minutesInDepartment: number)` (`:149-155`) and one `data-state`
  comparison (`:414`). `accessTargetLine` takes a plain number, constructs no object, and its output
  is `"<d> over|under the 24h 00m departmental access target"` — no "due", "deadline", "breach",
  "overdue" or "legal". I traced every indirection R28 warned the guards cannot see: no intermediate
  local, no aliased import, no spread onto a `LegalForm`, no cross-file helper, no post-construction
  mutation. The only `LegalForm` producers anywhere are `ward-movements.ts` and the reducer's
  `RECORD_EXAMINATION`, neither of which references the constant. **R28's judgement was right and
  its residual risk did not materialise.**
- **`LegalForm.dueAt` absence (brief item 2).** All 25 `dueAt` sites in `src/` handle `undefined`
  explicitly; there is no `??` fallback and no non-null assertion on it anywhere. Both rendering
  surfaces state the absence in words: `"… · no statutory deadline"`
  (`ward-management-console.tsx:52-54`) and `"… — no statutory deadline; <elapsed> in the emergency
department"` (`shortlist-panel.tsx:78-80`). `operationalScore`, `buildActionInbox`, `edPressure`
  and `priority-queue` all gate on `!== undefined` before any arithmetic. Fixture measured: 0 × 1A
  without `dueAt`, 0 × 3B with one.
- **`ward-eligibility.ts` (brief item 4).**
  `git diff cf751504f..916816089 -- src/components/ward-management/ward-eligibility.ts` is empty. No
  gate's pass/fail semantics changed anywhere in the diff. The two restriction warnings are a
  separate pure function in `ward-derivations.ts` and touch no gate.
- **The end-to-end journey navigates by clicking (brief item 5).** `tests/ui-ward-roles.spec.ts:367`
  is the only `page.goto` in the journey — the initial ED load the spec permits. All ten subsequent
  hops go through `switchTo()`, which clicks a real `<Link>` in the role switcher, and each name is
  proved to resolve to exactly one menu item before it is clicked. I independently confirmed the
  provider genuinely survives a rail/switcher click: in Proof 2, a `CONFIRM_CAPACITY` and a refused
  `HOLD_BED` raised on the ward screen were both still present in the coordinator's exceptions
  drawer after clicking through.
- **Controls versus reducer preconditions (brief item 3), for everything except the ward's Hold.**
  `examinationBlockedReason` / `handoverBlockedReason` (ED), the officer's four `*BlockedReason`
  helpers, `referralAnswerBlocked` (ward), and `canRefer` / `overrideSucceeded` (coordinator) each
  mirror their reducer branch clause-for-clause, in the same order, and the override path proves
  success by re-reading `movement.referredUnitIds` rather than a local flag. The officer's
  `arrivedBlockedReason` deliberately resolves its unit from the **live** `units` array. The single
  exception is `holdBlockedReason`, which is C1.
- **Tests that cannot fail.** I checked every test file added or changed in the diff for the house
  defect. `ward-flow-contracts.test.ts` counts matches rather than iterations in all six fixture
  invariants and asserts the true count (including the two honest `toBe(0)` cases R59 ruled on —
  both would still go red on a real violation). `ward-flow-single-source.test.ts` carries three
  separate non-empty-scan guards and a positive-control test proving `constructsLegalForm` fires on
  a known-real construction. The two jsdom suites both mutate state after mount and assert the _old_
  value is gone as well as the new one present. `tracker-derivations.test.ts` constructs its own
  jobs rather than relying on fixture coverage. `ward-priority.test.ts`'s new cases each name a
  falsifiable difference. I found no assertion in this diff that no product change could break —
  I1 is a guard narrower than its name, not one that cannot fail.
- **Patient-identifying data.** No name, DOB, MRN, address or diagnosis in any rendered string; the
  privacy invariant now accumulates and counts the strings it inspects before checking them.

---

## Spec-compliance verdict by section

| §                           | Verdict                        | Basis                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **3 — Model changes**       | **PASS**                       | All six `Movement` fields present and typed as specified; `DECLINE_REASONS` has seven entries with `out_of_catchment` offered in the ward's decline form; the two restriction warnings are a pure function with distinct levels and distinct prominence, rendered on the shortlist, the diagram and the ward screen; `ward-eligibility.ts` untouched; the 1A/3B invariant is pinned in both directions and measured clean. Fixture requirements met: 3 movements with `formedAt` before `openedAt`, 1 police arrival (WF-009), 3 examined.                                                                                                                                                                                                                                                                                                                                      |
| **6 — The events**          | **PASS as a reducer contract** | All fifteen events exist with the specified effects; `EVENT_ROLE` is checked before the payload is inspected at all; withdrawal is automatic and recorded with a reason, not implied by a shrinking list; the hold sets `now + 60` and never auto-releases. Two caveats that do not overturn the verdict: `CONFIRM_CAPACITY` is not unit-gated (M4), and three of the fifteen have no caller in the product (I2, I3) — the reducer conforms, the surfaces do not.                                                                                                                                                                                                                                                                                                                                                                                                               |
| **7 — The screens**         | **FAIL**                       | The four screens exist with the right shapes, scoping and empty states, and the access target is worded exactly as required. But §7's first numbered promise for the coordinator — _"Every figure moves when another role acts, including bed counts"_ — is not met (C1): the shortlist's capacity line, all eight gate rows and the ward's own bed grid are frozen. §7's ward paragraph — _"Confirm what beds are genuinely allocatable"_ — has a control that dispatches and a screen that never responds. §7.4's persistent refusals surface is closed by default with a badge that excludes refusals (I4).                                                                                                                                                                                                                                                                  |
| **9 — Role switching**      | **PASS**                       | Identity is in the URL; the switcher offers all four roles; ward and ED are inferred from the shared `focusMovementId`, read from live `movements`; the plural case offers every candidate rather than picking one (R52 honoured); the coordinator's placelessness is rendered as a fact ("Statewide — no ward or department") rather than invented; unavailable entries use `aria-disabled` + `title` + `sr-only` + an inert handler, per the repo's wiring convention. Every destination is a real `<Link>`.                                                                                                                                                                                                                                                                                                                                                                  |
| **10 — Failure behaviour**  | **PARTIAL**                    | The reducer refuses rather than absorbing, and every named case is implemented and tested: already-placed acceptance names the withdrawal, two-patients-one-bed refuses with `bed_held_for_earlier_referral`, wrong role refuses before the payload is read, out-of-order stages refuse. Conservative display holds throughout (unresolved ids are named, never substituted; absent `dueAt` is stated, never defaulted; `transportLeg` returns `undefined` rather than collapsing absence into a leg). It fails on the second half of the sentence — _"every refusal is recorded in `rejections` **and rendered on the coordinator screen**"_ — because the rendering is behind a closed drawer whose count ignores them (I4), and because C1 manufactures refusals no user can connect to the action that caused them.                                                         |
| **14 — How it gets proved** | **PARTIAL**                    | Reducer coverage is genuinely exhaustive and mutation-proved. The contract tests cover the cap, the declined-unit exclusion, ownerlessness, the recorded withdrawal, the form/examination agreement and privacy. Three shortfalls: _"beds always account for, before and after every event"_ is asserted for one unit across one ten-event walk, not as an invariant over every state (and the earlier `unitCapacity`-based version was already found to survive corruption); the per-role browser journeys exist and the end-to-end journey correctly navigates by clicking, but **dark, forced-colours and print are absent for all four new screens** (M1); and the fixture-coherence invariants were derived from a correct exhaustive table that was then only partly asserted, leaving C2 and I6 live. Time is injected everywhere except the live provider, as required. |

---

## Were any of the controller's rulings wrong?

**No ruling I would call wrong. One was correct but not carried through, and one brief-level
decision — never recorded as a ruling — is the root of C1.**

- **R63 (derive the fixture invariant from the reducer's complete set of stage-producing
  transitions) was the right call and the method was right.** The table it produced
  (`ward-flow-contracts.test.ts:196-200`) is, as far as I can verify by re-deriving it
  independently, genuinely exhaustive over the reducer's eight stage-assigning branches. It was then
  **incompletely discharged**: the `RAISE_REFERRAL` row records three writes (`referredUnitIds: []`,
  `declines: []`, `withdrawnReferrals: []`) and none of the three became an assertion. Both
  remaining fixture violations in the whole model — WF-012 (C2) and WF-018 (I6) — sit in exactly
  that un-asserted row. The ledger's own diagnosis of the R58 failure ("the instance was fixed and
  the class was left alone") applies one level up: this time the class was correctly identified and
  then not fully written down.
- **The Task 8 brief's instruction to resolve the ward's unit with `unitById(unitId)`**
  (`task-8-brief.md:12,66`) is, in my view, the wrong call, and it is the root of C1. It was written
  into the brief rather than introduced by the implementer, and it sends the one screen whose stated
  purpose is confirming allocatable beds to the frozen fixture that spec §4 exists to replace.
  Task 9 got the same decision right one task later and its code comment names the exact hazard,
  which suggests an oversight rather than a considered trade-off — but it was never surfaced as a
  ruling, so nothing weighed it.
- **R28 (narrow the access-target guard's claim; move real enforcement to Task 11's brief and
  review) I would affirm.** I checked the constant by reading every indirection R28 said the guards
  cannot see, and the quarantine holds. The named risk did not materialise, and the guards' names
  now match their reach.
- **R59 (keep the two `toBe(0)` assertions, name them honestly, do not manufacture a red) I would
  affirm.** Both remain falsifiable; asserting the real count is the honest instrument.
- **R66 (accept the 25-point weight without re-litigating it) I would affirm.** The weight is
  defensible, the wording is operational, and the score still orders only within an urgency tier. My
  only residual concern is disclosure, not arithmetic (M2).
- **R55, R62, R32, R35** — recorded, scoped and deferred correctly; nothing to add.

---

## Verification actually performed by me

Read: the full diff, the spec (all 19 sections), the plan's coverage table, the ledger's rulings
R24–R67, and the Task 8/9/10/11/12 briefs and reports for the surfaces in question.

Ran (all read-only, all against the already-running dev server or the fixture):

- Six headless-Chromium probes driving real controls: ward capacity confirmation on two units; the
  Hold-bed advertise-then-refuse sequence with a click-through to the coordinator's exceptions
  drawer; the coordinator shortlist after a ward drops capacity to zero; WF-012 across three
  screens; WF-018's withdrawn card; and an ED-raised referral through to its blocked examination.
- Three `tsx` probes measuring the real fixture against every implication I derived independently
  from the reducer's eight stage-producing branches (about twenty properties).
- Static reads: every `dueAt` site, every `ED_ACCESS_TARGET_MINUTES` site, every `allUnits()` /
  `unitById()` site, every `useWardFlow()` consumer, and every dispatcher of each of the fifteen
  events.

Not run, and why: `npx tsc --noEmit`, the node-env ward suites, the jsdom files and the ward
Chromium gate were all run by the controller at this exact HEAD, and I made no change that could
move them. `npm run verify:ui`, `verify:release`, the guard-push suite and anything provider-backed
were prohibited. No file was modified; `git status --porcelain` is empty.
