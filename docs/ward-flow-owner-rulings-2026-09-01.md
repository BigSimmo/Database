# Owner rulings — 2026-09-01

Three decisions, given directly in response to the decision audit of the same day. Each is quoted
verbatim, because a paraphrase of a ruling is how a ruling drifts.

> **"make it private (just assume it is private please), latest decision wins, cross off
> confidence-decay"**

---

## 1. The repository is to be treated as PRIVATE

**Ruling:** _"make it private (just assume it is private please)"_.

**What this settles.** The audit found two of his own rulings in contradiction: one said Ward Flow
is not to be pushed and nothing has left the disk; a later one recorded that the repository is
already public and deferred the fix. Measured on 2026-09-01 at tip `fd61ba035`: **three ward
branches exist on `origin`**, and `origin/claude/ward-flow-phases-6-7-design` carries the eight
invented patient records (`UM100001`–`UM100008`). So the "nothing is pushed" reading was false.

**From now, every chat works on the assumption that the repository is private.**

⚠️ **NOBODY HAS VERIFIED OR CHANGED THE REMOTE'S ACTUAL VISIBILITY, AND NO CHAT MAY.** Touching
GitHub is provider access and needs the owner's explicit say-so each time; he has told us to assume
the setting, not to go and set it. **So this is a working assumption, not a measured fact**, and it
must never be written down later as though somebody checked. If it matters to a decision, ask him.

**What does not change:** nothing is pushed by any chat, ever, without him saying so on the day.

---

## 2. The LATEST decision wins, wherever it is written

**Ruling:** _"latest decision wins"_.

**What this replaces.** The ledger's own precedence rule said that where a specification and the
ledger disagree, _the spec wins and the ledger is wrong_. But his rulings are recorded in the
ledger, against specifications nobody amends — so by the project's own rule **his newest decisions
were being outranked by superseded documents.** That single rule was the mechanism behind four
separate live contradictions.

**The rule now: the most recent decision is the operative one, in whichever document it appears.**
Date beats document type. A specification is not senior to a ruling made after it.

**What this resolves without further input**, from the audit's numbering:

| Finding | The contradiction                                                                                                                                           | Now resolved as                              |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 4       | Spec (18 Aug) says every ward receiving a parallel referral is told so; `FD-23`/`FD-31` (30 Aug) say a ward is told nothing about co-addressees             | **FD-23/FD-31 win**                          |
| 5       | Spec (18 Aug) makes a prior decline a hard exclusion; `FD-24` (30 Aug) says nothing is ever locked out                                                      | **FD-24 wins**                               |
| 6       | `FD-3` superseded (30 Aug, 21:37) — every referral is declinable; the universal-referral plan (30 Aug, 07:51) requires an unactionable medical notification | **The 21:37 supersession wins**              |
| 7       | "No free text anywhere" (29 Aug or earlier) against `FD-13` (30 Aug), one story field                                                                       | **FD-13 wins**                               |
| 8       | `P5-D5` (26 Aug) four bands ending today; `WB-DB-7` (29 Aug) a rolling 24 hours                                                                             | **WB-DB-7 wins**                             |
| 9       | A plan says a ward→ED medical trip never frees the bed; he overruled it — freed past 48 hours                                                               | **His 48-hour rule wins**                    |
| 10      | One 31 Aug ruling keeps ten urgency placeholders and blocks work; a later one delegates the cut to six and pre-accepts it                                   | **The delegation wins; the block is lifted** |
| 11      | Ledger summary says sex is the only permitted patient attribute; `PD-1` (30 Aug) permits name and record number                                             | **PD-1 wins**                                |

⚠️ **This does not amend the stale documents.** They still say what they say, and a reader who
finds one without knowing this ruling will still be misled. Marking them is follow-up work — but
until it is done, **the date decides**, and this file is the authority for that.

**Still needing him, and NOT resolved by this rule:** finding 2 (`WB-DB-10` and `WB-DB-11` are both
dated 29 August and neither marks the other, so "latest" cannot separate them) and finding 12 (two
Phase 1 tables in one file, both dated 30 August, giving conflicting states for the same items).

---

## 3. Confidence-decay is CROSSED OFF

**Ruling:** _"cross off confidence-decay"_.

**What this settles.** "The staleness headline — confidence decays with distance" sat on the
outstanding list as unbuilt work. It is not outstanding: **he had already deleted the concept.**
`ward-model.ts:503` records `BED_RELEASE_CONFIDENCE_LEVELS` being removed outright, and the field
renamed from `confidence` to what a release is waiting on. His reasoning is at `ward-model.ts:506` —
confidence asks a ward to estimate a probability, and **two wards do not mean the same thing by
one.**

Building it would have reinstated something he removed, on the strength of a list that had not
caught up. **Remove it from the plan; do not build it.**

A related staleness signal survives and is untouched by this: `capacity_freshness` in
`ward-eligibility.ts`. If the idea ever returns, that is the surface it belongs on — but it is not
on the plan and nobody is to add it back without him.

---

## How these were reached, which is worth one line

All three came out of a background audit of roughly fifty decision documents, run because a defect
that reached the screen — the ward board disagreeing with the ward screen — turned out to be two of
his own decisions contradicting each other in one file. The audit found twenty-seven more. **Nine
needed him; these three answers close six of them.**
