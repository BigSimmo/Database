# Ward Flow — owner decisions, 2026-08-29, and two drafts for review

**THE FOUNDATION, above everything in this document.** Owner, 2026-08-29: *the core principle is
patient flow from the emergency department to the wards. That is the foundation. Everything is built
on it.* Every decision below is subordinate to it, and where one would obstruct the forward flow — or
obstruct someone seeing why it is not happening — the decision is the thing to re-examine, not the
flow.

Three parts. **Part 1** records five decisions the owner made today, so they stop living in a chat.
**Part 2** is now only a pointer — the method moved to a single home after two sessions wrote it twice. **Part 3** offers
three genuinely different mission statements to choose between, rather than one to accept.

---

# Part 1 — Five decisions, 2026-08-29

> **THE `OD-` SERIES IS RETIRED. Owner decision, 2026-08-29.** This document no longer issues
> decision numbers and never will again. Everything below is kept for its owner-facing reasoning and
> its build notes; the identity of every decision lives elsewhere.
>
> **Decision numbering is owned by one session — the tracking ledger.** Nobody else assigns a number.
> Decisions are still made anywhere and their reasoning still lives in the specifications, but the
> ID comes from one place, which makes a collision impossible rather than merely unlikely.
>
> **Why this rule exists, recorded because the mechanism matters more than the instance.** `OD-1` and
> `WB-DB-14` are the same owner decision, recorded twice, hours apart, by two sessions neither of
> which knew the other was recording it. I did not set out to create a second register. I wrote
> decisions in the natural format of my own document and numbered them from one — and it announced
> itself to nobody, including me, until a third session swept for it. Being more careful does not
> prevent that, because nobody felt careless.
>
> **READ THIS BEFORE CITING ANY `OD-` NUMBER. Corrected 2026-08-29 after the ledger session found a
> duplicate.**
>
> These `OD-` entries were written without knowing the ward board specification was recording the
> same owner answers as `WB-DB-` decisions on the same day. **At least one is a straight duplicate:**
> `OD-1` and `WB-DB-14` are the same decision, recorded twice, by two sessions, hours apart. That is
> exactly the fault the tracking ledger was created to prevent, and I caused an instance of it.
>
> **The specification is the authority.** Where an entry below has a `WB-` twin, the spec entry is
> canonical and this one is a pointer carrying the owner-facing reasoning. Where they ever disagree,
> **the spec wins and this file is wrong** — say so and it gets fixed here.
>
> | Here | Canonical | Status |
> | --- | --- | --- |
> | OD-1 receiving-time options | **WB-DB-14** | Duplicate. Cite WB-DB-14 |
> | OD-2 sex on the admission record | **WB-D5** | This records the explicit approval WB-D5 was missing |
> | OD-3 override reasons | **WB-DB-15 (as superseded)** + WB-DB-16 | CLOSED. Duplicate — cite the spec |
> | OD-4 shift handover goes live | *(none)* | Sibling of WB-DB-11, which covered the morning page only |
> | OD-5 clinician check deferred | *(none)* | New |
>
> **The lesson, recorded because it is more useful than the correction:** a second register does not
> announce itself. I created one by writing decisions in the natural format of my own document, and
> the duplication was invisible to both sessions until a third one swept for it. Before opening any
> numbered series, check whether the project already has one.


## OD-1 — The receiving-time options, approved as drafted

**DUPLICATE — cite `WB-DB-14` instead.** The ward board specification records this same owner answer at `WB-DB-14`, written independently the same day. Kept here for its build notes only; the spec is canonical.

When a ward pulls a patient, it states when it can take a handover. The permitted answers, and the
only permitted answers:

- Any time
- Business hours only
- Not overnight
- After the afternoon handover
- Tomorrow, not today

**This closes WB-D15**, the longest-standing open item in the ward board specification, and unblocks the
transport officer's screen — which until now could not show a drop-off window at all and had to
render "not yet recorded".

**Notes for whoever builds it.** These overlap deliberately: a ward may reasonably mean both "not
overnight" and "after the afternoon handover", and the list does not force a single choice between
them. None is a legal figure and none may be converted into one — "not overnight" must never acquire
an hour. Like the other approved lists, no agent may tidy, shorten, reorder or remove an entry.

## OD-2 — Sex belongs on the admission record, explicitly approved

Previously built on inferred consent — the specification flagged it as a small governance widening
and recorded that silence was being read as acceptance. That is no longer the basis: the owner has
approved it outright.

**Why it matters that this was said out loud.** Sex is the single patient attribute this project
permits, and it is load-bearing — it is what makes the ward's male and female acceptance counts
*derived* rather than typed. In a blueprint a health service will read, "nobody objected" is not an
adequate footing for the most sensitive field in the model.

**What the alternative would have cost, recorded so the decision is legible:** the ward types those
two numbers itself and one module changes.

## OD-3 — The override reasons, and the free-text box comes out now

**CLOSED, and this entry is a duplicate — cite `WB-DB-15` (as superseded) and `WB-DB-16`.**

The owner confirmed the five reasons. The canonical record is on the ward board specification:
`WB-DB-15` shipped as four reasons and carries its own superseded-to-five block; `WB-DB-16` records
that there is never an "other, please specify", which is the constraint that keeps free text from
returning through the back door.

**A CITATION CORRECTION, because I had this wrong in two places.** I earlier referred to a withdrawn
no-replacement draft as `WB-DB-15`. That number now names a different decision on the same field —
one that *does* carry a replacement list, so a reader following my citation landed on a real entry
saying close to the opposite. **The withdrawn draft has no number and must be referred to by name:
the withdrawn no-replacement override draft.** Corrected here rather than left, because a burned
number pointing at a plausible wrong answer is exactly the failure this project keeps meeting.

The coordinator's override reason becomes a fixed list:

- The receiving team has agreed despite the mismatch
- Clinical urgency outweighs the mismatch
- The bed information is known to be out of date
- Continuity with a previous admission at this unit
- Closer to the person's home or family

**Deliberately excluded:** "nowhere eligible". That is already its own recorded act — an escalation —
and duplicating it here would create two vocabularies for one fact.

**Do this first, before the list is built.** The current `<textarea>` collects the coordinator's
reasoning, holds it in the screen's memory, and discards it when another patient is selected — while
the governance page states that override reasons are recorded. That is a page making a false claim
about what it keeps, and it is the standing no-free-text constraint being broken in the one place a
clinician is invited to type. Remove the box immediately; the list can follow.

## OD-4 — The shift handover page goes live, and the sheet carries its moment

The handover page currently freezes its figures when it opens. It will read live like every other
screen, and the printed sheet will carry the moment it was taken.

**The reasoning, because reversing a protection needs one.** Freezing was protecting something real:
people in a handover must be discussing the same numbers. But paper already holds still — printing is
what produces a stable artefact, and it does so honestly, with a time on it. Meanwhile a frozen screen
beside a live sheet is two numbers for one thing in one room, which is the failure this programme has
refused everywhere else.

**This completes the pattern begun by WB-DB-11**, which dropped the morning page's frozen view earlier
the same day. Both screens now behave the same way, which was the point.

## OD-5 — The clinician check is deferred, deliberately

**Owner decision, 2026-08-29: not yet.** Asked twice, deferred twice. Recorded as a decision rather
than left as an unanswered question, because a deferral that is never written down becomes an
oversight in three months' time.

**What is being deferred.** The bed model — `predicted → confirmed → released`, with `blocked` as a
flag — has never been read by a ward clinician. It has been revised once, from four stages to three
plus a flag, on the owner's own judgement rather than a ward's. So what exists is the owner's model
of a ward, not a ward's model of itself.

**Three further assumptions sit in the same position** and are worth checking in the same
conversation whenever it happens: that the bed is lost at the pull rather than the arrival; that
wards would in fact maintain their own board daily (the entire ward board rests on this); and that one
discharge date per patient is enough.

**The risk, stated once and not repeated.** It does not sit still. Every screen built on the model
increases what a wrong answer costs — not because the check gets harder, but because more has to
change if the answer is no. The method (Part 2 below) does not expire and is ready whenever he wants
it.

**The trigger to revisit, proposed rather than imposed: before anyone in the health service sees
it.** Showing an unvalidated model to the service that might adopt it is the most expensive possible
ordering, and it is the one moment where the deferral stops being cheap. Fifteen minutes beforehand
buys the whole demonstration.

---

# Part 2 — How to run the clinician check → MOVED

**This section has been retired to a pointer, 2026-08-29. The method lives in one place:**

> `docs/ward-flow-clinician-check-method.md` on branch `claude/Ward-design`

**Why it moved.** Two sessions wrote this document independently on the same day, without either
knowing the other was writing it — about seventy per cent overlapping, each with sections the other
lacked. That file is the better home: it is a standalone page the owner opens when he is about to do
the thing, where this was part two of a document about five decisions and would only be found by
someone reading about something else.

**Everything that was here is in that file**, credited by section: who to ask and why the nurse unit
manager usually knows this better than the consultant; the ordering rule (ask them to describe it
before showing them anything, or the exercise returns agreement instead of information); the five
things to listen for, of which the fifth — *what did they mention that the model has no place for* —
is the one most easily missed, because a thing the model cannot represent never arrives as an
objection, it arrives as a digression on the way to answering something else; the status-gradient
trap and its counter, *ask for the exception, not the rule*; and the practicalities — fifteen minutes
not five, and never by email, because a hesitation before "yes, that's about right" is the finding
and it does not survive being typed.

**And one thing that was NOT here and is the best idea in either document:** decide what counts as a
"no" before you go in. Without it every answer becomes "yes, with nuance", and the check returns a
pass for reasons unrelated to whether the model is right.

---

# Part 3 — Three mission statements, to choose between

Not three wordings of one idea. Three different arguments, for three different rooms. Pick the frame
first, then we polish the words.

## Option A — Lead with the gap (problem-first)

> **Bed flow is a two-sided equation, and only one side is managed.** Services count the beds they
> have. Almost nobody counts the beds they are about to get back, or knows who is ready to leave and
> cannot.
>
> **Ward Flow is a prototype of a statewide hub for psychiatric bed flow in Western Australia.** It
> follows one person from a community team's decision to admit, through the emergency department, to
> a ward, and out again through discharge — and gives every role in that pathway a screen showing
> what only they can know, because a coordinator's view is worth exactly what the people around them
> put into it.
>
> It runs on synthetic data, holds no patient information, and is not clinical decision support. It
> proposes nothing, predicts nothing and ranks nobody. Every figure traces back to a person who
> entered it and the moment they did.

**Best for:** a room that already knows bed flow is hard and wants to know whether you understand
*why*. **Risk:** the opening claim is the strongest thing in the document, and a bed coordinator may
push back on it immediately. Only use it if you believe it survives that.

## Option B — Lead with the person (journey-first)

> **Ward Flow follows one person from the moment a community team decides they need admission to the
> moment their bed is free again.**
>
> Along the way it gives the ward, the emergency department, the community team and the transport
> officer each a screen showing what only they can know — and gives the statewide coordinator the one
> view nobody currently has: where there is a bed right now, and where there is about to be one.
>
> It is a prototype running on synthetic data. It holds no patient information, is not clinical
> decision support, and makes no recommendation about any patient. Its purpose is to make the shape
> of such a system concrete enough to argue with.

**Best for:** a mixed clinical audience, and the safest of the three. **Risk:** it describes what the
system does without saying why it should exist, so it can read as a tool looking for a problem.

## Option C — Lead with the role (coordinator-first)

> **A statewide bed coordinator has to answer one question all day: where is there a bed for this
> person?** Today that answer is assembled by telephone, and it is out of date by the time it is
> complete.
>
> **Ward Flow is a prototype of the system that would answer it.** It follows a person from the
> community decision to admit, through the emergency department, to a ward and out through discharge,
> and it gives every role along that path a screen for contributing what only they know.
>
> It runs on synthetic data, holds no patient information, and is not clinical decision support. It
> decides nothing and recommends nobody — it shows what people have entered, and when.

**Best for:** an operational or executive audience deciding whether to fund or adopt. **Risk:** the
"assembled by telephone" line is a claim about how the service works today. It is almost certainly
true and it is also the kind of sentence someone in the room may take personally. Only use it if you
are willing to defend it.

## The three choices underneath all three

1. **"Prototype" or "working demonstration"?** Prototype is honest and lowers expectations. Working
   demonstration serves better with an adopter, without overclaiming — you have a route into a health
   service now, which argues for the second.
2. **Keep "concrete enough to argue with"?** It states that disagreement is the intended outcome. To
   a clinical audience that is disarming and true. To an executive weighing adoption it may read as
   unfinished. It is the line most worth deciding deliberately.
3. **How hard to state "not clinical decision support"?** It appears in all three. Given a real
   adopter, it should also be on the screens themselves, not only in documents.

## A one-line version, for an email or an introduction

> *A prototype of a statewide hub for psychiatric bed flow — following one person from the decision
> to admit through to their bed being free again, on entirely synthetic data.*
