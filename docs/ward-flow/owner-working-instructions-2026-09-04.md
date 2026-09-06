# Ward Flow — working instructions from the owner, 2026-09-04

**Provenance, stated precisely because this document will be cited.** These are the Ward Verifier's
recommendations, put to the owner on 2026-09-04, **endorsed by him, and distributed at his
instruction.** They are working instructions about **how the work is organised**.

⚠️ **THIS DOCUMENT DECIDES NONE OF THE FOUR CLINICAL OR PRODUCT QUESTIONS BELOW.** It says only
which questions are his and which are not. **Anyone citing it as an owner ruling on the substance of
a banner, a bed figure, or sex-versus-gender is misciting it.**

---

## 1. STOP BUNDLING REPAIRS WITH DECISIONS. FIX THE REPAIRS NOW.

**The owner's queue currently looks about twice as long as it is**, because sentences that are simply
untrue are travelling alongside questions that genuinely need him.

### These four are his. Nothing else on this page is.

| question                                                                         | where it already lives                             |
| -------------------------------------------------------------------------------- | -------------------------------------------------- |
| What the three banners should say now that suggesting is permitted               | `owner-decision-pending-device-copy-2026-09-04.md` |
| What he meant by "encode no rule" on sex versus gender identity                  | rec 8; and §5 lists the clinical half still open   |
| What a bed figure means (blocks the cluster header and the bed vocabulary)       | Ward Lead's cluster/vocabulary items               |
| Whether a human's own unrecorded pick should be labelled "Suggested destination" | `ward-management-modes.tsx:231`                    |

### These need no ruling. They are wrong. Fix them and do not queue them.

Each was measured at `fffda3266` unless stated — **see §4 on staleness before touching any line
number.**

- **`referrals/referral-intake.tsx:868`** — "records **only** the five permitted facts … plus the
  request itself". Every denial in it still holds; the form also writes `patientId` (`:830`), added
  by the owner's 2026-09-02 ruling. **The enumeration is stale by one field.**
- **`officer/officer-screen.tsx:224`** — "shows **every** transport job not yet arrived", against a
  filter at `:195` that also excludes closed movements. **A not-yet-arrived job on a closed movement
  vanishes with no explanation.**
- **`search/patient-search.tsx:99-102`** — enumerates people and open movements; **also renders
  referrals as their own list, first on the page.** The omitted category is the one the screen
  deliberately prioritises. _(Ward Builder Three.)_
- **`ward-management-modes.tsx:395`** — the column headed **"Top candidate"**, filled at `:400` by
  `eligibleCandidatesAmong(patient, units, now, 1)[0]`. At `limit = 1` the ranking pass runs after
  `.slice` and is a no-op, so the ward shown is **the first eligible ward in seed order**. It prints
  a superlative for a comparison that did not happen. _(Ward Builder One.)_
- **`tests/ward-person-screen.dom.test.tsx:76-81`** — the age assertion **cannot fail**. It computes
  the expected age, discards it, and checks the render against `/\d+\s*(years|year)/i`.
  Mutation-proved: `return age` → `return 999`, hash moved, a sibling test went red on "expected 999
  to be 36" while this one stayed green on **"999 years"**. **Fix this before anything touches
  `dayZero`** — until it can fail, a later clock repair has nothing to prove it worked.
- **Cosmetic, three clinician-facing screens:** "it never adds **a expected**" —
  `discharge-board:152`, `morning-page:261`, `ward-management-modes:512`.

**Already fixed, listed so nobody re-queues them:** the statistics ward-count sentence
(`a4c18c36d`); both `AI best-fit review` aria-labels (`394e6309e`); and the `Sparkles` icons and
`aiBadge` class name (`9f26975c2` — four icons to `ListChecks`, `.aiBadge` renamed `.reviewBadge`).

⚠️ **One of those carries a caveat that must travel with it.** The Sparkles removal was made on the
Verifier's argument that _"Sparkles is the 2026 convention for a machine generated this"_. **That is
a claim about what clinicians have been trained to read, and nobody measured it.** It was offered as
judgement and accepted as judgement, and the commit says so. **If it is ever challenged, there is no
evidence behind it beyond the convention itself.** Recorded because a judgement that produced a code
change reads, six months later, exactly like a measurement that did.

---

## 2. A SENTENCE ON A SCREEN IS PART OF THE CHANGE THAT MAKES IT FALSE

**Every failure found on 2026-09-04 had one cause.** Somebody changed what the software records,
filters or ranks; the code comments were updated; **the sentence a clinician reads was not.** In the
`spec D4` case the correction had a defined scope, was executed faithfully, and the scope said
"comments only".

**Nothing went red, because not one of those governance sentences has a test behind it.** Numbers in
this project are checked. Promises are not.

**The rule, and it is a rule rather than a system:** when you change what the software records,
filters, ranks or lists, **the sentence describing it is inside that diff.** Search for the claim
before you close the task.

⚠️ **The existing retirement template covers withdrawals only, and that is too narrow** — the
`referral-intake` and `patient-search` failures were **additions**, not withdrawals, and neither
would have been caught by it. **Widen it to any change to what the software records, filters, ranks
or lists.**

**Four chats hit this independently in one night**, from four different directions — a governance
paragraph, a test, a safeguard, and a duplicated origin-department sentence. **It is one thing this
project does, not four defects.**

### And there is a second thing outside the definition of "the code"

🔴 **The rendered page is outside the definition of "the code" — and so, apparently, is the commit
message.**

**Twice on 2026-09-04 the only surviving record of a decision was a comment inside a test.** Once
when a ruling on the discharge board was made twice and was wrong both times, and was caught only
because a test carried its author's reasoning; once earlier the same night on a different question.
**Both times a commit message existed and neither time did anyone find it.**

**Nobody greps history for a rule they do not know exists.** A decision recorded only in a commit
message is a decision the next person will re-make from scratch — and re-make differently, because
they will not know a reason was ever given.

**So: when a decision constrains what somebody may build later, it goes where they will be standing —
in the test that enforces it, or in a comment at the site it constrains.** The commit message is the
record of the change, not the record of the decision.

---

## 3. A LIST THAT GOES TO THE OWNER IS DERIVED FROM THE SCREENS, NEVER ASSEMBLED BY HAND

⚠️ **This recommendation is made by somebody who broke it the same day, which is the reason it is
here.** The Verifier claimed a sentence had fallen out of the owner's escalation list, having read
another document's **description** of that list instead of opening the list. It was row one.
Retracted at `b12122c06`.

**Ward Lead had been caught by the neighbouring version of it**: the escalated list was corrected
once for containing the **wrong member**, and that felt like an audit — **but nobody had asked
whether three was the right LENGTH.** Two different checks; only one had been run.

**They then derived it** (`bbc09d536`): every rendered denial of ranking, suggesting or allocating
across `src/components/ward-management` returns exactly three. **The answer was already right. What
changed is that it is now checkable.**

**So: before any list reaches the owner, produce it from the code, and put the command that produced
it in the document beside it.** It costs one command. **A list that cannot be re-derived is a claim,
not an inventory.**

---

## 4. EVERY LINE NUMBER ON THIS PAGE MAY ALREADY BE STALE

Measurements here were taken at **`fffda3266`**. The line has since moved on by roughly twenty
commits. **The Verifier reported a fixed defect as live from exactly this cause, hours after writing
the rule that unlabelled numbers expire.**

**Re-anchor before acting on any specific line.** Cite the sentence, never only the line number — a
governance statement in this project has already moved ninety-seven lines within an hour while two
people were discussing it.

---

## 5. WHAT NOT TO DO

**Do not reopen the regulatory question yet.** The owner's recorded position stands: it needs
answering **before this reaches a real patient, not before it is prototyped.**

⚠️ **But it now has a fact attached that it did not have this morning.** The answer cannot be "the
software does not rank wards for a patient" — **it does.** `eligibleCandidatesAmong`
(`ward-derivations.ts:696`) orders units by fit to the patient and feeds four surfaces. **Whoever
eventually answers the classification question must answer it about software that already ranks.**

**Do not repair `dayZero`.** Nothing currently depends on a calendar date derived from it, a fix
requires inventing a pinned date that does not exist, and the blast radius is every date-rendering
surface. **Record it; fix the age assertion in §1 first.**

---

## THE ONE FINDING THAT SHOULD NOT BE READ AS PROCESS

`ed/ed-screen.tsx:613` decides `isCommunityFormed` by comparing `movement.formedAt <
movement.openedAt`. The owner has ruled that a journey may begin at a community team, which makes
`openedAt` a referral instant rather than an arrival one.

**Every other consequence of that change inflates a duration. This one flips a category on a
statutory surface** — a hospital-formed patient would be shown as community-formed, and the legal
clock label would switch to match.

⚠️ **And no test would catch it.** The only test pinning `openedAt` asserts internal
self-consistency, which survives the redefinition; the other ~80 occurrences operate on synthetic
numbers. **A duration that drifts is visible to a clinician who knows the patient. A wrong legal
category is not.**
