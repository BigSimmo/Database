# Ward Flow matching: the design, and the one question it turns on

**Status:** design, not built. Nothing in this document describes shipped behaviour.

**Authority:** `R-2026-09-04-G` (owner, 2026-09-04), which withdrew spec D4's prohibition on the
board suggesting anything, and replaced it with two positive instructions and one preserved
boundary.

**Author:** Ward Lead. Attacked by Ward Verifier before and after drafting; the strongest argument in
it is theirs and is attributed where it appears.

---

## 1. What the owner actually decided, in two halves

> _"the app is to use all the information it has to make accurate suggestions about which patients
> best fit which wards, and about the most effective way to match **all** patients with beds. That
> second half is an allocation problem across the whole board, not a ranked list per patient."_

**Half one — per-patient fit.** For one patient, which wards suit them, and why.

**Half two — whole-board allocation.** Across every patient waiting and every bed free, an
arrangement. Not the same problem, not solvable by running half one repeatedly, and not the same
question ethically.

**And the boundary the owner KEPT:** the software never decides. The final acceptance comes from the
users. `R-2026-09-04-G` withdrew the prohibition on advising; it did not withdraw this.

⚠️ **PRESENTATION IS OPEN AND I NEARLY RECORDED THE OPPOSITE.** "not a ranked list per patient"
describes the shape of the allocation problem, not the shape of the interface. The ruling says in as
many words that _"a ranked list, a proposed allocation, or a switch between them is a design question
and is open."_ The Verifier caught me reading it as foreclosing the ranked list. It does not.

---

## 2. The load-bearing question is not ranking. It is the unit of acceptance.

My first three design questions were all about rank: can a ranked list be shown without the rank
becoming the decision; does the top item get accepted by default; how much deliberation survives an
ordered list. **All three are half-one questions, and half two is where the risk is.**

**The Verifier's argument, which reframed this design and which I accept in full:**

> A ranked list for one patient is advice a clinician accepts or ignores. A proposed allocation
> across all patients is much closer to the software doing the allocating and the human ratifying
> it — because the unit of the decision is no longer one patient a clinician is thinking about, it
> is an arrangement nobody composed. In a whole-board allocation there is no top item to resist,
> there is a whole arrangement, and accepting it wholesale is one click. The per-item deliberation
> the question worries about disappearing has nowhere to happen at all.

So the question this design turns on is: **what is the thing a human accepts?**

---

## 3. Three shapes, and why one of them fails

### (a) The unit stays one patient

A whole-board computation may inform each patient's suggestions, but the board never presents an
arrangement as acceptable. The clinician works patient by patient, as today, better advised.

**Holds the boundary comfortably.** Every acceptance is evidence a clinician considered that patient.

**And it under-delivers half two.** The owner asked for _"the most effective way to match all
patients with beds"_, and (a) answers only the first half while using the second as a hint. It is
the honest floor, not the target.

### (b) The unit is the arrangement, acceptance is per-row — **RECOMMENDED**

The engine composes an arrangement across the whole board. The board shows it. **Nothing commits
until every row has been individually acted on** — accepted, changed, or declined, each carrying its
own reason where the existing gates require one.

**Expensive by design, and the expense is the point.** It is the only shape that delivers half two's
computation while keeping half one's unit of human judgement. The clinician sees the arrangement —
including the cross-patient trade-offs no per-patient list can show, which is the whole value of
half two — and still decides one patient at a time.

**What it costs:** a nine-patient morning is nine deliberate acts. An "accept all remaining" control
would collapse (b) into (c) and must not exist. That prohibition is a design constraint of this
shape rather than a preference, and it should be tested rather than commented — this project has
already catalogued what happens to a rule that lives only in prose.

### (c) The unit is the arrangement, accepted wholesale — **REJECTED**

Shown here because an option that is never named comes back wearing different clothes.

**The reason it fails, which is the Verifier's and is the sharpest sentence in this design:**

> Wholesale acceptance of a composed arrangement is the only shape where the human's act carries no
> information about any individual patient. In (a) and (b) an acceptance is evidence a clinician
> considered that patient. In (c) one click is compatible with having considered none of them, and
> nothing in the record distinguishes a careful review from a reflex.

🔴 **That is what makes (c) decision-making rather than advice — not the ranking, and not the
presentation.**

⚠️ **THE NEXT SENTENCE WAS TOO STRONG AND ITS AUTHOR WITHDREW IT.** The first draft said _"(c)
cannot be rescued by a confirmation step"_. The Verifier — who wrote the argument above — corrected
their own claim before I built on it. The defensible version is narrower and it is the one that
governs here:

> **A repeated act of the same kind carries no more information than the first. Only an act of a
> different kind does.**

So a second click rescues nothing. **But a confirmation that requires ENTERING something — a reason,
a per-patient note, a named exception — does carry information, and the strong version forbade a
class of designs it had no business forbidding.** That leaves a real door open: a wholesale
acceptance gated behind an act of a genuinely different kind is not obviously (c). Nobody has
designed one, and **(c) as specified above — one click, nothing entered — stays rejected.**

---

## 4. The requirement that survives all three shapes: the record

⚠️ **The Verifier's question, which I had not asked and which changes what must be built:**

> What does the record show afterwards? If the audit trail of (b) is indistinguishable from the
> audit trail of (c) — an arrangement and a timestamp — then the distinction you are designing
> exists only at the moment of use and vanishes the instant anyone reviews it. **The patient who
> came to harm is reviewed from the record, not from the screen.**

⚠️ **AND ITS AUTHOR HAS SINCE DEMOTED ITS PREMISE, WHICH I AM RECORDING RATHER THAN QUIETLY
KEEPING.** _"The patient who came to harm is reviewed from the record"_ was asserted from argument,
not measurement. In a real review the record is one source among several — the clinical notes, the
people involved, the timeline. **The premise is a question for the owner, who is the only person on
this project who has actually reviewed a case.** The requirement below does not depend on the strong
version: a record that cannot distinguish deliberation from reflex is worth less than one that can,
whether or not it is the only source a reviewer has.

This is the same argument that put the closed-movement eligibility calculation behind a control.
**So (b) is only (b) if the record says so.** The event stream must distinguish, per patient:

- that a suggestion was shown, and what it was at the moment it was shown;
- that a human acted on **that patient's** row, distinctly from acting on the board;
- where the human's decision differed from the suggestion, and the reason recorded for it.

An arrangement plus a timestamp is the audit trail of (c) regardless of which screen produced it.

🔴 **AND THE FIRST BULLET CONTRADICTED §8.3, WHICH IS NOW RESOLVED HERE RATHER THAN LEFT STANDING.**
This section REQUIRED the record to show that a suggestion was shown and what it was; §8.3 filed
whether to retain exactly that as OPEN. **If the owner answered "do not retain", this requirement
became unsatisfiable — and by this section's own argument, shape (b) would then collapse into shape
(c) in the record, decided by a question filed as a retention detail.**

**Resolved this way:** the first bullet is **not conditional**. If a suggestion was shown and a human
acted on it, the record must say what they were looking at, because that is the whole difference
between advice taken and an arrangement ratified. **What §8.3 may still decide is how long that
record is KEPT and at what granularity — not whether it is written.** A retention period is a policy
question; whether the event exists at all is this design's question, and it is answered.

**And the open half of this requirement, which the Verifier predicted before reading the draft and
was right about:** the three bullets specify what is WRITTEN, not what a READER can conclude. Those
are different requirements and only the second is a safeguard. A record that faithfully logs nine
acceptances in nine seconds satisfies all three bullets and still cannot answer the question a
reviewer is actually asking. **I do not have the second requirement yet.** It is stated here as
missing rather than omitted.

---

## 4a. A promise already made to a clinician, which this design must keep or the owner must retract

🔴 **Found by the Verifier, and it is a dependency nobody had listed.** The product already prints,
on two surfaces (`ward-management-modes.tsx:899` via `coordinator-screen.tsx:182`, and
`ward-management-modes.tsx:1007`):

> _"A human coordinator confirms or overrides **every** suggestion."_

**This is not a description in the wrong tense. It is a commitment.** Unlike the withdrawn-rule
sentences in §7, no ruling has retired it and nothing about it is stale — it says what the software
will do for a clinician, and a clinician may be relying on it.

**Shape (a) keeps it. Shape (b) keeps it — per-row acceptance is exactly "confirms or overrides
every suggestion", and this is the strongest independent argument for (b) in the document, arrived
at from a direction that had nothing to do with the ethics.** Shape (c) makes it false, and one
click over nine patients is not nine confirmations however the event stream records it.

**So the promise is a live constraint on the design, and if any future shape breaks it the owner
retracts the sentence first — deliberately, in front of the clinician who was told it.**

---

## 5. What exists today

Measured against the working tree rather than recalled. Locations in the appendix; the
design-relevant summary:

**Per-patient fit is largely built.** `eligibility(movement, unit, now)` returns
`{ eligible, gates }` over ten gates; `referralEligibility()` does the same over nine for the
referral path. `shortlistCandidates()` returns **every** unit, deliberately uncapped, in four
availability buckets. `eligibleCandidatesAmong()` returns a cohort-matched, eligible-first list
truncated to a limit. Gates are classified three ways — suitability (overridable with a recorded
reason), informational (never blocks), and everything else (fail-closed, unbypassable even with a
reason). Reasons are plain sentences a clinician can disagree with; figures are raw counts.

**Nothing scores or ranks a person.** No ordinal, percentage, star or weight field exists on a
destination option, and destination options are ordered by catchment then alphabetical. This is
enforced by tests.

🔴 **BUT THE PRODUCT DOES RANK WARDS BY FIT TO A PATIENT, TODAY, AND AN EARLIER DRAFT OF THIS SECTION
OMITTED IT — WHICH MADE §7 READ AS A QUESTION ABOUT FUTURE BEHAVIOUR.** `eligibleCandidatesAmong`
has a **second pass** (`ward-derivations.ts:707-716`): within the truncated set it places a ward that
`restrictionNotice` flags as tighter than the patient needs **below** one that matches, and its own
comment says such a ward _"should not be the one a coordinator is steered toward first"_. That is
fit-to-this-patient ordering, it exists now, and it reaches four surfaces.

**This is the section that decides how urgent §7 feels, and it was reassuring.** A designer reading
the earlier draft would have concluded the ranking does not yet exist.

**Two consequences already visible on one screen**, both frozen and both in the owner's bundle:

- `ward-management-modes.tsx:425` calls it with `limit = 1`. The reorder runs **after** `.slice`, so
  on a one-element array it is a no-op — and the column is headed **"Top candidate"**. It prints a
  superlative for a comparison that did not happen.
- Thirty-five lines below, `:460` calls it with the **default limit of 3** and takes `[0]`. The
  reorder does run, so a destination is **silently preselected from a real ranking**.

⚠️ **One screen, two adjacent uses, opposite defects: a label claiming a ranking that did not happen,
and a ranking happening with no label at all.** The second is the stronger fact for §7 — a
preselected destination is not a ranking displayed, it is a ranking already acted upon before the
clinician touches anything.

🔴 **Half two does not exist at all, and the codebase says so in its own comment:** _"Nothing here
suggests anything YET because the matching work has not been designed, NOT because it is
forbidden."_ Every function taking both movements and units iterates movements **independently**.
**No cross-movement capacity contention is modelled anywhere** — nothing accounts for "if this unit
is offered to patient A, is it still available for patient B". That single absence is the whole of
half two.

**Acceptance is already a discrete, role-gated, refusable act.** `ACCEPT_IN_PRINCIPLE` and
`ACCEPT_REFERRAL` run the gates, refuse outright on physical facts, and require a recorded override
reason for judgement gates. **Nothing auto-selects or auto-accepts a unit anywhere in the reducer.**
The boundary the owner kept is already load-bearing in code, which is the strongest argument for
building half two behind it rather than beside it.

---

## 6. What must be built, in order

### Step 0 — two questions for the owner, before any of it

🔴 **This step did not exist in the first draft, and its absence would have cost the contention model
a rebuild.** Both questions are cheap now and expensive at step 4.

**0a. Does showing a suggestion contend?** In plain terms: _if the board shows you a bed for this
patient, is that bed still offered to the next patient?_ **That is a ward question, not a software
one** — it can be answered without knowing anything about the model.

⚠️ **It decides what the contention model's members ARE, and it was mis-filed.** It sat in §8.3 as
_"whether a shown-but-not-acted-on suggestion is itself retained is a privacy and retention
question"_. **Retention is its second consequence. Its first is this:**

- **If showing holds a bed**, a shown suggestion is a contending object **with a lifetime** — step 1
  must represent it, expire it, and resolve races between two shown arrangements.
- **If only acceptance contends**, step 1 is a projection over events that already exist.

**Those are not the same primitive.** Building step 1 without the answer means building one of them
and discovering at step 4 which was needed. **A question mis-filed by its consequence is deferred by
its filing rather than by anyone's decision** — under "privacy and retention" it reads as a question
about how long to keep a log, answerable after the model exists.

**0b. Shape (b) or shape (a)?** §3, and §8 item 1. Moved here because step 2 cannot start without it.

**The justification is §6's own principle, one level up.** The record is deliberately placed before
the screen so that the screen cannot decide what the record contains. By the same argument, building
the contention model first would let the model decide what "shown" means — and §4 has already
committed to that meaning being observable.

### Then

1. **A contention model.** The one genuinely missing primitive: a way to express that offering a bed
   to one patient removes it from another's options. Everything in half two is downstream of it, and
   nothing today has it. **Partially built** — `ward-contention.ts` reports claims per unit under the
   "only acceptance contends" reading. If 0a answers the other way it gains a member and a lifetime.
2. **An arrangement type**, carrying per-patient rows with their own suggestion, their own reasons,
   and their own acceptance state — so that (b) is representable and (c) is not.
3. **The per-row acceptance events**, extending the existing accept/decline events rather than
   replacing them, so the gates and the override-reason discipline are inherited rather than
   re-implemented.
4. **The record**, per §4, designed before the screen rather than after it.
5. **The screen.** Last, deliberately.

---

## 7. The regulatory question

**Already recorded by the owner, and answered as to timing.** The TGA/SaMD classification box was
left unticked on PR #2597 for exactly this reason, and the ruling states: _"A board that ranks wards
for a patient is closer to clinical decision support than one that records what happened … It needs
answering before this ships to anyone, not before it is prototyped."_

⚠️ **I described this in an earlier brief as something I had flagged. The owner had already recorded
it. Correcting the attribution here rather than leaving the implication standing.**

So: **prototype freely; do not ship without it.** Neither Ward Lead nor any builder is qualified to
answer it, and no amount of internal agreement substitutes.

**AND IT IS ALREADY LIVE IN SHIPPED COPY.** `escalation/escalation-board.tsx:48-52` tells a clinician
_"It **never** ranks a ward the patient does not fit, and it **never** states what would need to
change for one to work"_ — the withdrawn INSTRUCTION form of D4 — in the same paragraph as _"not a
medical device"_, asserted by zero tests. The pairing presents the second as support for the first.
**That is a clinical-governance decision rather than a wording one, and it is with the owner.**
Nobody edits that file meanwhile.

The withdrawal's own scope is the finding worth keeping: it was defined as _"every comment in this
area"_, was executed faithfully within that scope, and **the scope was wrong — comments only.** That
predicts where the next miss will be, which "one sentence was missed" does not.

---

## 8. Open for the owner

**Two of these block the build and two do not. That distinction was missing and it mattered.**

**Blocking — these are Step 0 (§6):**

1. **Does showing a suggestion contend?** _If the board shows you a bed for this patient, is that bed
   still offered to the next patient?_ A ward question, answerable without reference to the software,
   and it decides what the contention model is made of. **Previously buried inside item 3 below, where
   it read as a retention detail.**
2. **Shape (b) or shape (a)?** I recommend (b). (a) is the honest floor and under-delivers what was
   asked; (c) is rejected on the argument in §3 and should not be revisited without new reasoning
   that addresses the information content of the act, not the number of clicks.

**Not blocking:**

3. **The banner sentences** — §7, and now sharpened by §5: this is not a question about future
   behaviour. Clinical governance, and it travels with the rest of the device-copy bundle.
4. **How long the record is kept, and at what granularity.** ⚠️ **This is what remains of the old
   item 3 after the contradiction in §4 was resolved.** Whether the "a suggestion was shown" event is
   WRITTEN is settled by §4 and is not open — if it were open, answering it "no" would collapse shape
   (b) into shape (c) in the record. How long it is retained is a policy question and genuinely is.

---

## Appendix — inventory, with locations

_(Gathered by subagent, Sonnet, extraction; line numbers read from the working tree at the time of
writing. An inventory decays — re-derive rather than cite this once the contention model lands.)_

    eligibility(movement, unit, now)          ward-eligibility.ts:96-208    10 gates
    referralEligibility(referral,ward,unit)   ward-eligibility.ts:261-403    9 gates
    candidateReason(verdict)                  ward-eligibility.ts:428-432    first failing detail; never "N of M"
    shortlistCandidates(movement,units,now)   ward-derivations.ts:641-664    ALL units, uncapped by design
    eligibleCandidatesAmong(...,limit=3)      ward-derivations.ts:696-723    truncate-then-reorder, pinned
    ELIGIBILITY_GATES                         ward-eligibility.ts:37-50      12 names, union of both paths
    SUITABILITY_GATES  (overridable)          ward-flow-reducer.ts:485-505
    INFORMATIONAL_GATES (never blocks)        ward-derivations.ts:590        ["prior_decline"]
    PARALLEL_REFERRAL_CAP = 3                 ward-model.ts:201
    DestinationOption {figures, reasons}      referral-destination-options.ts:82-104   no rank field exists
    ACCEPT_IN_PRINCIPLE / DECLINE             ward-flow-reducer.ts:1125-1197 / 1465-1492
    ACCEPT_REFERRAL / DECLINE_REFERRAL        ward-flow-reducer.ts:2560-2687 / 2791-
    escalationBoard(movements,units,now)      ward-derivations.ts:1024-1049  per-movement, independent

**The gate that would catch a regression here:** `tests/ward-flow-single-source.test.ts` walks the TS
parser and refuses any live-unit-taking function that reads the frozen `allUnits()` fixture
internally. A contention model must take live `movements` and `units` as parameters or that gate goes
red — which is the correct outcome, and worth knowing before it happens rather than after.
