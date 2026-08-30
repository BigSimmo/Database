# Ward Flow Phase 9 — decisions taken during the autonomous session

**Written 2026-08-28**, while the product owner was away and had authorised decisions to be made on
his behalf, grounded in the repository. Companion to `docs/ward-flow-phase-8-9-questions.md`, which
states the questions; this states the answers.

**Only the owner's own answers are marked OWNER.** Everything marked SESSION was decided by this
session from that document's own recommendations, and is reversible — each entry says what reversing
it costs.

**Why these are being settled now, and not earlier.** The questions document's own instruction was:
"do not write Phase 9's specification in detail until Phase 7's referral board and its list of
outcomes are finished", because waiting-time equity, ownership clocks, notifications and the
escalation board all attach to that queue, and it had already changed shape twice. **Phase 7's build
is now complete** — the board, the match view, the intake form, the outcomes and the demand figure
are all built, reviewed and green — so the precondition is met.

> ## ⚠️ ALL NINE DECISIONS BELOW WERE CUT BY THE OWNER ON 2026-08-30, BEFORE ANY OF THEM WAS BUILT
>
> **The decisions still stand. The builds do not.** Those are two different things and this page is
> the only place they can be told apart, so the distinction is repeated at every decision rather than
> stated once here — a cut list is a document you have to already know exists; a decision is a
> document you arrive at.
>
> **What this means for a reader who finds one of these:**
>
> - **Do not re-litigate it.** It was decided, with its reasoning and its reversal cost recorded. If
>   the question comes up again, this is the answer, not an open item.
> - **Do not treat the missing implementation as a gap, an oversight, or a backlog row.** The absence
>   is intended. Nothing here is waiting to be built, and nothing here was forgotten.
> - **Do not restore one because it looks unfinished.** Every entry below is deliberately unbuilt.
>
> **The precedent is the medical-ward arm**, whose reason sits in `ward-model.ts` where the arm would
> have been rather than in a list somewhere else. A decision recorded away from the thing it governs
> is a decision waiting on a coincidence to be found.

---

## The rule this phase is built to

Phase 8's hazard was distance. **Phase 9's is legal appearance.**

The questions document names it exactly: "Phase 9's ownership clocks are the highest-risk surface
either phase contains: a red countdown at an invented threshold, on a screen full of legal-sounding
language, is exactly the thing the unbuilt statutory clock board exists to refuse."

That is not hypothetical here. This codebase has already carried an invented Form 1A deadline,
written in from an assistant's recollection rather than from a clinician, and the owner removed it on
2026-08-23. So the standing rule for every decision below:

> **Any threshold at which something on screen changes colour, escalates, or reads as overdue is
> invented, and the screen says so where a reader can see it. No figure, timeframe, threshold or
> duration from the Mental Health Act appears anywhere — code, copy, comment, test or fixture. A
> plain Voluntary/Involuntary label is permitted and is not a legal figure.**

---

## D9-1 — The wait becomes prominent, and its ceiling is removed; it never outranks urgency (SESSION)

> **CUT by the owner, 2026-08-30, before it was built. The decision below still stands; the build does not, and its absence is intended rather than outstanding.**
>
> **THE OWNER HAS ANSWERED THE QUESTION THIS DECISION RESERVED TO HIM, AND POINT 3 STANDS.**
>
> He first ruled, 2026-08-30: _"A long wait always is prioritised... however... in certain cases patients can be marked as urgent for many reasons which outranks everything. Otherwise go by time for the main level of urgency."_ Read literally that made TIME the main ordering, where point 3 makes urgency the primary sort and orders the wait within it. Both give an urgent patient the next bed; they differ about everyone else, which is most of the queue. **Put to him as that difference rather than resolved on his behalf**, he confirmed the same day: _"Ok I agree with that rule"_ — the rule being point 3. **So urgency remains the primary sort, the wait orders within a tier, and a long wait never lifts somebody above a more urgent person.** The refusal in point 3 is now the owner's own, not a session's.
>
> **AND HE ADDED A CONSTRAINT THAT IS NOT IN THIS DECISION:** _"patients must met a certain high threshold to be marked as urgent"_. **This is a safeguard against the failure that a top-outranking tier invites** — if urgency overrides everything and is easy to apply, urgency inflates until the tier means nothing and the wait ordering underneath it stops mattering. It is a real requirement and it is recorded here as his words.
>
> ⚠️ **HOW that threshold is expressed is NOT decided, and it must not be guessed, because two of this project's standing refusals meet at exactly this point.** _Nothing predicts, scores or ranks a person_, and _no figure, timeframe or threshold from the Mental Health Act, anywhere_. A numeric threshold the software applies would breach the first; a sourced clinical one would breach the second unless it has a named owner and a real source. **The shape that satisfies both is a short fixed list of stated reasons a human picks from, with who marked it and when recorded and visible — a human declaring urgency against criteria, never software computing it.** That is the same shape already used for decline reasons and for escalation, which `D9-2` records as declared by a human and never triggered by a threshold. **Recommended, not decided.**

Three things, and the third is a refusal:

1. **Show the wait far more prominently.** Length of wait carries the moral weight and is currently
   secondary everywhere it appears.
2. **Remove the ceiling.** Today a wait stops counting after about ten hours, so a twenty-hour wait
   and a ten-hour wait score identically. That is the actual defect. Removing it lets a very long
   wait keep climbing — **still only within its own urgency tier**.
3. **A long wait never lifts someone above a more urgent person.** Option C in the questions document
   would have the software override a clinician's urgency judgement. **That is the owner's alone to
   authorise and it is not taken here.** It is a different product, and it must not be built because
   it looked like the natural next step.

**Already half-shipped.** Phase 7's referral board already renders the wait prominently on every
queued row and orders by urgency tier then longest wait. This phase extends the same treatment to the
movement queue, where the ceiling actually lives.

**Cost to reverse:** the ceiling is one clamp in `operationalScore`. Prominence is layout.

## D9-2 — Declaring escalation records it and marks the screens, and changes nothing else (SESSION, and partly blocked)

> **CUT by the owner, 2026-08-30, before it was built. The decision below still stands; the build does not, and its absence is intended rather than outstanding.**

A human declares escalation; the screens show that it was declared, by which role and when. Nothing
is relaxed, no beds normally held back become offerable, and no checklist of correct practice
appears.

**Why.** Both richer options require a fact nobody has. Relaxing something needs to know what a real
service actually relaxes; a checklist is a claim about correct practice, and that comes from the
owner, not from us. **A** asserts nothing.

**Blocked, and it must not be worked around:** whether named escalation levels are in real use for WA
mental health bed pressure is section 3's third question and is unanswered. If real named levels
exist, using their names asserts something real about a real system. If they do not, **whatever they
are called must be visibly invented on screen.** Until the owner answers, the levels are numbered and
labelled as this prototype's own.

Whether escalation is declared **per site or once for the whole state** is an operational fact and is
the owner's to state directly. Until then: **statewide**, because the network is presented as one
network everywhere else in this prototype and a per-site version can be added without unpicking it.

**Cost to reverse:** the names are data; the per-site question is one scope field.

## D9-3 — The retrospective is one person's journey replayed, plus the ward prediction track record last (SESSION)

> **CUT by the owner, 2026-08-30, before it was built. The decision below still stands; the build does not, and its absence is intended rather than outstanding.**

Two of the four options are built, one is deferred, one is refused.

- **Built: one person's journey, replayed** — every step and how long each took. It answers the
  question a coordinator actually asks after something has gone badly, and it contains **no new fact
  about anyone**, which is why it is first.
- **Built last: the ward prediction track record** — how often each ward's predictions came true. The
  owner already agreed to this item. It is scheduled **last in the phase** because it is the one item
  in either phase exposed to the unvalidated four-stage bed model. If the clinician check comes back
  and the model is wrong, this is the only thing that has to change.
- **Deferred: yesterday's morning page beside today's.** Worth having, and it is its own decision
  because it puts a trend beside a page whose entire purpose is holding still. It also needs the
  memory below.
- **Refused: service-level statistics for the week.** That is performance reporting on invented
  numbers, which is precisely what roadmap decision 10 warns against.

**Cost to reverse:** the journey replay reads existing events and stores nothing; deleting it removes
a screen and nothing else.

## D9-4 — An ownership clock measures what is owed, and its colour threshold is invented and says so (SESSION — the highest-risk decision in the phase)

> **CUT by the owner, 2026-08-30, before it was built. The decision below still stands; the build does not, and its absence is intended rather than outstanding.**

The clock measures **time since this role was asked to do something specific and has not yet done
it**, falling back to **time since the role took the movement on** where there is no specific ask.
That is the only version that says what is actually owed, and it is what makes a handover
conversation shorter.

**The absolute limit, and it is the whole point of this entry.** If the clock changes colour when it
runs long, **the point at which it does is invented.** It must never be presented as a standard, a
target, a deadline, or anything with legal weight, and the screen must say plainly that the threshold
is one this prototype chose. This is the screen most likely to accidentally look like a statutory
clock board — which is exactly the thing roadmap decision 16 refuses to build.

Three specific prohibitions, each because a version of it has already happened here:

- **No duration constant in `ward-model.ts` without a real provenance entry.**
  `tests/ward-legal-figure-guard.test.ts` enforces this by the _shape_ of the declaration, and it
  caught a new constant on this branch today. Do not dodge it by putting the constant elsewhere.
- **No word implying a legal consequence** — expired, breached, overdue, in default, non-compliant.
  "Waiting longer than this prototype's own threshold" is honest; "overdue" is not.
- **No red countdown counting _down_ to anything.** Count up from when the ask was made. A countdown
  implies a deadline exists.

**Cost to reverse:** the fallback is one branch; the colour threshold is one constant and one line of
copy. The wording rules cost nothing to keep and are expensive to reintroduce after someone has read
the screen as legal.

## D9-5 — A notification fires only where someone is waiting on someone else (SESSION)

> **CUT by the owner, 2026-08-30, before it was built. The decision below still stands; the build does not, and its absence is intended rather than outstanding.**

A bed offered; a bed accepted or declined; a held bed about to lapse; transport booked. Four or five
a shift, each with a person on the other end who needs to act.

**Why not every change of state.** A notification list nobody reads is worse than no list, because it
looks like communication happened. That is the failure mode, not the volume.

The mechanism is already settled by roadmap decision 9 and is unchanged: in-app, plus a simulated
outbound log showing exactly what would be sent, with **nothing ever sending**, and content limited
to the movement identifier and what needs doing.

**"A held bed about to lapse" carries the same hazard as D9-4** — "about to" needs a threshold, and
that threshold is invented. Same rule: label it, never imply it is a standard.

**Cost to reverse:** the event list is data.

## D9-6 — Anything flagged at a handover stays flagged until someone clears it (SESSION)

> **CUT by the owner, 2026-08-30, before it was built. The decision below still stands; the build does not, and its absence is intended rather than outstanding.**

Today each shift takes a fresh picture, so something raised at the 08:00 handover can be silently
gone by the evening one with nobody noticing. Flagged items now persist until explicitly cleared, and
who cleared it and when is recorded — as a **role**, never a person, per roadmap decision 8.

**Why not the fuller version** (last handover shown beside what is true now): it needs the stored
memory in D9-8, which is real work rather than a screen. This is the smallest change that makes
"continuity" mean something and it needs no new machinery.

**Cost to reverse:** one flag and one clearing event.

## D9-7 — Navigation is grouped by role, with the coordinator's own section grouped by question (SESSION)

> **CUT by the owner, 2026-08-30, before it was built. The decision below still stands; the build does not, and its absence is intended rather than outstanding.**

Seventeen screens today, more than twenty after Phases 7 and 8, in a grouping that was never designed
— it accumulated.

Group by **who you are**: coordinator, ward, emergency department, transport, community team. The
hub's own description is that each role needs a real screen to contribute what only they know, so
grouping the navigation the same way makes the product explain itself. Anyone arriving wears one hat
— **except the coordinator**, whose section is large and whose day is a sequence of questions, so
**inside** that section the grouping is by question: where is there a bed, who is stuck, what
happened, what is coming.

**Cost to reverse:** navigation data. But note the six fail-closed registration sites: regrouping is
cheap, _moving a route_ is not, and every route must stay registered everywhere. Run
`check-registration.sh`, never a hand-picked subset.

## D9-8 — The prototype's memory is its own scoped item, never assumed into a screen (SESSION)

> **CUT by the owner, 2026-08-30, before it was built. The decision below still stands; the build does not, and its absence is intended rather than outstanding.**

The prototype has no memory. The demo clock moves forward and resets, and nothing survives from one
run to the next. **Both the deferred half of D9-3 and the fuller half of D9-6 need that, and it is
real work rather than a screen.**

It is therefore scoped as its own item and scheduled **after** everything above, so that a phase full
of screens is not silently blocked on infrastructure nobody costed. Everything decided above is
deliberately chosen to need none of it.

**Cost to reverse:** nothing is built that would have to be unbuilt.

## D9-9 — Waiting-time equity and the out-of-area ledger are designed knowing about each other (SESSION)

> **CUT by the owner, 2026-08-30, before it was built. The decision below still stands; the build does not, and its absence is intended rather than outstanding.**

Phase 8's out-of-area ledger is where **geographic** fairness lives. D9-1's waiting-time work is
where **time-based** fairness lives. They are two halves of one idea and ship in different phases, so
the risk is two screens answering the same question in different words — this project's most
expensive defect class, which appeared **three separate times** during Phase 7 alone.

So: one shared vocabulary for both, one function per figure, and neither screen computes a figure of
its own. Where they name the same quantity they use the same words, by importing the same function
rather than by two files agreeing — the fix that closed the urgency-tier defect.

---

## What I did not decide, and will not

1. **Whether named escalation levels exist in real use in WA.** Blocks the naming half of D9-2.
   Until answered, the levels are visibly this prototype's own.
2. **Whether escalation is declared per site or statewide.** An operational fact. Statewide until the
   owner says otherwise, and cheap to change.
3. **Whether a long wait should ever outrank a more urgent person** (P9-1 option C). The only option
   that changes who gets the next bed. **The owner's alone.**
4. **What a real service actually relaxes when it escalates**, and what correct practice is at each
   level. Blocks the richer halves of D9-2.
5. **The four-stage bed model**, still never put to a ward clinician. Phase 9 has exactly one item
   exposed to it — the ward prediction track record — and that item is scheduled last for this
   reason. `docs/ward-flow-clinician-check.md` is the one-page summary waiting to go out. **This
   remains the cheapest, highest-value thing available and only he can do it.**
6. **Any Mental Health Act figure.** None is needed and none will be written.
