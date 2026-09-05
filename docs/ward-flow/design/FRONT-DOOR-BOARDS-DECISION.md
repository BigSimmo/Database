# Front-door boards — the locked design

**Owner decision, 2026-09-05.** The design published as
`prototypes/mockup-front-doors-v5.html` is locked and is what gets built.

This record exists because that design **departs from
[`prototypes/DESIGN-LANGUAGE.md`](prototypes/DESIGN-LANGUAGE.md)**, which was the owner's choice on
2026-09-03 and says in its own second sentence that it governs _every_ Ward Flow surface.

⚠️ **`DESIGN-LANGUAGE.md` IS UNCHANGED, AND THAT IS THE POINT.** An earlier version of this record
prepended a "superseded in part" banner to it, attributed to an owner decision. **There was no
such decision.** The owner said "lock in this design", which is authority to freeze _this mockup_ —
not authority to alter the document that governs eleven other screens. The banner was my inference,
and it named the owner as its source, which is worse than leaving it unattributed: a reader would
have had no way to tell an inference from a ruling. It has been removed and the file verified
byte-identical to its prior state.

**So this is a recorded divergence, not a supersession.** These three boards are built differently
and this file says exactly how and why. `DESIGN-LANGUAGE.md` stands as written and still governs
everything it claimed to, including — on the question of whether it should change — these three
screens. Only the owner can answer that, and it is question 1 at the foot of this file.

**The lesson, because it will catch the next person.** "Lock in this design" is ambiguous between
_freeze this artefact_ and _make this the standard_. Two sessions took it the larger way on the same
day, and in both cases the larger reading happened to ratify the work that session had just
finished. **That is the direction ambiguity resolves when nobody checks.** Take the smaller reading
and ask.

---

## Scope — what this decision covers, and what it does not

| Covered by this record         | Still governed by `DESIGN-LANGUAGE.md`               |
| ------------------------------ | ---------------------------------------------------- |
| The ward patient board         | The patient detail screen                            |
| The emergency-department board | The referral screen                                  |
| The community-team board       | Search, statistics, transport, ward entry, ward home |

Measured 2026-09-05 by grepping `class="shell"` across `prototypes/*.html`: **11 of the 15
prototypes carry the Board frame, 4 carry this one.** So this decision is currently the minority
language in that directory, deliberately. Whether it should spread to the remaining screens is a
separate owner decision and is **not** taken here.

⚠️ **Do not "harmonise" the other eleven prototypes to this record on your own initiative.** A
sweep like that is a design decision wearing the clothes of a tidy-up.

---

## The one instruction these three boards depart from

**Departed from:** the instruction to copy `community-home.html`'s `<style>` block verbatim as the
source of colour, type and spacing. It is still in force for every other screen.

**What they use instead:** `src/app/ckb-v2-tokens.css` — the repository's own design system, ranked
#2 under `AGENTS.md` per `docs/design-system/SPEC.md`. The prototype inlines that file verbatim and
adds nothing but layout below it.

**The reason, in one sentence:** the built screens will live inside the application, where the
ckb-v2 layer is already mounted on the root element, so a screen styled from a copied prototype
block would have to be re-derived against ckb-v2 the moment it became real code — and a
re-derivation nobody schedules is how a second design system gets born.

### Everything else in `DESIGN-LANGUAGE.md` binds these boards too

These are not restated because they changed. They are restated because a reader who sees one
instruction departed from tends to assume the rest went with it, and it did not. **All eight bind
these three boards exactly as they bind every other screen:**

1. **Tokens only. No raw hex.** A colour the token layer does not have is a finding to report, not
   a hex to invent.
2. **State is worded as well as coloured.** Every chip carries text; colour may only reinforce a
   word already present. This is gated in CI.
3. **Contrast floor 4.5:1 for text.** Compute it, do not eyeball it.
4. **Figures are `tabular-nums`, set in a monospaced face.** Anything compared down a column
   lines up.
5. **Absence is stated, never blank.** An empty panel says why it is empty and what the absence
   means.
6. **The whole "Real data you may use" section**, including the twenty-three units across
   seventeen sites, the eight emergency departments, the sixteen community teams and their suburb
   counts, and the verified suburb → team pairs.
7. **Never invent a phone number, an address, a record number, or a person's name that could be
   mistaken for real.** The prototype honours this: its eight people are the repository's own
   seeded patients (`ward-patients-seed.ts`, UM100001–UM100008) and its five form codes are the
   five `SELECTABLE_LEGAL_FORMS` the model actually offers.
8. **The invented / real footnote discipline**, so the owner can find every invented figure later.

---

## Where the locked design conflicts with a rule that is still in force

Six were found. Each is a **defect in the prototype**, not a licence to drop the rule — the
prototype gets corrected, the rule stands. Five are fixed; one is not a builder's to take.

| Rule                                                                                                          | What the prototype did                                                                                                                                                                                                                                       | State                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| A zero renders as the word **"none"**, never `0` — "a nought reads as a measurement, 'none' reads as a state" | Rendered `↓ 0` / `↑ 0`                                                                                                                                                                                                                                       | **Fixed** — renders "none in" / "none out"                                                                                                      |
| Rows are links, because every row is somewhere you would go next                                              | Board rows were not links                                                                                                                                                                                                                                    | **Fixed**                                                                                                                                       |
| **Contrast floor 4.5:1 for text**                                                                             | Used `--text-soft` (3.07:1, marked decoration-only in its own token file) as a text colour in **22 places** — the UMRN column, every date of birth, every decision reference and its outstanding-time, the timer legend, the sort headers, the filter counts | **Fixed** — all now `--text-muted`; the one survivor is the form pill's caret, a glyph                                                          |
| **State is worded as well as coloured**                                                                       | Five lane rows drawn red carried no word at all                                                                                                                                                                                                              | **Fixed** — `person()` now takes the _word_, not a boolean, so a red row cannot be authored without one                                         |
| **State is worded as well as coloured**                                                                       | Each board's flagged decision showed a red "do this first" rule while carrying the **smallest** elapsed time of the three (3h 10m against 26h and 13h 24m) — colour and the only number in the row disagreed                                                 | **Fixed** — every flagged decision states its reason: "Do this first — a legal form lapses at 18:00". The reason is a deadline, not a duration. |
| Figures are tabular                                                                                           | Four classes carrying figures were not                                                                                                                                                                                                                       | **Fixed**                                                                                                                                       |
| Direction is carried by an arrow inside the path: `←` inbound, `→` outbound                                   | The boards use `↓` inbound and `↑` outbound                                                                                                                                                                                                                  | **Open — owner's call.** Until it is taken, do not change either.                                                                               |

⚠️ **All five fixed defects were found only because a peer asked whether the boards keep the five
rules, and noted that a "yes" would make the owner's outstanding question smaller.** Nothing failed;
no gate covers any of them. The measurement is what found them, and it was nearly not taken.

---

## The design, in the terms a builder needs

**Canonical source:** `prototypes/mockup-front-doors-v5.html`. Published artifact:
`https://claude.ai/code/artifact/48d467e3-99e2-446c-8f97-416b384e08d8`.

⚠️ **The URL previously recorded here — `f63c98d1-532d-475f-a507-564d98aadf36` — did not
exist.** It was checked on 2026-09-05 against the owner's own artifact list and resolved to nothing:
not deleted-and-listed, simply absent. **Anyone sent to review the locked design by that link would
have found a dead page, and the record would still have read as though the design had been
published.** The design was described in this file, discussed and locked without anybody following
its own citation.

**No checker covers this.** `scripts/check-ward-citations.mjs` verifies every backticked SHA and
repository path in the ward documents against six branches — an artifact URL is neither, so a
document can carry a dead external link through every gate this project has. The remedy applied here
was to publish the file and paste the real URL back; the general remedy is not taken here.

### The one repeated shape

Every block on the page is the same object — a `.module`: a one-pixel border, `--radius-xl`, a
header strip carrying an uppercase title, an optional count, and an optional right-aligned hint.
There is no second card shape and no shadow. **Border owns the edge; nothing owns lift.**

### The five parts of a board, in order

1. **Identity + timer**, side by side above the fold. Identity carries the eyebrow, one headline
   sentence that states the problem rather than naming the screen, and a row of count chips.
2. **Needs a decision** — the queue. Each entry: reference, how long it has been outstanding, one
   plain sentence saying what is wrong and who it is waiting on, then a filled primary button
   naming the action, with quiet secondary actions beside it. The first entry carries a red inset
   rule; no other entry does.
3. **The board itself** — the patient table on the ward screen; on ED and community, this is where
   the flow lanes sit instead.
4. **Coming in / going out** — two lanes side by side, each with **its own time axis**, because
   "since referral" and "owed a move" are different clocks and must never be ranked on one scale.
5. **Seen in the last 24 hours** — the work-done list, and the only part of the page that looks
   backwards.

Then the footnote: what is real, what is invented, and one screen-specific caution.

### The timer

Not a progress bar. **One block per hour of the target**, so a reader can count them rather than
estimate a proportion. Blocks past the target are red and are _additional_ — a twenty-six-hour
wait against a twenty-four-hour target draws twenty-six blocks, twenty-four dark and two red. The
figure above it is the only large red number on the page.

### The patient board columns

UMRN · Patient (name, year, age) · Bed (bed, then unit beneath) · Form · Story — presenting
complaint · Review · Plan · Referrals.

**The form cell is a control, not a label.** It offers the five codes the model holds — 1A, 3B, 3D,
4A, 4C — and the module header states that list, so a reader knows the whole vocabulary without
opening the control.

**The review cell is the only place absence is loud.** "Not seen today" is red. This is deliberate
and it is also the page's biggest risk: it must never be read as "this person was not seen". The
footnote says so in those words, and that footnote is not optional decoration — it is the sentence
that keeps the column honest.

### Colour

One accent, `--danger-solid`, spent in four places only: the breach blocks on the timer, the
timer's own figure, the inset rule on the first decision, and "Not seen today". Everything else is
ink, muted ink, and one inset grey. There is no second hue anywhere on the page.

---

## What this decision does not settle — the owner's, not a builder's

1. **Does `DESIGN-LANGUAGE.md` change at all?** It currently says it governs every Ward Flow
   surface, and these three boards do not follow one of its instructions. Either the document gains
   an exception for them, or these boards are brought back into line. **Nobody has asked.** Until
   somebody does, the document stands exactly as written and this file records the divergence.
2. Whether the remaining eleven prototypes move to this language.
3. The arrow convention (`←/→` versus `↓/↑`).

- Any figure on the prototype. Every patient, wait, story, plan and review time is invented and is
  listed as such at the foot of the page. They are placeholders for real synthetic data drawn from
  the running model, not content to preserve.
