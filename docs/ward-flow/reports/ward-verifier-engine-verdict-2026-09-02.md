# THE ENGINE DOES NOT ENFORCE PLACEMENT — a recorded design decision, awaiting the owner

**Ward Verifier's independent check, committed by Ward Lead because Ward Verifier writes no file and
holds no branch.** Measured at master `86a24f2f2`. It executed nothing, moved no pin, wrote no file.

⚠️ **This is a DESIGN DECISION AWAITING AN ANSWER, not a defect awaiting a fix.** That framing is the
owner's own, relayed to Ward Lead through Ward Verifier: it is a design choice rather than a bug, it
is safe while a human is reading the screen, **and it should be written down as a deliberate choice
rather than left as something nobody had noticed.** ⚠️ **Ward Lead did not receive that instruction
from the owner directly and records it as relayed.**

The five things below are kept apart because they have **different standings**. Collapsing them is
how a checked fact and an open question end up quoted as one thing.

---

## ⚠️ 5. WHERE THIS CHECK STOPS — placed ABOVE the conclusion, deliberately

**Ward Verifier asked for this section to sit here rather than in a footnote, and the reason is
today's own record: four separate instances of a true result whose limits travelled less far than the
result did — two of them its own. A limit recorded below a verdict gets quoted without it.**

- **Static analysis only. Nothing was executed.** A call made through a variable, a dynamic dispatch,
  or a handler wired at runtime is **invisible** to this method.
- Depth 8, 84 files in `src/components/ward-management`, 419 indexed functions, comments stripped.
- **Only that tree was indexed.** A helper imported from elsewhere would have surfaced as unopened,
  and none did — **so this boundary is covered rather than merely declared.**
- Screens outside that tree were not examined, so §4 is bounded to it.
- ⚠️ **Nothing here observes behaviour.** The original document drove the real reducer at
  `f2abfba77`; this read code at `86a24f2f2`. **They agree, which is worth something. Two independent
  static-and-probe results agreeing is not a run.**

⚠️ **ONE CHEAP STEP REMAINS AND THIS RECORD WOULD BE MISREAD WITHOUT IT: re-run the original probe at
the current tip.** The forensic gate landed after `f2abfba77`. **That is a test, so it is not Ward
Verifier's — it belongs to Ward Lead or a builder.** Until it runs, this finding is well founded and
not fully settled.

---

## 1. THE ESTABLISHED FACT

**No path — direct or transitive — from `REFER_TO_UNITS`, `ACCEPT_IN_PRINCIPLE` or `PULL_PATIENT`
reaches `eligibility()` or `referralEligibility()`.**

```
ACCEPT_REFERRAL   (CONTROL)  reaches eligibility: YES   11 bodies opened, 22 names seen
REFER_TO_UNITS               reaches eligibility: NO      6 bodies opened, 12 names seen
ACCEPT_IN_PRINCIPLE          reaches eligibility: NO      6 bodies opened, 13 names seen
PULL_PATIENT                 reaches eligibility: NO     11 bodies opened, 25 names seen
```

The reducer is 2,721 lines and holds **exactly two textual eligibility references, only one of which
is a call** — `referralEligibility()` at line 2207, inside `ACCEPT_REFERRAL`. Structure identical at
`7c8b8c26c` and `86a24f2f2`, so **the claim is current, not historical**; the document was written
against `3b864698d` / `f2abfba77` and still holds.

**This upgrades the finding from a PRESENCE measurement to a RELATION**, so the claim is now better
founded than the document that made it. Presence is "zero occurrences in a line range". A code path
is a relation, and nobody had measured it until now.

### ⚠️ THE CONTROL FAILED FIRST, AND CATCHING IT IS THE MOST VALUABLE PART OF THIS REPORT

Ward Verifier's initial traversal reported the control YES and the three events NO — **while opening
zero function bodies.** Every callee scored "unresolvable", so the control passed **only** because
`referralEligibility` is a direct call at depth 0.

**That would have produced three confident negatives from a traversal that never traversed, and the
verdict would have looked exactly right.** It was caught on the `opened: 0` line, **not on the
verdict**. The traversal was rebuilt, self-tested (`bodyOf("referralEligibility")` resolves, 3,280
chars) and re-run. **The control now passes for the right reason: it opens real bodies and still
finds the known path.**

Ward Builder Two set that condition — validate the traversal against a call you have already proved
exists, or every negative it produces is worthless — and it was the right condition.

**Completeness of the negatives:** every name the trace could not open was checked against all 84
files — `find`, `map`, `filter`, `includes`, `some`, `every`, `min`, `max`, `floor`, `String`,
`isFinite`, `padStart`, `toLowerCase`, `test`, `replace`, `if`, `switch`, `movement`, `ready`,
`left`, `now`. **Not one is an application function.** They are built-ins, keywords the regex matched
on `if (`, and local variable names. **There is no unexplored application code in those three paths.**

---

## 2. THE DECISION, WHICH IS THE OWNER'S

**Should the engine refuse a placement nobody has explicitly overridden?**

**Unanswered. Nobody should build either way.** The owner's own framing, relayed: **a design choice,
not a bug.** This document exists so that it is a deliberate choice on the record rather than
something nobody had noticed.

---

## 3. WHY IT IS CURRENTLY SAFE — the record must say this or it reads as an emergency

**The coordinator's shortlist runs `eligibility()` and labels every candidate. A human reads that
label before acting.**

**The exposure is not that the software does the wrong thing on its own.** It is that **nothing
behind the screen would stop a mistake the screen had already advised against.**

---

## 4. ⚠️ ONE CLAUSE OF THE ORIGINAL DOCUMENT IS WITHDRAWN

`the-engine-enforces-nothing.md` says:

> _"any claim on any screen that implies the system prevents an unsuitable placement is currently
> false."_

**There is no such claim on any ward screen.** A search for that class of wording — prevent, cannot
be placed, not permitted, will not allow, blocks, ensures, guarantee, refuses — returns only doc
comments about event refusal, an internal claims-register entry, and `cannot_safely_prevent_leaving`,
which is a clinical reason label **about a patient**, not a claim about the software.

The vocabulary a false claim would actually live in is "eligible": **34 quoted strings, every one
descriptive of a candidate and none a promise of enforcement** — "Eligible now", "Not eligible",
"None eligible", "No eligible destination found yet.", and
`candidate.verdict.eligible ? "Eligible" : "Not eligible"` at `ward-management-console.tsx:352`,
`ward-management-modes.tsx:257`, `ward-management-network.tsx:1180`.

**As written, the sentence sends a reader hunting false statements that do not exist.**

### ⚠️ THE SHARPER TRUE VERSION, which replaces it

> **No screen claims the system prevents an unsuitable placement. The risk is the opposite shape —
> "Not eligible" is rendered directly beside a control that will proceed anyway, and nothing on the
> screen says which.**

**That is the real thing for the owner to decide about, and it is a stronger statement than the one
it replaces.**

---

## ⚠️ THE VERDICT — added at Ward Verifier's insistence, because this file did not contain it

**VERDICT: RIGHT on the mechanism. UNDERSTATED in one respect. OVERSTATED in one clause.**

- **RIGHT** — the engine does not enforce placement.
- **UNDERSTATED** — the original document proved **presence** and this check proved the **relation**,
  so the finding is **better founded than its own evidence supported**.
- **OVERSTATED** — no screen claims prevention. See §4 and the sharper replacement.

⚠️ **The understated half matters most and is the easiest to lose.** A reader who takes only "right"
will conclude the original document was already sufficient. **It was not.** It measured whether a
token appeared in a line range, which cannot answer a question about a code path. **That the two
agree is a fact about the codebase, not about the method.**

### How this omission was found, because it is the same failure the document is about

Ward Lead was asked, by name, for _"a judgement: overstated, understated, or right"_. Ward Verifier
gave a three-part one. **Ward Lead then wrote a 131-line record of the evidence and never stated the
judgement.** The title carried the conclusion — "the engine does not enforce placement" — and a title
is not a verdict: a reader learns what the engine does and **not what was concluded about the
document that claimed it**, which was the whole assignment.

Ward Verifier caught it by searching the committed file for `right|overstat|understat|verdict`,
getting **six hits all of them incidental prose** — "looked exactly right", "the right reason", "a
verdict gets quoted without it" — **with `eligibility` returning 10 as the control that the search
discriminates.** It checked the artefact rather than accepting that its own words had been carried,
which is the discipline it asked of everyone else all day and then applied to a document written in
its favour.
