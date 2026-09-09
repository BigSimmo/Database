# Ward Verifier — §6's ordering, tested

**Subject:** `docs/ward-flow/matching-engine-design-2026-09-04.md` at `645ef6f0b`.
**Test applied:** does contention-model-first defer a question whose answer would change the model?

**Answer: yes — and the deferred question is filed under a heading that hides that it is a modelling
question at all.** The sequence is right in principle. Contention genuinely is the missing primitive,
and putting the screen last is right. **But step 1 is not first. Two owner questions sit underneath
it, and neither is in §6.**

---

## 🔴 THE DEFERRED QUESTION: DOES SHOWING A SUGGESTION CONTEND?

§8.3 files this as _"whether a shown-but-not-acted-on suggestion is itself retained is a privacy and
retention question I have not answered."_

**Retention is its second consequence. Its first is that it decides what the contention model's
members are.**

- **If showing an arrangement provisionally holds beds** — so that two coordinators are not both
  offered the same bed — then a shown-but-unacted suggestion is **a contending object with a
  lifetime**, and the contention model must represent it, expire it, and resolve races between two
  shown arrangements.
- **If only acceptance contends**, the contention model reads acceptance state, which already exists
  as a discrete role-gated act (§5).

**Building step 1 without the answer means building one of them and discovering at step 4 which was
needed.**

### ⛔ REPRICED — "TWO DIFFERENT MODELS" WAS TOO EXPENSIVE, AND THE CORRECTION MATTERS

**Added after Ward Builder One challenged the cost. Verified by me at `14b6abf8a`, not relayed.**

I wrote that the two answers need two different models. **They do not, because the contention
relation is already blind to what kind of claim it is pairing.** `ward-contention.ts:244`:

```ts
// The only claim property this function reads. Never `kind`.
const competing = row.claims.filter((claim) => !claim.reflectedInAllocatable);
```

`contentionPairs` mentions `kind` nowhere in its body. **A fourth kind of claim pairs automatically.**

⚠️ **AND THE MODULE ALREADY ANTICIPATES THIS EXACT QUESTION IN WRITING** — `:211-214` names _"a
fourth kind — a shown suggestion that holds a…"_ and says **"do not add a `kind` test to it without
a ruling."** So the code has been deliberately written to wait for the owner's answer. **That is an
argument the question is ripe, not that it is cheap.**

**The honest price, which is still not free.** The relation needs no change. What one branch does
need is a new claim kind declaring whether it consumes the ward's number, **and a producer** —
something that pushes the claim when a suggestion is shown and removes it when the suggestion
expires. Claims are constructed at `ward-contention.ts:159` and `:165`; that is where the work lands,
and an expiring hold with a lifetime is real work. **The other branch needs nothing new at all.**

⚠️ **Why the reprice is worth making rather than quietly softening: a question priced higher than it
is gets answered under pressure.** Telling the owner this forks the build in two directions invites
him to pick the cheap-sounding one. **Telling him it is one new kind of claim on machinery that
already expects it lets him answer the clinical question on its merits** — does showing a bed to one
patient take it away from the next.

⚠️ **And the heading is what makes it invisible.** Filed under privacy and retention, it reads as a
question about how long to keep a log — answerable after the model exists. It is not. **A question
mis-filed by consequence is deferred by its filing, not by anyone's decision.**

---

## 🔴 A CONTRADICTION BETWEEN §4 AND §8.3, INDEPENDENT OF THE ORDERING

§4 states as a **requirement** that the event stream must distinguish, per patient:

> that a suggestion was shown, and what it was at the moment it was shown

§8.3 files as **open** whether a shown-but-not-acted-on suggestion is retained at all.

**If the owner answers §8.3 "do not retain", §4's first bullet is unsatisfiable.** And §4's own
argument is that without it, _"an arrangement plus a timestamp is the audit trail of (c) regardless
of which screen produced it"_ — so **shape (b) would become indistinguishable from the shape the
design rejects, in the record, by the owner answering a question filed as a retention detail.**

**One of the two sections has to move.** Either §4's bullet is conditional and must say so, or §8.3
is already answered by §4 and should be struck. **As written, the design requires a thing and
simultaneously lists whether to have that thing as open.**

---

## THE SECOND DEPENDENCY, WHICH IS MILDER

§8.1 — shape (a) or (b) — is genuinely open, and §6 step 2 is explicitly conditional on it
(_"so that (b) is representable and (c) is not"_). **Step 1 is presented as independent of it and is
not quite.** Under (a) contention holds between independent single-patient suggestions; under (b) it
holds between rows within an arrangement **and** across arrangements. The primitive is the same
idea; its members are not.

**This one is survivable** — a contention model built for (b) covers (a) as the one-row case. It is
worth one sentence in §6 saying so deliberately, rather than leaving a reader to assume independence.

---

## AN INVENTORY ERROR IN §5 THAT UNDERSTATES THE PROBLEM §7 IS ABOUT

§5 describes `eligibleCandidatesAmong()` as _"a cohort-matched, eligible-first list truncated to a
limit"_ and summarises ordering as _"by catchment then alphabetical."_

**It omits the second pass.** `ward-derivations.ts:707-716` applies a restrictiveness reorder after
the eligibility cut: a unit matching the movement's own security requirement is ranked ahead of one
flagged as tighter than required, with the code's own comment saying the tighter unit _"should not be
the one a coordinator is steered toward first."_ **That pass is fit-to-this-patient ordering — it is
the thing three shipped banners deny, and it is the reason §7's regulatory question is live now
rather than on delivery.**

⚠️ **A designer reading §5 would conclude the ranking does not yet exist and that §7 is about future
behaviour.** Measured, it exists today and reaches four surfaces. **§5 is the section that decides
how urgent §7 feels, and it currently reads reassuringly.**

---

## WHAT §6 SHOULD BE

Insert a **step 0, owner-only**, before the contention model:

1. **Does showing a suggestion contend?** One sentence from the owner. It decides whether step 1
   needs a provisional-hold primitive.
2. **Shape (b) or (a)?** Already §8.1; move it here, because step 2 cannot start without it.

**Both are cheap to ask now and expensive to discover at step 4.** Neither requires the owner to
understand the model — the first is "if the board shows you a bed for this patient, is that bed still
offered to the next patient?", which is a ward question, not a software one.

**And §6's own principle is what justifies this.** It already puts the record before the screen
_"deliberately"_, on the argument that building the screen first would let the screen decide what the
record contains. **The same argument applies one level up: building the contention model first lets
the model decide what "shown" means, and §4 has already committed to that meaning being observable.**
