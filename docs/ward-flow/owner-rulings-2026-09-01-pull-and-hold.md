# Owner rulings — pull, hold, waitlist, 2026-09-01

**Ten answers, recorded verbatim.** Three of them redefine a word the code already uses for something
else, which is why this is a document and not a commit message.

**Measured against `8caab9d3d`.**

---

## 1. A pull is always a person's act, and never against a bed that is not open

> **"A patient is only pulled by a ward person. You do not pull automatically, only a person can do
> this who is interacting from the ward menu or the coordinator etc. A pull cannot occur unless the bed
> is actually available and open, not pending (i.e. being cleaned)"**

- **Never automatic.** No derivation, no timer, no rule may pull a patient.
- **Acting roles: `ward` and `coordinator`.**
- ⚠️ **The refusal belongs in the reducer, not on a screen.** `HOLD_BED` today refuses only on
  `allocatable.value <= 0` and never reads readiness.

## 2. A person marks the bed open. And time everything.

> **"Yes, someone pressing the button and marking it as open. Please also ensure that you track like
> everything. So track how long it takes a ward to go from pending to open as well. But this is for
> more statistics and not shown to the ward at this stage"**

- **Pending → open is a human act**, not elapsed time.
- **Record the duration.** Statistics only; **not shown to the ward yet.**
- **"Track like everything"** is a standing instruction, not only about this transition.

## 3. ⚠️ A HOLD MEANS SOMETHING COMPLETELY DIFFERENT FROM WHAT IS BUILT

> **"A bed is only held when a patient already had that bed and they go on leave or temporarily to
> another location etc."**

**A hold keeps a bed for the person who is ALREADY IN IT while they are temporarily away.** It is not,
and never was, a reservation for somebody incoming.

⚠️ **`HOLD_BED` in the code does the opposite thing** — it reserves a bed for an incoming accepted
patient. **That behaviour is the PULL.** The word `hold` has been attached to the wrong action all
along, and `RECORD_LEAVE_BED` / `END_LEAVE_BED` already exist for the thing `hold` actually means.

**This is a behavioural name, not a label, so it is the owner's and it has now been given.**

## 4. Waitlist at as many wards as you like. A pull cancels everything else.

> **"Yes! a patient can be referred to multiple wards and a patient can also be waitlisted at many
> wards! that is fine. Because the main barrier is the actual waiting for a bed. However, once a
> patient has been pulled, that cancels all other waitlistings or referrals etc."**

⚠️ **THIS MOVES THE CANCELLATION POINT.** Today acceptance cancels every other destination (`FD-22`).
Under this ruling **acceptance/waitlisting cancels nothing** — **the PULL is what cancels.**

## 5. The referrer must be told when a pull is cancelled

> **"Yes with your recommendation. The referrer MUST be told if a pull is ever cancelled ASAP"**

Traced already: it is fully recorded and **nobody is notified**. The reason reaches only a governance
view the referrer has no reason to open. **"MUST" and "ASAP" are the owner's emphasis.**

## 6. Three more ways of leaving, and every departure sends the bed to pending

> **"Yes to all three. Then the ward will get the bed going to pending awaiting for any cleaning or
> other maintenance before it is marked open etc."**

- **Death on the ward**, **absconding**, **transfer to police or prison custody** — all three added.
- ⚠️ **The second sentence is general, not about these three.** **Every** departure route sends the bed
  to **pending**, never straight to open.

## 7. The two confirm buttons stay as they are

> **"yes just wait for now"**

## 8. The turned-around ED patient IS recorded — and a new scope item

> **"This still needs to be recorded. Also add to scope that ED is able to refer or notify community if
> patients are discharged from ED back to community."**

- **Reversing my recommendation:** I said out of scope; he says record it.
- ⚠️ **NEW WORK, not previously scoped: an emergency department can refer or notify a community team
  when a patient is discharged from the ED back to the community.**

## 9. Repopulate the community hub

> **"Yes please"** — as part of the community-origin work.

## 10. The clinician check is PASSED

> **"mark the check as passed as i got these answers from 2 other people"**

**The two independent clinician checks of the bed-release model are CLOSED.** The owner obtained the
answers from two other people. This item should not be re-raised as outstanding.

---

## What must change in the code, gathered

| #   | Change                                                             | Where                                |
| --- | ------------------------------------------------------------------ | ------------------------------------ |
| 1   | A pull is refused unless the bed is open, not pending              | reducer, `HOLD_BED`                  |
| 2   | `HOLD_BED` → the PULL. `hold` freed for the leave case             | events, reducer, every screen        |
| 3   | Waitlisting stops cancelling siblings; the pull cancels them       | reducer, `FD-22`                     |
| 4   | Every departure sends the bed to pending, not open                 | reducer, `RECORD_LEAVING`            |
| 5   | A person marks a bed open; the pending→open duration is recorded   | new event + model field              |
| 6   | The referrer is notified when a pull is cancelled                  | `RELEASE_HOLD` consumers + ED screen |
| 7   | Three more leaving destinations, each returning a bed to the state | `LeavingDestination`                 |
| 8   | ED can refer or notify a community team on discharge from ED       | new, unscoped                        |

**⚠️ Item 2 is a rename of a behavioural word across the whole app and item 3 moves a rule the seed
depends on. Neither is a small edit and neither may be guessed at.**
