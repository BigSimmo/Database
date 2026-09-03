# THE OWNER HAS RULED: A REFERRAL REMEMBERS ITS PATIENT — 2026-09-02

⚠️ **HIS WORDS, GIVEN DIRECTLY TO WARD LEAD, NOT RELAYED: _"Yes to the referral remembering its
patient."_** Asked as the single open governance question, with the recommendation "yes, store the
link and add nothing else", and the price stated.

## 🔴 THIS IS A DELIBERATE CHANGE TO A REFUSAL, NOT A FEATURE

**`Referral`'s own doc comment holds its field set to a governed few and says, in the type's own
words, that it carries _"no name, date of birth, record number, address, diagnosis, or narrative
history"_. `tests/ward-referral-model.test.ts` enforces that structurally and names `patientId`
explicitly as a field its guard exists to catch.**

⚠️ **SO THE GUARD WAS RIGHT AND IT DID ITS JOB. It stopped an implementation decision from being
made by whoever got there first, and sent it to the person whose decision it was.** **Nothing about
this ruling makes the guard wrong; it makes ONE MEMBER of its list wrong, by his authority, on
2026-09-02.**

## WHAT THE RULING AUTHORISES — exactly one field

```
Referral.patientId?: PatientId        <- THIS, and nothing else
```

⚠️ **WHAT IT DOES NOT AUTHORISE, and this must not be stretched by anyone:**

- **NOT a name, date of birth, record number, address, diagnosis or narrative on a referral.** Those
  remain refused and the structural test must still fail on every one of them. **Adding one member
  is not relaxing the assertion.**
- **NOT a second identity home.** `Patient` (`ward-patients.ts`) stays the only place identity facts
  live — owner ruling `PD-1`. A referral holds a POINTER, not a copy.
- **NOT `address`, which remains UNRULED.** ⚠️ _"Silence is not permission"_ is already written into
  that file and this ruling does not disturb it.

**Optional, and deliberately so: a referral raised outside the patient flow legitimately has no
patient record behind it. A required field would force something to be invented.**

## 🔴 THE SECOND HALF, WITHOUT WHICH THE FIRST IS A LEAK

**`FD-23`, already an owner ruling and already quoted in `person-screen.tsx`: _a ward may not see
where else a patient has been referred; the coordinator may._**

⚠️ **A STORED LINK MAKES A PERSON'S REFERRAL HISTORY FINDABLE. That is the entire point of it and it
is also the exposure.** **Shipping the read without the role scoping would take a rule the code
currently honours BY BEING UNABLE TO BREAK IT and make it breakable, silently, on a screen that
already cites the rule as its reason for showing nothing.**

### ⚠️ AND THE ENFORCEMENT MECHANISM IS AN OPEN QUESTION, NOT A DETAIL

**`role` in this codebase is a BUILD-TIME TAG, not an identity** — established by refutation earlier
today (`WL-026`). Every screen hardcodes the literal matching its own identity; there is no picker,
no auth context, no role in the provider.

⚠️ **THE PERSON SCREEN HAS NO ROLE.** It is reached from patient search, which is in the rail on
every page, from any screen. **So "the coordinator may see this and a ward may not" has no mechanism
on that screen today, and inventing one is not a styling decision.**

**That question is the first thing to answer and it must be answered BEFORE the read is built, not
after.** **The write half — storing the link — carries no exposure on its own and can go first.**

## The order, and the reason it is this order

1. **`patientId` on `Referral` and on `RECEIVE_REFERRAL`.** The guard's list gains one member, with
   the ruling and its date recorded beside it. ⚠️ **The comment must say WHO ruled and WHEN, because
   the next person to read that list will otherwise see a field the guard's own prose forbids.**
2. **The Refer button carries the patient through to the intake form.** Write only. **No new read.**
3. ⚠️ **The `FD-23` mechanism — decided, then built.** Until then the person screen shows no referral
   history and its existing honest note stays.
4. **The person screen's copy changes LAST**, and only once 3 is real. **It currently says a referral
   started there is not attached to this person. That sentence becomes false at step 2 and must not
   be left standing** — but replacing it with one that promises a history the screen cannot yet show
   safely would be worse.

⚠️ **STEP 4 IS THE TRAP: the moment step 2 lands, a true sentence on a clinical screen becomes
false, and nothing will fail.**

---

## 🔴 CORRECTION TO THE ORDER ABOVE, MADE BEFORE ANYBODY BUILT TO IT

**I wrote step 4 — the person screen's copy — as LAST, after the read exists. That is wrong, and I
caught it while briefing the builder rather than by re-reading what I had written.**

⚠️ **THE SCREEN SAYS TODAY:** _"A referral started here is not yet attached to this person. This
prototype has no way to join the two, so the referral will carry only the facts you enter on it."_

⚠️ **THAT SENTENCE BECOMES FALSE AT STEP 2, THE MOMENT THE REFER BUTTON CARRIES A PATIENT — not at
step 4.** **It is a true, careful, deliberately honest sentence that quietly becomes a lie inside the
commit that makes it one, and nothing will fail.**

**So the copy changes in the SAME COMMIT as the write, and it says only what is then true: the
referral is recorded against this person, and this screen does not show their referral history.**
**Nothing promising a history — the read does not exist and is scoped away from this screen.**

**I named this exact trap two paragraphs earlier and then ordered the work so it would happen.**
⚠️ **Naming a hazard is not the same as sequencing around it, which is this project's own lesson
about registers arriving in the document that records a ruling.**

## RULED: the `FD-23` mechanism — the person screen NEVER shows referral history

**The coordinator sees it on a COORDINATOR screen.**

**`role` here is a build-time tag, not an identity (`WL-026`). The person screen has no role and is
reachable from the rail on every page, so _"the coordinator may and a ward may not"_ has no mechanism
there** — ⚠️ **and inventing one would mean inventing an auth model to satisfy a display decision.**

**A coordinator screen already carries the coordinator role by construction. Put the read where the
role already is, rather than teaching a role to a screen that has none.** **It also keeps the person
screen identity-only, which is exactly what `PD-1` scoped it to.**

## The adversarial read is assigned, and its reviewer set the terms before agreeing

**Ward Builder One, on the grounds that it is furthest from having built any of it.** ⚠️ **Its own
framing of what it will hunt: _"a widening that leaves the refusal list looking healthy while
removing the one member it was written for."_** **It will break the guard afterwards and confirm a
`dob` still goes red** — **because a refusal list nobody has tried to violate since it changed is a
list, not a guard.**
