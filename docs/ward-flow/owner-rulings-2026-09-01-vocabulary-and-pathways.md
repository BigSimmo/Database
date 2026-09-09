# Owner rulings — vocabulary, bed states and pathways, 2026-09-01

**Measured against `37bc8aca3`.** These supersede any earlier wording where they disagree.

---

## 1. The words, settled

- **A patient is ON LEAVE. Their bed is HELD.** Two facts about two different things, so both words
  earn their place and neither is stretched. **"Hold" no longer means reserving a bed for an incoming
  patient** — that is the PULL.
- **Fourth admission state is `departed`, not `discharged`.** Five of the eight ways out are not
  discharges (transferred, absconded, died, taken into custody), so "discharged" would be untrue for
  most of them. `discharged-to-the-community` remains one specific destination and does not collide.
- **`pulled` is NOT a referral state.** Every other referral state is an answer a ward gave; a pull is
  what happens afterwards. A patient may be waitlisted at many wards, so a referral can never be
  "pulled" — one of its wards pulls the patient, which cancels the rest. **Recording it in both places
  is how two records come to disagree.**

## 2. ⚠️ Six bed states, replacing a vague one

The owner asked: _"when a patient is pulled they are allocated the bed, So then is the best thing to do
label the bed Pulled until the patient physically arrives?"_ Yes — and answering it exposes that
today's `held` silently means three different things.

| State        | Meaning                                                                               |
| ------------ | ------------------------------------------------------------------------------------- |
| **Open**     | Free, ready, a patient can be pulled into it.                                         |
| **Pending**  | Free but being cleaned or repaired. **Cannot be pulled into** — built at `37bc8aca3`. |
| **Pulled**   | Allocated to a named patient who is on their way. Not free, not occupied.             |
| **Held**     | Kept for a patient who already has it and is on leave.                                |
| **Occupied** | Someone is in it.                                                                     |
| **Closed**   | Physically empty, but the ward cannot staff or use it.                                |

⚠️ **`Closed` is the leftover meaning of today's `held`** (`empty − availableNow`, i.e. a bed the ward's
own `allocatable` claim excludes). It needs its own name rather than hiding inside a word that now
means something else.

**A bed reads `Pulled` from allocation until the patient physically arrives, then `Occupied`.**

## 3. Pathways — what each actor may do

**Community**

- Refer to an ED · refer directly to a ward · receive an outpatient follow-up referral · discharge
- ⚠️ **NEW, and the owner flagged it as important and previously missed: refer to ANOTHER COMMUNITY
  TEAM.** A patient moves house and changes catchment. The whole team list derives from a catchment
  document, so this is routine rather than an edge case.

**Emergency department**

- Refer to a ward · refer to community follow-up · discharge
- Receive from community · **from ED medical doctors** · from a ward needing medical treatment

**Wards**

- **Refer to an ED** — for MEDICAL treatment. _"a psychiatric ward can only refer to ED"_ was said in
  that context; from the ED they can reach a medical ward.
- ✅ **REFER TO ANOTHER PSYCHIATRIC WARD.** _"Other psychiatric ward is different. A Ward can refer to
  another psychiatric ward. That is fine."_
- Refer to community follow-up · discharge · receive from an ED · receive from community
- ✅ **Also receive from another psychiatric ward**, by symmetry with the above.

> ⚠️ **THIS REVERSES A RULING MADE EARLIER THE SAME DAY, AND THE REVERSAL IS THE ONE THAT STANDS.**
> An earlier version of this file said "NO WARD-TO-WARD REFERRAL … that asymmetry is now a deliberate
> decision, not an oversight — do not fix it." **That is now wrong and it was wrong in the most
> dangerous possible way: it instructed a future session not to correct a real gap.**
>
> What happened: I asked whether a ward could refer to another psychiatric ward and he answered
> _"No... For now... a psychiatric ward can only refer to ED"_ — which he was answering about MEDICAL
> transfers. He corrected it within the hour, unprompted, on reading the consequence I had written
> down. **Writing the consequence out plainly is what surfaced the misunderstanding**, which is the
> argument for recording a decision's cost rather than only its content.
>
> The standing rule is **latest decision wins**. The asymmetry I originally flagged is real: the
> `transferred-to-another-psychiatric-ward` leaving destination — the only one that returns NO bed to
> the state, because the person still occupies a psychiatric bed — now has something in the app that
> can start it.

**Police and ambulance**

- ⚠️ **NOT a separate pathway.** _"These patients will come to ED and if it is for psychiatry then ED
  medical doctors will refer to psychiatry. So just leave them as ED medical doctor referrals"_ — no
  advance notice from the road, no actor outside the hospital creating records.

**ED to ED:** ⚠️ **NOT BUILT, by decision.** An emergency department cannot refer to another emergency
department, even when it has no secure assessment space. Confirmed 2026-09-01. Revisit only if he says
it happens often enough to matter.

**Ward to a general hospital:** ⚠️ **ALWAYS VIA AN ED, by decision.** A ward cannot send a patient
directly to a general hospital for medical treatment. Confirmed 2026-09-01, and consistent with wards
being able to refer only to an ED.

**Both of these are DELIBERATE ABSENCES, recorded so they are not later read as missing features.**

## 4. Rules confirmed, not previously recorded here

- Waitlisting cancels nothing. **The PULL cancels every other waitlist and referral.**
- **A ward may remove a patient from its own waitlist, and must notify the referrer.**
- **A pull must notify the referrer when the patient can come**, so transport can be booked.
- **A cancelled pull must notify the referrer.** Build it, but not now — backlog, by his decision.
- **Absconding does NOT return a bed to the state.** If the patient responds there is an option to
  place them on overnight leave — so the bed is **held**, not freed.
- **ED-to-community follow-up is a referral the community team CAN DECLINE**, not a notification.
- **A statistics screen, coordinator-only**, tracking everything — including how long a bed takes to go
  from pending to open. **"Track like everything"** is a standing instruction.
- **The two independent clinician checks are PASSED** — he obtained the answers from two other people.

---

## ⚠️ Two things found by attacking the plan before writing it — both need the owner

Ward Verifier attacked the change plan at `c1fc45917`. Both verified independently here.

### Finding A — moving the cancellation point removes a signal the owner asked for

`ward-referral-visibility.ts:44-50` documents the ONE thing a ward may still infer, and names the
owner's reason for it: a ward reading its own arm as `cancelled` infers the patient was placed
somewhere, _"so a ward does not spend its time on a patient who is being placed elsewhere"_.

**That inference is powered by the cancellation happening at ACCEPTANCE.** Moving it to the PULL does
not remove the signal — **it delays it**. A ward whose patient was accepted elsewhere now learns
nothing until somebody pulls, and keeps working the referral for that whole window.

⚠️ **I had the direction backwards, for the second time today.** I feared live referrals being reported
as settled. The real failure is the inverse — settled referrals not reported as settled, for longer —
and it defeats the owner's own stated reason for the rule while nothing fails and no test goes red.
**The module's allowlist test guards the SHAPE of the projection, not the MEANING of a state.**

### Finding B — a seed state the reducer could not produce, and the rule looks wrong rather than the seed

`state: "cancelled"` appears **zero** times in the seed, so nothing depends on cancellation — my first
fear was unfounded on the data.

But **RF-007 carries a ward arm `accepted` (`bty-youth`) AND a community arm still `queued`**
("Inner City Clinic"). `ACCEPT_REFERRAL` cancels every queued sibling **with no filter on the
destination kind** — so the reducer would have cancelled that community arm, and this state could not
have been produced. Same guard class that killed a fix attempt this morning.

⚠️ **BUT THE SEED IS CLINICALLY RIGHT AND THE RULE LOOKS WRONG.** A patient admitted to a ward still
needs community follow-up. **A ward bed and a community team are not competing for the same thing**, so
a ward acceptance cancelling a queued community arm is the app treating follow-up as a rival bed offer.

**This is the owner's to decide, and it is not a detail:** does accepting — or pulling — a patient
cancel a community follow-up referral? If not, the cancellation rule needs a kind filter, whichever
event carries it.

### Finding C — "must notify the referrer" has nothing to build on

There is no notification mechanism anywhere in the app. The only consumer of an unwind record is
`changeAudit`, rendered once in a governance view a referrer never opens. **Every "must notify" ruling
today lands on the same unbuilt thing**, which the owner has already put on the backlog. Scope them
knowing that, or they ship as records nobody reads and read as done.

---

## Nine more rulings, 2026-09-01 (the ambiguities I raised after re-reading his answers)

1. **The cap of 3 applies to REFERRING. Waitlisting is unlimited.** The cap exists so referring does not
   spam every ward; once wards have said yes there is no spam to prevent.
2. **Absconding HOLDS the bed** — it does not go to pending. **The ward may release it at any point;
   there is no timer.** A person decides, because a bed held forever is a bed the state has lost.
3. **Custody is a clean ENDING**, unlike absconding — somebody knows where the patient is and can
   re-refer.
4. **A ward patient sent to an ED for medical treatment keeps their bed HELD.** This is exactly the
   _"temporarily to another location"_ case in his hold ruling.
5. **The SENDING location books transport**, consistent with `TR-D5`.
   ⚠️ **AND: _"ED, Community and Wards all have the ability to book transport."_** `BOOK_TRANSPORT` is
   `["ed", "ward"]` today. **This is the 2026-08-31 community-transport ruling finally landing** — see
   `docs/ward-flow/community-origin-scope.md`, because a community team booking transport for a
   movement raises the origin question again.
6. **When a pull cancels a patient's other waitlists, those wards ARE told, and the patient is REMOVED
   from their waitlist.**
7. **If a community team declines an ED follow-up referral, it goes BACK TO THE ED as an open item.**
   Somebody has to notice.
8. **Statistics screen, coordinator-only.** Starting four: referral→bed, pull→arrival, pending→open,
   and declines per ward. ⚠️ **Plus, in his words: _"important things that the state government or ward
   coordinator or policy makers would want to track... also important things clinicans would want to
   track"_.** Two different audiences with different questions — do not collapse them into one list.
9. **A cancelled pull returns the bed straight to OPEN**, not pending. Nothing happened to it
   physically.

## Both open questions ANSWERED — and my recommendation was overruled on better grounds

### A ward learns nothing until it is affected

> **"NO! Other wards do not know anything at all unless it impacts them... so only if a patient is
> pulled then they are notified that the patient is taken off the waitlist"**

**I recommended telling other wards at acceptance and he overruled it.** ⚠️ **His reason is stronger
than mine and it is a PRIVACY position, not a timing preference:** a ward is told only what affects it,
and an acceptance elsewhere does not affect it — a **pull** does, because that is when the patient
leaves its waitlist.

⚠️ **THE CODE'S OWN STATED RATIONALE IS NOW SUPERSEDED.** `ward-referral-visibility.ts:44-50` records
the inference "cancelled means placed elsewhere" as intended, quoting _"so a ward does not spend its
time on a patient who is being placed elsewhere"_. **That reasoning stands, but it now fires at the
PULL rather than at acceptance**, and the comment must be updated to say so or it will read as a defect
to the next person.

So: **the cancellation moves to the pull, as he originally ruled**, and the notification rides with it.

### A community referral is discharge planning, not a rival placement

> **"No! Community referral means a patient is about to be discharged... also go ahead with your
> recommendation and stop cancelling them"**

⚠️ **THE DEFINITION IS THE VALUABLE PART.** A community referral does not compete with a bed — **it
means the patient is on their way OUT.** Cancelling it because a ward accepted them is the app
cancelling discharge planning at the moment admission is confirmed, which is precisely backwards.

**So `ACCEPT_REFERRAL`'s sibling-cancellation gains a filter on destination kind: a `community_team`
arm is never cancelled by a ward decision.** Fixing the cause, per his instruction.

⚠️ **AND THE LATENT DEFECT MUST NOT STAY INVISIBLE.** `admissionBelongsToTeam` reads only the
destination's kind and team name and never its state — deliberately, with its own comment saying a
cancelled referral still named that team and a decline locks nobody out. **So the wrongful cancellation
shows nowhere today.** If anyone later "tightens" the hub to respect state — which would look like an
improvement and pass review — people vanish from team pages. Fixing the reducer removes the trap at
source; the hub's choice should still be pinned by a test that says why.

---

## ⚠️ Absconding is NOT a way of leaving — a correction caught before it was built

Ward Verifier corrected its own earlier recommendation. Verified here: `RECORD_LEAVING` sets
`state: "left"` and `empty + 1`, so **anything recorded as a `LeavingDestination` FREES THE BED** —
the exact opposite of the owner's ruling that absconding **holds** it. Nothing is built yet, so nothing
needs undoing.

**The error was clinical, and it is worth stating in full because the model would have encoded it.**
Absconding was grouped with death and police custody as "ways a person leaves the ward". **Death and a
custody transfer END an admission. Absconding does not.** An absconded patient is **still admitted,
still the ward's responsibility, and may still be detained under the Act.** They have not been
discharged — **they are missing.** The bed is held because they may be back within hours.

- ✅ **`LEAVING_DESTINATIONS` gains TWO members, not three:** death on the ward, and transfer to police
  or prison custody.
- ✅ **Absconding needs its own shape** — an admission that continues while the patient is absent, with
  the bed held.

⚠️ **AND THE HOLD NEEDS SOMETHING TO END IT.** `HOLD_BED` writes `bedHeldUntil = now + 60`, so every
hold today expires. The owner ruled **no timer** for absconding and that **a ward may release it at any
point** — so the releasing event exists as a decision but not as code. **Without it the ruling produces
a bed no path can recover.**

**ANSWERED:** ✅ **a sixth leaving destination, `did-not-return`.** Honest, not a judgement about the
person, and it **does** return a bed to the state.

So `LEAVING_DESTINATIONS` gains **three** members after all — but not the three originally proposed:
**death on the ward**, **transfer to police or prison custody**, and **did not return**. Absconding
itself is not among them, because it is not a departure.

---

## Eight approvals, and two of them carry new work

All eight recommendations approved 2026-09-01. Six are already recorded elsewhere. **Two of his notes
add requirements that were not in the recommendation he was approving.**

### ⚠️ A pull allocates a bed. It does NOT mark anybody as arrived.

> **"a patient is not marked as arrived until the ward says they have arrived. The pull just means the
> bed is allocated to them."**

**This converts a suspected defect into a confirmed one.** `HOLD_BED` today creates an `Admission`
stamped `state: "occupied"` with `arrivedAt` set to the moment of the pull — and `RELEASE_HOLD` never
removes it, so **a phantom arrival survives a cancelled pull.** Nothing tests it.

Two things are wrong at once: the patient is recorded as having arrived when they have not, **and the
record that says so cannot be undone.** The ward is the only party that may assert an arrival.

### ⚠️ He wants ward-level decline tracking, and the model cannot express it

> **"The stats is only visible by a coordinator... it is about tracking this stuff.. it should be able
> to track what wards reject referrals and things etc"**

**This is a requirement, not a confirmation of the ruling he was answering.** Ward Builder measured that
a referral decline **cannot** name a ward: `acceptedUnitId` sits on the `ReferralAddressing`
(`ward-model.ts:918`), so an ACCEPTED addressing names a unit and a DECLINED one has nowhere to put it.
`DECLINE_REFERRAL` carries `referralId` and `destinationKind` — no unit.

So the honest statistic he asked for first is the one the model cannot currently produce.

**NEW WORK ITEM: a declined referral must record WHICH unit declined it, alongside its reason.** The
asymmetry looks like an oversight rather than a decision — the accept path already carries the unit —
but it is a model change on a surface with privacy rules attached (`FD-23`: a ward may learn that its
referral ended, never where or by whom), so **the projection boundary must be checked in the same
change.** Until it lands, the statistics page states that the figure is withheld and why.

---

## ✅ The journey begins when the referral is raised, and the referral stays attached

**Owner ruling, 2026-09-01.** The app has had **two unconnected front doors**: one creates a `Referral`,
a different one creates a `Movement` from a blank form at an emergency department. A ward could accept a
referral and **no journey ever came into existence from it.**

**The ruling: raising a referral creates the journey, and the referral stays attached to it throughout.**
So a coordinator sees one continuous story from _somebody asked_ to _they arrived_, instead of two halves
that never meet. **The pull is a stage within that journey, not its start.**

⚠️ **I ASKED HIM THE WRONG QUESTION FIRST** — whether a ward ACCEPTING should create the journey. On his
own model that is wrong: accepting means **waitlisted**, and a waitlisted patient is not coming. Only a
pull means they are on their way. **The error was mine and the model already said so.**

### What this unblocks, and the trap that comes with it

`Movement.referralId` becomes buildable, which unblocks moving the cancellation to the pull, waitlisting
at many wards, and part of the community-origin work.

⚠️ **BUT TWO CANCELLATION MECHANISMS BECOME ABLE TO DISAGREE THE MOMENT THE LINK EXISTS.**
`ACCEPT_IN_PRINCIPLE` cancels a movement's sibling unit referrals. `ACCEPT_REFERRAL` cancels a referral's
sibling destinations. **They are safe today only because their subjects are disjoint — and this link is
exactly what ends that.** `ACCEPT_REFERRAL` carries the owner's carve-out sparing community teams;
`ACCEPT_IN_PRINCIPLE` has **no carve-out at all**, so it would cancel a community follow-up the other one
deliberately protects.

**Settle that in the same change, not after.** Found by the agent that refused to build the field.
