# Ward Flow: everything waiting on you

**Assembled 2026-09-04 by Ward Lead from four working sessions plus a sweep of the written record.**

Nineteen items. **Eight block work that is stopped right now.** Ten do not. One is not a question at
all — it is a fact you should have.

Every session was asked to send only what is genuinely yours and to settle anything a measurement
could settle. **Between them they withdrew eight questions on that instruction** — things they had
been about to ask you that turned out to be defects they could simply fix.

---

## Read this first — about the decisions already recorded as yours

> **Roughly twenty-two decisions are recorded as yours from today. Six carry your own words. Sixteen
> are somebody's paraphrase of them, and nobody can check any of the twenty-two against what you
> actually said. About twenty describe things that have not been built — so they have never been
> contradicted by anything, which is not the same as having been confirmed.**

**One measured instance, which is item 1 below.** The specification records a fixed list of nine
delay reasons tagged as your decision. **You ruled that there should BE a fixed list, and that it
should be easy to extend. You have never ruled on what is in it.** The nine were derived from your
fixture and from published taxonomies. The session that wrote them says it put them to you, you asked
to see them, and you have not answered — so an open question was wearing your name, in the very
document that introduced the tagging convention.

**And the most-quoted sentence in the whole specification is a paraphrase.** _"Build the lightweight
version now; design so the heavy version adds without rework"_ is one session's synthesis of a
pattern across five separate answers of yours. No single answer said it. It may capture your intent
better than any one of them did — which is exactly what makes it worth flagging, because it is the
sentence somebody will cite to justify a shortcut.

**Nothing here asks you to re-do that work.** It asks you to read the sixteen paraphrases as
paraphrases.

---

# PART ONE — BLOCKING

## 1. Are these the right nine reasons a patient is delayed?

**The situation.** The delays view needs a fixed list of reasons a patient is waiting. Nine were
written; you have not seen them. They are:

    no suitable bed anywhere          awaiting a ward's answer
    awaiting the bed to be ready      awaiting staffing
    awaiting transport                awaiting medical clearance
    awaiting a legal form             awaiting funding or an external service
    patient or family factors

**Two more are proposed by the session that built them:**

- **awaiting a decision from the coordinator** — currently there is no way to record this, so a delay
  caused by the coordinator's own queue is invisible. **That flatters the coordinator**, and it is the
  one omission the session flagged as substantive rather than tidy.
- **out of area, awaiting a return** — a patient placed outside their catchment who is waiting to
  come back.

**Why it blocks.** Every delay recorded before you rule will carry a reason from the list as written.
Changing the list later means re-coding history or leaving two vocabularies in the data.

➡️ **Suggestion: no recommendation on the nine themselves — your instinct beats a derivation from
published taxonomies here, and this is the one item on the whole list where that is most true.** I do
recommend adding both proposals. The coordinator one especially: a delay category that cannot be
recorded is a delay category that will never appear in any statistic you look at.

**If you defer:** the delays view stays unbuilt. Nothing else is affected.

---

## 2. If the board shows you a bed for this patient, is that bed still offered to the next patient?

**The situation.** This is a question about how your wards actually work, and you can answer it
without knowing anything about the software.

**Why it blocks, concretely.** The software is being taught to notice when two patients want the same
bed. What that code is _made of_ depends entirely on your answer:

- **If showing a bed holds it** — then a suggestion is a thing with a lifetime. It has to expire. Two
  coordinators looking at the same board at the same moment have to be prevented from being offered
  the same bed. That is a substantial piece of machinery.
- **If only an actual acceptance counts** — then the code just reads decisions that have already been
  made and records nothing new.

**Half of it is already built, on the second reading.** If you answer the other way, that half needs
extending — not thrown away, but it grows.

⚠️ **This question was nearly missed entirely.** It was filed in the design under a heading about
privacy and data retention, where it read as a question about how long to keep a log — the sort of
thing you answer after the thing exists. **A question filed by its second consequence gets deferred by
its filing rather than by anyone's decision.**

➡️ **Suggestion: answer this one first, before anything else on the list.** It is cheap now and
expensive in a week. My own guess, offered as a guess: in a real ward a bed shown on a screen is not
held by anything, and the holding happens when somebody rings up and says yes — but that is my model
of your world, not knowledge of it.

**If you defer:** the bed-competition work stops. Everything downstream of it stops with it.

---

## 3. When a clinician accepts the board's suggestions, is it one patient at a time, or a whole arrangement row by row?

**The situation.** You asked for two things: suggestions about which patients fit which wards, and
_"the most effective way to match all patients with beds"_. The second is a different problem — an
arrangement across everybody, not a list per patient.

**Three shapes are possible:**

- **(a) One patient at a time, as now, better advised.** The board may work out the best arrangement
  behind the scenes, but it never puts an arrangement on screen as something to accept. Safe;
  under-delivers what you asked for.
- **(b) The arrangement, accepted row by row.** The board works out the whole board's best fit and
  shows it. **Nothing happens until every patient's row has been individually accepted, changed or
  refused.** A nine-patient morning is nine deliberate acts.
- **(c) The arrangement, accepted in one click.** Rejected.

**Why (c) is rejected, in one sentence:** that single click is compatible with having thought about
none of the nine patients, and nothing in the record afterwards could tell a careful review from a
reflex. **Asking "are you sure?" does not fix it** — a second click carries no more information than
the first. (A confirmation that made you _type_ something would carry information; nobody has designed
one and it is not on the table.)

**A promise you have already made bears on this.** Two screens currently tell clinicians _"a human
coordinator confirms or overrides every suggestion."_ **Shape (b) is that sentence, almost word for
word. Shape (c) makes it false.**

➡️ **Suggestion: (b).** It delivers what you asked for while keeping the unit of judgement where you
put it. It is deliberately more expensive to use than (c), and that expense is the safeguard.

**If you defer:** the arrangement work stops. The bed-competition groundwork can continue.

---

## 4. Should three screens still tell clinicians the app "never ranks wards"?

**The situation.** Three screens carry a paragraph that says the board is **not a medical device**,
and gives as the reason that it _"never ranks units by suitability"_ and _"never suggests which bed is
best"_.

**Your ruling today withdrew that restriction and asked the app to start suggesting.** So those
sentences describe a rule that no longer exists.

🔴 **And they were already not quite true.** The product ranks wards by fit to a patient **today**, on
four screens: it deliberately pushes a ward that is more locked-down than the patient needs further
down the list, and the code says in as many words that such a ward _"should not be the one a
coordinator is steered toward first"_.

**Each sentence is true of its own screen** — those three screens genuinely do no ranking. **The
product is not.** A clinician who reads three screens saying the software never ranks forms a belief
about the product, not about three screens. **That distinction is precisely what a regulator asks
about.**

**Related and already recorded:** the medical-device classification box was left unticked on the last
release for exactly this reason, and the timing was ruled — it needs answering **before this reaches
anyone, not before it is prototyped.** That still stands. This is the narrower question of what the
screens say today.

➡️ **Suggestion: change all three, and require that whatever replaces them is true of software that
already ranks — not of software about to.** The honest form is a description of today rather than a
promise about tomorrow: _"this board does not decide"_ rather than _"this board never ranks"_. And
whatever you pick should be pinned by a test, because all three are currently asserted by nothing,
which is how the last correction missed them.

**If you defer:** three screens stay frozen and nobody edits them. No other work is affected — but
the sentences become actively false the day matching ships.

---

## 5. How should a bed's state be represented?

**The situation.** You described six states you want to see: open, pending, pulled, held, occupied,
closed. The software has four numbers. Three ways of closing that gap are written up:

1. **Rename the existing four boxes** — cheapest, and it cannot express all six.
2. **Four boxes plus two side counts** — middle option.
3. **Give every bed its own record** — most work, most faithful, and it is the only one that could
   ever let a ward see beds by name or number.

**Sub-decisions ride on whichever you pick:** whether _"closed"_ means what your earlier note implies
or what the plain word implies — **they differ, and nobody has reconciled them**; whether a patient
who is named but has not arrived occupies a bed; whether beds get numbers a ward would recognise; and
whether the male/female designation belongs to the ward or to the bed.

➡️ **Suggestion: I do not have one, and I am not going to invent one.** I have not read the three
options closely enough. What I will say is that this is a **prerequisite** — nothing in the bed model
can be built until it is chosen, and item 12 (locked versus authorised) sits on top of it.

**If you defer:** the bed-state work stays unbuilt. The mixed-ward work currently in progress is
separate and continues.

---

## 6. When one referral asks both a community team and a ward, should it appear on the coordinator's screen?

**The situation.** A referral can be addressed to more than one kind of destination at once. When one
of those is a ward, it is also a live request for a bed — which is the coordinator's business.

The file recording this says plainly: **"half two cannot be finished without it."**

➡️ **Suggestion: yes, show it.** A live bed request that the coordinator cannot see is the failure
mode the coordinator's screen exists to prevent. Offered with less confidence than most items here,
because I have not opened that screen myself — this one came from the document sweep rather than from
a session that had it in hand.

**If you defer:** half of the referral work stays unfinished.

---

## 7. When a patient dies, absconds, or is taken into police custody, does each free up a bed?

**The situation.** Three new ways a patient can leave a ward were added. Whether each one returns a
bed to the statewide count was recorded as **"his call, not a default"**, with an explicit written
instruction not to build on an assumption.

➡️ **Suggestion: no recommendation on the clinical substance.** What I can say is that these three
are unlikely to be one answer — a death and an absconding have different consequences for how quickly
that bed is genuinely usable, and an absconded patient may return.

**If you defer:** the instruction not to build stands, so those three outcomes stay unmodelled.

---

## 8. The software accepts an override reason that nobody can type

**The situation.** The engine will accept a placement that fails a suitability check **if a reason is
recorded**. That machinery works and is tested. **No screen has a box to type the reason into.**

So today the safeguard exists and is unreachable — nobody can perform the override at all, which is
safe, and also means the feature does not work.

➡️ **Suggestion: build the box.** The safeguard was designed as "override is possible but always
recorded", and half-built it becomes "override is impossible", which is a different clinical policy
than the one you approved. If you meant override to be impossible, say so and the engine should be
changed to refuse rather than to accept-with-a-reason nobody can give.

**If you defer:** the override path stays unreachable.

---

# PART TWO — NOT BLOCKING, BUT YOURS

## 9. What should the app call "beds you could put someone in today"?

**The situation.** One number. **Seven different words for it** across the product: _free_, _ready_,
_available now_, _beds you can fill today_, _Now_, and two longer phrasings.

**This is not tidiness.** One screen used to say a ward had beds "free" while the same screen, two
hundred lines down, called the same number "ready" and showed the beds that are empty-but-not-fillable
as "held". A clinician reading both would conclude the ward had more room than it did.

➡️ **Suggestion: pick one and use it everywhere. "Ready" if you have no preference** — it is already
the most used, and it is the word the ward breakdown uses beside "held" and "blocked", so it reads as
part of a set rather than a claim on its own.

---

## 10. Looking at a whole service, do you want beds you could fill right now, or beds the wards say they can staff?

**The situation.** These are different numbers. **The screen currently shows one of each and calls
them both "ready."** The heading adds up what the wards say they can staff; the cards underneath show
what could actually be filled. **So the heading can overstate every single card beneath it** — a ward
with three staffed beds and none empty contributes three to the heading and one to its own card.

**A coordinator reads that heading to decide where to look first.**

➡️ **Suggestion: make the heading mean what the cards mean — beds you could fill right now.** A
heading that disagrees with its own contents is worse than either number alone.

**Offered honestly:** the bed-competition work starting now will make the consequences of this choice
visible in a way they are not today. **Answering in a week with better evidence costs nothing.**

---

## 11. Should the page listing every ward show any numbers, or stay names only?

**The situation.** The ward index is a plain list of ward names with no figures at all. A card layout
showing each ward's free beds was built once, refused by a test, and reverted. The stylesheet for it
is still there, kept deliberately for whoever decides this.

⚠️ **You should know two things that pull in opposite directions.**

**Against the restraint:** nobody can find where it came from. It was traced by content across more
than 4,800 documents and both working branches. **No decision of yours mentions this page.** You may
be being asked to ratify something you never asked for.

**For the restraint:** six neighbouring screens already show no bed figures and say so in prose, with
no rule enforcing it — people arrived there independently. And the reason given, in the one place it
is written down, is that two screens showing the same number in different words is this project's most
reliable defect. **Which is exactly what item 9 above turned out to be.**

➡️ **Suggestion: stay names only, and settle item 9 before anyone touches the layout.** If the ward
list later gains a figure, it should gain the agreed word for it, not an eighth one.

---

## 12. Should "this ward has locking doors" and "this ward may legally hold involuntary patients" stay two separate facts?

**The situation.** Today the software has one flag per ward, and you told us that is wrong: _"some
wards are a combination with a number of designated locked beds and open beds."_ That is being fixed
now — it is the one place the app currently gives a **wrong** clinical answer rather than an
incomplete one, because a mixed ward recorded as open hides all its locked beds from every patient who
needs one.

The remaining question is whether the two facts stay separate underneath.

➡️ **Suggestion: separate in the data, shown as one combined verdict on screen.** They can come apart
in reality, and a single flag is what caused the current defect. It is one line to reverse if you
disagree.

**One thing already decided and worth confirming:** your three words — **locked, voluntary, mixed** —
are being adopted for wards. **They are not being used for individual beds**, which are locked or open,
because "voluntary" describes a patient and "locked" describes a door, and a voluntary patient can be
nursed in a locked bed. Say if that split is over-careful.

---

## 13. Sex and gender identity in bed matching

**Your standing answer** is that this belongs to a clinician with specific expertise, and the code
should not change until they have been asked. That stands.

**What is not answered:** you said the software should encode no rule. **Did you mean no rule
connecting a person's gender identity to which bed they get, or no automatic rule about sex at all?**
Those have opposite consequences.

**Measured, so you have the facts:**

- **A sex-based bed rule does run today** — it is a live check in the eligibility gate.
- **No screen carries the statement you asked for** saying that no automatic rule applies. That
  statement was approved and never built.
- ⚠️ **A free-text field for sex-or-gender is kept as free text on the recorded grounds that "bed
  allocation depends on this". Bed allocation never reads it** — it reads a separate, closed list. So
  the closed list that was deliberately refused already exists, on the field that actually decides,
  and the free-text field's stated reason for existing is not true.

➡️ **Suggestion: no recommendation on the clinical question.** On the two facts: the missing on-screen
statement should be built, worded to be true of the field that actually decides. The free-text field's
justification should not be quietly ratified by that sentence — that is a privacy question about
storing free text on a sensitive attribute, and it is a separate one.

---

## 14. When a ward's referral is withdrawn because another ward accepted the patient, should the screen say "withdrawn by the referrer"?

**The situation.** Two different things currently share one label. In one, the referrer actually
withdrew. In the other, somebody else accepted the patient and this ward's request lapsed
automatically.

➡️ **Suggestion: keep them separate.** A ward deciding whether to keep holding a bed needs to know
which happened — "they changed their mind" and "someone else took the patient" have different
consequences for that ward's next hour.

**Raised because:** you approved a recommendation to merge both labels while the reasoning for keeping
them apart was not in front of you, and then gave a blanket "go ahead with any recommendations."
**That is not a considered ruling on this substance, and the record should not pretend it was.**

---

## 15. Is "Suggested destination" the right label?

**The situation.** A badge reads "Suggested destination" whenever a coordinator picks a ward that has
not been recorded yet. It means _proposed, not yet recorded_ — the coordinator's own pick.

**But it reads as suggested _by the software_**, on a product whose other screens currently deny
suggesting anything.

➡️ **Suggestion: rename it — "Not yet recorded" or similar.** Smallest item on this list. It rides
with item 4 and needs no separate thought.

---

## 16. When does the access-block clock start?

Parked from an earlier session, with no recommendation attached and nobody having measured it.

➡️ **Suggestion: none — I do not know enough about how that clock is used in your service to have
one.** Flagging it only because it is recorded as open and would otherwise be lost.

---

## 17. When a case is reviewed after something goes wrong, how much of the review comes from the software's own record?

**Why you are being asked.** The design requires the software to record what a clinician was looking
at when they decided — on the argument that **"the patient who came to harm is reviewed from the
record, not from the screen."**

**The person who wrote that sentence has since withdrawn it** as something they asserted from argument
rather than knowledge. In a real review the record may be one source among several: the notes, the
people involved, the timeline.

➡️ **Suggestion: no recommendation — you are the only person on this project who has actually
reviewed a case.** How strong that requirement needs to be depends entirely on your answer, and the
requirement is currently sized by a guess.

---

## 18. When you look at this app, are you one ward, one service, or the whole state?

**And does that change what you see, or only what you are shown first?**

**Measured:** the app has a way to **change** role and no notion of **being** one. The sidebar shows
all 23 destinations to everyone. There is no "current ward" anywhere in the software. The phrases
"current ward", "current role" and "my ward" appear **zero times** across every design document.

**Three things you have already approved assume that state exists** — shared per-location logins,
showing someone just their own ward or team, and per-ward notifications. **None of the three is
buildable until it does.**

➡️ **Suggestion: no recommendation, and this is genuinely a question about who is using it rather
than about software.** A coordinator covering a whole service, a ward clerk on one ward, and a
registrar carrying patients across three sites need different answers, and **every screen inherits
whichever one gets built.** Building it before you have ruled would decide it by implementation.

**Deliberately not started**, even though it is the highest-value item left, because it touches every
screen while the ward model is being rewritten.

---

# PART THREE — NOT A QUESTION

## 19. This prototype contains real Western Australian data

**Not only invented data, which is what two screens have been telling clinicians.**

- **The catchment table is a transcription of real tables** — roughly 537 rows, real postcodes, real
  suburbs, real clinic names, with notes reconciling scanning discrepancies between five named source
  documents. It feeds community team names and patient suburb pairings.
- **One real ward name**, which you supplied on 2026-08-27, is rendered on the ward index. Its bed
  numbers are invented like every other figure.

⚠️ **Two screens said "every ward listed here is invented" and "nothing here has been checked against
a real record".** Both are being corrected to name the exceptions. **Neither correction softens the
not-a-medical-device statement, and both still say every number is invented.**

**No decision is being asked for.** It is here because it bears on anything anyone later says about
this prototype being synthetic, and because you may simply not know the catchment table is real
rather than a fixture.

---

# What is NOT on this list

⚠️ **The written record holds a larger backlog than these nineteen.** A sweep of 36 of the 201
documents in this area found dozens more parked questions, mostly from 1 and 2 September. **None of
the four live sessions mentioned any of them** — asking sessions what is outstanding returns what is
outstanding in their attention, and the backlog lives in files.

**They divide into three kinds:**

- **Wording nobody has approved** — a dozen or so draft sentences shipping behind explicit
  "placeholder" markers. These can wait.
- **Repository housekeeping** — who owns a test file, whether scratch files may be deleted. **Not
  yours, and should never have been on a list for you.** I have reclaimed them.
- **Real product questions parked and forgotten** — four were promoted to items 5–8 above. Roughly a
  dozen more are genuine but not blocking: whether a coordinator may see a patient's suburb, whether
  certain controls should stop pre-selecting an answer, whether the product says "journey" or
  "movement".

**Two gaps I am telling you rather than leaving out:** the sweep read 36 documents of 201 and did not
open the specification folder at all, **so there may be more**; and I have not personally opened the
documents behind items 5–8, so those four are relayed accurately but not verified the way the rest of
this list is.

**The honest summary: complete for what blocks work tonight, and a sample of what is parked.**
