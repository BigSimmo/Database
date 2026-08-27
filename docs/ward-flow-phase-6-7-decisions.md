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

## Still open

- Everything the clinician check comes back with.
- **Two questions raised by the design conversation and left with the owner**, neither of which
  blocks implementation. Both are written up in full at the foot of each specification.
  1. The site table uses **real WA hospital names** beside invented units and bed numbers. Phase 6 is
     the first page built to be printed and shown around, and Phase 7 adds invented youth units to
     that table. Should the sites become clearly synthetic first, or is the banner enough?
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
