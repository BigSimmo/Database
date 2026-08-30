# Building on deferred answers

**Owner's ruling, 2026-08-30:** _"Please defer these. Do your best for now to build what's there
knowing that it is liable to change and also ensuring any change is easy to do in the future."_

**Deferred, not abandoned. Every item below gets a provisional value, and every provisional value is
recorded AS provisional — never as a decision.**

## The distinction the whole document rests on

> **A chosen value and a provisional value look identical in code.** Both are a literal sitting in a
> field. **The difference is whether anybody can find it again.**

**Pick a value and move on, and it becomes indistinguishable from a decided one within a week** — the
next reader finds a plausible number, assumes somebody chose it, and builds on it. **That is how a
placeholder becomes a requirement.**

> **So the rule is not "write it flexibly". It is: one place per fact, and that place SAYS it is
> unresolved.**

## What "easy to change later" actually requires

**Four things, and none of them is "make it configurable".** Configuration spreads a fact across a
schema, a default, a loader and a call site — **the opposite of one place per fact, sold as
flexibility.**

**1. One place per fact.** The owner's existing rule, and it is the whole mechanism. A value in one
place changes in one edit. A value in seven places changes in six edits and one missed one.

**2. The provisional value names the open question WHERE IT LIVES.** Not in a document somebody has
to know to read. A reader who has never seen this file should learn it is unresolved from the thing
itself.

**3. A test that names the deferred decision.** When the answer arrives, the test tells you **every
place it lands** — which is worth more than the answer was. **Without it, "where does this change?"
is a search, and a search cannot prove it found everything.**

**4. Do not adopt a SHAPE that assumes the answer.** This is the one that costs a rebuild rather than
an edit.

> **Worked example: keying the catchment lookup on postcode.** Tempting — numeric, no spelling
> variants. **But ~42 suburbs have no postcode in any source, and only one of the five documents
> carries postcodes at all.** Keying on postcode does not merely need changing later; **it assumes a
> completeness the data does not have, and it fails silently for those 42.** Keying on suburb is the
> same amount of work and survives the answer either way.

## THE SHAPE RULE — how to catch a shape that assumes an answer

**Owner's instruction, 2026-08-30: a rule to avoid this error for data liable to change.** Written
from **four** instances in this project, not from theory.

### A shape error is an assumption about the data that the shape encodes and nothing states

**It is invisible because the code is not wrong.** It was right when written, about the data as it
was. **What changes is the data, and the shape does not announce that it depended on it.**

### The four questions. Ask all four before choosing a key, a comparison, or a container

**1. RANGE — what happens when this value goes past where it goes today?**

> `release.expectedAt <= MIDDAY_MINUTES` compares an **absolute instant** against **720, a time of
> day.** Correct while the demo lasted one day. **The moment the clock crossed midnight, every day-1
> release became `> 1320` and the entire band system collapsed to one value.**

**2. COMPLETENESS — does every record actually have this field?**

> Keying catchment on **postcode**: numeric, no spelling variants, obviously the better key. **But
> ~42 suburbs carry no postcode in any source, and only one of five documents has postcodes at all.**
> It does not merely need changing later — **it fails silently for those 42.**

**3. CARDINALITY — does this still work when there are a thousand rather than ten?**

> `HOME_REGIONS` holds **ten broad values**; the catchment documents hold roughly **a thousand
> suburbs.** Every Perth suburb is "Perth Metropolitan" while Armadale and Joondalup have different
> services. **The container could not hold the answer, and nothing failed to say so.**

### 4. IRREGULARITY — is this mess, or is this a fact I have no field for?

**The shape error arriving from the DATA side, and it had already been catalogued as untidiness.**

**The follow-up-clinic column holds five slash-hedged values** — `Peel /Rockingham` and four like it.
They were filed in the spelling-variants table beside `Midalnd` and `Florea!`.

> **They are not typos. They are SETS, written by somebody who had no field for a set.**

**A misspelling and a slash look equally irregular, and only one of them is telling you the model is
wrong.** So the clinic column is **set-valued too**, and those five rows are **the evidence rather
than the exception** — parse the slashes as multiple entries, **never normalise them to one.**

**And the general warning is worth more than the instance.** A variants list groups by _"looks
irregular"_, which mixes **spelling errors, sets and genuine exceptions** into one table:

| What it looks like         | What it is                    | Remedy               |
| -------------------------- | ----------------------------- | -------------------- |
| `Midalnd`                  | a typo                        | **correct it**       |
| `Peel /Rockingham`         | **a set with no field**       | **change the model** |
| `Kwinana` on 2 of 500 rows | **possibly a real exception** | **ask a clinician**  |

> **Only one of the three is a correction.** Re-read any "irregular values" list asking **"is this
> mess, or is this a fact I have no field for?"** — and do not assume the slashes are the only ones.

### The tell: a comparison between two numbers is a SHAPE CLAIM

**Name the units on both sides, out loud.** _"Minutes since day zero"_ and _"minutes into a day"_ are
both minutes and **are not the same quantity.**

> **This exact bug has now appeared FOUR times in this project.** It is the single most repeated
> defect here, and every instance passed the full test suite.

### The decision procedure, which removes the judgement in the common case

**The two shapes usually cost the SAME to write and differ by orders of magnitude to undo.** Postcode
and suburb keys are identical work. Day-relative and absolute comparisons are identical work.

> **So when the cost is equal, take the shape that survives growth — every time, without deliberating.**
> Judgement is spent on shape while a value is still open; **a value behind a named constant is still
> the wrong shape if the key is wrong.**

**A wrong value is an edit. A wrong shape is a rebuild.**

### And do not "fix" a shape problem with a value

**Adding a `"tomorrow"` band to a comparison that cannot survive a day boundary** adds a member to a
vocabulary whose arithmetic is broken. **The new member becomes the bucket for everything the
arithmetic mishandles** — and it looks like a decision.

> **When a fix is a new value and the defect is in the shape, the fix hides the defect.** Classify by
> day first, then by time of day, and _"tomorrow"_ **falls out of the model rather than being added
> to it.**

## The deferred items and what each gets meanwhile

| Deferred                                                   | Provisional treatment                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Which hospital admits from which area**                  | **Nothing derives it.** No source names admitting hospitals except the 2015 column, which is unverifiable. The coordinator chooses the destination, as today. **Do not build a derivation and switch it off** — that assumes the column is usable, which is the open question. **A decision hiding as dead code is still a decision.** |
| **Suburb vs region as the recorded fact**                  | **Build on the recommendation: suburb recorded, region derived.** He has not rejected it, and it is the shape that survives either answer.                                                                                                                                                                                             |
| **`Bentley`/`Mills Street`, `Kwinana`×2, `Swan Valley`×2** | **Keep the source value verbatim, flagged unreviewed. Never silently normalise** — a typo and a real exception are indistinguishable in the document, and normalising picks one without saying so.                                                                                                                                     |
| **The five contradicting suburbs**                         | **Both values kept, both attributed to their source.** Never resolved by recency.                                                                                                                                                                                                                                                      |
| **~42 suburbs with no postcode**                           | **Already answered by keying on suburb.** No fallback: _"no catchment for this suburb"_ is a visible outcome.                                                                                                                                                                                                                          |

## An honest display over dishonest behaviour is WORSE than either alone

**The sharpest edge in the whole ruling, found by the referrals session while speccing the render.**

A contested value — two documents disagreeing — renders as **both answers, each attributed to its
source and date.** Honest. **But if the lookup then quietly routes on the newer one:**

> **The display is honest and the behaviour is not** — and that combination is **more dangerous than
> a silently wrong value**, because the visible honesty invites trust in a decision made somewhere
> the reader cannot see.

**It would also break _"never resolved by recency"_ while appearing to honour it**, which is the
worst property a rule violation can have: **it passes its own inspection.**

**So the three review states differ in BEHAVIOUR, not only in rendering:**

| State                                                  | Renders                           | Routes?                                                                                                                   |
| ------------------------------------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `reviewed`                                             | the team name, plainly            | **yes**                                                                                                                   |
| `unreviewed` — the three internal 2015 inconsistencies | with **"not reviewed"** beside it | **yes** — one source, nothing contradicting, nothing corroborating; overridable with the existing out-of-catchment reason |
| `contested` — the five cross-document contradictions   | **both answers, attributed**      | **NO. The clinician chooses**, exactly like _no catchment found_                                                          |

> **The general form, and it is worth more than the instance: whenever a screen admits uncertainty,
> check that the CODE admits it too.** A marker on the display and a silent choice underneath is not
> a partial fix — **it is a worse failure than making no choice visible at all.**

## The seven placeholder hospitals (owner, 2026-08-30)

**His words: _"midland? Rockingham, RPH, SCGH, Joondalup, Mandurah, Fremantle hospital? Place these
hospitals as placeholders please."_**

**Recorded verbatim, as PLACEHOLDERS, which is what he called them:**

```
Midland      Rockingham      RPH      SCGH      Joondalup      Mandurah      Fremantle
```

**What this answers and what it does NOT.** It gives the **list of admitting sites**. It does **not**
give the **suburb-to-hospital mapping** — that question stays deferred, and **nothing derives a
hospital from a suburb.** The coordinator still chooses.

> **The distinction matters because a list of real hospitals looks like a catchment model.** Seven
> plausible names sitting in the data are one wiring step away from being routed to, and **nothing
> would fail if somebody wired them.**

**Two things nobody should invent, and both are recorded as unknown rather than filled in:**

**The full site names.** `Midland` is presumably St John of God Midland Public Hospital, `Mandurah`
presumably Peel Health Campus, `Joondalup` presumably Joondalup Health Campus. **Presumably is not a
source.** They stay as he wrote them until he says otherwise — **his own trailing question marks on
`midland?` and `Fremantle hospital?` are part of the record.**

**And Fiona Stanley is absent from this list, exactly as it is absent from the 2015 document.**

**CORRECTED, and the correction is one I had already written into my own charter and made anyway.**

I called these **two independent sources**. **They are not independent in the way that matters.**

> **Independent instruments agreeing is evidence. Instruments that can fail the SAME WAY agreeing is
> not.**

**His list is a recollection, not a reference** — he punctuated it with his own question marks. **A
person listing hospitals from memory and a document listing them in 2015 are both answering _"what
were the admitting sites around then"_.** A shared blind spot produces agreement that **looks exactly
like confirmation.**

**And there is a specific candidate for the shared cause** — flagged as the referrals session's
recollection and **NOT as a source: Fiona Stanley opened in 2014.** A catchment list dated November
2015 omitting a hospital that opened the previous year is **entirely consistent with the list never
having been revised** — which would mean FSH does admit and **both sources are stale for the same
reason.**

> **So the honest question is not _"two sources omit it — is that right?"_, which asks him to
> arbitrate between two records. It is _"both of these could be out of date for the same reason —
> does Fiona Stanley admit?"_** — which he answers from knowing.

**Everything else stands.** No session adds it. **No session assumes `Fremantle` covers what Fiona
Stanley would cover** — the same refusal as the two unlabelled metro blocks. His question marks stay
in the record.

### ANSWERED 2026-08-30 — and the answer is a SHAPE fact, not a data fact

**Owner: _"Yes to the FSH question. If the patient is within the FSH catchment they go to either
Fiona Stanley hospital psychiatric ward or Fremantle hospital psychiatric ward."_**

**Three things follow, and the second is the one that would have cost a rebuild.**

**1. The 2015 approved-hospital column is CONFIRMED STALE, not merely suspected.** It omits a hospital
that does admit. **So the shared-cause theory was right** — both absences trace to the same
out-of-date picture, and _"two sources agree"_ was never evidence.

**2. A catchment yields a SET of admitting wards, not one.** One catchment → **Fiona Stanley
psychiatric ward OR Fremantle psychiatric ward.**

> **This is the shape rule's CARDINALITY question, answered against us by the first real fact we
> received.** A `suburb → hospital` field would have been the obvious model, identical work to build,
> and **wrong at the first catchment anybody checked.** Not a wrong value — a wrong shape, and a
> rebuild.

**Nothing may model a catchment's destination as a single site.** Even where a catchment happens to
have one today, **the type must permit several**, because one example is sufficient to settle the
shape and we now have one.

**3. Fremantle Hospital still has a psychiatric ward.** Worth stating explicitly because it is easy to
assume otherwise — Fiona Stanley took over most acute services from Fremantle, and **the natural
inference is that Fremantle stopped admitting.** It did not. **This is precisely the inference the
refusal _"no session assumes `Fremantle` covers what Fiona Stanley would cover"_ was protecting
against — and it turns out the truth runs the other way: they are both live, and neither covers the
other.**

**The placeholder list gains Fiona Stanley and is now eight:**

```
Midland   Rockingham   RPH   SCGH   Joondalup   Mandurah   Fremantle   Fiona Stanley
```

**What is still deferred: WHICH suburbs are in which catchment.** He has given one catchment's
destinations, not the mapping. **Nothing derives a hospital from a suburb** — unchanged, and now on
firmer ground, since the only column that could have supplied it is confirmed stale.

### Two tables, not one — and the reason is structural

**The relationship is many-to-many, not a tree.** One admitting hospital serves suburbs that follow
up at several different clinics; one clinic receives from suburbs admitting to several different
hospitals. **Midland admits 104 suburbs and they do not share one clinic.**

**One table cannot hold that without duplicating rows or silently picking a primary.** Two tables
joined on the suburb row holds it exactly, and **it matches how the 2015 document carries them — two
columns on one row, which is a join rather than a hierarchy.**

**And the structure is what keeps the deferral honest.** Hospitals in their own table with no mapping
is **visibly a list of names.** Hospitals in the clinic table keyed by suburb is **one wiring step
from being routed to** — prevented by the shape rather than by a comment asking people not to.

> **Third instance of the same trap, and worth a note so the two are not treated as equally settled
> just because they now sit side by side: the 76 clinic strings are not 76 teams.** Seven hospital
> names and seventy-six clinic strings both look like reference data. **Only one of them has been
> reconciled.**

**Status: provisional, open id in the ledger, marked in the data itself.** When the mapping arrives,
these names are already there and only the mapping is new.

## A screen whose emptiness is UNFALSIFIABLE is worse than a screen that does not exist

**The build-order argument, and it is stronger than the parallelism one it replaces.**

A hub is an inbox and an outbox over **addressed** referrals. A referral has no destination field yet.

> **A hub built before that exists cannot be built wrong in an interesting way — it can only be built
> EMPTY. And an empty hub is indistinguishable from a working hub with nothing to show.** Somebody
> would build it, look at it, see nothing, and **have no way to tell whether that is correct.**

**This is the project's governing failure arriving in a user interface rather than a test:** an absent
signal reading exactly like a passing one. **The screen cannot fail**, so building it earlier does not
buy earlier feedback — **it buys a thing that looks finished.**

**So the destination union goes before the hubs for a reason better than scheduling.** Parallelism
says building them early is _faster_. This says building them early is **not building them at all**,
because nothing about the result would be checkable.

> **The general form: before building a surface, ask what it would look like if it were broken. If the
> answer is "the same", the surface is not ready to be built** — whatever its dependencies technically
> allow.

## The register is the point

**Every provisional value goes in the decision ledger with an open id.** So when he answers, the work
is: **open the ledger, find the id, change one place, watch the test that named it go green.**

> **If a provisional value cannot be found from the ledger, it is not provisional — it is a decision
> nobody made.**

## ⚠️ THE SAME EMPTY LIST MEANS TWO DIFFERENT THINGS — Ward Referrals, and it is the constructive half

**This document already carries: *a screen whose emptiness is unfalsifiable is worse than a screen
that does not exist.*** That rule says what to avoid. **It never said what to do instead.**

**Ward Decisions changed what the ED Psychiatry Hub's outbox IS**, and Ward Referrals saw why that is
not a relabelling:

> **"Patients we referred on" is a record of something done. "Patients we must still move" is a
> worklist with an obligation in it. An empty list of referrals-sent means nothing happened; an empty
> list of patients-to-move means THE DEPARTMENT IS CLEAR.**

⚠️ **Identical rows, identical emptiness, opposite meanings.** One empty screen is an absence of
evidence; the other is the best news in the building. **Different ordering, different urgency,
different emptiness.**

**THE RULE: before building a list, say which QUESTION its emptiness answers.** If empty means *"we do
not know"*, the screen must say so — that is the unfalsifiable case the existing rule forbids. **If
empty means *"there is nothing left to do"*, the screen should say THAT, because it is the most
valuable state the list can be in and it looks exactly like the failure.**

**And it generalises past emptiness: a list titled as a RECORD and a list titled as a WORKLIST are
different screens even when they hold the same rows.** A record is sorted by when; a worklist is
sorted by what is most overdue. **Naming a list is choosing which one it is, and it is usually done
by accident.**
