# For the owner: what this software tells a clinician it does

**Status:** awaiting an owner ruling. **The named files are frozen meanwhile.**
**Type:** clinical governance, not wording. This is why it is not being fixed by a builder.

**This is ONE decision, not six.** It began as three banners carrying a withdrawn rule. It has grown,
by measurement, into a single question — what does this product tell a clinician it does, and is that
true of the product rather than of one screen. Ruling on the banners alone would settle half of it.

**One thing has already been fixed rather than brought to you**, and the reasoning is in §"the AI
best-fit panel" below: two accessible names announced an **"AI"** review of software that contains no
model and no inference. That was false under every possible ruling, so it was not a decision. Nothing
else has been touched.

---

## What the screens say

Three surfaces tell a clinician the board **never** does something, in the same paragraph as
**"not a medical device"**:

| File                                    | The sentence                                                                                                               |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `escalation/escalation-board.tsx:48-52` | _"It **never** ranks a ward the patient does not fit, and it **never** states what would need to change for one to work."_ |
| `referrals/referral-board.tsx:267`      | _"It **never** allocates, never ranks units by suitability, and never suggests which bed is best."_                        |
| `referrals/referral-match.tsx:330`      | _"this view **never** ranks units by suitability and **never** suggests which bed is best."_                               |

⚠️ **THE THIRD ROW WAS WRONG UNTIL NOW AND IT NAMED THE WRONG FILE.** It said
`ward-management-modes.tsx` — the shared `NotAMedicalDeviceStatement`, rendered on two screens.
Caught by Ward Builder Two, verified by reading it: that statement says _"It orders operational
placement work only — it never assesses a patient's risk, acuity or treatment. A human coordinator
confirms or overrides every suggestion."_ **It does not mention ranking or suggesting a bed at all**,
its risk/acuity/treatment denial was independently confirmed accurate, and its second sentence
presupposes suggestions rather than denying them — so it survives everything decided today and needs
no change.

**Three sentences were escalated; only two of the original three were the right ones.** The real
third is `referral-match.tsx:330`, which repeats the denial on the screen where the accept decision
is actually taken — deliberately, per its own comment, because a coordinator deciding there has
scrolled past the board's banner.

### Three is the whole list, and here is how that was established rather than assumed

⚠️ **A list can be corrected for the wrong MEMBER and never checked for the wrong LENGTH.** This one
was corrected once — the third row named the wrong file — and that fixed a member without asking
whether three was the right number. Those are two different checks and only the first had been run.

**Derived, not collected.** Every rendered denial of ranking, suggesting or allocating across all of
`src/components/ward-management/**`:

    escalation-board.tsx:50      "It never ranks a ward…"
    referral-board.tsx:267-268   "never allocates, never ranks…, never suggests which bed is best"
    referral-match.tsx:331       "never ranks units by suitability and never suggests which bed is best"

**Three matches, and they are the three rows above.** The only other hit in the tree is a source
comment pointing at this document.

**This is deliberately a narrower question than "which screens make universal claims".** Nine screens
do that; six of the nine deny things the software genuinely does not do — assessing risk, acuity or
treatment; changing an urgency tier; storing free text — and those were checked and came back
accurate. **These three are the ones `R-2026-09-04-G` falsified**, which is why they and only they
need your ruling.

## Why that is now a problem

**Ruling `R-2026-09-04-G` (2026-09-04) withdrew the rule these sentences state.** The board is to
start making suggestions. The withdrawal's scope was defined as _"every comment in this area"_, was
executed faithfully — four source files corrected — and **the scope was wrong: comments only.** The
rendered copy was never looked at.

**So when matching ships, these three sentences become false, and nothing goes red.** Measured:

    the escalation banner's content asserted by any test        0
    "never ranks a ward" asserted anywhere but the component     0

## The part that makes it yours rather than a builder's

⚠️ **The sentence does not merely mention the device status and the behaviour. It offers the second
as support for the first.** A reader takes _"not a medical device, … it never ranks"_ as one claim,
and the claim is about regulatory status. Changing the wording changes what the software is telling
a clinician about what it is.

**The related regulatory question is already recorded and is not this one.** The TGA/SaMD
classification box was left unticked on PR #2597, and the ruling sets the timing: it needs answering
**before this ships to anyone, not before it is prototyped**. That decision stands. This is the
narrower, live question of what the shipped screens say **today**.

## The population, so the boundary is visible

Every rendered "not a medical device" claim, all 15 opened and read:

    9   a universal about the software's own behaviour   ← the class this decision is about
    5   a claim that the DATA is invented                ← the honest template
    1   a bare badge with no supporting clause           (ward-board)

⚠️ **THE FIRST FIGURE HERE WAS WRONG UNTIL A FEW MINUTES AGO AND IT REACHED THIS DOCUMENT.** It was
first measured as 12 checkable / 3 universal. The corrected count is above. The error was not
arithmetic: the counter was looking for the escalated _shape_ — universals about ranking and
suggesting — and classified everything else as "supported by a checkable fact" without re-reading it
against the general property. So the question answered was "how many say what escalation-board says",
and the answer was reported as "how many make a universal claim". **The measurement was real; the
sentence wrapped around it was wider than the thing measured.** Corrected by opening all 15.

**One boundary, named rather than buried:** eight of the nine use the word "never". `add-patient`
says _"records **only** the four identity facts … and links them to **nothing**"_ — the identical
universal in different words. It is counted in. On a strict never-only reading the split is 8 / 6 / 1.

**The five data-is-invented claims are the template.** A checkable fact is verifiable and expires
honestly; a promise about software that has not been written cannot be either.

### What the corrected count changes, and what it does not

**The three with you are not the population.** They are the three that deny **ranking and suggesting**
specifically — the thing `R-2026-09-04-G` withdrew. **Six further screens make universal promises of
the same grammatical kind** (handover, patient-search, discharge-board, morning, referral-intake,
add-patient), and until tonight nobody had checked any of them against the code.

**This is not six more defects.** The first one checked came back **accurate**: _"never assesses a
patient's risk, acuity or treatment"_ holds, because `operationalScore` consumes waiting time,
statutory deadline state and blocker state only — all operational, none clinical. The remaining five
are unchecked rather than suspect, and are being swept now.

## 🔴 The largest thing in this document, and it is not a wording question

**Three screens tell a clinician the software _"never ranks units by suitability"_** —
`escalation-board:50`, `referral-board:267`, `referral-match:331`.

**Each is true of its own screen.** Measured: those three screens' code paths use a plain `.map` with
no sort at all.

**And the product ranks by suitability elsewhere.** `eligibleCandidatesAmong`
(`ward-derivations.ts:696-723`) orders its shortlist so that a ward flagged as **tighter than this
patient needs** is placed below one that matches. Its own comment says such a ward _"should not be
the one a coordinator is steered toward first"_. That is ranking by fit to a patient, in as many
words, and it feeds the coordinator shortlist panel, the flow diagram, the network view and the
decision panel.

**So the denials are true per screen and false product-wide.** A clinician who reads three screens
saying the software never ranks by suitability forms a belief about the product. The product ranks by
suitability on a fourth screen.

⚠️ **This is exactly the distinction the TGA/SaMD question turns on: a regulator asks about the
product, not about one board.** So you are not only choosing a wording here. You are being told, for
the first time, that the thing three banners deny is something the software already does somewhere
else.

**I have not changed any of the three.** The honest per-screen sentence and the honest product-wide
sentence are different sentences, and which one a governance banner should carry is your call.

## And two sentences that cannot both be precise

On the same screen as the frozen device statement, `ward-management-modes.tsx:1022` renders,
unfrozen: _"An authorised user confirms or overrides every destination."_

**That presupposes the software proposes something.** The banners say it suggests nothing. Both are
currently in different buckets — one frozen, one not — and putting them to you separately would have
had you rule on half of a thing. They belong in one decision.

## What is being recommended, so you have something to say yes or no to

**Change the three from a promise about the future to a statement about today** — the same
distinction the ruling itself demands of every comment in this area:

    DESCRIPTION   "this board does not rank wards"      true today, fine to write
    INSTRUCTION   "this board must never rank wards"    withdrawn, must not be written

The ruling gives the reason: _"A future reader must be able to tell 'nobody has built this yet' from
'you are forbidden to build this'."_ A clinician needs the same distinction, for a different reason
— one of those two sentences will still be true after matching ships.

**Options, briefly, because this is your call and not mine:**

1. **Reword all three to the present tense.** Recommended. Honest today, honest after matching
   ships, and it keeps the device statement supported by something checkable.
2. **Remove the behavioural clause and keep only the checkable facts**, matching the five
   data-is-invented screens. Safest, and loses information a clinician may actually want.
3. **Leave them until matching ships.** Defensible only if nothing ships to a clinician first; the
   risk is that the sentence is forgotten precisely because it currently reads as true.

**Whichever you choose, the sentence should be pinned by a test.** All three are asserted by nothing
today, which is why the withdrawal could miss them.

---

## 🔴 And one that is live rather than stale — the product already has an "AI best-fit review" panel

Everything above is a **withdrawn** rule surviving in the wrong tense. **This one is different: no
ruling retired either sentence, and both are shipped today.**

**Verified by reading both files, not relayed.** `ward-management-modes.tsx:227` renders, as the
accessible name of the decision panel — so a clinician using a screen reader hears it spoken:

    aria-label={`AI best-fit review for ${patient.id}`}

with a badge at `:231` reading **"Suggested destination"** whenever the selected ward is one the
shortlist computed rather than one a person recorded.

**And `referral-board.tsx:266-268` tells a clinician:** _"This board is **not a medical device**. It
never allocates, never ranks units by suitability, and **never suggests which bed is best**."_

**Each is defensible where it stands** — _"this board"_ scopes the banner to the referral board, and
the two are different screens. **Together they are not.** A clinician moving between two surfaces of
one product meets "never suggests which bed is best" and "AI best-fit review" in the same prototype.

### FIXED, not brought to you — and here is exactly what was changed and why

**One word of that label was false under every possible ruling: "AI".** `eligibleCandidatesAmong` is
deterministic rule-based sorting — no model, no inference, nothing learned. A wrong claim about a
mechanism is not a decision, so both labels now read **"Eligibility review"** instead. There were two,
the second at `:442` on the empty-state branch where nothing computes at all. A sweep of all 139 files
under `src/components/ward-management/` found no third and no case of the opposite error, with four
accessible names checked and confirmed accurate as a control.

⚠️ **AND A CLAIM THAT STOOD IN THIS DOCUMENT FOR AN HOUR WAS WRONG, IN THE DIRECTION THAT FLATTERED
THE ARGUMENT.** It said the shortlist computes _"no ranking beyond eligible-before-ineligible"_ and
that there is _"no best-fit review"_. **False.** `ward-derivations.ts:717-723` orders within the
shortlist, and the code's own comment is unambiguous: a ward tighter than the patient needs _"should
not be the one a coordinator is steered toward first"_. **That is ranking by fit to a patient.**

So "best-fit" was arguably honest and "AI" never was. **The label chosen is still "Eligibility
review"** — because the ordering that exists is a binary demotion on one restriction flag inside a
three-item list, with no score, weight or percentage anywhere, and because "best-fit" would land on
the ranking question you have not ruled on. It is true, it matches the panel's own "Eligibility check"
badge, and it pre-empts nothing.

**Two separate careful readers offered wrong reasons for the same right fix, in opposite directions** —
one said nothing is computed, one said nothing is ranked. Both are recorded in the code so the next
reader does not restore either. The correct fix survived both, which is the hazard worth naming: a
conclusion three people agree on stops being re-derived.

**`referral-board.tsx` remains frozen with the other banners.**

---

## One thing to decide alongside it

`ward-index.tsx` renders **"no bed numbers"** to a clinician — a page telling a user what it does not
show, on the authority of a restraint with **no recorded ruling behind it** (traced by content
search across 4,800+ documents and both ward branches; verdict **UNTRACEABLE**, not _inferred_ —
nobody can find the origin, which is a weaker claim than knowing it was invented).

Milder than the three above, because it describes an absence rather than guaranteeing future
behaviour. Same shape. Same sitting.
