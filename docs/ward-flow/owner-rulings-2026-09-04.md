# Owner rulings, 2026-09-04

Four rulings given directly by the owner. Recorded here because a ruling held only in a chat
message is the thing this project has lost twice already — see the FD-18 note that put a false
clinical promise on a screen, and the plan revision that was described but never committed.

Each entry states **what was asked**, **what was answered**, and **what it changes in code**.
Where a ruling required interpretation to be implementable, the interpretation is written out so
the owner can correct it rather than discover it.

---

## R-2026-09-04-A — The patient record may hold the placement field set

**Asked:** which facts may the patient record hold? Owner ruling PD-1 of 2026-08-30 permitted name,
record number, date of birth and age, stated that address and narrative history were **not** ruled
on, and that **silence is not permission**. The approved design adds seven more.

**Answered:** _"All of those and any others you think may be clinically relevant for this task and
context."_

**Approved, explicitly:** address · suburb · GP · catchment community team · legal status ·
interpreter / preferred language · Aboriginal or Torres Strait Islander status.

⚠️ **The "any others" clause is delegated clinical judgement and is being exercised narrowly.**
A broad grant is not a reason to widen a clinical record, and the fields below are proposed with
their reasons so the owner can strike any of them.

**Proposed additions beyond the seven, two only:**

| Field          | Why it is placement-relevant                                                                                                                                                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sex / gender   | Bed allocation depends on it — ward gender mix is a real constraint on which bed a patient can occupy. It is **already** carried on the referral's ward arm today, so this records something the system holds rather than collecting something new. |
| Preferred name | A patient addressed by the wrong name on arrival is a dignity failure and a small one to prevent. No clinical inference attaches to it.                                                                                                             |

⚠️ **Deliberately NOT added, and each is a separate decision the owner has not been asked for:**
risk flags or alerts; diagnosis; next of kin or carer contact; medication. **Each is a larger
clinical surface than the placement facts above, and "clinically relevant" was not read as
authorising them.** If any is wanted, it should be asked for on its own.

**What it changes:** `Patient` grows from five fields. `tests/ward-patient-model.test.ts` holds a
mutation-tested `PATIENT_FIELDS` list with a `DECISIONS` map; every added field needs its entry
citing this ruling, or the guard fails — which is the guard working, not an obstacle.

⚠️ **This ruling is about what the record may HOLD. It does not settle how the two sensitive fields
are PRESENTED.** The Aboriginal health review remains open on that, and the placement rule stands:
the two sensitive fields are not adjacent to each other, and neither sits directly above the
psychiatric history panel.

---

## R-2026-09-04-B — An emergency department MAY see other referral destinations

**Asked:** may an emergency department see that a patient was also referred to a ward? Noted at the
time that this was no longer a question about building something: `referralPersonFacts` already
discloses one bit, because a patient's sex appears only when a ward arm exists. **A "no" would have
been an instruction to change shipped behaviour.**

**Answered:** _"Yes can see."_

**Interpretation, stated so it can be corrected:** an ED-facing screen may see the destination list
for a referral it is party to — which ward or wards were asked, and the state of those arms. This
makes the ED seat **coordinator-like** for destination visibility, and **the opposite of the ward
and community seats**, which were both ruled restricted.

**What it changes:**

- The existing one-bit disclosure is **sanctioned, not a defect.** No fix is scheduled for it.
- FD-23's header must stop recording ED as undecided. All three destination kinds are now ruled:
  ward restricted, community restricted, **ED unrestricted**.
- ⚠️ An ED projection may now be built — but it must still be a **projection**, not the raw
  `Referral`. Today `ed-screen.tsx` pulls the whole record off the provider. "May see the
  destinations" is not "may see everything": the projection-not-flag architecture exists so that
  what reaches a component is what the component may show, and that reasoning is unchanged by this
  ruling.

---

## R-2026-09-04-C — Build the third transport state

**Asked:** the model cannot distinguish "no transport needed" from "no transport booked" for most
movements, so the screen would say only "no transport recorded".

**Answered:** _"Go ahead with adding this if recommended."_ It was recommended.

**What it changes:** transport need becomes a three-state fact on the movement — needed / not
needed / not recorded — following the same shape as medical clearance, which already models
exactly this uncertainty. **"Not recorded" must remain the default for existing data**; a migration
that guesses one of the other two for legacy movements would manufacture the very certainty this
ruling exists to provide honestly.

⚠️ **Separately and not covered by this ruling:** `formRequired` is an unvalidated bare string, so a
screen showing a form code must not imply the form was checked.

---

## R-2026-09-04-D — Fix the movement-to-referral link

**Asked:** the system cannot tell the owner that nobody is looking for a bed for a patient. The
link exists — `Movement.referralId`, properly enforced, `RAISE_REFERRAL` refuses an id that does
not resolve — but **not one of the twenty seeded movements carries it**, so `referralForMovement`
returns undefined for every patient in every emergency department.

**Answered:** _"Please fix this."_

⚠️ **What "fix" must mean here, because the obvious reading makes it worse.** Seeding the twenty
links makes today's fixture look right and hides the general problem: three different causes render
identically — nobody has asked yet (clinical), the movement predates the link (record-keeping), and
a runtime movement raised without naming a referral (record-keeping). **Only the first is a
clinical state.**

**So the fix is both halves:**

1. **Seed the links** for the fixture movements that genuinely have a referral, so the screen shows
   real data rather than a uniform absence.
2. **Make the three causes distinguishable**, so that "nobody is looking for a bed for this
   patient" becomes a state the system can actually assert — rather than an absence it infers.

⚠️ **Until half 2 lands, no screen may render an absent referral as an urgent clinical state.** An
earlier ruling of mine said it should be the loudest thing on the page; implemented against today's
data it would have reported that nobody was looking for anybody, anywhere, with every gate green.
That ruling was withdrawn and this one replaces it.

---

## R-2026-09-04-E — The movement workspace step track

**Asked:** the seven-step track on a patient's workspace shows numbers that do nothing when
clicked. Four questions were put with recommendations.

**Answered:** _"Yes to all your recommendations and for number 3 implement the control for
coordinator to be able to do this."_

**What was wrong, established by reading the code rather than the screen:**

1. **The numbers are about other patients.** `stageSummaries(movements)` counts every movement in
   the system at each stage, and it is rendered inside `WardPatientWorkspace`, a single patient's
   page. The number beside "Bed pulled" is how many patients _anywhere_ are pulled.
2. **Clicking does nothing.** `activeStage` is read in exactly one place — deciding which button
   looks highlighted. Nothing filters, opens, or moves. A patient at step 2 can have step 6
   highlighted.
3. **It promises a progress tracker and behaves like a filter that filters nothing** — numbered
   1–7 with `aria-current="step"`, which tells a screen reader it is a sequence.
4. **There is no transition map at all.** Each stage is set by whichever event fires; nothing knows
   step 4 follows step 3, so nothing can detect a skipped or reversed step.

**Ruled:**

- **The control becomes a progress tracker for one patient.** Steps behind filled, current marked,
  ahead greyed. **No count of other patients appears anywhere on a patient's page.**
- **A completed step is clickable and shows when it happened and who did it. A future step is not
  clickable.** Setting the stage stays with the real actions, which already exist.
- **A coordinator MAY move a patient backwards or skip a step.** This is consistent with the
  standing Ward Flow rule that no eligibility rule is absolute and a refusal records the decision
  rather than blocking it.
- **A patient who never arrives stops at the step they reached and the track says why it stopped**
  — "did not proceed at Bed pulled, 14:20". Today a stopped patient and a stalled one look
  identical, and they are clinically very different.

⚠️ **ASSUMPTION STATED RATHER THAN GUESSED, because it is the dangerous half.** A coordinator
step-back is **a recorded correction, not a rewind of side effects.** Stepping back from "Bed
pulled" does **not** silently release the bed; stepping back from "Moving" does not cancel the
transport. Those remain as they are and stay visible.

**The reason: a stage is a description of where a patient has got to, and a bed allocation is a
commitment to a person. Undoing the description must not quietly undo the commitment** — a bed
released because somebody corrected a typo is a patient with nowhere to go, and it would happen
silently. If the owner wants a step-back to release the bed, that is a second, explicit action.

**Every step-back records who, when, and why. A step-back with no reason is refused** — the same
shape as every other override in this system.

---

## R-2026-09-04-F — Who may step a patient back, how it is recorded, and what it must not undo

**Asked:** three questions opened by ruling E. **Answered:** _"Please go ahead with all your
recommendations I accept."_

**F1 — Only the coordinator role may step a patient back.** Not ward, ED, community or transport
officer. A ward stepping a patient back out of "Accepted" would be undoing its own commitment
invisibly to everyone else, and the coordinator is the role that already holds the override powers
in this system.

**F2 — The reason is a picked list plus an optional note, never free text alone.** Every other
reason capture in Ward Flow uses a fixed list so reasons can be counted and compared;
`DECLINE_REASONS` is the pattern. Starting list, extendable: **recorded in error · the decision
changed · the patient situation changed · the bed was lost.** A step-back with no reason is
refused.

🔴 **F3 — STEPPING BACK PAST "ACCEPTED" DOES NOT UN-ACCEPT. It is a separate, explicitly named
action — "withdraw the acceptance" — and it tells the ward.**

**The reasoning, because this is the one that would otherwise be discovered rather than decided:**
every other stage describes **where a patient has got to**. "Accepted" does not — it is **a ward
saying yes to a person**. If a coordinator quietly stepped a patient back to "Destination review",
the tracker would say nobody had accepted while the ward's own screen still said it had. **Two
screens, two answers, both honest, and no way for either reader to know the other exists.**

So the general rule from ruling E holds and this is its sharpest case: **a step-back records a
correction and never silently undoes a commitment.** Withdrawing an acceptance is a real act with
a real recipient, and it is performed as one.

**F4 — The rest of the movement workspace is to be reviewed the same way** the step track was:
the Overview, Legal and forms, Transport and Timeline tabs.

## R-2026-09-04-G — "It suggests nothing" is WITHDRAWN. The board is to match patients to beds.

🔴 **THIS REVERSES SPEC D4, WHICH WAS NEVER AN OWNER RULING.** It was inferred, hardened into
emphatic comments, enforced across four source files, and then obeyed by every session that met it —
including the one that wrote this document. It reads exactly like a safety principle, which is why
nobody questioned it.

**What the owner decided (2026-09-04):** the app is to use all the information it has to make
accurate suggestions about which patients best fit which wards, and about the most effective way to
match **all** patients with beds. That second half is an allocation problem across the whole board,
not a ranked list per patient.

**The boundary that survives, and it is the one that always mattered:** the software never makes a
clinical decision on its own. **The final acceptance comes from the users.** Advising and deciding
are different acts, and only the second was ever the danger.

⚠️ **THIS RULING CHANGES NO BEHAVIOUR TODAY, AND THAT IS DELIBERATE.** The owner's instruction was
to lift the prohibition now and plan the matching work as the next design, not to start building it.
So the code still suggests nothing — because nothing has been built, not because it is forbidden.

### The distinction every comment in this area now has to make

    DESCRIPTION   "this board does not rank wards"        — true today, and fine to write
    INSTRUCTION   "this board MUST NEVER rank wards"      — withdrawn, and must not be written

**The four source files carried the second and were read as binding.** They have been corrected to
the first. A future reader must be able to tell "nobody has built this yet" from "you are forbidden
to build this", and D4's wording made that impossible.

### What is NOT decided by this ruling

- **How matching is presented.** A ranked list, a proposed allocation, or a switch between them is a
  design question and is open.
- 🔴 **The regulatory question, which is now live.** A board that ranks wards _for a patient_ is
  closer to clinical decision support than one that records what happened. The TGA/SaMD
  classification box was left unticked on PR #2597 for exactly this reason, and lifting D4 is what
  makes it a real question rather than a hypothetical. It needs answering before this ships to
  anyone, not before it is prototyped.
- **Nothing about authentication, integration or AI**, which the owner placed explicitly later.

### The general lesson, recorded because D4 will not be the only one

**An inferred constraint that reads like a safety rule is obeyed exactly as if it were one, and
nothing distinguishes the two in the code.** Every hard rule in this project should be traceable to
a ruling or marked as inferred. An audit of which is which is in progress.

## R-2026-09-04-H — Sex and gender identity go to a clinician. The model is NOT changed yet.

**Owner decision (2026-09-04):** ask a clinician who works in this area. **Leave the code as it is
for now** — explicitly declining the offer to add a gender-identity field in advance of that advice.

**What the code does today, measured rather than recalled:**

    ward-model.ts        sex: Sex          one field; NO gender field exists anywhere
    ward-eligibility.ts  unit.sexMix[movement.sex]
                         sexDesignationAccepts(unit.sexDesignation, movement.sex)

So a patient's bed eligibility is computed from that single value, and there is currently no way to
record that a person's gender identity differs from their recorded sex — nor, therefore, any way for
the board to represent it, let alone match on it.

⚠️ **THE INTEGRATOR RECOMMENDED ADDING THE FIELD NOW AND WAS OVERRULED. Recording that, because a
recommendation that quietly disappears looks later like an option nobody thought of.** The argument
was that the data model is the expensive thing to change and the matching rule is the cheap one, so
a field could be added without pre-empting the clinical answer. The owner's call is to change
nothing until the advice arrives, and it is a defensible one: an unused field invites guesses about
what it means, and a half-modelled distinction can be worse than an absent one.

**What this means in practice, so nobody treats silence as approval:**

- **Do not add a gender field, and do not widen `Sex`, until the clinician has been asked.**
- ⚠️ **Every new screen built in the meantime hardens the single-field assumption**, which is the
  cost of waiting and should be visible when the advice does arrive.
- **This is a gate before any real-patient use**, not a blocker on prototyping.

**Not decided here:** what the matching rule should be. That is the clinician's question, and it is
the reason the field was not added pre-emptively.

## R-2026-09-04-I — Aboriginal cultural safety review: deferred, and a hard gate

**Owner decision (2026-09-04):** defer. Not commissioned now; recorded as a **hard gate before any
real-patient use**.

**The reasoning, which is the owner's and worth keeping:** the prototype runs on invented data and
there is not yet enough of a real thing for reviewers to react to. A review commissioned against a
sketch produces advice about a sketch.

⚠️ **THE FAILURE MODE IS FORGETTING, NOT DISAGREEING.** Nobody in this project would argue against
the review; the risk is that a deferred item filed under another feature is never found by whoever
prepares Ward Flow for use. It is therefore recorded as a Ward Flow gate in its own right rather
than relying on the Caring Contacts entry (`#1S81R8`), because Ward Flow is a separate surface with
its own questions — bed allocation, transport, and detention-adjacent legal status.

**It cannot be done by anyone inside this project.** It requires Aboriginal health practitioners.
No amount of internal review substitutes for it, and no session should record it as addressed.
