# Ward Flow Phases 6 and 7 — decisions taken before design

**Recorded 2026-08-27.** These are the product owner's answers to the questions that had to be
settled before Phases 6 and 7 could be specified. They were given in conversation, and this file
exists so they survive it — the recurring failure in this project is a decision that lived only in
chat and was then re-derived, or contradicted, by a later session.

Where this file and a later specification disagree, **the specification wins**, because it will
have been written with more detail in front of it. Where this file and someone's recollection
disagree, this file wins.

Nothing here is built yet. This is the input to the design conversation, not its output.

---

## Phase 6 — the morning page

| #   | Question                              | Decision                                                                            |
| --- | ------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | Who is it for?                        | The **bed coordinator starting a shift**. Not the ward, not a manager.              |
| 2   | The single headline number            | **Beds available right now, across the whole service.**                             |
| 3   | Fixed moment or live?                 | **Fixed at the morning handover**, with a live view one click away.                 |
| 4   | Scope                                 | **Whole service, grouped by hospital** — roll-up first, per-site detail underneath. |
| 12  | Fold in the sixty-second guided tour? | **Yes.** Defer "named moments on the demo clock" to a later phase.                  |

The reasoning behind 3 is worth keeping: a page that stops moving can be printed, pinned up and
argued over. Since the entire point of Phase 6 is producing something to put in front of
colleagues, the version that holds still is the more useful one.

---

## Phase 7 — the front door

### What a referral may carry

**Age band, sex, and whether a secure bed is needed — and nothing else.** No name, no date of
birth, no record number, no address, no diagnosis, no narrative history, no treatment, and no free
text anywhere. This extends rather than replaces the standing constraint that the prototype holds
no real patient information.

### Bed categories — the owner's list, used verbatim

These are **not one flat list of eight labels.** They are separate dimensions that combine, and the
owner said so explicitly: the legal-status pair cuts across the age categories, so any age category
may be either.

| Dimension        | Values                                           |
| ---------------- | ------------------------------------------------ |
| **Age**          | Older Adult · Adult · Youth                      |
| **Legal status** | Voluntary · Involuntary                          |
| **Sex**          | Undesignated (default) · Female only · Male only |
| **Forensic**     | Forensic · not forensic                          |

A bed is therefore described by a combination — an _Adult, Involuntary, Forensic_ bed that is
undesignated for sex — rather than by picking one label from a list.

**Both readings were confirmed by the owner on 2026-08-27**, and one of them corrected an
assumption that had been recorded wrongly:

1. **Forensic is its own fourth dimension and combines with the others.** Confirmed as assumed.
   An "Adult, Involuntary, Male-only, Forensic" bed is expressible. Forensic does not stand alone
   or replace the other three.
2. **Most beds are undesignated for sex; some are female-only or male-only.** This **corrects** the
   earlier assumption that every bed carries a designation. Undesignated is the normal case and
   should be the default, not an exceptional value bolted on.

### Why the sex dimension is a constraint, not an attribute

This one behaves differently from the other three and the distinction matters for matching:

- **Undesignated** places no restriction. Any patient may occupy the bed.
- **Female only** and **Male only** restrict who may occupy it.

So sex-designation is a **property of the bed that constrains which referrals fit**, not a
description of an occupant. A matching rule that treats it as a value to compare for equality will
wrongly exclude every referral from every undesignated bed — which, since undesignated is the
majority case, would break matching almost entirely. Model it as "does this bed accept this
person", never as "does this bed's sex equal this person's sex".

This is also why sex is one of the three permitted referral fields: without it, a referral cannot be
tested against a designated bed at all.

### Legal status may be shown as a plain label

Voluntary and Involuntary are part of how a bed is described, so the label is **in**. The absolute
constraint is unchanged and unaffected by this: **no figure, timeframe, threshold or duration from
the Mental Health Act may appear anywhere** — not in code, copy, comment, test or fixture. A label
saying which of the two applies is not a legal figure. If one is ever needed, stop and ask.

### Referral sources

**One referral type carrying a source label** — community, crisis service, police, ambulance,
inter-hospital transfer. Not five separate pathways. Split them later only if a real behavioural
difference appears; building five up front means maintaining five before we know whether they
differ.

### Referral outcome

A referral can be **accepted, declined with a reason chosen from a fixed list, or left queued**, and
the **coordinator** holds that decision. A referral board on which nobody can say no does not
reflect how any of this works, and a fixed reason list keeps free text out.

---

## Sequencing

1. **The clinician check comes first** — `docs/ward-flow-clinician-check.md`. It is the only
   outstanding item that gets more expensive the longer it waits, because Phase 6 is built entirely
   on the four-stage model and Phase 7 builds further on top.
2. **Then Phases 6 and 7 are designed in one conversation**, each still receiving its own written
   specification. Only the conversation is shared. That is the roadmap's own instruction and the
   reason is the fixed setup cost of a design conversation.

---

## Four further answers, given during the design conversation (2026-08-27)

These were put to the owner while Phases 6 and 7 were being specified, because each one changed the
work materially and three of them would have produced a matching bug that looks like a subtle defect
rather than a modelling error. All four were answered; each is now recorded at the decision it
settles, in the specification named beside it.

| Question                                                                                                                      | Answer                                                                                                                                                            | Recorded at             |
| ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Does an **Involuntary** bed accept a voluntary patient?                                                                       | **Yes.** An Involuntary bed accepts both; a Voluntary bed accepts voluntary only. It is a capability, not a value to match on — the same shape as the sex rule.   | Phase 7 spec, D3 rule 2 |
| Nothing on a referral says a person needs a **forensic** bed. How should Phase 7 handle it?                                   | **Forensic beds are described but never matched.** They are shown honestly and are never offered to any Phase 7 referral. Nothing is added to a referral.         | Phase 7 spec, D7        |
| A referral carries three person-facts. How wide does **"nothing else"** go?                                                   | **The three-field rule governs facts about the person.** The referral may also carry its own operational facts: source, urgency, origin site, transport, outcome. | Phase 7 spec, D5        |
| The morning page's point is handing a colleague a link, but the prototype is administrator-gated. What should Phase 6 assume? | **It stays in the sandbox.** The shareable artefact is the printed page and the guided tour shown live, not a public URL.                                         | Phase 6 spec, D9        |

## Two further answers, given before Phase 7 began (2026-08-27)

Both were put to the owner after Phase 6 was built and before Phase 7's first task.

### Where the youth beds go

**Bentley Health Service, in a unit called the East Metropolitan Youth Unit (EMyU).**

This answers the open question below, and it answers it better than either option offered. The
question assumed the choice was between inventing a fictional site and attaching an invented ward to a
real hospital name. The owner supplied a **real fact instead**: Bentley Health Service is already in
the site table, and EMyU is its actual youth unit. So the prototype is not asserting something false
about a real hospital — it is describing one correctly.

The bed **numbers** in that unit remain invented, exactly like every other number in this prototype,
and the standing banner still applies. Use the name verbatim, including its capitalisation.

This narrows roadmap decision 12 ("sites stay synthetic; real WA town names may be used for geography
and distance only") rather than contradicting it: a real unit name supplied by the owner is a fact he
holds, not a fact the prototype invented. The general rule is unchanged for everything else.

### The morning page gains a demand figure

**Yes — at the end of Phase 7, once real referrals exist.**

Phase 6 deliberately left demand out, because "how many people are waiting" could only have been a
count of movements that happen to be open in an emergency department, and building it then would have
meant building it twice. Once Phase 7's referral queue is real, the morning page gains one figure for
people waiting.

A bed coordinator starting a shift wants both halves of the equation. It is cheap to add while the
referral work is fresh and expensive to retrofit into a page people have already learned to read.
Everything Phase 6 decided about that page still holds: the figure is derived, never computed on the
page, and it is never summed into any bed figure.

## A fifth answer, given mid-build (2026-08-27)

### A referral gains a fourth field: whether an involuntary bed is needed

**Decided: add it.** This is the one place the permitted-field list moves from three to four, and the
owner moved it deliberately after being shown what the three-field version cost.

**What prompted it.** Task 2 built bed matching and surfaced that the Voluntary/Involuntary dimension
could not affect matching at all. A referral carried age band, sex and secure-bed-needed, and nothing
about legal status — so the gate had nothing to compare and passed for every bed. Two of the four bed
dimensions were therefore decorative in matching: forensic by the owner's explicit choice, legal status
by accident of the field list.

**The field is a requirement on the REQUEST, never a fact stored about a person.** This matters and it
follows roadmap decision 5's existing convention exactly — cohort is expressed as "this request needs an
adolescent bed", and the word never attaches to a patient. So the field is
`involuntaryBedNeeded: boolean`, read as "this request needs a bed that can hold someone
involuntarily". It is not a legal determination, not a status, and not a claim about the person.

**It is not a legal figure and does not weaken that constraint.** No figure, timeframe, threshold or
duration from the Mental Health Act is introduced. A plain requirement flag sits in exactly the same
category as the Voluntary/Involuntary bed label the owner already permitted.

**The matching rule it makes real** — an accepts-rule, never an equality:

- A referral that does **not** need an involuntary bed is accepted by **any** bed.
- A referral that **does** need one is accepted **only** by a bed that can hold someone involuntarily
  (the existing `unit.authorised`).

Consequences that must travel with it: the structural privacy test asserts the type's exact field set
and must be widened to four deliberately, not incidentally; the intake form gains the field; and the
seed must contain at least one referral needing an involuntary bed **and** at least one bed that must
refuse it, or the rule is untestable.

Forensic is unchanged and stays descriptive-only.

## A sixth answer, given mid-build (2026-08-28)

### A referral records where the person is from, as a REGION

**Decided: add it now, while the referral record is still being built.** The owner named this for what it
is: a governance decision, not an implementation one. It widens the permitted facts about a person for
the first time in five phases.

**What prompted it.** Preparing the Phase 8 groundwork surfaced that everything geographic measures from
somewhere, and today the system knows only which hospital a person is sitting in. Without this, the
out-of-area ledger — the equity measure the roadmap calls "the one with teeth" — would measure distance
from _the hospital that referred them_, not from home, and would have to be renamed to say so.

The groundwork also found the gap already being papered over: **a bed can be declined today for being
"out of catchment" while the system holds no catchment for anybody.**

**A region, never an address.** The field carries a broad area chosen from a fixed list — never a street
address, never free text, never a postcode. Roadmap decision 12 already permits real Western Australian
place names "for geography and distance only", and a region name is exactly that: public geography, not
a fact the prototype invented about a person's home.

**The permitted-fields list now has a clearer shape, and it is worth stating in full** because it has
grown twice in one night and the reasons differ:

| Kind                                | Fields                                                                    | Why permitted                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Facts about the person**          | `ageBand`, `sex`, `homeRegion`                                            | The minimum needed to place someone safely and to measure whether they were placed far from home.   |
| **Requirements on the request**     | `secureBedNeeded`, `involuntaryBedNeeded`                                 | Roadmap decision 5's convention — a requirement on the request, never a fact stored about a person. |
| **Facts about the referral itself** | source, raised-at, urgency, origin site, transport needed, state, outcome | Operational. Not about the person at all.                                                           |

Still absolutely excluded, and this has not moved: name, date of birth, record number, **address**,
diagnosis, narrative history, treatment, and **free text anywhere**.

**What must travel with it:** the structural privacy test asserts the type's exact field set and must be
widened deliberately, not incidentally; the region comes from a fixed list with a membership check, so an
address can never be entered where a region belongs; and the intake form offers a picker, never a text
box.

## Still open

- Everything the clinician check comes back with.
- **Two questions raised by the design conversation and left with the owner**, neither of which
  blocks implementation. Both are written up in full at the foot of each specification.
  1. ~~The site table uses real WA hospital names beside invented units and bed numbers.~~
     **ANSWERED 2026-08-27** — see the youth-beds decision above. The narrow case that prompted it is
     closed: the youth unit is a real unit at a real site, not an invention. The broader question —
     whether every site name should eventually be clearly synthetic — is still open, but nothing in
     Phase 7 now depends on it.
  2. Should the morning page and the existing shift-handover page eventually be one page? They answer
     different questions today.

---

## Where the two specifications are

- **Phase 6** — `docs/superpowers/specs/2026-08-27-ward-flow-phase-6-morning-page-design.md`
- **Phase 7** — `docs/superpowers/specs/2026-08-27-ward-flow-phase-7-front-door-design.md`

Both were written on 2026-08-27 in one conversation, as the roadmap instructs, and each carries its
own numbered decisions, an explicit statement of what is deliberately excluded, and a table naming
which decisions are unvalidated assumptions and what each would cost to reverse.

Both bed-category readings were confirmed by the owner on 2026-08-27 and are no longer open. One of
them — sex designation — corrected an assumption recorded here wrongly, which is precisely the
reason assumptions are written down as assumptions rather than folded silently into a
specification.

---

## The bed model becomes three stages plus a flag (OWNER, 2026-08-28)

**Decided by the product owner on 2026-08-28**, after the structural argument below was put to him
and he agreed to it. This supersedes the four-stage model
(`predicted → confirmed → blocked → released`) that Phases 5 to 7 were built on top of.

### The defect that prompted it, verified in the code before it was raised

`capacityBreakdown` (`ward-bed-availability.ts`) sorts today's releases into `confirmedToday` or
`predictedToday`. A release in state `"blocked"` matches **neither branch**, so it falls through
both and is counted **nowhere**.

Mark a confirmed discharge as blocked and the ward's confirmed count drops by one, with nothing
appearing anywhere to say why. **The figures improve at the exact moment the ward is stuck.**

### The change

**Three stages**, describing how certain the discharge is:

- **predicted** — with the existing `likely` / `possible` confidence
- **confirmed**
- **released**

**`blocked` stops being a stage and becomes a flag** that sits on top of a predicted or confirmed
discharge, carrying a reason and the role that recorded it. A discharge that is decided and stuck is
exactly that: still confirmed, and flagged.

**Transitions go both ways**, and a reversal is recorded like any other change. `confirmed` can
return to `predicted` when a decision is reversed. The one-way model did not stop that happening —
it made a ward record it dishonestly.

### What does NOT change

- **A predicted bed is still never counted as available.** The Phase 5 rule is untouched.
- Leave beds are still counted separately and never mixed into the available figure.
- Only the ward can move a bed between stages; the coordinator can see them and not change them.
- Only genuinely empty beds are offered.

### What changes in the counting, and it is one place

A blocked-but-confirmed bed **keeps counting as confirmed**, and the number of blocked beds is shown
separately beside it. Nothing else moves.

**What this gains beyond honesty:** "how many confirmed discharges are stuck, and why" becomes a
question the system can answer. That is a figure a bed coordinator actually wants, and the four-stage
model structurally could not produce it.

### Cost

One fewer member of `BED_RELEASE_STATES`; one optional reason field on `BedRelease`; one extra figure
in `CapacityBreakdown`; a blocked indicator on the ward and morning screens. Materially cheaper now
than after Phases 8 and 9 build on top.

### What this does NOT settle

**The clinician check is still owed** (`docs/ward-flow-clinician-check.md`). This change answers the
question the reviewer had the strongest structural argument about; it answers none of the others, and
the remaining ones are exactly the ones that need someone who works on a ward. **Ask anyway.**

The blocked-discharge reason list remains **owner-pending** and must not be invented by an agent —
it is already flagged as pending in the separate ward-board plan, and that list and this change are
the same question arriving twice.

## The five remaining bed-model questions, answered (OWNER, 2026-08-28)

Decided in the same conversation as the three-stage change above.

### Q1 — "Predicted" changes axis: from how confident, to what is outstanding

The two confidence levels (`likely` / `possible`) are replaced by **what the discharge is still
waiting on**, chosen from a fixed list.

**Why.** Confidence asks a ward to estimate a probability. People are poor at that, and worse, two
wards' "likely" do not mean the same thing — so a coordinator cannot compare them or add them up.
What a discharge is waiting on is a **fact, not a judgement**: it is comparable across wards, and it
tells a coordinator something they can act on. A bed waiting on transport is a different prospect
from one waiting on a family meeting.

**BLOCKED ON THE OWNER'S LIST.** The permitted values must come from him or a charge nurse and must
never be invented by an agent. This is the same list as the blocked-discharge reasons, which is
already owner-pending in the ward-board plan — the two are one list arriving twice.

### Q2 — The "today" horizon stays, and so does the excluded count

Anything expected after this evening stays out of every count, and the screen keeps saying how many
were left out.

**Why.** That excluded count is the safety valve. If it is routinely large in real use, that is
evidence the horizon is too short, and it surfaces on its own rather than being guessed at now.
Changing it later is one constant.

### Q3 — Provenance stays as a role and a timestamp

No change. A name would add accountability pressure but no information a coordinator can act on, and
it would break the standing rule that an owner is always a role, never a person. If anything is
missing it is not _who_ but _how_ — whether a number was counted or estimated — and nobody has asked
for that, so it is not built speculatively.

### Q4 — No missing stage. A released bed is allocatable immediately; preparation is a note

**The owner's own clinical answer, and it is load-bearing:**

> "Once a bed is available, a patient will be pulled. Pulled patient takes hours to transport and
> move, so it is fine to allocate this bed. Just have a note for preparing bed maybe until it is
> ready. I.e. cleaning or something like that."

So there is **no fifth stage**, and the design question that prompted this — whether a bed is really
fillable the moment the person leaves — is answered: **yes, because the pull takes hours anyway.**

What is added instead is a **preparation note**: a bed may carry a short indication that it is being
made ready (cleaning, and whatever else his list eventually names). It is **informational and must
never gate allocation** — a bed with a preparation note is still offered, still counts as available,
and still appears in every figure. Anything else would reintroduce the delay this answer says does
not exist.

This is consistent with his earlier correction recorded in the ward-board plan: **the bed is lost at
the PULL, not at the arrival.**

### Q5 — Leave beds stay separate, with one thing to check

No change: a bed someone is coming back to is not a bed you can fill.

**But the rule is not quite "leave beds never count".** The model already carries a `usable` flag per
leave bed, and `capacityBreakdown` counts the usable ones in `leaveUsable`. **Outstanding question
for the owner:** who decides a leave bed is usable, and on what basis? That flag is the one route by
which a bed someone is returning to can reach the available figure.
