# Plan — rebuilding the seven-step track on the movement workspace

**Ward Builder Three, 2026-09-04.** Planning only; no repository edits, no branch. Read from
`codex/task-ward-flow-live-state-20260831` with `git show`. I did not enter
`D:/Worktrees/Database/ward-lead`.

**Updated after Ward Lead's rulings at `81a2acaaa` and the supersede of ruling 2. Task 4 (`stageChanges`) and Task 6 (the R64 sweep) are new; the step-back is now Task 5.**

---

## 🔴 Read this before sweeping: the sweep as ruled would delete the most important record on the board

**Ruling: _"`destination_review` and `pulled` get the same remap `handover_ready` got."_ I checked the
records before recommending a change to them, and the criterion in my own earlier report was wrong.**

**`WF-009` is `destination_review` with `referredUnitIds: []` — and it is exactly what the reducer
produces.** It carries **two declines**:

```
declines: [ { rph-adult-secure, no_bed }, { gry-adult-secure, acuity_mix } ]
stage: "destination_review"   referredUnitIds: []   legalStatus: "Involuntary inpatient"
```

`DECLINE_REFERRAL` (reducer 1395) removes the declining unit from `referredUnitIds` and sets
`stage: "destination_review"`. **A movement with an empty list and a non-empty `declines` is the
normal end state of every ward saying no** — and `WF-009` is a detained, secure, specialled patient
whom two wards have refused. **That is the "nobody now looking" case: the single most clinically
important row in the fixture.**

⚠️ **A sweep keyed on "empty `referredUnitIds`" would have remapped it to "Placement requested" and
erased the fact that anybody was ever asked.** The correct criterion is **empty `referredUnitIds`
AND empty `declines`**.

**Measured with that criterion:**

| Class                                                    | Generated | Hand-authored                                                            |
| -------------------------------------------------------- | --------- | ------------------------------------------------------------------------ |
| `destination_review`, nothing asked and nothing declined | **4**     | **0** — `WF-002/010/013/017` hold real unit ids; `WF-009` holds declines |
| `pulled` with no `admissionId`                           | **4**     | **3** — `WF-004`, `WF-011`, `WF-016`                                     |

---

## Decision 1 — "when and who": WHO is not sourceable; WHEN is sourceable for five of seven

⚠️ **Ruling 1: "who" means WHICH ROLE. Confirmed.** Write "Flow coordinator", never a name, and
**never a placeholder where a role is unknown**. The model's `by` fields carry their own comment —
_"A ROLE, never a person"_ — and no stage assignment in the reducer writes an actor at all.

**WHEN**, measured over all 50 movements (20 hand-authored + `routineMovements(30, 300)`):

| #   | Step                   | Time field                                         | Exists | Populated                 |
| --- | ---------------------- | -------------------------------------------------- | ------ | ------------------------- |
| 1   | Placement requested    | `openedAt`                                         | ✓      | all 50                    |
| 2   | Destination review     | `referredAt` (reducer 1017)                        | ✓      | **0 of 50**               |
| 3   | Accepted, awaiting bed | `acceptedAt` (reducer 1103)                        | ✓      | **0 of 10 at or past it** |
| 4   | Bed pulled             | 🔴 none — only `pullExpiresAt`                     | ✗      | —                         |
| 5   | Handover ready         | 🔴 none; the handler writes `{...movement, stage}` | ✗      | —                         |
| 6   | Moving                 | `transport.collectedAt`                            | ✓      | yes                       |
| 7   | Arrived                | `closure.at`, `transport.arrivedAt`                | ✓      | yes                       |

⚠️ **THE TRAP, NAMED SO IT IS REFUSED RATHER THAN DISCOVERED: `pullExpiresAt − 60`.**
`PULL_PATIENT` writes `pullExpiresAt: event.now + 60`, so the subtraction is exact **today**, renders
perfectly, reviews perfectly, and breaks silently the day the reservation window changes — with no
test able to notice, because the arithmetic is right now. It is the substitution
`Movement.referredAt`'s own comment already forbids: _"answers a different question while reading as
plausible."_ **Task 3's mutation IS this substitution**, which is what turns _should not_ into
_cannot_.

🔴 **Ruling 2 SUPERSEDED. `pulledAt` and `handoverReadyAt` are NOT to be added. Build
`stageChanges` instead — Task 4.** Two more scattered fields _plus_ an array would be two places
recording when a step happened, free to disagree; and two fields still leave "who" unsatisfiable and
carry no `from`/`to`, so a step-back could not be represented at all.

**Existing records keep no value; do not backfill.** "Time not recorded" is the honest stopgap, not
the destination.

---

## Decision 2 — the transition map is DECLARED, because the graph is already not a line

A map derived from `MOVEMENT_STAGES` array order would call three shipped transitions "reversals":

| Transition                                          | Reducer                  | Recorded as                      |
| --------------------------------------------------- | ------------------------ | -------------------------------- |
| any → `destination_review` when a ward **declines** | `DECLINE_REFERRAL`, 1395 | a `Decline`                      |
| `pulled` → `accepted_awaiting_bed`                  | `RELEASE_PULL`, 2905     | `unwinds` — `at`, `by`, `reason` |
| `moving` → `handover_ready`                         | `CANCEL_TRANSPORT`, 3038 | `unwinds` — `at`, `by`, `reason` |

**Ruling 4: a ward's decline appears on the tracker labelled as a DECLINE, not as a step-back.** Two
labels, one track — a patient who went backwards because a ward said no is what a coordinator needs
to see, and it is a different act from a coordinator correcting a record.

### Ruling F was already implemented, twice, and Ruling 3 confirms the plan follows it

`RELEASE_PULL` and `CANCEL_TRANSPORT` are role-gated, reason-required and audited —
`CANCEL_TRANSPORT` enforces its reason **at runtime, not by type**, with its own comment recording
why: _"a type-only guarantee passes `vitest run` with no `tsc` involved."_ And `RELEASE_PULL` states
F3's principle in its own words: _"Never closes the movement, never clears `legalForm`, never touches
`referredUnitIds` — the patient survives and keeps their acceptance; only the pull itself unwinds."_

⚠️ **Ruling 3: the coordinator step-back is a THIRD `UnwindRecord` kind, and "withdraw the
acceptance" a fourth. DO NOT build a parallel step-back store** — a second audit trail for the same
class of act is precisely how two screens come to give two honest answers, which is what F3 exists
to prevent.

---

## Decision 3 — the track never paints a step completed from array position

For a reducer-impossible record the earlier steps were never taken. **The track shows the current
step, marks earlier ones "No record of this step", and greys the rest** — the same conservative shape
as "No referral recorded".

⚠️ **`handover_ready` with no transport is already CLOSED and I nearly reported it as live.**
`stageFields` has no case for it, which reads as the defect — but three lines above the switch,
ruling R64 remaps that index to `placement_requested` and names the records it fixed. **I read the
switch before the caller.**

⚠️ **And R64's fix did not sweep**: it closed one case with a long comment naming exactly this
property while two siblings sat in the same switch untouched. That is Task 6.

---

## Global Constraints

Everything in `2026-09-04-ward-flow-design-foundation.md` applies unchanged. The ones that bite:

- ⚠️ **`stageSummaries` STAYS. Two callers are correct** — `ward-management-network.tsx` and
  `ward-management-modes.tsx` are all-patient views. **Only the console's per-patient call at line
  285 is wrong. Fixing one caller by deleting the function would break two right ones**, and
  deleting it is the obvious move.
- ⚠️ **Ruling 5: `MovementClosure.reason` stays free text and the tracker renders it as recorded
  text — never as a category.** No chip, no grouping, no counting. **Do not let a display make it
  look categorised; that is how a free-text field acquires a false taxonomy.**
- ⚠️ **`--ward-space-N` is N PIXELS.** Surfaces: `--ward-ground`, `--ward-canvas`, `--ward-chrome`,
  `--ward-subtle`. **`--ward-border-subtle` does not exist** and renders at full text contrast.
- ⚠️ **DOM tests are `*.dom.test.tsx`** — a `*.test.tsx` matches no vitest glob and silently never
  runs. **Never `toHaveClass(styles.x)`.**
- **State is worded as well as coloured.** A greyed future step also says it is not yet reached.
- **Every guard ships with a mutation naming its expected message.**
- **Never `git add -A`; never `git stash`.** **No invented figures.**

---

## Task 1: The track becomes per-patient, and the count leaves the page

**Files** — Modify: `ward-management-console.tsx` (`MovementPipeline` ~94–130; call site 285),
`ward-management.module.css`. Test: `tests/ward-movement-step-track.dom.test.tsx`.

**Interfaces** — props become `{ movement }`; `activeStage`/`onStageChange` deleted. **Consumes
`stageSummaries` not at all.**

- [ ] **Step 1 — the failing tests**
  - `no number describing other patients appears anywhere on the track` — assert against **rendered
    text**, not the absence of an import.
  - `the current step is the movement's own stage` — a movement at step 2 marks step 2. Today
    `activeStage` is state seeded from `patient?.stage` and any click desynchronises it.
  - `steps after the current one are inert` — not clickable **and** worded as not reached.
- [ ] **Step 2 — implement.**
- [ ] **Step 3 — MUTATION**
  - Restore `stageSummaries(movements)` → the no-other-patients test fails **by name**; report the
    rendered number it found.
  - Make a future step clickable → the inert test fails, and **the wording assertion fails
    separately**. ⚠️ If both fail together they are one assertion wearing two names.

## Task 2: The declared transition map

**Files** — Create: `src/components/ward-management/movement-stage-transitions.ts`. Test:
`tests/ward-movement-stage-transitions.test.ts` (pure).

**Interfaces** — `STAGE_TRANSITIONS` (explicit edges, each naming its event) and
`stageTransitionKind(from, to)` → `"forward" | "backward" | "declined" | "skip" | "unknown"`.
**Exhaustive `switch`, no `default`** — the discipline `referralDestinationDirection` already uses.

- [ ] **Step 1 — the failing tests**
  - `every edge names an event that exists in the reducer`.
  - `the three shipped back edges are permitted, not violations`. 🔴 The test that makes the map
    declared rather than derived.
  - `a ward decline is labelled a decline, not a step-back` — ruling 4.
  - `a skipped step is distinguishable from a reversed one`.
- [ ] **Step 2 — implement.**
- [ ] **Step 3 — MUTATION**
  - Replace the declared map with one derived from `MOVEMENT_STAGES` order → **the back-edge test
    goes red naming all three.** Naming fewer than three means the map is partly derived.
  - Add a stage to `MOVEMENT_STAGES` → the switch fails to **compile**. Report the `tsc` message;
    ⚠️ `vitest` runs no `tsc`, so a green suite proves nothing here.

## Task 3: The stopped patient, and the unrecorded step

**Files** — Modify: `ward-management-console.tsx`, `ward-management.module.css`. Test:
`tests/ward-movement-step-track-stopped.dom.test.tsx`.

**Interfaces** — `movement.closure` and `movement.stage`, which **survives closure** (`isOpen` is
`!closure && stage !== "arrived"`). **`WF-008` is the seeded example**, closed at
`accepted_awaiting_bed`.

- [ ] **Step 1 — the failing tests**
  - `a movement closed as did_not_proceed says where it stopped and when` — _"did not proceed at Bed
    pulled, 14:20"_.
  - `a stopped movement and a stalled movement do not render alike` — 🔴 assert the two **against
    each other**, not each against a string.
  - `the closure reason renders as recorded text, not as a category` — ruling 5. Assert no chip
    element and no grouping.
  - `a step with no recorded time says so and shows no time`.
  - `earlier steps of a reducer-impossible movement are not painted as completed` — use `WF-004`.
- [ ] **Step 2 — implement.**
- [ ] **Step 3 — MUTATION**
  - Render the stopped movement through the stalled path → the do-not-render-alike test fails.
  - **Fill an unrecorded step's time from `pullExpiresAt − 60`** → the no-time test fails **by
    name**. ⚠️ **This mutation is the point of the task**: it is the plausible-looking fix somebody
    will otherwise ship, and it must be impossible rather than discouraged.
  - Render `closure.reason` inside a chip → the not-a-category test fails.

## Task 4: `stageChanges` — the single record of how a patient moved

🔴 **Prerequisite for Task 5. Build this first**: a step-back cannot be represented without
`from`/`to`.

**Files** — Modify: `ward-model.ts` (`StageChange`, `Movement.stageChanges`),
`ward-flow-reducer.ts` (**every** case that assigns a stage — 10 assignments at lines 842, 1037,
1103, 1364, 1395, 1431, 1494, 1532, 2905, 3038). Test:
`tests/ward-movement-stage-changes.test.ts` (pure).

**Interfaces** — `StageChange = { at: Instant; from?: MovementStage; to: MovementStage; by: string;
reason?: string }`. **`by` is a ROLE.** ⚠️ **`from` is optional and absent exactly once — on
creation**, where there is no previous stage; an entry is still written, so step 1 is inside the
array rather than reachable only through `openedAt`.

⚠️ **Do NOT remove `openedAt`, `referredAt`, `acceptedAt`, `transport.collectedAt` or `closure.at`.**
Each has other consumers. Two sources that must agree **with a guard that fires when they do not** is
honest; two sources with nobody checking is how this project got here.

- [ ] **Step 1 — the failing tests**
  - `every reducer case that assigns a stage appends exactly one entry` — 🔴 **derive the case list
    from the reducer source, do not hand-list it.** A hand-listed set of ten silently misses the
    eleventh somebody adds.
  - **The agreement test, per field, because the rules differ and one generic loop is wrong for half
    of them:**

    | Existing field                  | Agrees with                                                                                                                     |
    | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
    | `openedAt`                      | the creation entry (`from` absent)                                                                                              |
    | `referredAt`                    | ⚠️ the **LAST** entry with `to: destination_review` — `REFER` rewrites it on every re-referral                                  |
    | `acceptedAt`                    | ⚠️ the **FIRST** entry with `to: accepted_awaiting_bed` — `RELEASE_PULL` adds a later one and **does not** rewrite `acceptedAt` |
    | `transport.collectedAt`         | the entry with `to: moving`                                                                                                     |
    | `closure.at`, outcome `arrived` | the entry with `to: arrived`                                                                                                    |

  - `a movement past step 1 with an empty stageChanges is identified as predating the array` —
    ⚠️ **the absence has two causes and they are separable**: a movement AT `placement_requested`
    with no entries is normal; one at any later stage with no entries predates the field. **The
    tracker must say which**, not render both as "no record".
- [ ] **Step 2 — implement.**
- [ ] **Step 3 — MUTATION**
  - 🔴 **Run the agreement test against the 50 seeded movements ALONE first. It must be reported as
    VACUOUS** — every seeded `stageChanges` is empty, so the test cannot fail and proves nothing.
    **The fixture for this test must be built by driving the reducer**, not hand-authored. State the
    assertion count from both runs; if they are equal, the reducer fixture is not reaching it.
  - Make `RELEASE_PULL` rewrite `acceptedAt` → the `acceptedAt` row fails **by name**. This is the
    pair a single generic loop gets wrong.
  - Drop the entry from one stage assignment → the derived-case-list test names that case.

## Task 5: The coordinator step-back — UNBLOCKED (ruling 3), after Task 4

**Files** — Modify: `ward-model.ts` (`UnwindRecord.kind` gains `stage_corrected` and
`acceptance_withdrawn`), `ward-change-reasons.ts` (the F2 list), `ward-flow-reducer.ts`,
`ward-management-console.tsx`. Test: `tests/ward-movement-step-back.dom.test.tsx` +
`tests/ward-movement-step-back-reducer.test.ts`.

**Interfaces** — extends `UnwindRecord`, **does not create a second store**. Reasons: _recorded in
error · the decision changed · the patient situation changed · the bed was lost_, extendable.

- [ ] **Step 1 — the failing tests**
  - `a step-back with no reason is refused` — F2, and **enforced at runtime, not by type**, the
    lesson `CANCEL_TRANSPORT` already records.
  - `only the coordinator role may step back` — F1. Assert a ward, an ED and a transport officer are
    each refused, **naming the role in the message**.
  - 🔴 `stepping back past Accepted does NOT clear acceptedUnitId or acceptedAt` — F3.
  - 🔴 `stepping back from Bed pulled does not release the bed` — the unit's `allocatable` is
    unchanged.
  - 🔴 `stepping back from Moving does not cancel transport`.
  - `withdrawing an acceptance is a separate action and records the ward it tells`.
- [ ] **Step 2 — implement.**
- [ ] **Step 3 — MUTATION, and the three F3 ones are the reason this task exists**
  - Clear `acceptedUnitId` in the step-back handler → the F3 test fails **by name**.
  - Increment the unit's `allocatable` → the bed test fails.
  - Set `transport: undefined` → the transport test fails.
  - Accept an empty reason → the refusal test fails. ⚠️ Run this one with `vitest` **only** — if it
    passes, the guard is type-only and therefore absent.

## Task 6: Sweep R64 — and two different defects need two different repairs

**Files** — Modify: `ward-movements.ts` (`routineMovements` / `stageFields`, and three hand-authored
records). Test: `tests/ward-movement-fixture-reducer-reachable.test.ts` (pure).

### 5a. `destination_review` with nothing asked and nothing declined → remap to `placement_requested`

**4 generated records. Zero hand-authored** — see the top of this document. R64's own reasoning
applies unchanged: the honest stage for a record with no referral and no decline is
"Placement requested".

🔴 **The criterion is empty `referredUnitIds` AND empty `declines`. Not the first alone** — `WF-009`
would be destroyed by that, and it is the every-ward-declined case.

### 5b. `pulled` with no `admissionId` → 🔴 **give them an admission, do NOT remap**

**7 records: 4 generated, plus `WF-004`, `WF-011`, `WF-016`.**

⚠️ **Remapping these to `accepted_awaiting_bed` would take the `pulled` count to ZERO across all 50
movements** — no example of that stage anywhere in the demo. That would make
`shortlist-panel.tsx:364`'s `canReleasePull`, the ED handover-ready gate and the ED transport-booking
gate (`ed-screen.tsx:434`, `:454`) unreachable, and the expired-pull list
(`ward-derivations.ts:744`) permanently empty. **A stage with no example is not a repaired fixture;
it is a deleted feature.**

**`pulled` with an `acceptedUnitId` and a `pullExpiresAt` is a real, wanted state. The only missing
piece is the admission record `PULL_PATIENT` would have created — so create it.** That is the repair
that makes the fixture reducer-reachable without removing a stage from the product.

### What moves on other screens, measured — so nobody reads it as a regression

`stageSummaries` counts, over all 50 movements. **Only 5a moves anything; 5b changes no stage.**

| Stage                  | Now    | After the sweep | Δ      |
| ---------------------- | ------ | --------------- | ------ |
| Placement requested    | 14     | **18**          | **+4** |
| Destination review     | 9      | **5**           | **−4** |
| Accepted, awaiting bed | 6      | 6               | —      |
| Bed pulled             | 7      | 7               | —      |
| Handover ready         | 2      | 2               | —      |
| Moving                 | 6      | 6               | —      |
| Arrived                | 6      | 6               | —      |
| **Total**              | **50** | **50**          | —      |

**Screens affected: the pipeline strips on `ward-management-network.tsx` and
`ward-management-modes.tsx`, and the stage facet in `search/patient-search.tsx`. Nothing else.**

**Deliberately unaffected, and each checked rather than assumed:**

- **The open/closed split is untouched** — no `closure` changes — so the "43 open" figure the network
  page reconciles against does not move.
- **Referability is unchanged** — `REFERRABLE_MOVEMENT_STAGES` holds both `placement_requested` and
  `destination_review`, so no movement gains or loses the ability to be referred.
- **The ED outbox is unchanged** — it filters on `acceptedUnitId`, which 5b preserves.

- [ ] **Step 1 — the failing test.** `every seeded and generated movement is a state the reducer
could have produced`, asserting each stage's required companions: `destination_review` needs a
      referral **or** a decline; `pulled` needs `admissionId`; `handover_ready` needs `transport`;
      `moving` needs `transport.collectedAt`; `accepted_awaiting_bed` needs `acceptedUnitId`.
- [ ] **Step 2 — the fixture repairs.**
- [ ] **Step 3 — MUTATION**
  - Restore one generated `destination_review` → the test fails naming that id.
  - Remove one `admissionId` → fails naming that id.
  - 🔴 **Point the criterion at `referredUnitIds` alone and run it against `WF-009`** → **it must
    stay GREEN.** If it reddens, the guard would destroy the every-ward-declined case, and the
    criterion is wrong rather than the record.

---

## What the rulings still do not cover

1. ✅ **`stageChanges` — RULED, and it supersedes ruling 2.** Task 4.
2. **Nothing pins the fixture against the reducer today.** Task 6's test is the first, and it should
   probably run over any future generator too, not only this one.
3. ⚠️ **`stageChanges` and the five existing timestamps are two sources for one fact, kept
   deliberately.** Task 4's agreement test is what makes that honest rather than latent. **If that
   test is ever weakened or skipped, the duplication becomes the defect this project keeps
   finding** — two places recording one thing, free to disagree, with nobody checking.
4. **The tracker still shows nothing for the 50 seeded movements**, because `stageChanges` is not
   backfilled — correct, since nothing observed those transitions. **A demo showing a full history
   would need a fixture built by driving the reducer**, which Task 4 needs anyway for its own test.
   Whether the demo should have one is a product call.
