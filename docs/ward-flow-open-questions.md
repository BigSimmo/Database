# Ward Flow — every open question, with one recommendation each

**Current at 2026-08-30. Nothing here is blocking anybody** — every session has work in front of it,
and each answer improves what gets built rather than unlocking it.

> **One recommendation per question, never a menu.** Where the choice is genuinely yours and I have
> no basis to prefer one, that is said outright rather than dressed as advice.

---

## 1. What is the transport page called? — `HD-Q1`

**It has three names and a header cannot be built without one.**

```
the address        /transport
the page title     "Live tracker"
the file           live-tracker.tsx
```

✅ **ANSWERED: *Transport*.** Owner, 2026-08-30. **The route and the title now agree; the component
name is internal and cosmetic.** ⚠️ **The same check is still owed on every other route** — a header
stating a different name from the nav is two sources for one fact, one wrong, neither announcing it.

~~**Recommendation: whatever you would say asking somebody to open it.**~~ That is the test the design
session proposed and it is the right one — a header states the name a person uses, not the name the
code uses. ⚠️ **If it were mine I would say "Transport", because the page is a list of people who
still have to be moved, and only some of them have a vehicle yet.** *"Live tracker"* promises
tracking for everybody and the page itself says 35 of 43 have nothing to track.

**Same check is owed on every other route.** A header stating a different name from the navigation is
two sources for one fact, one wrong, neither announcing it.

## 2. Which facts travel with a referral, and to whom?

**Ten placeholder urgent-mark reasons exist at your request. Eight describe what the current SETTING
cannot do. Two describe the PERSON:** *currently secluded or restrained*, *repeated attempts to
leave*.

⚠️ **A reason for prioritising a bed is defensible. The same string recorded and displayed against a
named person on a screen many services can see is a disclosure.** **`FD-23` governs which SERVICE
sees a referral and says nothing about which FACTS travel with it.**

✅ **Nothing is disclosed today** — measured: those reasons are referenced by no screen, and no
ward-facing surface renders a name at all. **You are choosing what may be built, not repairing a leak.**

✅ **DISSOLVED RATHER THAN ANSWERED, 2026-08-30 — and dissolving it is a better outcome than a
ruling.** **The two reasons that describe the PERSON are being reworded to describe what the SETTING
cannot do**, like the other eight. ⚠️ **If every reason is about a ward's CAPABILITY, nothing
sensitive travels with the referral at all** — **so the coordinator and the wards see the same list,
with nothing hidden and nothing filtered, and there is no new rule to enforce.** **`FD-23` is
unchanged.**

~~**Recommendation: the coordinator sees the reason; a ward sees its CONSEQUENCE.**~~ *"Needs a level of
observation this ward would have to provide"* rather than the raw fact. **The shape already exists in
the product** — the parallel-referral badge tells a ward THAT a referral is parallel without naming
the other wards. ⚠️ **But which facts a ward needs in order to answer a referral safely is a clinical
judgement and it is yours, not mine.**

## 3. The ten urgent-mark reasons themselves

✅ **SHAPE APPROVED, WORDING STILL YOURS.** **Two of the ten are being reworded from patient-shaped
to setting-shaped.** ⚠️ **They REMAIN placeholders and still say so** — **the shape is your decision,
the words are a session's stand-in, and those two facts must not merge.**

~~**Recommendation: replace them when convenient; nothing waits on it.**~~ ⚠️ **A session inventing
clinical criteria for prioritising a psychiatric patient is the thing two standing refusals exist to
prevent, so these will not be improved by anybody here.**

## 4. Catchment: the suburb mapping, three oddities, five contradictions

**You gave the hospital list; the suburb-to-service mapping is still yours.** **Inside the 2015
document: `Bentley`/`Mills Street`, `Kwinana` on two rows, `Swan Valley` on two rows.** **Between
your two documents: Halls Head, Mandurah, Furnissdale, Birchmont, Calista.**

**Recommendation: leave all eight until you want real catchment behaviour.** **The screens work on
placeholders that say they are placeholders, and every disagreement is reported rather than silently
resolved in favour of the newer document.**

## 5. The real transport providers · 6. The real community teams

**Both are placeholder lists today, both derived from one exported array, both a single edit when you
have the real ones.** **Recommendation: no action. They are correct as placeholders and wrong only if
somebody reads them as real, which the screens prevent.**

## 7. A page refresh wipes a demonstration

⚠️ **If you refresh, or open a link in a new tab, everything done in that session resets to the
starting data.** **Mid-demonstration that looks like the app breaking.**

**Making the prototype remember was `D9-8`, and you cut it.** **The feature gap and the demonstration
risk are different objects, which is why this is here and not closed by the cut.**

**Recommendation: leave it cut, and simply do not refresh while showing it.** ⚠️ **If you expect to
show this to anyone who will drive it themselves, say so and it goes back in** — a stranger will
refresh.

## ✅ THREE RULINGS, ALL FIRST-HAND, 2026-08-30 — he asked for one recommendation each and took all three

**He asked for the questions, then for the recommendation alone on each, then said "Go ahead with
this".** ✅ **All three are HIS, given to the orchestrator directly, in that sequence.**

| Ruled | Goes to |
| --- | --- |
| ✅ **Hide the governance median below FIVE cases** | Ward Core — `ward-derivations.ts` |
| ✅ **Show urgency on EVERY ED card, next to the stage, spelled out in full** | Ward Referrals |
| ✅ **The ward screen is INSPECTED FIRST, by a chat that will not build it** | Ward Verifier looks; Ward Board waits for the list |

### ⚠️ WHAT EACH RULING DOES **NOT** SAY

**1. Five is a DISPLAY threshold, not a clinical one.** ⚠️ **It is a convention borrowed from health
reporting, and he was told so before he agreed** — **it is not derived from this data and it is not
a figure from anywhere else.** ✅ **One named constant, so replacing it is one edit.**

**2. "Every card" was the whole point of the recommendation, not a detail.** ⚠️ **If the tier only
appeared on urgent patients, ITS ABSENCE WOULD BECOME THE SIGNAL** — **and an absence is the one
thing this project has proved nobody reads.** **Same position on every card, next to the stage, so a
glance gets stage and priority together.** ⚠️ **It does NOT license changing the default, the
values, or the badge at `shortlist-panel.tsx:535`.**

**3. "Inspected first" means a FIRST look, and it must be recorded as a first look.** ⚠️ **The claim
that the ward page's sections are wrong currently has NO source** — **I had credited it to Ward
Verifier, which never assessed that screen.** ✅ **So this is not a second opinion confirming
anything; there is nothing to confirm.** ⚠️ **Whoever looks does not then build it** — **the
per-surface separation that sent the governance fix to Ward Core.**

### ✅ AND QUESTION 12 IS CLOSED IN BOTH PLACES

**He answered it in the orchestrator's chat.** ⚠️ **Ward Referrals also asked him in its own chat and
has no answer there** — **so the relay is labelled as a relay of a first-hand answer, and whether
that discharges its own question is ITS call, not mine.** ✅ **A coordinator carries the news; it
does not close somebody else's question.**

---

## 8. ⚠️ Closing old sessions — the only item here that is genuinely operational

**Around 48 chat sessions are resident. The machine has hit its memory limit tonight: it killed a
command mid-write and lost an edit silently, and it ended one session outright.**

✅ **DONE. 48 peer sessions earlier, 20 now, six of them live.** ⚠️ **Not proven solved — nobody
measured commit charge before or after, so this is much better odds rather than a fix.** **Every
session has been told to keep verifying the committed blob regardless, because that rule was never
about the machine.**

~~**Recommendation: close the ones you have finished with.**~~
⚠️ **This is the one thing on this list that cannot be done by anybody here being more careful.**
**The sessions holding standing memory are the best-fitting suspect, though nobody has measured
per-session cost, so it is a strong hypothesis rather than a proven cause.**

## 9. Does Ward Board stay paused?

**You told it *"Hold off for now"* mid-task. It stopped cleanly, holds five surfaces, and is not
working in them.** ⚠️ **It holds the ward page becoming the ward hub — the flow's last missing link,
and the only stopped item that is not polish.**

✅ **RESTARTED, 2026-08-30.** ⚠️ **It has been told to MERGE BEFORE TOUCHING ANYTHING** — two of its
five surfaces are behind and the model, the reducer and the derivations have all moved. **Its queue
is the ward hub first, because that is the flow's last missing link and the only outstanding item
that is not polish.**

~~**Recommendation: restart it when you are ready.**~~

## 11. ⚠️ Should a referral record when it arrived? — ONE missing fact, TWO visible problems

**A `Referral` has no arrival instant, and nothing links a referral to the patient's later movement.
So nothing can compute how long a referral has waited, and nothing can stop that clock when the
patient is admitted.**

**It shows up in two places, and both are currently HONEST about it:**

- **The ED hub says *"Not recorded"* on every row** rather than showing a number that would run
  forever and still look plausible.
- ⚠️ **The governance screen publishes *"Median time, referral to a ward accepting — 30 min, from 1
  of 27 recorded acceptances"*.** **26 of the 27 have no computable duration.**

> ✅ **ONE MISSING FACT WEARING THREE COSTUMES:** the governance median built on one case, the ED hub
> showing *"Not recorded"* on every row, and a model where nothing links a referral to the person or
> to what happens to them next. ⚠️ **Say yes to recording it and all three improve at once** — which
> turns this from a nice-to-have into the keystone.

**Recommendation: YES, record it.** **It is the highest-value answer on this whole list.**

⚠️ **AND A CORRECTION TO WHAT I TOLD YOU ABOUT THE MEDIAN, before you answer it.** I said the code
disagreed with its own written rule. **It does not.** **I quoted a fragment; the full sentence says a
thin sample *"must say so in the same breath as the figure"* and reserves *"say nothing rather than
guess"* for a median rendered BARE.** ✅ **The code discloses exactly as instructed.**

**So the real question is narrower and it invites a different answer:** *should a figure LABELLED
"Median" be printed at all from one observation, even with "from 1 of 27" beside it?* ⚠️ **That is a
fresh judgement, not the fixing of a contradiction — and *"your code disagrees with itself"* would
have got a yes from anybody.**

✅ **ANSWERED: suppress.** Owner, 2026-08-30: *"Go ahead with your recommendations."* **Below a stated
minimum the screen shows *"Not enough data to compute"*, which it already renders.** ⚠️ **The
disclosure rule is NOT overturned — `from {sampleSize} of {population}` stays beside every figure
that does render. He added a floor beneath it.** **Five is the orchestrator's number, not his.**

## 10. Three escalation questions — from a phase you cut

**Whether named escalation levels exist in WA · whether escalation is per site or statewide · what a
service actually relaxes when it escalates.**

**Recommendation: leave them. They belonged to cut work and nothing built depends on them.**
**Recorded so a later reader does not mistake their absence for an oversight.**

---

## ✅ Recently closed by you, so nobody re-asks

**No service-level patterns** *(refused, and recorded as a refusal rather than an omission)* ·
**the sending location always organises transport** · **cancel belongs to the booking team and the
coordinator** · **the referrer and the coordinator both see a decline reason** · **urgency is the
primary sort and a long wait never outranks a more urgent person** · **urgent needs a high
threshold** · **build the community hub** · **the away group keeps its patients as a line** ·
**the two-clinician review is closed for now.**

## 12. ✅ Where should urgency appear on an ED card, and on which cards? — a clinician's question

**The ED screen has NINE "Change urgency" buttons and displays nobody's urgency anywhere.** **A
clinician sets it from a picker showing a bare `1 2 3`, and can then change it — on a value the
screen never shows them, before or after.** ⚠️ **On the field you have just made outrank
everything else in the queue.**

**The label fix is already in hand and needs nothing from you.** **This is the separate question the
fix exposes, and it is yours because it is not a code question:**

- **Where on the card does it belong**, next to the stage and the clock that are already there?
- **Every card, or only some** — does a tier 3 patient need it shown as loudly as a tier 1?
- **Does it compete with what is already on the card** for the glance a busy clinician gives it?

✅ **Recommendation: answer it, rather than letting it be decided by whoever implements it.** ⚠️
**It was one sentence away from being settled inside a commit about wording, by nobody, because the
change is good and nothing would have stopped it.** **Two sessions caught that and held it back.**

**Nothing is blocked while you think about it — the labels land either way.**

> ⚠️ **ASKED TWICE, BY TWO SESSIONS, MINUTES APART** — **mine and Ward Referrals'.** ✅ **Answer
> it ONCE, wherever you see it.** **Neither of us is sending a third message about the duplication,
> because that would cost you more than the duplication did.** ⚠️ **A later reader should not read
> an unanswered copy as an open question.**
