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

| Dimension        | Values                      |
| ---------------- | --------------------------- |
| **Age**          | Older Adult · Adult · Youth |
| **Legal status** | Voluntary · Involuntary     |
| **Sex**          | Female Bed · Male Bed       |
| **Forensic**     | Forensic                    |

A bed is therefore described by a combination — an _Adult, Involuntary, Male_ bed — rather than by
picking one label from a list.

**Two readings assumed pending confirmation**, both cheap to change and both flagged to the owner:

1. **Forensic is treated as its own fourth dimension**, so an "Adult, Involuntary, Male, Forensic"
   bed is expressible, rather than Forensic standing alone and replacing the other three.
2. **Every bed is designated Female or Male.** No undesignated or mixed beds.

If either is wrong, correct it here before the Phase 7 specification is written.

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

## Still open

- The two assumed readings of the bed-category model, above.
- Everything the clinician check comes back with.
