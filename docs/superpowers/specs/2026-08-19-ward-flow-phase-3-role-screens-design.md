# Ward Flow Phase 3 — the other three roles — Design

**Status:** approved in brainstorming 2026-08-19. Binding authority for Phase 3.

Phase 1 built the model. Phase 2 built the flow coordinator's screen against it. **Phase 3 makes
the system move.** It adds the other three roles, and in doing so introduces the first mutable
state this build has ever had.

The coordinator screen is the **primary, guiding screen**. The other three exist to answer it.

---

## 1. What already exists

Six pure modules (`ward-clock`, `ward-model`, `ward-eligibility`, `ward-sites`, `ward-movements`,
`ward-derivations`) plus two Phase 2 additions (`ward-priority`, `ward-pressure`). 17 sites, 8
emergency departments, 22 units, 48 movements of which 41 are open. `NOW_ANCHOR = 642` (10:42).

One coordinator screen at `/ward-management` in five regions — emergency-department pressure
strip, priority queue, flow diagram, explainable shortlist, exceptions drawer — plus a phone form.
Eight further routes: `/network`, `/queue`, `/capacity`, `/movements`, `/exceptions`,
`/transport`, `/governance`, `/patients/[patientId]`. `/constellation` was retired in Phase 2.

Everything to date reads a frozen constant. Nothing has ever changed anything.

Three Phase 2 decisions pay off directly here: `edPressure(now, movements)`,
`queueOrder(movements, now)` and `buildActionInbox(movements, now)` all already accept an injected
movement list rather than importing one, so they work unchanged against mutable state.

---

## 2. Settled decisions

Decided by the product owner. Not open for re-litigation.

| #   | Question                     | Decision                                                                                                           |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | Does state persist?          | **No.** It mutates in memory and resets on refresh. No server, no storage.                                         |
| 2   | Phase shape                  | **All four surfaces in one phase.**                                                                                |
| 3   | Which actions genuinely work | **The full placement loop** (section 5). Everything outside it renders but is inert.                               |
| 4   | Role identity                | **In the URL**, with a switcher that follows the selected patient and a picker to move elsewhere.                  |
| 5   | Does the clock move?         | **Yes**, with a jump-forward control.                                                                              |
| 6   | Parallel referral withdrawal | **Instant and automatic**, with the reason shown to the ward.                                                      |
| 7   | The coordinator's action     | **Refer to up to three wards**, not single placement. Acceptance becomes the ward's move.                          |
| 8   | Security gate                | A locked ward still passes an open patient, worded as _more restrictive than required_; matching wards rank first. |

---

## 3. Architecture — the state layer

A single `WardFlowProvider` mounted at a new `src/app/ward-management/layout.tsx`, following the
repository's existing React-context pattern. Eight `createContext` providers already exist; no
state library is present and none is added.

It holds exactly two things:

```ts
type WardFlowState = {
  movements: Movement[]; // seeded from wardMovements, deep-copied, never mutated in place
  clockOffsetMinutes: number; // demo jump-forward, starts at 0
};
```

`now` is **derived, not stored**: `NOW_ANCHOR + minutesSinceMount + clockOffsetMinutes`.

Every change goes through one pure reducer:

```ts
function wardFlowReducer(state: WardFlowState, event: WardFlowEvent): WardFlowState;
```

The reducer contains no React, no I/O and no clock read — `now` arrives on the event. It is
therefore testable exhaustively in Vitest without a browser, which is where the bulk of this
phase's proof lives.

**The fixture is frozen and copied at seed time.** `wardMovements` is an imported constant that
four screens will now write against; mutating it in place would make tests order-dependent.

---

## 4. The clock

The fixture's waits and deadlines are all measured from 10:42. If `now` became the real time of
day, every patient would read as many hours overdue and the whole board would be nonsense. So the
clock starts at `NOW_ANCHOR` and advances from there.

- `wallClockNow()` in `ward-clock.ts` — exported since Phase 1 and unused until now — is the only
  permitted wall-clock read, and is consumed here, once, inside the provider.
- A jump-forward control (+15 min, +1 hour) advances `clockOffsetMinutes`, so a held bed can be
  watched expiring in seconds rather than in half an hour.
- **Tests inject a fixed `now`.** Only the live application ticks. This is the phase's main
  flakiness risk and the mitigation is structural, not incidental.

---

## 5. The events

The full placement loop. Each is a named event on the reducer; each names the role permitted to
raise it.

| Event                 | Role        | Effect                                                                                                                                                         |
| --------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RAISE_REFERRAL`      | ED          | Creates a movement at `placement_requested` from a short form.                                                                                                 |
| `REFER_TO_UNITS`      | Coordinator | Sets `referredUnitIds`, never above `PARALLEL_REFERRAL_CAP`; stage becomes `destination_review`.                                                               |
| `ACCEPT_IN_PRINCIPLE` | Ward        | Sets `acceptedUnitId`; stage becomes `accepted_awaiting_bed`; **withdraws all other referrals**.                                                               |
| `HOLD_BED`            | Ward        | Stage becomes `bed_held`; starts a **60-minute** hold expiry, stored as an instant so it counts down with the clock.                                           |
| `DECLINE`             | Ward        | Appends a `Decline` with a fixed reason; drops the unit from `referredUnitIds` and from that patient's future suggestions; stage becomes `destination_review`. |
| `HANDOVER_READY`      | ED          | Stage becomes `handover_ready`; transport requested.                                                                                                           |
| `TRANSPORT_ACCEPTED`  | Officer     | Stamps `acceptedAt`.                                                                                                                                           |
| `TRANSPORT_EN_ROUTE`  | Officer     | Stamps `enRouteAt`.                                                                                                                                            |
| `PATIENT_COLLECTED`   | Officer     | Stamps `collectedAt`; stage becomes `moving`.                                                                                                                  |
| `PATIENT_ARRIVED`     | Officer     | Stamps `arrivedAt`; stage becomes `arrived`. **The record closes and the patient leaves the system.**                                                          |
| `ADVANCE_CLOCK`       | Demo        | Adds to `clockOffsetMinutes`.                                                                                                                                  |
| `RESET_SCENARIO`      | Demo        | Re-seeds from the fixture.                                                                                                                                     |

**Withdrawal is automatic and is not an allocation.** When one ward accepts, the other referrals
disappear from those wards with "withdrawn — placed at _X_". Making a ward wait for a coordinator
to release it is the phone-around this system replaces. This does not breach the
nothing-auto-allocates rule, which governs _placing_ a patient, not releasing a ward.

**An expiring hold raises an exception. It never auto-releases the bed.**

---

## 6. The screens

### Coordinator — primary and guiding

Rewired, not rebuilt. Its five regions stay. Three things change:

1. **It reads live state.** Every figure moves when another role acts. A ward accepting is watched,
   not discovered on reload.
2. **Its action becomes a referral.** "Confirm placement" becomes _refer to the selected wards, up
   to three_, each told it is one of a parallel set. Acceptance is the ward's move. The governance
   line stands: the system suggests, a human decides, nothing auto-allocates.
3. **Answers arrive.** A decline drops that ward from the shortlist, records its reason and time,
   and returns the patient to destination review, live.

It also carries the one piece of Phase 2 follow-up the owner settled but which was deliberately not
implemented there: the security gate's detail changes from "Secure ward meets an open requirement"
to wording that says the ward is **more restrictive than required**, and candidate ordering ranks a
security-matching ward above an over-restrictive one. `ward-eligibility.ts` is a protected surface
and its pass/fail semantics do not change.

### Emergency department — `/ward-management/ed/[edId]`

Its own patients only. Each carries its legal clock, its referral state, and **the single
outstanding item**: a form, a transport request, or handover. Statewide capacity is visible and
read-only — hiding it would recreate the problem this system exists to remove. It can raise a new
referral through a short form (cohort, security, sex, specialling, legal status, urgency).

No statewide queue, no shortlist, no flow diagram. This is not the coordinator screen filtered.

### Ward — `/ward-management/ward/[unitId]`

One unit, not twenty-two. Confirm what beds are genuinely allocatable by cohort, security and sex
mix. Answer incoming referrals: accept in principle, hold a named bed, or decline with a reason
from the fixed list. See who has been accepted, held, or is en route here. A parallel referral is
labelled as one.

### Transport officer — `/ward-management/transport/officer`

A phone. The model carries no officer identity — `TransportJob` records a `provider`, not a person — so this surface shows every job not yet arrived rather than inventing an officer to own them. That is the honest reading and it is stated on the screen. Per job: patient identifier, origin department, destination
unit, legal form required, escort required. **Four actions: accepted, en route, collected,
arrived. Nothing else.**

Confirm-style controls are pinned to the bottom of the viewport rather than scrolled to — the
pattern settled for the coordinator's phone form.

### Live tracker — `/ward-management/transport`

The existing route, rewritten as the coordinator's view of every vehicle: which patient, which
leg, how long since the last stamp.

---

## 7. Role switching and identity

The URL carries identity. The switcher offers the four roles and infers _where_ you are standing
from the currently selected patient — switch to Ward with WF-017 selected and you arrive at the
ward it was referred to, seeing WF-017 awaiting your answer. A picker moves you elsewhere.

The coordinator is **statewide and has no place**. The switcher shows that asymmetry rather than
inventing a location for it.

---

## 8. Failure behaviour

**The reducer rejects impossible transitions rather than absorbing them.** A ward accepting a
patient already placed elsewhere is told the referral was withdrawn — never a silent success.

Rejections surface in a visible, persistent place, not a disappearing toast. The seam between four
screens acting on one patient is where this project has repeatedly found defects, and it is worth
its own surface.

All Phase 1 and Phase 2 rules continue to bind: conservative failure; display less rather than
something plausible; authorisation gates the destination only and never the patient's current
department; urgency tier leads and the operational score is never called severity, acuity or risk;
synthetic data only, including free text; determinism; design tokens; 3rem tap targets.

---

## 9. Out of scope

Deferred to Phase 4: the statutory clock board, the escalation record for when nothing is
eligible, shift handover, patient search, governance and capacity extensions, and the exception
categories the model does not compute (stale capacity, feed-versus-ward disagreement, overdue bed
releases, ownerless movements).

Rendered but inert in Phase 3: urgency changes, legal status changing mid-movement, closure as
did-not-proceed, ward-flagged bed releases.

---

## 10. How it gets proved

- **The reducer, exhaustively, in Vitest.** Every transition and every rejected transition. This is
  the bulk of the proof and it needs no browser.
- **Contract tests** for the invariants: parallel referrals never exceed the cap; a declined unit
  never reappears in that patient's suggestions; no movement is left ownerless; beds always account
  for; no identity field on any record; no unlawful destination is suggested.
- **One browser journey per role screen**, plus phone, dark, forced-colours and print.
- **One end-to-end journey in a single window**: ED raises, coordinator refers to three, one ward
  accepts and the other two see withdrawal, bed held, handover, the officer's four actions, arrived
  closes the record. This is the journey that proves the phase.
- Time is injected as a fixed value in every test.

---

## 11. Build order

1. The reducer and its tests — before any screen, as Phase 2 built derivations before regions.
2. The provider, the clock, and the coordinator rewire — nothing else has anywhere to send answers.
3. Ward screen — closes the loop on the coordinator screen.
4. Transport officer phone.
5. Live tracker.
6. ED screen.
7. Role switcher, then the end-to-end journey.

---

## 12. Risks

- **Ticking clocks and browser tests.** Mitigated by injecting a fixed `now` everywhere except the
  live provider.
- **The frozen fixture.** Must be deep-copied at seed; mutating it in place makes tests
  order-dependent.
- **Phase size.** Four surfaces plus a state layer is roughly twice Phase 2, which ran 21 commits
  and 11 review rounds. The owner chose this deliberately against a recommendation to split. If it
  sprawls, propose a split rather than grinding on.
- **Four screens describing one patient.** Every defect this project has found is a surface stating
  something the data does not support. Four surfaces multiply the opportunity.

---

## 13. Repository conventions this phase must satisfy

New routes need a literal `<Link href="...">` in the rail navigation — hrefs built from an array
are invisible to `tests/route-reachability.test.ts` and the route fails as an orphan. Every route
must be declared in `docs/design-system/adoption-contract.json` followed by
`npm run design-system:adoption:update`. Any new Playwright spec must be added to **both**
`testMatch` and `productionSpecPattern` in `playwright.config.ts`, or it silently runs zero tests.
