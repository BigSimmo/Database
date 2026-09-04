# Owner rulings, 2026-09-02 — the eight outstanding items

**Given directly to Ward Builder Three, in one message, answering a numbered list.** Recorded
verbatim first, then read. ⚠️ **Where my reading goes beyond his words I say so — the words are the
ruling, my reading is not.**

## 1. A withdrawal record must NOT name the wards that refused

> _"No. If a referral is withdrawn it is marked as withdrawn, not rejected."_

**The answer is NO.** ⚠️ **And the second sentence is a separate correction worth more than the
first: the concept is WITHDRAWAL, not rejection.** A referral the referrer takes back was not
refused by anybody — **so a record that names wards at all has already mis-framed the event**, quite
apart from the privacy question.

**What this means for the defect** (`§4.11`, `ward-release-band-day-boundary`/`withdrawnReferrals`):
the free-text field that can carry ward names must not carry them, **and the vocabulary around
withdrawal must not imply refusal.** ⚠️ **My reading, flagged as mine:** the guard is not "strip
names from the reason" but "a withdrawal record has no place to put them". **Blocked — the field is
in the reducer, which Ward Builder Two holds.**

## 2. The refuted test is turned around

> _"Yes to your recommendation"_ — my recommendation was: keep the same patient and the same
> unsuitable ward, and have the test assert the placement is now refused unless a reason is recorded.

⚠️ **BUT WARD LEAD HAS CLAIMED THAT FILE** (`tests/ward-screen-eligibility-warning.dom.test.tsx`) and
ruled a subtly different shape: the warning stays information at the SCREEN level, and the reducer
refusal is pinned as a SEPARATE case rather than bending this test to carry both. **Those are
compatible — the owner ruled the outcome, Ward Lead ruled the file layout — but Ward Lead must know
the owner has now spoken on it.**

## 3. Add a count check on the community teams — but make it survive him changing the number

> _"Add a check to the number but also be aware that I am likely to change the number of teams soon
> so make sure the check will update when i do this"_

⚠️ **This forbids the obvious implementation.** A test asserting `65` breaks the moment he adds a
team, and whoever hits it will "fix" it by editing the number — which is a check that cannot fail,
in the exact sense this project has spent the day cataloguing.
**It must derive the expected count from the same source the page derives it from**, so the two move
together and the check still catches a silent collapse to 3. **One place per fact.**

## 4. Fix the scan whose displayed sentence is currently false

> _"Fix this"_ — the check that only recognises one import form, so a sentence on screen is untrue
> and nothing goes red. **Ward Builder One's finding 5.3, confirmed still live on current code.**

## 5. Fix the two contradictory comments

> _"Review and fix this go ahead with your recommendations"_

**Both corrected in the same change, each saying which was wrong and when it became wrong.** Ward
Lead's addition stands: **two comments lying in opposite directions is worse than one, because
whichever a reader finds first confirms them.**

## 6. He will look at the rendered board himself

> _"I will do this soon"_ — the one gap no chat can close. **Nobody should re-attempt a screenshot;
> the pane returns blank for that region on two chats' attempts.**

## 7. Dark mode is unchecked, and gets reviewed or listed

> _"Treat as unchecked and you review it or add to task list"_

**Mine.** The contrast fix is measured in both themes, but dark was simulated by setting a class
rather than using the app's own switch. **Until somebody exercises the real toggle, the dark figures
describe a state a user may never be in.**

## 8. Compile the full register of ~180 findings

> _"Go ahead with this please. MAke a list of all 180 and then i will determine later what ones are
> real"_

⚠️ **He is not asking for a triage. He is asking for the LIST, so he can decide.** So the register
must record, per finding: what it claims, who found it, **whether it was tested or only reasoned**,
and the tree it was measured on. **A register that hides which ten of the 180 were actually tested
would be worse than no register**, because it would present reasoning and measurement as the same
kind of thing.

---

## ⚠️ CORRECTION TO ITEM 4 — THE SENTENCE IS TRUE. THE OWNER RULED ON A CLAIM THAT WAS WRONG.

**I told him: "a sentence shown on screen is currently untrue, and no check notices." He said
"Fix this." THE ALARMING HALF OF THAT WAS FALSE and I flagged at the time that I had not read the
sentence myself.**

**Ward Builder One re-read its own finding and retracted it. I verified the retraction rather than
accepting it — a retraction needs the same evidence as an assertion:**

```
importers of ward-statistics across src/, all forms, both quote styles, dynamic import() included : 0
CONTROL, the identical question asked of ward-nav                                                 : 5
```

**The sentence, at `statistics-ward-screen.tsx:154`, reads: _"It has no consumer in the app — only
its own test…"_. NOTHING IMPORTS IT BY ANY ROUTE. THE SCREEN IS ACCURATE TODAY.**

### What actually survives, and it is worth doing

**The scan at `tests/ward-statistics-sections.test.ts:237` IS form-blind** — it matches only the
deep-path string, so **a future relative importer would appear and the scan would not notice**, and
the screen's sentence would silently become false. ⚠️ **That is a tripwire for a future edit, not a
false statement in front of a clinician today.**

**Honest framing for the owner: UNTIDY WITH A LATENT RISK, not a clinical problem.** He asked which
it was; it is the first.

### ⚠️ How the error was made, and it is the day's own shape

**Ward Builder One established that the relative import FORM is live in this codebase — true, and I
verified it. Then it treated _"this import style exists here"_ as _"this module is imported that
way."_** **A true observation carrying a false inference.**

⚠️ **AND MY OWN WARNING LANDED ON IT BEFORE EITHER OF US KNEW.** I wrote to it: _"he should not get
a fix to something that was never broken because I relayed a summary and he approved a summary."_
**That is exactly what happened, to that finding, in that message.** **The relay was one sentence
long and the owner ruled on one sentence.**

### If the fix is still wanted

**Widen the matcher to catch a relative specifier, and add a positive control so an empty result
cannot be mistaken for a clean one.** ⚠️ **Keep two things already in that test: its zero-match guard
(`expect(sources.length).toBeGreaterThan(100)`) and the comment recording that a literal `\b` in a
regex can become a backspace byte.** **Whoever widens it must not lose either.**

---

## Custody: Ward Verifier's rows travel through Ward Builder Three

⚠️ **RULE 12, ruled by Ward Lead after I flagged the hole: WARD VERIFIER CANNOT WRITE FILES.** It
authors no commits, holds a detached pin, and reads source with `git show`. **"Every chat writes its
own register file" would have excluded the one chat whose entire output is findings — and an absence
reads as nothing to contribute rather than as no pen.**

**So `docs/ward-flow/finding-register-ward-verifier.md` on this branch is the SINGLE custody point
for its rows. Ward Lead is deliberately NOT holding a copy** — two copies is worse than one, and
worst is the next person applying the one-place-per-fact rule, finding a duplicate, and deleting the
wrong side. **Its additions and corrections come to Ward Builder Three.**
