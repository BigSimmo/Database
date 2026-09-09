# The three hubs, the patient screen, and the universal referral

> ⚠️ **ITS LIST IS SUPERSEDED. ITS REASONING IS NOT.**
>
> **The single list of outstanding work is `docs/ward-flow-task-ledger.md`** — on
> `claude/Wardquestions`, so from another branch:
> `git show claude/Wardquestions:docs/ward-flow-task-ledger.md`
>
> **Read THIS file for WHY a thing is the way it is.** ⚠️ **Do not take a task, a state or a count
> from it** — three documents carrying task state means fixing one leaves two wrong, **and that is
> exactly what happened: a heading here said three owner rulings were approved and unbuilt for hours
> after all three had landed, because the same claim was corrected in the ledger and not here.**
>
> **The changeable-data rule is one place per fact. This banner is the correction, and it sits at the
> top because the reader who would be misled ARRIVES here rather than going looking for a list of
> superseded documents.**

---

**Owner direction, 2026-08-30.** Prioritise: the **ED, ward and community hubs**; a **universal
referral button on a patient** opening a **universal referral screen**; and the **individual patient
screen and search**.

**Measured at `20a3e29e3` before planning.** Two findings force the order, and neither is visible
from the outside.

---

## 1. The two findings that decide the sequence

### A "patient" does not survive arrival, so a patient screen cannot be about a patient

**`patients/[patientId]` exists and renders `WardPatientWorkspace` — whose own title is _"Patient
movement workspace"_.** It is a screen about a **movement**, not a person.

**And `isOpen` excludes arrived movements**, gating ten surfaces. So:

> **Today a patient IS a movement, and movements end at arrival.** A patient screen built now would
> be a movement screen with a patient's name on it, and it would go blank the moment the person
> reaches a ward.

**Consequence: the patient screen and the search both depend on Task 17.** Not for convenience — a
person who does not outlive their movement has nothing for a patient screen to show.

### Search finds movements, not patients — and the owner's own requirement needs the second

**`search/patient-search.tsx` calls `searchMovements` with a `MovementSearchQuery`.** It cannot find
a `Referral`, and it cannot find an admitted patient.

**His requirement was explicit:** _"when I search that patient, there should be some way of the ED
psych to see the patient show up."_

> **That cannot work today, twice over: the referral is not searchable, and the arrived patient is
> excluded.** The name `patient-search` promises what the thing does not do — the same shape as every
> other finding this week.

---

## 2. The change that makes the referral form simple

**A referral button ON a patient inverts the form**, and it resolves the twenty-fields-versus-
frictionless tension almost entirely.

| Today: a form about a stranger     | With the button: a form about a known person                |
| ---------------------------------- | ----------------------------------------------------------- |
| asks age band, sex, home region    | **inherited** — and home region becomes DERIVED from suburb |
| asks legal status, forms           | **inherited**                                               |
| asks alerts, guardian, CMHT status | **inherited, editable**                                     |
| asks where they are now            | **known**                                                   |
| asks what the bed must provide     | **still asked**                                             |
| asks destination and urgency       | **still asked**                                             |
| asks the story                     | **still asked**                                             |

**So the universal referral screen asks four things, not twenty: where are they going, how urgent,
what must the bed provide, and what is the story.** Everything about the person is shown for
confirmation rather than typed.

**And it makes the standing rule enforceable rather than aspirational:** _nothing is answered for the
clinician_ is easy when the form asks four questions, and was always going to erode at twenty.

---

## 3. What a hub actually is, now that all three are peers

**Owner: community hubs are "the same as the previous two but for community teams." Three kinds, one
shape.**

**A hub is two lists over addressed referrals, plus the place's own patients:**

```
INBOX    referrals addressed TO this place, not yet acted on
OUTBOX   referrals this place has raised, and where they got to
HERE     the people currently at this place
```

**The ED hub has a third list the others do not**, and it is a different kind of thing:

> **Patients in this ED awaiting psychiatric review** — referred by ED medical staff. **A request for
> a person's time, not for a bed.**

**Keep that distinction in the type.** A bed request and a review request answered by the same
affordance is how one silently becomes the other.

**None of these lists can exist until a referral carries a destination**, because an inbox is a
filter on an addressee and there is no addressee.

---

## 3b. Four owner answers that changed this plan after it was written

### Catchment is by SUBURB, and that changes the model rather than filling a gap

**He supplied five documents.** The statewide one maps **postcode → suburb → approved hospital →
follow-up clinic**, twelve pages, dated 2015; a South Metropolitan one dated 2023; three metropolitan
sources.

**The model carries ten broad `HOME_REGIONS`. The documents carry roughly a thousand suburbs.**

> **Every Perth suburb is "Perth Metropolitan" — while Armadale and Joondalup are opposite ends of
> the city with different services. Region cannot produce the answer these documents contain.**

**So: a referral carries the patient's SUBURB or POSTCODE, and region becomes DERIVED.** Not an extra
field — **a correction to which fact is primary.**

**And it changes step 2 more than it looks.** A destination is not only _what kind of place_; **for a
ward it is largely DERIVABLE** — postcode gives the approved hospital. **The referrer chooses the
kind and the system knows the place**, which is a different design from a free choice of destination.

**The "follow up clinic" column IS the community team list**, in his own service's words: Armadale,
Bentley, Midland, Inner City, Joondalup, Clarkson, Lower West, Fremantle, Rockingham Kwinana, Peel,
Mirrabooka, and the country services. **So the ten invented placeholders in `ward-teams.ts` are
replaceable with real names** — and the shape question is answered by the data: **Perth has many, one
per region was wrong.**

**Whether community hubs get BUILT stays parked.** The names existing is not the same as the build
being unparked, and it is not being unparked on that basis.

**His note travels with the data: liable to change later.** The 2015 and 2023 documents disagree in
places; **every disagreement is being reported rather than silently resolved in favour of the newer
one.**

### `FD-16` — nothing flows from ED medical into the system, and that REMOVES machinery

> _"Psychiatry receive a verbal referral from medical ED staff and physical search the patient and
> add a new referral to themselves."_

**The request is verbal and deliberately outside the software.** Psychiatry search, find or add the
patient, and create a referral **addressed to their own team.**

**So the ED hub's third list is a list of SELF-ADDRESSED referrals.** No inbound feed, no placement
event, no curation step. **All three of the readings we had — including mine and the referrals
session's — were wrong, and the answer is simpler than any of them.**

> **Record the reason with the rule: the verbal step is deliberately outside the system.** Somebody
> will later propose letting ED medical raise referrals directly as an obvious improvement. **It is
> not an oversight — psychiatry own what enters the record.**

### Ward → ED medical: the bed is freed only past 48 hours, and that is overridable

**Otherwise the person shows as ON OVERNIGHT LEAVE and the bed stays theirs.** A recommendation that
it should never free the bed was **overruled by him, correctly** — the 48-hour line is clinical
knowledge, and it is his.

### Who judges the 48 hours — deferred WITH the answer already named

**The consultation-liaison psychiatry team** — _"for now just leave it as the coordinator and mark to
clarify this later."_

> **An unusual shape worth preserving exactly: he has told us the right answer AND told us not to
> build it yet.** A later reader finding only "coordinator" will think it settled. **It is not.**

---

## 4. The order, and why each step cannot move

### Step 1 — A patient survives arrival _(Task 17, assigned)_

Admit and discharge. **`admission` appears 0 times in the reducer today.** Everything below is
blocked on this, and it is blocked on nothing.

### Step 2 — A destination that knows what KIND of place it is

**A tagged union, not `referredUnitIds` widened.** The evidence points there twice from different
directions: **a referral addressed to a team inside a department** (ED psychiatry, not "an ED"), and
**a community team as a peer of a ward rather than a special case.**

**A unit id cannot express either.** This is the piece the whole hub model rests on.

### Step 3 — The patient record becomes about a person

**One record that spans referral, movement and admission**, so a person does not vanish at each
seam. **The patient screen then has a subject.**

### Step 4 — Search finds people, not movements

Across referrals, movements and admissions. **This is what makes his ED requirement work** — the
receiving clinician searches and the patient appears with the referral attached.

### Step 5 — The universal referral screen, opened from a patient

**Four questions, identity inherited and shown for confirmation.** One component, reached from a
button on any patient, anywhere.

### Step 6 — The three hubs

**Inbox and outbox over addressed referrals, plus the place's own people.** ED gains its
awaiting-review list. **Once steps 2 and 5 exist, a hub is a filter and a layout** — which is why it
is last rather than first, despite being the thing asked for.

---

## 5. What runs in parallel

| Together                                                                                             | Serial                                      |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Step 2 (destination) alongside Step 1 (admissions) — **different files, agree at the reducer first** | 1 before 3 — no person, no patient screen   |
| The three hubs, once step 5 lands — **one shape, three instances**                                   | 2 before 6 — no addressee, no inbox         |
| The override-reason fix, now, ahead of everything                                                    | 3 before 4 — search needs something to find |

**The override-reason fix goes first and is small:** the coordinator's reason is collected, validated
and discarded while the governance screen says it is recorded. **The owner has asked for two more
reasons of the same shape; they must not inherit the pattern.**

---

## 6. What this plan deliberately does not do

**It does not build a hub first**, despite hubs being what was asked for. **A hub over an
unaddressed referral is a page with an empty list and no way to fill it** — and it would look
finished.

**It does not build the patient screen before Task 17.** That screen would go blank exactly when a
patient reaches a ward, which is the moment the demonstration exists to show.

**And it does not widen `referredUnitIds`.** That is the cheap version of step 2 and it cannot
express a team inside a department or a community team as a peer — so it would be discovered as
wrong at the third hub, after two were built on it.
