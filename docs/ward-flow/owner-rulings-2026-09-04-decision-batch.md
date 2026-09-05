# Owner rulings, 2026-09-04 — the decision batch

**Seventeen of nineteen items settled in one sitting.** Recorded by Ward Lead from the owner's own
messages. **Where a sentence is in quotation marks it is verbatim; everything else is a paraphrase
and is marked as one.** That distinction exists because roughly sixteen earlier "decisions" were
paraphrase under a tag that read as quotation, and this batch is not repeating it.

---

## R-B-01 — The delay reasons: **eleven, and the list must stay cheap to change**

**Verbatim:** _"Yes to your recommendations please with addition to add or remove in the future
easily."_

The nine, plus the two proposed: **awaiting a decision from the coordinator** (previously
unrecordable, which flattered the coordinator) and **out of area, awaiting a return**.

**The standing requirement is his and is not an inference:** adding a twelfth must be a one-line
change with no migration.

⚠️ **The nine were previously tagged as his ruling and were not.** He ruled that there should BE a
fixed list; he had never seen its membership, had asked to see it, and had not answered. **They are
genuinely his as of now — which is exactly when it becomes easy to forget the tag was false
yesterday. Both states are recorded in the implementing commit.**

---

## R-B-02 — Showing a bed holds nothing. **The question is retired, not parked.**

**Verbatim:** _"A ward has to manually accept the referral..... no referral can be pulled unless the
ward accepts in... then the bed is gone. Also... if any coordinator moves a patient, it applies the
other rule of withdrawing the bed."_

**So the board is a noticeboard and the ward's acceptance IS the hold.** No temporary hold, no
expiry, no race handling, no fourth kind of claim. `ward-contention.ts`'s comment asking for a ruling
before anyone tests on claim kind is closed by this, and should be closed explicitly rather than
deleted — the next person will have the same idea.

⚠️ **Ward Lead over-framed this question and the owner corrected the framing, not just the answer.**
It was presented as a question about his world. It was really a question about whether to add
machinery nobody had asked for: the software showing a bed was never the act that mattered, because
the referral is, and the acceptance settles it.

**What survives is information rather than mechanism.** Nothing needs to stop two patients being
counted on one bed. But no screen says it is happening, and a coordinator looking at a ward's single
free bed cannot see two others are waiting on it. `contention()` and `contentionPairs()` report
exactly that and change nothing.

---

## R-B-03 — A human accepts **the arrangement, row by row**

**Paraphrase — he answered "B" to a lettered choice.** The board composes a whole-board arrangement;
nothing commits until each patient's row has been individually accepted, changed or refused.

**Wholesale one-click acceptance is rejected** and should not be revisited without new reasoning that
addresses the information content of the act rather than the number of clicks.

---

## R-B-04 — The three "never ranks" banners change

**Paraphrase — "Go ahead with your recommendation".** The recommendation was: change all three, and
**require the replacement to be true of software that already ranks, not software about to.**

**The agreed wording shares one reason clause across all three so they cannot drift apart:** _"It
places nobody: a coordinator decides every placement, one at a time."_ Verified against the reducer —
`ACCEPT_IN_PRINCIPLE` and `ACCEPT_REFERRAL` each carry a single `unitId`, so no event can place more
than one patient in one act.

⚠️ **"This board does not rank" was measured TRUE of all three screens and rejected anyway** — a
per-screen truth that reads as a product claim is the trap the person-screen disclaimer survived
strict parsing on. **"It places nobody" does not expire when matching ships.**

---

## R-B-05 — Bed states: **option 2**, and bed numbers stay on the table

**Verbatim:** _"Go ahead with our recommendations please option 2"_ and _"Consider adding bed numbers
in the future"._

Four boxes that add up — Open · Pulled · Closed · Occupied — plus **Pending** and **On leave** shown
beside them and visibly marked as beds already counted inside the four.

**The second sentence is a standing note, not a hope.** Option 2 leaves per-bed records reachable;
option 1 would have closed that door. **The reason a door is open is the first thing lost, so it is
recorded beside the choice.**

**Three things this requires that are not wording:** Pulled becomes a real number counted from the
admissions; the disagreement about where a pulled bed sits must be settled (the seed puts it in
Occupied, a live pull puts it in Held); and Pending must be capped inside the free beds.

---

## R-B-06 — A referral points **one way**

**Verbatim:** _"Refuse to create the referral. If a patient needs an inpatient admission then they
are not going to need community care. However... community referrals can come when a patient is from
ED or from the ward as they are likely to be discharge planning."_

    ED or ward -> community team              allowed (discharge planning)
    community team -> ED or ward              allowed (unwell, needs a bed)
    ED -> ward, ward -> ward                  allowed (still a bed request)
    a bed AND community care in one referral  REFUSED, with a message saying why

**Someone who genuinely needs both gets two referrals at two different times**, which is also what
happens in practice.

⚠️ **THIS REVERSES AN EARLIER ANSWER IN THE SAME SITTING AND THE LATER ONE WINS.** He first said yes,
show a mixed referral on the coordinator's screen. Having thought about it he ruled that one cannot be
created. **So the coordinator-screen display question dissolves rather than being answered.**

**One check outstanding before this is built:** whether anyone ever refers TO an emergency department
as part of discharge planning. The rule as written would block it.

---

## R-B-07 — Death, absconding and police custody free a bed

**Verbatim:** _"Yes free bed"._

---

## R-B-08 — Build the override-reason box

**Paraphrase — "Yes to your recommendation".** The engine accepts a placement that fails a
suitability check if a reason is recorded; no screen has the box, so the override is currently
unreachable. **Half-built, "override is possible but always recorded" had become "override is
impossible", which is a different clinical policy.**

---

## R-B-09 — "Ready", everywhere

**Paraphrase — "Yes to your recommendation".** One word for `min(allocatable, empty)`, replacing
seven.

## R-B-10 — The cluster header means what its cards mean

**Paraphrase — "Yes to your recommendations".** `ward-management-network.tsx`'s service heading stops
summing raw allocatable.

## R-B-11 — The ward index stays names only

**Paraphrase — "Yes to your recommendations".** Settle the word (R-B-09) before touching the layout.

⚠️ **The restraint had NO traceable origin — verdict UNTRACEABLE, not inferred — and now has a real
ruling behind it.** A future reader must be able to tell _"ratified on 2026-09-04"_ from _"somebody
found the missing ruling"_. The retained stylesheet is now prepared work for a branch considered and
not taken, which is a better reason to keep it than the one it had.

---

## R-B-12 — Locked and authorised stay **two facts**

**Verbatim:** _"Go ahead with your recommendation being aware of when a unit is authorised vs
unauthorised."_ And on the categories: _"Keep it simple... just have Mixed wards, Open wards, Locked
wards as three categories."_

    lockedBeds === 0      -> Open
    lockedBeds === beds   -> Locked
    otherwise             -> Mixed        (a locked ward with some open beds)

**Derived, not stored, so nothing holds the truth twice.** `authorised` untouched as the separate
statutory fact.

🔴 **THIS OVERTURNS WARD LEAD'S EARLIER INSTRUCTION, AND THE ROUTE THERE IS WORTH KEEPING.** The owner
said "yes to your recommendation" (which was: keep them separate) and then "they are the same thing".
**Ward Lead noticed the disagreement, flagged it, and resolved it the wrong way** — picking the more
specific statement, which is usually the right rule and failed here because the specific statement was
about a NARROWER SUBJECT. They were never in conflict; the conflict was manufactured and then
resolved.

**Ward Builder Two refused the instruction and produced the counterexample:** `sjgs-adult-secure` is
`security: "Secure"` with `authorised: false` — a locked ward that is not an authorised hospital, which
is the real WA distinction. The gate reads `!authorisationNeeded || unit.authorised`, so a merge would
have made that ward pass for an involuntary patient. **The app would have offered a bed for a
detention that unit cannot lawfully hold — introduced by a change whose purpose was to remove a wrong
clinical answer.**

⚠️ **"Being aware of" is built as a TEST, not a note:** a locked ward with `authorised: false` must
fail the authorisation gate for an involuntary patient, **floored on the population** so that it fails
loudly rather than passing over an empty set. That ward is currently the only artefact in the
repository demonstrating the two facts can disagree; a fixture tidy-up would take the distinction with
it and nothing would go red.

---

## R-B-13 — Sex now; a human handles divergence

**Verbatim:** _"for now just stick with sex... if they identify as a different gender, the
ward/coordinator step in to check and decide"._

**The existing sex gate stays.** The on-screen statement he previously approved gets built, and it
now describes a real process rather than disclaiming an absence.

⚠️ **It must not ratify the free-text field.** `sexOrGender` is kept free text on the recorded grounds
that _"bed allocation depends on this"_ — **allocation never reads it**; it reads the closed `Sex`
enum. The sentence must be true of the field that decides, and the comment must say the free-text
field is not consulted.

---

## R-B-14 — The two withdrawal labels stay separate

**Paraphrase — "Yes to recommendations please".** A referral withdrawn by its referrer and one that
lapsed because another ward accepted are different things, and a ward deciding whether to keep holding
a bed needs to know which.

⚠️ **Raised because a blanket "go ahead with any recommendations" had approved merging them while the
reasoning against was not in front of him. That is not a considered ruling on the substance, and the
record should not pretend it was.**

---

## R-B-15 — "Suggested destination" is the right label

**Verbatim:** _"Yes suggested destination is the right label"._

**Note the pair:** a label claiming a comparison that never happened was wrong ("Top candidate"); a
label describing a coordinator's own unrecorded pick is right. **The distinction is whether the word
claims the SOFTWARE did something.**

---

## R-B-18 — The whole state

**Verbatim:** _"The whole state."_ Answering: are you one ward, one service, or the whole state?

**This unblocks the role-and-place foundation**, which is held only until the ward model change lands.

---

## Flagged for later, by him

- **R-B-16** — when the access-block clock starts.
- **R-B-17** — how much of a post-incident review comes from the software's own record.

---

## Not a ruling — a fact he was given

**This prototype contains real Western Australian data**: the catchment table is a transcription of
real tables (~537 rows, real postcodes, suburbs and clinic names, reconciling five source documents),
plus one real ward name he supplied. Two screens said everything was invented; both are corrected.

---

## Still outstanding from him

1. **The ED-discharge check** under R-B-06 — does anyone refer TO an emergency department as part of
   discharge planning?
2. **R-B-16 and R-B-17**, flagged by him for later.
