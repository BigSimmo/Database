# ⚠️ The owner's ruling is broken in three places, at three layers, and they are not independent

**Assembled by Ward Lead 2026-09-02 from Ward Builder Two's findings (`df84e9153`, `b307d6d40`,
`6f1585972`). The ruling, verbatim, his exclamation mark:**

> _"It will send a refusal.. however... the referral can still be sent if the referrer gives a
> reason. **No referral locations are to be completely blocked !**"_

## The three

| #     | Where                                                             | Layer                        | Form            |
| ----- | ----------------------------------------------------------------- | ---------------------------- | --------------- |
| **1** | Shortlist omits wards — cohort pre-filter + the cap               | coordinator path, **screen** | omission        |
| **2** | `ACCEPT_REFERRAL` refuses on judgement gates with no reason field | front door, **engine**       | hard gate       |
| **3** | Match screen shows the reason and no control                      | front door, **screen**       | missing control |

⚠️ **2 and 3 are the same path and must ship together. 1 is a separate path and can ship alone.**

## ⚠️ 3 is the sharpest, and the sentence for it is Ward Builder Two's

`referral-match.tsx:518-535` lists **every** ward — genuinely unfiltered, straight from
`referralCandidates` — and for an unsuitable one it spells out exactly why it cannot take the patient.
**And then the accept control and the reason are the two arms of one ternary, so a ward is never shown
both.**

> ⚠️ **"The explanation is there. The button is not."**

**The system does the owner's first half perfectly. The second half was never wired.** _Advise loudly_
is built; _let the clinician decide_ does not exist on that screen.

## ⚠️ 2 is the one that survives every UI fix

`ACCEPT_REFERRAL` (`ward-flow-reducer.ts:2231-2239`) rejects on the first failing
`referralEligibility` gate — **including the judgement gates: age, security, sex designation, sex
mix.** The event (`ward-flow-events.ts:586-604`) carries `role`, `now`, `referralId`,
`destinationKind`, `unitId?`. **No reason field. No override field.** Its own doc comment states the
rule outright.

⚠️ **So a referral whose every ward fails one judgement gate can never be accepted, anywhere, by
anyone, with any reason.** The ruling broken at the layer that is supposed to hold policy.

**Control:** the same search finds `overrideReason` where it does exist, at
`ward-flow-events.ts:146` — so the absence is measured, not assumed.

## ⚠️ The finding behind the findings: the two paths hold OPPOSITE policies

- **The coordinator path checks no judgement rule at all**, so its `overrideReason` records a decision
  rather than unlocking one. **Nothing there is locked.**
- **The front door hard-gates on every judgement rule and cannot be argued with.**

**Same system, same ruling, broken at both ends for opposite reasons.** ⚠️ Neither half alone produces
that statement — it took looking at both ends, and it is why a fix aimed at one end would have read as
complete.

## The sequence, ruled

1. ⚠️ **2 + 3 FIRST.** The path where the ruling is most completely broken — _a patient unacceptable
   everywhere, permanently_. Its advisory half already exists, so it is the smallest honest change.
   **2 is Ward Builder Three (engine, reuse `OVERRIDE_REASONS`); 3 is Ward Builder Two
   (`referral-match.tsx`). Disjoint files, parallel work, ONE fold.**
2. **1 SECOND, and explicitly parked, not forgotten.** ⚠️ Unfiltering the shortlist first would offer
   a coordinator wards the front door still refuses — **a worse screen than the one we have now.**

⚠️ **NEITHER 2 NOR 3 FOLDS ALONE.** The button without its engine is a lie to the person pressing it;
the engine without the button is the silent-refusal defect again, on a second screen.

## The merge clears this path — checked, with a control

Against `git merge-base HEAD origin/main`:

```
referral-match.tsx      0 changes on main   <- clean
ward-flow-events.ts     0                   <- clean
ward-flow-reducer.ts    0                   <- clean
shortlist-panel.tsx     1                   <- the only contested file
CONTROL: ward-flow-provider.tsx  1          <- proves the check detects changes
```

⚠️ **None of the three files 2+3 touch is contested. The only contested one belongs to item 1 — the
one just parked.** The sequence chosen on clinical grounds also happens to avoid the merge.

## What is NOT established, stated because it is load-bearing

The falsification of "no other picker exists" **survives**, but on a coverage its own author
volunteered: **~39 files matched, 4 read in full, ~6 substantially, ~29 by grep alone.** Its
exhaustiveness rests on **a structural argument, not a sweep** — the event type is a closed union and
there is no computed `dispatch(variable)` anywhere outside the scripted tour.

⚠️ **The argument is sound and it is still an argument.** It is recorded as REASONED, and **it
silently expires the day anyone adds a computed dispatch.** Three screens do let a user click any ward
(`flow-diagram.tsx`, `ward-management-network.tsx`, `wards/ward-index.tsx`) and between them contain
**zero `dispatch(` calls** — display surfaces, which is why the two acting pickers are the whole
attack surface.
