# The network diagram — design

**Status:** design complete, nothing built. **Designed from Ward Verifier's browser report, never
from source** (`PROC-19`) — this page had not been touched since `3ab1f3dcc` on 26 August, so its
code is not evidence of what is on screen.

## The diagnosis, in the words that got it right

> **"It shows STATE and offers no ACTION."**

Health-service columns of ward cards. **Five bare unlabelled digits and a time per card, with the
legend somewhere else** — unreadable without first learning a code, and then re-learning it on every
visit.

⚠️ **The owner asked for a USE, not a restyle**, and that distinction is the whole design. **A
prettier diagram of the same state is still a diagram of state.** Making five digits legible would
be a real improvement to a screen that still would not answer a question anybody has.

## What it becomes

**Select a patient. The network answers one question: *where can this person go?***

- **Eligible wards light.**
- **Ineligible wards dim — with the gate that excluded them NAMED on the card.**

⚠️ **The gates already exist and already produce that reason.** `DECLINE_REASONS` carries
`sex_mix`, `no_bed`, `specialling_unavailable`, `acuity_mix`, `capability_mismatch`,
`out_of_catchment`, `bed_held_for_earlier_referral`. **This is not new logic; it is existing logic
made visible at the moment it matters.**

**That turns a picture of the network into the answer to the product's one job.** And it does
something no list can: **it shows the shape of the exclusion.** Six wards dimmed for `no_bed` is a
capacity problem. Six dimmed for `sex_mix` is a matching problem that may resolve this afternoon.
**A list of unavailable wards makes those look identical.**

## Why naming the gate is the load-bearing half

**Dimming alone would be worse than the current screen**, because it produces a confident answer with
no way to check it. **A clinician who cannot see WHY cannot tell a correct exclusion from a bug**,
and the first time a ward is dimmed that they know has a bed, the whole screen loses its authority.

⚠️ **Naming the gate makes the diagram falsifiable by the person reading it.** That is the same
property the two clocks give the ED hub (`P9-D2`) — **the useful information is not the state, it is
the reason for the state.**

## With no patient selected

**The current screen, unchanged in what it shows** — the network at rest. ⚠️ **It must not display a
default patient or the "first" patient**, because a diagram lit for somebody the reader did not
choose is indistinguishable from a diagram lit for the patient they think they selected.

**Empty selection means: no question has been asked.**

## The five digits

**A card carrying five unlabelled numbers and a time is a code, and the legend being elsewhere means
it must be memorised.** ⚠️ **The fix is not smaller labels — it is fewer numbers.** With a patient
selected, **most of those digits stop being the point**: the card's job becomes *can this person go
here, and if not, why not*.

**With no selection, the card shows what a person can read without a key.** ⚠️ **Same disease as the
capacity screen's bed-state row — six unlabelled digits under tiny headers — and the same
prescription: subtraction, not shrinking.**

## Refusals that apply

- **No invented threshold.** No "nearly full" colouring, no capacity band, no target — `P9-D3`.
- ⚠️ **No ranking of wards.** Eligible wards **light; they do not sort by desirability.** The
  standing refusal is that nothing may rank a **person**, and `CO-Q1` refuses ranking a **service**
  — **a "best match" ordering here would reintroduce both**: it ranks wards, and it ranks them *for
  this patient*.
- **No free-typed values.** The gate name is a chosen value from the existing union, never prose.
- **Nothing that looks like a recommendation.** ⚠️ **The diagram says where a patient MAY go. It
  must not say where they SHOULD** — that is a clinical decision and this is a prototype.

## Open, and not to be closed by building

- **Whether an ineligible ward can still be referred to.** `FD-24` says **nothing is locked out** and
  out-of-catchment is **greyed, not removed** — so dimming is presentation, not prohibition, and
  **a dimmed ward must remain selectable.** ⚠️ **A design that made dimming block selection would
  quietly reverse `FD-24`.**
- **Whether the diagram shows EDs and community teams**, now that a destination is a team and not
  only a place (`FD-15`). **Not ruled on.** The current screen is wards only.
